/**
 * GET /api/market/quotes?symbols=AAPL,MC.PA
 * Cours de marché. La clé du fournisseur reste ici, côté serveur.
 * Sans clé configurée, on répond explicitement : aucune valeur inventée.
 */
const CACHE = new Map();
const TTL = Number(process.env.MARKET_TTL_MS || 20000);
const KEY = () => process.env.MARKET_API_KEY;
const PROVIDER = () => process.env.MARKET_PROVIDER || 'finnhub';

async function json(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
  return r.json();
}
const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const ADAPTERS = {
  async finnhub(symbols) {
    const out = [];
    for (const s of symbols.slice(0, 30)) {
      try {
        const q = await json(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s)}&token=${KEY()}`);
        if (num(q.c)) out.push({ symbol: s, price: num(q.c), changePct: num(q.dp) });
      } catch {}
    }
    return out;
  },
  async twelvedata(symbols) {
    const d = await json(`https://api.twelvedata.com/quote?symbol=${symbols.join(',')}&apikey=${KEY()}`);
    const rows = symbols.length === 1 ? [d] : Object.values(d);
    return rows.filter(q => q && q.symbol && num(q.close) !== null)
      .map(q => ({ symbol: q.symbol, price: num(q.close), changePct: num(q.percent_change) }));
  },
  async eodhd(symbols) {
    const [first, ...rest] = symbols;
    const d = await json(`https://eodhd.com/api/real-time/${encodeURIComponent(first)}?fmt=json&api_token=${KEY()}`
      + (rest.length ? `&s=${rest.join(',')}` : ''));
    return (Array.isArray(d) ? d : [d]).filter(q => num(q.close) !== null)
      .map(q => ({ symbol: q.code, price: num(q.close), changePct: num(q.change_p) }));
  },
  async fmp(symbols) {
    const d = await json(`https://financialmodelingprep.com/api/v3/quote/${symbols.join(',')}?apikey=${KEY()}`);
    return (d || []).filter(q => num(q.price) !== null)
      .map(q => ({ symbol: q.symbol, price: num(q.price), changePct: num(q.changesPercentage) }));
  },
};

module.exports = async (req, res) => {
  const raw = String(req.query.symbols || '').trim();
  if (!raw) return res.status(400).json({ error: 'symbols_manquant' });
  if (!KEY()) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ quotes: [], connected: false, reason: 'cle_absente' });
  }

  const symbols = [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 60);
  const out = [], manquants = [];
  for (const s of symbols) {
    const hit = CACHE.get(s);
    if (hit && Date.now() - hit.at < TTL) out.push(hit.v); else manquants.push(s);
  }

  if (manquants.length) {
    try {
      const adapter = ADAPTERS[PROVIDER()];
      if (!adapter) return res.status(500).json({ error: 'fournisseur_inconnu', provider: PROVIDER() });
      for (const q of await adapter(manquants)) {
        CACHE.set(q.symbol, { at: Date.now(), v: q });
        out.push(q);
      }
    } catch (e) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        quotes: out, connected: true, degraded: true,
        reason: e.status === 429 ? 'quota_fournisseur' : 'fournisseur_indisponible',
      });
    }
  }

  res.setHeader('Cache-Control', `public, s-maxage=${Math.floor(TTL / 1000)}, stale-while-revalidate=120`);
  return res.status(200).json({ quotes: out, connected: true, provider: PROVIDER(), at: Date.now() });
};
