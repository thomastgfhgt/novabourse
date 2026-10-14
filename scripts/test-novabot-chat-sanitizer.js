// Vérifie le correctif du verrou anti-hallucination de NovaBot chat
// (audit 2026-10-13, bug réel rapporté : "Tu souhaites investir [donnée
// non vérifiée] [donnée non vérifiée]€..." en réponse à "j'aimerais
// investir 10000€"). Reproduit fidèlement nombresDuTexteUtilisateur() et
// construireAssainisseur() (api/analyze.js) — même convention que les
// autres fichiers test-novabot-*.js (fonctions pures recopiées).

function nombresDuTexteUtilisateur(messages){
  const nombres = new Set();
  const ajouter = n => { if (Number.isFinite(n)) nombres.add(Math.round(n * 100) / 100); };
  for (const m of messages){
    if (m.role !== 'user' || typeof m.content !== 'string') continue;
    for (const k of m.content.matchAll(/(\d+(?:[.,]\d+)?)\s*k\b/gi)){
      ajouter(Number(k[1].replace(',', '.')) * 1000);
    }
    for (const bloc of m.content.matchAll(/\d[\d .,]*\d|\d/g)){
      const brut = bloc[0];
      ajouter(Number(brut.replace(/[ .,]/g, '')));
      const finDecimale = brut.match(/^(.*)[,.](\d{1,2})$/);
      if (finDecimale) ajouter(Number(finDecimale[1].replace(/[ .,]/g, '') + '.' + finDecimale[2]));
    }
  }
  return [...nombres];
}

