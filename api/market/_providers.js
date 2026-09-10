/**
 * api/market/_providers.js — COUCHE FOURNISSEURS
 *
 * Trois sources, un format unique. Règles tenues partout :
 *   · une donnée absente vaut null, jamais 0 ni une estimation ;
 *   · chaque bloc indique le fournisseur qui l'a réellement produit ;
 *   · un fournisseur qui échoue passe la main, il ne renvoie pas de valeur ;
 *   · aucune correspondance de place approximative n'est autorisée.
 */

const KEYS = () => ({
  eodhd: process.env.EODHD_API_KEY || null,
  twelvedata: process.env.TWELVEDATA_API_KEY || null,
  finnhub: process.env.MARKET_API_KEY || process.env.FINNHUB_API_KEY || null,
});

const num = v => {
  if (
    v === null ||
    v === undefined ||
    v === '' ||
    v === 'NA' ||
    v === 'None'
  ){
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n)
    ? n
    : null;
};

const txt = v => (
  typeof v === 'string' && v.trim()
    ? v.trim()
    : null
);

async function getJSON(url, ms = 9000){
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);

  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: {
        accept: 'application/json',
      },
    });

    const body = await r.text();

    if (!r.ok){
      const e = new Error(`HTTP ${r.status}`);
      e.status = r.status;
      e.body = body.slice(0, 200);
      throw e;
    }

    try {
      return JSON.parse(body);
    } catch {
      throw new Error('json_invalide');
    }
  } finally {
    clearTimeout(t);
  }
}

/* ============================================================
   OUTILS DE TRI DES ÉTATS FINANCIERS
   ============================================================ */

/**
 * Convertit une clé YYYY-MM-DD en valeur numérique comparable.
 * Aucune dépendance à l'ordre d'insertion de l'objet JSON.
 */
function valeurDate(cle){
  if (typeof cle !== 'string') return null;

  const m = cle.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return null;

  const y = Number(m[1]);
  const mois = Number(m[2]);
  const jour = Number(m[3]);

  if (
    !Number.isInteger(y) ||
    !Number.isInteger(mois) ||
    !Number.isInteger(jour) ||
    mois < 1 ||
    mois > 12 ||
    jour < 1 ||
    jour > 31
  ){
    return null;
  }

  return y * 10000 + mois * 100 + jour;
}

/**
 * Renvoie les lignes financières triées explicitement
 * de la plus récente à la plus ancienne.
 */
function lignesTriees(src){
  if (!src || typeof src !== 'object'){
    return [];
  }

  return Object.entries(src)
    .map(([date, valeur]) => ({
      date,
      ordre: valeurDate(date),
      valeur,
    }))
    .filter(x => x.ordre !== null)
    .sort((a, b) => b.ordre - a.ordre);
}

/**
 * Dernière ligne réelle d'un état financier.
 */
function derniereLigne(src){
  const lignes = lignesTriees(src);

  return lignes.length
    ? lignes[0].valeur || {}
    : {};
}

/**
 * Extrait N et N-1 pour une métrique annuelle.
 *
 * Important :
 * on choisit d'abord les deux exercices les plus récents,
 * puis seulement ensuite on regarde leurs valeurs.
 *
 * Ainsi :
 *   2025 = 100
 *   2024 = null
 *   2023 = 80
 *
 * ne devient JAMAIS [100, 80].
 *
 * La croissance reste null car N-1 manque.
 */
function serieAnnuelleConsecutive(src, champ){
  const lignes = lignesTriees(src);

  if (lignes.length < 2){
    return null;
  }

  const actuelle = lignes[0];
  const precedente = lignes[1];

  const anneeActuelle =
    Number(actuelle.date.slice(0, 4));

  const anneePrecedente =
    Number(precedente.date.slice(0, 4));

  /*
   * Les exercices doivent appartenir à deux années consécutives.
   * On n'annualise pas et on ne saute jamais une année.
   */
  if (
    !Number.isInteger(anneeActuelle) ||
    !Number.isInteger(anneePrecedente) ||
    anneeActuelle - anneePrecedente !== 1
  ){
    return null;
  }

  const n =
    num(actuelle.valeur?.[champ]);

  const nMoins1 =
    num(precedente.valeur?.[champ]);

  if (
    n === null ||
    nMoins1 === null
  ){
    return null;
  }

  /*
   * Convention utilisée par _novascore.js :
   * [0] = exercice le plus récent
   * [1] = exercice précédent
   */
  return [
    n,
    nMoins1,
  ];
}

