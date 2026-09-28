// Verification RUNTIME (pas seulement syntaxique) des champs fondamentaux
// EODHD (peg, sharesOutstanding, enterpriseValue, roa, ebitda, ebit,
// debtToEquity, quickRatio). node --check ne detecte pas une reference a
// une variable inexistante a l'interieur d'un litteral objet (classe de
// bug reelle trouvee et corrigee sur debtToEquity : une reference nue a
// `debt`, qui n'etait qu'une CLE de propriete soeur, pas une variable) --
// seul un appel reel de la fonction le revele.

const mockResponse = {
  General: {
    Name: 'Test Corp', CurrencyCode: 'USD', Sector: 'Technology',
    Industry: 'Software', ISIN: 'US0000000000',
  },
  Highlights: {
    EarningsShare: 5, ProfitMargin: 0.25, OperatingMarginTTM: 0.30,
    ReturnOnEquityTTM: 0.35, PERatio: 20, MarketCapitalization: 1000000000,
    RevenueTTM: 500000000, GrossProfitTTM: 300000000,
    PEGRatio: 1.5, SharesOutstanding: 100000000, ReturnOnAssetsTTM: 0.12,
    EBITDA: 150000000,
  },
  Valuation: {
    ForwardPE: 18, PriceBookMRQ: 3, EnterpriseValueEbitda: 12,
    PriceSalesTTM: 4, EnterpriseValue: 1100000000,
  },
  Technicals: { '52WeekHigh': 150, '52WeekLow': 80, Beta: 1.2, AverageVolume: 5000000 },
  Financials: {
    Balance_Sheet: { quarterly: { '2026-06-30': {
      shortLongTermDebtTotal: 200000000, cash: 50000000,
      totalCurrentAssets: 400000000, totalCurrentLiabilities: 150000000,
      totalStockholderEquity: 600000000, inventory: 50000000,
    } } },
    Income_Statement: {
      yearly: { '2025-12-31': { netIncome: 125000000, totalRevenue: 500000000, ebit: 140000000, ebitda: 150000000 } },
      quarterly: {},
    },
    Cash_Flow: { quarterly: { '2026-06-30': { freeCashFlow: 90000000 } } },
  },
};

const mockVide = {
  General: { Name: 'Empty Corp', CurrencyCode: 'USD' },
  Highlights: { EarningsShare: 1 },
  Valuation: {},
  Technicals: {},
  Financials: {
    Balance_Sheet: { quarterly: {} },
    Income_Statement: { yearly: {}, quarterly: {} },
    Cash_Flow: { quarterly: {} },
  },
};

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

  global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(mockResponse) });
  const { FUNDAMENTALS } = require('../api/market/_providers.js');

  try {
    const f = (await FUNDAMENTALS.eodhd('TEST', 'US', 'fake-key-for-test')).fundamentals;
    rapporte('peg', f.peg === 1.5);
    rapporte('sharesOutstanding', f.sharesOutstanding === 100000000);
    rapporte('enterpriseValue', f.enterpriseValue === 1100000000);
    rapporte('roa', f.roa === 0.12);
    rapporte('ebitda (depuis Highlights.EBITDA)', f.ebitda === 150000000);
    rapporte('ebit (depuis Income_Statement.yearly)', f.ebit === 140000000);
    rapporte('debtToEquity = 200M / 600M', Math.abs(f.debtToEquity - (200000000 / 600000000)) < 1e-9);
    rapporte('quickRatio = (400M - 50M) / 150M', Math.abs(f.quickRatio - ((400000000 - 50000000) / 150000000)) < 1e-9);
    rapporte('grossMargin (deja existant) toujours correct', Math.abs(f.grossMargin - 0.6) < 1e-9);
    rapporte('currentRatio (deja existant) toujours correct', Math.abs(f.currentRatio - (400000000 / 150000000)) < 1e-9);

    global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(mockVide) });
    const f2 = (await FUNDAMENTALS.eodhd('TEST2', 'US', 'fake-key-for-test')).fundamentals;
    rapporte('peg absent -> null (jamais invente)', f2.peg === null);
    rapporte('sharesOutstanding absent -> null', f2.sharesOutstanding === null);
    rapporte('enterpriseValue absent -> null', f2.enterpriseValue === null);
    rapporte('roa absent -> null', f2.roa === null);
    rapporte('ebitda absent -> null', f2.ebitda === null);
    rapporte('ebit absent -> null', f2.ebit === null);
    rapporte('debtToEquity absent -> null (pas de division par 0/undefined)', f2.debtToEquity === null);
    rapporte('quickRatio absent -> null', f2.quickRatio === null);

    console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
    process.exit(allOk ? 0 : 1);
  } catch (e) {
    console.error('ERREUR RUNTIME (ex. ReferenceError) :', e);
    process.exit(1);
  }
})();
