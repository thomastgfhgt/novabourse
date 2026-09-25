/**
 * GET /api/market/extra?kind=news|catalog|health&...
 *
 * Route fusionnée (2026-09-24, étape 3 "Data Core") — regroupe trois
 * anciennes routes séparées (news.js, catalog.js, health.js) qui étaient
 * TOUTES LES TROIS absentes du déploiement (voir .vercelignore avant ce
 * commit) : le projet comptait 14 fichiers de route serverless pour une
 * limite de 12 fonctions sur le plan Vercel actuel (Hobby) — confirmé en
 * testant en direct (/api/market/news, /api/market/catalog et
 * /api/market/health répondaient tous 404 "NOT_FOUND" niveau plateforme,
 * pas une erreur applicative). Conséquence réelle avant ce correctif :
 *   - Nova News (accueil ET fiches actions) n'a jamais réellement
 *     fonctionné en production — le bouton "Voir les actualités"
 *     échouait silencieusement (repli déjà en place côté frontend,
 *     jamais d'erreur visible, mais aucune actualité non plus) ;
 *   - la recherche globale perdait tout le catalogue mondial
 *     (market_catalog_listings, bien plus large que les 11 243 sociétés
 *     du catalogue statique embarqué) — searchCatalog() se repliait
 *     silencieusement sur [] ;
 *   - le diagnostic /health (protégé par DIAG_SECRET) n'était pas
 *     accessible non plus.
 *
 * Fusionner ces 3 fichiers en 1 (14 → 12 fichiers de route au total)
 * reste sous la limite sans toucher aux 11 autres routes déjà déployées
 * et qui fonctionnaient déjà — aucune modifiée, aucun risque pour elles.
 * Chaque bloc ci-dessous est le code EXACT des anciens fichiers,
 * seulement déplacé sous un nom de fonction et dispatché par `kind` :
 * aucune logique métier n'a changé (mêmes providers, même cache, même
 * cascade, mêmes garde-fous).
 */

const { sb, configure } = require('./_supabase.js');
const { deviseDe, SOURCE_NAME, SOURCE_URL } = require('../../scripts/lib/catalogImport.js');
const {
  SEARCH,
  QUOTE,
  FUNDAMENTALS,
  HISTORY,
  NEWS,
  KEYS,
  eodhdSymbolPourType,
  tdSymbol,
  coingeckoRef,
  frankfurterRef,
} = require('./_providers.js');
const { chargerBloc, historiqueValide } = require('./_marketBlock.js');
const { normaliserTicker, normaliserExchange } = require('./company.js');
const { resolveOrdre, noterResultat, TYPES_AVEC_ACTUALITES } = require('./_router.js');
const { lire, ecrire, avecVerrou } = require('./_cache.js');

/* ============================================================
   kind=news — ex api/market/news.js, inchangé
   ============================================================ */
const MAX_LIMIT = 30;
const DEFAULT_LIMIT = 10;

async function handleNews(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const ticker = normaliserTicker(req.query?.ticker);
  if (!ticker) return res.status(400).json({ error: 'ticker_invalide' });

  const exchange = normaliserExchange(req.query?.exchange);
  const frais = req.query?.fresh === '1';
  const type = String(req.query?.type || 'stock').toLowerCase();
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number(req.query?.limit) || DEFAULT_LIMIT));

  if (!TYPES_AVEC_ACTUALITES.has(type)) {
    return res.status(200).json({
      ticker, exchange, articles: null, source: null, asOf: null,
      journal: [{ bloc: 'news', ok: false, reason: `type_sans_actualites:${type}` }],
    });
  }

  const keys = KEYS();
  if (!keys.eodhd) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const journal = [];
  const n = await chargerBloc({
    nom: 'news',
    table: NEWS,
    ordre: resolveOrdre('news', ticker, exchange, type),
    args: [ticker, exchange, limit, type],
    ticker, exchange, frais, journal,
    cacheParts: [String(limit)],
  });
  noterResultat('news', ticker, exchange, type, n.source);

  const disponible = historiqueValide(n.data);

  return res.status(200).json({
    ticker,
    exchange,
    articles: disponible ? n.data : null,
    source: disponible ? n.source : null,
    asOf: disponible ? (n.data[0]?.date ?? null) : null,
    freshness: disponible ? n.freshness : null,
    provenance: disponible ? { source: n.source, sourceUrl: n.sourceUrl, retrievedAt: n.retrievedAt } : null,
    journal,
  });
}

/* ============================================================
   kind=catalog — ex api/market/catalog.js, inchangé
   ============================================================ */
const MAX_RESULTS = 50;
const DEFAULT_RESULTS = 20;
const MAX_QUERY_LENGTH = 100;
const CATALOG_TTL = 24 * 60 * 60 * 1000; // 24 h
const CATALOG_CACHE = new Map();
const TYPES_VALIDES = new Set(['stock', 'etf']);
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

