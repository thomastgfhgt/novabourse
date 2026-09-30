function volatiliteAnnualisee(points){
  if (!Array.isArray(points) || points.length < 10) return null;
  const rendements = [];
  for (let i = 1; i < points.length; i++){
    const prev = points[i - 1].close, cur = points[i].close;
    if (Number.isFinite(prev) && Number.isFinite(cur) && prev > 0) rendements.push(cur / prev - 1);
  }
  if (rendements.length < 10) return null;
  const moyenne = rendements.reduce((a, b) => a + b, 0) / rendements.length;
  const variance = rendements.reduce((a, b) => a + (b - moyenne) ** 2, 0) / (rendements.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function pourcentageMoisHausse(points){
  if (!Array.isArray(points) || points.length < 20) return null;
  const parMois = new Map();
  for (const p of points){
    if (!p.date || !Number.isFinite(p.close)) continue;
    parMois.set(p.date.slice(0, 7), p.close);   // dernière clôture rencontrée pour ce mois (points triés croissant)
  }
  const mois = [...parMois.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (mois.length < 3) return null;   // au moins 2 transitions mois-à-mois
  let hausses = 0, total = 0;
  for (let i = 1; i < mois.length; i++){
    total++;
    if (mois[i][1] > mois[i - 1][1]) hausses++;
  }
  return total >= 2 ? (hausses / total) * 100 : null;
}

/* ============================================================
   GRAPHIQUE PROFESSIONNEL — rendu (Lightweight Charts)
   ============================================================ */

function chartSkeleton(){
  return `<div class="sk chart-skel" aria-hidden="true"></div>
    <p class="small" style="text-align:center;margin-top:14px;color:var(--ink-4)">Chargement des cours…</p>`;
}

function formatDateAffichage(date, kind){
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return date;
  return kind === 'intraday'
    ? d.toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
    : d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

/* Statistiques réelles de LA PÉRIODE ACTUELLEMENT AFFICHÉE (pts = entry.data
   de cette période précise, jamais l'historique complet HIST) — recalculées
   entièrement à chaque changement de période via CHART_PERIODS, jamais
   réutilisées d'une période à l'autre. Formules retenues, explicites :
 *   moyenne du cours   = somme des clôtures de la période / nombre de clôtures ;
 *   volume moyen       = somme des volumes connus / nombre de barres à volume connu ;
 *   volatilité période = écart-type (non biaisé) des rendements barre-à-barre
 *     (clôture[i]/clôture[i-1] - 1), exprimé en %, NON annualisé — distinct de
 *     volatiliteAnnualisee() ci-dessus, qui porte sur l'historique quotidien
 *     complet (~1 an) et annualise par ×√252 : les deux mesurent des choses
 *     différentes et ne doivent jamais être confondues dans l'affichage ;
 *   séances +/-         = nombre de barres dont la clôture est strictement
 *     supérieure/inférieure à la clôture de la barre précédente (égalité :
 *     ne compte dans aucun des deux, jamais arrondie vers l'un ou l'autre).
 * Renvoie null pour toute métrique dont les données réelles sont insuffisantes
 * — jamais une estimation ni un zéro qui laisserait croire à une vraie mesure. */
function statsPeriode(pts){
  const closes = pts.map(p => p.close).filter(Number.isFinite);
  const volumes = pts.map(p => p.volume).filter(v => Number.isFinite(v) && v >= 0);

  const average = closes.length ? closes.reduce((a, b) => a + b, 0) / closes.length : null;
  const avgVolume = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : null;

  const rendements = [];
  let positives = 0, negatives = 0;
  for (let i = 1; i < pts.length; i++){
    const prev = pts[i - 1].close, cur = pts[i].close;
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0) continue;
    rendements.push(cur / prev - 1);
    if (cur > prev) positives++;
    else if (cur < prev) negatives++;
  }

  let volatility = null;
  if (rendements.length >= 2){
    const m = rendements.reduce((a, b) => a + b, 0) / rendements.length;
    const variance = rendements.reduce((a, b) => a + (b - m) ** 2, 0) / (rendements.length - 1);
    volatility = Math.sqrt(variance) * 100;
  }

  return { average, avgVolume, volatility, positives, negatives, sessions: rendements.length };
}

/* Coquille HTML du graphique : barre d'info (prix/variation, mise à jour en
   direct par le crosshair via mountChartPro), bascule courbe/chandeliers
   (seulement si l'OHLC complet est réellement disponible — jamais affichée
   pour forcer un mode que la donnée ne permet pas), conteneur du graphique
   lui-même (rempli par Lightweight Charts, pas par ce template), puis les
   statistiques réelles de la période (haut/bas/ouverture/clôture/volume/
   moyenne/volatilité/séances +/-, voir statsPeriode ci-dessus). */
function chartProShell(stock, period, entry){
  const pts = entry.data;
  const first = pts[0], last = pts[pts.length - 1];
  const hausse = last.close >= first.close;
  const varAbs = last.close - first.close;
  const varPct = first.close ? (varAbs / first.close) * 100 : null;
  const highs = pts.map(p => p.high).filter(Number.isFinite);
  const lows = pts.map(p => p.low).filter(Number.isFinite);
  const hasOHLC = pts.every(p => Number.isFinite(p.open) && Number.isFinite(p.high) && Number.isFinite(p.low));
  const hasVolume = pts.some(p => Number.isFinite(p.volume) && p.volume > 0);
  const volTotal = pts.reduce((s, p) => s + (Number.isFinite(p.volume) ? p.volume : 0), 0);
  const closesValides = pts.map(p => p.close).filter(Number.isFinite);
  /* Repli sur les clôtures quand haut/bas intra-barre n'existent pas (ex.
     CoinGecko, qui ne fournit qu'un prix ponctuel par horodatage, jamais
     d'OHLC) : le plus haut/bas des CLÔTURES réellement reçues reste une
     donnée réelle, jamais une estimation — seulement moins précis qu'un
     vrai haut/bas intra-séance. */
  const plusHaut = highs.length ? Math.max(...highs) : (closesValides.length ? Math.max(...closesValides) : null);
  const plusBas = lows.length ? Math.min(...lows) : (closesValides.length ? Math.min(...closesValides) : null);
  const st = statsPeriode(pts);

  return `
    <div class="chart-toolbar">
      <div class="chart-info" id="cpInfo">
        <span class="cp-price tabular-nums">${fmt.num(last.close, 2)} ${esc(stock.curSymbol || '')}</span>
        <span class="cp-var tabular-nums ${hausse ? 'up-t' : 'down-t'}">${varAbs >= 0 ? '+' : ''}${fmt.num(varAbs, 2)}
          (${varPct === null ? '—' : (varPct >= 0 ? '+' : '') + fmt.num(varPct, 2) + ' %'})</span>
        <span class="cp-date tiny">${esc(formatDateAffichage(last.date, entry.kind))}</span>
      </div>
      ${hasOHLC ? `<div class="seg chart-mode">
        <button data-chart-mode="line" aria-pressed="${state.ui.chartMode !== 'candle'}">Courbe</button>
        <button data-chart-mode="candle" aria-pressed="${state.ui.chartMode === 'candle'}">Chandeliers</button>
      </div>` : ''}
    </div>
    <div id="chart-pro" class="chart-pro" data-key="${esc(cleHISTP(stock.id, period))}"
      data-hausse="${hausse ? '1' : '0'}"></div>
    <div class="chart-stats">
      <div><span class="tiny">Ouverture</span><b class="tabular-nums">${fmt.num(Number.isFinite(first.open) ? first.open : first.close, 2)}</b></div>
      <div><span class="tiny">Plus haut</span><b class="tabular-nums">${plusHaut !== null ? fmt.num(plusHaut, 2) : '—'}</b></div>
      <div><span class="tiny">Plus bas</span><b class="tabular-nums">${plusBas !== null ? fmt.num(plusBas, 2) : '—'}</b></div>
      <div><span class="tiny">Clôture</span><b class="tabular-nums">${fmt.num(last.close, 2)}</b></div>
      ${hasVolume ? `<div><span class="tiny">Volume</span><b class="tabular-nums">${fmt.int(volTotal)}</b></div>` : ''}
      <div><span class="tiny">Cours moyen sur la période</span><b class="tabular-nums">${st.average !== null ? fmt.num(st.average, 2) : '—'}</b></div>
      ${hasVolume ? `<div><span class="tiny">Volume moyen</span><b class="tabular-nums">${st.avgVolume !== null ? fmt.int(st.avgVolume) : '—'}</b></div>` : ''}
      <div><span class="tiny">Volatilité période</span><b class="tabular-nums">${st.volatility !== null ? fmt.num(st.volatility, 2) + ' %' : '—'}</b></div>
      <div><span class="tiny">${entry.kind === 'intraday' ? 'Barres' : 'Séances'} +/−</span><b class="tabular-nums"><span class="up-t">${st.positives}</span> / <span class="down-t">${st.negatives}</span></b></div>
    </div>
    <p class="tiny" style="margin-top:10px;color:var(--ink-4)">${pts.length} ${entry.kind === 'intraday' ? 'barres' : 'séances'} réelles
      · ${entry.kind === 'intraday' ? 'intraday ' + esc(entry.interval || '') : 'quotidien'} · source ${esc(entry.source || '—')}</p>`;
}

/* --- cycle de vie du graphique (canvas, pas du HTML string) ---
   view.innerHTML est remplacé à CHAQUE render() (navigation, tick vivant
   toutes les 8s, etc.) : le conteneur #chart-pro est donc un NOUVEAU noeud
   DOM à chaque fois. On détruit proprement l'instance précédente puis on
   en recrée une, en restaurant le zoom/scroll (visibleLogicalRange)
   uniquement quand il s'agit du même instrument+période qu'avant (un vrai
   changement de période/instrument repart, lui, sur la vue complète). */
let chartPro = null; // { chart, series, volumeSeries, key }

function chartTheme(){
  const cs = getComputedStyle(document.documentElement);
  const v = (name, repli) => { const val = cs.getPropertyValue(name); return val ? val.trim() : repli; };
  return {
    text: v('--ink-3', '#8d95a4'),
    grid: v('--line-2', '#1b2028'),
    up: v('--up', '#3ecf7f'),
    down: v('--down', '#f87171'),
  };
}

function detruireChartPro(){
  if (chartPro){
    try { chartPro.chart.remove(); } catch {}
    chartPro = null;
  }
}

function mountChartPro(){
  const el = document.getElementById('chart-pro');
  if (!el || typeof LightweightCharts === 'undefined'){ detruireChartPro(); return; }

  const key = el.dataset.key;
  const entry = HISTP.get(key);
  if (!entry || entry.status !== 'ready' || entry.data.length < 2){ detruireChartPro(); return; }

  let rangeAConserver = null;
  if (chartPro && chartPro.key === key){
    try { rangeAConserver = chartPro.chart.timeScale().getVisibleLogicalRange(); } catch {}
  }
  detruireChartPro();

  const theme = chartTheme();
  const hausse = el.dataset.hausse === '1';
  const couleur = hausse ? theme.up : theme.down;
  const candle = state.ui.chartMode === 'candle'
    && entry.data.every(p => Number.isFinite(p.open) && Number.isFinite(p.high) && Number.isFinite(p.low));
  const hasVolume = entry.data.some(p => Number.isFinite(p.volume) && p.volume > 0);

  let chart;
  try {
    chart = LightweightCharts.createChart(el, {
      layout: { background:{ color:'transparent' }, textColor: theme.text,
        fontFamily: getComputedStyle(document.body).fontFamily },
      grid: { vertLines:{ color: theme.grid }, horzLines:{ color: theme.grid } },
      rightPriceScale: { borderColor: theme.grid },
      timeScale: { borderColor: theme.grid, timeVisible: entry.kind === 'intraday', secondsVisible:false },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      autoSize: true,
    });
  } catch { return; } // bibliothèque indisponible (ex. CDN bloqué) : pas de graphique plutôt qu'un plantage

  const timeDe = p => entry.kind === 'intraday'
    ? Math.floor(new Date(p.date).getTime() / 1000)
    : p.date.slice(0, 10);

  let series;
  if (candle){
    series = chart.addSeries(LightweightCharts.CandlestickSeries, {
      upColor: theme.up, downColor: theme.down, borderVisible:false,
      wickUpColor: theme.up, wickDownColor: theme.down,
    });
    series.setData(entry.data.map(p => ({ time:timeDe(p), open:p.open, high:p.high, low:p.low, close:p.close })));
  } else {
    series = chart.addSeries(LightweightCharts.AreaSeries, {
      lineColor: couleur, topColor: couleur + '33', bottomColor: couleur + '00', lineWidth:2,
    });
    series.setData(entry.data.map(p => ({ time:timeDe(p), value:p.close })));
  }

  let volumeSeries = null;
  if (hasVolume){
    volumeSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
      priceFormat:{ type:'volume' }, priceScaleId:'volume', color: couleur + '55',
    });
    try { chart.priceScale('volume').applyOptions({ scaleMargins:{ top:.82, bottom:0 } }); } catch {}
    volumeSeries.setData(entry.data.filter(p => Number.isFinite(p.volume))
      .map(p => ({ time:timeDe(p), value:p.volume,
        color: (Number.isFinite(p.open) ? p.close >= p.open : true) ? theme.up + '66' : theme.down + '66' })));
  }

  chart.timeScale().fitContent();
  if (rangeAConserver){ try { chart.timeScale().setVisibleLogicalRange(rangeAConserver); } catch {} }

  const info = document.getElementById('cpInfo');
  const premier = entry.data[0].close;
  chart.subscribeCrosshairMove(param => {
    if (!info) return;
    const prixEl = info.querySelector('.cp-price'), varEl = info.querySelector('.cp-var'), dateEl = info.querySelector('.cp-date');
    if (!param || param.time === undefined || !param.seriesData || !param.seriesData.has(series)){
      const dernier = entry.data[entry.data.length - 1];
      const vAbs = dernier.close - premier, vPct = premier ? (vAbs / premier) * 100 : null;
      prixEl.textContent = `${fmt.num(dernier.close, 2)} `; prixEl.style.color = '';
      varEl.textContent = `${vAbs >= 0 ? '+' : ''}${fmt.num(vAbs, 2)} (${vPct === null ? '—' : (vPct >= 0 ? '+' : '') + fmt.num(vPct, 2) + ' %'})`;
      varEl.className = 'cp-var tabular-nums ' + (vAbs >= 0 ? 'up-t' : 'down-t');
      dateEl.textContent = formatDateAffichage(dernier.date, entry.kind);
      return;
    }
    const d = param.seriesData.get(series);
    const prix = candle ? d.close : d.value;
    if (!Number.isFinite(prix)) return;
    const vAbs = prix - premier, vPct = premier ? (vAbs / premier) * 100 : null;
    const vol = volumeSeries && param.seriesData.has(volumeSeries) ? param.seriesData.get(volumeSeries).value : null;
    const dateAff = typeof param.time === 'number'
      ? new Date(param.time * 1000).toLocaleString('fr-FR', entry.kind === 'intraday'
          ? { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }
          : { day:'2-digit', month:'2-digit', year:'numeric' })
      : String(param.time);
    prixEl.textContent = fmt.num(prix, 2) + ' ';
    varEl.textContent = `${vAbs >= 0 ? '+' : ''}${fmt.num(vAbs, 2)} (${vPct === null ? '—' : (vPct >= 0 ? '+' : '') + fmt.num(vPct, 2) + ' %'})`;
    varEl.className = 'cp-var tabular-nums ' + (vAbs >= 0 ? 'up-t' : 'down-t');
    dateEl.textContent = dateAff + (vol != null ? ' · vol. ' + fmt.int(vol) : '');
  });

  chartPro = { chart, series, volumeSeries, key };
}
