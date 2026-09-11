/**
 * GET /api/market/company?ticker=AAPL&exchange=NASDAQ
 *
 * Dossier financier normalisé assemblé à partir des fournisseurs marché.
 *
 * Aucun chiffre n'est inventé :
 *   - un bloc indisponible vaut null ;
 *   - un historique vide est considéré comme indisponible ;
 *   - aucune série fictive n'est générée.
 *
 * Ordre des fournisseurs :
 *
 *   cotation
 *     Twelve Data → EODHD → Finnhub
 *
 *   fondamentaux
 *     EODHD → Finnhub
 *
 *   historique
 *     EODHD → Twelve Data
 */

const {
  QUOTE,
  FUNDAMENTALS,
  HISTORY,
  cascade,
  KEYS,
} = require('./_providers.js');

const {
  lire,
  ecrire,
} = require('./_cache.js');

/*
 * Nombre maximum de points transmis au frontend.
 *
 * Environ 260 séances = un peu plus d'une année
 * de cotations quotidiennes.
 */
const MAX_HISTORY_POINTS = 260;

/* ============================================================
   VALIDATION
   ============================================================ */

function normaliserTicker(value) {
  const ticker =
    String(value || '')
      .trim()
      .toUpperCase();

  if (!ticker) {
    return null;
  }

  /*
   * Autorise notamment :
   *
   * AAPL
   * BRK.B
   * RDS-A
   * 7203
   *
   * mais interdit &, ?, =, /...
   *
   * Cela évite notamment qu'une URL mal formée produise :
   *
   * AAPL&EXCHANGE=NASDAQ&FRESH=1
   */
  if (
    ticker.length > 30
    || !/^[A-Z0-9._-]+$/.test(ticker)
  ) {
    return null;
  }

  return ticker;
}

function normaliserExchange(value) {
  const exchange =
    String(value || '')
      .trim()
      .toUpperCase();

  if (!exchange) {
    return null;
  }

  if (
    exchange.length > 40
    || !/^[A-Z0-9 ._-]+$/.test(exchange)
  ) {
    return null;
  }

  return exchange;
}

/* ============================================================
   VALIDATION DES BLOCS
   ============================================================ */

function quoteValide(data) {
  if (
    !data
    || typeof data !== 'object'
  ) {
    return false;
  }

  return (
    Number.isFinite(
      Number(data.price)
    )
    && Number(data.price) > 0
  );
}

function fondamentauxValides(data) {
  return Boolean(
    data
    && typeof data === 'object'
    && data.fundamentals
    && typeof data.fundamentals === 'object'
  );
}

function historiqueValide(data) {
  return (
    Array.isArray(data)
    && data.length > 0
  );
}

/* ============================================================
   ROUTE
   ============================================================ */

