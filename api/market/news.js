/**
 * GET /api/market/news?ticker=X&exchange=Y&type=Z[&limit=10][&fresh=1]
 *
 * Actualités seules, destinées au chargement à la demande côté frontend
 * (bouton "Voir les actualités"). Réutilise le même cache/journal que le
 * reste de la couche marché (voir _marketBlock.js), TTL 15 min (_cache.js,
 * TTL.news) — une actualité ne change pas d'une seconde à l'autre.
 *
 * `type` : seuls stock/etf ont un flux d'actualités branché aujourd'hui
 * (voir NEWS.eodhd dans _providers.js) — forex/crypto/index/commodity
 * répondent directement `articles:null` sans consommer d'appel fournisseur,
 * même logique que fundamentals.js pour les types sans bilan.
 */

const { NEWS, KEYS } = require('./_providers.js');
const { chargerBloc, historiqueValide } = require('./_marketBlock.js');
const { normaliserTicker, normaliserExchange } = require('./company.js');
const { resolveOrdre, noterResultat, TYPES_AVEC_ACTUALITES } = require('./_router.js');

const MAX_LIMIT = 30;
const DEFAULT_LIMIT = 10;

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
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(req.query?.limit) || DEFAULT_LIMIT));

  if (!TYPES_AVEC_ACTUALITES.has(type)) {
    return res.status(200).json({
      ticker, exchange, articles: null, source: null, asOf: null,
      journal: [{ bloc: 'news', ok: false, reason: `type_sans_actualites:${type}` }],
    });
  }

  const keys = KEYS();
  if (!keys.eodhd) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const journal = [];
  const n = await chargerBloc({
    nom: 'news',
    table: NEWS,
    ordre: resolveOrdre('news', ticker, exchange, type),
    args: [ticker, exchange, limit, type],
    ticker, exchange, frais, journal,
    cacheParts: [String(limit)],
  });
  noterResultat('news', ticker, exchange, type, n.source);

  const disponible = historiqueValide(n.data);

  return res.status(200).json({
    ticker,
    exchange,
    articles: disponible ? n.data : null,
    source: disponible ? n.source : null,
    asOf: disponible ? (n.data[0]?.date ?? null) : null,
    freshness: disponible ? n.freshness : null,
    provenance: disponible ? { source: n.source, sourceUrl: n.sourceUrl, retrievedAt: n.retrievedAt } : null,
    journal,
  });
};
