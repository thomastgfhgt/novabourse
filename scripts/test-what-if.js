// Reproduit fidelement enregistrerTransaction()/queSiRienFait() et le
// filtrage defensif de loadState() pour `transactions`, verifies sans
// navigateur.

function enregistrerTransaction(state, entree) {
  state.transactions.push({ id: 'tx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(), ...entree });
}

function queSiRienFait(tx, byId, prixDe, toEUR) {
  if (!tx || tx.type !== 'sell') return null;
  const st = byId[tx.stockId];
  if (!st) return null;
  const prixActuel = prixDe(st);
  if (prixActuel === null) return null;
  const valeurAujourdhui = toEUR(prixActuel * tx.qty, st.cur);
  const difference = valeurAujourdhui - tx.amountEUR;
  return { valeurAujourdhui, montantRecu: tx.amountEUR, difference,
    differencePct: tx.amountEUR ? (difference / tx.amountEUR) * 100 : null };
}

function mergeTransactions(saved) {
  return Array.isArray(saved)
    ? saved.filter(t => t && typeof t.id === 'string' && (t.type === 'buy' || t.type === 'sell')
        && Number.isFinite(t.qty) && Number.isFinite(t.amountEUR) && typeof t.date === 'string')
    : [];
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// enregistrerTransaction : forme correcte.
{
  const state = { transactions: [] };
  enregistrerTransaction(state, { stockId: 'AAPL-NAS', ticker: 'AAPL', name: 'Apple', type: 'buy', qty: 2, priceLocal: 150, currency: 'USD', amountEUR: 280 });
  const tx = state.transactions[0];
  check('id genere', typeof tx.id === 'string' && tx.id.length > 0);
  check('date ISO valide', !Number.isNaN(Date.parse(tx.date)));
  check('champs transmis conserves', tx.type === 'buy' && tx.qty === 2 && tx.amountEUR === 280);
}

// queSiRienFait : le titre a monte depuis la vente -> difference positive.
{
  const byId = { 'X': { cur: 'EUR' } };
  const prixDe = () => 120;   // cours actuel
  const toEUR = (v) => v;     // simplifie : deja en EUR
  const tx = { type: 'sell', stockId: 'X', qty: 10, amountEUR: 1000 }; // vendu a 100/titre
  const q = queSiRienFait(tx, byId, prixDe, toEUR);
  check('valeur aujourdhui = 1200 (10 x 120)', q.valeurAujourdhui === 1200);
  check('difference = +200 (aurait mieux valu garder)', q.difference === 200);
  check('differencePct = 20%', q.differencePct === 20);
}

// queSiRienFait : le titre a baisse -> difference negative (vendre etait le bon choix).
{
  const byId = { 'X': { cur: 'EUR' } };
  const prixDe = () => 80;
  const toEUR = (v) => v;
  const tx = { type: 'sell', stockId: 'X', qty: 10, amountEUR: 1000 };
  const q = queSiRienFait(tx, byId, prixDe, toEUR);
  check('difference negative (vente etait avantageuse)', q.difference === -200);
}

// queSiRienFait : un ACHAT n'est jamais concerne (position toujours detenue).
{
  const q = queSiRienFait({ type: 'buy' }, {}, () => 100, v => v);
  check('achat -> null (non applicable)', q === null);
}

// queSiRienFait : cours actuel indisponible -> null, jamais une estimation.
{
  const byId = { 'X': { cur: 'EUR' } };
  const prixDe = () => null;
  const tx = { type: 'sell', stockId: 'X', qty: 10, amountEUR: 1000 };
  const q = queSiRienFait(tx, byId, prixDe, v => v);
  check('cours indisponible -> null (jamais devine)', q === null);
}

// queSiRienFait : titre disparu du catalogue -> null.
{
  const q = queSiRienFait({ type: 'sell', stockId: 'INCONNU', qty: 1, amountEUR: 10 }, {}, () => 5, v => v);
  check('stock introuvable -> null', q === null);
}

// mergeTransactions : filtrage defensif.
{
  const merged = mergeTransactions([
    { id: 't1', type: 'buy', qty: 1, amountEUR: 100, date: '2026-01-01' },
    { id: 't2', type: 'vente_invalide', qty: 1, amountEUR: 100, date: '2026-01-01' }, // type invalide
    { type: 'sell', qty: 1, amountEUR: 100, date: '2026-01-01' },                     // id manquant
    { id: 't4', type: 'sell', qty: 'beaucoup', amountEUR: 100, date: '2026-01-01' },  // qty non numerique
    null,
  ]);
  check('seule la transaction valide survit (1 sur 5)', merged.length === 1 && merged[0].id === 't1');
  check('entree non-array -> tableau vide', mergeTransactions(undefined).length === 0);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
