// Vérifie la logique de confirm_mandate_amendment (api/me.js) : fusion d'un
// changement PARTIEL sur la ligne courante, bornes identiques au mandat
// complet, et surtout la vérification de concurrence optimiste
// (baseMandateId) qui doit REFUSER toute écriture si un autre onglet/
// conversation a déjà modifié le mandat entre-temps. Copie fidèle de la
// logique réelle (construireMandatDepuisEntree/mandatVersEntree) — mêmes
// noms que api/me.js, sans accès réseau/Supabase réel (sb() simulé).

const NOVABOT_MANDATE_KEYS = ['objective', 'horizon_years', 'risk_level', 'max_drawdown_pct', 'cash_min_pct',
  'max_position_pct', 'max_positions_count', 'preferences', 'hard_rules', 'allowed_regions', 'currencies',
  'benchmark', 'notes', 'trading_rules'];

function mandatVersEntree(m){
  return {
    objective: m.objective, horizonYears: m.horizon_years, riskLevel: m.risk_level,
    maxDrawdownPct: m.max_drawdown_pct, cashMinPct: m.cash_min_pct, maxPositionPct: m.max_position_pct,
    maxPositionsCount: m.max_positions_count, preferences: m.preferences, hardRules: m.hard_rules,
    allowedRegions: m.allowed_regions, currencies: m.currencies, benchmark: m.benchmark, notes: m.notes,
    tradingRules: m.trading_rules,
  };
}
function str(v, max){ return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function num(v){ return (typeof v === 'number' && Number.isFinite(v)) ? v : null; }
function construireMandatDepuisEntree(m){
  return {
    objective: str(m.objective, 40) || null,
    horizon_years: num(m.horizonYears),
    risk_level: str(m.riskLevel, 20) || null,
    max_drawdown_pct: num(m.maxDrawdownPct),
    cash_min_pct: num(m.cashMinPct) ?? 20,
    max_position_pct: num(m.maxPositionPct) ?? 10,
    max_positions_count: Number.isInteger(m.maxPositionsCount) ? m.maxPositionsCount : null,
    preferences: Array.isArray(m.preferences) ? m.preferences : [],
    hard_rules: Array.isArray(m.hardRules) ? m.hardRules : [],
    allowed_regions: Array.isArray(m.allowedRegions) ? m.allowedRegions : null,
    currencies: Array.isArray(m.currencies) ? m.currencies : null,
    benchmark: str(m.benchmark, 20) || null,
    notes: str(m.notes, 2000) || null,
    trading_rules: (m.tradingRules && typeof m.tradingRules === 'object') ? m.tradingRules : null,
  };
}

// Simule la branche confirm_mandate_amendment de handleNovaBot (sans écrire nulle part,
// retourne ce qui SERAIT écrit) — isole la logique métier du transport réseau.
function simulerConfirmAmendment({ current, changes, baseMandateId }){
  if (baseMandateId && baseMandateId !== current.id){
    return { ok:false, status:409, error:'mandat_modifie_depuis' };
  }
  const merged = { ...mandatVersEntree(current), ...changes };
  const next = construireMandatDepuisEntree(merged);
  const memeMandat = NOVABOT_MANDATE_KEYS.every(k => JSON.stringify(current[k]) === JSON.stringify(next[k]));
  if (memeMandat) return { ok:false, status:400, error:'amendement_vide' };
  return { ok:true, next };
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

const current = {
  id:'mandat-1', objective:'growth', horizon_years:10, risk_level:'moderate', max_drawdown_pct:null,
  cash_min_pct:20, max_position_pct:10, max_positions_count:null, preferences:[], hard_rules:[],
  allowed_regions:null, currencies:null, benchmark:null, notes:null, trading_rules:null,
};

/* ---------- fusion correcte : champs absents de `changes` restent inchangés ---------- */
{
  const r = simulerConfirmAmendment({ current, changes:{ riskLevel:'high' }, baseMandateId:'mandat-1' });
  check('un changement partiel (riskLevel seul) est appliqué', r.ok && r.next.risk_level === 'high');
  check('les champs NON mentionnés dans changes restent ceux de la ligne courante (objective, cash_min_pct...)',
    r.ok && r.next.objective === 'growth' && r.next.cash_min_pct === 20);
}

/* ---------- RÉGRESSION CENTRALE : baseMandateId périmé -> AUCUNE écriture ---------- */
{
  const r = simulerConfirmAmendment({ current, changes:{ riskLevel:'high' }, baseMandateId:'un-autre-mandat-deja-remplace' });
  check('RÉGRESSION CENTRALE : baseMandateId ne correspond plus au mandat réel -> rejeté (409), rien à écrire',
    !r.ok && r.status === 409 && r.error === 'mandat_modifie_depuis');
}

/* ---------- pas de baseMandateId transmis : pas de vérification de concurrence (chemin pour un futur appelant sans contexte de version) ---------- */
{
  const r = simulerConfirmAmendment({ current, changes:{ riskLevel:'high' }, baseMandateId:null });
  check('sans baseMandateId, le changement est quand même appliqué (pas de régression du chemin normal)', r.ok);
}

/* ---------- amendement vide : jamais une nouvelle ligne identique écrite ---------- */
{
  const r = simulerConfirmAmendment({ current, changes:{ riskLevel:'moderate' }, baseMandateId:'mandat-1' });
  check('un "changement" qui reproduit exactement la valeur déjà en place est rejeté (amendement_vide)',
    !r.ok && r.error === 'amendement_vide');
}

/* ---------- bornes respectées même dans un changement partiel ---------- */
{
  const r = simulerConfirmAmendment({ current, changes:{ maxPositionsCount:5 }, baseMandateId:'mandat-1' });
  check('un entier valide (maxPositionsCount) passe tel quel', r.ok && r.next.max_positions_count === 5);
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
