// Vérifie le câblage d'autonomyMode dans le pipeline NovaBot (2026-10-09) :
// reproduit fidèlement la logique de novabotAccepterDecision()/
// novabotRefuserDecision() (js/core.js) et le routage "pending" vs
// exécution immédiate selon le mode, sans réseau ni navigateur. Même
// convention que les fichiers test-novabot-*.js précédents.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

/* ---------- routage pending vs immédiat (copie d'evaluerNovaBot()) ---------- */
function routerAchat(autonomyMode, verdictAllowed){
  if (!verdictAllowed) return 'reject';
  if (autonomyMode !== 'auto') return 'pending';
  return 'simulated';
}
check('mode "auto" + Risk Engine OK -> exécution immédiate', routerAchat('auto', true) === 'simulated');
check('mode "advice" + Risk Engine OK -> mis EN ATTENTE, jamais exécuté directement', routerAchat('advice', true) === 'pending');
check('mode "semi_auto" + Risk Engine OK -> mis EN ATTENTE (même règle qu\'"advice" dans cette passe)', routerAchat('semi_auto', true) === 'pending');
check('Risk Engine KO -> toujours "reject", quel que soit le mode (jamais une mise en attente d\'un achat déjà interdit)',
  routerAchat('auto', false) === 'reject' && routerAchat('advice', false) === 'reject');

/* ---------- novabotAccepterDecision() (copie simplifiée) ---------- */
function novabotRiskCheckSimple(intent, wallet, mandate){
  const violations = [];
  if (intent.amountEUR > wallet.cash) violations.push({ type:'cash_insuffisant', message:'Liquidités insuffisantes.' });
  return { allowed: violations.length === 0, violations };
}
function accepterDecision(d, wallet, mandate){
  if (!d || d.executionStatus !== 'pending' || d.action !== 'buy') return { ok:false };
  const verdict = novabotRiskCheckSimple({ amountEUR:d.amountEUR }, wallet, mandate);
  if (!verdict.allowed){
    d.executionStatus = 'rejected';
    return { ok:false, msg:'refuse_a_execution' };
  }
  wallet.cash -= d.amountEUR;
  d.executionStatus = 'simulated';
  return { ok:true };
}
{
  const d = { id:'nd1', action:'buy', amountEUR:1000, executionStatus:'pending' };
  const wallet = { cash:5000 };
  const r = accepterDecision(d, wallet, {});
  check('accepter une décision en attente avec assez de cash -> exécutée, cash débité',
    r.ok === true && d.executionStatus === 'simulated' && wallet.cash === 4000);
}
{
  // le cash a changé depuis la proposition (ex. un autre achat entre-temps) -> refusé à l'exécution
  const d = { id:'nd2', action:'buy', amountEUR:9000, executionStatus:'pending' };
  const wallet = { cash:1000 };
  const r = accepterDecision(d, wallet, {});
  check('accepter une décision dont les conditions ont changé (cash insuffisant maintenant) -> REFUSÉE à l\'exécution, jamais forcée',
    r.ok === false && d.executionStatus === 'rejected' && wallet.cash === 1000);
}
{
  const d = { id:'nd3', action:'buy', amountEUR:500, executionStatus:'simulated' };
  const wallet = { cash:5000 };
  const r = accepterDecision(d, wallet, {});
  check('accepter une décision DÉJÀ traitée (pas "pending") -> aucun effet, jamais une double exécution',
    r.ok === false && wallet.cash === 5000);
}
{
  const d = { id:'nd4', action:'sell', amountEUR:500, executionStatus:'pending' };
  const wallet = { cash:5000 };
  const r = accepterDecision(d, wallet, {});
  check('accepter une décision qui n\'est pas un achat ("sell") -> refusée (seuls les achats passent par ce circuit)',
    r.ok === false);
}

/* ---------- refuser une décision ---------- */
function refuserDecision(d){
  if (!d || d.executionStatus !== 'pending') return false;
  d.executionStatus = 'skipped';
  return true;
}
{
  const d = { id:'nd5', executionStatus:'pending' };
  check('refuser une décision en attente -> passe à "skipped", jamais une transaction créée', refuserDecision(d) === true && d.executionStatus === 'skipped');
}
{
  const d = { id:'nd6', executionStatus:'simulated' };
  check('refuser une décision déjà exécutée -> aucun effet (jamais annulée après coup)',
    refuserDecision(d) === false && d.executionStatus === 'simulated');
}

/* ---------- rapport ---------- */
const fails = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
console.log('');
if (fails.length) {
  console.log(`${fails.length}/${results.length} ÉCHEC(S)`);
  process.exit(1);
} else {
  console.log(`TOUS LES TESTS PASSENT (${results.length})`);
}
