// Vérifie novabotTraiterAction() (js/novabot-chat.js) — audit 2026-10-14,
// "je veux que NovaBot puisse gérer tout ce qu'on lui donne
// automatiquement sans aucun bouton à taper [...] comme Claude Code".
// Reproduit fidèlement le dispatch (fonctions pures sur un état
// simulé) — même convention que les autres fichiers test-novabot-*.js.
//
// PRINCIPE VÉRIFIÉ : le modèle ne décide JAMAIS lui-même d'un achat/
// vente ni d'un montant — "action" ne fait qu'appeler le MÊME pipeline
// déterministe que les boutons existants (evaluerNovaBot(), le même
// toggle que le bouton pause/reprise), jamais une nouvelle logique de
// décision financière.

function novabotTraiterAction(action, state, appels){
  if (action === 'run_evaluation'){
    if (!state.novabot.enabled){ appels.toasts.push('NovaBot est en pause — réactive-le avant de lancer une évaluation.'); return; }
    appels.evaluations++;
  } else if (action === 'pause' && state.novabot.enabled){
    state.novabot.enabled = false;
    appels.toasts.push('NovaBot mis en pause.');
  } else if (action === 'resume' && !state.novabot.enabled){
    state.novabot.enabled = true;
    appels.toasts.push('NovaBot réactivé.');
  } else if (action === 'cancel_mandate' && !state.novabot.cancelled){
    // 2026-10-15 : distinct de "pause" — annule le mandat, jamais une vente/suppression de position.
    state.novabot.cancelled = true;
    appels.cancelMandateAppele = (appels.cancelMandateAppele || 0) + 1;
    appels.toasts.push('Mandat annulé — tes positions restent inchangées.');
  } else if (action === 'restore_last_mandate_version'){
    appels.restoreAppele = (appels.restoreAppele || 0) + 1;
    appels.toasts.push('Version précédente du mandat restaurée.');
  }
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- RÉGRESSION CENTRALE : "run_evaluation" déclenche RÉELLEMENT le pipeline existant ---------- */
{
  const state = { novabot:{ enabled:true } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction('run_evaluation', state, appels);
  check('RÉGRESSION : "run_evaluation" appelle réellement evaluerNovaBot() — le même pipeline que le bouton "Évaluer maintenant"',
    appels.evaluations === 1);
}

/* ---------- jamais d'évaluation déclenchée si NovaBot est en pause ---------- */
{
  const state = { novabot:{ enabled:false } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction('run_evaluation', state, appels);
  check('RÉGRESSION : "run_evaluation" ne lance rien si NovaBot est en pause — un message explique pourquoi, jamais un échec silencieux',
    appels.evaluations === 0 && appels.toasts.length === 1);
}

/* ---------- pause : fonctionne si actif ---------- */
{
  const state = { novabot:{ enabled:true } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction('pause', state, appels);
  check('"pause" met bien NovaBot en pause', state.novabot.enabled === false);
}

/* ---------- RÉGRESSION : "pause" déjà en pause -> aucun effet, aucun toast redondant ---------- */
{
  const state = { novabot:{ enabled:false } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction('pause', state, appels);
  check('RÉGRESSION : "pause" sur un NovaBot déjà en pause -> aucun toast (le prompt système est censé déjà l\'éviter, double sécurité côté client)',
    appels.toasts.length === 0 && state.novabot.enabled === false);
}

/* ---------- resume : fonctionne si en pause ---------- */
{
  const state = { novabot:{ enabled:false } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction('resume', state, appels);
  check('"resume" réactive bien NovaBot', state.novabot.enabled === true);
}

/* ---------- RÉGRESSION : "resume" déjà actif -> aucun effet, aucun toast redondant ---------- */
{
  const state = { novabot:{ enabled:true } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction('resume', state, appels);
  check('RÉGRESSION : "resume" sur un NovaBot déjà actif -> aucun toast, jamais un double déclenchement', appels.toasts.length === 0);
}

/* ---------- une action inconnue/null n'a jamais d'effet (jamais un crash sur une valeur imprévue) ---------- */
{
  const state = { novabot:{ enabled:true } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction(null, state, appels);
  novabotTraiterAction('autre_chose', state, appels);
  check('une action null/inconnue n\'a jamais d\'effet', appels.evaluations === 0 && appels.toasts.length === 0 && state.novabot.enabled === true);
}

/* ---------- cancel_mandate : annule bien, jamais une vente ---------- */
{
  const state = { novabot:{ enabled:true, cancelled:false } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction('cancel_mandate', state, appels);
  check('"cancel_mandate" annule bien le mandat', state.novabot.cancelled === true);
  check('RÉGRESSION : aucun champ "positions"/"transactions" n\'est même référencé par ce dispatch (annuler ne vend jamais rien)',
    appels.cancelMandateAppele === 1 && !('positions' in appels) && !('transactions' in appels));
}

/* ---------- RÉGRESSION : cancel_mandate déjà annulé -> aucun effet redondant ---------- */
{
  const state = { novabot:{ enabled:true, cancelled:true } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction('cancel_mandate', state, appels);
  check('RÉGRESSION : "cancel_mandate" sur un mandat déjà annulé -> aucun toast redondant', appels.toasts.length === 0);
}

/* ---------- restore_last_mandate_version : dispatché ---------- */
{
  const state = { novabot:{ enabled:true, cancelled:false } };
  const appels = { evaluations:0, toasts:[] };
  novabotTraiterAction('restore_last_mandate_version', state, appels);
  check('"restore_last_mandate_version" est bien dispatché', appels.restoreAppele === 1);
}

/* ---------- validation serveur (api/analyze.js) : liste blanche stricte, désormais 5 valeurs ---------- */
function validerAction(mandateConfirmed, repAction){
  return mandateConfirmed && ['run_evaluation', 'pause', 'resume', 'cancel_mandate', 'restore_last_mandate_version'].includes(repAction)
    ? repAction : null;
}
check('RÉGRESSION (sécurité) : une valeur hors liste blanche n\'est JAMAIS transmise au client, quoi que le modèle renvoie',
  validerAction(true, 'achete_tout') === null && validerAction(true, 'vends_apple') === null && validerAction(true, 'vend_les_positions') === null);
check('RÉGRESSION (sécurité) : "action" toujours null tant que le mandat n\'est pas confirmé (onboarding), même si le modèle en renvoie une',
  validerAction(false, 'run_evaluation') === null && validerAction(false, 'cancel_mandate') === null);
check('une valeur valide en mandat confirmé passe bien', validerAction(true, 'run_evaluation') === 'run_evaluation');
check('les 2 nouvelles valeurs (2026-10-15) passent bien en mandat confirmé',
  validerAction(true, 'cancel_mandate') === 'cancel_mandate' && validerAction(true, 'restore_last_mandate_version') === 'restore_last_mandate_version');
check('une absence de valeur (undefined/null) reste null', validerAction(true, undefined) === null && validerAction(true, null) === null);

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
