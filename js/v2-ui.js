/* ============================================================
   DESIGN V2 — composants de la maquette novatitre-v2.html (2026-10-19)
   ============================================================
   Reprise EXACTE du balisage de la maquette (classes préfixées v-, voir
   css/v2.css généré par scripts/build-v2-css.py), mais alimentée par les
   VRAIES données du site (QUOTES, HISTP, catalogue, compte, Nova...).
   Là où la maquette affiche un chiffre d'exemple sans équivalent réel
   (solde, performance d'un compte qui n'existe pas encore), le même
   emplacement affiche la donnée réelle ou un état vide explicite —
   jamais un montant inventé. */

const V2ICON = {
  rook:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h2v2h2V3h4v2h2V3h2v5l-2 2v6l2 2v2H6v-2l2-2v-6L6 8z"/></svg>',
  knight:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 21h11v-2l-1-1V9c0-3-2.5-6-6-6l-1 2-2 1-2 4 1 2 3-1 1 1-4 5v2l-1 1z"/></svg>',
  bishop:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="3.5" r="1.5"/><path d="M12 6c-3 2.5-4 5-4 7 0 1.8 1 3 2 3.5L8 19v2h8v-2l-2-2.5c1-.5 2-1.7 2-3.5 0-2-1-4.5-4-7z"/></svg>',
  pawn:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="3"/><path d="M9.5 10h5l1 6 2 3v2h-11v-2l2-3z"/></svg>',
  queen:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="6" r="1.6"/><circle cx="9" cy="4" r="1.6"/><circle cx="15" cy="4" r="1.6"/><circle cx="20" cy="6" r="1.6"/><path d="M4 8l2.5 9h11L20 8l-4 4-4-6-4 6zM6 19h12v2H6z"/></svg>',
  chev:'<svg class="v-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>',
  bank:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 2 7v2h20V7zM4 11h3v7H4zm6.5 0h3v7h-3zM17 11h3v7h-3zM2 20h20v2H2z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  spark:'<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z"/></svg>',
  star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  scale:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  lockic:'<svg viewBox="0 0 24 24" fill="#fff"><path d="M7 10V7a5 5 0 0 1 10 0v3h1v11H6V10zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>',
  line:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 3 8-9"/></svg>',
  candle:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="7" width="4" height="9" rx="1"/><rect x="6.4" y="4" width="1.2" height="16"/><rect x="15" y="5" width="4" height="7" rx="1"/><rect x="16.4" y="2" width="1.2" height="14"/></svg>',
  back:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m15 6-6 6 6 6"/></svg>',
};

/* ---------- formatage (mêmes règles que la maquette) ---------- */
const v2nf = (v, d = 0) => Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits:d, maximumFractionDigits:d }) : '—';
const v2cls = v => v >= 0 ? 'v-up' : 'v-down';
const v2tri = v => v >= 0 ? '▲' : '▼';
const v2var = v => Number.isFinite(v) ? `${v2tri(v)} ${v2nf(Math.abs(v), 2)} %` : '—';

/* Prénom pour "Bonjour Thomas" : premier mot du nom complet RÉEL du compte
   (Google), jamais déduit d'un e-mail — null sinon ("Bonjour" seul). */
function v2prenom(){
  const nom = String(state.auth?.name || '').trim();
  if (!nom || nom.includes('@')) return null;
  return nom.split(/\s+/)[0];
}