/* ============================================================
   SYMBOLES
   ============================================================ */

/*
 * Un ticker seul est ambigu :
 * SAN peut désigner plusieurs instruments selon la place.
 * On transporte donc toujours ticker + exchange.
 */
const SUFFIX = {
  NASDAQ: 'US',
  NYSE: 'US',
  'NYSE ARCA': 'US',

  PA: 'PA',
  AS: 'AS',
  DE: 'XETRA',
  SW: 'SW',
  L: 'LSE',
  MC: 'MC',
  MI: 'MI',
  BR: 'BR',
  LS: 'LS',
  HE: 'HE',
  ST: 'ST',
  CO: 'CO',
  OL: 'OL',
};

const eodhdSymbol = (ticker, exchange) =>
  `${ticker}.${SUFFIX[exchange] || exchange || 'US'}`;

/*
 * Twelve Data :
 * les marchés US n'ont pas besoin de suffixe.
 *
 * Une place inconnue est transmise telle quelle :
 * mieux vaut un refus du fournisseur qu'une correspondance
 * silencieuse avec le mauvais instrument.
 */
const TD_EXCHANGE = {
  NASDAQ: null,
  NYSE: null,
  'NYSE ARCA': null,

  PA: 'Euronext Paris',
  AS: 'Euronext Amsterdam',
  BR: 'Euronext Brussels',
  LS: 'Euronext Lisbon',

  DE: 'XETRA',
  SW: 'SIX',
  L: 'LSE',

  MC: 'BME',
  MI: 'MTA',

  ST: 'OMX',
  CO: 'OMXC',
  HE: 'OMXH',
  OL: 'OSL',
};

const tdSymbol = (ticker, exchange) => {
  if (!exchange){
    return ticker;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      TD_EXCHANGE,
      exchange
    )
  ){
    const place =
      TD_EXCHANGE[exchange];

    return place
      ? `${ticker}:${place}`
      : ticker;
  }

  return `${ticker}:${exchange}`;
};

/* ============================================================
   FINNHUB — GARDE-FOU DE PLACE
   ============================================================ */

/*
 * Notre intégration Finnhub actuelle utilise le ticker seul.
 * Tant qu'un mapping international fiable n'est pas installé,
 * on l'autorise uniquement pour les places US identifiées.
 */
function finnhubAutorise(exchange){
  return [
    'NASDAQ',
    'NYSE',
    'NYSE ARCA',
  ].includes(
    String(exchange || '').toUpperCase()
  );
}

function verifierFinnhub(exchange){
  if (!finnhubAutorise(exchange)){
    const e =
      new Error('place_non_supportee_finnhub');

    e.code =
      'place_non_supportee_finnhub';

    throw e;
  }
}

/* ============================================================
   RECHERCHE
   ============================================================ */

const SEARCH = {
  async eodhd(q, key){
    const d =
      await getJSON(
        `https://eodhd.com/api/search/${encodeURIComponent(q)}`
        + `?api_token=${key}&fmt=json&limit=20`
      );

    return (
      Array.isArray(d)
        ? d
        : []
    ).map(x => ({
      name: txt(x.Name),
      ticker: txt(x.Code),
      exchange: txt(x.Exchange),
      country: txt(x.Country),
      currency: txt(x.Currency),
      type: txt(x.Type),
    }));
  },

  async twelvedata(q, key){
    const d =
      await getJSON(
        `https://api.twelvedata.com/symbol_search`
        + `?symbol=${encodeURIComponent(q)}`
        + `&outputsize=20`
        + `&apikey=${key}`
      );

    return (
      d?.data || []
    ).map(x => ({
      name: txt(x.instrument_name),
      ticker: txt(x.symbol),
      exchange: txt(x.exchange),
      country: txt(x.country),
      currency: txt(x.currency),
      type: txt(x.instrument_type),
    }));
  },

  async finnhub(q, key){
    const d =
      await getJSON(
        `https://finnhub.io/api/v1/search`
        + `?q=${encodeURIComponent(q)}`
        + `&token=${key}`
      );

    /*
     * Finnhub search reste utilisable comme moteur de recherche,
     * mais l'exchange n'est pas considéré suffisamment fiable
     * pour autoriser ensuite une cotation internationale.
     */
    return (
      d?.result || []
    ).map(x => ({
      name: txt(x.description),
      ticker: txt(
        x.displaySymbol || x.symbol
      ),
      exchange: null,
      country: null,
      currency: null,
      type: txt(x.type),
    }));
  },
};

