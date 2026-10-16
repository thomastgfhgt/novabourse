/**
 * api/_alpaca/eu.js — Alpaca Europe (Broker API EU) : ouverture de compte
 * d'un résident français et financement par virement EUR.
 *
 * Préparation "passage au trading réel" (2026-10-16). Fonctions pures
 * (validation, construction des corps de requête) séparées des appels
 * réseau, pour être testées sans identifiants (scripts/test-alpaca-eu.js).
 *
 * Sources (documentation officielle EU, consultée le 2026-10-16) :
 *   - Create an Account : https://docs.alpaca.markets/eu/reference/createaccount
 *     (exemple "germany_eur" : currency EUR, account_agreement +
 *     customer_agreement, tax_id_type par pays — FRA_SPI pour la France)
 *   - Funding Accounts : https://docs.alpaca.markets/eu/docs/funding-accounts
 *     (EUR uniquement, virement vers l'IBAN Omnibus d'Alpaca, référence
 *     "<Correspondent ID>-<Account Number>")
 *   - Incoming wire (Sandbox) : https://docs.alpaca.markets/eu/reference/createincomingwire
 *     (wire_instructions "FFC <correspondant>-<numéro de compte>")
 *
 * Jamais testé contre le vrai Sandbox EU à ce jour : aucun identifiant EU
 * disponible. Le jour où ils existent, un vrai appel tranche — comme pour
 * le code postal US (voir accounts.js), le réel l'emporte sur la doc.
 *
 * Préfixe "_" : jamais exposé comme route Vercel.
 */

'use strict';

const { appelBroker, verifierVerrouProduction } = require('./client.js');

/* Pays de résidence fiscale pris en charge — France uniquement pour
   l'instant (marché visé). Ajouter un pays = ajouter son type d'identifiant
   fiscal Alpaca ET sa règle de format, jamais un pays sans les deux. */
const PAYS_PRIS_EN_CHARGE = Object.freeze({
  FRA: Object.freeze({
    taxIdType: 'FRA_SPI',
    /* Numéro fiscal de référence français (SPI) : 13 chiffres, le premier
       entre 0 et 3 (format publié par la DGFiP). Contrôle de forme
       uniquement — l'authenticité relève du KYC. */
    taxIdValide: v => /^[0-3]\d{12}$/.test(String(v || '').replace(/\s/g, '')),
    codePostalValide: v => /^\d{5}$/.test(String(v || '').trim()),
  }),
});

const FUNDING_SOURCES = Object.freeze(['employment_income', 'investments', 'inheritance', 'business_income', 'savings', 'family']);
const EMPLOYMENT_STATUS = Object.freeze(['unemployed', 'employed', 'student', 'retired']);
const INVESTMENT_OBJECTIVES = Object.freeze(['generate_income', 'preserve_wealth', 'market_speculation', 'growth', 'balance_preserve_wealth_with_growth']);
const TIME_HORIZONS = Object.freeze(['less_than_1_year', '1_to_2_years', '3_to_5_years', '6_to_10_years', 'more_than_10_years']);
const RISK_TOLERANCES = Object.freeze(['conservative', 'moderate', 'significant_risk']);
const EXPERIENCE = Object.freeze(['none', '1_to_5_years', 'over_5_years']);

/* Révision du formulaire W-8BEN (IRS, octobre 2021). Sans W-8BEN valide,
   Alpaca applique la retenue américaine par défaut de 30 % sur les
   dividendes — le traité franco-américain la ramène à 15 %. */
const W8BEN_REVISION = '10-2021';

function ageEnAnnees(dateIso, maintenant) {
  return (maintenant.getTime() - new Date(dateIso + 'T00:00:00Z').getTime()) / (365.25 * 86400000);
}

