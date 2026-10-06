// Teste les 2 parseurs de dates purs d'api/market/_nasdaqCalendar.js
// (dates résultats/dividendes, remplacement gratuit d'EODHD pour Nova
// Event, §34 du prompt maître NovaTitre) sans appel réseau réel.

const { dateUsVersIso, dateTexteAnglaisVersIso } = require('../api/market/_nasdaqCalendar.js');

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

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
