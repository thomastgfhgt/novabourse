/**
 * GET /api/market/history?ticker=X&exchange=Y&type=Z[&fresh=1]
 * GET /api/market/history?ticker=X&exchange=Y&type=Z&period=1a[&interval=1h][&fresh=1]
 *
 * Historique OHLCV seul (sans cotation ni fondamentaux), destiné au
 * chargement à la demande côté frontend (bouton "Voir le graphique").
 *
 * SANS `period` : comportement STRICTEMENT INCHANGÉ (compatibilité totale
 * avec l'existant — même cascade, même cache, mêmes ~260 points quotidiens),
 * à l'exception de l'ajout PUREMENT ADDITIF de `freshness`/`provenance`
 * (voir _freshness.js) au corps de la réponse.
 *
 * AVEC `period` : chemin paramétré multi-période/intraday. Périodes
 * disponibles ci-dessous (PERIOD_SPECS) — chacune choisit une granularité
 * réaliste (intraday réel pour les périodes courtes, quotidien pour les
 * longues) sans jamais fabriquer une donnée absente. Un `interval` explicite
 * (1min/5min/15min/30min/1h) peut surcharger la granularité par défaut d'une
 * période intraday.
 *
 * CORRECTIF (audit routage multi-actifs — bug de production confirmé) :
 * crypto/forex utilisent désormais EODHD avec le VRAI symbole de ce
 * fournisseur pour ces types (voir eodhdSymbolPourType() dans
 * _providers.js : "BTC-USD.CC", "EURUSD.FOREX" — vérifiés empiriquement en
 * direct, pas depuis la seule documentation, y compris sur /intraday/).
 * Avant ce correctif, crypto/forex étaient réduits à Twelve Data SEUL, sans
 * aucun repli : un simple HTTP 429 (quota) chez Twelve Data rendait alors
 * TOUTE la classe d'actif indisponible d'un coup. C'est la cause racine du
 * bug "ALGO/USD cours indisponible" / "ATOM/USD historique indisponible" :
 * ni l'un ni l'autre n'a de rapport avec le ticker lui-même (vérifié : les
 * deux existent bien chez Twelve Data), c'est l'absence de repli
 * fonctionnel qui posait problème.
 *
 * 'index'/'commodity' restent sur Twelve Data seul : aucune convention
 * EODHD n'a pu être vérifiée pour ces deux types, donc EODHD reste
 * explicitement retiré de leur cascade plutôt que d'envoyer un symbole non
 * vérifié.
 *
 * Aucune donnée n'est jamais inventée :
 *   - période demandée mais fournisseur incapable => history: null, reason explicite ;
 *   - historique vide est indisponible, jamais une série synthétique ;
 *   - intraday jamais reconstruit à partir de clôtures quotidiennes.
 */

const { HISTORY, INTRADAY, INTRADAY_MINUTES, KEYS, COINGECKO_JOURS_MAX } = require('./_providers.js');
const { chargerBloc, historiqueValide } = require('./_marketBlock.js');
const { normaliserTicker, normaliserExchange } = require('./company.js');

/* Identique à company.js : ~260 séances = un peu plus d'un an de
   cotations quotidiennes. S'applique UNIQUEMENT au chemin par défaut
   (sans `period`), pour compatibilité stricte avec l'existant. */
const MAX_HISTORY_POINTS = 260;

/* Plafond de sécurité sur le nombre de barres intraday renvoyées (une
   estimation d'outputsize trop large ne doit jamais produire une réponse
   disproportionnée). Les périodes quotidiennes ne sont pas replafonnées
   ici : leur taille est déjà bornée par `jours` (voir PERIOD_SPECS) et
   par joursHistorique() côté _providers.js (max 5000). */
const MAX_INTRADAY_POINTS = 1500;

/* Types pour lesquels EODHD n'a AUCUNE convention de symbole vérifiée
   (voir eodhdSymbolPourType() dans _providers.js) : y envoyer un appel
   n'a pas de sens, quel que soit le chemin (défaut/quotidien/intraday).
   crypto/forex EN FONT DÉSORMAIS PARTIE côté couverture (ils ont une
   convention EODHD vérifiée : "BTC-USD.CC" / "EURUSD.FOREX") — seul
   index/commodity restent sans repli EODHD. */
const TYPES_SANS_SUFFIXE_EODHD = new Set(['index', 'commodity']);

