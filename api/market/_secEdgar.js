/**
 * api/market/_secEdgar.js — SEC EDGAR (data.sec.gov), source de repli pour
 * les fondamentaux des actions américaines.
 *
 * Aucune clé requise : source publique officielle (SEC, gouvernement
 * américain). Contrat imposé par la SEC : un en-tête User-Agent
 * identifiable (nom d'application + contact), sous peine de 403/429 — voir
 * https://www.sec.gov/os/webmaster-faq#developers. Fichier volontairement
 * SANS dépendance vers _providers.js (éviterait une dépendance circulaire :
 * _providers.js importe ce fichier pour brancher FUNDAMENTALS.secedgar) —
 * num()/txt()/le client HTTP sont donc de courtes copies locales, pas
 * partagées.
 *
 * Portée volontairement restreinte :
 *   - uniquement les dépôts 10-K/10-Q (10-K/A, 10-Q/A inclus) : par
 *     construction, seul un émetteur domestique américain dépose sous
 *     cette forme (un émetteur étranger dépose 20-F/40-F) — c'est de là
 *     que identity.country='United States' et fundamentals en devise USD
 *     sont déduits, jamais devinés ;
 *   - type 'stock' uniquement (voir secedgar() ci-dessous) : un ETF ne
 *     dépose pas de comptes GAAP sous cette forme, cikPourTicker()
 *     renverrait de toute façon null pour la quasi-totalité d'entre eux ;
 *   - `debt`/`debtToEquity`/`ebitda`/`ebit` volontairement ABSENTS : XBRL
 *     ne fournit aucun concept "dette financière totale" unique et
 *     cohérent d'un émetteur à l'autre (LongTermDebtNoncurrent/DebtCurrent
 *     ne sont pas taggés partout de la même façon) — même principe que
 *     l'exclusion de ROIC côté EODHD (api/market/_providers.js) : mieux
 *     vaut rester null qu'un chiffre possiblement faux présenté comme
 *     fiable ;
 *   - `marketCap`/`pe`/`priceToBook`/dividendes : ABSENTS — SEC EDGAR ne
 *     connaît aucun cours de bourse, seulement les états financiers
 *     déposés.
 *
 * Vérifié en DIRECT (2026-09-28) sur 5 profils de dépôt différents (AAPL,
 * MSFT, KO, TSLA, JPM — volontairement un industriel, un conglomérat, une
 * banque) avant intégration :
 *   - Assets/StockholdersEquity/CashAndCashEquivalentsAtCarryingValue/
 *     Revenues/NetIncomeLoss/EarningsPerShareDiluted/
 *     dei:EntityCommonStockSharesOutstanding : présents pour les 5.
 *   - Liabilities : absent chez KO (confirmé, pas une erreur de nom).
 *   - AssetsCurrent/LiabilitiesCurrent/GrossProfit/OperatingIncomeLoss/
 *     PaymentsToAcquirePropertyPlantAndEquipment : ABSENTS chez JPM — une
 *     banque n'a structurellement pas de distinction actif/passif courant
 *     ni de marge brute en XBRL US GAAP. Chaque dérivation ci-dessous
 *     accepte cette absence (résultat null), jamais traitée comme anormale.
 *   - RevenueFromContractWithCustomerExcludingAssessedTax : absent chez
 *     KO/JPM — toujours un repli après 'Revenues', jamais le seul chemin.
 */

const { lire, ecrire, avecVerrou } = require('./_cache.js');

const HEADERS = {
  'User-Agent': 'NovaBourse contact@novabourse.site',
  Accept: 'application/json',
};

