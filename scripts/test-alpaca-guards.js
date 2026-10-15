// Vérification des garde-fous Alpaca (api/_alpaca/client.js), §2bis/§10 de
// la mission "Alpaca Sandbox Trading" : liste fermée de domaines, blocage
// des redirections, verrou production, interrupteur général, liste admin.
// Aucun appel réseau réel ici (sauf le test de redirection, qui mock
// global.fetch comme scripts/test-circuit-breaker.js) — ne nécessite donc
// pas les vraies clés Alpaca pour tourner.

const ENV_SAUVE = { ...process.env };
function reinitialiserEnv() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('ALPACA_') || k === 'TRADING_ENABLED' || k === 'TRADING_ADMIN_EMAILS' || k === 'VERCEL_ENV') {
      delete process.env[k];
    }
  }
  Object.assign(process.env, ENV_SAUVE);
}

function configurerSandboxUSValide() {
  process.env.ALPACA_BROKER_CLIENT_ID = 'id-test';
  process.env.ALPACA_BROKER_CLIENT_SECRET = 'secret-test';
  process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.sandbox.alpaca.markets';
  process.env.ALPACA_BROKER_AUTH_URL = 'https://authx.sandbox.alpaca.markets/v1/oauth2/token';
  process.env.ALPACA_BROKER_REGION = 'us';
  process.env.ALPACA_BROKER_ENV = 'sandbox';
}

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };
  const leveUneErreur = (fn) => { try { fn(); return false; } catch { return true; } };

  delete require.cache[require.resolve('../api/_alpaca/client.js')];
  const client = require('../api/_alpaca/client.js');

  // --- 1) Configuration Sandbox US valide : acceptée ---
  configurerSandboxUSValide();
  rapporte('config Sandbox US valide acceptée (validerConfiguration ne lève pas)',
    !leveUneErreur(() => client.validerConfiguration()));

  // --- 2) URL de production rejetée (même chemin que la sandbox) ---
  configurerSandboxUSValide();
  process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.alpaca.markets';
  rapporte('URL de PRODUCTION rejetée',
    leveUneErreur(() => client.validerConfiguration()));

  // --- 3) Domaine voisin (lookalike) rejeté ---
  configurerSandboxUSValide();
  process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.sandbox.alpaca.markets.exemple.com';
  rapporte('domaine voisin ("...markets.exemple.com") rejeté',
    leveUneErreur(() => client.validerConfiguration()));

  // --- 4) http:// (non-https) rejeté ---
  configurerSandboxUSValide();
  process.env.ALPACA_BROKER_BASE_URL = 'http://broker-api.sandbox.alpaca.markets';
  rapporte('http:// (non chiffré) rejeté',
    leveUneErreur(() => client.validerConfiguration()));

  // --- 5) Port personnalisé rejeté ---
  configurerSandboxUSValide();
  process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.sandbox.alpaca.markets:8443';
  rapporte('port personnalisé rejeté',
    leveUneErreur(() => client.validerConfiguration()));

  // --- 6) Mélange région US / domaine EU rejeté ---
  configurerSandboxUSValide();
  process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.sandbox.eu.alpaca.markets';
  rapporte('domaine EU avec ALPACA_BROKER_REGION=us rejeté (une région = un seul couple)',
    leveUneErreur(() => client.validerConfiguration()));

  // --- 7) ALPACA_BROKER_ENV différent de 'sandbox' rejeté ---
  configurerSandboxUSValide();
  process.env.ALPACA_BROKER_ENV = 'live';
  rapporte("ALPACA_BROKER_ENV='live' rejeté (aucun chemin vers la prod Alpaca)",
    leveUneErreur(() => client.validerConfiguration()));

  // --- 8) Verrou production : actif en VERCEL_ENV=production ---
  configurerSandboxUSValide();
  process.env.VERCEL_ENV = 'production';
  rapporte('verrouProductionActif() = true quand VERCEL_ENV=production',
    client.verrouProductionActif() === true);
  rapporte('verifierVerrouProduction() lève bien en production',
    leveUneErreur(() => client.verifierVerrouProduction()));
  rapporte('TRADING_ALLOWED_IN_PRODUCTION est bien false (constante code)',
    client.TRADING_ALLOWED_IN_PRODUCTION === false);

  // --- 9) Verrou production : inactif hors production ---
  configurerSandboxUSValide();
  process.env.VERCEL_ENV = 'preview';
  rapporte('verrouProductionActif() = false hors production',
    client.verrouProductionActif() === false);
  rapporte('verifierVerrouProduction() ne lève pas hors production',
    !leveUneErreur(() => client.verifierVerrouProduction()));

  // --- 10) TRADING_ENABLED=true en production : le verrou reste prioritaire ---
  // (vérifié indirectement : verifierVerrouProduction() ne regarde jamais
  // TRADING_ENABLED, donc aucune valeur de ce flag ne peut le contourner.)
  configurerSandboxUSValide();
  process.env.VERCEL_ENV = 'production';
  process.env.TRADING_ENABLED = 'true';
  rapporte('TRADING_ENABLED=true en production ne contourne PAS le verrou',
    leveUneErreur(() => client.verifierVerrouProduction()));

  // --- 11) Interrupteur général (tradingActif) ---
  reinitialiserEnv();
  rapporte('tradingActif() = false par défaut (variable absente)',
    client.tradingActif() === false);
  process.env.TRADING_ENABLED = 'false';
  rapporte("tradingActif() = false si TRADING_ENABLED='false'",
    client.tradingActif() === false);
  process.env.TRADING_ENABLED = 'true';
  rapporte("tradingActif() = true si TRADING_ENABLED='true'",
    client.tradingActif() === true);

  // --- 12) Liste admin ---
  reinitialiserEnv();
  process.env.TRADING_ADMIN_EMAILS = 'Admin@Exemple.com, autre@exemple.com';
  rapporte('e-mail admin reconnu (comparaison insensible à la casse)',
    client.estAdmin('admin@exemple.com') === true);
  rapporte('e-mail admin reconnu avec espaces/majuscules d\'origine',
    client.estAdmin('AUTRE@exemple.com') === true);
  rapporte('e-mail non listé refusé',
    client.estAdmin('inconnu@exemple.com') === false);
  rapporte('e-mail partiel ne matche jamais par sous-chaîne',
    client.estAdmin('exemple.com') === false);
  rapporte('aucun e-mail -> false',
    client.estAdmin(null) === false);
  rapporte('liste vide -> toujours false',
    (() => { delete process.env.TRADING_ADMIN_EMAILS; return client.estAdmin('admin@exemple.com') === false; })());

  // --- 13) hoteEtCheminAutorises : cas limites directs (sans passer par l'env) ---
  rapporte('URL invalide (non parseable) rejetée',
    client.hoteEtCheminAutorises('pas-une-url', 'https://broker-api.sandbox.alpaca.markets') === false);
  rapporte('chemin différent sur une URL à chemin fixe (auth) rejeté',
    client.hoteEtCheminAutorises(
      'https://authx.sandbox.alpaca.markets/v1/autre-chemin',
      'https://authx.sandbox.alpaca.markets/v1/oauth2/token'
    ) === false);

  // --- 14) Redirection bloquée (mock réseau, comme test-circuit-breaker.js) ---
  reinitialiserEnv();
  configurerSandboxUSValide();
  const fetchOriginal = global.fetch;
  global.fetch = async () => ({ ok: false, status: 302, headers: new Map() });
  let aLeveRedirection = false;
  try {
    await client.fetchSansRedirection('https://broker-api.sandbox.alpaca.markets/v1/assets');
  } catch (e) {
    aLeveRedirection = (e.code === 'REDIRECT_BLOCKED');
  }
  rapporte('une réponse 3xx est traitée comme une erreur, jamais suivie', aLeveRedirection);
  global.fetch = fetchOriginal;

  reinitialiserEnv();
  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
