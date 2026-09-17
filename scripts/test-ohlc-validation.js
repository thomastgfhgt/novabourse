const { normaliserHistorique, normaliserIntraday } = require('../api/market/_providers.js');

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// Cas 1 : high < low (donnee provider aberrante) -> les deux passent a null,
// close/open restent (le point n'est pas rejete en bloc).
{
  const out = normaliserHistorique([
    { date: '2026-09-01', open: 100, high: 90, low: 110, close: 101, volume: 1000 },
  ]);
  check('high<low : high -> null', out[0].high === null);
  check('high<low : low -> null', out[0].low === null);
  check('high<low : close conserve', out[0].close === 101);
  check('high<low : open conserve', out[0].open === 100);
  check('high<low : le point n\'est pas rejete', out.length === 1);
}

// Cas 2 : high >= low, cas normal -> rien ne change.
{
  const out = normaliserHistorique([
    { date: '2026-09-01', open: 100, high: 105, low: 99, close: 101, volume: 1000 },
  ]);
  check('cas normal : high conserve', out[0].high === 105);
  check('cas normal : low conserve', out[0].low === 99);
}

// Cas 3 : volume negatif -> null, jamais conserve tel quel.
{
  const out = normaliserHistorique([
    { date: '2026-09-01', open: 100, high: 105, low: 99, close: 101, volume: -500 },
  ]);
  check('volume negatif -> null', out[0].volume === null);
}

// Cas 4 : volume positif -> inchange.
{
  const out = normaliserHistorique([
    { date: '2026-09-01', open: 100, high: 105, low: 99, close: 101, volume: 500 },
  ]);
  check('volume positif conserve', out[0].volume === 500);
}

// Cas 5 : high == low (barre plate, legitime pour un instrument tres peu
// liquide) -> pas une anomalie, les deux sont conserves.
{
  const out = normaliserHistorique([
    { date: '2026-09-01', open: 100, high: 100, low: 100, close: 100, volume: 0 },
  ]);
  check('high==low : conserve (pas une anomalie)', out[0].high === 100 && out[0].low === 100);
}

// Cas 6 : meme garde-fou sur normaliserIntraday.
{
  const out = normaliserIntraday([
    { date: '2026-09-01T10:00:00Z', open: 100, high: 90, low: 110, close: 101, volume: -5 },
  ]);
  check('intraday high<low -> null/null', out[0].high === null && out[0].low === null);
  check('intraday volume negatif -> null', out[0].volume === null);
  check('intraday close conserve', out[0].close === 101);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
