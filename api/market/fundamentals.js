/**
 * GET /api/market/fundamentals?ticker=X&exchange=Y[&fresh=1]
 *
 * Fondamentaux seuls (sans cotation ni historique), destinés au
 * chargement à la demande côté frontend (bouton "Voir les chiffres").
 *
 * Réutilise EXACTEMENT la même validation, la même cascade (EODHD ->
 * Finnhub) et le même cache que /api/market/company (via
 * _marketBlock.js). SimFin/Eulerpool ne sont PAS intégrés dans cette
 * passe — cascade inchangée, comme demandé.
 * Aucune donnée manquante n'est comblée : un champ absent reste null.
 */

const { FUNDAMENTALS, KEYS } = require('./_providers.js');
const { chargerBloc } = require('./_marketBlock.js');
const { normaliserTicker, normaliserExchange } = require('./company.js');

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

  const keys = KEYS();
  if (!keys.eodhd && !keys.finnhub) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const journal = [];
  const f = await chargerBloc({
    nom: 'fundamentals',
    table: FUNDAMENTALS,
    ordre: ['eodhd', 'finnhub'],
    args: [ticker, exchange],
    ticker, exchange, frais, journal,
  });

  const aFundamentals = fondamentauxValides(f.data);

  return res.status(200).json({
    ticker,
    exchange,
    fundamentals: aFundamentals ? f.data.fundamentals : null,
    source: aFundamentals ? f.source : null,
    asOf: aFundamentals ? (f.data?.asOf ?? null) : null,
    journal,
  });
};


