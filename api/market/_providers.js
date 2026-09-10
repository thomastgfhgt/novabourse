/**
 * api/market/_providers.js — COUCHE FOURNISSEURS
 *
 * Trois sources, un format unique. Règles tenues partout :
 *   · une donnée absente vaut null, jamais 0 ni une estimation ;
 *   · chaque bloc indique le fournisseur qui l'a réellement produit ;
 *   · un fournisseur qui échoue passe la main, il ne renvoie pas de valeur.
 */
const KEYS = () => ({
  eodhd: process.env.EODHD_API_KEY || null,
  twelvedata: process.env.TWELVEDATA_API_KEY || null,
  finnhub: process.env.MARKET_API_KEY || process.env.FINNHUB_API_KEY || null,
});

const num = v => {
  if (v === null || v === undefined || v === '' || v === 'NA' || v === 'None') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const txt = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

async function getJSON(url, ms = 9000){
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: 'application/json' } });
    const body = await r.text();
    if (!r.ok){
      const e = new Error(`HTTP ${r.status}`);
      e.status = r.status; e.body = body.slice(0, 200);
      throw e;
    }
    return JSON.parse(body);
  } finally { clearTimeout(t); }
}

/* ---------- SYMBOLES ----------
   Un ticker seul est ambigu : SAN existe à Paris et à Madrid. On transporte
   donc toujours ticker + place. */
const SUFFIX = { NASDAQ:'US', NYSE:'US', 'NYSE ARCA':'US', PA:'PA', AS:'AS', DE:'XETRA',
  SW:'SW', L:'LSE', MC:'MC', MI:'MI', BR:'BR', LS:'LS', HE:'HE', ST:'ST', CO:'CO', OL:'OL' };
const eodhdSymbol = (ticker, exchange) => `${ticker}.${SUFFIX[exchange] || exchange || 'US'}`;
const tdSymbol = (ticker, exchange) => (exchange && !['NASDAQ','NYSE'].includes(exchange)
  ? `${ticker}:${exchange}` : ticker);

/* ============================================================
   RECHERCHE
   ============================================================ */
const SEARCH = {
  async eodhd(q, key){
    const d = await getJSON(`https://eodhd.com/api/search/${encodeURIComponent(q)}`
      + `?api_token=${key}&fmt=json&limit=20`);
    return (Array.isArray(d) ? d : []).map(x => ({
      name: txt(x.Name), ticker: txt(x.Code), exchange: txt(x.Exchange),
      country: txt(x.Country), currency: txt(x.Currency), type: txt(x.Type),
    }));
  },
  async twelvedata(q, key){
    const d = await getJSON(`https://api.twelvedata.com/symbol_search`
      + `?symbol=${encodeURIComponent(q)}&outputsize=20&apikey=${key}`);
    return (d?.data || []).map(x => ({
      name: txt(x.instrument_name), ticker: txt(x.symbol), exchange: txt(x.exchange),
      country: txt(x.country), currency: txt(x.currency), type: txt(x.instrument_type),
    }));
  },
  async finnhub(q, key){
    const d = await getJSON(`https://finnhub.io/api/v1/search`
      + `?q=${encodeURIComponent(q)}&token=${key}`);
    return (d?.result || []).map(x => ({
      name: txt(x.description), ticker: txt(x.displaySymbol || x.symbol),
      exchange: null, country: null, currency: null, type: txt(x.type),
    }));
  },
};

/* ============================================================
   COTATION
   ============================================================ */
