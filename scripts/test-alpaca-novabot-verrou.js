// Vérifie que l'interface technique préparée pour NovaBot (§7) ne peut
// JAMAIS exécuter quoi que ce soit — même avec un argument qui ressemble
// à une décision parfaitement valide.

const { executerDecisionNovaBot } = require('../api/_alpaca/novabot-interface.js');

(() => {
  let allOk = true;
  const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

  const decisionPlausible = {
    accountId: 'b272cbc1-71b4-41c8-9aa5-26d8a12efcad',
    symbol: 'AAPL', side: 'buy', qty: 1,
    raison: 'Test', mandateId: 'mandat-test',
  };

  let leve = false;
  try { executerDecisionNovaBot(decisionPlausible); } catch (e) {
    leve = e.message === 'novabot_execution_autonome_desactivee_dans_le_code';
  }
  rapporte('lève systématiquement, même avec une décision plausible', leve);

  let leveVide = false;
  try { executerDecisionNovaBot(); } catch { leveVide = true; }
  rapporte('lève aussi sans argument', leveVide);

  console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
  process.exit(allOk ? 0 : 1);
})();
