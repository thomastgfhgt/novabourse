// Reproduit fidelement fluxNetPeriode() (js/page-watchlist.js) et le calcul
// corrige de periodeGain/periodePct (js/page-portfolio.js) pour verifier le
// §36 du prompt maitre NovaTitre : "10 000 € -> depot de 5 000 € ne signifie
// PAS +50% de performance". Meme convention que les autres scripts test-*.js.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

function fluxNetPeriode(transactions, startMs, endMs) {
  let net = 0;
  for (const tx of transactions) {
    if (tx.type !== 'deposit' && tx.type !== 'withdraw') continue;
    const t = new Date(tx.date).getTime();
    if (!(t > startMs && t <= endMs)) continue;
    net += tx.type === 'deposit' ? tx.amountEUR : -tx.amountEUR;
  }
  return net;
}

function performancePeriode(first, last, transactions) {
  const flux = fluxNetPeriode(transactions, first.t, last.t);
  const gain = (last.totalValue - first.totalValue) - flux;
  const pct = first.totalValue ? (gain / first.totalValue) * 100 : null;
  return { gain, pct, flux };
}

// ---- Scenario exact du prompt maitre : 10 000 € -> depot de 5 000 € ----
{
  const first = { t: 1000, totalValue: 10000 };
  const last  = { t: 2000, totalValue: 15000 }; // uniquement du au depot, zero gain de marche
  const transactions = [
    { type: 'deposit', amountEUR: 5000, date: new Date(1500).toISOString() },
  ];
  const { gain, pct, flux } = performancePeriode(first, last, transactions);
  check('depot pendant la periode detecte (flux = 5000)', flux === 5000);
  check('gain de periode = 0 une fois le depot retire (pas +5000)', gain === 0);
  check('performance = 0% (PAS +50%, exactement le cas cite au §36)', pct === 0);
}

// ---- Un vrai gain de marche, sans aucun flux ----
{
  const first = { t: 1000, totalValue: 10000 };
  const last  = { t: 2000, totalValue: 10800 };
  const { gain, pct, flux } = performancePeriode(first, last, []);
  check('sans flux : gain = variation brute (800)', gain === 800);
  check('sans flux : performance = 8%', Math.abs(pct - 8) < 1e-9);
  check('sans flux : flux = 0', flux === 0);
}

// ---- Gain de marche RÉEL + un retrait pendant la periode ----
{
  const first = { t: 1000, totalValue: 10000 };
  const last  = { t: 3000, totalValue: 10300 }; // +800 de marche, -500 de retrait = +300 net
  const transactions = [
    { type: 'withdraw', amountEUR: 500, date: new Date(2000).toISOString() },
  ];
  const { gain, pct, flux } = performancePeriode(first, last, transactions);
  check('retrait pendant la periode detecte (flux = -500)', flux === -500);
  check('gain reel retrouve malgre le retrait (300 - (-500) = 800)', gain === 800);
  check('performance reflete le vrai gain de marche (8%), pas le retrait', Math.abs(pct - 8) < 1e-9);
}

// ---- Un dépôt EXACTEMENT au timestamp du relevé de départ : deja inclus
//      dans first.totalValue (le relevé est pris juste après le dépôt),
//      ne doit PAS être soustrait une 2e fois. ----
{
  const first = { t: 1000, totalValue: 10000 }; // déjà après le dépôt de 5000
  const last  = { t: 2000, totalValue: 10200 }; // +200 de marché depuis
  const transactions = [
    { type: 'deposit', amountEUR: 5000, date: new Date(1000).toISOString() }, // == first.t, pas "après"
  ];
  const { gain, pct, flux } = performancePeriode(first, last, transactions);
  check('dépôt AU relevé de départ (pas après) : non recompté (flux = 0)', flux === 0);
  check('dépôt AU relevé de départ : gain = variation brute (200), pas -4800', gain === 200);
}

// ---- Transaction buy/sell (jamais un flux) ignorée par fluxNetPeriode ----
{
  const first = { t: 1000, totalValue: 10000 };
  const last  = { t: 2000, totalValue: 10000 };
  const transactions = [
    { type: 'buy', stockId: 'X', qty: 1, priceLocal: 100, amountEUR: 100, date: new Date(1500).toISOString() },
    { type: 'fee', amountEUR: 5, date: new Date(1600).toISOString() },
  ];
  const { flux } = performancePeriode(first, last, transactions);
  check('achat/frais jamais comptés comme un flux de trésorerie (flux = 0)', flux === 0);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
