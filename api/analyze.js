/**
 * POST /api/analyze — analyse par modèle de langage.
 * Quota appliqué côté serveur selon le plan. Clés jamais exposées.
 * Règle inchangée : le modèle rend un verdict qualitatif et des facteurs en
 * texte. Aucun chiffre produit par lui n'est conservé.
 */
const { userFromToken, sb } = require('./me.js');
const { PLAN_LIMITS, planReel, limiteDe, consommation, reserver, cloturer, quotaBlock } = require('./_limits.js');
const { novascore } = require('./market/_novascore.js');

/* Ordre de priorité : xAI d'abord, c'est la couche qu'on valide en premier.
   Le modèle est configurable pour ne pas avoir à toucher au code. */
const PROVIDERS = {
  xai:       { env:'XAI_API_KEY',       url:'https://api.x.ai/v1/chat/completions',
               model: () => process.env.XAI_MODEL || 'grok-4.6',
               auth: k => ({ Authorization:`Bearer ${k}` }) },
  openai:    { env:'OPENAI_API_KEY',    url:'https://api.openai.com/v1/chat/completions',
               model: () => process.env.OPENAI_MODEL || 'gpt-4.1-mini',
               auth: k => ({ Authorization:`Bearer ${k}` }) },
  anthropic: { env:'ANTHROPIC_API_KEY', url:'https://api.anthropic.com/v1/messages',
               model: () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
               auth: k => ({ 'x-api-key':k, 'anthropic-version':'2023-06-01' }) },
};
const actif = () => Object.entries(PROVIDERS).filter(([, p]) => process.env[p.env]);

/* DOIT RESTER IDENTIQUE à la liste SECTORS d'index.html (recherche "const
   SECTORS =") : sert à valider qu'un secteur renvoyé par le modèle pour le
   screener (voir screenerAnalyse ci-dessous) correspond à une valeur RÉELLE
   du filtre existant, jamais une catégorie inventée que le frontend ne
   saurait pas appliquer. */
const SECTORS = ['Technologie','Finance','Santé','Industrie','Énergie','Consommation',
  'Automobile','Luxe','Télécommunications','Matériaux','Immobilier','Services publics'];

const CONSIGNE_SCREENER = `Tu transformes une recherche en langage naturel en filtres
structurés pour un écran de sélection d'entreprises. Réponds en JSON strict :
{"sector":"tous|${SECTORS.join('|')}","country":"tous|<nom de pays en français>",
"scoreMin":0,"explanation":"..."}
Règles :
- "sector" doit être EXACTEMENT une des valeurs listées ci-dessus, ou "tous".
- "country" est un nom de pays en français (ex. "États-Unis", "France"), ou "tous"
  si aucun pays n'est mentionné. N'invente pas un pays qui n'est pas raisonnablement
  déduit de la requête.
- "scoreMin" : 0 par défaut. Mets 70 si l'utilisateur cherche une entreprise
  manifestement "solide"/"de qualité"/"rentable", 60 pour "en croissance". Sinon 0.
- "explanation" : une phrase en français résumant les filtres appliqués, pour que
  l'utilisateur puisse vérifier avant de lancer la recherche.
- N'invente aucun autre champ. Si la requête ne permet de déduire aucun filtre
  pertinent, réponds {"sector":"tous","country":"tous","scoreMin":0,"explanation":"Aucun filtre déduit."}`;

const CONSIGNE = `Tu analyses une entreprise cotée à partir des seuls chiffres fournis.
Réponds en JSON strict : {"whatItDoes":"...","verdict":"positif|neutre|negatif|insuffisant","uncertainty":"faible|moyenne|elevee","summary":"...","positive":["..."],"negative":["..."]}
"whatItDoes" : 1 à 2 phrases expliquant simplement ce que fait l'entreprise et
comment elle gagne son argent, en te basant UNIQUEMENT sur son secteur/
industrie/description déjà fournis dans le contexte — jamais un détail
(produit, chiffre, part de marché) qui n'y figure pas explicitement.
Règles absolues :
- N'invente aucun chiffre. Ne cite que ceux du contexte.
- Ne produis aucun objectif de cours, aucune probabilité, aucun pourcentage de réussite.
- Ne recommande jamais d'acheter ou de vendre.
- Si les données manquent, réponds "insuffisant".`;

