/**
 * api/_alpaca/client.js — Client Alpaca Broker API, Sandbox uniquement.
 *
 * Préfixe "_" (convention déjà en place, voir api/market/_providers.js) :
 * jamais exposé comme route Vercel.
 *
 * Garde-fous §2bis de la mission "Alpaca Sandbox Trading" :
 *   - Liste fermée de domaines écrite EN DUR ci-dessous (jamais lue depuis
 *     une variable d'environnement — une variable mal configurée ne doit
 *     jamais pouvoir l'élargir).
 *   - Comparaison stricte du nom d'hôte ET du chemin via new URL() — jamais
 *     une sous-chaîne. https obligatoire, aucun port personnalisé.
 *   - Une région = un seul couple de domaines (impossible de mélanger un
 *     domaine US avec ALPACA_BROKER_REGION=eu, ou l'inverse).
 *   - Redirections bloquées (redirect:'manual' sur CHAQUE requête réseau) :
 *     toute réponse 3xx est traitée comme une erreur, jamais suivie.
 *   - Verrou production inscrit en dur dans LE CODE (TRADING_ALLOWED_IN_PRODUCTION
 *     ci-dessous), jamais une variable Vercel — le lever exige un commit.
 *   - AUCUN chemin de code vers la production Alpaca n'existe dans ce
 *     fichier : pas de constante, pas de commentaire "à décommenter".
 *
 * Mécanisme d'authentification — confirmé par appel RÉEL en Phase 1 (audit),
 * jamais une supposition : OAuth 2.0 Client Credentials. Le secret est
 * transmis dans le CORPS de la requête (form-urlencoded, client_secret_post),
 * jamais dans l'en-tête Authorization (client_secret_basic, non supporté par
 * Alpaca). Token Bearer valide 900 secondes (confirmé par la réponse réelle).
 */

'use strict';

// Liste fermée des endpoints Sandbox autorisés — EN DUR, jamais depuis
// process.env. Paire US confirmée par appel réel (Phase 1). Paire EU
// déduite par symétrie documentaire UNIQUEMENT (jamais appelée ni testée :
// aucun identifiant EU disponible à ce jour) — présente pour que
// ALPACA_BROKER_REGION='eu' soit utilisable un jour sans élargir cette
// liste fermée elle-même ; si incorrecte, l'appel échoue proprement
// (domaine refusé ou 404), jamais un risque de sécurité.
const ENDPOINTS_AUTORISES = Object.freeze({
  us: Object.freeze({
    baseUrl: 'https://broker-api.sandbox.alpaca.markets',
    authUrl: 'https://authx.sandbox.alpaca.markets/v1/oauth2/token',
  }),
  eu: Object.freeze({
    baseUrl: 'https://broker-api.sandbox.eu.alpaca.markets',
    authUrl: 'https://authx.sandbox.eu.alpaca.markets/v1/oauth2/token',
  }),
});

// Verrou production — constante dans LE CODE. Le lever exige de modifier
// cette ligne (donc un commit + une revue), jamais une simple variable Vercel.
const TRADING_ALLOWED_IN_PRODUCTION = false;

function estEnvironnementProduction() {
  return process.env.VERCEL_ENV === 'production';
}

function verrouProductionActif() {
  return estEnvironnementProduction() && !TRADING_ALLOWED_IN_PRODUCTION;
}

/* À appeler en PREMIER dans toute route d'ordre ou de financement (Phases
   4/5) — lève une erreur bloquante si on tourne en production, quelles que
   soient les variables d'environnement (§2bis). Les routes de lecture
   restent de toute façon bloquées par tradingActif() ci-dessous tant que
   TRADING_ENABLED n'est pas 'true'. */
function verifierVerrouProduction() {
  if (verrouProductionActif()) {
    const err = new Error('alpaca_verrouille_en_production');
    err.code = 'PRODUCTION_LOCKED';
    throw err;
  }
}

/* Interrupteur général (§3) — défaut false partout. Toute route Alpaca,
   lecture ou écriture, doit appeler ceci avant d'agir. */
function tradingActif() {
  return process.env.TRADING_ENABLED === 'true';
}

/* Liste blanche admin/bêta (§3) — comparaison insensible à la casse,
   jamais de correspondance partielle (pas de .includes() sur la chaîne
   brute : un split + comparaison exacte par entrée). */
