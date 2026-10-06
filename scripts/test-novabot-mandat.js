// Reproduit fidelement les 2 nouvelles contraintes de mandat ajoutees a la
// boucle d'achat d'evaluerNovaBot() (js/core.js, §21/§24 du prompt maitre
// NovaTitre : "Garde 20% de cash" / "maximum 10% par position") pour les
// verifier sans navigateur. Fichier separe de test-novabot.js (deja vert,
// jamais touche) plutot que d'y risquer une regression.

function portfolioValue(wallet, prixDe) {
  let value = 0;
  for (const pos of wallet.positions) {
    const prix = prixDe(pos.id);
    if (prix !== null) value += prix * pos.qty;
  }
  return { total: value + wallet.cash, value };
}

function novabotAcheter(w, journal, id, montantEUR, prix, motif) {
  const qty = montantEUR / prix;
  const pos = w.positions.find(p => p.id === id);
  if (pos) {
    const totalQty = pos.qty + qty;
    pos.avg = ((pos.avg * pos.qty) + (prix * qty)) / totalQty;
    pos.qty = totalQty;
  } else {
    w.positions.push({ id, qty, avg: prix });
  }
  w.cash -= montantEUR;
  journal.push({ type: 'buy', stockId: id, qty, amountEUR: montantEUR, motif });
}

// Reproduit la boucle d'achat d'evaluerNovaBot() avec cashMinPct/maxPositionPct.
function evaluerAchats(cfg, watchlist, prixDe, scoreDe) {
  const journal = [];
  const w = cfg.wallet;
  const dejaDetenus = new Set(w.positions.map(p => p.id));
  for (const id of watchlist.filter(id => !dejaDetenus.has(id))) {
    const pf = portfolioValue(w, prixDe);
    const cashMin = (cfg.cashMinPct / 100) * pf.total;
    if (w.cash - cfg.tradeAmountEUR < cashMin) break;
    if (cfg.tradeAmountEUR > (cfg.maxPositionPct / 100) * pf.total) break;
    const score = scoreDe(id);
    if (score === null || score < cfg.scoreAchat) continue;
    const prix = prixDe(id);
    if (prix === null) continue;
    novabotAcheter(w, journal, id, cfg.tradeAmountEUR, prix, 'score');
  }
  return journal;
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }
const scoreToujours100 = () => 100;

// ---- Liquidités minimales : refuse un achat qui passerait sous le seuil ----
{
  // Portefeuille total 10000 (tout en cash), cashMinPct 20% -> réserve 2000.
  // Achat de 8500 laisserait 1500 de cash < 2000 -> refusé.
  const cfg = { wallet: { cash: 10000, positions: [] }, cashMinPct: 20, maxPositionPct: 100, tradeAmountEUR: 8500, scoreAchat: 0 };
  const j = evaluerAchats(cfg, ['AAPL'], () => 100, scoreToujours100);
  check('liquidités minimales : achat refusé s\'il fait passer le cash sous la réserve', j.length === 0 && cfg.wallet.cash === 10000);
}
{
  // Même réserve (20% de 10000 = 2000), mais achat de 1000 -> cash final 9000 > 2000 -> autorisé.
  const cfg = { wallet: { cash: 10000, positions: [] }, cashMinPct: 20, maxPositionPct: 100, tradeAmountEUR: 1000, scoreAchat: 0 };
  const j = evaluerAchats(cfg, ['AAPL'], () => 100, scoreToujours100);
  check('liquidités minimales : achat autorisé quand la réserve reste respectée', j.length === 1 && cfg.wallet.cash === 9000);
}
{
  // cashMinPct à 0 (aucune réserve exigée) -> tout l'ancien comportement (dépenser jusqu'à cash < tradeAmountEUR) reste possible.
  const cfg = { wallet: { cash: 10000, positions: [] }, cashMinPct: 0, maxPositionPct: 100, tradeAmountEUR: 9999, scoreAchat: 0 };
  const j = evaluerAchats(cfg, ['AAPL'], () => 100, scoreToujours100);
  check('liquidités minimales à 0% : non-régression, achat quasi total du cash toujours possible', j.length === 1);
}

// ---- Maximum par position : refuse un achat qui dépasserait le plafond ----
{
  // Portefeuille total 10000, maxPositionPct 10% -> plafond 1000.
  // tradeAmountEUR 1500 dépasse à lui seul ce plafond -> refusé.
  const cfg = { wallet: { cash: 10000, positions: [] }, cashMinPct: 0, maxPositionPct: 10, tradeAmountEUR: 1500, scoreAchat: 0 };
  const j = evaluerAchats(cfg, ['AAPL'], () => 100, scoreToujours100);
  check('maximum par position : achat refusé s\'il dépasserait le plafond à lui seul', j.length === 0);
}
{
  // tradeAmountEUR 500 reste sous le plafond de 1000 -> autorisé.
  const cfg = { wallet: { cash: 10000, positions: [] }, cashMinPct: 0, maxPositionPct: 10, tradeAmountEUR: 500, scoreAchat: 0 };
  const j = evaluerAchats(cfg, ['AAPL'], () => 100, scoreToujours100);
  check('maximum par position : achat autorisé sous le plafond', j.length === 1);
}

// ---- Les 2 contraintes utilisent le portefeuille TOTAL (cash + positions), pas seulement le cash ----
{
  // Cash 1000 seul, mais une position déjà détenue vaut 9000 -> total 10000.
  // maxPositionPct 10% -> plafond 1000, tradeAmountEUR 500 -> autorisé malgré un cash faible.
  const cfg = { wallet: { cash: 1000, positions: [{ id: 'MSFT', qty: 10, avg: 900 }] }, cashMinPct: 0, maxPositionPct: 10, tradeAmountEUR: 500, scoreAchat: 0 };
  const j = evaluerAchats(cfg, ['AAPL'], (id) => (id === 'MSFT' ? 900 : 100), scoreToujours100);
  check('plafond calculé sur le portefeuille TOTAL (cash + positions), pas seulement le cash', j.length === 1);
}

// ---- Non-régression : NovaScore sous le seuil toujours refusé, même mandat généreux ----
{
  const cfg = { wallet: { cash: 10000, positions: [] }, cashMinPct: 0, maxPositionPct: 100, tradeAmountEUR: 500, scoreAchat: 70 };
  const j = evaluerAchats(cfg, ['AAPL'], () => 100, () => 50);
  check('NovaScore sous le seuil toujours refusé (non-régression, logique inchangée)', j.length === 0);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
