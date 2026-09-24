/**
 * scripts/build-catalog.js — régénère catalog.json depuis le CSV source réel.
 *
 * Remplace l'extraction ponctuelle qui avait produit les 11 243 premières
 * entrées (jamais rejouée depuis) : le dataset source (github.com/
 * adanos-software/free-ticker-database, data/core_listings.csv) contient
 * aujourd'hui 61 799 lignes, 85 places, 122 pays (vérifié 2026-09-24) —
 * catalog.json n'avait simplement jamais été régénéré face à sa croissance.
 *
 * Réutilise scripts/lib/csvParser.js (RFC 4180) et exchangeCodeDepuisCatalogue
 * (api/market/_exchangeCrosswalk.js, vient d'être étendu pour Hong Kong/
 * Shanghai/Shenzhen/Corée/Brésil/Taïwan, vérifiés empiriquement contre la
 * vraie API EODHD en production) pour ne pas dupliquer cette logique.
 *
 * Aucune donnée de marché : uniquement de l'identité (ticker, nom, ISIN,
 * place, secteur, pays, devise) — jamais un prix/score/fondamental, qui
 * restent exclusivement chargés en direct via /api/market/*.
 *
 * Usage : node scripts/build-catalog.js
 */
const fs = require('fs');
const path = require('path');
const { parseCsvObjects } = require('./lib/csvParser.js');
const { exchangeCodeDepuisCatalogue } = require('../api/market/_exchangeCrosswalk.js');

const SOURCE_URL = 'https://raw.githubusercontent.com/adanos-software/free-ticker-database/main/data/core_listings.csv';
const OUT_PATH = path.join(__dirname, '..', 'catalog.json');

/* Traduction des secteurs GICS bruts (colonne stock_sector, en anglais) vers
   les libellés français déjà utilisés par Explorer — copie EXACTE de
   SECTEUR_CATALOGUE dans index.html (dupliquée faute de module partagé
   entre le frontend un seul fichier et ce script Node ; les deux DOIVENT
   rester synchronisés si l'une est modifiée). */
const SECTEUR_CATALOGUE = {
  'Information Technology': 'Technologie',
  'Financials': 'Finance',
  'Health Care': 'Santé',
  'Industrials': 'Industrie',
  'Energy': 'Énergie',
  'Consumer Discretionary': 'Consommation',
  'Consumer Staples': 'Consommation',
  'Communication Services': 'Télécommunications',
  'Materials': 'Matériaux',
  'Real Estate': 'Immobilier',
  'Utilities': 'Services publics',
};

/* Nom français canonique par code pays ISO 3166-1 alpha-2 — traduction
   déterministe d'une nomenclature connue (mêmes principes que
   SECTEUR_CATALOGUE ci-dessus), pas une donnée de marché. Couvre les 92
   codes pays réellement présents dans core_listings.csv au 2026-09-24
   (vérifié : `node -e "... new Set(objects.map(r=>r.country_code))"`).
   Aligné sur l'orthographe déjà utilisée par REGION_OF_COUNTRY/
   COUNTRY_ALIASES dans index.html pour les pays qui s'y trouvent déjà
   (ex. 'Arabie saoudite' en minuscule, 'Corée du Sud', 'Taïwan') — un
   nouveau pays ci-dessous, absent de REGION_OF_COUNTRY, apparaît
   simplement sous "Monde" au filtre région (jamais deviné). */
const PAYS_FR = {
  AE: 'Émirats arabes unis', AR: 'Argentine', AT: 'Autriche', AU: 'Australie',
  BE: 'Belgique', BG: 'Bulgarie', BH: 'Bahreïn', BM: 'Bermudes', BR: 'Brésil',
  BS: 'Bahamas', BW: 'Botswana', CA: 'Canada', CH: 'Suisse', CL: 'Chili',
  CN: 'Chine', CO: 'Colombie', CY: 'Chypre', CZ: 'République tchèque',
  DE: 'Allemagne', DK: 'Danemark', EE: 'Estonie', EG: 'Égypte', ES: 'Espagne',
  FI: 'Finlande', FO: 'Îles Féroé', FR: 'France', GA: 'Gabon',
  GB: 'Royaume-Uni', GG: 'Guernesey', GH: 'Ghana', GI: 'Gibraltar',
  GR: 'Grèce', HK: 'Hong Kong', HR: 'Croatie', HU: 'Hongrie',
  ID: 'Indonésie', IE: 'Irlande', IL: 'Israël', IM: 'Île de Man', IN: 'Inde',
  IS: 'Islande', IT: 'Italie', JE: 'Jersey', JP: 'Japon', KE: 'Kenya',
  KR: 'Corée du Sud', KW: 'Koweït', KY: 'Îles Caïmans', KZ: 'Kazakhstan',
  LI: 'Liechtenstein', LK: 'Sri Lanka', LT: 'Lituanie', LU: 'Luxembourg',
  MA: 'Maroc', MC: 'Monaco', MH: 'Îles Marshall', MT: 'Malte',
  MU: 'Maurice', MW: 'Malawi', MX: 'Mexique', MY: 'Malaisie', NG: 'Nigeria',
  NL: 'Pays-Bas', NO: 'Norvège', NZ: 'Nouvelle-Zélande', OM: 'Oman',
  PA: 'Panama', PE: 'Pérou', PG: 'Papouasie-Nouvelle-Guinée',
  PH: 'Philippines', PK: 'Pakistan', PL: 'Pologne', PR: 'Porto Rico',
  PT: 'Portugal', QA: 'Qatar', RO: 'Roumanie', RW: 'Rwanda',
  SA: 'Arabie saoudite', SE: 'Suède', SG: 'Singapour', SI: 'Slovénie',
  TH: 'Thaïlande', TR: 'Turquie', TW: 'Taïwan', TZ: 'Tanzanie',
  UG: 'Ouganda', US: 'États-Unis', VG: 'Îles Vierges britanniques',
  VN: 'Vietnam', ZA: 'Afrique du Sud', ZM: 'Zambie', ZW: 'Zimbabwe',
};

