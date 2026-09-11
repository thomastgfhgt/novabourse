/**
 * GET /api/market/search?q=air%20liquide
 *
 * Recherche mondiale d'instruments.
 *
 * Les résultats proviennent uniquement des fournisseurs marché.
 * Aucune société n'est codée en dur.
 *
 * Principes :
 *   - plusieurs fournisseurs peuvent contribuer au même résultat ;
 *   - ticker + place identifient l'instrument ;
 *   - les places sont normalisées vers les codes internes NovaBourse ;
 *   - aucun résultat fictif n'est généré ;
 *   - aucun fournisseur ne peut masquer les suivants simplement parce
 *     qu'il a renvoyé quelques résultats.
 */

const {
  SEARCH,
  KEYS,
} = require('./_providers.js');

const CACHE = new Map();

const TTL = 60 * 60 * 1000; // 1 heure
const MAX_RESULTS = 15;
const MAX_QUERY_LENGTH = 100;

const ORDRE = [
  'eodhd',
  'twelvedata',
  'finnhub',
];

/* ============================================================
   NORMALISATION DES PLACES
   ============================================================ */

/**
 * Code interne unique utilisé ensuite par :
 *
 *   company.js
 *   _providers.js
 *   quotes.js
 *
 * Important :
 * Twelve Data peut par exemple renvoyer "Euronext Paris"
 * tandis qu'EODHD utilise PA.
 */
const EXCHANGE_ALIASES = {
  /* États-Unis */
  NASDAQ: 'NASDAQ',
  'NASDAQ GLOBAL SELECT': 'NASDAQ',
  'NASDAQ GLOBAL MARKET': 'NASDAQ',
  'NASDAQ CAPITAL MARKET': 'NASDAQ',

  NYSE: 'NYSE',
  'NEW YORK STOCK EXCHANGE': 'NYSE',

  'NYSE ARCA': 'NYSE ARCA',
  ARCA: 'NYSE ARCA',

  /* France */
  PA: 'PA',
  PARIS: 'PA',
  'EURONEXT PARIS': 'PA',

  /* Amsterdam */
  AS: 'AS',
  AMSTERDAM: 'AS',
  'EURONEXT AMSTERDAM': 'AS',

  /* Bruxelles */
  BR: 'BR',
  BRUSSELS: 'BR',
  'EURONEXT BRUSSELS': 'BR',

  /* Lisbonne */
  LS: 'LS',
  LISBON: 'LS',
  'EURONEXT LISBON': 'LS',

  /* Allemagne */
  DE: 'DE',
  XETRA: 'DE',
  FRANKFURT: 'DE',

  /* Suisse */
  SW: 'SW',
  SIX: 'SW',
  'SIX SWISS EXCHANGE': 'SW',

  /* Royaume-Uni */
  L: 'L',
  LSE: 'L',
  'LONDON STOCK EXCHANGE': 'L',

  /* Espagne */
  MC: 'MC',
  BME: 'MC',
  MADRID: 'MC',

  /* Italie */
  MI: 'MI',
  MTA: 'MI',
  MILAN: 'MI',
  'BORSA ITALIANA': 'MI',

  /* Nordiques */
  ST: 'ST',
  STOCKHOLM: 'ST',
  OMX: 'ST',
  'NASDAQ STOCKHOLM': 'ST',

  CO: 'CO',
  COPENHAGEN: 'CO',
  OMXC: 'CO',
  'NASDAQ COPENHAGEN': 'CO',

  HE: 'HE',
  HELSINKI: 'HE',
  OMXH: 'HE',
  'NASDAQ HELSINKI': 'HE',

  OL: 'OL',
  OSLO: 'OL',
  OSL: 'OL',
};

function normaliserExchange(value) {
  if (
    value === null
    || value === undefined
  ) {
    return null;
  }

  const brut =
    String(value)
      .trim();

  if (!brut) {
    return null;
  }

  const cle =
    brut
      .toUpperCase()
      .replace(/\s+/g, ' ');

  return (
    EXCHANGE_ALIASES[cle]
    || cle
  );
}

/* ============================================================
   NORMALISATION TEXTE
   ============================================================ */

function propre(value) {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const valueTrimmed =
    value.trim();

  return valueTrimmed
    ? valueTrimmed
    : null;
}

