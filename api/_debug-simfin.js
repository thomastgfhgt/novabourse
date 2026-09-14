/**
 * DIAGNOSTIC TEMPORAIRE — à supprimer après usage, ainsi que la variable
 * Vercel SIMFIN_DEBUG_SECRET une fois le test terminé.
 *
 * Ne fait partie d'aucune route existante, ne touche à aucun fournisseur
 * déjà en place (_providers.js, company.js, index.html inchangés).
 *
 * Protection d'accès : exige SIMFIN_DEBUG_SECRET (variable Vercel dédiée,
 * JAMAIS SIMFIN_API_KEY elle-même), EXCLUSIVEMENT via l'en-tête :
 *   Authorization: Bearer <SIMFIN_DEBUG_SECRET>
 * Aucune autre forme n'est acceptée (pas de paramètre d'URL). Sans secret
 * valide : 401 immédiat, avant toute résolution et avant tout appel
 * SimFin.
 *
 * SIMFIN_API_KEY n'est jamais renvoyée, jamais logguée, jamais incluse
 * dans un message d'erreur.
 *
 * ORDRE DES APPELS (voir diagnostiquerTicker) :
 *   1. /companies/statements?ticker=X  — l'endpoint qui nous intéresse
 *      réellement, tenté EN PREMIER, sans supposer au préalable la forme
 *      de /companies/general (qui pourrait produire un faux négatif si sa
 *      propre enveloppe diffère de ce qu'on imagine).
 *   2. Si (1) réussit (2xx) : terminé, qu'il y ait des données ou non —
 *      "société trouvée mais sans données" n'est pas la même chose qu'un
 *      "mauvais paramètre", donc pas de second appel.
 *   3. Si (1) échoue avec 400 ou 404 (symptôme compatible avec un mauvais
 *      paramètre/route pour CE ticker précis) : on tente /companies/general
 *      pour résoudre un identifiant numérique, puis un seul appel
 *      /companies/statements?id=... si un identifiant a été trouvé.
 *   4. Toute autre erreur (401/403/5xx) : aucun repli, ça ne serait pas
 *      résolu par un changement de paramètre.
 * Cas normal : 1 seul appel SimFin par ticker.
 *
 * Déploiement : ajouter à /api/_debug-simfin.js, déployer, appeler une
 * fois, copier la réponse, PUIS SUPPRIMER ce fichier et la variable
 * SIMFIN_DEBUG_SECRET.
 */

const BASE = 'https://prod.simfin.com/api/v3';

/* Authentification SimFin : en-tête "Authorization", valeur = la clé API
   brute, sans préfixe "Bearer" — confirmé par la configuration de
   référence dltHub spécifique à SimFin (distincte du "Bearer <clé>"
   d'autres API comme OpenAI/Anthropic, à ne pas confondre). */
function enTetesSimFin(cle){
  return { Authorization: cle, accept: 'application/json' };
}

async function appelJSON(url, cle){
  try {
    const r = await fetch(url, { headers: enTetesSimFin(cle) });
    const texte = await r.text();
    let corps = null;
    try { corps = JSON.parse(texte); } catch { /* corps non-JSON */ }
    return { httpStatus: r.status, ok: r.ok, corps, texteBrut: corps ? null : texte.slice(0, 500) };
  } catch (e) {
    return { httpStatus: null, ok: false, erreurReseau: e.message };
  }
}

/* Décrit la structure RÉELLE d'un objet JSON sans présumer d'un schéma
   précis : type de la racine, clés de niveau 1, clés de niveau 2 des
   premiers objets/tableaux pertinents, longueurs de tableaux. */
function decrireStructure(valeur, profondeurRestante = 2){
  if (valeur === null || valeur === undefined) return { type: typeof valeur };
  if (Array.isArray(valeur)){
    return {
      type: 'array',
      longueur: valeur.length,
      premierElement: valeur.length && profondeurRestante > 0
        ? decrireStructure(valeur[0], profondeurRestante - 1) : undefined,
    };
  }
  if (typeof valeur === 'object'){
    const cles = Object.keys(valeur);
    const detail = {};
    if (profondeurRestante > 0){
      for (const k of cles.slice(0, 12)){
        detail[k] = decrireStructure(valeur[k], profondeurRestante - 1);
      }
    }
    return { type: 'object', cles, detail: profondeurRestante > 0 ? detail : undefined };
  }
  return { type: typeof valeur, exemple: String(valeur).slice(0, 40) };
}

/* Cherche des indices d'unité/devise à plat (clé contenant "curr", "unit"
   ou "scale", racine ou premier niveau), sans supposer un nom précis. */
function indicesUnite(valeur){
  const trouves = {};
  const scan = (obj, prefixe) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const [k, v] of Object.entries(obj)){
      if (/curr|unit|scale/i.test(k) && (typeof v === 'string' || typeof v === 'number')){
        trouves[prefixe + k] = v;
      }
    }
  };
  scan(valeur, '');
  if (Array.isArray(valeur) && valeur[0]) scan(valeur[0], '[0].');
  return trouves;
}

/* Un corps JSON "présent" n'est pas la même chose qu'un corps CONTENANT
   des données exploitables : [], {} et null doivent être distingués d'un
   tableau non vide ou d'un objet avec au moins une clé. */
