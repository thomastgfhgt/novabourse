/* ============================================================
   NOVATITRE — ÉPREUVES D'APPLICATION (v14)
   À la fin de certaines missions, on part dans Marchés ou Portefeuille
   faire l'action pour de vrai (vraies valeurs, argent fictif).
   Ajoutées en fin de mission : les numéros des étapes existantes ne bougent pas.
   ============================================================ */
(() => {
  const add = (id, st) => { const m = window.NT_MISSIONS.find(x => x.id === id); if (m && m.steps) m.steps.push(Object.assign({ type: 'apply' }, st)); };
  add('m2-5', { title: 'Maintenant, pour de vrai', text: 'Tu sais passer un ordre au marché. Fais-le sur une vraie valeur de Paris, avec ton argent fictif.', goalText: 'Achète une action de Paris au marché', goal: { ev: 'buy', type: 'market', zone: 'Paris' }, hint: 'Stellantis coûte environ 4 € : parfait pour un petit budget.' });
  add('m2-6', { title: 'À toi de fixer ton prix', text: 'Place un vrai ordre à cours limité : un prix d’achat un peu sous le cours actuel.', goalText: 'Place un ordre à cours limité sous le cours', goal: { ev: 'limit' }, hint: 'Choisis « Cours limité », puis un prix un peu plus bas que le cours.' });
  add('m2-7', { title: 'Vendre à ton prix', text: 'Tu détiens une valeur ? Vends-en une partie. (Sinon, achète d’abord 1 titre, puis revends-le.)', goalText: 'Vends une partie d’une position', goal: { ev: 'sell' }, hint: 'Ouvre une valeur que tu détiens et choisis « Vendre ».' });
  add('m3-1', { title: 'Ne pas tout miser au même endroit', text: 'Construis un vrai début de portefeuille diversifié.', goalText: 'Aie au moins 2 secteurs différents', goal: { ev: 'sectors', n: 2 }, hint: 'Par exemple une banque et une entreprise de santé.' });
  add('m3-2', { title: 'Ton premier ETF', text: 'Un ETF réunit des centaines d’entreprises en une ligne. Ajoutes-en un.', goalText: 'Achète un ETF', goal: { ev: 'buy', kind: 'etf' }, hint: 'Le filtre « ETF » dans Marchés les montre tous.' });
})();
