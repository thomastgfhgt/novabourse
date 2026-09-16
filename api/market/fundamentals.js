/**
 * GET /api/market/fundamentals?ticker=X&exchange=Y&type=Z[&fresh=1]
 *
 * Fondamentaux seuls (sans cotation ni historique), destinés au
 * chargement à la demande côté frontend (bouton "Voir les chiffres").
 *
 * Réutilise EXACTEMENT la même validation, la même cascade (EODHD ->
 * Finnhub) et le même cache que /api/market/company (via
 * _marketBlock.js). SimFin/Eulerpool ne sont PAS intégrés dans cette
 * passe — cascade inchangée, comme demandé.
 * Aucune donnée manquante n'est comblée : un champ absent reste null.
 *
 * `type` (optionnel, 'stock' par défaut) : pour forex/crypto/index/
 * commodity, aucun fournisseur actuellement branché ne peut légitimement
 * renvoyer des "fondamentaux d'entreprise" (ROE, PER, marge...) — une
 * paire de devises, une crypto, un indice ou une matière première n'a pas
 * de bilan. Plutôt que d'interroger EODHD/Finnhub pour obtenir
 * invariablement une réponse vide, la route répond directement
 * `fundamentals:null` sans consommer d'appel fournisseur.
 * Le frontend ne propose déjà pas cette section pour ces types ; ceci
 * protège la route elle-même si elle est appelée directement.
 */

const { FUNDAMENTALS, KEYS } = require('./_providers.js');
const { chargerBloc } = require('./_marketBlock.js');
const { normaliserTicker, normaliserExchange } = require('./company.js');
const { resolveOrdre, noterResultat } = require('./_router.js');

const TYPES_SANS_FONDAMENTAUX = new Set(['forex', 'crypto', 'index', 'commodity']);

function fondamentauxValides(data) {
  return Boolean(data && typeof data === 'object' && data.fundamentals && typeof data.fundamentals === 'object');
}

module.exports = async (req, res) => {
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

  if (TYPES_SANS_FONDAMENTAUX.has(type)) {
    return res.status(200).json({
      ticker, exchange, fundamentals: null, source: null, asOf: null,
      journal: [{ bloc: 'fundamentals', ok: false, reason: `type_sans_fondamentaux:${type}` }],
    });
  }

  const keys = KEYS();
  if (!keys.eodhd && !keys.finnhub) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const journal = [];
  const f = await chargerBloc({
    nom: 'fundamentals',
    table: FUNDAMENTALS,
    ordre: resolveOrdre('fundamentals', ticker, exchange, type),
    args: [ticker, exchange],
    ticker, exchange, frais, journal,
  });
  noterResultat('fundamentals', ticker, exchange, type, f.source);

  const aFundamentals = fondamentauxValides(f.data);

  return res.status(200).json({
    ticker,
    exchange,
    fundamentals: aFundamentals ? f.data.fundamentals : null,
    source: aFundamentals ? f.source : null,
    asOf: aFundamentals ? (f.data?.asOf ?? null) : null,
    /* Additif (voir api/market/_freshness.js) : un bilan/résultat publié
       est une donnée périodique déjà close, jamais en direct. */
    freshness: aFundamentals ? f.freshness : null,
    provenance: aFundamentals ? { source: f.source, sourceUrl: f.sourceUrl, retrievedAt: f.retrievedAt } : null,
    journal,
  });
};