/* Devise principale par code pays — étend DEVISE_PAR_PAYS de
   scripts/lib/catalogImport.js (déjà utilisé par le chemin Supabase) aux
   92 pays réellement présents. Dupliqué plutôt qu'importé : ce script
   construit le catalogue STATIQUE (catalog.json), catalogImport.js le
   catalogue DYNAMIQUE (market_catalog_listings, toujours bloqué par la
   migration SQL non exécutée) — les deux tables doivent rester
   cohérentes si l'une évolue, mais restent deux chemins distincts. */
const DEVISE_PAR_PAYS = {
  US: 'USD', CA: 'CAD', GB: 'GBP', FR: 'EUR', DE: 'EUR', NL: 'EUR',
  BE: 'EUR', PT: 'EUR', IE: 'EUR', IT: 'EUR', ES: 'EUR', LU: 'EUR',
  AT: 'EUR', FI: 'EUR', GR: 'EUR', CH: 'CHF', SE: 'SEK', DK: 'DKK',
  NO: 'NOK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', JP: 'JPY',
  CN: 'CNY', HK: 'HKD', IN: 'INR', KR: 'KRW', TW: 'TWD', AU: 'AUD',
  NZ: 'NZD', BR: 'BRL', MX: 'MXN', TH: 'THB', IL: 'ILS', ID: 'IDR',
  TR: 'TRY', SG: 'SGD', VN: 'VND', PK: 'PKR', LK: 'LKR', EG: 'EGP',
  ZA: 'ZAR', SA: 'SAR', PH: 'PHP', PE: 'PEN', AE: 'AED', QA: 'QAR',
  KE: 'KES', NG: 'NGN', MA: 'MAD', IS: 'ISK', CO: 'COP', AR: 'ARS',
  /* Ajoutés pour cette passe (pays présents dans core_listings.csv sans
     devise encore déclarée) : ISO 4217 officiel du pays de cotation. */
  BG: 'BGN', BH: 'BHD', BM: 'BMD', BS: 'BSD', BW: 'BWP', CL: 'CLP',
  CY: 'EUR', CZ: 'CZK', EE: 'EUR', FO: 'DKK', GA: 'XAF', GG: 'GBP',
  GH: 'GHS', GI: 'GIP', HR: 'EUR', IM: 'GBP', JE: 'GBP', KW: 'KWD',
  KY: 'KYD', KZ: 'KZT', LI: 'CHF', LT: 'EUR', MC: 'EUR', MH: 'USD',
  MT: 'EUR', MU: 'MUR', MW: 'MWK', MY: 'MYR', OM: 'OMR', PA: 'USD',
  PG: 'PGK', PR: 'USD', RW: 'RWF', SI: 'EUR', TZ: 'TZS', UG: 'UGX',
  VG: 'USD', ZM: 'ZMW', ZW: 'ZWL',
};

/* Symbole d'affichage par devise — étend CUR_SYMBOL d'index.html (voir
   commentaire similaire ci-dessus) aux devises nouvellement introduites.
   Une devise absente de cette table reste affichée sous son code ISO brut
   (ex. "BGN") — dégradation gracieuse déjà en place côté frontend
   (CUR_SYMBOL[cur] || cur), jamais un symbole inventé. */
const CUR_SYMBOL = {
  EUR:'€', USD:'$', GBP:'£', CHF:'CHF', JPY:'¥', HKD:'HK$', SEK:'kr',
  DKK:'kr', NOK:'kr', CAD:'$', AUD:'$', CNH:'¥', SGD:'$', MXN:'$',
  ZAR:'R', TRY:'₺', BRL:'R$', INR:'₹', KRW:'₩', IDR:'Rp', MYR:'RM',
  ILS:'₪', PLN:'zł', CNY:'¥', TWD:'NT$', VND:'₫', SAR:'﷼', NZD:'$',
};

/* Libellé humain de place par code NovaBourse — étend le vocabulaire déjà
   utilisé (voir catalog.json existant) aux 6 places Asie/émergents
   ajoutées cette passe (vérifiées, voir _providers.js/SUFFIX). */
