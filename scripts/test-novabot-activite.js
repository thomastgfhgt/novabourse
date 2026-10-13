// Vérifie le panneau "NovaBot travaille" (audit 2026-10-13, V7 §4 — "je
// veux voir NovaBot travailler", qualifié par l'utilisateur de demande
// la plus importante). Reproduit fidèlement novabotActiviteDebuter/
// Conclure/EtapeDirecte (js/novabot-chat.js) — fonctions pures sur un
// état simple, même convention que les autres fichiers test-novabot-*.js.
//
// RÉGRESSION TROUVÉE EN ÉCRIVANT LE CORRECTIF LUI-MÊME : une première
// version suivait l'étape "en cours" via "la DERNIÈRE entrée du tableau
// avec le même libellé" — cassait dès qu'une étape s'intercalait avant
// sa conclusion (ex. une vente déclenchée PENDANT la vérification des
// positions détenues) : l'étape "Vérification..." restait bloquée
// "en cours" pour toujours dans l'IHM, une deuxième entrée dupliquée
// apparaissant à la place. Corrigé en suivant chaque étape par
// RÉFÉRENCE DIRECTE à son objet plutôt que par position/libellé.

function creerActivite(){
  return { ouvert:false, enCours:false, etapes:[], resume:null };
}
function debuter(activite, label){
  const etape = { label, statut:'en_cours', detail:null };
  activite.etapes.push(etape);
  return etape;
}
function conclure(etape, statut, detail){
  etape.statut = statut; etape.detail = detail || null;
}
function etapeDirecte(activite, label, statut, detail){
  activite.etapes.push({ label, statut, detail: detail || null });
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- RÉGRESSION CENTRALE : étape intercalée avant la conclusion ---------- */
{
  const a = creerActivite();
  const etapePositions = debuter(a, 'Vérification de 2 position(s) détenue(s)');
  etapeDirecte(a, 'Vente simulée : AAPL', 'terminee', 'Stop-loss déclenché');
  conclure(etapePositions, 'terminee', 'Positions vérifiées.');

  check('RÉGRESSION CENTRALE : l\'étape "Vérification..." est bien conclue malgré une étape intercalée, jamais bloquée "en cours"',
    a.etapes[0].statut === 'terminee' && a.etapes[0].label === 'Vérification de 2 position(s) détenue(s)');
  check('aucune étape "Vérification..." dupliquée (une seule entrée pour cette étape, pas deux)',
    a.etapes.filter(e => e.label.startsWith('Vérification')).length === 1);
  check('l\'étape intercalée (vente) reste bien présente, à sa place, inchangée', a.etapes[1].label === 'Vente simulée : AAPL');
  check('exactement 2 étapes au total (pas de doublon fantôme)', a.etapes.length === 2);
}

/* ---------- séquence normale : analyse d'un candidat (début -> conclusion) ---------- */
{
  const a = creerActivite();
  const etapeCandidat = debuter(a, 'Analyse de MSFT');
  conclure(etapeCandidat, 'terminee', 'NovaScore 82/100');
  check('étape normale correctement conclue (statut + détail)', a.etapes[0].statut === 'terminee' && a.etapes[0].detail === 'NovaScore 82/100');
}

/* ---------- échec réel (donnée indisponible) : jamais présenté comme une réussite ---------- */
{
  const a = creerActivite();
  const etapeCandidat = debuter(a, 'Analyse de XYZ');
  conclure(etapeCandidat, 'echouee', 'NovaScore indisponible (données insuffisantes).');
  check('RÉGRESSION : un échec réel (données manquantes) est marqué "echouee", jamais maquillé en "terminee"',
    a.etapes[0].statut === 'echouee');
}

/* ---------- plusieurs candidats analysés à la suite : chacun garde sa propre conclusion ---------- */
{
  const a = creerActivite();
  const e1 = debuter(a, 'Analyse de AAA');
  conclure(e1, 'terminee', 'NovaScore 90/100');
  const e2 = debuter(a, 'Analyse de BBB');
  conclure(e2, 'echouee', 'Cours indisponible.');
  const e3 = debuter(a, 'Analyse de CCC');
  conclure(e3, 'terminee', 'NovaScore 55/100');
  check('trois candidats analysés successivement -> trois étapes distinctes, chacune avec le bon statut final',
    a.etapes.length === 3 && a.etapes[0].statut === 'terminee' && a.etapes[1].statut === 'echouee' && a.etapes[2].statut === 'terminee');
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
