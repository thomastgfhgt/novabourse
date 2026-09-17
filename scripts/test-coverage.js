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
  QUOTE, HISTORY, FUNDAMENTALS, NEWS, SEARCH, KEYS,
} = require('../api/market/_providers.js');
const { normaliserResultat, pertinence } = require('../api/market/search.js');
const { calculerPeriodStats, PERIOD_SPECS } = require('../api/market/history.js');

const INSTRUMENTS = [
  // ---- Actions US (référence, section 32 du cahier des charges) ----
  { name: 'Apple', ticker: 'AAPL', exchange: 'NASDAQ', type: 'stock' },
  { name: 'Microsoft', ticker: 'MSFT', exchange: 'NASDAQ', type: 'stock' },
  { name: 'Nvidia', ticker: 'NVDA', exchange: 'NASDAQ', type: 'stock' },
  { name: 'Alphabet', ticker: 'GOOGL', exchange: 'NASDAQ', type: 'stock' },
  { name: 'Amazon', ticker: 'AMZN', exchange: 'NASDAQ', type: 'stock' },
  { name: 'Meta', ticker: 'META', exchange: 'NASDAQ', type: 'stock' },
  { name: 'JPMorgan Chase', ticker: 'JPM', exchange: 'NYSE', type: 'stock' },
  { name: 'Berkshire Hathaway B', ticker: 'BRK-B', exchange: 'NYSE', type: 'stock' },
  { name: 'TSMC (ADR US)', ticker: 'TSM', exchange: 'NYSE', type: 'stock' },
  // ---- Actions Europe (places déjà vérifiées, voir SUFFIX dans _providers.js) ----
  { name: 'Hermès', ticker: 'RMS', exchange: 'PA', type: 'stock' },
  { name: 'LVMH', ticker: 'MC', exchange: 'PA', type: 'stock' },
  { name: "L'Oréal", ticker: 'OR', exchange: 'PA', type: 'stock' },
  { name: 'Airbus', ticker: 'AIR', exchange: 'PA', type: 'stock' },
  { name: 'SAP', ticker: 'SAP', exchange: 'DE', type: 'stock' },
  { name: 'Siemens', ticker: 'SIE', exchange: 'DE', type: 'stock' },
  { name: 'Nestlé', ticker: 'NESN', exchange: 'SW', type: 'stock' },
  { name: 'Roche', ticker: 'ROG', exchange: 'SW', type: 'stock' },
  { name: 'Novartis', ticker: 'NOVN', exchange: 'SW', type: 'stock' },
  { name: 'ASML', ticker: 'ASML', exchange: 'AS', type: 'stock' },
  { name: 'Shell (LSE, prix BRUT non ajusté pence)', ticker: 'SHEL', exchange: 'L', type: 'stock' },
  { name: 'HSBC (LSE, prix BRUT non ajusté pence)', ticker: 'HSBA', exchange: 'L', type: 'stock' },
  // ---- Canada (place vérifiée) ----
  { name: 'Royal Bank of Canada', ticker: 'RY', exchange: 'TO', type: 'stock' },
  // ---- Australie (place vérifiée) ----
  { name: 'BHP Group', ticker: 'BHP', exchange: 'AU', type: 'stock' },
  // ---- Actions Asie / Inde / Brésil / Afrique du Sud (places NON dans SUFFIX/TD_EXCHANGE -
  //      couverture attendue = NON VÉRIFIÉE, voir _exchangeCrosswalk.js et le rapport) ----
  { name: 'Toyota', ticker: '7203', exchange: 'TSE', type: 'stock' },
  { name: 'Sony', ticker: '6758', exchange: 'TSE', type: 'stock' },
  { name: 'Nintendo', ticker: '7974', exchange: 'TSE', type: 'stock' },
  { name: 'Tencent', ticker: '0700', exchange: 'HK', type: 'stock' },
  { name: 'Alibaba (ADR US, place vérifiée)', ticker: 'BABA', exchange: 'NYSE', type: 'stock' },
  { name: 'Samsung Electronics', ticker: '005930', exchange: 'KRX', type: 'stock' },
  { name: 'TCS', ticker: 'TCS', exchange: 'NSE', type: 'stock' },
  { name: 'Petrobras', ticker: 'PETR4', exchange: 'SA', type: 'stock' },
  { name: 'Naspers (JSE)', ticker: 'NPN', exchange: 'JSE', type: 'stock' },
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
    : instr.type === 'forex'
    ? ['twelvedata', 'eodhd', 'frankfurter']
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
    : instr.type === 'forex'
    ? ['eodhd', 'twelvedata', 'frankfurter']
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

/* SEARCH (section 32) : verifie que le MEILLEUR resultat classe est un
   vrai match textuel (ticker ou nom) sur la requete envoyee, jamais une
   societe sans rapport ("Hera S.p.A." pour une recherche "Hermes", voir
   le commentaire pertinence() dans search.js) ni le mauvais type
   d'instrument. N'affirme rien sur la fusion providers x providers ici
   (deja couverte par search.js lui-meme) : seulement identite/pertinence
   sur CE fournisseur, pris isolement. */
async function testerSearch(instr, keys) {
  const requete = instr.name;
  for (const provider of ['eodhd', 'twelvedata', 'finnhub']) {
    if (!keys[provider]) continue;
    const fonction = SEARCH[provider];
    if (typeof fonction !== 'function') continue;
    try {
      const bruts = await fonction(requete, keys[provider]);
      const resultats = (Array.isArray(bruts) ? bruts : [])
        .map(r => normaliserResultat(r, provider))
        .filter(Boolean)
        .map(r => ({ ...r, _pertinence: pertinence(r, requete) }))
        .sort((a, b) => b._pertinence - a._pertinence);
      if (!resultats.length) continue;
      const meilleur = resultats[0];
      const match = meilleur._pertinence > 0
        && (meilleur.ticker.toUpperCase() === instr.ticker.toUpperCase() || meilleur._pertinence >= 20);
      return { ok: match, provider, trouve: `${meilleur.name} (${meilleur.ticker}${meilleur.exchange ? '@' + meilleur.exchange : ''})` };
    } catch (e) { /* essaie le suivant */ }
  }
  return { ok: false, provider: null };
}

/* PÉRIODES (sections 30-31) : pour chaque période, appelle le MÊME
   fournisseur HISTORY que testerHistory ci-dessus avec le nombre de jours
   réel de PERIOD_SPECS (history.js), puis valide via calculerPeriodStats
   (déjà testé isolément, voir scripts/test-period-stats.js) + des
   contrôles supplémentaires propres à une série réelle : ordre
   chronologique, aucun point dans le futur, high >= low, aucun NaN. Un
   échec de valeur est distingué d'un échec réseau (`raison`). */
const PERIODES_A_TESTER = ['1s', '1m', '3m', '6m', '1a', '5a', 'max'];

function validerSerieReelle(ohlcv) {
  for (let i = 0; i < ohlcv.length; i++) {
    const p = ohlcv[i];
    if (!Number.isFinite(p.close) || p.close <= 0) return 'close_invalide';
    if (Number.isFinite(p.high) && Number.isFinite(p.low) && p.high < p.low) return 'high_inferieur_low';
    if (new Date(p.date).getTime() > Date.now() + 86400000) return 'point_dans_le_futur';
    if (i > 0 && new Date(p.date).getTime() < new Date(ohlcv[i - 1].date).getTime()) return 'ordre_chronologique_rompu';
  }
  return null;
}

async function testerPeriodes(instr, keys) {
  const ordre = instr.type === 'crypto'
    ? ['coingecko', 'eodhd', 'twelvedata']
    : instr.type === 'forex'
    ? ['eodhd', 'twelvedata', 'frankfurter']
    : (instr.type === 'index' || instr.type === 'commodity') ? ['twelvedata']
    : ['eodhd', 'twelvedata'];

  const parPeriode = {};
  for (const periode of PERIODES_A_TESTER) {
    const jours = PERIOD_SPECS[periode]?.jours ?? 400;
    let resultat = { ok: false, raison: 'aucun_fournisseur' };
    for (const provider of ordre) {
      if (!keys[provider]) continue;
      try {
        const h = await HISTORY[provider](instr.ticker, instr.exchange, jours, instr.type, keys[provider]);
        if (!Array.isArray(h) || h.length < 2) { resultat = { ok: false, raison: 'moins_de_2_points' }; continue; }
        const raisonInvalide = validerSerieReelle(h);
        if (raisonInvalide) { resultat = { ok: false, raison: raisonInvalide }; continue; }
        const stats = calculerPeriodStats(h, periode, null);
        resultat = stats
          ? { ok: true, provider, points: stats.pointCount, percentChange: stats.percentChange }
          : { ok: false, raison: 'periodStats_null' };
        break;
      } catch (e) {
        resultat = { ok: false, raison: e.message || 'erreur_fournisseur' };
      }
    }
    parPeriode[periode] = resultat;
  }
  return parPeriode;
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

/* --search et --periodes sont OPT-IN (jamais par défaut) : les activer
   multiplie le nombre d'appels fournisseurs (jusqu'à +7 appels/instrument
   pour les périodes) — cohérent avec la section 19 ("minimiser les appels
   fournisseurs") même pour un script de diagnostic. Le mode par défaut
   reste identique à avant cette passe : quote + history(30j) + fundamentals. */
const AVEC_SEARCH = process.argv.includes('--search');
const AVEC_PERIODES = process.argv.includes('--periodes');

async function main() {
  const keys = KEYS();
  console.log('Clés détectées (jamais affichées) :',
    Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, Boolean(v)])));
  if (!AVEC_SEARCH && !AVEC_PERIODES) {
    console.log("(lancer avec --search et/ou --periodes pour tester aussi la résolution d'identité et les 7 périodes du graphique)");
  }
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

    let s = null;
    if (AVEC_SEARCH && instr.type === 'stock') {
      s = await testerSearch(instr, keys);
      statut('search', s.ok, s.ok ? `${s.provider} -> ${s.trouve}` : 'échec — pas de match pertinent');
    }

    let p = null;
    if (AVEC_PERIODES) {
      p = await testerPeriodes(instr, keys);
      for (const periode of PERIODES_A_TESTER) {
        const r = p[periode];
        statut(periode, r.ok, r.ok ? `${r.provider} (${r.points} pts, ${r.percentChange >= 0 ? '+' : ''}${r.percentChange?.toFixed(2)}%)` : r.raison);
      }
    }

    console.log('');
    resultats.push({ instr, q, h, f, s, p });
  }

  const total = resultats.length;
  const quoteOk = resultats.filter(r => r.q.ok).length;
  const histOk = resultats.filter(r => r.h.ok).length;
  console.log('='.repeat(60));
  console.log(`Résumé : quote ${quoteOk}/${total} · history ${histOk}/${total}`);
  if (AVEC_SEARCH) {
    const searchOk = resultats.filter(r => r.s && r.s.ok).length;
    const searchTeste = resultats.filter(r => r.s).length;
    console.log(`search : ${searchOk}/${searchTeste}`);
  }
  if (AVEC_PERIODES) {
    for (const periode of PERIODES_A_TESTER) {
      const ok = resultats.filter(r => r.p && r.p[periode]?.ok).length;
      console.log(`période ${periode} : ${ok}/${total}`);
    }
  }
  console.log('Un échec ici signifie : pas de clé disponible localement, OU');
  console.log('instrument/place hors couverture vérifiée des fournisseurs actuels.');
}

main().catch(e => { console.error(e); process.exitCode = 1; });
