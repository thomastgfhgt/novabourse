// Vérifie NovaBot V5 Phase A (2026-10-11 : "audit et correction de la
// création, ouverture et sauvegarde des conversations") sans réseau ni
// navigateur : reproduit fidèlement
// 1) novabotGrouperParDate() (js/nova.js) — groupement Aujourd'hui/Hier/
//    7 derniers jours/Plus anciennes ;
// 2) la préférence lastConversationId sur list[0] dans
//    novabotConversationsCharger() (js/novabot-chat.js) ;
// 3) les manipulations de liste d'archiver/désarchiver (js/novabot-chat.js).
// Même convention que les fichiers test-novabot-*.js précédents.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

/* ---------- 1) novabotGrouperParDate() (copie de js/nova.js) ---------- */
function grouperParDate(list, maintenant = Date.now()) {
  const jour = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const aujourdhuiJour = jour(maintenant);
  const hierJour = aujourdhuiJour - 86400000;
  const septJoursJour = aujourdhuiJour - 7 * 86400000;
  const groupes = { aujourdhui: [], hier: [], septJours: [], plusAnciennes: [] };
  for (const c of list) {
    const j = jour(new Date(c.updatedAt || c.createdAt).getTime());
    if (j === aujourdhuiJour) groupes.aujourdhui.push(c);
    else if (j === hierJour) groupes.hier.push(c);
    else if (j > septJoursJour) groupes.septJours.push(c);
    else groupes.plusAnciennes.push(c);
  }
  return groupes;
}

{
  // Horloge fixe : 2026-10-11 15:00 locale, pour un test déterministe.
  const MAINTENANT = new Date(2026, 9, 11, 15, 0, 0).getTime();
  const iso = (annee, mois, jour, heure) => new Date(annee, mois, jour, heure).toISOString();
  const liste = [
    { id: 'a', updatedAt: iso(2026, 9, 11, 9) },   // aujourd'hui, 9h (avant "maintenant")
    { id: 'b', updatedAt: iso(2026, 9, 11, 23) },  // aujourd'hui, 23h — toujours AUJOURD'HUI
    { id: 'c', updatedAt: iso(2026, 9, 10, 23, 59) }, // hier 23h59 — jamais "aujourd'hui" malgré <24h
    { id: 'd', updatedAt: iso(2026, 9, 10, 1) },   // hier, tôt le matin
    { id: 'e', updatedAt: iso(2026, 9, 5, 12) },   // il y a 6 jours -> "7 derniers jours"
    { id: 'f', updatedAt: iso(2026, 9, 3, 12) },   // il y a 8 jours -> "plus anciennes" (hors fenêtre de 7j)
    { id: 'g', updatedAt: iso(2026, 8, 1, 12) },   // très ancien
  ];
  const g = grouperParDate(liste, MAINTENANT);
  check('RÉGRESSION : une conversation d\'hier 23h59 va sous "Hier", jamais "Aujourd\'hui" malgré moins de 24h d\'écart',
    g.hier.some(c => c.id === 'c') && !g.aujourdhui.some(c => c.id === 'c'));
  check('"Aujourd\'hui" contient les deux entrées du jour calendaire courant',
    g.aujourdhui.length === 2 && g.aujourdhui.every(c => ['a', 'b'].includes(c.id)));
  check('"Hier" contient les deux entrées du jour calendaire précédent',
    g.hier.length === 2 && g.hier.every(c => ['c', 'd'].includes(c.id)));
  check('"7 derniers jours" exclut aujourd\'hui/hier et une entrée vieille de 8 jours',
    g.septJours.length === 1 && g.septJours[0].id === 'e');
  check('"Plus anciennes" récupère tout ce qui dépasse 7 jours (8 jours ET très ancien)',
    g.plusAnciennes.length === 2 && g.plusAnciennes.every(c => ['f', 'g'].includes(c.id)));
  check('aucune conversation perdue ou dupliquée entre les 4 groupes',
    g.aujourdhui.length + g.hier.length + g.septJours.length + g.plusAnciennes.length === liste.length);
}
check('liste vide -> 4 groupes vides, jamais une exception', (() => {
  const g = grouperParDate([]);
  return g.aujourdhui.length === 0 && g.hier.length === 0 && g.septJours.length === 0 && g.plusAnciennes.length === 0;
})());

