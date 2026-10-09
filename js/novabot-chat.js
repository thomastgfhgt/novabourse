/* ============================================================
   NOVABOT — CONVERSATIONS MULTIPLES + MOTEUR (refonte UX complète,
   2026-10-08)
   ------------------------------------------------------------
   Retour utilisateur explicite : "je veux une véritable expérience
   comparable à ChatGPT [...] plusieurs conversations ne signifient PAS
   plusieurs portefeuilles [...] toutes les conversations accèdent au
   MÊME portefeuille, au MÊME mandat et à la MÊME mémoire structurée."
   Donc : NOVABOT_CONVERSATIONS gère la LISTE (plusieurs fils), NOVABOT_CHAT
   gère le fil ACTIF — mais tout ce qui est "intelligence financière"
   (state.novabot.wallet/mandat/decisions) reste unique et partagé, lu en
   direct depuis state.novabot à chaque appel, jamais dupliqué par
   conversation.

   Persistance : toujours nova_conversations/nova_messages (?resource=
   conversations, api/me.js), aucune nouvelle table. Auto-titrage : les
   50 premiers caractères du premier message utilisateur — volontairement
   PAS un appel modèle dédié (coût/complexité non justifiés pour un titre
   de liste), limite assumée documentée au rapport.
   Pas de streaming serveur réel (3 fournisseurs IA aux API de streaming
   différentes, hors de portée raisonnable de cette passe) : la réponse
   complète est récupérée puis révélée progressivement côté client
   (novabotRevelerProgressivement()) pour l'impression de fluidité
   demandée, sans la complexité d'un vrai flux SSE multi-fournisseurs. */

let NOVABOT_UI = { view:'chat', sidebarOpen:false, portfolioPeriod:'1A' };
let NOVABOT_CONVERSATIONS = { loaded:false, loading:false, list:[], search:'' };
/* controller/revealTimer (§2, bouton "Stop") : jamais persistés, purement
   l'état d'une requête/animation en cours côté client. */
let NOVABOT_CHAT = { conversationId:null, messages:[], mandateDraft:{}, sending:false, readyToConfirm:false, loadingThread:false, streamingText:null, controller:null, revealTimer:null };

/* ---------- données réelles transmises à Nova Core (inchangé) ---------- */
function novabotDecisionsPertinentes(texte){
  if (!texte) return [];
  const t = texte.toLowerCase();
  const vus = new Set();
  const trouvees = [];
  for (const d of [...state.novabot.decisions].reverse()){
    if (!d.ticker && !d.name) continue;
    const correspond = (d.ticker && t.includes(d.ticker.toLowerCase()))
      || (d.name && d.name.length > 2 && t.includes(d.name.toLowerCase()));
    if (!correspond || vus.has(d.id)) continue;
    vus.add(d.id);
    trouvees.push(d);
    if (trouvees.length >= 10) break;
  }
  return trouvees;
}
function novabotDecisionCompacte(d){
  return { date:d.date, action:d.action, ticker:d.ticker, name:d.name, priceObserved:d.priceObserved,
    qty:d.qty, amountEUR:d.amountEUR, weightBeforePct:d.weightBeforePct, weightAfterPct:d.weightAfterPct,
    reason:d.reason, executionStatus:d.executionStatus };
}
function novabotChatContexte(dernierMessage){
  const confirme = state.novabot.mandateConfirmed;
  if (!confirme){
    return { mandateConfirmed:false, mandateDraft: NOVABOT_CHAT.mandateDraft };
  }
  const pf = novabotPortfolioValue();
  const positions = state.novabot.wallet.positions.map(p => {
    const st = byId[p.id];
    const valeurEUR = st ? toEUR(p.avg * p.qty, st.cur) : null;
    return { ticker: st?.ticker || p.id, name: st?.name || p.id, qty:p.qty, avgPrice:p.avg,
      weightPct: (valeurEUR !== null && pf.total > 0) ? (valeurEUR / pf.total) * 100 : null };
  });
  const mandate = novabotMandat();
  const recentes = state.novabot.decisions.slice(-15).map(novabotDecisionCompacte);
  const specifiques = novabotDecisionsPertinentes(dernierMessage).map(novabotDecisionCompacte);
  return {
    mandateConfirmed:true,
    mandate: { objective:mandate.objective, riskLevel:mandate.riskLevel,
      horizonYears:mandate.horizonYears, cashMinPct:mandate.cashMinPct, maxPositionPct:mandate.maxPositionPct,
      hardRules:mandate.hardRules, autonomyMode:state.novabot.autonomyMode },
    portfolio: { cash:state.novabot.wallet.cash, totalValue:pf.total, realizedPnL:state.novabot.wallet.realizedPnL,
      positions, lastRunAt: state.novabot.lastRunAt ? new Date(state.novabot.lastRunAt).toISOString() : null },
    recentDecisions: recentes,
    specificDecisions: specifiques.length ? specifiques : null,
  };
}