/* ============================================================
   COTATION
   ============================================================ */

const QUOTE = {
  async twelvedata(t, ex, key){
    const d =
      await getJSON(
        `https://api.twelvedata.com/quote`
        + `?symbol=${encodeURIComponent(tdSymbol(t, ex))}`
        + `&apikey=${key}`
      );

    if (
      !d ||
      d.status === 'error' ||
      num(d.close) === null
    ){
      throw new Error(
        d?.message || 'vide'
      );
    }

    return {
      price: num(d.close),
      change: num(d.change),
      changePercent: num(d.percent_change),

      previousClose:
        num(d.previous_close),

      open: num(d.open),
      high: num(d.high),
      low: num(d.low),

      volume: num(d.volume),

      currency:
        txt(d.currency),

      timestamp:
        d.timestamp
          ? new Date(
              Number(d.timestamp) * 1000
            ).toISOString()
          : null,
    };
  },

  async eodhd(t, ex, key){
    const d =
      await getJSON(
        `https://eodhd.com/api/real-time/${encodeURIComponent(eodhdSymbol(t, ex))}`
        + `?api_token=${key}&fmt=json`
      );

    if (
      num(d?.close) === null
    ){
      throw new Error('vide');
    }

    return {
      price: num(d.close),
      change: num(d.change),
      changePercent: num(d.change_p),

      previousClose:
        num(d.previousClose),

      open: num(d.open),
      high: num(d.high),
      low: num(d.low),

      volume: num(d.volume),

      currency: null,

      timestamp:
        d.timestamp
          ? new Date(
              Number(d.timestamp) * 1000
            ).toISOString()
          : null,
    };
  },

  async finnhub(t, ex, key){
    verifierFinnhub(ex);

    const d =
      await getJSON(
        `https://finnhub.io/api/v1/quote`
        + `?symbol=${encodeURIComponent(t)}`
        + `&token=${key}`
      );

    if (
      num(d?.c) === null ||
      num(d.c) === 0
    ){
      throw new Error('vide');
    }

    return {
      price: num(d.c),
      change: num(d.d),
      changePercent: num(d.dp),

      previousClose: num(d.pc),

      open: num(d.o),
      high: num(d.h),
      low: num(d.l),

      volume: null,
      currency: null,

      timestamp:
        d.t
          ? new Date(
              Number(d.t) * 1000
            ).toISOString()
          : null,
    };
  },
};

/* ============================================================
   FONDAMENTAUX
   ============================================================ */

