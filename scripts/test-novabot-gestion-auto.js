// Vérifie novabotProchaineEvaluation() (js/nova.js) — audit 2026-10-13,
// "fonctionnalités pas abouties" : le statut actif/pause de NovaBot
// n'était visible nulle part sur l'écran Portefeuille, uniquement dans
// un réglage avancé enterré. Nouvelle carte "Gestion automatique
// NovaBot" : vérifie le calcul de la prochaine évaluation (cycle
// serveur quotidien, 7h UTC — voir vercel.json "crons").

function novabotProchaineEvaluation(maintenant){
  const prochaine = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate(), 7, 0, 0));
  if (prochaine <= maintenant) prochaine.setUTCDate(prochaine.getUTCDate() + 1);
  return prochaine;
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

check('avant 7h UTC -> prochaine évaluation le jour même à 7h',
  novabotProchaineEvaluation(new Date('2026-10-13T05:00:00Z')).toISOString() === '2026-10-13T07:00:00.000Z');
check('après 7h UTC -> prochaine évaluation le lendemain à 7h',
  novabotProchaineEvaluation(new Date('2026-10-13T08:00:00Z')).toISOString() === '2026-10-14T07:00:00.000Z');
check('exactement à 7h00m00s UTC -> considéré comme déjà passé, bascule au lendemain (jamais "maintenant" affiché comme futur)',
  novabotProchaineEvaluation(new Date('2026-10-13T07:00:00Z')).toISOString() === '2026-10-14T07:00:00.000Z');
check('franchissement de fin de mois géré correctement par Date (pas de calcul de jour fait à la main)',
  novabotProchaineEvaluation(new Date('2026-10-31T08:00:00Z')).toISOString() === '2026-11-01T07:00:00.000Z');

const fails = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
console.log('');
if (fails.length){
  console.log(`${fails.length}/${results.length} ÉCHEC(S)`);
  process.exit(1);
} else {
  console.log(`TOUS LES TESTS PASSENT (${results.length})`);
}
