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

let NOVABOT_UI = { view:'chat', sidebarOpen:false, portfolioPeriod:'1A', activite:{ ouvert:false, enCours:false, etapes:[] } };

/* CORRECTIF (audit 2026-10-13, "fonctionnalités pas abouties" — §4 du
   prompt V7, qualifié par l'utilisateur de "l'une de mes demandes les
   plus importantes" : "je veux voir NovaBot travailler") — n'existait
   PAS du tout avant ce correctif, pas une amélioration d'un panneau
   existant. CONTRAINTE EXPLICITE RESPECTÉE : "Aucune recherche fictive
   ne doit être affichée comme une recherche réellement effectuée" —
   chaque étape ci-dessous est posée au moment EXACT où evaluerNovaBot()
   (js/core.js) effectue RÉELLEMENT ce travail, jamais une simulation ni
   une étape décorative ajoutée après coup pour "faire plus vivant". */
function novabotActiviteDemarrer(){
  NOVABOT_UI.activite = { ouvert:true, enCours:true, etapes:[] };
  render();
}
/* Démarre une étape "en_cours", renvoie une RÉFÉRENCE DIRECTE à son objet
   (pas un index : des étapes peuvent s'intercaler avant sa conclusion —
   ex. une vente déclenchée pendant la vérification des positions — un
   index deviendrait faux ; la référence reste toujours valide). L'appelant
   la conclut lui-même via novabotActiviteConclure(). Une étape déjà
   conclue en un seul appel (jamais "en cours" entre-temps, ex. une vente
   déjà effective quand on l'apprend) se pousse directement via
   novabotActiviteEtapeDirecte(). */
function novabotActiviteDebuter(label){
  const etape = { label, statut:'en_cours', detail:null };
  NOVABOT_UI.activite.etapes.push(etape);
  render();
  return etape;
}
function novabotActiviteConclure(etape, statut, detail){
  etape.statut = statut; etape.detail = detail || null;
  render();
}
function novabotActiviteEtapeDirecte(label, statut, detail){
  NOVABOT_UI.activite.etapes.push({ label, statut, detail: detail || null });
  render();
}
function novabotActiviteTerminer(resume){
  NOVABOT_UI.activite.enCours = false;
  NOVABOT_UI.activite.resume = resume || null;
  render();
}
function novabotActiviteFermer(){
  NOVABOT_UI.activite.ouvert = false;
  render();
}
/* archivedList/archivedLoaded/showArchived (V5 Phase A, §2 : "archiver les
   conversations") : liste SÉPARÉE de `list`, chargée paresseusement
   uniquement quand l'utilisateur ouvre la section "Archivées" du panneau —
   jamais au chargement initial, pour ne jamais payer ce coût réseau tant
   que personne n'en a besoin. */
let NOVABOT_CONVERSATIONS = { loaded:false, loading:false, list:[], search:'', archivedList:[], archivedLoaded:false, archivedLoading:false, showArchived:false };
/* controller/revealTimer (§2, bouton "Stop") : jamais persistés, purement
   l'état d'une requête/animation en cours côté client. */
