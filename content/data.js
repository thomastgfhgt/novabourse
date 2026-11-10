/* ============================================================
   NOVATITRE — NOVA MISSIONS · DONNÉES DE BASE (v2, 31/10/2026)
   ------------------------------------------------------------
   Entreprises, cours et portefeuilles du simulateur : FICTIFS.
   Règles fiscales 2026 citées (à revérifier à chaque loi de finances) :
   - PFU (flat tax) 31,4 % = 12,8 % d'impôt + 18,6 % de prélèvements sociaux
   - PEA : plafond 150 000 € ; après 5 ans, gains exonérés d'impôt, 18,6 % de PS
   - Assurance-vie : PS 17,2 % ; après 8 ans abattement 4 600 € / 9 200 €
   Règle de rédaction : l'ACTION d'abord, texte de 2 lignes maximum,
   au moins une vraie action par mission, jamais 2 exercices identiques à la suite.
   ============================================================ */

/* ---------- petits constructeurs (rendent le contenu lisible) ---------- */
window.NT_H = (() => {
  const B = (title, text) => ({ type: 'brief', title, text });
  const Q = (q, choices, answer, explain) => ({ type: 'qcm', q, choices, answer, explain });
  const V = (q, answer, explain) => ({ type: 'vf', q, answer, explain });
  const S = (q, left, right, cards) => ({ type: 'swipe', q, left, right, cards: cards.map(([t, s, explain]) => ({ t, side: s === 'l' ? 'left' : 'right', explain })) });
  const O = (q, items, explain) => ({ type: 'order', q, items, explain });
  const C = (q, answer, tol, unit, explain) => ({ type: 'calc', q, answer, tol, unit, explain });
  const X = (q, pairs, explain) => ({ type: 'match', q, pairs, explain });           // relier
  const T = (q, price, goal, explain) => ({ type: 'ticket', q, price, goal, explain }); // ticket d'ordre
  const K = (q, bids, asks, choices, answer, explain) => ({ type: 'book', q, bids, asks, choices, answer, explain });
  const G = (q, series, marks, answer, explain, from = '2019', to = '2021') => ({ type: 'chart', q, series, marks, answer, explain, from, to });
  const L = (q, capital, rate, min, max, target, explain, monthly = 0) => ({ type: 'slider', q, capital, rate, min, max, target, explain, monthly });
  const R = (title, persona, nodes) => ({ type: 'role', title, persona, nodes });
  /* graphique en bougies généré + question : gen = { kind, seed, n, tail }, show = { ma, vol, rsi, levels, marks } */
  const CQ = (q, gen, show, choices, answer, explain) => ({ type: 'candles', q, gen, show, choices, answer, explain });
  /* mission : points et argent fictif selon la durée */
  const PTS = { 2: 10, 3: 12, 5: 15, 7: 20, 10: 25, 15: 35 };
  const mis = (id, ch, title, kind, dur, goal, steps, extra = {}) =>
    Object.assign({ id, ch, title, kind, dur, goal, steps, score: PTS[dur] || 15, cash: (PTS[dur] || 15) * 12 }, extra);
  return { B, Q, V, S, O, C, X, T, K, G, L, R, CQ, mis };
})();

window.NT_RANKS = [
  { min: 0,   name: 'Novice' },
  { min: 150, name: 'Initié' },
  { min: 330, name: 'Investisseur' },
  { min: 520, name: 'Analyste' },
  { min: 700, name: 'Stratège' },
  { min: 880, name: 'Expert' },
];
window.NT_CERT_SCORE = 700;
window.NT_MISSIONS = [];

