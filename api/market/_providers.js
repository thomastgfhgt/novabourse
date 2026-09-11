/**
 * api/market/_providers.js — COUCHE FOURNISSEURS
 *
 * Trois sources, un format unique.
 *
 * Principes :
 *   - donnée absente => null ;
 *   - aucune estimation ;
 *   - chaque bloc conserve sa provenance ;
 *   - un fournisseur qui échoue laisse la place au suivant ;
 *   - les historiques sont normalisés, triés et dédupliqués ;
 *   - aucun ticker étranger ambigu n'est envoyé aveuglément à Finnhub.
 */

const KEYS = () => ({
  eodhd:
    process.env.EODHD_API_KEY
    || null,

  twelvedata:
    process.env.TWELVEDATA_API_KEY
    || null,

  finnhub:
    process.env.MARKET_API_KEY
    || process.env.FINNHUB_API_KEY
    || null,
});

/* ============================================================
   NORMALISATION DE BASE
   ============================================================ */

const num = v => {
  if (
    v === null
    || v === undefined
    || v === ''
    || v === 'NA'
    || v === 'None'
  ) {
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n)
    ? n
    : null;
};

const txt = v =>
  (
    typeof v === 'string'
    && v.trim()
  )
    ? v.trim()
    : null;

/**
 * Conversion sûre timestamp Unix -> ISO.
 */
function isoUnix(value) {
  const n = num(value);

  if (n === null) {
    return null;
  }

  const ms =
    n < 1e12
      ? n * 1000
      : n;

  const d =
    new Date(ms);

  return Number.isFinite(d.getTime())
    ? d.toISOString()
    : null;
}

/**
 * URL conservée pour diagnostic mais sans secret.
 */
const urlSansCle = u =>
  String(u)
    .replace(
      /([?&])(api_token|apikey|token)=[^&]*/gi,
      '$1$2=***'
    );

async function getJSON(
  url,
  ms = 9000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      ms
    );

  try {
    const response =
      await fetch(
        url,
        {
          signal:
            controller.signal,

          headers: {
            accept:
              'application/json',
          },
        }
      );

    const body =
      await response.text();

    if (!response.ok) {
      const error =
        new Error(
          `HTTP ${response.status}`
        );

      error.status =
        response.status;

      error.body =
        body.slice(
          0,
          200
        );

      error.url =
        urlSansCle(url);

      throw error;
    }

    try {
      return JSON.parse(body);

    } catch {
      const error =
        new Error(
          'reponse_non_json'
        );

      error.body =
        body.slice(
          0,
          200
        );

      error.url =
        urlSansCle(url);

      throw error;
    }

  } catch (error) {
    if (!error.url) {
      error.url =
        urlSansCle(url);
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   SYMBOLES / PLACES
   ============================================================ */

const SUFFIX = {
  NASDAQ: 'US',
  NYSE: 'US',
  'NYSE ARCA': 'US',

  US: 'US',

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

const eodhdSymbol = (
  ticker,
  exchange
) =>
  `${ticker}.${
    SUFFIX[exchange]
    || exchange
    || 'US'
  }`;

const TD_EXCHANGE = {
  NASDAQ: null,
  NYSE: null,
  'NYSE ARCA': null,
  US: null,

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

const tdSymbol = (
  ticker,
  exchange
) => {
  if (!exchange) {
    return ticker;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      TD_EXCHANGE,
      exchange
    )
  ) {
    const place =
      TD_EXCHANGE[exchange];

    return place
      ? `${ticker}:${place}`
      : ticker;
  }

  return `${ticker}:${exchange}`;
};

/**
 * Finnhub /quote ne reçoit qu'un symbole.
 *
 * Ne pas l'utiliser aveuglément comme fallback
 * pour SAN.PA, BNP.PA, AIR.PA, etc.
 */
const US_EXCHANGES =
  new Set([
    'NASDAQ',
    'NYSE',
    'NYSE ARCA',
    'US',
  ]);

function finnhubAutorise(exchange) {
  return (
    !exchange
    || US_EXCHANGES.has(
      String(exchange)
        .toUpperCase()
    )
  );
}

/* ============================================================
   RECHERCHE
   ============================================================ */

const SEARCH = {
  async eodhd(q, key) {
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
      name:
        txt(x.Name),

      ticker:
        txt(x.Code),

      exchange:
        txt(x.Exchange),

      country:
        txt(x.Country),

      currency:
        txt(x.Currency),

      type:
        txt(x.Type),
    }));
  },

  async twelvedata(q, key) {
    const d =
      await getJSON(
        `https://api.twelvedata.com/symbol_search`
        + `?symbol=${encodeURIComponent(q)}`
        + `&outputsize=20`
        + `&apikey=${key}`
      );

    return (
      d?.data
      || []
    ).map(x => ({
      name:
        txt(x.instrument_name),

      ticker:
        txt(x.symbol),

      exchange:
        txt(x.exchange),

      country:
        txt(x.country),

      currency:
        txt(x.currency),

      type:
        txt(x.instrument_type),
    }));
  },

  async finnhub(q, key) {
    const d =
      await getJSON(
        `https://finnhub.io/api/v1/search`
        + `?q=${encodeURIComponent(q)}`
        + `&token=${key}`
      );

    return (
      d?.result
      || []
    ).map(x => ({
      name:
        txt(x.description),

      ticker:
        txt(
          x.displaySymbol
          || x.symbol
        ),

      exchange:
        null,

      country:
        null,

      currency:
        null,

      type:
        txt(x.type),
    }));
  },
};

