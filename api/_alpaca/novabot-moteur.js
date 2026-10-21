/**
 * api/_alpaca/novabot-moteur.js — décisions de NovaBot sur un VRAI compte
 * Alpaca (2026-10-21).
 *
 * Demande utilisateur : "qu'il fasse vraiment des achats réfléchis, qu'il
 * achète, qu'il revende, et qu'il demande à l'utilisateur s'il veut tout
 * vendre au cas où tout s'écroulerait". Choix utilisateur : attendre
 * l'accès réel Alpaca (rien de fictif).
 *
 * Ce module ne passe AUCUN ordre : il produit des PROPOSITIONS motivées
 * (achat, vente, tout vendre) à partir des données réelles du compte et
 * du marché. Chaque ordre n'est envoyé qu'après confirmation explicite de
 * l'utilisateur (route novabot-executer / novabot-tout-vendre, api/me.js),
 * qui recalcule les propositions juste avant d'exécuter : jamais un ordre
 * "de mémoire". Une gestion automatique sans confirmation relèverait de la
 * gestion de portefeuille pour compte de tiers (agrément AMF).
 *
 * Fonctions PURES (aucun réseau), testées par scripts/test-novabot-moteur.js.
 * Préfixe "_" : jamais exposé comme route Vercel.
 */

'use strict';

/* Paramètres par niveau de risque déclaré par l'utilisateur. */
const REGLES_PAR_RISQUE = Object.freeze({
  low:      Object.freeze({ scoreAchat: 75, stopLossPct: 8,  takeProfitPct: 15, maxPositionPct: 10, cashMinPct: 30, krachPortefeuillePct: 5,  maxAchats: 2, volatiliteMax: 0.30 }),
  moderate: Object.freeze({ scoreAchat: 70, stopLossPct: 10, takeProfitPct: 20, maxPositionPct: 15, cashMinPct: 15, krachPortefeuillePct: 7,  maxAchats: 3, volatiliteMax: 0.45 }),
  high:     Object.freeze({ scoreAchat: 65, stopLossPct: 15, takeProfitPct: 30, maxPositionPct: 20, cashMinPct: 5,  krachPortefeuillePct: 10, maxAchats: 4, volatiliteMax: 0.80 }),
});
/* Chute de l'indice de référence (S&P 500, via SPY) qui déclenche la
   question "veux-tu tout vendre ?", quel que soit le profil. */
const KRACH_MARCHE_PCT = 4;
const MONTANT_MIN_ORDRE = 5;

/* Univers d'achat : grandes capitalisations américaines (Alpaca Europe
   donne accès aux actions US), secteurs repris du catalogue réel. */
const UNIVERS_ACHAT = Object.freeze([
  ['AAPL', 'NASDAQ', 'Apple', 'Technologie'], ['MSFT', 'NASDAQ', 'Microsoft', 'Technologie'],
  ['NVDA', 'NASDAQ', 'NVIDIA', 'Technologie'], ['GOOGL', 'NASDAQ', 'Alphabet', 'Télécommunications'],
  ['AMZN', 'NASDAQ', 'Amazon', 'Consommation'], ['META', 'NASDAQ', 'Meta Platforms', 'Télécommunications'],
  ['AVGO', 'NASDAQ', 'Broadcom', 'Technologie'], ['JPM', 'NYSE', 'JPMorgan Chase', 'Finance'],
  ['V', 'NYSE', 'Visa', 'Finance'], ['MA', 'NYSE', 'Mastercard', 'Finance'],
  ['UNH', 'NYSE', 'UnitedHealth', 'Santé'], ['JNJ', 'NYSE', 'Johnson & Johnson', 'Santé'],
  ['PG', 'NYSE', 'Procter & Gamble', 'Consommation'], ['KO', 'NYSE', 'Coca-Cola', 'Consommation'],
  ['PEP', 'NASDAQ', 'PepsiCo', 'Consommation'], ['COST', 'NASDAQ', 'Costco', 'Consommation'],
  ['HD', 'NYSE', 'Home Depot', 'Consommation'], ['LLY', 'NYSE', 'Eli Lilly', 'Santé'],
  ['XOM', 'NYSE', 'Exxon Mobil', 'Énergie'], ['WMT', 'NASDAQ', 'Walmart', 'Consommation'],
  ['ADBE', 'NASDAQ', 'Adobe', 'Technologie'], ['CRM', 'NYSE', 'Salesforce', 'Technologie'],
  ['ORCL', 'NYSE', 'Oracle', 'Technologie'], ['MRK', 'NYSE', 'Merck', 'Santé'],
  ['ABBV', 'NYSE', 'AbbVie', 'Santé'], ['CVX', 'NYSE', 'Chevron', 'Énergie'],
  ['MCD', 'NYSE', "McDonald's", 'Consommation'], ['NKE', 'NYSE', 'Nike', 'Consommation'],
  ['DIS', 'NYSE', 'Walt Disney', 'Télécommunications'], ['TSLA', 'NASDAQ', 'Tesla', 'Consommation'],
].map(([symbol, exchange, name, sector]) => Object.freeze({ symbol, exchange, name, sector })));