const MARKET_LABEL = {
  NASDAQ: 'NASDAQ', NYSE: 'NYSE', 'NYSE ARCA': 'NYSE Arca',
  PA: 'Euronext Paris', DE: 'Xetra', L: 'London Stock Exchange',
  SW: 'SIX Swiss Exchange', AS: 'Euronext Amsterdam', MC: 'Bolsa de Madrid',
  MI: 'Borsa Italiana', BR: 'Euronext Brussels', LS: 'Euronext Lisbon',
  ST: 'Nasdaq Stockholm', CO: 'Nasdaq Copenhagen', OL: 'Oslo Børs',
  HE: 'Nasdaq Helsinki', TO: 'Toronto Stock Exchange', AU: 'ASX',
  HK: 'Hong Kong Stock Exchange', SHG: 'Shanghai Stock Exchange',
  SHE: 'Shenzhen Stock Exchange', KO: 'Korea Exchange',
  SA: 'B3 (Bolsa de São Paulo)', TW: 'Taiwan Stock Exchange',
};

/* Id court par exchangeCode (voir catalog.json existant : NASDAQ->NAS,
   NYSE->NYS, 'NYSE ARCA'->NYA ; toute autre place utilise son propre
   exchangeCode tel quel, déjà court). */
const ID_SUFFIX = { NASDAQ: 'NAS', NYSE: 'NYS', 'NYSE ARCA': 'NYA' };

const BLANK_FIELDS = () => ({
  score: null, scores: {}, coverage: 0, partial: true,
  fundamentals: null, hasFundamentals: false, fundamentalsSource: null,
  companyIdentity: null, fundamentalsStatus: 'idle',
  volatility: null, volRisk: null, momentum: null, marketCapEUR: null,
  type: 'stock',
});

async function telechargerCsv() {
  const r = await fetch(SOURCE_URL);
  if (!r.ok) throw new Error(`telechargement_echoue: HTTP ${r.status}`);
  return r.text();
}

async function main() {
  console.log(`Téléchargement de ${SOURCE_URL}...`);
  const csvText = await telechargerCsv();

  console.log('Parsing (RFC 4180)...');
  const { header, objects, skipped } = parseCsvObjects(csvText);
  console.log(`${objects.length} lignes lues (${skipped} ignorées au parsing).`);

  const parId = new Map();
  const exchangesNonMappes = {};
  let sansExchangeCode = 0;

  for (const row of objects) {
    const ticker = String(row.ticker || '').trim();
    const name = String(row.name || '').trim();
    const exchangeRaw = String(row.exchange || '').trim();
    const countryCode = String(row.country_code || '').trim().toUpperCase();
    if (!ticker || !name || !exchangeRaw) continue;

    const assetTypeRaw = String(row.asset_type || '').trim();
    if (assetTypeRaw && assetTypeRaw !== 'Stock' && assetTypeRaw !== 'ETF') continue;

    const exchangeCode = exchangeCodeDepuisCatalogue(exchangeRaw, countryCode);
    if (!exchangeCode) {
      exchangesNonMappes[exchangeRaw] = (exchangesNonMappes[exchangeRaw] || 0) + 1;
      sansExchangeCode++;
      continue; // identité non exploitable sans place résolue : cohérent avec
      // le principe "jamais une place devinée" déjà appliqué au catalogue
      // dynamique (market_catalog_listings) — un instrument dont la place
      // n'est pas vérifiée ne serait affichable dans aucune fiche réelle.
    }

    const cur = DEVISE_PAR_PAYS[countryCode] || null;
    const id = `${ticker}-${ID_SUFFIX[exchangeCode] || exchangeCode}`;
    if (parId.has(id)) continue; // doublon (même ticker+place déjà vu) : garde la 1re occurrence

    parId.set(id, {
      id,
      name,
      ticker,
      market: MARKET_LABEL[exchangeCode] || exchangeRaw,
      exchangeCode,
      sector: SECTEUR_CATALOGUE[String(row.stock_sector || '').trim()] || null,
      country: PAYS_FR[countryCode] || (countryCode ? String(row.country || '').trim() || null : null),
      cur,
      curSymbol: cur ? (CUR_SYMBOL[cur] || cur) : '',
      ...BLANK_FIELDS(),
      type: assetTypeRaw === 'ETF' ? 'etf' : 'stock',
    });
  }

  const stocks = [...parId.values()];
  console.log(`${stocks.length} entreprises retenues (places résolues).`);
  console.log(`${sansExchangeCode} lignes ignorées faute de place vérifiée (${Object.keys(exchangesNonMappes).length} places distinctes non mappées).`);
  console.log('Top 15 places non mappées (par nombre de titres) :');
  console.log(Object.entries(exchangesNonMappes).sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([ex, n]) => `  ${ex} : ${n}`).join('\n'));

  fs.writeFileSync(OUT_PATH, JSON.stringify(stocks));
  console.log(`Écrit dans ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(2)} Mo).`);
}

main().catch(e => { console.error(e); process.exit(1); });
