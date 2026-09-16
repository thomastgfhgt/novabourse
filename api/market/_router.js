/**
 * api/market/_router.js — ROUTAGE PAR TYPE D'ACTIF ET TYPE DE DONNÉE
 *
 * Point UNIQUE qui décide, pour un instrument (assetType NovaBourse) et un
 * type de donnée (quote/history/intraday/fundamentals/news), quels
 * fournisseurs tenter et dans quel ordre. Remplace les règles dupliquées
 * qui existaient indépendamment dans company.js, history.js, quotes.js,
 * fundamentals.js et news.js (même logique réécrite plusieurs fois, avec
 * un vrai risque de divergence silencieuse entre les copies).
 *
 * Ne décide JAMAIS du symbole envoyé à un fournisseur — ça reste le rôle
 * des fonctions dédiées de _providers.js (eodhdSymbolPourType, tdSymbol,
 * coingeckoRef, frankfurterRef) — uniquement de L'ORDRE de la cascade.
 *
 * Deux couches combinées pour produire l'ordre final :
 *   1. RÈGLE STATIQUE par assetType/dataType (ordreStatique) — ce que ce
 *      backend sait, par construction, chaque fournisseur savoir faire.
 *   2. MÉMOIRE DE ROUTAGE (section "fallback sans explosion du nombre
 *      d'appels" du cahier des charges) : si un fournisseur a répondu avec
 *      succès récemment pour CET instrument précis et CE type de donnée
 *      précis, il est essayé EN PREMIER — sans jamais retirer les autres
 *      de la cascade, seulement les repousser après lui. S'il échoue à
 *      son tour (quota épuisé entre-temps, panne), la cascade continue
 *      normalement et la mémoire est mise à jour avec le nouveau
 *      fournisseur qui a réellement réussi. Ce n'est donc jamais "on saute
 *      un fournisseur" — seulement "on essaie d'abord celui qui a le plus
 *      de chances, d'après ce qu'on a observé récemment".
 */

const { COINGECKO_JOURS_MAX } = require('./_providers.js');

/* Aucune convention EODHD vérifiée pour ce type (voir _providers.js,
   eodhdSymbolPourType) — cohérent avec history.js/company.js. 'index' n'en
   fait plus partie : eodhdIndexSymbol() (".INDX", convention EODHD
   documentée) a été ajouté — restait auparavant exclusivement dépendant de
   Twelve Data, exactement le même défaut architectural qui causait le bug
   crypto/forex d'origine (un seul fournisseur, aucun repli). */
const TYPES_SANS_SUFFIXE_EODHD = new Set(['commodity']);
const TYPES_AVEC_FONDAMENTAUX = new Set(['stock', 'etf']);
const TYPES_AVEC_ACTUALITES = new Set(['stock', 'etf']);

/**
 * Identifiant canonique d'un instrument — utilisé UNIQUEMENT comme clé de
 * mémoire de routage/diagnostic, jamais pour construire un symbole
 * fournisseur (ça reste le rôle des fonctions dédiées de _providers.js).
 * Même forme que idDe() dans _providers.js (ticker@exchange), avec le
 * type en plus pour distinguer un même ticker utilisé par deux assetTypes
 * différents (rare mais possible : ex. un ticker catalogue et sa version
 * crypto ne doivent jamais partager une mémoire de routage).
 */
function instrumentKey(ticker, exchange, type) {
  return `${String(ticker || '').toUpperCase()}@${String(exchange || '').toUpperCase()}@${String(type || 'stock').toLowerCase()}`;
}

/* ============================================================
   RÈGLE STATIQUE PAR TYPE D'ACTIF / TYPE DE DONNÉE
   ============================================================ */

/**
 * @param {'quote'|'history'|'intraday'|'fundamentals'|'news'} dataType
 * @param {string} type - assetType NovaBourse (stock/etf/crypto/forex/index/commodity)
 * @param {object} [opts]
 * @param {number} [opts.jours] - fenêtre demandée en jours (history uniquement) ;
 *   omis = chemin par défaut non paramétré par période (toujours ≤365j
 *   utiles, voir MAX_HISTORY_POINTS côté history.js/company.js).
 * @returns {string[]} ordre de cascade — jamais fabriqué, peut être vide
 *   (aucun fournisseur pertinent pour cette combinaison).
 */
