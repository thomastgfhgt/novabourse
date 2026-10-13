// Vérifie la logique de FILTRAGE des candidats à l'achat ajoutée au
// cycle automatique serveur (audit 2026-10-13, "je veux que tout soit
// automatisé [...] sans appuyer sur un bouton") — api/market/extra.js,
// handleNovabotCron(). Reproduit fidèlement les conditions d'éligibilité
// d'un candidat (même convention que les autres fichiers test-novabot-
// *.js : logique pure recopiée, pas de mock réseau/Supabase ici — déjà
// couvert indirectement par test-novabot-cron-engine.js pour le
// dimensionnement/risk check réutilisés tels quels).

function estEligible(id, st, wallet, mandate){
  if (!st || st.cur !== 'EUR') return false; // limitation devise assumée (voir _novabotEngine.js)
  if (wallet.positions.some(p => p.id === id)) return false; // déjà détenu -> renforcement non géré en v1
  if (mandate.hardRules.some(r => r.type === 'excluded_sector' && r.value === st.sector)) return false;
  if (mandate.hardRules.some(r => r.type === 'excluded_asset' && (r.value === id || r.value === st.ticker))) return false;
  return true;
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

const walletVide = { cash: 500, positions: [] };
const mandateSansRegle = { cashMinPct: 10, maxPositionPct: 15, hardRules: [] };

check('un candidat EUR, non détenu, sans exclusion -> éligible',
  estEligible('AAPL-NAS', { ticker:'AAPL', sector:'Technologie', cur:'EUR' }, walletVide, mandateSansRegle));

check('RÉGRESSION : un candidat déjà détenu (wallet.positions) est exclu — renforcement non géré par ce cycle (v1)',
  !estEligible('AAPL-NAS', { ticker:'AAPL', sector:'Technologie', cur:'EUR' },
    { cash:500, positions:[{ id:'AAPL-NAS', qty:1, avg:150 }] }, mandateSansRegle));

check('RÉGRESSION : un secteur exclu par le mandat (hardRules) écarte le candidat',
  !estEligible('XOM-NYS', { ticker:'XOM', sector:'Énergie', cur:'EUR' }, walletVide,
    { cashMinPct:10, maxPositionPct:15, hardRules:[{ type:'excluded_sector', value:'Énergie' }] }));

check('RÉGRESSION : un actif exclu nommément (par id OU par ticker) écarte le candidat',
  !estEligible('AAPL-NAS', { ticker:'AAPL', sector:'Technologie', cur:'EUR' }, walletVide,
    { cashMinPct:10, maxPositionPct:15, hardRules:[{ type:'excluded_asset', value:'AAPL' }] }));

check('une devise non-EUR écarte le candidat (même limitation assumée que pour les sorties)',
  !estEligible('X-LON', { ticker:'X', sector:'Technologie', cur:'GBP' }, walletVide, mandateSansRegle));

check('instrument introuvable dans le catalogue (st undefined) -> jamais une exception, simplement exclu',
  !estEligible('INCONNU-XXX', undefined, walletVide, mandateSansRegle));

check('une exclusion sur UN secteur n\'affecte pas un candidat d\'un AUTRE secteur',
  estEligible('AAPL-NAS', { ticker:'AAPL', sector:'Technologie', cur:'EUR' }, walletVide,
    { cashMinPct:10, maxPositionPct:15, hardRules:[{ type:'excluded_sector', value:'Énergie' }] }));

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
