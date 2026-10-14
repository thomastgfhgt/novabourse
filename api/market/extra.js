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

const fs = require('fs');
const path = require('path');
const { sb, configure } = require('./_supabase.js');
const { rejouerNovaBot, novabotRiskCheckServeur, montantInvestissableServeur, MONTANT_MIN_INVESTISSABLE } = require('./_novabotEngine.js');
const { deviseDe, SOURCE_NAME, SOURCE_URL } = require('../../scripts/lib/catalogImport.js');
const {
  SEARCH,
  QUOTE,
  FUNDAMENTALS,
  HISTORY,
  NEWS,
  KEYS,
  yahooSymbole,
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
  /* CORRECTIF (bug réel trouvé lors du retrait d'EODHD, 2026-10-06) :
     cette garde vérifiait EXCLUSIVEMENT keys.eodhd — toujours faux
     maintenant qu'EODHD est retiré, elle aurait renvoyé 503 à chaque
     appel alors que Yahoo (NEWS.yahoo, sans clé) fonctionne. */
  if (!keys.yahoo) {
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

  /* CORRECTIF (collision de ticker, 2026-10-06 — voir le "cas réel MC" déjà
     documenté dans sql/2026-09-15_market_catalog.sql) : la recherche floue
     ci-dessus (ILIKE + tri par listing_key) ne garantit PAS qu'un ticker
     court exact (ex. "MC") fasse remonter TOUTES ses sociétés homonymes —
     vérifié en direct : aucune des 3 sociétés réelles "MC" (LVMH/Euronext,
     Moelis & Co/NYSE, MC Group/SET) n'apparaît dans les 15 premiers
     résultats flous. Un correspondant EXACT (ticker=eq., jamais une
     recherche élargie) est donc ajouté EN PLUS, en tête, dès que la
     requête ressemble à un ticker (≤6 caractères) — le catalogue devient
     ainsi le désambiguïsateur réellement fiable qu'exige l'architecture
     "Supabase = référentiel central" plutôt que de dépendre du classement
     d'un moteur de recherche externe (Yahoo/Twelve Data/...) pour ce cas
     précis. Seulement sur la 1ère page (jamais sur un curseur de
     pagination) pour ne jamais dupliquer ces entrées sur une page
     suivante. */
  let exacts = [];
  if (!cursor && !ISIN_RE.test(isinCandidat)) {
    const qExact = qBrut.toUpperCase();
    if (qExact.length >= 1 && qExact.length <= 6 && /^[A-Z0-9.\-]+$/.test(qExact)) {
      const filtresExact = [`ticker=eq.${encodeURIComponent(qExact)}`];
      if (type) filtresExact.push(`asset_type=eq.${type}`);
      filtresExact.push('select=*');
      filtresExact.push(`limit=10`);
      try {
        exacts = await sb(`market_catalog_listings?${filtresExact.join('&')}`);
      } catch { /* la recherche floue reste disponible même si celle-ci échoue */ }
    }
  }

  const vus = new Set(exacts.map(r => r.listing_key));
  const aPlus = rows.length > limit;
  const page = [...exacts, ...rows.filter(r => !vus.has(r.listing_key))].slice(0, limit);
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
      yahoo: Boolean(keys.yahoo),
      twelvedata: Boolean(keys.twelvedata),
      finnhub: Boolean(keys.finnhub),
      coingecko: Boolean(keys.coingecko),
      frankfurter: Boolean(keys.frankfurter),
    },
    ticker,
    exchange,
    type,
    providerSymbols: {
      yahoo: yahooSymbole(ticker, exchange, type),
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
   kind=novabot-cron — V7 phase 2 (2026-10-12), étendu le 2026-10-13
   pour inclure les NOUVEAUX achats automatiques ("je veux que tout soit
   automatisé [...] sans appuyer sur un bouton") : "le système doit
   fonctionner côté serveur, même lorsque l'utilisateur ferme son
   navigateur". Déclenché par Vercel Cron (voir vercel.json, "crons") —
   Vercel ajoute automatiquement Authorization: Bearer $CRON_SECRET sur
   ces appels dès que la variable d'env CRON_SECRET existe ; même en-tête
   accepté pour un déclenchement manuel de test (curl), aucune distinction
   nécessaire. Jamais appelable sans ce secret : return 404 (pas 401, pour
   ne même pas révéler que la route existe) si le secret serveur est
   absent — même convention défensive que DIAG_SECRET ci-dessus.

   SORTIES (stop-loss/take-profit) : pour TOUS les modes d'autonomie,
   comme côté navigateur ("une protection de risque n'attend jamais un
   accord"). ENTRÉES (nouveaux achats) : exécutées immédiatement
   seulement en mode 'auto' ; en 'advice'/'semi_auto', une décision
   'pending' est créée — identique au comportement du bouton "Évaluer
   maintenant" côté navigateur, l'utilisateur l'approuve ensuite dans
   l'application.

   LIMITATION ASSUMÉE ET DOCUMENTÉE — univers de découverte restreint :
   la sélection de candidats côté navigateur s'appuie sur un score mis
   en cache localement au fil de la navigation (state local), qu'un
   serveur démarrant à froid n'a pas ; scanner tout le catalogue
   (46 000+ instruments) en vrais NovaScore à chaque cycle dépasserait
   le budget de temps d'une fonction serverless. NOVABOT_CRON_UNIVERS_
   DECOUVERTE ci-dessous est un panier volontairement restreint et
   explicite (18 grandes capitalisations européennes réelles, réparties
   sur 8 secteurs réels du catalogue, toutes cotées en EUR — voir le
   correctif de devise plus bas) — PAS le catalogue entier, le temps
   qu'un vrai cache de score serveur soit construit (chantier séparé).
   Chaque score reste 100% réel (même pipeline /api/market/company que
   le reste de l'app) : restreindre l'UNIVERS examiné n'invente jamais
   une note pour un instrument qui y figure.

   LIMITATION ASSUMÉE — réglages non synchronisés côté serveur : le
   seuil NovaScore d'achat, le stop-loss/take-profit et le montant par
   trade (cfg.scoreAchat/stopLossPct/takeProfitPct/tradeAmountEUR) ne
   sont stockés QUE côté navigateur (aucune colonne correspondante sur
   novabot_mandates) — ce cycle utilise les mêmes valeurs par défaut que
   l'application (70/10%/20%/500€), qui peuvent diverger d'un réglage
   que l'utilisateur aurait personnalisé. Synchroniser ces réglages vers
   le mandat serveur est un prérequis pour lever cette limitation,
   signalé ici plutôt que silencieusement ignoré.

   Bornes de charge (budget de temps d'une fonction serverless) : au plus
   NOVABOT_CRON_MAX_COMPTES comptes actifs par déclenchement ; un seul
   appel /api/market/company par instrument (position détenue OU
   candidat à l'achat), jamais par compte — PARTAGÉ et récupéré EN
   PARALLÈLE (Promise.all) entre tous les comptes traités, pour rester
   dans le budget de temps malgré plusieurs comptes et jusqu'à 20
   candidats de découverte. */
const NOVABOT_CRON_MAX_COMPTES = 15;
/* CORRECTIF (2026-10-13, trouvé en vérifiant le tout premier déclenchement
   réel en production) : la liste initiale (Apple, Microsoft, Nvidia...)
   était intégralement en USD — la restriction "devise EUR uniquement"
   déjà en place pour les sorties (conversion non gérée par ce cycle,
   voir _novabotEngine.js) les excluait donc TOUTES, rendant la
   découverte totalement inopérante malgré un déploiement propre et des
   tests qui passaient (les tests vérifient la logique de filtrage,
   jamais le contenu réel du catalogue — une lacune de couverture
   corrigée indirectement en vérifiant ces ids en production). Remplacé
   par 18 grandes capitalisations européennes RÉELLEMENT cotées en EUR
   (vérifié contre catalog.json), mêmes secteurs représentés. */
const NOVABOT_CRON_UNIVERS_DECOUVERTE = [
  'ASML-AS', // Technologie
  'MC-PA', 'OR-PA', 'RMS-PA', 'MBG-DE', // Consommation
  'TTE-PA', // Énergie
  'SAN-MC', 'BNP-PA', 'CS-PA', 'ISP-MI', // Finance
  'SU-PA', 'DG-PA', 'SGO-PA', // Industrie
  'BAS-DE', 'ORA-PA', // Matériaux
  'DTE-DE', // Télécommunications
  'IBE-MC', 'ENGI-PA', // Services publics
];
/* Score minimum pour déclencher un achat — même défaut que state.novabot.
   scoreAchat côté client (limitation ci-dessus : non synchronisé). */
const NOVABOT_CRON_SCORE_ACHAT = 70;
const NOVABOT_CRON_TRADE_AMOUNT_EUR = 500;

let CATALOGUE_PAR_ID = null;
function catalogueParId(){
  if (CATALOGUE_PAR_ID) return CATALOGUE_PAR_ID;
  try {
    const brut = fs.readFileSync(path.join(process.cwd(), 'catalog.json'), 'utf8');
    const liste = JSON.parse(brut);
    CATALOGUE_PAR_ID = new Map(liste.map(st => [st.id, st]));
  } catch (e){
    console.error('[novabot-cron] catalogue illisible :', e.message);
    CATALOGUE_PAR_ID = new Map();
  }
  return CATALOGUE_PAR_ID;
}

async function handleNovabotCron(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const attendu = process.env.CRON_SECRET;
  if (!attendu) return res.status(404).json({ error: 'introuvable' });
  const auth = req.headers['authorization'] || '';
  const fourni = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (fourni !== attendu) return res.status(401).json({ error: 'non_autorise' });

  if (!configure()) return res.status(503).json({ error: 'supabase_indisponible' });

  const rapport = { comptesTraites: 0, positionsExaminees: 0, ventesDeclenchees: 0,
    candidatsExamines: 0, achatsDeclenches: 0, propositionsCreees: 0, erreurs: [] };

  try {
    const comptes = await sb(`novabot_accounts?status=eq.active&select=*&limit=${NOVABOT_CRON_MAX_COMPTES}`);
    const byId = catalogueParId();
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = `${proto}://${req.headers.host}`;

    /* Un seul appel /api/market/company par instrument pour TOUT le
       cycle — positions détenues ET univers de découverte confondus —
       jamais répété par compte. dossierCache : id -> { prix, score,
       volatility, maxDrawdown, fundamentals } | null (échec ou données
       insuffisantes, jamais une valeur inventée à la place). */
    const dossierCache = new Map();
    async function recupererDossier(id){
      if (dossierCache.has(id)) return dossierCache.get(id);
      const st = byId.get(id);
      if (!st){ dossierCache.set(id, null); return null; }
      try {
        const r = await fetch(`${base}/api/market/company?ticker=${encodeURIComponent(st.ticker)}`
          + `&exchange=${encodeURIComponent(st.exchangeCode || '')}&type=${encodeURIComponent(st.type || 'stock')}`);
        const d = r.ok ? await r.json() : null;
        const dossier = d && Number.isFinite(d.price) && d.price > 0 ? {
          prix: d.price,
          score: Number.isFinite(d.novaScore?.score) ? d.novaScore.score : null,
          volatility: Number.isFinite(d.novaScore?.volatility) ? d.novaScore.volatility : null,
          maxDrawdown: Number.isFinite(d.novaScore?.maxDrawdown) ? d.novaScore.maxDrawdown : null,
          fundamentals: d.fundamentals || null,
        } : null;
        dossierCache.set(id, dossier);
        return dossier;
      } catch { dossierCache.set(id, null); return null; }
    }

    /* Positions RÉELLEMENT détenues par au moins un des comptes traités
       + l'univers de découverte entier : récupérés EN PARALLÈLE avant la
       boucle par compte (Promise.all), pas en série — reste dans le
       budget de temps malgré plusieurs comptes et jusqu'à 20 candidats. */
    const walletsParCompte = new Map();
    for (const compte of comptes) {
      try {
        const txRows = await sb(`novabot_transactions?account_id=eq.${encodeURIComponent(compte.id)}&select=*`);
        const transactions = txRows.map(r => ({
          stockId: r.stock_id, type: r.type, qty: r.qty, priceLocal: r.price_local,
          currency: r.currency, amountEUR: r.amount_eur, realizedGain: r.realized_gain, date: r.occurred_at,
        }));
        walletsParCompte.set(compte.id, rejouerNovaBot(transactions));
      } catch (e){
        rapport.erreurs.push({ accountId: compte.id, message: e.message });
      }
    }
    const idsAPrefetcher = new Set(NOVABOT_CRON_UNIVERS_DECOUVERTE);
    for (const wallet of walletsParCompte.values()) for (const pos of wallet.positions) idsAPrefetcher.add(pos.id);
    await Promise.all([...idsAPrefetcher].map(recupererDossier));

    for (const compte of comptes) {
      rapport.comptesTraites++;
      const wallet = walletsParCompte.get(compte.id);
      if (!wallet) continue; // rejeu du journal déjà en échec, erreur déjà consignée ci-dessus
      try {
        const mandateRows = await sb(`novabot_mandates?account_id=eq.${encodeURIComponent(compte.id)}&is_current=eq.true&select=*&limit=1`);
        const mandateRow = mandateRows[0];
        /* CORRECTIF (audit 2026-10-14) : relit maintenant les réglages
           RÉELLEMENT choisis par l'utilisateur (voir sql/2026-10-14_
           novabot_trading_rules.sql + pushNovaBot(), js/core.js) — avant
           ce correctif, ce cycle utilisait TOUJOURS les mêmes valeurs par
           défaut que l'application, quel que soit le réglage personnalisé
           de l'utilisateur dans "Mon mandat -> Réglages avancés". Repli
           sur ces mêmes défauts UNIQUEMENT si trading_rules est absent
           (compte créé avant ce correctif, ou navigateur jamais rouvert
           depuis) — jamais une valeur inventée à la place. */
        const tr = mandateRow?.trading_rules || {};
        const stopLossPct = Number.isFinite(tr.stopLossPct) ? tr.stopLossPct : 10;
        const takeProfitPct = Number.isFinite(tr.takeProfitPct) ? tr.takeProfitPct : 20;
        const scoreAchat = Number.isFinite(tr.scoreAchat) ? tr.scoreAchat : NOVABOT_CRON_SCORE_ACHAT;
        const tradeAmountEUR = Number.isFinite(tr.tradeAmountEUR) ? tr.tradeAmountEUR : NOVABOT_CRON_TRADE_AMOUNT_EUR;

        /* --- sorties : positions détenues (inchangé) --- */
        for (const pos of [...wallet.positions]){
          rapport.positionsExaminees++;
          const st = byId.get(pos.id);
          if (!st || st.cur !== 'EUR') continue; // limitation V1 : conversion devise non gérée ici (voir _novabotEngine.js)
          const dossier = dossierCache.get(pos.id);
          if (!dossier) continue; // §32 : cours indisponible -> pas d'ordre, jamais un cours inventé
          const prix = dossier.prix;

          const gainPct = ((prix - pos.avg) / pos.avg) * 100;
          if (gainPct > -stopLossPct && gainPct < takeProfitPct) continue;

          const motif = gainPct <= -stopLossPct
            ? `Stop-loss déclenché (cycle automatique) : position à ${gainPct.toFixed(1)} %`
            : `Take-profit déclenché (cycle automatique) : position à +${gainPct.toFixed(1)} %`;
          const amountEUR = prix * pos.qty;
          const cashAvant = wallet.cash;
          const txId = 'nbtx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          const decId = 'nd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const nowIso = new Date().toISOString();

          await sb('novabot_transactions', { method: 'POST', body: JSON.stringify([{
            id: txId, user_id: compte.user_id, account_id: compte.id,
            stock_id: pos.id, ticker: st.ticker, name: st.name, type: 'sell',
            qty: pos.qty, price_local: prix, currency: st.cur, amount_eur: amountEUR,
            realized_gain: (prix - pos.avg) * pos.qty, decision_id: decId, reason: motif,
            occurred_at: nowIso,
          }]) });
          await sb('novabot_decisions', { method: 'POST', body: JSON.stringify([{
            id: decId, user_id: compte.user_id, account_id: compte.id,
            action: 'sell', stock_id: pos.id, ticker: st.ticker, name: st.name,
            price_observed: prix, qty: pos.qty, amount_eur: amountEUR,
            cash_before: cashAvant, cash_after: cashAvant + amountEUR,
            reason: motif, data_used: { gainPct, source: 'novabot-cron' },
            execution_status: 'simulated', occurred_at: nowIso,
          }]) });
          wallet.cash += amountEUR;
          /* CORRECTIF (2026-10-13, trouvé en ajoutant les entrées ci-
             dessous) : la position vendue n'était jamais retirée de
             wallet.positions — sans incidence tant que seules les
             sorties existaient (chaque position n'est examinée qu'une
             fois par passage), mais la logique d'entrée plus bas
             vérifie "déjà détenu ?" sur CE MÊME wallet en mémoire : sans
             ce retrait, un titre à peine vendu aurait pu être
             immédiatement rejugé "détenu" à tort. */
          wallet.positions = wallet.positions.filter(p => p.id !== pos.id);
          rapport.ventesDeclenchees++;
        }

        /* --- entrées : nouveaux achats (2026-10-13, "tout automatisé
           sans appuyer sur un bouton") --- */
        if (!mandateRow) continue; // pas de mandat confirmé -> rien à risque-vérifier, jamais un achat sans mandat réel
        const mandate = {
          cashMinPct: Number.isFinite(mandateRow.cash_min_pct) ? mandateRow.cash_min_pct : 20,
          maxPositionPct: Number.isFinite(mandateRow.max_position_pct) ? mandateRow.max_position_pct : 10,
          hardRules: Array.isArray(mandateRow.hard_rules) ? mandateRow.hard_rules : [],
          /* preferences (2026-10-15, parité avec js/core.js) : NON
             contraignantes par définition — consommées ICI pour filtrer la
             découverte, jamais ajoutées à novabotRiskCheckServeur() qui
             reste strictement réservé aux hard rules (même séparation que
             côté client, voir evaluerNovaBot()). */
          preferences: Array.isArray(mandateRow.preferences) ? mandateRow.preferences : [],
        };
        const maxPriceEURPref = Number(mandate.preferences.find(p => p.type === 'max_price_eur')?.value);
        const prixPlafond = Number.isFinite(maxPriceEURPref) ? maxPriceEURPref : null;
        for (const id of NOVABOT_CRON_UNIVERS_DECOUVERTE){
          const st = byId.get(id);
          if (!st || st.cur !== 'EUR') continue; // même limitation devise que les sorties
          if (wallet.positions.some(p => p.id === id)) continue; // déjà détenu -> renforcement non géré par ce cycle (v1)
          if (mandate.hardRules.some(r => r.type === 'excluded_sector' && r.value === st.sector)) continue;
          if (mandate.hardRules.some(r => r.type === 'excluded_asset' && (r.value === id || r.value === st.ticker))) continue;
          rapport.candidatsExamines++;
          const dossier = dossierCache.get(id);
          if (!dossier || dossier.score === null) continue; // §32 : NovaScore indisponible -> pas d'ordre
          if (dossier.score < scoreAchat) continue;
          /* dossier.prix est déjà en EUR à ce stade (st.cur==='EUR' imposé
             ligne ci-dessus) — jamais de conversion supplémentaire ici. */
          if (prixPlafond !== null && dossier.prix > prixPlafond) continue;

          const pfCourant = { total: wallet.cash + wallet.positions.reduce((s, p) => {
            const pst = byId.get(p.id); const pd = dossierCache.get(p.id);
            return s + (pst && pd ? pd.prix * p.qty : p.avg * p.qty);
          }, 0) };
          const sizing = montantInvestissableServeur({
            tradeAmountEUR,
            cashDispo: wallet.cash - (mandate.cashMinPct / 100) * pfCourant.total,
            pfTotalEUR: pfCourant.total, maxPositionPct: mandate.maxPositionPct, valeurExistanteEUR: 0,
          });
          if (sizing < MONTANT_MIN_INVESTISSABLE) continue;

          const intent = { action: 'buy', stockId: id, ticker: st.ticker, sector: st.sector, amountEUR: sizing };
          const verdict = novabotRiskCheckServeur(intent, wallet, mandate, pfCourant.total);
          const motif = `NovaScore ${dossier.score} ≥ seuil ${scoreAchat} (cycle automatique)`;
          const decId = 'nd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          const nowIso = new Date().toISOString();

          if (!verdict.allowed){
            await sb('novabot_decisions', { method: 'POST', body: JSON.stringify([{
              id: decId, user_id: compte.user_id, account_id: compte.id,
              action: 'reject', stock_id: id, ticker: st.ticker, name: st.name,
              price_observed: dossier.prix, amount_eur: sizing, execution_status: 'rejected',
              reason: verdict.violations.map(v => v.message).join(' '),
              data_used: { novaScore: dossier.score, source: 'novabot-cron' }, occurred_at: nowIso,
            }]) });
            continue;
          }

          if (compte.autonomy_mode === 'auto'){
            const qty = sizing / dossier.prix;
            const txId = 'nbtx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            await sb('novabot_transactions', { method: 'POST', body: JSON.stringify([{
              id: txId, user_id: compte.user_id, account_id: compte.id,
              stock_id: id, ticker: st.ticker, name: st.name, type: 'buy',
              qty, price_local: dossier.prix, currency: st.cur, amount_eur: sizing,
              decision_id: decId, reason: motif, occurred_at: nowIso,
            }]) });
            await sb('novabot_decisions', { method: 'POST', body: JSON.stringify([{
              id: decId, user_id: compte.user_id, account_id: compte.id,
              action: 'buy', stock_id: id, ticker: st.ticker, name: st.name,
              price_observed: dossier.prix, qty, amount_eur: sizing,
              cash_before: wallet.cash, cash_after: wallet.cash - sizing,
              reason: motif, data_used: { novaScore: dossier.score, volatility: dossier.volatility,
                maxDrawdown: dossier.maxDrawdown, source: 'novabot-cron' },
              execution_status: 'simulated', occurred_at: nowIso,
            }]) });
            wallet.cash -= sizing;
            wallet.positions.push({ id, qty, avg: dossier.prix, currency: st.cur });
            rapport.achatsDeclenches++;
          } else {
            await sb('novabot_decisions', { method: 'POST', body: JSON.stringify([{
              id: decId, user_id: compte.user_id, account_id: compte.id,
              action: 'buy', stock_id: id, ticker: st.ticker, name: st.name,
              price_observed: dossier.prix, qty: sizing / dossier.prix, amount_eur: sizing,
              cash_before: wallet.cash, cash_after: wallet.cash,
              reason: `${motif} (en attente de ton accord — mode ${compte.autonomy_mode === 'advice' ? 'conseil' : 'semi-autonome'})`,
              data_used: { novaScore: dossier.score, source: 'novabot-cron' },
              execution_status: 'pending', occurred_at: nowIso,
            }]) });
            rapport.propositionsCreees++;
          }
        }
      } catch (e){
        rapport.erreurs.push({ accountId: compte.id, message: e.message });
      }
    }
  } catch (e){
    console.error('[novabot-cron] échec :', e.message);
    return res.status(503).json({ error: 'cycle_impossible', message: e.message });
  }

  return res.status(200).json(rapport);
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
  if (kind === 'novabot-cron') return handleNovabotCron(req, res);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(400).json({ error: 'kind_invalide', kinds_valides: ['news', 'worldnews', 'catalog', 'health', 'novabot-cron'] });
};