module.exports = async (
  req,
  res
) => {
  /*
   * Une fiche société contient des données marché susceptibles
   * d'évoluer rapidement. Le cache métier est géré côté serveur
   * par _cache.js, pas par le navigateur.
   */
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

  /* ---------- paramètres ---------- */

  const ticker =
    normaliserTicker(
      req.query?.ticker
    );

  if (!ticker) {
    return res.status(400).json({
      error:
        'ticker_invalide',
    });
  }

  const exchange =
    normaliserExchange(
      req.query?.exchange
    );

  /*
   * fresh=1 conserve pour l'instant le comportement actuel :
   * contourner le cache interne.
   *
   * À terme, il serait préférable de réserver ce mode aux
   * diagnostics internes afin d'éviter qu'un tiers puisse
   * volontairement consommer les quotas fournisseurs.
   */
  const frais =
    req.query?.fresh === '1';

  /* ---------- fournisseurs ---------- */

  const keys =
    KEYS();

  if (
    !keys.eodhd
    && !keys.twelvedata
    && !keys.finnhub
  ) {
    return res.status(503).json({
      error:
        'aucun_fournisseur_configure',
    });
  }

  const journal =
    [];

  /* =========================================================
     CHARGEMENT D'UN BLOC
     ========================================================= */

  const bloc = async (
    nom,
    table,
    ordre,
    args
  ) => {
    /*
     * Réutilisation du cache partagé.
     *
     * quote peut notamment avoir été alimenté auparavant
     * par /api/market/quotes.
     */
    if (!frais) {
      const hit =
        lire(
          nom,
          ticker,
          exchange
        );

      if (hit) {
        /*
         * Ne pas réutiliser un historique vide comme s'il
         * s'agissait d'un vrai historique.
         */
        if (
          nom !== 'history'
          || historiqueValide(hit.valeur)
        ) {
          journal.push({
            bloc:
              nom,

            provider:
              hit.source,

            ok:
              true,

            cache:
              true,
          });

          return {
            data:
              hit.valeur,

            source:
              hit.source,
          };
        }
      }
    }

    const resultat =
      await cascade(
        table,
        ordre,
        args,
        journal,
        nom
      );

    /*
     * On ne met pas un historique vide en cache.
     *
     * Cela permet à une requête ultérieure de retenter
     * un fournisseur plutôt que de rester bloquée sur [].
     */
    const peutEcrire =
      nom === 'history'
        ? historiqueValide(
            resultat.data
          )
        : Boolean(
            resultat.data
          );

    if (peutEcrire) {
      ecrire(
        nom,
        [
          ticker,
          exchange,
        ],
        resultat.data,
        resultat.source
      );
    }

    return resultat;
  };

  /* =========================================================
     APPELS FOURNISSEURS
     ========================================================= */

  const [
    q,
    f,
    h,
  ] =
    await Promise.all([
      bloc(
        'quote',
        QUOTE,
        [
          'twelvedata',
          'eodhd',
          'finnhub',
        ],
        [
          ticker,
          exchange,
        ]
      ),

      bloc(
        'fundamentals',
        FUNDAMENTALS,
        [
          'eodhd',
          'finnhub',
        ],
        [
          ticker,
          exchange,
        ]
      ),

      /*
       * 400 jours calendaires donnent généralement assez
       * de séances pour construire environ un an de graphique.
       *
       * La signature est bien :
       *
       * HISTORY(ticker, exchange, n, key)
       */
      bloc(
        'history',
        HISTORY,
        [
          'eodhd',
          'twelvedata',
        ],
        [
          ticker,
          exchange,
          400,
        ]
      ),
    ]);

  /* =========================================================
     VALIDITÉ RÉELLE DES BLOCS
     ========================================================= */

  const aMarket =
    quoteValide(
      q.data
    );

  const aFundamentals =
    fondamentauxValides(
      f.data
    );

  const aHistory =
    historiqueValide(
      h.data
    );

  /* =========================================================
     IDENTITÉ
     ========================================================= */

  const identity = {
    name:
      f.data?.identity?.name
      || null,

    ticker,

    /*
     * Si le fournisseur donne une place précise,
     * on la conserve. Sinon on garde celle demandée.
     */
    exchange:
      f.data?.identity?.exchange
      || exchange,

    country:
      f.data?.identity?.country
      || null,

    currency:
      f.data?.identity?.currency
      || q.data?.currency
      || null,

    sector:
      f.data?.identity?.sector
      || null,

    industry:
      f.data?.identity?.industry
      || null,
  };

  /* =========================================================
     MARCHÉ
     ========================================================= */

  const market =
    aMarket
      ? {
          price:
            q.data.price,

          change:
            q.data.change
            ?? null,

          changePercent:
            q.data.changePercent
            ?? null,

          previousClose:
            q.data.previousClose
            ?? null,

          open:
            q.data.open
            ?? null,

          high:
            q.data.high
            ?? null,

          low:
            q.data.low
            ?? null,

          volume:
            q.data.volume
            ?? null,

          marketCap:
            f.data?.fundamentals?.marketCap
            ?? null,

          timestamp:
            q.data.timestamp
            ?? null,
        }
      : null;

  /* =========================================================
     HISTORIQUE
     ========================================================= */

  let history =
    null;

  if (aHistory) {
    /*
     * _providers.js normalise maintenant l'historique
     * dans l'ordre ancien → récent.
     *
     * slice(-260) conserve donc les séances les plus récentes.
     */
    const ohlcv =
      h.data.slice(
        -MAX_HISTORY_POINTS
      );

    history = {
      /*
       * Nombre réellement envoyé au navigateur.
       *
       * Avant :
       *
       * points = h.data.length
       * ohlcv  = seulement les 260 derniers
       *
       * Les deux informations pouvaient donc se contredire.
       */
      points:
        ohlcv.length,

      /*
       * Information supplémentaire utile si le fournisseur
       * avait renvoyé davantage de données.
       */
      availablePoints:
        h.data.length,

      ohlcv,
    };
  }

  /* =========================================================
     ÉTAT GLOBAL
     ========================================================= */

  const complete =
    Boolean(
      market
      && aFundamentals
      && history
    );

  const missing =
    [];

  if (!market) {
    missing.push(
      'market'
    );
  }

  if (!aFundamentals) {
    missing.push(
      'fundamentals'
    );
  }

  if (!history) {
    missing.push(
      'history'
    );
  }

  /* =========================================================
     RÉPONSE
     ========================================================= */

  return res.status(200).json({
    identity,

    market,

    fundamentals:
      aFundamentals
        ? f.data.fundamentals
        : null,

    history,

    sources: {
      quote:
        aMarket
          ? q.source
          : null,

      fundamentals:
        aFundamentals
          ? f.source
          : null,

      history:
        aHistory
          ? h.source
          : null,
    },

    asOf: {
      quote:
        aMarket
          ? (
              q.data?.timestamp
              || null
            )
          : null,

      fundamentals:
        aFundamentals
          ? (
              f.data?.asOf
              || null
            )
          : null,
    },

    complete,

    missing,

    /*
     * Diagnostic fournisseurs.
     *
     * Aucun secret ni clé API n'est exposé ici.
     */
    journal,
  });
};

/* Exports utiles pour tests unitaires. */
module.exports.normaliserTicker =
  normaliserTicker;

module.exports.normaliserExchange =
  normaliserExchange;

module.exports.historiqueValide =
  historiqueValide;