/* Ordre de cascade historique/intraday, dépendant du type d'instrument :
 *   - crypto : CoinGecko (gratuit, sans clé, indépendant des quotas payants
 *     — voir _providers.js) EN PREMIER, préserve le quota EODHD/Twelve Data
 *     pour les types qui n'ont pas d'alternative gratuite. EODHD/Twelve Data
 *     restent en repli réel si CoinGecko ne reconnaît pas ce ticker precis.
 *     BUG DE PRODUCTION CONFIRMÉ (voir rapport) : CoinGecko rejette (HTTP
 *     401, error_code 10012) toute requête d'historique au-delà de 365
 *     jours en API publique gratuite — un fait vérifié en production, pas
 *     une supposition. `jours` (voir plus bas) permet donc d'exclure
 *     CoinGecko de la cascade AVANT même l'appel réseau quand la période
 *     demandée dépasse cette limite (2A/5A/10A/MAX) : un appel qu'on sait
 *     déjà voué à l'échec ne doit jamais être tenté (coûte une latence et
 *     un aller-retour pour rien). Le chemin PAR DÉFAUT (n=400, `jours`
 *     omis ici) reste éligible sans condition : coingeckoMarketChart()
 *     plafonne alors proprement à 365 jours réels, largement suffisant
 *     pour les 260 points que ce chemin garde de toute façon
 *     (MAX_HISTORY_POINTS ci-dessus).
 *   - forex : Frankfurter (gratuit, sans clé) en DERNIER repli seulement,
 *     jamais en tête — contrairement à CoinGecko, ses taux ne sont publiés
 *     qu'une fois par jour (voir _freshness.js), qualité inférieure à
 *     EODHD/Twelve Data pour tout ce qu'ils couvrent déjà. Absent du chemin
 *     intraday : Frankfurter n'a structurellement aucune donnée intraday.
 *   - index/commodity : aucune convention EODHD vérifiée, ni CoinGecko ni
 *     Frankfurter ne sont des sources pertinentes -> Twelve Data seul.
 *   - stock/etf : EODHD/Twelve Data, ordre historique inchangé (intraday
 *     privilégie Twelve Data en tête, daily privilégie EODHD en tête —
 *     comportement préexistant, non modifié ici).
 *
 * @param {number|null} [jours] - nombre de jours réellement demandés pour le
 *   chemin quotidien paramétré (PERIOD_SPECS) ; omis (undefined) pour le
 *   chemin par défaut, qui n'a pas cette notion de période explicite.
 */
function ordreHistoriquePourType(type, { intraday, jours } = {}) {
  const coingeckoEligible = jours === undefined || jours <= COINGECKO_JOURS_MAX;

  if (type === 'crypto') {
    if (intraday) return ['coingecko', 'twelvedata', 'eodhd'];
    return coingeckoEligible ? ['coingecko', 'eodhd', 'twelvedata'] : ['eodhd', 'twelvedata'];
  }
  if (type === 'forex') {
    return intraday ? ['twelvedata', 'eodhd'] : ['eodhd', 'twelvedata', 'frankfurter'];
  }
  if (TYPES_SANS_SUFFIXE_EODHD.has(type)) return ['twelvedata'];
  return intraday ? ['twelvedata', 'eodhd'] : ['eodhd', 'twelvedata'];
}

/**
 * Une période "réellement exploitable" au sens du cahier des charges :
 * granularité choisie pour rester représentative de la période (jamais
 * un faux intraday reconstruit depuis du quotidien, jamais un "MAX"
 * tronqué silencieusement à un an).
 */
const PERIOD_SPECS = {
  '1j':  { kind: 'intraday', interval: '5min',  jours: 1 },
  '5j':  { kind: 'intraday', interval: '15min', jours: 5 },
  '1s':  { kind: 'intraday', interval: '30min', jours: 7 },
  '1m':  { kind: 'intraday', interval: '1h',    jours: 30 },
  '3m':  { kind: 'daily', jours: 90 },
  '6m':  { kind: 'daily', jours: 180 },
  'ytd': { kind: 'daily', jours: null }, // calculé dynamiquement
  '1a':  { kind: 'daily', jours: 365 },
  '2a':  { kind: 'daily', jours: 730 },
  '5a':  { kind: 'daily', jours: 1825 },
  '10a': { kind: 'daily', jours: 3650 },
  'max': { kind: 'daily', jours: 5000 },
};

