/**
 * POST /api/analyze — analyse par modèle de langage.
 * Quota appliqué côté serveur selon le plan. Clés jamais exposées.
 * Règle inchangée : le modèle rend un verdict qualitatif et des facteurs en
 * texte. Aucun chiffre produit par lui n'est conservé.
 */
const { userFromToken, sb, LIMITS } = require('./me.js');

const PROVIDERS = {
  openai:    { env:'OPENAI_API_KEY',    url:'https://api.openai.com/v1/chat/completions',
               model:'gpt-4.1-mini', auth: k => ({ Authorization:`Bearer ${k}` }) },
  anthropic: { env:'ANTHROPIC_API_KEY', url:'https://api.anthropic.com/v1/messages',
               model:'claude-sonnet-4-5', auth: k => ({ 'x-api-key':k, 'anthropic-version':'2023-06-01' }) },
  xai:       { env:'XAI_API_KEY',       url:'https://api.x.ai/v1/chat/completions',
               model:'grok-3-mini', auth: k => ({ Authorization:`Bearer ${k}` }) },
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'methode_non_autorisee' });

  const user = await userFromToken(req);
  if (!user) return res.status(401).json({ error: 'non_connecte' });

  const dispo = actif();
  if (!dispo.length) {
    return res.status(503).json({ error: 'aucun_modele_configure',
      message: "Aucune clé de modèle n'est configurée sur le serveur." });
  }

  // Plan et quota, lus en base.
  let plan = 'free';
  try {
    const rows = await sb(`profiles?id=eq.${user.id}&select=plan,subscription_status`);
    const p = rows[0];
    if (p && ['active','trialing','past_due'].includes(p.subscription_status)) plan = p.plan || 'free';
  } catch {}
  const quota = LIMITS[plan].analyses;

  const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
  let utilise = 0;
  try {
    const rows = await sb(`ai_usage?user_id=eq.${user.id}&created_at=gte.${debutMois.toISOString()}&select=id`);
    utilise = rows.length;
  } catch {}
  if (utilise >= quota) {
    return res.status(402).json({ error: 'quota_atteint', limite: quota, utilise,
      upgradeTo: plan === 'free' ? 'pro' : 'elite' });
  }

  const { context, company } = req.body || {};
  if (!context || !company) return res.status(400).json({ error: 'contexte_manquant' });

  const [id, p] = dispo[0];
  const key = process.env[p.env];
  const prompt = `${CONSIGNE}\n\nEntreprise : ${company}\nDonnées :\n${JSON.stringify(context)}`;

  let parsed = null, brut = '';
  try {
    const body = id === 'anthropic'
      ? { model: p.model, max_tokens: 700, messages: [{ role:'user', content: prompt }] }
      : { model: p.model, max_tokens: 700, messages: [{ role:'user', content: prompt }] };
    const r = await fetch(p.url, { method:'POST',
      headers: { 'Content-Type':'application/json', ...p.auth(key) }, body: JSON.stringify(body) });
    const d = await r.json();
    brut = id === 'anthropic' ? (d.content?.[0]?.text || '') : (d.choices?.[0]?.message?.content || '');
    parsed = JSON.parse(brut.replace(/```json|```/g, '').trim());
  } catch (e) {
    return res.status(502).json({ error: 'reponse_illisible', provider: id });
  }

  // Filet : tout champ numérique produit par le modèle est retiré.
  const retires = [];
  for (const k of Object.keys(parsed)) {
    if (typeof parsed[k] === 'number' || /prob|score|target|objectif|confidence/i.test(k)) {
      retires.push(k); delete parsed[k];
    }
  }

  sb('ai_usage', { method:'POST', headers:{ Prefer:'return=minimal' },
    body: JSON.stringify([{ user_id:user.id, provider:id, model:p.model }]) }).catch(() => {});

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    analysis: parsed, provider: id, model: p.model,
    numericStripped: retires, quota: { limite: quota, utilise: utilise + 1 },
  });
};
