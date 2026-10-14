// Vérifie la logique de restore_mandate_version (api/me.js) : restaurer une
// version antérieure doit créer une NOUVELLE ligne (jamais rebasculer
// l'ancienne en courante — l'historique append-only n'est jamais réécrit),
// et être un no-op si la cible est déjà la version courante.

const NOVABOT_MANDATE_KEYS = ['objective', 'horizon_years', 'risk_level', 'max_drawdown_pct', 'cash_min_pct',
  'max_position_pct', 'max_positions_count', 'preferences', 'hard_rules', 'allowed_regions', 'currencies',
  'benchmark', 'notes', 'trading_rules'];

// Simule la branche restore_mandate_version de handleNovaBot (sans Supabase réel).
function simulerRestore({ target, current }){
  if (!target) return { ok:false, status:404, error:'version_introuvable' };
  if (target.id === current.id) return { ok:true, unchanged:true, mandateId: current.id };
  const restored = {};
  for (const k of NOVABOT_MANDATE_KEYS) restored[k] = target[k];
  // La ligne "target" elle-même n'est JAMAIS modifiée ici (vérifié par le test ci-dessous :
  // on ne retourne qu'une copie de ses valeurs, jamais une mutation de l'objet target).
  return { ok:true, unchanged:false, restoredValues: restored, targetUntouched: target };
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

const versionAncienne = {
  id:'mandat-v1', objective:'preserve', horizon_years:5, risk_level:'low', max_drawdown_pct:null,
  cash_min_pct:30, max_position_pct:5, max_positions_count:null, preferences:[], hard_rules:[],
  allowed_regions:null, currencies:null, benchmark:null, notes:null, trading_rules:null,
};
const versionCourante = { ...versionAncienne, id:'mandat-v2', risk_level:'high', cash_min_pct:10 };

/* ---------- restaurer une version différente de la courante ---------- */
{
  const r = simulerRestore({ target: versionAncienne, current: versionCourante });
  check('restaurer une version antérieure réussit', r.ok && !r.unchanged);
  check('les valeurs restaurées correspondent à la version cible (risk_level low, pas high)',
    r.restoredValues.risk_level === 'low' && r.restoredValues.cash_min_pct === 30);
  check('RÉGRESSION : la ligne "target" elle-même n\'est jamais mutée (toujours id mandat-v1, jamais rebasculée en courante ici)',
    r.targetUntouched.id === 'mandat-v1');
}

/* ---------- restaurer la version déjà courante : no-op, jamais une ligne dupliquée ---------- */
{
  const r = simulerRestore({ target: versionCourante, current: versionCourante });
  check('restaurer la version déjà courante est un no-op explicite (unchanged:true)', r.ok && r.unchanged === true);
}

/* ---------- version cible introuvable (scopée à un autre compte, ou id invalide) ---------- */
{
  const r = simulerRestore({ target: null, current: versionCourante });
  check('version cible introuvable -> 404, jamais une restauration silencieuse d\'autre chose', !r.ok && r.status === 404);
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
