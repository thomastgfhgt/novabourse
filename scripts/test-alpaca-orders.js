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

  // --- Annulation : 204 -> succès, 422 -> ordre non annulable (mock réseau) ---
  const fetchOriginal = global.fetch;
  delete require.cache[require.resolve('../api/_alpaca/client.js')];
  delete require.cache[require.resolve('../api/_alpaca/orders.js')];

  global.fetch = async (url) => {
    if (String(url).includes('oauth2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'faux-token-test', expires_in: 900, token_type: 'Bearer' }) };
    }
    return { status: 204, ok: false, json: async () => null };
  };
  const { annulerOrdre } = require('../api/_alpaca/orders.js');
  const res204 = await annulerOrdre('acc-1', 'ordre-1');
  rapporte('204 -> annulation acceptée, jamais une erreur', res204.annule === true);
  global.fetch = fetchOriginal;

  global.fetch = async (url) => {
    if (String(url).includes('oauth2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'faux-token-test', expires_in: 900, token_type: 'Bearer' }) };
    }
    return { status: 422, ok: false, json: async () => ({ code: 42210000, message: 'order is not cancelable' }) };
  };
  delete require.cache[require.resolve('../api/_alpaca/client.js')];
  delete require.cache[require.resolve('../api/_alpaca/orders.js')];
  const { annulerOrdre: annulerOrdre2 } = require('../api/_alpaca/orders.js');
  let erreur422 = null;
  try { await annulerOrdre2('acc-1', 'ordre-2'); } catch (e) { erreur422 = e; }
  rapporte('422 -> ordre non annulable propagé, jamais présenté comme annulé',
    erreur422 && erreur422.status === 422 && erreur422.message === 'alpaca_ordre_non_annulable');
  global.fetch = fetchOriginal;

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
