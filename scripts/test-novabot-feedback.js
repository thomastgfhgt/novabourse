// Vérifie le correctif de persistance de l'avis (pouce haut/bas) sur un
// message NovaBot (audit 2026-10-13, "fonctionnalités pas abouties") :
// avant ce correctif, novabotMessageFeedback() ne modifiait QUE l'état
// local — semblait fonctionner (bascule visuelle) mais disparaissait à
// la moindre actualisation. Reproduit fidèlement la logique optimiste +
// annulation en cas d'échec (js/novabot-chat.js), avec un authFetch
// simulé — même convention que les autres fichiers test-novabot-*.js.

async function novabotMessageFeedback(messages, index, valeur, { authFetch, render }){
  const m = messages[index];
  if (!m || m.role !== 'assistant') return;
  const avant = m.feedback || null;
  const apres = avant === valeur ? null : valeur;
  m.feedback = apres;
  render();
  if (!m.id) return;
  try {
    const r = await authFetch();
    if (!r.ok) throw new Error('réponse non ok');
  } catch (e){
    m.feedback = avant;
    render();
  }
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

(async () => {
  /* ---------- succès : l'avis reste posé ---------- */
  {
    const messages = [{ role:'assistant', content:'x', id:'m1' }];
    const rendus = [];
    await novabotMessageFeedback(messages, 0, 'up', { authFetch: async () => ({ ok:true }), render: () => rendus.push(1) });
    check('avis positif persisté avec succès -> reste affiché', messages[0].feedback === 'up');
    check('render() appelé (retour visuel immédiat)', rendus.length === 1);
  }

  /* ---------- RÉGRESSION CENTRALE : échec serveur -> la bascule visuelle est annulée ---------- */
  {
    const messages = [{ role:'assistant', content:'x', id:'m2' }];
    await novabotMessageFeedback(messages, 0, 'down', { authFetch: async () => ({ ok:false }), render: () => {} });
    check('RÉGRESSION : si la sauvegarde échoue, l\'avis affiché est annulé (jamais un avis affiché qui n\'a pas réellement été pris en compte)',
      messages[0].feedback === null);
  }

  /* ---------- re-clic sur le même avis -> le retire (toggle) ---------- */
  {
    const messages = [{ role:'assistant', content:'x', id:'m3', feedback:'up' }];
    await novabotMessageFeedback(messages, 0, 'up', { authFetch: async () => ({ ok:true }), render: () => {} });
    check('cliquer à nouveau sur le même avis le retire (toggle), jamais bloqué sur une seule valeur', messages[0].feedback === null);
  }

  /* ---------- pas encore d'id serveur -> bascule locale uniquement, jamais d'appel réseau ---------- */
  {
    const messages = [{ role:'assistant', content:'x' }]; // pas de m.id : message pas encore sauvegardé
    let appele = false;
    await novabotMessageFeedback(messages, 0, 'up', { authFetch: async () => { appele = true; return { ok:true }; }, render: () => {} });
    check('sans id serveur (sauvegarde du message encore en cours) : bascule locale posée', messages[0].feedback === 'up');
    check('sans id serveur : aucun appel réseau tenté (rien à cibler)', appele === false);
  }

  /* ---------- un message utilisateur n'a pas d'avis (bouton réservé aux réponses Nova) ---------- */
  {
    const messages = [{ role:'user', content:'x', id:'m4' }];
    await novabotMessageFeedback(messages, 0, 'up', { authFetch: async () => ({ ok:true }), render: () => {} });
    check('un message role=user est ignoré (jamais de feedback posé dessus)', messages[0].feedback === undefined);
  }

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