/* ============================================================
   COTATION
   ============================================================ */

const QUOTE = {
  async twelvedata(
    ticker,
    exchange,
    key
  ) {
    const d =
      await getJSON(
        `https://api.twelvedata.com/quote`
        + `?symbol=${encodeURIComponent(tdSymbol(ticker, exchange))}`
        + `&apikey=${key}`
      );

    if (
      !d
      || d.status === 'error'
      || num(d.close) === null
    ) {
      throw new Error(
        d?.message
        || 'vide'
      );
    }

    return {
      price:
        num(d.close),

      change:
        num(d.change),

      changePercent:
        num(d.percent_change),

      previousClose:
        num(d.previous_close),

      open:
        num(d.open),

      high:
        num(d.high),

      low:
        num(d.low),

      volume:
        num(d.volume),

      currency:
        txt(d.currency),

      timestamp:
        isoUnix(d.timestamp),
    };
  },

  async eodhd(
    ticker,
    exchange,
    key
  ) {
    const d =
      await getJSON(
        `https://eodhd.com/api/real-time/${encodeURIComponent(eodhdSymbol(ticker, exchange))}`
        + `?api_token=${key}&fmt=json`
      );

    if (
      num(d?.close)
      === null
    ) {
      throw new Error(
        'vide'
      );
    }

    return {
      price:
        num(d.close),

      change:
        num(d.change),

      changePercent:
        num(d.change_p),

      previousClose:
        num(d.previousClose),

      open:
        num(d.open),

      high:
        num(d.high),

      low:
        num(d.low),

      volume:
        num(d.volume),

      currency:
        null,

      timestamp:
        isoUnix(d.timestamp),
    };
  },

  async finnhub(
    ticker,
    exchange,
    key
  ) {
    if (
      !finnhubAutorise(exchange)
    ) {
      throw new Error(
        'place_non_supportee_par_finnhub'
      );
    }

    const d =
      await getJSON(
        `https://finnhub.io/api/v1/quote`
        + `?symbol=${encodeURIComponent(ticker)}`
        + `&token=${key}`
      );

    if (
      num(d?.c) === null
      || num(d.c) === 0
    ) {
      throw new Error(
        'vide'
      );
    }

    return {
      price:
        num(d.c),

      change:
        num(d.d),

      changePercent:
        num(d.dp),

      previousClose:
        num(d.pc),

      open:
        num(d.o),

      high:
        num(d.h),

      low:
        num(d.l),

      volume:
        null,

      currency:
        null,

      timestamp:
        isoUnix(d.t),
    };
  },
};

/* ============================================================
   FONDAMENTAUX
   ============================================================ */

