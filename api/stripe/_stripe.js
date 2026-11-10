/**
 * api/stripe/_stripe.js — client Stripe partagé, MODE TEST UNIQUEMENT.
 *
 * Préfixe "_" : jamais exposé comme route Vercel.
 *
 * Verrou inscrit dans LE CODE (jamais une variable Vercel) : tant que
 * PAIEMENT_REEL_AUTORISE vaut false, seule une clé de test
 * (sk_test_… ou rk_test_…) est acceptée. Une clé réelle mise par erreur
 * dans Vercel bloque le paiement au lieu de débiter une vraie carte.
 * Le lever exige un commit relu, après « OK mise en ligne » de Thomas.
 */

const Stripe = require('stripe');

const PAIEMENT_REEL_AUTORISE = false;

const SITE = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://novatitre.com'
).replace(/\/+$/, '');

/* Prix de l'offre Premium (identifiants price_… dans les variables
   Vercel). Le navigateur ne choisit jamais un prix ni un montant. */
const PRIX_PREMIUM = {
  mensuel: 'STRIPE_PRICE_PREMIUM_MENSUEL',
  annuel: 'STRIPE_PRICE_PREMIUM_ANNUEL',
};

const ESSAI_JOURS = 7;

function cleAutorisee(cle) {
  if (!cle) return false;
  if (/^(sk|rk)_test_/.test(cle)) return true;
  return PAIEMENT_REEL_AUTORISE && /^(sk|rk)_live_/.test(cle);
}

/* Client Stripe, ou null si la clé est absente ou interdite. */
function stripeAutorise() {
  const cle = process.env.STRIPE_SECRET_KEY;
  return cleAutorisee(cle) ? new Stripe(cle) : null;
}

/* Identifiant de prix → offre enregistrée dans profiles.plan. */
function offreDuPrix(priceId) {
  if (!priceId) return null;
  const premium = Object.values(PRIX_PREMIUM).map(v => process.env[v]).filter(Boolean);
  return premium.includes(priceId) ? 'premium' : null;
}

module.exports = {
  PAIEMENT_REEL_AUTORISE,
  SITE,
  PRIX_PREMIUM,
  ESSAI_JOURS,
  cleAutorisee,
  stripeAutorise,
  offreDuPrix,
};
