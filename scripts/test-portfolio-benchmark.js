// Reproduit fidelement benchmarkPourPeriode() (js/page-watchlist.js, §37 du
// prompt maitre NovaTitre : "Portefeuille +8,7% / Benchmark +5,2% / Ecart
// +3,5 pts") pour la verifier sans navigateur / sans appel reseau reel.

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

function benchmarkPourPeriode(entry) {
  if (!entry || entry.status !== 'ready' || entry.data.length < 2) return null;
  const first = entry.data[0].close, last = entry.data[entry.data.length - 1].close;
  if (!(first > 0)) return null;
  return { pct: (last / first - 1) * 100 };
}

// ---- cas nominal : hausse de l'indice ----
{
  const entry = { status: 'ready', data: [{ close: 7500 }, { close: 7850 }] };
  const r = benchmarkPourPeriode(entry);
  check('hausse détectée correctement (7500 -> 7850 = +4.666...%)', r && Math.abs(r.pct - (7850 / 7500 - 1) * 100) < 1e-9);
}

// ---- cas nominal : baisse de l'indice ----
{
  const entry = { status: 'ready', data: [{ close: 8000 }, { close: 7600 }] };
  const r = benchmarkPourPeriode(entry);
  check('baisse détectée correctement (8000 -> 7600 = -5%)', r && Math.abs(r.pct - (-5)) < 1e-9);
}

// ---- jamais un chiffre tant que les données ne sont pas prêtes (§81) ----
check('status loading -> null (jamais un 0% affiché comme une vraie donnée)',
  benchmarkPourPeriode({ status: 'loading', data: [] }) === null);
check('status error -> null', benchmarkPourPeriode({ status: 'error', data: [] }) === null);
check('status empty -> null', benchmarkPourPeriode({ status: 'empty', data: [] }) === null);
check('entry absente (undefined) -> null', benchmarkPourPeriode(undefined) === null);
check('un seul point (pas assez pour une variation) -> null',
  benchmarkPourPeriode({ status: 'ready', data: [{ close: 7500 }] }) === null);
check('premier point à zéro (division invalide) -> null',
  benchmarkPourPeriode({ status: 'ready', data: [{ close: 0 }, { close: 100 }] }) === null);

// ---- scénario complet du §37 : "Portefeuille +8,7% / Benchmark +5,2% / Écart +3,5 pts" ----
{
  const portefeuillePct = 8.7;
  const entry = { status: 'ready', data: [{ close: 1000 }, { close: 1052 }] }; // +5.2%
  const r = benchmarkPourPeriode(entry);
  const ecart = portefeuillePct - r.pct;
  check('benchmark calculé proche de +5.2% (exemple du §37)', Math.abs(r.pct - 5.2) < 0.01);
  check('écart calculé proche de +3.5 pts (exemple exact du §37)', Math.abs(ecart - 3.5) < 0.01);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
