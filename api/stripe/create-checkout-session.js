/**
 * POST /api/stripe/create-checkout-session
 * Corps attendu : { "plan": "pro" | "elite" }
 *
 * Le navigateur ne choisit jamais un prix ni un montant.
 * La correspondance plan → price_id reste exclusivement côté serveur.
 */

const Stripe = require('stripe');
const { userFromToken, sb } = require('../me.js');

const PRICE = {
  pro: 'STRIPE_PRICE_PRO',
  elite: 'STRIPE_PRICE_ELITE'
};

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.novabourse.site'
).replace(/\/+$/, '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'methode_non_autorisee'
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: 'stripe_non_configure'
    });
  }

  const user = await userFromToken(req);

  if (!user) {
    return res.status(401).json({
      error: 'non_connecte'
    });
  }

  const plan = String(
    (req.body && req.body.plan) || ''
  );

  if (!PRICE[plan]) {
    return res.status(400).json({
      error: 'plan_invalide',
      accepte: ['pro', 'elite']
    });
  }

  const price = process.env[PRICE[plan]];

  if (!price || !price.startsWith('price_')) {
    return res.status(503).json({
      error: 'prix_absent',
      variable: PRICE[plan]
    });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let profile = null;

  try {
    const rows = await sb(
      `profiles?id=eq.${encodeURIComponent(user.id)}&select=stripe_customer_id,stripe_subscription_id,subscription_status`
    );

    profile = rows[0] || null;
  } catch (e) {
    console.error('[checkout] lecture profil impossible :', e.message);

    return res.status(503).json({
      error: 'profil_indisponible'
    });
  }

  // Empêche de créer plusieurs abonnements actifs pour le même utilisateur.
  if (
    profile?.stripe_subscription_id &&
    ['active', 'trialing', 'past_due'].includes(profile.subscription_status)
  ) {
    return res.status(409).json({
      error: 'abonnement_deja_actif'
    });
  }

  let customer = profile?.stripe_customer_id || null;

  try {
    if (!customer) {
      const createdCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_id: user.id
        }
      });

      customer = createdCustomer.id;

      await sb(
        `profiles?id=eq.${encodeURIComponent(user.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            stripe_customer_id: customer
          })
        }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,

      line_items: [
        {
          price,
          quantity: 1
        }
      ],

      client_reference_id: user.id,

      metadata: {
        supabase_id: user.id,
        plan
      },

      subscription_data: {
        metadata: {
          supabase_id: user.id,
          plan
        }
      },

      success_url: `${SITE}/?paiement=ok`,
      cancel_url: `${SITE}/?paiement=annule`,

      allow_promotion_codes: true,
      locale: 'fr'
    });

    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json({
      url: session.url
    });

  } catch (e) {
    console.error('[checkout] Stripe :', e.message);

    return res.status(500).json({
      error: 'creation_checkout_impossible'
    });
  }
};
