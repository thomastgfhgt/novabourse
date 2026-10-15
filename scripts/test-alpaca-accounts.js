// Vérification de api/_alpaca/accounts.js — forme du corps de création de
// compte (doit respecter EXACTEMENT les champs obligatoires documentés par
// Alpaca pour POST /v1/accounts) + propagation correcte d'une erreur HTTP
// (ex. le 403 "request is forbidden" réellement observé en Phase 3 avec des
// identifiants lecture seule). Mock de global.fetch, comme
// scripts/test-circuit-breaker.js — aucun appel réseau réel ici.

process.env.ALPACA_BROKER_CLIENT_ID = 'id-test';
process.env.ALPACA_BROKER_CLIENT_SECRET = 'secret-test';
process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.sandbox.alpaca.markets';
process.env.ALPACA_BROKER_AUTH_URL = 'https://authx.sandbox.alpaca.markets/v1/oauth2/token';
process.env.ALPACA_BROKER_REGION = 'us';
process.env.ALPACA_BROKER_ENV = 'sandbox';

const { corpsCompteTest } = require('../api/_alpaca/accounts.js');

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

  // --- 1) Forme du corps de test (champs obligatoires documentés) ---
  const corps = corpsCompteTest('185.13.21.99');
  rapporte('contact présent avec email/téléphone/adresse', Boolean(
    corps.contact && corps.contact.email_address && corps.contact.phone_number
    && Array.isArray(corps.contact.street_address) && corps.contact.city
  ));
  rapporte('identity présente avec les champs obligatoires', Boolean(
    corps.identity && corps.identity.given_name && corps.identity.family_name
    && corps.identity.date_of_birth && corps.identity.tax_id_type
    && corps.identity.country_of_tax_residence && Array.isArray(corps.identity.funding_source)
  ));
  rapporte('disclosures présentes avec les 4 booléens obligatoires', Boolean(
    corps.disclosures
    && typeof corps.disclosures.is_control_person === 'boolean'
    && typeof corps.disclosures.is_affiliated_exchange_or_finra === 'boolean'
    && typeof corps.disclosures.is_politically_exposed === 'boolean'
    && typeof corps.disclosures.immediate_family_exposed === 'boolean'
  ));
  rapporte('agreements : les 3 accords requis, chacun avec signed_at/ip_address',
    Array.isArray(corps.agreements) && corps.agreements.length === 3
    && corps.agreements.every(a => a.agreement && a.signed_at && a.ip_address === '185.13.21.99'));
  rapporte('aucun disclosure à true (jamais ACTION_REQUIRED par défaut sur des données de test)',
    !corps.disclosures.is_control_person && !corps.disclosures.is_affiliated_exchange_or_finra
    && !corps.disclosures.is_politically_exposed && !corps.disclosures.immediate_family_exposed);

  // --- 2) Propagation d'une erreur HTTP réelle (403, observé en Phase 3) ---
  delete require.cache[require.resolve('../api/_alpaca/client.js')];
  delete require.cache[require.resolve('../api/_alpaca/accounts.js')];
  const fetchOriginal = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('oauth2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'faux-token-test', expires_in: 900, token_type: 'Bearer' }) };
    }
    return { ok: false, status: 403, json: async () => ({ code: 40310000, message: 'request is forbidden' }) };
  };
  const { creerCompteSandbox } = require('../api/_alpaca/accounts.js');
  let erreurPropagee = null;
  try {
    await creerCompteSandbox('185.13.21.99');
  } catch (e) {
    erreurPropagee = e;
  }
  rapporte('un 403 réel est bien propagé comme erreur (jamais un faux succès)',
    erreurPropagee && erreurPropagee.status === 403);
  rapporte('le corps d\'erreur Alpaca est conservé pour diagnostic',
    erreurPropagee && erreurPropagee.body && erreurPropagee.body.code === 40310000);
  global.fetch = fetchOriginal;

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