/* ---------- liste des conversations ---------- */
async function novabotConversationsCharger(){
  if (NOVABOT_CONVERSATIONS.loaded || NOVABOT_CONVERSATIONS.loading) return;
  NOVABOT_CONVERSATIONS.loading = true;
  try {
    const r = await authFetch('/api/me?resource=conversations');
    if (r.ok){
      const data = await r.json();
      NOVABOT_CONVERSATIONS.list = (data.conversations || [])
        .filter(c => c.module === 'novabot')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
  } catch (e){ console.warn('[novabot-chat] liste conversations impossible :', e); }
  NOVABOT_CONVERSATIONS.loading = false;
  NOVABOT_CONVERSATIONS.loaded = true;

  if (NOVABOT_CONVERSATIONS.list.length){
    await novabotConversationOuvrir(NOVABOT_CONVERSATIONS.list[0].id);
  } else {
    await novabotConversationNouvelle();
  }
}

function novabotAccueilTexte(){
  if (!state.novabot.mandateConfirmed){
    return `Bonjour, je suis Nova. Je vais gérer un portefeuille simulé pour toi — jamais d'argent réel. Pour commencer : quel capital souhaites-tu me confier, et pour quel objectif ?`;
  }
  const pf = novabotPortfolioValue();
  return `Bonjour, ton portefeuille NovaBot vaut actuellement ${fmt.eur(pf.total)}. Demande-moi par exemple « que surveilles-tu aujourd'hui ? » ou « explique-moi tes dernières décisions ».`;
}
/* Suggestions (§3) : affichées sous l'accueil UNIQUEMENT si un mandat est
   confirmé (avant ça, la conversation est l'onboarding lui-même, pas de
   raccourcis qui le court-circuiteraient). */
const NOVABOT_SUGGESTIONS = [
  'Analyse mon portefeuille',
  'Que surveilles-tu aujourd\'hui ?',
  'Explique-moi tes dernières décisions',
  'Quels risques vois-tu ?',
  'Compare ta performance au marché',
];

async function novabotConversationOuvrir(id){
  if (NOVABOT_CHAT.conversationId === id) { NOVABOT_UI.sidebarOpen = false; render(); return; }
  NOVABOT_CHAT.loadingThread = true;
  render();
  try {
    const r = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(id)}`);
    if (r.ok){
      const full = await r.json();
      NOVABOT_CHAT.conversationId = full.id;
      NOVABOT_CHAT.messages = full.messages.map(m => ({ role:m.role, content:m.content }));
      const dernierAvecDraft = [...full.messages].reverse().find(m => m.metadata?.mandateDraftSnapshot);
      NOVABOT_CHAT.mandateDraft = dernierAvecDraft?.metadata?.mandateDraftSnapshot || {};
      NOVABOT_CHAT.readyToConfirm = false;
    }
  } catch (e){ console.warn('[novabot-chat] ouverture conversation impossible :', e); }
  NOVABOT_CHAT.loadingThread = false;
  NOVABOT_UI.sidebarOpen = false;
  render();
}

async function novabotConversationNouvelle(){
  NOVABOT_UI.sidebarOpen = false;
  if (NOVABOT_CHAT.controller){ try { NOVABOT_CHAT.controller.abort(); } catch (e){} }
  if (NOVABOT_CHAT.revealTimer) clearTimeout(NOVABOT_CHAT.revealTimer);
  NOVABOT_CHAT = { conversationId:null, messages:[], mandateDraft:{}, sending:false, readyToConfirm:false, loadingThread:false, streamingText:null, controller:null, revealTimer:null };
  const accueil = novabotAccueilTexte();
  NOVABOT_CHAT.messages.push({ role:'assistant', content:accueil });
  render();
  try {
    const r = await authFetch('/api/me?resource=conversations', { method:'POST',
      body: JSON.stringify({ module:'novabot', title:null }) });
    if (r.ok){
      const d = await r.json();
      NOVABOT_CHAT.conversationId = d.id;
      NOVABOT_CONVERSATIONS.list.unshift({ id:d.id, module:'novabot', title:null, createdAt:d.createdAt, updatedAt:d.updatedAt });
      authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(d.id)}&action=message`,
        { method:'POST', body: JSON.stringify({ role:'assistant', content:accueil }) }).catch(() => {});
    }
  } catch (e){ console.warn('[novabot-chat] création conversation impossible :', e); }
  render();
}

