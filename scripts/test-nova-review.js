// Reproduit la logique de Nova Review (theseAvantVente/compareHorizon,
// index.html PAGES.novareview, LOT H de l'Étape 3) pour la vérifier sans
// navigateur.
function theseAvantVente(transactions, stockId, dateVente) {
  const avant = transactions
    .filter(t => t.type === 'buy' && t.stockId === stockId && t.thesisReason
      && new Date(t.date) < new Date(dateVente))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return avant[0] || null;
}

const HORIZON_JOURS = { court: 90, moyen: 365, long: Infinity };
const HORIZON_LABEL = { court: 'court terme', moyen: 'moyen terme', long: 'long terme' };
function compareHorizon(joursDetention, horizonKey) {
  const seuil = HORIZON_JOURS[horizonKey];
  const label = HORIZON_LABEL[horizonKey];
  if (!Number.isFinite(seuil) && horizonKey !== 'long') return null;
  const j = Math.max(0, Math.round(joursDetention));
  if (horizonKey === 'long') {
    return j >= 365 ? { aligne: true, texte: `Conservé ${j} j — cohérent avec l'horizon « ${label} » annoncé.` }
                     : { aligne: false, texte: `Vendu après ${j} j — plus tôt que l'horizon « ${label} » annoncé.` };
  }
  return j <= seuil ? { aligne: true, texte: `Conservé ${j} j — cohérent avec l'horizon « ${label} » annoncé.` }
                     : { aligne: false, texte: `Conservé ${j} j — au-delà de l'horizon « ${label} » annoncé.` };
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

check('horizon inconnu -> null (jamais une comparaison inventée)', compareHorizon(50, 'inexistant') === null);

check('court terme tenu -> aligné', compareHorizon(30, 'court').aligne === true);
check('court terme dépassé -> non aligné', compareHorizon(200, 'court').aligne === false);
check('long terme tenu (>=365j) -> aligné', compareHorizon(400, 'long').aligne === true);
check('long terme vendu tôt (<365j) -> non aligné', compareHorizon(100, 'long').aligne === false);
check('moyen terme, exactement au seuil -> aligné (inclusif)', compareHorizon(365, 'moyen').aligne === true);

const transactions = [
  { type: 'buy', stockId: 'AAPL-NAS', thesisReason: 'Croissance solide', date: '2026-01-01T00:00:00.000Z' },
  { type: 'sell', stockId: 'AAPL-NAS', date: '2026-01-15T00:00:00.000Z' },
  { type: 'buy', stockId: 'AAPL-NAS', thesisReason: 'Rachat après repli', date: '2026-02-01T00:00:00.000Z' },
  { type: 'buy', stockId: 'MSFT-NAS', thesisReason: null, date: '2026-01-01T00:00:00.000Z' },
];

{
  // Vente du 2026-03-01 : doit retrouver la thèse du 2026-02-01 (la plus
  // récente AVANT cette vente), jamais celle du 2026-01-01.
  const t = theseAvantVente(transactions, 'AAPL-NAS', '2026-03-01T00:00:00.000Z');
  check('retrouve la these la plus recente AVANT la vente', t.thesisReason === 'Rachat après repli');
}
{
  // Vente du 2026-01-10, AVANT le rachat du 2026-02-01 : ne doit trouver
  // que la these du 2026-01-01, jamais celle du futur.
  const t = theseAvantVente(transactions, 'AAPL-NAS', '2026-01-10T00:00:00.000Z');
  check('ignore une these posterieure a la vente en cours de revue', t.thesisReason === 'Croissance solide');
}
{
  const t = theseAvantVente(transactions, 'MSFT-NAS', '2026-06-01T00:00:00.000Z');
  check('aucune these renseignee -> null (jamais un texte invente)', t === null);
}
{
  const t = theseAvantVente(transactions, 'GOOGL-NAS', '2026-06-01T00:00:00.000Z');
  check('titre jamais achete -> null', t === null);
}

// ============================================================
// MOTEUR DE VERDICT (2026-09-26, retour utilisateur : esprit "chess.com",
// separer la qualite de la decision du resultat) — reproduit l'arbre de
// decision de evaluerVente()/evaluerPositionOuverte() (index.html), pris
// en entree deja calcule (gainPct/regretPct/processAligne/concentration)
// pour tester l'ARBRE lui-meme independamment de ses dependances
// (queSiRienFait/compareHorizon/rejouerTransactions, deja testees
// ailleurs).
const VERDICT_CONCENTRATION_RISQUEE = .35;
const VERDICT_GAIN_EXCELLENT = .10;
const VERDICT_REGRET_MANQUE = .15;

function verdictVente({ gainPct, regretPct, processAligne, concentration }) {
  if (regretPct !== null && regretPct >= VERDICT_REGRET_MANQUE) return 'Occasion manquée';
  if (gainPct === null) return 'Intéressant';
  if (gainPct >= VERDICT_GAIN_EXCELLENT && processAligne !== false) return 'Excellent coup';
  if (gainPct >= 0 && processAligne !== false) return 'Bon coup';
  if (gainPct >= 0 && processAligne === false) return 'Intéressant';
  if (gainPct < 0 && concentration !== null && concentration >= VERDICT_CONCENTRATION_RISQUEE) return 'Risqué';
  return 'Erreur à étudier';
}
function verdictPositionOuverte({ gainPct, concentration }) {
  if (concentration !== null && concentration >= VERDICT_CONCENTRATION_RISQUEE) return 'Risqué';
  if (gainPct >= VERDICT_GAIN_EXCELLENT) return 'Excellent coup';
  if (gainPct >= 0) return 'Bon coup';
  if (gainPct >= -.10) return 'Intéressant';
  return 'Erreur à étudier';
}

check('gros gain + processus respecte -> Excellent coup',
  verdictVente({ gainPct: .25, regretPct: 0, processAligne: true, concentration: .1 }) === 'Excellent coup');
check('gain modeste + processus inconnu (pas de these) -> Bon coup',
  verdictVente({ gainPct: .04, regretPct: 0, processAligne: null, concentration: .1 }) === 'Bon coup');
check('gain mais processus non respecte -> Interessant (chance plutot que methode)',
  verdictVente({ gainPct: .08, regretPct: 0, processAligne: false, concentration: .1 }) === 'Intéressant');
check('perte + forte concentration au moment de l\'achat -> Risque',
  verdictVente({ gainPct: -.15, regretPct: null, processAligne: null, concentration: .5 }) === 'Risqué');
check('perte + position raisonnable -> Erreur a etudier',
  verdictVente({ gainPct: -.15, regretPct: null, processAligne: true, concentration: .1 }) === 'Erreur à étudier');
check('fort regret (conserver aurait bien mieux valu) -> Occasion manquee, prioritaire sur le reste',
  verdictVente({ gainPct: .20, regretPct: .30, processAligne: true, concentration: .1 }) === 'Occasion manquée');
check('cout inconnu (gainPct null) -> Interessant, jamais un verdict tranche sans base',
  verdictVente({ gainPct: null, regretPct: null, processAligne: null, concentration: null }) === 'Intéressant');
check('leger regret (<3% dans le code appelant) n\'empeche pas un Excellent coup si sous le seuil "manque"',
  verdictVente({ gainPct: .15, regretPct: .02, processAligne: true, concentration: .1 }) === 'Excellent coup');

check('position ouverte tres concentree -> Risque, prioritaire meme si gagnante',
  verdictPositionOuverte({ gainPct: .30, concentration: .5 }) === 'Risqué');
check('position ouverte en gain fort et peu concentree -> Excellent coup',
  verdictPositionOuverte({ gainPct: .12, concentration: .1 }) === 'Excellent coup');
check('position ouverte en perte moderee -> Interessant (pas encore un resultat definitif)',
  verdictPositionOuverte({ gainPct: -.05, concentration: .1 }) === 'Intéressant');
check('position ouverte en forte perte -> Erreur a etudier',
  verdictPositionOuverte({ gainPct: -.25, concentration: .1 }) === 'Erreur à étudier');

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
