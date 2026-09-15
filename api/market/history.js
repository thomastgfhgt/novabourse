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
 * `type` (optionnel, 'stock' par défaut) détermine l'ordre de cascade.
 *
 * CORRECTIF (audit routage multi-actifs — bug de production confirmé) :
 * crypto/forex utilisent désormais EODHD avec le VRAI symbole de ce
 * fournisseur pour ces types (voir eodhdSymbolPourType() dans
 * _providers.js : "BTC-USD.CC", "EURUSD.FOREX" — vérifiés empiriquement en
 * direct, pas depuis la seule documentation). Avant ce correctif,
 * crypto/forex étaient réduits à Twelve Data SEUL, sans aucun repli : un
 * simple HTTP 429 (quota) chez Twelve Data — confirmé en production le
 * jour de cet audit — rendait alors TOUTE la classe d'actif indisponible
 * d'un coup. C'est la cause racine du bug "ALGO/USD cours indisponible" /
 * "ATOM/USD historique indisponible" : ni l'un ni l'autre n'a de rapport
 * avec le ticker lui-même (vérifié : les deux existent bien chez Twelve
 * Data), c'est l'absence de repli fonctionnel qui posait problème.
 *
 * 'index'/'commodity' restent sur Twelve Data seul : aucune convention
 * EODHD n'a pu être vérifiée pour ces deux types (voir rapport précédent),
 * donc EODHD reste explicitement retiré de leur cascade plutôt que
 * d'envoyer un symbole non vérifié.
 */

const { HISTORY, KEYS } = require('./_providers.js');
const { chargerBloc, historiqueValide } = require('./_marketBlock.js');
const { normaliserTicker, normaliserExchange } = require('./company.js');

/* Identique à company.js : ~260 séances = un peu plus d'un an de
   cotations quotidiennes. */
const MAX_HISTORY_POINTS = 260;

const TYPES_SANS_SUFFIXE_EODHD = new Set(['index', 'commodity']);

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
    args: [ticker, exchange, 400, type],
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
    /* Additif (voir api/market/_freshness.js) : un OHLCV quotidien n'est
       jamais du temps réel, quel que soit le fournisseur. */
    freshness: aHistory ? h.freshness : null,
    provenance: aHistory ? { source: h.source, sourceUrl: h.sourceUrl, retrievedAt: h.retrievedAt } : null,
    journal,
  });
};
