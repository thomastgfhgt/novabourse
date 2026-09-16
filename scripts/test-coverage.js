#!/usr/bin/env node
/**
 * scripts/test-coverage.js — TEST DE COUVERTURE MULTI-ACTIFS
 *
 * Interroge directement la couche fournisseurs (api/market/_providers.js) —
 * pas de serveur Vercel requis — pour un panier d'instruments représentatif
 * de toutes les classes d'actifs que NovaBourse prétend couvrir : actions
 * (US/Europe/Asie/Inde/Brésil/Australie), crypto, forex, indices, matières
 * premières, obligations, futures.
 *
 * Usage :
 *   node scripts/test-coverage.js                 (utilise les clés déjà
 *                                                    dans l'environnement)
 *   EODHD_API_KEY=... TWELVEDATA_API_KEY=... FINNHUB_API_KEY=... \
 *     node scripts/test-coverage.js
 *
 * Aucune clé n'est jamais affichée. CoinGecko ne nécessite aucune clé — les
 * lignes crypto restent donc testables même sans aucun abonnement payant.
 *
 * Pour chaque instrument, rapporte : identity (résolution ticker/exchange),
 * quote, history (30j), fundamentals (stock/etf uniquement), provider
 * utilisé, erreur éventuelle — jamais un succès fabriqué.
 */

const {
  QUOTE, HISTORY, FUNDAMENTALS, NEWS, KEYS,
} = require('../api/market/_providers.js');

const INSTRUMENTS = [
  // ---- Actions US ----
  { name: 'Apple', ticker: 'AAPL', exchange: 'NASDAQ', type: 'stock' },
  { name: 'Microsoft', ticker: 'MSFT', exchange: 'NASDAQ', type: 'stock' },
  { name: 'Nvidia', ticker: 'NVDA', exchange: 'NASDAQ', type: 'stock' },
  // ---- Actions Europe ----
  { name: 'Hermès', ticker: 'RMS', exchange: 'PA', type: 'stock' },
  { name: 'LVMH', ticker: 'MC', exchange: 'PA', type: 'stock' },
  { name: "L'Oréal", ticker: 'OR', exchange: 'PA', type: 'stock' },
  { name: 'SAP', ticker: 'SAP', exchange: 'DE', type: 'stock' },
  { name: 'Siemens', ticker: 'SIE', exchange: 'DE', type: 'stock' },
  // ---- Actions Asie / Inde / Brésil / Australie (places NON dans SUFFIX/TD_EXCHANGE -
  //      couverture attendue = NON VÉRIFIÉE, voir rapport) ----
  { name: 'Toyota', ticker: '7203', exchange: 'TSE', type: 'stock' },
  { name: 'Tencent', ticker: '0700', exchange: 'HK', type: 'stock' },
  { name: 'Alibaba (ADR US)', ticker: 'BABA', exchange: 'NYSE', type: 'stock' },
  { name: 'TCS', ticker: 'TCS', exchange: 'NSE', type: 'stock' },
  { name: 'Petrobras', ticker: 'PETR4', exchange: 'SA', type: 'stock' },
  { name: 'BHP', ticker: 'BHP', exchange: 'AX', type: 'stock' },
  // ---- Crypto ----
  { name: 'Bitcoin', ticker: 'BTC/USD', exchange: '', type: 'crypto' },
  { name: 'Ethereum', ticker: 'ETH/USD', exchange: '', type: 'crypto' },
  { name: 'Solana', ticker: 'SOL/USD', exchange: '', type: 'crypto' },
  { name: 'XRP', ticker: 'XRP/USD', exchange: '', type: 'crypto' },
  { name: 'Cardano', ticker: 'ADA/USD', exchange: '', type: 'crypto' },
  { name: 'Dogecoin', ticker: 'DOGE/USD', exchange: '', type: 'crypto' },
  { name: 'Avalanche', ticker: 'AVAX/USD', exchange: '', type: 'crypto' },
  { name: 'Polkadot', ticker: 'DOT/USD', exchange: '', type: 'crypto' },
  { name: 'Chainlink', ticker: 'LINK/USD', exchange: '', type: 'crypto' },
  { name: 'Litecoin', ticker: 'LTC/USD', exchange: '', type: 'crypto' },
  { name: 'Bitcoin Cash', ticker: 'BCH/USD', exchange: '', type: 'crypto' },
  { name: 'Cosmos', ticker: 'ATOM/USD', exchange: '', type: 'crypto' },
  { name: 'Algorand', ticker: 'ALGO/USD', exchange: '', type: 'crypto' },
  // ---- Forex ----
  { name: 'EUR/USD', ticker: 'EUR/USD', exchange: '', type: 'forex' },
  { name: 'GBP/USD', ticker: 'GBP/USD', exchange: '', type: 'forex' },
  { name: 'USD/JPY', ticker: 'USD/JPY', exchange: '', type: 'forex' },
  // ---- Indices ----
  { name: 'S&P 500', ticker: 'GSPC', exchange: 'INDX', type: 'index' },
  { name: 'CAC 40', ticker: 'PX1', exchange: 'INDX', type: 'index' },
  // ---- Matières premières ----
  { name: 'Or (spot)', ticker: 'XAU/USD', exchange: '', type: 'commodity' },
  { name: 'Pétrole WTI', ticker: 'WTI/USD', exchange: '', type: 'commodity' },
];