function texteRecherche(value) {
  return String(value || '')
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .trim()
    .slice(0, MAX_QUERY_LENGTH);
}

function normaliserResultatCatalogue(row) {
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

/* ============================================================
   kind=worldnews — Nova News accueil (LOT C, 2026-09-25)
   ============================================================
   Actualité économique/financière MONDIALE, distincte de kind=news
   ci-dessus (par entreprise, déjà réelle). Sources : flux RSS PUBLICS,
   sans clé API — Yahoo Finance + CNBC, vérifiés en direct avant cette
   passe (chacun répond HTTP 200 avec du contenu réel et daté du jour
   même). Cascade honnête : si UNE source échoue, l'autre suffit à
   répondre ; seulement si LES DEUX échouent, l'erreur est renvoyée
   telle quelle — jamais un article inventé pour combler. Aucune clé à
   protéger ici (flux publics), donc aucun risque à exposer l'URL des
   sources au client (déjà visible dans `journal`/`sourcesUtilisees`). */
const WORLDNEWS_SOURCES = [
  { id: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
  { id: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
];
const WORLDNEWS_MAX = 40;
const WORLDNEWS_TIMEOUT_MS = 6000;

function decoderEntitesRss(valeur) {
  return String(valeur)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '') // un <title>/<description> RSS n'est jamais censé contenir de balises ; retirées si présentes plutôt que rendues telles quelles
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function champRss(bloc, tag) {
  const m = bloc.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decoderEntitesRss(m[1]) : null;
}

/* Image d'illustration, quand le flux en fournit une réellement — vérifié
   empiriquement : Yahoo Finance fournit un media:content (url) sur 100 %
   de ses items (49/49 testés), CNBC n'en fournit AUCUNE (aucune balise
   media, enclosure ou thumbnail sur tout le flux testé). Retourne null
   si absente : jamais une image générique/de remplacement inventée pour
   un article qui n'en a pas réellement une. */
function imageRss(bloc) {
  const m = bloc.match(/<media:content\b[^>]*\burl="([^"]+)"[^>]*\/?>/i)
    || bloc.match(/<enclosure\b[^>]*\burl="([^"]+)"[^>]*\btype="image\/[^"]*"[^>]*\/?>/i);
  if (!m) return null;
  const url = decoderEntitesRss(m[1]);
  return /^https:\/\//i.test(url) ? url : null;
}

/* Parseur RSS 2.0 minimal, volontairement sans dépendance (aucune n'est
   utilisée ailleurs dans ce projet) : suffisant pour la structure
   régulière <item><title>/<link>/<pubDate></item> des flux ci-dessus,
   vérifiée en direct avant cette passe. Une entrée sans titre NI lien
   exploitable est ignorée, jamais complétée par une valeur devinée. */
function parserRss(xml) {
  const items = [];
  const blocs = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const bloc of blocs) {
    const title = champRss(bloc, 'title');
    const link = champRss(bloc, 'link');
    if (!title || !link) continue;
    const pubDateRaw = champRss(bloc, 'pubDate');
    const d = pubDateRaw ? new Date(pubDateRaw) : null;
    const publishedAt = d && Number.isFinite(d.getTime()) ? d.toISOString() : null;
    items.push({ title: title.slice(0, 220), url: link, publishedAt, image: imageRss(bloc) });
  }
  return items;
}

async function telechargerFlux(source) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), WORLDNEWS_TIMEOUT_MS);
  try {
    const r = await fetch(source.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NovaBourseBot/1.0; +https://www.novabourse.site)' },
    });
    if (!r.ok) return { ok: false, source: source.id, reason: `HTTP ${r.status}` };
    const xml = await r.text();
    const items = parserRss(xml).map(it => ({ ...it, source: source.id }));
    return { ok: true, source: source.id, items };
  } catch (e) {
    return { ok: false, source: source.id, reason: e.name === 'AbortError' ? 'delai_depasse' : String(e.message || e) };
  } finally {
    clearTimeout(t);
  }
}

