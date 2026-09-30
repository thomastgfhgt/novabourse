let searchTimer = null, hits = [], hi = 0, searchToken = 0;
/* Morph de la recherche (motion system, 2026-09-21) : la capsule d'où
   vient le clic (icône loupe de l'en-tête, bouton "Rechercher…" d'un
   état vide, etc.) sert de point de départ visuel — même technique FLIP
   que les .seg (voir plus haut) et le même constat que pour eux :
   .sheet est recréé à chaque ouverture, donc on écrit la position/échelle
   de départ en variable CSS, on force un reflow, puis on laisse
   l'animation "searchMorph" jouer vers la position naturelle. Sans clic
   d'origine (raccourci clavier "/"), repli sur l'icône de l'en-tête —
   si elle non plus n'existe pas (page gate), pas de morph, juste
   l'entrée standard des feuilles. */
function openSearch(origin){
  const originEl = origin || document.querySelector('[data-search]');
  const originRect = originEl ? originEl.getBoundingClientRect() : null;
  openSheet(`<h3 id="sheetTitle">Rechercher</h3>
    <input class="field" id="sq" type="search" placeholder="Entreprise, symbole, secteur…"
      autocomplete="off" aria-label="Rechercher" style="margin-top:16px">
    <div id="sqOut"></div>`);
  const sheetEl = document.getElementById('sheet');
  /* Le morph (mise à l'échelle depuis une icône) n'a de sens que pour la
     boîte de dialogue centrée du desktop — sous 641px, .sheet devient une
     feuille pleine largeur ancrée en bas (voir @media max-width:640px) :
     partir d'une icône de 38px en haut d'écran donnerait un étirement
     brutal plutôt qu'un morph. Le slide-up standard (sheetUp), déjà
     adapté au mobile, reste inchangé sous ce seuil. */
  if (originRect && sheetEl && window.innerWidth > 640){
    const sr = sheetEl.getBoundingClientRect();
    if (sr.width && sr.height){
      const dx = (originRect.left + originRect.width/2) - (sr.left + sr.width/2);
      const dy = (originRect.top + originRect.height/2) - (sr.top + sr.height/2);
      const sx = Math.max(.1, Math.min(1, originRect.width / sr.width));
      const sy = Math.max(.1, Math.min(1, originRect.height / sr.height));
      sheetEl.style.setProperty('--morph-from',
        `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`);
      sheetEl.style.animation = 'none';
      sheetEl.offsetHeight; // force le reflow avant d'activer l'animation
      sheetEl.style.animation = '';
      sheetEl.classList.add('sheet-morph');
    }
  }
  const i = document.getElementById('sq');
  i.focus(); paintSearch('');
  i.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const out = document.getElementById('sqOut');
    if (out) out.innerHTML = `<div style="margin-top:16px">${'<div class="sk" style="height:56px;margin-top:8px"></div>'.repeat(3)}</div>`;
    searchTimer = setTimeout(() => paintSearch(i.value), 170);
  });
  i.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault(); hi = Math.max(0, Math.min(hits.length-1, hi + (e.key==='ArrowDown'?1:-1)));
      document.querySelectorAll('#sqOut .row').forEach((el,n)=>el.style.background = n===hi?'var(--bg-2)':'');
    } else if (e.key === 'Enter' && hits[hi]) pick(hits[hi]);
  });
}
function renderHits(q, remoteSettled){
  const out = document.getElementById('sqOut'); if (!out) return;
  if (!hits.length){
    out.innerHTML = remoteSettled
      ? `<p class="small" style="margin-top:18px">Aucun résultat pour « ${esc(q)} ».</p>`
      : `<p class="small" style="margin-top:18px">Aucun résultat local. Recherche en ligne…</p>`;
    return;
  }
  out.innerHTML = `<div class="rows" style="margin-top:12px">${hits.map((h,i)=>{
    const st = h.type === 'action' ? byId[h.id] : null;
    return `<button class="row" data-hit="${i}" style="${i===0?'background:var(--bg-2)':''}">
      ${st ? avatar(st) : `<span class="av" style="background:var(--ink-4)">${esc((h.title||'??').slice(0,2).toUpperCase())}</span>`}
      <span class="row-main"><span class="row-t">${esc(h.title)}</span>
        <span class="row-s">${esc(h.sub)}${h.remote && !st ? ' · en ligne' : ''}</span></span>
    </button>`; }).join('')}</div>`;
}

