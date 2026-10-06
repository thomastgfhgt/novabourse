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

  /* Yahoo Finance (endpoints publics non officiels) : fournisseur
     PRINCIPAL décidé le 2026-10-06 pour remplacer EODHD/Twelve Data/
     Finnhub pendant la phase de développement (voir le grand commentaire
     "YAHOO FINANCE" plus bas dans ce fichier pour le détail des
     vérifications empiriques ET l'avertissement juridique — usage
     commercial à grande échelle NON validé juridiquement en l'état,
     audit de licences prévu avant commercialisation). Sentinelle `true`
     comme coingecko/frankfurter ci-dessous : aucune clé, aucun compte.
     YAHOO_DISABLED="1" permet de le couper sans toucher au code, par
     exemple si Yahoo bloque l'IP du serveur ou change ses protections. */
  yahoo:
    process.env.YAHOO_DISABLED === '1'
      ? null
      : true,

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

  /* Même identifiant qu'eulerpool ci-dessus (même compte, même clé) — nom
     de fournisseur DISTINCT uniquement pour que cascade()/le journal
     distinguent une cotation native ('eulerpool') d'un taux croisé
     calculé ('eulerpool_fx', voir eulerpoolCommodityRefCroise). BUG DE
     PRODUCTION CONFIRMÉ ET CORRIGÉ : sans cette entrée, cascade() ignorait
     silencieusement 'eulerpool_fx' de tout ordre de cascade (keys['eulerpool_fx']
     valait undefined, donc toujours faux), aucune ligne de journal, aucune
     erreur visible — juste un fournisseur qui n'était jamais essayé. */
  eulerpool_fx:
    process.env.EULERPOOL_API_KEY
    || null,

  /* SEC EDGAR (data.sec.gov) : source publique officielle du gouvernement
     américain, aucune clé requise — uniquement un en-tête User-Agent
     identifiable (voir _secEdgar.js). Même principe de sentinelle que
     coingecko/frankfurter ci-dessus. SECEDGAR_DISABLED permet de le
     couper sans toucher au code. */
  secedgar:
    process.env.SECEDGAR_DISABLED === '1'
      ? null
      : true,
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
  ms = 9000,
  enTetesSupplementaires = {}
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

          /* `enTetesSupplementaires` optionnel (défaut {}) : comportement
             strictement inchangé pour tout appelant existant. Ajouté pour
             SEC EDGAR (_secEdgar.js), qui EXIGE contractuellement un
             en-tête User-Agent identifiable (nom + contact) sous peine de
             403/429 — voir https://www.sec.gov/os/webmaster-faq#developers,
             vérifié en direct avant intégration. */
          headers: {
            accept:
              'application/json',
            ...enTetesSupplementaires,
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
  /* TO (Toronto) et AU (places australiennes) : vérifiés via l'endpoint
     réel EODHD /exchange-symbol-list/TO et /exchange-symbol-list/AU (27 et
     19 tickers testés avec succès, ex. RY.TO, BHP.AU) — le code NovaBourse
     est ici identique au code EODHD, aucune traduction nécessaire. */
  TO: 'TO',
  AU: 'AU',

  /* Expansion Asie/émergents (2026-09-24, LOT "couverture mondiale") :
     vérifié EMPIRIQUEMENT en interrogeant la vraie API EODHD en production
     (jamais deviné depuis une doc tierce) — un cours réel a été reçu pour
     chacun de ces 6 codes :
       0700.HK    (Tencent)         -> 438,4 HKD
       600519.SHG (Kweichow Moutai) -> 1237 CNY
       000001.SHE (Ping An)         -> 11,3 CNY
       005930.KO  (Samsung, KOSPI)  -> 285500 KRW
       PETR4.SA   (Petrobras)       -> 49,43 BRL
       2330.TW    (TSMC)            -> 2475 TWD
     Tokyo (essayé : T/TSE/JP/TYO), Inde (NSE/BSE) et Arabie Saoudite (SR/
     TADAWUL) ont échoué avec des erreurs cohérentes avec un plan EODHD ne
     couvrant pas encore ces places (403 Forbidden "contact support", ou
     404 Ticker Not Found malgré un format de symbole par ailleurs
     documenté comme correct) — PAS un problème de code, laissés NULL en
     attendant soit une vérification ultérieure, soit une évolution de
     plan. KOSDAQ (marché coréen distinct de KO/KOSPI) et TPEX (Taiwan OTC,
     distinct de TW/TWSE) volontairement NON vérifiés dans cette passe,
     restent NULL par prudence plutôt que supposés identiques à KO/TW.

     SUITE (2026-09-28, LOT "couverture mondiale de données") : KOSDAQ et
     Taiwan OTC (laissés NULL ci-dessus) enfin vérifiés EMPIRIQUEMENT, plus
     Afrique du Sud essayée et confirmée elle aussi plan-gated (donc
     laissée NULL, comme Tokyo/Inde/Arabie Saoudite ci-dessus) :
       003690.KQ  (Korean Reinsurance)  -> historique RÉEL reçu (210
         séances), mais cotation ET fondamentaux vides/plan-gated —
         ajoutée quand même : un graphique réel sans prix en direct reste
         strictement plus utile qu'une place totalement non résolue
         (cohérent avec `partial`/`missing` déjà honnêtement affichés
         ailleurs pour ce cas).
       6274.TWO   (Taiwan Union Tech.) -> cotation (1495 TWD), historique
         (267 séances) ET fondamentaux (via le repli Eulerpool) TOUS
         réels — couverture complète, pas seulement partielle.
       SOL.SJ (Sasol, tentative JSE Afrique du Sud) -> même signature
         d'erreur que Tokyo/Inde/Arabie Saoudite (403 Forbidden "contact
         support" + 404 Ticker Not Found) : PAS un problème de code,
         laissée NULL. */
  HK: 'HK',
  SHG: 'SHG',
  SHE: 'SHE',
  KO: 'KO',
  SA: 'SA',
  TW: 'TW',
  KQ: 'KQ',
  TWO: 'TWO',

  /* SUITE (2026-09-28, chantier "couverture mondiale") : 3 nouveaux codes
     vérifiés EMPIRIQUEMENT via l'endpoint réel /api/market/company en
     production (jamais devinés depuis une doc tierce) :
       AAG.V    (Aftermath Silver, TSX Venture) -> cotation ET historique
         RÉELS (0,67 CAD, capitalisation réelle) — couverture complète.
       11B.WAR  (11 bit studios, Bourse de Varsovie) -> cotation ET
         historique RÉELS (118,6 PLN) ; fondamentaux plan-gated (403,
         même signature que les autres places européennes déjà
         documentées ci-dessus) — pas un problème de code.
       0001.KLSE (Supercomnet Technologies, Bursa Malaysia) -> historique
         RÉEL reçu (269 séances), cotation ET fondamentaux vides/
         plan-gated — ajoutée quand même, même raisonnement que KQ
         ci-dessus (un historique réel sans prix en direct reste
         strictement plus utile qu'une place non résolue).
     BATS (Cboe/BZX, ~1370 titres du catalogue) volontairement ABSENT
     d'ici : vérifié en direct (AAAU.US) qu'il ne s'agit PAS d'une place
     EODHD distincte pour les titres de ce catalogue — la composite 'US'
     déjà mappée ci-dessus suffit (voir ALIAS_CATALOGUE, _exchangeCrosswalk.js,
     BATS -> US). */
  V: 'V',
  WAR: 'WAR',
  KLSE: 'KLSE',

  /* Suite (2026-09-28) : 2 nouveaux codes vérifiés EMPIRIQUEMENT (mêmes
     garanties que V/WAR/KLSE ci-dessus) :
       AADI.JK  (Adaro Andalan Indonesia, IDX) -> cotation ET historique
         RÉELS (11 625 IDR, capitalisation réelle) — couverture complète.
       786.KAR  (786 Investment, PSX Pakistan) -> cotation ET historique
         RÉELS (21,35 PKR) ; fondamentaux plan-gated (403), même
         signature que les autres places déjà documentées.
     Tentatives infructueuses (404 "Ticker Not Found", code incorrect —
     pas un problème de plan) volontairement NON ajoutées : TASE (Israël,
     essayé TA/TLV/IL) et BIST (Turquie, essayé IS/IST/TR) — code EODHD
     exact non trouvé sans accès à leur documentation complète, laissées
     NULL plutôt que devinées davantage. */
  JK: 'JK',
  KAR: 'KAR',

  /* Suite (2026-09-28, 2e passe) : 1 nouveau code vérifié EMPIRIQUEMENT :
       ABXX.NEO (Abaxx Technologies, Cboe Canada ex-NEO Exchange) ->
         cotation ET historique RÉELS (16,78 CAD, 274 séances) — même
         valeur cotée en parallèle sous TO (16,75 CAD, mais seulement 89
         séances sous ce code pour ce titre précis) : confirme qu'il
         s'agit bien d'une place EODHD distincte de TO, pas un doublon.
     AMS (raw label du catalogue source, ~234 titres) volontairement PAS
     un nouveau code ici : vérifié (AALB.AS, Aalberts NV, 42,36 EUR, 279
     séances) qu'il s'agit de la composite Amsterdam déjà mappée ('AS')
     — voir ALIAS_CATALOGUE, _exchangeCrosswalk.js, AMS -> AS. Un titre
     de l'échantillon (3DIS, ETP à effet de levier, ISIN Euroclear XS)
     n'a rien renvoyé même sous 'AS' — pas un problème de code, juste un
     instrument non couvert, laissé honnêtement absent comme les autres
     cas similaires déjà documentés dans ce fichier. */
  NEO: 'NEO',

  /* Suite (2026-09-28, 3e passe) : 3 nouveaux codes vérifiés
     EMPIRIQUEMENT :
       AAAK.AT   (Wool Industry Tria Alfa, Bourse d'Athènes) -> cotation
         ET historique RÉELS (4,58 EUR, capitalisation réelle).
       ANV.VN    (Nam Viet Corp, HOSE Vietnam) -> cotation ET historique
         RÉELS (15 300 VND, capitalisation réelle).
       AB.PSE    (Atok Big Wedge, Bourse des Philippines) -> historique
         RÉEL reçu (231 séances), cotation vide/plan-gated — ajoutée
         quand même, même raisonnement que KLSE/KOSDAQ déjà actés. */
  AT: 'AT',
  VN: 'VN',
  PSE: 'PSE',

  /* Suite (2026-09-28, 4e passe) : 2 nouveaux codes vérifiés
     EMPIRIQUEMENT :
       AC.MX     (Arca Continental, Bolsa Mexicana de Valores) -> cotation
         ET historique RÉELS (199,24 MXN, capitalisation réelle).
       AAISA.SN  (Administradora Americana de Inversiones, Bourse de
         Santiago du Chili) -> cotation ET historique RÉELS (623,08 CLP,
         capitalisation réelle).
     Égypte (essayé CA) et Nigeria (essayé LG) échoués (404 Ticker Not
     Found, code incorrect) — laissés NULL plutôt que devinés davantage. */
  MX: 'MX',
  SN: 'SN',
};

