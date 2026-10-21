// Vérifie js/novabot-intelligence.js : reconnaissance des entreprises citées
// (sur le vrai catalogue), mémoire du profil (fusion, doublons, effacement),
// fiche de données réelles (aucun champ inventé).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let allOk = true;
const rapporte = (nom, ok) => { console.log((ok ? 'PASS' : 'FAIL') + ' - ' + nom); if (!ok) allOk = false; };

const catalogue = require('../catalog.json');
const memoire = {};
const toasts = [];
const ctx = {
  console, Math, Number, JSON, Map, Set, Promise, setTimeout, String, Array, Object, RegExp,
  stocks: catalogue,
  byId: Object.fromEntries(catalogue.map(s => [s.id, s])),
  state: { watchlist: ['MC-PA'], novabot: { mandateConfirmed: false } },
  V2_POPULAIRES: { actions: ['AAPL-NAS', 'MSFT-NAS', 'NVDA-NAS'], etf: ['SPY-NYA'] },
  QUOTES: new Map([['AAPL-NAS', { price: 342.74, changePercent: -0.21, freshness: 'DELAYED' }]]),
  localStorage: { getItem: k => memoire[k] ?? null, setItem: (k, v) => { memoire[k] = v; } },
  toast: m => toasts.push(m),
  fmt: { eur: v => v.toLocaleString('fr-FR') + ' €' },
  capEnMilliards: v => v / 1e9, croissanceSerie: () => 5.2,
};
vm.createContext(ctx);
const uiSrc = fs.readFileSync(path.join(__dirname, '../js/v2-ui.js'), 'utf8');
vm.runInContext(uiSrc.match(/function v2nomCourt[\s\S]*?\r?\n}\r?\n/)[0], ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/novabot-intelligence.js'), 'utf8'), ctx);

// --- 1) entreprises citées ---
const ids = t => vm.runInContext(`novabotEntreprisesCitees(${JSON.stringify(t)}).map(s => s.id)`, ctx);
const a = ids('Que penses-tu d\'Apple et de NVDA ?');
rapporte('Apple reconnu sur sa place principale (AAPL-NAS)', a.includes('AAPL-NAS'));
rapporte('NVDA reconnu par son sigle', a.includes('NVDA-NAS'));
rapporte('LVMH de la liste suivie privilégié (MC-PA)', ids('Et LVMH, c\'est solide ?').includes('MC-PA'));
rapporte('aucune entreprise dans une phrase générale', ids('Explique-moi ce qu\'est un ETF').length === 0);
rapporte('mot contenant un nom ne déclenche rien ("pineapple")', !ids('j\'aime le pineapple').includes('AAPL-NAS'));
rapporte('au plus 6 entreprises', ids('AAPL MSFT NVDA GOOGL AMZN META TSLA ASML').length <= 6);

// --- 2) mémoire du profil ---
vm.runInContext(`novabotProfilAppliquer({ riskLevel:'low', horizonYears:10, hardRules:[{type:'excluded_sector',value:'armement'}] })`, ctx);
let p = vm.runInContext('novabotProfilLire()', ctx);
rapporte('risque, horizon et exclusion retenus', p.riskLevel === 'low' && p.horizonYears === 10 && p.hardRules.length === 1);
rapporte('confirmation affichée à l\'utilisateur', /Nova a retenu/.test(toasts[toasts.length - 1] || ''));
const avant = toasts.length;
vm.runInContext(`novabotProfilAppliquer({ hardRules:[{type:'excluded_sector',value:'Armement'}] })`, ctx);
p = vm.runInContext('novabotProfilLire()', ctx);
rapporte('exclusion en double ignorée (casse comprise)', p.hardRules.length === 1 && toasts.length === avant);
vm.runInContext(`novabotProfilAppliquer({ budgetEUR:5000, preferences:[{type:'investment_style',value:'dividendes'}] })`, ctx);
p = vm.runInContext('novabotProfilLire()', ctx);
rapporte('budget et préférence ajoutés sans perdre le reste', p.budgetEUR === 5000 && p.preferences.length === 1 && p.riskLevel === 'low');
vm.runInContext(`novabotProfilAppliquer({ effacer:true })`, ctx);
rapporte('"oublie mon profil" efface tout', Object.keys(vm.runInContext('novabotProfilLire()', ctx)).length === 0);

// --- 3) fiche de données réelles ---
const fiche = vm.runInContext(`novabotFicheDonnees(byId['AAPL-NAS'])`, ctx);
rapporte('cours et variation réels repris', fiche.cours === 342.74 && fiche.variationJourPct === -0.21);
rapporte('aucun ratio inventé sans fondamentaux chargés', !('per' in fiche) && !('roePct' in fiche));

console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
