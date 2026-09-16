/**
 * api/market/_freshness.js — TAXONOMIE DE FRAÎCHEUR DES DONNÉES
 *
 * Règle absolue du projet : une donnée différée ou de fin de journée ne
 * doit JAMAIS être présentée comme temps réel.
 *
 * Vérifié empiriquement (voir rapport) avant d'écrire ce fichier :
 *   - EODHD documente explicitement que son endpoint /real-time est en
 *     réalité DIFFÉRÉ de 15-20 min pour les actions (~1 min pour le
 *     forex), quel que soit le plan souscrit — jamais du temps réel au
 *     sens strict, sauf leur API WebSocket séparée (non utilisée ici).
 *   - Twelve Data et Finnhub ne documentent aucune garantie de délai
 *     vérifiable de façon générique : cela dépend de l'abonnement
 *     réellement souscrit par NovaBourse, que ce code ne peut pas
 *     connaître.
 *   - CoinGecko (API publique gratuite) ne documente pas de délai garanti
 *     contractuellement pour /coins/markets (rafraîchi en pratique
 *     fréquemment, mais sans SLA) — DELAYED par défaut, comme les autres,
 *     jamais présumé temps réel sans confirmation.
 *
 * Défaut retenu : DELAYED pour toute cotation, quel que soit le
 * fournisseur. C'est le seul choix qui ne risque jamais de sur-estimer la
 * fraîcheur réelle. Une variable d'environnement optionnelle par
 * fournisseur permet de corriger ce défaut UNIQUEMENT si l'abonnement réel
 * est confirmé temps réel — jamais activée par défaut, jamais devinée par
 * ce code.
 */

const FRESHNESS = Object.freeze({
  LIVE: 'LIVE',
  DELAYED: 'DELAYED',
  END_OF_DAY: 'END_OF_DAY',
  HISTORICAL: 'HISTORICAL',
  UNKNOWN: 'UNKNOWN',
  /* Valeur additionnelle, hors des 5 demandées : une fiche catalogue
     (ticker/nom/ISIN, voir api/market/catalog.js) n'est pas une donnée de
     marché avec une fraîcheur LIVE/DELAYED/EOD/HISTORICAL — la forcer dans
     une de ces cases serait moins honnête que d'assumer une 6e valeur
     dédiée à l'identité de référence. */
  REFERENCE: 'REFERENCE',
});

const DEFAUT_COTATION_PAR_PROVIDER = {
  eodhd: FRESHNESS.DELAYED,
  twelvedata: FRESHNESS.DELAYED,
  finnhub: FRESHNESS.DELAYED,
  coingecko: FRESHNESS.DELAYED,
};

const ENV_SURCHARGE_PAR_PROVIDER = {
  eodhd: 'EODHD_QUOTE_FRESHNESS',
  twelvedata: 'TWELVEDATA_QUOTE_FRESHNESS',
  finnhub: 'FINNHUB_QUOTE_FRESHNESS',
  coingecko: 'COINGECKO_QUOTE_FRESHNESS',
};

/**
 * Fraîcheur d'une cotation pour un fournisseur donné.
 * Ne jamais appeler pour de l'historique/des fondamentaux : voir
 * freshnessHistorique()/freshnessFondamentaux() ci-dessous, qui ne
 * dépendent pas du fournisseur.
 */
function freshnessCotation(provider) {
  if (!provider) return null;

  const envVar = ENV_SURCHARGE_PAR_PROVIDER[provider];
  const surcharge = envVar ? process.env[envVar] : null;

  if (
    surcharge
    && Object.prototype.hasOwnProperty.call(FRESHNESS, surcharge)
  ) {
    return FRESHNESS[surcharge];
  }

  return DEFAUT_COTATION_PAR_PROVIDER[provider] || FRESHNESS.UNKNOWN;
}

/* Un historique OHLCV quotidien n'est jamais du temps réel, par nature,
   quel que soit le fournisseur — aucune ambiguïté à trancher ici. */
function freshnessHistorique() {
  return FRESHNESS.HISTORICAL;
}

/* Un bilan/compte de résultat est une donnée périodique déjà publiée
   (trimestre/année écoulés) — jamais une donnée en direct. */
function freshnessFondamentaux() {
  return FRESHNESS.HISTORICAL;
}

/* Un article d'actualité est déjà publié au moment où on le reçoit (son
   propre champ `date` porte l'heure de publication réelle) — jamais une
   donnée en direct au sens LIVE/DELAYED d'une cotation. */
function freshnessActualites() {
  return FRESHNESS.HISTORICAL;
}

const SOURCE_URL_PROVIDER = {
  eodhd: 'https://eodhd.com/',
  twelvedata: 'https://twelvedata.com/',
  finnhub: 'https://finnhub.io/',
  coingecko: 'https://www.coingecko.com/',
};

module.exports = {
  FRESHNESS,
  freshnessCotation,
  freshnessHistorique,
  freshnessFondamentaux,
  freshnessActualites,
  SOURCE_URL_PROVIDER,
};
