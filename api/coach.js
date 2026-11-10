/**
 * POST /api/coach — Nova Coach, le coach pédagogique de l'école.
 *
 * Contrat (js/ai.js, mode « api ») :
 *   requête  { task, prompt, turns, json }
 *   réponse  { text }
 *
 * Règles :
 *   - Élève connecté obligatoire (jeton Supabase dans Authorization).
 *     Le jeton sert UNIQUEMENT à connaître l'identifiant de l'élève, pour
 *     la limite de messages. Son nom et son e-mail ne sont jamais lus,
 *     jamais journalisés, jamais envoyés à l'IA.
 *   - Les règles du coach (aucun conseil d'achat ou de vente, argent
 *     fictif…) sont écrites ICI, côté serveur : le navigateur ne peut pas
 *     les modifier.
 *   - Adresses e-mail et numéros de téléphone tapés par l'élève sont
 *     effacés avant l'envoi.
 *   - Limite de messages par mois selon l'offre + limite par heure
 *     (api/_limits.js), réservée AVANT l'appel à l'IA.
 *   - Clé ANTHROPIC_API_KEY : variable Vercel, jamais dans le navigateur.
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const { userFromToken, sb } = require('./me.js');
const { planReel, reserverCoach, cloturerCoach, limiteCoach, COACH_PAR_HEURE } = require('./_limits.js');

const SONNET = 'claude-sonnet-5-5';
const HAIKU = 'claude-haiku-5-5';

/* Tâches envoyées par le site. Les explications courtes partent sur
   Haiku (rapide, économique) ; le reste sur Sonnet. Effort bas pour la
   conversation, moyen pour les bilans et la relecture d'un plan. */
const TACHES = {
  coach:     { model: SONNET, effort: 'low' },
  question:  { model: SONNET, effort: 'low' },
  deblocage: { model: SONNET, effort: 'low' },
  salle:     { model: SONNET, effort: 'low' },
  bilan:     { model: SONNET, effort: 'medium' },
  plan:      { model: SONNET, effort: 'medium' },
  explique:  { model: HAIKU,  effort: 'low' },
};

const MAX_PROMPT = 12000;   // caractères
const MAX_TOUR = 4000;      // caractères par message de la conversation
const MAX_TOURS = 30;

/* Règles du coach — reprises de js/ai.js et complétées. */
const REGLES = `Tu es Nova Coach, le coach pédagogique de NovaTitre, une école de bourse et de trading en ligne (simulateur, argent fictif uniquement).
Règles absolues :
- Tu expliques et tu fais progresser. Tu ne donnes JAMAIS de conseil en investissement personnalisé : jamais « achète », « vends » ou « garde » un titre réel, jamais de sélection de titres réels pour la personne, jamais de signal d'achat ou de vente, jamais de promesse ni de prévision de gains.
- Si on te demande quoi acheter : explique que tu ne peux pas, propose la check-list (horizon, épargne de précaution, perte supportable, diversification, frais) et une mission de l'école.
- NovaTitre n'est pas un intermédiaire financier : aucun ordre réel, aucun courtier partenaire. Tout se passe avec de l'argent fictif.
- Les certificats de l'école s'appellent « Certificat NovaTitre (certificat interne) ». Ce ne sont pas des diplômes : ne les présente jamais comme tels.
- Tu es une intelligence artificielle et tu peux te tromper ; pour les règles fiscales, rappelle de vérifier sur les sources officielles (impots.gouv.fr, AMF).
- Pas de crypto, CFD, forex ou levier présentés comme des opportunités : seulement pour comprendre leurs risques.
- Français simple, phrases courtes, tutoiement, ton chaleureux et motivant, jamais culpabilisant. Pas de jargon sans l'expliquer. Pas d'emoji.
- Tu t'appuies uniquement sur les données fournies. N'invente pas de statistiques sur l'élève.
- Tu ne connais ni le nom ni l'e-mail de l'élève, et tu ne les demandes pas.`;

const CONSIGNE_JSON = `Réponds uniquement avec du JSON valide, sans aucun texte autour et sans bloc de code.`;

const REFUS_TEXTE = 'Je ne peux pas t’aider sur ce point. Reformule ta question autrement, ou pose-moi une question sur une mission de l’école.';

