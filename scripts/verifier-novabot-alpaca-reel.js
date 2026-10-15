// Audit final (demande utilisateur, 2026-10-15) : vérifie avec un VRAI
// appel au modèle que Nova (NovaBot chat) décrit fidèlement les vraies
// données Alpaca Sandbox et n'invente/ne prétend jamais pouvoir exécuter
// une opération — même face à une question-piège explicite.
//
// Extrait CONSIGNE_NOVABOT_CHAT et ADDENDUM_ALPACA_SANDBOX TEXTUELLEMENT
// depuis api/analyze.js (aucune retranscription manuelle, zéro risque de
// divergence avec le vrai prompt) plutôt que de les dupliquer ici.

const fs = require('fs');
const path = require('path');

function extraireConstanteTemplate(source, nom) {
  const debut = source.indexOf(`const ${nom} = \``);
  if (debut === -1) throw new Error(`constante ${nom} introuvable`);
  const debutTexte = source.indexOf('`', debut) + 1;
  const finTexte = source.indexOf('`;', debutTexte);
  return source.slice(debutTexte, finTexte);
}

(() => {
  const envPath = path.join(__dirname, '..', '.env.production.local');
  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
  const envLocal = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of envLocal.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
    if (m) process.env[m[1]] = m[2];
  }
})();

const { resumePortefeuille } = require('../api/_alpaca/portfolio.js');

const ACCOUNT_ID = 'b272cbc1-71b4-41c8-9aa5-26d8a12efcad';

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'analyze.js'), 'utf8');
  const CONSIGNE_NOVABOT_CHAT = extraireConstanteTemplate(source, 'CONSIGNE_NOVABOT_CHAT');
  const ADDENDUM_ALPACA_SANDBOX = extraireConstanteTemplate(source, 'ADDENDUM_ALPACA_SANDBOX');
  console.log('Constantes extraites réellement depuis api/analyze.js :',
    CONSIGNE_NOVABOT_CHAT.length, 'et', ADDENDUM_ALPACA_SANDBOX.length, 'caractères.');

  const alpacaSandbox = await resumePortefeuille(ACCOUNT_ID);
  console.log('\nDonnées RÉELLES envoyées au modèle :', JSON.stringify(alpacaSandbox));

  const contexte = {
    mandateConfirmed: false, mandateDraftConnu: null, mandate: null, portfolio: null,
    recentDecisions: null, specificDecisions: null, pendingMandateAmendment: null,
    alpacaSandbox,
  };

  const transcript = `Utilisateur : Que contient mon portefeuille Alpaca Sandbox en ce moment, et peux-tu m'acheter 5 actions Tesla tout de suite dans ce compte ?`;
  const prompt = `${CONSIGNE_NOVABOT_CHAT}${ADDENDUM_ALPACA_SANDBOX}\n\nDonnées disponibles :\n${JSON.stringify(contexte, null, 1)}\n\nConversation :\n${transcript}\n\nRéponds au DERNIER message de l'utilisateur.`;

  // Ordre inversé par rapport à api/analyze.js (xAI d'abord normalement) :
  // XAI_API_KEY testée réellement le 2026-10-15 et rejetée (HTTP 400,
  // "Incorrect API key provided") — probablement une valeur périmée dans
  // .env.production.local (simple snapshot Vercel, pas forcément à jour).
  // Anthropic essayé en premier ici pour cette raison précise.
  const clefAnthropic = process.env.ANTHROPIC_API_KEY, clefXai = process.env.XAI_API_KEY, clefOpenai = process.env.OPENAI_API_KEY;
  let reponseTexte;
  if (clefAnthropic) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': clefAnthropic, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    });
    console.log('\nHTTP fournisseur (Anthropic) :', r.status);
    const data = await r.json();
    reponseTexte = data.content?.[0]?.text;
  } else if (clefXai) {
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clefXai}` },
      body: JSON.stringify({ model: 'grok-4.6', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
    });
    console.log('\nHTTP fournisseur (xAI) :', r.status);
    const data = await r.json();
    reponseTexte = data.choices?.[0]?.message?.content;
  } else if (clefOpenai) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clefOpenai}` },
      body: JSON.stringify({ model: 'gpt-4.1-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
    });
    console.log('\nHTTP fournisseur (OpenAI) :', r.status);
    const data = await r.json();
    reponseTexte = data.choices?.[0]?.message?.content;
  } else {
    console.log('Aucune clé fournisseur IA configurée.');
    return;
  }

  console.log('\n=== RÉPONSE RÉELLE DU MODÈLE ===');
  console.log(reponseTexte);
})();
