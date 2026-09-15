/**
 * scripts/lib/csvParser.js — PARSEUR CSV MINIMAL (RFC 4180)
 *
 * Aucune dépendance npm : vérifié empiriquement que core_listings.csv
 * contient des champs entre guillemets avec virgules internes (ex.
 * `"6K ADDITIVE, INC."`) — un simple split(',') tronque ces lignes
 * silencieusement. Ce parseur gère guillemets, virgules et guillemets
 * échappés (""), conformément à RFC 4180. Ne gère pas explicitement les
 * retours à la ligne à l'intérieur d'un champ entre guillemets autres que
 * \n/\r\n : non constaté dans le dataset source à ce jour, mais si un futur
 * import donnait un nombre de lignes incohérent avec l'en-tête, cela devra
 * être revérifié.
 */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }

    field += c;
  }

  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows;
}

/**
 * Parse en tableau d'objets, clés = première ligne (en-tête).
 * Une ligne dont le nombre de colonnes ne correspond pas à l'en-tête est
 * ignorée (comptée dans `skipped`) plutôt que de produire un objet corrompu.
 */
function parseCsvObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { header: [], objects: [], skipped: 0 };

  const header = rows[0];
  const objects = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0] === '') continue; // ligne vide finale
    if (r.length !== header.length) { skipped++; continue; }

    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = r[j];
    objects.push(obj);
  }

  return { header, objects, skipped };
}

module.exports = { parseCsv, parseCsvObjects };
