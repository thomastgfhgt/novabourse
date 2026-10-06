/**
 * api/market/_nasdaqCalendar.js — dates réelles résultats/dividendes, source
 * de repli GRATUITE pour EODHD (plan "Technicals"/"SplitsDividends" jamais
 * vérifié en direct, voir _providers.js — et EODHD n'est de toute façon
 * JAMAIS la source réelle des fondamentaux en production, confirmé en
 * direct le 2026-10-06 : AAPL/MSFT/JPM → finnhub, MC → secedgar).
 *
 * API publique api.nasdaq.com (celle qui alimente nasdaq.com/market-activity,
 * utilisée sans clé par plusieurs projets GitHub open source, ex.
 * s-kerin/finance_calendars) — NON documentée officiellement, NON garantie
 * stable : mêmes réserves que free-ticker-database (scripts/build-catalog.js)
 * ou SEC EDGAR (_secEdgar.js), jamais présentée comme une API officielle
 * NASDAQ Inc.
 *
 * Portée VÉRIFIÉE EN DIRECT (2026-10-06, token réel, aucune clé) :
 *   - /api/quote/{TICKER}/dividends : exDividendDate/dividendPaymentDate/
 *     yield/annualizedDividend/payoutRatio réels pour AAPL ; "N/A" partout
 *     + message explicite pour un ticker non-Nasdaq — mais SEULEMENT pour
 *     CET endpoint.
 *   - /api/analyst/{TICKER}/earnings-date : BUG RÉEL CONFIRMÉ EN DIRECT
 *     (2026-10-06) — contrairement à /dividends ci-dessus, cet endpoint ne
 *     renvoie PAS "N/A" pour un ticker non-Nasdaq : interrogé avec le
 *     ticker seul "MC" (LVMH sur Euronext Paris, voir le commentaire
 *     identique dans sql/2026-09-15_market_catalog.sql sur ce même "cas
 *     réel MC"), il a renvoyé avec confiance la date de résultats de
 *     Moelis & Co (NYSE: MC) — une société SANS AUCUN RAPPORT présentée
 *     comme celle demandée. Nasdaq expose un espace de tickers GLOBAL
 *     (toutes les places américaines), sans aucune notion d'exchange
 *     distinct par requête : AUCUNE confiance possible dans cet endpoint
 *     sans vérifier au préalable que l'exchange NovaBourge est RÉELLEMENT
 *     une place américaine (voir estExchangeAmericain() ci-dessous,
 *     OBLIGATOIRE avant tout appel — jamais sur la seule foi du ticker).
 *     Date extraite d'un texte libre ("Earnings announcement* for AAPL:
 *     Oct 29, 2026"), via une regex stricte (retombe sur null si le format
 *     change). Le texte source précise explicitement "estimated... derived
 *     from an algorithm... might be revised" : jamais présentée comme
 *     confirmée par l'entreprise (nextEarningsEstimated:true, toujours,
 *     par construction de cette source).
 *
 * Couverture : titres RÉELLEMENT cotés aux États-Unis (NASDAQ/NYSE/
 * NYSE ARCA/AMEX, voir estExchangeAmericain()) uniquement — tout autre
 * exchange (y compris vide/inconnu, par prudence après le bug ci-dessus)
 * ne déclenche AUCUN appel réseau, jamais une donnée devinée ni une
 * collision de ticker.
 */

const { lire, ecrire, avecVerrou } = require('./_cache.js');

/* Mêmes 4 valeurs EXACTEMENT que US_EXCHANGES (_providers.js, utilisé par
   finnhubAutorise()) — mais volontairement SANS son autorisation de
   l'exchange VIDE (qui suffit à Finnhub, le ticker seul étant fiable pour
   lui). Ici, un exchange vide/inconnu est REFUSÉ : vu la collision MC
   documentée ci-dessus, mieux vaut ne jamais interroger Nasdaq que de
   risquer d'attribuer les résultats d'une société américaine à un ticker
   homonyme non-américain. */
