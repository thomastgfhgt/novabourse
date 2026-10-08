// Vérifie la couche conversation de NovaBot (refonte expérience,
// 2026-10-08) sans réseau ni modèle réel : reproduit fidèlement
// 1) validerMandateDraft() (api/analyze.js) ;
// 2) la validation de schéma de novabotChatAnalyse() ;
// 3) novabotDecisionsPertinentes() (js/novabot-chat.js) ;
// 4) le mapping risque -> cashMinPct/maxPositionPct de novabotConfirmerMandat()
//    (js/core.js). Même convention que les fichiers test-novabot-*.js
//    précédents (fonctions pures recopiées, check()+PASS/FAIL).
// 5) RÉGRESSION (bug réel trouvé en testant cette refonte dans le
//    navigateur, 2026-10-08) : DEFAULT_STATE.novabot.wallet valait encore
//    {cash:10000, invested:10000} — un capital implicite hérité d'avant
//    la conversation. Une fois novabotConfirmerMandat() ajouté (qui crée
//    une VRAIE transaction 'deposit' pour le capital choisi), ce
//    placeholder non nul faisait DOUBLER le capital de départ
//    (10000 implicite + 10000 déposé = 20000 affiché). Vérifié en direct
//    dans le navigateur, corrigé, verrouillé ici pour ne jamais régresser.

const fs = require('fs');
const path = require('path');
const coreSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8');

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

