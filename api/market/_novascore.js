/**
 * api/market/_novascore.js — MOTEUR NOVASCORE
 *
 * Déterministe : mêmes données + même version = même note. Aucune valeur
 * aléatoire, aucun appel réseau, aucune intervention d'un modèle de langage.
 * Le moteur ne reçoit que le dossier normalisé de la couche marché.
 *
 * Deux principes tenus partout :
 *   · une métrique absente est retirée, jamais estimée ;
 *   · un calcul non significatif rend null, jamais NaN ni Infinity.
 *
 * REDISTRIBUTION ≠ COUVERTURE
 *   Les poids manquants sont redistribués pour ramener le score sur 100.
 *   La couverture, elle, ne bénéficie d'aucune redistribution : elle mesure
 *   la quantité d'information réellement disponible.
 */

const ENGINE = 'nova-1.0.0';

/* ---------- barèmes ----------
   Interpolation linéaire entre paliers, plafonnée aux extrémités. Publiés
   ici pour que toute note soit recalculable à la main. */
function bareme(points, v){
  if (!Number.isFinite(v)) return null;
  const p = points;
  if (v <= p[0][0]) return p[0][1];
  if (v >= p[p.length - 1][0]) return p[p.length - 1][1];
  for (let i = 1; i < p.length; i++){
    if (v <= p[i][0]){
      const [x0, y0] = p[i - 1], [x1, y1] = p[i];
      return Math.round(y0 + (v - x0) / (x1 - x0) * (y1 - y0));
    }
  }
  return null;
}

const SCALES = {
  growth:          [[-0.10, 0], [0, 25], [0.08, 55], [0.15, 75], [0.25, 100]],
  profitMargin:    [[0, 0], [0.05, 30], [0.12, 60], [0.20, 85], [0.30, 100]],
  operatingMargin: [[0, 0], [0.06, 32], [0.15, 65], [0.25, 90], [0.35, 100]],
  roe:             [[0, 0], [0.08, 35], [0.15, 65], [0.25, 90], [0.40, 100]],
  netDebtToCap:    [[-0.20, 100], [0, 92], [0.25, 70], [0.60, 40], [1.00, 10], [1.50, 0]],
  cashToDebt:      [[0, 0], [0.25, 35], [0.60, 65], [1.20, 90], [2.50, 100]],
  pe:              [[6, 100], [12, 82], [20, 60], [30, 35], [45, 10], [70, 0]],
  forwardPE:       [[5, 100], [11, 84], [18, 62], [28, 36], [42, 10], [65, 0]],
  priceToBook:     [[0.6, 100], [1.5, 78], [3, 55], [6, 25], [12, 0]],
  evToEbitda:      [[4, 100], [8, 80], [13, 55], [20, 25], [32, 0]],
  perf:            [[-0.25, 0], [-0.08, 30], [0.05, 55], [0.20, 82], [0.40, 100]],
  volatility:      [[0.12, 100], [0.20, 78], [0.30, 52], [0.42, 25], [0.55, 0]],
  maxDrawdown:     [[0.08, 100], [0.18, 75], [0.30, 48], [0.45, 20], [0.60, 0]],
  debtToCap:       [[0, 100], [0.20, 78], [0.45, 50], [0.80, 20], [1.20, 0]],
  fcfMargin:       [[-0.05, 0], [0.02, 30], [0.08, 60], [0.15, 85], [0.25, 100]],
  fcfPositive:     [[0, 0], [1, 100]],
};

/* ---------- familles : poids de note et poids de couverture ---------- */
const FAMILIES = {
  profitability: { weight: 17, label: 'Rentabilité',
    metrics: { profitMargin: 7, operatingMargin: 5, roe: 5 } },
  growth:        { weight: 16, label: 'Croissance',
    metrics: { revenueGrowth: 7, epsGrowth: 5, fcfGrowth: 4 } },
  solidity:      { weight: 16, label: 'Solidité financière',
    metrics: { netDebtToCap: 9, cashToDebt: 7 } },
  valuation:     { weight: 16, label: 'Valorisation',
    metrics: { pe: 6, evToEbitda: 4, priceToBook: 3, forwardPE: 3 } },
  quality:       { weight: 12, label: 'Qualité',
    metrics: { fcfMargin: 5, operatingMargin: 4, fcfPositive: 3 } },
  risk:          { weight: 12, label: 'Risque',
    metrics: { volatility: 5, maxDrawdown: 4, debtToCap: 3 } },
  momentum:      { weight: 11, label: 'Momentum',
    metrics: { perf3M: 4, perf12M: 4, perf1M: 3 } },
};
const POIDS_TOTAL = Object.values(FAMILIES).reduce((a, f) => a + f.weight, 0);   // 100

/* ============================================================
   CAS MATHÉMATIQUES NON SIGNIFIATIFS
   Chaque règle est explicite. Aucun résultat n'est produit « par défaut ».
   ============================================================ */
