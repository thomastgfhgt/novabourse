// Reproduit la logique de tri/filtre de l'aperçu "Marché" de l'accueil
// (js/page-home.js, correctif 2026-10-07 : stocks.slice(0,6) montrait des
// micro-valeurs quasi inconnues sans cours, "Hermes Transporte Blindados
// S.A." en tete, au lieu de grandes capitalisations) pour la verifier
// sans navigateur.

const TICKERS_APERCU_ACCUEIL = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'ASML'];

function apercuMarche(stocks){
  return TICKERS_APERCU_ACCUEIL
    .map(t => stocks.find(s => s.ticker === t))
    .filter(Boolean);
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// ---- ordre de `stocks` (catalogue) n'influence jamais le resultat ----
{
  const stocks = [
    { ticker: 'HERMESC1', name: 'Hermes Transporte Blindados S.A.' },
    { ticker: 'BMK.V', name: 'MacDonald Mines Exploration Ltd' },
    { ticker: 'AAPL', name: 'Apple Inc' },
    { ticker: 'MSFT', name: 'Microsoft Corporation' },
  ];
  const r = apercuMarche(stocks);
  check('micro-valeurs du catalogue (HERMESC1/BMK.V) jamais affichees ici', !r.some(s => s.ticker === 'HERMESC1' || s.ticker === 'BMK.V'));
  check('AAPL et MSFT (liste fixe) presents malgre leur position en fin de tableau', r.length === 2 && r[0].ticker === 'AAPL' && r[1].ticker === 'MSFT');
}

// ---- ordre de sortie = ordre de TICKERS_APERCU_ACCUEIL, jamais l'ordre d'arrivee dans stocks ----
{
  const stocks = [
    { ticker: 'ASML', name: 'ASML Holding' },
    { ticker: 'AAPL', name: 'Apple Inc' },
  ];
  const r = apercuMarche(stocks);
  check('ordre toujours AAPL avant ASML (ordre de la liste fixe), meme si ASML arrive en 1er dans stocks', r[0].ticker === 'AAPL' && r[1].ticker === 'ASML');
}

// ---- valeur pas encore resolue -> absente, jamais une entree vide/cassee ----
{
  const stocks = [{ ticker: 'AAPL', name: 'Apple Inc' }];
  const r = apercuMarche(stocks);
  check('valeurs non encore resolues simplement absentes (pas de trou/undefined)', r.length === 1 && r.every(Boolean));
}

// ---- stocks vide -> liste vide, jamais une erreur ----
{
  const r = apercuMarche([]);
  check('catalogue vide -> liste vide, aucune exception', Array.isArray(r) && r.length === 0);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