const FUNDAMENTALS = {
  async eodhd(
    ticker,
    exchange,
    key
  ) {
    const d =
      await getJSON(
        `https://eodhd.com/api/fundamentals/${encodeURIComponent(eodhdSymbol(ticker, exchange))}`
        + `?api_token=${key}&fmt=json`,
        12000
      );

    const general =
      d?.General
      || {};

    const highlights =
      d?.Highlights
      || {};

    const valuation =
      d?.Valuation
      || {};

    /**
     * Dernière période par date réelle.
     */
    const plusRecent = (
      bloc,
      frequence
    ) => {
      const src =
        d?.Financials
          ?.[bloc]
          ?.[frequence];

      if (
        !src
        || typeof src !== 'object'
      ) {
        return {};
      }

      const dates =
        Object.keys(src)
          .filter(
            date =>
              /^\d{4}-\d{2}-\d{2}$/
                .test(date)
              && Number.isFinite(
                Date.parse(date)
              )
          )
          .sort(
            (a, b) =>
              b.localeCompare(a)
          );

      return dates.length
        ? (
            src[dates[0]]
            || {}
          )
        : {};
    };

    const balanceSheet =
      plusRecent(
        'Balance_Sheet',
        'quarterly'
      );

    const cashFlow =
      plusRecent(
        'Cash_Flow',
        'quarterly'
      );

    const incomeYearly =
      plusRecent(
        'Income_Statement',
        'yearly'
      );

    const incomeQuarterly =
      plusRecent(
        'Income_Statement',
        'quarterly'
      );

    const netIncome =
      num(
        incomeYearly.netIncome
      )
      ?? num(
        incomeQuarterly.netIncome
      )
      ?? null;

    const revenue =
      num(
        highlights.RevenueTTM
      )
      ?? num(
        incomeYearly.totalRevenue
      )
      ?? null;

    /**
     * Conserve date + année + valeur.
     *
     * Les lignes avec valeur absente restent dans la série :
     * le moteur NovaScore pourra constater qu'un exercice
     * manque au lieu de fabriquer une croissance N/N-2.
     */
    const periodes = (
      bloc,
      champ
    ) => {
      const src =
        d?.Financials
          ?.[bloc]
          ?.yearly;

      if (
        !src
        || typeof src !== 'object'
      ) {
        return null;
      }

      const lignes =
        Object.entries(src)
          .filter(
            ([date]) =>
              /^\d{4}-\d{2}-\d{2}$/
                .test(date)
              && Number.isFinite(
                Date.parse(date)
              )
          )
          .sort(
            (a, b) =>
              b[0].localeCompare(
                a[0]
              )
          )
          .map(
            ([date, valeur]) => ({
              date,

              annee:
                Number(
                  date.slice(
                    0,
                    4
                  )
                ),

              valeur:
                num(
                  valeur?.[champ]
                ),
            })
          );

      return lignes.length
        ? lignes.slice(
            0,
            5
          )
        : null;
    };

    const revenueSeries =
      periodes(
        'Income_Statement',
        'totalRevenue'
      );

    const epsDiluee =
      periodes(
        'Income_Statement',
        'earningsPerShareDiluted'
      );

    const epsBasic =
      periodes(
        'Income_Statement',
        'earningsPerShareBasic'
      );

    /**
     * Choisit la série contenant réellement
     * le plus de valeurs exploitables.
     */
    const nbValeurs =
      serie =>
        Array.isArray(serie)
          ? serie.filter(
              point =>
                num(point?.valeur)
                !== null
            ).length
          : 0;

    const epsSeries =
      nbValeurs(epsDiluee)
        >= nbValeurs(epsBasic)
        ? epsDiluee
        : epsBasic;

    const fcfSeries =
      periodes(
        'Cash_Flow',
        'freeCashFlow'
      );

    if (
      !Object.keys(highlights).length
      && !Object.keys(general).length
    ) {
      throw new Error(
        'vide'
      );
    }

    return {
      identity: {
        name:
          txt(general.Name),

        exchange:
          txt(general.Exchange),

        country:
          txt(
            general.CountryName
          ),

        currency:
          txt(
            general.CurrencyCode
          ),

        sector:
          txt(general.Sector),

        industry:
          txt(general.Industry),
      },

      fundamentals: {
        revenue,

        netIncome,

        revenueSeries,

        epsSeries,

        fcfSeries,

        eps:
          num(
            highlights.EarningsShare
          ),

        profitMargin:
          num(
            highlights.ProfitMargin
          ),

        operatingMargin:
          num(
            highlights.OperatingMarginTTM
          ),

        roe:
          num(
            highlights.ReturnOnEquityTTM
          ),

        debt:
          num(
            balanceSheet
              .shortLongTermDebtTotal
          ),

        cash:
          num(
            balanceSheet.cash
          ),

        freeCashFlow:
          num(
            cashFlow.freeCashFlow
          ),

        pe:
          num(
            highlights.PERatio
          ),

        forwardPE:
          num(
            valuation.ForwardPE
          ),

        priceToBook:
          num(
            valuation.PriceBookMRQ
          ),

        evToEbitda:
          num(
            valuation
              .EnterpriseValueEbitda
          ),

        dividendYield:
          num(
            highlights.DividendYield
          ),

        marketCap:
          num(
            highlights
              .MarketCapitalization
          ),
      },

      asOf:
        txt(
          general.UpdatedAt
        ),
    };
  },

  async finnhub(
    ticker,
    exchange,
    key
  ) {
    if (
      !finnhubAutorise(exchange)
    ) {
      throw new Error(
        'place_non_supportee_par_finnhub'
      );
    }

    const d =
      await getJSON(
        `https://finnhub.io/api/v1/stock/metric`
        + `?symbol=${encodeURIComponent(ticker)}`
        + `&metric=all`
        + `&token=${key}`
      );

    const metric =
      d?.metric;

    if (!metric) {
      throw new Error(
        'vide'
      );
    }

    return {
      identity: {},

      fundamentals: {
        revenue:
          null,

        revenuePerShare:
          num(
            metric.revenuePerShareTTM
          ),

        revenueSeries:
          null,

        epsSeries:
          null,

        fcfSeries:
          null,

        netIncome:
          null,

        eps:
          num(
            metric.epsTTM
          ),

        profitMargin:
          num(
            metric.netProfitMarginTTM
          ) !== null
            ? num(
                metric.netProfitMarginTTM
              ) / 100
            : null,

        operatingMargin:
          num(
            metric.operatingMarginTTM
          ) !== null
            ? num(
                metric.operatingMarginTTM
              ) / 100
            : null,

        roe:
          num(
            metric.roeTTM
          ) !== null
            ? num(
                metric.roeTTM
              ) / 100
            : null,

        debt:
          null,

        cash:
          null,

        freeCashFlow:
          null,

        pe:
          num(
            metric.peTTM
          ),

        forwardPE:
          null,

        priceToBook:
          num(
            metric.pbAnnual
          ),

        evToEbitda:
          num(
            metric.evToEbitdaTTM
          ),

        dividendYield:
          num(
            metric
              .dividendYieldIndicatedAnnual
          ),

        marketCap:
          num(
            metric
              .marketCapitalization
          ),
      },

      asOf:
        null,
    };
  },
};

