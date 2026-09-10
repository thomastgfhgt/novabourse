/**
 * GET /api/market/company?ticker=AAPL&exchange=NASDAQ
 *
 * Dossier financier normalisé, assemblé à partir des trois fournisseurs.
 * Chaque bloc porte le nom de celui qui l'a réellement produit. Un bloc
 * introuvable vaut null : rien n'est comblé.
 *
 * Répartition, par ordre d'essai :
 *   cotation      twelvedata → eodhd → finnhub
 *   fondamentaux  eodhd → finnhub
 *   historique    eodhd → twelvedata
 */
const { QUOTE, FUNDAMENTALS, HISTORY, cascade, KEYS } = require('./_providers.js');
/* Cache commun à toute la couche marché : une cotation obtenue par le batch
   de quotes.js est réutilisée ici, et inversement. */
const { lire, ecrire } = require('./_cache.js');

module.exports = async (req, res) => {
  const ticker = String(req.query.ticker || '').trim().toUpperCase();
  const exchange = String(req.query.exchange || '').trim().toUpperCase() || null;
  const frais = req.query.fresh === '1';
  if (!ticker) return res.status(400).json({ error: 'ticker_manquant' });

  const keys = KEYS();
  if (!keys.eodhd && !keys.twelvedata && !keys.finnhub){
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const journal = [];
  const bloc = async (nom, table, ordre, args) => {
    if (!frais){
      const hit = lire(nom, ticker, exchange);
      if (hit){ journal.push({ bloc:nom, provider:hit.source, ok:true, cache:true });
        return { data: hit.valeur, source: hit.source }; }
    }
    const r = await cascade(table, ordre, args, journal, nom);
    if (r.data) ecrire(nom, [ticker, exchange], r.data, r.source);
    return r;
  };

  const [q, f, h] = await Promise.all([
    bloc('quote', QUOTE, ['twelvedata','eodhd','finnhub'], [ticker, exchange]),
    bloc('fundamentals', FUNDAMENTALS, ['eodhd','finnhub'], [ticker, exchange]),
    bloc('history', HISTORY, ['eodhd','twelvedata'], [ticker, exchange, 400]),
  ]);

  const identity = {
    name: f.data?.identity?.name || null,
    ticker,
    exchange: f.data?.identity?.exchange || exchange,
    country: f.data?.identity?.country || null,
    currency: f.data?.identity?.currency || q.data?.currency || null,
    sector: f.data?.identity?.sector || null,
    industry: f.data?.identity?.industry || null,
  };

  const market = q.data ? {
    price:q.data.price, change:q.data.change, changePercent:q.data.changePercent,
    previousClose:q.data.previousClose, open:q.data.open, high:q.data.high, low:q.data.low,
    volume:q.data.volume, marketCap:f.data?.fundamentals?.marketCap ?? null,
    timestamp:q.data.timestamp,
  } : null;

  const complet = market && f.data && h.data;
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    identity,
    market,
    fundamentals: f.data?.fundamentals || null,
    history: h.data ? { points: h.data.length, ohlcv: h.data.slice(-260) } : null,
    sources: { quote:q.source, fundamentals:f.source, history:h.source },
    asOf: { quote:q.data?.timestamp || null, fundamentals:f.data?.asOf || null },
    complete: Boolean(complet),
    missing: [!market && 'market', !f.data && 'fundamentals', !h.data && 'history'].filter(Boolean),
    journal,                       // ce qui a été essayé, et pourquoi ça a échoué
  });
};

