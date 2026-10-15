/**
 * api/_alpaca/orders.js — Ordres Alpaca Broker API Sandbox (Phase 4).
 *
 * Préfixe "_" : jamais exposé comme route Vercel.
 *
 * §5.2 de la mission : chaque ordre porte un client_order_id unique généré
 * AVANT l'envoi, enregistré, jamais renvoyé automatiquement en cas de
 * timeout — on recherche d'abord l'ordre existant par ce même id (voir
 * rechercherOrdreParClientId) avant de décider quoi faire.
 *
 * Phase 4 — condition d'entrée de la mission : "permissions d'écriture
 * confirmées par Alpaca ET mon accord explicite." Les permissions sont
 * confirmées (compte créé réellement le 2026-10-15, voir accounts.js) ;
 * ce module est prêt mais AUCUN ordre réel n'est soumis depuis ce fichier
 * sans un appel explicite — jamais déclenché automatiquement.
 */

'use strict';

const crypto = require('crypto');
const { appelBroker, verifierVerrouProduction } = require('./client.js');

const SIDES_AUTORISES = Object.freeze(['buy', 'sell']);
// Volontairement restreint au marché pour ce premier jalon (brief §5.2 :
// "type d'ordre (marché ; limite si pris en charge)") — limite viendra
// dans un second temps, une fois le marché validé de bout en bout.
const TYPES_AUTORISES = Object.freeze(['market']);
const TIME_IN_FORCE_AUTORISES = Object.freeze(['day']);

function genererClientOrderId() {
  return crypto.randomUUID();
}

/* Validation PURE (aucun réseau) — à appeler côté serveur avant tout envoi
   (§5.2 : "Contrôles serveur avant envoi"). Retourne {valide, erreurs}. */
function validerParametresOrdre(params) {
  const erreurs = [];
  const p = params || {};

  if (!p.symbol || typeof p.symbol !== 'string') erreurs.push('symbol_requis');
  if (!SIDES_AUTORISES.includes(p.side)) erreurs.push('side_invalide');
  if (!TYPES_AUTORISES.includes(p.type || 'market')) erreurs.push('type_non_supporte');
  if (!TIME_IN_FORCE_AUTORISES.includes(p.timeInForce || 'day')) erreurs.push('time_in_force_non_supporte');

  const aQty = p.qty !== undefined && p.qty !== null && p.qty !== '';
  const aNotional = p.notional !== undefined && p.notional !== null && p.notional !== '';
  if (aQty && aNotional) erreurs.push('qty_et_notional_exclusifs');
  if (!aQty && !aNotional) erreurs.push('qty_ou_notional_requis');
  if (aQty && !(Number(p.qty) > 0)) erreurs.push('qty_doit_etre_positive');
  if (aNotional && !(Number(p.notional) > 0)) erreurs.push('notional_doit_etre_positif');

  return { valide: erreurs.length === 0, erreurs };
}

/* Soumet un ordre réel — AUCUN appel automatique, uniquement sur demande
   explicite de l'appelant (route serveur avec confirmation utilisateur,
   §5.2 : "confirmation explicite → envoi par le serveur"). */
async function creerOrdre(brokerAccountId, params) {
  verifierVerrouProduction();
  const { valide, erreurs } = validerParametresOrdre(params);
  if (!valide) {
    const err = new Error('alpaca_ordre_parametres_invalides');
    err.erreurs = erreurs;
    throw err;
  }

  const clientOrderId = params.clientOrderId || genererClientOrderId();
  const corps = {
    symbol: params.symbol,
    side: params.side,
    type: params.type || 'market',
    time_in_force: params.timeInForce || 'day',
    client_order_id: clientOrderId,
    ...(params.qty !== undefined ? { qty: String(params.qty) } : {}),
    ...(params.notional !== undefined ? { notional: String(params.notional) } : {}),
  };

  const r = await appelBroker(`/v1/trading/accounts/${encodeURIComponent(brokerAccountId)}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_ordre_echoue');
    err.status = r.status;
    err.body = data;
    err.clientOrderId = clientOrderId;
    throw err;
  }
  return data;
}

/* À appeler APRÈS un timeout réseau, avant tout nouvel essai — jamais un
   renvoi automatique (§5.2). */
async function rechercherOrdreParClientId(brokerAccountId, clientOrderId) {
  const r = await appelBroker(
    `/v1/trading/accounts/${encodeURIComponent(brokerAccountId)}/orders:by_client_order_id?client_order_id=${encodeURIComponent(clientOrderId)}`
  );
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error('alpaca_recherche_ordre_echouee');
    err.status = r.status;
    err.body = data;
    throw err;
  }
  return data;
}

/* Annulation (§1, Phase 4 : "Ordres (achat, vente, annulation)") —
   DELETE .../orders/{order_id}. Réponse réelle attendue : 204 si la
   demande d'annulation est acceptée, 422 si l'ordre n'est plus annulable
   (ex. déjà exécuté) — jamais présenté comme annulé dans ce cas. */
async function annulerOrdre(brokerAccountId, alpacaOrderId) {
  verifierVerrouProduction();
  const r = await appelBroker(
    `/v1/trading/accounts/${encodeURIComponent(brokerAccountId)}/orders/${encodeURIComponent(alpacaOrderId)}`,
    { method: 'DELETE' }
  );
  if (r.status === 204) return { annule: true };
  const data = await r.json().catch(() => null);
  const err = new Error(r.status === 422 ? 'alpaca_ordre_non_annulable' : 'alpaca_annulation_echouee');
  err.status = r.status;
  err.body = data;
  throw err;
}

module.exports = {
  SIDES_AUTORISES,
  TYPES_AUTORISES,
  TIME_IN_FORCE_AUTORISES,
  genererClientOrderId,
  validerParametresOrdre,
  creerOrdre,
  rechercherOrdreParClientId,
  annulerOrdre,
};