/* Efface ce qui pourrait identifier l'élève s'il l'a tapé lui-même. */
function effacerDonneesPerso(texte) {
  return String(texte)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[e-mail retiré]')
    .replace(/(?:\+\d{2,3}[\s.-]?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g, '[numéro retiré]');
}

/* Valide et met en forme la demande du site. Retourne null si invalide. */
function lireDemande(body) {
  const b = body && typeof body === 'object' ? body : null;
  if (!b || typeof b.prompt !== 'string' || !b.prompt.trim()) return null;
  if (b.prompt.length > MAX_PROMPT) return null;

  const tache = Object.prototype.hasOwnProperty.call(TACHES, b.task) ? b.task : 'coach';

  let tours = [];
  if (b.turns != null) {
    if (!Array.isArray(b.turns) || b.turns.length > MAX_TOURS) return null;
    for (const t of b.turns) {
      if (!t || (t.role !== 'user' && t.role !== 'assistant')) return null;
      if (typeof t.content !== 'string' || t.content.length > MAX_TOUR) return null;
      tours.push({ role: t.role, content: effacerDonneesPerso(t.content) });
    }
  }

  /* Même ordre que le mode « claude » de js/ai.js : la demande d'abord,
     puis la conversation. Le dernier message doit venir de l'élève. */
  const messages = [{ role: 'user', content: effacerDonneesPerso(b.prompt) }, ...tours];
  while (messages.length > 1 && messages[messages.length - 1].role !== 'user') messages.pop();

  return { tache, json: b.json === true, messages };
}

function lireCorps(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

let client = null;
const claude = () => client || (client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 50_000,
  maxRetries: 1,
}));

async function demanderAClaude({ tache, json, messages }) {
  const { model, effort } = TACHES[tache];
  const system = json ? `${REGLES}\n\n${CONSIGNE_JSON}` : REGLES;
  const base = {
    model,
    max_tokens: 8000,
    system,
    output_config: { effort },
    messages,
  };

  /* Sonnet : repli automatique côté serveur si un filtre de sécurité
     refuse la demande. Haiku n'a pas de repli : on gère le refus. */
  const reponse = model === SONNET
    ? await claude().beta.messages.create({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
    : await claude().messages.create(base);

  if (reponse.stop_reason === 'refusal') return { refus: true, model };

  const text = reponse.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  return { text, model: reponse.model || model };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'coach_non_configure' });
  }

  /* Seul l'identifiant est gardé : rien d'autre du profil ne circule. */
  const utilisateur = await userFromToken(req);
  const userId = utilisateur && utilisateur.id;
  if (!userId) {
    return res.status(401).json({ error: 'non_connecte' });
  }

  const demande = lireDemande(lireCorps(req));
  if (!demande) {
    return res.status(400).json({ error: 'demande_invalide' });
  }

  const { plan } = await planReel(sb, userId);
  const { model } = TACHES[demande.tache];

  const place = await reserverCoach(sb, userId, plan, model);
  if (!place.ok) {
    if (place.reason === 'quota_exceeded') {
      return res.status(429).json({ error: 'limite_mensuelle', limit: limiteCoach(plan) });
    }
    if (place.reason === 'rate_limited') {
      return res.status(429).json({ error: 'limite_horaire', limit: COACH_PAR_HEURE });
    }
    /* Base injoignable : on refuse plutôt que d'appeler l'IA sans compter. */
    return res.status(503).json({ error: 'limite_indisponible' });
  }

  try {
    const r = await demanderAClaude(demande);

    if (r.refus) {
      await cloturerCoach(sb, place.reservationId, 'ok');
      if (demande.json) return res.status(502).json({ error: 'refus' });
      return res.status(200).json({ text: REFUS_TEXTE });
    }

    await cloturerCoach(sb, place.reservationId, 'ok');
    return res.status(200).json({ text: r.text });

  } catch (e) {
    /* L'échec n'est pas décompté. Aucun contenu de l'élève n'est
       journalisé : seulement le type d'erreur. */
    await cloturerCoach(sb, place.reservationId, 'failed');

    if (e instanceof Anthropic.RateLimitError) {
      console.error('[coach] limite Anthropic atteinte');
      return res.status(429).json({ error: 'ia_surchargee' });
    }
    if (e instanceof Anthropic.APIError) {
      console.error('[coach] erreur Anthropic', e.status);
      return res.status(e.status === 529 ? 503 : 502).json({ error: 'ia_indisponible' });
    }
    console.error('[coach] erreur', e && e.name);
    return res.status(502).json({ error: 'ia_indisponible' });
  }
};

module.exports._test = { lireDemande, effacerDonneesPerso, REGLES, TACHES };
