// Vérifie la fondation persistée NovaBot (refonte fonctionnelle, 2026-10-07,
// tranche A) sans navigateur ni Supabase réel : reproduit fidèlement
// 1) rejouerNovaBot() (js/core.js) — même principe que test-novabot-mandat.js
//    pour rejouerTransactions() ;
// 2) la logique de validation/diff de mandat d'api/me.js (?resource=novabot) ;
// 3) la fusion par id (dédoublonnage) utilisée par syncNovaBot().
// L'écriture réelle en base (RLS, idempotence SQL via on_conflict) n'est PAS
// vérifiable ici : elle dépend d'une instance Supabase vivante, hors de
// portée d'un test unitaire. Voir le rapport final pour cette limite.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

/* ---------- 1) rejeu du journal (copie de rejouerNovaBot()) ---------- */
function rejouerNovaBot(transactions, defaults) {
  const wallet = { cash: defaults.cash, invested: defaults.invested, positions: [], realizedPnL: 0 };
  const triees = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const tx of triees) {
    if (tx.type === 'buy') {
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos) {
        const totalQty = pos.qty + tx.qty;
        pos.avg = ((pos.avg * pos.qty) + (tx.priceLocal * tx.qty)) / totalQty;
        pos.qty = totalQty;
      } else {
        wallet.positions.push({ id: tx.stockId, qty: tx.qty, avg: tx.priceLocal });
      }
      wallet.cash -= tx.amountEUR;
    } else if (tx.type === 'sell') {
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos) {
        pos.qty -= tx.qty;
        if (pos.qty <= 0.0001) wallet.positions = wallet.positions.filter(p => p.id !== tx.stockId);
      }
      wallet.cash += tx.amountEUR;
      if (Number.isFinite(tx.realizedGain)) wallet.realizedPnL += tx.realizedGain;
    } else if (tx.type === 'deposit') {
      wallet.cash += tx.amountEUR; wallet.invested += tx.amountEUR;
    } else if (tx.type === 'withdraw') {
      wallet.cash -= tx.amountEUR; wallet.invested -= tx.amountEUR;
    } else if (tx.type === 'fee') {
      wallet.cash -= tx.amountEUR;
    }
  }
  return wallet;
}

{
  const w = rejouerNovaBot([
    { date: '2026-10-07T08:00:00Z', type: 'deposit', amountEUR: 10000 },
    { date: '2026-10-07T09:00:00Z', type: 'buy', stockId: 'AAPL-NAS', qty: 10, priceLocal: 180, amountEUR: 1800 },
    { date: '2026-10-07T10:00:00Z', type: 'buy', stockId: 'AAPL-NAS', qty: 5, priceLocal: 190, amountEUR: 950 },
  ], { cash: 0, invested: 0 });
  check('dépôt initial crédite cash ET invested à parts égales (§26 : jamais compté comme performance)',
    w.cash === 10000 - 1800 - 950 && w.invested === 10000);
  check('2 achats du même titre fusionnent en une position au PRU pondéré',
    w.positions.length === 1 && w.positions[0].qty === 15
    && Math.abs(w.positions[0].avg - ((180 * 10 + 190 * 5) / 15)) < 1e-9);
}
{
  const w = rejouerNovaBot([
    { date: '2026-10-07T08:00:00Z', type: 'deposit', amountEUR: 10000 },
    { date: '2026-10-07T09:00:00Z', type: 'buy', stockId: 'MC-PAR', qty: 2, priceLocal: 600, amountEUR: 1200 },
    { date: '2026-10-08T09:00:00Z', type: 'sell', stockId: 'MC-PAR', qty: 2, priceLocal: 650, amountEUR: 1300, realizedGain: 100 },
  ], { cash: 0, invested: 0 });
  check('vente totale retire la position et crédite le gain réalisé',
    w.positions.length === 0 && w.cash === 10000 - 1200 + 1300 && w.realizedPnL === 100);
}
{
  const w = rejouerNovaBot([
    { date: '2026-10-07T08:00:00Z', type: 'deposit', amountEUR: 10000 },
    { date: '2026-10-07T09:00:00Z', type: 'fee', amountEUR: 2 },
  ], { cash: 0, invested: 0 });
  check('un frais sort du cash sans toucher invested (§36, jamais un retrait voulu)',
    w.cash === 10000 - 2 && w.invested === 10000);
}
check('le rejeu est indépendant de l\'ordre d\'entrée (trié par date, pas par insertion)',
  JSON.stringify(rejouerNovaBot([
    { date: '2026-10-08T09:00:00Z', type: 'buy', stockId: 'X', qty: 1, priceLocal: 10, amountEUR: 10 },
    { date: '2026-10-07T08:00:00Z', type: 'deposit', amountEUR: 100 },
  ], { cash: 0, invested: 0 }))
  === JSON.stringify(rejouerNovaBot([
    { date: '2026-10-07T08:00:00Z', type: 'deposit', amountEUR: 100 },
    { date: '2026-10-08T09:00:00Z', type: 'buy', stockId: 'X', qty: 1, priceLocal: 10, amountEUR: 10 },
  ], { cash: 0, invested: 0 })));

