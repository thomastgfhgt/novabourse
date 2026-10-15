/**
 * api/_alpaca/portfolio.js — Résumé lecture seule du portefeuille Sandbox
 * (§7 de la mission : "Nova AI reçoit... un résumé en lecture seule du
 * portefeuille Sandbox préparé par le serveur").
 *
 * Préfixe "_" : jamais exposé comme route Vercel.
 *
 * Volontairement limité aux champs qu'Alpaca fournit DIRECTEMENT par
 * position (symbole, quantité, valeur de marché, plus/moins-value) —
 * PAS de secteur/pays/exposition sectorielle pour l'instant : cela
 * demanderait de croiser avec le catalogue marché NovaTitre (sector/
 * country), une intégration séparée non encore faite. Jamais une
 * étiquette de secteur devinée ou approximée ici.
 */

'use strict';

const { appelBroker } = require('./client.js');
const { lireCompteTrading } = require('./accounts.js');

async function lirePositions(alpacaAccountId) {
  const r = await appelBroker(`/v1/trading/accounts/${encodeURIComponent(alpacaAccountId)}/positions`);
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_lecture_positions_echouee');
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

/* Résumé réel — aucune donnée fictive, aucune moyenne/estimation
   inventée. `concentrationTop` trie par poids réel (market_value /
   valeur totale des positions), jamais par ordre arbitraire. */
async function resumePortefeuille(alpacaAccountId) {
  const [compte, positionsBrutes] = await Promise.all([
    lireCompteTrading(alpacaAccountId),
    lirePositions(alpacaAccountId),
  ]);

  const positions = (positionsBrutes || []).map(p => ({
    symbol: p.symbol,
    qty: Number(p.qty),
    side: p.side,
    marketValue: Number(p.market_value),
    unrealizedPl: Number(p.unrealized_pl),
    unrealizedPlPc: Number(p.unrealized_plpc),
    avgEntryPrice: Number(p.avg_entry_price),
    currentPrice: Number(p.current_price),
  }));

  const totalMarketValue = positions.reduce((s, p) => s + Math.abs(p.marketValue), 0);
  const concentrationTop = [...positions]
    .sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue))
    .slice(0, 5)
    .map(p => ({
      symbol: p.symbol,
      weightPct: totalMarketValue > 0 ? Math.round((Math.abs(p.marketValue) / totalMarketValue) * 1000) / 10 : 0,
    }));

  return {
    currency: compte.currency,
    equity: Number(compte.equity),
    cash: Number(compte.cash),
    buyingPower: Number(compte.buying_power),
    portfolioValue: Number(compte.portfolio_value),
    positionCount: positions.length,
    positions,
    concentrationTop,
  };
}

module.exports = {
  lirePositions,
  resumePortefeuille,
};
