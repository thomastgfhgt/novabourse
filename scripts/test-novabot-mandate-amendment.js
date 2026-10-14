// Vérifie validerMandateAmendment() et validerHardRules() (api/analyze.js) —
// audit 2026-10-15 "NovaBot : pilotage complet du mandat depuis le chat" :
// une modification du mandat post-confirmation doit accepter UNIQUEMENT des
// champs réellement présents/valides, jamais une modification vide
// silencieusement acceptée plus loin dans la chaîne. Copie fidèle de la
// logique réelle — même convention que les autres fichiers test-novabot-*.js.

const NOVABOT_OBJECTIVES = new Set(['growth', 'income', 'preserve']);
const NOVABOT_RISK_LEVELS = new Set(['low', 'moderate', 'high']);
const NOVABOT_AUTONOMY = new Set(['advice', 'semi_auto', 'auto']);
function texteBorne(v, max){ return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

function validerHardRules(arr, max){
  if (!Array.isArray(arr)) return null;
  const regles = arr
    .filter(r => r && (r.type === 'excluded_sector' || r.type === 'excluded_asset') && typeof r.value === 'string')
    .slice(0, max).map(r => ({ type:r.type, value: texteBorne(r.value, 60) }));
  return regles.length ? regles : null;
}
function validerMandateAmendment(d){
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const out = {};
  if (NOVABOT_OBJECTIVES.has(d.objective)) out.objective = d.objective;
  if (NOVABOT_RISK_LEVELS.has(d.riskLevel)) out.riskLevel = d.riskLevel;
  if (Number.isFinite(d.horizonYears) && d.horizonYears > 0) out.horizonYears = d.horizonYears;
  const regles = validerHardRules(d.hardRules, 20);
  if (regles) out.hardRules = regles;
  if (Number.isFinite(d.cashMinPct) && d.cashMinPct >= 0 && d.cashMinPct <= 100) out.cashMinPct = d.cashMinPct;
  if (Number.isFinite(d.maxPositionPct) && d.maxPositionPct >= 1 && d.maxPositionPct <= 100) out.maxPositionPct = d.maxPositionPct;
  if (Number.isInteger(d.maxPositionsCount) && d.maxPositionsCount > 0) out.maxPositionsCount = d.maxPositionsCount;
  if (Number.isFinite(d.maxDrawdownPct) && d.maxDrawdownPct >= 0 && d.maxDrawdownPct <= 100) out.maxDrawdownPct = d.maxDrawdownPct;
  if (typeof d.benchmark === 'string' && d.benchmark.trim()) out.benchmark = texteBorne(d.benchmark, 20);
  if (typeof d.notes === 'string' && d.notes.trim()) out.notes = texteBorne(d.notes, 2000);
  if (NOVABOT_AUTONOMY.has(d.autonomyMode)) out.autonomyMode = d.autonomyMode;
  return Object.keys(out).length ? out : null;
}

// amendmentId : réutilisé si même contenu déjà en attente, sinon régénéré (api/analyze.js)
function resoudreAmendmentId(pendingAmendment, nouveauChanges, genererId){
  const memeContenu = pendingAmendment && JSON.stringify(pendingAmendment.changes) === JSON.stringify(nouveauChanges);
  return memeContenu && typeof pendingAmendment.id === 'string' ? pendingAmendment.id : genererId();
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- changement valide accepté tel quel ---------- */
{
  const v = validerMandateAmendment({ riskLevel:'high', horizonYears:20 });
  check('un changement valide (riskLevel+horizonYears) est accepté', v.riskLevel === 'high' && v.horizonYears === 20);
  check('aucun champ non mentionné ne se glisse dans le résultat', Object.keys(v).length === 2);
}

/* ---------- RÉGRESSION : un amendement vide ne doit jamais passer ---------- */
check('RÉGRESSION : un objet sans aucun champ reconnu renvoie null (jamais un amendement vide silencieusement accepté)',
  validerMandateAmendment({}) === null);
check('RÉGRESSION : une valeur de riskLevel invalide est purement ignorée, jamais propagée', validerMandateAmendment({ riskLevel:'extreme' }) === null);
check('null/undefined en entrée renvoie null, jamais une exception', validerMandateAmendment(null) === null && validerMandateAmendment(undefined) === null);
check('un tableau en entrée est rejeté (pas un objet de changements)', validerMandateAmendment([1,2]) === null);

/* ---------- hardRules : types inconnus filtrés, jamais propagés ---------- */
{
  const v = validerMandateAmendment({ hardRules: [
    { type:'excluded_sector', value:'Énergie' },
    { type:'excluded_asset', value:'TSLA' },
    { type:'type_invente', value:'X' },
  ] });
  check('seuls excluded_sector/excluded_asset passent, un type inventé est filtré', v.hardRules.length === 2);
}
check('hardRules absent/non-tableau -> le champ est simplement omis (jamais un tableau vide fabriqué)',
  validerMandateAmendment({ riskLevel:'low', hardRules:'pas un tableau' }).hardRules === undefined);

/* ---------- bornes numériques respectées ---------- */
check('cashMinPct hors bornes (150) est rejeté, jamais clampé silencieusement ici', validerMandateAmendment({ cashMinPct:150 }) === null);
check('maxPositionPct valide (25) est accepté', validerMandateAmendment({ maxPositionPct:25 }).maxPositionPct === 25);
check('maxPositionsCount non entier est rejeté', validerMandateAmendment({ maxPositionsCount:3.5 }) === null);

/* ---------- autonomyMode accepté au même titre que les autres champs ---------- */
check('autonomyMode valide est accepté dans un amendement', validerMandateAmendment({ autonomyMode:'auto' }).autonomyMode === 'auto');

/* ---------- identité de la proposition : réutilisée si même contenu, régénérée sinon ---------- */
{
  let compteur = 0;
  const genererId = () => `id-${++compteur}`;
  const changesA = { riskLevel:'high' };
  const idPremierTour = resoudreAmendmentId(null, changesA, genererId);
  check('premier tour sans proposition en attente -> un nouvel id est généré', idPremierTour === 'id-1');

  const idMemeContenu = resoudreAmendmentId({ id:idPremierTour, changes:changesA }, changesA, genererId);
  check('RÉGRESSION CENTRALE : un "oui" sur la MÊME proposition réutilise le même identifiant (jamais régénéré à chaque tour)',
    idMemeContenu === idPremierTour);

  const changesB = { riskLevel:'low' };
  const idNouveauContenu = resoudreAmendmentId({ id:idPremierTour, changes:changesA }, changesB, genererId);
  check('un contenu DIFFÉRENT régénère un nouvel identifiant (jamais confondu avec la proposition précédente)',
    idNouveauContenu !== idPremierTour);
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