async function handleWorldNews(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const dejaEnCache = lire('worldnews', 'global');
  if (dejaEnCache) {
    return res.status(200).json({ ...dejaEnCache.valeur, cached: true });
  }

  const { value } = await avecVerrou('worldnews', 'global', async () => {
    const resultats = await Promise.all(WORLDNEWS_SOURCES.map(telechargerFlux));
    const journal = resultats.map(r => ({ source: r.source, ok: r.ok, reason: r.reason || null, items: r.ok ? r.items.length : 0 }));

    const parUrl = new Map();
    for (const r of resultats) {
      if (!r.ok) continue;
      for (const it of r.items) { if (!parUrl.has(it.url)) parUrl.set(it.url, it); }
    }
    const items = [...parUrl.values()]
      .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
      .slice(0, WORLDNEWS_MAX);

    const sourcesUtilisees = resultats.filter(r => r.ok).map(r => r.source);
    const valeur = {
      items,
      sourcesUtilisees,
      partial: sourcesUtilisees.length < WORLDNEWS_SOURCES.length,
      journal,
      asOf: new Date().toISOString(),
    };
    if (sourcesUtilisees.length > 0) ecrire('worldnews', 'global', valeur, 'rss');
    return valeur;
  });

  if (!value.sourcesUtilisees.length) {
    return res.status(502).json({ error: 'sources_indisponibles', journal: value.journal });
  }
  return res.status(200).json({ ...value, cached: false });
}

async function handleCatalog(req, res) {
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
  const hit = CATALOG_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < CATALOG_TTL) {
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
  const results = page.map(normaliserResultatCatalogue);

  const payload = {
    results,
    count: results.length,
    nextCursor: aPlus ? page[page.length - 1].listing_key : null,
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    partial: false,
  };

  CATALOG_CACHE.set(cacheKey, { at: Date.now(), payload });

  return res.status(200).json(payload);
}

/* ============================================================
   kind=health — ex api/market/health.js, inchangé
   ============================================================ */
const essai = async (fn, args) => {
  const t0 = Date.now();
  try {
    const d = await fn(...args);
    return { ok: true, ms: Date.now() - t0, apercu: JSON.stringify(d).slice(0, 220) };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, erreur: e.status ? `HTTP ${e.status}` : e.message, corps: e.body || null };
  }
};

function parametreValide(value, maxLength, autoriserSlash = false) {
  const motif = autoriserSlash ? /^[A-Z0-9._/-]+$/i : /^[A-Z0-9._-]+$/i;
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maxLength &&
    motif.test(value)
  );
}

async function handleHealth(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const attendu = process.env.DIAG_SECRET;
  if (!attendu) {
    return res.status(404).json({ error: 'introuvable' });
  }

  const fourni = req.headers['x-diag-secret'];
  if (typeof fourni !== 'string' || fourni.length === 0 || fourni !== attendu) {
    return res.status(401).json({ error: 'non_autorise' });
  }

  const ticker = String(req.query?.ticker || 'AAPL').trim().toUpperCase();
  const exchange = String(req.query?.exchange !== undefined ? req.query.exchange : 'NASDAQ').trim().toUpperCase();
  const type = String(req.query?.type || 'stock').trim().toLowerCase();

  if (!parametreValide(ticker, 30, true)) {
    return res.status(400).json({ error: 'ticker_invalide' });
  }
  if (exchange && !parametreValide(exchange, 40)) {
    return res.status(400).json({ error: 'exchange_invalide' });
  }

  const keys = KEYS();

  const out = {
    cles: {
      eodhd: Boolean(keys.eodhd),
      twelvedata: Boolean(keys.twelvedata),
      finnhub: Boolean(keys.finnhub),
      coingecko: Boolean(keys.coingecko),
      frankfurter: Boolean(keys.frankfurter),
    },
    ticker,
    exchange,
    type,
    providerSymbols: {
      eodhd: eodhdSymbolPourType(ticker, exchange, type),
      twelvedata: tdSymbol(ticker, exchange),
      coingecko: (type === 'crypto' && coingeckoRef(ticker)) || null,
      frankfurter: (type === 'forex' && frankfurterRef(ticker)) || null,
      finnhub: ticker,
    },
    tests: {},
  };

  const blocs = [
    ['quote', QUOTE, [ticker, exchange, type]],
    ['fundamentals', FUNDAMENTALS, [ticker, exchange]],
    ['history', HISTORY, [ticker, exchange, 30, type]],
    ['news', NEWS, [ticker, exchange, 5, type]],
    ['search', SEARCH, [ticker]],
  ];

  for (const [nom, table, args] of blocs) {
    out.tests[nom] = {};
    for (const provider of Object.keys(table)) {
      if (!keys[provider]) {
        out.tests[nom][provider] = { ok: false, erreur: 'cle_absente' };
        continue;
      }
      out.tests[nom][provider] = await essai(table[provider], [...args, keys[provider]]);
    }
  }

  return res.status(200).json(out);
}

/* ============================================================
   dispatch
   ============================================================ */
module.exports = async (req, res) => {
  const kind = String(req.query?.kind || '').toLowerCase();
  if (kind === 'news') return handleNews(req, res);
  if (kind === 'worldnews') return handleWorldNews(req, res);
  if (kind === 'catalog') return handleCatalog(req, res);
  if (kind === 'health') return handleHealth(req, res);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(400).json({ error: 'kind_invalide', kinds_valides: ['news', 'worldnews', 'catalog', 'health'] });
};