/* ---------- 2) validation/diff de mandat (copie d'api/me.js) ---------- */
const NOVABOT_MANDATE_KEYS = ['objective', 'horizon_years', 'risk_level', 'max_drawdown_pct', 'cash_min_pct',
  'max_position_pct', 'max_positions_count', 'preferences', 'hard_rules', 'allowed_regions', 'currencies',
  'benchmark', 'notes'];
function normaliserMandat(m) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
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
  };
}
function memeMandat(current, next) {
  return current && NOVABOT_MANDATE_KEYS.every(k => JSON.stringify(current[k]) === JSON.stringify(next[k]));
}

{
  const v1 = normaliserMandat({ cashMinPct: 20, maxPositionPct: 10 });
  const v2 = normaliserMandat({ cashMinPct: 20, maxPositionPct: 10 });
  check('un mandat identique renvoyé 2 fois -> pas de nouvelle version (évite de spammer l\'historique)',
    memeMandat(v1, v2) === true);
}
{
  const v1 = normaliserMandat({ cashMinPct: 20, maxPositionPct: 10 });
  const v2 = normaliserMandat({ cashMinPct: 15, maxPositionPct: 10 });
  check('cashMinPct modifié -> détecté comme un mandat différent', memeMandat(v1, v2) === false);
}
{
  const v = normaliserMandat({ hardRules: [{ type: 'excluded_sector', value: 'tabac' }], preferences: [] });
  check('hard_rules et preferences restent deux listes distinctes (§3 : jamais mélangées)',
    Array.isArray(v.hard_rules) && v.hard_rules.length === 1 && Array.isArray(v.preferences) && v.preferences.length === 0);
}
check('mandat vide -> cash_min_pct/max_position_pct gardent un défaut sûr (jamais null -> 0% imposé par accident)',
  normaliserMandat({}).cash_min_pct === 20 && normaliserMandat({}).max_position_pct === 10);

const NOVABOT_CLIENT_STATUSES = ['setup', 'active', 'paused'];
check('statut "active" accepté côté client', NOVABOT_CLIENT_STATUSES.includes('active'));
check('statut "analyzing" REFUSÉ côté client (réservé au pipeline serveur, §25)',
  !NOVABOT_CLIENT_STATUSES.includes('analyzing'));

/* ---------- 3) fusion par id (copie de syncNovaBot()) ---------- */
{
  const local = [{ id: 'nb1', date: '2026-10-07T08:00:00Z', amountEUR: 10 }];
  const serveur = [
    { id: 'nb1', date: '2026-10-07T08:00:00Z', amountEUR: 10 },
    { id: 'nb2', date: '2026-10-07T09:00:00Z', amountEUR: 20 },
  ];
  const txById = new Map();
  for (const tx of local) txById.set(tx.id, tx);
  for (const tx of serveur) txById.set(tx.id, tx);
  const fusion = [...txById.values()];
  check('fusion local+serveur dédoublonne par id (même transaction jamais comptée deux fois)',
    fusion.length === 2);
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