const FUNDAMENTALS = {
  async eodhd(t, ex, key){
    const d =
      await getJSON(
        `https://eodhd.com/api/fundamentals/${encodeURIComponent(eodhdSymbol(t, ex))}`
        + `?api_token=${key}&fmt=json`,
        12000
      );

    const g =
      d?.General || {};

    const h =
      d?.Highlights || {};

    const v =
      d?.Valuation || {};

    const financials =
      d?.Financials || {};

    const incomeYearly =
      financials?.Income_Statement?.yearly || {};

    const incomeQuarterly =
      financials?.Income_Statement?.quarterly || {};

    const balanceQuarterly =
      financials?.Balance_Sheet?.quarterly || {};

    const cashFlowYearly =
      financials?.Cash_Flow?.yearly || {};

    /*
     * Toutes les dernières lignes sont désormais sélectionnées
     * explicitement par date décroissante.
     *
     * Aucun Object.values(...)[0].
     */
    const isY =
      derniereLigne(incomeYearly);

    const isQ =
      derniereLigne(incomeQuarterly);

    const bs =
      derniereLigne(balanceQuarterly);

    const cfY =
      derniereLigne(cashFlowYearly);

    /*
     * Résultat net :
     * l'annuel est privilégié.
     * Le trimestriel n'est qu'un fallback informatif.
     */
    const netIncome =
      num(isY.netIncome)
      ?? num(isQ.netIncome)
      ?? null;

    /*
     * Chiffre d'affaires utilisé avec le FCF dans NovaScore :
     * on privilégie l'exercice annuel afin de ne jamais diviser
     * un FCF trimestriel par un CA TTM.
     */
    const revenueAnnual =
      num(isY.totalRevenue);

    const revenueTTM =
      num(h.RevenueTTM);

    const revenue =
      revenueAnnual
      ?? revenueTTM
      ?? null;

    /*
     * FCF annuel uniquement.
     * Si l'annuel est absent, on préfère null à un mélange
     * trimestriel / annuel ou trimestriel / TTM.
     */
    const freeCashFlow =
      num(cfY.freeCashFlow);

    /*
     * Séries N / N-1.
     *
     * Les deux derniers exercices doivent réellement être
     * consécutifs ET posséder tous les deux la métrique.
     */
    const revenueSeries =
      serieAnnuelleConsecutive(
        incomeYearly,
        'totalRevenue'
      );

    const epsSeries =
      serieAnnuelleConsecutive(
        incomeYearly,
        'earningsPerShareDiluted'
      )
      ?? serieAnnuelleConsecutive(
        incomeYearly,
        'earningsPerShareBasic'
      );

    const fcfSeries =
      serieAnnuelleConsecutive(
        cashFlowYearly,
        'freeCashFlow'
      );

    if (
      !Object.keys(h).length &&
      !Object.keys(g).length
    ){
      throw new Error('vide');
    }

    return {
      identity: {
        name:
          txt(g.Name),

        exchange:
          txt(g.Exchange),

        country:
          txt(g.CountryName),

        currency:
          txt(g.CurrencyCode),

        sector:
          txt(g.Sector),

        industry:
          txt(g.Industry),
      },

      fundamentals: {
        revenue,
        revenueTTM,

        netIncome,

        /*
         * Séries utilisées exclusivement pour la croissance.
         */
        revenueSeries,
        epsSeries,
        fcfSeries,

        eps:
          num(h.EarningsShare),

        profitMargin:
          num(h.ProfitMargin),

        operatingMargin:
          num(h.OperatingMarginTTM),

        roe:
          num(h.ReturnOnEquityTTM),

        debt:
          num(
            bs.shortLongTermDebtTotal
          ),

        cash:
          num(bs.cash),

        freeCashFlow,

        pe:
          num(h.PERatio),

        forwardPE:
          num(v.ForwardPE),

        priceToBook:
          num(v.PriceBookMRQ),

        evToEbitda:
          num(
            v.EnterpriseValueEbitda
          ),

        dividendYield:
          num(h.DividendYield),

        marketCap:
          num(
            h.MarketCapitalization
          ),
      },

      asOf:
        txt(g.UpdatedAt),
    };
  },

  async finnhub(t, ex, key){
    verifierFinnhub(ex);

    const d =
      await getJSON(
        `https://finnhub.io/api/v1/stock/metric`
        + `?symbol=${encodeURIComponent(t)}`
        + `&metric=all`
        + `&token=${key}`
      );

    const m =
      d?.metric;

    if (!m){
      throw new Error('vide');
    }

    const netProfit =
      num(m.netProfitMarginTTM);

    const operating =
      num(m.operatingMarginTTM);

    const roe =
      num(m.roeTTM);

    return {
      identity: {},

      fundamentals: {
        /*
         * revenuePerShareTTM n'est PAS le CA total.
         */
        revenue: null,

        revenueTTM: null,

        revenuePerShare:
          num(
            m.revenuePerShareTTM
          ),

        revenueSeries: null,
        epsSeries: null,
        fcfSeries: null,

        netIncome: null,

        eps:
          num(m.epsTTM),

        profitMargin:
          netProfit !== null
            ? netProfit / 100
            : null,

        operatingMargin:
          operating !== null
            ? operating / 100
            : null,

        roe:
          roe !== null
            ? roe / 100
            : null,

        debt: null,
        cash: null,

        freeCashFlow: null,

        pe:
          num(m.peTTM),

        forwardPE: null,

        priceToBook:
          num(m.pbAnnual),

        evToEbitda:
          num(m.evToEbitdaTTM),

        dividendYield:
          num(
            m.dividendYieldIndicatedAnnual
          ),

        marketCap:
          num(
            m.marketCapitalization
          ),
      },

      asOf: null,
    };
  },
};

