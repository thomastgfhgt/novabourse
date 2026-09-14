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
} = require('./_providers.js');

const { chargerBloc, historiqueValide } = require('./_marketBlock.js');

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

  const keys = KEYS();
  if (!keys.eodhd && !keys.twelvedata && !keys.finnhub) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const journal = [];

  /* Remplace l'ancienne closure locale `bloc()` par le module partagé
     _marketBlock.js — comportement strictement identique (même lecture
     cache, même cascade, même écriture cache, même journal), juste
     factorisé pour être réutilisable par history.js et fundamentals.js. */
  const [q, f, h] = await Promise.all([
    chargerBloc({ nom:'quote', table:QUOTE, ordre:['twelvedata', 'eodhd', 'finnhub'],
      args:[ticker, exchange], ticker, exchange, frais, journal }),
    chargerBloc({ nom:'fundamentals', table:FUNDAMENTALS, ordre:['eodhd', 'finnhub'],
      args:[ticker, exchange], ticker, exchange, frais, journal }),
    chargerBloc({ nom:'history', table:HISTORY, ordre:['eodhd', 'twelvedata'],
      args:[ticker, exchange, 400], ticker, exchange, frais, journal }),
  ]);

  const aMarket = quoteValide(q.data);
  const aFundamentals = fondamentauxValides(f.data);
  const aHistory = historiqueValide(h.data);

  const identity = {
    name: f.data?.identity?.name || null,
    ticker,
    exchange: f.data?.identity?.exchange || exchange,
    country: f.data?.identity?.country || null,
    currency: f.data?.identity?.currency || q.data?.currency || null,
    sector: f.data?.identity?.sector || null,
    industry: f.data?.identity?.industry || null,
  };

  const market = aMarket ? {
    price: q.data.price,
    change: q.data.change ?? null,
    changePercent: q.data.changePercent ?? null,
    previousClose: q.data.previousClose ?? null,
    open: q.data.open ?? null,
    high: q.data.high ?? null,
    low: q.data.low ?? null,
    volume: q.data.volume ?? null,
    marketCap: f.data?.fundamentals?.marketCap ?? null,
    timestamp: q.data.timestamp ?? null,
  } : null;

  let history = null;
  if (aHistory) {
    const ohlcv = h.data.slice(-MAX_HISTORY_POINTS);
    history = { points: ohlcv.length, availablePoints: h.data.length, ohlcv };
  }

  const complete = Boolean(market && aFundamentals && history);
  const missing = [];
  if (!market) missing.push('market');
  if (!aFundamentals) missing.push('fundamentals');
  if (!history) missing.push('history');

  return res.status(200).json({
    identity,
    market,
    fundamentals: aFundamentals ? f.data.fundamentals : null,
    history,
    sources: {
      quote: aMarket ? q.source : null,
      fundamentals: aFundamentals ? f.source : null,
      history: aHistory ? h.source : null,
    },
    asOf: {
      quote: aMarket ? (q.data?.timestamp || null) : null,
      fundamentals: aFundamentals ? (f.data?.asOf || null) : null,
    },
    complete,
    missing,
    journal,
  });
};

module.exports.normaliserTicker = normaliserTicker;
module.exports.normaliserExchange = normaliserExchange;
module.exports.historiqueValide = historiqueValide;