/* Peint d'abord les résultats du catalogue local (instantané, hors-ligne),
   puis complète avec /api/market/search si disponible : le catalogue local
   est un accélérateur, pas une limite. searchToken protège contre une
   réponse distante obsolète si l'utilisateur a retapé entre-temps. */
function paintSearch(q){
  const myToken = ++searchToken;
  const out = document.getElementById('sqOut'); if (!out) return;
  const localHits = searchAll(q);
  if (myToken !== searchToken) return;   // une frappe plus récente a pris le relais
  hits = localHits; hi = 0;

  if (!q.trim()){
    out.innerHTML = state.recent.length
      ? `<p class="tiny" style="margin:18px 0 6px;display:flex;justify-content:space-between">
          <span>Recherches récentes</span>
          <button class="tiny" data-clear-recent style="color:var(--accent);font-weight:600">Effacer</button></p>
         ${state.recent.map(r=>`<button class="row" data-recent="${esc(r)}">
           <span style="color:var(--ink-4)">${svg(ICON.search)}</span>
           <span class="row-main"><span class="row-t">${esc(r)}</span></span></button>`).join('')}`
      : `<p class="small" style="margin-top:16px">Essayez « Apple », « AAPL », « Luxe » ou « CAC 40 ».</p>`;
    return;
  }

  renderHits(q, false);

  searchRemote(q).then(remoteHits => {
    if (myToken !== searchToken) return;   // une frappe plus récente a pris le relais
    const localIds = new Set(hits.filter(h => h.type === 'action').map(h => h.id));
    const additions = remoteHits.filter(h => !localIds.has(h.id));
    if (additions.length) hits = [...hits, ...additions].slice(0, 12);
    renderHits(q, true);   // recherche distante terminée : le message "aucun résultat" est définitif
  });
}
/* Intention portée par les 4 raccourcis de l'accueil (2026-09-23) — voir
   NB_QUICK/PAGES.home. Consommée UNE SEULE FOIS ici : posée juste avant
   openSearch() (voir le handler [data-search]), remise à null dès que
   pick() ou l'abandon de la recherche (fermeture sans choix) l'a lue,
   pour qu'un search "normal" ultérieur ne réutilise jamais par erreur
   l'intention d'un raccourci précédent. */
let searchIntent = null;
function pick(h){
  pushRecent(h.title); closeSheet();
  const intent = searchIntent; searchIntent = null;
  if (h.type === 'action'){
    console.debug('[NovaTitre][pick] résultat cliqué', h);
    /* Une société venue de /api/market/search n'existe pas encore dans
       byId : on la matérialise (métadonnées seulement) avant d'ouvrir sa
       fiche, qui se comporte alors exactement comme pour le catalogue
       local — cours/historique/score restent à charger depuis le serveur. */
    const id = (h.remote && !byId[h.id] && h.meta) ? (ensureRuntimeStock(h.meta)?.id || h.id) : h.id;
    if (intent === 'analyze'){ runAnalysis(id); return; }
    if (intent === 'buy'){ const st = byId[id]; if (st) openBuyAmount(st); return; }
    if (intent === 'alert'){ const st = byId[id]; if (st) openCreateAlerte(st); return; }
    go('stock', id);
  } else toast(`${h.title} : page indice bientôt disponible.`);
}

/* Alerte de prix — voir DEFAULT_STATE.alerts pour le format retenu et
   les limites honnêtement assumées (vérifiée pendant que l'app est
   ouverte, jamais de notification push). */