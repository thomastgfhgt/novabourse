const { calculerPeriodStats } = require('../api/market/history.js');

function approx(a, b, eps = 1e-9) { return Math.abs(a - b) < eps; }

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// Cas 1 : serie simple, hausse
{
  const ohlcv = [
    { date: '2026-09-01', open: 100, high: 102, low: 99, close: 100, volume: 1000 },
    { date: '2026-09-02', open: 100, high: 105, low: 100, close: 104, volume: 2000 },
    { date: '2026-09-03', open: 104, high: 110, low: 103, close: 108, volume: 1500 },
  ];
  const st = calculerPeriodStats(ohlcv, '1s', null);
  check('pointCount = 3', st.pointCount === 3);
  check('first = 100', st.first === 100);
  check('last = 108', st.last === 108);
  check('absoluteChange = 8', st.absoluteChange === 8);
  check('percentChange = 8%', approx(st.percentChange, 8));
  check('averageClose = (100+104+108)/3', approx(st.averageClose, 104));
  check('high = 110 (vrai haut intra-barre, pas juste les clotures)', st.high === 110);
  check('low = 99', st.low === 99);
  check('averageVolume = 1500', approx(st.averageVolume, 1500));
  check('from = premiere date', st.from === '2026-09-01');
  check('to = derniere date', st.to === '2026-09-03');
}

// Cas 2 : un seul point -> null (pas de variation possible)
{
  const st = calculerPeriodStats([{ date: '2026-09-01', close: 100 }], '1j', '5min');
  check('1 seul point => null', st === null);
}

// Cas 3 : aucune donnee -> null
{
  check('tableau vide => null', calculerPeriodStats([], '1m', null) === null);
  check('null en entree => null', calculerPeriodStats(null, '1m', null) === null);
}

// Cas 4 : points sans high/low (ex. CoinGecko) -> repli sur les clotures, jamais NaN
{
  const ohlcv = [
    { date: '2026-09-01', close: 50 },
    { date: '2026-09-02', close: 55 },
  ];
  const st = calculerPeriodStats(ohlcv, '1s', null);
  check('repli high = max(closes) = 55', st.high === 55);
  check('repli low = min(closes) = 50', st.low === 50);
  check('pas de NaN', Number.isFinite(st.high) && Number.isFinite(st.low) && Number.isFinite(st.averageClose));
}

// Cas 5 : baisse, verifie le signe de percentChange
{
  const ohlcv = [
    { date: '2026-09-01', close: 200, high: 200, low: 198, volume: 10 },
    { date: '2026-09-02', close: 180, high: 190, low: 178, volume: 20 },
  ];
  const st = calculerPeriodStats(ohlcv, '1m', null);
  check('baisse : absoluteChange negatif', st.absoluteChange === -20);
  check('baisse : percentChange negatif', st.percentChange < 0);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
