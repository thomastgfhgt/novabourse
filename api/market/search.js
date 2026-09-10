/**
 * GET /api/market/search?q=air%20liquide
 * Recherche mondiale. Aucune liste codée en dur : les résultats viennent des
 * fournisseurs. L'identifiant retourné combine ticker et place, pour ne jamais
 * confondre deux sociétés partageant un même symbole.
 */
const { SEARCH, cascade, KEYS } = require('./_providers.js');

const CACHE = new Map();
const TTL = 3600000;

module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.status(400).json({ error: 'requete_trop_courte' });

  const keys = KEYS();
  if (!keys.eodhd && !keys.twelvedata && !keys.finnhub){
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const hit = CACHE.get(q.toLowerCase());
  if (hit && Date.now() - hit.at < TTL){
    res.setHeader('Cache-Control', 'public, s-maxage=600');
    return res.status(200).json({ ...hit.payload, cached: true });
  }

  const journal = [];
  const r = await cascade(SEARCH, ['eodhd','twelvedata','finnhub'], [q], journal, 'search');
  const results = (r.data || [])
    .filter(x => x.ticker && x.name)
    .filter(x => !x.type || /common stock|equity|cs|etf/i.test(x.type))
    .slice(0, 15)
    .map(x => ({ ...x, id: `${x.ticker}${x.exchange ? '@' + x.exchange : ''}` }));

  const payload = { results, source: r.source, journal };
  if (results.length) CACHE.set(q.toLowerCase(), { at: Date.now(), payload });

  res.setHeader('Cache-Control', 'public, s-maxage=600');
  return res.status(200).json(payload);
};
