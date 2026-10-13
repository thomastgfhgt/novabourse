// Vérifie le correctif "Apple et bien d'autres entreprises apparaissent
// en plusieurs fois sur Marchés" (audit 2026-10-13). Reproduit
// fidèlement remoteId()/ensureRuntimeStock() (js/core.js) — même
// convention que les autres fichiers test-*.js.
//
// CAUSE RÉELLE : catalog.json (scripts/build-catalog.js, table
// ID_SUFFIX) abrège NASDAQ/NYSE/NYSE ARCA dans l'id d'une société
// ("AAPL-NAS"), mais /api/market/search et le catalogue distant
// (market_catalog_listings) renvoient le nom complet ("NASDAQ") —
// remoteId() utilisait ce nom complet tel quel, calculant un id
// DIFFÉRENT ("AAPL-NASDAQ") pour la MÊME société déjà présente dans
// stocks/byId sous "AAPL-NAS". ensureRuntimeStock() ne détectait donc
// jamais le doublon (byId['AAPL-NASDAQ'] === undefined, même si
// byId['AAPL-NAS'] existe déjà) et créait une DEUXIÈME entrée.

const ID_EXCHANGE_SUFFIX = { NASDAQ:'NAS', NYSE:'NYS', 'NYSE ARCA':'NYA' };
function remoteId(ticker, exchangeCode){
  const t = String(ticker || '').toUpperCase().trim();
  const eBrut = String(exchangeCode || '').toUpperCase().trim();
  const e = ID_EXCHANGE_SUFFIX[eBrut] || eBrut;
  return e ? `${t}-${e}` : t;
}
function pickExchangeCode(x){
  if (!x) return '';
  return x.exchangeCode || x.exchange_code || x.exchangeMic || x.mic || x.micCode
    || x.exchangeShort || x.marketCode || x.exchange || '';
}
function ensureRuntimeStock(byId, stocks, meta){
  if (!meta || !meta.ticker) return null;
  const code = pickExchangeCode(meta);
  const id = remoteId(meta.ticker, code);
  if (byId[id]) return byId[id];
  const s = { id, name: meta.name || meta.ticker, ticker: String(meta.ticker).toUpperCase(), exchangeCode: code };
  stocks.push(s);
  byId[id] = s;
  return s;
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- RÉGRESSION CENTRALE : scénario exact du rapport ---------- */
{
  const byId = {}; const stocks = [];
  // 1) catalog.json charge Apple sous son id abrégé réel (scripts/build-catalog.js, ID_SUFFIX)
  const appleCatalogue = { id:'AAPL-NAS', name:'Apple Inc', ticker:'AAPL', exchangeCode:'NASDAQ' };
  stocks.push(appleCatalogue); byId[appleCatalogue.id] = appleCatalogue;

  // 2) /api/market/extra?kind=catalog (market_catalog_listings) renvoie Apple avec le nom COMPLET de la place
  const appleRecherche = { ticker:'AAPL', name:'Apple Inc', exchangeCode:'NASDAQ', sector:'Technologie', country:'United States' };
  ensureRuntimeStock(byId, stocks, appleRecherche);

  check('RÉGRESSION CENTRALE : Apple reste UNE SEULE fois dans stocks après un résultat de recherche (plus de doublon)',
    stocks.filter(s => s.ticker === 'AAPL').length === 1);
  check('le résultat de recherche a bien été reconnu comme la même société déjà catalogue (byId retourne l\'entrée existante)',
    byId['AAPL-NAS'] === appleCatalogue);
}

/* ---------- même scénario pour NYSE et NYSE ARCA (même table ID_SUFFIX) ---------- */
{
  const byId = {}; const stocks = [];
  const jnjCatalogue = { id:'JNJ-NYS', name:'Johnson & Johnson', ticker:'JNJ', exchangeCode:'NYSE' };
  stocks.push(jnjCatalogue); byId[jnjCatalogue.id] = jnjCatalogue;
  ensureRuntimeStock(byId, stocks, { ticker:'JNJ', name:'Johnson & Johnson', exchangeCode:'NYSE' });
  check('même correctif pour NYSE (Johnson & Johnson) : une seule entrée', stocks.filter(s => s.ticker === 'JNJ').length === 1);
}

/* ---------- une place NON concernée par l'abréviation reste inchangée ---------- */
{
  const byId = {}; const stocks = [];
  const asmlCatalogue = { id:'ASML-AS', name:'ASML Holding', ticker:'ASML', exchangeCode:'AS' };
  stocks.push(asmlCatalogue); byId[asmlCatalogue.id] = asmlCatalogue;
  ensureRuntimeStock(byId, stocks, { ticker:'ASML', name:'ASML Holding', exchangeCode:'AS' });
  check('une place déjà identique entre les deux sources (ex. Euronext Amsterdam "AS") n\'a jamais été affectée par ce bug',
    stocks.filter(s => s.ticker === 'ASML').length === 1);
}

/* ---------- non-régression : exchangeCode stocké reste la forme COMPLÈTE (API routing) ---------- */
{
  const byId = {}; const stocks = [];
  const s = ensureRuntimeStock(byId, stocks, { ticker:'MSFT', name:'Microsoft', exchangeCode:'NASDAQ' });
  check('RÉGRESSION (ne jamais casser /api/market/history|fundamentals|quotes) : exchangeCode STOCKÉ reste "NASDAQ" en toutes lettres, seul l\'id interne est abrégé',
    s.exchangeCode === 'NASDAQ' && s.id === 'MSFT-NAS');
}

/* ---------- une vraie société DIFFÉRENTE n'est jamais fusionnée à tort ---------- */
{
  const byId = {}; const stocks = [];
  const appleCatalogue = { id:'AAPL-NAS', name:'Apple Inc', ticker:'AAPL', exchangeCode:'NASDAQ' };
  stocks.push(appleCatalogue); byId[appleCatalogue.id] = appleCatalogue;
  ensureRuntimeStock(byId, stocks, { ticker:'APLE', name:'Apple Hospitality REIT', exchangeCode:'NYSE' });
  check('un ticker différent ("APLE" vs "AAPL") reste une société bien distincte, jamais fusionnée',
    stocks.length === 2);
}

/* ---------- rapport ---------- */
const fails = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
console.log('');
if (fails.length){
  console.log(`${fails.length}/${results.length} ÉCHEC(S)`);
  process.exit(1);
} else {
  console.log(`TOUS LES TESTS PASSENT (${results.length})`);
}
