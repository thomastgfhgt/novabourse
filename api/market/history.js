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
 * période intraday. Ne télécharge jamais plus que la période demandée : 1M
 * ne déclenche pas un appel dimensionné pour MAX.
 *
 * ORDRE DE CASCADE : décidé par _router.js (resolveOrdre), source unique
 * partagée avec company.js/quotes.js/fundamentals.js/news.js — voir ce
 * fichier pour le détail par assetType (crypto/forex/index/commodity/stock)
 * et la mémoire de routage (dernier fournisseur qui a fonctionné pour CET
 * instrument précis, essayé en premier).
 *
 * Aucune donnée n'est jamais inventée :
 *   - période demandée mais fournisseur incapable => history: null, reason explicite ;
 *   - historique vide est indisponible, jamais une série synthétique ;
 *   - intraday jamais reconstruit à partir de clôtures quotidiennes.
 */

const { HISTORY, INTRADAY, INTRADAY_MINUTES, KEYS, ajusterPenceHistorique } = require('./_providers.js');
const { chargerBloc, historiqueValide } = require('./_marketBlock.js');
const { normaliserTicker, normaliserExchange } = require('./company.js');
const { resolveOrdre, noterResultat } = require('./_router.js');

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
     seul, ou forex via Frankfurter seul (voir _router.js) — ne jamais 503
     ce cas prématurément ici. */
  if (!keys.eodhd && !keys.twelvedata && !keys.finnhub && !keys.coingecko && !keys.frankfurter && !keys.eulerpool) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  /* ================= CHEMIN PAR DÉFAUT (compat stricte) ================= */
  if (!periodeBrute) {
    const ordre = resolveOrdre('history', ticker, exchange, type);

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
    noterResultat('history', ticker, exchange, type, h.source);

    /* Correctif pence/LSE (voir _providers.js) : h.data reste la valeur
       brute mise en cache par chargerBloc, jamais convertie avant écriture
       — la conversion s'applique ici, à chaque lecture. */
    const donnees = ajusterPenceHistorique(ticker, exchange, h.data);
    const aHistory = historiqueValide(donnees);

    let history = null;
    if (aHistory) {
      const ohlcv = donnees.slice(-MAX_HISTORY_POINTS);
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

    const ordre = resolveOrdre('intraday', ticker, exchange, type);

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
    noterResultat('intraday', ticker, exchange, type, h.source);

    const donneesIntraday = ajusterPenceHistorique(ticker, exchange, h.data);
    const disponible = historiqueValide(donneesIntraday);

    let history = null;
    if (disponible) {
      const ohlcv = donneesIntraday.length > MAX_INTRADAY_POINTS
        ? donneesIntraday.slice(-MAX_INTRADAY_POINTS)
        : donneesIntraday;
      history = { points: ohlcv.length, availablePoints: donneesIntraday.length, ohlcv };
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
  const ordre = resolveOrdre('history', ticker, exchange, type, { jours });

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
  noterResultat('history', ticker, exchange, type, h.source);

  const donneesPeriode = ajusterPenceHistorique(ticker, exchange, h.data);
  const disponible = historiqueValide(donneesPeriode);

  let history = null;
  if (disponible) {
    history = { points: donneesPeriode.length, availablePoints: donneesPeriode.length, ohlcv: donneesPeriode };
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
