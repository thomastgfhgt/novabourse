/**
 * api/_alpaca/accounts.js — Comptes clients Alpaca Broker API Sandbox.
 *
 * Préfixe "_" : jamais exposé comme route Vercel (voir api/_alpaca/client.js).
 *
 * Données de test : UNIQUEMENT l'exemple officiellement documenté par
 * Alpaca pour POST /v1/accounts (identité "John Doe" / SSN 666-55-4321 —
 * préfixe 666 réservé, invalide pour un vrai SSN, utilisé par convention
 * dans toute documentation technique). Jamais une donnée personnelle
 * réelle, jamais un utilisateur NovaTitre réel tant que le parcours de
 * saisie n'existe pas (Phase 3, étape suivante).
 */

'use strict';

const { appelBroker, verifierVerrouProduction } = require('./client.js');

/* Accords présentés/acceptés — signed_at posé à l'appel, jamais une date
   fixe en dur (refléterait un faux horodatage de consentement). */
function accordsSandbox(ipAddress) {
  const maintenant = new Date().toISOString();
  return ['account_agreement', 'customer_agreement', 'margin_agreement'].map(agreement => ({
    agreement,
    signed_at: maintenant,
    ip_address: ipAddress,
  }));
}

/* Corps de test — EXACTEMENT l'exemple de la documentation officielle
   Alpaca (reference "Create an Account"), jamais inventé ni modifié au-delà
   de l'IP et de la date de signature (voir accordsSandbox). */
function corpsCompteTest(ipAddress) {
  return {
    account_type: 'trading',
    contact: {
      email_address: 'john.doe@example.com',
      phone_number: '+15556667788',
      street_address: ['20 N San Mateo Dr'],
      unit: '4B',
      city: 'San Mateo',
      state: 'CA',
      country: 'USA',
      postal_code: '94401',
    },
    identity: {
      given_name: 'John',
      middle_name: 'P',
      family_name: 'Doe',
      date_of_birth: '1990-01-01',
      // CORRECTIF (2026-10-15, testé réellement) : "666-55-4321" — pourtant
      // l'exemple de la doc officielle Alpaca — est rejeté par la validation
      // réelle (HTTP 422, "tax_id cannot have area 000 or 666 for SSN/ITIN").
      // CORRECTIF 2 (même jour) : "123-45-6789" also rejeté, réellement
      // cette fois pour une raison différente ("cannot be just increasing
      // values") — la validation Alpaca Sandbox est visiblement plus
      // stricte que le format attendu. Valeur non séquentielle, zone hors
      // 000/666/900-999, sans lien avec un numéro réel historique connu.
      tax_id: '452-69-8317',
      tax_id_type: 'USA_SSN',
      country_of_citizenship: 'USA',
      country_of_birth: 'USA',
      country_of_tax_residence: 'USA',
      funding_source: ['employment_income'],
    },
    disclosures: {
      is_control_person: false,
      is_affiliated_exchange_or_finra: false,
      is_politically_exposed: false,
      immediate_family_exposed: false,
    },
    agreements: accordsSandbox(ipAddress),
    enabled_assets: ['us_equity'],
  };
}

/* Crée un compte client Sandbox — action d'ÉCRITURE réelle (bien que sans
   risque : Sandbox uniquement). À appeler UNE fois par utilisateur
   NovaTitre (§4 : "au plus un compte Alpaca Sandbox, uniquement au sien").
   `ipAddress` doit être l'IP réelle de la requête qui a déclenché l'action
   (jamais une valeur inventée) — voir l'appelant pour sa provenance. */
