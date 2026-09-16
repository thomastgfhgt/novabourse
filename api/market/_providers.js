/**
 * api/market/_providers.js — COUCHE FOURNISSEURS
 *
 * Trois sources, un format unique.
 *
 * Principes :
 *   - donnée absente => null ;
 *   - aucune estimation ;
 *   - chaque bloc conserve sa provenance ;
 *   - un fournisseur qui échoue laisse la place au suivant ;
 *   - les historiques sont normalisés, triés et dédupliqués ;
 *   - aucun ticker étranger ambigu n'est envoyé aveuglément à Finnhub.
 */

const KEYS = () => ({
  eodhd:
    process.env.EODHD_API_KEY
    || null,

  twelvedata:
    process.env.TWELVEDATA_API_KEY
    || null,

  /* CORRECTIF : FINNHUB_API_KEY d'abord (nom non ambigu, dédié à ce seul
     provider). MARKET_API_KEY reste en repli pour compatibilité historique.
     Diagnostic : un 401 "Invalid API key" chez Finnhub alors qu'une clé
     Finnhub valide existe est exactement le symptôme d'une variable
     MARKET_API_KEY définie avec une autre valeur (autre usage, reliquat,
     faute de frappe) qui masquait FINNHUB_API_KEY tant que l'ancien ordre
     (MARKET_API_KEY d'abord) était utilisé.
     À vérifier dans Vercel (noms de variables uniquement, jamais la
     valeur) : FINNHUB_API_KEY existe-t-elle ? MARKET_API_KEY existe-t-elle
     aussi ? Contiennent-elles la même clé ou deux valeurs différentes ? */
  finnhub:
    process.env.FINNHUB_API_KEY
    || process.env.MARKET_API_KEY
    || null,

  /* CoinGecko "Public API" (api.coingecko.com) : aucune clé requise, ne
     nécessite aucun compte. `coingecko: true` est donc une valeur
     SENTINELLE (pas un vrai secret) — cascade()/BATCH ci-dessous
     n'appellent un fournisseur que si keys[nom] est vérité, ce placeholder
     leur permet de traiter CoinGecko exactement comme les fournisseurs à
     clé sans dupliquer leur logique. COINGECKO_DISABLED="1" permet de le
     couper explicitement en production (ex. abus constaté sur son IP
     partagée) sans toucher au code. */
  coingecko:
    process.env.COINGECKO_DISABLED === '1'
      ? null
      : true,

  /* Frankfurter (api.frankfurter.dev, ex api.frankfurter.app) : taux de
     référence BCE, API open-source (MIT), aucune clé requise. Même
     principe de sentinelle que coingecko ci-dessus. FRANKFURTER_DISABLED
     permet de le couper sans toucher au code. */
  frankfurter:
    process.env.FRANKFURTER_DISABLED === '1'
      ? null
      : true,

  /* Eulerpool : clé RÉELLE requise (pas une sentinelle comme coingecko/
     frankfurter ci-dessus — service payant, clé personnelle). Testée en
     direct avant intégration (voir rapport) : équities/ETF/fonds/
     obligations/commodités/crypto/forex/macro, 400+ endpoints. Couverture
     réellement branchée ici volontairement restreinte à ce qui a été
     vérifié champ par champ, jamais au catalogue entier de l'API. */
  eulerpool:
    process.env.EULERPOOL_API_KEY
    || null,
});

/* ============================================================
   NORMALISATION DE BASE
   ============================================================ */

const num = v => {
  if (
    v === null
    || v === undefined
    || v === ''
    || v === 'NA'
    || v === 'None'
  ) {
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n)
    ? n
    : null;
};

const txt = v =>
  (
    typeof v === 'string'
    && v.trim()
  )
    ? v.trim()
    : null;

/**
 * Conversion sûre timestamp Unix -> ISO.
 */
function isoUnix(value) {
  const n = num(value);

  if (n === null) {
    return null;
  }

  const ms =
    n < 1e12
      ? n * 1000
      : n;

  const d =
    new Date(ms);

  return Number.isFinite(d.getTime())
    ? d.toISOString()
    : null;
}

/**
 * URL conservée pour diagnostic mais sans secret.
 */
const urlSansCle = u =>
  String(u)
    .replace(
      /([?&])(api_token|apikey|token)=[^&]*/gi,
      '$1$2=***'
    );

async function getJSON(
  url,
  ms = 9000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      ms
    );

  try {
    const response =
      await fetch(
        url,
        {
          signal:
            controller.signal,

          headers: {
            accept:
              'application/json',
          },
        }
      );

    const body =
      await response.text();

    if (!response.ok) {
      const error =
        new Error(
          `HTTP ${response.status}`
        );

      error.status =
        response.status;

      error.body =
        body.slice(
          0,
          200
        );

      error.url =
        urlSansCle(url);

      throw error;
    }

    try {
      return JSON.parse(body);

    } catch {
      const error =
        new Error(
          'reponse_non_json'
        );

      error.body =
        body.slice(
          0,
          200
        );

      error.url =
        urlSansCle(url);

      throw error;
    }

  } catch (error) {
    if (!error.url) {
      error.url =
        urlSansCle(url);
    }

    throw error;

  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   SYMBOLES / PLACES
   ============================================================ */

const SUFFIX = {
  NASDAQ: 'US',
  NYSE: 'US',
  'NYSE ARCA': 'US',

  US: 'US',

  PA: 'PA',
  AS: 'AS',
  DE: 'XETRA',
  SW: 'SW',
  L: 'LSE',
  MC: 'MC',
  MI: 'MI',
  BR: 'BR',
  LS: 'LS',
  HE: 'HE',
  ST: 'ST',
  CO: 'CO',
  OL: 'OL',
};

const eodhdSymbol = (
  ticker,
  exchange
) => {
  /*
   * Validation explicite plutôt que fabrication silencieuse : si
   * `exchange` est renseigné mais n'est PAS une des places canoniques
   * connues de ce backend (les clés de SUFFIX ci-dessus), le suffixe
   * EODHD construit ci-dessous ("exchange" brut) est très probablement
   * invalide et produira un symbole qui n'existera pas chez EODHD —
   * exactement le type de perte silencieuse ticker/exchange suspectée
   * entre /api/market/search et /api/market/company. On journalise
   * (logs serveur uniquement, jamais exposé au client) sans jamais
   * changer le symbole retourné : aucun exchange aujourd'hui fonctionnel
   * n'est donc affecté par cet ajout.
   */
  if (
    exchange
    && !Object.prototype.hasOwnProperty.call(SUFFIX, exchange)
  ) {
    console.warn(
      `[market] exchange non canonique reçu par eodhdSymbol : "${exchange}" `
      + `(ticker "${ticker}") — vérifier la chaîne search -> ensureRuntimeStock `
      + `-> /api/market/company pour une perte/mutation de exchangeCode.`
    );
  }

  return `${ticker}.${
    SUFFIX[exchange]
    || exchange
    || 'US'
  }`;
};

/* ============================================================
   SYMBOLES EODHD — CRYPTO / FOREX (audit multi-actifs)
   ============================================================
   Root cause confirmée en production (voir rapport) : les cotations
   crypto/forex reposaient à 100% sur Twelve Data, sans repli fonctionnel,
   car eodhdSymbol() ci-dessus construit un symbole "action" (ex.
   "BTC/USD.US") qui n'a aucun sens pour EODHD et échoue toujours (404).
   Résultat : la moindre panne/quota Twelve Data (confirmé : HTTP 429 en
   production au moment de l'audit) rend TOUTE la classe d'actif
   indisponible d'un coup — c'est le vrai bug architectural, pas un
   problème par symbole.

   Conventions ci-dessous vérifiées EMPIRIQUEMENT (pas depuis la seule
   documentation) via l'endpoint réel EODHD avec le token public "demo" :
     GET https://eodhd.com/api/real-time/BTC-USD.CC?api_token=demo
       -> vraies données retournées (close ≈ 76014, etc.)
     GET https://eodhd.com/api/real-time/EURUSD.FOREX?api_token=demo
       -> vraies données retournées (close ≈ 1.1545)
   Le token demo est limité à quelques symboles de démonstration (ALGO-USD.CC
   et ATOM-USD.CC renvoient "Forbidden" avec ce token précis) : ceci ne
   remet pas en cause le FORMAT (confirmé sur BTC/EUR), seulement la
   couverture exacte de la clé de démonstration — à confirmer en production
   avec la vraie clé NovaBourse (voir résultats de test joints au rapport). */

/**
 * "BASE/QUOTE" (ex. "BTC/USD") -> "BASE-QUOTE.CC" (ex. "BTC-USD.CC").
 * Retourne null si le ticker n'a pas exactement cette forme — jamais un
 * symbole partiellement construit à partir d'un ticker inattendu.
 */
function eodhdCryptoSymbol(ticker) {
  const m = /^([A-Z0-9]+)\/([A-Z0-9]+)$/.exec(String(ticker || '').toUpperCase());
  return m ? `${m[1]}-${m[2]}.CC` : null;
}

/**
 * "BASE/QUOTE" (ex. "EUR/USD") -> "BASEQUOTE.FOREX" (ex. "EURUSD.FOREX").
 */
function eodhdForexSymbol(ticker) {
  const m = /^([A-Z0-9]+)\/([A-Z0-9]+)$/.exec(String(ticker || '').toUpperCase());
  return m ? `${m[1]}${m[2]}.FOREX` : null;
}

/**
 * Convention EODHD documentée pour les indices (ex. "GSPC.INDX" pour le
 * S&P 500, "GDAXI.INDX" pour le DAX) — un simple suffixe .INDX sur le code
 * d'indice déjà utilisé par le catalogue NovaBourse (ces codes, comme
 * GDAXI/FCHI/N225/HSI/BSESN, SONT déjà la nomenclature EODHD ; c'est ce qui
 * a motivé leur choix dans le catalogue à l'origine). Non testable avec le
 * token "demo" (403 sur tous les indices essayés, y compris GSPC.INDX —
 * la couverture du token demo, pas le format, voir eodhdCryptoSymbol
 * ci-dessus pour la même distinction). À VÉRIFIER EMPIRIQUEMENT avec la
 * vraie clé de production avant de considérer la couverture confirmée —
 * voir rapport de couverture joint. */
function eodhdIndexSymbol(ticker) {
  const t = String(ticker || '').trim().toUpperCase();
  return /^[A-Z0-9]+$/.test(t) ? `${t}.INDX` : null;
}

/**
 * Point d'entrée UNIQUE pour obtenir un symbole EODHD, quel que soit le
 * type d'instrument. 'commodity' renvoie explicitement null : aucune
 * convention EODHD n'a pu être vérifiée pour ce type (voir rapport) —
 * mieux vaut ne pas appeler EODHD du tout que d'envoyer un symbole non
 * vérifié.
 */
function eodhdSymbolPourType(ticker, exchange, type) {
  if (type === 'crypto') return eodhdCryptoSymbol(ticker);
  if (type === 'forex') return eodhdForexSymbol(ticker);
  if (type === 'index') return eodhdIndexSymbol(ticker);
  if (type === 'commodity') return null;
  return eodhdSymbol(ticker, exchange);
}

/* ============================================================
   COINGECKO — SOURCE CRYPTO GRATUITE SANS CLÉ (audit sources supplémentaires)
   ============================================================
   api.coingecko.com/api/v3 ("Public API") ne nécessite aucune clé ni
   compte. Vérifié empiriquement en direct au moment de l'intégration :
     GET /simple/price?ids=algorand,cosmos&vs_currencies=usd
     GET /coins/markets?vs_currency=usd&ids=algorand,cosmos
     GET /coins/algorand/market_chart?vs_currency=usd&days=30
   -> réponses réelles et exploitables pour les deux instruments qui
   posaient problème en production (ALGO, ATOM). C'est un fournisseur
   RÉEL et INDÉPENDANT des trois payants (EODHD/Twelve Data/Finnhub) : il
   ne dépend d'aucun de leurs quotas, et couvre nativement des centaines
   de cryptomonnaies que ni EODHD ni Twelve Data ne référencent forcément.
   Mise en garde documentée par CoinGecko : ce point d'accès public est
   soumis à une limite de débit partagée, sans garantie de disponibilité
   contractuelle — d'où sa position de PREMIER essai pour crypto (préserve
   le quota payant) mais jamais seul fournisseur exclusif (repli sur
   Twelve Data/EODHD toujours conservé dans la cascade appelante).

   Correspondance ticker NovaBourse -> identifiant CoinGecko : NE JAMAIS
   deviner un id depuis le symbole (ex. "atom" fonctionne mais de nombreux
   symboles CoinGecko sont ambigus - plusieurs pièces partagent le même
   symbole). Seule cette table, vérifiée manuellement contre /coins/list,
   fait foi ; un ticker absent de cette table n'a simplement pas de
   correspondance CoinGecko (comportement identique à exchangeCode manquant
   ailleurs dans ce fichier : jamais une devinette silencieuse). */
const CRYPTO_ID_COINGECKO = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  XRP: 'ripple',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  SOL: 'solana',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  XLM: 'stellar',
  TRX: 'tron',
  ATOM: 'cosmos',
  ETC: 'ethereum-classic',
  XMR: 'monero',
  ALGO: 'algorand',
  VET: 'vechain',
  FIL: 'filecoin',
  BNB: 'binancecoin',
  UNI: 'uniswap',
  AAVE: 'aave',
  NEAR: 'near',
};

