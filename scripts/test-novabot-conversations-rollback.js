// Vérifie le correctif "mise à jour optimiste sans annulation" sur
// archiver/désarchiver/renommer/supprimer une conversation (audit
// 2026-10-13, même classe de bug que la perte silencieuse de messages
// déjà corrigée) — js/novabot-chat.js. Reproduit fidèlement la logique
// (capturer l'état avant, l'annuler si le serveur confirme un échec),
// avec un authFetch simulé — même convention que les autres fichiers
// test-novabot-*.js.

async function archiver(conv, id, authFetch, toastAppele){
  const c = conv.list.find(x => x.id === id);
  conv.list = conv.list.filter(x => x.id !== id);
  if (c) conv.archivedList = [{ ...c, archived:true }, ...conv.archivedList];
  let reussi = false;
  try { const r = await authFetch(); reussi = r.ok; } catch { /* reussi reste false */ }
  if (!reussi && c){
    conv.archivedList = conv.archivedList.filter(x => x.id !== id);
    conv.list = [c, ...conv.list];
    toastAppele.push('Archivage impossible — réessaie dans un instant.');
  }
}
async function renommer(conv, id, nouveauTitre, authFetch, toastAppele){
  const entry = conv.list.find(c => c.id === id);
  const ancien = entry?.title;
  if (entry) entry.title = nouveauTitre;
  let reussi = false;
  try { const r = await authFetch(); reussi = r.ok; } catch { /* reussi reste false */ }
  if (!reussi && entry){
    entry.title = ancien;
    toastAppele.push('Renommage impossible — réessaie dans un instant.');
  }
}
async function supprimer(conv, id, authFetch, toastAppele){
  const c = conv.list.find(x => x.id === id);
  const index = conv.list.findIndex(x => x.id === id);
  conv.list = conv.list.filter(x => x.id !== id);
  let reussi = false;
  try { const r = await authFetch(); reussi = r.ok; } catch { /* reussi reste false */ }
  if (!reussi && c){
    conv.list.splice(index, 0, c);
    toastAppele.push('Suppression impossible — réessaie dans un instant.');
  }
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

(async () => {

/* ---------- archivage : succès -> reste archivé ---------- */
{
  const conv = { list:[{ id:'c1', title:'Conversation 1' }], archivedList:[] };
  const toasts = [];
  await archiver(conv, 'c1', async () => ({ ok:true }), toasts);
  check('archivage réussi : conversation retirée de list, présente dans archivedList', conv.list.length === 0 && conv.archivedList.length === 1);
  check('aucun toast d\'erreur si le serveur confirme', toasts.length === 0);
}

/* ---------- RÉGRESSION CENTRALE : archivage échoué -> annulé, conversation restaurée ---------- */
{
  const conv = { list:[{ id:'c1', title:'Conversation 1' }], archivedList:[] };
  const toasts = [];
  await archiver(conv, 'c1', async () => ({ ok:false }), toasts);
  check('RÉGRESSION : archivage réellement échoué -> la conversation reste dans list (jamais disparue silencieusement)',
    conv.list.length === 1 && conv.list[0].id === 'c1');
  check('RÉGRESSION : la conversation n\'est PAS dans archivedList après un échec (pas d\'état incohérent)', conv.archivedList.length === 0);
  check('un toast explicite informe l\'utilisateur de l\'échec', toasts.length === 1);
}

/* ---------- renommage échoué -> ancien titre restauré ---------- */
{
  const conv = { list:[{ id:'c1', title:'Ancien titre' }] };
  const toasts = [];
  await renommer(conv, 'c1', 'Nouveau titre', async () => ({ ok:false }), toasts);
  check('RÉGRESSION : renommage échoué -> l\'ancien titre est restauré, jamais un titre affiché qui n\'a pas réellement été enregistré',
    conv.list[0].title === 'Ancien titre');
}
{
  const conv = { list:[{ id:'c1', title:'Ancien titre' }] };
  const toasts = [];
  await renommer(conv, 'c1', 'Nouveau titre', async () => ({ ok:true }), toasts);
  check('renommage réussi -> le nouveau titre reste affiché', conv.list[0].title === 'Nouveau titre');
}

/* ---------- suppression échouée -> conversation restaurée à SA PLACE D'ORIGINE ---------- */
{
  const conv = { list:[{ id:'c1' }, { id:'c2' }, { id:'c3' }] };
  const toasts = [];
  await supprimer(conv, 'c2', async () => ({ ok:false }), toasts);
  check('RÉGRESSION : suppression réellement échouée -> la conversation reste visible (jamais réellement supprimée)',
    conv.list.length === 3);
  check('restaurée à SA POSITION D\'ORIGINE (index 1), pas ajoutée n\'importe où', conv.list[1].id === 'c2');
}
{
  const conv = { list:[{ id:'c1' }, { id:'c2' }] };
  const toasts = [];
  await supprimer(conv, 'c2', async () => ({ ok:true }), toasts);
  check('suppression réussie -> la conversation reste bien absente', conv.list.length === 1 && conv.list[0].id === 'c1');
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

})();