/* ============================================================
   NORMALISATION HISTORIQUE
   ============================================================ */

/**
 * Point essentiel pour les graphiques.
 *
 * Quel que soit le fournisseur :
 *
 *     ancien -> récent
 *
 * Pas de doublon de date.
 * Pas de séance sans clôture.
 */
function normaliserHistorique(
  lignes
) {
  if (
    !Array.isArray(lignes)
  ) {
    return [];
  }

  const map =
    new Map();

  for (
    const ligne
    of lignes
  ) {
    const date =
      txt(
        ligne?.date
      );

    const close =
      num(
        ligne?.close
      );

    if (
      !date
      || close === null
      || close <= 0
    ) {
      continue;
    }

    const timestamp =
      Date.parse(date);

    if (
      !Number.isFinite(timestamp)
    ) {
      continue;
    }

    const cle =
      new Date(timestamp)
        .toISOString()
        .slice(
          0,
          10
        );

    map.set(
      cle,
      {
        date: cle,

        open:
          num(
            ligne.open
          ),

        high:
          num(
            ligne.high
          ),

        low:
          num(
            ligne.low
          ),

        close,

        volume:
          num(
            ligne.volume
          ),
      }
    );
  }

  return [
    ...map.values(),
  ].sort(
    (a, b) =>
      a.date.localeCompare(
        b.date
      )
  );
}

function joursHistorique(n) {
  const valeur =
    Math.trunc(
      Number(n)
    );

  if (
    !Number.isFinite(valeur)
  ) {
    return 400;
  }

  return Math.max(
    30,
    Math.min(
      valeur,
      5000
    )
  );
}

/* ============================================================
   HISTORIQUE OHLCV
   ============================================================ */