/* ============================================================
   HISTORIQUE OHLCV
   ============================================================ */

const HISTORY = {
  async eodhd(t, ex, key, n){
    const from =
      new Date(
        Date.now() - n * 86400000
      )
        .toISOString()
        .slice(0, 10);

    const d =
      await getJSON(
        `https://eodhd.com/api/eod/${encodeURIComponent(eodhdSymbol(t, ex))}`
        + `?api_token=${key}`
        + `&fmt=json`
        + `&period=d`
        + `&from=${from}`,
        12000
      );

    if (
      !Array.isArray(d) ||
      !d.length
    ){
      throw new Error('vide');
    }

    return d.map(x => ({
      date:
        txt(x.date),

      open:
        num(x.open),

      high:
        num(x.high),

      low:
        num(x.low),

      close:
        num(
          x.adjusted_close
          ?? x.close
        ),

      volume:
        num(x.volume),
    }));
  },

  async twelvedata(t, ex, key, n){
    const d =
      await getJSON(
        `https://api.twelvedata.com/time_series`
        + `?symbol=${encodeURIComponent(tdSymbol(t, ex))}`
        + `&interval=1day`
        + `&outputsize=${Math.min(n, 5000)}`
        + `&apikey=${key}`,
        12000
      );

    if (
      !d?.values?.length
    ){
      throw new Error(
        d?.message || 'vide'
      );
    }

    return d.values
      .slice()
      .reverse()
      .map(x => ({
        date:
          txt(x.datetime),

        open:
          num(x.open),

        high:
          num(x.high),

        low:
          num(x.low),

        close:
          num(x.close),

        volume:
          num(x.volume),
      }));
  },
};

/* ============================================================
   CASCADE
   ============================================================ */

/**
 * Essai en cascade :
 * le premier fournisseur qui produit réellement un bloc gagne.
 */
async function cascade(
  table,
  ordre,
  args,
  journal,
  bloc
){
  const keys =
    KEYS();

  for (const nom of ordre){
    const fn =
      table[nom];

    if (
      !fn ||
      !keys[nom]
    ){
      continue;
    }

    try {
      const out =
        await fn(
          ...args,
          keys[nom]
        );

      journal.push({
        bloc,
        provider: nom,
        ok: true,
      });

      return {
        data: out,
        source: nom,
      };
    } catch (e){
      journal.push({
        bloc,
        provider: nom,
        ok: false,
        reason:
          e.status
            ? `HTTP ${e.status}`
            : e.message,
      });
    }
  }

  return {
    data: null,
    source: null,
  };
}

/* ============================================================
   COTATIONS EN LOT
   ============================================================ */

const idDe = v =>
  `${v.ticker}@${v.exchange || ''}`;

