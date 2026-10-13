// Vérifie le correctif "conversations disparues" (audit 2026-10-13) :
// 1) novabotSauvegarderMessage() — plus jamais un échec de sauvegarde
//    totalement silencieux (fire-and-forget .catch(() => {})) : une
//    relance après échec, puis un signal visible (saveFailed) si la
//    relance échoue aussi. Reproduit fidèlement (js/novabot-chat.js),
//    avec un authFetch/render simulés — même convention que les autres
//    fichiers test-novabot-*.js (logique pure recopiée).
// 2) Contrat de code : AUCUN appel action=message dans novabot-chat.js
//    ne doit plus utiliser le pattern .catch(() => {}) fire-and-forget
//    (grep du fichier réel) — garde-fou contre une régression future qui
//    réintroduirait silencieusement le même bug.

const fs = require('fs');
const path = require('path');

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- 1) comportement de novabotSauvegarderMessage (recopié) ---------- */
function creerSauvegarde({ reponses }){
  // reponses : tableau d'objets {ok, id} ou {reject:true} consommés dans l'ordre,
  // un par appel réseau simulé (authFetch).
  let appelIdx = 0;
  const rendus = [];
  const authFetch = async () => {
    const r = reponses[appelIdx++];
    if (!r) throw new Error('appel réseau inattendu (pas assez de réponses simulées)');
    if (r.reject) throw new Error('réseau indisponible (simulé)');
    return { ok: r.ok, json: async () => (r.ok ? { id: r.id } : null) };
  };
  const render = () => rendus.push('render');
  async function novabotSauvegarderMessage(convId, msgObj, payload){
    const tenter = async () => {
      try {
        const r = await authFetch();
        return r.ok ? await r.json() : null;
      } catch { return null; }
    };
    let saved = await tenter();
    if (!saved) saved = await tenter(); // délai réel remplacé par un appel immédiat dans ce test
    if (saved?.id){
      msgObj.id = saved.id;
      if (msgObj.saveFailed){ msgObj.saveFailed = false; render(); }
    } else {
      msgObj.saveFailed = true;
      render();
    }
  }
  return { novabotSauvegarderMessage, rendus };
}

(async () => {
  /* Succès dès le premier appel : jamais de relance inutile, pas de
     saveFailed. */
  {
    const { novabotSauvegarderMessage } = creerSauvegarde({ reponses: [{ ok:true, id:'m1' }] });
    const msg = { role:'user', content:'bonjour' };
    await novabotSauvegarderMessage('conv1', msg, { role:'user', content:'bonjour' });
    check('succès au premier essai : id assigné, saveFailed jamais posé', msg.id === 'm1' && !msg.saveFailed);
  }

  /* RÉGRESSION centrale : premier essai échoue (réseau), relance réussit
     -> le message est quand même sauvegardé, jamais perdu. */
  {
    const { novabotSauvegarderMessage } = creerSauvegarde({ reponses: [{ reject:true }, { ok:true, id:'m2' }] });
    const msg = { role:'user', content:'deuxième message' };
    await novabotSauvegarderMessage('conv1', msg, { role:'user', content:'deuxième message' });
    check('RÉGRESSION : premier essai échoué, la relance automatique sauve quand même le message', msg.id === 'm2' && !msg.saveFailed);
  }

  /* RÉGRESSION centrale : les DEUX essais échouent -> jamais silencieux,
     saveFailed posé et visible (voir novabotSaveFailedBadge, js/nova.js). */
  {
    const { novabotSauvegarderMessage, rendus } = creerSauvegarde({ reponses: [{ reject:true }, { reject:true }] });
    const msg = { role:'assistant', content:'réponse perdue' };
    await novabotSauvegarderMessage('conv1', msg, { role:'assistant', content:'réponse perdue' });
    check('RÉGRESSION CENTRALE : échec des deux tentatives -> saveFailed=true (jamais un échec silencieux comme avant ce correctif)', msg.saveFailed === true);
    check('un render() est bien déclenché pour afficher le badge (jamais une UI figée sans retour visuel)', rendus.length >= 1);
  }

  /* Reprise manuelle (bouton Réessayer du badge) : un message déjà en
     échec, re-sauvegardé avec succès, voit son badge disparaître. */
  {
    const { novabotSauvegarderMessage } = creerSauvegarde({ reponses: [{ ok:true, id:'m3' }] });
    const msg = { role:'user', content:'texte', saveFailed:true };
    await novabotSauvegarderMessage('conv1', msg, { role:'user', content:'texte' });
    check('reprise manuelle réussie : saveFailed repasse à false, id assigné', msg.saveFailed === false && msg.id === 'm3');
  }

  /* ---------- 2) contrat de code : plus de fire-and-forget silencieux ---------- */
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'novabot-chat.js'), 'utf8');
  const occurencesActionMessage = (source.match(/action=message/g) || []).length;
  check('action=message référencé au moins une fois (le helper novabotSauvegarderMessage lui-même)', occurencesActionMessage >= 1);
  // Chaque sauvegarde de message doit passer par le helper, jamais un
  // nouvel appel authFetch(...).catch(() => {}) direct réintroduit à côté.
  const appelsDirectsFireAndForget = (source.match(/action=message[\s\S]{0,200}?\.catch\(\(\)\s*=>\s*\{\}\)/g) || []).length;
  check('RÉGRESSION (garde-fou anti-réapparition) : aucun appel action=message en fire-and-forget .catch(() => {}) hors du helper', appelsDirectsFireAndForget === 0);

  const results2 = results;
  const fails = results2.filter(([, ok]) => !ok);
  for (const [name, ok] of results2) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
  console.log('');
  if (fails.length){
    console.log(`${fails.length}/${results2.length} ÉCHEC(S)`);
    process.exit(1);
  } else {
    console.log(`TOUS LES TESTS PASSENT (${results2.length})`);
  }
})();
