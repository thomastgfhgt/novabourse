/**
 * scripts/lib/catalogImport.js — LOGIQUE D'IMPORT DU CATALOGUE (RÉUTILISABLE)
 *
 * Séparée de scripts/import-catalog.js (le point d'entrée CLI) pour pouvoir,
 * plus tard, être appelée depuis une route Vercel Cron sans dupliquer cette
 * logique — pas de Cron ajouté dans cette passe (demande explicite), mais
 * l'architecture ne demandera pas de refactoring pour en ajouter un :
 * il suffira d'un fichier api/cron/sync-catalog.js qui appelle runImport().
 *
 * Ne télécharge JAMAIS le CSV à la demande d'un utilisateur final : ce
 * module n'est appelé que par un script lancé manuellement (ou plus tard un
 * Cron), jamais par une route publique de l'API.
 *
 * Aucune donnée de marché n'est inventée : seules l'identité (ticker, nom,
 * ISIN, place, secteur) provenant réellement du CSV source sont écrites.
 */

const { parseCsvObjects } = require('./csvParser.js');
const { exchangeCodeDepuisCatalogue } = require('../../api/market/_exchangeCrosswalk.js');
const { sb, configure } = require('../../api/market/_supabase.js');

const SOURCE_NAME = 'free-ticker-database';
const SOURCE_URL =
  'https://raw.githubusercontent.com/adanos-software/free-ticker-database/main/data/core_listings.csv';

const COLONNES_ATTENDUES = [
  'listing_key', 'ticker', 'exchange', 'name', 'asset_type',
  'stock_sector', 'etf_category', 'country', 'country_code',
  'isin', 'aliases', 'instrument_group_key', 'scope_reason',
];

const TYPE_INTERNE = { Stock: 'stock', ETF: 'etf' };

/* Devise principale de cotation déduite du pays — fait ISO déterministe
   (pas une donnée de marché), au même titre que les correspondances
   pays/devise déjà codées en dur dans le catalogue statique d'index.html.
   Volontairement non exhaustif : une entrée absente reste `null`, jamais
   devinée. Couvre les pays réellement présents parmi les places déjà
   vérifiées (voir _exchangeCrosswalk.js) et les principales places
   mondiales pour que la recherche catalogue reste correcte même pour les
   instruments sans cotation en direct pour l'instant. */
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
};

function normaliserLigne(row, importBatchId, retrievedAt) {
  const listingKey = String(row.listing_key || '').trim();
  const ticker = String(row.ticker || '').trim();
  const exchangeRaw = String(row.exchange || '').trim();
  const name = String(row.name || '').trim();
  const countryCode = String(row.country_code || '').trim() || null;

  if (!listingKey || !ticker || !exchangeRaw || !name) return null;

  const assetTypeRaw = String(row.asset_type || '').trim();
  const assetType = TYPE_INTERNE[assetTypeRaw] || assetTypeRaw.toLowerCase() || 'stock';

  return {
    listing_key: listingKey,
    ticker,
    name,
    asset_type: assetType,
    exchange_raw: exchangeRaw,
    exchange_code: exchangeCodeDepuisCatalogue(exchangeRaw, countryCode),
    stock_sector: String(row.stock_sector || '').trim() || null,
    etf_category: String(row.etf_category || '').trim() || null,
    country: String(row.country || '').trim() || null,
    country_code: countryCode,
    isin: String(row.isin || '').trim() || null,
    aliases: String(row.aliases || '').trim() || null,
    instrument_group_key: String(row.instrument_group_key || '').trim() || null,
    scope_reason: String(row.scope_reason || '').trim() || null,
    source: SOURCE_NAME,
    source_url: SOURCE_URL,
    import_batch_id: importBatchId,
    retrieved_at: retrievedAt,
    updated_at: retrievedAt,
  };
}

function deviseDe(countryCode) {
  return DEVISE_PAR_PAYS[String(countryCode || '').toUpperCase()] || null;
}

async function telechargerCsv() {
  const r = await fetch(SOURCE_URL);
  if (!r.ok) throw new Error(`telechargement_echoue: HTTP ${r.status}`);
  return r.text();
}

