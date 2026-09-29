// Verification du correctif tickers Hong Kong (api/market/_providers.js,
// eodhdSymbol) -- bug REEL trouve en testant un echantillon aleatoire de
// tout le catalogue (pas seulement les grandes capitalisations) : 0/14
// valeurs HK avaient un prix, contre 86-100% pour toutes les autres
// places testees. Diagnostique en direct contre l'API reelle : le
// catalogue stocke les tickers HK sur 5 chiffres avec zero de tete
// ("00001"), EODHD n'en reconnait que 4 ("0001.HK" repond avec un prix
// reel, "00001.HK" echoue "Ticker Not Found"). Verifie sur les 2854
// tickers HK du catalogue : seuls 4 ont reellement 5 chiffres
// significatifs (80737/80941/83168/87001, probablement des produits
// structures), tous les autres n'ont que des zeros de tete en trop.

const { eodhdSymbol } = require('../api/market/_providers.js');

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

  // Cas courant : zero de tete en trop (l'immense majorite des 2854 tickers HK)
  rapporte("00001.HK -> 0001.HK (zero de tete retire)", eodhdSymbol('00001', 'HK') === '0001.HK');
  rapporte("00002.HK -> 0002.HK", eodhdSymbol('00002', 'HK') === '0002.HK');
  rapporte("00700.HK -> 0700.HK (Tencent, deja verifie fonctionnel en direct)", eodhdSymbol('00700', 'HK') === '0700.HK');
  rapporte("00016.HK -> 0016.HK", eodhdSymbol('00016', 'HK') === '0016.HK');

  // Cas limite : ticker deja a 4 chiffres significatifs (pas de zero a retirer)
  rapporte("09988.HK -> 9988.HK (4 chiffres significatifs)", eodhdSymbol('09988', 'HK') === '9988.HK');

  // Cas limite CRITIQUE : les 4 tickers reels avec 5 chiffres significatifs
  // (produits structures) -- NE DOIVENT JAMAIS perdre un chiffre.
  rapporte("80737.HK reste 80737.HK (5 chiffres significatifs, jamais tronque)", eodhdSymbol('80737', 'HK') === '80737.HK');
  rapporte("87001.HK reste 87001.HK", eodhdSymbol('87001', 'HK') === '87001.HK');

  // Doit rester inchange pour toute autre place (jamais un effet de bord).
  rapporte("AAPL@NASDAQ inchange", eodhdSymbol('AAPL', 'NASDAQ') === 'AAPL.US');
  rapporte("MC@PA inchange", eodhdSymbol('MC', 'PA') === 'MC.PA');
  rapporte("BHP@AU inchange", eodhdSymbol('BHP', 'AU') === 'BHP.AU');

  // Un ticker HK non-numerique (ne devrait jamais arriver en pratique,
  // HKEX n'utilise que des codes numeriques) ne doit jamais planter.
  rapporte("ticker HK non-numerique laisse tel quel (pas de crash)", eodhdSymbol('ABC', 'HK') === 'ABC.HK');

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