const BATCH = {
  limite: {
    twelvedata: 120,
    eodhd: 100,
    finnhub: 10,
  },

  async twelvedata(valeurs, key){
    /*
     * Association exacte :
     * symbole demandé par Twelve Data → instrument interne.
     */
    const map =
      new Map(
        valeurs.map(v => [
          tdSymbol(
            v.ticker,
            v.exchange
          ),
          v,
        ])
      );

    const demandes =
      [...map.keys()];

    const d =
      await getJSON(
        `https://api.twelvedata.com/quote`
        + `?symbol=${demandes.map(encodeURIComponent).join(',')}`
        + `&apikey=${key}`,
        12000
      );

    if (
      !d ||
      d.status === 'error'
    ){
      throw new Error(
        d?.message || 'vide'
      );
    }

    /*
     * Pour un seul symbole, Twelve Data renvoie directement
     * l'objet cotation sans clé englobante.
     */
    const entrees =
      demandes.length === 1
        ? [[demandes[0], d]]
        : Object.entries(d);

    const out =
      new Map();

    for (const [cle, q] of entrees){
      if (
        !q ||
        typeof q !== 'object' ||
        q.status === 'error'
      ){
        continue;
      }

      if (
        num(q.close) === null
      ){
        continue;
      }

      const src =
        map.get(cle);

      /*
       * Pas d'association certaine :
       * on ignore la ligne.
       */
      if (!src){
        continue;
      }

      out.set(
        idDe(src),
        {
          symbol:
            idDe(src),

          ticker:
            src.ticker,

          exchange:
            src.exchange,

          price:
            num(q.close),

          changePercent:
            num(
              q.percent_change
            ),

          change:
            num(q.change),

          currency:
            txt(q.currency),

          timestamp:
            q.timestamp
              ? new Date(
                  Number(q.timestamp)
                  * 1000
                ).toISOString()
              : null,
        }
      );
    }

    if (!out.size){
      throw new Error(
        'aucune ligne exploitable'
      );
    }

    return out;
  },

  async eodhd(valeurs, key){
    const map =
      new Map(
        valeurs.map(v => [
          eodhdSymbol(
            v.ticker,
            v.exchange
          ),
          v,
        ])
      );

    const [
      premier,
      ...reste
    ] = [...map.keys()];

    const d =
      await getJSON(
        `https://eodhd.com/api/real-time/${encodeURIComponent(premier)}`
        + `?api_token=${key}`
        + `&fmt=json`
        + (
          reste.length
            ? `&s=${reste.map(encodeURIComponent).join(',')}`
            : ''
        ),
        12000
      );

    const lignes =
      Array.isArray(d)
        ? d
        : [d];

    const out =
      new Map();

    for (const q of lignes){
      if (
        !q ||
        num(q.close) === null
      ){
        continue;
      }

      const src =
        map.get(q.code);

      if (!src){
        continue;
      }

      out.set(
        idDe(src),
        {
          symbol:
            idDe(src),

          ticker:
            src.ticker,

          exchange:
            src.exchange,

          price:
            num(q.close),

          changePercent:
            num(q.change_p),

          change:
            num(q.change),

          currency: null,

          timestamp:
            q.timestamp
              ? new Date(
                  Number(q.timestamp)
                  * 1000
                ).toISOString()
              : null,
        }
      );
    }

    if (!out.size){
      throw new Error(
        'aucune ligne exploitable'
      );
    }

    return out;
  },

  /*
   * Finnhub n'a pas d'endpoint batch.
   *
   * Seuls les instruments US explicitement identifiés
   * sont autorisés tant que le mapping international
   * n'est pas déterministe.
   */
  async finnhub(valeurs, key){
    const autorisees =
      valeurs
        .filter(v =>
          finnhubAutorise(
            v.exchange
          )
        )
        .slice(
          0,
          BATCH.limite.finnhub
        );

    if (!autorisees.length){
      throw new Error(
        'aucune_place_finnhub_supportee'
      );
    }

    const out =
      new Map();

    for (const v of autorisees){
      try {
        const q =
          await getJSON(
            `https://finnhub.io/api/v1/quote`
            + `?symbol=${encodeURIComponent(v.ticker)}`
            + `&token=${key}`,
            6000
          );

        if (
          num(q?.c) === null ||
          num(q.c) === 0
        ){
          continue;
        }

        out.set(
          idDe(v),
          {
            symbol:
              idDe(v),

            ticker:
              v.ticker,

            exchange:
              v.exchange,

            price:
              num(q.c),

            changePercent:
              num(q.dp),

            change:
              num(q.d),

            currency: null,

            timestamp:
              q.t
                ? new Date(
                    Number(q.t)
                    * 1000
                  ).toISOString()
                : null,
          }
        );
      } catch {
        /*
         * Un symbole échoue :
         * les autres continuent.
         */
      }
    }

    if (!out.size){
      throw new Error(
        'aucune ligne exploitable'
      );
    }

    return out;
  },
};

module.exports = {
  SEARCH,
  QUOTE,
  FUNDAMENTALS,
  HISTORY,
  BATCH,

  cascade,

  KEYS,
  num,
  txt,
  getJSON,

  eodhdSymbol,
  tdSymbol,
  idDe,

  SUFFIX,
  TD_EXCHANGE,

  /*
   * Exportés pour pouvoir les tester unitairement.
   */
  lignesTriees,
  derniereLigne,
  serieAnnuelleConsecutive,
  finnhubAutorise,
};