/* ============================================================
   CORRECTIF LSE : COTATION EN PENCE (GBX), PAS EN LIVRES (GBP)
   ============================================================
   Bug de correction potentiellement invisible tant qu'aucune action LSE
   n'était au catalogue : vérifié empiriquement en production (audit
   d'expansion du catalogue européen) — GET /api/market/quotes pour AZN@L
   renvoie price=12136, alors que le cours réel d'AstraZeneca est d'environ
   121,36 GBP. EODHD (et la plupart des fournisseurs) cotent la majorité
   des actions du London Stock Exchange en pence (GBX = 1/100 GBP), pas en
   livres. Sans ce correctif, tout prix/variation absolue affiché pour ces
   valeurs serait 100x trop grand — exactement le type de donnée fausse
   interdit par le cahier des charges.
   Liste vérifiée en DEUX temps, jamais sur la seule metadata statique :
   l'endpoint /exchange-symbol-list/LSE (champ "Currency" par ticker) a
   d'abord servi de point de départ, MAIS s'est révélé lui-même incorrect
   pour LLOY (déclaré "GBP" alors que la cotation réelle est en pence —
   111,25 brut chez EODHD contre un vrai cours de marché de ~110-111 GBX
   au 16/09/2026, confirmé par recherche web indépendante ; en GBP cela
   ferait de Lloyds la valeur la plus chère du FTSE100 par un facteur
   énorme, impossible). CPG et IHG, eux, confirmés authentiquement cotés
   en USD par la même vérification croisée (valeurs brutes EODHD 30,91 et
   153,55 conformes aux cours USD réels trouvés indépendamment) — ce sont
   donc les deux SEULES exceptions retenues, pas trois. changePercent
   n'est jamais affecté (ratio, la division par 100 s'annule au
   numérateur et au dénominateur) : uniquement les montants absolus
   (price/change/open/high/low/close/previousClose). */
const LSE_TICKERS_PENCE = new Set([
  'AZN', 'SHEL', 'HSBA', 'ULVR', 'BP', 'GSK', 'DGE', 'RIO', 'BATS', 'RKT',
  'NG', 'VOD', 'BARC', 'LLOY', 'NWG', 'PRU', 'TSCO', 'SBRY', 'BT-A', 'RR',
  'AAL', 'GLEN', 'AV', 'LGEN', 'STAN', 'NXT', 'ABF', 'EXPN', 'REL', 'LSEG',
  'SN', 'PSON', 'WTB',
]);

function estCotePenceLSE(ticker, exchange) {
  return exchange === 'L' && LSE_TICKERS_PENCE.has(String(ticker || '').toUpperCase());
}

/** Convertit un objet cotation (price/change/...) de pence vers livres. */
function ajusterPenceQuote(ticker, exchange, quote) {
  if (!quote || !estCotePenceLSE(ticker, exchange)) return quote;
  const sortie = { ...quote };
  for (const champ of ['price', 'change', 'open', 'high', 'low', 'close', 'previousClose']) {
    if (Number.isFinite(sortie[champ])) sortie[champ] = sortie[champ] / 100;
  }
  sortie.currency = 'GBP';
  return sortie;
}