function normaliserTicker(value) {
  const ticker =
    propre(value);

  if (!ticker) {
    return null;
  }

  const out =
    ticker
      .toUpperCase();

  if (
    out.length > 30
    || !/^[A-Z0-9._-]+$/.test(out)
  ) {
    return null;
  }

  return out;
}

/* ============================================================
   TYPES D'INSTRUMENTS
   ============================================================ */

function typeAccepte(type) {
  /*
   * Certains fournisseurs ne donnent aucun type.
   * On ne rejette pas automatiquement ces résultats :
   * le ticker + le nom restent des informations réelles.
   */
  if (!type) {
    return true;
  }

  return (
    /common stock|common share|ordinary share|equity|stock|cs|etf/i
      .test(type)
  );
}

/* ============================================================
   NORMALISATION D'UN RÉSULTAT
   ============================================================ */

function normaliserResultat(
  raw,
  provider
) {
  if (
    !raw
    || typeof raw !== 'object'
  ) {
    return null;
  }

  const ticker =
    normaliserTicker(
      raw.ticker
    );

  const name =
    propre(
      raw.name
    );

  if (
    !ticker
    || !name
  ) {
    return null;
  }

  if (
    !typeAccepte(
      raw.type
    )
  ) {
    return null;
  }

  const exchange =
    normaliserExchange(
      raw.exchange
    );

  return {
    ticker,
    exchange,

    name,

    country:
      propre(
        raw.country
      ),

    currency:
      propre(
        raw.currency
      ),

    type:
      propre(
        raw.type
      ),

    /*
     * L'identifiant repose sur le symbole ET la place.
     *
     * Lorsque la place est inconnue (ex. résultat Finnhub),
     * on conserve simplement le ticker.
     */
    id:
      exchange
        ? `${ticker}@${exchange}`
        : ticker,

    provider,

    providers: [
      provider,
    ],
  };
}

/* ============================================================
   FUSION DE RÉSULTATS
   ============================================================ */

/**
 * Score uniquement destiné à classer les résultats de recherche.
 *
 * CE N'EST PAS UN SCORE FINANCIER.
 *
 * Il favorise :
 *   - correspondance exacte ticker ;
 *   - correspondance exacte nom ;
 *   - nom commençant par la recherche ;
 *   - présence d'une place identifiée.
 */
function pertinence(
  result,
  query
) {
  const q =
    query
      .trim()
      .toLowerCase();

  const ticker =
    String(
      result.ticker
      || ''
    )
      .toLowerCase();

  const name =
    String(
      result.name
      || ''
    )
      .toLowerCase();

  let score = 0;

  if (ticker === q) {
    score += 100;
  }

  if (name === q) {
    score += 90;
  }

  if (
    ticker.startsWith(q)
  ) {
    score += 60;
  }

  if (
    name.startsWith(q)
  ) {
    score += 50;
  }

  if (
    name.includes(q)
  ) {
    score += 30;
  }

  if (
    ticker.includes(q)
  ) {
    score += 20;
  }

  if (
    result.exchange
  ) {
    score += 5;
  }

  return score;
}

/**
 * Fusion sans inventer de données.
 *
 * Si deux fournisseurs renvoient le même ticker@place,
 * on conserve les informations déjà présentes et on complète
 * uniquement les champs absents.
 */
function fusionner(
  existant,
  nouveau
) {
  const providers =
    [
      ...new Set([
        ...(
          existant.providers
          || []
        ),

        ...(
          nouveau.providers
          || []
        ),
      ]),
    ];

  return {
    ...existant,

    name:
      existant.name
      || nouveau.name,

    country:
      existant.country
      || nouveau.country,

    currency:
      existant.currency
      || nouveau.currency,

    type:
      existant.type
      || nouveau.type,

    exchange:
      existant.exchange
      || nouveau.exchange,

    providers,

    /*
     * provider = source principale,
     * providers = toutes les sources ayant confirmé l'instrument.
     */
    provider:
      existant.provider
      || nouveau.provider,
  };
}

/* ============================================================
   ROUTE
   ============================================================ */

