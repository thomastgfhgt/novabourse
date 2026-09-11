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
  KEYS,
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

function parametreValide(value, maxLength) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[A-Z0-9._-]+$/i.test(value)
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

  const exchange = String(req.query?.exchange || 'NASDAQ')
    .trim()
    .toUpperCase();

  if (!parametreValide(ticker, 30)) {
    return res.status(400).json({
      error: 'ticker_invalide',
    });
  }

  if (!parametreValide(exchange, 40)) {
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
    },

    ticker,
    exchange,

    tests: {},
  };

  const blocs = [
    ['quote', QUOTE, [ticker, exchange]],

    ['fundamentals', FUNDAMENTALS, [
      ticker,
      exchange,
    ]],

    ['history', HISTORY, [
      ticker,
      exchange,
      30,
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