let NOVABOT_CHAT = { conversationId:null, messages:[], mandateDraft:{}, sending:false, readyToConfirm:false, loadingThread:false, streamingText:null, controller:null, revealTimer:null, editingIndex:null, revealedActionsIndex:null,
  /* 2026-10-15 (pilotage du mandat depuis le chat) : REMPLACÉ, jamais
     fusionné, à chaque nouvelle proposition (contrairement à mandateDraft
     ci-dessus, cumulatif pendant l'onboarding) — une nouvelle proposition
     ne doit jamais hériter d'un champ d'une proposition précédente non
     confirmée. */
  pendingMandateAmendment:null, readyToConfirmAmendment:false };

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
  return { date:d.date, action:d.action, ticker:d.ticker, name:d.name, stockId:d.stockId, priceObserved:d.priceObserved,
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
    mandate: { id:mandate.id, objective:mandate.objective, riskLevel:mandate.riskLevel,
      horizonYears:mandate.horizonYears, cashMinPct:mandate.cashMinPct, maxPositionPct:mandate.maxPositionPct,
      hardRules:mandate.hardRules,
      /* V6 §6 ("mémoire commune") : transmis sur CHAQUE message, pas
         seulement à l'onboarding — "Nova doit pouvoir en tenir compte"
         dans une conversation différente de celle où la préférence a été
         exprimée. Nécessitait le correctif sanitiserDonnees() côté
         serveur (les tableaux étaient silencieusement supprimés). */
      preferences:mandate.preferences, autonomyMode:state.novabot.autonomyMode },
    portfolio: { cash:state.novabot.wallet.cash, totalValue:pf.total, realizedPnL:state.novabot.wallet.realizedPnL,
      positions, lastRunAt: state.novabot.lastRunAt ? new Date(state.novabot.lastRunAt).toISOString() : null,
      /* enabled (audit 2026-10-14, "action" déclenchable depuis le chat) :
         sans ce champ, le modèle ne saurait pas si NovaBot tourne déjà ou
         est en pause — risque de proposer "resume" alors que c'est déjà
         actif, ou de ne jamais suggérer de le réactiver. */
      enabled: state.novabot.enabled },
    recentDecisions: recentes,
    specificDecisions: specifiques.length ? specifiques : null,
    /* NOUVEAU (2026-10-15) : une proposition de modification du mandat
       déjà en attente de confirmation — le modèle doit en tenir compte
       plutôt que d'en recréer une autre à chaque tour (voir
       CONSIGNE_NOVABOT_CHAT, api/analyze.js). */
    pendingMandateAmendment: NOVABOT_CHAT.pendingMandateAmendment,
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

/* CORRECTIF (2026-10-15, "passage au trading réel") : le premier
   message invitait un nouvel utilisateur à "confier un capital" à un
   portefeuille simulé — une invitation à un mécanisme de simulation,
   justement ce qui ne doit plus être proposé en avant de l'expérience
   publique. Les utilisateurs ayant déjà confirmé un mandat (données
   existantes, préservées) continuent normalement, avec une mention
   explicite que le montant reste simulé. */
function novabotAccueilTexte(){
  if (!state.novabot.mandateConfirmed){
    if (!PORTEFEUILLE_FICTIF_PUBLIC){
      return `Bonjour, je suis Nova. Je peux analyser des entreprises, t'expliquer une stratégie d'investissement et répondre à tes questions. Que veux-tu comprendre ?`;
    }
    return `Bonjour, je suis Nova. Je vais gérer un portefeuille simulé pour toi — jamais d'argent réel. Pour commencer : quel capital souhaites-tu me confier, et pour quel objectif ?`;
  }
  const pf = novabotPortfolioValue();
  return `Bonjour, ton portefeuille NovaBot simulé vaut actuellement ${fmt.eur(pf.total)} (aucun argent réel). Demande-moi par exemple « que surveilles-tu aujourd'hui ? » ou « explique-moi tes dernières décisions ».`;
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
      /* feedback restauré depuis metadata.feedback (voir action=feedback,
         api/me.js) — correctif 2026-10-13, sans quoi un avis persisté
         côté serveur réapparaîtrait "non donné" à chaque réouverture. */
      NOVABOT_CHAT.messages = full.messages.map(m => ({ role:m.role, content:m.content, id:m.id, feedback:m.metadata?.feedback || null }));
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
  NOVABOT_CHAT = { conversationId:null, messages:[], mandateDraft:{}, sending:false, readyToConfirm:false, loadingThread:false, streamingText:null, controller:null, revealTimer:null, editingIndex:null, revealedActionsIndex:null,
  /* 2026-10-15 (pilotage du mandat depuis le chat) : REMPLACÉ, jamais
     fusionné, à chaque nouvelle proposition (contrairement à mandateDraft
     ci-dessus, cumulatif pendant l'onboarding) — une nouvelle proposition
     ne doit jamais hériter d'un champ d'une proposition précédente non
     confirmée. */
  pendingMandateAmendment:null, readyToConfirmAmendment:false };
  const accueil = novabotAccueilTexte();
  const msgAccueil = { role:'assistant', content:accueil };
  NOVABOT_CHAT.messages.push(msgAccueil);
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
      novabotSauvegarderMessage(d.id, msgAccueil, { role:'assistant', content:accueil });
    }
  } catch (e){ console.warn('[novabot-chat] création conversation impossible :', e); }
  render();
}

/* CORRECTIF (audit 2026-10-13, même classe de bug que l'archivage ci-
   dessus) : le nouveau titre était affiché AVANT toute confirmation
   serveur, sans annulation en cas d'échec réel — un rechargement
   suivant aurait silencieusement ramené l'ancien titre, sans que
   l'utilisateur comprenne pourquoi son renommage n'a "pas tenu". */