/* ---------- 2) préférence lastConversationId (copie de novabotConversationsCharger) ---------- */
function choisirConversationAOuvrir(list, lastConversationId) {
  const derniere = lastConversationId && list.find(c => c.id === lastConversationId);
  return (derniere || list[0]).id;
}
{
  const list = [{ id: 'recent' }, { id: 'ancienne' }, { id: 'tres-ancienne' }];
  check('RÉGRESSION : rouvre la conversation EXACTE quittée précédemment, pas forcément la plus récente',
    choisirConversationAOuvrir(list, 'ancienne') === 'ancienne');
  check('lastConversationId absent de la liste reçue (supprimée ailleurs) -> repli sûr sur list[0]',
    choisirConversationAOuvrir(list, 'id-inexistant') === 'recent');
  check('lastConversationId null (première visite) -> list[0], jamais une exception',
    choisirConversationAOuvrir(list, null) === 'recent');
}

/* ---------- 3) archiver/désarchiver : manipulations de liste (copie de js/novabot-chat.js) ---------- */
function archiverDansListes(list, archivedList, archivedLoaded, id) {
  const c = list.find(x => x.id === id);
  const nouvelleListe = list.filter(x => x.id !== id);
  const nouvelleArchivee = (c && archivedLoaded) ? [{ ...c, archived: true }, ...archivedList] : archivedList;
  return { list: nouvelleListe, archivedList: nouvelleArchivee };
}
function desarchiverDansListes(list, archivedList, id) {
  const c = archivedList.find(x => x.id === id);
  const nouvelleArchivee = archivedList.filter(x => x.id !== id);
  const nouvelleListe = c
    ? [{ ...c, archived: false }, ...list].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    : list;
  return { list: nouvelleListe, archivedList: nouvelleArchivee };
}
{
  const active = [{ id: 'x', title: 'X', updatedAt: '2026-10-11T10:00:00Z' }, { id: 'y', title: 'Y', updatedAt: '2026-10-10T10:00:00Z' }];
  const r1 = archiverDansListes(active, [], true, 'x');
  check('archiver retire la conversation de la liste ACTIVE', r1.list.length === 1 && r1.list[0].id === 'y');
  check('archiver l\'ajoute à la liste ARCHIVÉE (si déjà chargée) avec archived:true',
    r1.archivedList.length === 1 && r1.archivedList[0].id === 'x' && r1.archivedList[0].archived === true);

  const r2 = archiverDansListes(active, [], false, 'x');
  check('archiver sans la liste archivée encore chargée ne fabrique PAS une liste prématurée (reste vide, pas d\'incohérence au prochain chargement)',
    r2.archivedList.length === 0);

  const archivee = [{ id: 'x', title: 'X', updatedAt: '2026-10-05T10:00:00Z', archived: true }];
  const r3 = desarchiverDansListes([{ id: 'y', title: 'Y', updatedAt: '2026-10-10T10:00:00Z' }], archivee, 'x');
  check('désarchiver retire la conversation de la liste ARCHIVÉE', r3.archivedList.length === 0);
  check('désarchiver la réinsère dans la liste ACTIVE avec archived:false, re-triée par date',
    r3.list.length === 2 && r3.list.find(c => c.id === 'x').archived === false && r3.list[0].id === 'y');

  const r4 = desarchiverDansListes([{ id: 'y' }], [], 'inexistant');
  check('désarchiver un id introuvable dans la liste archivée ne modifie rien (jamais une exception)',
    r4.list.length === 1 && r4.archivedList.length === 0);
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
