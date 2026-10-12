// Vérifie NovaBot V6 §6 ("mémoire commune") : reproduit fidèlement
// 1) sanitiserDonnees() (api/analyze.js) — RÉGRESSION réelle trouvée en
//    câblant mandate.preferences : hardRules/preferences étaient
//    silencieusement supprimés avant même cette passe, dans les deux
//    rôles de CONSIGNE_NOVABOT_CHAT (tous les tableaux étaient ignorés) ;
// 2) validerPreferences()/validerMandateDraft() (api/analyze.js) ;
// 3) novabotAjouterPreferences() (js/core.js) : dédoublonnage.
// Même convention que les fichiers test-novabot-*.js précédents
// (fonctions pures recopiées, check()+PASS/FAIL) — pas un chargement du
// vrai fichier serveur (ses require() relatifs ne résoudraient pas
// depuis scripts/, et ce n'est le pattern d'aucun test existant du dossier).

function texteBorne(v, max) { return typeof v === 'string' ? v.slice(0, max) : v; }

/* ---------- copie de sanitiserDonnees() (api/analyze.js) ---------- */
function sanitiserDonnees(obj, profondeur = 0) {
  if (profondeur > 2 || !obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && v.length < 200) out[k] = texteBorne(v, 200);
    else if (typeof v === 'boolean') out[k] = v;
    else if (Array.isArray(v)) {
      const items = v.slice(0, 30).map(item => {
        if (typeof item === 'number' && Number.isFinite(item)) return item;
        if (typeof item === 'string' && item.length < 200) return texteBorne(item, 200);
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const nested = sanitiserDonnees(item, profondeur + 1);
          return (nested && Object.keys(nested).length) ? nested : null;
        }
        return null;
      }).filter(x => x !== null);
      if (items.length) out[k] = items;
    }
    else if (v && typeof v === 'object') {
      const nested = sanitiserDonnees(v, profondeur + 1);
      if (nested && Object.keys(nested).length) out[k] = nested;
    }
  }
  return out;
}

/* ---------- copie de validerPreferences()/validerMandateDraft() ---------- */
function validerPreferences(arr, max) {
  if (!Array.isArray(arr)) return null;
  const prefs = arr
    .filter(p => p && typeof p.type === 'string' && typeof p.value === 'string' && p.value.trim())
    .slice(0, max).map(p => ({ type: texteBorne(p.type, 40), value: texteBorne(p.value, 80) }));
  return prefs.length ? prefs : null;
}
const NOVABOT_OBJECTIVES = new Set(['growth', 'income', 'preserve']);
function validerMandateDraft(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const out = {};
  if (Number.isFinite(d.initialCapital) && d.initialCapital >= 0) out.initialCapital = d.initialCapital;
  if (NOVABOT_OBJECTIVES.has(d.objective)) out.objective = d.objective;
  if (Array.isArray(d.hardRules)) {
    const regles = d.hardRules
      .filter(r => r && (r.type === 'excluded_sector' || r.type === 'excluded_asset') && typeof r.value === 'string')
      .slice(0, 20).map(r => ({ type: r.type, value: texteBorne(r.value, 60) }));
    if (regles.length) out.hardRules = regles;
  }
  const prefs = validerPreferences(d.preferences, 20);
  if (prefs) out.preferences = prefs;
  return Object.keys(out).length ? out : null;
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

/* ---------- 1) sanitiserDonnees() : RÉGRESSION tableaux ---------- */
{
  const out = sanitiserDonnees({ hardRules: [{ type:'excluded_sector', value:'Armement' }], preferences: [{ type:'investment_style', value:'long terme' }], cashMinPct: 20 });
  check('RÉGRESSION : hardRules (tableau d\'objets) survit à sanitiserDonnees, n\'est plus supprimé',
    Array.isArray(out.hardRules) && out.hardRules.length === 1 && out.hardRules[0].value === 'Armement');
  check('RÉGRESSION : preferences (tableau d\'objets) survit à sanitiserDonnees',
    Array.isArray(out.preferences) && out.preferences.length === 1 && out.preferences[0].value === 'long terme');
  check('un champ scalaire simple (cashMinPct) continue de passer normalement (non-régression)',
    out.cashMinPct === 20);
}
check('tableau de chaînes simples également transmis', (() => {
  const out = sanitiserDonnees({ tags: ['tech', 'santé'] });
  return Array.isArray(out.tags) && out.tags.length === 2;
})());
check('tableau vide -> propriété absente (jamais un [] inutile dans le contexte envoyé au modèle)',
  !('hardRules' in sanitiserDonnees({ hardRules: [] })));
check('élément de tableau invalide (null, objet sans les bons champs) filtré sans rejeter tout le tableau', (() => {
  const out = sanitiserDonnees({ hardRules: [{ type:'excluded_sector', value:'Énergie' }, null] });
  return out.hardRules.length === 1;
})());
check('objet totalement vide -> {} jamais null (contrat inchangé pour les appelants existants)',
  JSON.stringify(sanitiserDonnees({})) === '{}');

/* ---------- 2) validerPreferences()/validerMandateDraft() ---------- */
check('validerPreferences respecte le plafond `max` (newPreferences : jamais plus de 2 par tour)',
  validerPreferences([{ type:'a', value:'1' }, { type:'b', value:'2' }, { type:'c', value:'3' }], 2).length === 2);
check('validerPreferences rejette une entrée sans value ou vide',
  validerPreferences([{ type:'a', value:'' }, { type:'b' }], 10) === null);
check('validerPreferences(null ou non-tableau) -> null, jamais une exception',
  validerPreferences(null, 5) === null && validerPreferences('x', 5) === null);
check('validerMandateDraft accepte des préférences valides au même titre que hardRules',
  validerMandateDraft({ preferences: [{ type:'investment_style', value:'ESG' }] }).preferences.length === 1);

/* ---------- 3) novabotAjouterPreferences() : dédoublonnage (copie de js/core.js) ---------- */
function ajouterPreferences(existantes, nouvelles) {
  const vus = new Set(existantes.map(p => (p.type + '|' + p.value).toLowerCase()));
  const ajoutees = [];
  for (const p of nouvelles) {
    if (!p || typeof p.type !== 'string' || typeof p.value !== 'string' || !p.value.trim()) continue;
    const cle = (p.type + '|' + p.value).toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    ajoutees.push({ type:p.type, value:p.value.trim() });
  }
  return ajoutees.length ? [...existantes, ...ajoutees] : existantes;
}
check('RÉGRESSION : une préférence déjà connue (même type+value, insensible à la casse) n\'est jamais dupliquée',
  ajouterPreferences([{ type:'investment_style', value:'Long terme' }], [{ type:'investment_style', value:'long terme' }]).length === 1);
check('une préférence réellement nouvelle est ajoutée',
  ajouterPreferences([{ type:'investment_style', value:'Long terme' }], [{ type:'investment_style', value:'ESG' }]).length === 2);
check('liste vide de nouvelles préférences -> liste existante inchangée',
  JSON.stringify(ajouterPreferences([{ type:'a', value:'x' }], [])) === JSON.stringify([{ type:'a', value:'x' }]));

/* ---------- rapport ---------- */
const fails = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
console.log('');
if (fails.length) {
  console.log(`${fails.length}/${results.length} ÉCHEC(S)`);
  process.exit(1);
} else {
  console.log(`TOUS LES TESTS PASSENT (${results.length})`);
}
