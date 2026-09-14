/**
 * GET /api/market/history?ticker=X&exchange=Y&type=Z[&fresh=1]
 *
 * Historique OHLCV seul (sans cotation ni fondamentaux), destiné au
 * chargement à la demande côté frontend (bouton "Voir le graphique").
 *
 * Réutilise EXACTEMENT la même validation, la même cascade et le même
 * cache que /api/market/company (via _marketBlock.js) : aucune nouvelle
 * règle, aucune donnée fabriquée. Un historique vide est indisponible,
 * jamais une série synthétique.
 *
 * `type` (optionnel, 'stock' par défaut) détermine l'ordre de cascade :
 * confirmé par lecture de _providers.js, eodhdSymbol() n'a AUCUNE
 * convention de suffixe pour forex/crypto (uniquement des codes de place
 * boursière : PA, DE, NASDAQ...) et retombe sur ".US" par défaut quand
 * `exchange` est vide — un symbole EODHD invalide pour une paire de
 * devises ou une crypto (ex. "EUR/USD.US"). La cascade s'en remet
 * normalement à Twelve Data ensuite (EODHD échoue proprement), mais
 * envoyer cet appel voué à l'échec n'a pas de sens : pour forex/crypto,
 * EODHD est explicitement retiré de l'ordre plutôt que laissé échouer
 * "par accident". Twelve Data accepte nativement "EUR/USD"/"BTC/USD"
 * comme symbole direct (confirmé par sa documentation officielle).
 */

const { HISTORY, KEYS } = require('./_providers.js');
const { chargerBloc, historiqueValide } = require('./_marketBlock.js');
const { normaliserTicker, normaliserExchange } = require('./company.js');

/* Identique à company.js : ~260 séances = un peu plus d'un an de
   cotations quotidiennes. */
const MAX_HISTORY_POINTS = 260;

const TYPES_SANS_SUFFIXE_EODHD = new Set(['forex', 'crypto']);

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

  const ordre = TYPES_SANS_SUFFIXE_EODHD.has(type)
    ? ['twelvedata']
    : ['eodhd', 'twelvedata'];

  const keys = KEYS();
  if (!ordre.some(p => keys[p])) {
    return res.status(503).json({ error: 'aucun_fournisseur_configure' });
  }

  const journal = [];
  const h = await chargerBloc({
    nom: 'history',
    table: HISTORY,
    ordre,
    args: [ticker, exchange, 400],
    ticker, exchange, frais, journal,
  });

  const aHistory = historiqueValide(h.data);

  let history = null;
  if (aHistory) {
    const ohlcv = h.data.slice(-MAX_HISTORY_POINTS);
    history = { points: ohlcv.length, availablePoints: h.data.length, ohlcv };
  }

  return res.status(200).json({
    ticker,
    exchange,
    history,
    source: aHistory ? h.source : null,
    /* Dérivé de la donnée réellement reçue (date du dernier point), jamais
       une estampille fabriquée : null si aucun historique exploitable. */
    asOf: aHistory ? (history.ohlcv[history.ohlcv.length - 1]?.date ?? null) : null,
    journal,
  });
};
