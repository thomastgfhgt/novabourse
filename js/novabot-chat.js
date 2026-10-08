/* ============================================================
   NOVABOT — CONVERSATION (refonte expérience, 2026-10-08)
   ------------------------------------------------------------
   Retour utilisateur explicite : "l'élément central doit être la
   conversation avec NovaBot [...] le mandat doit être créé automatiquement
   à partir de la conversation [...] NovaBot doit répondre en utilisant
   son portefeuille, son mandat, ses analyses et ses décisions RÉELLEMENT
   enregistrées." Ce fichier est la seule pièce manquante pour relier le
   moteur déjà construit (Mandate Engine + Risk Engine + pipeline de
   décision, js/core.js) à une expérience que l'utilisateur voit et à
   laquelle il parle — rien ici ne duplique ce moteur, tout passe par les
   fonctions déjà existantes (novabotMandat(), novabotConfirmerMandat(),
   state.novabot.decisions/wallet).

   Persistance : réutilise TEL QUEL l'infrastructure Nova Core déjà posée
   (nova_conversations/nova_messages, ?resource=conversations dans
   api/me.js) — jamais une table dédiée à NovaBot, cette conversation est
   juste une parmi d'autres avec module='novabot' (déjà prévu dans le
   schéma depuis sa création). Aucune nouvelle table, aucun nouveau
   fichier serverless.

   Pas de tool-calling natif par fournisseur (3 APIs différentes) : les
   données réelles (portefeuille/décisions/mandat) sont assemblées ICI,
   côté client, à partir de ce que l'app a déjà en mémoire, puis envoyées
   au serveur à chaque tour — voir novabotChatContexte(). Le serveur
   (api/analyze.js, mode 'novabot-chat') ne fait QUE transmettre ces
   données au modèle et valider strictement sa réponse, jamais les
   récupérer lui-même. */

let NOVABOT_CHAT = { loaded:false, loading:false, sending:false, conversationId:null, messages:[], mandateDraft:{} };

/* Recherche déterministe (jamais confiée au modèle) : une décision dont le
   ticker ou le nom apparaît dans le message de l'utilisateur est jointe
   au contexte MÊME si elle est plus ancienne que les recentDecisions
   envoyées par défaut — permet "pourquoi as-tu acheté LVMH en octobre ?"
   six mois plus tard sans renvoyer tout l'historique à chaque tour. */
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

/* Assemble ce qui sera transmis à Nova Core pour CE tour — voir
   CONSIGNE_NOVABOT_CHAT (api/analyze.js) pour comment c'est utilisé. */
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

/* Charge (ou crée) LA conversation NovaBot — une seule par utilisateur,
   comme toute conversation Nova Core (module='novabot'). Amorce un
   premier message d'accueil SCRIPTÉ (aucun appel modèle : un bonjour ne
   justifie pas un appel IA ni ne consomme de quota) si la conversation
   est neuve. */
