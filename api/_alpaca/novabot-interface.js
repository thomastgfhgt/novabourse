/**
 * api/_alpaca/novabot-interface.js — Interface technique PRÉPARÉE pour un
 * futur pilotage par NovaBot (§7 de la mission : "NovaBot : préparer une
 * interface technique (types, emplacement prévu) mais aucune exécution.
 * Le trading autonome est désactivé dans le code, pas seulement par
 * configuration.")
 *
 * Préfixe "_" : jamais exposé comme route Vercel.
 *
 * CE FICHIER NE FAIT RIEN AUJOURD'HUI. Il documente la FORME qu'aurait une
 * décision NovaBot (si elle existait un jour) et où elle se brancherait
 * (api/_alpaca/orders.js : creerOrdre()) — rien de plus. Aucun code ici ne
 * lit de données réelles, n'appelle le modèle, ni n'exécute quoi que ce
 * soit. Le verrou n'est PAS une variable d'environnement qu'on pourrait
 * activer par erreur : c'est cette fonction elle-même, qui lève toujours.
 */

'use strict';

/**
 * @typedef {Object} DecisionNovaBot
 * @property {string} accountId         - broker_accounts.alpaca_account_id visé.
 * @property {string} symbol            - ex. "AAPL".
 * @property {'buy'|'sell'} side
 * @property {number} [qty]             - exclusif avec notional.
 * @property {number} [notional]        - exclusif avec qty.
 * @property {string} raison            - explication en langage naturel, destinée à
 *                                         être montrée à l'utilisateur AVANT toute
 *                                         confirmation — jamais exécutée sans elle.
 * @property {string} mandateId         - le mandat NovaBot dont cette décision découlerait
 *                                         (voir novabot_mandates, sql/2026-10-07_novabot_foundation.sql).
 */

/**
 * Point d'entrée PRÉPARÉ, jamais implémenté — lève TOUJOURS, quel que
 * soit l'argument. Ce n'est pas un bug : c'est le verrou. Toute future
 * tentative de brancher NovaBot sur de l'exécution réelle devra d'abord
 * supprimer CETTE fonction (donc un commit, une revue, impossible par
 * accident) — jamais une simple bascule de configuration.
 *
 * @param {DecisionNovaBot} _decision
 * @returns {never}
 */
function executerDecisionNovaBot(_decision) {
  throw new Error('novabot_execution_autonome_desactivee_dans_le_code');
}

module.exports = {
  executerDecisionNovaBot,
};