function validerDonneesCompteEU(d, maintenant = new Date()) {
  const erreurs = [];
  const p = d || {};
  const pays = PAYS_PRIS_EN_CHARGE[p.country];

  if (!p.givenName) erreurs.push('prenom_requis');
  if (!p.familyName) erreurs.push('nom_requis');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth || '')) erreurs.push('date_naissance_invalide');
  else if (ageEnAnnees(p.dateOfBirth, maintenant) < 18) erreurs.push('age_minimum_18_ans');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.emailAddress || '')) erreurs.push('email_invalide');
  if (!/^\+\d{8,15}$/.test(p.phoneNumber || '')) erreurs.push('telephone_invalide');
  if (!p.streetAddress) erreurs.push('adresse_requise');
  if (!p.city) erreurs.push('ville_requise');

  if (!pays) {
    erreurs.push('pays_non_pris_en_charge');
  } else {
    if (!pays.codePostalValide(p.postalCode)) erreurs.push('code_postal_invalide');
    if (!pays.taxIdValide(p.taxId)) erreurs.push('numero_fiscal_format_invalide');
  }
  if (!/^[A-Z]{3}$/.test(p.countryOfCitizenship || '')) erreurs.push('nationalite_requise');

  if (!Array.isArray(p.fundingSource) || !p.fundingSource.length
    || !p.fundingSource.every(f => FUNDING_SOURCES.includes(f))) erreurs.push('source_revenus_requise');
  if (!EMPLOYMENT_STATUS.includes(p.employmentStatus)) erreurs.push('situation_professionnelle_requise');

  /* Profil investisseur — conservé chez Alpaca (champs officiels du
     compte). Sert de trace du test d'adéquation (MiFID II) ; sa forme
     exacte reste à valider avec le conseil juridique (voir le dossier). */
  if (!INVESTMENT_OBJECTIVES.includes(p.investmentObjective)) erreurs.push('objectif_requis');
  if (!TIME_HORIZONS.includes(p.investmentTimeHorizon)) erreurs.push('horizon_requis');
  if (!RISK_TOLERANCES.includes(p.riskTolerance)) erreurs.push('tolerance_risque_requise');
  if (!EXPERIENCE.includes(p.experienceStocks)) erreurs.push('experience_actions_requise');

  for (const champ of ['isControlPerson', 'isAffiliatedExchangeOrFinra', 'isPoliticallyExposed', 'immediateFamilyExposed']) {
    if (typeof p.disclosures?.[champ] !== 'boolean') erreurs.push('declaration_' + champ + '_requise');
  }

  if (p.accordsAcceptes !== true) erreurs.push('accords_non_acceptes');
  if (p.w8benCertifie !== true) erreurs.push('w8ben_non_certifie');

  return { valide: erreurs.length === 0, erreurs };
}

/* Secteur d'emploi : règle officielle Alpaca — chômeur/étudiant →
   not_employed, retraité → self_employed. Pour un salarié, "other" faute
   de question plus précise dans le formulaire. */
function secteurEmploi(status) {
  if (status === 'unemployed' || status === 'student') return 'not_employed';
  if (status === 'retired') return 'self_employed';
  return 'other';
}

function corpsCompteEU(d, ipAddress, maintenant = new Date()) {
  const pays = PAYS_PRIS_EN_CHARGE[d.country];
  const signe = maintenant.toISOString();
  const nomComplet = `${d.givenName} ${d.familyName}`;
  return {
    account_type: 'trading',
    currency: 'EUR',
    enabled_assets: ['us_equity'],
    contact: {
      email_address: d.emailAddress,
      phone_number: d.phoneNumber,
      street_address: [d.streetAddress],
      city: d.city,
      postal_code: String(d.postalCode).trim(),
      country: d.country,
    },
    identity: {
      given_name: d.givenName,
      family_name: d.familyName,
      date_of_birth: d.dateOfBirth,
      tax_id: String(d.taxId).replace(/\s/g, ''),
      tax_id_type: pays.taxIdType,
      country_of_citizenship: d.countryOfCitizenship,
      country_of_tax_residence: d.country,
      funding_source: d.fundingSource,
      investment_experience_with_stocks: d.experienceStocks,
    },
    investment_objective: d.investmentObjective,
    investment_time_horizon: d.investmentTimeHorizon,
    risk_tolerance: d.riskTolerance,
    disclosures: {
      is_control_person: d.disclosures.isControlPerson,
      is_affiliated_exchange_or_finra: d.disclosures.isAffiliatedExchangeOrFinra,
      is_politically_exposed: d.disclosures.isPoliticallyExposed,
      immediate_family_exposed: d.disclosures.immediateFamilyExposed,
      employment_status: d.employmentStatus,
      employment_sector: secteurEmploi(d.employmentStatus),
    },
    /* Compte au comptant uniquement : jamais de margin_agreement (pas
       d'effet de levier pour un particulier débutant). */
    agreements: ['account_agreement', 'customer_agreement'].map(agreement => ({
      agreement, signed_at: signe, ip_address: ipAddress,
    })),
    documents: [{
      document_type: 'w8ben',
      mime_type: 'application/json',
      content_data: {
        full_name: nomComplet,
        signer_full_name: nomComplet,
        date_of_birth: d.dateOfBirth,
        country_citizen: d.countryOfCitizenship,
        permanent_address_street: d.streetAddress,
        permanent_address_city_state: `${String(d.postalCode).trim()} ${d.city}`,
        permanent_address_country: d.country,
        foreign_tax_id: String(d.taxId).replace(/\s/g, ''),
        date: signe.slice(0, 10),
        timestamp: signe,
        ip_address: ipAddress,
        revision: W8BEN_REVISION,
      },
    }],
  };
}

