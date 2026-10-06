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
 * des fonctions dédiées de _providers.js (yahooSymbole, tdSymbol,
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

/* Historique : ce nom date d'une époque où EODHD, retiré depuis (voir git
   log, 2026-10-06), n'avait aucune convention de symbole vérifiée pour
   'commodity'. Les branches `if (type === 'commodity')` explicites,
   quelques lignes plus bas dans chaque cas, interceptent déjà ce type
   avant d'atteindre ce `.has()` — resté par prudence (inoffensif, jamais
   atteint), pas renommé pour limiter l'étendue de cette passe à EODHD
   uniquement. */
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
    /* CORRECTIF MAJEUR (2026-10-06) : Yahoo Finance devient le fournisseur
       PRINCIPAL pour quote/history/intraday (voir le grand commentaire
       "YAHOO FINANCE" dans _providers.js — vérifications empiriques +
       avertissement juridique sur l'usage commercial). EODHD/Twelve Data/
       Finnhub/Eulerpool restent dans la cascade mais SEULEMENT en tout
       dernier repli, jamais requis pour le fonctionnement normal :
       NovaTitre ne doit plus dépendre d'un fournisseur payant/à clé pour
       fonctionner (décision produit explicite). CoinGecko/Frankfurter/
       SEC EDGAR restent prioritaires là où ils l'étaient déjà (sources
       officielles/gratuites déjà éprouvées, aucune raison de les
       redescendre derrière Yahoo). */
    case 'quote':
      if (type === 'crypto') return ['coingecko', 'yahoo', 'twelvedata'];
      if (type === 'forex') return ['yahoo', 'frankfurter', 'twelvedata'];
      if (type === 'index') return ['yahoo', 'twelvedata'];
      /* commodity : XPD/USD, XPT/USD, XBR/USD (EODHD_COMMODITY_FOREX,
         _providers.js). Yahoo vérifié en direct pour XBR/USD (BZ=F,
         Brent) ; PA=F/PL=F (palladium/platine) suivent la même convention
         publique mais n'ont pas été re-vérifiés empiriquement cette
         session — Eulerpool (vérifié, mais payant) reste juste derrière
         au cas où Yahoo échouerait pour ces 2 tickers précis. */
      if (type === 'commodity') return ['yahoo', 'twelvedata', 'eulerpool', 'eulerpool_fx'];
      if (TYPES_SANS_SUFFIXE_EODHD.has(type)) return ['yahoo', 'twelvedata'];
      return ['yahoo', 'twelvedata', 'finnhub'];

    case 'history':
      if (type === 'crypto') {
        return coingeckoEligibleHistorique
          ? ['coingecko', 'yahoo', 'twelvedata']
          : ['yahoo', 'twelvedata'];
      }
      if (type === 'forex') return ['yahoo', 'frankfurter', 'twelvedata'];
      if (type === 'index') return ['yahoo', 'twelvedata'];
      if (type === 'commodity') return ['yahoo', 'twelvedata', 'eulerpool', 'eulerpool_fx'];
      if (TYPES_SANS_SUFFIXE_EODHD.has(type)) return ['yahoo', 'twelvedata'];
      return ['yahoo', 'twelvedata'];

    case 'intraday':
      if (type === 'crypto') return ['coingecko', 'yahoo', 'twelvedata'];
      /* Frankfurter n'a structurellement aucune donnée intraday (taux BCE
         quotidiens) — jamais inclus ici, contrairement au chemin history.
         Eulerpool non plus (commodity/quotes n'a aucune granularité
         infra-journalière confirmée) — absent du chemin intraday. */
      if (type === 'forex') return ['yahoo', 'twelvedata'];
      if (type === 'index') return ['yahoo', 'twelvedata'];
      if (type === 'commodity') return ['yahoo', 'twelvedata'];
      if (TYPES_SANS_SUFFIXE_EODHD.has(type)) return ['yahoo', 'twelvedata'];
      return ['yahoo', 'twelvedata'];

    case 'fundamentals':
      /* Aucune cryptomonnaie/paire de devises/indice/matière première n'a
         de bilan d'entreprise — les appelants (fundamentals.js) filtrent
         déjà ces types en amont ; cette règle reste cohérente si jamais
         appelée directement. Eulerpool en DERNIER repli : bug de
         production confirmé — EODHD refuse (HTTP 403, limite de PLAN, pas
         de symbole) les fondamentaux de plusieurs actions européennes
         (Hermès, LVMH, L'Oréal, SAP, Siemens...), et Finnhub ne couvre que
         les places US (finnhubAutorise) — sans Eulerpool, ces actions
         n'avaient AUCUN repli fonctionnel pour les fondamentaux, même
         schéma de défaut que le bug crypto/forex/indices déjà corrigé.
         SEC EDGAR (2026-09-28, voir _secEdgar.js) inséré AVANT Eulerpool :
         3e repli réellement indépendant pour les actions US (aucune clé,
         source officielle, jamais de limite de plan), placé avant
         Eulerpool qui a été vérifié/dimensionné pour les valeurs
         européennes, pas testé pour les US. Pour un ticker non-US, l'appel
         échoue proprement (ticker_non_reconnu_par_secedgar, aucun coût
         réseau après le premier index mis en cache 24h) et la cascade
         continue vers Eulerpool exactement comme avant.
         EODHD retiré (2026-10-06) : vérifié en direct sur 4 tickers réels
         (AAPL/MSFT/JPM/MC) — EODHD n'était JAMAIS la source effective des
         fondamentaux en production (toujours finnhub ou secedgar), ce
         retrait n'a donc aucun effet observable, seulement un appel
         réseau voué à l'échec évité à chaque fois. Les dates résultats/
         dividendes qu'EODHD aurait dû fournir (jamais vérifiées en direct,
         voir l'historique de ce fichier) viennent maintenant de
         _nasdaqCalendar.js (voir fundamentals.js), une source réellement
         vérifiée en direct.
         Yahoo (2026-10-06) inséré APRÈS secedgar : secedgar reste
         prioritaire pour les US (officiel, zéro clé, déjà fiable) ; Yahoo
         complète pour les valeurs EUROPÉENNES qu'Eulerpool couvrait seul
         jusqu'ici (voir le commentaire plus haut) — mais Yahoo est LE PLUS
         FRAGILE des 2 (flux cookie+crumb, voir FUNDAMENTALS.yahoo dans
         _providers.js), d'où sa position après secedgar plutôt qu'avant.
         finnhub/eulerpool (payants/à clé) redescendus en tout dernier
         repli, jamais requis pour le fonctionnement normal. */
      return TYPES_AVEC_FONDAMENTAUX.has(type) ? ['secedgar', 'yahoo', 'finnhub', 'eulerpool'] : [];

    case 'news':
      /* EODHD était l'UNIQUE fournisseur ici (retiré le 2026-10-06, voir
         git log) — sans aucun repli possible. Yahoo (NEWS.yahoo,
         _providers.js) le remplace, gratuit, sans clé. */
      return TYPES_AVEC_ACTUALITES.has(type) ? ['yahoo'] : [];

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
