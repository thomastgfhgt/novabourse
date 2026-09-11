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

/* L'URL est conservée SANS la clé : indispensable au diagnostic, jamais
   exposant un secret. */
const urlSansCle = u => String(u)
  .replace(/([?&])(api_token|apikey|token)=[^&]*/gi, '$1$2=***');

async function getJSON(url, ms = 9000){
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { accept: 'application/json' } });
    const body = await r.text();
    if (!r.ok){
      const e = new Error(`HTTP ${r.status}`);
      e.status = r.status; e.body = body.slice(0, 200); e.url = urlSansCle(url);
      throw e;
    }
    try {
      return JSON.parse(body);
    } catch {
      const e = new Error('reponse_non_json');
      e.body = body.slice(0, 200); e.url = urlSansCle(url);
      throw e;
    }
  } catch (e){
    if (!e.url) e.url = urlSansCle(url);
    throw e;
  } finally { clearTimeout(t); }
}

/* ---------- SYMBOLES ----------
   Un ticker seul est ambigu : SAN existe à Paris et à Madrid. On transporte
   donc toujours ticker + place. */
const SUFFIX = { NASDAQ:'US', NYSE:'US', 'NYSE ARCA':'US', PA:'PA', AS:'AS', DE:'XETRA',
  SW:'SW', L:'LSE', MC:'MC', MI:'MI', BR:'BR', LS:'LS', HE:'HE', ST:'ST', CO:'CO', OL:'OL' };
const eodhdSymbol = (ticker, exchange) => `${ticker}.${SUFFIX[exchange] || exchange || 'US'}`;
/* Twelve Data attend « TICKER:PLACE », avec le nom de place tel qu'il l'emploie.
   Les marchés américains se passent de suffixe. Une place inconnue est
   transmise telle quelle : mieux vaut un symbole refusé qu'une correspondance
   approximative avec une autre société. */
