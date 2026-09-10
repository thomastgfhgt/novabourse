/**
 * POST /api/analyze — analyse par modèle de langage.
 * Quota appliqué côté serveur selon le plan. Clés jamais exposées.
 * Règle inchangée : le modèle rend un verdict qualitatif et des facteurs en
 * texte. Aucun chiffre produit par lui n'est conservé.
 */
const { userFromToken, sb } = require('./me.js');
const { PLAN_LIMITS, planReel, limiteDe, consommation, reserver, cloturer, quotaBlock } = require('./_limits.js');

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

const CONSIGNE = `Tu analyses une entreprise cotée à partir des seuls chiffres fournis.
Réponds en JSON strict : {"verdict":"positif|neutre|negatif|insuffisant","uncertainty":"faible|moyenne|elevee","summary":"...","positive":["..."],"negative":["..."]}
Règles absolues :
- N'invente aucun chiffre. Ne cite que ceux du contexte.
- Ne produis aucun objectif de cours, aucune probabilité, aucun pourcentage de réussite.
- Ne recommande jamais d'acheter ou de vendre.
- Si les données manquent, réponds "insuffisant".`;

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

  const { ticker, exchange } = req.body || {};
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
  };

  const [id, p] = dispo[0];
  const key = process.env[p.env];
  const modele = typeof p.model === 'function' ? p.model() : p.model;
  const prompt = `${CONSIGNE}

Entreprise : ${company} (${ticker})
Données disponibles :
${JSON.stringify(context || {}, null, 1)}

Si une donnée n'apparaît pas ci-dessus ou vaut null, elle est INDISPONIBLE :
ne la remplace par aucune estimation, et signale-le dans "negative" si elle est
importante pour juger l'entreprise.`;

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
    usage = d.usage || null;
  } catch (e) {
    console.error('[analyze]', id, e.message);
    await annuler('cancelled');
    return res.status(502).json({ error: e.name === 'AbortError' ? 'delai_depasse' : 'reponse_illisible',
      provider: id, detail: e.message });
  }

  // Filet : tout champ numérique produit par le modèle est retiré.
  const retires = [];
  for (const k of Object.keys(parsed)) {
    if (typeof parsed[k] === 'number' || /prob|score|target|objectif|confidence/i.test(k)) {
      retires.push(k); delete parsed[k];
    }
  }

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
    identity: dossier.identity,
    market: dossier.market,
    analysis: parsed, provider: id, model: modele, tokens: usage,
    numericStripped: retires, quota: quotaBlock(plan, utilise),
  });
};
