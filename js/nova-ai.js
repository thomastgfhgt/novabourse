function novascoreBloc(n){
  if (!n) return '';
  if (n.score === null){
    return `<div class="notice" style="margin-bottom:18px">
      <b>NovaScore non calculable.</b> Couverture des données : ${n.coverage} %.
      Sous 40 %, aucune note n'est produite.</div>`;
  }
  const familles = Object.values(n.families || {}).filter(f => f.score !== null)
    .sort((a, b) => b.score - a.score);
  return `<div class="nsc">
    <div class="nsc-head">
      <span class="nsc-val tabular-nums">${n.score}<small>/100</small></span>
      <span class="nsc-meta">
        <b>NovaScore</b>
        <span>Couverture ${n.coverage} %${n.coherence !== null && n.coherence !== undefined
          ? ` · Cohérence ${n.coherence} %` : ''} · Confiance ${esc(n.confidence)}</span>
      </span>
    </div>
    ${n.comparable ? '' : `<p class="tiny" style="margin-top:10px">Score partiel :
      la couverture est insuffisante pour comparer cette société à une autre.</p>`}
    <div class="nsc-fam">
      ${familles.map(f => `<div class="nsc-line">
        <span>${esc(f.label)}</span>
        <i><em style="width:${f.score}%"></em></i>
        <b class="tabular-nums">${f.score}</b>
      </div>`).join('')}
    </div>
    <p class="tiny" style="margin-top:12px">Calculé par NovaTitre
      (${esc(n.engine)}) à partir des données du dossier. Le modèle l'explique,
      il ne le produit pas.</p>
  </div>`;
}

