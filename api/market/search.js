/**
 * GET /api/market/search?q=air%20liquide
 *
 * Recherche mondiale d'instruments.
 *
 * Les résultats proviennent uniquement des fournisseurs marché.
 * Aucune société n'est codée en dur.
 *
 * Principes :
 *   - plusieurs fournisseurs peuvent contribuer au même résultat ;
 *   - ticker + place identifient l'instrument ;
 *   - les places sont normalisées vers les codes internes NovaBourse ;
 *   - aucun résultat fictif n'est généré ;
 *   - aucun fournisseur ne peut masquer les suivants simplement parce
 *     qu'il a renvoyé quelques résultats.
 */

const {
  SEARCH,
  KEYS,
} = require('./_providers.js');

const CACHE = new Map();

const TTL = 60 * 60 * 1000; // 1 heure
const MAX_RESULTS = 15;
const MAX_QUERY_LENGTH = 100;

const ORDRE = [
  'eodhd',
  'twelvedata',
  'finnhub',
];

/* ============================================================
   NORMALISATION DES PLACES
   ============================================================ */

const EXCHANGE_ALIASES = {
  NASDAQ: 'NASDAQ',
  'NASDAQ GLOBAL SELECT': 'NASDAQ',
  'NASDAQ GLOBAL MARKET': 'NASDAQ',
  'NASDAQ CAPITAL MARKET': 'NASDAQ',
  NYSE: 'NYSE',
  'NEW YORK STOCK EXCHANGE': 'NYSE',
  'NYSE ARCA': 'NYSE ARCA',
  ARCA: 'NYSE ARCA',
  PA: 'PA',
  PARIS: 'PA',
  'EURONEXT PARIS': 'PA',
  AS: 'AS',
  AMSTERDAM: 'AS',
  'EURONEXT AMSTERDAM': 'AS',
  BR: 'BR',
  BRUSSELS: 'BR',
  'EURONEXT BRUSSELS': 'BR',
  LS: 'LS',
  LISBON: 'LS',
  'EURONEXT LISBON': 'LS',
  DE: 'DE',
  XETRA: 'DE',
  FRANKFURT: 'DE',
  SW: 'SW',
  SIX: 'SW',
  'SIX SWISS EXCHANGE': 'SW',
  L: 'L',
  LSE: 'L',
  'LONDON STOCK EXCHANGE': 'L',
  MC: 'MC',
  BME: 'MC',
  MADRID: 'MC',
  MI: 'MI',
  MTA: 'MI',
  MILAN: 'MI',
  'BORSA ITALIANA': 'MI',
  ST: 'ST',
  STOCKHOLM: 'ST',
  OMX: 'ST',
  'NASDAQ STOCKHOLM': 'ST',
  CO: 'CO',
  COPENHAGEN: 'CO',
  OMXC: 'CO',
  'NASDAQ COPENHAGEN': 'CO',
  HE: 'HE',
  HELSINKI: 'HE',
  OMXH: 'HE',
  'NASDAQ HELSINKI': 'HE',
  OL: 'OL',
  OSLO: 'OL',
  OSL: 'OL',
};

function normaliserExchange(value) {
  if (value === null || value === undefined) return null;
  const brut = String(value).trim();
  if (!brut) return null;
  const cle = brut.toUpperCase().replace(/\s+/g, ' ');
  return EXCHANGE_ALIASES[cle] || cle;
}

/* ============================================================
   NORMALISATION TEXTE
   ============================================================ */

function propre(value) {
  if (typeof value !== 'string') return null;
  const valueTrimmed = value.trim();
  return valueTrimmed ? valueTrimmed : null;
}

/* Retire les signes diacritiques (accents, cédilles...) pour la SEULE
   finalité de comparer deux chaînes lors du calcul de pertinence.
   N'affecte JAMAIS les données stockées/retournées : `name`/`ticker`
   gardent leur graphie exacte (ex. "Hermès" reste affiché avec l'accent).
   Cause réelle corrigée ici, confirmée empiriquement : une recherche
   "Hermes" (sans accent — le cas le plus probable en pratique, l'accent
   n'étant pas d'accès direct sur la plupart des claviers) ne matchait
   jamais "Hermès International" (nom stocké avec l'accent), ce dernier
   se retrouvant alors à égalité de score (0) avec du bruit sans aucun
   rapport, et perdant le départage alphabétique. */
function sansAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normaliserTicker(value) {
  const ticker = propre(value);
  if (!ticker) return null;
  const out = ticker.toUpperCase();
  /* CORRECTIF (audit multi-actifs), confirmé empiriquement : le "/" est
     rejeté, alors que c'est le format standard d'une paire Forex
     ("EUR/USD") — Twelve Data l'utilise tel quel comme symbole (confirmé
     par leur documentation officielle, y compris pour le WebSocket). Le
     "/" est ajouté au jeu de caractères autorisés, rien d'autre ne change :
     la limite de longueur et le reste du filtre (contre l'injection dans
     une URL de provider) restent strictement identiques. */
  if (out.length > 30 || !/^[A-Z0-9._/-]+$/.test(out)) return null;
  return out;
}

/* ============================================================
   TYPES D'INSTRUMENTS
   ============================================================ */

function typeAccepte(type) {
  /*
   * Certains fournisseurs ne donnent aucun type.
   * On ne rejette pas automatiquement ces résultats :
   * le ticker + le nom restent des informations réelles.
   *
   * CORRECTIF (audit multi-actifs) : la regex précédente ne matchait que
   * action/ETF ("common stock", "equity", "etf"...) et rejetait donc
   * systématiquement tout résultat Forex ("Physical Currency" chez
   * Twelve Data), Crypto ("Digital Currency") ou Indice ("Index") —
   * confirmé empiriquement, pas supposé. Élargi pour accepter ces types
   * réels sans changer le comportement existant pour les actions/ETF.
   */
  if (!type) return true;
  return /common stock|common share|ordinary share|equity|stock|cs|etf|index|indices|currency|forex|fx|crypto|digital currency|physical currency/i.test(type);
}

/* Fait correspondre un type brut fournisseur (très hétérogène selon EODHD/
   Twelve Data/Finnhub) à la taxonomie interne NovaBourse. Volontairement
   conservateur : un type non reconnu devient 'stock' par défaut plutôt que
   d'inventer une nouvelle catégorie — cohérent avec le comportement actuel
   avant cette passe, où tout était implicitement une action. */
function typeInterne(type) {
  const t = String(type || '').toLowerCase();
  if (/digital currency|crypto/.test(t)) return 'crypto';
  if (/physical currency|forex|^fx$|currency/.test(t)) return 'forex';
  if (/^index$|indices/.test(t)) return 'index';
  if (/etf/.test(t)) return 'etf';
  return 'stock';
}

/* ============================================================
   NORMALISATION D'UN RÉSULTAT
   ============================================================ */

function normaliserResultat(raw, provider) {
  if (!raw || typeof raw !== 'object') return null;
  const ticker = normaliserTicker(raw.ticker);
  const name = propre(raw.name);
  if (!ticker || !name) return null;
  if (!typeAccepte(raw.type)) return null;
  const exchange = normaliserExchange(raw.exchange);
  return {
    ticker,
    exchange,
    name,
    country: propre(raw.country),
    currency: propre(raw.currency),
    type: propre(raw.type),
    /* Taxonomie interne dérivée du type brut fournisseur (voir
       typeInterne()) — additif : ne remplace pas `type`, qui garde la
       valeur brute exacte du fournisseur pour référence/debug. */
    assetType: typeInterne(raw.type),
    id: exchange ? `${ticker}@${exchange}` : ticker,
    provider,
    providers: [provider],
  };
}

/* ============================================================
   FUSION DE RÉSULTATS
   ============================================================ */

function pertinence(result, query) {
  /* Comparaison insensible aux accents (voir sansAccents()) — c'est la
     correction du bug confirmé empiriquement : sans ceci, "Hermes" (sans
     accent) ne matchait jamais "Hermès" (avec accent). */
  const q = sansAccents(query.trim().toLowerCase());
  const ticker = sansAccents(String(result.ticker || '').toLowerCase());
  const name = sansAccents(String(result.name || '').toLowerCase());
  let score = 0;
  if (ticker === q) score += 100;
  if (name === q) score += 90;
  if (ticker.startsWith(q)) score += 60;
  if (name.startsWith(q)) score += 50;
  if (name.includes(q)) score += 30;
  if (ticker.includes(q)) score += 20;
  if (result.exchange) score += 5;
  return score;
}

