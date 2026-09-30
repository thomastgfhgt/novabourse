const CMP_ROWS = [
  { label:'Nova Score',        get:s => s.score,                  fmt:v => v + ' / 100', higher:true },
  { label:'Couverture',        get:s => s.coverage,               fmt:v => v + ' %',     higher:true },
  { label:'PER',               get:s => s.fundamentals?.pe,       fmt:v => fmt.num(v,1) + ' ×', higher:false },
  { label:'Rentabilité (ROE)', get:s => s.fundamentals?.roe,      fmt:v => fmt.pctRatio(v), higher:true },
  { label:'Marge',             get:s => Number.isFinite(s.fundamentals?.profitMargin) ? s.fundamentals.profitMargin : s.fundamentals?.operatingMargin,
    fmt:v => fmt.pctRatio(v), higher:true },
  { label:'Croissance du CA',  get:s => croissanceSerie(s.fundamentals?.revenueSeries), fmt:v => trendTxt(v,1), higher:true },
  /* Réutilise le MÊME historique que le graphique base-100 ci-dessous
     (HIST, déjà chargé par PAGES.compare pour cette même page — jamais un
     second appel réseau). null tant que l'historique n'est pas 'ready',
     géré nativement par volatiliteAnnualisee (renvoie null si <10 points). */
  { label:'Volatilité',        get:s => volatiliteAnnualisee(HIST.get(s.id)?.status === 'ready' ? HIST.get(s.id).data : null),
    fmt:v => fmt.num(v,1) + ' %', higher:false },
];

const CMP_PALETTE = ['#e67e22','#0066ff','#21c984','#e0407a'];

/* Prépare, pour chaque société sélectionnée, ses points réels pour la
   période choisie (mêmes HIST/histPeriode que la fiche action — aucun
   second moteur d'historique). Une société sans historique suffisant est
   marquée 'insufficient' mais ne bloque pas les autres. */
function comparisonSeries(ids, periodId){
  return ids.map((id, i) => {
    const st = byId[id];
    if (!st) return { id, label:id, color:CMP_PALETTE[i % CMP_PALETTE.length], status:'unknown' };
    const entry = HIST.get(id);
    if (!entry || entry.status === 'loading' || HIST_ENCOURS.has(id))
      return { id, stock:st, label:st.name, color:CMP_PALETTE[i % CMP_PALETTE.length], status:'loading' };
    if (entry.status === 'error')
      return { id, stock:st, label:st.name, color:CMP_PALETTE[i % CMP_PALETTE.length], status:'error' };
    const pts = histPeriode(id, periodId);
    if (!pts) return { id, stock:st, label:st.name, color:CMP_PALETTE[i % CMP_PALETTE.length], status:'insufficient' };
    const base = pts[0].close;
    const points = pts.map(p => ({ t:new Date(p.date).getTime(), close:p.close, index: base ? (p.close / base) * 100 : null }))
      .filter(p => Number.isFinite(p.t) && Number.isFinite(p.index));
    if (points.length < 2) return { id, stock:st, label:st.name, color:CMP_PALETTE[i % CMP_PALETTE.length], status:'insufficient' };
    const perfPct = (pts[pts.length - 1].close / pts[0].close - 1) * 100;
    return { id, stock:st, label:st.name, color:CMP_PALETTE[i % CMP_PALETTE.length],
      status:'ready', points, perfPct, firstDate:pts[0].date, lastDate:pts[pts.length - 1].date };
  });
}

/* Graphique multi-séries, en base 100 (chaque courbe démarre à 100 sur son
   propre premier point réel de la période affichée). Positionnement en X
   par VRAIE DATE (timestamp), jamais par index de tableau : deux marchés
   n'ont pas les mêmes séances, comparer "point i contre point i" fausserait
   le résultat. Fonction séparée de areaChart()/spark(), qui ne gèrent
   qu'une seule série et ne sont pas modifiées. */
