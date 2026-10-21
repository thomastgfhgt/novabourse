/* ============================================================
   DESIGN V2 — fiche valeur : en-tête de la maquette (2026-10-19)
   ============================================================
   Appelé par PAGES.stock (js/page-stock.js), qui garde ses onglets réels
   (graphique pro, chiffres, analystes, analyse Nova AI, actualités). Les
   actions de l'ancien onglet "Actions" (Comparer, Liste, Alerte) sont ici
   dans la rangée de raccourcis, comme dans la maquette. */
function v2StockEntete(s){
  v2StockGraphiqueAuto(s);
  const q = QUOTES.get(s.id) || null;
  const prix = q && Number.isFinite(q.price) ? q.price : null;
  const v = q && Number.isFinite(q.changePercent) ? q.changePercent : null;
  const suivie = state.watchlist.includes(s.id);
  const labelFraicheur = q ? libelleFraicheur(q) : '';
  const labelSeance = q ? (MARKET_STATUS_LABEL[q.marketStatus] || '') : '';
  const maj = state.ui.liveAt && route.page === 'stock' && route.arg === s.id
    ? 'Actualisé à ' + new Date(state.ui.liveAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '';
  const infos = [labelFraicheur, maj, labelSeance].filter(Boolean).join(' · ');
  const nbAlertes = state.alerts.filter(a => a.stockId === s.id && !a.triggered).length;
  const nbListes = listesAvec(s.id).length;
  const mesAlertes = state.alerts.filter(a => a.stockId === s.id);
  return `<div class="v-sk-top"><button class="v-circ" data-back aria-label="Retour">${V2ICON.back}</button><span style="flex:1"></span>
      <button class="v-circ ${suivie ? 'v-on' : ''}" data-star="${esc(s.id)}" aria-pressed="${suivie}" aria-label="${suivie ? 'Retirer de la liste de suivi' : 'Suivre'}">${V2ICON.star.replace('fill="none"', suivie ? 'fill="currentColor"' : 'fill="none"')}</button></div>
    <div class="v-sk-id v2-sk-logo">${v2logo(s, 56)}<div><h1>${esc(v2nomCourt(s.name))}</h1><p>${[s.ticker, s.market, s.sector].filter(Boolean).map(esc).join(' · ')}</p></div></div>
    <div class="v-sk-price"><p class="v-v v-num">${prix === null ? '—' : v2nf(prix, prix < 1000 ? 2 : 0)}<small>${esc(s.curSymbol || '')}</small></p>
      ${v === null ? (prix === null ? `<p class="v-d" style="color:var(--v-ink3)">Cours indisponible pour cette place</p>` : '')
        : `<p class="v-d ${v2cls(v)}">${v2var(v)} <span>aujourd'hui</span></p>`}</div>
    ${infos ? `<p class="v-label" style="font-weight:500;margin-top:6px">${esc(infos)}</p>` : ''}
    <div class="v-trade"><button class="v-big-cta" data-buy="${esc(s.id)}">Acheter</button><button class="v-big-cta v-out" data-sell="${esc(s.id)}">Vendre</button></div>
    ${!PORTEFEUILLE_FICTIF_PUBLIC ? `<p class="v-legal" style="text-align:left;margin-top:10px">Compte d'investissement non encore disponible : l'achat sera activé une fois un compte réel connecté.</p>` : ''}
    <div class="v-qa">
      ${s.type === 'stock' ? `<button data-nova="${esc(s.id)}" data-v2-onglet="analyse"><span class="v-ring" style="background:var(--v-accent)">${V2ICON.spark}</span>Nova AI</button>` : ''}
      <button data-cmp="${esc(s.id)}" aria-pressed="${state.compare.includes(s.id)}"><span class="v-ring">${V2ICON.scale}</span>Comparer</button>
      <button data-add-to-list="${esc(s.id)}"><span class="v-ring">${V2ICON.list}${nbListes ? `<span class="v-lock">${nbListes}</span>` : ''}</span>Liste</button>
      <button data-open-alerte="${esc(s.id)}"><span class="v-ring">${V2ICON.bell}${nbAlertes ? `<span class="v-lock">${nbAlertes}</span>` : ''}</span>Alerte</button>
    </div>
    ${state.compare.length >= 2 ? `<button class="v-more" style="border:0;margin-top:12px" data-go="compare">Voir la comparaison (${state.compare.length})</button>` : ''}
    ${mesAlertes.length ? `<div class="v-card" style="margin-top:14px;padding:4px 18px">${mesAlertes.map(a => `<div class="v-statrow"><span>${a.triggered ? 'Atteinte' : 'Alerte'} · ${a.direction === 'above' ? '≥' : '≤'} ${esc(fmt.cur(a.target, s.cur))}</span>
      <button data-delete-alerte="${esc(a.id)}" aria-label="Retirer cette alerte" style="color:var(--v-ink3)">Retirer</button></div>`).join('')}</div>` : ''}`;
}

/* Ouverture / plus haut / plus bas / volume réels (grid3 de la maquette). */
function v2StockStats(s){
  const q = QUOTES.get(s.id);
  if (!q) return '';
  const champs = [['Ouverture', q.open], ['Plus haut', q.high], ['Plus bas', q.low], ['Clôture préc.', q.previousClose]]
    .filter(([, v]) => Number.isFinite(v)).map(([k, v]) => [k, v2nf(v, 2)]);
  if (Number.isFinite(q.volume) && q.volume > 0) champs.push(['Volume', fmt.int(q.volume)]);
  if (!champs.length) return '';
  return `<div class="v-grid3">${champs.map(([k, v]) => `<div class="v-stat"><span>${k}</span><b class="v-num">${v}</b></div>`).join('')}</div>`;
}

/* La maquette affiche le graphique dès l'ouverture de l'Aperçu : on le
   demande automatiquement (une requête par fiche, dédoublonnée par
   chargerGraphiquePeriode) au lieu d'attendre "Voir le graphique". */
function v2StockGraphiqueAuto(s){
  if ((state.ui.stockTab || 'apercu') !== 'apercu') return;
  const period = CHART_PERIODS.some(p => p.api === state.ui.chartPeriod) ? state.ui.chartPeriod : '3m';
  if (!HISTP.get(cleHISTP(s.id, period))) queueMicrotask(() => chargerGraphiquePeriode(s, period));
}

/* "Nova AI" lance l'analyse réelle (data-nova) et ouvre l'onglet Analyse. */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-v2-onglet]');
  if (b) state.ui.stockTab = b.dataset.v2Onglet;
}, true);