async function novabotConversationRenommer(id, titre){
  const t = (titre || '').trim().slice(0, 200);
  if (!t) return;
  const entry = NOVABOT_CONVERSATIONS.list.find(c => c.id === id);
  const ancienTitre = entry?.title;
  if (entry) entry.title = t;
  render();
  let reussi = false;
  try {
    const r = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(id)}&action=rename`,
      { method:'POST', body: JSON.stringify({ title:t }) });
    reussi = r.ok;
  } catch (e){ console.warn('[novabot-chat] renommage impossible :', e); }
  if (!reussi && entry){
    entry.title = ancienTitre;
    toast('Renommage impossible — réessaie dans un instant.');
    render();
  }
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
/* CORRECTIF (audit 2026-10-13, même classe de bug que l'archivage/le
   renommage ci-dessous) : une suppression qui échouait réellement côté
   serveur (réseau) faisait quand même disparaître la conversation de
   l'écran — elle n'était jamais vraiment perdue (resterait visible au
   prochain rechargement), mais sans rien pour l'utilisateur signalant
   que "Supprimer" n'avait en fait rien supprimé. */
async function novabotConversationSupprimer(id){
  const c = NOVABOT_CONVERSATIONS.list.find(x => x.id === id);
  const index = NOVABOT_CONVERSATIONS.list.findIndex(x => x.id === id);
  NOVABOT_CONVERSATIONS.list = NOVABOT_CONVERSATIONS.list.filter(x => x.id !== id);
  const eraitActive = NOVABOT_CHAT.conversationId === id;
  let reussi = false;
  try {
    const r = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(id)}`, { method:'DELETE' });
    reussi = r.ok;
  } catch (e){ console.warn('[novabot-chat] suppression impossible :', e); }
  if (!reussi && c){
    NOVABOT_CONVERSATIONS.list.splice(index, 0, c);
    toast('Suppression impossible — réessaie dans un instant.');
    render();
    return;
  }
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
/* CORRECTIF (audit 2026-10-13, même classe de bug que la perte
   silencieuse de messages déjà corrigée : "conversations disparues") —
   la mise à jour locale (retirer de list, ajouter à archivedList) était
   appliquée AVANT toute confirmation du serveur, SANS annulation en cas
   d'échec. Un archivage qui échouait réellement (réseau) retirait quand
   même la conversation de l'écran — jusqu'au prochain rechargement, où
   elle réapparaîtrait brusquement (le serveur ne l'a jamais archivée),
   sans aucune explication pour l'utilisateur. Même chose en sens
   inverse pour le désarchivage. Corrigé : la mise à jour locale est
   annulée si le serveur confirme un échec, avec un toast explicite —
   jamais un état visible qui ne correspond pas à la réalité serveur. */