const QUOTE = {
  async twelvedata(t, ex, key){
    const d = await getJSON(`https://api.twelvedata.com/quote`
      + `?symbol=${encodeURIComponent(tdSymbol(t, ex))}&apikey=${key}`);
    if (!d || d.status === 'error' || num(d.close) === null) throw new Error(d?.message || 'vide');
    return { price:num(d.close), change:num(d.change), changePercent:num(d.percent_change),
      previousClose:num(d.previous_close), open:num(d.open), high:num(d.high), low:num(d.low),
      volume:num(d.volume), currency:txt(d.currency),
      timestamp: d.timestamp ? new Date(d.timestamp * 1000).toISOString() : null };
  },
  async eodhd(t, ex, key){
    const d = await getJSON(`https://eodhd.com/api/real-time/${encodeURIComponent(eodhdSymbol(t, ex))}`
      + `?api_token=${key}&fmt=json`);
    if (num(d?.close) === null) throw new Error('vide');
    return { price:num(d.close), change:num(d.change), changePercent:num(d.change_p),
      previousClose:num(d.previousClose), open:num(d.open), high:num(d.high), low:num(d.low),
      volume:num(d.volume), currency:null,
      timestamp: d.timestamp ? new Date(d.timestamp * 1000).toISOString() : null };
  },
  async finnhub(t, ex, key){
    const d = await getJSON(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t)}&token=${key}`);
    if (num(d?.c) === null || num(d.c) === 0) throw new Error('vide');
    return { price:num(d.c), change:num(d.d), changePercent:num(d.dp),
      previousClose:num(d.pc), open:num(d.o), high:num(d.h), low:num(d.l),
      volume:null, currency:null,
      timestamp: d.t ? new Date(d.t * 1000).toISOString() : null };
  },
};

/* ============================================================
   FONDAMENTAUX
   ============================================================ */
const FUNDAMENTALS = {
  async eodhd(t, ex, key){
    const d = await getJSON(`https://eodhd.com/api/fundamentals/${encodeURIComponent(eodhdSymbol(t, ex))}`
      + `?api_token=${key}&fmt=json`, 12000);
    const g = d?.General || {}, h = d?.Highlights || {}, v = d?.Valuation || {};
    const bs = Object.values(d?.Financials?.Balance_Sheet?.quarterly || {})[0] || {};
    const cf = Object.values(d?.Financials?.Cash_Flow?.quarterly || {})[0] || {};
    if (!Object.keys(h).length && !Object.keys(g).length) throw new Error('vide');
    return {
      identity: { name:txt(g.Name), exchange:txt(g.Exchange), country:txt(g.CountryName),
        currency:txt(g.CurrencyCode), sector:txt(g.Sector), industry:txt(g.Industry) },
      fundamentals: {
        revenue:num(h.RevenueTTM), netIncome:num(h.ProfitMargin) !== null && num(h.RevenueTTM) !== null
          ? Math.round(num(h.RevenueTTM) * num(h.ProfitMargin)) : null,
        eps:num(h.EarningsShare), profitMargin:num(h.ProfitMargin),
        operatingMargin:num(h.OperatingMarginTTM), roe:num(h.ReturnOnEquityTTM),
        debt:num(bs.shortLongTermDebtTotal), cash:num(bs.cash),
        freeCashFlow:num(cf.freeCashFlow),
        pe:num(h.PERatio), forwardPE:num(v.ForwardPE), priceToBook:num(v.PriceBookMRQ),
        evToEbitda:num(v.EnterpriseValueEbitda), dividendYield:num(h.DividendYield),
        marketCap:num(h.MarketCapitalization),
      },
      asOf: txt(g.UpdatedAt),
    };
  },
  async finnhub(t, ex, key){
    const d = await getJSON(`https://finnhub.io/api/v1/stock/metric`
      + `?symbol=${encodeURIComponent(t)}&metric=all&token=${key}`);
    const m = d?.metric;
    if (!m) throw new Error('vide');
    return {
      identity: {},
      fundamentals: {
        revenue:num(m.revenuePerShareTTM), netIncome:null, eps:num(m.epsTTM),
        profitMargin:num(m.netProfitMarginTTM) !== null ? num(m.netProfitMarginTTM) / 100 : null,
        operatingMargin:num(m.operatingMarginTTM) !== null ? num(m.operatingMarginTTM) / 100 : null,
        roe:num(m.roeTTM) !== null ? num(m.roeTTM) / 100 : null,
        debt:null, cash:null, freeCashFlow:null,
        pe:num(m.peTTM), forwardPE:null, priceToBook:num(m.pbAnnual),
        evToEbitda:num(m.evToEbitdaTTM), dividendYield:num(m.dividendYieldIndicatedAnnual),
        marketCap:num(m.marketCapitalization),
      },
      asOf: null,
    };
  },
};

/* ============================================================
   HISTORIQUE (OHLCV)
   ============================================================ */
const HISTORY = {
  async eodhd(t, ex, key, n){
    const from = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const d = await getJSON(`https://eodhd.com/api/eod/${encodeURIComponent(eodhdSymbol(t, ex))}`
      + `?api_token=${key}&fmt=json&period=d&from=${from}`, 12000);
    if (!Array.isArray(d) || !d.length) throw new Error('vide');
    return d.map(x => ({ date:txt(x.date), open:num(x.open), high:num(x.high),
      low:num(x.low), close:num(x.adjusted_close ?? x.close), volume:num(x.volume) }));
  },
  async twelvedata(t, ex, key, n){
    const d = await getJSON(`https://api.twelvedata.com/time_series`
      + `?symbol=${encodeURIComponent(tdSymbol(t, ex))}&interval=1day&outputsize=${Math.min(n, 5000)}`
      + `&apikey=${key}`, 12000);
    if (!d?.values?.length) throw new Error(d?.message || 'vide');
    return d.values.slice().reverse().map(x => ({ date:txt(x.datetime), open:num(x.open),
      high:num(x.high), low:num(x.low), close:num(x.close), volume:num(x.volume) }));
  },
};

/* ---------- Essai en cascade : le premier qui répond gagne ---------- */
async function cascade(table, ordre, args, journal, bloc){
  const keys = KEYS();
  for (const nom of ordre){
    const fn = table[nom];
    if (!fn || !keys[nom]) continue;
    try {
      const out = await fn(...args, keys[nom]);
      journal.push({ bloc, provider: nom, ok: true });
      return { data: out, source: nom };
    } catch (e){
      journal.push({ bloc, provider: nom, ok: false,
        reason: e.status ? `HTTP ${e.status}` : e.message });
    }
  }
  return { data: null, source: null };
}

module.exports = { SEARCH, QUOTE, FUNDAMENTALS, HISTORY, cascade, KEYS, num, getJSON,
  eodhdSymbol, tdSymbol };
