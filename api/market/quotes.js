const { BATCH, KEYS, idDe } = require('./_providers.js');
const { lire, ecrire } = require('./_cache.js');

const ORDRE = ['twelvedata', 'eodhd', 'finnhub'];
const MAX_SYMBOLES = 120;

function normaliserSymbole(raw) {
  if (typeof raw !== 'string') return null;
  const valeur = raw.trim();
  if (!valeur || valeur.length > 80) return null;
  const morceaux = valeur.split('@');
  if (morceaux.length > 2) return null;
  const ticker = String(morceaux[0] || '').trim().toUpperCase();
  const exchange = String(morceaux[1] || '').trim().toUpperCase();
  /* CORRECTIF (audit multi-actifs) : troisième occurrence indépendante du
     même bug, déjà corrigé dans search.js et company.js — confirmé
     empiriquement ici aussi avant correction : normaliserSymbole('EUR/USD@')
     renvoyait null, donc parseSymboles() éliminait silencieusement TOUTES
     les paires Forex/Crypto avant même le premier appel réseau. C'est la
     cause exacte du "—" observé sur Marchés pour Forex/Crypto. Le "/" est
     ajouté au jeu de caractères autorisés, rien d'autre ne change. */
  if (!ticker || ticker.length > 30 || !/^[A-Z0-9._/-]+$/.test(ticker)) return null;
  if (exchange && (exchange.length > 40 || !/^[A-Z0-9 ._-]+$/.test(exchange))) return null;
  return { ticker, exchange };
}

function parseSymboles(raw) {
  const valeurs = String(raw || '').split(',');
  const uniques = new Map();
  for (const valeur of valeurs) {
    const symbole = normaliserSymbole(valeur);
    if (!symbole) continue;
    uniques.set(idDe(symbole), symbole);
    if (uniques.size >= MAX_SYMBOLES) break;
  }
  return [...uniques.values()];
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const demandes = parseSymboles(req.query?.symbols);
  if (!demandes.length) return res.status(400).json({ error: 'symbols_manquant' });

  const keys = KEYS();
  if (!keys.twelvedata && !keys.eodhd && !keys.finnhub) {
    return res.status(200).json({
      quotes: [], connected: false, source: null, sources: [], partial: true,
      missing: demandes.map(idDe), reason: 'aucun_fournisseur_configure', journal: [],
    });
  }

  const journal = [];
  const trouve = new Map();
  const aChercher = [];
  const fresh = req.query?.fresh === '1';

  if (fresh) {
    aChercher.push(...demandes);
  } else {
    for (const valeur of demandes) {
      const hit = lire('quote', valeur.ticker, valeur.exchange);
      if (hit) {
        trouve.set(idDe(valeur), { ...hit.valeur, source: hit.source, cached: true });
      } else {
        aChercher.push(valeur);
      }
    }
  }

  let reste = [...aChercher];

  for (const nom of ORDRE) {
    if (!reste.length) break;
    if (!keys[nom]) {
      journal.push({ provider: nom, ok: false, reason: 'cle_absente' });
      continue;
    }
    const limite = Number(BATCH.limite?.[nom]);
    if (!Number.isFinite(limite) || limite <= 0) {
      journal.push({ provider: nom, ok: false, reason: 'limite_invalide' });
      continue;
    }
    const maxLots = nom === 'finnhub' ? 1 : Math.ceil(reste.length / limite);
    let numeroLot = 0;

    while (reste.length && numeroLot < maxLots) {
      numeroLot++;
      const lot = reste.slice(0, limite);
      if (!lot.length) break;

      try {
        const map = await BATCH[nom](lot, keys[nom]);
        const idsLot = new Set(lot.map(idDe));
        for (const [id, quote] of map) {
          if (!idsLot.has(id)) continue;
          trouve.set(id, { ...quote, source: nom, cached: false });
          ecrire('quote', [quote.ticker, quote.exchange], quote, nom);
        }
        const avant = reste.length;
        reste = reste.filter(valeur => !map.has(idDe(valeur)));
        const obtenus = avant - reste.length;
        journal.push({ provider: nom, lot: numeroLot, ok: true, demandes: lot.length, obtenus, restants: reste.length });

        if (obtenus === 0) break;

        const idsTestes = new Set(lot.map(idDe));
        const nonTestes = reste.filter(valeur => !idsTestes.has(idDe(valeur)));
        if (!nonTestes.length) break;
        const dejaTestes = reste.filter(valeur => idsTestes.has(idDe(valeur)));
        reste = [...nonTestes, ...dejaTestes];

      } catch (error) {
        journal.push({ provider: nom, lot: numeroLot, ok: false, demandes: lot.length, reason: error.status ? `HTTP ${error.status}` : error.message });
        break;
      }
    }
  }

  const ids = demandes.map(idDe);
  const quotes = ids.filter(id => trouve.has(id)).map(id => trouve.get(id));
  const missing = ids.filter(id => !trouve.has(id));
  const sources = [...new Set(quotes.map(quote => quote.source).filter(Boolean))];

  return res.status(200).json({
    quotes,
    connected: quotes.length > 0,
    source: sources.length === 1 ? sources[0] : null,
    sources,
    partial: missing.length > 0,
    missing,
    journal,
  });
};

module.exports.parseSymboles = parseSymboles;
module.exports.normaliserSymbole = normaliserSymbole;
