/**
 * GET /api/market/quotes?symbols=AAPL@NASDAQ,AIR@PA
 *
 * Cotations en lot. Le navigateur envoie « TICKER@PLACE » et rien d'autre :
 * la conversion vers le format de chaque fournisseur vit dans _providers.js,
 * source unique. Un changement de mapping côté serveur n'a donc aucun effet
 * sur le frontend.
 *
 * Cascade par reliquat : Twelve Data (batch natif) → EODHD (batch natif) →
 * Finnhub (plafonné). Chaque fournisseur ne reçoit que ce que le précédent
 * n'a pas couvert. Un symbole que personne ne sert reste dans « missing » et
 * s'affiche « — ». Aucun prix n'est jamais estimé.
 */
const { BATCH, KEYS, idDe } = require('./_providers.js');
const { lire, ecrire } = require('./_cache.js');

const ORDRE = ['twelvedata', 'eodhd', 'finnhub'];

function parseSymboles(raw){
  return [...new Set(String(raw || '').split(',').map(s => s.trim()).filter(Boolean))]
    .slice(0, 120)
    .map(s => {
      const [ticker, exchange] = s.split('@');
      return ticker
        ? { ticker: ticker.toUpperCase(), exchange: (exchange || '').toUpperCase() }
        : null;
    })
    .filter(Boolean);
}

module.exports = async (req, res) => {
  const demandes = parseSymboles(req.query.symbols);
  if (!demandes.length) return res.status(400).json({ error: 'symbols_manquant' });

  const keys = KEYS();
  if (!keys.twelvedata && !keys.eodhd && !keys.finnhub){
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      quotes: [], connected: false, source: null, sources: [],
      partial: true, missing: demandes.map(idDe),
      reason: 'aucun_fournisseur_configure', journal: [],
    });
  }

  const journal = [];
  const trouve = new Map();          // id « TICKER@PLACE » → cotation

  // 1. Ce que le cache partagé possède déjà (alimenté aussi par company.js).
  const aChercher = [];
  if (req.query.fresh === '1'){
    aChercher.push(...demandes);
  } else {
    for (const v of demandes){
      const hit = lire('quote', v.ticker, v.exchange);
      if (hit) trouve.set(idDe(v), { ...hit.valeur, source: hit.source, cached: true });
      else aChercher.push(v);
    }
  }

  /* 2. Cascade par reliquat.
     On ne s'arrête que lorsqu'il n'y a plus rien à chercher : un fournisseur
     qui ne couvre qu'une partie du lot ne prive pas les suivants du reste. */
  let reste = [...aChercher];
  for (const nom of ORDRE){
    if (!reste.length) break;
    if (!keys[nom]){
      journal.push({ provider: nom, ok: false, reason: 'cle_absente' });
      continue;
    }

    const lot = reste.slice(0, BATCH.limite[nom]);
    try {
      const map = await BATCH[nom](lot, keys[nom]);
      for (const [id, q] of map){
        trouve.set(id, { ...q, source: nom });
        ecrire('quote', [q.ticker, q.exchange], q, nom);
      }
      // Seuls les symboles réellement obtenus sortent de la liste.
      reste = reste.filter(v => !map.has(idDe(v)));
      journal.push({ provider: nom, ok: true, demandes: lot.length,
        obtenus: map.size, restants: reste.length });
    } catch (e){
      journal.push({ provider: nom, ok: false, demandes: lot.length,
        reason: e.status ? `HTTP ${e.status}` : e.message });
    }
  }

  const quotes  = demandes.map(idDe).filter(id => trouve.has(id)).map(id => trouve.get(id));
  const missing = demandes.map(idDe).filter(id => !trouve.has(id));

  /* 3. Provenance. Plusieurs fournisseurs peuvent avoir contribué au même lot :
     un champ unique serait trompeur. On expose donc « source » seulement
     lorsqu'elle est sans ambiguïté, et « sources » dans tous les cas. Chaque
     cotation porte en plus son propre champ source. */
  const sources = [...new Set(quotes.map(q => q.source).filter(Boolean))];

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    quotes,
    // Vrai seulement si au moins une cotation réelle a été obtenue. Des clés
    // configurées mais des fournisseurs tous en échec donnent false.
    connected: quotes.length > 0,
    source: sources.length === 1 ? sources[0] : null,
    sources,
    partial: missing.length > 0,
    missing,                        // ces symboles resteront « — » à l'écran
    journal,
  });
};
