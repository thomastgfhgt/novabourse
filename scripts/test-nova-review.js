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

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
