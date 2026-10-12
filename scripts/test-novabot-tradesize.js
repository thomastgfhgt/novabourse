// Vérifie le correctif NovaBot V7 §3 (audit 2026-10-12, bug confirmé par
// capture d'écran : "dizaines de lignes similaires Refusé pour risque —
// Alphabet Inc. — 500€" sur un portefeuille de 500€).
// Cause exacte : cfg.tradeAmountEUR (500€, montant FIXE par achat) était
// utilisé tel quel comme montant d'achat, sans jamais être réduit pour
// respecter la réserve de cash (cashMinPct) ou le maximum par position
// (maxPositionPct) du mandat — avec un portefeuille DE LA TAILLE du
// montant par défaut, un rejet mathématiquement garanti, identique à
// chaque passage. Reproduit la formule de dimensionnement (js/core.js,
// evaluerNovaBot()) en isolation, même convention que les autres
// fichiers test-novabot-*.js (fonctions pures recopiées).

const NOVABOT_MONTANT_MIN_INVESTISSABLE = 5;

function cashDisponiblePourInvestir(wallet, pfTotal, cashMinPct){
  const cashMinGlobal = (cashMinPct / 100) * pfTotal;
  return wallet.cash - cashMinGlobal;
}

function montantInvestissable({ tradeAmountEUR, cashDispo, pfTotal, maxPositionPct, valeurExistanteEUR }){
  const plafondPosition = (maxPositionPct / 100) * pfTotal - valeurExistanteEUR;
  return Math.min(tradeAmountEUR, cashDispo, plafondPosition);
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

/* ---------- 1) scénario exact du rapport : 500€, tradeAmountEUR=500 ---------- */
{
  const wallet = { cash: 500 };
  const pfTotal = 500;
  const cashMinPct = 10; // réserve minimale du mandat
  const cashDispo = cashDisponiblePourInvestir(wallet, pfTotal, cashMinPct);
  check('RÉGRESSION : avec 500€ de cash et 10% de réserve, il reste bien 450€ investissables (pas 0, pas 500)',
    cashDispo === 450);

  const montant = montantInvestissable({ tradeAmountEUR: 500, cashDispo, pfTotal, maxPositionPct: 20, valeurExistanteEUR: 0 });
  check('RÉGRESSION : le montant investi réel est maintenant plafonné (ici par maxPositionPct=20% -> 100€), jamais le flat 500€ qui aurait toujours violé la réserve',
    montant === 100 && montant < 500);
  check('le montant respecte la réserve de cash (ne dépasse jamais cashDispo)', montant <= cashDispo);

  const cashApresAchat = wallet.cash - montant;
  const cashMin = (cashMinPct / 100) * pfTotal;
  check('RÉGRESSION CENTRALE : après achat au montant calculé, le cash restant respecte TOUJOURS la réserve minimale (c\'était systématiquement violé avec le montant fixe)',
    cashApresAchat >= cashMin - 1e-9);
}

/* ---------- 2) plus de maxPositionPct configuré (plafond large) : le cash reste la seule vraie limite ---------- */
{
  const wallet = { cash: 500 };
  const pfTotal = 500;
  const cashDispo = cashDisponiblePourInvestir(wallet, pfTotal, 10); // 450
  const montant = montantInvestissable({ tradeAmountEUR: 500, cashDispo, pfTotal, maxPositionPct: 100, valeurExistanteEUR: 0 });
  check('sans contrainte de position resserrée, le montant est plafonné par le cash disponible (450€), toujours pas le flat 500€',
    montant === 450);
}

/* ---------- 3) réserve = 100% du portefeuille : plus rien d'investissable, détecté AVANT tout candidat ---------- */
{
  const wallet = { cash: 500 };
  const pfTotal = 500;
  const cashDispo = cashDisponiblePourInvestir(wallet, pfTotal, 100);
  check('RÉGRESSION : réserve à 100% -> 0€ disponible, sous le seuil minimum -> aucun candidat ne doit être évalué individuellement',
    cashDispo === 0 && cashDispo < NOVABOT_MONTANT_MIN_INVESTISSABLE);
}

/* ---------- 4) renforcement d'une position existante : le plafond tient compte de la valeur déjà détenue ---------- */
{
  const wallet = { cash: 500 };
  const pfTotal = 600; // 500 cash + 100 déjà investis dans ce même titre
  const cashDispo = cashDisponiblePourInvestir(wallet, pfTotal, 10); // 500 - 60 = 440
  const montant = montantInvestissable({ tradeAmountEUR: 500, cashDispo, pfTotal, maxPositionPct: 20, valeurExistanteEUR: 100 });
  // plafond position = 20% * 600 - 100 = 20 ; c'est la borne la plus stricte
  check('une position déjà partiellement détenue a un plafond de renforcement réduit d\'autant (20% de 600€ - 100€ déjà détenus = 20€)',
    montant === 20);
}

/* ---------- 5) déduplication 24h (même convention que `dejaWatch` existant) ---------- */
function dejaSignaleCashGlobal(decisions, maintenant){
  return decisions.some(d => d.dataUsed?.raison === 'cash_reserve_globale'
    && (maintenant - new Date(d.date).getTime()) < 24 * 3600 * 1000);
}
check('RÉGRESSION : un rejet "cash_reserve_globale" déjà enregistré il y a moins de 24h n\'est pas réémis (c\'est exactement le mécanisme qui produisait les dizaines de lignes identiques)',
  dejaSignaleCashGlobal([{ date: new Date(Date.now() - 3600 * 1000).toISOString(), dataUsed:{ raison:'cash_reserve_globale' } }], Date.now()));
check('un rejet "cash_reserve_globale" vieux de plus de 24h peut être réémis (la situation mérite d\'être re-signalée)',
  !dejaSignaleCashGlobal([{ date: new Date(Date.now() - 25 * 3600 * 1000).toISOString(), dataUsed:{ raison:'cash_reserve_globale' } }], Date.now()));
check('aucune décision passée -> jamais bloqué par la déduplication au premier passage', !dejaSignaleCashGlobal([], Date.now()));

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
