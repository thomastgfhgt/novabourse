/**
 * GET /api/market/catalog?q=...&type=stock|etf&isin=...&limit=20&cursor=...
 *
 * Lecture du catalogue mondial importé depuis free-ticker-database
 * (voir scripts/import-catalog.js). Identité UNIQUEMENT — ticker, nom,
 * ISIN, place, secteur, pays. Aucun prix, aucune variation, aucun score :
 * ces champs continuent d'être obtenus exclusivement en direct via
 * /api/market/quotes et /api/market/company.
 *
 * Ne télécharge jamais le CSV source ici : cette route ne lit QUE la table
 * Supabase déjà remplie par le script d'import. Un catalogue vide (import
 * jamais lancé) répond simplement 0 résultat, jamais une erreur trompeuse.
 *
 * `exchangeCode` peut être null : l'instrument est réel et identifiable,
 * mais aucun fournisseur vérifié ne couvre sa place pour l'instant (voir
 * api/market/_exchangeCrosswalk.js). Le frontend traite déjà ce cas
 * normalement (cours affiché "indisponible"), aucune UI nouvelle requise.
 */

const { sb, configure } = require('./_supabase.js');
const { deviseDe, SOURCE_NAME, SOURCE_URL } = require('../../scripts/lib/catalogImport.js');

const MAX_RESULTS = 50;
const DEFAULT_RESULTS = 20;
const MAX_QUERY_LENGTH = 100;
/* Identité/catalogue (ticker, nom, ISIN, place) — parmi les données les
   plus stables de tout le backend : un ticker ne change quasiment jamais.
   24h (comme TTL.constituents dans _cache.js) plutôt que 10 min : aucune
   raison de retélécharger la même page de catalogue plusieurs fois par
   heure (voir cahier des charges, "cache adapté à la donnée" : identity/
   catalogue = long). */
const TTL = 24 * 60 * 60 * 1000; // 24 h

const CACHE = new Map();

const TYPES_VALIDES = new Set(['stock', 'etf']);
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

/* Retire tout caractère qui n'a rien à faire dans un nom d'entreprise/ticker
   AVANT de construire un filtre PostgREST ilike : élimine par construction
   tout risque lié aux caractères spéciaux de la syntaxe PostgREST (`,`, `(`,
   `)`) et aux jokers ilike (`*`, `%`) — plutôt que d'essayer de les échapper
   après coup. */
function texteRecherche(value) {
  return String(value || '')
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function normaliserResultat(row) {
  return {
    listingKey: row.listing_key,
    ticker: row.ticker,
    name: row.name,
    exchange: row.exchange_raw,
    exchangeCode: row.exchange_code || null,
    country: row.country,
    countryCode: row.country_code,
    currency: deviseDe(row.country_code),
    isin: row.isin,
    sector: row.stock_sector || row.etf_category || null,
    type: row.asset_type === 'stock' ? 'Stock' : row.asset_type === 'etf' ? 'ETF' : row.asset_type,
    assetType: row.asset_type,
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    retrievedAt: row.retrieved_at,
    freshness: 'REFERENCE',
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=600');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  if (!configure()) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'catalogue_non_configure' });
  }

  const qBrut = String(req.query?.q || '').trim();
  const type = String(req.query?.type || '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(MAX_RESULTS, Number(req.query?.limit) || DEFAULT_RESULTS));
  const cursor = String(req.query?.cursor || '').trim();

  if (qBrut && qBrut.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: 'requete_trop_longue' });
  }
  if (type && !TYPES_VALIDES.has(type)) {
    return res.status(400).json({ error: 'type_invalide' });
  }

  const cacheKey = JSON.stringify({ qBrut, type, limit, cursor });
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) {
    return res.status(200).json({ ...hit.payload, cached: true });
  }

  const filtres = [];

  const isinCandidat = qBrut.toUpperCase();
  if (ISIN_RE.test(isinCandidat)) {
    filtres.push(`isin=eq.${encodeURIComponent(isinCandidat)}`);
  } else if (qBrut) {
    const q = texteRecherche(qBrut);
    if (q.length < 2) {
      return res.status(400).json({ error: 'requete_trop_courte' });
    }
    const motif = encodeURIComponent(`*${q}*`);
    filtres.push(`or=(ticker.ilike.${motif},name.ilike.${motif})`);
  }

  if (type) filtres.push(`asset_type=eq.${type}`);
  if (cursor) filtres.push(`listing_key=gt.${encodeURIComponent(cursor)}`);

  filtres.push('select=*');
  filtres.push('order=listing_key.asc');
  filtres.push(`limit=${limit + 1}`);

  let rows;
  try {
    rows = await sb(`market_catalog_listings?${filtres.join('&')}`);
  } catch (error) {
    return res.status(502).json({
      error: 'catalogue_indisponible',
      detail: error.status ? `HTTP ${error.status}` : error.message,
    });
  }

  const aPlus = rows.length > limit;
  const page = rows.slice(0, limit);
  const results = page.map(normaliserResultat);

  const payload = {
    results,
    count: results.length,
    nextCursor: aPlus ? page[page.length - 1].listing_key : null,
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    partial: false,
  };

  CACHE.set(cacheKey, { at: Date.now(), payload });

  return res.status(200).json(payload);
};

module.exports.texteRecherche = texteRecherche;
module.exports.normaliserResultat = normaliserResultat;