/** Même correctif pour une série OHLCV (historique/intraday). */
function ajusterPenceHistorique(ticker, exchange, points) {
  if (!Array.isArray(points) || !estCotePenceLSE(ticker, exchange)) return points;
  return points.map((p) => {
    const q = { ...p };
    for (const champ of ['open', 'high', 'low', 'close', 'adjClose']) {
      if (Number.isFinite(q[champ])) q[champ] = q[champ] / 100;
    }
    return q;
  });
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

/**
 * "XAU/EUR" -> { id: 'XAU', quoteCurrency: 'EUR' } : Eulerpool ne cote ces
 * commodités qu'en USD (voir eulerpoolCommodityRef ci-dessus) — pour une
 * autre devise PUBLIÉE PAR LA BCE (voir FRANKFURTER_CURRENCIES), le prix
 * est un TAUX CROISÉ RÉEL (prix USD réel × taux de change réel), jamais
 * une estimation : voir QUOTE.eulerpool_fx / HISTORY.eulerpool_fx.
 * Renvoie null pour USD (cas direct, déjà couvert par eulerpoolCommodityRef)
 * et pour toute devise que la BCE ne publie pas.
 */
function eulerpoolCommodityRefCroise(ticker) {
  const m = /^([A-Z0-9]+)\/([A-Z]{3})$/.exec(String(ticker || '').toUpperCase());
  if (!m) return null;
  const id = EULERPOOL_COMMODITY_ID[m[1]];
  if (!id || m[2] === 'USD' || !FRANKFURTER_CURRENCIES.has(m[2])) return null;
  return { id, quoteCurrency: m[2] };
}

/* Apparie chaque point de prix (déjà trié plus récent -> plus ancien) au
   taux de change PUBLIÉ LE MÊME JOUR OU LE JOUR OUVRÉ RÉEL LE PLUS PROCHE
   ANTÉRIEUR (jamais un taux d'une autre date "par défaut" — la BCE ne
   publie rien le week-end/jours fériés, d'où la recherche du dernier jour
   ouvré réel) — jamais le taux "d'aujourd'hui" appliqué à un prix ancien
   (une commodité au flux figé depuis des mois, converti avec le taux du
   jour, produirait un nombre qui ne correspond à AUCUN instant réel).
   `tauxParDate` : Map "YYYY-MM-DD" -> taux, construite depuis une série
   Frankfurter déjà triée par date croissante. */
function tauxLePlusProcheAvant(tauxParDate, datesTriees, dateCible) {
  const cle = dateCible.slice(0, 10);
  if (tauxParDate.has(cle)) return tauxParDate.get(cle);
  // Recherche du dernier jour ouvré <= dateCible (les dates sont triées croissant).
  let trouve = null;
  for (const d of datesTriees) {
    if (d > cle) break;
    trouve = d;
  }
  return trouve ? tauxParDate.get(trouve) : null;
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
   YAHOO FINANCE — endpoints publics non officiels (2026-10-06)
   ============================================================
   AUCUNE clé requise (contrairement à EODHD/Twelve Data/Finnhub/
   Eulerpool) : endpoints "query1.finance.yahoo.com" utilisés tels quels,
   sans compte ni jeton payant. Même principe de sentinelle que coingecko/
   frankfurter dans KEYS() ci-dessus.

   ⚠️ AVERTISSEMENT JURIDIQUE — À LIRE AVANT TOUTE EXTENSION DE CE BLOC ⚠️
   Il n'existe AUCUNE API Yahoo Finance officielle depuis 2017 (confirmé
   par recherche, 2026-10-06). Ces endpoints sont NON documentés, NON
   garantis, peuvent être modifiés/bloqués/limités par Yahoo à tout moment
   sans préavis. Leur usage commercial se situe dans une zone grise :
   les conditions d'utilisation de Yahoo Finance restreignent l'usage
   commercial de données obtenues par ce biais, et une partie des données
   provient elle-même de places boursières/fournisseurs tiers dont les
   propres licences restreignent la redistribution. NovaTitre les utilise
   ici comme fournisseur PRINCIPAL pendant la phase de développement
   (décision explicite du produit, 2026-10-06), PAS comme un choix
   juridiquement validé pour une exploitation commerciale à grande
   échelle. Un audit de licences dédié est prévu AVANT la commercialisation
   de NovaTitre, et remplacera cette source si nécessaire — c'est
   précisément le rôle de la couche _router.js/cascade() : un seul
   fournisseur remplacé ici n'oblige à toucher aucune autre partie de
   l'application (company.js/history.js/search.js/quotes.js/extra.js ne
   connaissent que des données déjà normalisées, jamais leur provenance).

   Vérifié EMPIRIQUEMENT en direct (2026-10-06, sans clé, token réel) :
     - /v8/finance/chart/{symbole} : quote + historique OHLCV + volume,
       AAPL/MSFT/NVDA/SPY/^GSPC/^FCHI/EURUSD=X/BTC-USD/GC=F/BZ=F/MC.PA/
       TTE.PA/CARS + 12 places européennes/asiatiques (voir YAHOO_SUFFIX
       ci-dessous) — AUCUNE authentification requise, fraîcheur mesurée à
       6 secondes sur AAPL en séance. Historique testé jusqu'à 2 ans
       (501 points quotidiens), sans trou.
     - /v1/finance/search : recherche + actualités par ticker (newsCount),
       AUCUNE authentification requise. CORRECTIF (collision de ticker
       réellement reproduite en direct, 2026-10-06) : une recherche par
       TICKER NU ("MC") renvoie Moelis & Co (NYSE) et jamais LVMH, qui
       n'apparaît même pas dans les 15 premiers résultats — l'affirmation
       inverse écrite ici initialement était FAUSSE (confondue avec un
       test antérieur fait via Twelve Data, pas Yahoo). Une recherche par
       NOM ("LVMH") trouve en revanche la bonne société en 1er résultat
       (MC.PA). Le vrai désambiguïsateur pour un ticket court exact est
       donc le catalogue Supabase (recherche ticker=eq. exacte, voir
       handleCatalog()/api/market/extra.js), jamais le classement de
       pertinence de Yahoo pour ce cas précis — SEARCH.yahoo reste
       complémentaire (texte libre, actualités), pas autoritaire sur les
       collisions de ticker.
     - /v10/finance/quoteSummary : fondamentaux RÉELS (financialData,
       defaultKeyStatistics...), mais EXIGE un cookie + "crumb" (2 appels
       réseau, voir crumbYahoo() ci-dessous) — plus fragile que les 2
       endpoints ci-dessus, cassera plus facilement si Yahoo durcit encore
       ses protections. Échec de ce flux = fundamentals.yahoo renvoie
       simplement null, jamais une exception qui casserait la cascade.
     - /v7/finance/quote (cotation multi-symboles en 1 appel) : DÉSORMAIS
       bloqué (401 "User is unable to access this feature") même avec le
       crumb testé pour quoteSummary — abandonné. BATCH.yahoo ci-dessous
       interroge donc /v8/finance/chart EN PARALLÈLE, un appel par
       symbole (coût réseau plus élevé qu'un vrai batch, mais aucune
       authentification requise et nettement plus robuste). */

const YAHOO_DISCLAIMER_URL = 'https://finance.yahoo.com/';

const YAHOO_UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

/* Suffixe de place Yahoo, par code canonique NovaBourse (voir SUFFIX plus
   haut pour la convention EODHD équivalente). '' = aucun suffixe (places
   américaines composites). Seules les entrées marquées VÉRIFIÉ ont été
   testées empiriquement en direct le 2026-10-06 (un prix réel reçu pour
   un titre réel de cette place) ; les autres places du catalogue
   (BSE_IN, SGX, TADAWUL, JSE...) restent volontairement ABSENTES —
   jamais une convention Yahoo devinée. */
const YAHOO_SUFFIX = {
  NASDAQ: '', NYSE: '', 'NYSE ARCA': '', US: '',          // VÉRIFIÉ (AAPL/SPY)
  PA: '.PA',                                                // VÉRIFIÉ (MC.PA, TTE.PA)
  DE: '.DE',                                                // VÉRIFIÉ (SAP.DE)
  L: '.L',                                                  // VÉRIFIÉ (HSBA.L)
  AS: '.AS',                                                // VÉRIFIÉ (ASML.AS, INGA.AS)
  MI: '.MI',                                                // VÉRIFIÉ (ENI.MI)
  SW: '.SW',                                                // VÉRIFIÉ (NESN.SW)
  TO: '.TO',                                                // VÉRIFIÉ (RY.TO)
  AU: '.AX',                                                // VÉRIFIÉ (BHP.AX — lettre différente du code NovaBourse)
  HK: '.HK',                                                // VÉRIFIÉ (0700.HK)
  SHG: '.SS',                                               // VÉRIFIÉ (600519.SS)
  SHE: '.SZ',                                               // VÉRIFIÉ (000001.SZ)
  KO: '.KS',                                                // VÉRIFIÉ (005930.KS)
  SA: '.SA',                                                // VÉRIFIÉ (PETR4.SA)
  TW: '.TW',                                                // VÉRIFIÉ (2330.TW)
  HE: '.HE',                                                // VÉRIFIÉ (NOKIA.HE)
  ST: '.ST',                                                // VÉRIFIÉ (ERIC-B.ST)
  CO: '.CO',                                                // VÉRIFIÉ (MAERSK-B.CO)
  OL: '.OL',                                                // VÉRIFIÉ (AKER.OL)
  BR: '.BR',                                                // VÉRIFIÉ (ABI.BR)
  LS: '.LS',                                                // VÉRIFIÉ (EDP.LS)
};

function yahooSymbole(ticker, exchange, type) {
  const t = String(ticker || '').toUpperCase().trim();
  if (!t) return null;

  if (type === 'crypto') return `${t.replace('/', '-')}`; // BTC/USD -> BTC-USD
  if (type === 'forex') return `${t.replace('/', '')}=X`; // EUR/USD -> EURUSD=X
  if (type === 'index') {
    /* Convention Yahoo documentée publiquement : préfixe "^" sur le même
       ticker racine canonique NovaBourse utilisé partout ailleurs (ex.
       GSPC/FCHI/DJI, voir INDICES_VERIFIES/seedIndices() dans js/core.js)
       — jamais un nouveau mapping inventé. VÉRIFIÉ EN DIRECT ici pour
       GSPC et FCHI (2026-10-06). */
    return `^${t}`;
  }
  if (type === 'commodity') {
    /* Seuls XPD/USD, XPT/USD, XBR/USD sont dans le périmètre NovaBourse
       (EODHD_COMMODITY_FOREX plus haut) — convention Yahoo "futures"
       vérifiée en direct pour XBR/USD (BZ=F, Brent). PA=F (palladium) et
       PL=F (platine) sont la convention Yahoo publique standard pour ces
       deux métaux, non re-vérifiée empiriquement cette session. */
    const FUTURES_YAHOO = { 'XPD/USD': 'PA=F', 'XPT/USD': 'PL=F', 'XBR/USD': 'BZ=F' };
    return FUTURES_YAHOO[t] || null;
  }

  const code = String(exchange || '').toUpperCase().trim();
  const suffixe = Object.prototype.hasOwnProperty.call(YAHOO_SUFFIX, code) ? YAHOO_SUFFIX[code] : null;
  if (suffixe === null) return code ? null : t; // place non vérifiée -> null, SAUF composite US implicite (exchange vide)
  return `${t}${suffixe}`;
}

/* Inverse de yahooSymbole() pour un résultat de SEARCH.yahoo : ne retire
   QUE l'un des suffixes CONNUS de YAHOO_SUFFIX (triés du plus long au
   plus court pour qu'un suffixe à 3 lettres ne soit jamais coupé par un
   suffixe à 2 lettres qui le chevauche), jamais un simple split('.') —
   sans quoi un ticker américain contenant un point interne (ex. "BRK.B")
   serait tronqué à tort en "BRK". Un symbole sans suffixe reconnu est
   retourné TEL QUEL, jamais deviné. */
const YAHOO_SUFFIXES_TRIES = [...new Set(Object.values(YAHOO_SUFFIX).filter(Boolean))]
  .sort((a, b) => b.length - a.length);
