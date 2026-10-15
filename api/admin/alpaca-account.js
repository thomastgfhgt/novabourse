/**
 * GET /api/admin/alpaca-account
 *
 * Lit l'état RÉEL (jamais une valeur supposée) du compte Alpaca lié à
 * l'utilisateur connecté — cherche d'abord sa ligne dans broker_accounts
 * (cache local), puis relit Alpaca directement pour le statut et le
 * pouvoir d'achat (source de vérité, §5.1 : "en cas d'écart, Alpaca
 * gagne"). Jamais de secret/token renvoyé.
 */

'use strict';

const { tradingActif, estAdmin } = require('../_alpaca/client.js');
const { recupererCompte, lireCompteTrading } = require('../_alpaca/accounts.js');

const SB = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function utilisateurDepuisJeton(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token || !SB || !ANON) return null;
  try {
    const r = await fetch(`${SB}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function sb(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  if (!r.ok) {
    const err = new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }
  res.setHeader('Cache-Control', 'no-store');

  if (!tradingActif()) {
    return res.status(200).json({ status: 'disabled' });
  }

  const user = await utilisateurDepuisJeton(req);
  if (!user || !estAdmin(user.email)) {
    return res.status(403).json({ error: 'acces_refuse' });
  }

  try {
    const lignes = await sb(`broker_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=alpaca_account_id,account_number,status&limit=1`);
    if (!lignes.length) {
      return res.status(200).json({ status: 'not_linked' });
    }

    const { alpaca_account_id } = lignes[0];
    const [compte, trading] = await Promise.all([
      recupererCompte(alpaca_account_id),
      lireCompteTrading(alpaca_account_id).catch(() => null),
    ]);

    return res.status(200).json({
      status: 'linked',
      accountNumber: compte.account_number,
      accountStatus: compte.status,
      buyingPower: trading ? trading.buying_power : null,
      cash: trading ? trading.cash : null,
      portfolioValue: trading ? trading.portfolio_value : null,
      currency: compte.currency,
    });
  } catch (e) {
    return res.status(200).json({ status: 'error', message: e.message });
  }
};
