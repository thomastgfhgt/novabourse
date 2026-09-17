// Reproduit fidelement la logique de filtrage radarMin ajoutee a
// radarResults() (index.html) pour verifier son comportement sans navigateur.
function filtrerParScoreMin(list, radarMin){
  if (radarMin > 0) return list.filter(s => Number.isFinite(s.score) && s.score >= radarMin);
  return list;
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

const stocks = [
  { id: 'A', score: 82 },
  { id: 'B', score: 55 },
  { id: 'C', score: null },   // jamais analysee
  { id: 'D', score: 70 },
];

// radarMin=0 -> aucun filtre, tout passe (y compris les jamais-analysees).
{
  const out = filtrerParScoreMin(stocks, 0);
  check('radarMin=0 : aucun filtre', out.length === 4);
}
// radarMin=70 -> seules A et D (score reel >= 70) passent ; C (jamais
// analysee) est exclue, jamais traitee comme "echoue" ou "reussit" par defaut.
{
  const out = filtrerParScoreMin(stocks, 70);
  check('radarMin=70 : 2 resultats (A, D)', out.length === 2);
  check('radarMin=70 : C (score null) exclue, jamais faussement incluse', !out.some(s => s.id === 'C'));
  check('radarMin=70 : B (55 < 70) exclue', !out.some(s => s.id === 'B'));
}
// radarMin=50 -> A, B, D passent (55>=50), C toujours exclue.
{
  const out = filtrerParScoreMin(stocks, 50);
  check('radarMin=50 : 3 resultats (A, B, D)', out.length === 3);
  check('radarMin=50 : C toujours exclue (jamais analysee)', !out.some(s => s.id === 'C'));
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
