/**
 * GET /api/market/company?ticker=AAPL&exchange=NASDAQ
 *
 * Dossier financier normalisé assemblé à partir des fournisseurs marché.
 *
 * Aucun chiffre n'est inventé :
 *   - un bloc indisponible vaut null ;
 *   - un historique vide est considéré comme indisponible ;
 *   - aucune série fictive n'est générée.
 *
 * Ordre des fournisseurs :
 *
 *   cotation
 *     Twelve Data → EODHD → Finnhub
 *
 *   fondamentaux
 *     EODHD → Finnhub
 *
 *   historique
 *     EODHD → Twelve Data
 */

const {
  QUOTE,
  FUNDAMENTALS,
  HISTORY,
  KEYS,
  ajusterPenceQuote,
  ajusterPenceHistorique,
} = require('./_providers.js');

const { chargerBloc, historiqueValide } = require('./_marketBlock.js');
const { resolveOrdre, noterResultat } = require('./_router.js');
const { statutMarche } = require('./_marketHours.js');
const { novascore } = require('./_novascore.js');

const MAX_HISTORY_POINTS = 260;

function normaliserTicker(value) {
  const ticker = String(value || '').trim().toUpperCase();
  if (!ticker) return null;
  /* CORRECTIF (audit multi-actifs) : même bug que celui déjà corrigé dans
     search.js, trouvé indépendamment ici — confirmé empiriquement, pas
     supposé : le "/" était rejeté, alors que c'est le format standard
     d'une paire Forex ("EUR/USD"), utilisé tel quel par Twelve Data. Ce
     fichier est importé par history.js ET fundamentals.js : ce correctif
     s'applique donc aux deux automatiquement. Rien d'autre ne change. */
  if (ticker.length > 30 || !/^[A-Z0-9._/-]+$/.test(ticker)) return null;
  return ticker;
}

function normaliserExchange(value) {
  const exchange = String(value || '').trim().toUpperCase();
  if (!exchange) return null;
  if (exchange.length > 40 || !/^[A-Z0-9 ._-]+$/.test(exchange)) return null;
  return exchange;
}

function quoteValide(data) {
  if (!data || typeof data !== 'object') return false;
  return Number.isFinite(Number(data.price)) && Number(data.price) > 0;
}