window.NT_CHAPTERS = [
  { id: 1, title: 'Premiers pas',               sub: 'Épargne, risque, inflation, intérêts composés', color: '#8f74ff' },
  { id: 2, title: 'Ma première plateforme',     sub: 'Fiche valeur, ordres, frais, carnet d’ordres',  color: '#5b8cff' },
  { id: 3, title: 'Construire mon portefeuille', sub: 'ETF, diversification, horizon, investir chaque mois', color: '#3fd39a' },
  { id: 4, title: 'Lire une entreprise',        sub: 'Résultats, dette, dividendes, PER, actualité',  color: '#a68cff' },
  { id: 5, title: 'Résister aux tempêtes',      sub: 'Krachs, émotions, biais, patience',             color: '#ff7aa8' },
  { id: 6, title: 'Déjouer les pièges',         sub: 'Arnaques, faux conseillers, promesses',          color: '#ff9f5a' },
  { id: 7, title: 'Ma stratégie',               sub: 'Objectif, répartition, rééquilibrage, plan',    color: '#c4b5ff' },
  { id: 8, title: 'Mes enveloppes',             sub: 'Livrets, PEA, assurance-vie, PER, épargne salariale, impôts', color: '#66d0ff', after: 2 },
  { id: 9, title: 'Produits risqués : les comprendre', sub: 'Crypto, effet de levier, CFD, options', color: '#ff6b7f', after: 5 },
  { id: 10, title: 'Lire les bougies',          sub: 'Bougies, unités de temps, figures, volumes', color: '#3fd39a' },
  { id: 11, title: 'Tendances et indicateurs',  sub: 'Supports, résistances, cassures, moyennes mobiles, RSI', color: '#5b8cff' },
  { id: 12, title: 'Gérer le risque',           sub: 'Stop, règle des 1 %, taille de position, ratio, drawdown', color: '#a68cff' },
  { id: 13, title: 'Plan, journal et mental',   sub: 'Plan de trading, journal, biais, calendrier, styles', color: '#ff9f5a' },
  { id: 14, title: 'Stratégies et tests',       sub: 'Tendance, retour à la moyenne, backtest, statistiques', color: '#c4b5ff' },
  { id: 15, title: 'Dérivés et macroéconomie',  sub: 'Futures, options, taux, inflation, banques centrales', color: '#ff7aa8' },
];

/* L'école : 5 niveaux, chacun validé par un examen et un Certificat NovaTitre. */
window.NT_LEVELS = [
  { id: 1, title: 'Les bases',          sub: 'Épargne, risque, ordres, frais, ETF',                ch: [1, 2, 3],          exam: 15 },
  { id: 2, title: 'Investisseur',       sub: 'Entreprises, crises, arnaques, stratégie, enveloppes', ch: [4, 5, 6, 7, 8, 9], exam: 20 },
  { id: 3, title: 'Lire un graphique',  sub: 'Bougies, tendances, supports, indicateurs',          ch: [10, 11],           exam: 15 },
  { id: 4, title: 'Trader',             sub: 'Risque, taille de position, plan, journal, mental',  ch: [12, 13],           exam: 15 },
  { id: 5, title: 'Trader avancé',      sub: 'Stratégies, backtest, dérivés, macroéconomie',       ch: [14, 15],           exam: 15 },
];
window.NT_PASS = 0.8;   // 80 % de bonnes réponses pour valider un examen