const HISTORY = {
  async eodhd(
    ticker,
    exchange,
    n,
    key
  ) {
    const jours =
      joursHistorique(n);

    const from =
      new Date(
        Date.now()
        - jours * 86400000
      )
        .toISOString()
        .slice(
          0,
          10
        );

    const symbole =
      eodhdSymbol(
        ticker,
        exchange
      );

    const url =
      `https://eodhd.com/api/eod/${encodeURIComponent(symbole)}`
      + `?api_token=${key}`
      + `&fmt=json`
      + `&period=d`
      + `&from=${from}`;

    const d =
      await getJSON(
        url,
        12000
      );

    if (
      !Array.isArray(d)
    ) {
      const error =
        new Error(
          `format_inattendu:${typeof d}`
        );

      error.url =
        urlSansCle(url);

      error.symbole =
        symbole;

      error.body =
        JSON.stringify(d)
          .slice(
            0,
            200
          );

      throw error;
    }

    const recues =
      d.length;

    const brutes =
      d.map(
        ligne => ({
          date:
            txt(
              ligne.date
            ),

          open:
            num(
              ligne.open
            ),

          high:
            num(
              ligne.high
            ),

          low:
            num(
              ligne.low
            ),

          /*
           * Pour le graphique longue durée,
           * adjusted_close évite les ruptures artificielles
           * liées notamment aux splits.
           */
          close:
            num(
              ligne.adjusted_close
              ?? ligne.close
            ),

          volume:
            num(
              ligne.volume
            ),
        })
      );

    const lignes =
      normaliserHistorique(
        brutes
      );

    if (
      !lignes.length
    ) {
      const error =
        new Error(
          recues
            ? `zero_ligne_apres_normalisation (recues:${recues}, champs:${Object.keys(d[0] || {}).join('|')})`
            : 'aucune_ligne_recue'
        );

      error.url =
        urlSansCle(url);

      error.symbole =
        symbole;

      error.recues =
        recues;

      throw error;
    }

    lignes.recues =
      recues;

    return lignes;
  },

  async twelvedata(
    ticker,
    exchange,
    n,
    key
  ) {
    const jours =
      joursHistorique(n);

    const d =
      await getJSON(
        `https://api.twelvedata.com/time_series`
        + `?symbol=${encodeURIComponent(tdSymbol(ticker, exchange))}`
        + `&interval=1day`
        + `&outputsize=${Math.min(jours, 5000)}`
        + `&apikey=${key}`,
        12000
      );

    if (
      !d?.values?.length
    ) {
      throw new Error(
        d?.message
        || 'vide'
      );
    }

    const recues =
      d.values.length;

    const lignes =
      normaliserHistorique(
        d.values.map(
          ligne => ({
            date:
              txt(
                ligne.datetime
              ),

            open:
              num(
                ligne.open
              ),

            high:
              num(
                ligne.high
              ),

            low:
              num(
                ligne.low
              ),

            close:
              num(
                ligne.close
              ),

            volume:
              num(
                ligne.volume
              ),
          })
        )
      );

    if (
      !lignes.length
    ) {
      throw new Error(
        'zero_ligne_apres_normalisation'
      );
    }

    lignes.recues =
      recues;

    return lignes;
  },
};

/* ============================================================
   CASCADE
   ============================================================ */

async function cascade(
  table,
  ordre,
  args,
  journal,
  bloc
) {
  const keys =
    KEYS();

  for (
    const nom
    of ordre
  ) {
    const fn =
      table[nom];

    if (
      !fn
      || !keys[nom]
    ) {
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

        provider:
          nom,

        ok:
          true,

        recues:
          out
          && out.recues != null
            ? out.recues
            : null,

        conservees:
          Array.isArray(out)
            ? out.length
            : null,
      });

      return {
        data:
          out,

        source:
          nom,
      };

    } catch (error) {
      journal.push({
        bloc,

        provider:
          nom,

        ok:
          false,

        reason:
          error.status
            ? `HTTP ${error.status}`
            : error.message,

        url:
          error.url
          || null,

        symbole:
          error.symbole
          || null,

        recues:
          error.recues
          ?? null,

        corps:
          error.body
            ? String(
                error.body
              ).slice(
                0,
                200
              )
            : null,
      });
    }
  }

  return {
    data:
      null,

    source:
      null,
  };
}

/* ============================================================
   COTATIONS EN LOT
   ============================================================ */

