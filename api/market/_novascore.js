/**
 * api/market/_novascore.js — MOTEUR NOVASCORE
 *
 * Déterministe :
 * mêmes données normalisées + même version du moteur = même note.
 *
 * Aucun appel réseau.
 * Aucun aléatoire.
 * Aucun modèle de langage.
 *
 * Principes :
 *   - une métrique absente est retirée, jamais inventée ;
 *   - un calcul non significatif produit null ;
 *   - les périodes sont triées explicitement ;
 *   - une croissance annuelle n'est calculée qu'entre deux exercices
 *     réellement consécutifs.
 */

const ENGINE = 'nova-1.0.1';

/* ============================================================
   BARÈMES
   ============================================================ */

function bareme(points, v) {
  if (!Number.isFinite(v)) return null;

  const p = points;

  if (v <= p[0][0]) {
    return p[0][1];
  }

  if (v >= p[p.length - 1][0]) {
    return p[p.length - 1][1];
  }

  for (let i = 1; i < p.length; i++) {
    if (v <= p[i][0]) {
      const [x0, y0] = p[i - 1];
      const [x1, y1] = p[i];

      return Math.round(
        y0
        + ((v - x0) / (x1 - x0))
        * (y1 - y0)
      );
    }
  }

  return null;
}

const SCALES = {
  growth: [
    [-0.10, 0],
    [0, 25],
    [0.08, 55],
    [0.15, 75],
    [0.25, 100],
  ],

  profitMargin: [
    [0, 0],
    [0.05, 30],
    [0.12, 60],
    [0.20, 85],
    [0.30, 100],
  ],

  operatingMargin: [
    [0, 0],
    [0.06, 32],
    [0.15, 65],
    [0.25, 90],
    [0.35, 100],
  ],

  roe: [
    [0, 0],
    [0.08, 35],
    [0.15, 65],
    [0.25, 90],
    [0.40, 100],
  ],

  netDebtToCap: [
    [-0.20, 100],
    [0, 92],
    [0.25, 70],
    [0.60, 40],
    [1.00, 10],
    [1.50, 0],
  ],

  cashToDebt: [
    [0, 0],
    [0.25, 35],
    [0.60, 65],
    [1.20, 90],
    [2.50, 100],
  ],

  pe: [
    [6, 100],
    [12, 82],
    [20, 60],
    [30, 35],
    [45, 10],
    [70, 0],
  ],

  forwardPE: [
    [5, 100],
    [11, 84],
    [18, 62],
    [28, 36],
    [42, 10],
    [65, 0],
  ],

  priceToBook: [
    [0.6, 100],
    [1.5, 78],
    [3, 55],
    [6, 25],
    [12, 0],
  ],

  evToEbitda: [
    [4, 100],
    [8, 80],
    [13, 55],
    [20, 25],
    [32, 0],
  ],

  perf: [
    [-0.25, 0],
    [-0.08, 30],
    [0.05, 55],
    [0.20, 82],
    [0.40, 100],
  ],

  volatility: [
    [0.12, 100],
    [0.20, 78],
    [0.30, 52],
    [0.42, 25],
    [0.55, 0],
  ],

  maxDrawdown: [
    [0.08, 100],
    [0.18, 75],
    [0.30, 48],
    [0.45, 20],
    [0.60, 0],
  ],

  debtToCap: [
    [0, 100],
    [0.20, 78],
    [0.45, 50],
    [0.80, 20],
    [1.20, 0],
  ],

  fcfMargin: [
    [-0.05, 0],
    [0.02, 30],
    [0.08, 60],
    [0.15, 85],
    [0.25, 100],
  ],

  fcfPositive: [
    [0, 0],
    [1, 100],
  ],
};

/* ============================================================
   FAMILLES
   ============================================================ */

