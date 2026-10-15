/**
 * POST /api/admin/alpaca-link-account
 *
 * Lie le compte Alpaca Sandbox déjà créé (Phase 3, test réel du
 * 2026-10-15) à l'utilisateur NovaTitre RÉELLEMENT connecté — le user_id
 * est TOUJOURS dérivé du jeton Supabase de la requête, jamais choisi/
 * deviné côté serveur (§4 : "au plus un compte Alpaca Sandbox,
 * uniquement au sien"). Idempotent : un second appel pour le même
 * utilisateur met juste à jour le statut, ne crée jamais de doublon
 * (contrainte unique sur broker_accounts.user_id, voir
 * sql/2026-10-15_broker_accounts.sql).
 *
 * Même double porte que alpaca-status.js : TRADING_ENABLED puis
 * TRADING_ADMIN_EMAILS — ce lien n'est PAS encore une fonctionnalité
 * grand public (pas de parcours de saisie d'identité réelle), réservé
 * admin pour l'instant.
 */

'use strict';

const {
  tradingActif,
  estAdmin,
  regionConfiguree,
} = require('../_alpaca/client.js');
const { recupererCompte } = require('../_alpaca/accounts.js');

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

async function sb(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
      ...(init.headers || {}),
    },
  });
  if (!r.ok) {
    const err = new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  const text = await r.text();
  return text ? JSON.parse(text) : [];
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

  const { alpacaAccountId } = req.body || {};
  if (!alpacaAccountId) {
    return res.status(400).json({ error: 'alpaca_account_id_requis' });
  }

  try {
    const compte = await recupererCompte(alpacaAccountId);

    await sb('broker_accounts?on_conflict=user_id', {
      method: 'POST',
      body: JSON.stringify([{
        user_id: user.id,
        alpaca_account_id: compte.id,
        account_number: compte.account_number,
        region: regionConfiguree(),
        env: 'sandbox',
        status: compte.status,
        updated_at: new Date().toISOString(),
      }]),
    });

    return res.status(200).json({
      status: 'linked',
      alpacaAccountId: compte.id,
      accountNumber: compte.account_number,
      accountStatus: compte.status,
    });
  } catch (e) {
    return res.status(200).json({ status: 'error', message: e.message });
  }
};
