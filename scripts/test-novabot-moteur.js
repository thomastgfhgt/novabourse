// Vérifie api/_alpaca/novabot-moteur.js : achats réfléchis, ventes,
// détection de krach ("veux-tu tout vendre ?"), respect des règles du profil.
const m = require('../api/_alpaca/novabot-moteur.js');

let allOk = true;
const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

const compte = (positions = [], cash = 5000, equity = 10000, lastEquity = 10000) => ({ cash, equity, lastEquity, positions });
const pos = (symbol, qty, prix, plPc, extra = {}) => ({ symbol, qty, currentPrice: prix, marketValue: qty * prix, unrealizedPlPc: plPc, ...extra });
const cand = (symbol, score, sector, volatility = 0.25) => ({ symbol, name: symbol, sector, score, prix: 100, volatility });

// --- 1) Krach ---
let k = m.detecterKrach({ compte: compte([pos('AAPL', 10, 100, 0)], 1000, 9200, 10000), marche: {}, profil: { riskLevel: 'moderate' } });
rapporte('portefeuille -8 % (seuil modéré 7 %) : question "tout vendre ?"', k.declenche && /Veux-tu/.test(k.question));
k = m.detecterKrach({ compte: compte([pos('AAPL', 10, 100, 0)], 1000, 9500, 10000), marche: {}, profil: { riskLevel: 'moderate' } });
rapporte('portefeuille -5 % en profil modéré : pas d\'alerte', !k.declenche);
k = m.detecterKrach({ compte: compte([pos('AAPL', 10, 100, 0)], 1000, 9500, 10000), marche: {}, profil: { riskLevel: 'low' } });
rapporte('portefeuille -5 % en profil prudent : alerte', k.declenche);
k = m.detecterKrach({ compte: compte([pos('AAPL', 10, 100, 0)]), marche: { indiceVariationPct: -4.5 }, profil: {} });
rapporte('S&P 500 -4,5 % : alerte même si le portefeuille tient', k.declenche);
k = m.detecterKrach({ compte: compte([], 10000, 9000, 10000), marche: { indiceVariationPct: -6 }, profil: {} });
rapporte('aucune position : rien à vendre, pas de question', !k.declenche);

// --- 2) Ventes ---
let v = m.proposerVentes({ compte: compte([pos('TSLA', 5, 90, -0.12)]), profil: { riskLevel: 'moderate' } });
rapporte('perte de 12 % (stop 10 %) : vente totale proposée', v.length === 1 && v[0].qty === 5 && /protection/.test(v[0].raisons[0]));
v = m.proposerVentes({ compte: compte([pos('NVDA', 10, 120, 0.25)]), profil: { riskLevel: 'moderate' } });
rapporte('gain de 25 % (objectif 20 %) : vente de la moitié', v.length === 1 && v[0].qty === 5);
v = m.proposerVentes({ compte: compte([pos('XOM', 4, 100, 0.02, { sector: 'Énergie' })]), profil: { hardRules: [{ type: 'excluded_sector', value: 'énergie' }] } });
rapporte('position devenue hors règles (secteur exclu) : vente proposée', v.length === 1 && /hors de tes règles/.test(v[0].raisons[0]));
v = m.proposerVentes({ compte: compte([pos('AAPL', 10, 100, 0.03)]), profil: {}, scores: { AAPL: 50 } });
rapporte('Nova Score effondré (50) : vente proposée', v.length === 1 && /Nova Score/.test(v[0].raisons[0]));
v = m.proposerVentes({ compte: compte([pos('AAPL', 30, 100, 0.03)], 1000, 10000), profil: { riskLevel: 'moderate' } });
rapporte('position à 30 % (max 15 %) : réduction proposée', v.length === 1 && v[0].qty > 0 && v[0].qty < 30);
v = m.proposerVentes({ compte: compte([pos('AAPL', 10, 100, 0.03)]), profil: {}, scores: { AAPL: 80 } });
rapporte('position saine : aucune vente', v.length === 0);

// --- 3) Achats ---
const candidats = [cand('AAPL', 82, 'Technologie'), cand('JNJ', 78, 'Santé'), cand('XOM', 90, 'Énergie'),
  cand('TSLA', 74, 'Consommation', 0.9), cand('KO', 60, 'Consommation')];
let a = m.proposerAchats({ compte: compte([], 5000, 10000), profil: { riskLevel: 'moderate', hardRules: [{ type: 'excluded_sector', value: 'énergie' }] }, candidats });
rapporte('secteur exclu jamais proposé (Exxon)', !a.some(x => x.symbol === 'XOM'));
rapporte('score sous le seuil jamais proposé (Coca-Cola 60)', !a.some(x => x.symbol === 'KO'));
rapporte('trop volatil pour le profil jamais proposé (Tesla)', !a.some(x => x.symbol === 'TSLA'));
rapporte('achats motivés (score, volatilité, diversification)', a.length >= 1 && a.every(x => x.raisons.length >= 2 && /Nova Score/.test(x.raisons[0])));
const totalAchats = a.reduce((s, x) => s + x.notional, 0);
rapporte('liquidités minimum du profil respectées (15 %)', 5000 - totalAchats >= 1500 - 0.01);
a = m.proposerAchats({ compte: compte([], 5000, 10000), profil: { riskLevel: 'moderate', budgetEUR: 1000 }, candidats });
rapporte('budget de l\'utilisateur réparti (1 000 € → 200 € par achat)', a.length && a.every(x => x.notional <= 200));
a = m.proposerAchats({ compte: compte([pos('AAPL', 15, 100, 0, { sector: 'Technologie' })], 5000, 10000), profil: { riskLevel: 'moderate' }, candidats: [cand('AAPL', 85, 'Technologie')] });
rapporte('jamais au-delà du poids maximum par valeur', a.length === 0);

// --- 4) Ensemble ---
const tout = m.propositionsNovaBot({ compte: compte([pos('AAPL', 10, 100, 0)], 5000, 9000, 10000), marche: {}, profil: { riskLevel: 'moderate' }, candidats });
rapporte('en plein krach : aucune proposition d\'achat', tout.krach.declenche && tout.achats.length === 0);
const ok = m.propositionToujoursValable({ ventes: [{ symbol: 'TSLA' }], achats: [] }, { type: 'vente', symbol: 'TSLA' });
const ko = m.propositionToujoursValable({ ventes: [], achats: [] }, { type: 'achat', symbol: 'AAPL' });
rapporte('un ordre confirmé n\'est exécuté que s\'il est toujours proposé', ok && !ko);

console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