function fondamentauxValides(data) {
  return Boolean(data && typeof data === 'object' && data.fundamentals && typeof data.fundamentals === 'object');
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
  /* Ajouté lors du correctif routage multi-actifs : QUOTE/HISTORY
     attendent désormais `type` en 3e/4e position (voir _providers.js,
     eodhdSymbolPourType) — sans ce paramètre, `key` se retrouverait décalé
     dans le slot `type` et casserait TOUTE cotation/historique, y compris
     pour les actions. 'stock' par défaut : comportement inchangé pour tous
     les appels existants qui n'envoient pas `type`. */
  const type = String(req.query?.type || 'stock').toLowerCase();

  const keys = KEYS();
  /* `keys.coingecko`/`keys.frankfurter` inclus : voir history.js pour la
     même garde — un déploiement sans clé payante peut tout de même servir
     crypto via CoinGecko seul, ou forex via Frankfurter seul. */
  if (!keys.eodhd && !keys.twelvedata && !keys.finnhub && !keys.coingecko && !keys.frankfurter && !keys.eulerpool) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const journal = [];

  /* Ordre de cascade désormais décidé par _router.js (resolveOrdre) — même
     règle par assetType que history.js/quotes.js/fundamentals.js/news.js
     (source unique, plus de copie locale susceptible de diverger) plus la
     mémoire de routage (essaie d'abord le fournisseur qui a fonctionné
     récemment pour CET instrument précis). Le chemin par défaut (n=400,
     `jours` omis) reste toujours éligible à CoinGecko côté crypto. */
  const ordreQuote = resolveOrdre('quote', ticker, exchange, type);
  const ordreFundamentals = resolveOrdre('fundamentals', ticker, exchange, 'stock');
  const ordreHistory = resolveOrdre('history', ticker, exchange, type);

  /* Remplace l'ancienne closure locale `bloc()` par le module partagé
     _marketBlock.js — comportement strictement identique (même lecture
     cache, même cascade, même écriture cache, même journal), juste
     factorisé pour être réutilisable par history.js et fundamentals.js. */
  const [q, f, h] = await Promise.all([
    chargerBloc({ nom:'quote', table:QUOTE, ordre:ordreQuote,
      args:[ticker, exchange, type], ticker, exchange, frais, journal }),
    chargerBloc({ nom:'fundamentals', table:FUNDAMENTALS, ordre:ordreFundamentals,
      args:[ticker, exchange], ticker, exchange, frais, journal }),
    chargerBloc({ nom:'history', table:HISTORY, ordre:ordreHistory,
      args:[ticker, exchange, 400, type], ticker, exchange, frais, journal }),
  ]);

  noterResultat('quote', ticker, exchange, type, q.source);
  noterResultat('fundamentals', ticker, exchange, 'stock', f.source);
  noterResultat('history', ticker, exchange, type, h.source);

  /* Correctif pence/LSE (voir _providers.js) : q.data/h.data restent les
     valeurs brutes mises en cache par chargerBloc, jamais converties avant
     écriture — la conversion s'applique ici, à chaque lecture. */
  const qData = ajusterPenceQuote(ticker, exchange, q.data);
  const hData = ajusterPenceHistorique(ticker, exchange, h.data);

  const aMarket = quoteValide(qData);
  const aFundamentals = fondamentauxValides(f.data);
  const aHistory = historiqueValide(hData);

  const identity = {
    name: f.data?.identity?.name || null,
    ticker,
    exchange: f.data?.identity?.exchange || exchange,
    country: f.data?.identity?.country || null,
    currency: f.data?.identity?.currency || qData?.currency || null,
    sector: f.data?.identity?.sector || null,
    industry: f.data?.identity?.industry || null,
    /* Déjà présent dans la réponse fondamentaux EODHD (aucun coût
       supplémentaire) — null si le fournisseur qui a répondu ne le
       fournit pas (ex. Finnhub), jamais deviné. */
    isin: f.data?.identity?.isin || null,
    /* Ajout (audit "fiche entreprise") : mêmes garanties que les champs
       ci-dessus (déjà présents dans la réponse fondamentaux, aucun coût
       supplémentaire, null si absent — jamais deviné). */
    description: f.data?.identity?.description || null,
    website: f.data?.identity?.website || null,
    employees: f.data?.identity?.employees ?? null,
    ipoDate: f.data?.identity?.ipoDate || null,
  };

  const market = aMarket ? {
    price: qData.price,
    change: qData.change ?? null,
    changePercent: qData.changePercent ?? null,
    previousClose: qData.previousClose ?? null,
    open: qData.open ?? null,
    high: qData.high ?? null,
    low: qData.low ?? null,
    volume: qData.volume ?? null,
    marketCap: f.data?.fundamentals?.marketCap ?? null,
    timestamp: qData.timestamp ?? null,
    /* Jamais LIVE par défaut : voir api/market/_freshness.js pour la
       justification (EODHD confirme un délai documenté de 15-20 min ;
       Twelve Data/Finnhub non garantis génériquement temps réel). */
    freshness: q.freshness ?? null,
    /* Indice contextuel (voir _marketHours.js) : jamais un remplacement de
       `freshness` ci-dessus, seulement "cette place est probablement en
       séance maintenant" — aucun calendrier de jours fériés. */
    marketStatus: statutMarche(exchange, type).status,
  } : null;

  let history = null;
  if (aHistory) {
    const ohlcv = hData.slice(-MAX_HISTORY_POINTS);
    history = { points: ohlcv.length, availablePoints: hData.length, ohlcv };
  }

  const complete = Boolean(market && aFundamentals && history);
  const missing = [];
  if (!market) missing.push('market');
  if (!aFundamentals) missing.push('fundamentals');
  if (!history) missing.push('history');

  /* Ajout additif (LOT I, 2026-09-24, préparation NovaBot) : le moteur
     NovaScore (_novascore.js) est déterministe et n'appelle aucun modèle de
     langage — jusqu'ici il n'était calculé QUE dans api/analyze.js (payant,
     limité par quota), alors qu'il pourrait déjà l'être ici gratuitement,
     à partir des mêmes market/fundamentals/history déjà assemblés
     ci-dessus. Champ additif, ne remplace ni ne modifie aucun champ
     existant : un consommateur qui ignore `novaScore` continue de recevoir
     exactement la même réponse qu'avant ce commit. Permet à NovaBot de
     filtrer sur un NovaScore réel sans consommer le quota d'analyses IA de
     l'utilisateur (voir index.html, evaluerNovaBot()). */
  const nova = novascore({ fundamentals: aFundamentals ? f.data.fundamentals : null, market, history });

  return res.status(200).json({
    identity,
    market,
    fundamentals: aFundamentals ? f.data.fundamentals : null,
    history,
    novaScore: nova.score === null ? null : {
      engine: nova.engine, score: nova.score, coverage: nova.coverage,
      coherence: nova.coherence, confidence: nova.confidence,
    },
    sources: {
      quote: aMarket ? q.source : null,
      fundamentals: aFundamentals ? f.source : null,
      history: aHistory ? h.source : null,
    },
    asOf: {
      quote: aMarket ? (qData?.timestamp || null) : null,
      fundamentals: aFundamentals ? (f.data?.asOf || null) : null,
    },
    /* Ajout additif (voir api/market/_freshness.js) : ne remplace ni
       `sources` ni `asOf` ci-dessus, pour ne rien casser chez un
       consommateur existant (frontend, api/analyze.js). `provenance`
       donne la traçabilité complète demandée (source, sourceUrl,
       retrievedAt) par bloc ; `freshness` la résume pour un accès rapide. */
    freshness: {
      quote: aMarket ? q.freshness : null,
      fundamentals: aFundamentals ? f.freshness : null,
      history: aHistory ? h.freshness : null,
    },
    provenance: {
      quote: aMarket ? { source: q.source, sourceUrl: q.sourceUrl, retrievedAt: q.retrievedAt } : null,
      fundamentals: aFundamentals ? { source: f.source, sourceUrl: f.sourceUrl, retrievedAt: f.retrievedAt } : null,
      history: aHistory ? { source: h.source, sourceUrl: h.sourceUrl, retrievedAt: h.retrievedAt } : null,
    },
    complete,
    missing,
    journal,
  });
};

module.exports.normaliserTicker = normaliserTicker;
module.exports.normaliserExchange = normaliserExchange;
module.exports.historiqueValide = historiqueValide;