async function novabotConversationRenommer(id, titre){
  const t = (titre || '').trim().slice(0, 200);
  if (!t) return;
  const entry = NOVABOT_CONVERSATIONS.list.find(c => c.id === id);
  if (entry) entry.title = t;
  render();
  try {
    await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(id)}&action=rename`,
      { method:'POST', body: JSON.stringify({ title:t }) });
  } catch (e){ console.warn('[novabot-chat] renommage impossible :', e); }
}
/* Titre automatique (§2 : "titres générés automatiquement") — les 50
   premiers caractères du premier message utilisateur, jamais un appel
   modèle dédié rien que pour résumer un titre. */
async function novabotAutoTitrer(id, premierMessage){
  const entry = NOVABOT_CONVERSATIONS.list.find(c => c.id === id);
  if (entry && entry.title) return; // déjà titrée, jamais écrasée
  const titre = premierMessage.trim().slice(0, 50) + (premierMessage.length > 50 ? '…' : '');
  await novabotConversationRenommer(id, titre);
}

function novabotConversationSupprimerConfirmer(id){
  const c = NOVABOT_CONVERSATIONS.list.find(x => x.id === id);
  if (!c) return;
  openSheet(`<h3 id="sheetTitle">Supprimer « ${esc(c.title || 'Conversation sans titre')} » ?</h3>
    <p>Cette conversation et ses messages seront définitivement supprimés. Ton portefeuille et ton mandat NovaBot ne sont pas concernés.</p>
    <div class="btns" style="margin-top:22px">
      <button class="btn btn-s" data-close style="flex:1">Annuler</button>
      <button class="btn btn-a" data-novabot-conv-delete-ok="${esc(id)}" style="flex:1">Supprimer</button></div>`);
}
async function novabotConversationSupprimer(id){
  NOVABOT_CONVERSATIONS.list = NOVABOT_CONVERSATIONS.list.filter(c => c.id !== id);
  const eraitActive = NOVABOT_CHAT.conversationId === id;
  try {
    await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(id)}`, { method:'DELETE' });
  } catch (e){ console.warn('[novabot-chat] suppression impossible :', e); }
  if (eraitActive){
    if (NOVABOT_CONVERSATIONS.list.length) await novabotConversationOuvrir(NOVABOT_CONVERSATIONS.list[0].id);
    else await novabotConversationNouvelle();
  } else {
    render();
  }
}

/* Révélation progressive (voir note d'en-tête : pas de vrai streaming
   serveur) — purement visuelle, le texte complet est déjà en mémoire.
   revealTimer gardé sur NOVABOT_CHAT pour pouvoir l'interrompre (bouton
   Stop, §2) sans attendre la fin de l'animation. */
function novabotRevelerProgressivement(texteComplet){
  NOVABOT_CHAT.streamingText = '';
  const mots = texteComplet.split(' ');
  let i = 0;
  const pas = () => {
    if (i >= mots.length){ NOVABOT_CHAT.streamingText = null; NOVABOT_CHAT.revealTimer = null; render(); return; }
    NOVABOT_CHAT.streamingText = mots.slice(0, i + 1).join(' ');
    i++;
    render();
    NOVABOT_CHAT.revealTimer = setTimeout(pas, 18);
  };
  pas();
}

/* Bouton Stop (§2) : interrompt soit la requête réseau en cours (aucune
   réponse encore reçue), soit l'animation de révélation (le message
   complet est déjà en mémoire, on arrête simplement de le "taper"). */
function novabotChatArreter(){
  if (NOVABOT_CHAT.controller){
    try { NOVABOT_CHAT.controller.abort(); } catch (e){}
    NOVABOT_CHAT.controller = null;
  }
  if (NOVABOT_CHAT.revealTimer){
    clearTimeout(NOVABOT_CHAT.revealTimer);
    NOVABOT_CHAT.revealTimer = null;
  }
  NOVABOT_CHAT.streamingText = null;
  render();
}