function joursYTD(){
  const maintenant = new Date();
  const debutAnnee = Date.UTC(maintenant.getUTCFullYear(), 0, 1);
  return Math.max(1, Math.ceil((Date.now() - debutAnnee) / 86400000) + 1);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const ticker = normaliserTicker(req.query?.ticker);
  if (!ticker) return res.status(400).json({ error: 'ticker_invalide' });

  const exchange = normaliserExchange(req.query?.exchange);
  const frais = req.query?.fresh === '1';
  const type = String(req.query?.type || 'stock').toLowerCase();
  const periodeBrute = req.query?.period ? String(req.query.period).toLowerCase() : null;

  const keys = KEYS();
  /* `keys.coingecko`/`keys.frankfurter` inclus : un déploiement sans AUCUNE
     clé payante peut tout de même servir l'historique crypto via CoinGecko
     seul, ou forex via Frankfurter seul (voir ordreHistoriquePourType) —
     ne jamais 503 ce cas prématurément ici. */
  if (!keys.eodhd && !keys.twelvedata && !keys.finnhub && !keys.coingecko && !keys.frankfurter) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  /* ================= CHEMIN PAR DÉFAUT (compat stricte) ================= */
  if (!periodeBrute) {
    const ordre = ordreHistoriquePourType(type, { intraday: false });

    if (!ordre.some(p => keys[p])) {
      return res.status(503).json({ error: 'aucun_fournisseur_configure' });
    }

    const journal = [];
    const h = await chargerBloc({
      nom: 'history',
      table: HISTORY,
      ordre,
      args: [ticker, exchange, 400, type],
      ticker, exchange, frais, journal,
    });

    const aHistory = historiqueValide(h.data);

    let history = null;
    if (aHistory) {
      const ohlcv = h.data.slice(-MAX_HISTORY_POINTS);
      history = { points: ohlcv.length, availablePoints: h.data.length, ohlcv };
    }

    return res.status(200).json({
      ticker,
      exchange,
      history,
      source: aHistory ? h.source : null,
      asOf: aHistory ? (history.ohlcv[history.ohlcv.length - 1]?.date ?? null) : null,
      /* Additif (voir api/market/_freshness.js) : un OHLCV quotidien n'est
         jamais du temps réel, quel que soit le fournisseur. */
      freshness: aHistory ? h.freshness : null,
      provenance: aHistory ? { source: h.source, sourceUrl: h.sourceUrl, retrievedAt: h.retrievedAt } : null,
      journal,
    });
  }

  /* ================= CHEMIN PARAMÉTRÉ (period / interval) ================= */
  const spec = PERIOD_SPECS[periodeBrute];
  if (!spec) {
    return res.status(400).json({
      error: 'periode_invalide',
      periodesDisponibles: Object.keys(PERIOD_SPECS),
    });
  }

  const jours = spec.jours ?? (periodeBrute === 'ytd' ? joursYTD() : 400);

  if (spec.kind === 'intraday') {
    const intervalleDemande = req.query?.interval && INTRADAY_MINUTES[req.query.interval]
      ? String(req.query.interval)
      : spec.interval;

    const ordre = ordreHistoriquePourType(type, { intraday: true });

    if (!ordre.some(p => keys[p])) {
      return res.status(503).json({ error: 'aucun_fournisseur_configure' });
    }

    const journal = [];
    const h = await chargerBloc({
      nom: 'intraday',
      table: INTRADAY,
      ordre,
      args: [ticker, exchange, intervalleDemande, jours, type],
      ticker, exchange, frais, journal,
      cacheParts: [periodeBrute, intervalleDemande],
    });

    const disponible = historiqueValide(h.data);

    let history = null;
    if (disponible) {
      const ohlcv = h.data.length > MAX_INTRADAY_POINTS
        ? h.data.slice(-MAX_INTRADAY_POINTS)
        : h.data;
      history = { points: ohlcv.length, availablePoints: h.data.length, ohlcv };
    }

    return res.status(200).json({
      ticker,
      exchange,
      period: periodeBrute,
      kind: 'intraday',
      interval: intervalleDemande,
      history,
      source: disponible ? h.source : null,
      asOf: disponible ? (history.ohlcv[history.ohlcv.length - 1]?.date ?? null) : null,
      reason: disponible ? null : 'intraday_indisponible',
      freshness: disponible ? h.freshness : null,
      provenance: disponible ? { source: h.source, sourceUrl: h.sourceUrl, retrievedAt: h.retrievedAt } : null,
      journal,
    });
  }

  /* spec.kind === 'daily' */
  const ordre = ordreHistoriquePourType(type, { intraday: false, jours });

  if (!ordre.some(p => keys[p])) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const journal = [];
  const h = await chargerBloc({
    nom: 'histp',
    table: HISTORY,
    ordre,
    args: [ticker, exchange, jours, type],
    ticker, exchange, frais, journal,
    cacheParts: [periodeBrute],
  });

  const disponible = historiqueValide(h.data);

  let history = null;
  if (disponible) {
    history = { points: h.data.length, availablePoints: h.data.length, ohlcv: h.data };
  }

  return res.status(200).json({
    ticker,
    exchange,
    period: periodeBrute,
    kind: 'daily',
    interval: null,
    history,
    source: disponible ? h.source : null,
    asOf: disponible ? (history.ohlcv[history.ohlcv.length - 1]?.date ?? null) : null,
    reason: disponible ? null : 'historique_indisponible',
    freshness: disponible ? h.freshness : null,
    provenance: disponible ? { source: h.source, sourceUrl: h.sourceUrl, retrievedAt: h.retrievedAt } : null,
    journal,
  });
};
