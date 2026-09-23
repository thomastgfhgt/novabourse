// Verifie la couverture reelle de REGION_OF_COUNTRY contre les pays
// reellement presents dans le catalogue, et quelques classifications
// de reference.
// CORRECTIF (2026-09-24) : le catalogue (11 243 entreprises) vit
// desormais dans catalog.json, extrait de l'ancien "const stocks = [...]"
// d'index.html pour ne plus etre analyse/compile en JS a chaque
// chargement de page (voir la note dans index.html juste avant
// "const stocks = []") — ce script lit donc catalog.json plutot que de
// regex-extraire un tableau qui n'existe plus en dur dans le HTML.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8'));

const countriesInCatalog = new Set(catalog.map(s => s.country).filter(Boolean));
const mapSection = html.slice(html.indexOf('const REGION_OF_COUNTRY'), html.indexOf('const REGIONS ='));
const regionMap = Object.fromEntries([...mapSection.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(m => [m[1], m[2]]));

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

check('Le catalogue contient bien des pays (sanity)', countriesInCatalog.size > 30);

const nonMappes = [...countriesInCatalog].filter(c => !regionMap[c]);
check(`Tous les pays du catalogue sont mappés (0 attendu, trouvé: ${nonMappes.length})`, nonMappes.length === 0);

// Classifications de reference (pays majeurs, region attendue).
const attendu = {
  'France': 'France',
  'Allemagne': 'Europe',
  'Espagne': 'Europe',
  'Italie': 'Europe',
  'Suède': 'Europe',
  'Danemark': 'Europe',
  'Norvège': 'Europe',
  'Pays-Bas': 'Europe',
  'Belgique': 'Europe',
  'Royaume-Uni': 'Europe',
  'États-Unis': 'Amériques',
  'Canada': 'Amériques',
  'Brésil': 'Amériques',
  'Chine': 'Asie/Pacifique',
  'Japon': 'Asie/Pacifique',
  'Inde': 'Asie/Pacifique',
  'Australie': 'Asie/Pacifique',
  'Israël': 'Moyen-Orient',
  'Afrique du Sud': 'Afrique',
};
for (const [pays, region] of Object.entries(attendu)) {
  check(`${pays} -> ${region}`, regionMap[pays] === region);
}

// Formes anglaises legacy toujours tolerees (retro-compatibilite locale).
check('Forme anglaise legacy "Germany" toujours toleree', regionMap['Germany'] === 'Europe');

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