/**
 * Mode "screener" (§37 du PRD) : remplace le parsing par expressions
 * régulières côté frontend (parseNaturalQuery) par une interprétation
 * réelle du modèle, pour une requête qu'une regex ne peut pas couvrir.
 * Réutilise EXACTEMENT le même mécanisme de quota/réservation que l'analyse
 * d'entreprise ci-dessus (même compteur mensuel) — délibéré : un appel
 * modèle coûte la même chose, quel que soit son objet, et créer un second
 * compteur séparé aurait demandé une nouvelle table Supabase pour un
 * bénéfice pas évident. Le frontend garde le parsing local par regex comme
 * geste instantané/gratuit pour les requêtes simples ; ce mode sert aux
 * requêtes que la regex ne couvre pas.
 */
async function screenerAnalyse(req, res, { user, plan, dispo }){
  const requete = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 300) : '';
  if (!requete) return res.status(400).json({ error: 'requete_vide' });

  const [id, p] = dispo[0];
  const key = process.env[p.env];
  const modele = typeof p.model === 'function' ? p.model() : p.model;
  const prompt = `${CONSIGNE_SCREENER}\n\nRequête utilisateur : "${requete}"`;

  const resa = await reserver(sb, user.id, plan);
  if (!resa.ok){
    if (resa.reason === 'quota_exceeded'){
      const q = quotaBlock(plan, resa.used ?? limiteDe(plan));
      return res.status(429).json({ error:'quota_exceeded',
        message:`Vous avez utilisé vos ${limiteDe(plan)} analyses incluses ce mois-ci.`, ...q });
    }
    if (resa.reason === 'rate_limited'){
      return res.status(429).json({ error:'rate_limited',
        message:"Trop de requêtes lancées en peu de temps. Réessayez dans quelques minutes.", plan });
    }
    return res.status(503).json({ error:'quota_indisponible',
      message:"Le compteur d'analyses est momentanément indisponible. Réessayez." });
  }
  const reservation = resa.reservationId;
  const utilise = resa.used;
  const annuler = statut => cloturer(sb, reservation, statut || 'cancelled');

  let parsed = null;
  try {
    const body = { model: modele, max_tokens: 300, messages: [{ role:'user', content: prompt }] };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(p.url, { method:'POST', signal: ctrl.signal,
      headers: { 'Content-Type':'application/json', ...p.auth(key) }, body: JSON.stringify(body) });
    clearTimeout(t);
    const d = await r.json();
    if (!r.ok){
      await annuler('cancelled');
      return res.status(502).json({ error: 'fournisseur_en_erreur', provider: id, status: r.status });
    }
    const brut = id === 'anthropic' ? (d.content?.[0]?.text || '') : (d.choices?.[0]?.message?.content || '');
    parsed = JSON.parse(brut.replace(/```json|```/g, '').trim());

    /* Même principe que le schéma de l'analyse d'entreprise : rejet strict
       plutôt que coercition silencieuse. "sector" DOIT être une valeur
       réelle de SECTORS (ou "tous") — jamais une catégorie inventée que le
       frontend ne saurait pas appliquer à state.filters.radarSector. */
    if (
      !parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || (parsed.sector !== 'tous' && !SECTORS.includes(parsed.sector))
      || typeof parsed.country !== 'string'
      || !Number.isFinite(Number(parsed.scoreMin))
      || typeof parsed.explanation !== 'string'
    ){
      throw new Error('schema_screener_invalide');
    }
    parsed = {
      sector: parsed.sector,
      country: parsed.country.slice(0, 60),
      scoreMin: [0, 50, 60, 70].includes(Number(parsed.scoreMin)) ? Number(parsed.scoreMin) : 0,
      explanation: parsed.explanation.slice(0, 200),
    };
  } catch (e){
    await annuler('cancelled');
    return res.status(502).json({ error: e.name === 'AbortError' ? 'delai_depasse' : 'reponse_illisible', detail: e.message });
  }

  await cloturer(sb, reservation, 'ok', { provider:id, model:modele });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ filters: parsed, provider: id, model: modele, quota: quotaBlock(plan, utilise) });
}