const TD_EXCHANGE = {
  NASDAQ:null, NYSE:null, 'NYSE ARCA':null,
  PA:'Euronext Paris', AS:'Euronext Amsterdam', BR:'Euronext Brussels',
  LS:'Euronext Lisbon', DE:'XETRA', SW:'SIX', L:'LSE',
  MC:'BME', MI:'MTA', ST:'OMX', CO:'OMXC', HE:'OMXH', OL:'OSL',
};
const tdSymbol = (ticker, exchange) => {
  if (!exchange) return ticker;
  if (Object.prototype.hasOwnProperty.call(TD_EXCHANGE, exchange)){
    const place = TD_EXCHANGE[exchange];
    return place ? `${ticker}:${place}` : ticker;
  }
  return `${ticker}:${exchange}`;
};

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
    /* La période la plus récente est choisie par sa DATE. Se fier à l'ordre
       des clés d'un objet JSON rendrait le résultat dépendant du fournisseur. */
    const plusRecent = (bloc, frequence) => {
      const src = d?.Financials?.[bloc]?.[frequence];
      if (!src || typeof src !== 'object') return {};
      const dates = Object.keys(src)
        .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x) && !isNaN(Date.parse(x)))
        .sort((a, b) => b.localeCompare(a));
      return dates.length ? (src[dates[0]] || {}) : {};
    };
    const bs = plusRecent('Balance_Sheet', 'quarterly');
    const cf = plusRecent('Cash_Flow', 'quarterly');
    /* Résultat net : on le lit dans les états financiers publiés, jamais
       reconstitué. L'annuel prime sur le trimestriel, qui ne couvre que
       trois mois et ne se compare pas au chiffre d'affaires sur douze. */
    const isY = plusRecent('Income_Statement', 'yearly');
    const isQ = plusRecent('Income_Statement', 'quarterly');
    const netIncome = num(isY.netIncome) ?? num(isQ.netIncome) ?? null;
    const revenue   = num(h.RevenueTTM) ?? num(isY.totalRevenue) ?? null;

    /* Séries annuelles, du plus récent au plus ancien. On TRIE explicitement
       par date : l'ordre des clés d'un objet JSON n'est pas garanti, et se
       fier à Object.values()[0] reviendrait à comparer deux exercices au
       hasard. Aucun appel réseau supplémentaire : ces séries sont déjà dans
       la réponse fundamentals. */
    /* Périodes financières, triées par date décroissante et VALIDÉES.
       On conserve la date avec la valeur : sans elle, un exercice manquant
       au milieu ferait comparer N à N-2 comme s'il s'agissait de N-1, et la
       croissance affichée serait fausse. */
    const periodes = (bloc, champ) => {
      const src = d?.Financials?.[bloc]?.yearly;
      if (!src || typeof src !== 'object') return null;
      const lignes = Object.entries(src)
        .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)))
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, v]) => ({ date, annee: +date.slice(0, 4), valeur: num(v?.[champ]) }));
      return lignes.length ? lignes.slice(0, 5) : null;
    };

    const revenueSeries = periodes('Income_Statement', 'totalRevenue');
    const epsSeries     = periodes('Income_Statement', 'earningsPerShareDiluted')
                       ?? periodes('Income_Statement', 'earningsPerShareBasic');
    const fcfSeries     = periodes('Cash_Flow', 'freeCashFlow');
    if (!Object.keys(h).length && !Object.keys(g).length) throw new Error('vide');
    return {
      identity: { name:txt(g.Name), exchange:txt(g.Exchange), country:txt(g.CountryName),
        currency:txt(g.CurrencyCode), sector:txt(g.Sector), industry:txt(g.Industry) },
      fundamentals: {
        revenue, netIncome,
        revenueSeries, epsSeries, fcfSeries,
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
        /* revenuePerShareTTM est un chiffre d'affaires PAR ACTION : ce n'est
           pas le chiffre d'affaires total. Le confondre fausserait toute
           comparaison de croissance. Finnhub ne donne pas le total via
           /stock/metric, donc revenue reste null. */
        revenue:null, revenuePerShare:num(m.revenuePerShareTTM),
        revenueSeries:null, epsSeries:null, fcfSeries:null,
        netIncome:null, eps:num(m.epsTTM),
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
  async eodhd(t, ex, n, key){
    const from = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const symbole = eodhdSymbol(t, ex);
    const url = `https://eodhd.com/api/eod/${encodeURIComponent(symbole)}`
      + `?api_token=${key}&fmt=json&period=d&from=${from}`;
    const d = await getJSON(url, 12000);

    if (!Array.isArray(d)){
      const e = new Error(`format_inattendu:${typeof d}`);
      e.url = urlSansCle(url); e.symbole = symbole;
      e.body = JSON.stringify(d).slice(0, 200);
      throw e;
    }
    const recues = d.length;
    const lignes = d.map(x => ({ date:txt(x.date), open:num(x.open), high:num(x.high),
      low:num(x.low), close:num(x.adjusted_close ?? x.close), volume:num(x.volume) }))
      .filter(x => x.date && x.close !== null);   // une clôture absente n'est pas une séance

    if (!lignes.length){
      const e = new Error(recues
        ? `zero_ligne_apres_normalisation (recues:${recues}, champs:${Object.keys(d[0] || {}).join('|')})`
        : 'aucune_ligne_recue');
      e.url = urlSansCle(url); e.symbole = symbole; e.recues = recues;
      throw e;
    }
    lignes.recues = recues;
    return lignes;
  },
  async twelvedata(t, ex, n, key){
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
      journal.push({ bloc, provider: nom, ok: true,
        recues: out && out.recues != null ? out.recues : null,
        conservees: Array.isArray(out) ? out.length : null });
      return { data: out, source: nom };
    } catch (e){
      journal.push({ bloc, provider: nom, ok: false,
        reason: e.status ? `HTTP ${e.status}` : e.message,
        url: e.url || null, symbole: e.symbole || null,
        recues: e.recues ?? null,
        corps: e.body ? String(e.body).slice(0, 200) : null });
    }
  }
  return { data: null, source: null };
}

/* ============================================================
   COTATIONS EN LOT
   Twelve Data et EODHD acceptent plusieurs symboles par appel. Finnhub non :
   il reste un dernier recours, volontairement plafonné.
   Chaque adaptateur reçoit [{ticker, exchange}] et rend une Map indexée par
   « TICKER@EXCHANGE » — la conversion vers le format du fournisseur se fait
   ici, jamais dans le navigateur.
   ============================================================ */