async function runAnalysis(stockId){
  const st = byId[stockId];
  if (!st || !st.ticker){ toast("Entreprise non identifiée."); return; }
  if (state.auth.status !== 'authenticated'){ toast('Connectez-vous pour lancer une analyse.'); return; }

  /* NovaOrb (§53 du brief design system) : état "thinking" pendant
     l'attente de la réponse IA — remplace le spinner générique
     .brand-spin (logo qui tourne, déjà utilisé ailleurs pour le
     chargement de l'app) par .nova-orb (3 halos qui flottent, recolorés
     en bleu électrique/violet/cyan lors de la 2ᵉ passe de refonte
     visuelle du 2026-10-07 — plus d'orange, voir son commentaire CSS).
     C'est le seul endroit de l'app où l'IA "réfléchit" réellement à une
     question posée par l'utilisateur — l'endroit le plus honnête pour
     donner à NovaOrb un sens, plutôt que de l'ajouter à un endroit
     arbitraire juste pour l'utiliser. */
  openSheet(`<h3 id="sheetTitle">${esc(st.name)}</h3>
    <div id="aiOut"><div class="spin-wrap">
      <span class="nova-orb"><i></i><i></i><i></i></span>
      <span class="spin-txt">Analyse en cours…</span></div></div>`);

  let d;
  try {
    /* Identité déjà connue de NovaTitre (catalogue local, société créée via
       /api/market/search, ou retrouvée après refresh via runtimeCatalog) :
       transmise telle quelle pour que le dossier d'analyse ne reparte pas de
       zéro sur des champs que le frontend connaît déjà. `exchange` envoie le
       code canonique (exchangeCode), plus cohérent avec /api/market/company
       et /api/market/quotes qui l'utilisent déjà ailleurs — auparavant ce
       payload envoyait encore st.market (parfois un libellé lisible, ex.
       "Euronext Paris", au lieu du code "PA"). Aucun champ financier
       (fundamentals/score/prix) n'est envoyé ici : seule l'identité. */
    const r = await authFetch('/api/analyze', { method:'POST',
      body: JSON.stringify({
        ticker: st.ticker,
        exchange: st.exchangeCode || st.market || null,
        name: st.name || null,
        country: (st.country && st.country !== '—') ? st.country : null,
        sector: (st.sector && st.sector !== 'Non classé') ? st.sector : null,
        industry: st.industry || null,
        currency: st.cur || null,
        /* Niveau de langage (§45) : ajuste le ton de la réponse IA au mode
           actuel de l'utilisateur — jamais un second appel, jamais un
           champ financier supplémentaire. */
        mode: isExpert() ? 'expert' : 'debutant',
      }) });
    d = await r.json();
    if (!r.ok) throw Object.assign(new Error(d.error || d.code || 'erreur'), { data:d });
  } catch (e){
    const err = e.data || {};
    const key = err.code || err.error;

    /* Cas spécifique : couverture de données insuffisante pour produire un
       NovaScore. Le serveur ne devrait dans ce cas ni avoir appelé le
       modèle ni consommé de quota (voir rapport) — le frontend, lui, se
       contente d'afficher honnêtement cet état, sans jamais présenter la
       tentative comme une analyse IA aboutie (pas de nom de modèle ici). */
    if (key === 'insufficient_data' || key === 'donnees_insuffisantes' || key === 'coverage_insuffisante'){
      const out = document.getElementById('aiOut');
      const cov = Number.isFinite(err.coverage) ? err.coverage : null;
      const missing = Array.isArray(err.missing) ? err.missing : [];
      if (out) out.innerHTML = `<div class="notice" style="margin-top:8px">
        <b>Analyse impossible : données financières insuffisantes.</b>
        ${cov !== null ? `<p class="tiny" style="margin-top:8px">Couverture : ${cov} % · Minimum requis : 40 %</p>` : ''}
        ${missing.length ? `<p class="tiny" style="margin-top:6px">Données manquantes : ${missing.map(esc).join(', ')}</p>` : ''}
      </div>`;
      return;
    }

    const msg = { non_connecte:'Votre session a expiré. Reconnectez-vous.',
      quota_exceeded: err.message || 'Quota mensuel atteint.',
      aucun_modele_configure:"Aucun modèle n'est configuré sur le serveur.",
      entreprise_non_identifiee:"Entreprise non identifiée.",
      delai_depasse:"Le modèle n'a pas répondu à temps.",
      fournisseur_en_erreur:`Le fournisseur a répondu ${err.status || ''}.`,
      donnees_indisponibles:"Les données financières de cette société n'ont pas pu être récupérées.",
    }[key] || "L'analyse n'a pas abouti.";
    const out = document.getElementById('aiOut');
    if (out) out.innerHTML = `<div class="notice" style="margin-top:8px"><b>${esc(msg)}</b></div>`;
    return;
  }

  if (d.quota && state.account) Object.assign(state.account, d.quota);
  /* CORRECTIF (audit "screener sans effet", 2026-09-17) : le NovaScore
     calculé par /api/analyze n'était jusqu'ici affiché QUE dans ce panneau,
     jamais reporté sur st.score/st.scores — si bien que toute fonction
     s'appuyant sur ces champs (le filtre "Nova Score minimum" du Radar,
     notamment) restait aveugle même pour une valeur qu'on vient d'analyser.
     Écrit ici, immédiatement après l'analyse, jamais ailleurs deviné. */
  if (st && d.novascore){
    st.score = Number.isFinite(d.novascore.score) ? d.novascore.score : null;
    st.scores = Object.fromEntries(Object.entries(d.novascore.families || {})
      .map(([k, v]) => [k, v.score]));
    st.coverage = Number.isFinite(d.novascore.coverage) ? d.novascore.coverage : 0;
    st.partial = !d.novascore.comparable;
  }
  const a = d.analysis || {};
  const out = document.getElementById('aiOut');
  if (!out) return;
  out.innerHTML = `
    ${novascoreBloc(d.novascore)}
    ${d.marketConnected === false ? `<div class="notice" style="margin-bottom:18px">
      <b>Validation technique.</b> Aucun fournisseur de données de marché n'est encore
      connecté : cette réponse sert à vérifier la chaîne, elle ne constitue pas une analyse financière.
    </div>` : ''}
    ${a.whatItDoes ? `<p class="small" style="color:var(--ink-3)">${esc(a.whatItDoes)}</p>` : ''}
    <p class="small" style="margin-top:14px">${esc(a.summary || '')}</p>
    ${(a.positive || []).length ? `<p class="nova-t">Forces</p><ul class="pts good">
      ${a.positive.slice(0,3).map(x => `<li><i>+</i><span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
    ${(a.negative || []).length ? `<p class="nova-t">Risques</p><ul class="pts bad">
      ${a.negative.slice(0,3).map(x => `<li><i>−</i><span>${esc(x)}</span></li>`).join('')}</ul>` : ''}
    <p class="tiny" style="margin-top:8px">Modèle ${esc(d.model || '')} ·
      ${d.quota && !d.quota.unlimited ? `${d.quota.used}/${d.quota.limit} analyses ce mois` : ''}</p>
    <div class="notice" style="margin-top:16px">Aucun objectif de cours, aucune probabilité.
      Les chiffres proviennent de nos données, jamais du modèle.</div>`;
}

/* ---------- démarrage ---------- */
/* Charge le catalogue depuis /catalog.json (2026-09-24, voir la note sur
   `const stocks = []` plus haut pour le pourquoi). Remplit stocks/byId
   EN PLACE (push()/affectation de propriété, jamais stocks = ... ni
   byId = ...) : les deux gardent la même identité d'objet du début à la
   fin, donc tout code qui a déjà capturé une référence à l'un ou l'autre
   (avant même que cette fonction ait fini) voit les bonnes données dès
   qu'elles arrivent, sans rien recâbler.
   `if (byId[s.id]) continue` : une société "hors catalogue" déjà
   restaurée par restoreRuntimeCatalog() (positions/Comparer d'une
   session précédente) a pu arriver EN PREMIER, avant ce fetch — jamais
   la dupliquer ni écraser cette référence déjà potentiellement tenue
   ailleurs (une position du portefeuille, par exemple).
   Délai maximum de 6s (AbortController) : un fetch lent ne doit jamais
   bloquer indéfiniment le premier rendu — l'app démarre alors avec un
   catalogue vide/partiel plutôt que de ne jamais démarrer. */