/* ---------- courbe (area() de la maquette) ---------- */
let v2gid = 0;
function v2area(data, color, { h = 100, fill = true, base = false, pad = null } = {}){
  if (!Array.isArray(data) || data.length < 2 || !data.every(Number.isFinite)) return '';
  const w = 300, min = Math.min(...data), max = Math.max(...data), r = (max - min) || 1;
  /* pad : marge haute/basse en unités du viewBox. Par défaut celle de la
     maquette (6 en bas, 8 en haut) ; les mini-courbes de ligne passent 2
     pour utiliser toute leur hauteur (sinon une séance réelle de ±1 %
     paraissait plate sur 28 px). */
  const bas = pad === null ? 6 : pad, haut = pad === null ? 8 : pad;
  const pts = data.map((v, i) => [i / (data.length - 1) * w, h - bas - (v - min) / r * (h - bas - haut)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++){
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const id = 'v2g' + (v2gid++);
  const b = base ? `<line x1="0" x2="${w}" y1="${pts[0][1]}" y2="${pts[0][1]}" stroke="rgba(255,255,255,.25)" stroke-dasharray="2 5"/>` : '';
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${b}${fill ? `<path d="${d} L${w},${h} L0,${h}Z" fill="url(#${id})"/>` : ''}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

/* Couleurs officielles des cryptos (pas de logo d'entreprise disponible). */
const V2_COULEURS_MARQUE = { BTC:'#f7931a', ETH:'#627eea' };

/* ---------- logo rond (logo-c) : vrai logo si disponible ---------- */
function v2logo(s, size){
  const url = logoUrl(s);
  const pret = url && LOGO_OK.has(url);
  if (url && !pret && !LOGO_FAILED.has(url)) assurerLogo(url);
  const st = size ? `width:${size}px;height:${size}px;` : '';
  if (pret) return `<span class="v-logo-c v2-logo-img" style="${st}background:#fff"><img src="${esc(url)}" alt="" decoding="async"></span>`;
  const sigle = String(s.ticker || '').split(/[-/]/)[0].slice(0, 4);
  const fond = V2_COULEURS_MARQUE[sigle] || SECTOR_HUE[s.sector] || '#2a2347';
  return `<span class="v-logo-c" style="${st}background:${fond};color:#fff">${esc(sigle)}</span>`;
}

/* Nom court comme dans la maquette ("Alphabet" plutôt que "Alphabet Inc
   Class A") : retire seulement les suffixes juridiques/de catégorie. */
function v2nomCourt(nom){
  let n = String(nom || '');
  for (let i = 0; i < 3; i++){
    n = n.replace(/[,\s]+(Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Company|Ltd\.?|Limited|PLC|plc|N\.?V\.?|S\.?A\.?|SE|AG|Holdings?|Group|Class [A-C]|Cl [A-C]|ADR|Common Stock|Ordinary Shares)$/i, '').trim();
  }
  return n || String(nom || '');
}

/* Cotation réelle d'une valeur (null tant qu'aucune n'a été reçue). */
function v2quote(s){
  const q = QUOTES.get(s.id) || null;
  return {
    prix: q && Number.isFinite(q.price) ? q.price : null,
    varPct: q && Number.isFinite(q.changePercent) ? q.changePercent : null,
  };
}
/* Courbe du jour réelle (même règle que stockRow : dernier point = aujourd'hui). */
/* CORRECTIF (2026-10-20, "je veux des vraies courbes dans le Radar et le
   Marché") : la courbe n'apparaissait que si son dernier point datait
   d'aujourd'hui (UTC) — donc AUCUNE courbe américaine avant l'ouverture de
   Wall Street, et l'API "1j" renvoie en réalité plusieurs jours de points.
   On trace maintenant la DERNIÈRE SÉANCE réellement disponible (celle du
   jour dès que le marché est ouvert) : uniquement des points réels. */
function v2derniereSeance(data){
  if (!Array.isArray(data) || data.length < 2) return null;
  const jour = String(data[data.length - 1].date).slice(0, 10);
  const pts = data.filter(p => String(p.date).slice(0, 10) === jour).map(p => p.close).filter(Number.isFinite);
  return pts.length >= 2 ? pts : null;
}
function v2lisser(pts, n = 30){
  if (!pts || pts.length <= n) return pts;
  const out = [];
  for (let i = 0; i < n; i++){
    const a = Math.floor(i * pts.length / n), b = Math.max(a + 1, Math.floor((i + 1) * pts.length / n));
    const tranche = pts.slice(a, b);
    out.push(tranche.reduce((x, y) => x + y, 0) / tranche.length);
  }
  /* Le dernier point reste le dernier cours réel (fin de courbe exacte). */
  out[out.length - 1] = pts[pts.length - 1];
  return out;
}
function v2sparkData(s){
  const e = HISTP.get(cleHISTP(s.id, '1j'));
  return e && e.status === 'ready' ? v2derniereSeance(e.data) : null;
}

/* ---------- ligne valeur (row() de la maquette) ---------- */
function v2row(s, opts = {}){
  const { prix, varPct } = v2quote(s);
  const enChargement = prix === null && cotationEnCours(s.id);
  const right = opts.right || (prix === null
    ? `<b class="v-num">${enChargement ? '…' : '—'}</b><span></span>`
    : `<b class="v-num">${v2nf(prix, prix < 100 ? 2 : 0)}</b><span class="${varPct === null ? '' : v2cls(varPct)}">${varPct === null ? '' : v2var(varPct)}</span>`);
  const sd = opts.spark ? v2sparkData(s) : null;
  return `<button class="v-row" data-stock="${esc(s.id)}">${v2logo(s)}
    <span class="v-t"><b>${opts.title || esc(v2nomCourt(s.name))}</b><span>${opts.sub || esc(s.ticker + (s.sector ? ' · ' + s.sector : ''))}</span></span>
    ${opts.spark ? `<span class="v-spark">${sd ? v2area(v2lisser(sd), (varPct ?? 0) >= 0 ? 'var(--v-up)' : 'var(--v-down)', { h:28, fill:false, pad:2 }) : ''}</span>` : ''}
    <span class="v-p">${right}</span></button>`;
}

/* ---------- tuiles (tiles() de la maquette) ---------- */
function v2tiles(list){
  return list.map(s => {
    const { varPct } = v2quote(s);
    return `<button class="v-tile" data-stock="${esc(s.id)}">${v2logo(s)}<b>${esc(s.ticker)}</b><span class="${varPct === null ? '' : v2cls(varPct)}">${varPct === null ? '—' : v2var(varPct)}</span></button>`;
  }).join('');
}

/* ---------- interrupteur segmenté (seg() de la maquette) ---------- */
function v2seg(key, options, cur){
  return `<div class="v-seg" data-v2seg="${esc(key)}"><span class="v-knob"></span>${options.map(([v, l]) =>
    `<button type="button" data-v2segv="${esc(v)}" class="${v === cur ? 'v-on' : ''}">${l}</button>`).join('')}</div>`;
}
function v2syncSegs(root = document){
  root.querySelectorAll('.v-seg').forEach(s => {
    const on = s.querySelector('button.v-on'), k = s.querySelector('.v-knob');
    if (on && k){ k.style.left = on.offsetLeft + 'px'; k.style.width = on.offsetWidth + 'px'; }
  });
}

/* ---------- carrousels + points (wireRails() de la maquette) ---------- */
function v2wireRails(){
  document.querySelectorAll('[data-v2rail]').forEach(rail => {
    if (rail.dataset.wired) return;
    rail.dataset.wired = '1';
    const dots = document.getElementById(rail.dataset.v2rail);
    if (!dots) return;
    rail.addEventListener('scroll', () => {
      const first = rail.firstElementChild;
      if (!first) return;
      const i = Math.round(rail.scrollLeft / (first.offsetWidth + 12));
      [...dots.children].forEach((x, j) => x.classList.toggle('v-on', j === i));
    }, { passive:true });
  });
}

/* ---------- jauge circulaire (Nova Score / Nova Review) ---------- */
function v2gauge(score, label, grad = ['#ff8fd0', '#a68cff']){
  const C = 2 * Math.PI * 50, off = C * (1 - Math.max(0, Math.min(100, score)) / 100), id = 'v2rg' + (v2gid++);
  return `<div class="v-gauge"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,.1)" stroke-width="12" fill="none"/>
    <circle class="v-gfg" cx="60" cy="60" r="50" stroke="url(#${id})" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}" style="transition:stroke-dashoffset 1.2s var(--v-ease)"/>
    <defs><linearGradient id="${id}"><stop offset="0" stop-color="${grad[0]}"/><stop offset="1" stop-color="${grad[1]}"/></linearGradient></defs></svg>
    <div class="v-v"><div><b class="v-num">${Math.round(score)}</b><small>${label}</small></div></div></div>`;
}
function v2animateGauges(){
  requestAnimationFrame(() => setTimeout(() =>
    document.querySelectorAll('.v-gfg').forEach(c => { c.style.strokeDashoffset = c.dataset.off; }), 120));
}

/* ---------- temple (TEMPLE de la maquette, à l'identique) ---------- */
const V2_LOGO_PATHS = `<path d="M 770,180 L 781,283 L 781,293 L 783,303 L 784,324 L 802,500 L 803,521 L 808,559 L 808,569 L 810,583 L 815,594 L 828,607 L 1028,718 L 1125,770 L 949,475 Z"/><path d="M 758,181 L 616,414 L 402,770 L 410,766 L 510,699 L 615,626 L 741,535 L 754,520 L 758,508 Z"/><path d="M 410,774 L 1120,774 L 861,663 L 849,659 L 747,615 L 727,608 L 712,608 L 697,614 L 572,686 Z"/>`;
function v2colonne(x, i){
  const d = .34 + i * .05;
  return `<g class="v-tp" style="animation-delay:${d}s">
    <path d="M${x-31} 116h62"/>
    <path d="M${x-25} 121c-5 2-6 10-1 12 3 1 5-2 2-4M${x+25} 121c5 2 6 10 1 12-3 1-5-2-2-4"/>
    <path d="M${x-17} 132 ${x-12} 122 ${x-6} 131 ${x} 121 ${x+6} 131 ${x+12} 122 ${x+17} 132" stroke-width="4.2"/>
    <path d="M${x-21} 139h42"/>
    <rect x="${x-13.5}" y="143" width="27" height="107" rx="2.5"/>
    <path d="M${x-4.5} 150v93M${x+4.5} 150v93" stroke-width="3.2"/>
    <path d="M${x-18.5} 255h37"/>
    <path d="M${x-23} 262h46"/>
  </g>`;
}
/* L'animation d'entrée ne se joue qu'une fois par session (render() recrée
   l'accueil à chaque cotation reçue). */
let v2TempleVu = false;
const V2_TEMPLE = `<svg viewBox="0 0 400 294" fill="none" stroke="currentColor" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <g class="v-tp" style="animation-delay:0s">
    <path d="M12 89 200 3 388 89"/>
    <path d="M34 87 200 15 366 87"/>
    <path d="M10 89.5h381" stroke-width="5.6"/>
  </g>
  <g class="v-tp" style="animation-delay:.1s"><svg x="179" y="41" width="41" height="35" viewBox="392 172 742 610" fill="currentColor" stroke="none">${V2_LOGO_PATHS}</svg></g>
  <g class="v-tp" style="animation-delay:.18s"><path d="M18 101h363"/><path d="M28 110.5h343" stroke-width="4"/></g>
  ${[66, 139, 260, 334].map(v2colonne).join('')}
  <g class="v-tp" style="animation-delay:.6s"><path d="M27 268h347"/><path d="M14 279h373"/><path d="M2 290h396"/></g>
</svg>`;
/* Fondu + zoom au défilement (onScroll() de la maquette). */
function v2templeScroll(){
  const t = document.getElementById('v2temple');
  if (!t) return;
  const r = t.getBoundingClientRect(), start = r.height * .15, end = -r.height * .55;
  const k = Math.min(1, Math.max(0, (start - r.top) / (start - end)));
  t.style.opacity = 1 - k;
  t.style.transform = `scale(${1 + k * .8})`;
}
(function(){
  let tick = false;
  addEventListener('scroll', () => {
    if (tick) return;
    tick = true;
    requestAnimationFrame(() => { tick = false; v2templeScroll(); });
  }, { passive:true });
  addEventListener('resize', () => { v2syncSegs(); });
})();

/* render() recrée tout #view à chaque cotation reçue : sans ça, chaque
   rafraîchissement ramènerait les carrousels sur leur première carte. */
function v2avantRender(){
  const rails = {};
  document.querySelectorAll('[data-v2rail]').forEach(r => { rails[r.dataset.v2rail] = r.scrollLeft; });
  return { rails };
}
/* À appeler après chaque render() : segments, carrousels, jauges, temple. */
function v2afterRender(etat){
  v2syncSegs();
  v2wireRails();
  if (etat) document.querySelectorAll('[data-v2rail]').forEach(r => {
    const x = etat.rails[r.dataset.v2rail];
    if (x){ r.scrollLeft = x; r.dispatchEvent(new Event('scroll')); }
  });
  v2animateGauges();
  v2templeScroll();
}

/* Suggestions NovaBot sans mandat (mode pédagogique). */
const V2_SUGGESTIONS_PEDAGOGIQUES = [
  "Que penses-tu d'Apple ?",
  'Explique-moi le PER',
  'Comment diversifier un portefeuille ?',
  "C'est quoi un ETF ?",
  'Quels risques pour un débutant ?',
];