function tickerDepuisSymboleYahoo(symbole) {
  const s = String(symbole || '').toUpperCase();
  for (const suf of YAHOO_SUFFIXES_TRIES) {
    if (s.endsWith(suf)) return s.slice(0, -suf.length);
  }
  return s;
}

/* Cookie + "crumb" : seul moyen connu (2026-10-06) de débloquer
   quoteSummary (fondamentaux). Mémorisé en mémoire-processus (même
   limite que le reste des caches de ce projet, voir _cache.js) — un
   crumb reste valide plusieurs heures en pratique, jamais réobtenu à
   chaque appel. Échec à N'IMPORTE QUELLE étape -> null, jamais une
   exception qui remonterait jusqu'à l'appelant. */
let YAHOO_CRUMB_CACHE = null;
async function crumbYahoo() {
  if (YAHOO_CRUMB_CACHE) return YAHOO_CRUMB_CACHE;
  try {
    /* CORRECTIF (bug réel confirmé en direct, 2026-10-06) : /v1/test/getcrumb
       exige désormais un cookie de session préalable ("Invalid Cookie",
       HTTP 401, sans lui) — absent de la version initiale de cette
       fonction, qui ne faisait qu'un seul appel sans cookie et échouait
       donc SYSTÉMATIQUEMENT. fc.yahoo.com sert ce cookie (même s'il
       répond lui-même 404 sur le corps de la réponse, le cookie est bien
       posé — vérifié en direct). fetch() ne gère aucun cookie-jar
       automatique côté Node : le header Set-Cookie de la 1ère réponse est
       donc explicitement relu et renvoyé en Cookie sur la 2e requête. */
    const amorce = await fetch('https://fc.yahoo.com', { headers: YAHOO_UA });
    const cookie = amorce.headers.get('set-cookie');
    if (!cookie) return null;

    const r = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...YAHOO_UA, cookie },
    });
    if (!r.ok) return null;
    const crumb = (await r.text()).trim();
    if (!crumb || crumb.length > 40) return null;
    YAHOO_CRUMB_CACHE = { crumb, cookie };
    return YAHOO_CRUMB_CACHE;
  } catch {
    return null;
  }
}

/* ============================================================
   RECHERCHE
   ============================================================ */

const SEARCH = {
  /* Yahoo Finance (voir le bloc de garanties/avertissement juridique plus
     haut) : /v1/finance/search couvre quotes ET news en un seul appel,
     sans clé. `key` ignoré (sentinelle `true`, même signature que les
     autres fournisseurs pour que cascade() reste générique). Exchange
     canonicalisé depuis exchDisp (texte lisible Yahoo) plutôt que depuis
     le suffixe du symbole — plus robuste (un ticker avec point interne,
     ex. BRK.B, ne serait pas correctement découpé par suffixe). Place
     non reconnue -> exchange:null, jamais une place inventée. */
  async yahoo(q, key) {
    const d = await getJSON(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=15&newsCount=0`,
      9000, YAHOO_UA
    );
    const CANON_DEPUIS_EXCHDISP = {
      NASDAQ: 'NASDAQ', NYSE: 'NYSE', NYSEArca: 'NYSE ARCA', 'NYSE American': 'US',
      Paris: 'PA', Amsterdam: 'AS', XETRA: 'DE', Milan: 'MI', Swiss: 'SW',
      LSE: 'L', Toronto: 'TO', ASX: 'AU', HKSE: 'HK', Shanghai: 'SHG',
      Shenzhen: 'SHE', KSE: 'KO', Taiwan: 'TW', Helsinki: 'HE',
      Stockholm: 'ST', Copenhagen: 'CO', Oslo: 'OL', Brussels: 'BR', Lisbon: 'LS',
    };
    return (d?.quotes || [])
      .filter(x => x && x.symbol && (x.quoteType === 'EQUITY' || x.quoteType === 'ETF'))
      .map(x => ({
        name: txt(x.longname || x.shortname),
        ticker: tickerDepuisSymboleYahoo(x.symbol),
        exchange: CANON_DEPUIS_EXCHDISP[x.exchDisp] || null,
        country: null,
        currency: null,
        type: x.quoteType === 'ETF' ? 'ETF' : 'Common Stock',
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
  /* Yahoo Finance (voir le bloc de garanties/avertissement juridique plus
     haut) : /v8/finance/chart sert à la fois la cotation (meta) et
     l'historique (HISTORY.yahoo plus bas) — 2 appels distincts malgré
     tout, chacun avec son propre cache (`quote`/`history`, _cache.js),
     cohérent avec le reste de l'architecture (jamais un appel partagé
     entre 2 blocs différents). Fraîcheur mesurée en direct (2026-10-06) :
     6 secondes d'écart entre regularMarketTime et l'horodatage réel —
     mais freshnessCotation() reste DELAYED par défaut (voir
     _freshness.js) : aucune garantie contractuelle de ce délai, jamais
     présenté comme un SLA. */
  async yahoo(ticker, exchange, type, key) {
    const symbole = yahooSymbole(ticker, exchange, type);
    if (!symbole) throw new Error('type_sans_convention_yahoo');

    const d = await getJSON(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbole)}?range=5d&interval=1d`,
      9000, YAHOO_UA
    );
    const r = d?.chart?.result?.[0];
    const m = r?.meta;
    if (!m || num(m.regularMarketPrice) === null) {
      throw new Error(d?.chart?.error?.description || 'vide');
    }

    const q = r?.indicators?.quote?.[0];
    const dernierIdx = Array.isArray(q?.close) ? q.close.length - 1 : -1;
    const ouverture = dernierIdx >= 0 ? num(q.open[dernierIdx]) : null;

    const prix = num(m.regularMarketPrice);
    const cloturePrecedente = num(m.chartPreviousClose ?? m.previousClose);
    const variation = Number.isFinite(prix) && Number.isFinite(cloturePrecedente)
      ? prix - cloturePrecedente : num(m.fulldayChange);

    return {
      price: prix,
      change: variation,
      changePercent: num(m.regularMarketChangePercent ?? m.fulldayChangePercent),
      previousClose: cloturePrecedente,
      open: ouverture,
      high: num(m.regularMarketDayHigh),
      low: num(m.regularMarketDayLow),
      volume: num(m.regularMarketVolume),
      currency: txt(m.currency),
      timestamp: Number.isFinite(m.regularMarketTime) ? new Date(m.regularMarketTime * 1000).toISOString() : null,
    };
  },

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

  /* Taux croisé RÉEL (prix USD Eulerpool × taux de change Frankfurter/BCE),
     jamais une estimation — voir eulerpoolCommodityRefCroise. Source
     distincte ('eulerpool_fx', jamais confondue avec 'eulerpool' seul) :
     transparence totale sur le fait qu'il s'agit d'une conversion, pas
     d'une cotation native dans cette devise. */
  async eulerpool_fx(ticker, exchange, type, key) {
    if (type !== 'commodity') throw new Error('type_non_supporte_par_eulerpool_fx');
    const ref = eulerpoolCommodityRefCroise(ticker);
    if (!ref) throw new Error('commodite_non_reconnue_par_eulerpool_fx');

    const prixUSD = await eulerpoolCommodityQuotesBrutes(ref.id, key);
    if (!prixUSD.length) throw new Error('vide');

    const dernierPrix = prixUSD[0];
    const precedentPrix = prixUSD.length >= 2 ? prixUSD[1] : null;

    /* Fenêtre Frankfurter couvrant les deux dates de prix RÉELLEMENT
       reçues (pas "aujourd'hui" — voir eulerpoolCommodityQuotesBrutes,
       le flux Eulerpool peut dater de plusieurs mois). */
    const dateLaPlusAncienne = precedentPrix ? precedentPrix.date : dernierPrix.date;
    const jours = Math.max(5, Math.ceil((Date.now() - Date.parse(dateLaPlusAncienne)) / 86400000) + 5);
    const tauxSerie = await frankfurterSeries('USD', ref.quoteCurrency, jours);
    if (!tauxSerie.length) throw new Error('taux_de_change_indisponible');

    const tauxParDate = new Map(tauxSerie.map(t => [t.date, t.rate]));
    const datesTriees = tauxSerie.map(t => t.date);

    const tauxDernier = tauxLePlusProcheAvant(tauxParDate, datesTriees, dernierPrix.date);
    if (tauxDernier === null) throw new Error('taux_de_change_indisponible');

    const prixConverti = dernierPrix.close * tauxDernier;
    let changePercent = null, change = null;
    if (precedentPrix) {
      const tauxPrecedent = tauxLePlusProcheAvant(tauxParDate, datesTriees, precedentPrix.date);
      if (tauxPrecedent !== null) {
        const precedentConverti = precedentPrix.close * tauxPrecedent;
        change = prixConverti - precedentConverti;
        changePercent = precedentConverti ? (change / precedentConverti) * 100 : null;
      }
    }

    return {
      price: prixConverti,
      change,
      changePercent,
      previousClose: null,
      open: null,
      high: null,
      low: null,
      volume: null,
      currency: ref.quoteCurrency,
      timestamp: dernierPrix.date,
    };
  },
};

