/**
 * GET /api/market/health?ticker=AAPL&exchange=NASDAQ
 *
 * Route de diagnostic protégée.
 *
 * Elle interroge chaque fournisseur séparément et indique ce qu'il a
 * réellement répondu.
 *
 * IMPORTANT :
 * - aucune clé API n'est exposée ;
 * - la route est désactivée si DIAG_SECRET n'existe pas ;
 * - le secret doit être envoyé uniquement dans le header x-diag-secret ;
 * - les paramètres sont validés avant tout appel fournisseur.
 */

const {
  SEARCH,
  QUOTE,
  FUNDAMENTALS,
  HISTORY,
  NEWS,
  KEYS,
  eodhdSymbolPourType,
  tdSymbol,
  coingeckoRef,
  frankfurterRef,
} = require('./_providers.js');

const essai = async (fn, args) => {
  const t0 = Date.now();

  try {
    const d = await fn(...args);

    return {
      ok: true,
      ms: Date.now() - t0,
      apercu: JSON.stringify(d).slice(0, 220),
    };
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - t0,
      erreur: e.status ? `HTTP ${e.status}` : e.message,
      corps: e.body || null,
    };
  }
};

function parametreValide(value, maxLength, autoriserSlash = false) {
  const motif = autoriserSlash ? /^[A-Z0-9._/-]+$/i : /^[A-Z0-9._-]+$/i;
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    motif.test(value)
  );
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  /* ---------- méthode ---------- */

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');

    return res.status(405).json({
      error: 'methode_non_autorisee',
    });
  }

  /* ---------- protection diagnostic ---------- */

  const attendu = process.env.DIAG_SECRET;

  /*
   * Aucun secret configuré :
   * on fait volontairement croire que la route n'existe pas.
   */
  if (!attendu) {
    return res.status(404).json({
      error: 'introuvable',
    });
  }

  /*
   * Le secret n'est JAMAIS accepté dans l'URL.
   *
   * Utilisation :
   *
   * x-diag-secret: <DIAG_SECRET>
   *
   * Cela évite qu'un secret apparaisse dans :
   * - logs serveur
   * - historique navigateur
   * - analytics
   * - reverse proxies
   */
  const fourni = req.headers['x-diag-secret'];

  if (
    typeof fourni !== 'string' ||
    fourni.length === 0 ||
    fourni !== attendu
  ) {
    return res.status(401).json({
      error: 'non_autorise',
    });
  }

  /* ---------- paramètres ---------- */

  const ticker = String(req.query?.ticker || 'AAPL')
    .trim()
    .toUpperCase();

  /* `req.query?.exchange !== undefined` (pas `||`) : permet de tester
     explicitement crypto/forex/index/commodity avec exchange="" (place
     vide), qui ne doit JAMAIS retomber silencieusement sur 'NASDAQ'. */
  const exchange = String(
    req.query?.exchange !== undefined ? req.query.exchange : 'NASDAQ'
  )
    .trim()
    .toUpperCase();

  /* Ajouté lors du correctif routage multi-actifs : nécessaire pour
     diagnostiquer crypto/forex/index/commodity, dont le symbole
     fournisseur dépend du type (voir eodhdSymbolPourType). */
  const type = String(req.query?.type || 'stock').trim().toLowerCase();

  /* "/" ajouté (audit multi-actifs, même correctif que search.js/
     quotes.js/company.js) : sans lui, un ticker crypto/forex ("BTC/USD")
     était rejeté par ce diagnostic AVANT même le premier appel réseau. */
  if (!parametreValide(ticker, 30, true)) {
    return res.status(400).json({
      error: 'ticker_invalide',
    });
  }

  /* Place vide autorisée (crypto/forex/index/commodity n'ont pas de place
     boursière) — seule une place NON vide est validée par le format. */
  if (exchange && !parametreValide(exchange, 40)) {
    return res.status(400).json({
      error: 'exchange_invalide',
    });
  }

  /* ---------- fournisseurs ---------- */

  const keys = KEYS();

  const out = {
    cles: {
      eodhd: Boolean(keys.eodhd),
      twelvedata: Boolean(keys.twelvedata),
      finnhub: Boolean(keys.finnhub),
      coingecko: Boolean(keys.coingecko),
      frankfurter: Boolean(keys.frankfurter),
    },

    ticker,
    exchange,
    type,

    /* Identité multi-fournisseur (section "identité multi-provider" du
       cahier des charges) : le symbole EXACT que chaque fournisseur
       recevrait pour cet instrument, résolu par les mêmes fonctions que la
       cascade réelle utilise (eodhdSymbolPourType/tdSymbol/coingeckoRef/
       frankfurterRef) — jamais recalculé séparément ni deviné pour ce
       diagnostic. `null` signifie : ce fournisseur n'a aucune convention
       vérifiée pour ce ticker/type précis, il est donc absent de la
       cascade réelle pour ce bloc (voir ordreHistoriquePourType côté
       history.js pour le détail par type). */
    providerSymbols: {
      eodhd: eodhdSymbolPourType(ticker, exchange, type),
      twelvedata: tdSymbol(ticker, exchange),
      coingecko: (type === 'crypto' && coingeckoRef(ticker)) || null,
      frankfurter: (type === 'forex' && frankfurterRef(ticker)) || null,
      finnhub: ticker,
    },

    tests: {},
  };

  /* `type` ajouté en dernière position avant la clé pour quote/history —
     voir _providers.js (les tables QUOTE et HISTORY attendent désormais
     type juste avant key). FUNDAMENTALS/SEARCH n'ont pas cette signature
     (jamais appelées avec un type différent de 'stock' en pratique). */
  const blocs = [
    ['quote', QUOTE, [ticker, exchange, type]],

    ['fundamentals', FUNDAMENTALS, [
      ticker,
      exchange,
    ]],

    ['history', HISTORY, [
      ticker,
      exchange,
      30,
      type,
    ]],

    ['news', NEWS, [
      ticker,
      exchange,
      5,
      type,
    ]],

    ['search', SEARCH, [
      ticker,
    ]],
  ];

  for (const [nom, table, args] of blocs) {
    out.tests[nom] = {};

    for (const provider of Object.keys(table)) {
      if (!keys[provider]) {
        out.tests[nom][provider] = {
          ok: false,
          erreur: 'cle_absente',
        };

        continue;
      }

      out.tests[nom][provider] = await essai(
        table[provider],
        [...args, keys[provider]]
      );
    }
  }

  return res.status(200).json(out);
};