function ordreStatique(dataType, type, opts = {}) {
  const { jours } = opts;
  /* CoinGecko (API publique gratuite) rejette systématiquement (HTTP 401,
     error_code 10012 — vérifié en production) toute requête d'historique
     au-delà de 365 jours. L'exclure de la cascade AVANT l'appel réseau
     pour une période longue évite un appel voué à l'échec à coup sûr. */
  const coingeckoEligibleHistorique = jours === undefined || jours <= COINGECKO_JOURS_MAX;

  switch (dataType) {
    case 'quote':
      if (type === 'crypto') return ['coingecko', 'twelvedata', 'eodhd'];
      if (type === 'forex') return ['twelvedata', 'eodhd', 'frankfurter'];
      /* index : eodhdIndexSymbol() (".INDX") ajouté — plus un seul point de
         défaillance sur Twelve Data (voir _providers.js pour la
         justification et l'avertissement "à vérifier empiriquement").
         Jamais Finnhub (incompatible par construction, voir
         TYPES_INCOMPATIBLES_FINNHUB dans _providers.js). */
      if (type === 'index') return ['twelvedata', 'eodhd'];
      if (TYPES_SANS_SUFFIXE_EODHD.has(type)) return ['twelvedata'];
      return ['twelvedata', 'eodhd', 'finnhub'];

    case 'history':
      if (type === 'crypto') {
        return coingeckoEligibleHistorique ? ['coingecko', 'eodhd', 'twelvedata'] : ['eodhd', 'twelvedata'];
      }
      if (type === 'forex') return ['eodhd', 'twelvedata', 'frankfurter'];
      if (type === 'index') return ['eodhd', 'twelvedata'];
      if (TYPES_SANS_SUFFIXE_EODHD.has(type)) return ['twelvedata'];
      return ['eodhd', 'twelvedata'];

    case 'intraday':
      if (type === 'crypto') return ['coingecko', 'twelvedata', 'eodhd'];
      /* Frankfurter n'a structurellement aucune donnée intraday (taux BCE
         quotidiens) — jamais inclus ici, contrairement au chemin history. */
      if (type === 'forex') return ['twelvedata', 'eodhd'];
      if (type === 'index') return ['twelvedata', 'eodhd'];
      if (TYPES_SANS_SUFFIXE_EODHD.has(type)) return ['twelvedata'];
      return ['twelvedata', 'eodhd'];

    case 'fundamentals':
      /* Aucune cryptomonnaie/paire de devises/indice/matière première n'a
         de bilan d'entreprise — les appelants (fundamentals.js) filtrent
         déjà ces types en amont ; cette règle reste cohérente si jamais
         appelée directement. */
      return TYPES_AVEC_FONDAMENTAUX.has(type) ? ['eodhd', 'finnhub'] : [];

    case 'news':
      return TYPES_AVEC_ACTUALITES.has(type) ? ['eodhd'] : [];

    default:
      return [];
  }
}

/* ============================================================
   MÉMOIRE DE ROUTAGE
   ============================================================ */

/* Table séparée du cache de données (_cache.js) : ici on mémorise
   uniquement QUEL FOURNISSEUR a fonctionné, pour réordonner la cascade —
   jamais pour en sauter. Mémoire processus (mêmes limites documentées que
   _cache.js : un allègement, pas une garantie distribuée) et TTL modéré :
   un fournisseur qui redevient indisponible (quota épuisé, panne) doit
   être redécouvert sans attendre trop longtemps. */
const MEMOIRE = new Map();
const MEMOIRE_TTL_MS = 30 * 60 * 1000; // 30 min
const MEMOIRE_TAILLE_MAX = 5000;

const cleMemoire = (dataType, cle) => `${dataType}:${cle}`;

function fournisseurMemorise(dataType, cle) {
  const k = cleMemoire(dataType, cle);
  const hit = MEMOIRE.get(k);
  if (!hit) return null;
  if (Date.now() - hit.at >= MEMOIRE_TTL_MS) { MEMOIRE.delete(k); return null; }
  return hit.provider;
}

function memoriserFournisseur(dataType, cle, provider) {
  if (!provider) return;
  MEMOIRE.set(cleMemoire(dataType, cle), { provider, at: Date.now() });
  if (MEMOIRE.size > MEMOIRE_TAILLE_MAX) {
    const vieux = [...MEMOIRE.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 1000);
    for (const [k] of vieux) MEMOIRE.delete(k);
  }
}

/**
 * Ordre final de cascade pour UN instrument précis : la règle statique
 * (ordreStatique), réordonnée pour essayer EN PREMIER le fournisseur
 * mémorisé comme ayant fonctionné récemment pour cet instrument+dataType
 * — uniquement s'il fait partie de la liste statique. Ne retire jamais
 * aucun fournisseur ; renvoie la règle statique telle quelle en l'absence
 * de mémoire valide.
 *
 * @param {'quote'|'history'|'intraday'|'fundamentals'|'news'} dataType
 * @param {string} ticker
 * @param {string|null} exchange
 * @param {string} type - assetType NovaBourse
 * @param {object} [opts] - voir ordreStatique (ex. { jours })
 */
function resolveOrdre(dataType, ticker, exchange, type, opts = {}) {
  const base = ordreStatique(dataType, type, opts);
  if (!base.length) return base;

  const memo = fournisseurMemorise(dataType, instrumentKey(ticker, exchange, type));
  if (!memo || !base.includes(memo)) return base;

  return [memo, ...base.filter(p => p !== memo)];
}

/**
 * À appeler après CHAQUE tentative de cascade (succès ou non) pour tenir
 * la mémoire à jour : `source` vaut null quand tous les fournisseurs ont
 * échoué — dans ce cas on n'enregistre rien plutôt que de mémoriser une
 * absence.
 */
function noterResultat(dataType, ticker, exchange, type, source) {
  if (!source) return;
  memoriserFournisseur(dataType, instrumentKey(ticker, exchange, type), source);
}

module.exports = {
  instrumentKey,
  ordreStatique,
  resolveOrdre,
  noterResultat,
  fournisseurMemorise,
  memoriserFournisseur,
  TYPES_SANS_SUFFIXE_EODHD,
  TYPES_AVEC_FONDAMENTAUX,
  TYPES_AVEC_ACTUALITES,
};