module.exports = async (req, res) => {
  if (req.method === 'GET'){
    return res.status(200).json({
      providers: Object.fromEntries(Object.entries(PROVIDERS)
        .map(([k, v]) => [k, { configured: Boolean(process.env[v.env]),
          model: typeof v.model === 'function' ? v.model() : v.model }])),
      active: actif()[0]?.[0] || null,
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' });

  const user = await userFromToken(req);
  if (!user) return res.status(401).json({ error: 'non_connecte' });

  const dispo = actif();
  if (!dispo.length) {
    return res.status(503).json({ error: 'aucun_modele_configure',
      message: "Aucune clé de modèle n'est configurée sur le serveur." });
  }

  /* ---------- PLAN RÉEL ----------
     Lu dans Supabase. Un plan inconnu, absent ou dont l'abonnement n'est plus
     actif retombe sur free — jamais sur pro ni elite. */
  const { plan } = await planReel(sb, user.id);

  if (req.body?.mode === 'screener'){
    return screenerAnalyse(req, res, { user, plan, dispo });
  }

  const { ticker, exchange, name, country, sector, industry, currency, mode } = req.body || {};
  /* Niveau de langage (§45 du PRD) : ajuste UNIQUEMENT le ton/vocabulaire
     demandé au modèle, jamais le schéma JSON ni les règles anti-
     hallucination (identiques quel que soit le niveau) — validé par le
     même code que le mode "normal", aucune exception de schéma ici. */
  const niveauLangage = mode === 'expert'
    ? "Le lecteur est un investisseur expérimenté : utilise les termes financiers usuels (PER, marge, ROE...) sans les redéfinir."
    : "Le lecteur découvre la Bourse : évite le jargon financier non expliqué, ou explique-le en quelques mots simples dans la même phrase.";
  // Aucune entreprise par défaut : sans identification, aucun appel ne part.
  if (!ticker) return res.status(400).json({ error: 'entreprise_non_identifiee' });

  /* Le dossier financier est récupéré ICI, côté serveur. Le navigateur ne
     transmet plus aucun chiffre : il ne pourrait pas en garantir l'origine. */
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = `${proto}://${req.headers.host}`;
  let dossier = null;
  try {
    const r = await fetch(`${base}/api/market/company?ticker=${encodeURIComponent(ticker)}`
      + (exchange ? `&exchange=${encodeURIComponent(exchange)}` : ''));
    dossier = await r.json();
  } catch (e){
    console.error('[analyze] dossier :', e.message);
  }
  if (!dossier || dossier.error || !dossier.market){
    return res.status(424).json({ error: 'donnees_indisponibles',
      message: "Les données financières de cette société n'ont pas pu être récupérées.",
      detail: dossier?.error || dossier?.missing || null, journal: dossier?.journal || null });
  }

  /* IDENTITÉ — fusion serveur-prioritaire.
     dossier.identity vient de /api/market/company, alimenté par les
     fournisseurs financiers réels (EODHD General, etc.) : c'est TOUJOURS la
     source de vérité. Le frontend peut transmettre des métadonnées NON
     FINANCIÈRES déjà connues de NovaBourse (catalogue local, résultat de
     recherche, catalogue runtime restauré après refresh) ; elles ne
     comblent QUE les champs que le serveur n'a réellement pas pu déterminer
     — jamais l'inverse, et jamais un champ financier (aucun prix, aucun
     fondamental, aucun score n'est accepté depuis req.body ici). Chaque
     champ conserve sa provenance dans identitySource pour audit. */
  /* Validation stricte des métadonnées d'identité venant du client, AVANT
     toute utilisation : elles finissent dans le prompt envoyé au modèle, et
     /api/analyze est un endpoint public (authentifié, mais appelable
     directement, pas seulement depuis index.html). Cela réduit la surface
     d'entrée (type, longueur, caractères de contrôle) mais NE constitue PAS
     une protection absolue contre une injection de prompt : un texte court,
     bien formé et dans la limite de longueur peut rester sémantiquement
     problématique. Seule une séparation stricte entre données et
     instructions au niveau du prompt (hors périmètre de ce correctif)
     éliminerait le risque plus complètement.
     Règles appliquées ici : type string strict (un objet/tableau devient
     null, jamais sérialisé) ; caractères de contrôle retirés ; espaces
     superflus retirés ; longueur bornée par champ. Une valeur vide après
     nettoyage devient null — jamais une chaîne vide propagée comme
     "connue". */
  function texteIdentite(valeur, maxLen){
    if (typeof valeur !== 'string') return null;
    const nettoye = valeur.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    return nettoye ? nettoye.slice(0, maxLen) : null;
  }
  const identiteClient = {
    name: texteIdentite(name, 120),
    country: texteIdentite(country, 60),
    sector: texteIdentite(sector, 60),
    industry: texteIdentite(industry, 80),
    currency: texteIdentite(currency, 10),
  };
  const identitySource = {};
  const identity = { ...dossier.identity };
  for (const champ of Object.keys(identiteClient)) {
    const valeurServeur = identity[champ];
    const valeurClient = identiteClient[champ];
    if ((valeurServeur === null || valeurServeur === undefined) && valeurClient) {
      identity[champ] = valeurClient;
      identitySource[champ] = 'frontend';
    } else {
      identitySource[champ] = valeurServeur != null ? 'server' : null;
    }
  }
  dossier = { ...dossier, identity };

  /* NovaScore : calculé ICI, par notre moteur, à partir du dossier réel.
     Le modèle le recevra pour l'expliquer — jamais pour le produire. */
  const nova = novascore(dossier);

  /* VERROU DE QUOTA — CORRIGÉ.
     Avant ce correctif, ce verrou ne se déclenchait que si fundamentals ET
     history manquaient TOUS LES DEUX. Une société avec un historique réel
     mais sans fondamentaux (ex. NVIDIA : history OK, fundamentals absents)
     passait donc ce verrou, réservait le quota et appelait le modèle, alors
     même que le moteur NovaScore avait déjà correctement calculé une
     couverture < 40 % et refusé de produire une note (score:null).
     Le verrou se base maintenant directement sur ce que le moteur a déjà
     décidé — score:null ET son signal explicite `refused` (redondants par
     construction dans _novascore.js, vérifié : le seul chemin renvoyant
     score:null est le refus pour couverture insuffisante, qui pose toujours
     refused:'couverture_insuffisante') — plutôt que de dupliquer un second
     seuil arbitraire ici, susceptible de diverger de celui de
     _novascore.js. Aucune réservation, aucun appel au modèle ne doit avoir
     lieu avant ce test. */
  if (nova.score === null || nova.refused){
    return res.status(424).json({
      error: 'insufficient_data',
      message: "Couverture des données insuffisante pour produire un NovaScore "
        + "(minimum 40 % requis). Aucune analyse n'a été consommée.",
      coverage: nova.coverage,
      novaScore: null,
      missing: dossier.missing || [],
      quotaConsomme: false,
      sources: dossier.sources,
      journal: (dossier.journal || []).filter(j => !j.ok),
    });
  }

  const company = dossier.identity?.name || ticker;
  const context = {
    identite: dossier.identity,
    marche: dossier.market,
    fondamentaux: dossier.fundamentals,
    historique: dossier.history ? {
      seances: dossier.history.points,
      premier: dossier.history.ohlcv[0] || null,
      dernier: dossier.history.ohlcv[dossier.history.ohlcv.length - 1] || null,
      clotures: dossier.history.ohlcv.slice(-60).map(x => x.close),
    } : null,
    sources: dossier.sources,
    donneesManquantes: dossier.missing,
    novaScore: nova.score,
    novaDetail: nova.score === null ? null : {
      couverture: nova.coverage, coherence: nova.coherence, confiance: nova.confidence,
      familles: Object.fromEntries(Object.entries(nova.families)
        .map(([k, v]) => [v.label, v.score])),
      metriquesAbsentes: Object.values(nova.families).flatMap(v => v.missing),
    },
  };

  const [id, p] = dispo[0];
  const key = process.env[p.env];
  const modele = typeof p.model === 'function' ? p.model() : p.model;
  const prompt = `${CONSIGNE}

${niveauLangage}

Entreprise : ${company} (${ticker})
Données disponibles :
${JSON.stringify(context || {}, null, 1)}

Si une donnée n'apparaît pas ci-dessus ou vaut null, elle est INDISPONIBLE :
ne la remplace par aucune estimation, et signale-le dans "negative" si elle est
importante pour juger l'entreprise.

Le NovaScore est calculé par NovaBourse à partir de ces chiffres. Tu peux
l'expliquer ou relever ce qui te semble en tension avec lui, mais tu ne produis
jamais et ne modifies jamais de note.`;

  /* ---------- RÉSERVATION ATOMIQUE ----------
     Postgres compte et insère dans une seule transaction, sous verrou par
     utilisateur : deux clics simultanés ne peuvent pas dépasser la limite.
     Si la réservation est impossible, on s'arrête ici : jamais d'appel au
     fournisseur sans trace de consommation. */
  const resa = await reserver(sb, user.id, plan);
  if (!resa.ok){
    if (resa.reason === 'quota_exceeded'){
      const q = quotaBlock(plan, resa.used ?? limiteDe(plan));
      return res.status(429).json({ error:'quota_exceeded',
        message:`Vous avez utilisé vos ${limiteDe(plan)} analyses incluses ce mois-ci.`, ...q });
    }
    if (resa.reason === 'rate_limited'){
      return res.status(429).json({ error:'rate_limited',
        message:"Trop d'analyses lancées en peu de temps. Réessayez dans quelques minutes.",
        plan });
    }
    console.error('[analyze] réservation impossible :', resa.detail || resa.reason);
    return res.status(503).json({ error:'quota_indisponible',
      message:"Le compteur d'analyses est momentanément indisponible. Réessayez." });
  }
  const reservation = resa.reservationId;
  /* reserve_analysis renvoie v_mois + 1 : la réservation qui vient d'être
     insérée est DÉJÀ comptée. On ne rajoute donc rien à cette valeur. */
  const utilise = resa.used;

  const annuler = statut => cloturer(sb, reservation, statut || 'cancelled');

  let parsed = null, brut = '', usage = null;
  try {
    const body = { model: modele, max_tokens: 900,
      messages: [{ role:'user', content: prompt }] };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(p.url, { method:'POST', signal: ctrl.signal,
      headers: { 'Content-Type':'application/json', ...p.auth(key) }, body: JSON.stringify(body) });
    clearTimeout(t);
    const d = await r.json();
    if (!r.ok){
      console.error('[analyze]', id, r.status, JSON.stringify(d).slice(0, 300));
      await annuler('cancelled');
      return res.status(502).json({ error: 'fournisseur_en_erreur', provider: id,
        status: r.status, detail: d?.error?.message || d?.error || null });
    }
    brut = id === 'anthropic' ? (d.content?.[0]?.text || '') : (d.choices?.[0]?.message?.content || '');
    parsed = JSON.parse(brut.replace(/```json|```/g, '').trim());

    /* SCHÉMA STRICT — VALIDATION AVANT NORMALISATION.
       Un modèle peut renvoyer un JSON syntaxiquement valide mais qui ne
       respecte pas le contrat attendu (verdict hors énumération, uncertainty
       hors énumération, summary/positive/negative absents ou du mauvais
       type). Une telle réponse est REJETÉE explicitement (throw), pas
       silencieusement coercée en null/[] : la consommer comme un "200 avec
       verdict:null" produirait une analyse facturée au quota alors que le
       modèle n'a en réalité pas respecté le contrat — ce que ce correctif
       supprime. Le rejet remonte au catch englobant, qui annule la
       réservation ('cancelled') et renvoie 502 : aucune analyse n'est donc
       jamais consommée définitivement dans ce cas.
       Seulement une fois cette validation passée, les champs sont bornés en
       longueur et les éléments non-string filtrés des tableaux — ça, c'est
       de la normalisation, pas une validation de conformité. */
    const VERDICTS_AUTORISES = new Set(['positif', 'neutre', 'negatif', 'insuffisant']);
    const INCERTITUDES_AUTORISEES = new Set(['faible', 'moyenne', 'elevee']);
    if (
      !parsed || typeof parsed !== 'object' || Array.isArray(parsed)
      || !VERDICTS_AUTORISES.has(parsed.verdict)
      || !INCERTITUDES_AUTORISEES.has(parsed.uncertainty)
      || typeof parsed.summary !== 'string'
      || !Array.isArray(parsed.positive)
      || !Array.isArray(parsed.negative)
    ){
      throw new Error('schema_analyse_invalide');
    }
    const listeBornee = (v, maxItems, maxLen) => v
      .filter(x => typeof x === 'string')
      .slice(0, maxItems)
      .map(x => x.slice(0, maxLen));
    parsed = {
      /* Optionnel plutôt que rejeté si absent (contrairement à
         verdict/uncertainty/summary/positive/negative ci-dessus) : c'est un
         nouveau champ, un modèle qui l'omettrait de temps en temps ne doit
         pas transformer une analyse par ailleurs valide en échec facturé au
         quota. Chaîne vide affichée comme "non fournie", jamais devinée. */
      whatItDoes: typeof parsed.whatItDoes === 'string' ? parsed.whatItDoes.slice(0, 300) : '',
      verdict: parsed.verdict,               // déjà validé dans l'énumération ci-dessus
      uncertainty: parsed.uncertainty,       // déjà validé dans l'énumération ci-dessus
      summary: parsed.summary.slice(0, 600),
      positive: listeBornee(parsed.positive, 6, 220),
      negative: listeBornee(parsed.negative, 6, 220),
    };

    usage = d.usage || null;
  } catch (e) {
    console.error('[analyze]', id, e.message);
    await annuler('cancelled');
    return res.status(502).json({ error: e.name === 'AbortError' ? 'delai_depasse' : 'reponse_illisible',
      provider: id, detail: e.message });
  }

  /* VERROU. Deux filtres, puis une construction explicite de la réponse.
     1. tout champ numérique produit par le modèle est retiré ;
     2. tout champ dont le NOM évoque une note l'est aussi, quel que soit son
        type — « "78/100" » en texte serait sinon passé ;
     3. le NovaScore renvoyé plus bas provient de l'objet du moteur : la
        valeur du modèle n'a aucun chemin vers l'affichage. */
  const INTERDITS = /(^|_)(score|note|rating|novascore|target|objectif|prob|probability|confidence|valuation|price)/i;
  const retires = [];
  for (const k of Object.keys(parsed)) {
    if (typeof parsed[k] === 'number' || INTERDITS.test(k)) {
      retires.push(k); delete parsed[k];
    }
  }

  /* VERROU ANTI-HALLUCINATION EN TEXTE LIBRE.
     Le filtre ci-dessus ne retire qu'un chiffre porté DIRECTEMENT par une
     valeur JSON numérique ou un nom de champ suspect. Il laisse passer un
     chiffre inventé glissé dans une phrase ("summary", "positive[]",
     "negative[]"), ex. {"summary":"Le PER est de 31,4"} sans que 31,4 ne
     figure nulle part dans le contexte réellement transmis au modèle.
     Principe : construire l'ensemble des nombres RÉELLEMENT présents dans
     `context` (chaque valeur, plus sa forme ×100 pour couvrir un ratio cité
     en pourcentage, arrondie à 0/1/2 décimales pour tolérer un arrondi du
     modèle), puis, pour chaque nombre repéré dans le texte, ne le laisser
     passer que s'il correspond à l'une de ces valeurs autorisées. Un
     nombre qui ne correspond à rien de fourni est remplacé par un
     marqueur — jamais toute la phrase : le modèle garde le droit de citer
     un vrai chiffre du contexte. Compromis assumé : un nombre non financier
     bénin (ex. "deux segments") peut être retiré s'il ne correspond à
     aucune valeur du contexte ; c'est jugé préférable à laisser passer un
     chiffre financier inventé. */
  function nombresAutorises(valeur, acc){
    if (typeof valeur === 'number' && Number.isFinite(valeur)){
      for (const v of [valeur, valeur * 100]){
        for (const d of [0, 1, 2]) acc.add(v.toFixed(d));
      }
    } else if (Array.isArray(valeur)){
      valeur.forEach(v => nombresAutorises(v, acc));
    } else if (valeur && typeof valeur === 'object'){
      Object.values(valeur).forEach(v => nombresAutorises(v, acc));
    }
    return acc;
  }
  const autorises = nombresAutorises(context, new Set());
  let nombresRetires = 0;
  function assainirTexte(texte){
    if (typeof texte !== 'string') return texte;
    return texte.replace(/-?\d+(?:[.,]\d+)?/g, jeton => {
      const n = Number(jeton.replace(',', '.'));
      if (!Number.isFinite(n)) return jeton;
      for (const d of [0, 1, 2]) {
        if (autorises.has(n.toFixed(d))) return jeton;
      }
      nombresRetires++;
      return '[donnée non vérifiée]';
    });
  }
  if (typeof parsed.whatItDoes === 'string') parsed.whatItDoes = assainirTexte(parsed.whatItDoes);
  if (typeof parsed.summary === 'string') parsed.summary = assainirTexte(parsed.summary);
  if (Array.isArray(parsed.positive)) parsed.positive = parsed.positive.map(assainirTexte);
  if (Array.isArray(parsed.negative)) parsed.negative = parsed.negative.map(assainirTexte);

  await cloturer(sb, reservation, 'ok', { provider:id, model:modele,
    tokens_in: usage?.prompt_tokens ?? null, tokens_out: usage?.completion_tokens ?? null });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    // Tant qu'aucun fournisseur de marché n'est configuré, l'analyse ne porte
    // pas sur des cotations réelles : le serveur le déclare, le client l'affiche.
    // Vrai uniquement si au moins un fournisseur a réellement répondu.
    marketConnected: Boolean(dossier.sources
      && (dossier.sources.quote || dossier.sources.fundamentals || dossier.sources.history)),
    // Provenance réelle de chaque bloc de données transmis au modèle.
    sources: dossier.sources,
    asOf: dossier.asOf,
    missing: dossier.missing,
    // Motif d'échec de chaque fournisseur : sans lui, un bloc manquant reste
    // inexplicable et le diagnostic prend des heures.
    journal: (dossier.journal || []).filter(j => !j.ok),
    identity: dossier.identity,
    // Provenance de chaque champ d'identité (server = /api/market/company,
    // frontend = complété depuis les métadonnées transmises par le client,
    // null = inconnu des deux côtés). Purement diagnostique.
    identitySource,
    market: dossier.market,
    analysis: parsed, provider: id, model: modele, tokens: usage,
    // Nombre de chiffres en texte libre retirés faute de correspondre à une
    // valeur réellement transmise au modèle (voir verrou anti-hallucination).
    unverifiedNumbersRemoved: nombresRetires,
    // Seule note affichable : celle du moteur. Jamais celle du modèle.
    novascore: {
      engine: nova.engine, score: nova.score, coverage: nova.coverage,
      coherence: nova.coherence, confidence: nova.confidence,
      comparable: nova.comparable ?? false, refused: nova.refused,
      families: Object.fromEntries(Object.entries(nova.families)
        .map(([k, v]) => [k, { label: v.label, score: v.score,
          weight: nova.weightsApplied[k] ?? 0,          // poids appliqué au score
          baseWeight: v.baseWeight,                     // poids théorique
          coverageWeight: v.coverageWeight,             // poids réellement couvert
          missing: v.missing }])),
      computedAt: nova.computedAt,
    },
    numericStripped: retires, quota: quotaBlock(plan, utilise),
  });
};