async function novabotConversationArchiver(id){
  const c = NOVABOT_CONVERSATIONS.list.find(x => x.id === id);
  NOVABOT_CONVERSATIONS.list = NOVABOT_CONVERSATIONS.list.filter(x => x.id !== id);
  if (c && NOVABOT_CONVERSATIONS.archivedLoaded){
    NOVABOT_CONVERSATIONS.archivedList = [{ ...c, archived:true }, ...NOVABOT_CONVERSATIONS.archivedList];
  }
  const eraitActive = NOVABOT_CHAT.conversationId === id;
  let reussi = false;
  try {
    const r = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(id)}&action=archive`, { method:'POST' });
    reussi = r.ok;
  } catch (e){ console.warn('[novabot-chat] archivage impossible :', e); }
  if (!reussi && c){
    NOVABOT_CONVERSATIONS.archivedList = NOVABOT_CONVERSATIONS.archivedList.filter(x => x.id !== id);
    NOVABOT_CONVERSATIONS.list = [c, ...NOVABOT_CONVERSATIONS.list];
    toast('Archivage impossible — réessaie dans un instant.');
    render();
    return;
  }
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
  let reussi = false;
  try {
    const r = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(id)}&action=unarchive`, { method:'POST' });
    reussi = r.ok;
  } catch (e){ console.warn('[novabot-chat] désarchivage impossible :', e); }
  if (!reussi && c){
    NOVABOT_CONVERSATIONS.list = NOVABOT_CONVERSATIONS.list.filter(x => x.id !== id);
    NOVABOT_CONVERSATIONS.archivedList = [c, ...NOVABOT_CONVERSATIONS.archivedList];
    toast('Désarchivage impossible — réessaie dans un instant.');
    render();
  }
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
   Stop, §2) sans attendre la fin de l'animation.
   CORRECTIF (motion design premium, phase 1, 2026-10-15, décision
   explicite après consultation : "ne pas ralentir les réponses avec un
   effet de machine à écrire artificiel" entrait en conflit direct avec le
   découpage mot par mot — 18ms/mot cumulés pouvaient dépasser 1s pour une
   réponse de 50+ mots) : découpage par PHRASE au lieu de mot. "reply" est
   borné côté serveur à 1-4 phrases courtes, jamais de markdown
   (CONSIGNE_NOVABOT_CHAT, api/analyze.js) — donc 1 à 4 étapes réelles,
   jamais plus, et rien à préserver (pas de tableau/lien/bloc). La
   ponctuation forte (./!/?) suivie d'un espace sépare les phrases ; une
   décimale/un pourcentage français ("12,5 %") utilise une virgule, jamais
   un point, donc ce découpage ne fragmente pas un nombre dans le cas
   courant.
   CORRECTIF (retour utilisateur réel, 2026-10-15 : "je ne vois toujours
   aucune animation" malgré un rechargement complet confirmé, code
   vérifié présent et correct sur le serveur) : le code s'exécutait bel
   et bien, mais à 90ms/étape, une réponse de 2-3 phrases ne prenait que
   180-270ms au total — perçu comme "apparu d'un coup" par un œil humain,
   pas comme une révélation progressive. Porté à 220ms/étape : pour 1 à 4
   étapes, 220-880ms au total, encore nettement plus court que l'ancien
   système mot par mot pour une réponse de plusieurs dizaines de mots
   (18ms × 25-40 mots ≈ 450-720ms, SANS compter que chaque mot déclenchait
   aussi un rendu complet), mais chaque étape reste cette fois clairement
   perceptible — c'est la condition explicitement posée par l'utilisateur
   ("garder un effet progressif mais plus rapide/perceptible différemment"),
   pas seulement "plus rapide". Sous animationsDisabled() (js/core.js),
   aucune étape intermédiaire : la réponse complète s'affiche
   immédiatement. */
