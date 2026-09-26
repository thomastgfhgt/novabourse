// Reproduit fidelement la validation stricte de api/analyze.js
// (mode='novareview', LOT "realise avec l'IA", 2026-09-26) pour la
// verifier sans appel reseau ni cle API. Le modele ne produit JAMAIS de
// verdict/chiffre lui-meme (voir CONSIGNE_NOVA_REVIEW) - ce fichier teste
// uniquement la validation du bilan ENTRANT (ce que le client envoie),
// jamais un appel reel au fournisseur.

function texteBorne(valeur, maxLen) {
  if (typeof valeur !== 'string') return null;
  const nettoye = valeur.split('').filter(c => { const code = c.charCodeAt(0); return code > 31 && code !== 127; }).join('').trim();
  return nettoye ? nettoye.slice(0, maxLen) : null;
}
function nombreBorne(valeur) {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null;
}
const VERDICTS_NOVA_REVIEW = new Set(['Excellent coup', 'Bon coup', 'Intéressant', 'Risqué', 'Erreur à étudier', 'Occasion manquée']);

function validerBilan(brut) {
  if (!brut || typeof brut !== 'object') return null;
  const decisions = (Array.isArray(brut.decisions) ? brut.decisions : []).slice(0, 20)
    .map(d => ({
      nom: texteBorne(d?.nom, 80),
      type: d?.type === 'position_ouverte' ? 'position_ouverte' : 'vente',
      verdict: VERDICTS_NOVA_REVIEW.has(d?.verdict) ? d.verdict : null,
      gainPct: nombreBorne(d?.gainPct),
      regretPct: nombreBorne(d?.regretPct),
      concentrationPct: nombreBorne(d?.concentrationPct),
      raisons: (Array.isArray(d?.raisons) ? d.raisons : []).slice(0, 5)
        .map(r => texteBorne(r, 200)).filter(Boolean),
    }))
    .filter(d => d.nom && d.verdict);
  if (!decisions.length) return null;
  return { decisions,
    performanceVariationPct: nombreBorne(brut.performanceVariationPct),
    secteursDistincts: nombreBorne(brut.secteursDistincts),
    maxPositionPct: nombreBorne(brut.maxPositionPct) };
}

const results = [];
function check(name, cond) { results.push([name, Boolean(cond)]); }

check('bilan non-objet -> null (jamais une valeur par defaut inventee)', validerBilan(null) === null);
check('bilan sans decisions exploitables -> null', validerBilan({ decisions: [] }) === null);
check('bilan avec seulement des decisions invalides -> null',
  validerBilan({ decisions: [{ nom: 'X' /* pas de verdict */ }] }) === null);

{
  const r = validerBilan({ decisions: [
    { nom: 'Apple', type: 'vente', verdict: 'Excellent coup', gainPct: 30, regretPct: 3.8, concentrationPct: 100, raisons: ['Gain de 30%'] },
  ] });
  check('decision valide conservee', r.decisions.length === 1);
  check('type par defaut "vente" si absent/invalide', r.decisions[0].type === 'vente');
}
{
  // Verdict qui n'existe pas dans le vocabulaire fixe -> decision rejetee entierement (jamais un verdict invente/tolere).
  const r = validerBilan({ decisions: [{ nom: 'Tesla', verdict: 'Coup du siecle' }] });
  check('verdict hors vocabulaire fixe -> decision rejetee', r === null);
}
{
  // Nom absent -> decision rejetee meme si le verdict est valide.
  const r = validerBilan({ decisions: [{ verdict: 'Bon coup' }, { nom: 'Valide', verdict: 'Bon coup' }] });
  check('decision sans nom rejetee individuellement, les autres restent', r.decisions.length === 1 && r.decisions[0].nom === 'Valide');
}
{
  // Plus de 20 decisions -> tronque a 20, jamais un tableau non borne envoye au modele.
  const decisions = Array.from({ length: 30 }, (_, i) => ({ nom: 'Titre' + i, verdict: 'Bon coup' }));
  const r = validerBilan({ decisions });
  check('tableau de decisions borne a 20 maximum', r.decisions.length === 20);
}
{
  // Chaine de controle/tres longue -> nettoyee et bornee.
  const nomSale = 'A\x00B\x1FC'.padEnd(120, 'x');
  const r = validerBilan({ decisions: [{ nom: nomSale, verdict: 'Bon coup' }] });
  check('caracteres de controle retires du nom', !/[\x00-\x1f]/.test(r.decisions[0].nom));
  check('nom borne a 80 caracteres', r.decisions[0].nom.length <= 80);
}
{
  // gainPct non-numerique (ex. NaN, string, Infinity) -> null, jamais une valeur inventee/coercee.
  const r = validerBilan({ decisions: [{ nom: 'X', verdict: 'Bon coup', gainPct: 'trente', regretPct: Infinity }] });
  check('gainPct non numerique -> null', r.decisions[0].gainPct === null);
  check('regretPct infini -> null (Number.isFinite exclut Infinity)', r.decisions[0].regretPct === null);
}
{
  // raisons bornees a 5 entrees, 200 caracteres chacune, entrees vides retirees.
  const raisons = Array.from({ length: 10 }, (_, i) => 'Raison ' + i);
  const r = validerBilan({ decisions: [{ nom: 'X', verdict: 'Bon coup', raisons: [...raisons, '', null, 123] }] });
  check('raisons bornees a 5 maximum', r.decisions[0].raisons.length === 5);
}

let allOk = true;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!ok) allOk = false;
}
console.log(allOk ? '\nTOUS LES TESTS PASSENT' : '\nECHEC');
process.exit(allOk ? 0 : 1);
