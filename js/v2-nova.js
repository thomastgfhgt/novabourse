/* ============================================================
   DESIGN V2 — modules Nova : NovaBot, Nova News, Nova Review, Nova Event
   (2026-10-19, maquette novatitre-v2.html)
   ============================================================
   Chargé APRÈS js/nova.js, js/novabot-chat.js et js/v2-*.js.

   Règles suivies (identiques au reste du design v2) :
   - Uniquement de l'AFFICHAGE. Aucun appel réseau nouveau, aucune donnée
     inventée : chaque chiffre vient des fonctions existantes de nova.js
     (bilanHebdomadaireNovaReview, evaluerVente, evaluerPositionOuverte,
     resumeNovaReviewPourCarte, WORLD_NEWS, evenementsSuivis...).
   - Tous les attributs d'action existants sont conservés tels quels
     (data-back, data-go, data-show-worldnews, data-nova-review-ia,
     data-novabot-view, data-novabot-suggestion, data-stock...).
   - Filet de sécurité : si un rendu v2 lève une erreur, on affiche la
     version d'origine de la page (jamais une page blanche). */

(function(){
  'use strict';

  /* ---------- outils ---------- */
  const echapper = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const e = s => (typeof esc === 'function' ? esc(s) : echapper(s));
  const ORIG = {
    novabot: PAGES.novabot, novanews: PAGES.novanews,
    novareview: PAGES.novareview, novaevent: PAGES.novaevent,
    portfolioView: typeof novabotPortfolioView === 'function' ? novabotPortfolioView : null,
    heroBot: typeof v2heroBot === 'function' ? v2heroBot : null,
  };
  function sur(nom, fn){
    return (...args) => {
      try { return fn(...args); }
      catch (err){
        console.warn('[v2-nova] rendu de repli pour', nom, err);
        return ORIG[nom] ? ORIG[nom](...args) : '';
      }
    };
  }
  const UIN = { revFilter:'tout', newsFilter:'tout', newsRefreshing:false };

  const I = {
    rook: V2ICON.rook, knight: V2ICON.knight, bishop: V2ICON.bishop, pawn: V2ICON.pawn,
    back: V2ICON.back, chev: V2ICON.chev, spark: V2ICON.spark, check: V2ICON.check,
    lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    ext:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  };

  const tete = (titre, eyebrow, couleur, icone, droite = '') => `
    <div class="n2-head"><button class="n2-circ" data-back aria-label="Retour">${I.back}</button><span style="flex:1"></span>${droite}</div>
    <p class="n2-eyebrow" style="color:${couleur}"><span class="n2-chess" style="background:${couleur}">${icone}</span>${eyebrow}</p>
    <h1 class="n2-title">${titre}</h1>`;

  function jauge(pct, petit, grad){
    const C = 2 * Math.PI * 50, v = Math.max(0, Math.min(100, pct)), off = C * (1 - v / 100);
    const id = 'n2g' + Math.random().toString(36).slice(2, 8);
    return `<div class="n2-gauge"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,.1)" stroke-width="12" fill="none"/>
      <circle class="v-gfg" cx="60" cy="60" r="50" stroke="url(#${id})" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}" style="transition:stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)"/>
      <defs><linearGradient id="${id}"><stop offset="0" stop-color="${grad[0]}"/><stop offset="1" stop-color="${grad[1]}"/></linearGradient></defs></svg>
      <div class="n2-gv"><div><b>${Math.round(v)}</b><small>${petit}</small></div></div></div>`;
  }
  const vide = (icone, couleur, titre, texte, bouton = '') => `<section class="n2-empty">
      <span class="n2-empty-i" style="background:${couleur}">${icone}</span>
      <h2>${titre}</h2><p>${texte}</p>${bouton}</section>`;

  /* ============================================================
     1. ACCUEIL : carte NovaBot entièrement cliquable + 2 boutons
     ============================================================ */
  if (ORIG.heroBot){
    window.v2heroBot = sur('heroBot', () => {
      const html = ORIG.heroBot();
      return html
        .replace('<article class="v-hero v-bot">', '<article class="v-hero v-bot n2-hero-bot" data-n2-bot="chat" role="button" tabindex="0" aria-label="Ouvrir NovaBot">')
        .replace(/<\/article>\s*$/, `<div class="n2-bot-links">
            <button type="button" data-n2-bot="chat">Ouvrir NovaBot ${I.arrow}</button>
            <button type="button" data-n2-bot="portfolio">Son portefeuille ${I.arrow}</button>
          </div></article>`);
    });
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-n2-bot]');
    if (!b) return;
    /* Les suggestions et le champ "Écris à Nova…" gardent leur propre action. */
    if (ev.target.closest('[data-v2ask], [data-v2ask-form], input, form')) return;
    NOVABOT_UI.view = b.dataset.n2Bot === 'portfolio' ? 'portfolio' : 'chat';
    go('novabot');
  });
  document.addEventListener('keydown', ev => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('article[data-n2-bot]')){
      ev.preventDefault(); NOVABOT_UI.view = 'chat'; go('novabot');
    }
  });

  /* ============================================================
     2. NOVABOT : accueil de la discussion + onglet Portefeuille
     ============================================================ */
  function bonjour(){
    const salut = typeof saluationJour === 'function' ? saluationJour() : (new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir');
    const prenom = typeof v2prenom === 'function' ? v2prenom() : null;
    return salut + (prenom ? ' ' + prenom : '');
  }
  PAGES.novabot = sur('novabot', () => {
    const html = ORIG.novabot();
    const c = NOVABOT_CHAT;
    const accueilSeul = NOVABOT_UI.view === 'chat' && !c.loadingThread && !c.sending
      && c.messages.length <= 1 && (!c.messages[0] || c.messages[0].role === 'assistant');
    if (!accueilSeul) return html;
    const intro = c.messages[0]?.content || (typeof novabotAccueilTexte === 'function' ? novabotAccueilTexte() : '');
    const bloc = `<div class="n2-nb-hello">
        <div class="n2-orb"><span class="n2-blob"></span><span class="n2-blob n2-b2"></span><span class="n2-core">${I.rook}</span></div>
        <h1>${e(bonjour())}</h1>
        <p>${e(intro)}</p>
        <p class="n2-nb-label">Pour commencer</p>
      </div>`;
    const i = html.indexOf('<div class="nb-chat-shell');
    if (i < 0) return html;
    return html.slice(0, i) + bloc + html.slice(i).replace('<div class="nb-chat-shell', '<div class="nb-chat-shell n2-accueil');
  });

  if (ORIG.portfolioView){
    window.novabotPortfolioView = sur('portfolioView', () => {
      if (typeof PORTEFEUILLE_FICTIF_PUBLIC !== 'undefined' && PORTEFEUILLE_FICTIF_PUBLIC) return ORIG.portfolioView();
      /* Aucun compte d'investissement réel : écran d'attente, sans aucun montant. */
      return `<section class="n2-soon">
        <div class="n2-orb n2-orb-s"><span class="n2-blob"></span><span class="n2-blob n2-b2"></span><span class="n2-core">${I.lock}</span></div>
        <span class="n2-pill">● Bientôt disponible</span>
        <h2>Le suivi de ton vrai portefeuille arrive</h2>
        <p>NovaBot peut déjà analyser des entreprises et t'expliquer une stratégie dans la discussion. Le suivi d'un vrai portefeuille arrivera une fois un compte d'investissement réel connecté.</p>
        <div class="n2-steps">
          <div class="n2-step"><span class="n2-n">1</span><div><b>Tu connectes ton compte</b><span>Un compte d'investissement réel, à ton nom.</span></div></div>
          <div class="n2-step"><span class="n2-n">2</span><div><b>Tu fixes ton mandat</b><span>Objectif, niveau de risque, secteurs à éviter.</span></div></div>
          <div class="n2-step"><span class="n2-n">3</span><div><b>NovaBot propose, tu décides</b><span>Chaque décision t'est expliquée avant toute confirmation.</span></div></div>
        </div>
        <button type="button" class="n2-cta" data-novabot-view="chat">Retour à la discussion</button>
      </section>`;
    });
  }

  /* ============================================================
     3. NOVA NEWS
     ============================================================ */
  function heureMaj(){
    const t = WORLD_NEWS.asOf ? new Date(WORLD_NEWS.asOf) : null;
    if (!t || isNaN(t)) return 'Mis à jour récemment';
    const min = Math.round((Date.now() - t.getTime()) / 60000);
    if (min < 1) return 'Mis à jour à l’instant';
    if (min < 60) return `Mis à jour il y a ${min} min`;
    return 'Mis à jour à ' + t.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  }
  const dateArticle = a => a.publishedAt
    ? (typeof formatDateAffichage === 'function' ? formatDateAffichage(a.publishedAt, 'intraday') : new Date(a.publishedAt).toLocaleString('fr-FR'))
    : '';
  const lien = u => {
    if (typeof safeHref === 'function') return safeHref(u);
    try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; }
  };
  const COULEURS_SOURCE = ['#1c3a6b', '#2b1f63', '#123c5a', '#1f4a3a', '#3a2a12', '#4a1f3a'];
  const couleurSource = s => COULEURS_SOURCE[[...String(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % COULEURS_SOURCE.length];

  PAGES.novanews = sur('novanews', () => {
    const noms = nomsEntreprisesPertinentes();
    const tous = WORLD_NEWS.items
      .filter(a => lien(a.url))
      .map(a => ({ ...a, pertinence: noms.length ? articlePertinentPour(a, noms) : null }))
      .sort((a, b) => (b.pertinence ? 1 : 0) - (a.pertinence ? 1 : 0));
    const nbPour = tous.filter(a => a.pertinence).length;
    if (UIN.newsFilter === 'pourtoi' && !nbPour) UIN.newsFilter = 'tout';
    const liste = UIN.newsFilter === 'pourtoi' ? tous.filter(a => a.pertinence) : tous;
    const droite = `<button class="n2-circ" data-search aria-label="Rechercher">${V2ICON.search}</button>`;
    let corps;
    if (WORLD_NEWS.status === 'idle'){
      corps = vide(I.bishop, '#3e63d6', 'Les actualités du jour', 'Les articles sont chargés quand tu le demandes.',
        `<button class="n2-cta" data-show-worldnews>Voir les actualités</button>`);
    } else if (WORLD_NEWS.status === 'loading' && !tous.length){
      corps = `<div class="n2-skel-card"><div class="n2-skel" style="height:150px;border-radius:22px"></div>
        <div class="n2-skel" style="width:85%"></div><div class="n2-skel" style="width:60%"></div></div>`;
    } else if (!tous.length){
      corps = vide(I.bishop, '#3e63d6', 'Actualités indisponibles', 'Aucun article n’a pu être obtenu pour le moment. Réessaie dans quelques minutes.',
        `<button class="n2-cta" data-n2-news-refresh>Réessayer</button>`);
    } else {
      const [une, ...reste] = liste;
      const img = une && lien(une.image);
      corps = `
        <div class="n2-chips">
          <button class="n2-chip ${UIN.newsFilter === 'tout' ? 'n2-on' : ''}" data-n2-news="tout">Tout <em>${tous.length}</em></button>
          ${nbPour ? `<button class="n2-chip ${UIN.newsFilter === 'pourtoi' ? 'n2-on' : ''}" data-n2-news="pourtoi">Pour toi <em>${nbPour}</em></button>` : ''}
        </div>
        ${une ? `<a class="n2-une" href="${e(lien(une.url))}" target="_blank" rel="noopener noreferrer">
          <div class="n2-cover"${img ? ` style="background-image:linear-gradient(180deg,rgba(11,9,18,0) 40%,rgba(11,9,18,.75)),url('${e(img)}')"` : ''}>
            <span class="n2-badge">À la une</span>
            ${img ? '' : `<svg viewBox="0 0 300 90" preserveAspectRatio="none"><path d="M0 70 C40 60 60 30 100 40 S160 80 200 50 260 20 300 30 V90 H0Z" fill="rgba(255,255,255,.08)"/><path d="M0 70 C40 60 60 30 100 40 S160 80 200 50 260 20 300 30" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"/></svg>`}
          </div>
          <div class="n2-une-body"><h2>${e(une.title)}</h2>
            <div class="n2-meta">${une.source ? `<span class="n2-src">${e(une.source)}</span>` : ''}<span>${e(dateArticle(une))}</span>${I.ext}</div>
            ${une.pertinence ? `<div class="n2-meta"><span class="n2-concerne">Concerne ${e(une.pertinence.label)}</span></div>` : ''}
          </div></a>` : ''}
        ${reste.length ? `<section class="n2-card n2-nlist">${reste.map(a => {
          const im = lien(a.image);
          return `<a class="n2-nitem" href="${e(lien(a.url))}" target="_blank" rel="noopener noreferrer">
            <span class="n2-thumb" style="${im ? `background-image:url('${e(im)}')` : `background:linear-gradient(135deg,${couleurSource(a.source)},#120e22)`}">${im ? '' : e(String(a.source || '·')[0])}</span>
            <span class="n2-tx"><b>${e(a.title)}</b>
              <span class="n2-meta">${a.source ? `<span class="n2-src">${e(a.source)}</span>` : ''}<span>${e(dateArticle(a))}</span></span>
              ${a.pertinence ? `<span class="n2-meta"><span class="n2-concerne">Concerne ${e(a.pertinence.label)}</span></span>` : ''}</span></a>`;
        }).join('')}</section>` : ''}
        <p class="n2-legal">Articles de presse externes, non rédigés par NovaTitre · sources ${e((WORLD_NEWS.sourcesUtilisees || []).join(', ') || '—')}. Pas un conseil en investissement.</p>`;
    }
    return `<div class="v-page n2-page">
      ${tete('L’actualité qui compte pour toi', 'Nova News', '#3e63d6', I.bishop, droite)}
      <p class="n2-lead">Actualité économique, financière et géopolitique mondiale. Les articles qui citent tes valeurs passent en premier.</p>
      ${WORLD_NEWS.status !== 'idle' && tous.length ? `<div class="n2-upd"><i></i>${e(heureMaj())}
        <button data-n2-news-refresh class="${UIN.newsRefreshing ? 'n2-spin' : ''}">${I.refresh}Actualiser</button></div>` : ''}
      ${corps}
    </div>`;
  });
  document.addEventListener('click', async ev => {
    const f = ev.target.closest('[data-n2-news]');
    if (f){ UIN.newsFilter = f.dataset.n2News; render(); return; }
    if (ev.target.closest('[data-n2-news-refresh]')){
      if (UIN.newsRefreshing) return;
      UIN.newsRefreshing = true; render();
      try { await chargerNovaNewsMonde({ silencieux: WORLD_NEWS.status === 'loaded' }); } catch (err){ console.warn('[v2-nova] actualisation', err); }
      UIN.newsRefreshing = false; render();
      if (typeof toast === 'function') toast(WORLD_NEWS.status === 'loaded' ? 'Actualité à jour' : 'Actualités indisponibles pour le moment');
    }
  });

  /* ============================================================
     4. NOVA REVIEW
     ============================================================ */
  const CAT = v => (v === 'Excellent coup' || v === 'Bon coup') ? 'bon'
    : (v === 'Risqué' || v === 'Intéressant') ? 'surv'
    : (v === 'Erreur à étudier' || v === 'Occasion manquée') ? 'revoir' : 'autre';
  const pctTxt = r => (r >= 0 ? '+' : '−') + (Math.abs(r) * 100).toLocaleString('fr-FR', { maximumFractionDigits:1 }) + ' %';

  function prevuReel(tx, ev, these){
    if (!these || !these.thesisReason) return '';
    const horizon = these.thesisHorizon && HORIZON_LABEL[these.thesisHorizon] ? `Horizon ${HORIZON_LABEL[these.thesisHorizon]}` : '';
    let reel;
    if (ev.ouverte){
      reel = `Toujours détenue${Number.isFinite(ev.gainPct) ? ` · ${pctTxt(ev.gainPct)} latent` : ''}`;
    } else {
      const jours = Math.max(0, Math.round((new Date(tx.date) - new Date(these.date)) / 86400000));
      reel = `Vendue après ${jours} j${Number.isFinite(ev.gainPct) ? ` · ${pctTxt(ev.gainPct)}` : ''}`;
    }
    return `<div class="n2-vs"><div><p class="n2-lab">Prévu</p><p class="n2-val">${e(these.thesisReason)}${horizon ? `<span>${e(horizon)}</span>` : ''}</p></div>
      <div class="n2-arrow">${I.arrow}</div>
      <div><p class="n2-lab">Réalité</p><p class="n2-val">${e(reel)}</p></div></div>`;
  }
  function carteDecision({ tx, ev, stockId }){
    const style = VERDICT_STYLE[ev.verdict] || { accent:'#a8a2c8', rgb:'168,162,200' };
    const st = byId[stockId];
    const dateTx = new Date(tx.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
    const sous = ev.ouverte ? `Achetée · ${fmt.eur(tx.amountEUR)} investis` : `Vendue le ${dateTx} · ${fmt.eur(tx.amountEUR)} récupérés`;
    const these = theseAvantVente(stockId, ev.ouverte ? new Date().toISOString() : tx.date);
    const couleurRaison = r => /^(Gain|Horizon .* respecté|Vendre a évité|Thèse déclarée)/.test(r) ? '#3fd39a'
      : /^(Perte|Vendu en dehors|Cet achat représentait|Représente|Conserver aurait)/.test(r) ? '#ff6b6b' : '#f2b54a';
    return `<article class="n2-dec">
      <div class="n2-dec-h">${st && typeof v2logo === 'function' ? v2logo(st) : `<span class="n2-chess" style="background:#2a2347;width:40px;height:40px">${I.pawn}</span>`}
        <span class="n2-t"><b>${e(tx.name)}</b><span>${e(sous)}</span></span>
        <span class="n2-verdict" style="background:rgba(${style.rgb},.16);color:${style.accent}">${e(ev.verdict)}</span></div>
      ${prevuReel(tx, ev, these)}
      <ul class="n2-facts">${ev.raisons.map(r => `<li><i style="background:${couleurRaison(r)}"></i>${e(r)}</li>`).join('')}</ul>
      ${st ? `<button type="button" class="n2-ghost" data-stock="${e(st.id)}">Voir la fiche ${I.chev}</button>` : ''}
    </article>`;
  }

  PAGES.novareview = sur('novareview', () => {
    const ventes = state.transactions.filter(t => t.type === 'sell').slice().reverse()
      .map(tx => ({ tx, ev: evaluerVente(tx), stockId: tx.stockId }));
    const ouvertes = state.wallet.positions.map(pos => {
      const ev = evaluerPositionOuverte(pos);
      if (!ev) return null;
      const st = byId[pos.id];
      return { tx: { name: st?.name || pos.id, date: new Date().toISOString(), amountEUR: toEUR(pos.avg * pos.qty, st?.cur || 'EUR') }, ev, stockId: pos.id };
    }).filter(Boolean);
    const lead = `<p class="n2-lead">Ce que tu avais prévu à l’achat, comparé à ce qui s’est réellement passé. Jamais un jugement inventé : seulement des faits comparés à ta propre intention déclarée.</p>`;
    if (!ventes.length && !ouvertes.length){
      return `<div class="v-page n2-page">${tete('Tes décisions, face à tes intentions', 'Nova Review', '#e0529b', I.knight)}${lead}
        ${vide(I.knight, '#e0529b', 'Pas encore de décision à analyser', 'Nova Review comparera tes décisions à ce que tu avais prévu dès ton premier achat ou ta première vente.')}</div>`;
    }
    const bilan = bilanHebdomadaireNovaReview();
    const r = resumeNovaReviewPourCarte();
    const toutes = [...ouvertes, ...ventes];
    const compte = { bon:0, surv:0, revoir:0 };
    toutes.forEach(d => { const k = CAT(d.ev.verdict); if (k in compte) compte[k]++; });
    const filtrees = UIN.revFilter === 'tout' ? toutes : toutes.filter(d => CAT(d.ev.verdict) === UIN.revFilter);

    const ia = NOVA_REVIEW_IA;
    const blocIA = !bilan ? '' : ia.status === 'idle'
      ? `<button class="n2-cta n2-violet" data-nova-review-ia>${I.spark} Commenter ma semaine avec Nova AI</button>`
      : ia.status === 'loading' ? `<div class="n2-ia"><div class="n2-skel" style="width:90%"></div><div class="n2-skel" style="width:70%"></div><p class="n2-mute">Nova AI commente ta semaine…</p></div>`
      : ia.status === 'error' ? `<div class="n2-notice">${e(ia.erreur || "Le commentaire IA n'a pas abouti.")}</div>`
      : ia.commentaire ? `<div class="n2-ia"><p class="n2-ia-t">${I.spark} Nova AI</p>
          <p>${e(ia.commentaire.resume || '')}</p>
          ${(ia.commentaire.points || []).length ? `<ul class="n2-facts">${ia.commentaire.points.map(p => `<li><i style="background:#a68cff"></i>${e(p)}</li>`).join('')}</ul>` : ''}
          ${ia.commentaire.lecon ? `<div class="n2-lesson"><b>À retenir · </b>${e(ia.commentaire.lecon)}</div>` : ''}
          <p class="n2-mute">Commentaire généré à partir des verdicts calculés par NovaTitre, jamais l’inverse.</p></div>` : '';

    const hero = bilan ? `<section class="n2-rev-hero">
        <div class="n2-gwrap">
          ${r && r.total ? jauge(r.bonnes / r.total * 100, '% réussies', ['#ff8fd0', '#a68cff']) : ''}
          <div class="n2-kpis"><p class="n2-mute" style="color:#ff9fd3;font-weight:700">7 derniers jours</p>
            <b>${bilan.achats.length} achat${bilan.achats.length > 1 ? 's' : ''} · ${bilan.ventes.length} vente${bilan.ventes.length > 1 ? 's' : ''}</b>
            ${bilan.performance ? `<span class="${bilan.performance.variation >= 0 ? 'n2-up' : 'n2-down'}">${bilan.performance.variation >= 0 ? '▲' : '▼'} ${fmt.eur(Math.abs(bilan.performance.variation))} (${fmt.pct(bilan.performance.variationPct, 1)})</span>` : ''}
          </div></div>
        ${r ? `<div class="n2-rkpis"><div><b class="n2-up">${r.bonnes}</b><span>bonne${r.bonnes > 1 ? 's' : ''} décision${r.bonnes > 1 ? 's' : ''}</span></div>
          <div><b style="color:#f2b54a">${r.surveiller}</b><span>à surveiller</span></div>
          <div><b class="n2-down">${r.erreurs}</b><span>à revoir</span></div></div>` : ''}
        <div class="n2-tiles">
          ${bilan.meilleure ? `<div><span>Meilleure décision</span><b>${e(bilan.meilleure.tx.name)}</b></div>` : ''}
          ${bilan.plusRisquee && bilan.plusRisquee.ev.concentration !== null ? `<div><span>Plus risquée</span><b>${e(bilan.plusRisquee.tx.name)}</b><em>${fmt.pctRatio(bilan.plusRisquee.ev.concentration, 0)} du capital</em></div>` : ''}
          <div><span>Diversification</span><b>${bilan.secteursDistincts} secteur${bilan.secteursDistincts > 1 ? 's' : ''}</b><em>plus grosse ligne : ${bilan.maxPositionPct} %</em></div>
        </div>
        ${bilan.lecon ? `<div class="n2-lesson"><b>Leçon de la semaine · </b>${e(bilan.lecon)}</div>` : ''}
        ${blocIA}
      </section>` : `<section class="n2-rev-hero"><p class="n2-mute" style="margin:0">Aucune décision ces 7 derniers jours : le bilan de la semaine apparaîtra dès ton prochain achat ou ta prochaine vente.</p></section>`;

    const puces = [['tout', 'Toutes', toutes.length], ['bon', 'Bons coups', compte.bon], ['surv', 'À surveiller', compte.surv], ['revoir', 'À revoir', compte.revoir]]
      .filter(([k, , n]) => k === 'tout' || n)
      .map(([k, l, n]) => `<button class="n2-chip ${UIN.revFilter === k ? 'n2-on' : ''}" data-n2-rev="${k}">${l} <em>${n}</em></button>`).join('');

    return `<div class="v-page n2-page">${tete('Tes décisions, face à tes intentions', 'Nova Review', '#e0529b', I.knight)}${lead}
      ${hero}
      <div class="n2-sec-h"><h2>Tes décisions</h2></div>
      <div class="n2-chips">${puces}</div>
      ${filtrees.length ? filtrees.map(carteDecision).join('') : `<p class="n2-mute" style="text-align:center;padding:20px 0">Aucune décision dans ce filtre.</p>`}
      <p class="n2-legal">Analyse de tes propres décisions, à but pédagogique. Pas un conseil en investissement.</p>
    </div>`;
  });
  document.addEventListener('click', ev => {
    const f = ev.target.closest('[data-n2-rev]');
    if (f){ UIN.revFilter = f.dataset.n2Rev; render(); }
  });

  /* ============================================================
     5. NOVA EVENT
     ============================================================ */
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function dansJours(iso){
    const j = Math.round((new Date(iso + 'T12:00:00') - new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00')) / 86400000);
    return j <= 0 ? 'Aujourd’hui' : j === 1 ? 'Demain' : `Dans ${j} jours`;
  }
  PAGES.novaevent = sur('novaevent', () => {
    const suivis = stocksSuivisPourEvenements();
    const head = tete('Les rendez-vous de tes entreprises', 'Nova Event', '#1f9fd0', I.pawn);
    const lead = `<p class="n2-lead">Résultats et dividendes à venir de tes valeurs suivies et détenues. Couverture : actions cotées aux États-Unis (Nasdaq, NYSE, AMEX).</p>`;
    if (!state.watchlist.length && !state.wallet.positions.length){
      return `<div class="v-page n2-page">${head}${lead}${vide(I.cal, '#1f9fd0', 'Aucune valeur suivie',
        'Ajoute une action à ta liste ou à ton portefeuille pour voir ici ses prochains résultats et dividendes.',
        `<button class="n2-cta" data-go="markets">Explorer les marchés</button>`)}</div>`;
    }
    if (!suivis.length){
      return `<div class="v-page n2-page">${head}${lead}${vide(I.cal, '#1f9fd0', 'Calendrier réservé aux actions',
        'Nova Event couvre les résultats et dividendes des actions. Tes valeurs suivies actuelles n’en contiennent aucune (ETF, indice…).')}</div>`;
    }
    const enCours = suivis.filter(st => st.fundamentalsStatus === 'idle' || st.fundamentalsStatus === 'loading');
    const evts = evenementsSuivis();
    let corps;
    if (evts.length){
      const groupes = [];
      for (const ev of evts){
        const d = new Date(ev.date + 'T12:00:00');
        const cle = MOIS[d.getMonth()] + ' ' + d.getFullYear();
        let g = groupes.find(x => x.cle === cle);
        if (!g){ g = { cle, items:[] }; groupes.push(g); }
        g.items.push(ev);
      }
      const prochain = evts[0];
      corps = `<section class="n2-ev-hero">
          <p class="n2-mute" style="color:#7fd7f5;font-weight:700">Prochain rendez-vous · ${e(dansJours(prochain.date))}</p>
          <div class="n2-ev-big"><span class="n2-day"><b>${new Date(prochain.date + 'T12:00:00').getDate()}</b>${MOIS[new Date(prochain.date + 'T12:00:00').getMonth()]}</span>
            <div><b>${prochain.type === 'earnings' ? 'Résultats' : 'Dividende'} ${e(prochain.ticker)}</b><span>${e(prochain.label)}${prochain.type === 'earnings' && prochain.estimated ? ' · date estimée' : ''}</span></div></div>
          <p class="n2-mute" style="margin:12px 0 0">${evts.length} événement${evts.length > 1 ? 's' : ''} à venir pour ${suivis.length} action${suivis.length > 1 ? 's' : ''} suivie${suivis.length > 1 ? 's' : ''}.</p>
        </section>
        ${groupes.map(g => `<div class="n2-sec-h"><h2>${e(g.cle.charAt(0).toUpperCase() + g.cle.slice(1))}</h2></div>
          <section class="n2-card" style="padding:4px 18px">${g.items.map(ev => {
            const d = new Date(ev.date + 'T12:00:00');
            const detail = ev.type === 'earnings'
              ? `Résultats ${ev.estimated ? 'estimés' : 'prévus'}`
              : `Détachement du dividende${Number.isFinite(ev.amount) ? ` · ${fmt.num(ev.amount, 2)} $/action` : ''}${ev.paymentDate ? ` · versé le ${dateEvenementAffichee(ev.paymentDate)}` : ''}`;
            return `<button type="button" class="n2-evrow" data-stock="${e(ev.stockId)}">
              <span class="n2-day n2-day-s"><b>${d.getDate()}</b>${MOIS[d.getMonth()]}</span>
              <span class="n2-t"><b>${e(ev.ticker)} <em>${e(ev.label)}</em></b><span>${e(detail)}</span></span>
              <span class="n2-tag ${ev.type === 'earnings' ? 'n2-tag-r' : 'n2-tag-d'}">${ev.type === 'earnings' ? 'Résultats' : 'Dividende'}</span></button>`;
          }).join('')}</section>`).join('')}`;
    } else if (enCours.length){
      corps = `<div class="n2-skel-card"><div class="n2-skel" style="height:90px;border-radius:22px"></div><div class="n2-skel" style="width:70%"></div></div>
        <p class="n2-mute" style="text-align:center">Chargement des dates connues…</p>`;
    } else {
      corps = vide(I.cal, '#1f9fd0', 'Aucun événement connu',
        'Aucune date de résultats ou de dividende n’est connue pour tes valeurs suivies : la donnée n’est pas disponible pour ces titres, ou aucune échéance n’est prévue prochainement.');
    }
    return `<div class="v-page n2-page">${head}${lead}${corps}
      <p class="n2-legal">Dates issues du calendrier public Nasdaq. Les dates de résultats non confirmées par l’entreprise sont des estimations.</p></div>`;
  });
})();