function novabotRevelerProgressivement(texteComplet){
  NOVABOT_CHAT.streamingText = '';
  if (animationsDisabled()){
    NOVABOT_CHAT.streamingText = null; NOVABOT_CHAT.revealTimer = null; render(); return;
  }
  const phrases = texteComplet.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [texteComplet];
  let i = 0, accumule = '';
  const pas = () => {
    if (i >= phrases.length){ NOVABOT_CHAT.streamingText = null; NOVABOT_CHAT.revealTimer = null; render(); return; }
    accumule += phrases[i];
    NOVABOT_CHAT.streamingText = accumule;
    i++;
    render();
    NOVABOT_CHAT.revealTimer = setTimeout(pas, 220);
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

/* CORRECTIF (audit 2026-10-14, "je veux que NovaBot puisse gérer tout ce
   qu'on lui donne automatiquement sans aucun bouton à taper [...] comme
   Claude Code") : jusqu'ici la conversation ne faisait JAMAIS plus que
   parler — même après confirmation du mandat, "lance une évaluation"
   n'avait aucun effet réel, il fallait physiquement trouver et cliquer
   le bouton "Évaluer maintenant" (ou celui de pause/reprise, enterré
   dans les réglages avancés du mandat). `action` (validé côté serveur,
   api/analyze.js — liste blanche stricte de 3 valeurs) ne fait
   qu'appeler le MÊME pipeline déterministe que ces boutons, EXACTEMENT
   comme un clic réel : le modèle ne décide jamais lui-même d'un achat/
   vente ni d'un montant, il demande seulement au moteur déjà existant
   de tourner. Un message visible confirme toujours l'action déclenchée
   — jamais une action silencieuse que l'utilisateur ne verrait nulle
   part. */
async function novabotTraiterAction(action){
  if (action === 'run_evaluation'){
    if (!state.novabot.enabled){ toast('NovaBot est en pause — réactive-le avant de lancer une évaluation.'); return; }
    evaluerNovaBot();
  } else if (action === 'pause' && state.novabot.enabled){
    state.novabot.enabled = false; saveState(); pushNovaBot();
    toast('NovaBot mis en pause.'); render();
  } else if (action === 'resume' && !state.novabot.enabled){
    state.novabot.enabled = true; saveState(); pushNovaBot();
    toast('NovaBot réactivé.'); render();
  } else if (action === 'cancel_mandate' && !state.novabot.cancelled){
    /* `await` réel, contrairement à pause/resume ci-dessus (2026-10-15) :
       annuler est irréversible sans refaire l'onboarding — jamais annoncé
       avant une vraie confirmation serveur. */
    const ok = await novabotAnnulerMandat();
    toast(ok ? 'Mandat annulé — tes positions restent inchangées.' : "Impossible d'annuler le mandat pour l'instant.");
  } else if (action === 'restore_last_mandate_version'){
    const ok = await novabotRestaurerVersionPrecedente();
    toast(ok ? 'Version précédente du mandat restaurée.' : 'Aucune version précédente à restaurer, ou restauration impossible.');
  }
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
      /* 2026-10-16 ("passage au trading réel") : sans mandat existant et
         fictif retiré, le serveur bascule sur un rôle d'analyse/conseil
         pédagogique — plus jamais d'onboarding "quel capital me confier". */
      modePedagogique: !PORTEFEUILLE_FICTIF_PUBLIC && !state.novabot.mandateConfirmed,
      /* §7 de la mission Alpaca Sandbox : réglage dans Compte > Réglages
         (state.settings.novaAiPortefeuilleAlpaca), transmis à chaque
         requête — le serveur recalcule les chiffres lui-même, ceci ne
         sert qu'à indiquer le consentement de l'utilisateur. */
      novaAiPortefeuilleAlpaca: state.settings.novaAiPortefeuilleAlpaca === true,
      ...novabotChatContexte(dernierMessageUtilisateur),
    })});
    if (!r.ok){
      const err = await r.json().catch(() => ({}));
      /* CORRECTIF (audit 2026-10-12, §7 : "afficher le type de limite
         atteinte et sa date de réinitialisation lorsqu'elle est connue")
         — le message précédent était un texte générique fixe, ignorant
         periodEnd pourtant déjà renvoyé par quotaChatBlock() (_limits.js).
         Distingue aussi quota (mensuel) de rate_limited (débit horaire,
         repart de lui-même en quelques minutes) — deux situations
         différentes, jamais confondues dans le message affiché. */
      let msg;
      if (err.error === 'quota_exceeded'){
        const dateReset = err.periodEnd ? new Date(err.periodEnd).toLocaleDateString('fr-FR', { day:'numeric', month:'long' }) : null;
        msg = `J'ai atteint le quota de messages NovaBot inclus dans ton offre ce mois-ci`
          + (dateReset ? ` (renouvellement le ${dateReset})` : '') + ` — passe à une offre supérieure pour continuer dès maintenant.`;
      } else if (err.error === 'rate_limited'){
        msg = "Trop de messages envoyés en peu de temps — réessaie dans quelques minutes.";
      } else {
        msg = "Je n'ai pas pu répondre à l'instant (problème de connexion au modèle).";
      }
      /* Bouton Réessayer (§4) : rejoue le DERNIER message utilisateur
         exactement comme "Régénérer" le ferait sur une réponse normale —
         retryTexte porté par le message d'erreur lui-même, jamais une
         variable globale qui pourrait pointer sur le mauvais message
         après plusieurs échecs successifs. */
      NOVABOT_CHAT.messages.push({ role:'assistant', content:msg, error:true, retryTexte: dernierMessageUtilisateur || null });
      NOVABOT_CHAT.controller = null; NOVABOT_CHAT.sending = false; render(); return;
    }
    const d = await r.json();
    NOVABOT_CHAT.controller = null;
    NOVABOT_CHAT.sending = false;
    /* Fiche décision (V6 §7 : "fiches d'actions", exemple exact du brief
       "pourquoi as-tu acheté Nvidia ?") — JAMAIS généré par le modèle :
       entièrement dérivé de state.novabot.decisions (déjà réel, déjà
       affiché ailleurs dans l'app), donc aucun risque de donnée
       inventée. Attachée au message dès qu'une décision correspond au
       dernier message utilisateur, que la réponse texte en parle ou non. */
    const decisionLiee = novabotDecisionsPertinentes(dernierMessageUtilisateur)[0] || null;
    const msgObj = { role:'assistant', content:d.reply, relatedDecision: decisionLiee ? novabotDecisionCompacte(decisionLiee) : null };
    NOVABOT_CHAT.messages.push(msgObj);
    render();
    novabotRevelerProgressivement(d.reply);
    if (d.mandateDraft){
      NOVABOT_CHAT.mandateDraft = { ...NOVABOT_CHAT.mandateDraft, ...d.mandateDraft };
    }
    NOVABOT_CHAT.readyToConfirm = Boolean(d.readyToConfirm)
      && (PORTEFEUILLE_FICTIF_PUBLIC || state.novabot.mandateConfirmed);
    /* mandateAmendment (2026-10-15) : REMPLACÉ, jamais fusionné —
       contrairement à mandateDraft ci-dessus (cumulatif pendant
       l'onboarding), une nouvelle proposition de modification ne doit
       jamais hériter d'un champ d'une proposition précédente non
       confirmée (voir la déclaration de NOVABOT_CHAT plus haut). */
    if (d.mandateAmendment){
      NOVABOT_CHAT.pendingMandateAmendment = { id: d.amendmentId, changes: d.mandateAmendment,
        summary: d.summary, baseMandateId: d.baseMandateId };
    }
    NOVABOT_CHAT.readyToConfirmAmendment = Boolean(d.readyToConfirmAmendment);
    if (d.newPreferences) novabotAjouterPreferences(d.newPreferences);
    if (d.action) novabotTraiterAction(d.action);
    /* id serveur du message capturé une fois la réponse arrivée (V6 §5 :
       nécessaire pour pouvoir le cibler ensuite via "Régénérer"/
       "Reprendre ici"/truncate_from — voir api/me.js). */
    novabotSauvegarderMessage(convId, msgObj, { role:'assistant', content:d.reply,
      metadata: { provider:d.provider, model:d.model, mandateDraftSnapshot: NOVABOT_CHAT.mandateDraft } });
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
    NOVABOT_CHAT.messages.push({ role:'assistant', content:"Je n'ai pas pu répondre à l'instant (problème réseau).", error:true, retryTexte: dernierMessageUtilisateur || null });
  }
  NOVABOT_CHAT.sending = false;
  render();
}

