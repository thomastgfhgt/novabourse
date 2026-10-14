// Vérifie novabotDecisionGainPct() (js/nova.js) — audit 2026-10-14,
// rapport : "on ne voit pas les gains ou les pertes des choix de
// NovaBot". Reproduit fidèlement la logique (fonctions pures sur un
// état simulé) — même convention que les autres fichiers test-novabot-
// *.js.

function novabotDecisionGainPct(d, { wallet, byId, quotesByStockId }){
  if (d.action === 'sell' && Number.isFinite(d.dataUsed?.gainPct)){
    return { pct: d.dataUsed.gainPct, label: 'Gain/perte réalisé' };
  }
  if (d.action === 'buy' && d.executionStatus === 'simulated'
    && Number.isFinite(d.priceObserved) && d.priceObserved > 0
    && wallet.positions.some(p => p.id === d.stockId)){
    const st = byId[d.stockId];
    const coursActuel = st ? quotesByStockId.get(st.id) : null;
    if (Number.isFinite(coursActuel)){
      return { pct: ((coursActuel - d.priceObserved) / d.priceObserved) * 100, label: 'Performance depuis l\'achat' };
    }
  }
  return null;
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- RÉGRESSION CENTRALE : une vente affiche son gain/perte réellement réalisé ---------- */
{
  const d = { action:'sell', stockId:'AAPL-NAS', dataUsed:{ gainPct:-10.3 } };
  const g = novabotDecisionGainPct(d, { wallet:{ positions:[] }, byId:{}, quotesByStockId:new Map() });
  check('RÉGRESSION : une vente (stop-loss) affiche le gainPct réellement stocké au moment du déclenchement, jamais recalculé',
    g !== null && g.pct === -10.3 && g.label === 'Gain/perte réalisé');
}

/* ---------- un achat encore détenu affiche la performance depuis l'achat (cours réel) ---------- */
{
  const d = { action:'buy', executionStatus:'simulated', stockId:'MSFT-NAS', priceObserved:100 };
  const wallet = { positions:[{ id:'MSFT-NAS', qty:1, avg:100 }] };
  const byId = { 'MSFT-NAS': { id:'MSFT-NAS' } };
  const quotes = new Map([['MSFT-NAS', 112]]);
  const g = novabotDecisionGainPct(d, { wallet, byId, quotesByStockId:quotes });
  check('RÉGRESSION : un achat encore détenu affiche sa performance réelle depuis l\'achat (112 vs 100 -> +12%)',
    g !== null && Math.abs(g.pct - 12) < 1e-9 && g.label === 'Performance depuis l\'achat');
}

/* ---------- un achat DONT LA POSITION A ÉTÉ VENDUE DEPUIS n'affiche RIEN ici ---------- */
{
  const d = { action:'buy', executionStatus:'simulated', stockId:'NVDA-NAS', priceObserved:50 };
  const wallet = { positions:[] }; // plus détenu
  const quotes = new Map([['NVDA-NAS', 80]]);
  const g = novabotDecisionGainPct(d, { wallet, byId:{ 'NVDA-NAS':{id:'NVDA-NAS'} }, quotesByStockId:quotes });
  check('RÉGRESSION : un achat dont la position a été vendue depuis n\'affiche rien ici (le résultat réel appartient à LA VENTE, jamais mélangé)',
    g === null);
}

/* ---------- cours actuel indisponible -> jamais une estimation, rien affiché ---------- */
{
  const d = { action:'buy', executionStatus:'simulated', stockId:'X', priceObserved:50 };
  const wallet = { positions:[{ id:'X', qty:1, avg:50 }] };
  const g = novabotDecisionGainPct(d, { wallet, byId:{ X:{id:'X'} }, quotesByStockId:new Map() });
  check('RÉGRESSION : cours actuel indisponible -> aucun chiffre affiché, jamais une estimation inventée', g === null);
}

/* ---------- une décision en attente (pending) n'affiche jamais de gain (rien ne s'est encore passé) ---------- */
{
  const d = { action:'buy', executionStatus:'pending', stockId:'X', priceObserved:50 };
  const wallet = { positions:[{ id:'X', qty:1, avg:50 }] };
  const quotes = new Map([['X', 60]]);
  const g = novabotDecisionGainPct(d, { wallet, byId:{ X:{id:'X'} }, quotesByStockId:quotes });
  check('RÉGRESSION : une proposition en attente (jamais exécutée) n\'affiche aucun gain — rien ne s\'est encore produit', g === null);
}

/* ---------- un refus (reject) n'affiche jamais de gain (aucune opération réelle) ---------- */
{
  const d = { action:'reject', stockId:'X', priceObserved:50, dataUsed:{} };
  const g = novabotDecisionGainPct(d, { wallet:{ positions:[] }, byId:{}, quotesByStockId:new Map() });
  check('un rejet n\'affiche jamais de gain (aucune transaction n\'a eu lieu)', g === null);
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
