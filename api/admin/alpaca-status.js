/**
 * GET /api/admin/alpaca-status
 *
 * Page admin "Test de connexion Alpaca" (§2 de la mission "Alpaca Sandbox
 * Trading") — réservée aux administrateurs (TRADING_ADMIN_EMAILS),
 * vérifiés côté serveur. Affiche UNIQUEMENT : statut, région, environnement,
 * latence, permissions vérifiées. Jamais de secret ni de token.
 *
 * Double porte, dans cet ordre :
 *   1) TRADING_ENABLED doit être 'true' (interrupteur général, §3) — sinon
 *      la fonctionnalité est invisible et répond "désactivée", quel que
 *      soit l'utilisateur.
 *   2) L'utilisateur authentifié doit figurer dans TRADING_ADMIN_EMAILS —
 *      sinon accès refusé, même avec TRADING_ENABLED=true (mode bêta, §3 :
 *      "le contrôle se fait côté serveur, pas seulement en masquant les
 *      boutons").
 *
 * Même motif d'authentification que api/me.js (userFromToken) — dupliqué
 * ici volontairement : ce module Alpaca ne doit dépendre d'aucun autre
 * fichier métier existant (cohérent avec api/market/_supabase.js, qui fait
 * le même choix pour la même raison).
 */

'use strict';

const {
  tradingActif,
  estAdmin,
  regionConfiguree,
  appelBroker,
} = require('../_alpaca/client.js');

const SB = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;

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

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  res.setHeader('Cache-Control', 'no-store');

  if (!tradingActif()) {
    return res.status(200).json({ status: 'disabled', message: 'Fonctionnalité désactivée.' });
  }

  const user = await utilisateurDepuisJeton(req);
  if (!user || !estAdmin(user.email)) {
    return res.status(403).json({ error: 'acces_refuse' });
  }

  const debut = Date.now();
  try {
    const r = await appelBroker('/v1/clock');
    const latencyMs = Date.now() - debut;

    if (!r.ok) {
      return res.status(200).json({
        status: 'error',
        region: regionConfiguree(),
        env: 'sandbox',
        latencyMs,
        httpStatus: r.status,
        permissionsVerified: [],
      });
    }

    await r.json(); // confirme une réponse JSON valide, jamais renvoyée telle quelle

    return res.status(200).json({
      status: 'connected',
      region: regionConfiguree(),
      env: 'sandbox',
      latencyMs,
      permissionsVerified: ['read:clock'],
    });
  } catch (e) {
    return res.status(200).json({
      status: 'error',
      region: regionConfiguree(),
      env: 'sandbox',
      message: e.code || 'erreur_inconnue',
    });
  }
};