/* CORRECTIF (audit 2026-10-13, "conversations disparues") : bug réel et
   grave confirmé contre la vraie base — les 9 conversations NovaBot
   réelles de l'utilisateur avaient TOUTES 0 message enregistré. Chaque
   sauvegarde de message (le sien, celui de Nova, le message d'accueil)
   partait en fire-and-forget avec .catch(() => {}) : le moindre échec
   (coupure réseau, jeton d'authentification expiré en cours de session,
   erreur serveur ponctuelle) faisait disparaître le message SANS AUCUNE
   trace ni pour l'utilisateur ni dans les journaux — la conversation
   continuait à fonctionner normalement en apparence (Nova répond quand
   même, l'appel au modèle est indépendant de la sauvegarde) pendant que
   son contenu ne persistait jamais réellement côté serveur.
   novabotSauvegarderMessage() : UNE tentative + UNE relance après 1,5 s
   en cas d'échec (laisse le temps à un jeton de se rafraîchir ou un
   réseau de se rétablir) ; si la relance échoue aussi, pose
   msgObj.saveFailed = true (affiché discrètement, voir novabotMsgRow()/
   styles.css) ET conserve le texte pour une tentative manuelle plutôt que
   de l'abandonner en silence — jamais à nouveau un échec invisible. */