/* Devises de règlement acceptées par `vs_currencies`/`vs_currency` que
   CoinGecko documente et que NovaBourse utilise réellement (voir FX dans
   index.html) — liste fermée plutôt qu'un passe-plat de n'importe quelle
   chaîne vers l'URL du fournisseur. */
const COINGECKO_VS_CURRENCIES = new Set(['usd', 'eur', 'gbp', 'chf', 'jpy', 'cad', 'aud']);

/**
 * "BASE/QUOTE" (ex. "ALGO/USD") -> { id: 'algorand', vs: 'usd' }, ou null
 * si la base n'a pas de correspondance vérifiée ou si la devise de cotation
 * n'est pas supportée. Jamais de valeur partiellement construite.
 */
function coingeckoRef(ticker) {
  const m = /^([A-Z0-9]+)\/([A-Z0-9]+)$/.exec(String(ticker || '').toUpperCase());
  if (!m) return null;
  const id = CRYPTO_ID_COINGECKO[m[1]];
  const vs = m[2].toLowerCase();
  if (!id || !COINGECKO_VS_CURRENCIES.has(vs)) return null;
  return { id, vs };
}

/* ============================================================
   FRANKFURTER — FOREX GRATUIT SANS CLÉ (audit sources supplémentaires)
   ============================================================
   api.frankfurter.dev (ex .app) : taux de référence BCE, API open-source
   (MIT), aucune clé requise. Vérifié empiriquement en direct :
     GET /v1/latest?base=EUR&symbols=USD                  -> taux réel
     GET /v1/2026-08-15..2026-09-15?base=EUR&symbols=USD   -> série réelle
     GET /v1/currencies                                     -> 30 devises BCE
   Limite RÉELLE et documentée, pas une supposition : taux de RÉFÉRENCE BCE,
   publiés UNE FOIS PAR JOUR ouvré (~16h CET), jamais intraday, jamais de
   bid/ask/open/high/low/volume — un point de clôture quotidien par devise.
   Couvre 30 devises (dont EUR/USD/GBP/JPY/CHF/AUD/CAD/NZD... — 16 des 18
   paires du catalogue NovaBourse actuel ; absent : CNH, offshore yuan que
   la BCE ne publie pas). Positionné en DERNIER repli (jamais premier,
   contrairement à CoinGecko) : EODHD/Twelve Data restent supérieurs en
   qualité (intraday réel, bid/ask) pour tout ce qu'ils couvrent déjà. */
const FRANKFURTER_CURRENCIES = new Set([
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
  'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
  'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
]);

/**
 * "BASE/QUOTE" (ex. "EUR/USD") -> { base: 'EUR', quote: 'USD' }, ou null si
 * l'une des deux devises n'est pas publiée par la BCE (jamais une paire
 * partiellement construite).
 */
function frankfurterRef(ticker) {
  const m = /^([A-Z]{3})\/([A-Z]{3})$/.exec(String(ticker || '').toUpperCase());
  if (!m) return null;
  if (!FRANKFURTER_CURRENCIES.has(m[1]) || !FRANKFURTER_CURRENCIES.has(m[2])) return null;
  if (m[1] === m[2]) return null;
  return { base: m[1], quote: m[2] };
}

/* Partagée par QUOTE.frankfurter et HISTORY.frankfurter : une série réelle
   de taux quotidiens BCE, ordonnée chronologiquement. `days` est une fenêtre
   CALENDAIRE (pas un nombre de séances) — la BCE ne publie rien le week-end
   ni les jours fériés, la série renvoyée peut donc avoir moins de points que
   `days` ; c'est attendu, jamais comblé. */
