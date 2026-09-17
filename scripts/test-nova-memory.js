// Reproduit fidelement la logique de rappel Nova Memory ajoutee a
// PAGES.stock (retrouver la derniere raison d'achat renseignee pour un
// titre precis) pour la verifier sans navigateur.
function derniereThese(transactions, stockId) {
  return [...transactions].reverse()
    .find(t => t.type === 'buy' && t.stockId === stockId && t.thesisReason);
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

const transactions = [
  { type: 'buy', stockId: 'AAPL-NAS', thesisReason: 'Croissance solide', date: '2026-01-01' },
  { type: 'buy', stockId: 'MSFT-NAS', thesisReason: null, date: '2026-02-01' },        // pas de these
  { type: 'sell', stockId: 'AAPL-NAS', thesisReason: null, date: '2026-03-01' },
  { type: 'buy', stockId: 'AAPL-NAS', thesisReason: 'Rachat après repli, thèse intacte', date: '2026-04-01' },
];

// Doit trouver la PLUS RECENTE these pour AAPL (celle du 04-01, pas celle du 01-01).
{
  const t = derniereThese(transactions, 'AAPL-NAS');
  check('trouve la these la plus recente', t.thesisReason === 'Rachat après repli, thèse intacte');
}
// MSFT a ete achete mais sans these renseignee -> aucun rappel.
{
  const t = derniereThese(transactions, 'MSFT-NAS');
  check('aucune these renseignee -> undefined (pas de rappel)', t === undefined);
}
// Titre jamais achete -> undefined.
{
  const t = derniereThese(transactions, 'GOOGL-NAS');
  check('titre jamais achete -> undefined', t === undefined);
}
// Un achat SANS these ne doit jamais faire remonter une these d'un AUTRE titre.
{
  const t = derniereThese([{ type: 'buy', stockId: 'X', thesisReason: 'these X' }], 'Y');
  check('these d\'un autre titre jamais confondue', t === undefined);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
