// Reproduit fidelement la logique de tri ajoutee a radarResults() pour la
// verifier sans navigateur.
function trier(list, sortKey, varDe) {
  const out = [...list];
  out.sort((a, b) => {
    if (sortKey === 'score') {
      const sa = Number.isFinite(a.score) ? a.score : null, sb = Number.isFinite(b.score) ? b.score : null;
      if (sa === null && sb === null) return a.name.localeCompare(b.name, 'fr');
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sb - sa;
    }
    if (sortKey === 'name') return a.name.localeCompare(b.name, 'fr');
    const va = varDe(a), vb = varDe(b);
    if (va === null && vb === null) return a.name.localeCompare(b.name, 'fr');
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  });
  return out;
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

const stocks = [
  { name: 'Zorro',   score: 40, perf: -2 },
  { name: 'Alpha',   score: null, perf: 5 },
  { name: 'Beta',    score: 90, perf: 1 },
  { name: 'Charlie', score: 60, perf: 10 },
];
const varDe = s => s.perf;

// Tri par performance (comportement historique / par defaut).
{
  const out = trier(stocks, 'perf', varDe);
  check('tri perf : Charlie (10) en tete', out[0].name === 'Charlie');
  check('tri perf : Zorro (-2) en dernier', out[out.length - 1].name === 'Zorro');
}
// Tri par Nova Score : les valeurs sans score (null) toujours en dernier,
// jamais melangees au hasard avec les valeurs notees.
{
  const out = trier(stocks, 'score', varDe);
  check('tri score : Beta (90) en tete', out[0].name === 'Beta');
  check('tri score : Alpha (score null) en dernier', out[out.length - 1].name === 'Alpha');
  check('tri score : ordre correct entre valeurs notees', out[1].name === 'Charlie' && out[2].name === 'Zorro');
}
// Tri par nom.
{
  const out = trier(stocks, 'name', varDe);
  check('tri nom : ordre alphabetique', out.map(s => s.name).join(',') === 'Alpha,Beta,Charlie,Zorro');
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
