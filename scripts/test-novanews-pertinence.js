// Reproduit fidelement nomsEntreprisesPertinentes()/articlePertinentPour()
// (js/nova.js, §29/§33 du prompt maitre NovaTitre : "IMPORTANT POUR VOUS")
// pour les verifier sans navigateur.

const RE_ECHAP = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function nomsEntreprisesPertinentes(watchlist, positions, byId) {
  const ids = new Set([...watchlist, ...positions.map(p => p.id)]);
  const noms = [];
  for (const id of ids) {
    const st = byId[id];
    if (!st) continue;
    const premierMot = String(st.name || '').trim().split(/\s+/)[0];
    if (premierMot && premierMot.length >= 3) noms.push({ id, label: st.name, mot: premierMot, ticker: st.ticker });
  }
  return noms;
}
function articlePertinentPour(article, noms) {
  const titre = article?.title || '';
  for (const n of noms) {
    if (new RegExp(`\\b${RE_ECHAP(n.mot)}\\b`, 'i').test(titre)) return n;
    if (n.ticker && n.ticker.length >= 3 && new RegExp(`\\b${RE_ECHAP(n.ticker)}\\b`).test(titre)) return n;
  }
  return null;
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

const byId = {
  'AAPL-NAS': { name: 'Apple Inc', ticker: 'AAPL' },
  'MC-PAR': { name: 'LVMH Moët Hennessy - Louis Vuitton', ticker: 'MC' },
  'ON-NAS': { name: 'ON Semiconductor Corp', ticker: 'ON' },
  'F-NYS': { name: 'Ford Motor Co', ticker: 'F' },
};

// ---- correspondance par nom (premier mot significatif) ----
{
  const noms = nomsEntreprisesPertinentes(['AAPL-NAS'], [], byId);
  const r = articlePertinentPour({ title: 'Apple dévoile son nouveau Mac' }, noms);
  check('correspondance par premier mot du nom ("Apple" dans "Apple dévoile...")', r && r.id === 'AAPL-NAS');
}
{
  const noms = nomsEntreprisesPertinentes(['MC-PAR'], [], byId);
  const r = articlePertinentPour({ title: 'LVMH annonce ses résultats trimestriels' }, noms);
  check('nom composé réduit à son 1er mot ("LVMH Moët Hennessy..." -> "LVMH")', r && r.id === 'MC-PAR');
}

// ---- aucune correspondance accidentelle (mot entier, pas une sous-chaîne) ----
{
  const noms = nomsEntreprisesPertinentes(['AAPL-NAS'], [], byId);
  const r = articlePertinentPour({ title: 'Pineapple sales rise this quarter' }, noms);
  check('"Apple" ne matche pas à l\'intérieur de "Pineapple" (mot entier, pas une sous-chaîne)', r === null);
}

// ---- tickers courts (<3 caractères) jamais utilisés, trop de faux positifs ----
{
  const noms = nomsEntreprisesPertinentes(['F-NYS'], [], byId);
  // "F" est le ticker (1 caractère, exclu) ; "Ford" est le nom (4 caractères, utilisé).
  const r1 = articlePertinentPour({ title: 'F is a common letter in headlines' }, noms);
  check('ticker à 1 caractère ("F") jamais comparé, même en mot entier', r1 === null);
  const r2 = articlePertinentPour({ title: 'Ford announces new electric truck' }, noms);
  check('mais le NOM ("Ford", 4 caractères) reste comparé normalement', r2 && r2.id === 'F-NYS');
}
{
  const noms = nomsEntreprisesPertinentes(['ON-NAS'], [], byId);
  // Ticker "ON" (2 caractères, exclu) ; nom "ON Semiconductor" -> 1er mot "ON" (2 caractères, aussi exclu par la longueur >=3 du nom).
  const r = articlePertinentPour({ title: 'Markets rally on strong earnings' }, noms);
  check('"ON" (ticker ET 1er mot du nom, tous deux <3 caractères) jamais une fausse alerte sur "on strong"', r === null);
}

// ---- aucune entreprise suivie/détenue -> toujours aucune pertinence ----
{
  const noms = nomsEntreprisesPertinentes([], [], byId);
  check('aucune valeur suivie/détenue -> liste de noms vide', noms.length === 0);
  check('liste vide -> jamais de pertinence trouvée', articlePertinentPour({ title: 'Apple dévoile son nouveau Mac' }, noms) === null);
}

// ---- positions ET watchlist combinées, sans doublon ----
{
  const noms = nomsEntreprisesPertinentes(['AAPL-NAS'], [{ id: 'AAPL-NAS' }, { id: 'MC-PAR' }], byId);
  check('watchlist + positions combinées (Set, "AAPL-NAS" présent dans les 2 -> jamais dupliqué)', noms.length === 2);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
