// Reproduit fidelement le calcul des metriques de diversification ajoutees
// a PAGES.portfolio pour les verifier sans navigateur.
function calculer(pf, bySector, byCur) {
  const positionsValides = pf.lines.filter(l => l.priceAvailable && l.value > 0);
  const maxPosition = positionsValides.reduce((max, l) => Math.max(max, l.value), 0);
  const maxPositionPct = pf.value ? Math.round(maxPosition / pf.value * 100) : 0;
  const secteursDistincts = Object.keys(bySector).length;
  const cashPct = pf.total ? Math.round(pf.cash / pf.total * 100) : 0;
  const maxDevise = Object.values(byCur).reduce((max, v) => Math.max(max, v), 0);
  const maxDevisePct = pf.value ? Math.round(maxDevise / pf.value * 100) : 0;
  return { maxPositionPct, secteursDistincts, cashPct, maxDevisePct };
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// Portefeuille concentre : une seule position, un seul secteur.
{
  const pf = {
    lines: [{ priceAvailable: true, value: 800 }],
    value: 800, total: 1000, cash: 200,
  };
  const bySector = { Technologie: 800 };
  const byCur = { USD: 800 };
  const m = calculer(pf, bySector, byCur);
  check('position concentree : 100% detectee', m.maxPositionPct === 100);
  check('1 seul secteur detecte', m.secteursDistincts === 1);
  check('liquidites 20% correctes (200/1000)', m.cashPct === 20);
  check('devise dominante 100%', m.maxDevisePct === 100);
}

// Portefeuille diversifie : 4 positions egales, secteurs et devises variees.
{
  const pf = {
    lines: [
      { priceAvailable: true, value: 250 }, { priceAvailable: true, value: 250 },
      { priceAvailable: true, value: 250 }, { priceAvailable: true, value: 250 },
    ],
    value: 1000, total: 1000, cash: 0,
  };
  const bySector = { Technologie: 300, Santé: 300, Finance: 200, Luxe: 200 };
  const byCur = { EUR: 600, USD: 400 };
  const m = calculer(pf, bySector, byCur);
  check('position max = 25% (bien reparti)', m.maxPositionPct === 25);
  check('4 secteurs distincts', m.secteursDistincts === 4);
  check('0% liquidites', m.cashPct === 0);
  check('devise dominante 60% (EUR)', m.maxDevisePct === 60);
}

// Position au prix indisponible -> exclue du calcul de concentration max.
{
  const pf = {
    lines: [{ priceAvailable: false, value: 0 }, { priceAvailable: true, value: 100 }],
    value: 100, total: 150, cash: 50,
  };
  const m = calculer(pf, {}, {});
  check('position indisponible exclue de maxPosition', m.maxPositionPct === 100);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