async function creerCompteSandbox(ipAddress) {
  verifierVerrouProduction();
  const r = await appelBroker('/v1/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpsCompteTest(ipAddress)),
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

async function recupererCompte(alpacaAccountId) {
  const r = await appelBroker(`/v1/accounts/${encodeURIComponent(alpacaAccountId)}`);
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_lecture_compte_echouee');
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

/* Lecture de l'état de trading réel (buying_power, cash, equity...) — le
   compte seul (recupererCompte) ne porte PAS ces champs : confirmé par
   appel réel, ils vivent sur /v1/trading/accounts/{id}/account. Sert à
   vérifier qu'un dépôt a RÉELLEMENT changé le pouvoir d'achat, jamais une
   valeur supposée. */
async function lireCompteTrading(alpacaAccountId) {
  const r = await appelBroker(`/v1/trading/accounts/${encodeURIComponent(alpacaAccountId)}/account`);
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_lecture_compte_trading_echouee');
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

/* ---------- Ouverture réelle (§4 : "parcours d'ouverture avec suivi
   d'étapes") — données saisies par un vrai utilisateur NovaTitre, jamais
   plus une identité de test fixe. Validation PURE (aucun réseau) avant
   tout appel, pour un retour immédiat et clair côté formulaire — mais
   Alpaca reste l'autorité finale (une validation client qui passe ici
   peut encore être rejetée par Alpaca pour une raison non anticipée,
   jamais présentée comme un échec de notre code). */
const FUNDING_SOURCES_AUTORISEES = Object.freeze([
  'employment_income', 'investments', 'inheritance', 'business_income', 'savings', 'family',
]);

/* Règles de format RÉELLEMENT observées (2026-10-15, voir le correctif
   ci-dessus sur corpsCompteTest) — pas une supposition : zone 000/666
   refusée, valeurs strictement croissantes refusées. Alpaca peut encore
   refuser pour d'autres raisons non couvertes ici ; ce n'est qu'un
   filtre de confort, jamais une garantie d'acceptation. */
function taxIdFormatValide(taxId) {
  const chiffres = String(taxId || '').replace(/\D/g, '');
  if (chiffres.length !== 9) return false;
  const zone = chiffres.slice(0, 3);
  if (zone === '000' || zone === '666' || Number(zone) >= 900) return false;
  if (/^(?:0123456789|123456789|012345678)/.test(chiffres)) return false;
  const croissant = chiffres.split('').every((c, i) => i === 0 || Number(c) === Number(chiffres[i - 1]) + 1);
  if (croissant) return false;
  return true;
}

function validerDonneesCompte(d) {
  const erreurs = [];
  const p = d || {};

  if (!p.givenName) erreurs.push('prenom_requis');
  if (!p.familyName) erreurs.push('nom_requis');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dateOfBirth || '')) erreurs.push('date_naissance_invalide');
  else {
    const age = (Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 86400000);
    if (age < 18) erreurs.push('age_minimum_18_ans');
  }
  if (!taxIdFormatValide(p.taxId)) erreurs.push('numero_fiscal_format_invalide');
  if (!Array.isArray(p.fundingSource) || !p.fundingSource.length
    || !p.fundingSource.every(f => FUNDING_SOURCES_AUTORISEES.includes(f))) erreurs.push('source_revenus_requise');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.emailAddress || '')) erreurs.push('email_invalide');
  if (!/^\+\d{8,15}$/.test(p.phoneNumber || '')) erreurs.push('telephone_invalide');
  if (!p.streetAddress) erreurs.push('adresse_requise');
  if (!p.city) erreurs.push('ville_requise');
  // Pays TOUJOURS "USA" (voir corpsCompteDepuisFormulaire : le Broker API
  // Sandbox utilisé ici est la région US, tax_id_type fixé à USA_SSN —
  // aucun sélecteur de pays, pour ne jamais produire une combinaison
  // incohérente ex. "résidence fiscale France" + "SSN américain"). `state`
  // donc toujours requis (règle Alpaca : obligatoire si le pays OU la
  // résidence fiscale vaut USA — ici toujours les deux).
  if (!p.state) erreurs.push('etat_requis');

  for (const champ of ['isControlPerson', 'isAffiliatedExchangeOrFinra', 'isPoliticallyExposed', 'immediateFamilyExposed']) {
    if (typeof p.disclosures?.[champ] !== 'boolean') erreurs.push('declaration_' + champ + '_requise');
  }

  if (p.accordsAcceptes !== true) erreurs.push('accords_non_acceptes');

  return { valide: erreurs.length === 0, erreurs };
}

function corpsCompteDepuisFormulaire(d, ipAddress) {
  return {
    account_type: 'trading',
    contact: {
      email_address: d.emailAddress,
      phone_number: d.phoneNumber,
      street_address: [d.streetAddress],
      city: d.city,
      state: d.state,
      ...(d.postalCode ? { postal_code: d.postalCode } : {}),
      country: 'USA',
    },
    identity: {
      given_name: d.givenName,
      family_name: d.familyName,
      date_of_birth: d.dateOfBirth,
      tax_id: d.taxId,
      tax_id_type: 'USA_SSN',
      country_of_citizenship: 'USA',
      country_of_birth: 'USA',
      country_of_tax_residence: 'USA',
      funding_source: d.fundingSource,
    },
    disclosures: {
      is_control_person: d.disclosures.isControlPerson,
      is_affiliated_exchange_or_finra: d.disclosures.isAffiliatedExchangeOrFinra,
      is_politically_exposed: d.disclosures.isPoliticallyExposed,
      immediate_family_exposed: d.disclosures.immediateFamilyExposed,
    },
    agreements: accordsSandbox(ipAddress),
    enabled_assets: ['us_equity'],
  };
}

/* Ouverture réelle — valide d'abord (retour immédiat si incomplet),
   n'appelle Alpaca QUE si la validation locale passe. */
async function creerCompteDepuisFormulaire(donnees, ipAddress) {
  verifierVerrouProduction();
  const { valide, erreurs } = validerDonneesCompte(donnees);
  if (!valide) {
    const err = new Error('alpaca_formulaire_invalide');
    err.erreurs = erreurs;
    throw err;
  }
  const r = await appelBroker('/v1/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpsCompteDepuisFormulaire(donnees, ipAddress)),
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

module.exports = {
  creerCompteSandbox,
  recupererCompte,
  lireCompteTrading,
  corpsCompteTest,
  FUNDING_SOURCES_AUTORISEES,
  taxIdFormatValide,
  validerDonneesCompte,
  creerCompteDepuisFormulaire,
};