function comparisonChart(seriesList){
  const ready = seriesList.filter(s => s.status === 'ready');
  if (ready.length < 2) return '';

  const w = 800, h = 260, pad = { t:16, b:14, l:4, r:8 };
  const allT = ready.flatMap(s => s.points.map(p => p.t));
  const allV = ready.flatMap(s => s.points.map(p => p.index));
  const minT = Math.min(...allT), maxT = Math.max(...allT), spanT = (maxT - minT) || 1;
  const minV = Math.min(...allV, 100), maxV = Math.max(...allV, 100);
  const spanV = (maxV - minV) || 1;
  const X = t => pad.l + ((t - minT) / spanT) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - minV) / spanV) * (h - pad.t - pad.b);
  const baseY = Y(100).toFixed(1);

  const lines = ready.map(s => {
    const d = s.points.map((p,i) => `${i?'L':'M'}${X(p.t).toFixed(1)},${Y(p.index).toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.6"
      stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Comparaison des performances, base 100">
    <line x1="${pad.l}" y1="${baseY}" x2="${w-pad.r}" y2="${baseY}" stroke="var(--line-2)" stroke-width="1"/>
    <text x="${w-pad.r-4}" y="${(Number(baseY)-6).toFixed(1)}" fill="var(--ink-4)" font-size="11"
      text-anchor="end" font-family="ui-monospace,monospace">100 (départ)</text>
    ${lines}
  </svg>`;
}

PAGES.compare = () => {
  const ids = state.compare.filter(id => byId[id]);
  const periodId = PERIODS_DISPO.includes(state.ui.pfPeriod) ? state.ui.pfPeriod : '1A';
  const picked = ids.map(id => byId[id]);

  const chips = picked.length ? `<div class="chips" style="margin-top:20px">
    ${picked.map(x=>`<button class="chip" aria-pressed="true" data-uncmp="${esc(x.id)}">
      ${esc(x.name)} ✕</button>`).join('')}
    ${picked.length < 4 ? `<button class="chip" data-search>+ Ajouter une action</button>` : ''}
  </div>` : '';

  if (picked.length < 2){
    return `<div class="page-in">
      <p class="eyebrow">Comparer</p>
      <h1 class="title">Comparer les actions</h1>
      <p class="lead measure-l" style="margin-top:10px">Superposez les performances réelles de deux à
        quatre entreprises, normalisées en base 100 pour rester comparables quelle que soit leur devise
        ou leur niveau de prix.</p>
      ${chips}
      <div class="card" style="margin-top:20px">${emptyState(
        'Choisissez au moins deux entreprises',
        'Ouvrez une fiche et touchez « Comparer » pour l’ajouter ici.',
        { go:'radar', label:'Ouvrir le Radar' })}</div></div>`;
  }
  if (picked.length > 4){
    return `<div class="page-in">
      <p class="eyebrow">Comparer</p><h1 class="title">Comparer les actions</h1>
      ${chips}
      <div class="card" style="margin-top:20px">${emptyState('Quatre entreprises au maximum',
        'Retirez une entreprise pour continuer.')}</div></div>`;
  }

  const series = comparisonSeries(ids, periodId);
  const ready = series.filter(s => s.status === 'ready');
  const notReady = series.filter(s => s.status !== 'ready');

  /* CORRECTIF (audit "réglage sans effet", 2026-09-17) : state.settings.
     showCoverage existait (bascule dans Réglages > Affichage des données)
     mais n'était lu nulle part — activer/désactiver "Afficher la
     couverture" ne changeait jamais rien à l'écran. Seul affichage réel
     d'une couverture aujourd'hui : cette ligne du comparateur. */
  const lignesVisibles = state.settings.showCoverage === false
    ? CMP_ROWS.filter(row => row.label !== 'Couverture')
    : CMP_ROWS;
  const body = lignesVisibles.map(row => {
    const vals = picked.map(row.get);
    const valid = vals.filter(v => v !== null && v !== undefined && Number.isFinite(v));
    const best  = valid.length > 1 ? (row.higher ? Math.max(...valid) : Math.min(...valid)) : null;
    const worst = valid.length > 1 ? (row.higher ? Math.min(...valid) : Math.max(...valid)) : null;
    return `<tr>
      <td class="cmp-k"><b>${esc(row.label)}</b></td>
      ${vals.map(v => {
        if (v === null || v === undefined || !Number.isFinite(v))
          return `<td class="cmp-na">indisponible</td>`;
        const cls = best !== null && v === best ? 'cmp-best'
                  : worst !== null && v === worst ? 'cmp-worst' : '';
        return `<td class="tabular-nums ${cls}">${row.fmt(v)}</td>`;
      }).join('')}
    </tr>`;
  }).join('');

  return `<div class="page-in">
    <p class="eyebrow">Comparer</p>
    <h1 class="title">Comparer les actions</h1>
    <p class="lead measure-l" style="margin-top:10px">${picked.length} entreprises · performance réelle,
      base 100 au premier cours disponible de la période.</p>

    ${chips}

    <section class="section">
      <div class="section-h"><h2 class="h2">Performance</h2>
        <div class="seg" data-seg="cperiod">${PERIODS_DISPO.map(x=>`<button data-cperiod="${x}"
          aria-pressed="${periodId===x}">${x}</button>`).join('')}</div></div>
      <div class="card">
        ${ready.length >= 2
          ? comparisonChart(series)
          : `<p class="small" style="padding:24px 0;text-align:center">
              ${ready.length===0 && notReady.some(s=>s.status==='loading')
                ? 'Chargement des historiques…'
                : 'Au moins deux historiques sont nécessaires pour comparer.'}</p>`}
        <div class="rows" style="margin-top:${ready.length>=2?'18px':'0'}">
          ${series.map(s => `<div class="row" style="padding:9px 0">
            <span style="display:flex;align-items:center;gap:9px;flex:1;min-width:0">
              <i style="width:11px;height:11px;border-radius:3px;background:${s.color};flex:0 0 auto"></i>
              <span class="row-t" style="font-size:14px">${esc(s.label)}</span>
            </span>
            <span class="tabular-nums ${s.status==='ready' ? (s.perfPct>=0?'up-t':'down-t') : ''}" style="font-size:13.5px;color:${s.status==='ready'?'':'var(--ink-4)'}">
              ${s.status==='ready' ? trendTxt(s.perfPct,1)
                : s.status==='loading' ? 'chargement…'
                : s.status==='error' ? 'erreur réseau'
                : 'historique indisponible'}
            </span>
          </div>`).join('')}
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="h2">Critères mesurés</h2>
      <div class="card" style="margin-top:14px;overflow-x:auto">
        <table class="cmp">
          <thead><tr><th>Critère</th>
            ${picked.map(x=>`<th><button data-stock="${esc(x.id)}" style="text-align:center;width:100%">
              <span style="display:block;font-weight:650">${esc(x.name)}</span>
              <span class="cmp-t">${esc(x.ticker)}</span></button></th>`).join('')}
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <p class="tiny" style="margin-top:16px">Ces critères ne sont affichés que lorsque les fondamentaux
        sont réellement disponibles. Ils ne désignent aucune action à acheter.</p>
    </section>
  </div>`;
};

