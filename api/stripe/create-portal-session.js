/**
 * POST /api/stripe/create-portal-session
 * Portail client Stripe : factures, moyen de paiement, résiliation.
 */
const Stripe = require('stripe');
const { userFromToken, sb } = require('../me.js');
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.novabourse.site').replace(/\/+$/, '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'stripe_non_configure' });

  const user = await userFromToken(req);
  if (!user) return res.status(401).json({ error: 'non_connecte' });

  const rows = await sb(`profiles?id=eq.${user.id}&select=stripe_customer_id`).catch(() => []);
  const customer = rows[0]?.stripe_customer_id;
  if (!customer) return res.status(404).json({ error: 'aucun_abonnement' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const s = await stripe.billingPortal.sessions.create({ customer, return_url: SITE, locale: 'fr' });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ url: s.url });
};