const FAMILIES = {
  profitability: {
    weight: 17,
    label: 'Rentabilité',
    metrics: {
      profitMargin: 7,
      operatingMargin: 5,
      roe: 5,
    },
  },

  growth: {
    weight: 16,
    label: 'Croissance',
    metrics: {
      revenueGrowth: 7,
      epsGrowth: 5,
      fcfGrowth: 4,
    },
  },

  solidity: {
    weight: 16,
    label: 'Solidité financière',
    metrics: {
      netDebtToCap: 9,
      cashToDebt: 7,
    },
  },

  valuation: {
    weight: 16,
    label: 'Valorisation',
    metrics: {
      pe: 6,
      evToEbitda: 4,
      priceToBook: 3,
      forwardPE: 3,
    },
  },

  quality: {
    weight: 12,
    label: 'Qualité',
    metrics: {
      fcfMargin: 5,
      operatingMargin: 4,
      fcfPositive: 3,
    },
  },

  risk: {
    weight: 12,
    label: 'Risque',
    metrics: {
      volatility: 5,
      maxDrawdown: 4,
      debtToCap: 3,
    },
  },

  momentum: {
    weight: 11,
    label: 'Momentum',
    metrics: {
      perf3M: 4,
      perf12M: 4,
      perf1M: 3,
    },
  },
};

const POIDS_TOTAL =
  Object.values(FAMILIES)
    .reduce(
      (total, famille) =>
        total + famille.weight,
      0
    );

/* ============================================================
   OUTILS MATHÉMATIQUES
   ============================================================ */

const fini = v =>
  (
    typeof v === 'number'
    && Number.isFinite(v)
  )
    ? v
    : null;

function croissance(nMoins1, n) {
  const a = fini(nMoins1);
  const b = fini(n);

  if (a === null || b === null) {
    return {
      value: null,
      reason: 'donnee_absente',
    };
  }

  if (a === 0) {
    return {
      value: null,
      reason: 'base_nulle',
    };
  }

  if (a < 0 && b >= 0) {
    return {
      value: null,
      reason: 'retournement_positif',
      note: 'passage_de_perte_a_profit',
    };
  }

  if (a > 0 && b < 0) {
    return {
      value: null,
      reason: 'retournement_negatif',
      note: 'passage_de_profit_a_perte',
    };
  }

  if (a < 0 && b < 0) {
    return {
      value:
        (
          Math.abs(a)
          - Math.abs(b)
        )
        / Math.abs(a),

      reason: null,
      note: 'perte_reduite',
    };
  }

  return {
    value: (b - a) / a,
    reason: null,
  };
}

function ratio(num, den, opts = {}) {
  const a = fini(num);
  const b = fini(den);

  if (a === null || b === null) {
    return null;
  }

  if (b === 0) {
    return opts.zeroDen === undefined
      ? null
      : opts.zeroDen;
  }

  const r = a / b;

  return Number.isFinite(r)
    ? r
    : null;
}

/* ============================================================
   SÉRIES FONDAMENTALES
   ============================================================ */

/**
 * Normalise une série annuelle.
 *
 * Entrée attendue :
 * [
 *   { date:"2025-12-31", annee:2025, valeur:123 },
 *   ...
 * ]
 *
 * Le moteur ne fait jamais confiance à l'ordre reçu.
 */
function normaliserSerieAnnuelle(serie) {
  if (!Array.isArray(serie)) {
    return [];
  }

  const valides = serie
    .filter(
      x =>
        x
        && typeof x === 'object'
        && Number.isInteger(x.annee)
        && Number.isFinite(x.valeur)
    )
    .map(x => ({
      date:
        typeof x.date === 'string'
          ? x.date
          : null,

      annee:
        x.annee,

      valeur:
        x.valeur,
    }))
    .sort((a, b) => {
      if (b.annee !== a.annee) {
        return b.annee - a.annee;
      }

      /*
       * En cas de doublon d'année,
       * la date la plus récente passe devant.
       */
      return String(b.date || '')
        .localeCompare(
          String(a.date || '')
        );
    });

  /*
   * Une seule observation par exercice.
   */
  const uniques = [];
  const annees = new Set();

  for (const point of valides) {
    if (annees.has(point.annee)) {
      continue;
    }

    annees.add(point.annee);
    uniques.push(point);
  }

  return uniques;
}

/* ============================================================
   MÉTRIQUES FONDAMENTALES
   ============================================================ */

