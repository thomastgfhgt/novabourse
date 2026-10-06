// Reproduit estExchangeAmericainOuInconnu() (api/market/_secEdgar.js,
// correctif 2026-10-06 : bug reel confirme en direct — secedgar("MC","PA")
// renvoyait les fondamentaux de Moelis & Co (NYSE) au lieu de refuser,
// alors que la fiche demandee etait LVMH (Euronext Paris, meme ticker
// "MC"). Memes garanties que test-nasdaq-calendar.js pour la meme classe
// de bug cote _nasdaqCalendar.js.

const EXCHANGES_US_CONFIRMES = new Set(['NASDAQ', 'NYSE', 'NYSE ARCA', 'US']);
function estExchangeAmericainOuInconnu(exchange) {
  const e = String(exchange || '').toUpperCase().trim();
  return !e || EXCHANGES_US_CONFIRMES.has(e);
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

check('NASDAQ -> autorisé', estExchangeAmericainOuInconnu('NASDAQ') === true);
check('NYSE -> autorisé', estExchangeAmericainOuInconnu('NYSE') === true);
check('"NYSE ARCA" -> autorisé', estExchangeAmericainOuInconnu('NYSE ARCA') === true);
check('"US" -> autorisé', estExchangeAmericainOuInconnu('US') === true);
check('insensible à la casse ("nasdaq")', estExchangeAmericainOuInconnu('nasdaq') === true);
check('exchange vide -> autorisé (comportement historique préservé)', estExchangeAmericainOuInconnu('') === true);
check('exchange absent (undefined) -> autorisé', estExchangeAmericainOuInconnu(undefined) === true);
check('"PA" (Euronext Paris, cas réel MC=LVMH) -> REFUSÉ', estExchangeAmericainOuInconnu('PA') === false);
check('"DE" (Xetra) -> REFUSÉ', estExchangeAmericainOuInconnu('DE') === false);
check('"L" (Londres) -> REFUSÉ', estExchangeAmericainOuInconnu('L') === false);

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
