// Reproduit fidelement ORDRE_TACHES/dispoPourTache() (api/analyze.js) pour
// verifier le routage par tache (§3 du prompt maitre NovaTitre : "je ne veux
// PAS appeler systematiquement le modele le plus puissant et le plus cher").
// Meme convention que test-nova-ai-bascule.js (deja la suite jumelle, qui
// couvre appelModeleAvecBascule() generiquement, pas ORDRE_TACHES lui-meme).

const PROVIDERS = {
  xai:       { env: 'XAI_API_KEY' },
  openai:    { env: 'OPENAI_API_KEY' },
  anthropic: { env: 'ANTHROPIC_API_KEY' },
};
const ORDRE_TACHES = {
  analyse: ['xai', 'openai', 'anthropic'],
  screener: ['openai', 'xai', 'anthropic'],
  novareview: ['xai', 'openai', 'anthropic'],
};
function actif(env) {
  return Object.entries(PROVIDERS).filter(([, p]) => env[p.env]);
}
// Reproduit dispoPourTache() (api/analyze.js) côté ordre des ids uniquement
// (le vrai code renvoie [id, PROVIDERS[id]], inutile ici : on ne teste que
// le classement produit par ORDRE_TACHES filtré par ce qui est configuré).
function ordreEffectif(tache, env) {
  const configures = new Set(actif(env).map(([id]) => id));
  return (ORDRE_TACHES[tache] || Object.keys(PROVIDERS)).filter(id => configures.has(id));
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

const toutConfigure = { XAI_API_KEY: 'x', OPENAI_API_KEY: 'x', ANTHROPIC_API_KEY: 'x' };

check('screener : openai passe en premier quand tout est configuré (tâche simple/économique, §3)',
  ordreEffectif('screener', toutConfigure).join(',') === 'openai,xai,anthropic');

check('analyse : xai reste en premier (tâche complexe, ordre de déploiement délibéré inchangé)',
  ordreEffectif('analyse', toutConfigure).join(',') === 'xai,openai,anthropic');

check('novareview : xai reste en premier (tâche "modèle puissant" du §3, inchangé)',
  ordreEffectif('novareview', toutConfigure).join(',') === 'xai,openai,anthropic');

check('screener se distingue bien de analyse/novareview (c\'était le bug trouvé par l\'audit : les 3 tâches utilisaient le même ordre)',
  ordreEffectif('screener', toutConfigure).join(',') !== ordreEffectif('analyse', toutConfigure).join(','));

// Seul xAI configuré (état réel de production au moment de l'audit) : le
// reclassement de screener ne doit avoir AUCUN effet tant qu'openai n'est
// pas réellement configuré — juste xai, seul fournisseur actif.
check('seul xAI configuré : screener retombe sur xai seul (aucune régression en prod actuelle)',
  ordreEffectif('screener', { XAI_API_KEY: 'x' }).join(',') === 'xai');

check('seul xAI configuré : analyse retombe aussi sur xai seul',
  ordreEffectif('analyse', { XAI_API_KEY: 'x' }).join(',') === 'xai');

// xAI + OpenAI configurés (Anthropic absent) : l'ordre relatif des deux
// configurés est respecté, Anthropic simplement absent de la liste.
check('xai+openai configurés (sans anthropic) : screener = openai,xai',
  ordreEffectif('screener', { XAI_API_KEY: 'x', OPENAI_API_KEY: 'x' }).join(',') === 'openai,xai');

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
