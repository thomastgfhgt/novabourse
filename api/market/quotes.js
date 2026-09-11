/**
 * GET /api/market/quotes?symbols=AAPL@NASDAQ,AIR@PA
 *
 * Cotations réelles en lot.
 *
 * Le navigateur transmet uniquement :
 *
 *   TICKER@PLACE
 *
 * Exemple :
 *
 *   AAPL@NASDAQ
 *   AIR@PA
 *
 * Toute conversion vers les symboles propres aux fournisseurs
 * reste centralisée dans _providers.js.
 *
 * Cascade :
 *
 *   Twelve Data
 *      ↓ reliquat
 *   EODHD
 *      ↓ reliquat
 *   Finnhub
 *
 * Aucun prix n'est estimé.
 * Une cotation absente reste absente et apparaît dans "missing".
 */

const {
  BATCH,
  KEYS,
  idDe,
} = require('./_providers.js');

const {
  lire,
  ecrire,
} = require('./_cache.js');

const ORDRE = [
  'twelvedata',
  'eodhd',
  'finnhub',
];

const MAX_SYMBOLES = 120;

/* ============================================================
   VALIDATION / NORMALISATION
   ============================================================ */

function normaliserSymbole(raw) {
  if (
    typeof raw !== 'string'
  ) {
    return null;
  }

  const valeur =
    raw.trim();

  if (
    !valeur
    || valeur.length > 80
  ) {
    return null;
  }

  /*
   * On accepte exactement :
   *
   * TICKER
   * TICKER@PLACE
   *
   * mais pas :
   *
   * AAPL@NASDAQ@XXX
   */
  const morceaux =
    valeur.split('@');

  if (
    morceaux.length > 2
  ) {
    return null;
  }

  const ticker =
    String(
      morceaux[0]
      || ''
    )
      .trim()
      .toUpperCase();

  const exchange =
    String(
      morceaux[1]
      || ''
    )
      .trim()
      .toUpperCase();

  /*
   * Autorise les formats usuels de ticker :
   *
   * BRK.B
   * RDS-A
   * 7203
   *
   * mais refuse les caractères susceptibles
   * de produire des paramètres aberrants.
   */
  if (
    !ticker
    || ticker.length > 30
    || !/^[A-Z0-9._-]+$/.test(ticker)
  ) {
    return null;
  }

  if (
    exchange
    && (
      exchange.length > 40
      || !/^[A-Z0-9 ._-]+$/.test(exchange)
    )
  ) {
    return null;
  }

  return {
    ticker,
    exchange,
  };
}

