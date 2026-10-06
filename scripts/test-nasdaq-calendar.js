// Teste les 2 parseurs de dates purs d'api/market/_nasdaqCalendar.js
// (dates résultats/dividendes, remplacement gratuit d'EODHD pour Nova
// Event, §34 du prompt maître NovaTitre) sans appel réseau réel.

const { dateUsVersIso, dateTexteAnglaisVersIso, estExchangeAmericain, nasdaqCalendarDates } = require('../api/market/_nasdaqCalendar.js');

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

// ---- dateUsVersIso (format Nasdaq MM/DD/YYYY) ----
check('MM/DD/YYYY valide -> ISO', dateUsVersIso('08/10/2026') === '2026-08-10');
check('jour/mois à 1 chiffre -> complété par un zéro', dateUsVersIso('1/5/2026') === '2026-01-05');
check('"N/A" (valeur Nasdaq pour un ticker non couvert) -> null', dateUsVersIso('N/A') === null);
check('absent/non-string -> null', dateUsVersIso(undefined) === null && dateUsVersIso(null) === null);
check('mois invalide (13) -> null, jamais une date fabriquée', dateUsVersIso('13/01/2026') === null);
check('format totalement différent -> null', dateUsVersIso('2026-08-10') === null);

// ---- dateTexteAnglaisVersIso ("Earnings announcement* for AAPL: Oct 29, 2026") ----
check(
  'texte réel observé en direct (2026-10-06) -> ISO correct',
  dateTexteAnglaisVersIso('Earnings announcement* for AAPL: Oct 29, 2026') === '2026-10-29'
);
check(
  'mois court (Jan, Jun...) reconnu',
  dateTexteAnglaisVersIso('Earnings announcement* for XYZ: Jan 3, 2027') === '2027-01-03'
);
check('texte sans date reconnaissable -> null, jamais une date devinée', dateTexteAnglaisVersIso('Aucune donnée disponible') === null);
check('absent/non-string -> null', dateTexteAnglaisVersIso(undefined) === null);
check('format inattendu (pas de ": Mois Jour, Année" en fin de texte) -> null', dateTexteAnglaisVersIso('Oct 29, 2026 : prochains résultats') === null);

// ---- estExchangeAmericain (garde-fou anti-collision MC/LVMH vs Moelis & Co) ----
check('NASDAQ -> américain', estExchangeAmericain('NASDAQ') === true);
check('NYSE -> américain', estExchangeAmericain('NYSE') === true);
check('"NYSE ARCA" -> américain', estExchangeAmericain('NYSE ARCA') === true);
check('"US" (code composite, ex. anciennement BATS/NYSE MKT) -> américain', estExchangeAmericain('US') === true);
check('insensible à la casse ("nasdaq")', estExchangeAmericain('nasdaq') === true);
check('"PA" (Euronext Paris, ex. MC=LVMH) -> PAS américain', estExchangeAmericain('PA') === false);
check('exchange vide -> REFUSÉ (contrairement à finnhubAutorise, volontairement plus strict)', estExchangeAmericain('') === false);
check('exchange absent -> REFUSÉ', estExchangeAmericain(undefined) === false);

(async () => {
  // ---- nasdaqCalendarDates() : AUCUN appel réseau pour un exchange non confirmé US ----
  // Reproduit le bug réel trouvé en direct le 2026-10-06 : ticker="MC" avec
  // un exchange non-US ne doit JAMAIS atteindre l'API Nasdaq (qui aurait
  // sinon renvoyé par erreur la date de résultats de Moelis & Co, NYSE).
  const resultatNonUs = await nasdaqCalendarDates('MC', 'PA');
  check('nasdaqCalendarDates("MC","PA") -> null IMMÉDIAT, aucune collision possible', resultatNonUs === null);

  const resultatSansExchange = await nasdaqCalendarDates('AAPL', '');
  check('nasdaqCalendarDates(ticker, "") -> null (exchange vide jamais toléré)', resultatSansExchange === null);

  let allOk = true;
  for (const [name, ok] of results) {
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
    if (!ok) allOk = false;
  }
  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
