/**
 * api/_alpaca/funding.js — Financement Sandbox (dépôts/retraits simulés),
 * Phase 5 de la mission "Alpaca Sandbox Trading".
 *
 * §5.3 : "Utiliser uniquement le mécanisme de financement Sandbox
 * officiellement documenté et autorisé." Mécanisme confirmé par la
 * documentation officielle (reference createachrelationshipforaccount /
 * createtransferforaccount) : une relation ACH doit exister (statut
 * APPROVED) avant qu'un transfert ACH entrant (dépôt simulé) ne soit
 * accepté. Aucun lien avec Stripe ni un compte bancaire réel — §5.3.
 *
 * Préfixe "_" : jamais exposé comme route Vercel.
 */

'use strict';

const { appelBroker, verifierVerrouProduction } = require('./client.js');

const TYPES_COMPTE_BANCAIRE = Object.freeze(['CHECKING', 'SAVINGS']);

/* Crée une relation ACH — prérequis documenté avant tout dépôt simulé.
   En Sandbox, aucune vraie banque n'est contactée ; le format doit
   simplement être valide (voir docs officielles). */
async function creerRelationACH(brokerAccountId, params) {
  verifierVerrouProduction();
  const p = params || {};
  if (!p.accountOwnerName) throw new Error('alpaca_ach_nom_requis');
  if (!TYPES_COMPTE_BANCAIRE.includes(p.bankAccountType)) throw new Error('alpaca_ach_type_compte_invalide');
  if (!p.bankAccountNumber) throw new Error('alpaca_ach_numero_compte_requis');
  if (!p.bankRoutingNumber) throw new Error('alpaca_ach_numero_routage_requis');

  const r = await appelBroker(`/v1/accounts/${encodeURIComponent(brokerAccountId)}/ach_relationships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_owner_name: p.accountOwnerName,
      bank_account_type: p.bankAccountType,
      bank_account_number: p.bankAccountNumber,
      bank_routing_number: p.bankRoutingNumber,
    }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_ach_relation_echouee');
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function listerRelationsACH(brokerAccountId) {
  const r = await appelBroker(`/v1/accounts/${encodeURIComponent(brokerAccountId)}/ach_relationships`);
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_ach_liste_echouee');
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

/* Dépôt simulé (direction INCOMING uniquement — §5.3 ne couvre que
   "dépôts/retraits simulés", jamais un virement sortant réel). */
async function creerDepotSimule(brokerAccountId, relationshipId, montant) {
  verifierVerrouProduction();
  if (!(Number(montant) > 0)) throw new Error('alpaca_montant_invalide');

  const r = await appelBroker(`/v1/accounts/${encodeURIComponent(brokerAccountId)}/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transfer_type: 'ach',
      relationship_id: relationshipId,
      amount: String(montant),
      direction: 'INCOMING',
    }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_depot_echoue');
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

module.exports = {
  TYPES_COMPTE_BANCAIRE,
  creerRelationACH,
  listerRelationsACH,
  creerDepotSimule,
};
