/**
 * POST /api/stripe/create-checkout-session
 * Corps attendu : { "plan": "mensuel" | "annuel" }
 *
 * Offre Premium de l'école : 7,99 € / mois ou 59,99 € / an, avec un essai
 * gratuit de 7 jours au premier abonnement (carte demandée au début, rien
 * n'est payé pendant l'essai).
 *
 * Le navigateur ne choisit jamais un prix ni un montant.
 * La correspondance plan → price_id reste exclusivement côté serveur.
 * MODE TEST UNIQUEMENT : voir api/stripe/_stripe.js.
 */

const { userFromToken, sb } = require('../me.js');
const { SITE, PRIX_PREMIUM, ESSAI_JOURS, stripeAutorise } = require('./_stripe.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'methode_non_autorisee'
    });
  }

  const stripe = stripeAutorise();

  if (!stripe) {
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

  if (!PRIX_PREMIUM[plan]) {
    return res.status(400).json({
      error: 'plan_invalide',
      accepte: Object.keys(PRIX_PREMIUM)
    });
  }

  const price = process.env[PRIX_PREMIUM[plan]];

  if (!price || !price.startsWith('price_')) {
    return res.status(503).json({
      error: 'prix_absent',
      variable: PRIX_PREMIUM[plan]
    });
  }

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

  // Empêche de créer plusieurs abonnements actifs pour le même élève.
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
      /* L'e-mail sert à Stripe pour envoyer les factures ; il n'est
         transmis à aucun autre service. */
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

    /* Essai gratuit : seulement si ce client n'a jamais eu d'abonnement
       (Stripe garde l'historique, aucune colonne de base en plus). */
    const anciens = await stripe.subscriptions.list({
      customer,
      status: 'all',
      limit: 1
    });

    const essai = anciens.data.length === 0;

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
        plan: 'premium',
        facturation: plan
      },

      subscription_data: {
        metadata: {
          supabase_id: user.id,
          plan: 'premium',
          facturation: plan
        },
        ...(essai ? { trial_period_days: ESSAI_JOURS } : {})
      },

      // Carte demandée dès le début, même pendant l'essai.
      payment_method_collection: 'always',

      success_url: `${SITE}/?paiement=ok`,
      cancel_url: `${SITE}/?paiement=annule`,

      allow_promotion_codes: true,
      locale: 'fr'
    });

    return res.status(200).json({
      url: session.url,
      essai
    });

  } catch (e) {
    console.error('[checkout] Stripe :', e.message);

    return res.status(500).json({
      error: 'creation_checkout_impossible'
    });
  }
};