function contientDonnees(corps){
  if (corps === null || corps === undefined) return false;
  if (Array.isArray(corps)) return corps.length > 0;
  if (typeof corps === 'object') return Object.keys(corps).length > 0;
  return false;
}

function resumerReponse(r){
  if (!r.corps) return { httpStatus: r.httpStatus, ok: r.ok, erreur: r.texteBrut || r.erreurReseau };
  return {
    httpStatus: r.httpStatus, ok: r.ok,
    donneesDisponibles: contientDonnees(r.corps),
    structure: decrireStructure(r.corps, 3),
    indicesUnite: indicesUnite(r.corps),
  };
}

/* Un échec est "compatible avec un mauvais paramètre/format" — donc digne
   de tenter la résolution via /companies/general — uniquement pour 400
   (requête mal formée) ou 404 (route/ressource introuvable avec CE
   paramètre précis). 401/403/5xx ne seraient pas résolus par un
   changement de paramètre : pas de repli dans ces cas. */
function echecCompatibleMauvaisParametre(r){
  return !r.ok && (r.httpStatus === 400 || r.httpStatus === 404);
}

/* Cherche un identifiant SimFin numérique dans les emplacements usuels
   observés pour ce type d'API, SANS parcourir tout le JSON récursivement :
     - racine.id / racine.simId
     - racine[0].id / racine[0].simId  (si racine est un tableau)
     - racine.data.id / racine.data.simId
     - racine.data[0].id / racine.data[0].simId  (si racine.data est un tableau) */
function chercherIdSimFin(corps){
  if (!corps || typeof corps !== 'object') return null;
  const candidats = [];
  candidats.push(Array.isArray(corps) ? corps[0] : corps);
  const data = !Array.isArray(corps) ? corps.data : undefined;
  if (data !== undefined) candidats.push(Array.isArray(data) ? data[0] : data);
  for (const c of candidats){
    if (c && typeof c === 'object'){
      if (c.id !== undefined && c.id !== null) return c.id;
      if (c.simId !== undefined && c.simId !== null) return c.simId;
    }
  }
  return null;
}

async function diagnostiquerTicker(ticker, cle){
  // 1. L'endpoint qui nous intéresse réellement, tenté directement.
  const parTicker = await appelJSON(
    `${BASE}/companies/statements?ticker=${encodeURIComponent(ticker)}&statements=pl,bs,cf,derived`, cle);

  if (parTicker.ok){
    return { ticker, formeUtilisee: 'ticker', general: { appele: false }, statements: resumerReponse(parTicker) };
  }

  if (!echecCompatibleMauvaisParametre(parTicker)){
    // 401/403/5xx : aucun repli, ça ne serait pas résolu par un changement
    // de paramètre.
    return {
      ticker,
      formeUtilisee: 'ticker (échec non lié au paramètre, pas de second essai)',
      general: { appele: false },
      statements: resumerReponse(parTicker),
    };
  }

  // 3. Échec 400/404 sur ticker= : tenter de résoudre un identifiant via
  // /companies/general, décrit génériquement (pas de recherche récursive).
  const general = await appelJSON(`${BASE}/companies/general?ticker=${encodeURIComponent(ticker)}`, cle);
  const idResolu = general.ok ? chercherIdSimFin(general.corps) : null;

  const resultat = {
    ticker,
    formeUtilisee: 'ticker (échoué 400/404) -> repli /companies/general',
    essaiTicker: resumerReponse(parTicker),
    general: {
      appele: true,
      httpStatus: general.httpStatus,
      ok: general.ok,
      idResolu,
      structure: general.corps ? decrireStructure(general.corps, 2) : null,
      erreur: general.ok ? null : (general.texteBrut || general.erreurReseau || general.corps),
    },
  };

  if (idResolu === null){
    resultat.statements = { skipped: true, raison: 'aucun identifiant résolu via /companies/general' };
    return resultat;
  }

  // 5. Un seul appel supplémentaire avec l'identifiant résolu.
  const parId = await appelJSON(
    `${BASE}/companies/statements?id=${encodeURIComponent(idResolu)}&statements=pl,bs,cf,derived`, cle);
  resultat.statements = resumerReponse(parId);
  return resultat;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET'){
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const secretAttendu = process.env.SIMFIN_DEBUG_SECRET;
  if (!secretAttendu){
    return res.status(500).json({ error: 'SIMFIN_DEBUG_SECRET absente de cet environnement' });
  }
  const enTeteAuth = req.headers['authorization'] || '';
  const secretFourni = enTeteAuth.startsWith('Bearer ') ? enTeteAuth.slice(7) : null;
  if (secretFourni !== secretAttendu){
    // Aucun appel SimFin déclenché ici.
    return res.status(401).json({ error: 'secret_invalide_ou_absent' });
  }

  const cle = process.env.SIMFIN_API_KEY;
  if (!cle){
    return res.status(500).json({ error: 'SIMFIN_API_KEY absente de cet environnement' });
  }

  const [msft, rms] = await Promise.all([
    diagnostiquerTicker('MSFT', cle),
    diagnostiquerTicker('RMS', cle),
  ]);

  return res.status(200).json({ msft, rms });
  // `cle` et `secretAttendu` n'apparaissent à aucun moment ci-dessus.
};
