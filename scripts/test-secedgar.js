// Verification RUNTIME de l'adaptateur SEC EDGAR (api/market/_secEdgar.js).
// Reproduit notamment le bug reel trouve et corrige pendant l'integration :
// un repli statique (dernierAnnuel(A) ?? dernierAnnuel(B)) choisissait un
// concept XBRL PERIME (ex. 'Revenues', qu'Apple a cesse de deposer apres
// son passage a ASC 606) plutot que le concept de remplacement plus
// recent ('RevenueFromContractWithCustomerExcludingAssessedTax') -- il
// faut comparer les DATES des deux candidats, jamais figer un ordre de
// priorite statique.

const mockTickers = {
  '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
  '1': { cik_str: 999999, ticker: 'VIDE', title: 'Empty Corp' },
};

// Reproduit fidelement la situation reelle Apple : 'Revenues' s'arrete en
// 2018 (10-K), 'RevenueFromContractWithCustomerExcludingAssessedTax'
// prend le relais jusqu'a 2025 -- les DEUX concepts existent dans la
// meme reponse, comme en production.
const mockFactsAapl = {
  entityName: 'Apple Inc.',
  facts: {
    dei: {
      EntityCommonStockSharesOutstanding: {
        units: { shares: [
          { end: '2026-06-27', val: 14594180000, form: '10-Q', filed: '2026-07-31' },
        ] },
      },
    },
    'us-gaap': {
      Revenues: {
        units: { USD: [
          { start: '2017-10-01', end: '2018-09-29', val: 265595000000, form: '10-K', filed: '2018-11-05' },
        ] },
      },
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        units: { USD: [
          { start: '2022-09-25', end: '2023-09-30', val: 383285000000, form: '10-K', filed: '2023-11-03' },
          { start: '2023-10-01', end: '2024-09-28', val: 391035000000, form: '10-K', filed: '2024-11-01' },
          { start: '2024-09-29', end: '2025-09-27', val: 416161000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      NetIncomeLoss: {
        units: { USD: [
          { start: '2024-09-29', end: '2025-09-27', val: 112010000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      EarningsPerShareDiluted: {
        units: { 'USD/shares': [
          { start: '2024-09-29', end: '2025-09-27', val: 7.46, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      CashAndCashEquivalentsAtCarryingValue: {
        units: { USD: [
          { end: '2025-09-27', val: 30737000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      Assets: {
        units: { USD: [
          { end: '2025-09-27', val: 355838000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      AssetsCurrent: {
        units: { USD: [
          { end: '2025-09-27', val: 152987000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      LiabilitiesCurrent: {
        units: { USD: [
          { end: '2025-09-27', val: 152444000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      StockholdersEquity: {
        units: { USD: [
          { end: '2025-09-27', val: 56950000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      GrossProfit: {
        units: { USD: [
          { start: '2024-09-29', end: '2025-09-27', val: 195200000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      OperatingIncomeLoss: {
        units: { USD: [
          { start: '2024-09-29', end: '2025-09-27', val: 130000000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      NetCashProvidedByUsedInOperatingActivities: {
        units: { USD: [
          { start: '2024-09-29', end: '2025-09-27', val: 118000000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
      PaymentsToAcquirePropertyPlantAndEquipment: {
        units: { USD: [
          { start: '2024-09-29', end: '2025-09-27', val: 19233000000, form: '10-K', filed: '2025-11-01' },
        ] },
      },
    },
  },
};

const mockFactsVide = { entityName: 'Empty Corp', facts: { dei: {}, 'us-gaap': {} } };

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

  global.fetch = async (url) => {
    if (String(url).includes('company_tickers.json')) {
      return { ok: true, status: 200, text: async () => JSON.stringify(mockTickers) };
    }
    if (String(url).includes('0000320193')) {
      return { ok: true, status: 200, text: async () => JSON.stringify(mockFactsAapl) };
    }
    if (String(url).includes('0000999999')) {
      return { ok: true, status: 200, text: async () => JSON.stringify(mockFactsVide) };
    }
    return { ok: false, status: 404, text: async () => '{}' };
  };

  const { secedgar, infoPourTicker } = require('../api/market/_secEdgar.js');

  try {
    const info = await infoPourTicker('AAPL');
    rapporte('CIK resolu pour AAPL', info && info.cik === 320193);

    const infoInconnu = await infoPourTicker('INCONNU');
    rapporte('ticker inconnu -> null (jamais un CIK devine)', infoInconnu === null);

    const r = await secedgar('AAPL', 'US', true);
    const f = r.fundamentals;

    rapporte(
      'revenue = 2025 (le PLUS RECENT des 2 concepts candidats), pas 2018 (concept perime)',
      f.revenue === 416161000000
    );
    rapporte('revenueSeries commence par le point le plus recent (2025)', f.revenueSeries && f.revenueSeries[0].date === '2025-09-27');
    rapporte(
      'revenueSeries fusionne les deux concepts (4 exercices reels : 2018/2023/2024/2025, historique jamais tronque)',
      f.revenueSeries && f.revenueSeries.length === 4 && f.revenueSeries.some(p => p.annee === 2018)
    );
    rapporte('netIncome correct', f.netIncome === 112010000000);
    rapporte('eps correct', f.eps === 7.46);
    rapporte('cash correct', f.cash === 30737000000);
    rapporte('sharesOutstanding correct (dei)', f.sharesOutstanding === 14594180000);
    rapporte(
      'currentRatio derive (meme date bilan uniquement)',
      Math.abs(f.currentRatio - (152987000000 / 152444000000)) < 1e-9
    );
    rapporte(
      'grossMargin derive (meme exercice uniquement)',
      Math.abs(f.grossMargin - (195200000000 / 416161000000)) < 1e-9
    );
    rapporte(
      'roe derive (StockholdersEquity et NetIncomeLoss a la meme date)',
      Math.abs(f.roe - (112010000000 / 56950000000)) < 1e-9
    );
    rapporte(
      'freeCashFlow derive (flux operationnel - capex, meme exercice)',
      f.freeCashFlow === 118000000000 - 19233000000
    );
    rapporte('debt jamais invente -> null', f.debt === null);
    rapporte('debtToEquity jamais invente -> null', f.debtToEquity === null);
    rapporte('marketCap jamais invente -> null (SEC EDGAR n\'a aucun cours)', f.marketCap === null);
    rapporte('identity.country deduit du depot 10-K', r.identity.country === 'United States');
    rapporte('identity.currency deduit (USD)', r.identity.currency === 'USD');

    // Cas "donnees absentes" (aucun concept exploitable) : echec propre
    // ('vide'), jamais un objet a moitie rempli ni une ReferenceError.
    try {
      await secedgar('VIDE', 'US', true);
      rapporte('reponse sans aucun concept exploitable doit lever une erreur', false);
    } catch (e) {
      rapporte('reponse vide leve proprement "vide" (pas de crash)', e.message === 'vide');
    }

    // Ticker totalement inconnu -> echec propre, jamais un CIK invente.
    try {
      await secedgar('INCONNU', 'US', true);
      rapporte('ticker inconnu doit lever une erreur', false);
    } catch (e) {
      rapporte('ticker inconnu leve ticker_non_reconnu_par_secedgar', e.message === 'ticker_non_reconnu_par_secedgar');
    }

    console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
    process.exit(allOk ? 0 : 1);
  } catch (e) {
    console.error('ERREUR RUNTIME :', e);
    process.exit(1);
  }
})();