/* Référence de virement — EXACTEMENT "<Correspondent ID>-<Account
   Number>" (doc Funding Accounts). Une référence fausse = des fonds non
   crédités, donc refus strict plutôt qu'une référence approximative. */
function referenceVirement(correspondant, accountNumber) {
  const c = String(correspondant || '').trim().toUpperCase();
  const n = String(accountNumber || '').trim();
  if (!/^[A-Z0-9]{4}$/.test(c)) throw new Error('alpaca_correspondant_invalide');
  if (!/^[A-Z0-9]{6,20}$/i.test(n)) throw new Error('alpaca_numero_compte_invalide');
  return `${c}-${n}`;
}

/* Instructions affichées au client pour approvisionner son compte. L'IBAN
   Omnibus n'est connu qu'une fois le partenariat signé : null tant que la
   variable n'existe pas — jamais un IBAN inventé ou "d'exemple". */
function instructionsDepot(correspondant, accountNumber, env = process.env) {
  const iban = String(env.ALPACA_EU_OMNIBUS_IBAN || '').replace(/\s/g, '') || null;
  const bic = String(env.ALPACA_EU_OMNIBUS_BIC || '').trim() || null;
  return {
    devise: 'EUR',
    beneficiaire: env.ALPACA_EU_OMNIBUS_BENEFICIAIRE || null,
    iban,
    bic,
    reference: referenceVirement(correspondant, accountNumber),
    disponible: Boolean(iban),
  };
}

function corpsVirementSimule(correspondant, accountNumber, montant) {
  const m = Number(montant);
  if (!(m > 0) || m > 1000000) throw new Error('montant_invalide');
  return {
    currency: 'EUR',
    amount: m.toFixed(2),
    wire_instructions: `FFC ${referenceVirement(correspondant, accountNumber)}`,
    delay_until: null,
  };
}

async function creerCompteEU(donnees, ipAddress) {
  verifierVerrouProduction();
  const { valide, erreurs } = validerDonneesCompteEU(donnees);
  if (!valide) {
    const err = new Error('alpaca_formulaire_invalide');
    err.erreurs = erreurs;
    throw err;
  }
  const r = await appelBroker('/v1/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpsCompteEU(donnees, ipAddress)),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_creation_compte_echouee');
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

/* Sandbox uniquement : cet endpoint n'existe pas en production (doc
   createincomingwire), et le verrou production bloque de toute façon. */
async function simulerVirementEntrantEU(correspondant, accountNumber, montant) {
  verifierVerrouProduction();
  const r = await appelBroker('/v1/testing/incoming_wires', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpsVirementSimule(correspondant, accountNumber, montant)),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_virement_simule_echoue');
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

module.exports = {
  PAYS_PRIS_EN_CHARGE,
  FUNDING_SOURCES,
  EMPLOYMENT_STATUS,
  INVESTMENT_OBJECTIVES,
  TIME_HORIZONS,
  RISK_TOLERANCES,
  EXPERIENCE,
  W8BEN_REVISION,
  validerDonneesCompteEU,
  corpsCompteEU,
  referenceVirement,
  instructionsDepot,
  corpsVirementSimule,
  creerCompteEU,
  simulerVirementEntrantEU,
};
