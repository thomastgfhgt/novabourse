// Vérification de api/_alpaca/funding.js — validations d'entrée (aucun
// réseau réel) + propagation correcte du 403 réellement observé en Phase 5
// (permission de financement distincte de celle des comptes/ordres).

process.env.ALPACA_BROKER_CLIENT_ID = 'id-test';
process.env.ALPACA_BROKER_CLIENT_SECRET = 'secret-test';
process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.sandbox.alpaca.markets';
process.env.ALPACA_BROKER_AUTH_URL = 'https://authx.sandbox.alpaca.markets/v1/oauth2/token';
process.env.ALPACA_BROKER_REGION = 'us';
process.env.ALPACA_BROKER_ENV = 'sandbox';

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

  delete require.cache[require.resolve('../api/_alpaca/client.js')];
  delete require.cache[require.resolve('../api/_alpaca/funding.js')];
  const { creerRelationACH, creerDepotSimule } = require('../api/_alpaca/funding.js');

  const leveUneErreurAsync = async (fn) => { try { await fn(); return false; } catch { return true; } };

  rapporte('nom du titulaire manquant rejeté',
    await leveUneErreurAsync(() => creerRelationACH('acc-1', { bankAccountType: 'CHECKING', bankAccountNumber: '1', bankRoutingNumber: '2' })));
  rapporte('type de compte invalide rejeté',
    await leveUneErreurAsync(() => creerRelationACH('acc-1', { accountOwnerName: 'Test', bankAccountType: 'LIVRET', bankAccountNumber: '1', bankRoutingNumber: '2' })));
  rapporte('numéro de compte manquant rejeté',
    await leveUneErreurAsync(() => creerRelationACH('acc-1', { accountOwnerName: 'Test', bankAccountType: 'CHECKING', bankRoutingNumber: '2' })));
  rapporte('montant de dépôt invalide (0) rejeté',
    await leveUneErreurAsync(() => creerDepotSimule('acc-1', 'rel-1', 0)));
  rapporte('montant de dépôt invalide (négatif) rejeté',
    await leveUneErreurAsync(() => creerDepotSimule('acc-1', 'rel-1', -50)));

  // --- Propagation d'un 403 réel (observé en Phase 5 : permission ACH
  // distincte de celle des comptes/ordres) ---
  const fetchOriginal = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('oauth2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'faux-token-test', expires_in: 900, token_type: 'Bearer' }) };
    }
    return { ok: false, status: 403, json: async () => ({ code: 40310000, message: 'request is forbidden' }) };
  };
  delete require.cache[require.resolve('../api/_alpaca/client.js')];
  delete require.cache[require.resolve('../api/_alpaca/funding.js')];
  const { creerRelationACH: creerRelationACH2 } = require('../api/_alpaca/funding.js');
  let erreur = null;
  try {
    await creerRelationACH2('acc-1', { accountOwnerName: 'Test', bankAccountType: 'CHECKING', bankAccountNumber: '1', bankRoutingNumber: '2' });
  } catch (e) { erreur = e; }
  rapporte('un 403 réel (permission financement manquante) est propagé, jamais un faux succès',
    erreur && erreur.status === 403 && erreur.body && erreur.body.code === 40310000);
  global.fetch = fetchOriginal;

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
