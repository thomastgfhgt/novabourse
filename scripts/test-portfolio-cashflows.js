// Reproduit fidelement la logique des depots/retraits/frais ajoutee a
// js/core.js (depositCash/withdrawCash/payFee + rejouerTransactions) pour
// la verifier sans navigateur. Meme convention que test-portfolio-breakdown.js.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// ---- depositCash/withdrawCash/payFee, reproduits a l'identique ----
function makeWallet(cash, invested) { return { cash, invested, positions: [], realizedPnL: 0 }; }

function depositCash(wallet, amountEUR) {
  if (!(amountEUR > 0)) return { ok: false, msg: 'Montant invalide' };
  wallet.cash += amountEUR;
  wallet.invested = (Number.isFinite(wallet.invested) ? wallet.invested : 0) + amountEUR;
  return { ok: true };
}
function withdrawCash(wallet, amountEUR) {
  if (!(amountEUR > 0)) return { ok: false, msg: 'Montant invalide' };
  if (amountEUR > wallet.cash) return { ok: false, msg: 'Liquidités insuffisantes' };
  wallet.cash -= amountEUR;
  wallet.invested = (Number.isFinite(wallet.invested) ? wallet.invested : 0) - amountEUR;
  return { ok: true };
}
function payFee(wallet, amountEUR) {
  if (!(amountEUR > 0)) return { ok: false, msg: 'Montant invalide' };
  if (amountEUR > wallet.cash) return { ok: false, msg: 'Liquidités insuffisantes' };
  wallet.cash -= amountEUR;
  return { ok: true };
}

// ---- rejouerTransactions, reproduite a l'identique (voir js/core.js) ----
function rejouerTransactions(transactions, startCash, startInvested) {
  const wallet = { cash: startCash, invested: startInvested, positions: [], realizedPnL: 0 };
  const triees = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const tx of triees) {
    if (tx.type === 'buy') {
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos) {
        const totalQty = pos.qty + tx.qty;
        pos.avg = ((pos.avg * pos.qty) + (tx.priceLocal * tx.qty)) / totalQty;
        pos.qty = totalQty;
      } else {
        wallet.positions.push({ id: tx.stockId, qty: tx.qty, avg: tx.priceLocal });
      }
      wallet.cash -= tx.amountEUR;
    } else if (tx.type === 'sell') {
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos) {
        pos.qty -= tx.qty;
        if (pos.qty <= 0.0001) wallet.positions = wallet.positions.filter(p => p.id !== tx.stockId);
      }
      wallet.cash += tx.amountEUR;
      if (Number.isFinite(tx.realizedGain)) wallet.realizedPnL += tx.realizedGain;
    } else if (tx.type === 'deposit') {
      wallet.cash += tx.amountEUR;
      wallet.invested += tx.amountEUR;
    } else if (tx.type === 'withdraw') {
      wallet.cash -= tx.amountEUR;
      wallet.invested -= tx.amountEUR;
    } else if (tx.type === 'fee') {
      wallet.cash -= tx.amountEUR;
    }
  }
  return wallet;
}

// ---- tests directs des 3 fonctions ----
{
  const w = makeWallet(1000, 1000);
  const r = depositCash(w, 500);
  check('depositCash : ok=true', r.ok === true);
  check('depositCash : cash augmente du montant (1000 -> 1500)', w.cash === 1500);
  check('depositCash : invested augmente autant (1000 -> 1500)', w.invested === 1500);
}
{
  const w = makeWallet(1000, 1000);
  const r = withdrawCash(w, 300);
  check('withdrawCash : ok=true', r.ok === true);
  check('withdrawCash : cash diminue du montant (1000 -> 700)', w.cash === 700);
  check('withdrawCash : invested diminue autant (1000 -> 700)', w.invested === 700);
}
{
  const w = makeWallet(100, 1000);
  const r = withdrawCash(w, 500);
  check('withdrawCash : refuse si cash insuffisant', r.ok === false && w.cash === 100 && w.invested === 1000);
}
{
  const w = makeWallet(1000, 1000);
  const r = payFee(w, 20);
  check('payFee : ok=true', r.ok === true);
  check('payFee : cash diminue du montant (1000 -> 980)', w.cash === 980);
  check('payFee : invested INCHANGÉ (un frais n\'est pas un retrait voulu, §36)', w.invested === 1000);
}
{
  const w = makeWallet(1000, 1000);
  check('depositCash : rejette un montant négatif', depositCash(w, -50).ok === false);
  check('depositCash : rejette zéro', depositCash(w, 0).ok === false);
}

// ---- test d'intégration : rejouerTransactions avec les 3 nouveaux types ----
{
  const transactions = [
    { type: 'deposit', amountEUR: 5000, date: '2026-01-01T00:00:00Z' },
    { type: 'buy', stockId: 'AAPL-NAS', qty: 2, priceLocal: 100, amountEUR: 200, date: '2026-01-02T00:00:00Z' },
    { type: 'fee', amountEUR: 5, date: '2026-01-03T00:00:00Z' },
    { type: 'withdraw', amountEUR: 1000, date: '2026-01-04T00:00:00Z' },
    { type: 'sell', stockId: 'AAPL-NAS', qty: 1, priceLocal: 120, amountEUR: 120, realizedGain: 20, date: '2026-01-05T00:00:00Z' },
  ];
  const w = rejouerTransactions(transactions, /*startCash*/ 15480, /*startInvested*/ 110000);
  // cash : 15480 +5000 -200 -5 -1000 +120 = 19395
  check('rejouerTransactions : cash final correct avec dépôt/frais/retrait mêlés à achat/vente', w.cash === 19395);
  // invested : 110000 +5000(deposit) -1000(withdraw) = 114000 (achat/vente/frais ne touchent jamais invested)
  check('rejouerTransactions : invested ne bouge que sur deposit/withdraw (110000 -> 114000)', w.invested === 114000);
  check('rejouerTransactions : position AAPL correcte après achat de 2 puis vente de 1', w.positions.length === 1 && Math.abs(w.positions[0].qty - 1) < 1e-9);
  check('rejouerTransactions : realizedPnL alimenté uniquement par la vente (20)', w.realizedPnL === 20);
}
{
  // Aucun flux de type deposit/withdraw : invested reste au capital de départ (non-régression).
  const transactions = [
    { type: 'buy', stockId: 'X', qty: 1, priceLocal: 50, amountEUR: 50, date: '2026-01-01T00:00:00Z' },
  ];
  const w = rejouerTransactions(transactions, 15480, 110000);
  check('rejouerTransactions : sans dépôt/retrait, invested reste au capital de départ (non-régression)', w.invested === 110000);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