async function novabotChatCharger(){
  if (NOVABOT_CHAT.loaded || NOVABOT_CHAT.loading) return;
  NOVABOT_CHAT.loading = true;
  try {
    const r = await authFetch('/api/me?resource=conversations');
    if (r.ok){
      const data = await r.json();
      const existante = (data.conversations || []).find(c => c.module === 'novabot');
      if (existante){
        const r2 = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(existante.id)}`);
        if (r2.ok){
          const full = await r2.json();
          NOVABOT_CHAT.conversationId = full.id;
          NOVABOT_CHAT.messages = full.messages.map(m => ({ role:m.role, content:m.content }));
          /* Le brouillon de mandat n'est pas une colonne séparée : repris
             du dernier instantané joint à un message assistant (voir
             novabotChatEnvoyer() plus bas) — seule façon de le faire
             survivre à un rechargement de page sans nouvelle table. */
          const dernierAvecDraft = [...full.messages].reverse().find(m => m.metadata?.mandateDraftSnapshot);
          NOVABOT_CHAT.mandateDraft = dernierAvecDraft?.metadata?.mandateDraftSnapshot || {};
        }
      }
    }
  } catch (e){ console.warn('[novabot-chat] chargement impossible :', e); }
  NOVABOT_CHAT.loading = false;
  NOVABOT_CHAT.loaded = true;

  if (!NOVABOT_CHAT.conversationId){
    try {
      const r = await authFetch('/api/me?resource=conversations', { method:'POST',
        body: JSON.stringify({ module:'novabot', title:'NovaBot' }) });
      if (r.ok){ const d = await r.json(); NOVABOT_CHAT.conversationId = d.id; }
    } catch (e){ console.warn('[novabot-chat] création impossible :', e); }
  }
  if (!NOVABOT_CHAT.messages.length){
    const accueil = state.novabot.mandateConfirmed
      ? `Bonjour, je suis Nova. Ton mandat est actif — demande-moi par exemple « qu'as-tu fait récemment ? » ou « pourquoi as-tu acheté X ? ».`
      : `Bonjour, je suis Nova. Je vais gérer un portefeuille simulé pour toi — jamais d'argent réel. Pour commencer : quel capital souhaites-tu me confier, et pour quel objectif ?`;
    NOVABOT_CHAT.messages.push({ role:'assistant', content:accueil });
    if (NOVABOT_CHAT.conversationId){
      authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(NOVABOT_CHAT.conversationId)}&action=message`,
        { method:'POST', body: JSON.stringify({ role:'assistant', content:accueil }) }).catch(() => {});
    }
  }
  render();
}

/* Envoie un tour complet : persiste le message utilisateur, appelle Nova
   Core avec le contexte réel assemblé ci-dessus, applique la réponse
   (texte + éventuel brouillon de mandat mis à jour), persiste la réponse.
   Ne lève jamais : un échec affiche un message d'erreur DANS la
   conversation plutôt que de la casser. */
async function novabotChatEnvoyer(texte){
  const contenu = (texte || '').trim().slice(0, 2000);
  if (!contenu || NOVABOT_CHAT.sending) return;
  NOVABOT_CHAT.sending = true;
  NOVABOT_CHAT.messages.push({ role:'user', content:contenu });
  render();

  if (NOVABOT_CHAT.conversationId){
    authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(NOVABOT_CHAT.conversationId)}&action=message`,
      { method:'POST', body: JSON.stringify({ role:'user', content:contenu }) }).catch(() => {});
  }

  try {
    const r = await authFetch('/api/analyze', { method:'POST', body: JSON.stringify({
      mode:'novabot-chat',
      messages: NOVABOT_CHAT.messages,
      mandateConfirmed: state.novabot.mandateConfirmed,
      ...novabotChatContexte(contenu),
    })});
    if (!r.ok){
      const err = await r.json().catch(() => ({}));
      const msg = err.error === 'quota_exceeded'
        ? "J'ai atteint le quota d'analyses IA de ce mois-ci pour notre conversation — réessaie le mois prochain, ou passe à une offre supérieure."
        : "Je n'ai pas pu répondre à l'instant (problème de connexion au modèle). Réessaie dans un instant.";
      NOVABOT_CHAT.messages.push({ role:'assistant', content:msg });
      NOVABOT_CHAT.sending = false; render(); return;
    }
    const d = await r.json();
    NOVABOT_CHAT.messages.push({ role:'assistant', content:d.reply });
    if (d.mandateDraft){
      NOVABOT_CHAT.mandateDraft = { ...NOVABOT_CHAT.mandateDraft, ...d.mandateDraft };
    }
    NOVABOT_CHAT.readyToConfirm = Boolean(d.readyToConfirm);
    if (NOVABOT_CHAT.conversationId){
      authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(NOVABOT_CHAT.conversationId)}&action=message`,
        { method:'POST', body: JSON.stringify({ role:'assistant', content:d.reply,
          metadata: { provider:d.provider, model:d.model, mandateDraftSnapshot: NOVABOT_CHAT.mandateDraft } }) }).catch(() => {});
    }
  } catch (e){
    console.warn('[novabot-chat] envoi impossible :', e);
    NOVABOT_CHAT.messages.push({ role:'assistant', content:"Je n'ai pas pu répondre à l'instant. Réessaie dans un instant." });
  }
  NOVABOT_CHAT.sending = false;
  render();
}

/* Lit #novabotChatInput, vide le champ, envoie — appelée par le clic sur
   "Envoyer" ET par la touche Entrée (voir le gestionnaire global
   keydown, index.html, même convention que submitGateEmail()). */
function novabotChatSoumetre(){
  const input = document.getElementById('novabotChatInput');
  if (!input || !input.value.trim() || NOVABOT_CHAT.sending) return;
  const texte = input.value;
  input.value = '';
  novabotChatEnvoyer(texte);
}

/* Geste explicite de confirmation (§12 : jamais automatique) — commet le
   brouillon comme mandat réel (novabotConfirmerMandat(), js/core.js) puis
   ajoute un message de confirmation scripté à la conversation (pas un
   appel modèle : confirmer une action déjà prise par l'utilisateur ne
   nécessite aucun raisonnement). */
function novabotChatConfirmer(){
  novabotConfirmerMandat(NOVABOT_CHAT.mandateDraft);
  NOVABOT_CHAT.readyToConfirm = false;
  const recap = `Mandat confirmé — ${fmt.eur(state.novabot.wallet.invested)} confiés, activé en simulation. `
    + `Je commence à chercher des opportunités dès que tu le souhaites (bouton « Évaluer maintenant ») ou dis-moi simplement d'y aller.`;
  NOVABOT_CHAT.messages.push({ role:'assistant', content:recap });
  if (NOVABOT_CHAT.conversationId){
    authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(NOVABOT_CHAT.conversationId)}&action=message`,
      { method:'POST', body: JSON.stringify({ role:'assistant', content:recap }) }).catch(() => {});
  }
  render();
}
