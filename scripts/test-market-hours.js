const { statutMarche } = require('../api/market/_marketHours.js');

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// 2026-09-15 = mardi (vérifié via `new Date(...).toLocaleDateString(...,{weekday:'long'})`).
// 2026-09-19 = samedi. New York = UTC-4 (EDT) en septembre. Paris = UTC+2 (CEST) en septembre.

// NASDAQ, mardi 14:00 UTC = 10:00 heure de New York -> en séance (9h30-16h00).
{
  const d = new Date('2026-09-15T14:00:00Z');
  const st = statutMarche('NASDAQ', 'stock', d);
  check('NASDAQ mardi 10h locale -> open', st.status === 'open');
  check('NASDAQ localTime = 10:00', st.localTime === '10:00');
  check('NASDAQ timezone = America/New_York', st.timezone === 'America/New_York');
}

// NASDAQ, mardi 23:00 UTC = 19:00 heure de New York -> après clôture.
{
  const d = new Date('2026-09-15T23:00:00Z');
  const st = statutMarche('NASDAQ', 'stock', d);
  check('NASDAQ mardi 19h locale -> closed (après clôture)', st.status === 'closed');
}

// NASDAQ, samedi -> fermé quelle que soit l'heure (jour non ouvré).
{
  const d = new Date('2026-09-19T14:00:00Z');
  const st = statutMarche('NASDAQ', 'stock', d);
  check('NASDAQ samedi -> closed (week-end)', st.status === 'closed');
}

// Euronext Paris, mardi 08:00 UTC = 10:00 heure de Paris -> en séance (9h00-17h30).
{
  const d = new Date('2026-09-15T08:00:00Z');
  const st = statutMarche('PA', 'stock', d);
  check('Paris mardi 10h locale -> open', st.status === 'open');
}

// Euronext Paris, mardi 06:00 UTC = 08:00 heure de Paris -> avant ouverture.
{
  const d = new Date('2026-09-15T06:00:00Z');
  const st = statutMarche('PA', 'stock', d);
  check('Paris mardi 8h locale -> closed (avant ouverture)', st.status === 'closed');
}

// Crypto : jamais de statut de séance (24/7, non modélisé comme une place).
{
  const st = statutMarche('NASDAQ', 'crypto', new Date('2026-09-15T14:00:00Z'));
  check('crypto -> unknown quel que soit exchangeCode', st.status === 'unknown');
}

// Place non couverte -> unknown, jamais un horaire devine.
{
  const st = statutMarche('TSE', 'stock', new Date('2026-09-15T14:00:00Z'));
  check('place non couverte (TSE) -> unknown', st.status === 'unknown');
}

// NASDAQ ET NYSE ARCA doivent partager le meme statut a un instant donne
// (meme fuseau/horaires reels) -- coherence interne de la table.
{
  const d = new Date('2026-09-15T14:00:00Z');
  const a = statutMarche('NASDAQ', 'stock', d);
  const b = statutMarche('NYSE ARCA', 'stock', d);
  check('NASDAQ et NYSE ARCA coherents au meme instant', a.status === b.status);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
