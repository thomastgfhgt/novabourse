// Vérification de api/_alpaca/orders.js — validation PURE des paramètres
// (§5.2 : "Contrôles serveur avant envoi"), jamais un appel réseau réel.

process.env.ALPACA_BROKER_CLIENT_ID = 'id-test';
process.env.ALPACA_BROKER_CLIENT_SECRET = 'secret-test';
process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.sandbox.alpaca.markets';
process.env.ALPACA_BROKER_AUTH_URL = 'https://authx.sandbox.alpaca.markets/v1/oauth2/token';
process.env.ALPACA_BROKER_REGION = 'us';
process.env.ALPACA_BROKER_ENV = 'sandbox';

const { validerParametresOrdre, genererClientOrderId } = require('../api/_alpaca/orders.js');

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

  rapporte('ordre marché/achat valide (qty) accepté',
    validerParametresOrdre({ symbol: 'AAPL', side: 'buy', qty: 1 }).valide === true);
  rapporte('ordre marché/vente valide (notional) accepté',
    validerParametresOrdre({ symbol: 'AAPL', side: 'sell', notional: 100 }).valide === true);
  rapporte('symbol manquant rejeté',
    validerParametresOrdre({ side: 'buy', qty: 1 }).erreurs.includes('symbol_requis'));
  rapporte('side invalide rejeté',
    validerParametresOrdre({ symbol: 'AAPL', side: 'short_cross', qty: 1 }).erreurs.includes('side_invalide'));
  rapporte('qty ET notional ensemble rejeté',
    validerParametresOrdre({ symbol: 'AAPL', side: 'buy', qty: 1, notional: 100 }).erreurs.includes('qty_et_notional_exclusifs'));
  rapporte('ni qty ni notional rejeté',
    validerParametresOrdre({ symbol: 'AAPL', side: 'buy' }).erreurs.includes('qty_ou_notional_requis'));
  rapporte('qty négative ou nulle rejetée',
    validerParametresOrdre({ symbol: 'AAPL', side: 'buy', qty: 0 }).erreurs.includes('qty_doit_etre_positive'));
  rapporte('type limite non encore supporté, rejeté',
    validerParametresOrdre({ symbol: 'AAPL', side: 'buy', qty: 1, type: 'limit' }).erreurs.includes('type_non_supporte'));
  rapporte('client_order_id généré est bien un UUID unique à chaque appel',
    genererClientOrderId() !== genererClientOrderId());

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
