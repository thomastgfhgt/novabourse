// Vérification du §9 : "retries uniquement sur les requêtes sans effet
// de bord (lecture) avec délai progressif". Mock réseau, pas d'appel réel.

process.env.ALPACA_BROKER_CLIENT_ID = 'id-test';
process.env.ALPACA_BROKER_CLIENT_SECRET = 'secret-test';
process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.sandbox.alpaca.markets';
process.env.ALPACA_BROKER_AUTH_URL = 'https://authx.sandbox.alpaca.markets/v1/oauth2/token';
process.env.ALPACA_BROKER_REGION = 'us';
process.env.ALPACA_BROKER_ENV = 'sandbox';

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };
  const fetchOriginal = global.fetch;

  const reponseToken = { ok: true, status: 200, json: async () => ({ access_token: 'faux-token-test', expires_in: 900, token_type: 'Bearer' }) };

  // --- 1) GET : deux 429, puis un 200 -> doit réussir en 3 appels réels ---
  let appelsApi = 0;
  global.fetch = async (url, init) => {
    if (String(url).includes('oauth2/token')) return reponseToken;
    appelsApi++;
    if (appelsApi < 3) return { ok: false, status: 429, json: async () => ({ message: 'rate limited' }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  delete require.cache[require.resolve('../api/_alpaca/client.js')];
  const { appelBroker, _reinitialiserCachePourTests } = require('../api/_alpaca/client.js');
  _reinitialiserCachePourTests();
  const r1 = await appelBroker('/v1/clock');
  rapporte('GET avec 2x 429 puis 200 : réessaie et finit par réussir', r1.status === 200 && appelsApi === 3);
  global.fetch = fetchOriginal;

  // --- 2) GET : 500 persistant -> abandonne après 3 essais, jamais une boucle infinie ---
  let appelsApi2 = 0;
  global.fetch = async (url) => {
    if (String(url).includes('oauth2/token')) return reponseToken;
    appelsApi2++;
    return { ok: false, status: 500, json: async () => ({ message: 'erreur serveur' }) };
  };
  delete require.cache[require.resolve('../api/_alpaca/client.js')];
  const { appelBroker: appelBroker2, _reinitialiserCachePourTests: reset2 } = require('../api/_alpaca/client.js');
  reset2();
  const r2 = await appelBroker2('/v1/clock');
  rapporte('GET avec 500 persistant : abandonne après exactement 3 essais', r2.status === 500 && appelsApi2 === 3);
  global.fetch = fetchOriginal;

  // --- 3) POST (effet de bord) : 500 -> JAMAIS de réessai, un seul appel ---
  let appelsApi3 = 0;
  global.fetch = async (url) => {
    if (String(url).includes('oauth2/token')) return reponseToken;
    appelsApi3++;
    return { ok: false, status: 500, json: async () => ({ message: 'erreur serveur' }) };
  };
  delete require.cache[require.resolve('../api/_alpaca/client.js')];
  const { appelBroker: appelBroker3, _reinitialiserCachePourTests: reset3 } = require('../api/_alpaca/client.js');
  reset3();
  const r3 = await appelBroker3('/v1/accounts', { method: 'POST', body: '{}' });
  rapporte('POST (écriture) avec 500 : JAMAIS de réessai, un seul appel',
    r3.status === 500 && appelsApi3 === 1);
  global.fetch = fetchOriginal;

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
