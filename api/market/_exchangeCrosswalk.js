/**
 * api/market/_exchangeCrosswalk.js — PLACES DU CATALOGUE -> CODES NOVABOURSE
 *
 * Le dataset free-ticker-database (github.com/adanos-software/free-ticker-database)
 * utilise ses propres codes de place (85 valeurs distinctes constatées :
 * "NASDAQ", "XETRA", "Euronext", "ADX", "SET"...), qui ne correspondent pas
 * toujours aux codes canoniques déjà utilisés par api/market/_providers.js
 * (SUFFIX/TD_EXCHANGE) et api/market/search.js (EXCHANGE_ALIASES) pour
 * construire un symbole fournisseur (EODHD/Twelve Data/Finnhub).
 *
 * Principe strict : AUCUN code n'est deviné. Si la correspondance n'est pas
 * vérifiée, exchangeCode reste null — l'instrument reste identifiable
 * (ticker, nom, ISIN, pays) via le catalogue, mais ne prétend pas pouvoir
 * fournir une cotation en direct tant qu'aucun fournisseur confirmé ne
 * couvre cette place. C'est la même philosophie que MARKET_CATEGORIES dans
 * index.html : une catégorie/place n'apparaît "fonctionnelle" que vérifiée.
 *
 * Vérifié empiriquement (voir rapport) sur les 85 valeurs `exchange` réelles
 * du dataset : seules celles ci-dessous coïncident avec une place que
 * NovaBourse sait déjà interroger. Toutes les autres (TSE, SZSE, HKEX, SSE,
 * BSE_IN, TSX, KRX, B3, SGX, ADX, SET, JSE, TADAWUL...) restent NULL tant
 * qu'aucun provider n'a été testé et confirmé pour elles.
 */

const { SUFFIX } = require('./_providers.js');
const { EXCHANGE_ALIASES } = require('./search.js');

const CODES_CANONIQUES = new Set(Object.keys(SUFFIX));

/* Alias propres au VOCABULAIRE du dataset catalogue, absents de
   EXCHANGE_ALIASES (qui couvre le vocabulaire des réponses live
   EODHD/Twelve Data/Finnhub — un vocabulaire différent). Volontairement
   séparé de search.js : ne pas mélanger deux sources hétérogènes dans une
   même table, pour que chacune reste vérifiable indépendamment. */
const ALIAS_CATALOGUE = {
  STO: 'ST',   // Nasdaq Stockholm
  CPH: 'CO',   // Nasdaq Copenhagen
  HEL: 'HE',   // Nasdaq Helsinki
  OSL: 'OL',   // Oslo Børs (déjà alias direct côté search.js, dupliqué ici par clarté)
  'NYSE ARCA': 'NYSE ARCA',
  /* TSX/ASX : mêmes places réelles que TO/AU (déjà vérifiées empiriquement
     via l'endpoint EODHD /exchange-symbol-list, voir SUFFIX dans
     _providers.js) — le dataset catalogue leur donne juste un nom
     différent ("Toronto Stock Exchange" / "Australian Securities
     Exchange"). Pas une nouvelle place non testée : un simple alias
     manquant, responsable à lui seul de 4262 titres (2010 TSX + 2252 ASX)
     comptés comme "non mappés" alors que le fournisseur les couvre déjà.
     TSXV (TSX Venture) volontairement EXCLU : marché distinct, dont la
     convention de symbole EODHD n'a jamais été vérifiée — resterait NULL. */
  TSX: 'TO',
  ASX: 'AU',
};

/* "Euronext" est un label générique dans ce dataset qui recouvre plusieurs
   places distinctes chez NovaBourse (Paris/Amsterdam/Bruxelles/Lisbonne).
   Seule désambiguïsation fiable disponible dans les colonnes du dataset :
   country_code. Irlande (Euronext Dublin) volontairement absente : aucun
   code NovaBourse ne la couvre aujourd'hui (voir SUFFIX) — reste null. */
const EURONEXT_PAR_PAYS = {
  FR: 'PA',
  NL: 'AS',
  BE: 'BR',
  PT: 'LS',
};

/**
 * @param {string} exchangeRaw - valeur brute de la colonne `exchange` du dataset
 * @param {string} countryCode - valeur brute de la colonne `country_code`
 * @returns {string|null} code canonique NovaBourse, ou null si non vérifié
 */
function exchangeCodeDepuisCatalogue(exchangeRaw, countryCode) {
  const brut = String(exchangeRaw || '').trim();
  if (!brut) return null;

  if (brut.toUpperCase() === 'EURONEXT') {
    const code = EURONEXT_PAR_PAYS[String(countryCode || '').toUpperCase().trim()];
    return code || null;
  }

  const cle = brut.toUpperCase().replace(/\s+/g, ' ');

  if (CODES_CANONIQUES.has(cle)) return cle;

  const aliasCatalogue = ALIAS_CATALOGUE[cle];
  if (aliasCatalogue && CODES_CANONIQUES.has(aliasCatalogue)) return aliasCatalogue;

  const aliasSearch = EXCHANGE_ALIASES[cle];
  if (aliasSearch && CODES_CANONIQUES.has(aliasSearch)) return aliasSearch;

  return null;
}

module.exports = {
  exchangeCodeDepuisCatalogue,
  EURONEXT_PAR_PAYS,
  ALIAS_CATALOGUE,
  CODES_CANONIQUES,
};