const arrondi = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const normaliser = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function reglesPour(profil){
  const base = REGLES_PAR_RISQUE[profil?.riskLevel] || REGLES_PAR_RISQUE.moderate;
  return { ...base, niveau: REGLES_PAR_RISQUE[profil?.riskLevel] ? profil.riskLevel : 'moderate' };
}

/* Exclusions de l'utilisateur (hardRules) : secteur ou entreprise. */
function estExclu(valeur, profil){
  const regles = Array.isArray(profil?.hardRules) ? profil.hardRules : [];
  return regles.find(r => {
    const v = normaliser(r.value);
    if (!v) return false;
    if (r.type === 'excluded_sector') return normaliser(valeur.sector) === v || normaliser(valeur.sector).includes(v);
    if (r.type === 'excluded_asset') return normaliser(valeur.symbol) === v || normaliser(valeur.name).includes(v);
    return false;
  }) || null;
}

/* ---------- 1. Krach : faut-il demander "veux-tu tout vendre ?" ---------- */
function detecterKrach({ compte, marche, profil }){
  const regles = reglesPour(profil);
  const raisons = [];
  const equity = Number(compte?.equity), veille = Number(compte?.lastEquity);
  const varPortefeuille = equity > 0 && veille > 0 ? (equity / veille - 1) * 100 : null;
  if (varPortefeuille !== null && varPortefeuille <= -regles.krachPortefeuillePct){
    raisons.push(`Ton portefeuille a perdu ${arrondi(Math.abs(varPortefeuille), 1)} % depuis la clôture d'hier (seuil de ton profil : ${regles.krachPortefeuillePct} %).`);
  }
  const varMarche = Number(marche?.indiceVariationPct);
  if (Number.isFinite(varMarche) && varMarche <= -KRACH_MARCHE_PCT){
    raisons.push(`Le marché américain (S&P 500) chute de ${arrondi(Math.abs(varMarche), 1)} % aujourd'hui (seuil : ${KRACH_MARCHE_PCT} %).`);
  }
  const positionsOuvertes = (compte?.positions || []).filter(p => Number(p.qty) > 0).length;
  return {
    declenche: raisons.length > 0 && positionsOuvertes > 0,
    raisons,
    variationPortefeuillePct: varPortefeuille === null ? null : arrondi(varPortefeuille, 2),
    question: 'Les marchés baissent fortement. Veux-tu que NovaBot vende toutes tes positions pour protéger ton capital ?',
  };
}

/* ---------- 2. Ventes réfléchies ---------- */
function proposerVentes({ compte, profil, scores = {} }){
  const regles = reglesPour(profil);
  const equity = Number(compte?.equity) || 0;
  const propositions = [];
  for (const p of compte?.positions || []){
    const qty = Number(p.qty), valeur = Number(p.marketValue), pl = Number(p.unrealizedPlPc) * 100;
    if (!(qty > 0) || !(valeur > 0)) continue;
    const info = { symbol: p.symbol, name: p.name || p.symbol, sector: p.sector || null };
    const poids = equity > 0 ? (valeur / equity) * 100 : 0;
    const exclusion = estExclu(info, profil);
    const score = Number.isFinite(scores[p.symbol]) ? scores[p.symbol] : null;
    let vente = null;
    if (exclusion){
      vente = { qty, raisons: [`${info.name} est désormais hors de tes règles (${exclusion.value}).`] };
    } else if (Number.isFinite(pl) && pl <= -regles.stopLossPct){
      vente = { qty, raisons: [`Perte de ${arrondi(Math.abs(pl), 1)} % : seuil de protection de ton profil atteint (${regles.stopLossPct} %).`] };
    } else if (Number.isFinite(pl) && pl >= regles.takeProfitPct){
      vente = { qty: arrondi(qty / 2, 6), raisons: [`Gain de ${arrondi(pl, 1)} % : objectif de ton profil atteint (${regles.takeProfitPct} %), NovaBot propose d'en sécuriser la moitié.`] };
    } else if (score !== null && score < regles.scoreAchat - 15){
      vente = { qty, raisons: [`Nova Score tombé à ${score} (seuil d'achat ${regles.scoreAchat}) : la qualité qui justifiait l'achat s'est dégradée.`] };
    } else if (poids > regles.maxPositionPct * 1.5){
      const cible = (regles.maxPositionPct / 100) * equity;
      const qVendre = arrondi(qty * (1 - cible / valeur), 6);
      if (qVendre > 0) vente = { qty: qVendre, raisons: [`${info.name} pèse ${arrondi(poids, 1)} % du portefeuille (maximum de ton profil : ${regles.maxPositionPct} %) : NovaBot propose de réduire le risque de concentration.`] };
    }
    if (!vente) continue;
    propositions.push({ type: 'vente', symbol: p.symbol, name: info.name, qty: vente.qty,
      montantEstime: arrondi(vente.qty * (Number(p.currentPrice) || valeur / qty)), raisons: vente.raisons });
  }
  return propositions;
}