function statut(label, ok, detail) {
  const marque = ok ? 'OK ' : 'X  ';
  console.log(`  ${marque}${label.padEnd(14)} ${detail}`);
}

async function testerQuote(instr, keys) {
  const ordre = instr.type === 'crypto'
    ? ['coingecko', 'twelvedata', 'eodhd']
    : ['twelvedata', 'eodhd', 'finnhub'];
  for (const provider of ordre) {
    if (!keys[provider]) continue;
    try {
      const q = await QUOTE[provider](instr.ticker, instr.exchange, instr.type, keys[provider]);
      return { ok: true, provider, price: q.price };
    } catch (e) { /* essaie le suivant */ }
  }
  return { ok: false, provider: null };
}

async function testerHistory(instr, keys) {
  const ordre = instr.type === 'crypto'
    ? ['coingecko', 'eodhd', 'twelvedata']
    : (instr.type === 'index' || instr.type === 'commodity') ? ['twelvedata']
    : ['eodhd', 'twelvedata'];
  for (const provider of ordre) {
    if (!keys[provider]) continue;
    try {
      const h = await HISTORY[provider](instr.ticker, instr.exchange, 30, instr.type, keys[provider]);
      return { ok: true, provider, points: h.length };
    } catch (e) { /* essaie le suivant */ }
  }
  return { ok: false, provider: null };
}

async function testerFundamentals(instr, keys) {
  if (instr.type !== 'stock' && instr.type !== 'etf') return { ok: null, provider: null };
  for (const provider of ['eodhd', 'finnhub']) {
    if (!keys[provider]) continue;
    try {
      const f = await FUNDAMENTALS[provider](instr.ticker, instr.exchange, keys[provider]);
      if (f && f.fundamentals) return { ok: true, provider };
    } catch (e) { /* essaie le suivant */ }
  }
  return { ok: false, provider: null };
}

async function main() {
  const keys = KEYS();
  console.log('Clés détectées (jamais affichées) :',
    Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, Boolean(v)])));
  console.log('');

  const resultats = [];
  for (const instr of INSTRUMENTS) {
    /* CoinGecko (gratuit, sans clé) est soumis à une limite de débit
       partagée sur son point d'accès public — un petit délai entre chaque
       instrument crypto évite de fausser ce rapport par des 429 dus au
       script de test lui-même (jamais un souci en production : le cache
       serveur de 60s/12h et le verrou anti-rafale évitent cette rafale). */
    if (instr.type === 'crypto' && keys.coingecko) await new Promise(r => setTimeout(r, 1500));
    console.log(`${instr.name} (${instr.ticker}${instr.exchange ? '@' + instr.exchange : ''}, ${instr.type})`);
    const q = await testerQuote(instr, keys);
    statut('quote', q.ok, q.ok ? `${q.provider} (${q.price})` : 'échec — aucun fournisseur');
    const h = await testerHistory(instr, keys);
    statut('history', h.ok, h.ok ? `${h.provider} (${h.points} points/30j)` : 'échec — aucun fournisseur');
    const f = await testerFundamentals(instr, keys);
    if (f.ok !== null) statut('fundamentals', f.ok, f.ok ? f.provider : 'échec — aucun fournisseur');
    console.log('');
    resultats.push({ instr, q, h, f });
  }

  const total = resultats.length;
  const quoteOk = resultats.filter(r => r.q.ok).length;
  const histOk = resultats.filter(r => r.h.ok).length;
  console.log('='.repeat(60));
  console.log(`Résumé : quote ${quoteOk}/${total} · history ${histOk}/${total}`);
  console.log('Un échec ici signifie : pas de clé disponible localement, OU');
  console.log('instrument/place hors couverture vérifiée des fournisseurs actuels.');
}

main().catch(e => { console.error(e); process.exitCode = 1; });
