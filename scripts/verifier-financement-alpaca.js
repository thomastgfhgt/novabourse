// Vérification RÉELLE de bout en bout (pas un test unitaire mocké, pas
// dans scripts/test-*.js) : relation ACH -> dépôt virtuel -> pouvoir
// d'achat mis à jour -> ordre fictif. Fait de vrais appels réseau vers
// Alpaca Sandbox avec les identifiants de .env.local.
//
// Préparé le 2026-10-15 en attendant des identifiants avec le scope
// Funding activé (les identifiants précédents avaient Funding
// explicitement désactivé à la création, confirmé par l'utilisateur).
// Ne rien supposer : chaque étape affiche le VRAI code HTTP et s'arrête
// à la première erreur réelle plutôt que de continuer sur une supposition.
//
// Usage : node scripts/verifier-financement-alpaca.js <ALPACA_ACCOUNT_ID>
// (par défaut, le compte Sandbox déjà créé le 2026-10-15 : John Doe,
// b272cbc1-71b4-41c8-9aa5-26d8a12efcad)

const fs = require('fs');
const path = require('path');

(() => {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
})();

const ACCOUNT_ID = process.argv[2] || 'b272cbc1-71b4-41c8-9aa5-26d8a12efcad';

const { creerRelationACH, listerRelationsACH, creerDepotSimule } = require('../api/_alpaca/funding.js');
const { lireCompteTrading } = require('../api/_alpaca/accounts.js');
const { creerOrdre } = require('../api/_alpaca/orders.js');

function afficher(titre, obj) {
  console.log('\n=== ' + titre + ' ===');
  console.log(JSON.stringify(obj, null, 2));
}

(async () => {
  console.log('Compte Alpaca cible :', ACCOUNT_ID);

  // --- 1) État initial (avant tout) ---
  let avant;
  try {
    avant = await lireCompteTrading(ACCOUNT_ID);
    console.log('\n[1/5] État AVANT — buying_power =', avant.buying_power, '| cash =', avant.cash);
  } catch (e) {
    console.log('\n[1/5] ECHEC lecture état initial — status', e.status, JSON.stringify(e.body));
    process.exit(1);
  }

  // --- 2) Relation ACH (prérequis documenté avant tout dépôt) ---
  let relation;
  try {
    relation = await creerRelationACH(ACCOUNT_ID, {
      accountOwnerName: 'John Doe',
      bankAccountType: 'CHECKING',
      bankAccountNumber: '123456789012',
      bankRoutingNumber: '021000021',
    });
    afficher('[2/5] Relation ACH créée (statut réel)', { id: relation.id, status: relation.status });
  } catch (e) {
    console.log('\n[2/5] ECHEC création relation ACH — status', e.status, JSON.stringify(e.body));
    console.log('Arrêt : sans relation ACH, aucun dépôt ne peut être tenté honnêtement.');
    process.exit(1);
  }

  if (relation.status !== 'APPROVED') {
    console.log('\nRelation ACH au statut "' + relation.status + '" (pas encore APPROVED).');
    console.log('Nouvelle lecture de la liste des relations pour vérifier un changement de statut...');
    try {
      const liste = await listerRelationsACH(ACCOUNT_ID);
      afficher('Relations ACH actuelles', liste);
    } catch (e) {
      console.log('ECHEC relecture des relations —', e.status, JSON.stringify(e.body));
    }
  }

  // --- 3) Dépôt virtuel (uniquement si la relation est APPROVED) ---
  if (relation.status === 'APPROVED') {
    try {
      const depot = await creerDepotSimule(ACCOUNT_ID, relation.id, 10000);
      afficher('[3/5] Dépôt virtuel soumis (statut réel)', depot);
    } catch (e) {
      console.log('\n[3/5] ECHEC dépôt — status', e.status, JSON.stringify(e.body));
      process.exit(1);
    }
  } else {
    console.log('\n[3/5] Dépôt NON tenté — relation ACH pas encore APPROVED (jamais un dépôt sur une relation non approuvée).');
    process.exit(0);
  }

  // --- 4) Pouvoir d'achat réellement mis à jour ? ---
  try {
    const apres = await lireCompteTrading(ACCOUNT_ID);
    console.log('\n[4/5] État APRÈS — buying_power =', apres.buying_power, '| cash =', apres.cash);
    if (Number(apres.buying_power) <= Number(avant.buying_power)) {
      console.log('ATTENTION : le pouvoir d\'achat n\'a pas augmenté — le dépôt a peut-être été accepté mais pas encore réglé (voir statut ci-dessus), jamais supposer un succès.');
    }
  } catch (e) {
    console.log('\n[4/5] ECHEC relecture après dépôt — status', e.status, JSON.stringify(e.body));
    process.exit(1);
  }

  // --- 5) Ordre fictif, maintenant que le compte est (en principe) financé ---
  try {
    const ordre = await creerOrdre(ACCOUNT_ID, { symbol: 'AAPL', side: 'buy', qty: 1 });
    afficher('[5/5] Ordre fictif soumis (statut réel)', ordre);
  } catch (e) {
    console.log('\n[5/5] ECHEC ordre — status', e.status, JSON.stringify(e.body));
    process.exit(1);
  }

  console.log('\nVérification terminée — chaque étape ci-dessus reflète une réponse RÉELLE d\'Alpaca.');
})();