/* ---------- 3. Achats réfléchis ---------- */
function proposerAchats({ compte, profil, candidats = [], budgetParAchat }){
  const regles = reglesPour(profil);
  const equity = Number(compte?.equity) || 0;
  const cashMin = (regles.cashMinPct / 100) * equity;
  let cashDispo = (Number(compte?.cash) || 0) - cashMin;
  const detenus = new Map((compte?.positions || []).map(p => [p.symbol, Number(p.marketValue) || 0]));
  const secteursDetenus = new Set((compte?.positions || []).map(p => p.sector).filter(Boolean));
  const parAchat = Number.isFinite(budgetParAchat) && budgetParAchat > 0
    ? budgetParAchat
    : Number.isFinite(profil?.budgetEUR) && profil.budgetEUR > 0 ? profil.budgetEUR / 5 : equity * 0.05;

  const eligibles = candidats
    .filter(c => Number.isFinite(c.score) && c.score >= regles.scoreAchat && Number(c.prix) > 0)
    .filter(c => !estExclu(c, profil))
    .filter(c => !Number.isFinite(c.volatility) || c.volatility <= regles.volatiliteMax)
    /* Diversification : à score proche, un secteur pas encore détenu passe devant. */
    .sort((a, b) => (b.score + (secteursDetenus.has(b.sector) ? 0 : 3)) - (a.score + (secteursDetenus.has(a.sector) ? 0 : 3)));

  const propositions = [];
  for (const c of eligibles){
    if (propositions.length >= regles.maxAchats || cashDispo < MONTANT_MIN_ORDRE) break;
    const plafondPosition = (regles.maxPositionPct / 100) * equity - (detenus.get(c.symbol) || 0);
    const montant = arrondi(Math.min(parAchat, cashDispo, plafondPosition));
    if (!(montant >= MONTANT_MIN_ORDRE)) continue;
    const raisons = [`Nova Score ${c.score}/100, au-dessus du seuil de ton profil (${regles.scoreAchat}).`];
    if (Number.isFinite(c.volatility)) raisons.push(`Volatilité ${arrondi(c.volatility * 100, 0)} %, compatible avec un risque ${regles.niveau === 'low' ? 'faible' : regles.niveau === 'high' ? 'élevé' : 'modéré'}.`);
    raisons.push(secteursDetenus.has(c.sector) ? `Renforce le secteur ${c.sector}, sans dépasser ${regles.maxPositionPct} % du portefeuille par valeur.` : `Diversifie ton portefeuille vers le secteur ${c.sector}.`);
    propositions.push({ type: 'achat', symbol: c.symbol, name: c.name, sector: c.sector, notional: montant, raisons });
    cashDispo -= montant;
  }
  return propositions;
}

/* Tout en un : ce que NovaBot propose maintenant, à confirmer une à une. */
function propositionsNovaBot({ compte, marche, profil, candidats, scores, budgetParAchat }){
  const krach = detecterKrach({ compte, marche, profil });
  const ventes = proposerVentes({ compte, profil, scores });
  /* En plein krach, NovaBot n'achète pas : il pose d'abord la question. */
  const achats = krach.declenche ? [] : proposerAchats({ compte, profil, candidats, budgetParAchat });
  return { regles: reglesPour(profil), krach, ventes, achats };
}

/* Avant d'exécuter une proposition confirmée, elle doit TOUJOURS exister
   dans un calcul fait à l'instant avec les données fraîches. */
function propositionToujoursValable(courantes, demande){
  const liste = demande?.type === 'vente' ? courantes.ventes : demande?.type === 'achat' ? courantes.achats : [];
  return liste.find(p => p.symbol === demande.symbol) || null;
}

module.exports = {
  REGLES_PAR_RISQUE, KRACH_MARCHE_PCT, MONTANT_MIN_ORDRE, UNIVERS_ACHAT,
  reglesPour, estExclu, detecterKrach, proposerVentes, proposerAchats,
  propositionsNovaBot, propositionToujoursValable,
};