function metriquesFondamentales(
  f = {},
  market = {}
) {
  const out = {};
  const notes = {};

  const cap =
    fini(market.marketCap)
    ?? fini(f.marketCap);

  /* ---------- rentabilité ---------- */

  out.profitMargin =
    fini(f.profitMargin);

  out.operatingMargin =
    fini(f.operatingMargin);

  out.roe =
    fini(f.roe);

  /* ---------- croissance ---------- */

  const series = [
    [
      'revenueGrowth',
      f.revenueSeries,
    ],

    [
      'epsGrowth',
      f.epsSeries,
    ],

    [
      'fcfGrowth',
      f.fcfSeries,
    ],
  ];

  for (const [cle, serieBrute] of series) {
    out[cle] = null;

    const serie =
      normaliserSerieAnnuelle(
        serieBrute
      );

    if (serie.length < 2) {
      if (
        Array.isArray(serieBrute)
        && serieBrute.length > 0
      ) {
        notes[cle] =
          'serie_incomplete';
      }

      continue;
    }

    const recent =
      serie[0];

    const precedent =
      serie[1];

    /*
     * Exemple refusé :
     *
     * 2025
     * 2023
     *
     * Ce n'est pas une croissance annuelle.
     */
    if (
      recent.annee
      - precedent.annee
      !== 1
    ) {
      notes[cle] =
        `exercices_non_consecutifs (${precedent.annee}->${recent.annee})`;

      continue;
    }

    const c =
      croissance(
        precedent.valeur,
        recent.valeur
      );

    out[cle] =
      c.value;

    if (c.reason) {
      notes[cle] =
        c.reason;
    }

    if (c.note) {
      notes[cle] =
        c.note;
    }
  }

  /* ---------- solidité ---------- */

  const dette =
    fini(f.debt);

  const cash =
    fini(f.cash);

  const detteNette =
    dette !== null
    && cash !== null
      ? dette - cash
      : null;

  out.netDebtToCap =
    ratio(
      detteNette,
      cap
    );

  if (
    dette !== null
    && dette === 0
  ) {
    out.cashToDebt = 2.5;

    notes.cashToDebt =
      'dette_nulle';

  } else {
    out.cashToDebt =
      ratio(
        cash,
        dette
      );
  }

  out.debtToCap =
    ratio(
      dette,
      cap
    );

  /* ---------- valorisation ---------- */

  for (
    const cle
    of [
      'pe',
      'forwardPE',
      'evToEbitda',
    ]
  ) {
    const v =
      fini(f[cle]);

    if (v === null) {
      out[cle] = null;
      continue;
    }

    if (v <= 0) {
      out[cle] = null;

      notes[cle] =
        'multiple_negatif';

      continue;
    }

    out[cle] = v;
  }

  const pb =
    fini(f.priceToBook);

  out.priceToBook =
    pb !== null
    && pb > 0
      ? pb
      : null;

  if (
    pb !== null
    && pb <= 0
  ) {
    notes.priceToBook =
      'fonds_propres_negatifs';
  }

  /* ---------- qualité ---------- */

  out.fcfMargin =
    ratio(
      f.freeCashFlow,
      f.revenue
    );

  const fcf =
    fini(f.freeCashFlow);

  out.fcfPositive =
    fcf === null
      ? null
      : (
          fcf > 0
            ? 1
            : 0
        );

  return {
    metrics: out,
    notes,
  };
}

/* ============================================================
   HISTORIQUE DE MARCHÉ
   ============================================================ */

/**
 * Trie, nettoie et déduplique les clôtures.
 *
 * NovaScore ne doit jamais dépendre de l'ordre
 * choisi par le fournisseur.
 */