async function upsertParLots(lignes, onProgress) {
  const TAILLE_LOT = 500;
  let upserted = 0;

  for (let i = 0; i < lignes.length; i += TAILLE_LOT) {
    const lot = lignes.slice(i, i + TAILLE_LOT);

    await sb('market_catalog_listings?on_conflict=listing_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(lot),
    });

    upserted += lot.length;
    if (onProgress) onProgress(upserted, lignes.length);
  }

  return upserted;
}

/**
 * Exécute un import complet : téléchargement, parsing, normalisation,
 * crosswalk, écriture en base, traçabilité du lot.
 *
 * @param {object} [opts]
 * @param {(msg: string) => void} [opts.log] - callback de progression (défaut: no-op)
 * @returns {Promise<object>} résumé de l'import
 */
async function runImport({ log = () => {} } = {}) {
  if (!configure()) {
    throw new Error(
      'supabase_non_configure : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY '
      + 'doivent être définis dans l\'environnement avant de lancer cet import.'
    );
  }

  const demarre = new Date().toISOString();

  log(`Création du lot d'import (source: ${SOURCE_URL})...`);
  const [batch] = await sb('market_catalog_imports', {
    method: 'POST',
    body: JSON.stringify([{
      source: SOURCE_NAME,
      source_url: SOURCE_URL,
      started_at: demarre,
      status: 'running',
    }]),
  });
  const importBatchId = batch.id;

  try {
    log('Téléchargement du CSV...');
    const csvText = await telechargerCsv();

    log('Parsing (RFC 4180)...');
    const { header, objects, skipped: skippedParsing } = parseCsvObjects(csvText);

    const enTeteOk = COLONNES_ATTENDUES.every(c => header.includes(c));
    if (!enTeteOk) {
      throw new Error(
        `schema_source_inattendu : colonnes reçues = [${header.join(', ')}]`
      );
    }

    log(`${objects.length} lignes lues (${skippedParsing} ignorées au parsing).`);

    const retrievedAt = new Date().toISOString();
    const lignesNormalisees = [];
    const parListingKey = new Map();
    const exchangesNonMappes = {};
    let skippedNormalisation = 0;

    for (const row of objects) {
      const ligne = normaliserLigne(row, importBatchId, retrievedAt);
      if (!ligne) { skippedNormalisation++; continue; }

      if (!ligne.exchange_code) {
        exchangesNonMappes[ligne.exchange_raw] = (exchangesNonMappes[ligne.exchange_raw] || 0) + 1;
      }

      // Le dataset garantit listing_key unique ; défensif au cas où.
      parListingKey.set(ligne.listing_key, ligne);
    }
    lignesNormalisees.push(...parListingKey.values());

    log(`${lignesNormalisees.length} lignes normalisées, upsert en cours (lots de 500)...`);

    const upserted = await upsertParLots(lignesNormalisees, (fait, total) => {
      log(`  ... ${fait}/${total}`);
    });

    const rowsSkipped = skippedParsing + skippedNormalisation;

    await sb(`market_catalog_imports?id=eq.${importBatchId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        finished_at: new Date().toISOString(),
        status: 'ok',
        rows_read: objects.length,
        rows_upserted: upserted,
        rows_skipped: rowsSkipped,
        unmapped_exchanges: exchangesNonMappes,
      }),
    });

    return {
      importBatchId,
      rowsRead: objects.length,
      rowsUpserted: upserted,
      rowsSkipped,
      unmappedExchanges: exchangesNonMappes,
    };

  } catch (error) {
    await sb(`market_catalog_imports?id=eq.${importBatchId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        finished_at: new Date().toISOString(),
        status: 'failed',
        error_message: String(error.message || error).slice(0, 2000),
      }),
    }).catch(() => {});

    throw error;
  }
}

module.exports = {
  runImport,
  normaliserLigne,
  deviseDe,
  SOURCE_NAME,
  SOURCE_URL,
  COLONNES_ATTENDUES,
};
