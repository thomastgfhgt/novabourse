// Vérifie NovaBot V6 §8 : le quota de messages de conversation est bien
// SÉPARÉ et INDÉPENDANT du quota d'analyses NovaScore (bug réel rapporté :
// "Coucou" dans NovaBot consommait une des 5 analyses mensuelles du plan
// Découverte). Sans réseau ni Supabase : charge réellement api/_limits.js
// (pas une copie) pour verrouiller ce contrat dans le temps.

const { PLAN_LIMITS, CHAT_LIMITS, limiteDe, limiteChatDe, quotaBlock, quotaChatBlock } = require('../api/_limits.js');

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

check('RÉGRESSION : le quota chat free est bien plus généreux que le quota analyses free (bavarder != analyser)',
  limiteChatDe('free') > limiteDe('free'));
check('les deux quotas free restent des nombres finis réels (jamais Infinity par accident, qui désactiverait toute limite)',
  Number.isFinite(limiteDe('free')) && Number.isFinite(limiteChatDe('free')));
check('PLAN_LIMITS.free.analyses vaut toujours 5 (valeur connue au moment du diagnostic — si elle change, ce test doit être revu consciemment)',
  PLAN_LIMITS.free.analyses === 5);
check('CHAT_LIMITS a une entrée pour chaque plan existant dans PLAN_LIMITS (jamais un plan sans limite de chat définie)',
  Object.keys(PLAN_LIMITS).every(p => p in CHAT_LIMITS));
check('elite reste illimité pour les deux quotas (cohérence : un abonnement illimité l\'est pour tout)',
  !Number.isFinite(limiteDe('elite')) && !Number.isFinite(limiteChatDe('elite')));

{
  const q = quotaChatBlock('free', 3);
  check('quotaChatBlock("free", 3) calcule remaining correctement (limite - used)',
    q.remaining === limiteChatDe('free') - 3 && q.limit === limiteChatDe('free') && q.unlimited === false);
}
{
  const q = quotaChatBlock('elite', 999);
  check('quotaChatBlock("elite", ...) : unlimited=true, remaining/limit explicitement null (jamais un chiffre trompeur)',
    q.unlimited === true && q.remaining === null && q.limit === null);
}
check('un plan inconnu retombe sur la limite "free" (fail-safe, jamais undefined/NaN)',
  Number.isFinite(limiteChatDe('plan_inexistant')) && limiteChatDe('plan_inexistant') === limiteChatDe('free'));
check('RÉGRESSION : quotaBlock (analyses) et quotaChatBlock (chat) restent deux fonctions distinctes avec des résultats différents pour le même "used"',
  quotaBlock('free', 2).limit !== quotaChatBlock('free', 2).limit);

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
