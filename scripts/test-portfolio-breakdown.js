// Reproduit fidelement la logique d'agregation par pays/type d'actif
// ajoutee a PAGES.portfolio pour la verifier sans navigateur.
const MARKET_CATEGORIES = [
  { id:'tous', label:'Tous' }, { id:'stock', label:'Actions' }, { id:'etf', label:'ETF' },
  { id:'forex', label:'Devises' }, { id:'crypto', label:'Crypto' },
  { id:'index', label:'Indices' }, { id:'commodity', label:'Matières premières' },
];

function agreger(lines) {
  const byCountry = {};
  lines.forEach(l => { if (l.priceAvailable && l.stock && l.stock.country) byCountry[l.stock.country] = (byCountry[l.stock.country] || 0) + l.value; });
  const byType = {};
  lines.forEach(l => { if (l.priceAvailable && l.stock) {
    const label = MARKET_CATEGORIES.find(c => c.id === l.stock.type)?.label || l.stock.type;
    byType[label] = (byType[label] || 0) + l.value;
  } });
  return { byCountry, byType };
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

const lines = [
  { priceAvailable: true, value: 1000, stock: { country: 'France', type: 'stock' } },
  { priceAvailable: true, value: 500, stock: { country: 'France', type: 'stock' } },
  { priceAvailable: true, value: 300, stock: { country: 'États-Unis', type: 'etf' } },
  { priceAvailable: true, value: 200, stock: { country: null, type: 'crypto' } },   // pas de pays -> exclu de byCountry
  { priceAvailable: false, value: 0, stock: { country: 'Japon', type: 'stock' } },  // prix indisponible -> exclu des deux
];

const { byCountry, byType } = agreger(lines);

check('France agregee correctement (1000+500)', byCountry['France'] === 1500);
check('États-Unis present', byCountry['États-Unis'] === 300);
check('Pays null exclu (jamais une clé "null")', !('null' in byCountry) && Object.keys(byCountry).length === 2);
check('Position au prix indisponible exclue (Japon absent)', !('Japon' in byCountry));

check('type stock -> libellé "Actions" (via MARKET_CATEGORIES)', byType['Actions'] === 1500);
check('type etf -> libellé "ETF"', byType['ETF'] === 300);
check('type crypto -> libellé "Crypto" (compté même sans pays)', byType['Crypto'] === 200);

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