function fusionner(existant, nouveau) {
  const providers = [...new Set([...(existant.providers || []), ...(nouveau.providers || [])])];
  return {
    ...existant,
    name: existant.name || nouveau.name,
    country: existant.country || nouveau.country,
    currency: existant.currency || nouveau.currency,
    type: existant.type || nouveau.type,
    assetType: existant.assetType || nouveau.assetType,
    exchange: existant.exchange || nouveau.exchange,
    providers,
    provider: existant.provider || nouveau.provider,
  };
}

/* ============================================================
   ROUTE
   ============================================================ */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'public, s-maxage=600');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const q = String(req.query?.q || '').trim();
  if (q.length < 2) return res.status(400).json({ error: 'requete_trop_courte' });
  if (q.length > MAX_QUERY_LENGTH) return res.status(400).json({ error: 'requete_trop_longue' });

  const keys = KEYS();
  if (!keys.eodhd && !keys.twelvedata && !keys.finnhub) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const cacheKey = q.toLowerCase().replace(/\s+/g, ' ');
  const hit = CACHE.get(cacheKey);
  if (hit && (Date.now() - hit.at < TTL)) {
    return res.status(200).json({ ...hit.payload, cached: true });
  }

  const journal = [];
  const resultats = new Map();

  for (const provider of ORDRE) {
    if (!keys[provider]) {
      journal.push({ provider, ok: false, reason: 'cle_absente' });
      continue;
    }
    const fonction = SEARCH[provider];
    if (typeof fonction !== 'function') continue;

    try {
      const bruts = await fonction(q, keys[provider]);
      let acceptes = 0;
      for (const brut of (Array.isArray(bruts) ? bruts : [])) {
        const resultat = normaliserResultat(brut, provider);
        if (!resultat) continue;
        const existant = resultats.get(resultat.id);
        if (existant) {
          resultats.set(resultat.id, fusionner(existant, resultat));
        } else {
          resultats.set(resultat.id, resultat);
        }
        acceptes++;
      }
      journal.push({ provider, ok: true, recus: Array.isArray(bruts) ? bruts.length : 0, acceptes });
      if (resultats.size >= MAX_RESULTS * 2) break;
    } catch (error) {
      journal.push({ provider, ok: false, reason: error.status ? `HTTP ${error.status}` : (error.message || 'erreur_fournisseur') });
    }
  }

  const scores = [...resultats.values()]
    .map(result => ({ ...result, _pertinence: pertinence(result, q) }));

  /* Plancher de pertinence : un résultat à score 0 n'a aucune correspondance
     textuelle réelle avec la requête (ni ticker, ni nom, ni préfixe) — ce
     n'est pas "un résultat moins bon", c'est du bruit qui ne devrait
     apparaître que s'il n'y a strictement rien d'autre. Confirmé
     empiriquement : c'est ce qui faisait apparaître "Hera S.p.A." et
     "Hermana Holding" pour une recherche Hermès, sans aucun rapport
     textuel, simplement parce que la liste n'était jamais filtrée. */
  const pertinents = scores.filter(r => r._pertinence > 0);
  const base = pertinents.length ? pertinents : scores;

  const results = base
    .sort((a, b) => {
      if (b._pertinence !== a._pertinence) return b._pertinence - a._pertinence;
      if (Boolean(b.exchange) !== Boolean(a.exchange)) return b.exchange ? 1 : -1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, MAX_RESULTS)
    .map(({ _pertinence, ...result }) => result);

  const sources = [...new Set(results.flatMap(result => result.providers || []))];

  const payload = {
    results,
    source: sources.length === 1 ? sources[0] : null,
    sources,
    partial: results.length === 0,
    journal,
  };

  if (results.length) {
    CACHE.set(cacheKey, { at: Date.now(), payload });
  }

  return res.status(200).json(payload);
};

module.exports.normaliserExchange = normaliserExchange;
module.exports.normaliserResultat = normaliserResultat;
module.exports.pertinence = pertinence;
/* Exposé pour api/market/_exchangeCrosswalk.js : réutilise cette table
   plutôt que d'en dupliquer une variante. Export additif, aucun changement
   de comportement de cette route. */
module.exports.EXCHANGE_ALIASES = EXCHANGE_ALIASES;