function parseSymboles(raw) {
  const valeurs =
    String(
      raw
      || ''
    )
      .split(',');

  /*
   * IMPORTANT :
   *
   * on normalise AVANT de dédupliquer.
   *
   * Ainsi :
   *
   * aapl@nasdaq
   * AAPL@NASDAQ
   *
   * deviennent une seule demande.
   */
  const uniques =
    new Map();

  for (
    const valeur
    of valeurs
  ) {
    const symbole =
      normaliserSymbole(
        valeur
      );

    if (!symbole) {
      continue;
    }

    uniques.set(
      idDe(symbole),
      symbole
    );

    if (
      uniques.size
      >= MAX_SYMBOLES
    ) {
      break;
    }
  }

  return [
    ...uniques.values(),
  ];
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
    'no-store'
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

  /* ---------- symboles ---------- */

  const demandes =
    parseSymboles(
      req.query?.symbols
    );

  if (
    !demandes.length
  ) {
    return res.status(400).json({
      error:
        'symbols_manquant',
    });
  }

  /* ---------- fournisseurs ---------- */

  const keys =
    KEYS();

  if (
    !keys.twelvedata
    && !keys.eodhd
    && !keys.finnhub
  ) {
    return res.status(200).json({
      quotes: [],

      connected:
        false,

      source:
        null,

      sources:
        [],

      partial:
        true,

      missing:
        demandes.map(idDe),

      reason:
        'aucun_fournisseur_configure',

      journal:
        [],
    });
  }

  const journal =
    [];

  /*
   * ID TICKER@PLACE -> cotation.
   */
  const trouve =
    new Map();

  /* =========================================================
     1. CACHE
     ========================================================= */

  const aChercher =
    [];

  const fresh =
    req.query?.fresh === '1';

  if (fresh) {
    aChercher.push(
      ...demandes
    );

  } else {
    for (
      const valeur
      of demandes
    ) {
      const hit =
        lire(
          'quote',
          valeur.ticker,
          valeur.exchange
        );

      if (hit) {
        trouve.set(
          idDe(valeur),
          {
            ...hit.valeur,

            source:
              hit.source,

            cached:
              true,
          }
        );

      } else {
        aChercher.push(
          valeur
        );
      }
    }
  }

  /* =========================================================
     2. CASCADE PAR RELIQUAT
     ========================================================= */

  let reste =
    [
      ...aChercher,
    ];

  for (
    const nom
    of ORDRE
  ) {
    if (
      !reste.length
    ) {
      break;
    }

    if (
      !keys[nom]
    ) {
      journal.push({
        provider:
          nom,

        ok:
          false,

        reason:
          'cle_absente',
      });

      continue;
    }

    const limite =
      Number(
        BATCH.limite?.[nom]
      );

    if (
      !Number.isFinite(limite)
      || limite <= 0
    ) {
      journal.push({
        provider:
          nom,

        ok:
          false,

        reason:
          'limite_invalide',
      });

      continue;
    }

    /*
     * Finnhub n'est volontairement utilisé
     * que pour un petit nombre de symboles :
     * il n'a pas de vrai endpoint batch.
     *
     * Pour Twelve Data et EODHD en revanche,
     * on peut faire plusieurs lots si nécessaire.
     */
    const maxLots =
      nom === 'finnhub'
        ? 1
        : Math.ceil(
            reste.length
            / limite
          );

    let numeroLot =
      0;

    while (
      reste.length
      && numeroLot < maxLots
    ) {
      numeroLot++;

      const lot =
        reste.slice(
          0,
          limite
        );

      if (
        !lot.length
      ) {
        break;
      }

      try {
        const map =
          await BATCH[nom](
            lot,
            keys[nom]
          );

        /*
         * On n'accepte que les identifiants
         * réellement demandés dans ce lot.
         */
        const idsLot =
          new Set(
            lot.map(idDe)
          );

        for (
          const [id, quote]
          of map
        ) {
          if (
            !idsLot.has(id)
          ) {
            continue;
          }

          trouve.set(
            id,
            {
              ...quote,

              source:
                nom,

              cached:
                false,
            }
          );

          ecrire(
            'quote',
            [
              quote.ticker,
              quote.exchange,
            ],
            quote,
            nom
          );
        }

        /*
         * IMPORTANT :
         *
         * seuls les symboles réellement obtenus
         * disparaissent du reliquat.
         *
         * Les autres pourront être testés par
         * le fournisseur suivant.
         */
        const avant =
          reste.length;

        reste =
          reste.filter(
            valeur =>
              !map.has(
                idDe(valeur)
              )
          );

        const obtenus =
          avant
          - reste.length;

        journal.push({
          provider:
            nom,

          lot:
            numeroLot,

          ok:
            true,

          demandes:
            lot.length,

          obtenus,

          restants:
            reste.length,
        });

        /*
         * Si ce fournisseur n'a rien trouvé dans
         * le lot, refaire exactement le même lot
         * provoquerait une boucle inutile.
         *
         * On passe donc au fournisseur suivant.
         */
        if (
          obtenus === 0
        ) {
          break;
        }

        /*
         * Il reste potentiellement des symboles du
         * premier lot que ce fournisseur ne sait
         * pas servir.
         *
         * Pour éviter de rappeler le fournisseur
         * sur ces mêmes symboles, on ne doit pas
         * simplement reprendre reste.slice(0,...).
         *
         * On calcule les symboles encore non testés
         * par ce fournisseur.
         */
        const idsTestes =
          new Set(
            lot.map(idDe)
          );

        const nonTestes =
          reste.filter(
            valeur =>
              !idsTestes.has(
                idDe(valeur)
              )
          );

        /*
         * Si tous les symboles restants faisaient
         * déjà partie du lot courant, ce fournisseur
         * n'a plus rien de nouveau à essayer.
         */
        if (
          !nonTestes.length
        ) {
          break;
        }

        /*
         * Place les symboles jamais testés en tête
         * pour le prochain lot.
         */
        const dejaTestes =
          reste.filter(
            valeur =>
              idsTestes.has(
                idDe(valeur)
              )
          );

        reste = [
          ...nonTestes,
          ...dejaTestes,
        ];

      } catch (error) {
        journal.push({
          provider:
            nom,

          lot:
            numeroLot,

          ok:
            false,

          demandes:
            lot.length,

          reason:
            error.status
              ? `HTTP ${error.status}`
              : error.message,
        });

        /*
         * Si un fournisseur échoue sur le lot,
         * on ne multiplie pas les appels identiques.
         * On laisse le reliquat au fournisseur suivant.
         */
        break;
      }
    }
  }

  /* =========================================================
     3. RÉPONSE
     ========================================================= */

  /*
   * On garde l'ordre demandé par le frontend.
   */
  const ids =
    demandes.map(idDe);

  const quotes =
    ids
      .filter(
        id =>
          trouve.has(id)
      )
      .map(
        id =>
          trouve.get(id)
      );

  const missing =
    ids.filter(
      id =>
        !trouve.has(id)
    );

  const sources =
    [
      ...new Set(
        quotes
          .map(
            quote =>
              quote.source
          )
          .filter(Boolean)
      ),
    ];

  return res.status(200).json({
    quotes,

    /*
     * connected signifie :
     * au moins une vraie cotation a été obtenue.
     */
    connected:
      quotes.length > 0,

    /*
     * source unique seulement si tout ce qui a été
     * obtenu provient du même fournisseur.
     */
    source:
      sources.length === 1
        ? sources[0]
        : null,

    sources,

    partial:
      missing.length > 0,

    /*
     * Ceux-là doivent rester "—" dans l'interface.
     */
    missing,

    journal,
  });
};

/* Utile pour tests unitaires éventuels. */
module.exports.parseSymboles =
  parseSymboles;

module.exports.normaliserSymbole =
  normaliserSymbole;