async function novabotSauvegarderMessage(convId, msgObj, payload){
  /* tenter() avale elle-même toute exception (authFetch() qui REJETTE,
     pas seulement une réponse HTTP non-ok) et renvoie null dans les deux
     cas — CORRECTIF trouvé en testant ce helper (test-novabot-message-
     persistence.js) : sans ce try/catch interne, une vraie coupure
     réseau (fetch() qui lève, pas un simple 4xx/5xx) faisait sortir
     directement vers le catch EXTÉRIEUR, sautant purement et simplement
     la relance — exactement la classe d'erreur la plus probable derrière
     le bug "conversations disparues" (coupure réseau en cours de
     session), celle que la relance est censée couvrir en premier. */
  const tenter = async () => {
    try {
      const r = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(convId)}&action=message`,
        { method:'POST', body: JSON.stringify(payload) });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };
  let saved = await tenter();
  if (!saved){
    await new Promise(r => setTimeout(r, 1500));
    saved = await tenter();
  }
  if (saved?.id){
    msgObj.id = saved.id;
    if (msgObj.saveFailed){ msgObj.saveFailed = false; render(); }
  } else {
    console.warn('[novabot-chat] message non sauvegardé après relance');
    msgObj.saveFailed = true;
    render();
  }
}

/* Bouton "Réessayer" manuel sur le badge "Non sauvegardé" (novabotSave
   FailedBadge, js/nova.js) — relance une sauvegarde, pas un nouveau
   message distinct (jamais de doublon dans la conversation). */
function novabotMessageResauvegarder(index){
  const m = NOVABOT_CHAT.messages[index];
  if (!m || !m.saveFailed || !NOVABOT_CHAT.conversationId) return;
  novabotSauvegarderMessage(NOVABOT_CHAT.conversationId, m, { role:m.role, content:m.content });
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
    /* retryTexte = `contenu` lui-même (pas dernierMessageUtilisateur, qui
       n'existe pas encore ici) : sans ceci, le texte que l'utilisateur
       vient de taper (déjà effacé du champ par novabotChatSoumetre())
       serait purement et simplement perdu si la conversation n'a pas pu
       s'ouvrir — un échec réseau ne doit jamais faire disparaître ce que
       l'utilisateur a écrit. */
    NOVABOT_CHAT.messages.push({ role:'assistant', content:"Je n'ai pas pu ouvrir de conversation à l'instant (problème de connexion).", error:true, retryTexte: contenu });
    render();
    return;
  }
  const estPremierMessageUtilisateur = !NOVABOT_CHAT.messages.some(m => m.role === 'user');
  NOVABOT_CHAT.sending = true;
  const msgObj = { role:'user', content:contenu };
  NOVABOT_CHAT.messages.push(msgObj);
  render();

  const convId = NOVABOT_CHAT.conversationId;
  novabotSauvegarderMessage(convId, msgObj, { role:'user', content:contenu });
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

/* Bascule des actions d'un message (audit 2026-10-12, §2 : "présentation
   discrète et contextuelle, adaptée aux interactions tactiles" — plus
   une barre technique permanente sous chaque message sur mobile). Tap
   sur la bulle : ouvre ses actions (un seul message ouvert à la fois,
   re-tap referme). Édition en cours : ignoré, la bulle devient un champ
   de texte, pas une cible de bascule. */
function novabotMessageActionsBasculer(index){
  if (NOVABOT_CHAT.editingIndex !== null) return;
  NOVABOT_CHAT.revealedActionsIndex = (NOVABOT_CHAT.revealedActionsIndex === index) ? null : index;
  render();
}

/* Réessayer (audit 2026-10-12, §4 : "afficher une erreur claire et un
   bouton Réessayer en cas d'échec") : rejoue le texte conservé sur le
   message d'erreur lui-même (retryTexte) — retire ce message d'erreur
   avant de renvoyer, pour ne jamais accumuler plusieurs échecs affichés
   à la suite d'un simple clic. */
async function novabotMessageReessayer(index){
  const m = NOVABOT_CHAT.messages[index];
  if (!m || !m.retryTexte || NOVABOT_CHAT.sending) return;
  const texte = m.retryTexte;
  NOVABOT_CHAT.messages.splice(index, 1);
  render();
  await novabotChatEnvoyer(texte);
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

/* CORRECTIF (audit 2026-10-13, "fonctionnalités pas abouties") : jusqu'ici
   une bascule PUREMENT locale — semblait fonctionner (retour visuel
   immédiat) mais l'avis disparaissait à la moindre actualisation,
   jamais réellement enregistré. Persisté maintenant via action=feedback
   (api/me.js, metadata.feedback sur nova_messages) dès que le message a
   un id serveur ; si le PATCH échoue, la bascule visuelle est annulée —
   mieux vaut rien afficher qu'afficher un avis qui n'a pas réellement
   été pris en compte. */
async function novabotMessageFeedback(index, valeur){
  const m = NOVABOT_CHAT.messages[index];
  if (!m || m.role !== 'assistant') return;
  const avant = m.feedback || null;
  const apres = avant === valeur ? null : valeur;
  m.feedback = apres;
  render();
  if (!m.id || !NOVABOT_CHAT.conversationId) return; // pas encore de message serveur à cibler (sauvegarde en cours) : bascule locale seule pour l'instant
  try {
    const r = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(NOVABOT_CHAT.conversationId)}&action=feedback`,
      { method:'POST', body: JSON.stringify({ messageId:m.id, feedback:apres }) });
    if (!r.ok) throw new Error('réponse non ok');
  } catch (e){
    console.warn('[novabot-chat] avis non enregistré :', e);
    m.feedback = avant; // annule la bascule visuelle : jamais un avis affiché qui n'a pas réellement été pris en compte
    render();
  }
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
/* CORRECTIF (audit 2026-10-13, "je veux que tout soit automatisé [...]
   sans appuyer sur un bouton") : avant ce correctif, confirmer le mandat
   affichait littéralement "clique sur Évaluer maintenant" — exactement
   l'inverse de "entièrement automatique" pour un mandat en mode auto,
   et un geste manuel superflu même en conseil/semi-autonome (l'analyse
   elle-même peut démarrer seule ; seule l'EXÉCUTION d'un achat reste
   soumise à confirmation dans ces deux modes, déjà géré par
   evaluerNovaBot() lui-même). Lance maintenant la première évaluation
   directement à la confirmation, pour TOUS les modes — jamais besoin de
   trouver un bouton pour que NovaBot commence à travailler. Le cycle
   quotidien côté serveur (vercel.json, "crons") prend ensuite le relais
   sans navigateur ouvert. */
