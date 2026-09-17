// Verifie que les accesseurs CMP_ROWS corriges lisent les VRAIS noms de
// champs renvoyes par /api/market/fundamentals (voir _providers.js),
// reproduits fidelement, contre un objet fundamentals realiste.

function fmtPctRatio(v, d = 1){
  return Number.isFinite(v) ? (v * 100).toLocaleString('fr-FR', { minimumFractionDigits:d, maximumFractionDigits:d }) + ' %' : '—';
}
function croissanceSerie(serie){
  if (!Array.isArray(serie)) return null;
  const valides = serie.filter(x => x && Number.isInteger(x.annee) && Number.isFinite(x.valeur)).sort((a, b) => b.annee - a.annee);
  if (valides.length < 2) return null;
  const [recent, precedent] = valides;
  if (recent.annee - precedent.annee !== 1) return null;
  if (precedent.valeur === 0) return null;
  return (recent.valeur - precedent.valeur) / precedent.valeur * 100;
}

// Objet fundamentals REALISTE (mêmes noms de champs que _providers.js
// FUNDAMENTALS.eodhd renvoie reellement) - jamais .per/.margin/.debtEquity.
const fundamentalsReel = {
  pe: 31.4,
  roe: 0.28,            // decimal (28%), pas deja en pourcentage
  profitMargin: 0.245,  // decimal (24.5%)
  operatingMargin: 0.31,
  revenueSeries: [
    { annee: 2025, valeur: 120 },
    { annee: 2024, valeur: 100 },
  ],
};

// Les ANCIENS accesseurs (avant correctif) pour comparaison.
const ancien = {
  per: s => s.fundamentals && s.fundamentals.per,
  margin: s => s.fundamentals && s.fundamentals.margin,
};
// Les NOUVEAUX accesseurs (apres correctif, reproduits verbatim).
const nouveau = {
  pe: s => s.fundamentals?.pe,
  roe: s => s.fundamentals?.roe,
  margin: s => Number.isFinite(s.fundamentals?.profitMargin) ? s.fundamentals.profitMargin : s.fundamentals?.operatingMargin,
  croissance: s => croissanceSerie(s.fundamentals?.revenueSeries),
};

const st = { fundamentals: fundamentalsReel };
const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

check('ANCIEN accesseur .per -> undefined (bug confirme)', ancien.per(st) === undefined);
check('ANCIEN accesseur .margin -> undefined (bug confirme)', ancien.margin(st) === undefined);

check('NOUVEAU .pe -> 31.4 (vrai champ)', nouveau.pe(st) === 31.4);
check('NOUVEAU .roe -> 0.28 (valeur brute correcte)', nouveau.roe(st) === 0.28);
check('NOUVEAU ROE formate en % -> "28,0 %"', fmtPctRatio(nouveau.roe(st)) === '28,0 %');
check('NOUVEAU .margin -> profitMargin (0.245)', nouveau.margin(st) === 0.245);
check('NOUVEAU margin formate en % -> "24,5 %"', fmtPctRatio(nouveau.margin(st)) === '24,5 %');

// operatingMargin en repli si profitMargin absent.
{
  const st2 = { fundamentals: { operatingMargin: 0.15 } };
  check('NOUVEAU .margin repli sur operatingMargin si profitMargin absent', nouveau.margin(st2) === 0.15);
}

check('NOUVEAU croissance CA -> +20% (120 vs 100)', nouveau.croissance(st) === 20);

// Societe non analysee (fundamentals null) -> tout reste indisponible,
// jamais une erreur/NaN.
{
  const vide = { fundamentals: null };
  check('societe non analysee : .pe -> undefined, pas de crash', nouveau.pe(vide) === undefined);
  check('societe non analysee : formatage -> "—"', fmtPctRatio(nouveau.roe(vide)) === '—');
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