/* ============================================================
   FONDAMENTAUX — REPLIS DE SYMBOLE EULERPOOL (clé "TICKER@EXCHANGE",
   même convention que instrumentKey() dans _router.js)
   ============================================================
   Aucune valeur ci-dessous n'est devinée : ROG vérifié en direct (voir
   commentaire dans FUNDAMENTALS.eulerpool) ; chaque ISIN vient de la
   réponse réelle d'EODHD /exchange-symbol-list pour l'exchange exact de
   ce ticker (jamais recalculé/fabriqué), et a été testé avec succès
   contre l'endpoint réel Eulerpool avant intégration. */
const EULERPOOL_TICKER_OVERRIDE = {
  'RO@SW': 'ROG',
  'SRT3@DE': 'SRT',
};

const EULERPOOL_ISIN_OVERRIDE = {
  'STLAP@PA': 'NL00150001Q9',
  'QIA@DE': 'NL0015002SN0',
  'BT-A@L': 'GB0030913577',
  'DSFIR@AS': 'CH1216478797',
  'RAND@AS': 'NL0000379121',
  'KPN@AS': 'NL0000009082',
  'NN@AS': 'NL0010773842',
  'ASM@AS': 'NL0000334118',
  'AKZA@AS': 'NL0013267909',
  'MT@AS': 'LU1598757687',
  'IBE@MC': 'ES0144580Y14',
  'SAN@MC': 'ES0113900J37',
  'BBVA@MC': 'ES0113211835',
  'ITX@MC': 'ES0148396007',
  'REP@MC': 'ES0173516115',
  'TEF@MC': 'ES0178430E18',
  'CABK@MC': 'ES0140609019',
  'AMS@MC': 'ES0109067019',
  'FER@MC': 'NL0015001FS8',
  'NTGY@MC': 'ES0116870314',
  'ELE@MC': 'ES0130670112',
  'AENA@MC': 'ES0105046017',
  'INVE-B@ST': 'SE0015811963',
  'ATCO-A@ST': 'SE0017486889',
  'VOLV-B@ST': 'SE0000115446',
  'ERIC-B@ST': 'SE0000108656',
  'HM-B@ST': 'SE0000106270',
  'HEXA-B@ST': 'SE0015961909',
  'SEB-A@ST': 'SE0000148884',
  'SWED-A@ST': 'SE0000242455',
  'ASSA-B@ST': 'SE0007100581',
  'ESSITY-B@ST': 'SE0009922164',
  'SKA-B@ST': 'SE0000113250',
  'SKF-B@ST': 'SE0000108227',
  'EPI-A@ST': 'SE0015658109',
  'NOVO-B@CO': 'DK0062498333',
  'MAERSK-B@CO': 'DK0010244508',
  'CARL-B@CO': 'DK0010181759',
  'COLO-B@CO': 'DK0060448595',
  'NSIS-B@CO': 'DK0060336014',
  'SHOP@TO': 'CA82509L1076',
  'BHP@AU': 'AU000000BHP4',
  'CBA@AU': 'AU000000CBA7',
  'CSL@AU': 'AU000000CSL8',
  'NAB@AU': 'AU000000NAB4',
  'WBC@AU': 'AU000000WBC1',
  'ANZ@AU': 'AU000000ANZ3',
  'WES@AU': 'AU000000WES1',
  'WOW@AU': 'AU000000WOW2',
  'TLS@AU': 'AU000000TLS2',
  'FMG@AU': 'AU000000FMG4',
  'MQG@AU': 'AU000000MQG1',
  'GMG@AU': 'AU000000GMG2',
  'TCL@AU': 'AU000000TCL6',
  'STO@AU': 'AU000000STO6',
  'WDS@AU': 'AU0000224040',
  'REA@AU': 'AU000000REA9',
  'COL@AU': 'AU0000030678',
  'QBE@AU': 'AU000000QBE9',
  'ALL@AU': 'AU000000ALL7',
};

/* ============================================================
   FONDAMENTAUX
   ============================================================ */

const { secedgar } = require('./_secEdgar.js');