function estAdmin(email) {
  if (!email) return false;
  const liste = String(process.env.TRADING_ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return liste.includes(String(email).trim().toLowerCase());
}

function regionConfiguree() {
  const r = process.env.ALPACA_BROKER_REGION;
  return (r === 'us' || r === 'eu') ? r : null;
}

/* Compare une URL configurée à l'URL attendue : protocole https obligatoire,
   aucun port personnalisé, hôte EXACTEMENT identique (jamais une sous-chaîne
   comme "sandbox.alpaca.markets.exemple.com"). Pour un endpoint à chemin
   fixe (auth), le chemin doit aussi correspondre exactement ; pour une URL
   de base (chemin ajouté par l'appelant), le chemin configuré doit être vide
   ou '/'. */
function hoteEtCheminAutorises(urlConfiguree, urlAttendue) {
  if (!urlConfiguree || !urlAttendue) return false;
  let u, attendu;
  try {
    u = new URL(urlConfiguree);
    attendu = new URL(urlAttendue);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.port) return false;
  if (u.hostname !== attendu.hostname) return false;
  if (attendu.pathname === '/') {
    return u.pathname === '/' || u.pathname === '';
  }
  return u.pathname === attendu.pathname;
}

function endpointsAttendus() {
  const r = regionConfiguree();
  return r ? ENDPOINTS_AUTORISES[r] : null;
}

/* Valide la configuration complète — région, env, base URL, auth URL —
   d'un seul coup. Appelée au chargement ET avant CHAQUE appel réseau
   (défense en profondeur : une variable Vercel modifiée entre deux
   requêtes ne doit jamais passer inaperçue). Lève une erreur explicite,
   jamais un échec silencieux. */
function validerConfiguration() {
  if (process.env.ALPACA_BROKER_ENV !== 'sandbox') {
    throw new Error('alpaca_environnement_non_autorise');
  }
  const attendu = endpointsAttendus();
  if (!attendu) {
    throw new Error('alpaca_region_non_autorisee');
  }
  if (!hoteEtCheminAutorises(process.env.ALPACA_BROKER_BASE_URL, attendu.baseUrl)) {
    throw new Error('alpaca_base_url_non_autorisee');
  }
  if (!hoteEtCheminAutorises(process.env.ALPACA_BROKER_AUTH_URL, attendu.authUrl)) {
    throw new Error('alpaca_auth_url_non_autorisee');
  }
  return attendu;
}

/* fetch() avec redirection bloquée — toute réponse 3xx est une ERREUR,
   jamais suivie. Utilisée pour CHAQUE requête Alpaca, sans exception. */
async function fetchSansRedirection(url, init = {}) {
  const r = await fetch(url, { ...init, redirect: 'manual' });
  if (r.status >= 300 && r.status < 400) {
    const err = new Error('alpaca_redirection_refusee');
    err.code = 'REDIRECT_BLOCKED';
    err.status = r.status;
    throw err;
  }
  return r;
}

// Cache mémoire du token — vit tant que l'instance de fonction Vercel reste
// chaude ; une instance froide repart simplement d'un nouveau token (jamais
// un problème de correction, juste un appel réseau de plus).
let tokenCache = null;

/* Renouvelle le token AVANT expiration (marge de 30s), jamais à chaque
   appel (voir doc officielle : "Do not request a new access token for
   each API call"). Ne journalise jamais le token ni les identifiants. */
async function obtenirToken() {
  validerConfiguration();
  const maintenant = Date.now();
  if (tokenCache && tokenCache.expiresAt - maintenant > 30000) {
    return tokenCache.accessToken;
  }
  const clientId = process.env.ALPACA_BROKER_CLIENT_ID;
  const clientSecret = process.env.ALPACA_BROKER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('alpaca_identifiants_absents');
  }
  const corps = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const r = await fetchSansRedirection(process.env.ALPACA_BROKER_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: corps.toString(),
  });
  if (!r.ok) {
    const err = new Error('alpaca_authentification_echouee');
    err.status = r.status;
    throw err;
  }
  const data = await r.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 900) * 1000),
  };
  return tokenCache.accessToken;
}

/* Appel générique authentifié vers le Broker API Sandbox. `chemin` doit
   commencer par '/' (ex. '/v1/assets'). Ne journalise jamais le token. */
async function appelBroker(chemin, init = {}) {
  validerConfiguration();
  const token = await obtenirToken();
  const r = await fetchSansRedirection(`${process.env.ALPACA_BROKER_BASE_URL}${chemin}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  return r;
}

/* Réinitialise le cache de token — usage test uniquement (jamais appelé
   depuis une route). */
function _reinitialiserCachePourTests() {
  tokenCache = null;
}

module.exports = {
  ENDPOINTS_AUTORISES,
  TRADING_ALLOWED_IN_PRODUCTION,
  estEnvironnementProduction,
  verrouProductionActif,
  verifierVerrouProduction,
  tradingActif,
  estAdmin,
  regionConfiguree,
  hoteEtCheminAutorises,
  endpointsAttendus,
  validerConfiguration,
  fetchSansRedirection,
  obtenirToken,
  appelBroker,
  _reinitialiserCachePourTests,
};