function novabotChatConfirmer(){
  const ok = novabotConfirmerMandat(NOVABOT_CHAT.mandateDraft);
  NOVABOT_CHAT.readyToConfirm = false;
  if (ok === false){ render(); return; }
  const recap = `Mandat confirmé — ${fmt.eur(state.novabot.wallet.invested)} simulés (aucun argent réel). `
    + `Je lance une première évaluation tout de suite, puis je repasserai chaque jour automatiquement sans que tu aies rien à faire.`;
  const msgRecap = { role:'assistant', content:recap };
  NOVABOT_CHAT.messages.push(msgRecap);
  if (NOVABOT_CHAT.conversationId){
    novabotSauvegarderMessage(NOVABOT_CHAT.conversationId, msgRecap, { role:'assistant', content:recap });
  }
  render();
  evaluerNovaBot();
}

/* Sibling de novabotChatConfirmer() ci-dessus, mais pour une MODIFICATION
   du mandat déjà confirmé (2026-10-15, "NovaBot — pilotage complet du
   mandat depuis le chat") — jamais le même chemin : novabotConfirmerMandat()
   est écrit exclusivement pour l'onboarding (dépôt initial, activation),
   le réappeler ici redéposerait du capital et redéclencherait "activé" à
   tort. `await` RÉEL de la réponse serveur (contrairement à la plupart
   des mutations NovaBot, silencieuses) : le message de succès n'est
   affiché qu'APRÈS une écriture confirmée, jamais avant ("ne jamais
   annoncer une modification réussie si elle n'a pas été enregistrée"). */
async function novabotChatConfirmerAmendement(){
  const p = NOVABOT_CHAT.pendingMandateAmendment;
  if (!p) return;
  NOVABOT_CHAT.readyToConfirmAmendment = false;
  let recap;
  try {
    const r = await authFetch('/api/me?resource=novabot', { method:'POST', body: JSON.stringify({
      action:'confirm_mandate_amendment', amendmentId:p.id, changes:p.changes,
      baseMandateId:p.baseMandateId, conversationId:NOVABOT_CHAT.conversationId, summary:p.summary,
    })});
    const d = await r.json().catch(() => ({}));
    if (r.ok){
      recap = `Modification enregistrée (version ${d.version}) — ${p.summary}`;
      await syncNovaBot(); // relit le mandat fraîchement écrit, une seule source de vérité
    } else if (d.error === 'mandat_modifie_depuis'){
      recap = "Le mandat a changé entre-temps (une autre conversation ou un autre appareil) — je n'ai rien modifié pour éviter d'écraser ce changement. Dis-moi si tu veux toujours appliquer la même chose.";
      await syncNovaBot();
    } else {
      recap = "Je n'ai pas pu enregistrer ce changement (problème serveur) — rien n'a été modifié.";
    }
  } catch (e){
    console.warn('[novabot-chat] confirmation de modification impossible :', e);
    recap = "Je n'ai pas pu enregistrer ce changement (problème réseau) — rien n'a été modifié.";
  }
  NOVABOT_CHAT.pendingMandateAmendment = null;
  const msgRecap = { role:'assistant', content:recap };
  NOVABOT_CHAT.messages.push(msgRecap);
  if (NOVABOT_CHAT.conversationId){
    novabotSauvegarderMessage(NOVABOT_CHAT.conversationId, msgRecap, { role:'assistant', content:recap });
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
