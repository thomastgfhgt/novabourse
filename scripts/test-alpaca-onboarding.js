// Vérification de la validation du formulaire d'ouverture réelle
// (api/_alpaca/accounts.js : taxIdFormatValide/validerDonneesCompte) —
// aucun appel réseau, uniquement les règles de format déjà observées
// réellement contre l'API Alpaca (zone 000/666 refusée, séquences
// croissantes refusées, voir le correctif du 2026-10-15).

process.env.ALPACA_BROKER_CLIENT_ID = 'id-test';
process.env.ALPACA_BROKER_CLIENT_SECRET = 'secret-test';
process.env.ALPACA_BROKER_BASE_URL = 'https://broker-api.sandbox.alpaca.markets';
process.env.ALPACA_BROKER_AUTH_URL = 'https://authx.sandbox.alpaca.markets/v1/oauth2/token';
process.env.ALPACA_BROKER_REGION = 'us';
process.env.ALPACA_BROKER_ENV = 'sandbox';

const { taxIdFormatValide, validerDonneesCompte } = require('../api/_alpaca/accounts.js');

(async () => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

  rapporte('zone 666 rejetée (réellement observé par Alpaca)', taxIdFormatValide('666-55-4321') === false);
  rapporte('zone 000 rejetée', taxIdFormatValide('000-55-4321') === false);
  rapporte('suite croissante rejetée (réellement observé par Alpaca)', taxIdFormatValide('123-45-6789') === false);
  rapporte('zone ITIN (900+) rejetée', taxIdFormatValide('912-34-5678') === false);
  rapporte('longueur incorrecte rejetée', taxIdFormatValide('123-45-678') === false);
  rapporte('valeur plausible non séquentielle acceptée', taxIdFormatValide('452-69-8317') === true);

  const complet = () => ({
    givenName: 'Marie', familyName: 'Curie', dateOfBirth: '1990-01-01',
    taxId: '452-69-8317', fundingSource: ['employment_income'],
    emailAddress: 'marie@exemple.com', phoneNumber: '+15556667788',
    streetAddress: '1 rue du Test', city: 'San Mateo', state: 'CA', postalCode: '94401',
    disclosures: { isControlPerson: false, isAffiliatedExchangeOrFinra: false, isPoliticallyExposed: false, immediateFamilyExposed: false },
    accordsAcceptes: true,
  });

  rapporte('formulaire complet et valide accepté', validerDonneesCompte(complet()).valide === true);
  rapporte('prénom manquant rejeté',
    validerDonneesCompte({ ...complet(), givenName: '' }).erreurs.includes('prenom_requis'));
  rapporte('mineur rejeté',
    validerDonneesCompte({ ...complet(), dateOfBirth: new Date().toISOString().slice(0, 10) }).erreurs.includes('age_minimum_18_ans'));
  rapporte('email invalide rejeté',
    validerDonneesCompte({ ...complet(), emailAddress: 'pas-un-email' }).erreurs.includes('email_invalide'));
  rapporte('état (state) manquant rejeté',
    validerDonneesCompte({ ...complet(), state: undefined }).erreurs.includes('etat_requis'));
  rapporte('code postal manquant rejeté (réellement observé, divergence avec la doc officielle)',
    validerDonneesCompte({ ...complet(), postalCode: undefined }).erreurs.includes('code_postal_requis'));
  rapporte('déclaration manquante (une des 4) rejetée',
    validerDonneesCompte({ ...complet(), disclosures: { isControlPerson: false } }).erreurs.some(e => e.startsWith('declaration_')));
  rapporte('accords non acceptés rejetés (jamais une création sans consentement explicite)',
    validerDonneesCompte({ ...complet(), accordsAcceptes: false }).erreurs.includes('accords_non_acceptes'));
  rapporte('source de revenus absente rejetée',
    validerDonneesCompte({ ...complet(), fundingSource: [] }).erreurs.includes('source_revenus_requise'));

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
