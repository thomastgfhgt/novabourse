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

module.exports = {
  creerCompteSandbox,
  recupererCompte,
  corpsCompteTest,
};
