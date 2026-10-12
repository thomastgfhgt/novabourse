// Vérifie api/market/_novabotEngine.js — le portage serveur du moteur
// NovaBot (V7 phase 2, 2026-10-12 : "le système doit fonctionner côté
// serveur, même lorsque l'utilisateur ferme son navigateur"). Charge le
// VRAI module (pas une copie) : contrairement aux autres fichiers
// test-novabot-*.js, _novabotEngine.js n'a aucune dépendance Vercel/
// réseau dans ses exports (fonctions pures uniquement), donc require()
// direct est fiable ici.

const { rejouerNovaBot, toEURSimple, novabotRiskCheckServeur,
  montantInvestissableServeur, MONTANT_MIN_INVESTISSABLE } = require('../api/market/_novabotEngine.js');

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- rejouerNovaBot() : identique à js/core.js ---------- */
{
  const transactions = [
    { type:'deposit', amountEUR:500, date:'2026-01-01T00:00:00Z' },
    { type:'buy', stockId:'AAPL-NAS', qty:2, priceLocal:150, amountEUR:300, date:'2026-01-02T00:00:00Z' },
  ];
  const wallet = rejouerNovaBot(transactions);
  check('rejouerNovaBot : dépôt + achat -> cash correct (500-300=200)', wallet.cash === 200);
  check('rejouerNovaBot : position ouverte avec la bonne quantité/prix moyen', wallet.positions.length === 1 && wallet.positions[0].qty === 2 && wallet.positions[0].avg === 150);
}
check('rejouerNovaBot : une vente ferme intégralement la position sous 0.0001', (() => {
  const w = rejouerNovaBot([
    { type:'deposit', amountEUR:500, date:'2026-01-01T00:00:00Z' },
    { type:'buy', stockId:'X', qty:1, priceLocal:100, amountEUR:100, date:'2026-01-02T00:00:00Z' },
    { type:'sell', stockId:'X', qty:1, priceLocal:110, amountEUR:110, realizedGain:10, date:'2026-01-03T00:00:00Z' },
  ]);
  return w.positions.length === 0 && w.realizedPnL === 10;
})());

/* ---------- toEURSimple() : jamais un taux inventé ---------- */
check('toEURSimple : EUR -> montant inchangé', toEURSimple(100, 'EUR') === 100);
check('RÉGRESSION : toEURSimple sur une devise non-EUR renvoie null (jamais un taux de conversion inventé sans accès aux taux réels)', toEURSimple(100, 'USD') === null);
check('toEURSimple : montant non-fini -> null, jamais NaN propagé', toEURSimple(NaN, 'EUR') === null);

/* ---------- novabotRiskCheckServeur() : même contrat que js/core.js ---------- */
{
  const wallet = { cash: 450 };
  const mandate = { hardRules: [], cashMinPct: 10 };
  const intentOk = { action:'buy', amountEUR: 100, sector:'Tech', stockId:'X', ticker:'X' };
  const verdictOk = novabotRiskCheckServeur(intentOk, wallet, mandate, 500);
  check('novabotRiskCheckServeur : achat dans les clous -> autorisé', verdictOk.allowed === true);

  const intentTrop = { action:'buy', amountEUR: 440, sector:'Tech', stockId:'X', ticker:'X' }; // <= cash (450) mais viole la réserve de 10% (50€) une fois dépensé
  const verdictTrop = novabotRiskCheckServeur(intentTrop, wallet, mandate, 500);
  check('RÉGRESSION : achat qui viole la réserve de cash -> refusé (cash_min)', verdictTrop.allowed === false && verdictTrop.violations.some(v => v.type === 'cash_min'));

  const verdictVente = novabotRiskCheckServeur({ action:'sell' }, wallet, mandate, 500);
  check('une vente est toujours autorisée par le Risk Engine (jamais bloquée par la réserve de cash)', verdictVente.allowed === true);

  const mandateSecteurExclu = { hardRules: [{ type:'excluded_sector', value:'Tech' }], cashMinPct: 10 };
  const verdictSecteur = novabotRiskCheckServeur(intentOk, wallet, mandateSecteurExclu, 500);
  check('secteur exclu par le mandat -> refusé', verdictSecteur.allowed === false && verdictSecteur.violations.some(v => v.type === 'secteur_interdit'));
}

/* ---------- montantInvestissableServeur() : même formule que le correctif 2026-10-12 ---------- */
check('RÉGRESSION : même scénario que le bug "Refusé pour risque x50" (500€, réserve 10%) -> montant plafonné, jamais le flat tradeAmountEUR',
  montantInvestissableServeur({ tradeAmountEUR: 500, cashDispo: 450, pfTotalEUR: 500, maxPositionPct: 20, valeurExistanteEUR: 0 }) === 100);
check('MONTANT_MIN_INVESTISSABLE exporté et cohérent avec js/core.js (5€)', MONTANT_MIN_INVESTISSABLE === 5);

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
