// Verification du module Alpaca Europe (api/_alpaca/eu.js) -- fonctions
// pures uniquement (validation, corps de requete, reference de virement),
// aucun appel reseau ni identifiant requis. Verifie aussi que les appels
// reseau restent bloques par le verrou production quand VERCEL_ENV vaut
// 'production'.

const eu = require('../api/_alpaca/eu.js');

let allOk = true;
const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

const maintenant = new Date('2026-10-16T10:00:00Z');
const valide = {
  givenName: 'Camille', familyName: 'Martin', dateOfBirth: '1990-04-12',
  emailAddress: 'camille@example.com', phoneNumber: '+33612345678',
  streetAddress: '12 rue de la Paix', city: 'Paris', postalCode: '75002', country: 'FRA',
  countryOfCitizenship: 'FRA', taxId: '1 23 45 678 901 23',
  fundingSource: ['employment_income'], employmentStatus: 'employed',
  investmentObjective: 'growth', investmentTimeHorizon: '6_to_10_years',
  riskTolerance: 'moderate', experienceStocks: 'none',
  disclosures: { isControlPerson: false, isAffiliatedExchangeOrFinra: false, isPoliticallyExposed: false, immediateFamilyExposed: false },
  accordsAcceptes: true, w8benCertifie: true,
};

// --- 1) validation ---
rapporte('formulaire complet accepte', eu.validerDonneesCompteEU(valide, maintenant).valide === true);
const erreursDe = d => eu.validerDonneesCompteEU({ ...valide, ...d }, maintenant).erreurs;
rapporte('mineur refuse', erreursDe({ dateOfBirth: '2010-01-01' }).includes('age_minimum_18_ans'));
rapporte('pays hors liste refuse', erreursDe({ country: 'USA' }).includes('pays_non_pris_en_charge'));
rapporte('numero fiscal francais de 12 chiffres refuse', erreursDe({ taxId: '123456789012' }).includes('numero_fiscal_format_invalide'));
rapporte('numero fiscal commencant par 4 refuse', erreursDe({ taxId: '4234567890123' }).includes('numero_fiscal_format_invalide'));
rapporte('code postal a 4 chiffres refuse', erreursDe({ postalCode: '7500' }).includes('code_postal_invalide'));
rapporte('W-8BEN non certifie refuse', erreursDe({ w8benCertifie: false }).includes('w8ben_non_certifie'));
rapporte('accords non acceptes refuses', erreursDe({ accordsAcceptes: false }).includes('accords_non_acceptes'));
rapporte('profil investisseur obligatoire', erreursDe({ riskTolerance: undefined }).includes('tolerance_risque_requise'));
rapporte('declaration manquante refusee', erreursDe({ disclosures: { isControlPerson: false } }).includes('declaration_isPoliticallyExposed_requise'));

// --- 2) corps de requete ---
const corps = eu.corpsCompteEU(valide, '203.0.113.7', maintenant);
rapporte('devise EUR', corps.currency === 'EUR');
rapporte('type identifiant fiscal FRA_SPI', corps.identity.tax_id_type === 'FRA_SPI');
rapporte('numero fiscal sans espaces', corps.identity.tax_id === '1234567890123');
rapporte('residence fiscale FRA', corps.identity.country_of_tax_residence === 'FRA' && corps.contact.country === 'FRA');
rapporte('jamais de margin_agreement', !corps.agreements.some(a => a.agreement === 'margin_agreement'));
rapporte('accords horodates et IP reelle', corps.agreements.every(a => a.signed_at === maintenant.toISOString() && a.ip_address === '203.0.113.7'));
const w8 = corps.documents[0];
rapporte('W-8BEN joint en JSON', w8.document_type === 'w8ben' && w8.mime_type === 'application/json');
const champsW8 = ['country_citizen', 'date', 'date_of_birth', 'full_name', 'ip_address', 'permanent_address_city_state',
  'permanent_address_country', 'permanent_address_street', 'revision', 'timestamp', 'signer_full_name'];
rapporte('W-8BEN : tous les champs obligatoires presents', champsW8.every(c => w8.content_data[c]));
rapporte('profil investisseur au niveau racine', corps.investment_objective === 'growth' && corps.risk_tolerance === 'moderate');
rapporte('secteur emploi retraite -> self_employed', eu.corpsCompteEU({ ...valide, employmentStatus: 'retired' }, '1.1.1.1', maintenant).disclosures.employment_sector === 'self_employed');

// --- 3) virement ---
rapporte('reference "<correspondant>-<compte>"', eu.referenceVirement('abcd', '987654321') === 'ABCD-987654321');
let leve = false; try { eu.referenceVirement('ABC', '987654321'); } catch { leve = true; }
rapporte('correspondant de 3 caracteres refuse', leve);
const vs = eu.corpsVirementSimule('ABCD', '987654321', 250);
rapporte('virement simule : EUR, montant en chaine, FFC', vs.currency === 'EUR' && vs.amount === '250.00' && vs.wire_instructions === 'FFC ABCD-987654321');
leve = false; try { eu.corpsVirementSimule('ABCD', '987654321', 0); } catch { leve = true; }
rapporte('montant nul refuse', leve);
const sansIban = eu.instructionsDepot('ABCD', '987654321', {});
rapporte('sans IBAN configure : indisponible, jamais un IBAN invente', sansIban.disponible === false && sansIban.iban === null);
const avecIban = eu.instructionsDepot('ABCD', '987654321', { ALPACA_EU_OMNIBUS_IBAN: 'ES91 2100 0418 4502 0005 1332' });
rapporte('avec IBAN configure : IBAN sans espaces + reference', avecIban.disponible && avecIban.iban === 'ES9121000418450200051332' && avecIban.reference === 'ABCD-987654321');

// --- 4) verrou production ---
(async () => {
  process.env.VERCEL_ENV = 'production';
  let bloque = false;
  try { await eu.simulerVirementEntrantEU('ABCD', '987654321', 10); } catch (e) { bloque = e.code === 'PRODUCTION_LOCKED'; }
  rapporte('production : virement simule bloque par le verrou', bloque);
  bloque = false;
  try { await eu.creerCompteEU(valide, '1.1.1.1'); } catch (e) { bloque = e.code === 'PRODUCTION_LOCKED'; }
  rapporte('production : ouverture de compte bloquee par le verrou', bloque);

  // --- 5) endpoints de production : declares mais inatteignables ---
  const client = require('../api/_alpaca/client.js');
  Object.assign(process.env, {
    ALPACA_BROKER_ENV: 'production', ALPACA_BROKER_REGION: 'eu',
    ALPACA_BROKER_BASE_URL: 'https://broker-api.eu.alpaca.markets',
    ALPACA_BROKER_AUTH_URL: 'https://authx.eu.alpaca.markets/v1/oauth2/token',
  });
  const refuse = (nom, envVercel) => {
    process.env.VERCEL_ENV = envVercel;
    let msg = null; try { client.validerConfiguration(); } catch (e) { msg = e.message; }
    rapporte(nom, msg === 'alpaca_production_verrouillee');
  };
  rapporte('verrou du code toujours a false', client.TRADING_ALLOWED_IN_PRODUCTION === false);
  refuse('ENV=production refuse sur un deploiement Production', 'production');
  refuse('ENV=production refuse sur une Preview', 'preview');
  process.env.ALPACA_BROKER_ENV = 'sandbox';
  process.env.VERCEL_ENV = 'preview';
  let msg = null; try { client.validerConfiguration(); } catch (e) { msg = e.message; }
  rapporte('Sandbox : URL de production refusee (liste fermee)', msg === 'alpaca_base_url_non_autorisee');

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
