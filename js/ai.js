/* ============================================================
   NOVATITRE — LE CERVEAU IA (suivi personnalisé par Nova Coach)
   ------------------------------------------------------------
   Trois façons de joindre l'IA, essayées dans cet ordre :
   1. « claude » : la page publiée sur claude.ai appelle Claude
      directement (capacité « sample », sur le compte du visiteur,
      avec son accord à la première question).
   2. « api »    : sur le vrai site, POST vers window.NT_AI_ENDPOINT
      (ex. '/api/coach'), qui appelle Claude côté serveur.
      Format : { task, prompt, json } → { text } (voir CAHIER-DES-CHARGES).
   3. « local »  : aucune IA joignable → analyse automatique par règles,
      clairement présentée comme telle.
   L'IA ne reçoit JAMAIS le nom de l'élève : seulement des statistiques
   d'apprentissage (missions, erreurs, examens, discipline).
   ============================================================ */
window.NT_AI = (() => {
  let mode = 'local', sample = null, ready = null;

  function init(){
    if (ready) return ready;
    ready = (async () => {
      try {
        if (window.claude && typeof window.claude.use === 'function'){
          sample = await window.claude.use('sample');
          if (sample){ mode = 'claude'; return mode; }
        }
      } catch (e){}
      if (window.NT_AI_ENDPOINT){ mode = 'api'; return mode; }
      mode = 'local'; return mode;
    })();
    return ready;
  }

  /* Règles fixes données à l'IA avant chaque demande (pas de « system prompt » côté page : on les met en tête). */
  const RULES = `Tu es Nova Coach, le coach pédagogique de NovaTitre, une école de bourse et de trading en ligne (simulateur, argent fictif).
Règles absolues :
- Tu expliques et tu fais progresser. Tu ne donnes JAMAIS de conseil en investissement personnalisé : jamais « achète », « vends » ou « garde » un titre réel, jamais de sélection de titres réels pour la personne, jamais de promesse ni de prévision de gains.
- Si on te demande quoi acheter : explique que tu ne peux pas, propose la check-list (horizon, épargne de précaution, perte supportable, diversification, frais) et une mission de l'école.
- Tu es une intelligence artificielle et tu peux te tromper ; pour les règles fiscales, rappelle de vérifier sur les sources officielles (impots.gouv.fr, AMF).
- Pas de crypto, CFD, forex ou levier présentés comme des opportunités : seulement pour comprendre leurs risques.
- Français simple, phrases courtes, tutoiement, ton chaleureux et motivant, jamais culpabilisant. Pas de jargon sans l'expliquer.
- Tu t'appuies uniquement sur les données fournies. N'invente pas de statistiques sur l'élève.`;

  async function ask(prompt, opts = {}){
    await init();
    const full = RULES + '\n\n' + prompt;
    if (mode === 'claude'){
      const o = { modelTier: opts.tier || 'default' };
      if (opts.onText) o.onText = opts.onText;
      if (opts.signal) o.signal = opts.signal;
      if (opts.nocache) o.cache = false;
      if (opts.turns){
        const turns = [{ role: 'user', content: RULES + '\n\n' + prompt }].concat(opts.turns);
        return opts.json ? await sample.json(turns, o) : (await sample(turns, o)).text;
      }
      return opts.json ? await sample.json(full, o) : (await sample(full, o)).text;
    }
    if (mode === 'api'){
      const r = await fetch(window.NT_AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: opts.signal,
        body: JSON.stringify({ task: opts.task || 'coach', prompt, turns: opts.turns || null, json: !!opts.json }) });
      if (!r.ok) throw { code: r.status === 429 ? 'rate_limited' : 'upstream_error', message: 'HTTP ' + r.status };
      const d = await r.json(); const text = d.text || '';
      if (opts.onText) opts.onText({ text, delta: text });
      if (!opts.json) return text;
      try { return JSON.parse(text.slice(text.search(/[[{]/), Math.max(text.lastIndexOf('}'), text.lastIndexOf(']')) + 1)); } catch (e){ throw { code: 'invalid_json', message: 'json', text }; }
    }
    throw { code: 'local', message: 'Aucune IA joignable ici.' };
  }

  const errorText = e => ({
    not_granted: 'Tu n’as pas autorisé Nova Coach à utiliser l’IA. L’analyse automatique reste disponible.',
    sampling_disabled: 'L’IA n’est pas disponible pour ce compte.',
    rate_limited: 'Nova Coach est très sollicité : réessaie dans un moment.',
    session_expired: 'Reconnecte-toi pour utiliser l’IA.',
    refused: 'Nova Coach n’a pas pu répondre à cette demande. Reformule autrement.',
    invalid_json: 'La réponse de l’IA était incomplète. Réessaie.',
    local: 'L’IA n’est pas branchée sur cette version : voici l’analyse automatique.',
    cancelled: '',
  }[e && e.code] ?? 'Connexion à l’IA interrompue. Réessaie dans un instant.');

  return { init, ask, errorText, get mode(){ return mode; } };
})();