const idDe = v => `${v.ticker}@${v.exchange || ''}`;

const BATCH = {
  limite: { twelvedata: 120, eodhd: 100, finnhub: 10 },

  async twelvedata(valeurs, key){
    /* En lot, Twelve Data renvoie un objet DONT LES CLÉS sont exactement les
       symboles demandés. On s'appuie sur cette clé, pas sur les champs de la
       réponse : q.exchange n'est pas garanti et son format varie selon les
       places. Si une ligne n'est rattachable à aucune demande, elle est
       ignorée — la cotation sera simplement considérée absente. */
    const map = new Map(valeurs.map(v => [tdSymbol(v.ticker, v.exchange), v]));
    const demandes = [...map.keys()];
    const d = await getJSON(`https://api.twelvedata.com/quote`
      + `?symbol=${demandes.map(encodeURIComponent).join(',')}&apikey=${key}`, 12000);
    if (!d || d.status === 'error') throw new Error(d?.message || 'vide');

    // Un seul symbole : la réponse est l'objet lui-même, sans clé.
    const entrees = demandes.length === 1
      ? [[demandes[0], d]]
      : Object.entries(d);

    const out = new Map();
    for (const [cle, q] of entrees){
      if (!q || typeof q !== 'object' || q.status === 'error') continue;
      if (num(q.close) === null) continue;
      const src = map.get(cle);
      if (!src) continue;                    // aucune association certaine
      out.set(idDe(src), { symbol: idDe(src), ticker: src.ticker, exchange: src.exchange,
        price: num(q.close), changePercent: num(q.percent_change), change: num(q.change),
        currency: txt(q.currency),
        timestamp: q.timestamp ? new Date(q.timestamp * 1000).toISOString() : null });
    }
    if (!out.size) throw new Error('aucune ligne exploitable');
    return out;
  },

  async eodhd(valeurs, key){
    const map = new Map(valeurs.map(v => [eodhdSymbol(v.ticker, v.exchange), v]));
    const [premier, ...reste] = [...map.keys()];
    const d = await getJSON(`https://eodhd.com/api/real-time/${encodeURIComponent(premier)}`
      + `?api_token=${key}&fmt=json`
      + (reste.length ? `&s=${reste.map(encodeURIComponent).join(',')}` : ''), 12000);
    const lignes = Array.isArray(d) ? d : [d];
    const out = new Map();
    for (const q of lignes){
      if (!q || num(q.close) === null) continue;
      const src = map.get(q.code);
      if (!src) continue;
      out.set(idDe(src), { symbol: idDe(src), ticker: src.ticker, exchange: src.exchange,
        price: num(q.close), changePercent: num(q.change_p), change: num(q.change),
        currency: null,
        timestamp: q.timestamp ? new Date(q.timestamp * 1000).toISOString() : null });
    }
    if (!out.size) throw new Error('aucune ligne exploitable');
    return out;
  },

  /* Finnhub n'a pas d'endpoint groupé. On le plafonne strictement : mieux vaut
     une réponse partielle que des dizaines d'appels par affichage. */
  async finnhub(valeurs, key){
    const out = new Map();
    for (const v of valeurs.slice(0, BATCH.limite.finnhub)){
      try {
        const q = await getJSON(`https://finnhub.io/api/v1/quote`
          + `?symbol=${encodeURIComponent(v.ticker)}&token=${key}`, 6000);
        if (num(q?.c) === null || num(q.c) === 0) continue;
        out.set(idDe(v), { symbol: idDe(v), ticker: v.ticker, exchange: v.exchange,
          price: num(q.c), changePercent: num(q.dp), change: num(q.d), currency: null,
          timestamp: q.t ? new Date(q.t * 1000).toISOString() : null });
      } catch {}
    }
    if (!out.size) throw new Error('aucune ligne exploitable');
    return out;
  },
};

module.exports = { SEARCH, QUOTE, FUNDAMENTALS, HISTORY, BATCH, cascade, KEYS, num, txt,
  getJSON, eodhdSymbol, tdSymbol, idDe, SUFFIX, TD_EXCHANGE };