/* Test de départ : 2 questions par niveau. 1–7 = chapitres 1 à 7 ; 8, 9, 10 = niveaux 3, 4, 5 de l'école (trading). */
window.NT_PLACEMENT = [
  { lvl: 1, q: 'Quel placement garantit le capital ?', choices: ['Un livret d’épargne réglementé', 'Une action', 'Un ETF'], answer: 0 },
  { lvl: 1, q: 'Avec 2 % d’inflation, 1 000 € gardés 10 ans achètent…', choices: ['plus de choses', 'autant', 'moins de choses'], answer: 2 },
  { lvl: 2, q: 'Le spread, c’est…', choices: ['les frais du courtier', 'l’écart entre meilleur prix de vente et meilleur prix d’achat', 'le dividende'], answer: 1 },
  { lvl: 2, q: 'Un ordre à cours limité permet de…', choices: ['garantir l’exécution immédiate', 'fixer le prix maximum payé', 'éviter les frais'], answer: 1 },
  { lvl: 3, q: 'Un ETF sur un indice mondial…', choices: ['garantit le capital', 'investit dans de nombreuses entreprises à la fois', 'ne peut pas baisser'], answer: 1 },
  { lvl: 3, q: 'Diversifier sert surtout à…', choices: ['répartir le risque', 'supprimer tout risque', 'payer moins de frais'], answer: 0 },
  { lvl: 4, q: 'La marge nette, c’est…', choices: ['bénéfice ÷ chiffre d’affaires', 'chiffre d’affaires ÷ salariés', 'cours ÷ dividende'], answer: 0 },
  { lvl: 4, q: 'Un dividende…', choices: ['est garanti chaque année', 'peut être réduit ou supprimé', 'est un remboursement de prêt'], answer: 1 },
  { lvl: 5, q: 'Face à une baisse de 30 %, avec un horizon de 15 ans et une épargne de côté, vendre dans la panique…', choices: ['transforme une baisse en perte réelle', 'protège toujours', 'est obligatoire'], answer: 0 },
  { lvl: 5, q: 'Les performances passées…', choices: ['garantissent l’avenir', 'ne préjugent pas des performances futures', 'sont toujours mensongères'], answer: 1 },
  { lvl: 6, q: 'Où vérifier qu’un courtier est autorisé ?', choices: ['REGAFI', 'Instagram', 'Les avis clients'], answer: 0 },
  { lvl: 6, q: '« 10 % par mois garantis » est…', choices: ['une belle opportunité', 'un signal d’arnaque', 'un taux normal'], answer: 1 },
  { lvl: 7, q: 'Rééquilibrer un portefeuille, c’est…', choices: ['tout vendre chaque année', 'revenir à sa répartition cible', 'acheter uniquement ce qui monte'], answer: 1 },
  { lvl: 7, q: 'En 2026, les gains d’un PEA de plus de 5 ans supportent…', choices: ['31,4 %', '18,6 % de prélèvements sociaux', 'aucun prélèvement'], answer: 1 },
  /* niveaux 8 à 10 : trading (valident les niveaux 3, 4 et 5 de l'école) */
  { lvl: 8, q: 'Sur un graphique en bougies, une bougie verte signifie…', choices: ['clôture au-dessus de l’ouverture', 'clôture en dessous de l’ouverture', 'volume en hausse'], answer: 0 },
  { lvl: 8, q: 'Un RSI au-dessus de 70 signifie…', choices: ['une forte hausse récente (« suracheté »), sans signal garanti', 'qu’il faut vendre immédiatement', 'que l’entreprise est en difficulté'], answer: 0 },
  { lvl: 9, q: 'Capital 10 000 €, risque 1 %, entrée 50 €, stop 48 €. Taille de position ?', choices: ['50 actions', '200 actions', '10 actions'], answer: 0 },
  { lvl: 9, q: 'Après une perte de 50 %, quelle hausse faut-il pour revenir au départ ?', choices: ['+100 %', '+50 %', '+25 %'], answer: 0 },
  { lvl: 10, q: '40 % de trades gagnants à 2R, 60 % de perdants à 1R : espérance par trade ?', choices: ['+0,2 R', '−0,2 R', '0 R'], answer: 0 },
  { lvl: 10, q: 'L’acheteur d’un call peut perdre au maximum…', choices: ['la prime payée', 'un montant illimité', 'rien du tout'], answer: 0 },
];

/* Marché du simulateur : entreprises FICTIVES. Les cours « vivent » chaque
   jour (marche aléatoire déterministe dans le prototype ; vrais cours en
   léger différé sur le site). vol = volatilité quotidienne typique. */
window.NT_MARKET = [
  { id: 'EXP', name: 'Exemplia',            sector: 'Industrie',     price: 42.52, vol: 0.014, pea: true,  div: 1.20 },
  { id: 'SOL', name: 'Solaria Foods',       sector: 'Alimentation',  price: 18.40, vol: 0.010, pea: true,  div: 0.62 },
  { id: 'NVX', name: 'Novix Santé',         sector: 'Santé',         price: 96.10, vol: 0.012, pea: true,  div: 2.10 },
  { id: 'BRK', name: 'Banque Brisa',        sector: 'Finance',       price: 12.05, vol: 0.017, pea: true,  div: 0.70 },
  { id: 'TEC', name: 'Tecnor Systems',      sector: 'Technologie',   price: 151.30, vol: 0.022, pea: false, div: 0 },
  { id: 'LUM', name: 'Maison Lumen',        sector: 'Luxe',          price: 388.00, vol: 0.016, pea: true,  div: 6.50 },
  { id: 'TEL', name: 'Telcora',             sector: 'Télécoms',      price: 9.84,  vol: 0.009, pea: true,  div: 0.45 },
  { id: 'AUT', name: 'Autoria',             sector: 'Automobile',    price: 27.30, vol: 0.019, pea: true,  div: 1.05 },
  { id: 'MON', name: 'ETF Monde (fictif)',  sector: 'ETF · 1 500 entreprises', price: 31.80, vol: 0.008, pea: true, div: 0 },
  { id: 'OBL', name: 'ETF Obligations (fictif)', sector: 'ETF · obligations d’États', price: 104.20, vol: 0.003, pea: false, div: 0 },
  { id: 'LIV', name: 'Livret (fictif)',     sector: 'Épargne garantie · disponible', price: 100.00, vol: 0, pea: false, div: 0 },
];

/* Histoire en épisodes : 1 nouvel épisode par jour. */
window.NT_STORY_META = { title: 'Ta première année d’investisseur', sub: 'Une histoire en 6 épisodes, un par jour.' };