async function novabotChatEnvoyer(texte){
  const contenu = (texte || '').trim().slice(0, 2000);
  if (!contenu || NOVABOT_CHAT.sending) return;
  /* CORRECTIF (2026-10-08, vérifié en direct dans le navigateur) : si la
     création de la conversation a échoué (réseau), conversationId reste
     null et le message partait silencieusement aux oubliettes, sans
     aucun signe pour l'utilisateur (particulièrement visible depuis
     novabotPoserQuestion() : "Demander à Nova pourquoi" semblait ne rien
     faire). Un message d'erreur VISIBLE vaut mieux qu'un échec muet. */
  if (!NOVABOT_CHAT.conversationId){
    NOVABOT_CHAT.messages.push({ role:'assistant', content:"Je n'ai pas pu ouvrir de conversation à l'instant (problème de connexion). Réessaie dans un instant.", error:true });
    render();
    return;
  }
  const estPremierMessageUtilisateur = !NOVABOT_CHAT.messages.some(m => m.role === 'user');
  NOVABOT_CHAT.sending = true;
  NOVABOT_CHAT.messages.push({ role:'user', content:contenu });
  render();

  const convId = NOVABOT_CHAT.conversationId;
  authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(convId)}&action=message`,
    { method:'POST', body: JSON.stringify({ role:'user', content:contenu }) }).catch(() => {});
  if (estPremierMessageUtilisateur) novabotAutoTitrer(convId, contenu);

  const controller = new AbortController();
  NOVABOT_CHAT.controller = controller;
  try {
    const r = await authFetch('/api/analyze', { method:'POST', signal: controller.signal, body: JSON.stringify({
      mode:'novabot-chat',
      messages: NOVABOT_CHAT.messages,
      mandateConfirmed: state.novabot.mandateConfirmed,
      ...novabotChatContexte(contenu),
    })});
    if (!r.ok){
      const err = await r.json().catch(() => ({}));
      const msg = err.error === 'quota_exceeded'
        ? "J'ai atteint le quota d'analyses IA de ce mois-ci pour notre conversation — réessaie le mois prochain, ou passe à une offre supérieure."
        : "Je n'ai pas pu répondre à l'instant (problème de connexion au modèle).";
      NOVABOT_CHAT.messages.push({ role:'assistant', content:msg, error:true });
      NOVABOT_CHAT.controller = null; NOVABOT_CHAT.sending = false; render(); return;
    }
    const d = await r.json();
    NOVABOT_CHAT.controller = null;
    NOVABOT_CHAT.sending = false;
    NOVABOT_CHAT.messages.push({ role:'assistant', content:d.reply });
    render();
    novabotRevelerProgressivement(d.reply);
    if (d.mandateDraft){
      NOVABOT_CHAT.mandateDraft = { ...NOVABOT_CHAT.mandateDraft, ...d.mandateDraft };
    }
    NOVABOT_CHAT.readyToConfirm = Boolean(d.readyToConfirm);
    authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(convId)}&action=message`,
      { method:'POST', body: JSON.stringify({ role:'assistant', content:d.reply,
        metadata: { provider:d.provider, model:d.model, mandateDraftSnapshot: NOVABOT_CHAT.mandateDraft } }) }).catch(() => {});
    return;
  } catch (e){
    NOVABOT_CHAT.controller = null;
    /* Interruption volontaire (bouton Stop) : jamais un message d'erreur,
       juste une note neutre — l'utilisateur a demandé l'arrêt. */
    if (e && e.name === 'AbortError'){
      NOVABOT_CHAT.messages.push({ role:'assistant', content:'Réponse interrompue.' });
      NOVABOT_CHAT.sending = false; render(); return;
    }
    console.warn('[novabot-chat] envoi impossible :', e);
    NOVABOT_CHAT.messages.push({ role:'assistant', content:"Je n'ai pas pu répondre à l'instant.", error:true });
  }
  NOVABOT_CHAT.sending = false;
  render();
}
function novabotChatSoumetre(){
  const input = document.getElementById('novabotChatInput');
  if (!input || !input.value.trim() || NOVABOT_CHAT.sending) return;
  const texte = input.value;
  input.value = '';
  input.style.height = 'auto';
  novabotChatEnvoyer(texte);
}
function novabotChatConfirmer(){
  novabotConfirmerMandat(NOVABOT_CHAT.mandateDraft);
  NOVABOT_CHAT.readyToConfirm = false;
  const recap = `Mandat confirmé — ${fmt.eur(state.novabot.wallet.invested)} confiés, activé en simulation. `
    + `Je commence à chercher des opportunités dès que tu le souhaites (bouton « Évaluer maintenant », dans Portefeuille) ou dis-moi simplement d'y aller.`;
  NOVABOT_CHAT.messages.push({ role:'assistant', content:recap });
  if (NOVABOT_CHAT.conversationId){
    authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(NOVABOT_CHAT.conversationId)}&action=message`,
      { method:'POST', body: JSON.stringify({ role:'assistant', content:recap }) }).catch(() => {});
  }
  render();
}

/* "Demander à Nova pourquoi" (§7/§8) : ouvre une NOUVELLE conversation
   contextualisée plutôt que d'interrompre la conversation en cours — la
   question elle-même nomme l'entreprise/la décision, suffisant pour que
   novabotDecisionsPertinentes() (déterministe) la retrouve sans logique
   serveur supplémentaire. L'accueil générique reste le premier message
   (déjà persisté côté serveur au moment où la conversation est créée) :
   le retirer localement sans le supprimer côté serveur désynchroniserait
   l'affichage d'un simple rechargement de page. */
async function novabotPoserQuestion(texte){
  NOVABOT_UI.view = 'chat';
  await novabotConversationNouvelle();
  novabotChatEnvoyer(texte);
}