async function fetchJSON(url, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: HEADERS });
    const body = await response.text();
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.body = body.slice(0, 200);
      error.url = url;
      throw error;
    }
    try {
      return JSON.parse(body);
    } catch {
      const error = new Error('reponse_non_json');
      error.body = body.slice(0, 200);
      error.url = url;
      throw error;
    }
  } catch (error) {
    if (!error.url) error.url = url;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const num = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const txt = v => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

/* ============================================================
   INDEX TICKER -> CIK
   ============================================================ */

async function indexTickerVersCik() {
  const hit = lire('secedgarCiks');
  if (hit) return hit.valeur;

  const { value } = await avecVerrou('secedgarCiks', [], async () => {
    const encore = lire('secedgarCiks');
    if (encore) return encore.valeur;

    const d = await fetchJSON('https://www.sec.gov/files/company_tickers.json', 15000);
    const map = new Map();
    for (const entree of Object.values(d || {})) {
      const ticker = txt(entree?.ticker);
      const cik = Number(entree?.cik_str);
      if (ticker && Number.isFinite(cik)) {
        map.set(ticker.toUpperCase(), { cik, title: txt(entree?.title) });
      }
    }
    ecrire('secedgarCiks', [], map, 'secedgar');
    return map;
  });
  return value;
}

async function infoPourTicker(ticker) {
  const t = String(ticker || '').trim().toUpperCase();
  if (!t) return null;
  const map = await indexTickerVersCik();
  return map.get(t) || null;
}

/* ============================================================
   FAITS XBRL (companyfacts)
   ============================================================ */

async function factsPourCik(cik) {
  const cle = String(cik);
  const hit = lire('secedgarFacts', cle);
  if (hit) return hit.valeur;

  const { value } = await avecVerrou('secedgarFacts', [cle], async () => {
    const encore = lire('secedgarFacts', cle);
    if (encore) return encore.valeur;

    const cikPad = String(cik).padStart(10, '0');
    const d = await fetchJSON(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cikPad}.json`, 15000);
    ecrire('secedgarFacts', [cle], d, 'secedgar');
    return d;
  });
  return value;
}

/* Formes de dépôt acceptées — voir en-tête : seule garantie que l'émetteur
   est domestique américain (Assets/Revenues/... en USD). */
const FORMES_ACCEPTEES = new Set(['10-K', '10-K/A', '10-Q', '10-Q/A']);
const FORMES_ANNUELLES = new Set(['10-K', '10-K/A']);

/**
 * @param {object} facts - réponse companyfacts brute
 * @param {'us-gaap'|'dei'} taxonomie
 * @param {string} concept - nom exact du concept XBRL
 * @param {string} unite - clé exacte dans `units` ('USD', 'USD/shares', 'shares'...)
 */
function pointsConcept(facts, taxonomie, concept, unite) {
  const c = facts?.facts?.[taxonomie]?.[concept];
  const arr = c?.units?.[unite];
  return Array.isArray(arr) ? arr : [];
}

function dureeJours(p) {
  if (!p.start || !p.end) return null;
  const debut = Date.parse(p.start);
  const fin = Date.parse(p.end);
  if (!Number.isFinite(debut) || !Number.isFinite(fin)) return null;
  return Math.round((fin - debut) / 86400000);
}

/**
 * Dernier point INSTANT (bilan — Assets, StockholdersEquity...) : un seul
 * `end`, pas de fenêtre de durée à vérifier.
 */
function dernierInstant(facts, taxonomie, concept, unite, formes = FORMES_ACCEPTEES) {
  const points = pointsConcept(facts, taxonomie, concept, unite)
    .filter(p => formes.has(p.form) && txt(p.end) && num(p.val) !== null)
    .sort((a, b) => b.end.localeCompare(a.end) || String(b.filed || '').localeCompare(String(a.filed || '')));
  return points.length ? { valeur: num(points[0].val), date: points[0].end, form: points[0].form } : null;
}

/**
 * Dernier point de FLUX (compte de résultat/tableau de flux — Revenues,
 * NetIncomeLoss...) restreint à une fenêtre de durée réelle (annuelle
 * ~365j ou trimestrielle ~91j) pour ne jamais confondre un cumul YTD avec
 * une valeur du seul trimestre — les deux coexistent dans la même série
 * companyfacts (confirmé en direct sur NetIncomeLoss/AAPL, voir en-tête).
 */
function dernierFlux(facts, taxonomie, concept, unite, { min, max, formes }) {
  const points = pointsConcept(facts, taxonomie, concept, unite)
    .filter(p => formes.has(p.form) && num(p.val) !== null)
    .map(p => ({ ...p, duree: dureeJours(p) }))
    .filter(p => p.duree !== null && p.duree >= min && p.duree <= max)
    .sort((a, b) => b.end.localeCompare(a.end) || String(b.filed || '').localeCompare(String(a.filed || '')));
  return points.length ? { valeur: num(points[0].val), date: points[0].end, form: points[0].form } : null;
}

const dernierAnnuelUnConcept = (facts, concept, unite = 'USD') =>
  dernierFlux(facts, 'us-gaap', concept, unite, { min: 350, max: 380, formes: FORMES_ANNUELLES });

/**
 * Comme dernierAnnuelUnConcept, mais pour PLUSIEURS concepts candidats
 * (ex. 'Revenues' puis son remplaçant post-ASC606
 * 'RevenueFromContractWithCustomerExcludingAssessedTax') : renvoie
 * toujours celui dont la date `end` est la PLUS RÉCENTE, jamais le
 * premier qui répond.
 *
 * Bug réel trouvé et corrigé pendant l'intégration : un simple repli
 * statique (a() ?? b()) choisissait 'Revenues' pour Apple même si ce tag
 * n'est plus déposé depuis l'exercice 2018 (Apple est passé à
 * RevenueFromContractWithCustomerExcludingAssessedTax après l'adoption
 * d'ASC 606) — renvoyait silencieusement le chiffre d'affaires 2018 comme
 * "dernier" alors qu'un exercice 2025 existait sous l'autre tag. Vérifié
 * en direct : 'Revenues' (10-K) s'arrête au 2018-09-29 chez Apple,
 * 'RevenueFromContractWithCustomerExcludingAssessedTax' va jusqu'au
 * 2025-09-27 — comparer les DATES, jamais supposer qu'un concept "gagne"
 * par défaut, est la seule façon fiable de choisir.
 */
function dernierAnnuelParmi(facts, concepts, unite = 'USD') {
  let meilleur = null;
  for (const concept of concepts) {
    const candidat = dernierAnnuelUnConcept(facts, concept, unite);
    if (candidat && (!meilleur || candidat.date > meilleur.date)) meilleur = candidat;
  }
  return meilleur;
}

/**
 * Jusqu'à 5 exercices annuels (10-K), du plus récent au plus ancien —
 * même forme {date, annee, valeur} que EODHD (periodes(), voir
 * _providers.js) pour rester directement exploitable par les mêmes
 * consommateurs (NovaScore, fiches actions). Accepte plusieurs concepts
 * candidats (même raison que dernierAnnuelParmi ci-dessus : un émetteur
 * peut changer de tag XBRL d'un exercice à l'autre) — fusionnés par date,
 * jamais un concept qui écrase silencieusement l'autre.
 */
function serieAnnuelle(facts, concepts, unite = 'USD') {
  const listeConcepts = Array.isArray(concepts) ? concepts : [concepts];
  const vues = new Map();
  for (const concept of listeConcepts) {
    for (const p of pointsConcept(facts, 'us-gaap', concept, unite)) {
      if (!FORMES_ANNUELLES.has(p.form) || num(p.val) === null) continue;
      const duree = dureeJours(p);
      if (duree === null || duree < 350 || duree > 380) continue;
      const existant = vues.get(p.end);
      if (!existant || String(p.filed || '') > String(existant.filed || '')) vues.set(p.end, p);
    }
  }
  const lignes = [...vues.values()]
    .sort((a, b) => b.end.localeCompare(a.end))
    .slice(0, 5)
    .map(p => ({ date: p.end, annee: Number(p.end.slice(0, 4)), valeur: num(p.val) }));
  return lignes.length ? lignes : null;
}

/* Deux valeurs ne sont divisées entre elles que si elles proviennent
   EXACTEMENT de la même date de fin de période (bilan) ou du même
   exercice (résultat) — jamais un ratio approximatif entre deux dates
   différentes. Même discipline que grossMargin/currentRatio côté EODHD. */
const ratioSiMemePeriode = (a, b) => (a && b && a.date === b.date && b.valeur) ? a.valeur / b.valeur : null;

/* CORRECTIF (bug réel confirmé en direct, 2026-10-06) : l'ancienne
   signature ignorait complètement `exchange` en partant du principe
   qu'"un ticker US n'est jamais ambigu entre places" — vrai en soi, mais
   cette fonction était appelée pour N'IMPORTE QUEL ticker, y compris des
   valeurs non-américaines (ex. MC@PA = LVMH, Euronext Paris). Le ticker
   SEC EDGAR "MC" correspond en réalité à Moelis & Co (NYSE) : la fiche
   LVMH affichait donc silencieusement les fondamentaux de Moelis & Co,
   sans qu'aucune erreur ne le signale — même famille de bug que la
   collision Nasdaq déjà corrigée (_nasdaqCalendar.js, voir
   estExchangeAmericain() là-bas, même principe repris ici). Dupliqué
   plutôt qu'importé de _providers.js : ce fichier reste volontairement
   SANS dépendance vers lui (éviterait une dépendance circulaire, voir
   l'en-tête de ce fichier). Exchange vide/non précisé reste autorisé
   (comportement historique inchangé pour l'appelant qui ne connaît pas
   encore la place) ; seul un exchange EXPLICITEMENT non-américain bloque
   l'appel, avant toute requête réseau. */
const EXCHANGES_US_CONFIRMES = new Set(['NASDAQ', 'NYSE', 'NYSE ARCA', 'US']);
function estExchangeAmericainOuInconnu(exchange) {
  const e = String(exchange || '').toUpperCase().trim();
  return !e || EXCHANGES_US_CONFIRMES.has(e);
}

/**
 * @param {string} ticker
 * @param {string|null} exchange - un exchange EXPLICITEMENT non-américain
 *   fait échouer l'appel avant toute requête réseau (voir le correctif
 *   ci-dessus) ; vide/absent reste autorisé, SEC EDGAR identifie alors par
 *   ticker seul comme avant.
 * @param {*} _key - sentinelle (voir KEYS().secedgar dans _providers.js),
 *   jamais un vrai secret : aucune clé n'est requise par cette API.
 */
async function secedgar(ticker, exchange, _key) {
  if (!estExchangeAmericainOuInconnu(exchange)) {
    throw new Error('exchange_non_americaine');
  }

  const info = await infoPourTicker(ticker);
  if (!info) throw new Error('ticker_non_reconnu_par_secedgar');

  const facts = await factsPourCik(info.cik);
  if (!facts || typeof facts !== 'object' || !facts.facts) throw new Error('vide');

  const CONCEPTS_REVENU = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'];
  const revenu = dernierAnnuelParmi(facts, CONCEPTS_REVENU);
  const revenuSerie = serieAnnuelle(facts, CONCEPTS_REVENU);
  const netIncome = dernierAnnuelParmi(facts, ['NetIncomeLoss']);
  const CONCEPTS_EPS = ['EarningsPerShareDiluted', 'EarningsPerShareBasic'];
  const epsSerie = serieAnnuelle(facts, CONCEPTS_EPS, 'USD/shares');
  const eps = dernierAnnuelParmi(facts, CONCEPTS_EPS, 'USD/shares');
  const cash = dernierInstant(facts, 'us-gaap', 'CashAndCashEquivalentsAtCarryingValue', 'USD');
  const actifs = dernierInstant(facts, 'us-gaap', 'Assets', 'USD');
  const actifsCourants = dernierInstant(facts, 'us-gaap', 'AssetsCurrent', 'USD');
  const passifsCourants = dernierInstant(facts, 'us-gaap', 'LiabilitiesCurrent', 'USD');
  const fondsPropres = dernierInstant(facts, 'us-gaap', 'StockholdersEquity', 'USD');
  const grossProfit = dernierAnnuelParmi(facts, ['GrossProfit']);
  const operatingIncome = dernierAnnuelParmi(facts, ['OperatingIncomeLoss']);
  const fluxOperationnel = dernierAnnuelParmi(facts, ['NetCashProvidedByUsedInOperatingActivities']);
  const capex = dernierAnnuelParmi(facts, ['PaymentsToAcquirePropertyPlantAndEquipment']);
  const sharesOutstanding = dernierInstant(facts, 'dei', 'EntityCommonStockSharesOutstanding', 'shares');
  const fcfSerie = (() => {
    const flux = serieAnnuelle(facts, ['NetCashProvidedByUsedInOperatingActivities']);
    const cap = serieAnnuelle(facts, ['PaymentsToAcquirePropertyPlantAndEquipment']);
    if (!flux || !cap) return null;
    const capParDate = new Map(cap.map(p => [p.date, p.valeur]));
    const lignes = flux
      .filter(p => capParDate.has(p.date))
      .map(p => ({ date: p.date, annee: p.annee, valeur: p.valeur - capParDate.get(p.date) }));
    return lignes.length ? lignes : null;
  })();

  if (!revenu && !netIncome && !actifs) throw new Error('vide');

  return {
    identity: {
      name: txt(facts.entityName) || info.title,
      exchange: null,
      /* Voir en-tête : déduit du dépôt 10-K/10-Q lui-même, réservé aux
         émetteurs domestiques US — jamais deviné. */
      country: 'United States',
      currency: 'USD',
      sector: null,
      industry: null,
      isin: null,
      description: null,
      website: null,
      employees: null,
      ipoDate: null,
    },

    fundamentals: {
      revenue: revenu ? revenu.valeur : null,
      netIncome: netIncome ? netIncome.valeur : null,
      revenueSeries: revenuSerie,
      epsSeries: epsSerie,
      fcfSeries: fcfSerie,
      eps: eps ? eps.valeur : null,
      profitMargin: ratioSiMemePeriode(netIncome, revenu),
      operatingMargin: ratioSiMemePeriode(operatingIncome, revenu),
      roe: ratioSiMemePeriode(netIncome, fondsPropres),
      roa: ratioSiMemePeriode(netIncome, actifs),
      debt: null,
      cash: cash ? cash.valeur : null,
      freeCashFlow: (fluxOperationnel && capex && fluxOperationnel.date === capex.date)
        ? fluxOperationnel.valeur - capex.valeur
        : null,
      pe: null,
      forwardPE: null,
      priceToBook: null,
      evToEbitda: null,
      dividendYield: null,
      dividendPerShare: null,
      payoutRatio: null,
      exDividendDate: null,
      nextDividendDate: null,
      nextEarningsDate: null,
      marketCap: null,
      analystRatings: null,
      wallStreetTargetPrice: null,
      epsEstimateCurrentYear: null,
      epsEstimateNextYear: null,
      epsEstimateCurrentQuarter: null,
      epsEstimateNextQuarter: null,
      week52High: null,
      week52Low: null,
      beta: null,
      avgVolume3M: null,
      grossMargin: ratioSiMemePeriode(grossProfit, revenu),
      currentRatio: ratioSiMemePeriode(actifsCourants, passifsCourants),
      peg: null,
      sharesOutstanding: sharesOutstanding ? sharesOutstanding.valeur : null,
      enterpriseValue: null,
      ebitda: null,
      ebit: null,
      debtToEquity: null,
      quickRatio: null,
    },

    asOf: (actifs?.date || netIncome?.date || revenu?.date) || null,
  };
}

module.exports = { secedgar, infoPourTicker, factsPourCik };
