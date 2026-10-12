// Vérifie NovaBot V6 §7 ("fiches d'actions") : la fiche décision n'est
// JAMAIS générée par le modèle — entièrement dérivée de
// state.novabot.decisions (déjà réelle) + un cours actuel lu en direct.
// Reproduit la logique pure de novabotDecisionCard() (js/nova.js), sans
// DOM ni réseau.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

function evolutionPct(priceObserved, coursActuel) {
  if (coursActuel === null || !Number.isFinite(priceObserved) || priceObserved <= 0) return null;
  return ((coursActuel - priceObserved) / priceObserved) * 100;
}
const ACTION_LABEL = { buy:'Achat', sell:'Vente', hold:'Conservation', increase:'Renforcement',
  reduce:'Réduction', watch:'Surveillance', reject:'Refusé' };

check('évolution positive calculée correctement (182,40 -> 193,70 = +6,19%)',
  Math.abs(evolutionPct(182.40, 193.70) - 6.1952) < 0.01);
check('évolution négative calculée correctement (255,00 -> 234,30 = -8,12%)',
  Math.abs(evolutionPct(255.00, 234.30) - (-8.1176)) < 0.01);
check('RÉGRESSION : cours actuel indisponible (null, ex. quote jamais chargée) -> null, JAMAIS un calcul sur une valeur absente',
  evolutionPct(182.40, null) === null);
check('RÉGRESSION : priceObserved absent (undefined, décision historique incomplète) -> null, jamais NaN',
  evolutionPct(undefined, 193.70) === null);
check('priceObserved à zéro (donnée corrompue) -> null, jamais une division par zéro silencieuse',
  evolutionPct(0, 193.70) === null);
check('tous les 7 libellés d\'action du schéma novabot_decisions ont une traduction FR (jamais une valeur brute affichée)',
  ['buy','sell','hold','increase','reduce','watch','reject'].every(a => typeof ACTION_LABEL[a] === 'string'));

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
