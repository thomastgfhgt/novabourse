// Vérifie la couche IA de NovaBot (refonte fonctionnelle, 2026-10-08,
// tranche C) sans réseau ni modèle réel : reproduit fidèlement
// 1) la validation de schéma de novabotDecisionAnalyse() (api/analyze.js) ;
// 2) sanitiserDonnees() (filtre récursif avant envoi au modèle) ;
// 3) l'orchestration déterministe <-> IA d'evaluerNovaBot() (js/core.js) —
//    la borne NOVABOT_LLM_MAX, le routage buy/watch/reject selon l'avis IA,
//    et le repli sur le comportement déterministe de la tranche B si l'IA
//    est indisponible. Même convention que les fichiers test-novabot-*.js
//    précédents (fonctions pures recopiées, check()+PASS/FAIL).

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

/* ---------- 1) validation de schéma (copie de validerEtNormaliser) ---------- */
const NOVABOT_ACTIONS = new Set(['buy', 'watch', 'reject']);
function validerDecisionIA(rep) {
  if (
    !rep || typeof rep !== 'object' || Array.isArray(rep)
    || !NOVABOT_ACTIONS.has(rep.action)
    || !Number.isFinite(Number(rep.confidence))
    || typeof rep.reasoning !== 'string'
    || !Array.isArray(rep.keyFactors)
  ) {
    throw new Error('schema_novabot_invalide');
  }
  return {
    action: rep.action,
    confidence: Math.max(0, Math.min(100, Math.round(Number(rep.confidence)))),
    reasoning: rep.reasoning.slice(0, 500),
    keyFactors: rep.keyFactors.filter(f => typeof f === 'string').slice(0, 3).map(f => f.slice(0, 120)),
  };
}

check('décision valide (action="buy") acceptée',
  validerDecisionIA({ action: 'buy', confidence: 72, reasoning: 'x', keyFactors: ['a'] }).action === 'buy');
check('action inconnue ("sell", réservée aux sorties déterministes) REJETÉE', (() => {
  try { validerDecisionIA({ action: 'sell', confidence: 50, reasoning: 'x', keyFactors: [] }); return false; }
  catch { return true; }
})());
check('confidence hors bornes (150) clampée à 100',
  validerDecisionIA({ action: 'watch', confidence: 150, reasoning: 'x', keyFactors: [] }).confidence === 100);
check('confidence négative clampée à 0',
  validerDecisionIA({ action: 'reject', confidence: -10, reasoning: 'x', keyFactors: [] }).confidence === 0);
check('keyFactors borné à 3 éléments maximum',
  validerDecisionIA({ action: 'buy', confidence: 50, reasoning: 'x', keyFactors: ['a', 'b', 'c', 'd', 'e'] }).keyFactors.length === 3);
check('reasoning manquant (objet sans ce champ) REJETÉ', (() => {
  try { validerDecisionIA({ action: 'buy', confidence: 50, keyFactors: [] }); return false; }
  catch { return true; }
})());

/* ---------- 2) sanitisation des données envoyées au modèle ---------- */
function sanitiserDonnees(obj, profondeur = 0) {
  if (profondeur > 2 || !obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && v.length < 200) out[k] = v.slice(0, 200);
    else if (typeof v === 'boolean') out[k] = v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = sanitiserDonnees(v, profondeur + 1);
      if (nested && Object.keys(nested).length) out[k] = nested;
    }
  }
  return out;
}
check('fondamentaux : nombres/chaînes/booléens conservés',
  JSON.stringify(sanitiserDonnees({ peRatio: 18.4, sector: 'Tech', profitable: true }))
  === JSON.stringify({ peRatio: 18.4, sector: 'Tech', profitable: true }));
check('un tableau en valeur est IGNORÉ (jamais transmis tel quel au modèle)',
  sanitiserDonnees({ history: [1, 2, 3], score: 80 }).history === undefined);
check('une fonction/valeur non-primitive en valeur est ignorée',
  sanitiserDonnees({ cb: () => {}, score: 80 }).cb === undefined);
check('null en entrée -> null (jamais une exception)', sanitiserDonnees(null) === null);

/* ---------- 3) orchestration déterministe <-> IA (copie d'evaluerNovaBot()) ---------- */
const NOVABOT_LLM_MAX = 3;
function simulerPassage(candidats, { aiReasoning, avisParTicker }) {
  // Reproduit la boucle d'entrée : pour chaque candidat au-dessus du seuil,
  // au plus NOVABOT_LLM_MAX appels IA par passage ; au-delà, ou si
  // aiReasoning est faux, ou si l'avis IA est indisponible (null) -> achat
  // déterministe (comportement de la tranche B, jamais bloqué).
  let appelsIA = 0;
  const resultats = [];
  for (const c of candidats) {
    let avisIA = null;
    if (aiReasoning && appelsIA < NOVABOT_LLM_MAX) {
      appelsIA++;
      avisIA = avisParTicker[c] ?? null; // null simule un échec d'appel (quota/réseau)
    }
    const actionDecidee = avisIA ? avisIA.action : 'buy';
    resultats.push({ ticker: c, action: actionDecidee, viaIA: Boolean(avisIA) });
  }
  return resultats;
}

{
  const r = simulerPassage(['A', 'B'], { aiReasoning: false, avisParTicker: { A: { action: 'reject' } } });
  check('aiReasoning désactivé -> comportement déterministe pur (achat), même si un avis IA existerait',
    r.every(x => x.action === 'buy' && x.viaIA === false));
}
{
  const r = simulerPassage(['A', 'B', 'C'], { aiReasoning: true,
    avisParTicker: { A: { action: 'buy' }, B: { action: 'watch' }, C: { action: 'reject' } } });
  check('aiReasoning activé -> chaque candidat suit l\'action recommandée par l\'IA',
    r[0].action === 'buy' && r[1].action === 'watch' && r[2].action === 'reject');
}
{
  // 5 candidats, borne à 3 : les 2 derniers retombent en déterministe (achat).
  const avis = { A: { action: 'reject' }, B: { action: 'reject' }, C: { action: 'reject' } };
  const r = simulerPassage(['A', 'B', 'C', 'D', 'E'], { aiReasoning: true, avisParTicker: avis });
  check('NOVABOT_LLM_MAX respecté : au-delà de 3 candidats, repli déterministe (jamais de 4e appel IA)',
    r[0].viaIA && r[1].viaIA && r[2].viaIA && !r[3].viaIA && !r[4].viaIA
    && r[3].action === 'buy' && r[4].action === 'buy');
}
{
  // L'IA indisponible (null, quota épuisé/réseau) pour UN candidat précis
  // -> repli déterministe pour CE candidat seulement, jamais une exception
  // qui interromprait tout le passage.
  const r = simulerPassage(['A', 'B'], { aiReasoning: true, avisParTicker: { A: { action: 'reject' }, B: null } });
  check('avis IA indisponible pour un candidat -> repli déterministe (achat) pour ce candidat, sans bloquer les autres',
    r[0].action === 'reject' && r[1].action === 'buy');
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
