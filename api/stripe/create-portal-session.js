/**
 * POST /api/stripe/create-portal-session
 * Espace client Stripe (« Gérer mon abonnement ») : factures, moyen de
 * paiement, résiliation en ligne.
 * MODE TEST UNIQUEMENT : voir api/stripe/_stripe.js.
 */
const { userFromToken, sb } = require('../me.js');
const { SITE, stripeAutorise } = require('./_stripe.js');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' });

  const stripe = stripeAutorise();
  if (!stripe) return res.status(503).json({ error: 'stripe_non_configure' });

  const user = await userFromToken(req);
  if (!user) return res.status(401).json({ error: 'non_connecte' });

  const rows = await sb(`profiles?id=eq.${encodeURIComponent(user.id)}&select=stripe_customer_id`).catch(() => []);
  const customer = rows[0]?.stripe_customer_id;
  if (!customer) return res.status(404).json({ error: 'aucun_abonnement' });

  try {
    const s = await stripe.billingPortal.sessions.create({ customer, return_url: SITE, locale: 'fr' });
    return res.status(200).json({ url: s.url });
  } catch (e) {
    console.error('[portail] Stripe :', e.message);
    return res.status(500).json({ error: 'portail_indisponible' });
  }
};
