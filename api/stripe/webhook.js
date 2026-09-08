/**
 * POST /api/stripe/webhook — source de vérité de l'abonnement.
 *
 * - Vérification de la signature Stripe
 * - Corps brut obligatoire
 * - Idempotence des événements
 * - Mise à jour du plan uniquement côté serveur
 */

const Stripe = require('stripe');
const { sb } = require('../me.js');

module.exports.config = {
  api: {
    bodyParser: false
  }
};

const PLAN_BY_PRICE = () => ({
  [process.env.STRIPE_PRICE_PRO]: 'pro',
  [process.env.STRIPE_PRICE_ELITE]: 'elite',
});

const ACTIFS = ['active', 'trialing', 'past_due'];

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Renvoie false si cet événement Stripe a déjà été traité.
 */
async function premierPassage(event) {
  try {
    const rows = await sb('stripe_events', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=ignore-duplicates,return=representation'
      },
      body: JSON.stringify([
        {
          id: event.id,
          type: event.type
        }
      ]),
    });

    return rows.length > 0;
  } catch (e) {
    console.error('[webhook] verification idempotence impossible :', e.message);

    // On continue pour éviter de perdre définitivement un paiement.
    return true;
  }
}

/**
 * Si le traitement échoue après l'enregistrement de l'événement,
 * on retire l'événement afin que Stripe puisse réellement le rejouer.
 */
async function libererEvenement(eventId) {
  try {
    await sb(
      `stripe_events?id=eq.${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE'
      }
    );
  } catch (e) {
    console.error(
      '[webhook] impossible de liberer evenement :',
      eventId,
      e.message
    );
  }
}

async function appliquer(sub) {
  const priceId =
    sub.items?.data?.[0]?.price?.id || null;

  const plan =
    ACTIFS.includes(sub.status)
      ? (PLAN_BY_PRICE()[priceId] || 'free')
      : 'free';

  const userId =
    sub.metadata?.supabase_id || null;

  const customer =
    typeof sub.customer === 'string'
      ? sub.customer
      : sub.customer?.id;

  const patch = {
    plan,
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    stripe_price_id: priceId,

    subscription_current_period_end:
      sub.current_period_end
        ? new Date(
            sub.current_period_end * 1000
          ).toISOString()
        : null,

    cancel_at_period_end:
      Boolean(sub.cancel_at_period_end),

    updated_at:
      new Date().toISOString(),
  };

  let filtre;

  if (userId) {
    filtre =
      `id=eq.${encodeURIComponent(userId)}`;
  } else if (customer) {
    filtre =
      `stripe_customer_id=eq.${encodeURIComponent(customer)}`;
  } else {
    throw new Error(
      'Impossible d’identifier le profil Supabase'
    );
  }

  await sb(
    `profiles?${filtre}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch)
    }
  );
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('method not allowed');
  }

  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET;

  const stripeSecret =
    process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !stripeSecret) {
    return res.status(503).send('non configure');
  }

  const stripe =
    new Stripe(stripeSecret);

  let event;

  try {
    const buf =
      await rawBody(req);

    event =
      stripe.webhooks.constructEvent(
        buf,
        req.headers['stripe-signature'],
        webhookSecret
      );

  } catch (e) {
    console.error(
      '[webhook] signature invalide :',
      e.message
    );

    return res
      .status(400)
      .send('signature invalide');
  }

  const premier =
    await premierPassage(event);

  if (!premier) {
    return res.status(200).json({
      received: true,
      duplicate: true
    });
  }

  try {

    switch (event.type) {

      case 'checkout.session.completed': {
        const session =
          event.data.object;

        if (
          session.mode !== 'subscription' ||
          !session.subscription
        ) {
          break;
        }

        const sub =
          await stripe.subscriptions.retrieve(
            session.subscription
          );

        const supabaseId =
          session.client_reference_id ||
          session.metadata?.supabase_id;

        if (
          !sub.metadata?.supabase_id &&
          supabaseId
        ) {
          sub.metadata = {
            ...sub.metadata,
            supabase_id: supabaseId
          };
        }

        await appliquer(sub);

        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':

        await appliquer(
          event.data.object
        );

        break;

      case 'invoice.paid':
      case 'invoice.payment_failed': {

        const invoice =
          event.data.object;

        if (!invoice.subscription) {
          break;
        }

        const sub =
          await stripe.subscriptions.retrieve(
            invoice.subscription
          );

        await appliquer(sub);

        break;
      }

      default:
        break;
    }

  } catch (e) {

    console.error(
      '[webhook]',
      event.type,
      e.message
    );

    // Important :
    // Stripe va réessayer l'événement.
    // On retire donc son marqueur d'idempotence.
    await libererEvenement(event.id);

    return res
      .status(500)
      .send('erreur interne');
  }

  return res.status(200).json({
    received: true,
    type: event.type
  });
};