module.exports = async (
  req,
  res
) => {
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=600'
  );

  /* ---------- méthode ---------- */

  if (
    req.method !== 'GET'
  ) {
    res.setHeader(
      'Allow',
      'GET'
    );

    return res.status(405).json({
      error:
        'methode_non_autorisee',
    });
  }

  /* ---------- requête ---------- */

  const q =
    String(
      req.query?.q
      || ''
    )
      .trim();

  if (
    q.length < 2
  ) {
    return res.status(400).json({
      error:
        'requete_trop_courte',
    });
  }

  if (
    q.length > MAX_QUERY_LENGTH
  ) {
    return res.status(400).json({
      error:
        'requete_trop_longue',
    });
  }

  /* ---------- fournisseurs ---------- */

  const keys =
    KEYS();

  if (
    !keys.eodhd
    && !keys.twelvedata
    && !keys.finnhub
  ) {
    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    return res.status(503).json({
      error:
        'aucun_fournisseur_configure',
    });
  }

  /* ---------- cache ---------- */

  const cacheKey =
    q
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const hit =
    CACHE.get(
      cacheKey
    );

  if (
    hit
    && (
      Date.now()
      - hit.at
      < TTL
    )
  ) {
    return res.status(200).json({
      ...hit.payload,

      cached:
        true,
    });
  }

  /* =========================================================
     RECHERCHE MULTI-FOURNISSEURS
     ========================================================= */

  const journal =
    [];

  const resultats =
    new Map();

  for (
    const provider
    of ORDRE
  ) {
    if (
      !keys[provider]
    ) {
      journal.push({
        provider,

        ok:
          false,

        reason:
          'cle_absente',
      });

      continue;
    }

    const fonction =
      SEARCH[provider];

    if (
      typeof fonction !== 'function'
    ) {
      continue;
    }

    try {
      const bruts =
        await fonction(
          q,
          keys[provider]
        );

      let acceptes =
        0;

      for (
        const brut
        of (
          Array.isArray(bruts)
            ? bruts
            : []
        )
      ) {
        const resultat =
          normaliserResultat(
            brut,
            provider
          );

        if (!resultat) {
          continue;
        }

        const existant =
          resultats.get(
            resultat.id
          );

        if (existant) {
          resultats.set(
            resultat.id,
            fusionner(
              existant,
              resultat
            )
          );

        } else {
          resultats.set(
            resultat.id,
            resultat
          );
        }

        acceptes++;
      }

      journal.push({
        provider,

        ok:
          true,

        recus:
          Array.isArray(bruts)
            ? bruts.length
            : 0,

        acceptes,
      });

      /*
       * On possède déjà suffisamment de bons candidats.
       *
       * Inutile de brûler systématiquement tous les quotas.
       */
      if (
        resultats.size
        >= MAX_RESULTS * 2
      ) {
        break;
      }

    } catch (error) {
      journal.push({
        provider,

        ok:
          false,

        reason:
          error.status
            ? `HTTP ${error.status}`
            : (
                error.message
                || 'erreur_fournisseur'
              ),
      });
    }
  }

  /* =========================================================
     CLASSEMENT
     ========================================================= */

  const results =
    [
      ...resultats.values(),
    ]
      .map(result => ({
        ...result,

        _pertinence:
          pertinence(
            result,
            q
          ),
      }))
      .sort(
        (a, b) => {
          /*
           * Pertinence d'abord.
           */
          if (
            b._pertinence
            !== a._pertinence
          ) {
            return (
              b._pertinence
              - a._pertinence
            );
          }

          /*
           * En cas d'égalité, une place connue
           * est préférable.
           */
          if (
            Boolean(b.exchange)
            !== Boolean(a.exchange)
          ) {
            return b.exchange
              ? 1
              : -1;
          }

          return (
            a.name
              .localeCompare(
                b.name
              )
          );
        }
      )
      .slice(
        0,
        MAX_RESULTS
      )
      .map(
        ({
          _pertinence,
          ...result
        }) => result
      );

  const sources =
    [
      ...new Set(
        results.flatMap(
          result =>
            result.providers
            || []
        )
      ),
    ];

  const payload = {
    results,

    /*
     * Gardé pour compatibilité :
     * source n'est défini que si tous les résultats
     * proviennent d'une seule source.
     */
    source:
      sources.length === 1
        ? sources[0]
        : null,

    sources,

    partial:
      results.length === 0,

    journal,
  };

  /*
   * On ne met en cache qu'une recherche
   * ayant réellement produit quelque chose.
   */
  if (
    results.length
  ) {
    CACHE.set(
      cacheKey,
      {
        at:
          Date.now(),

        payload,
      }
    );
  }

  return res.status(200).json(
    payload
  );
};

/* Exports utiles pour tests. */
module.exports.normaliserExchange =
  normaliserExchange;

module.exports.normaliserResultat =
  normaliserResultat;

module.exports.pertinence =
  pertinence;