const idDe =
  v =>
    `${v.ticker}@${v.exchange || ''}`;

const BATCH = {
  limite: {
    twelvedata:
      120,

    eodhd:
      100,

    finnhub:
      10,
  },

  async twelvedata(
    valeurs,
    key
  ) {
    const map =
      new Map(
        valeurs.map(
          v => [
            tdSymbol(
              v.ticker,
              v.exchange
            ),
            v,
          ]
        )
      );

    const demandes =
      [
        ...map.keys(),
      ];

    if (
      !demandes.length
    ) {
      throw new Error(
        'aucun_symbole'
      );
    }

    const d =
      await getJSON(
        `https://api.twelvedata.com/quote`
        + `?symbol=${demandes.map(encodeURIComponent).join(',')}`
        + `&apikey=${key}`,
        12000
      );

    if (
      !d
      || d.status === 'error'
    ) {
      throw new Error(
        d?.message
        || 'vide'
      );
    }

    const entrees =
      demandes.length === 1
        ? [
            [
              demandes[0],
              d,
            ],
          ]
        : Object.entries(d);

    const out =
      new Map();

    for (
      const [cle, quote]
      of entrees
    ) {
      if (
        !quote
        || typeof quote !== 'object'
        || quote.status === 'error'
        || num(quote.close) === null
      ) {
        continue;
      }

      const src =
        map.get(cle);

      if (!src) {
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
            num(
              quote.close
            ),

          changePercent:
            num(
              quote.percent_change
            ),

          change:
            num(
              quote.change
            ),

          currency:
            txt(
              quote.currency
            ),

          timestamp:
            isoUnix(
              quote.timestamp
            ),
        }
      );
    }

    if (
      !out.size
    ) {
      throw new Error(
        'aucune_ligne_exploitable'
      );
    }

    return out;
  },

  async eodhd(
    valeurs,
    key
  ) {
    const map =
      new Map(
        valeurs.map(
          v => [
            eodhdSymbol(
              v.ticker,
              v.exchange
            ),
            v,
          ]
        )
      );

    const symboles =
      [
        ...map.keys(),
      ];

    if (
      !symboles.length
    ) {
      throw new Error(
        'aucun_symbole'
      );
    }

    const [
      premier,
      ...reste
    ] =
      symboles;

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

    for (
      const quote
      of lignes
    ) {
      if (
        !quote
        || num(quote.close) === null
      ) {
        continue;
      }

      const code =
        txt(
          quote.code
          || quote.symbol
        );

      if (!code) {
        continue;
      }

      const src =
        map.get(code);

      if (!src) {
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
            num(
              quote.close
            ),

          changePercent:
            num(
              quote.change_p
            ),

          change:
            num(
              quote.change
            ),

          currency:
            null,

          timestamp:
            isoUnix(
              quote.timestamp
            ),
        }
      );
    }

    if (
      !out.size
    ) {
      throw new Error(
        'aucune_ligne_exploitable'
      );
    }

    return out;
  },

  async finnhub(
    valeurs,
    key
  ) {
    const compatibles =
      valeurs.filter(
        v =>
          finnhubAutorise(
            v.exchange
          )
      );

    const out =
      new Map();

    for (
      const v
      of compatibles.slice(
        0,
        BATCH.limite.finnhub
      )
    ) {
      try {
        const quote =
          await getJSON(
            `https://finnhub.io/api/v1/quote`
            + `?symbol=${encodeURIComponent(v.ticker)}`
            + `&token=${key}`,
            6000
          );

        if (
          num(quote?.c) === null
          || num(quote.c) === 0
        ) {
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
              num(
                quote.c
              ),

            changePercent:
              num(
                quote.dp
              ),

            change:
              num(
                quote.d
              ),

            currency:
              null,

            timestamp:
              isoUnix(
                quote.t
              ),
          }
        );

      } catch {
        // Une cotation individuelle ne doit
        // pas faire échouer tout le lot.
      }
    }

    if (
      !out.size
    ) {
      throw new Error(
        'aucune_ligne_exploitable'
      );
    }

    return out;
  },
};

/* ============================================================
   EXPORTS
   ============================================================ */

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
  isoUnix,

  getJSON,

  eodhdSymbol,
  tdSymbol,

  idDe,

  SUFFIX,
  TD_EXCHANGE,

  normaliserHistorique,
  finnhubAutorise,
};