function normaliserHistorique(ohlcv) {
  if (!Array.isArray(ohlcv)) {
    return [];
  }

  const points = ohlcv
    .map(point => {
      const close =
        fini(
          point?.close
        );

      if (
        close === null
        || close <= 0
      ) {
        return null;
      }

      const dateBrute =
        point?.date
        ?? point?.datetime
        ?? point?.timestamp
        ?? null;

      if (dateBrute === null) {
        return null;
      }

      let timestamp = null;

      if (
        typeof dateBrute === 'number'
        && Number.isFinite(dateBrute)
      ) {
        /*
         * Support secondes Unix
         * ou millisecondes.
         */
        timestamp =
          dateBrute < 1e12
            ? dateBrute * 1000
            : dateBrute;

      } else {
        const parsed =
          new Date(dateBrute)
            .getTime();

        timestamp =
          Number.isFinite(parsed)
            ? parsed
            : null;
      }

      if (
        !Number.isFinite(timestamp)
      ) {
        return null;
      }

      return {
        timestamp,
        close,
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.timestamp
        - b.timestamp
    );

  /*
   * Une clôture par timestamp.
   *
   * Si un fournisseur fournit deux fois
   * la même séance, on garde la dernière
   * observation rencontrée après tri.
   */
  const dedup = new Map();

  for (const point of points) {
    dedup.set(
      point.timestamp,
      point
    );
  }

  return [
    ...dedup.values(),
  ].sort(
    (a, b) =>
      a.timestamp
      - b.timestamp
  );
}

/* ============================================================
   MÉTRIQUES DE MARCHÉ
   ============================================================ */

function metriquesMarche(ohlcv) {
  const out = {
    volatility: null,
    maxDrawdown: null,
    perf1M: null,
    perf3M: null,
    perf12M: null,
  };

  const historique =
    normaliserHistorique(
      ohlcv
    );

  if (
    historique.length < 25
  ) {
    return out;
  }

  const closes =
    historique.map(
      point =>
        point.close
    );

  /* ---------- volatilité ---------- */

  const rendements = [];

  for (
    let i = 1;
    i < closes.length;
    i++
  ) {
    const r =
      Math.log(
        closes[i]
        / closes[i - 1]
      );

    if (
      Number.isFinite(r)
    ) {
      rendements.push(r);
    }
  }

  if (
    rendements.length >= 20
  ) {
    const moyenne =
      rendements.reduce(
        (a, b) => a + b,
        0
      )
      / rendements.length;

    const variance =
      rendements.reduce(
        (a, b) =>
          a
          + (
            b - moyenne
          ) ** 2,
        0
      )
      / (
        rendements.length - 1
      );

    const vol =
      Math.sqrt(variance)
      * Math.sqrt(252);

    out.volatility =
      Number.isFinite(vol)
        ? vol
        : null;
  }

  /* ---------- drawdown ---------- */

  let pic =
    closes[0];

  let maxDrawdown =
    0;

  for (
    const valeur
    of closes
  ) {
    if (
      valeur > pic
    ) {
      pic = valeur;
    }

    const drawdown =
      (
        pic - valeur
      )
      / pic;

    if (
      drawdown > maxDrawdown
    ) {
      maxDrawdown =
        drawdown;
    }
  }

  out.maxDrawdown =
    Number.isFinite(maxDrawdown)
      ? maxDrawdown
      : null;

  /* ---------- momentum ---------- */

  const dernier =
    closes[
      closes.length - 1
    ];

  const periodes = [
    ['perf1M', 21],
    ['perf3M', 63],
    ['perf12M', 252],
  ];

  for (
    const [cle, seances]
    of periodes
  ) {
    if (
      closes.length
      <= seances
    ) {
      continue;
    }

    const base =
      closes[
        closes.length
        - 1
        - seances
      ];

    out[cle] =
      base > 0
        ? (
            dernier
            - base
          )
          / base
        : null;
  }

  return out;
}

/* ============================================================
   NOTE D'UNE MÉTRIQUE
   ============================================================ */

function noteMetrique(
  cle,
  valeur
) {
  if (
    valeur === null
    || valeur === undefined
  ) {
    return null;
  }

  const scale =
    SCALES[cle]

    || (
      /^(revenue|eps|fcf)Growth$/
        .test(cle)
        ? SCALES.growth
        : null
    )

    || (
      /^perf/
        .test(cle)
        ? SCALES.perf
        : null
    );

  return scale
    ? bareme(
        scale,
        valeur
      )
    : null;
}

/* ============================================================
   NOVASCORE
   ============================================================ */

function novascore(dossier) {
  const fundamentals =
    dossier?.fundamentals
    || {};

  const market =
    dossier?.market
    || {};

  const ohlcv =
    dossier?.history?.ohlcv
    || null;

  const {
    metrics: fond,
    notes,
  } =
    metriquesFondamentales(
      fundamentals,
      market
    );

  const marche =
    metriquesMarche(
      ohlcv
    );

  const brut = {
    ...fond,
    ...marche,
  };

  const families = {};

  let poidsDisponible =
    0;

  let couverture =
    0;

  for (
    const [cle, conf]
    of Object.entries(
      FAMILIES
    )
  ) {
    const notesMetriques =
      {};

    const manquantes =
      [];

    let somme =
      0;

    let poidsCouvert =
      0;

    for (
      const [metrique, poidsMetrique]
      of Object.entries(
        conf.metrics
      )
    ) {
      const note =
        noteMetrique(
          metrique,
          brut[metrique]
        );

      if (
        note === null
      ) {
        manquantes.push(
          metrique
        );

        continue;
      }

      notesMetriques[
        metrique
      ] = note;

      somme +=
        note
        * poidsMetrique;

      poidsCouvert +=
        poidsMetrique;
    }

    const score =
      poidsCouvert
        ? Math.round(
            somme
            / poidsCouvert
          )
        : null;

    families[cle] = {
      label:
        conf.label,

      score,

      baseWeight:
        conf.weight,

      coverageWeight:
        poidsCouvert,

      metrics:
        notesMetriques,

      missing:
        manquantes,
    };

    poidsDisponible +=
      poidsCouvert;

    couverture +=
      poidsCouvert;
  }

  const coverage =
    Math.round(
      couverture
    );

  /* ---------- couverture insuffisante ---------- */

  if (
    coverage < 40
  ) {
    return {
      engine:
        ENGINE,

      score:
        null,

      coverage,

      coherence:
        null,

      confidence:
        'insuffisante',

      refused:
        'couverture_insuffisante',

      families,

      weightsApplied:
        {},

      inputs:
        brut,

      notes,

      computedAt:
        new Date()
          .toISOString(),
    };
  }

  /* ---------- redistribution ---------- */

  const weightsApplied =
    {};

  let total =
    0;

  for (
    const [cle, fam]
    of Object.entries(
      families
    )
  ) {
    if (
      fam.score === null
    ) {
      continue;
    }

    const poids =
      (
        fam.coverageWeight
        / poidsDisponible
      )
      * POIDS_TOTAL;

    weightsApplied[
      cle
    ] =
      Math.round(
        poids * 10
      )
      / 10;

    total +=
      fam.score
      * poids;
  }

  const score =
    Math.round(
      total
      / POIDS_TOTAL
    );

  /* ---------- cohérence ---------- */

  const notesFamilles =
    Object.values(
      families
    )
      .map(
        famille =>
          famille.score
      )
      .filter(
        valeur =>
          valeur !== null
      );

  let coherence =
    null;

  if (
    notesFamilles.length >= 3
  ) {
    const moyenne =
      notesFamilles.reduce(
        (a, b) =>
          a + b,
        0
      )
      / notesFamilles.length;

    const ecart =
      Math.sqrt(
        notesFamilles.reduce(
          (totalEcart, note) =>
            totalEcart
            + (
              note - moyenne
            ) ** 2,
          0
        )
        / notesFamilles.length
      );

    coherence =
      Math.max(
        0,
        Math.min(
          100,
          Math.round(
            100
            - ecart * 3
          )
        )
      );
  }

  /* ---------- confiance ---------- */

  const nivCouv =
    coverage >= 70
      ? 3
      : coverage >= 55
        ? 2
        : 1;

  const nivCoh =
    coherence === null
      ? 1
      : coherence >= 64
        ? 3
        : coherence >= 40
          ? 2
          : 1;

  const confidence =
    [
      'insuffisante',
      'limitée',
      'correcte',
      'élevée',
    ][
      Math.min(
        nivCouv,
        nivCoh
      )
    ];

  return {
    engine:
      ENGINE,

    score,

    coverage,

    coherence,

    confidence,

    comparable:
      coverage >= 70,

    refused:
      null,

    families,

    weightsApplied,

    inputs:
      brut,

    notes,

    computedAt:
      new Date()
        .toISOString(),
  };
}

module.exports = {
  novascore,
  FAMILIES,
  SCALES,
  ENGINE,

  croissance,
  ratio,
  bareme,

  normaliserSerieAnnuelle,
  normaliserHistorique,

  metriquesMarche,
  metriquesFondamentales,
};
