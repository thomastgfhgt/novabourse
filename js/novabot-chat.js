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
/* archivedList/archivedLoaded/showArchived (V5 Phase A, §2 : "archiver les
   conversations") : liste SÉPARÉE de `list`, chargée paresseusement
   uniquement quand l'utilisateur ouvre la section "Archivées" du panneau —
   jamais au chargement initial, pour ne jamais payer ce coût réseau tant
   que personne n'en a besoin. */
let NOVABOT_CONVERSATIONS = { loaded:false, loading:false, list:[], search:'', archivedList:[], archivedLoaded:false, archivedLoading:false, showArchived:false };
/* controller/revealTimer (§2, bouton "Stop") : jamais persistés, purement
   l'état d'une requête/animation en cours côté client. */
let NOVABOT_CHAT = { conversationId:null, messages:[], mandateDraft:{}, sending:false, readyToConfirm:false, loadingThread:false, streamingText:null, controller:null, revealTimer:null, editingIndex:null };

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
    /* V5 Phase A (§2 : "Conserver la conversation active après
       actualisation") : rouvre la conversation EXACTE quittée à la session
       précédente si elle existe toujours dans la liste reçue (jamais
       seulement "la plus récente" — l'utilisateur a pu consulter une
       conversation plus ancienne juste avant de recharger la page). */
    const derniere = state.novabot.lastConversationId
      && NOVABOT_CONVERSATIONS.list.find(c => c.id === state.novabot.lastConversationId);
    await novabotConversationOuvrir((derniere || NOVABOT_CONVERSATIONS.list[0]).id);
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
      /* id conservé par message (V6 §5 : édition/régénération/reprise ont
         besoin de cibler un message PRÉCIS côté serveur, voir
         action=truncate_from, api/me.js) — jamais perdu au chargement. */
      NOVABOT_CHAT.messages = full.messages.map(m => ({ role:m.role, content:m.content, id:m.id }));
      const dernierAvecDraft = [...full.messages].reverse().find(m => m.metadata?.mandateDraftSnapshot);
      NOVABOT_CHAT.mandateDraft = dernierAvecDraft?.metadata?.mandateDraftSnapshot || {};
      NOVABOT_CHAT.readyToConfirm = false;
      state.novabot.lastConversationId = full.id;
      saveState();
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
  NOVABOT_CHAT = { conversationId:null, messages:[], mandateDraft:{}, sending:false, readyToConfirm:false, loadingThread:false, streamingText:null, controller:null, revealTimer:null, editingIndex:null };
  const accueil = novabotAccueilTexte();
  NOVABOT_CHAT.messages.push({ role:'assistant', content:accueil });
  render();
  try {
    const r = await authFetch('/api/me?resource=conversations', { method:'POST',
      body: JSON.stringify({ module:'novabot', title:null }) });
    if (r.ok){
      const d = await r.json();
      NOVABOT_CHAT.conversationId = d.id;
      NOVABOT_CONVERSATIONS.list.unshift({ id:d.id, module:'novabot', title:null, archived:false, createdAt:d.createdAt, updatedAt:d.updatedAt });
      state.novabot.lastConversationId = d.id;
      saveState();
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

/* ---------- archiver / désarchiver (V5 Phase A, §2) ----------
   Toggle réversible, jamais de confirmation (contraste volontaire avec la
   suppression ci-dessus, destructive) : retire la conversation de la liste
   ACTIVE et, si la section "Archivées" a déjà été chargée, l'y ajoute
   immédiatement plutôt que de forcer un rechargement réseau complet. */
async function novabotConversationArchiver(id){
  const c = NOVABOT_CONVERSATIONS.list.find(x => x.id === id);
  NOVABOT_CONVERSATIONS.list = NOVABOT_CONVERSATIONS.list.filter(x => x.id !== id);
  if (c && NOVABOT_CONVERSATIONS.archivedLoaded){
    NOVABOT_CONVERSATIONS.archivedList = [{ ...c, archived:true }, ...NOVABOT_CONVERSATIONS.archivedList];
  }
  const eraitActive = NOVABOT_CHAT.conversationId === id;
  try {
    await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(id)}&action=archive`, { method:'POST' });
  } catch (e){ console.warn('[novabot-chat] archivage impossible :', e); }
  if (eraitActive){
    if (NOVABOT_CONVERSATIONS.list.length) await novabotConversationOuvrir(NOVABOT_CONVERSATIONS.list[0].id);
    else await novabotConversationNouvelle();
  } else {
    render();
  }
}
async function novabotConversationDesarchiver(id){
  const c = NOVABOT_CONVERSATIONS.archivedList.find(x => x.id === id);
  NOVABOT_CONVERSATIONS.archivedList = NOVABOT_CONVERSATIONS.archivedList.filter(x => x.id !== id);
  if (c){
    NOVABOT_CONVERSATIONS.list = [{ ...c, archived:false }, ...NOVABOT_CONVERSATIONS.list]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }
  render();
  try {
    await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(id)}&action=unarchive`, { method:'POST' });
  } catch (e){ console.warn('[novabot-chat] désarchivage impossible :', e); }
}
/* Chargement paresseux : seulement à la première ouverture de la section
   "Archivées" du panneau, jamais au chargement initial de NovaBot. */
