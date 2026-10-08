// Vérifie le Mandate Engine + Risk Engine de NovaBot (refonte fonctionnelle,
// 2026-10-08, tranche B) sans navigateur : reproduit fidèlement
// novabotRiskCheck()/novabotDiscoveryCandidats() (js/core.js). Même
// convention que test-novabot-mandat.js (fonctions pures recopiées,
// check()+PASS/FAIL) — js/core.js est écrit pour l'environnement navigateur
// (scope global partagé entre scripts), pas directement require()-able.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

function portfolioValue(wallet) {
  let value = 0;
  for (const pos of wallet.positions) value += pos.avg * pos.qty; // avg/qty déjà en EUR dans ces fixtures
  return { total: value + wallet.cash, value };
}
const toEUR = (v) => v; // fixtures déjà en EUR : pas de conversion de devise à tester ici

/* ---------- Risk Engine (copie de novabotRiskCheck()) ---------- */
function novabotRiskCheck(intent, wallet, mandate) {
  const violations = [];
  const pf = portfolioValue(wallet);

  const secteurInterdit = mandate.hardRules.find(r => r.type === 'excluded_sector' && r.value === intent.sector);
  if (secteurInterdit) violations.push({ type: 'secteur_interdit', message: `Secteur "${intent.sector}" exclu par le mandat.` });

  const actifInterdit = mandate.hardRules.find(r => r.type === 'excluded_asset'
    && (r.value === intent.stockId || r.value === intent.ticker));
  if (actifInterdit) violations.push({ type: 'actif_interdit', message: `${intent.ticker} exclu explicitement par le mandat.` });

  if (intent.action === 'buy') {
    if (intent.amountEUR > wallet.cash) {
      violations.push({ type: 'cash_insuffisant', message: 'Liquidités simulées insuffisantes pour cet achat.' });
    } else {
      const cashApres = wallet.cash - intent.amountEUR;
      const cashMin = (mandate.cashMinPct / 100) * pf.total;
      if (cashApres < cashMin) violations.push({ type: 'cash_min', message: `Ferait passer le cash sous le minimum du mandat (${mandate.cashMinPct} %).` });
    }
    const posExistante = wallet.positions.find(p => p.id === intent.stockId);
    const valeurExistanteEUR = posExistante ? toEUR(posExistante.avg * posExistante.qty) : 0;
    const poidsApresPct = pf.total > 0 ? ((valeurExistanteEUR + intent.amountEUR) / pf.total) * 100 : 100;
    if (poidsApresPct > mandate.maxPositionPct + 1e-9) {
      violations.push({ type: 'position_max', message: `Dépasserait le maximum par position du mandat (${mandate.maxPositionPct} %).` });
    }
    if (!posExistante && mandate.maxPositionsCount !== null && wallet.positions.length >= mandate.maxPositionsCount) {
      violations.push({ type: 'positions_max_count', message: `Le mandat limite le portefeuille à ${mandate.maxPositionsCount} positions.` });
    }
  }

  return { allowed: violations.length === 0, violations };
}

const mandatBase = { cashMinPct: 20, maxPositionPct: 10, maxPositionsCount: null, hardRules: [], preferences: [] };

