/**
 * GET /api/market/health?ticker=AAPL&exchange=NASDAQ
 * Diagnostic : interroge chaque fournisseur séparément et rapporte ce qu'il a
 * réellement répondu. Aucune clé n'est exposée, seulement son existence.
 */
const { SEARCH, QUOTE, FUNDAMENTALS, HISTORY, KEYS } = require('./_providers.js');

const essai = async (fn, args) => {
  const t0 = Date.now();
  try {
    const d = await fn(...args);
    return { ok:true, ms:Date.now() - t0,
      apercu: JSON.stringify(d).slice(0, 220) };
  } catch (e){
    return { ok:false, ms:Date.now() - t0, erreur: e.status ? `HTTP ${e.status}` : e.message,
      corps: e.body || null };
  }
};

module.exports = async (req, res) => {
  /* Cette route déclenche jusqu'à une dizaine d'appels fournisseurs payants.
     Laissée ouverte, elle permet à n'importe qui de brûler les quotas et de
     découvrir la configuration. Elle exige donc un secret serveur. */
  const attendu = process.env.DIAG_SECRET;
  if (!attendu){
    return res.status(404).json({ error: 'introuvable' });   // désactivée par défaut
  }
  const fourni = req.headers['x-diag-secret'] || req.query.secret || '';
  if (String(fourni) !== attendu){
    return res.status(401).json({ error: 'non_autorise' });
  }

  const t = String(req.query.ticker || 'AAPL').toUpperCase();
  const ex = String(req.query.exchange || 'NASDAQ').toUpperCase();
  const k = KEYS();
  const out = { cles: { eodhd:Boolean(k.eodhd), twelvedata:Boolean(k.twelvedata),
    finnhub:Boolean(k.finnhub) }, ticker:t, exchange:ex, tests:{} };

  for (const [nom, table, args] of [
    ['quote', QUOTE, [t, ex]], ['fundamentals', FUNDAMENTALS, [t, ex]],
    ['history', HISTORY, [t, ex, 30]], ['search', SEARCH, [t]],
  ]){
    out.tests[nom] = {};
    for (const p of Object.keys(table)){
      if (!k[p]) { out.tests[nom][p] = { ok:false, erreur:'cle_absente' }; continue; }
      out.tests[nom][p] = await essai(table[p], [...args, k[p]]);
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json(out);
};