const EXCHANGES_US_CONFIRMES = new Set(['NASDAQ', 'NYSE', 'NYSE ARCA', 'US']);
function estExchangeAmericain(exchange) {
  return EXCHANGES_US_CONFIRMES.has(String(exchange || '').toUpperCase().trim());
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  Accept: 'application/json',
};

const BLOC_CACHE = 'nasdaqCalendar';

async function fetchJSON(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* "08/10/2026" (MM/DD/YYYY, format Nasdaq) -> "2026-08-10". "N/A"/absent/
   mal formé -> null, jamais une date fabriquée. */
function dateUsVersIso(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const mois = Number(mm), jour = Number(dd);
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/* "Earnings announcement* for AAPL: Oct 29, 2026" -> "2026-10-29". Regex
   stricte sur la forme documentée empiriquement ; tout texte qui ne la
   respecte pas (source modifiée, ticker inconnu) retombe sur null. */
function dateTexteAnglaisVersIso(texte) {
  if (typeof texte !== 'string') return null;
  const m = texte.match(/:\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s+(\d{4})\s*$/);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]}, ${m[3]} UTC`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function dividendesNasdaq(ticker) {
  const d = await fetchJSON(`https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker)}/dividends?assetclass=stocks`);
  const data = d?.data;
  if (!data) return { exDividendDate: null, nextDividendDate: null, dividendPerShare: null };
  const montant = typeof data.dividends?.rows?.[0]?.amount === 'string'
    ? Number(data.dividends.rows[0].amount.replace(/[^0-9.\-]/g, ''))
    : null;
  return {
    exDividendDate: dateUsVersIso(data.exDividendDate),
    nextDividendDate: dateUsVersIso(data.dividendPaymentDate),
    dividendPerShare: Number.isFinite(montant) ? montant : null,
  };
}

async function prochainResultatNasdaq(ticker) {
  const d = await fetchJSON(`https://api.nasdaq.com/api/analyst/${encodeURIComponent(ticker)}/earnings-date`);
  const iso = dateTexteAnglaisVersIso(d?.data?.announcement);
  return { nextEarningsDate: iso, nextEarningsEstimated: iso ? true : null };
}

/* Point d'entrée : fusionne les 2 appels (dividendes + résultats),
   jamais plus d'1 requête réseau par champ, jamais de rejet (une panne
   partielle laisse juste les champs correspondants à null). Retourne null
   si STRICTEMENT aucun champ n'a de valeur (distingue "rien à afficher" de
   "un objet avec seulement des null", voir fundamentals.js). Cache 6h par
   ticker : ces dates ne changent pas d'une requête à l'autre dans la
   journée, inutile de re-frapper l'API à chaque "Voir les chiffres".
   `exchange` OBLIGATOIRE et vérifié AVANT tout appel réseau (voir
   estExchangeAmericain() plus haut) — CORRECTIF (bug réel confirmé en
   direct, 2026-10-06) : appelé sans cette vérification, ticker="MC" a
   renvoyé la date de résultats de Moelis & Co (NYSE) alors que la
   société réellement demandée était LVMH (Euronext Paris). Jamais
   d'exception à ce garde-fou, quelle que soit la forme du ticker. */
async function nasdaqCalendarDates(ticker, exchange) {
  const t = String(ticker || '').toUpperCase().trim();
  if (!t || !estExchangeAmericain(exchange)) return null;

  const hit = lire(BLOC_CACHE, t);
  if (hit) return hit.valeur;

  const { value } = await avecVerrou(BLOC_CACHE, t, async () => {
    const encore = lire(BLOC_CACHE, t);
    if (encore) return encore.valeur;

    const [div, res] = await Promise.all([dividendesNasdaq(t), prochainResultatNasdaq(t)]);
    const fusion = { ...div, ...res };
    const aUneValeur = Object.values(fusion).some(v => v !== null && v !== undefined);
    const resultat = aUneValeur ? fusion : null;
    ecrire(BLOC_CACHE, t, resultat, 'nasdaq');
    return resultat;
  });
  return value;
}

module.exports = { nasdaqCalendarDates, dateUsVersIso, dateTexteAnglaisVersIso, estExchangeAmericain };