async function frankfurterSeries(base, quote, days) {
  const fin = new Date();
  const debut = new Date(Date.now() - Math.max(1, Math.round(days)) * 86400000);
  const iso = d => d.toISOString().slice(0, 10);

  const d = await getJSON(
    `https://api.frankfurter.dev/v1/${iso(debut)}..${iso(fin)}`
    + `?base=${base}&symbols=${quote}`,
    9000
  );

  const rates = d?.rates;
  if (!rates || typeof rates !== 'object') throw new Error('vide');

  return Object.entries(rates)
    .filter(([date, val]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && num(val?.[quote]) !== null)
    .map(([date, val]) => ({ date, rate: num(val[quote]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ============================================================
   EULERPOOL — COMMODITÉS (audit sources supplémentaires, section 11)
   ============================================================
   api.eulerpool.com : clé RÉELLE requise (EULERPOOL_API_KEY, déjà présente
   côté Vercel), testée en direct avant intégration — /equity/profile/AAPL
   répond avec de vraies données (voir rapport). Documentation publique
   fournie PAR Eulerpool pour cet usage (jamais du scraping HTML,
   explicitement interdit par ailleurs sur ce site) :
   https://eulerpool.com/llms-full.txt.

   Couverture VÉRIFIÉE EN DIRECT, pas supposée depuis la doc seule :
     GET /api/1/commodity/list          -> exactement 3 commodités
                                            disponibles : Or (XAU), Argent
                                            (XAG), Pétrole WTI (symbole
                                            interne "CL1"), toutes cotées
                                            en USD.
     GET /api/1/commodity/quotes/XAU    -> 1260 points réels (2021-2026),
                                            {timestamp, price} par point,
                                            triés du plus récent au plus
                                            ancien. Sert À LA FOIS de
                                            "quote" (premier élément) et
                                            d'historique (série complète) —
                                            un seul endpoint pour les deux
                                            usages, jamais besoin de
                                            /commodity/prices (testé aussi :
                                            renvoie [] pour ces mêmes
                                            symboles, vocabulaire différent
                                            et non résolu ici, donc pas
                                            utilisé).
   Aucune autre paire du catalogue commodités NovaBourse (XAU/EUR, XPD/USD,
   HG1, XBR/USD, URALS/USD...) n'a de correspondance Eulerpool vérifiée :
   reste non couverte, jamais devinée. */
const EULERPOOL_COMMODITY_ID = {
  XAU: 'XAU',
  XAG: 'XAG',
  WTI: 'CL1',
};

/**
 * "XAU/USD" -> { id: 'XAU', quote: 'USD' }. Seul USD est vérifié comme
 * devise de cotation chez Eulerpool pour ces 3 commodités (voir
 * /commodity/list, "currency":"USD" sur les trois) — toute autre devise
 * (XAU/EUR, XAU/GBP...) renvoie null plutôt qu'une conversion devinée.
 */
function eulerpoolCommodityRef(ticker) {
  const m = /^([A-Z0-9]+)\/([A-Z]{3})$/.exec(String(ticker || '').toUpperCase());
  if (!m) return null;
  const id = EULERPOOL_COMMODITY_ID[m[1]];
  if (!id || m[2] !== 'USD') return null;
  return { id, quote: 'USD' };
}

/* Partagée par QUOTE.eulerpool et HISTORY.eulerpool (commodités) : un seul
   endpoint sert les deux usages (voir commentaire ci-dessus).
   CORRECTIF (bug de production confirmé) : passer `startdate`/`enddate`
   avec `enddate` fixé à `Date.now()` fait échouer l'appel avec 404
   "Commodity not found" pour XAG/CL1 (jamais pour XAU) — leur flux
   Eulerpool s'arrête visiblement plus tôt que celui de l'Or (constaté :
   leurs derniers points lors du diagnostic initial dataient de plusieurs
   mois), et une fenêtre qui dépasse le dernier point réellement publié
   fait échouer la requête côté Eulerpool plutôt que de renvoyer un tableau
   vide. Plutôt que de deviner une date de fin sûre par symbole (fragile,
   se périmerait différemment pour chaque commodité), l'appel se fait
   TOUJOURS sans filtre de date (comportement confirmé fonctionner pour
   les 3 symboles lors du diagnostic) ; le filtrage sur `jours` — quand il
   a un sens — se fait ici côté serveur NovaBourse, sur les points
   réellement reçus. Retourne les points BRUTS, triés du plus récent au
   plus ancien (ordre déjà observé chez Eulerpool) : à l'appelant de
   décider s'il veut le plus récent tel quel (quote, potentiellement
   périmé mais réel) ou une fenêtre bornée (history). */
async function eulerpoolCommodityQuotesBrutes(id, cle) {
  const d = await getJSON(
    `https://api.eulerpool.com/api/1/commodity/quotes/${encodeURIComponent(id)}`
    + `?token=${encodeURIComponent(cle)}`,
    12000
  );
  if (!Array.isArray(d)) throw new Error('vide');

  return d
    .filter(p => num(p?.timestamp) !== null && num(p?.price) !== null)
    .map(p => ({ date: new Date(num(p.timestamp)).toISOString(), close: num(p.price) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/* Fenêtre des `jours` derniers jours RÉELLEMENT reçus (pas relative à
   `Date.now()` — voir eulerpoolCommodityQuotesBrutes : une commodité dont
   le flux s'est arrêté plusieurs mois avant "aujourd'hui" ne doit pas se
   retrouver avec un historique vide juste parce que la fenêtre est ancrée
   sur la date du jour). Utilisée par HISTORY.eulerpool uniquement —
   QUOTE.eulerpool prend directement points[0] de la série brute. */
function eulerpoolFenetreJours(pointsTries, jours) {
  if (!pointsTries.length) return [];
  const plusRecent = Date.parse(pointsTries[0].date);
  const seuil = plusRecent - Math.max(1, Math.round(jours)) * 86400000;
  return pointsTries.filter(p => Date.parse(p.date) >= seuil);
}

const TD_EXCHANGE = {
  NASDAQ: null,
  NYSE: null,
  'NYSE ARCA': null,
  US: null,

  PA: 'Euronext Paris',
  AS: 'Euronext Amsterdam',
  BR: 'Euronext Brussels',
  LS: 'Euronext Lisbon',

  DE: 'XETRA',
  SW: 'SIX',
  L: 'LSE',

  MC: 'BME',
  MI: 'MTA',

  ST: 'OMX',
  CO: 'OMXC',
  HE: 'OMXH',
  OL: 'OSL',
};

const tdSymbol = (
  ticker,
  exchange
) => {
  if (!exchange) {
    return ticker;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      TD_EXCHANGE,
      exchange
    )
  ) {
    const place =
      TD_EXCHANGE[exchange];

    return place
      ? `${ticker}:${place}`
      : ticker;
  }

  return `${ticker}:${exchange}`;
};

/**
 * Finnhub /quote ne reçoit qu'un symbole.
 *
 * Ne pas l'utiliser aveuglément comme fallback
 * pour SAN.PA, BNP.PA, AIR.PA, etc.
 */
const US_EXCHANGES =
  new Set([
    'NASDAQ',
    'NYSE',
    'NYSE ARCA',
    'US',
  ]);

/* Finnhub /quote n'accepte qu'un ticker brut (ex. "AAPL"), jamais une paire
   "BASE/QUOTE" ni un symbole EODHD-style : structurellement incompatible
   avec crypto/forex/index/commodity dans NovaBourse (leur ticker contient
   un "/" ou n'a pas d'équivalent US direct). Avant cette correction,
   finnhubAutorise('') renvoyait true pour ces quatre types (exchange vide),
   déclenchant un appel Finnhub voué à l'échec à chaque fois. */
const TYPES_INCOMPATIBLES_FINNHUB = new Set(['crypto', 'forex', 'index', 'commodity']);

function finnhubAutorise(exchange, type) {
  if (TYPES_INCOMPATIBLES_FINNHUB.has(type)) return false;
  return (
    !exchange
    || US_EXCHANGES.has(
      String(exchange)
        .toUpperCase()
    )
  );
}

/* ============================================================
   RECHERCHE
   ============================================================ */

const SEARCH = {
  async eodhd(q, key) {
    const d =
      await getJSON(
        `https://eodhd.com/api/search/${encodeURIComponent(q)}`
        + `?api_token=${key}&fmt=json&limit=20`
      );

    return (
      Array.isArray(d)
        ? d
        : []
    ).map(x => ({
      name:
        txt(x.Name),

      ticker:
        txt(x.Code),

      exchange:
        txt(x.Exchange),

      country:
        txt(x.Country),

      currency:
        txt(x.Currency),

      type:
        txt(x.Type),
    }));
  },

  async twelvedata(q, key) {
    const d =
      await getJSON(
        `https://api.twelvedata.com/symbol_search`
        + `?symbol=${encodeURIComponent(q)}`
        + `&outputsize=20`
        + `&apikey=${key}`
      );

    return (
      d?.data
      || []
    ).map(x => ({
      name:
        txt(x.instrument_name),

      ticker:
        txt(x.symbol),

      exchange:
        txt(x.exchange),

      country:
        txt(x.country),

      currency:
        txt(x.currency),

      type:
        txt(x.instrument_type),
    }));
  },

  async finnhub(q, key) {
    const d =
      await getJSON(
        `https://finnhub.io/api/v1/search`
        + `?q=${encodeURIComponent(q)}`
        + `&token=${key}`
      );

    return (
      d?.result
      || []
    ).map(x => ({
      name:
        txt(x.description),

      ticker:
        txt(
          x.displaySymbol
          || x.symbol
        ),

      exchange:
        null,

      country:
        null,

      currency:
        null,

      type:
        txt(x.type),
    }));
  },
};

/* ============================================================
   COTATION
   ============================================================ */

const QUOTE = {
  async twelvedata(
    ticker,
    exchange,
    type,
    key
  ) {
    const d =
      await getJSON(
        `https://api.twelvedata.com/quote`
        + `?symbol=${encodeURIComponent(tdSymbol(ticker, exchange))}`
        + `&apikey=${key}`
      );

    if (
      !d
      || d.status === 'error'
      || num(d.close) === null
    ) {
      throw new Error(
        d?.message
        || 'vide'
      );
    }

    return {
      price:
        num(d.close),

      change:
        num(d.change),

      changePercent:
        num(d.percent_change),

      previousClose:
        num(d.previous_close),

      open:
        num(d.open),

      high:
        num(d.high),

      low:
        num(d.low),

      volume:
        num(d.volume),

      currency:
        txt(d.currency),

      timestamp:
        isoUnix(d.timestamp),
    };
  },

  async eodhd(
    ticker,
    exchange,
    type,
    key
  ) {
    const symbole =
      eodhdSymbolPourType(ticker, exchange, type);

    if (!symbole) {
      throw new Error(
        'type_sans_convention_eodhd'
      );
    }

    const d =
      await getJSON(
        `https://eodhd.com/api/real-time/${encodeURIComponent(symbole)}`
        + `?api_token=${key}&fmt=json`
      );

    if (
      num(d?.close)
      === null
    ) {
      throw new Error(
        'vide'
      );
    }

    return {
      price:
        num(d.close),

      change:
        num(d.change),

      changePercent:
        num(d.change_p),

      previousClose:
        num(d.previousClose),

      open:
        num(d.open),

      high:
        num(d.high),

      low:
        num(d.low),

      volume:
        num(d.volume),

      currency:
        null,

      timestamp:
        isoUnix(d.timestamp),
    };
  },

  async finnhub(
    ticker,
    exchange,
    type,
    key
  ) {
    if (
      !finnhubAutorise(exchange, type)
    ) {
      throw new Error(
        'place_non_supportee_par_finnhub'
      );
    }

    const d =
      await getJSON(
        `https://finnhub.io/api/v1/quote`
        + `?symbol=${encodeURIComponent(ticker)}`
        + `&token=${key}`
      );

    if (
      num(d?.c) === null
      || num(d.c) === 0
    ) {
      throw new Error(
        'vide'
      );
    }

    return {
      price:
        num(d.c),

      change:
        num(d.d),

      changePercent:
        num(d.dp),

      previousClose:
        num(d.pc),

      open:
        num(d.o),

      high:
        num(d.h),

      low:
        num(d.l),

      volume:
        null,

      currency:
        null,

      timestamp:
        isoUnix(d.t),
    };
  },

  /* Un seul appel /coins/markets couvre AUSSI le cas batch (voir BATCH.coingecko
     plus bas) : même endpoint, ids séparés par virgule. Ici ids=1 seul. */
  async coingecko(ticker, exchange, type, key) {
    if (type !== 'crypto') throw new Error('type_non_supporte_par_coingecko');
    const ref = coingeckoRef(ticker);
    if (!ref) throw new Error('ticker_non_reconnu_par_coingecko');

    const d = await getJSON(
      `https://api.coingecko.com/api/v3/coins/markets`
      + `?vs_currency=${ref.vs}&ids=${ref.id}&price_change_percentage=24h`,
      9000
    );

    const ligne = Array.isArray(d) ? d[0] : null;
    if (!ligne || num(ligne.current_price) === null) {
      throw new Error('vide');
    }

    return {
      price: num(ligne.current_price),
      change: num(ligne.price_change_24h),
      changePercent: num(ligne.price_change_percentage_24h),
      /* Dérivé arithmétiquement de deux valeurs réellement reçues
         (current_price - price_change_24h), jamais une estimation :
         c'est la même opération que absChange() applique déjà côté
         frontend à partir de price/changePercent seuls. */
      previousClose: (num(ligne.current_price) !== null && num(ligne.price_change_24h) !== null)
        ? num(ligne.current_price) - num(ligne.price_change_24h)
        : null,
      open: null,
      high: num(ligne.high_24h),
      low: num(ligne.low_24h),
      volume: num(ligne.total_volume),
      currency: ref.vs.toUpperCase(),
      timestamp: txt(ligne.last_updated) ? new Date(ligne.last_updated).toISOString() : null,
    };
  },

  /* Frankfurter n'a pas d'endpoint "cotation instantanée" avec variation —
     seulement des taux quotidiens. On réutilise la série courte (voir
     frankfurterSeries plus bas, partagée avec HISTORY.frankfurter) : prix =
     dernier taux réel connu, previousClose = taux réel du jour ouvré
     précédent, change/changePercent dérivés arithmétiquement des deux —
     jamais un flux temps réel, jamais fabriqué. */
  async frankfurter(ticker, exchange, type, key) {
    if (type !== 'forex') throw new Error('type_non_supporte_par_frankfurter');
    const ref = frankfurterRef(ticker);
    if (!ref) throw new Error('paire_non_reconnue_par_frankfurter');

    const serie = await frankfurterSeries(ref.base, ref.quote, 10);
    if (serie.length < 1) throw new Error('vide');

    const dernier = serie[serie.length - 1];
    const precedent = serie.length >= 2 ? serie[serie.length - 2] : null;
    const change = precedent ? dernier.rate - precedent.rate : null;
    const changePercent = (precedent && precedent.rate) ? (change / precedent.rate) * 100 : null;

    return {
      price: dernier.rate,
      change,
      changePercent,
      previousClose: precedent ? precedent.rate : null,
      open: null,
      high: null,
      low: null,
      volume: null,
      currency: ref.quote,
      timestamp: new Date(`${dernier.date}T16:00:00Z`).toISOString(),
    };
  },

  /* Commodités uniquement (XAU/XAG/WTI, voir eulerpoolCommodityRef) — le
     seul type pour lequel Eulerpool est branché aujourd'hui, cascade
     appelante toujours en dernier repli (voir _router.js : qualité et
     fraîcheur non garanties par contrat, jamais un premier choix devant
     Twelve Data/EODHD). */
  async eulerpool(ticker, exchange, type, key) {
    if (type !== 'commodity') throw new Error('type_non_supporte_par_eulerpool');
    const ref = eulerpoolCommodityRef(ticker);
    if (!ref) throw new Error('commodite_non_reconnue_par_eulerpool');

    /* Toujours les points 0 et 1 de la série (déjà triée du plus récent au
       plus ancien) — le dernier point réel disponible et celui juste
       avant, quelle que soit leur ancienneté par rapport à aujourd'hui
       (voir eulerpoolCommodityQuotesBrutes : jamais de fenêtre ancrée sur
       Date.now() qui ferait échouer XAG/CL1). Un point réel mais ancien
       reste honnête (timestamp réel renvoyé tel quel) — jamais masqué. */
    const tries = await eulerpoolCommodityQuotesBrutes(ref.id, key);
    if (!tries.length) throw new Error('vide');

    const dernier = tries[0];
    const precedent = tries.length >= 2 ? tries[1] : null;
    const change = precedent ? dernier.close - precedent.close : null;
    const changePercent = (precedent && precedent.close) ? (change / precedent.close) * 100 : null;

    return {
      price: dernier.close,
      change,
      changePercent,
      previousClose: precedent ? precedent.close : null,
      open: null,
      high: null,
      low: null,
      volume: null,
      currency: ref.quote,
      timestamp: dernier.date,
    };
  },
};

/* ============================================================
   FONDAMENTAUX
   ============================================================ */

const FUNDAMENTALS = {
  async eodhd(
    ticker,
    exchange,
    key
  ) {
    const d =
      await getJSON(
        `https://eodhd.com/api/fundamentals/${encodeURIComponent(eodhdSymbol(ticker, exchange))}`
        + `?api_token=${key}&fmt=json`,
        12000
      );

    const general =
      d?.General
      || {};

    const highlights =
      d?.Highlights
      || {};

    const valuation =
      d?.Valuation
      || {};

    const analystRatingsBrut =
      d?.AnalystRatings
      || {};

    /**
     * Dernière période par date réelle.
     */
    const plusRecent = (
      bloc,
      frequence
    ) => {
      const src =
        d?.Financials
          ?.[bloc]
          ?.[frequence];

      if (
        !src
        || typeof src !== 'object'
      ) {
        return {};
      }

      const dates =
        Object.keys(src)
          .filter(
            date =>
              /^\d{4}-\d{2}-\d{2}$/
                .test(date)
              && Number.isFinite(
                Date.parse(date)
              )
          )
          .sort(
            (a, b) =>
              b.localeCompare(a)
          );

      return dates.length
        ? (
            src[dates[0]]
            || {}
          )
        : {};
    };

    const balanceSheet =
      plusRecent(
        'Balance_Sheet',
        'quarterly'
      );

    const cashFlow =
      plusRecent(
        'Cash_Flow',
        'quarterly'
      );

    const incomeYearly =
      plusRecent(
        'Income_Statement',
        'yearly'
      );

    const incomeQuarterly =
      plusRecent(
        'Income_Statement',
        'quarterly'
      );

    const netIncome =
      num(
        incomeYearly.netIncome
      )
      ?? num(
        incomeQuarterly.netIncome
      )
      ?? null;

    const revenue =
      num(
        highlights.RevenueTTM
      )
      ?? num(
        incomeYearly.totalRevenue
      )
      ?? null;

    /**
     * Conserve date + année + valeur.
     *
     * Les lignes avec valeur absente restent dans la série :
     * le moteur NovaScore pourra constater qu'un exercice
     * manque au lieu de fabriquer une croissance N/N-2.
     */
    const periodes = (
      bloc,
      champ
    ) => {
      const src =
        d?.Financials
          ?.[bloc]
          ?.yearly;

      if (
        !src
        || typeof src !== 'object'
      ) {
        return null;
      }

      const lignes =
        Object.entries(src)
          .filter(
            ([date]) =>
              /^\d{4}-\d{2}-\d{2}$/
                .test(date)
              && Number.isFinite(
                Date.parse(date)
              )
          )
          .sort(
            (a, b) =>
              b[0].localeCompare(
                a[0]
              )
          )
          .map(
            ([date, valeur]) => ({
              date,

              annee:
                Number(
                  date.slice(
                    0,
                    4
                  )
                ),

              valeur:
                num(
                  valeur?.[champ]
                ),
            })
          );

      return lignes.length
        ? lignes.slice(
            0,
            5
          )
        : null;
    };

    const revenueSeries =
      periodes(
        'Income_Statement',
        'totalRevenue'
      );

    const epsDiluee =
      periodes(
        'Income_Statement',
        'earningsPerShareDiluted'
      );

    const epsBasic =
      periodes(
        'Income_Statement',
        'earningsPerShareBasic'
      );

    /**
     * Choisit la série contenant réellement
     * le plus de valeurs exploitables.
     */
    const nbValeurs =
      serie =>
        Array.isArray(serie)
          ? serie.filter(
              point =>
                num(point?.valeur)
                !== null
            ).length
          : 0;

    const epsSeries =
      nbValeurs(epsDiluee)
        >= nbValeurs(epsBasic)
        ? epsDiluee
        : epsBasic;

    const fcfSeries =
      periodes(
        'Cash_Flow',
        'freeCashFlow'
      );

    if (
      !Object.keys(highlights).length
      && !Object.keys(general).length
    ) {
      throw new Error(
        'vide'
      );
    }

    return {
      identity: {
        name:
          txt(general.Name),

        exchange:
          txt(general.Exchange),

        country:
          txt(
            general.CountryName
          ),

        currency:
          txt(
            general.CurrencyCode
          ),

        sector:
          txt(general.Sector),

        industry:
          txt(general.Industry),

        /* Déjà inclus dans la réponse fondamentaux EODHD — aucun appel
           ni coût supplémentaire. FIGI/MIC non fournis par ce plan :
           restent null plutôt que devinés. */
        isin:
          txt(general.ISIN),
      },

      fundamentals: {
        revenue,

        netIncome,

        revenueSeries,

        epsSeries,

        fcfSeries,

        eps:
          num(
            highlights.EarningsShare
          ),

        profitMargin:
          num(
            highlights.ProfitMargin
          ),

        operatingMargin:
          num(
            highlights.OperatingMarginTTM
          ),

        roe:
          num(
            highlights.ReturnOnEquityTTM
          ),

        debt:
          num(
            balanceSheet
              .shortLongTermDebtTotal
          ),

        cash:
          num(
            balanceSheet.cash
          ),

        freeCashFlow:
          num(
            cashFlow.freeCashFlow
          ),

        pe:
          num(
            highlights.PERatio
          ),

        forwardPE:
          num(
            valuation.ForwardPE
          ),

        priceToBook:
          num(
            valuation.PriceBookMRQ
          ),

        evToEbitda:
          num(
            valuation
              .EnterpriseValueEbitda
          ),

        dividendYield:
          num(
            highlights.DividendYield
          ),

        marketCap:
          num(
            highlights
              .MarketCapitalization
          ),

        /* Analystes (section "Voir les analystes") : déjà présent dans la
           même réponse EODHD /fundamentals déjà appelée pour "Voir les
           chiffres" — aucun appel réseau supplémentaire. null si le bloc
           AnalystRatings est absent (jamais une note inventée). */
        analystRatings:
          Object.keys(analystRatingsBrut).length
            ? {
                rating: num(analystRatingsBrut.Rating),
                targetPrice: num(analystRatingsBrut.TargetPrice),
                strongBuy: num(analystRatingsBrut.StrongBuy),
                buy: num(analystRatingsBrut.Buy),
                hold: num(analystRatingsBrut.Hold),
                sell: num(analystRatingsBrut.Sell),
                strongSell: num(analystRatingsBrut.StrongSell),
              }
            : null,

        /* Consensus de prix cible "Wall Street" (Highlights, distinct de
           AnalystRatings.TargetPrice ci-dessus — EODHD documente les deux
           comme des sources/méthodologies différentes ; on renvoie les deux
           tels quels plutôt que d'en choisir un arbitrairement). */
        wallStreetTargetPrice:
          num(highlights.WallStreetTargetPrice),

        epsEstimateCurrentYear:
          num(highlights.EPSEstimateCurrentYear),
        epsEstimateNextYear:
          num(highlights.EPSEstimateNextYear),
        epsEstimateCurrentQuarter:
          num(highlights.EPSEstimateCurrentQuarter),
        epsEstimateNextQuarter:
          num(highlights.EPSEstimateNextQuarter),
      },

      asOf:
        txt(
          general.UpdatedAt
        ),
    };
  },

  async finnhub(
    ticker,
    exchange,
    key
  ) {
    if (
      !finnhubAutorise(exchange)
    ) {
      throw new Error(
        'place_non_supportee_par_finnhub'
      );
    }

    const d =
      await getJSON(
        `https://finnhub.io/api/v1/stock/metric`
        + `?symbol=${encodeURIComponent(ticker)}`
        + `&metric=all`
        + `&token=${key}`
      );

    const metric =
      d?.metric;

    if (!metric) {
      throw new Error(
        'vide'
      );
    }

    return {
      identity: {},

      fundamentals: {
        revenue:
          null,

        revenuePerShare:
          num(
            metric.revenuePerShareTTM
          ),

        revenueSeries:
          null,

        epsSeries:
          null,

        fcfSeries:
          null,

        netIncome:
          null,

        eps:
          num(
            metric.epsTTM
          ),

        profitMargin:
          num(
            metric.netProfitMarginTTM
          ) !== null
            ? num(
                metric.netProfitMarginTTM
              ) / 100
            : null,

        operatingMargin:
          num(
            metric.operatingMarginTTM
          ) !== null
            ? num(
                metric.operatingMarginTTM
              ) / 100
            : null,

        roe:
          num(
            metric.roeTTM
          ) !== null
            ? num(
                metric.roeTTM
              ) / 100
            : null,

        debt:
          null,

        cash:
          null,

        freeCashFlow:
          null,

        pe:
          num(
            metric.peTTM
          ),

        forwardPE:
          null,

        priceToBook:
          num(
            metric.pbAnnual
          ),

        evToEbitda:
          num(
            metric.evToEbitdaTTM
          ),

        dividendYield:
          num(
            metric
              .dividendYieldIndicatedAnnual
          ),

        marketCap:
          num(
            metric
              .marketCapitalization
          ),

        /* Finnhub /stock/metric ne fournit aucun consensus analyste sous
           cette forme (ce serait un endpoint distinct, non branché ici) —
           null plutôt que deviné, cohérent avec revenueSeries/epsSeries
           déjà null pour ce même fournisseur un peu plus haut. */
        analystRatings: null,
        wallStreetTargetPrice: null,
        epsEstimateCurrentYear: null,
        epsEstimateNextYear: null,
        epsEstimateCurrentQuarter: null,
        epsEstimateNextQuarter: null,
      },

      asOf:
        null,
    };
  },
};

/* ============================================================
   ACTUALITÉS (bouton "Voir les actualités")
   ============================================================
   Vérifié empiriquement en direct (token public "demo") avant intégration :
     GET https://eodhd.com/api/news?s=AAPL.US&limit=3&api_token=demo
   -> articles réels (titre, contenu, lien, symboles liés, tags, sentiment).
   Un seul fournisseur pour l'instant (EODHD) : Finnhub propose aussi un
   /company-news mais nécessite une vraie clé pour être vérifié (le token
   demo EODHD suffisait à confirmer le format ci-dessus, pas Finnhub) — reste
   documenté comme extension possible plutôt qu'ajouté sans vérification
   empirique, conformément au principe de ce fichier. */
const NEWS = {
  async eodhd(ticker, exchange, limit, type, key) {
    if (type !== 'stock' && type !== 'etf') {
      throw new Error('type_sans_actualites');
    }

    const symbole = eodhdSymbol(ticker, exchange);
    const d = await getJSON(
      `https://eodhd.com/api/news`
      + `?s=${encodeURIComponent(symbole)}`
      + `&limit=${Math.max(1, Math.min(50, Math.round(limit) || 10))}`
      + `&api_token=${key}&fmt=json`,
      12000
    );

    if (!Array.isArray(d)) throw new Error(`format_inattendu:${typeof d}`);

    const articles = d
      .map(a => ({
        date: txt(a.date),
        title: txt(a.title),
        link: txt(a.link),
        /* content tronqué : un résumé suffit à l'affichage en liste, évite
           de faire transiter des dizaines de Ko de texte intégral par
           article vers le frontend pour rien. */
        summary: txt(a.content) ? String(a.content).slice(0, 400) : null,
        symbols: Array.isArray(a.symbols) ? a.symbols.filter(s => typeof s === 'string') : [],
        tags: Array.isArray(a.tags) ? a.tags.filter(t => typeof t === 'string') : [],
        sentiment: (a.sentiment && Number.isFinite(num(a.sentiment.polarity)))
          ? num(a.sentiment.polarity) : null,
      }))
      .filter(a => a.date && a.title && a.link);

    if (!articles.length) throw new Error('aucune_ligne_exploitable');
    return articles;
  },
};

/* ============================================================
   NORMALISATION HISTORIQUE
   ============================================================ */

/**
 * Point essentiel pour les graphiques.
 *
 * Quel que soit le fournisseur :
 *
 *     ancien -> récent
 *
 * Pas de doublon de date.
 * Pas de séance sans clôture.
 */
function normaliserHistorique(
  lignes
) {
  if (
    !Array.isArray(lignes)
  ) {
    return [];
  }

  const map =
    new Map();

  for (
    const ligne
    of lignes
  ) {
    const date =
      txt(
        ligne?.date
      );

    const close =
      num(
        ligne?.close
      );

    if (
      !date
      || close === null
      || close <= 0
    ) {
      continue;
    }

    const timestamp =
      Date.parse(date);

    if (
      !Number.isFinite(timestamp)
    ) {
      continue;
    }

    const cle =
      new Date(timestamp)
        .toISOString()
        .slice(
          0,
          10
        );

    map.set(
      cle,
      {
        date: cle,

        open:
          num(
            ligne.open
          ),

        high:
          num(
            ligne.high
          ),

        low:
          num(
            ligne.low
          ),

        close,

        volume:
          num(
            ligne.volume
          ),
      }
    );
  }

  return [
    ...map.values(),
  ].sort(
    (a, b) =>
      a.date.localeCompare(
        b.date
      )
  );
}

/* ============================================================
   NORMALISATION INTRADAY
   ============================================================
   Contrairement à normaliserHistorique() (une ligne par JOUR,
   volontairement conçue pour le quotidien), l'intraday a besoin d'une
   ligne par HORODATAGE exact — dédoublonnage par timestamp complet,
   jamais par date seule, sinon deux barres de la même séance
   s'écraseraient l'une l'autre. */
function normaliserIntraday(lignes) {
  if (!Array.isArray(lignes)) return [];

  const map = new Map();

  for (const ligne of lignes) {
    const brut = txt(ligne?.date);
    if (!brut) continue;

    const timestamp = Date.parse(brut);
    if (!Number.isFinite(timestamp)) continue;

    const close = num(ligne?.close);
    if (close === null || close <= 0) continue;

    map.set(timestamp, {
      date: new Date(timestamp).toISOString(),
      open: num(ligne?.open),
      high: num(ligne?.high),
      low: num(ligne?.low),
      close,
      volume: num(ligne?.volume),
    });
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Ré-agrège des barres RÉELLEMENT reçues vers une granularité plus
 * grossière (ex : des barres natives 1 minute vers des barres 15
 * minutes). Ce n'est PAS de la fabrication de donnée : chaque barre en
 * sortie est construite exclusivement à partir de barres réellement
 * reçues qui tombent dans le même intervalle de temps (open = première
 * barre du seau, close = dernière, high/low = extrêmes réels, volume =
 * somme réelle). Une pratique standard de tout moteur de graphique
 * financier. N'invente jamais un seau vide : un seau sans aucune barre
 * source n'apparaît simplement pas en sortie.
 */
function resampleOHLC(bars, minutesParBarre) {
  if (!Array.isArray(bars) || !bars.length || !minutesParBarre) {
    return bars || [];
  }

  const tailleMs = minutesParBarre * 60000;
  const groupes = new Map();

  for (const b of bars) {
    const t = Date.parse(b.date);
    if (!Number.isFinite(t)) continue;

    const cle = Math.floor(t / tailleMs) * tailleMs;
    const existant = groupes.get(cle);

    if (!existant) {
      groupes.set(cle, {
        date: new Date(cle).toISOString(),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: num(b.volume) || 0,
      });
    } else {
      if (b.high != null && (existant.high == null || b.high > existant.high)) existant.high = b.high;
      if (b.low != null && (existant.low == null || b.low < existant.low)) existant.low = b.low;
      existant.close = b.close;
      existant.volume = (existant.volume || 0) + (num(b.volume) || 0);
    }
  }

  return [...groupes.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/* Intervalles intraday supportés par ce backend (clé partagée par
   INTRADAY ci-dessous et par la validation du paramètre `interval` côté
   endpoint history.js) et leur durée en minutes. */
const INTRADAY_MINUTES = {
  '1min': 1,
  '5min': 5,
  '15min': 15,
  '30min': 30,
  '1h': 60,
};

const INTRADAY_INTERVALS = Object.keys(INTRADAY_MINUTES);

function joursHistorique(n) {
  const valeur =
    Math.trunc(
      Number(n)
    );

  if (
    !Number.isFinite(valeur)
  ) {
    return 400;
  }

  return Math.max(
    30,
    Math.min(
      valeur,
      5000
    )
  );
}

/* Limite RÉELLE et documentée par CoinGecko elle-même (confirmée en
   production, pas supposée — voir corps de l'erreur reçue) : "Public API
   users are limited to querying historical data within the past 365 days"
   (HTTP 401, error_code 10012). Exportée pour que history.js puisse
   décider, PAR PÉRIODE, si CoinGecko a une chance réelle de répondre avant
   même de l'inclure dans la cascade (voir ordreHistoriquePourType) — pour
   une période longue (2A/5A/10A/MAX), l'inclure serait un appel voué à
   l'échec à coup sûr, mieux vaut aller directement à EODHD/Twelve Data.
   Le chemin PAR DÉFAUT (n=400, non paramétré par période) reste, lui,
   plafonné PROPREMENT à 365 ci-dessous plutôt que rejeté : son propre
   contrat ne garde de toute façon que les 260 derniers points
   (MAX_HISTORY_POINTS, voir history.js/company.js), 365 jours réels de
   CoinGecko les couvre intégralement — ce n'est pas une troncature
   silencieuse d'une période explicitement choisie par l'utilisateur,
   c'est le fonctionnement déjà documenté de ce chemin précis. */
const COINGECKO_JOURS_MAX = 365;

/* Partagé par HISTORY.coingecko (quotidien) et INTRADAY.coingecko
   (infra-journalier) : même endpoint /market_chart, seule la valeur de
   `days` change la granularité RÉELLE renvoyée par CoinGecko (automatique,
   non paramétrable sur l'API publique gratuite — vérifié empiriquement :
   days<=1 -> ~5 min, 2-90 -> ~1 h, >90 -> quotidien). Aucun OHLC construit :
   uniquement un point prix (open=high=low=close=price) par horodatage
   RÉEL, jamais de barre inventée. */
async function coingeckoMarketChart(id, vs, days) {
  const d = await getJSON(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart`
    + `?vs_currency=${vs}&days=${Math.max(1, Math.min(Math.round(days), COINGECKO_JOURS_MAX))}`,
    12000
  );

  const prix = Array.isArray(d?.prices) ? d.prices : [];
  const volumes = new Map((Array.isArray(d?.total_volumes) ? d.total_volumes : [])
    .map(([t, v]) => [t, v]));

  if (!prix.length) throw new Error('vide');

  return prix.map(([t, price]) => ({
    date: new Date(t).toISOString(),
    open: null,
    high: null,
    low: null,
    close: num(price),
    volume: num(volumes.get(t)),
  }));
}

/* ============================================================
   HISTORIQUE OHLCV
   ============================================================ */

const HISTORY = {
  async eodhd(
    ticker,
    exchange,
    n,
    type,
    key
  ) {
    const jours =
      joursHistorique(n);

    const from =
      new Date(
        Date.now()
        - jours * 86400000
      )
        .toISOString()
        .slice(
          0,
          10
        );

    const symbole =
      eodhdSymbolPourType(
        ticker,
        exchange,
        type
      );

    if (!symbole) {
      throw new Error(
        'type_sans_convention_eodhd'
      );
    }

    const url =
      `https://eodhd.com/api/eod/${encodeURIComponent(symbole)}`
      + `?api_token=${key}`
      + `&fmt=json`
      + `&period=d`
      + `&from=${from}`;

    const d =
      await getJSON(
        url,
        12000
      );

    if (
      !Array.isArray(d)
    ) {
      const error =
        new Error(
          `format_inattendu:${typeof d}`
        );

      error.url =
        urlSansCle(url);

      error.symbole =
        symbole;

      error.body =
        JSON.stringify(d)
          .slice(
            0,
            200
          );

      throw error;
    }

    const recues =
      d.length;

    const brutes =
      d.map(
        ligne => ({
          date:
            txt(
              ligne.date
            ),

          open:
            num(
              ligne.open
            ),

          high:
            num(
              ligne.high
            ),

          low:
            num(
              ligne.low
            ),

          /*
           * Pour le graphique longue durée,
           * adjusted_close évite les ruptures artificielles
           * liées notamment aux splits.
           */
          close:
            num(
              ligne.adjusted_close
              ?? ligne.close
            ),

          volume:
            num(
              ligne.volume
            ),
        })
      );

    const lignes =
      normaliserHistorique(
        brutes
      );

    if (
      !lignes.length
    ) {
      const error =
        new Error(
          recues
            ? `zero_ligne_apres_normalisation (recues:${recues}, champs:${Object.keys(d[0] || {}).join('|')})`
            : 'aucune_ligne_recue'
        );

      error.url =
        urlSansCle(url);

      error.symbole =
        symbole;

      error.recues =
        recues;

      throw error;
    }

    lignes.recues =
      recues;

    return lignes;
  },

  async twelvedata(
    ticker,
    exchange,
    n,
    type,
    key
  ) {
    const jours =
      joursHistorique(n);

    const d =
      await getJSON(
        `https://api.twelvedata.com/time_series`
        + `?symbol=${encodeURIComponent(tdSymbol(ticker, exchange))}`
        + `&interval=1day`
        + `&outputsize=${Math.min(jours, 5000)}`
        + `&apikey=${key}`,
        12000
      );

    if (
      !d?.values?.length
    ) {
      throw new Error(
        d?.message
        || 'vide'
      );
    }

    const recues =
      d.values.length;

    const lignes =
      normaliserHistorique(
        d.values.map(
          ligne => ({
            date:
              txt(
                ligne.datetime
              ),

            open:
              num(
                ligne.open
              ),

            high:
              num(
                ligne.high
              ),

            low:
              num(
                ligne.low
              ),

            close:
              num(
                ligne.close
              ),

            volume:
              num(
                ligne.volume
              ),
          })
        )
      );

    if (
      !lignes.length
    ) {
      throw new Error(
        'zero_ligne_apres_normalisation'
      );
    }

    lignes.recues =
      recues;

    return lignes;
  },

  async coingecko(ticker, exchange, n, type, key) {
    if (type !== 'crypto') throw new Error('type_non_supporte_par_coingecko');
    const ref = coingeckoRef(ticker);
    if (!ref) throw new Error('ticker_non_reconnu_par_coingecko');

    const jours = joursHistorique(n);
    const brutes = await coingeckoMarketChart(ref.id, ref.vs, jours);
    const recues = brutes.length;

    /* normaliserHistorique() dédoublonne par JOUR en gardant le dernier
       point écrit pour cette date — les points CoinGecko étant déjà
       chronologiques, cela retient naturellement le dernier prix connu de
       chaque journée (une clôture réelle, pas approximée). */
    const lignes = normaliserHistorique(brutes);
    if (!lignes.length) throw new Error(recues ? 'zero_ligne_apres_normalisation' : 'aucune_ligne_recue');

    lignes.recues = recues;
    return lignes;
  },

  async frankfurter(ticker, exchange, n, type, key) {
    if (type !== 'forex') throw new Error('type_non_supporte_par_frankfurter');
    const ref = frankfurterRef(ticker);
    if (!ref) throw new Error('paire_non_reconnue_par_frankfurter');

    const jours = joursHistorique(n);
    const serie = await frankfurterSeries(ref.base, ref.quote, jours);
    const recues = serie.length;

    const lignes = normaliserHistorique(serie.map(p => ({
      date: p.date, open: null, high: null, low: null, close: p.rate, volume: null,
    })));

    if (!lignes.length) throw new Error(recues ? 'zero_ligne_apres_normalisation' : 'aucune_ligne_recue');
    lignes.recues = recues;
    return lignes;
  },

  async eulerpool(ticker, exchange, n, type, key) {
    if (type !== 'commodity') throw new Error('type_non_supporte_par_eulerpool');
    const ref = eulerpoolCommodityRef(ticker);
    if (!ref) throw new Error('commodite_non_reconnue_par_eulerpool');

    const jours = joursHistorique(n);
    const tries = await eulerpoolCommodityQuotesBrutes(ref.id, key);
    /* Fenêtre ancrée sur le point le plus récent RÉELLEMENT reçu, jamais
       sur Date.now() (voir eulerpoolFenetreJours) — un flux resté figé
       depuis plusieurs mois reste consultable avec un historique réel au
       lieu de systématiquement paraître vide. */
    const points = eulerpoolFenetreJours(tries, jours);
    const recues = points.length;

    /* normaliserHistorique() dédoublonne par JOUR — plusieurs points
       Eulerpool le même jour (rare, non constaté, mais jamais supposé
       absent) retiennent le dernier écrit, cohérent avec le traitement
       déjà appliqué à CoinGecko/Frankfurter ci-dessus. */
    const lignes = normaliserHistorique(points.map(p => ({
      date: p.date, open: null, high: null, low: null, close: p.close, volume: null,
    })));

    if (!lignes.length) throw new Error(recues ? 'zero_ligne_apres_normalisation' : 'aucune_ligne_recue');
    lignes.recues = recues;
    return lignes;
  },
};

/* ============================================================
   INTRADAY
   ============================================================
   Barres réellement infra-journalières. Jamais construites à partir de
   clôtures quotidiennes — soit le fournisseur renvoie de vraies barres
   intraday, soit ce bloc échoue et la cascade retombe sur le fournisseur
   suivant (ou remonte "intraday indisponible" si aucun n'a de données). */
const INTRADAY = {
  /* Twelve Data accepte nativement 1min/5min/15min/30min/1h comme
     `interval` — aucune conversion nécessaire. */
  async twelvedata(ticker, exchange, interval, jours, type, key) {
    if (!INTRADAY_MINUTES[interval]) {
      throw new Error('intervalle_non_supporte');
    }

    const barresParJour = {
      '1min': 390, '5min': 78, '15min': 26, '30min': 13, '1h': 7,
    };

    const outputsize = Math.max(
      30,
      Math.min(5000, Math.round((barresParJour[interval] || 20) * jours * 1.2))
    );

    const d = await getJSON(
      `https://api.twelvedata.com/time_series`
      + `?symbol=${encodeURIComponent(tdSymbol(ticker, exchange))}`
      + `&interval=${interval}`
      + `&outputsize=${outputsize}`
      + `&apikey=${key}`,
      12000
    );

    if (!d?.values?.length) {
      throw new Error(d?.message || 'vide');
    }

    const recues = d.values.length;

    const lignes = normaliserIntraday(
      d.values.map(ligne => ({
        date: txt(ligne.datetime),
        open: num(ligne.open),
        high: num(ligne.high),
        low: num(ligne.low),
        close: num(ligne.close),
        volume: num(ligne.volume),
      }))
    );

    if (!lignes.length) {
      throw new Error('zero_ligne_apres_normalisation');
    }

    lignes.recues = recues;
    return lignes;
  },

  /* EODHD ne propose nativement que 1m / 5m / 1h. Pour 15min/30min on
     récupère la plus fine granularité native disponible et on ré-agrège
     vers la granularité demandée (resampleOHLC — donnée réelle
     réagrégée, jamais inventée). */
  async eodhd(ticker, exchange, interval, jours, type, key) {
    const minutesDemandees = INTRADAY_MINUTES[interval];
    if (!minutesDemandees) {
      throw new Error('intervalle_non_supporte');
    }

    const NATIF_MINUTES = { '1m': 1, '5m': 5, '1h': 60 };
    const candidats = Object.entries(NATIF_MINUTES)
      .filter(([, m]) => m <= minutesDemandees)
      .sort((a, b) => b[1] - a[1]);
    const [natif, natifMinutes] = candidats.length ? candidats[0] : ['1m', 1];

    const to = Math.floor(Date.now() / 1000);
    const from = to - Math.round(jours * 86400);
    /* eodhdSymbolPourType() gère aussi crypto/forex (conventions "BTC-USD.CC"
       / "EURUSD.FOREX", vérifiées empiriquement sur ce même endpoint
       /intraday/) — voir historique de ce fichier pour le détail du
       correctif. index/commodity restent sans convention vérifiée : null,
       ce qui fait échouer proprement cet appel plutôt que d'envoyer un
       symbole inventé. */
    const symbole = eodhdSymbolPourType(ticker, exchange, type);
    if (!symbole) {
      throw new Error('type_sans_convention_eodhd');
    }

    const url = `https://eodhd.com/api/intraday/${encodeURIComponent(symbole)}`
      + `?api_token=${key}&fmt=json&interval=${natif}&from=${from}&to=${to}`;

    const d = await getJSON(url, 12000);

    if (!Array.isArray(d)) {
      const error = new Error(`format_inattendu:${typeof d}`);
      error.url = urlSansCle(url);
      error.symbole = symbole;
      throw error;
    }

    const recues = d.length;

    const brutes = d.map(ligne => ({
      date: isoUnix(ligne.timestamp),
      open: num(ligne.open),
      high: num(ligne.high),
      low: num(ligne.low),
      close: num(ligne.close),
      volume: num(ligne.volume),
    }));

    let lignes = normaliserIntraday(brutes);

    if (!lignes.length) {
      const error = new Error(recues ? `zero_ligne_apres_normalisation (recues:${recues})` : 'aucune_ligne_recue');
      error.url = urlSansCle(url);
      error.symbole = symbole;
      error.recues = recues;
      throw error;
    }

    if (natifMinutes < minutesDemandees) {
      lignes = resampleOHLC(lignes, minutesDemandees);
    }

    lignes.recues = recues;
    return lignes;
  },

  /* Granularité RÉELLE renvoyée par CoinGecko pour `jours` <= 90 (~5 min si
     jours<=1, sinon ~1 h) — non paramétrable sur l'API publique gratuite
     (voir coingeckoMarketChart ci-dessus). `interval` demandé n'est donc
     qu'indicatif ici : jamais ré-échantillonné vers une granularité plus
     fine que ce qui a été réellement reçu (resampleOHLC ne fait QUE
     grossir, jamais l'inverse) — retourné tel quel, la réponse HTTP
     (voir history.js) indique le vrai `interval` via le journal si besoin. */
  async coingecko(ticker, exchange, interval, jours, type, key) {
    if (type !== 'crypto') throw new Error('type_non_supporte_par_coingecko');
    const ref = coingeckoRef(ticker);
    if (!ref) throw new Error('ticker_non_reconnu_par_coingecko');

    const brutes = await coingeckoMarketChart(ref.id, ref.vs, jours);
    const recues = brutes.length;

    const lignes = normaliserIntraday(brutes);
    if (!lignes.length) throw new Error(recues ? 'zero_ligne_apres_normalisation' : 'aucune_ligne_recue');

    lignes.recues = recues;
    return lignes;
  },
};

/* ============================================================
   CASCADE
   ============================================================ */

async function cascade(
  table,
  ordre,
  args,
  journal,
  bloc
) {
  const keys =
    KEYS();

  for (
    const nom
    of ordre
  ) {
    const fn =
      table[nom];

    if (
      !fn
      || !keys[nom]
    ) {
      continue;
    }

    try {
      const out =
        await fn(
          ...args,
          keys[nom]
        );

      journal.push({
        bloc,

        provider:
          nom,

        ok:
          true,

        recues:
          out
          && out.recues != null
            ? out.recues
            : null,

        conservees:
          Array.isArray(out)
            ? out.length
            : null,
      });

      return {
        data:
          out,

        source:
          nom,
      };

    } catch (error) {
      journal.push({
        bloc,

        provider:
          nom,

        ok:
          false,

        reason:
          error.status
            ? `HTTP ${error.status}`
            : error.message,

        url:
          error.url
          || null,

        symbole:
          error.symbole
          || null,

        recues:
          error.recues
          ?? null,

        corps:
          error.body
            ? String(
                error.body
              ).slice(
                0,
                200
              )
            : null,
      });
    }
  }

  return {
    data:
      null,

    source:
      null,
  };
}

/* ============================================================
   COTATIONS EN LOT
   ============================================================ */

const idDe =
  v =>
    `${v.ticker}@${v.exchange || ''}`;

const BATCH = {
  limite: {
    twelvedata:
      120,

    eodhd:
      100,

    finnhub:
      10,

    /* /coins/markets accepte jusqu'à 250 `ids` par appel (documenté par
       CoinGecko) — un seul appel HTTP couvre tout le catalogue crypto
       NovaBourse actuel (20 paires) en une fois. */
    coingecko:
      250,

    /* Une limite haute et arbitraire ici : la vraie contrainte n'est pas
       une taille de lot (voir BATCH.frankfurter, un appel par devise BASE
       distincte, jamais par paire) mais le nombre de bases différentes
       présentes dans le lot. */
    frankfurter:
      250,

    /* Pas de véritable endpoint batch confirmé chez Eulerpool pour les
       commodités — un appel par symbole (voir BATCH.eulerpool), comme
       BATCH.finnhub. Limite = nombre de commodités réellement couvertes
       (3, voir EULERPOOL_COMMODITY_ID) : jamais plus d'appels que
       d'instruments qui peuvent réellement répondre. */
    eulerpool:
      3,
  },

  async twelvedata(
    valeurs,
    key
  ) {
    const map =
      new Map(
        valeurs.map(
          v => [
            tdSymbol(
              v.ticker,
              v.exchange
            ),
            v,
          ]
        )
      );

    const demandes =
      [
        ...map.keys(),
      ];

    if (
      !demandes.length
    ) {
      throw new Error(
        'aucun_symbole'
      );
    }

    const d =
      await getJSON(
        `https://api.twelvedata.com/quote`
        + `?symbol=${demandes.map(encodeURIComponent).join(',')}`
        + `&apikey=${key}`,
        12000
      );

    if (
      !d
      || d.status === 'error'
    ) {
      throw new Error(
        d?.message
        || 'vide'
      );
    }

    const entrees =
      demandes.length === 1
        ? [
            [
              demandes[0],
              d,
            ],
          ]
        : Object.entries(d);

    const out =
      new Map();

    for (
      const [cle, quote]
      of entrees
    ) {
      if (
        !quote
        || typeof quote !== 'object'
        || quote.status === 'error'
        || num(quote.close) === null
      ) {
        continue;
      }

      const src =
        map.get(cle);

      if (!src) {
        continue;
      }

      out.set(
        idDe(src),
        {
          symbol:
            idDe(src),

          ticker:
            src.ticker,

          exchange:
            src.exchange,

          price:
            num(
              quote.close
            ),

          changePercent:
            num(
              quote.percent_change
            ),

          change:
            num(
              quote.change
            ),

          currency:
            txt(
              quote.currency
            ),

          timestamp:
            isoUnix(
              quote.timestamp
            ),
        }
      );
    }

    if (
      !out.size
    ) {
      throw new Error(
        'aucune_ligne_exploitable'
      );
    }

    return out;
  },

  async eodhd(
    valeurs,
    key
  ) {
    /* Filtre AVANT construction de la requête : un instrument dont le
       type n'a aucune convention EODHD vérifiée (index/commodity, voir
       eodhdSymbolPourType) est simplement exclu de ce lot, jamais envoyé
       avec un symbole inventé. Il reste éligible aux autres fournisseurs
       de la cascade (twelvedata). */
    const map =
      new Map(
        valeurs
          .map(v => [
            eodhdSymbolPourType(v.ticker, v.exchange, v.type),
            v,
          ])
          .filter(([symbole]) => Boolean(symbole))
      );

    const symboles =
      [
        ...map.keys(),
      ];

    if (
      !symboles.length
    ) {
      throw new Error(
        'aucun_symbole'
      );
    }

    const [
      premier,
      ...reste
    ] =
      symboles;

    const d =
      await getJSON(
        `https://eodhd.com/api/real-time/${encodeURIComponent(premier)}`
        + `?api_token=${key}`
        + `&fmt=json`
        + (
          reste.length
            ? `&s=${reste.map(encodeURIComponent).join(',')}`
            : ''
        ),
        12000
      );

    const lignes =
      Array.isArray(d)
        ? d
        : [d];

    const out =
      new Map();

    for (
      const quote
      of lignes
    ) {
      if (
        !quote
        || num(quote.close) === null
      ) {
        continue;
      }

      const code =
        txt(
          quote.code
          || quote.symbol
        );

      if (!code) {
        continue;
      }

      const src =
        map.get(code);

      if (!src) {
        continue;
      }

      out.set(
        idDe(src),
        {
          symbol:
            idDe(src),

          ticker:
            src.ticker,

          exchange:
            src.exchange,

          price:
            num(
              quote.close
            ),

          changePercent:
            num(
              quote.change_p
            ),

          change:
            num(
              quote.change
            ),

          currency:
            null,

          timestamp:
            isoUnix(
              quote.timestamp
            ),
        }
      );
    }

    if (
      !out.size
    ) {
      throw new Error(
        'aucune_ligne_exploitable'
      );
    }

    return out;
  },

  async finnhub(
    valeurs,
    key
  ) {
    const compatibles =
      valeurs.filter(
        v =>
          finnhubAutorise(
            v.exchange,
            v.type
          )
      );

    const out =
      new Map();

    for (
      const v
      of compatibles.slice(
        0,
        BATCH.limite.finnhub
      )
    ) {
      try {
        const quote =
          await getJSON(
            `https://finnhub.io/api/v1/quote`
            + `?symbol=${encodeURIComponent(v.ticker)}`
            + `&token=${key}`,
            6000
          );

        if (
          num(quote?.c) === null
          || num(quote.c) === 0
        ) {
          continue;
        }

        out.set(
          idDe(v),
          {
            symbol:
              idDe(v),

            ticker:
              v.ticker,

            exchange:
              v.exchange,

            price:
              num(
                quote.c
              ),

            changePercent:
              num(
                quote.dp
              ),

            change:
              num(
                quote.d
              ),

            currency:
              null,

            timestamp:
              isoUnix(
                quote.t
              ),
          }
        );

      } catch {
        // Une cotation individuelle ne doit
        // pas faire échouer tout le lot.
      }
    }

    if (
      !out.size
    ) {
      throw new Error(
        'aucune_ligne_exploitable'
      );
    }

    return out;
  },

  /* Seuls les éléments type==='crypto' avec un ticker reconnu par
     CRYPTO_ID_COINGECKO participent — les autres (actions, forex...) sont
     silencieusement exclus de CE lot, jamais envoyés à CoinGecko avec un
     id inventé. Ils restent éligibles aux autres fournisseurs de la
     cascade (voir ORDRE dans quotes.js). Toutes les devises de règlement
     demandées sont regroupées par vs_currency pour respecter le contrat
     d'un seul vs_currency par appel /coins/markets — un seul appel HTTP
     suffit tant que tout le lot cote dans la même devise (cas normal :
     NovaBourse coté crypto uniquement en USD aujourd'hui). */
  async coingecko(valeurs, key) {
    const parGroupe = new Map(); // vs -> Map(id -> valeur)
    for (const v of valeurs) {
      if (v.type !== 'crypto') continue;
      const ref = coingeckoRef(v.ticker);
      if (!ref) continue;
      if (!parGroupe.has(ref.vs)) parGroupe.set(ref.vs, new Map());
      parGroupe.get(ref.vs).set(ref.id, v);
    }

    if (!parGroupe.size) throw new Error('aucun_symbole');

    const out = new Map();

    for (const [vs, parId] of parGroupe) {
      const ids = [...parId.keys()];
      let lignes;
      try {
        lignes = await getJSON(
          `https://api.coingecko.com/api/v3/coins/markets`
          + `?vs_currency=${vs}&ids=${ids.join(',')}&price_change_percentage=24h`,
          12000
        );
      } catch {
        continue; // un groupe de devise indisponible ne doit pas faire échouer les autres
      }

      for (const ligne of (Array.isArray(lignes) ? lignes : [])) {
        if (num(ligne?.current_price) === null) continue;
        const src = parId.get(ligne.id);
        if (!src) continue;

        out.set(idDe(src), {
          symbol: idDe(src),
          ticker: src.ticker,
          exchange: src.exchange,
          price: num(ligne.current_price),
          change: num(ligne.price_change_24h),
          changePercent: num(ligne.price_change_percentage_24h),
          currency: vs.toUpperCase(),
          timestamp: txt(ligne.last_updated) ? new Date(ligne.last_updated).toISOString() : null,
        });
      }
    }

    if (!out.size) throw new Error('aucune_ligne_exploitable');
    return out;
  },

  /* Regroupe par devise BASE (une paire "EUR/USD" a pour base EUR) : un seul
     appel /v1/{plage}?base=EUR&symbols=USD,GBP,... couvre toutes les paires
     du lot qui partagent la même base, jamais un appel par paire. Fenêtre de
     7 jours (jamais 1 seul jour) pour toujours disposer d'un point
     "précédent" réel même un lundi (le vendredi précédent) — voir
     QUOTE.frankfurter/frankfurterSeries pour la même logique. */
  async frankfurter(valeurs, key) {
    const parBase = new Map(); // base -> Map(quote -> valeur)
    for (const v of valeurs) {
      if (v.type !== 'forex') continue;
      const ref = frankfurterRef(v.ticker);
      if (!ref) continue;
      if (!parBase.has(ref.base)) parBase.set(ref.base, new Map());
      parBase.get(ref.base).set(ref.quote, v);
    }

    if (!parBase.size) throw new Error('aucun_symbole');

    const out = new Map();
    const fin = new Date();
    const debut = new Date(Date.now() - 7 * 86400000);
    const iso = d => d.toISOString().slice(0, 10);

    for (const [base, parQuote] of parBase) {
      const quotes = [...parQuote.keys()];
      let d;
      try {
        d = await getJSON(
          `https://api.frankfurter.dev/v1/${iso(debut)}..${iso(fin)}`
          + `?base=${base}&symbols=${quotes.join(',')}`,
          12000
        );
      } catch {
        continue; // un groupe de devise indisponible ne doit pas faire échouer les autres
      }

      const dates = Object.keys(d?.rates || {}).sort();
      if (dates.length < 1) continue;
      const dateDerniere = dates[dates.length - 1];
      const datePrecedente = dates.length >= 2 ? dates[dates.length - 2] : null;

      for (const quote of quotes) {
        const prix = num(d.rates[dateDerniere]?.[quote]);
        if (prix === null) continue;
        const src = parQuote.get(quote);
        if (!src) continue;

        const prixPrecedent = datePrecedente ? num(d.rates[datePrecedente]?.[quote]) : null;
        const change = prixPrecedent !== null ? prix - prixPrecedent : null;

        out.set(idDe(src), {
          symbol: idDe(src),
          ticker: src.ticker,
          exchange: src.exchange,
          price: prix,
          change,
          changePercent: (change !== null && prixPrecedent) ? (change / prixPrecedent) * 100 : null,
          currency: quote,
          timestamp: new Date(`${dateDerniere}T16:00:00Z`).toISOString(),
        });
      }
    }

    if (!out.size) throw new Error('aucune_ligne_exploitable');
    return out;
  },

  /* Un appel par commodité (voir limite ci-dessus, au plus 3) — même
     schéma que BATCH.finnhub : pas de vrai endpoint multi-symboles
     confirmé chez Eulerpool pour /commodity/quotes. */
  async eulerpool(valeurs, key) {
    const compatibles = valeurs.filter(v => v.type === 'commodity' && eulerpoolCommodityRef(v.ticker));
    const out = new Map();

    for (const v of compatibles.slice(0, BATCH.limite.eulerpool)) {
      try {
        const q = await QUOTE.eulerpool(v.ticker, v.exchange, 'commodity', key);
        out.set(idDe(v), {
          symbol: idDe(v),
          ticker: v.ticker,
          exchange: v.exchange,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          currency: q.currency,
          timestamp: q.timestamp,
        });
      } catch {
        // Une commodité individuelle ne doit pas faire échouer tout le lot.
      }
    }

    if (!out.size) throw new Error('aucune_ligne_exploitable');
    return out;
  },
};

/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  SEARCH,
  QUOTE,
  FUNDAMENTALS,
  HISTORY,
  INTRADAY,
  BATCH,
  NEWS,

  cascade,

  KEYS,

  num,
  txt,
  isoUnix,

  getJSON,

  eodhdSymbol,
  eodhdCryptoSymbol,
  eodhdForexSymbol,
  eodhdIndexSymbol,
  eodhdSymbolPourType,
  tdSymbol,
  coingeckoRef,
  CRYPTO_ID_COINGECKO,
  COINGECKO_JOURS_MAX,
  frankfurterRef,
  FRANKFURTER_CURRENCIES,
  eulerpoolCommodityRef,
  EULERPOOL_COMMODITY_ID,

  idDe,

  SUFFIX,
  TD_EXCHANGE,

  normaliserHistorique,
  normaliserIntraday,
  resampleOHLC,
  joursHistorique,
  finnhubAutorise,

  INTRADAY_MINUTES,
  INTRADAY_INTERVALS,
};
