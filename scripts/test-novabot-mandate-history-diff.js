// Vérifie diffMandats() (api/me.js) — le diff affiché dans mandateHistory
// se recalcule à la lecture entre deux lignes adjacentes de
// novabot_mandates (append-only), jamais stocké en double. Copie fidèle.

const NOVABOT_MANDATE_KEYS = ['objective', 'horizon_years', 'risk_level', 'max_drawdown_pct', 'cash_min_pct',
  'max_position_pct', 'max_positions_count', 'preferences', 'hard_rules', 'allowed_regions', 'currencies',
  'benchmark', 'notes', 'trading_rules'];

function diffMandats(a, b){
  const out = {};
  for (const k of NOVABOT_MANDATE_KEYS){
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = { from: b[k], to: a[k] };
  }
  return out;
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

const base = {
  objective:'growth', horizon_years:10, risk_level:'moderate', max_drawdown_pct:null,
  cash_min_pct:20, max_position_pct:10, max_positions_count:null, preferences:[], hard_rules:[],
  allowed_regions:null, currencies:null, benchmark:null, notes:null, trading_rules:null,
};

/* ---------- deux lignes différant sur exactement 2 clés -> diff rapporte exactement ces 2 ---------- */
{
  const plusRecent = { ...base, risk_level:'high', cash_min_pct:30 };
  const d = diffMandats(plusRecent, base);
  check('exactement 2 clés changées détectées', Object.keys(d).length === 2);
  check('risk_level : from moderate, to high', d.risk_level.from === 'moderate' && d.risk_level.to === 'high');
  check('cash_min_pct : from 20, to 30', d.cash_min_pct.from === 20 && d.cash_min_pct.to === 30);
  check('les clés inchangées (objective, horizon_years...) sont absentes du diff', !('objective' in d) && !('horizon_years' in d));
}

/* ---------- lignes identiques -> diff vide ---------- */
check('deux lignes strictement identiques produisent un diff vide', Object.keys(diffMandats(base, { ...base })).length === 0);

/* ---------- changement sur un tableau (hardRules) détecté par valeur, pas par référence ---------- */
{
  const plusRecent = { ...base, hard_rules: [{ type:'excluded_sector', value:'Énergie' }] };
  const d = diffMandats(plusRecent, base);
  check('un changement de tableau (hard_rules vide -> 1 règle) est détecté', 'hard_rules' in d);
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
