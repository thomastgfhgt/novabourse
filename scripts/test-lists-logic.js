// Reproduit fidelement (verbatim) la logique des listes multiples ajoutee
// a index.html, avec un state/saveState factices, pour verifier son
// comportement sans navigateur.
let state = { lists: [] };
function saveState(){}

const LIST_COLORS = ['#3557f6','#00a651','#e0407a','#c47f0a','#5b4ae0','#0891b2','#dc2626','#64748b'];
const LIST_ICONS = ['star','shield','chart','wallet','list','book'];

function creerListe(nom, color, icon){
  const nomPropre = String(nom || '').trim().slice(0, 60);
  if (!nomPropre) return null;
  const id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const liste = {
    id, name: nomPropre,
    color: LIST_COLORS.includes(color) ? color : LIST_COLORS[state.lists.length % LIST_COLORS.length],
    icon: LIST_ICONS.includes(icon) ? icon : 'star',
    items: [],
  };
  state.lists.push(liste);
  saveState();
  return liste;
}
function renommerListe(id, nom){
  const l = state.lists.find(x => x.id === id);
  if (!l) return;
  const nomPropre = String(nom || '').trim().slice(0, 60);
  if (nomPropre) l.name = nomPropre;
  saveState();
}
function recolorerListe(id, color, icon){
  const l = state.lists.find(x => x.id === id);
  if (!l) return;
  if (LIST_COLORS.includes(color)) l.color = color;
  if (LIST_ICONS.includes(icon)) l.icon = icon;
  saveState();
}
function supprimerListe(id){
  const i = state.lists.findIndex(x => x.id === id);
  if (i < 0) return;
  state.lists.splice(i, 1);
  saveState();
}
function toggleItemListe(listeId, stockId){
  const l = state.lists.find(x => x.id === listeId);
  if (!l) return;
  const i = l.items.indexOf(stockId);
  if (i >= 0) l.items.splice(i, 1);
  else l.items.push(stockId);
  saveState();
}
const listesAvec = (stockId) => state.lists.filter(l => l.items.includes(stockId));

// Le merge de loadState() pour un tableau `lists` corrompu/ancien (reproduit
// verbatim) : verifie qu'un element invalide est filtre, pas tout le tableau.
function mergeLists(saved){
  return Array.isArray(saved)
    ? saved.filter(l => l && typeof l.id === 'string' && typeof l.name === 'string')
      .map(l => ({
        id: l.id, name: l.name,
        color: typeof l.color === 'string' ? l.color : '#3557f6',
        icon: typeof l.icon === 'string' ? l.icon : 'star',
        items: Array.isArray(l.items) ? [...new Set(l.items.filter(x => typeof x === 'string'))] : [],
      }))
    : [];
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// Creation
{
  const l = creerListe('  Dividendes  ');
  check('creerListe : nom nettoye (trim)', l.name === 'Dividendes');
  check('creerListe : id genere unique', typeof l.id === 'string' && l.id.length > 0);
  check('creerListe : items vide au depart', l.items.length === 0);
  check('creerListe : couleur par defaut valide', LIST_COLORS.includes(l.color));
}
// Nom vide -> refuse
{
  const before = state.lists.length;
  const l = creerListe('   ');
  check('creerListe : nom vide refuse (null)', l === null);
  check('creerListe : nom vide ne cree rien', state.lists.length === before);
}
// Renommage
{
  const l = state.lists[0];
  renommerListe(l.id, 'Rendement');
  check('renommerListe : nom mis a jour', state.lists[0].name === 'Rendement');
  renommerListe(l.id, '   ');
  check('renommerListe : nom vide ignore (garde l\'ancien)', state.lists[0].name === 'Rendement');
}
// Couleur/icone
{
  const l = state.lists[0];
  recolorerListe(l.id, '#e0407a', 'wallet');
  check('recolorerListe : couleur valide appliquee', l.color === '#e0407a');
  check('recolorerListe : icone valide appliquee', l.icon === 'wallet');
  recolorerListe(l.id, '#000000', 'inconnu');
  check('recolorerListe : couleur invalide ignoree', l.color === '#e0407a');
  check('recolorerListe : icone invalide ignoree', l.icon === 'wallet');
}
// Toggle d'un item
{
  const l = state.lists[0];
  toggleItemListe(l.id, 'AAPL-NAS');
  check('toggleItemListe : ajout', l.items.includes('AAPL-NAS'));
  toggleItemListe(l.id, 'AAPL-NAS');
  check('toggleItemListe : retrait au second toggle', !l.items.includes('AAPL-NAS'));
}
// listesAvec
{
  const l2 = creerListe('Tech');
  toggleItemListe(state.lists[0].id, 'MSFT-NAS');
  toggleItemListe(l2.id, 'MSFT-NAS');
  const trouvees = listesAvec('MSFT-NAS');
  check('listesAvec : trouve les 2 listes contenant le meme stock', trouvees.length === 2);
}
// Suppression
{
  const nb = state.lists.length;
  const l = state.lists[0];
  supprimerListe(l.id);
  check('supprimerListe : une liste en moins', state.lists.length === nb - 1);
  check('supprimerListe : id absent supprime -> aucun crash', (() => { supprimerListe('inexistant'); return true; })());
}
// Migration/merge defensif
{
  const merged = mergeLists([
    { id: 'a', name: 'Valide', items: ['X', 'Y', 'Y'] },      // doublon dans items
    { id: 'b' },                                              // name manquant -> filtre
    { name: 'sans id' },                                      // id manquant -> filtre
    null,                                                      // element null -> filtre
    { id: 'c', name: 'Sans couleur ni icone' },
  ]);
  check('mergeLists : elements invalides filtres (3 valides sur 5)', merged.length === 2);
  check('mergeLists : doublons d\'items deduplique', merged[0].items.length === 2);
  check('mergeLists : couleur/icone par defaut si absents', merged[1].color === '#3557f6' && merged[1].icon === 'star');
  check('mergeLists : entree non-array -> tableau vide', mergeLists(null).length === 0 && mergeLists('oops').length === 0);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