{
  // Portefeuille 10 000 € tout cash. Achat de 500 € : cash après = 9500,
  // cash min 20% de 10000 = 2000 -> largement au-dessus, poids après = 5%.
  const wallet = { cash: 10000, positions: [] };
  const intent = { action: 'buy', stockId: 'AAPL-NAS', ticker: 'AAPL', sector: 'Technologie', amountEUR: 500 };
  const v = novabotRiskCheck(intent, wallet, mandatBase);
  check('achat raisonnable autorisé (cash/position largement dans les limites)', v.allowed === true);
}
{
  // Secteur Énergie explicitement exclu (hard rule) — jamais franchissable,
  // même si cash/position seraient par ailleurs tout à fait valides.
  const wallet = { cash: 10000, positions: [] };
  const mandate = { ...mandatBase, hardRules: [{ type: 'excluded_sector', value: 'Énergie' }] };
  const intent = { action: 'buy', stockId: 'TTE-PAR', ticker: 'TTE', sector: 'Énergie', amountEUR: 100 };
  const v = novabotRiskCheck(intent, wallet, mandate);
  check('hard rule "secteur exclu" REFUSE même un petit achat par ailleurs valide',
    v.allowed === false && v.violations.some(x => x.type === 'secteur_interdit'));
}
{
  // Actif explicitement exclu par ticker.
  const wallet = { cash: 10000, positions: [] };
  const mandate = { ...mandatBase, hardRules: [{ type: 'excluded_asset', value: 'XOM' }] };
  const intent = { action: 'buy', stockId: 'XOM-NYS', ticker: 'XOM', sector: 'Énergie', amountEUR: 100 };
  const v = novabotRiskCheck(intent, wallet, mandate);
  check('hard rule "actif exclu" (par ticker) refuse', v.allowed === false && v.violations.some(x => x.type === 'actif_interdit'));
}
{
  // Cash minimum 20% : portefeuille à 10000 total, acheter 8500€ laisserait
  // 1500€ de cash (15%, sous le minimum) -> refusé.
  const wallet = { cash: 10000, positions: [] };
  const intent = { action: 'buy', stockId: 'X', ticker: 'X', sector: 'Technologie', amountEUR: 8500 };
  const v = novabotRiskCheck(intent, wallet, mandatBase);
  check('achat qui ferait passer le cash sous le minimum du mandat REFUSÉ',
    v.allowed === false && v.violations.some(x => x.type === 'cash_min'));
}
{
  // Poids maximum 10% : portefeuille 10000€ total, acheter 1500€ -> 15% > 10%.
  const wallet = { cash: 10000, positions: [] };
  const intent = { action: 'buy', stockId: 'X', ticker: 'X', sector: 'Technologie', amountEUR: 1500 };
  const v = novabotRiskCheck(intent, wallet, mandatBase);
  check('achat qui dépasserait le poids maximum par position REFUSÉ',
    v.allowed === false && v.violations.some(x => x.type === 'position_max'));
}
{
  // Renforcement d'une position déjà détenue : le poids EXISTANT compte
  // dans le calcul du poids après (pas seulement le nouvel achat).
  const wallet = { cash: 9000, positions: [{ id: 'X', qty: 10, avg: 90 }] }; // position existante = 900€, total = 9900
  const intent = { action: 'buy', stockId: 'X', ticker: 'X', sector: 'Technologie', amountEUR: 200 };
  const v = novabotRiskCheck(intent, wallet, mandatBase);
  // poids après = (900+200)/9900 = 11.1% > 10% -> refusé
  check('renforcement d\'une position existante tient compte du poids DÉJÀ détenu',
    v.allowed === false && v.violations.some(x => x.type === 'position_max'));
}
{
  // Nombre maximum de positions : mandat limité à 2 positions, déjà 2
  // détenues -> un 3e achat (nouveau titre) refusé, même minime.
  const wallet = { cash: 10000, positions: [{ id: 'A', qty: 1, avg: 100 }, { id: 'B', qty: 1, avg: 100 }] };
  const mandate = { ...mandatBase, maxPositionsCount: 2 };
  const intent = { action: 'buy', stockId: 'C', ticker: 'C', sector: 'Technologie', amountEUR: 50 };
  const v = novabotRiskCheck(intent, wallet, mandate);
  check('nombre maximum de positions du mandat respecté (nouveau titre refusé au-delà)',
    v.allowed === false && v.violations.some(x => x.type === 'positions_max_count'));
}
{
  // Le même nombre maximum NE bloque PAS un renforcement d'une position déjà détenue.
  const wallet = { cash: 10000, positions: [{ id: 'A', qty: 1, avg: 100 }, { id: 'B', qty: 1, avg: 100 }] };
  const mandate = { ...mandatBase, maxPositionsCount: 2 };
  const intent = { action: 'buy', stockId: 'A', ticker: 'A', sector: 'Technologie', amountEUR: 50 };
  const v = novabotRiskCheck(intent, wallet, mandate);
  check('renforcer une position EXISTANTE reste autorisé même au plafond du nombre de positions',
    v.violations.every(x => x.type !== 'positions_max_count'));
}
{
  // Une préférence (jamais une hard rule) n'a AUCUN pouvoir de blocage ici.
  const wallet = { cash: 10000, positions: [] };
  const mandate = { ...mandatBase, preferences: [{ type: 'preferred_sector', value: 'Technologie' }] };
  const intent = { action: 'buy', stockId: 'TTE-PAR', ticker: 'TTE', sector: 'Énergie', amountEUR: 100 };
  const v = novabotRiskCheck(intent, wallet, mandate);
  check('une préférence seule (secteur préféré) ne bloque jamais un achat hors de ce secteur',
    v.allowed === true);
}

/* ---------- Discovery (copie simplifiée de novabotDiscoveryCandidats()) ---------- */
function discoveryFiltre(stocksCatalogue, watchlist, positions, mandate) {
  const dejaDetenus = new Set(positions.map(p => p.id));
  const estAutorise = (st) => {
    if (!st) return false;
    if (mandate.hardRules.some(r => r.type === 'excluded_sector' && r.value === st.sector)) return false;
    if (mandate.hardRules.some(r => r.type === 'excluded_asset' && (r.value === st.id || r.value === st.ticker))) return false;
    return true;
  };
  const byId = Object.fromEntries(stocksCatalogue.map(s => [s.id, s]));
  const watch = watchlist.filter(id => !dejaDetenus.has(id) && estAutorise(byId[id]));
  const dejaVus = new Set([...dejaDetenus, ...watch]);
  const reste = stocksCatalogue.filter(st => !dejaVus.has(st.id) && estAutorise(st)).map(st => st.id);
  return [...watch, ...reste];
}
{
  const catalogue = [
    { id: 'AAPL-NAS', ticker: 'AAPL', sector: 'Technologie' },
    { id: 'TTE-PAR', ticker: 'TTE', sector: 'Énergie' },
    { id: 'MSFT-NAS', ticker: 'MSFT', sector: 'Technologie' },
  ];
  const mandate = { ...mandatBase, hardRules: [{ type: 'excluded_sector', value: 'Énergie' }] };
  const candidats = discoveryFiltre(catalogue, [], [], mandate);
  check('discovery au-delà de la watchlist exclut un secteur interdit AVANT même de le proposer',
    !candidats.includes('TTE-PAR') && candidats.includes('AAPL-NAS') && candidats.includes('MSFT-NAS'));
}
{
  const catalogue = [{ id: 'AAPL-NAS', ticker: 'AAPL', sector: 'Technologie' }];
  const candidats = discoveryFiltre(catalogue, ['AAPL-NAS'], [], mandatBase);
  check('un titre de la watchlist n\'apparaît pas deux fois (watchlist + reste du catalogue)',
    candidats.filter(id => id === 'AAPL-NAS').length === 1);
}
{
  const catalogue = [{ id: 'AAPL-NAS', ticker: 'AAPL', sector: 'Technologie' }];
  const candidats = discoveryFiltre(catalogue, [], [{ id: 'AAPL-NAS', qty: 1, avg: 100 }], mandatBase);
  check('un titre déjà détenu n\'est jamais un "candidat" d\'achat (c\'est une sortie potentielle, pas une entrée)',
    !candidats.includes('AAPL-NAS'));
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