async function novabotArchivesBasculer(){
  NOVABOT_CONVERSATIONS.showArchived = !NOVABOT_CONVERSATIONS.showArchived;
  if (NOVABOT_CONVERSATIONS.showArchived && !NOVABOT_CONVERSATIONS.archivedLoaded && !NOVABOT_CONVERSATIONS.archivedLoading){
    NOVABOT_CONVERSATIONS.archivedLoading = true;
    render();
    try {
      const r = await authFetch('/api/me?resource=conversations&archived=1');
      if (r.ok){
        const data = await r.json();
        NOVABOT_CONVERSATIONS.archivedList = (data.conversations || []).filter(c => c.module === 'novabot');
      }
    } catch (e){ console.warn('[novabot-chat] liste archivées impossible :', e); }
    NOVABOT_CONVERSATIONS.archivedLoading = false;
    NOVABOT_CONVERSATIONS.archivedLoaded = true;
  }
  render();
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

/* Portion commune à l'envoi normal ET à "Régénérer" (V6 §5) : appelle le
   modèle sur l'état ACTUEL de NOVABOT_CHAT.messages, ajoute la réponse,
   la révèle progressivement, la persiste côté serveur. N'ajoute JAMAIS le
   message utilisateur lui-même — fait par l'appelant, qui sait s'il doit
   en créer un nouveau (envoi normal) ou réutiliser l'existant (régénérer). */
async function novabotAppelerModeleEtRepondre(dernierMessageUtilisateur){
  const convId = NOVABOT_CHAT.conversationId;
  const controller = new AbortController();
  NOVABOT_CHAT.controller = controller;
  try {
    const r = await authFetch('/api/analyze', { method:'POST', signal: controller.signal, body: JSON.stringify({
      mode:'novabot-chat',
      messages: NOVABOT_CHAT.messages,
      mandateConfirmed: state.novabot.mandateConfirmed,
      ...novabotChatContexte(dernierMessageUtilisateur),
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
    const msgObj = { role:'assistant', content:d.reply };
    NOVABOT_CHAT.messages.push(msgObj);
    render();
    novabotRevelerProgressivement(d.reply);
    if (d.mandateDraft){
      NOVABOT_CHAT.mandateDraft = { ...NOVABOT_CHAT.mandateDraft, ...d.mandateDraft };
    }
    NOVABOT_CHAT.readyToConfirm = Boolean(d.readyToConfirm);
    /* id serveur du message capturé une fois la réponse arrivée (V6 §5 :
       nécessaire pour pouvoir le cibler ensuite via "Régénérer"/
       "Reprendre ici"/truncate_from — voir api/me.js). */
    authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(convId)}&action=message`,
      { method:'POST', body: JSON.stringify({ role:'assistant', content:d.reply,
        metadata: { provider:d.provider, model:d.model, mandateDraftSnapshot: NOVABOT_CHAT.mandateDraft } }) })
      .then(r2 => r2.ok ? r2.json() : null).then(saved => { if (saved?.id) msgObj.id = saved.id; }).catch(() => {});
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
  const msgObj = { role:'user', content:contenu };
  NOVABOT_CHAT.messages.push(msgObj);
  render();

  const convId = NOVABOT_CHAT.conversationId;
  authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(convId)}&action=message`,
    { method:'POST', body: JSON.stringify({ role:'user', content:contenu }) })
    .then(r => r.ok ? r.json() : null).then(saved => { if (saved?.id) msgObj.id = saved.id; }).catch(() => {});
  if (estPremierMessageUtilisateur) novabotAutoTitrer(convId, contenu);

  await novabotAppelerModeleEtRepondre(contenu);
}
function novabotChatSoumetre(){
  const input = document.getElementById('novabotChatInput');
  if (!input || !input.value.trim() || NOVABOT_CHAT.sending) return;
  const texte = input.value;
  input.value = '';
  input.style.height = 'auto';
  novabotChatEnvoyer(texte);
}

/* ---------- actions sur un message (V6 §5) ---------- */
function novabotMessageCopier(index){
  const m = NOVABOT_CHAT.messages[index];
  if (!m) return;
  const faireSecours = () => {
    const ta = document.createElement('textarea');
    ta.value = m.content; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e){}
    ta.remove();
    toast('Copié');
  };
  if (navigator.clipboard?.writeText){
    navigator.clipboard.writeText(m.content).then(() => toast('Copié')).catch(faireSecours);
  } else faireSecours();
}

/* Avis positif/négatif (V6 §5) — bascule locale, jamais encore persistée
   côté serveur (pas de colonne dédiée sur nova_messages à ce stade) :
   survit à la session en cours mais pas à une actualisation complète de
   la page. Limitation assumée et à faire évoluer si un vrai suivi de
   satisfaction est demandé — un clic réagit réellement, jamais décoratif. */
function novabotMessageFeedback(index, valeur){
  const m = NOVABOT_CHAT.messages[index];
  if (!m || m.role !== 'assistant') return;
  m.feedback = m.feedback === valeur ? null : valeur;
  render();
}

/* Régénérer (Nova uniquement, dernier message du fil) : supprime la
   réponse côté serveur (truncate_from, inclusif) ET localement, puis
   relance l'appel modèle sur l'historique qui s'arrête maintenant au
   dernier message utilisateur — EXACTEMENT comme si cette réponse
   n'avait jamais existé. */
async function novabotMessageRegenerer(index){
  const m = NOVABOT_CHAT.messages[index];
  if (!m || m.role !== 'assistant' || index !== NOVABOT_CHAT.messages.length - 1 || NOVABOT_CHAT.sending) return;
  const dernierUtilisateur = [...NOVABOT_CHAT.messages.slice(0, index)].reverse().find(x => x.role === 'user');
  NOVABOT_CHAT.messages.splice(index, 1);
  NOVABOT_CHAT.sending = true;
  render();
  if (m.id){
    try {
      await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(NOVABOT_CHAT.conversationId)}&action=truncate_from`,
        { method:'POST', body: JSON.stringify({ fromMessageId: m.id }) });
    } catch (e){ console.warn('[novabot-chat] troncature (régénérer) impossible :', e); }
  }
  await novabotAppelerModeleEtRepondre(dernierUtilisateur?.content || '');
}

/* Reprendre la conversation à partir de ce message (V6 §5) : garde tout
   jusqu'à `index` INCLUS, supprime le reste (serveur ET local) — jamais
   un simple masquage visuel, sinon le fil "ressusciterait" au prochain
   chargement (novabotConversationOuvrir relit toujours le serveur). */
async function novabotMessageReprendreIci(index){
  const suivant = NOVABOT_CHAT.messages[index + 1];
  NOVABOT_CHAT.messages = NOVABOT_CHAT.messages.slice(0, index + 1);
  render();
  toast('Conversation reprise à partir de ce message');
  if (suivant?.id){
    try {
      await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(NOVABOT_CHAT.conversationId)}&action=truncate_from`,
        { method:'POST', body: JSON.stringify({ fromMessageId: suivant.id }) });
    } catch (e){ console.warn('[novabot-chat] troncature (reprendre) impossible :', e); }
  }
}

/* Modifier un message utilisateur (V6 §5) : ouvre un champ éditable sur
   CE message — ne remplace rien tant que l'utilisateur n'a pas confirmé. */
function novabotMessageModifierOuvrir(index){
  const m = NOVABOT_CHAT.messages[index];
  if (!m || m.role !== 'user') return;
  NOVABOT_CHAT.editingIndex = index;
  render();
}
function novabotMessageModifierAnnuler(){
  NOVABOT_CHAT.editingIndex = null;
  render();
}
/* Valide l'édition : supprime ce message et tout ce qui suit (serveur ET
   local — même primitive truncate_from que "Régénérer"/"Reprendre ici"),
   puis renvoie le texte édité comme un nouveau message normal. Simplifi-
   cation assumée (pas de vraies branches multiples façon ChatGPT : la
   version précédente n'est pas conservée à côté, seulement remplacée) —
   à faire évoluer si le besoin de comparer plusieurs versions se confirme. */
async function novabotMessageModifierValider(index){
  const champ = document.getElementById('novabotEditInput' + index);
  const nouveauTexte = (champ?.value || '').trim().slice(0, 2000);
  if (!nouveauTexte) return;
  const m = NOVABOT_CHAT.messages[index];
  NOVABOT_CHAT.editingIndex = null;
  NOVABOT_CHAT.messages = NOVABOT_CHAT.messages.slice(0, index);
  render();
  if (m?.id){
    try {
      await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(NOVABOT_CHAT.conversationId)}&action=truncate_from`,
        { method:'POST', body: JSON.stringify({ fromMessageId: m.id }) });
    } catch (e){ console.warn('[novabot-chat] troncature (modifier) impossible :', e); }
  }
  await novabotChatEnvoyer(nouveauTexte);
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