const fini = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Croissance entre deux exercices. null si la comparaison n'a pas de sens. */
function croissance(nMoins1, n){
  const a = fini(nMoins1), b = fini(n);
  if (a === null || b === null) return { value: null, reason: 'donnee_absente' };
  if (a === 0) return { value: null, reason: 'base_nulle' };
  // Passage par zéro : « −50 M € → +10 M € » ne se traduit pas en pourcentage.
  if (a < 0 && b >= 0) return { value: null, reason: 'retournement_positif', note: 'passage_de_perte_a_profit' };
  if (a > 0 && b < 0)  return { value: null, reason: 'retournement_negatif', note: 'passage_de_profit_a_perte' };
  if (a < 0 && b < 0){
    // Deux exercices négatifs : une « croissance » de −20 % signifie une perte
    // réduite. Le signe usuel induirait en erreur, on l'inverse explicitement.
    return { value: (Math.abs(a) - Math.abs(b)) / Math.abs(a), reason: null, note: 'perte_reduite' };
  }
  return { value: (b - a) / a, reason: null };
}

/** Ratio protégé : dénominateur nul ou absent → null. */
function ratio(num, den, opts = {}){
  const a = fini(num), b = fini(den);
  if (a === null || b === null) return null;
  if (b === 0) return opts.zeroDen === undefined ? null : opts.zeroDen;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

/* ============================================================
   MÉTRIQUES DÉRIVÉES
   ============================================================ */
function metriquesFondamentales(f = {}, market = {}){
  const out = {}, notes = {};
  const cap = fini(market.marketCap) ?? fini(f.marketCap);

  // — Rentabilité
  out.profitMargin    = fini(f.profitMargin);
  out.operatingMargin = fini(f.operatingMargin);
  out.roe             = fini(f.roe);

  // — Croissance (séries annuelles extraites par l'adaptateur)
  for (const [cle, serie] of [['revenueGrowth', f.revenueSeries],
                              ['epsGrowth', f.epsSeries],
                              ['fcfGrowth', f.fcfSeries]]){
    if (!Array.isArray(serie) || serie.length < 2){ out[cle] = null; continue; }
    const c = croissance(serie[1], serie[0]);   // [0] = exercice le plus récent
    out[cle] = c.value;
    if (c.reason) notes[cle] = c.reason;
    if (c.note) notes[cle] = c.note;
  }

  // — Solidité
  const dette = fini(f.debt), cash = fini(f.cash);
  const detteNette = dette !== null && cash !== null ? dette - cash : null;
  out.netDebtToCap = ratio(detteNette, cap);
  if (dette !== null && dette === 0){
    // Aucune dette : cashToDebt n'a pas de dénominateur. On ne divise pas,
    // on constate la situation la plus favorable du barème.
    out.cashToDebt = 2.5; notes.cashToDebt = 'dette_nulle';
  } else {
    out.cashToDebt = ratio(cash, dette);
  }
  out.debtToCap = ratio(dette, cap);

  // — Valorisation : un multiple négatif n'est pas « bon marché », il traduit
  //   une perte. On l'écarte plutôt que de le noter.
  for (const cle of ['pe', 'forwardPE', 'evToEbitda']){
    const v = fini(f[cle]);
    if (v === null){ out[cle] = null; continue; }
    if (v <= 0){ out[cle] = null; notes[cle] = 'multiple_negatif'; continue; }
    out[cle] = v;
  }
  const pb = fini(f.priceToBook);
  out.priceToBook = pb !== null && pb > 0 ? pb : null;
  if (pb !== null && pb <= 0) notes.priceToBook = 'fonds_propres_negatifs';

  // — Qualité
  out.fcfMargin   = ratio(f.freeCashFlow, f.revenue);
  out.fcfPositive = fini(f.freeCashFlow) === null ? null : (f.freeCashFlow > 0 ? 1 : 0);

  return { metrics: out, notes };
}

/** Volatilité, drawdown et performances, calculés sur les clôtures réelles. */
function metriquesMarche(ohlcv){
  const out = { volatility: null, maxDrawdown: null, perf1M: null, perf3M: null, perf12M: null };
  if (!Array.isArray(ohlcv)) return out;
  const c = ohlcv.map(x => fini(x && x.close)).filter(v => v !== null && v > 0);
  if (c.length < 25) return out;

  const rend = [];
  for (let i = 1; i < c.length; i++) rend.push(Math.log(c[i] / c[i - 1]));
  if (rend.length >= 20){
    const m = rend.reduce((a, b) => a + b, 0) / rend.length;
    const varn = rend.reduce((a, b) => a + (b - m) ** 2, 0) / (rend.length - 1);
    const vol = Math.sqrt(varn) * Math.sqrt(252);
    out.volatility = Number.isFinite(vol) ? vol : null;
  }

  let pic = c[0], dd = 0;
  for (const v of c){ if (v > pic) pic = v; const d = (pic - v) / pic; if (d > dd) dd = d; }
  out.maxDrawdown = Number.isFinite(dd) ? dd : null;

  const dernier = c[c.length - 1];
  for (const [cle, seances] of [['perf1M', 21], ['perf3M', 63], ['perf12M', 252]]){
    if (c.length <= seances) continue;
    const base = c[c.length - 1 - seances];
    out[cle] = base > 0 ? (dernier - base) / base : null;
  }
  return out;
}

/* ============================================================
   CALCUL
   ============================================================ */
function noteMetrique(cle, valeur){
  if (valeur === null || valeur === undefined) return null;
  const scale = SCALES[cle]
    || (/^(revenue|eps|fcf)Growth$/.test(cle) ? SCALES.growth : null)
    || (/^perf/.test(cle) ? SCALES.perf : null);
  return scale ? bareme(scale, valeur) : null;
}

function novascore(dossier){
  const f = dossier?.fundamentals || {};
  const market = dossier?.market || {};
  const ohlcv = dossier?.history?.ohlcv || null;

  const { metrics: fond, notes } = metriquesFondamentales(f, market);
  const marche = metriquesMarche(ohlcv);
  const brut = { ...fond, ...marche };

  const families = {};
  let poidsDisponible = 0;      // pour la redistribution du score
  let couverture = 0;           // JAMAIS redistribué

  for (const [cle, conf] of Object.entries(FAMILIES)){
    const notesMetriques = {}, manquantes = [];
    let somme = 0, poidsCouvert = 0;

    /* Chaque métrique pèse ce qu'elle vaut : profitMargin (7) compte plus
       qu'operatingMargin (5). Une moyenne simple traiterait à égalité une
       mesure structurante et un complément. */
    for (const [m, poidsM] of Object.entries(conf.metrics)){
      const n = noteMetrique(m, brut[m]);
      if (n === null){ manquantes.push(m); continue; }
      notesMetriques[m] = n;
      somme += n * poidsM;
      poidsCouvert += poidsM;
    }

    const score = poidsCouvert ? Math.round(somme / poidsCouvert) : null;
    families[cle] = { label: conf.label, score,
      baseWeight: conf.weight,
      // Poids réellement porté par la famille : celui de ses métriques
      // disponibles, pas son poids théorique.
      coverageWeight: poidsCouvert,
      metrics: notesMetriques, missing: manquantes };

    poidsDisponible += poidsCouvert;
    couverture += poidsCouvert;                      // sans redistribution
  }

  const coverage = Math.round(couverture);           // sur 100
  if (coverage < 40){
    return { engine: ENGINE, score: null, coverage, coherence: null,
      confidence: 'insuffisante', refused: 'couverture_insuffisante',
      families, weightsApplied: {}, inputs: brut, notes,
      computedAt: new Date().toISOString() };
  }

  /* Redistribution : le poids appliqué découle du poids RÉELLEMENT couvert,
     jamais du poids théorique. Une famille amputée de la moitié de ses
     métriques ne récupère donc pas son poids entier dans la note. */
  const weightsApplied = {};
  let total = 0;
  for (const [cle, fam] of Object.entries(families)){
    if (fam.score === null) continue;
    const p = fam.coverageWeight / poidsDisponible * POIDS_TOTAL;
    weightsApplied[cle] = Math.round(p * 10) / 10;
    total += fam.score * p;
  }
  const score = Math.round(total / POIDS_TOTAL);

  /* Cohérence : dispersion des familles calculées. Elle ne rapporte aucun
     point — une société médiocre mais régulière reste médiocre. */
  const notesFam = Object.values(families).map(x => x.score).filter(v => v !== null);
  let coherence = null;
  if (notesFam.length >= 3){
    const m = notesFam.reduce((a, b) => a + b, 0) / notesFam.length;
    const ecart = Math.sqrt(notesFam.reduce((a, b) => a + (b - m) ** 2, 0) / notesFam.length);
    coherence = Math.max(0, Math.min(100, Math.round(100 - ecart * 3)));
  }

  /* Confiance : le moins-disant des deux. Une couverture parfaite avec des
     signaux contradictoires n'inspire pas plus confiance que l'inverse. */
  const nivCouv = coverage >= 70 ? 3 : coverage >= 55 ? 2 : 1;
  const nivCoh  = coherence === null ? 1 : coherence >= 64 ? 3 : coherence >= 40 ? 2 : 1;
  const confidence = ['insuffisante', 'limitée', 'correcte', 'élevée'][Math.min(nivCouv, nivCoh)];

  return {
    engine: ENGINE, score, coverage, coherence, confidence,
    comparable: coverage >= 70,
    refused: null,
    families, weightsApplied,
    inputs: brut, notes,
    computedAt: new Date().toISOString(),
  };
}

module.exports = { novascore, FAMILIES, SCALES, ENGINE, croissance, ratio, bareme,
  metriquesMarche, metriquesFondamentales };