function construireAssainisseur(contexte){
  function nombresAutorises(valeur, acc){
    if (typeof valeur === 'number' && Number.isFinite(valeur)){
      for (const v of [valeur, valeur * 100]){
        for (const d of [0, 1, 2]) acc.add(v.toFixed(d));
      }
    } else if (Array.isArray(valeur)){
      valeur.forEach(v => nombresAutorises(v, acc));
    } else if (valeur && typeof valeur === 'object'){
      Object.values(valeur).forEach(v => nombresAutorises(v, acc));
    }
    return acc;
  }
  const autorises = nombresAutorises(contexte, new Set());
  const compteur = { retires: 0 };
  function assainirTexte(texte){
    if (typeof texte !== 'string') return texte;
    return texte.replace(/(?<!\d)-?\d{1,3}(?:[ .]\d{3})+(?:,\d+)?|(?<!\d)-?\d+(?:[.,]\d+)?/g, jeton => {
      const normalise = /^-?\d{1,3}(?:[ .]\d{3})+(?:,\d+)?$/.test(jeton)
        ? jeton.replace(/[ .]/g, '').replace(',', '.')
        : jeton.replace(',', '.');
      const n = Number(normalise);
      if (!Number.isFinite(n)) return jeton;
      for (const d of [0, 1, 2]) {
        if (autorises.has(n.toFixed(d))) return jeton;
      }
      compteur.retires++;
      return '[donnée non vérifiée]';
    });
  }
  return { assainirTexte, compteur };
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- scénario exact du rapport ---------- */
{
  const messages = [{ role:'user', content:"J'aimerais bien investir 10000€ dans des choses pas du tout risqué et pour le plus court possible fais ça automatiquement je te laisse tout gérer seul" }];
  const contexte = { mandateConfirmed:false, mandate:null, portfolio:null, montantsDeclaresParUtilisateur: nombresDuTexteUtilisateur(messages) };
  const { assainirTexte } = construireAssainisseur(contexte);
  const reponseModele = "Tu souhaites investir 10 000€ avec un faible risque et un horizon court. Je vais te proposer un mandat adapté.";
  const assaini = assainirTexte(reponseModele);
  check('RÉGRESSION CENTRALE : "10 000" dans la réponse du modèle n\'est plus redacté (l\'utilisateur l\'a lui-même écrit)',
    !assaini.includes('[donnée non vérifiée]'));
  check('le texte reste identique au mot "10 000" près (rien d\'autre modifié)', assaini === reponseModele);
}

/* ---------- §2 : toutes les écritures doivent être reconnues comme le MÊME montant ---------- */
{
  const ecritures = ['10000€', '10 000€', '10.000€', '10k€', '10 000 euros'];
  for (const ecriture of ecritures){
    const messages = [{ role:'user', content:`Je veux investir ${ecriture}` }];
    const nombres = nombresDuTexteUtilisateur(messages);
    check(`"${ecriture}" est reconnu comme 10000`, nombres.includes(10000));
  }
}

/* ---------- §6 : montants supplémentaires explicitement demandés ---------- */
{
  const cas = [
    { texte: '500€', attendu: 500 },
    { texte: '1 500,50€', attendu: 1500.50 },
    { texte: '25000€', attendu: 25000 },
    { texte: '100000€', attendu: 100000 },
    { texte: '500 dollars', attendu: 500 },
  ];
  for (const { texte, attendu } of cas){
    const nombres = nombresDuTexteUtilisateur([{ role:'user', content: texte }]);
    check(`"${texte}" -> ${attendu} correctement extrait`, nombres.includes(attendu));
  }
}

/* ---------- messages avec PLUSIEURS montants ---------- */
{
  const nombres = nombresDuTexteUtilisateur([{ role:'user', content: "J'ai 500€ de côté mais je veux en investir 10000 au total, donc ajouter 9500€." }]);
  check('plusieurs montants dans un même message -> tous extraits (500, 10000, 9500)',
    nombres.includes(500) && nombres.includes(10000) && nombres.includes(9500));
}

/* ---------- message avec une faute d'orthographe : n'affecte pas l'extraction des chiffres ---------- */
{
  const nombres = nombresDuTexteUtilisateur([{ role:'user', content: "Je voudrez investire 10000€ dans des valeures peu risqué" }]);
  check('une faute d\'orthographe dans le texte n\'empêche pas la reconnaissance du montant (10000)', nombres.includes(10000));
}

/* ---------- seuls les messages role=user alimentent l'ensemble autorisé (jamais les réponses du modèle lui-même) ---------- */
{
  const messages = [
    { role:'assistant', content: "Je te propose d'investir 42424€, un montant totalement inventé." },
    { role:'user', content: "D'accord pour 10000€" },
  ];
  const nombres = nombresDuTexteUtilisateur(messages);
  check('RÉGRESSION : un nombre dit par l\'ASSISTANT (role=assistant) n\'entre jamais dans l\'ensemble autorisé — seul l\'utilisateur peut "déverrouiller" un montant',
    !nombres.includes(42424) && nombres.includes(10000));
}

/* ---------- le verrou reste actif : un nombre réellement halluciné, jamais écrit par l'utilisateur, est toujours redacté ---------- */
{
  const messages = [{ role:'user', content: "Quel est le cours d'Apple ?" }];
  const contexte = { montantsDeclaresParUtilisateur: nombresDuTexteUtilisateur(messages) };
  const { assainirTexte, compteur } = construireAssainisseur(contexte);
  const reponseInventee = "Le cours d'Apple est actuellement de 312,45€.";
  const assaini = assainirTexte(reponseInventee);
  check('RÉGRESSION (le verrou reste un vrai garde-fou) : un prix halluciné, jamais fourni par l\'utilisateur ni le contexte, est toujours redacté',
    assaini.includes('[donnée non vérifiée]') && compteur.retires >= 1);
}

/* ---------- un nombre réellement fourni par le contexte structuré (mandat/portefeuille) reste autorisé comme avant ---------- */
{
  const contexte = { mandateConfirmed:true, portfolio:{ total:782.40 }, montantsDeclaresParUtilisateur: [] };
  const { assainirTexte } = construireAssainisseur(contexte);
  const assaini = assainirTexte("Ton portefeuille vaut actuellement 782,40€.");
  check('non-régression : un montant réellement présent dans le contexte structuré (portfolio.total) reste autorisé comme avant ce correctif',
    !assaini.includes('[donnée non vérifiée]'));
}

/* ---------- RÉGRESSION (audit 2026-10-14) : un intervalle de poids réels n'est plus coupé par un tiret pris pour un signe moins ---------- */
{
  const contexte = { mandateConfirmed:true, portfolio:{ positions:[{ weightPct:10 }, { weightPct:15 }] }, montantsDeclaresParUtilisateur:[] };
  const { assainirTexte } = construireAssainisseur(contexte);
  const reponseModele = "Tes positions tech sont toutes simulées autour de 10-15 % du portefeuille.";
  const assaini = assainirTexte(reponseModele);
  check('RÉGRESSION CENTRALE : "10-15 %" (intervalle de poids réels) n\'est plus redacté — le tiret n\'est plus lu comme un signe moins quand il suit directement un chiffre',
    !assaini.includes('[donnée non vérifiée]'));
  check('le texte reste identique à l\'intervalle près (rien d\'autre modifié)', assaini === reponseModele);
}
check('RÉGRESSION : une VRAIE perte négative (précédée d\'un espace, pas d\'un chiffre) reste correctement reconnue comme négative, pas cassée par ce correctif', (() => {
  const contexte = { recentDecisions:[{ gainPct:-5.2 }], montantsDeclaresParUtilisateur:[] };
  const { assainirTexte } = construireAssainisseur(contexte);
  const assaini = assainirTexte("La position a perdu -5,2 % cette semaine.");
  return !assaini.includes('[donnée non vérifiée]');
})());

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
