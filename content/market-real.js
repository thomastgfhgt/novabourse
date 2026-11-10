/* ============================================================
   NOVATITRE — VRAIES VALEURS (cours réels de départ, datés et sourcés)
   ------------------------------------------------------------
   Chaque prix est un vrai cours de clôture relevé le 2 novembre 2026,
   avec sa date et sa source. Rien n'est inventé.
   Après cette date, le prototype fait bouger les cours en SIMULATION
   (étiquetée « simulé ») pour que le portefeuille vive.
   Sur le vrai site : cours en direct (ou léger différé) sous licence.
   cur = devise de cotation ; minCh = chapitre à valider (à moitié) avant de pouvoir acheter.
   ============================================================ */
window.NT_MARKET_SRC = {
  bd: { t: 'Bourse Direct, cours de la Bourse de Paris (clôture du 30/10/2026)', u: 'https://www.boursedirect.fr/fr/marche/paris' },
  pt: { t: 'Portfolio Terminal, clôture de Wall Street du 30/10/2026', u: 'https://portfolio-terminal.com/blog/stock-market-week-in-review-october-30-2026' },
  hg: { t: 'Gotrade, fiches des valeurs américaines', u: 'https://www.heygotrade.com/en/us-stock/asml/' },
  sa: { t: 'StockAnalysis, historique de QQQ', u: 'https://stockanalysis.com/etf/qqq/history/' },
  dg: { t: 'Digrin, historique de SPY', u: 'https://www.digrin.com/stocks/detail/SPY/price' },
  fo: { t: 'Fortune, prix du bitcoin le 30/10/2026', u: 'https://fortune.com/article/price-of-bitcoin-10-30-2026/' },
};
window.NT_EURUSD = 1.1197;   // euro / dollar à la clôture du 30/10/2026 (BFM Bourse / Tradingsat)
window.NT_MARKET = [
  /* Paris (euros) — éligibles PEA */
  { id: 'MC', name: 'LVMH', sector: 'Luxe', zone: 'Paris', kind: 'action', cur: 'EUR', price: 387.00, chg: 0.82, date: '2026-10-30', src: 'bd', vol: 0.016, pea: true },
  { id: 'TTE', name: 'TotalEnergies', sector: 'Énergie', zone: 'Paris', kind: 'action', cur: 'EUR', price: 85.43, chg: 0.98, date: '2026-10-30', src: 'bd', vol: 0.014, pea: true },
  { id: 'SAN', name: 'Sanofi', sector: 'Santé', zone: 'Paris', kind: 'action', cur: 'EUR', price: 79.74, chg: 4.71, date: '2026-10-30', src: 'bd', vol: 0.012, pea: true },
  { id: 'BNP', name: 'BNP Paribas', sector: 'Banque', zone: 'Paris', kind: 'action', cur: 'EUR', price: 85.65, chg: -2.28, date: '2026-10-30', src: 'bd', vol: 0.017, pea: true },
  { id: 'AIR', name: 'Airbus', sector: 'Aéronautique', zone: 'Paris', kind: 'action', cur: 'EUR', price: 192.40, chg: -2.01, date: '2026-10-30', src: 'bd', vol: 0.016, pea: true },
  { id: 'SU', name: 'Schneider Electric', sector: 'Équipements électriques', zone: 'Paris', kind: 'action', cur: 'EUR', price: 237.50, chg: -4.08, date: '2026-10-30', src: 'bd', vol: 0.017, pea: true },
  { id: 'OR', name: 'L’Oréal', sector: 'Cosmétiques', zone: 'Paris', kind: 'action', cur: 'EUR', price: 436.95, chg: 2.93, date: '2026-10-30', src: 'bd', vol: 0.012, pea: true },
  { id: 'STLA', name: 'Stellantis', sector: 'Automobile', zone: 'Paris', kind: 'action', cur: 'EUR', price: 4.1415, chg: -1.94, date: '2026-10-30', src: 'bd', vol: 0.022, pea: true },
  /* États-Unis (dollars) — compte-titres */
  { id: 'AAPL', name: 'Apple', sector: 'Technologie', zone: 'USA', kind: 'action', cur: 'USD', price: 344.63, chg: -1.23, date: '2026-10-30', src: 'pt', vol: 0.016 },
  { id: 'MSFT', name: 'Microsoft', sector: 'Logiciels', zone: 'USA', kind: 'action', cur: 'USD', price: 521.91, chg: -1.55, date: '2026-10-30', src: 'pt', vol: 0.015 },
  { id: 'NVDA', name: 'Nvidia', sector: 'Semi-conducteurs', zone: 'USA', kind: 'action', cur: 'USD', price: 204.64, chg: -4.22, date: '2026-10-30', src: 'pt', vol: 0.028 },
  { id: 'GOOGL', name: 'Alphabet (Google)', sector: 'Internet', zone: 'USA', kind: 'action', cur: 'USD', price: 279.84, chg: -1.40, date: '2026-10-30', src: 'pt', vol: 0.02 },
  { id: 'AMZN', name: 'Amazon', sector: 'Commerce en ligne', zone: 'USA', kind: 'action', cur: 'USD', price: 240.35, chg: -1.41, date: '2026-10-30', src: 'pt', vol: 0.018 },
  { id: 'META', name: 'Meta Platforms', sector: 'Internet', zone: 'USA', kind: 'action', cur: 'USD', price: 614.99, chg: -1.53, date: '2026-10-30', src: 'pt', vol: 0.022 },
  { id: 'TSLA', name: 'Tesla', sector: 'Automobile', zone: 'USA', kind: 'action', cur: 'USD', price: 399.81, chg: -0.87, date: '2026-10-30', src: 'pt', vol: 0.032 },
  { id: 'ASML', name: 'ASML', sector: 'Semi-conducteurs', zone: 'USA', kind: 'action', cur: 'USD', price: 1565.90, chg: -6.55, date: '2026-10-30', src: 'hg', vol: 0.024, note: 'Coté à Amsterdam et à New York (ici : New York, en dollars).' },
  /* ETF (dollars) */
  { id: 'SPY', name: 'ETF S&P 500 (SPY)', sector: 'ETF · 500 grandes entreprises américaines', zone: 'ETF', kind: 'etf', cur: 'USD', price: 755.79, chg: null, date: null, src: 'dg', vol: 0.009, dateTxt: 'cours récent' },
  { id: 'QQQ', name: 'ETF Nasdaq 100 (QQQ)', sector: 'ETF · 100 valeurs technologiques', zone: 'ETF', kind: 'etf', cur: 'USD', price: 690.49, chg: -3.47, date: '2026-10-30', src: 'sa', vol: 0.012 },
  { id: 'VTI', name: 'ETF Marché américain total (VTI)', sector: 'ETF · environ 3 500 entreprises', zone: 'ETF', kind: 'etf', cur: 'USD', price: 378.24, chg: null, date: '2026-10-29', src: 'hg', vol: 0.009 },
  { id: 'IWM', name: 'ETF Petites entreprises US (IWM)', sector: 'ETF · Russell 2000', zone: 'ETF', kind: 'etf', cur: 'USD', price: 281.29, chg: null, date: '2026-10-28', src: 'hg', vol: 0.013 },
  { id: 'EEM', name: 'ETF Pays émergents (EEM)', sector: 'ETF · Chine, Inde, Taïwan…', zone: 'ETF', kind: 'etf', cur: 'USD', price: 62.01, chg: null, date: '2026-10-23', src: 'hg', vol: 0.011 },
  { id: 'AGG', name: 'ETF Obligations US (AGG)', sector: 'ETF · obligations', zone: 'ETF', kind: 'etf', cur: 'USD', price: 96.05, chg: null, date: '2026-10-26', src: 'hg', vol: 0.003 },
  { id: 'GLD', name: 'ETF Or (GLD)', sector: 'ETF · or physique', zone: 'ETF', kind: 'etf', cur: 'USD', price: 368.57, chg: -1.32, date: '2026-10-29', src: 'hg', vol: 0.01 },
  { id: 'VNQ', name: 'ETF Immobilier coté US (VNQ)', sector: 'ETF · immobilier', zone: 'ETF', kind: 'etf', cur: 'USD', price: 93.87, chg: null, date: '2026-10-29', src: 'hg', vol: 0.011 },
  /* Crypto (dollars) — achat après le chapitre 9 */
  { id: 'BTC', name: 'Bitcoin', sector: 'Crypto-actif · très risqué', zone: 'Crypto', kind: 'crypto', cur: 'USD', price: 77380.93, chg: null, date: '2026-10-30', src: 'fo', vol: 0.035, minCh: 9, frac: true },
  { id: 'ETH', name: 'Ethereum', sector: 'Crypto-actif · très risqué', zone: 'Crypto', kind: 'crypto', cur: 'USD', price: 2232.62, chg: null, date: '2026-10-30', src: 'fo', vol: 0.045, minCh: 9, frac: true },
  /* Épargne (utilisée par les séances du jour) */
  { id: 'LIV', name: 'Livret d’épargne', sector: 'Épargne garantie · disponible', zone: 'Épargne', kind: 'livret', cur: 'EUR', price: 100, chg: 0, date: '2026-10-30', src: null, vol: 0, hidden: true },
];
/* Anciens identifiants des séances → vraies valeurs équivalentes */
window.NT_MK_ALIAS = { MON: 'VTI', OBL: 'AGG' };