const FUNDAMENTALS = {
  /* Yahoo Finance (voir le bloc de garanties/avertissement juridique plus
     haut) : LE PLUS FRAGILE des 6 blocs Yahoo ajoutés le 2026-10-06 — seul
     à exiger le flux cookie+crumb (crumbYahoo()), qui peut cesser de
     fonctionner si Yahoo durcit encore ses protections (déjà arrivé une
     fois pour /v7/finance/quote, abandonné pour BATCH.yahoo ci-dessus).
     Échec du crumb -> erreur normale de cascade, repli immédiat vers
     secedgar/finnhub/eulerpool, jamais une exception qui casserait la
     page. Couverture snapshot uniquement (pas de revenueSeries/epsSeries/
     fcfSeries historiques ici — demanderait des modules supplémentaires
     plus fragiles encore) : utile surtout pour les valeurs EUROPÉENNES,
     que secedgar (US uniquement) ne couvre jamais. */
  async yahoo(ticker, exchange, key) {
    const session = await crumbYahoo();
    if (!session) throw new Error('crumb_indisponible');

    const symbole = yahooSymbole(ticker, exchange, 'stock');
    if (!symbole) throw new Error('type_sans_convention_yahoo');

    const modules = 'financialData,defaultKeyStatistics,summaryDetail,assetProfile,price';
    const d = await getJSON(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbole)}`
      + `?modules=${modules}&crumb=${encodeURIComponent(session.crumb)}`,
      9000, { ...YAHOO_UA, cookie: session.cookie }
    );
    const r = d?.quoteSummary?.result?.[0];
    if (!r) throw new Error(d?.quoteSummary?.error?.description || 'vide');

    const brut = (obj, champ) => (obj && obj[champ] && typeof obj[champ].raw === 'number') ? obj[champ].raw : null;
    const fd = r.financialData || {};
    const ks = r.defaultKeyStatistics || {};
    const sd = r.summaryDetail || {};
    const ap = r.assetProfile || {};

    const fundamentals = {
      revenue: brut(fd, 'totalRevenue'),
      netIncome: null, // non fourni par financialData ; pas de 2e module série dans cette passe
      revenueSeries: null,
      epsSeries: null,
      fcfSeries: null,
      eps: brut(ks, 'trailingEps'),
      profitMargin: brut(fd, 'profitMargins'),
      operatingMargin: brut(fd, 'operatingMargins'),
      roe: brut(fd, 'returnOnEquity'),
      debt: brut(fd, 'totalDebt'),
      cash: brut(fd, 'totalCash'),
      freeCashFlow: brut(fd, 'freeCashflow'),
      pe: brut(sd, 'trailingPE'),
      forwardPE: brut(ks, 'forwardPE'),
      priceToBook: brut(ks, 'priceToBook'),
      evToEbitda: brut(ks, 'enterpriseToEbitda'),
      dividendYield: brut(sd, 'dividendYield'),
      marketCap: brut(sd, 'marketCap'),
    };
    if (Object.values(fundamentals).every(v => v === null)) throw new Error('aucun_champ_exploitable');

    return {
      identity: {
        name: txt(r.price?.longName || r.price?.shortName),
        exchange: txt(r.price?.exchangeName),
        country: txt(ap.country),
        currency: txt(r.price?.currency),
        sector: txt(ap.sector),
        industry: txt(ap.industry),
        isin: null,
        description: txt(ap.longBusinessSummary),
        website: txt(ap.website),
        employees: Number.isFinite(ap.fullTimeEmployees) ? ap.fullTimeEmployees : null,
        ipoDate: null,
      },
      fundamentals,
      asOf: new Date().toISOString().slice(0, 10),
    };
  },

  /* Repli fondamentaux US (voir _secEdgar.js pour le détail des concepts
     XBRL couverts/exclus et les vérifications en direct effectuées avant
     intégration). Fonction définie dans un module séparé — SANS
     dépendance vers ce fichier (éviterait un require circulaire, puisque
     ce fichier-ci importe _secEdgar.js) — simplement référencée ici pour
     rejoindre le même objet FUNDAMENTALS que les autres fournisseurs. */
  secedgar,

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

  /* Repli pour les actions dont EODHD refuse les fondamentaux (HTTP 403,
     "Forbidden" — confirmé en production pour plusieurs actions
     européennes, ex. RMS.PA/Hermès : limite de PLAN EODHD, pas un problème
     de symbole ni de code). Schéma RÉEL vérifié en direct (endpoint
     /equity/metrics/{ticker.exchange}, ex. "RMS.PA" — "RMS" seul renvoie
     404 "Security not found", confirmé empiriquement) avant d'écrire ce
     mapping. Champs disponibles très différents d'EODHD : jamais forcés
     dans un champ qui ne correspond pas exactement (ex. `debt` reste null
     ici — Eulerpool ne donne qu'un `netDebt` combiné dette-trésorerie,
     pas les deux séparément comme EODHD ; forcer l'un dans l'autre serait
     une approximation déguisée). Signature à 3 paramètres avant la clé
     (ticker, exchange, key) — comme FUNDAMENTALS.eodhd/finnhub ci-dessus,
     PAS comme QUOTE.eulerpool : ce bloc n'est jamais appelé que pour
     type==='stock' (filtré en amont par fundamentals.js/_router.js), un
     paramètre `type` supplémentaire ici décalerait silencieusement `key`
     et casserait tout appel (cascade() passe args+key dans cet ordre). */
  async eulerpool(ticker, exchange, key) {
    /* CORRECTIF (audit couverture fondamentaux européens) : le symbole
       "TICKER.EXCHANGE" (convention EODHD) ne correspond PAS toujours au
       symbole interne d'Eulerpool — confirmé en production : Roche
       (ticker NovaBourse "RO", place "SW") n'existe chez Eulerpool que
       sous "ROG.SW", jamais "RO.SW". EULERPOOL_TICKER_OVERRIDE corrige
       ce cas précis (jamais deviné — "ROG.SW" vérifié en direct avant
       intégration).
       Plus généralement, 40 valeurs néerlandaises/espagnoles/suédoises/
       danoises échouaient TOUTES avec "TICKER.EXCHANGE" alors qu'elles
       existent réellement chez Eulerpool — leurs docs (equity/*) donnent
       eux-mêmes un ISIN en exemple d'identifiant, jamais un ticker.
       Testé et confirmé en direct : interroger Eulerpool par ISIN RÉEL
       (récupéré depuis EODHD /exchange-symbol-list, jamais fabriqué)
       fonctionne pour 40/42 valeurs qui échouaient par ticker — d'où le
       repli ISIN ci-dessous, tenté UNIQUEMENT si le ticker échoue
       d'abord (préserve le chemin existant, déjà fonctionnel, pour
       toutes les valeurs qui n'ont jamais eu besoin de ce repli). */
    const cleInstrument = `${String(ticker || '').toUpperCase()}@${String(exchange || '').toUpperCase()}`;
    const tickerEulerpool = EULERPOOL_TICKER_OVERRIDE[cleInstrument] || ticker;
    const symbolePrincipal = exchange ? `${tickerEulerpool}.${exchange}` : tickerEulerpool;
    const isinRepli = EULERPOOL_ISIN_OVERRIDE[cleInstrument] || null;

    /* /equity/metrics (chiffres) ET /equity/profile (identité — name,
       country, sector, industry : schéma réel vérifié en direct sur AAPL,
       Hermès (RMS.PA) et SAP (SAP.DE) avant intégration, voir rapport) en
       parallèle : deux appels, mais
       jamais plus d'un par bloc réellement chargé (ni l'un ni l'autre
       n'est redemandé tant que le cache 12h de _cache.js reste valide).
       /equity/profile peut échouer indépendamment de /equity/metrics
       (droits de plan potentiellement différents par endpoint) — son
       échec ne doit jamais faire échouer les CHIFFRES, qui sont
       l'information principale de ce bloc ; l'identité reste alors
       simplement null, jamais devinée. */
    const interroger = async (symbole) => Promise.all([
      getJSON(
        `https://api.eulerpool.com/api/1/equity/metrics/${encodeURIComponent(symbole)}`
        + `?token=${encodeURIComponent(key)}`,
        12000
      ),
      getJSON(
        `https://api.eulerpool.com/api/1/equity/profile/${encodeURIComponent(symbole)}`
        + `?token=${encodeURIComponent(key)}`,
        12000
      ).catch(() => null),
    ]);

    /* getJSON() (voir plus haut dans ce fichier) LÈVE une exception sur
       tout statut HTTP non-2xx (404 "Security not found" inclus) — sans
       ce try/catch, le repli ISIN ci-dessous ne serait JAMAIS atteint :
       une 404 sur le ticker interromprait la fonction avant même
       d'arriver au test `!d.valuation`. Piège déjà rencontré une fois
       dans cette passe (constaté en production avant ce correctif). */
    let d, profil;
    try {
      [d, profil] = await interroger(symbolePrincipal);
    } catch (erreurTicker) {
      if (!isinRepli) throw erreurTicker;
      [d, profil] = await interroger(isinRepli);
    }

    if (!d || typeof d !== 'object' || !d.valuation) throw new Error('vide');

    const valuation = d.valuation || {};
    const profitability = d.profitability || {};
    const perShare = d.perShare || {};
    const historique = Array.isArray(d.historical) ? d.historical : [];

    /* Le plus récent exercice réel (le tableau `historical` est déjà trié
       du plus récent au plus ancien, vérifié empiriquement). */
    const dernierExercice = historique[0] || {};

    /* Séries (5 exercices, même convention que periodes() côté EODHD
       ci-dessus) — Eulerpool en fournit jusqu'à 11 ans, plus que EODHD,
       mais on garde la même profondeur pour rester cohérent partout où
       ces séries sont consommées (croissanceSerie() côté frontend n'a de
       toute façon besoin que de 2 exercices consécutifs). */
    const serie = (champ) => {
      const lignes = historique
        .filter(h => h && /^\d{4}-\d{2}-\d{2}$/.test(String(h.period)) && num(h[champ]) !== null)
        .slice(0, 5)
        .map(h => ({ date: h.period, annee: num(h.year) ?? Number(String(h.period).slice(0, 4)), valeur: num(h[champ]) }));
      return lignes.length ? lignes : null;
    };

    /* `valuation.pe`/`ps`/`pebit` valent exactement 0 quand Eulerpool n'a
       pas pu calculer le ratio pour ce titre précis (constaté : RMS.PA a
       pe=0/ps=0/pebit=0 alors que pb=7.65 et marketCap sont, eux, réels —
       un PER de 0 n'existe pas pour une société bénéficiaire) — traité
       comme "absent", jamais affiché comme un vrai zéro. */
    const ratioOuNull = v => (Number.isFinite(v) && v !== 0) ? v : null;

    return {
      identity: {
        name: txt(profil?.name),
        exchange: null,
        country: txt(profil?.country),
        currency: txt(d.currency),
        sector: txt(profil?.sector),
        industry: txt(profil?.industry),
        isin: txt(d.isin) || txt(profil?.isin),
      },

      fundamentals: {
        revenue: num(dernierExercice.revenue),
        netIncome: num(dernierExercice.netIncome),
        revenueSeries: serie('revenue'),
        epsSeries: serie('eps'),
        /* Aucun champ "free cash flow" dans /equity/metrics (existe peut-être
           via /equity/cashflowstatement, non branché dans cette passe —
           jamais deviné depuis un autre champ). */
        fcfSeries: null,

        eps: num(perShare.eps),
        /* grossMargin/operatingMargin/netMargin sont en POINTS DE
           POURCENTAGE chez Eulerpool (ex. 28.49 = 28,49 %), confirmé
           empiriquement — contrairement à EODHD (ratio 0-1). Divisé par
           100 ici pour respecter la convention ratio déjà utilisée
           partout ailleurs dans ce fichier (voir measureText() côté
           frontend, qui applique fmt.pctRatio à ce champ). */
        profitMargin: num(profitability.netMargin) !== null ? num(profitability.netMargin) / 100 : null,
        operatingMargin: num(profitability.operatingMargin) !== null ? num(profitability.operatingMargin) / 100 : null,
        /* roe, lui, est DÉJÀ un ratio 0-1 chez Eulerpool (0.24 = 24 %,
           confirmé) — cohérent avec EODHD, aucune conversion. */
        roe: num(profitability.roe),

        /* Eulerpool ne sépare pas dette brute et trésorerie (seulement un
           `netDebt` combiné) — jamais approximé dans l'un ou l'autre champ. */
        debt: null,
        cash: null,
        freeCashFlow: null,

        pe: ratioOuNull(num(valuation.pe)),
        forwardPE: null,
        priceToBook: num(valuation.pb),
        evToEbitda: num(valuation.evEbitda),
        dividendYield: num(perShare.dividendYield),
        /* `valuation.marketCap` est en MILLIONS chez Eulerpool (144217.59
           pour Hermès ≈ 144,2 Md€, confirmé en comparant à l'ordre de
           grandeur réel de la société) — ×1e6 pour rejoindre la
           convention "valeur absolue" déjà utilisée par EODHD ailleurs
           dans ce fichier (voir capEnMilliards() côté frontend, qui
           suppose déjà cette convention par défaut). */
        marketCap: num(valuation.marketCap) !== null ? num(valuation.marketCap) * 1e6 : null,

        /* Consensus analystes : endpoint distinct (/equity/analyst-grades),
           non branché dans cette passe — jamais deviné depuis /metrics. */
        analystRatings: null,
        wallStreetTargetPrice: null,
        epsEstimateCurrentYear: null,
        epsEstimateNextYear: null,
        epsEstimateCurrentQuarter: null,
        epsEstimateNextQuarter: null,
      },

      asOf: txt(dernierExercice.period),
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
  /* Yahoo Finance (voir le bloc de garanties/avertissement juridique plus
     haut dans ce fichier) : remplace EODHD, qui était l'UNIQUE
     fournisseur de news par action avant ce correctif (2026-10-06),
     aucun repli possible en cas d'échec/clé absente. Même endpoint que
     SEARCH.yahoo (/v1/finance/search), avec newsCount : un seul appel
     réseau sert les 2 blocs si jamais appelés ensemble (pas le cas
     actuellement, mais aucun coût supplémentaire si ça change). Pas de
     `sentiment`/`tags` côté Yahoo (jamais inventés, restent null/[]) ;
     `symbols` reconstruit depuis relatedTickers quand fourni.
     LIMITE RÉELLE CONFIRMÉE (2026-10-06) : interroger Yahoo avec le
     symbole EXACT suffixé (ex. "MC.PA", "SAP.DE") renvoie souvent ZÉRO
     actualité, même quand des articles existent (vérifié : q=MC.PA et
     q=LVMH.PA renvoient 0 résultat, alors que q=LVMH, lui, en renvoie 5).
     Chercher par le TICKER NU résoudrait ça pour beaucoup de valeurs
     européennes, mais réintroduirait la MÊME collision que "MC" déjà
     documentée ailleurs (Moelis & Co apparaîtrait sous le nom de LVMH) —
     volontairement NON tenté ici : un "aucune actualité disponible"
     honnête est préférable à une actualité attribuée à la mauvaise
     société. Limite connue, pas un bug à corriger silencieusement. */
  async yahoo(ticker, exchange, limit, type, key) {
    if (type !== 'stock' && type !== 'etf') {
      throw new Error('type_sans_actualites');
    }
    const symbole = yahooSymbole(ticker, exchange, type);
    if (!symbole) throw new Error('type_sans_convention_yahoo');

    const n = Math.max(1, Math.min(20, Math.round(limit) || 10));
    const d = await getJSON(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbole)}&quotesCount=0&newsCount=${n}`,
      9000, YAHOO_UA
    );
    const nouvelles = Array.isArray(d?.news) ? d.news : [];
    if (!nouvelles.length) throw new Error('aucune_actualite_recue');

    return nouvelles.map(a => ({
      date: Number.isFinite(a.providerPublishTime) ? new Date(a.providerPublishTime * 1000).toISOString() : null,
      title: txt(a.title),
      link: txt(a.link),
      summary: null,
      symbols: Array.isArray(a.relatedTickers) ? a.relatedTickers.filter(s => typeof s === 'string') : [],
      tags: [],
      sentiment: null,
    }));
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

    let high = num(ligne.high);
    let low = num(ligne.low);
    /* Rupture OHLC physiquement impossible (section 21 : "détecte les
       ruptures absurdes... ne corrige jamais silencieusement") : si
       high < low, AUCUN des deux n'est fiable individuellement — on ne
       devine pas lequel des deux champs est en faute, les deux repassent
       à null. `close` (déjà validé > 0 ci-dessus) et `open` restent
       inchangés : le point garde sa valeur la plus sûre plutôt que d'être
       rejeté en bloc pour une anomalie sur deux champs annexes. Le
       frontend gère déjà ce cas (repli sur les clôtures quand haut/bas
       manquent, voir chartProShell dans index.html). */
    if (high !== null && low !== null && high < low) {
      high = null;
      low = null;
    }

    let volume = num(ligne.volume);
    /* Un volume négatif n'a aucun sens réel (jamais un nombre d'actions
       négatif) : traité comme une valeur absente plutôt que conservé tel
       quel ou deviné à 0. */
    if (volume !== null && volume < 0) volume = null;

    map.set(
      cle,
      {
        date: cle,

        open:
          num(
            ligne.open
          ),

        high,

        low,

        close,

        volume,
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

    /* Mêmes garde-fous que normaliserHistorique() ci-dessus (section 21) :
       high < low => les deux repassent à null plutôt qu'une valeur
       devinée ; volume négatif => null plutôt que conservé tel quel. */
    let high = num(ligne?.high);
    let low = num(ligne?.low);
    if (high !== null && low !== null && high < low) { high = null; low = null; }
    let volume = num(ligne?.volume);
    if (volume !== null && volume < 0) volume = null;

    map.set(timestamp, {
      date: new Date(timestamp).toISOString(),
      open: num(ligne?.open),
      high,
      low,
      close,
      volume,
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
  /* Yahoo Finance (voir le bloc de garanties/avertissement juridique plus
     haut) : testé en direct jusqu'à 2 ans (501 points quotidiens, AAPL)
     sans trou. `range` choisi par palier plutôt que par jour exact (API
     Yahoo n'accepte qu'un ensemble fixe de valeurs, voir validRanges
     dans la réponse réelle) — le palier immédiatement supérieur au
     nombre de jours demandé est toujours sûr (jamais moins de données
     que demandé). */
  async yahoo(ticker, exchange, n, type, key) {
    const symbole = yahooSymbole(ticker, exchange, type);
    if (!symbole) throw new Error('type_sans_convention_yahoo');

    const jours = joursHistorique(n);
    const range = jours <= 5 ? '5d' : jours <= 30 ? '1mo' : jours <= 90 ? '3mo'
      : jours <= 180 ? '6mo' : jours <= 365 ? '1y' : jours <= 730 ? '2y'
      : jours <= 1825 ? '5y' : jours <= 3650 ? '10y' : 'max';

    const d = await getJSON(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbole)}?range=${range}&interval=1d`,
      12000, YAHOO_UA
    );
    const r = d?.chart?.result?.[0];
    const timestamps = r?.timestamp;
    const q = r?.indicators?.quote?.[0];
    const adj = r?.indicators?.adjclose?.[0]?.adjclose;
    if (!Array.isArray(timestamps) || !q) {
      const error = new Error(d?.chart?.error?.description || 'aucune_ligne_recue');
      error.symbole = symbole;
      throw error;
    }

    const recues = timestamps.length;
    const brutes = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: num(q.open?.[i]),
      high: num(q.high?.[i]),
      low: num(q.low?.[i]),
      /* adjclose évite les ruptures artificielles liées aux splits/
         dividendes — même principe que adjusted_close côté EODHD plus
         haut. */
      close: num(adj?.[i] ?? q.close?.[i]),
      volume: num(q.volume?.[i]),
    })).filter(l => l.close !== null); // séance sans échange réel (jour férié partiel) -> écartée, jamais un 0 inventé

    const lignes = normaliserHistorique(brutes);
    if (!lignes.length) {
      const error = new Error(recues ? `zero_ligne_apres_normalisation (recues:${recues})` : 'aucune_ligne_recue');
      error.symbole = symbole;
      error.recues = recues;
      throw error;
    }
    lignes.recues = recues;
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

  /* Série de taux croisés RÉELS (voir QUOTE.eulerpool_fx pour la même
     logique, appliquée ici point par point plutôt qu'à un seul instant). */
  async eulerpool_fx(ticker, exchange, n, type, key) {
    if (type !== 'commodity') throw new Error('type_non_supporte_par_eulerpool_fx');
    const ref = eulerpoolCommodityRefCroise(ticker);
    if (!ref) throw new Error('commodite_non_reconnue_par_eulerpool_fx');

    const jours = joursHistorique(n);
    const triesUSD = await eulerpoolCommodityQuotesBrutes(ref.id, key);
    const pointsUSD = eulerpoolFenetreJours(triesUSD, jours);
    const recues = pointsUSD.length;
    if (!pointsUSD.length) throw new Error('aucune_ligne_recue');

    const dateLaPlusAncienne = pointsUSD[pointsUSD.length - 1].date;
    const joursCouverture = Math.max(5, Math.ceil((Date.now() - Date.parse(dateLaPlusAncienne)) / 86400000) + 5);
    const tauxSerie = await frankfurterSeries('USD', ref.quoteCurrency, joursCouverture);
    if (!tauxSerie.length) throw new Error('taux_de_change_indisponible');

    const tauxParDate = new Map(tauxSerie.map(t => [t.date, t.rate]));
    const datesTriees = tauxSerie.map(t => t.date);

    const brutes = pointsUSD
      .map(p => {
        const taux = tauxLePlusProcheAvant(tauxParDate, datesTriees, p.date);
        return taux === null ? null : { date: p.date, open: null, high: null, low: null, close: p.close * taux, volume: null };
      })
      .filter(Boolean);

    const lignes = normaliserHistorique(brutes);
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
  /* Yahoo Finance (voir le bloc de garanties/avertissement juridique plus
     haut) : /v8/finance/chart accepte directement un `interval`
     infra-journalier (1m/5m/15m/30m/60m) — conversion triviale depuis les
     clés NovaBourse (INTRADAY_MINUTES). `range=5d` plutôt que `1d` : une
     séance qui vient de clôturer (hors heures de marché côté serveur)
     renverrait sinon 0 barre avec range=1d — 5 jours couvre ce cas sans
     jamais renvoyer plus que ce que normaliserIntraday() garde de toute
     façon (fenêtre glissante). */
  async yahoo(ticker, exchange, interval, jours, type, key) {
    const minutesDemandees = INTRADAY_MINUTES[interval];
    if (!minutesDemandees) throw new Error('intervalle_non_supporte');

    const symbole = yahooSymbole(ticker, exchange, type);
    if (!symbole) throw new Error('type_sans_convention_yahoo');

    const INTERVALLE_YAHOO = { '1min': '1m', '5min': '5m', '15min': '15m', '30min': '30m', '1h': '60m' };
    const d = await getJSON(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbole)}`
      + `?range=5d&interval=${INTERVALLE_YAHOO[interval]}`,
      12000, YAHOO_UA
    );
    const r = d?.chart?.result?.[0];
    const timestamps = r?.timestamp;
    const q = r?.indicators?.quote?.[0];
    if (!Array.isArray(timestamps) || !q) {
      throw new Error(d?.chart?.error?.description || 'vide');
    }

    const recues = timestamps.length;
    const lignes = normaliserIntraday(
      timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString(),
        open: num(q.open?.[i]),
        high: num(q.high?.[i]),
        low: num(q.low?.[i]),
        close: num(q.close?.[i]),
        volume: num(q.volume?.[i]),
      }))
    );
    if (!lignes.length) throw new Error('zero_ligne_apres_normalisation');
    lignes.recues = recues;
    return lignes;
  },

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
   COUPE-CIRCUIT QUOTA JOURNALIER
   ============================================================
   Constaté en production (2026-09-29) : Twelve Data renvoie HTTP 429
   avec le message exact "You have run out of API credits for the day"
   quand le quota QUOTIDIEN (pas juste la limite par minute) est épuisé
   — un signal GLOBAL, valable pour TOUTE requête à venir aujourd'hui,
   pas un échec ponctuel du symbole demandé. Différent de MEMOIRE
   (_router.js), qui ne fait que réordonner un fournisseur par
   instrument sans jamais l'écarter : sans ce coupe-circuit, chaque
   lot/instrument continuait de retenter Twelve Data en pure perte
   (1 aller-retour réseau voué à l'échec par appel) jusqu'à ce que le
   quota redevienne disponible de lui-même. TTL volontairement modéré
   (15 min, jamais "jusqu'à demain") : l'heure exacte de
   réinitialisation du quota Twelve Data n'est pas documentée avec
   certitude — mieux vaut redécouvrir un peu trop tôt qu'attendre sur
   une hypothèse fausse. Générique par nom de fournisseur : s'applique
   à n'importe lequel s'il renvoie un jour le même type de signal,
   jamais codé en dur pour Twelve Data seul. */
const PROVIDER_COUPE_JUSQUA = new Map();
const COUPE_CIRCUIT_DUREE_MS = 15 * 60 * 1000;

function fournisseurCoupe(nom) {
  const jusqua = PROVIDER_COUPE_JUSQUA.get(nom);
  if (!jusqua) return false;
  if (Date.now() >= jusqua) {
    PROVIDER_COUPE_JUSQUA.delete(nom);
    return false;
  }
  return true;
}

/**
 * @param {string} nom - nom du fournisseur (clé de KEYS()/table)
 * @param {*} corpsErreur - error.body de l'appel qui a échoué
 * @returns {boolean} true si CE signal précis (quota journalier épuisé)
 *   a été reconnu et le coupe-circuit activé — false pour toute autre
 *   erreur (HTTP 429 "par minute", panne réseau, etc.), qui reste gérée
 *   normalement (nouvelle tentative au prochain appel, jamais coupée).
 */
function signalerQuotaEpuise(nom, corpsErreur) {
  const texte = String(corpsErreur || '');
  if (!/run out of API credits for the day/i.test(texte)) return false;
  PROVIDER_COUPE_JUSQUA.set(nom, Date.now() + COUPE_CIRCUIT_DUREE_MS);
  return true;
}

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

    if (fournisseurCoupe(nom)) {
      journal.push({ bloc, provider: nom, ok: false, reason: 'quota_journalier_epuise_connu' });
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
      signalerQuotaEpuise(nom, error.body);

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
    /* Pas de vrai endpoint batch chez Yahoo : /v7/finance/quote (jusqu'à
       plusieurs symboles en 1 appel) exige désormais le même cookie+
       crumb que FUNDAMENTALS.yahoo ET renvoie 401 "User is unable to
       access this feature" même une fois le crumb fourni (vérifié en
       direct, 2026-10-06) — abandonné comme trop fragile pour un chemin
       aussi sollicité (Marchés/Radar/accueil). BATCH.yahoo ci-dessous
       interroge /v8/finance/chart EN PARALLÈLE, un appel par symbole :
       plus de requêtes réseau qu'un vrai batch, mais chaque requête est
       indépendante et sans authentification — jamais un seul point de
       défaillance partagé. Limite = MAX_SYMBOLES (quotes.js) : un seul
       "lot" couvrant tout, Promise.all gère le parallélisme réel. */
    yahoo:
      120,

    twelvedata:
      120,

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

    /* Taux croisés (voir eulerpoolCommodityRefCroise) : au plus 2
       commodités (XAU/XAG — WTI n'a pas de paire croisée au catalogue) ×
       les devises Frankfurter du catalogue NovaBourse pour ces deux
       commodités précises, jamais plus. */
    eulerpool_fx:
      15,
  },

  async yahoo(valeurs, key) {
    const resultats = await Promise.allSettled(
      valeurs.map(async v => {
        const symbole = yahooSymbole(v.ticker, v.exchange, v.type);
        if (!symbole) throw new Error('type_sans_convention_yahoo');
        const d = await getJSON(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbole)}?range=5d&interval=1d`,
          9000, YAHOO_UA
        );
        const m = d?.chart?.result?.[0]?.meta;
        const prix = num(m?.regularMarketPrice);
        if (prix === null) throw new Error('vide');
        const cloturePrecedente = num(m.chartPreviousClose ?? m.previousClose);
        return {
          src: v,
          quote: {
            symbol: idDe(v),
            ticker: v.ticker,
            exchange: v.exchange,
            price: prix,
            change: Number.isFinite(cloturePrecedente) ? prix - cloturePrecedente : num(m.fulldayChange),
            changePercent: num(m.regularMarketChangePercent ?? m.fulldayChangePercent),
            currency: txt(m.currency),
            timestamp: Number.isFinite(m.regularMarketTime) ? new Date(m.regularMarketTime * 1000).toISOString() : null,
          },
        };
      })
    );

    const out = new Map();
    for (const r of resultats) {
      if (r.status === 'fulfilled') out.set(idDe(r.value.src), r.value.quote);
    }
    if (!out.size) throw new Error('aucune_ligne_exploitable');
    return out;
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

  async eulerpool_fx(valeurs, key) {
    const compatibles = valeurs.filter(v => v.type === 'commodity' && eulerpoolCommodityRefCroise(v.ticker));
    const out = new Map();

    for (const v of compatibles.slice(0, BATCH.limite.eulerpool_fx)) {
      try {
        const q = await QUOTE.eulerpool_fx(v.ticker, v.exchange, 'commodity', key);
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
        // Une paire individuelle ne doit pas faire échouer tout le lot.
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
  fournisseurCoupe,
  signalerQuotaEpuise,

  KEYS,

  num,
  txt,
  isoUnix,

  getJSON,

  yahooSymbole,
  tickerDepuisSymboleYahoo,
  YAHOO_SUFFIX,
  YAHOO_DISCLAIMER_URL,

  tdSymbol,
  coingeckoRef,
  CRYPTO_ID_COINGECKO,
  COINGECKO_JOURS_MAX,
  frankfurterRef,
  FRANKFURTER_CURRENCIES,
  eulerpoolCommodityRef,
  eulerpoolCommodityRefCroise,
  EULERPOOL_COMMODITY_ID,

  idDe,

  SUFFIX,
  TD_EXCHANGE,
  LSE_TICKERS_PENCE,
  estCotePenceLSE,
  ajusterPenceQuote,
  ajusterPenceHistorique,

  normaliserHistorique,
  normaliserIntraday,
  resampleOHLC,
  joursHistorique,
  finnhubAutorise,

  INTRADAY_MINUTES,
  INTRADAY_INTERVALS,
};
