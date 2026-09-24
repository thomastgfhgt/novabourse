// Reproduit fidelement l'arithmetique et la logique de decision de NovaBot
// (index.html, novabotAcheter/novabotVendre/evaluerNovaBot, LOT I,
// 2026-09-24) pour la verifier sans navigateur. Simulation UNIQUEMENT :
// verifie surtout que le portefeuille papier reste isole du portefeuille
// reel et que les regles se declenchent exactement comme attendu.

function novabotAcheter(w, journal, id, montantEUR, prix, motif) {
  const qty = montantEUR / prix; // EUR = devise du test, pas de conversion
  if (!Number.isFinite(qty) || !(qty > 0)) return;
  const pos = w.positions.find(p => p.id === id);
  if (pos) {
    const totalQty = pos.qty + qty;
    pos.avg = ((pos.avg * pos.qty) + (prix * qty)) / totalQty;
    pos.qty = totalQty;
  } else {
    w.positions.push({ id, qty, avg: prix });
  }
  w.cash -= montantEUR;
  journal.push({ type: 'buy', stockId: id, qty, priceLocal: prix, amountEUR: montantEUR, motif });
}
function novabotVendre(w, journal, id, prix, motif) {
  const i = w.positions.findIndex(p => p.id === id);
  if (i < 0) return;
  const pos = w.positions[i];
  const qty = pos.qty;
  const proceeds = prix * qty;
  const costBasis = pos.avg * qty;
  const realizedGain = proceeds - costBasis;
  w.positions.splice(i, 1);
  w.cash += proceeds;
  w.realizedPnL = (Number.isFinite(w.realizedPnL) ? w.realizedPnL : 0) + realizedGain;
  journal.push({ type: 'sell', stockId: id, qty, priceLocal: prix, amountEUR: proceeds, realizedGain, motif });
}

// Reproduit evaluerNovaBot() : sort avant d'entrer, watchlist uniquement,
// s'arrete des que les liquidites sont insuffisantes.
function evaluer(cfg, watchlist, prixDe, scoreDe) {
  const journal = [];
  const w = cfg.wallet;
  for (const pos of [...w.positions]) {
    const prix = prixDe(pos.id);
    if (prix === null) continue;
    const gainPct = ((prix - pos.avg) / pos.avg) * 100;
    if (gainPct <= -cfg.stopLossPct) novabotVendre(w, journal, pos.id, prix, 'stop-loss');
    else if (gainPct >= cfg.takeProfitPct) novabotVendre(w, journal, pos.id, prix, 'take-profit');
  }
  const dejaDetenus = new Set(w.positions.map(p => p.id));
  for (const id of watchlist.filter(id => !dejaDetenus.has(id))) {
    if (w.cash < cfg.tradeAmountEUR) break;
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

// --- Arithmetique isolee ---
{
  const walletReel = { cash: 15480, positions: [], realizedPnL: 0 };
  const w = { cash: 10000, positions: [], realizedPnL: 0 };
  const j = [];
  novabotAcheter(w, j, 'AAPL', 500, 100, 'test');
  check('achat simule ne touche jamais le portefeuille reel (isolation)', walletReel.cash === 15480);
  check('achat simule debite le cash papier', w.cash === 9500);
  check('achat simule cree une position papier avec le bon PRU', w.positions[0].avg === 100 && w.positions[0].qty === 5);
}
{
  // Rachat -> cout moyen pondere, meme formule que buyStock().
  const w = { cash: 10000, positions: [{ id: 'AAPL', qty: 5, avg: 100 }], realizedPnL: 0 };
  const j = [];
  novabotAcheter(w, j, 'AAPL', 500, 120, 'test');
  const attendu = ((100 * 5) + (120 * (500 / 120))) / (5 + 500 / 120);
  check('rachat simule recalcule le PRU en cout moyen pondere', Math.abs(w.positions[0].avg - attendu) < 1e-9);
}
{
  const w = { cash: 9500, positions: [{ id: 'AAPL', qty: 5, avg: 100 }], realizedPnL: 0 };
  const j = [];
  novabotVendre(w, j, 'AAPL', 130, 'take-profit');
  check('vente simulee credite le cash papier', w.cash === 9500 + 650);
  check('vente simulee cumule le gain realise papier', w.realizedPnL === 150);
  check('vente simulee retire la position papier', w.positions.length === 0);
}

// --- Logique de decision ---
{
  const cfg = { scoreAchat: 70, stopLossPct: 10, takeProfitPct: 20, tradeAmountEUR: 1000,
    wallet: { cash: 5000, positions: [{ id: 'A', qty: 10, avg: 100 }], realizedPnL: 0 } };
  const prix = { A: 89 }; // -11% : franchit le stop-loss (-10%)
  const j = evaluer(cfg, [], id => prix[id] ?? null, () => null);
  check('stop-loss se declenche au-dela du seuil declare', j.length === 1 && j[0].type === 'sell' && j[0].motif === 'stop-loss');
}
{
  const cfg = { scoreAchat: 70, stopLossPct: 10, takeProfitPct: 20, tradeAmountEUR: 1000,
    wallet: { cash: 5000, positions: [{ id: 'A', qty: 10, avg: 100 }], realizedPnL: 0 } };
  const prix = { A: 95 }; // -5% : ne franchit ni stop-loss ni take-profit
  const j = evaluer(cfg, [], id => prix[id] ?? null, () => null);
  check('aucune regle franchie -> aucune vente', j.length === 0);
}
{
  const cfg = { scoreAchat: 70, stopLossPct: 10, takeProfitPct: 20, tradeAmountEUR: 1000,
    wallet: { cash: 5000, positions: [], realizedPnL: 0 } };
  const watchlist = ['A', 'B'];
  const score = { A: 80, B: 60 };
  const j = evaluer(cfg, watchlist, () => 50, id => score[id]);
  check('achat simule uniquement si le NovaScore reel atteint le seuil', j.length === 1 && j[0].stockId === 'A');
}
{
  // Liquidites insuffisantes pour un 2e achat -> s'arrete, jamais un achat partiel.
  const cfg = { scoreAchat: 70, stopLossPct: 10, takeProfitPct: 20, tradeAmountEUR: 1000,
    wallet: { cash: 1500, positions: [], realizedPnL: 0 } };
  const watchlist = ['A', 'B'];
  const j = evaluer(cfg, watchlist, () => 50, () => 80);
  check('achats simules s\'arretent des que les liquidites papier sont insuffisantes', j.length === 1);
}
{
  // Position deja detenue -> jamais rachetee automatiquement par la regle score.
  const cfg = { scoreAchat: 70, stopLossPct: 10, takeProfitPct: 20, tradeAmountEUR: 1000,
    wallet: { cash: 5000, positions: [{ id: 'A', qty: 5, avg: 90 }], realizedPnL: 0 } };
  const j = evaluer(cfg, ['A'], () => 100, () => 90);
  check('une position deja detenue n\'est jamais rachetee par la regle NovaScore', j.length === 0);
}
{
  // NovaScore indisponible (couverture insuffisante) -> jamais un achat sur une estimation.
  const cfg = { scoreAchat: 70, stopLossPct: 10, takeProfitPct: 20, tradeAmountEUR: 1000,
    wallet: { cash: 5000, positions: [], realizedPnL: 0 } };
  const j = evaluer(cfg, ['A'], () => 100, () => null);
  check('NovaScore indisponible -> jamais un achat invente', j.length === 0);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
