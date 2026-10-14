// Vérifie la synchronisation des réglages de trading (NovaScore minimum,
// stop-loss, take-profit, montant par trade) vers le serveur — audit
// 2026-10-14 : ces réglages n'avaient jamais de colonne correspondante
// sur novabot_mandates, le cycle automatique utilisait donc TOUJOURS ses
// valeurs par défaut au lieu d'un réglage personnalisé. Reproduit
// fidèlement la validation serveur (api/me.js) et le repli du cycle
// (api/market/extra.js) — même convention que les autres fichiers
// test-novabot-*.js.

function validerTradingRules(m){
  return (m.tradingRules && typeof m.tradingRules === 'object') ? {
    scoreAchat: Number.isFinite(m.tradingRules.scoreAchat) ? Math.max(0, Math.min(100, m.tradingRules.scoreAchat)) : null,
    stopLossPct: Number.isFinite(m.tradingRules.stopLossPct) ? Math.max(1, Math.min(90, m.tradingRules.stopLossPct)) : null,
    takeProfitPct: Number.isFinite(m.tradingRules.takeProfitPct) ? Math.max(1, Math.min(500, m.tradingRules.takeProfitPct)) : null,
    tradeAmountEUR: Number.isFinite(m.tradingRules.tradeAmountEUR) ? Math.max(10, Math.min(1000000, m.tradingRules.tradeAmountEUR)) : null,
  } : null;
}

const NOVABOT_CRON_SCORE_ACHAT = 70;
const NOVABOT_CRON_TRADE_AMOUNT_EUR = 500;
function reglagesCycle(mandateRow){
  const tr = mandateRow?.trading_rules || {};
  return {
    stopLossPct: Number.isFinite(tr.stopLossPct) ? tr.stopLossPct : 10,
    takeProfitPct: Number.isFinite(tr.takeProfitPct) ? tr.takeProfitPct : 20,
    scoreAchat: Number.isFinite(tr.scoreAchat) ? tr.scoreAchat : NOVABOT_CRON_SCORE_ACHAT,
    tradeAmountEUR: Number.isFinite(tr.tradeAmountEUR) ? tr.tradeAmountEUR : NOVABOT_CRON_TRADE_AMOUNT_EUR,
  };
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- validation serveur : valeurs normales acceptées telles quelles ---------- */
{
  const v = validerTradingRules({ tradingRules:{ scoreAchat:80, stopLossPct:15, takeProfitPct:30, tradeAmountEUR:200 } });
  check('des réglages valides sont transmis sans modification', v.scoreAchat === 80 && v.stopLossPct === 15 && v.takeProfitPct === 30 && v.tradeAmountEUR === 200);
}

/* ---------- RÉGRESSION : valeurs hors bornes jamais propagées telles quelles (clamp, pas rejet silencieux) ---------- */
check('RÉGRESSION : scoreAchat hors bornes (150) est ramené à 100, jamais propagé tel quel au moteur de risque serveur',
  validerTradingRules({ tradingRules:{ scoreAchat:150 } }).scoreAchat === 100);
check('RÉGRESSION : tradeAmountEUR négatif/trop petit est ramené au minimum (10€)',
  validerTradingRules({ tradingRules:{ tradeAmountEUR:-50 } }).tradeAmountEUR === 10);
check('RÉGRESSION : takeProfitPct démesuré (10000%) est plafonné à 500%',
  validerTradingRules({ tradingRules:{ takeProfitPct:10000 } }).takeProfitPct === 500);

/* ---------- absence de tradingRules -> null, jamais une exception ---------- */
check('aucun tradingRules transmis -> null proprement, jamais un objet à moitié rempli', validerTradingRules({}) === null);

/* ---------- RÉGRESSION CENTRALE : le cycle automatique utilise le réglage réel de l'utilisateur ---------- */
{
  const mandateRow = { trading_rules: { scoreAchat: 85, stopLossPct: 8, takeProfitPct: 25, tradeAmountEUR: 150 } };
  const r = reglagesCycle(mandateRow);
  check('RÉGRESSION CENTRALE : le cycle automatique utilise bien le NovaScore minimum RÉELLEMENT choisi par l\'utilisateur (85), jamais le défaut (70)',
    r.scoreAchat === 85);
  check('même chose pour le montant par trade (150€ choisi, jamais le défaut 500€)', r.tradeAmountEUR === 150);
  check('même chose pour stop-loss/take-profit', r.stopLossPct === 8 && r.takeProfitPct === 25);
}

/* ---------- compte sans trading_rules (créé avant ce correctif) -> repli sur les défauts, jamais une erreur ---------- */
{
  const r1 = reglagesCycle({ trading_rules: null });
  const r2 = reglagesCycle(undefined);
  check('compte avec trading_rules=null -> repli propre sur les valeurs par défaut de l\'application',
    r1.scoreAchat === 70 && r1.tradeAmountEUR === 500 && r1.stopLossPct === 10 && r1.takeProfitPct === 20);
  check('mandat totalement absent (undefined) -> même repli, jamais un crash', r2.scoreAchat === 70);
}

/* ---------- rapport ---------- */
const fails = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
console.log('');
if (fails.length){
  console.log(`${fails.length}/${results.length} ÉCHEC(S)`);
  process.exit(1);
} else {
  console.log(`TOUS LES TESTS PASSENT (${results.length})`);
}