{
  const m = coreSrc.match(/novabot:\{[\s\S]*?wallet:\{\s*cash:(-?\d+),\s*invested:(-?\d+)/);
  check('RÉGRESSION : DEFAULT_STATE.novabot.wallet part bien de 0/0 (jamais un capital implicite non nul)',
    m && Number(m[1]) === 0 && Number(m[2]) === 0);
}
{
  const fn = coreSrc.match(/function rejouerNovaBot\(transactions\)\{[\s\S]*?const wallet = \{ cash: (-?\d+), invested: (-?\d+)/);
  check('RÉGRESSION : rejouerNovaBot() part explicitement de 0/0 (jamais DEFAULT_STATE, même après un futur changement de celui-ci)',
    fn && Number(fn[1]) === 0 && Number(fn[2]) === 0);
}

/* ---------- 1) validerMandateDraft() (copie d'api/analyze.js) ---------- */
const NOVABOT_OBJECTIVES = new Set(['growth', 'income', 'preserve']);
const NOVABOT_RISK_LEVELS = new Set(['low', 'moderate', 'high']);
const NOVABOT_AUTONOMY = new Set(['advice', 'semi_auto', 'auto']);
function texteBorne(v, max) { return typeof v === 'string' ? v.slice(0, max) : null; }
function validerMandateDraft(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const out = {};
  if (Number.isFinite(d.initialCapital) && d.initialCapital >= 0) out.initialCapital = d.initialCapital;
  if (NOVABOT_OBJECTIVES.has(d.objective)) out.objective = d.objective;
  if (NOVABOT_RISK_LEVELS.has(d.riskLevel)) out.riskLevel = d.riskLevel;
  if (Number.isFinite(d.horizonYears) && d.horizonYears > 0) out.horizonYears = d.horizonYears;
  if (Array.isArray(d.hardRules)) {
    const regles = d.hardRules
      .filter(r => r && (r.type === 'excluded_sector' || r.type === 'excluded_asset') && typeof r.value === 'string')
      .slice(0, 20).map(r => ({ type: r.type, value: texteBorne(r.value, 60) }));
    if (regles.length) out.hardRules = regles;
  }
  if (NOVABOT_AUTONOMY.has(d.autonomyMode)) out.autonomyMode = d.autonomyMode;
  return Object.keys(out).length ? out : null;
}

check('capital + objectif + risque + horizon en un seul message (exemple du brief) tous extraits',
  (() => {
    const d = validerMandateDraft({ initialCapital: 10000, objective: 'growth', riskLevel: 'moderate', horizonYears: 5 });
    return d.initialCapital === 10000 && d.objective === 'growth' && d.riskLevel === 'moderate' && d.horizonYears === 5;
  })());
check('objectif hors énumération ("rich quick") REJETÉ, jamais transmis tel quel',
  validerMandateDraft({ objective: 'rich quick' }) === null);
check('capital négatif REJETÉ', validerMandateDraft({ initialCapital: -500 }) === null);
check('hardRules : type inconnu filtré, type valide conservé', (() => {
  const d = validerMandateDraft({ hardRules: [{ type: 'excluded_sector', value: 'Énergie' }, { type: 'inconnu', value: 'x' }] });
  return d.hardRules.length === 1 && d.hardRules[0].type === 'excluded_sector';
})());
check('objet totalement vide ou sans champ reconnu -> null (jamais un objet {} inutile)',
  validerMandateDraft({ randomField: 'x' }) === null && validerMandateDraft({}) === null);
check('tableau en entrée -> null (jamais traité comme un objet)', validerMandateDraft([1, 2]) === null);

/* ---------- 2) schéma de la réponse de conversation ---------- */
function validerReponseChat(rep) {
  if (!rep || typeof rep !== 'object' || Array.isArray(rep) || typeof rep.reply !== 'string' || typeof rep.readyToConfirm !== 'boolean') {
    throw new Error('schema_novabot_chat_invalide');
  }
  return { reply: rep.reply.slice(0, 800), readyToConfirm: rep.readyToConfirm === true };
}
check('réponse valide acceptée', validerReponseChat({ reply: 'Bonjour', readyToConfirm: false }).reply === 'Bonjour');
check('readyToConfirm non-booléen REJETÉ', (() => {
  try { validerReponseChat({ reply: 'x', readyToConfirm: 'oui' }); return false; } catch { return true; }
})());
check('reply manquant REJETÉ', (() => {
  try { validerReponseChat({ readyToConfirm: false }); return false; } catch { return true; }
})());

/* ---------- 3) novabotDecisionsPertinentes() (copie de js/novabot-chat.js) ---------- */
function decisionsPertinentes(decisions, texte) {
  if (!texte) return [];
  const t = texte.toLowerCase();
  const vus = new Set();
  const trouvees = [];
  for (const d of [...decisions].reverse()) {
    if (!d.ticker && !d.name) continue;
    const correspond = (d.ticker && t.includes(d.ticker.toLowerCase())) || (d.name && d.name.length > 2 && t.includes(d.name.toLowerCase()));
    if (!correspond || vus.has(d.id)) continue;
    vus.add(d.id);
    trouvees.push(d);
    if (trouvees.length >= 10) break;
  }
  return trouvees;
}
{
  const decisions = [
    { id: '1', ticker: 'MC', name: 'LVMH', action: 'buy', date: '2026-10-01' },
    { id: '2', ticker: 'AAPL', name: 'Apple Inc.', action: 'sell', date: '2026-10-05' },
  ];
  check('"pourquoi as-tu acheté LVMH" retrouve la décision par le NOM (pas seulement le ticker)',
    decisionsPertinentes(decisions, 'Pourquoi as-tu acheté LVMH le mois dernier ?').map(d => d.id).includes('1'));
  check('un message sans mention d\'aucune société ne retrouve rien (pas de faux positif)',
    decisionsPertinentes(decisions, 'Quel est ton plan pour cette semaine ?').length === 0);
  check('plusieurs décisions pour le même titre : toutes remontées (jamais une seule au hasard)',
    decisionsPertinentes([...decisions, { id: '3', ticker: 'MC', name: 'LVMH', action: 'sell', date: '2026-10-10' }], 'LVMH').length === 2);
}

/* ---------- 4) mapping risque -> cashMinPct/maxPositionPct (copie de novabotConfirmerMandat()) ---------- */
function parametresRisque(riskLevel) {
  const niveau = ['low', 'moderate', 'high'].includes(riskLevel) ? riskLevel : 'moderate';
  if (niveau === 'low') return { cashMinPct: 30, maxPositionPct: 6 };
  if (niveau === 'high') return { cashMinPct: 10, maxPositionPct: 15 };
  return { cashMinPct: 20, maxPositionPct: 10 };
}
check('risque "low" -> plus de cash conservé, positions plus petites qu\'en "moderate"',
  parametresRisque('low').cashMinPct > parametresRisque('moderate').cashMinPct
  && parametresRisque('low').maxPositionPct < parametresRisque('moderate').maxPositionPct);
check('risque "high" -> moins de cash conservé, positions plus grandes qu\'en "moderate"',
  parametresRisque('high').cashMinPct < parametresRisque('moderate').cashMinPct
  && parametresRisque('high').maxPositionPct > parametresRisque('moderate').maxPositionPct);
check('risque non précisé (undefined) -> repli sûr sur "moderate", jamais une erreur',
  JSON.stringify(parametresRisque(undefined)) === JSON.stringify(parametresRisque('moderate')));

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
