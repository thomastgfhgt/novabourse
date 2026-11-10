/* ============================================================
   NOVATITRE — Nova Missions (prototype jouable)
   Tout l'état est local (navigateur). En production : Supabase
   (progression, classes, ligues) + API Claude (Nova Coach,
   jeux de rôle libres, mission du jour). Voir CAHIER-DES-CHARGES.md
   ============================================================ */
(function(){
'use strict';
const CH = window.NT_CHAPTERS, MS = window.NT_MISSIONS, POOL = window.NT_DAILY_POOL, STORY = window.NT_STORY, PL = window.NT_PLACEMENT, MK = window.NT_MARKET;
const $ = (s, r = document) => r.querySelector(s);
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const eur = n => n.toLocaleString('fr-FR', { style:'currency', currency:'EUR', minimumFractionDigits:2 });
const eur0 = n => n.toLocaleString('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 });
const num = (n, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits:d, maximumFractionDigits:d });
const DAY0 = Date.UTC(2026, 0, 1);
const dayIndex = () => Math.floor((Date.now() - DAY0) / 864e5) + (S ? (S.dayOffset || 0) : 0);   // « jour suivant » simulable dans le prototype
const today = () => new Date(DAY0 + dayIndex() * 864e5).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
/* Vraies valeurs : cours réel à la date relevée, puis évolution SIMULÉE (déterministe) les jours suivants.
   Sur le vrai site : cours en direct sous licence. */
const PX = {}, ANCH = {};
const anchorOf = s => ANCH[s.id] ?? (ANCH[s.id] = Math.floor((Date.parse(s.date || '2026-10-30') - DAY0) / 864e5));
function priceOn(s, d){
  const a = anchorOf(s); if (d <= a || !s.vol) return s.price;
  const key = s.id + ':' + d; if (PX[key] != null) return PX[key];
  let v = s.price, x = 0; for (const c of s.id) x = (x * 31 + c.charCodeAt(0)) % 233280;
  for (let i = a + 1; i <= d; i++){ x = (x * 9301 + 49297 + i) % 233280; const r = x / 233280 - 0.5; v = v * (1 + r * 2 * s.vol) + (s.price - v) * 0.02; }
  const dp = s.price < 10 ? 4 : 2; return (PX[key] = Math.round(v * 10 ** dp) / 10 ** dp);
}
const px = s => priceOn(s, dayIndex());
const pxPrev = s => priceOn(s, dayIndex() - 1);
const isSim = s => dayIndex() > anchorOf(s);
const chg = s => isSim(s) ? (px(s) / pxPrev(s) - 1) * 100 : (s.chg ?? null);
const EURUSD = window.NT_EURUSD || 1.12;
const toEur = (s, v) => s && s.cur === 'USD' ? v / EURUSD : v;
const money = (s, v) => v.toLocaleString('fr-FR', { style: 'currency', currency: s && s.cur === 'USD' ? 'USD' : 'EUR', minimumFractionDigits: 2, maximumFractionDigits: v < 10 ? 4 : 2 });
const mkFind = id => MK.find(x => x.id === ((window.NT_MK_ALIAS || {})[id] || id));
const dateFr = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '';

/* ---------- icônes ---------- */
const P = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  logo: `<svg viewBox="392 172 742 610" fill="currentColor" aria-hidden="true"><path d="M 770,180 L 808,569 L 828,607 L 1125,770 L 949,475 Z"/><path d="M 758,181 L 402,770 L 741,535 L 758,508 Z"/><path d="M 410,774 L 1120,774 L 747,615 L 712,608 L 697,614 Z"/></svg>`,
  target: P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'),
  chart: P('<path d="M4 19h16"/><path d="M5 15l4-5 4 3 6-7"/>'),
  wallet: P('<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 13h2"/><path d="M3 10h18"/>'),
  chat: P('<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/>'),
  user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  check: P('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  bolt: P('<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>'),
  lock: P('<rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  play: P('<path d="M8 5l11 7-11 7z"/>'),
  clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  flame: P('<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5.5C10 9.5 11 11 12 11c0-3-1-5.5 0-8z"/>'),
  coin: P('<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.8 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3.1-1.6M12 6.5V8m0 8v1.5"/>'),
  trophy: P('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>'),
  shield: P('<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
  school: P('<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>'),
  building: P('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>'),
  person: P('<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21c.8-4 3.5-6.5 7-6.5s6.2 2.5 7 6.5"/>'),
  chev: P('<path d="M6 9l6 6 6-6"/>'),
  back: P('<path d="M15 6l-6 6 6 6"/>'),
  star: P('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  send: P('<path d="M4 12l16-8-6 16-2.5-6.5z"/>'),
  book: P('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>'),
  candle: P('<path d="M7 3v18M17 3v18"/><rect x="4.5" y="7" width="5" height="8" rx="1"/><rect x="14.5" y="5" width="5" height="10" rx="1"/>'),
  cap: P('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3.5 2.5 8.5 2.5 12 0v-5"/><path d="M22 9v6"/>'),
};

/* ---------- état (local au navigateur) ---------- */
const DEF = { page:'landing', arg:null, onb:false, audience:'perso', goal:null, pace:'normal', score:0, cash:0, done:{}, skip:{}, eclair:{}, streak:0, lastDay:null,
  positions:{}, history:[], premium:false, reminder:true, placement:null, dailyDone:null, coach:[], classes:[], assigns:[], open:{},
  dayOffset:0, reviews:[], story:{}, dayCount:{}, results:{}, plays:{}, sound:true, certs:{}, exams:{}, room:null, roomHist:[], plan:null, name:'', read:{} };
let S;
try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem('nt-missions') || '{}')); } catch(e){ S = Object.assign({}, DEF); }
/* migration : les anciennes valeurs fictives deviennent leur équivalent réel (même montant en euros), sinon remboursées */
if (S.positions && !S.mkV14){ const AL = window.NT_MK_ALIAS || {}, R = window.NT_MARKET || [], fx = window.NT_EURUSD || 1.12; let refund = 0;
  for (const id of Object.keys(S.positions)){ if (R.some(x => x.id === id)) continue; const p = S.positions[id], val = (p.qty || 0) * (p.avg || 0), nid = AL[id], s = R.find(x => x.id === nid); delete S.positions[id];
    if (s && val > 0){ const pe = s.cur === 'USD' ? s.price / fx : s.price, q = Math.round(val / pe * 10000) / 10000, o = S.positions[s.id] || { qty: 0, avg: 0 }; o.avg = (o.avg * o.qty + q * s.price) / (o.qty + q); o.qty = Math.round((o.qty + q) * 10000) / 10000; S.positions[s.id] = o; } else refund += val; }
  if (refund > 0){ S.cash = Math.round(((S.cash || 0) + refund) * 100) / 100; (S.history = S.history || []).push('Passage aux vraies valeurs : anciennes positions fictives remboursées (' + Math.round(refund) + ' € fictifs)'); }
  S.mkV14 = true; }
const save = () => { try { localStorage.setItem('nt-missions', JSON.stringify(S)); } catch(e){} };

const rankOf = sc => { let r = window.NT_RANKS[0], nx = null; for (const k of window.NT_RANKS){ if (sc >= k.min) r = k; else { nx = k; break; } } return { r, nx }; };
const chMissions = c => MS.filter(m => m.ch === c);
const isDone = id => !!(S.done[id] || S.skip[id]);
const chProgress = c => { const l = chMissions(c); return l.filter(m => isDone(m.id)).length / l.length; };
const plMax = v => !v ? 0 : v <= 7 ? v : v === 8 ? 11 : v === 9 ? 13 : 15;   // niveau du test → dernier chapitre validé
const chUnlocked = c => { if (S.plan2 && planOpen().includes(c)) return true; const ch = CH.find(x => x.id === c); if (ch && ch.after) return chProgress(ch.after) >= 0.5 || (S.placement || 0) >= ch.after; return c === 1 || (S.placement && c <= plMax(S.placement) + 1) || chProgress(c - 1) >= 0.5; };
const chPremium = c => c >= 3 && !S.premium && c !== S.freeCh;   // freeCh : un chapitre offert aux bons élèves du test
const gradable = st => ['qcm','vf','calc','book','match','chart','candles'].includes(st.type);
const reviewable = st => ['qcm','vf','calc','book','match','chart','order','candles'].includes(st.type);
const todayCount = () => S.dayCount[today()] || 0;
const DAILY_GOAL = 1;
const dailyMission = () => POOL[((dayIndex() % POOL.length) + POOL.length) % POOL.length];
const dueReviews = () => S.reviews.filter(r => r.due <= today());
const storyNext = () => STORY.find(e => !S.story[e.id]);
const storyReady = () => { const e = storyNext(); if (!e) return false; const i = STORY.indexOf(e); return i === 0 || S.story[STORY[i - 1].id] < today(); };
const nextMission = () => { const ok = m => m.steps && !isDone(m.id) && chUnlocked(m.ch) && !chPremium(m.ch); for (const s of ((S.plan2 && S.plan2.plan) || [])){ const m = MS.find(x => x.ch === s.ch && ok(x)); if (m) return m; } return MS.find(ok); };
const paceMax = () => S.pace === 'rapide' ? 3 : S.pace === 'normal' ? 7 : 99;
const portfolioValue = (prev = false) => Object.entries(S.positions).reduce((s, [id, p]) => { const m = mkFind(id); return s + p.qty * (m ? toEur(m, prev ? pxPrev(m) : px(m)) : 0); }, 0);

/* retours sensoriels : petit son (désactivable) + vibration courte */
let AC = null;
function sfx(kind){
  try { if (navigator.vibrate) navigator.vibrate(kind === 'ok' ? 12 : kind === 'ko' ? [25, 40, 25] : [10, 30, 10, 30, 20]); } catch(e){}
  if (!S.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'ok' ? [660, 880] : kind === 'ko' ? [300, 240] : [523, 659, 784, 1046];
    notes.forEach((f, i) => { const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + i * 0.09;
      o.type = kind === 'ko' ? 'triangle' : 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + 0.18); });
  } catch(e){}
}
function toast(t){ document.querySelectorAll('.toast').forEach(x => x.remove()); const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role','status'); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
function go(page, arg = null){ const same = S.page === page; S.page = page; S.arg = arg; save(); render(); window.scrollTo(0, 0);
  if (page === 'carte' && !same && !(window.NT_FX && window.NT_FX.parcours)) setTimeout(() => { const n = document.querySelector('.mnode.cur'); if (n && n.getBoundingClientRect().top > window.innerHeight * 0.7) window.scrollTo({ top: window.scrollY + n.getBoundingClientRect().top - window.innerHeight * 0.4, behavior: RM() ? 'auto' : 'smooth' }); }, 250); }

/* ---------- gabarits communs ---------- */
const top = () => oTop();
const lvChip = () => { const { r, nx } = rankOf(S.score), lo = r.min, hi = nx ? nx.min : 1000, p = Math.max(4, Math.min(100, (S.score - lo) / (hi - lo) * 100));
  return `<button class="lvchip" data-go="carte" aria-label="${h(r.name)}, ${S.score} points${nx ? ', prochain rang ' + h(nx.name) + ' à ' + hi : ''}"><span class="lv-r">${h(r.name)}</span><span class="lv-bar"><i style="width:${p.toFixed(0)}%"></i></span><span class="tn lv-n">${S.score}</span></button><span class="pill tn" title="Série de jours">${I.flame}${S.streak}</span>`; };
const DOCK_GROUP = { home: ['home','coach','suivi','jeux'], carte: ['carte','missions'], markets: ['markets','bureau','stock','room'], portfolio: ['portfolio'], profile: ['profile','certs','plan','monplan','cours','amf'] };
const DOCK = [['home','Accueil',null],['carte','Parcours',P('<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>')],['markets','Marchés',I.chart],['portfolio','Portefeuille',I.wallet],['profile','Profil',I.user]];
const dock = () => { const idx = DOCK.findIndex(([k]) => DOCK_GROUP[k].includes(S.page)), from = window.__dockPrev ?? idx; window.__dockPrev = idx;
  return `<nav class="dock" aria-label="Navigation" style="--i:${from < 0 ? 0 : from};--n:${DOCK.length}" data-to="${idx}"><span class="dock-pill${idx < 0 ? ' off' : ''}" aria-hidden="true"></span>${DOCK.map(([k,l,ic]) => `<button data-go="${k}"${DOCK_GROUP[k].includes(S.page) ? ' aria-current="page"' : ''}>${ic || TEMPLE_ICON}<span>${l}</span></button>`).join('')}</nav>
  ${S.onb && S.page !== 'coach' ? `<button class="fab" data-go="coach" aria-label="Nova Coach, poser une question">${I.chat}</button>` : ''}`; };
const legal = () => `<p class="note">Contenu pédagogique. Investir comporte un risque de perte en capital. NovaTitre ne fournit pas de conseil en investissement personnalisé. Valeurs réelles, cours réels datés puis simulés ; argent et portefeuilles fictifs.</p>`;
const ring = (sc, size = '') => { const p = Math.min(1, sc / 1000) * 100; return `<div class="ring" ${size}><svg viewBox="0 0 100 100"><defs><linearGradient id="gV" x1="0" x2="1"><stop offset="0" stop-color="#c4b5ff"/><stop offset="1" stop-color="#5b8cff"/></linearGradient></defs><circle cx="50" cy="50" r="42" class="trk"/><circle cx="50" cy="50" r="42" class="arc" pathLength="100" style="stroke-dasharray:${p.toFixed(1)} 100"/></svg><b class="tn">${sc}</b><small>/ 1000</small></div>`; };

/* ============================================================
   PAGES
   ============================================================ */
const PAGES = {};

/* ---------- vitrine ---------- */
PAGES.landing = () => `<div class="landing"><div class="wrap">
  <header class="top"><span class="logo">${I.logo}<span>NovaTitre</span></span><span class="grow"></span>
    <button class="btn ghost sm" data-go="pricing">Tarifs</button><button class="btn sm" data-start="perso">Commencer</button></header>
  ${temple('land')}
  <section class="hero">
    <div>
      <span class="eyebrow">École de bourse et de trading, par l’IA</span>
      <h1 style="margin-top:10px">Apprends la bourse<br><em>en mission.</em></h1>
      <p class="lead">De zéro à trader avancé, en 5 niveaux. Des missions de 3 à 15 minutes, des cours de 2 minutes, une salle de marché pour t’entraîner sans risque, et un certificat à chaque niveau. L’IA adapte ton parcours : si tu sais déjà, tu passes.</p>
      <div class="cta"><button class="btn v" data-start="perso">Ma première séance (3 min)</button><button class="btn ghost" data-go="pricing">Voir les offres</button></div>
      <p class="note">Gratuit pour commencer · Sans carte bancaire · Aucun argent réel</p>
    </div>
    <div class="preview" aria-hidden="true">
      <div class="row" style="justify-content:space-between"><span class="eyebrow">Mission en cours</span><span class="chip g">${I.clock}5 min</span></div>
      <h3 style="font-size:20px;margin:10px 0 4px">L’ordre à cours limité</h3>
      <p class="small">Achète 3 actions sans payer plus de 42,50 € chacune.</p>
      <div class="ticket" style="margin-top:12px"><div class="tk-head"><b>Exemplia</b><span class="tn">42,52 €</span></div>
        <div class="seg"><button aria-pressed="false">Au marché</button><button aria-pressed="true">Limité</button></div>
        <div class="tk-f"><label>Prix limite</label><input value="42,50" readonly tabindex="-1"></div>
        <div class="guide">Nova Coach : ton ordre ne s’exécutera qu’à 42,50 € ou moins.</div></div>
      <div class="row" style="margin-top:14px;justify-content:space-between"><span class="pill v">${I.star}+18 Nova Score</span><span class="pill">${I.coin}+250 € fictifs</span></div>
    </div>
  </section>
  <section class="doors" aria-label="Choisis ton espace">
    <button class="door" data-start="perso"><span class="ic">${I.person}</span><b>Particuliers</b><span>Comprends la bourse à ton rythme, avec un parcours qui s’adapte à ton niveau.</span><span class="go">Commencer gratuitement →</span></button>
    <button class="door" data-go="campus"><span class="ic">${I.school}</span><b>Écoles</b><span>Crée tes classes, impose des missions, suis les progrès de chaque élève.</span><span class="go">Découvrir Nova Campus →</span></button>
    <button class="door" data-go="pro"><span class="ic">${I.building}</span><b>Entreprises</b><span>Forme tes équipes à l’épargne et à l’investissement, avec des statistiques anonymes.</span><span class="go">Découvrir Nova Pro →</span></button>
  </section>
  <section class="sec"><div class="sec-h"><h2>Comment ça marche</h2></div>
    <div class="how">
      <div class="card"><span class="chip v">1</span><b>Test de départ</b><p>8 questions qui s’adaptent à tes réponses. Ce que tu sais déjà est validé d’office.</p></div>
      <div class="card"><span class="chip v">2</span><b>Missions</b><p>Plus de 140 missions et 36 fiches de cours : ordres, graphiques en bougies, gestion du risque, jeux de rôle, salle de marché. Un examen et un certificat à chaque niveau.</p></div>
      <div class="card"><span class="chip v">3</span><b>Nova Score & certificat</b><p>Ton score monte à chaque mission. À 700, tu passes la certification NovaTitre.</p></div>
    </div></section>
  <footer class="foot">Contenu pédagogique : NovaTitre ne fournit pas de conseil en investissement personnalisé et n’exécute aucun ordre réel. Investir comporte un risque de perte en capital.<br>
    Mentions légales · CGU · CGV · Confidentialité (pages déjà prêtes sur le site actuel) · Prototype du 31/10/2026</footer>
</div></div>`;

/* ---------- accueil des nouveaux + test adaptatif ---------- */
let T = null;   // état du test
PAGES.onb = () => {
  if (!T) T = { step: S.profile && S.profile.objectif ? 1 : 0, lvl: { '1': 2, '2': 3, '3': 4, '4': 6 }[(S.profile || {}).niveau] || 3, n: 0, used: new Set(), log: [], cur: null, sel: null };
  if (T.step === 0) return `<div class="wrap">${top()}
    <span class="eyebrow">Bienvenue</span><h1 style="font-size:28px;margin:8px 0 6px">Qu’est-ce qui t’amène ?</h1><p class="muted">On adapte les missions à ton objectif.</p>
    <div class="opts" style="margin-top:18px">${[['comprendre','Comprendre comment marche la bourse'],['premiers','Préparer mes premiers placements'],['travail','Pour mes études ou mon travail'],['curieux','Juste par curiosité']].map(([k,t]) =>
      `<button class="opt" data-goal="${k}"${S.goal === k ? ' aria-pressed="true"' : ''}>${t}</button>`).join('')}</div>
    <h2 style="font-size:18px;margin:26px 0 10px">Ton rythme préféré</h2>
    <div class="pace">${[['rapide','Rapide · 3 min'],['normal','Normal · 7 min'],['intense','Intense · 15 min']].map(([k,t]) => `<button data-pace="${k}" aria-pressed="${S.pace === k}">${t}</button>`).join('')}</div>
    <button class="btn v full" style="margin-top:26px" data-test-start${S.goal ? '' : ' disabled'}>Faire mon test de départ (5 min)</button>
    <button class="btn ghost full" style="margin-top:10px" data-test-skip>Commencer au tout début</button>
  </div>`;
  if (T.step === 1){
    if (!T.cur){ const pool = PL.filter((q, i) => q.lvl === T.lvl && !T.used.has(i)); const q = pool[0] || PL.find((q, i) => !T.used.has(i)); T.cur = q; T.used.add(PL.indexOf(q)); T.sel = null; }
    const q = T.cur;
    return `<div class="wrap">${top()}
      <div class="p-top"><div class="bar"><i style="width:${(T.n / Math.max(10, T.n + 1)) * 100}%"></i></div><span class="small tn">${T.n + 1}/${Math.max(10, T.n + 1)}</span></div>
      <div class="p-body"><div class="p-kicker"><span class="chip v">Test de départ</span><span class="chip">Niveau ${q.lvl}</span></div>
        <p class="p-q">${h(q.q)}</p>
        <div class="opts">${q.choices.map((c, i) => `<button class="opt" data-tsel="${i}" aria-pressed="${T.sel === i}">${h(c)}</button>`).join('')}<button class="opt idk" data-tsel="-1" aria-pressed="${T.sel === -1}">Je ne sais pas</button></div>
        <p class="small">${T.n >= 10 ? 'Question de confirmation : ton résultat est à la limite entre deux niveaux.' : 'Les questions deviennent plus difficiles quand tu réussis, plus simples quand tu bloques. Si tu ne sais pas, dis-le : c’est plus utile que deviner.'}</p></div>
      <button class="btn v full" data-tnext${T.sel === null ? ' disabled' : ''}>Valider</button></div>`;
  }
  const v = T.validated, nCh = plMax(v), sk = MS.filter(m => m.ch <= nCh);
  return `<div class="wrap">${top()}<div class="debrief">
    <div class="burst"><div>${I.trophy}</div></div>
    <h1 style="font-size:28px">${v ? `${nCh} chapitre${nCh > 1 ? 's' : ''} validé${nCh > 1 ? 's' : ''} d’office` : 'On commence ensemble au début'}</h1>
    <p class="muted" style="max-width:40ch">${v ? `Tu sais déjà l’essentiel ${nCh > 9 ? `des niveaux 1 à ${nCh >= 15 ? 5 : nCh >= 13 ? 4 : 3}, trading compris` : `des chapitres ${CH.slice(0, nCh).map(c => '« ' + c.title + ' »').join(', ')}`}. Ces ${sk.length} missions sont validées : tu peux les rejouer quand tu veux.` : 'Aucun souci : les premières missions vont vite, et tu peux toujours les passer en mode éclair.'}</p>
    ${ring(S.score)}</div>
    ${planHTML()}
    <button class="btn v full" style="margin-top:12px" data-go="home">Commencer mon entraînement</button></div>`;
};
function finishTest(){ S.testDone = true;
  // chapitre validé si au moins une bonne réponse à ce niveau ou au-dessus, et aucune erreur à ce niveau ou en dessous
  let v = 0;
  for (let c = 1; c <= 10; c++){
    const okAbove = T.log.some(x => x.lvl >= c && x.ok), koBelow = T.log.some(x => x.lvl <= c && !x.ok);
    if (okAbove && !koBelow) v = c; else break;
  }
  T.validated = v; S.placement = v;
  MS.filter(m => m.ch <= plMax(v)).forEach(m => { if (!S.skip[m.id]){ S.skip[m.id] = 1; S.score = Math.min(1000, S.score + Math.round(m.score * 0.8)); } });
  S.plan2 = buildPlan(S.profile, v);
  /* Si le test valide déjà les chapitres gratuits, on offre le 1er chapitre du plan pour s'attacher avant de payer */
  if (!S.premium && plMax(v) >= 2){ const f = S.plan2.plan.find(x => x.ch >= 3) || { ch: Math.min(15, plMax(v) + 1) }; S.freeCh = f.ch; }
  S.onb = true; T.step = 2; save();
}

/* ---------- Nova Missions ---------- */
PAGES.missions = () => { const done = MS.filter(m => isDone(m.id)).length, lvNow = levelOf((nextMission() || MS[MS.length - 1]).ch);
  return `<div class="wrap">${top()}
  <button class="btn ghost sm" data-go="carte">${I.back}Ma carte</button><div class="sec-h" style="margin-top:10px"><h2 style="font-size:24px">Mon parcours en liste</h2><span>${done} / ${MS.length} missions</span></div>
  <div class="card"><div class="row" style="justify-content:space-between"><span class="eyebrow">En cours</span>${S.plan2 ? '<button class="v-link" data-go="monplan">Mon plan</button>' : ''}</div>
    <b style="display:block;font-size:18px;margin-top:4px">Niveau ${lvNow.id} · ${h(lvNow.title)}</b><div class="bar" style="margin-top:10px"><i style="width:${(done / MS.length * 100).toFixed(1)}%"></i></div>
    <p class="small" style="margin-top:8px">${Object.keys(S.certs).length} certificat${Object.keys(S.certs).length > 1 ? 's' : ''} · ${S.streak} jour${S.streak > 1 ? 's' : ''} de série</p></div>
  <div class="pace mini" role="group" aria-label="Durée de la séance">${[['rapide','3 min'],['normal','7 min'],['intense','15 min']].map(([k,t]) => `<button data-pace="${k}" aria-pressed="${S.pace === k}">${t}</button>`).join('')}</div>
  <section class="sec">${levelsHTML()}</section>
  ${legal()}
  </div>${dock()}`;
};
/* « Continuer » choisit la meilleure chose à faire maintenant */
function upNext(){
  const rv = dueReviews(), td = today(), DAILY = dailyMission(), ep = storyNext(), m = suggest()[0];
  if (!sessDoneToday() && TH.length){ const t = themeFor(0), min = S.pace === 'rapide' ? 3 : S.pace === 'intense' ? 15 : 7;
    return { kind: 'session', eyebrow: `Ta séance du jour · ${min} min`, title: t.title, sub: S.pace === 'rapide' ? 'Une leçon de 90 secondes et une décision à prendre.' : S.pace === 'intense' ? 'Une leçon de 90 secondes, 5 questions et une décision à prendre.' : 'Une leçon de 90 secondes, 3 questions et une décision à prendre.', attr: 'data-session' }; }
  if (rv.length) return { kind:'review', eyebrow:'À revoir · 1 min', title:`${rv.length} notion${rv.length > 1 ? 's' : ''} à revoir`, sub:'C’est le bon moment pour ne pas les oublier.', attr:'data-review' };
  if (S.dailyDone !== td) return { kind:'daily', eyebrow:`Mission du jour · ${DAILY.dur} min`, title: DAILY.title, sub: DAILY.goal, attr:'data-play="daily"' };
  if (ep && storyReady()) return { kind:'story', eyebrow:`Épisode ${STORY.indexOf(ep) + 1}/${STORY.length} · ${window.NT_STORY_META.title}`, title: ep.title, sub: ep.goal, attr:`data-play="${ep.id}"` };
  if (m) return { kind:'mission', eyebrow:`Chapitre ${m.ch} · ${m.kind} · ${m.dur} min`, title: m.title, sub: m.goal, attr:`data-play="${m.id}"` };
  return {};
}
const greet = () => { const hr = new Date().getHours(); return hr < 6 ? 'Bonne nuit' : hr < 18 ? 'Bonjour' : 'Bonsoir'; };
function suggest(){ const nm = nextMission(); const l0 = MS.filter(m => m.steps && !isDone(m.id) && chUnlocked(m.ch) && !chPremium(m.ch) && m.dur <= paceMax()); if (nm && S.plan2){ const sameCh = l0.filter(m => m.ch === nm.ch); if (sameCh.length) return sameCh.slice(0, 2); }
  const l = MS.filter(m => m.steps && !isDone(m.id) && chUnlocked(m.ch) && !chPremium(m.ch) && m.dur <= paceMax()); return (l.length ? l : MS.filter(m => m.steps && !isDone(m.id) && chUnlocked(m.ch) && !chPremium(m.ch))).slice(0, 2); }
function leagueRows(){ const me = { n:'Toi', p: Math.max(0, S.score % 400 + Object.keys(S.done).length * 10), me:true };
  return [{ n:'Camille', p: 320 }, { n:'Yanis', p: 270 }, { n:'Inès', p: 190 }, me, { n:'Hugo', p: 120 }].sort((a, b) => b.p - a.p); }
function chapCard(c){
  const pr = chProgress(c.id), un = chUnlocked(c.id), prem = chPremium(c.id), open = S.open[c.id] ?? (un && pr < 1 && c.id === (nextMission()?.ch));
  const list = chMissions(c.id), cur = list.find(m => !isDone(m.id));
  return `<div class="chap" data-open="${open ? 1 : 0}"><button class="chap-h" data-chap="${c.id}" aria-expanded="${!!open}">
    <span class="chap-n" style="background:${c.color}">${un ? c.id : I.lock}</span>
    <span class="grow"><b>${h(c.title)}</b><span>${h(c.sub)}</span><span class="bar"><i style="width:${(pr * 100).toFixed(0)}%"></i></span></span>
    ${prem ? '<span class="chip a">Premium</span>' : c.id === S.freeCh && !S.premium ? '<span class="chip g">Offert</span>' : ''}<span class="chev">${I.chev}</span></button>
    <div class="chap-b"><ol class="path" style="--c:${c.color}">${list.map((m, i) => node(m, i, m === cur)).join('')}</ol></div></div>`;
}
const ZIG = [0, 26, 40, 26, 0, -26, -40, -26];
function node(m, i, isCur){
  const done = S.done[m.id], skip = S.skip[m.id], un = chUnlocked(m.ch), prem = chPremium(m.ch), locked = !un || prem;
  const cls = done ? 'done' : skip ? 'skip' : locked ? 'lock' : isCur ? 'cur' : 'todo';
  const ic = done ? I.check : skip ? I.bolt : locked ? I.lock : I.play;
  const canEclair = isCur && !locked && !isDone(m.id) && m.steps.filter(gradable).length >= 2;
  return `<li class="nd ${cls}" style="--x:${ZIG[i % ZIG.length]}px">
    <button class="dot" data-play="${m.id}" aria-label="${isDone(m.id) ? 'Rejouer' : 'Jouer'} « ${h(m.title)} »${locked ? ' (verrouillée)' : ''}">${ic}</button>
    <span class="lb"><b>${h(m.title)}</b><span>${h(m.kind)} · ${m.dur} min${(S.viaSess || {})[m.id] ? ' · validée en séance' : skip && !done ? ' · validée au test' : ''}${S.eclair[m.id] ? ' · éclair' : ''}</span>
      ${canEclair ? `<button class="ecl" data-eclair="${m.id}" aria-label="Mission éclair : 3 questions pour valider « ${h(m.title)} »">${I.bolt}Je connais déjà</button>` : ''}</span></li>`;
}
function misRow(m, big = false){
  const done = S.done[m.id], skip = S.skip[m.id], un = chUnlocked(m.ch), prem = chPremium(m.ch), ready = !!m.steps;
  const cls = done ? 'done' : skip ? 'skip' : (!un || prem) ? 'lock' : '';
  const st = done ? I.check : skip ? I.bolt : (!un || prem) ? I.lock : I.play;
  return `<div class="mis ${cls}"><span class="st">${st}</span><div class="tx"><b>${h(m.title)}</b><div class="meta"><span class="chip">${h(m.kind)}</span><span class="chip">${I.clock}${m.dur} min</span></div></div>
    <div class="acts"><button class="ibtn ${!isDone(m.id) && un && !prem && ready ? 'v' : ''}" data-play="${m.id}" aria-label="Jouer « ${h(m.title)} »">${I.play}</button></div></div>`;
}

/* ---------- Marchés (simulateur) ---------- */
/* « Apprendre ici » : des missions et une fiche liées à la page du simulateur */
const LEARN = { markets: [['m2-3', 'm2-4', 'm2-11'], 'c2-1', 'Apprends à lire ce marché'], stock: [['m2-5', 'm2-6', 'm2-9', 'm2-8'], 'c2-2', 'Apprends à passer tes ordres'], portfolio: [['m3-1', 'm3-4', 'm3-8', 'm3-11'], 'c3-1', 'Apprends à construire ton portefeuille'] };
function learnHere(k){ const [ids, fid, t] = LEARN[k], ms = ids.map(id => MS.find(m => m.id === id)).filter(Boolean), f = CO.find(x => x.id === fid), dn = ms.filter(m => isDone(m.id)).length;
  return `<section class="sec learn"><div class="sec-h"><h2>${t}</h2><span class="small tn">${dn} / ${ms.length}</span></div><div class="learn-row">
    ${ms.map(m => { const d = isDone(m.id), lk = !chUnlocked(m.ch) || chPremium(m.ch); return `<button class="lchip ${d ? 'done' : lk ? 'lock' : ''}" data-play="${m.id}"><span>${d ? I.check : lk ? I.lock : I.play}</span><b>${h(m.title)}</b><small>${h(m.kind)} · ${m.dur} min</small></button>`; }).join('')}
    ${f ? `<button class="lchip f" data-fiche="${f.id}"><span>${I.book}</span><b>${h(f.title)}</b><small>Fiche · ${f.min} min</small></button>` : ''}</div></section>`; }
/* ---------- Marchés : vraies valeurs ---------- */
const SRCM = window.NT_MARKET_SRC || {};
const pctTxt = v => v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v), 2) + ' %';
const chgCls = v => v == null ? '' : v >= 0 ? 'pos' : 'neg';
const mkLogo = s => `<span class="tkr k-${s.kind}">${h(s.id.slice(0, 4))}</span>`;
const mkOpen = s => !s.minCh || chProgress(s.minCh) >= 0.5 || plMax(S.placement || 0) >= s.minCh;
let priceTag = s => isSim(s) ? `<span class="simtag">simulé</span>` : `<span class="realtag sm">réel · ${s.date ? dateFr(s.date).slice(0, 5) : 'récent'}</span>`;
function series(id){ const s = mkFind(id), a = anchorOf(s), d = dayIndex(), from = Math.min(a, d); return Array.from({ length: Math.max(1, d - from + 1) }, (_, i) => priceOn(s, from + i)); }
/* courbe qui se dessine : 1er point = cours réel, la suite = simulation */
function sparkSVG(vals, w = 320, hh = 120){
  if (vals.length < 2) return `<div class="chart-empty"><b class="tn">1 point réel</b><span>La courbe se dessine jour après jour (Profil → Jour +1 pour tester).</span></div>`;
  const mn = Math.min(...vals), mx = Math.max(...vals), up = vals[vals.length - 1] >= vals[0];
  const P = vals.map((v, i) => [(i / (vals.length - 1) * (w - 8) + 4), (8 + (1 - (v - mn) / (mx - mn || 1)) * (hh - 16))]);
  const pts = P.map(p => p.map(x => x.toFixed(1)).join(',')).join(' ');
  return `<svg viewBox="0 0 ${w} ${hh}" class="chart draw ${up ? 'up' : 'down'}" role="img" aria-label="Évolution : cours réel puis simulé"><defs><linearGradient id="chF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <polygon points="4,${hh} ${pts} ${w - 4},${hh}" fill="url(#chF)" class="ch-area"/><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" pathLength="1" class="ch-line"/>
    <circle cx="${P[0][0]}" cy="${P[0][1]}" r="4.5" class="ch-real"/><circle cx="${P[P.length - 1][0]}" cy="${P[P.length - 1][1]}" r="5" class="ch-last"/></svg>
    <div class="ch-leg"><span><i class="lg-real"></i>Cours réel du ${s0date(vals)}</span><span><i class="lg-sim"></i>Simulation</span></div>`; }
let __sd = ''; const s0date = () => __sd;
const MZ = [['all', 'Tout'], ['Paris', 'Paris'], ['USA', 'USA'], ['ETF', 'ETF'], ['Crypto', 'Crypto']];
const INDICES = [['CAC 40', '7 969,42', 2.4, 'sur la semaine'], ['S&P 500', '7 580,07', -1.82, '30/10'], ['Nasdaq', '25 437,00', -2.86, '30/10'], ['Brent', '113,91 $', 2.8, '30/10']];
PAGES.markets = () => { const z = window.__mz || 'all', list = MK.filter(s => !s.hidden && (z === 'all' || s.zone === z)), c = CAR(), ready = careerReady(), d = RD.DAYS[c.n];
  return `<div class="wrap">${top()}${tabs('markets')}
  <div class="pg-h" style="margin-top:12px"><h1>Marchés</h1><span class="realtag">Vraies valeurs</span></div>
  <div class="idx-row">${INDICES.map(([n, v, ch, w]) => `<div class="idx"><span>${n}</span><b class="tn">${v}</b><small class="tn ${chgCls(ch)}">${pctTxt(ch)} <em>${w}</em></small></div>`).join('')}</div>
  <button class="career ${ready ? '' : 'wait'}" data-career><span class="c-ic">${IC2.news}</span><span class="grow"><span class="eyebrow">Journée de trader · ${c.n}/${RD.DAYS.length}</span><b>${c.n >= RD.DAYS.length ? 'Semaine terminée' : ready && d ? h(RD.ev(d.decide).co) + ' : à toi de décider' : 'Prochaine journée demain'}</b></span>${ready ? `<span class="ibtn v">${I.play}</span>` : ''}</button>
  <div class="chips" role="group" aria-label="Filtrer">${MZ.map(([k, t]) => `<button data-mz="${k}" aria-pressed="${z === k}">${t}</button>`).join('')}</div>
  <div class="mk-list">${list.map(s => { const v = chg(s); return `<button class="mk-row" data-stock="${s.id}">${mkLogo(s)}<span class="grow"><b>${h(s.name)}</b><span>${h(s.sector)}</span></span><span class="mk-px"><b class="tn">${money(s, px(s))}</b><span class="tn ${chgCls(v)}">${pctTxt(v)}</span></span></button>`; }).join('')}</div>
  <p class="note">Cours réels relevés au 30/10/2026 (date précise sur chaque valeur, avec la source), puis évolution simulée les jours suivants. Sur le site : cours en direct. Ce n’est pas un conseil.</p>
  <section class="sec"><div class="sec-h"><h2>Les nouvelles de la semaine</h2></div><div class="news-row">${RD.EVENTS.filter(e => e.move != null).map(e => `<button class="nchip" data-event="${e.id}"><b>${h(e.co)}</b><span class="tn ${chgCls(e.move)}">${e.approx ? '≈ ' : ''}${pctTxt(e.move)}</span><small>${h(e.day)}</small></button>`).join('')}</div></section>
  ${learnHere('markets')}
  ${legal()}</div>${dock()}`; };
PAGES.bureau = () => PAGES.markets();
PAGES.stock = () => { const s = mkFind(S.arg) || MK[0], pos = S.positions[s.id], v = chg(s), open = mkOpen(s), src = SRCM[s.src];
  __sd = s.date ? dateFr(s.date).slice(0, 5) : 'cours récent';
  const tk = Object.assign({ name: s.name, price: px(s), cur: s.cur, sub: `${s.id} · ${s.zone === 'Paris' ? 'Euronext Paris' : s.zone === 'Crypto' ? 'crypto' : 'New York'}${isSim(s) ? ' · simulé' : ''}`, side: 'buy', type: 'market', qty: s.frac ? 0.01 : 1, limit: px(s) }, window.__tk || {});
  return `<div class="wrap">${top()}
  <button class="btn ghost sm" data-go="markets">${I.back}Marchés</button>
  <div class="st-head">${mkLogo(s)}<div><h1>${h(s.name)}</h1><p class="muted">${h(s.sector)} · ${s.pea ? 'éligible PEA' : 'compte-titres'}</p></div></div>
  <div class="row st-px"><b class="tn" data-count="${px(s)}" data-d="${px(s) < 10 ? 4 : 2}">${money(s, px(s))}</b><span class="tn ${chgCls(v)}">${pctTxt(v)}</span>${priceTag(s)}</div>
  ${s.cur === 'USD' ? `<p class="small">≈ ${eur(toEur(s, px(s)))} (1 € = ${num(EURUSD, 4)} $)</p>` : ''}
  <div class="chart-wrap">${sparkSVG(series(s.id))}</div>
  ${src ? `<a class="src" href="${h(src.u)}" target="_blank" rel="noopener">${IC2.ext}Cours réel : ${h(src.t)}${s.date ? '' : ' (cours récent)'}</a>` : ''}
  ${s.kind === 'crypto' ? `<div class="card warn" style="margin-top:12px"><b>Actif très risqué</b><p class="small" style="margin-top:4px">Le prix peut chuter de moitié en quelques semaines. Ici, on l’étudie pour comprendre le risque. Achat fictif ouvert après le chapitre 9.</p></div>` : ''}
  ${s.note ? `<p class="small" style="margin-top:8px">${h(s.note)}</p>` : ''}
  ${applyBanner()}
  ${pos ? `<div class="card pos-card"><span class="eyebrow">Ta position</span><div class="row" style="justify-content:space-between;margin-top:4px"><b class="tn">${num(pos.qty, s.frac ? 4 : 0)} × ${money(s, px(s))}</b><span class="tn ${chgCls(px(s) - pos.avg)}">${(px(s) - pos.avg >= 0 ? '+' : '') + eur(toEur(s, (px(s) - pos.avg) * pos.qty))}</span></div></div>` : ''}
  ${open ? `<div class="ticket" style="margin-top:14px" id="tradeTk">${ticketHTML(tk)}</div>
  <button class="btn v full big" style="margin-top:12px" data-trade="${s.id}">Passer l’ordre (fictif)</button>
  <p class="note">Disponible : ${eur(S.cash)} fictifs, gagnés en réussissant tes missions.</p>`
  : `<button class="btn ghost full" style="margin-top:14px" data-cnode="${s.minCh}">${I.lock}Achat fictif débloqué au chapitre ${s.minCh}</button>`}
  ${learnHere('stock')}
  ${legal()}</div>${dock()}`; };
/* ---------- Portefeuille ---------- */
const SECT_C = ['#8f74ff', '#5b8cff', '#3fd39a', '#8fb4ff', '#ff7aa8', '#66d0ff', '#c4b5ff', '#ff9f5a'];
PAGES.portfolio = () => { const val = portfolioValue(), prev = portfolioValue(true), ids = Object.keys(S.positions).filter(id => mkFind(id));
  const cost = ids.reduce((t, id) => { const s = mkFind(id), p = S.positions[id]; return t + toEur(s, p.avg * p.qty); }, 0), pl = val - cost;
  const bySec = {}; ids.forEach(id => { const s = mkFind(id); bySec[s.sector] = (bySec[s.sector] || 0) + toEur(s, px(s) * S.positions[id].qty); });
  const secs = Object.entries(bySec).sort((x, y) => y[1] - x[1]), maxW = secs.length ? Math.max(...ids.map(id => toEur(mkFind(id), px(mkFind(id)) * S.positions[id].qty))) / (val || 1) : 0;
  const solid = !ids.length ? null : Math.round(Math.min(100, secs.length * 18 + (1 - maxW) * 40 + (ids.some(id => mkFind(id).kind === 'etf') ? 10 : 0)));
  return `<div class="wrap">${top()}
  <div class="pg-h"><h1>Portefeuille</h1><span class="sample">Argent fictif</span></div>
  <div class="pf-hero"><span class="eyebrow">Valeur totale</span><b class="tn" data-count="${Math.round(val + S.cash)}" data-fmt="eur">${eur0(val + S.cash)}</b>
    <div class="row" style="gap:14px;flex-wrap:wrap"><span class="tn ${chgCls(pl)}">${ids.length ? (pl >= 0 ? '+' : '') + eur(pl) + ' depuis l’achat' : 'Aucune position'}</span>${ids.length ? `<span class="tn ${chgCls(val - prev)}">${(val - prev >= 0 ? '+' : '') + eur(val - prev)} cette nuit</span>` : ''}</div>
    <div class="pf-split"><div><span>Investi</span><b class="tn">${eur0(val)}</b></div><div><span>Disponible</span><b class="tn">${eur0(S.cash)}</b></div><div><span>Solidité</span><b class="tn">${solid == null ? '—' : solid + ' / 100'}</b></div></div></div>
  ${secs.length ? `<div class="alloc" aria-label="Répartition par secteur">${secs.map(([n, v], i) => `<i style="--w:${(v / val * 100).toFixed(1)}%;--c:${SECT_C[i % SECT_C.length]};--d:${i * 0.08}s" title="${h(n)}"></i>`).join('')}</div>
    <div class="alloc-leg">${secs.map(([n, v], i) => `<span><i style="background:${SECT_C[i % SECT_C.length]}"></i>${h(n)} <b class="tn">${num(v / val * 100, 0)} %</b></span>`).join('')}</div>` : ''}
  ${applyBanner()}
  <section class="sec"><div class="sec-h"><h2>Positions</h2><span class="small">${ids.length}</span></div>
    ${ids.length ? `<div class="mk-list">${ids.map(id => { const s = mkFind(id), p = S.positions[id], pv = toEur(s, (px(s) - p.avg) * p.qty);
      return `<button class="mk-row" data-stock="${s.id}">${mkLogo(s)}<span class="grow"><b>${h(s.name)}</b><span class="tn">${num(p.qty, p.qty % 1 ? 4 : 0)} × ${money(s, px(s))}</span></span><span class="mk-px"><b class="tn">${eur0(toEur(s, px(s) * p.qty))}</b><span class="tn ${chgCls(pv)}">${(pv >= 0 ? '+' : '') + eur(pv)}</span></span></button>`; }).join('')}</div>`
    : `<div class="card empty"><b>Ton portefeuille est vide</b><p class="small">Choisis une vraie valeur dans Marchés et achète-la avec ton argent fictif.</p><button class="btn v sm" style="margin-top:12px" data-go="markets">Aller aux marchés</button></div>`}</section>
  ${learnHere('portfolio')}
  <section class="sec"><div class="sec-h"><h2>Historique</h2></div><div class="card">${S.history.length ? S.history.slice(-6).reverse().map(x => `<p class="small tn hist">${h(x)}</p>`).join('') : '<p class="small">Tes ordres apparaîtront ici.</p>'}</div></section>
  ${legal()}</div>${dock()}`; };

/* ---------- Nova Coach ---------- */
const COACH = [
  [/etf|tracker/i, 'Un ETF est un fonds coté qui suit un indice (par exemple le CAC 40). En une seule ligne, tu investis dans toutes les entreprises de l’indice. Il peut baisser comme l’indice. La mission « Les ETF expliqués » (chapitre 3) va plus loin.'],
  [/spread|carnet/i, 'Le spread, c’est l’écart entre le meilleur prix de vente et le meilleur prix d’achat dans le carnet d’ordres. Plus il est petit, moins tu perds à l’achat puis à la revente. Entraîne-toi avec « Le carnet d’ordres et le spread ».'],
  [/pea|compte.?titre|cto/i, 'Le PEA accueille des actions européennes et certains fonds, jusqu’à 150 000 € de versements ; après 5 ans, les gains ne supportent plus que les prélèvements sociaux (18,6 % en 2026). Le compte-titres accepte presque tout, avec une taxation de 31,4 % sur les gains (2026).'],
  [/dividende/i, 'Le dividende est une part du bénéfice versée aux actionnaires. Il n’est jamais garanti : l’entreprise peut le réduire ou le supprimer.'],
  [/arnaque|escroc|garanti/i, 'Signaux d’alerte : rendement élevé « garanti », urgence, contact non sollicité, demande de virement à l’étranger ou en crypto. Vérifie toujours l’autorisation sur le registre REGAFI et les listes noires de l’AMF.'],
  [/achet|vend|investir dans|je mets|dois.?je/i, 'Je ne peux pas te dire quoi acheter ou vendre : ce serait un conseil personnalisé. Par contre, voici les questions à te poser : 1) Quand auras-tu besoin de cet argent ? 2) As-tu une épargne de précaution ? 3) Quelle baisse pourrais-tu supporter sans vendre ? 4) Est-ce diversifié ? 5) Combien coûtent les frais ? Tu veux qu’on travaille une de ces questions en mission ?'],
];
PAGES.coach = () => `<div class="wrap">${top()}
  <div class="sec-h" style="margin-top:4px"><h2 style="font-size:24px">Nova Coach</h2><span class="chip ${aiOn() ? 'v' : ''}">${aiLabel()}</span></div>
  <p class="small">Nova Coach est une intelligence artificielle : il explique, il ne donne pas de conseil en investissement personnalisé, et il peut se tromper. ${aiOn() ? 'Il connaît ta progression (sans ton nom) pour t’aider au mieux.' : 'Ici, l’IA n’est pas branchée : ses réponses sont préparées à l’avance.'}</p>
  <button class="card suivi-link" data-go="suivi"><span class="eyebrow">${I.target} Mon suivi personnalisé</span><b>Bilan, points forts, plan de la semaine</b></button>
  <div class="cmsgs" style="margin-top:14px" id="cmsgs">
    <div class="bub them"><small>Nova Coach</small>Salut ! Pose-moi une question sur une notion, une mission ou un mot que tu ne comprends pas.</div>
    ${S.coach.map(m => `<div class="bub ${m.me ? 'me' : 'them'}"><small>${m.me ? 'Toi' : 'Nova Coach'}</small>${m.me ? h(m.t) : coachText(m.t)}</div>`).join('')}</div>
  <div class="sugg">${['C’est quoi un ETF ?','Le spread ?','PEA ou compte-titres ?','Je dois acheter quoi ?'].map(s => `<button data-ask="${h(s)}">${h(s)}</button>`).join('')}</div>
  <form class="cin" id="coachF"><label class="sr" for="coachIn">Ta question</label><input id="coachIn" placeholder="Écris à Nova Coach…" autocomplete="off"><button class="ibtn v" aria-label="Envoyer">${I.send}</button></form>
</div>${dock()}`;
function askCoach(q){
  q = q.trim(); if (!q) return;
  if (aiOn()) return askCoachAI(q);
  const a = (COACH.find(([re]) => re.test(q)) || [null, 'Bonne question ! Dans la vraie version, je te réponds en détail avec des exemples. Ici, essaie : ETF, spread, PEA, dividende ou arnaque.'])[1];
  S.coach.push({ me:1, t:q }, { me:0, t:a }); S.coach = S.coach.slice(-30); save(); render();
  setTimeout(() => { const c = $('#cmsgs'); if (c) c.lastElementChild.scrollIntoView({ block:'end', behavior:'smooth' }); }, 30);
}

/* ---------- Profil ---------- */
const BADGES = [
  ['Première mission', () => Object.keys(S.done).length >= 1, I.play],
  ['5 missions', () => Object.keys(S.done).length >= 5, I.target],
  ['Éclair', () => Object.keys(S.eclair).length >= 1, I.bolt],
  ['Série de 3 j', () => S.streak >= 3, I.flame],
  ['Chapitre 1', () => chProgress(1) === 1, I.book],
  ['Premier ordre', () => S.history.some(x => /Achat|Vente/.test(x)), I.chart],
  ['Anti-arnaque', () => !!S.done['m6-1'], I.shield],
  ['Certifié', () => Object.keys(S.certs).length >= 1, I.trophy],
  ['Trader', () => !!S.certs.trader, I.cap],
  ['Discipline', () => defiPassed() >= 1, I.candle],
];
PAGES.profile = () => { const { r, nx } = rankOf(S.score), cert = S.score >= window.NT_CERT_SCORE;
  return `<div class="wrap">${top()}
  <section class="card"><div class="scorebox">${ring(S.score)}<div><span class="eyebrow">Mon Nova Score</span><b style="display:block;font-size:22px;margin-top:2px">${r.name}</b>
    <p class="small">${nx ? `Prochain rang : ${nx.name} (${nx.min})` : 'Rang maximum'}</p></div></div></section>
  <section class="sec"><div class="sec-h"><h2>Mon école</h2><span>${Object.keys(S.certs).length} / ${LV.length + 1} certificats</span></div><div class="cert">
    <div class="lvdots">${LV.map(l => `<span class="${S.certs[l.id] ? 'on' : ''}" title="Niveau ${l.id}">${S.certs[l.id] ? I.check : l.id}</span>`).join('')}<span class="${S.certs.trader ? 'on' : ''} big" title="Certificat Trader">${I.trophy}</span></div>
    <p class="small" style="margin-top:10px">Un examen par niveau (80 % pour valider), puis le Certificat Trader : Défi Trader (${defiPassed()}/${CF.defiSessions}), plan de trading${S.plan && S.plan.ok ? ' ✓' : ''} et examen final.</p>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn v sm" data-go="certs">${I.trophy}Mes certificats</button><button class="btn ghost sm" data-go="suivi">Mon suivi IA</button><button class="btn ghost sm" data-go="plan">Mon plan de trading</button><button class="btn ghost sm" data-go="amf">Prépa AMF</button><button class="btn ghost sm" data-go="cours">${I.book}Manuel</button></div></div></section>
  <section class="sec"><div class="sec-h"><h2>Mes outils</h2><span class="small">${TOOLS.filter(toolOn).length} / ${TOOLS.length}</span></div>${toolStrip()}</section>
  <section class="sec"><div class="sec-h"><h2>Mes chapitres</h2></div><div class="card">${CH.map(c => `<div style="padding:8px 0"><div class="row" style="justify-content:space-between"><span style="font-size:14px;font-weight:700">${c.id}. ${h(c.title)}</span><span class="small tn">${Math.round(chProgress(c.id) * 100)} %</span></div><div class="bar" style="margin-top:6px"><i style="width:${chProgress(c.id) * 100}%;background:${c.color}"></i></div></div>`).join('')}</div></section>
  <section class="sec"><div class="sec-h"><h2>Badges</h2></div><div class="badges">${BADGES.map(([t, f, ic]) => `<div class="badge ${f() ? 'on' : ''}"><div>${ic}</div>${h(t)}</div>`).join('')}</div></section>
  <section class="sec"><div class="sec-h"><h2>Réglages</h2></div><div class="card">
    ${subRow()}
    <div class="toggle"><span>Mon profil et mon plan d’entraînement</span><span class="row" style="gap:6px"><button class="btn ghost sm" data-go="monplan">Voir</button><button class="btn ghost sm" data-redoprofile>Refaire</button></span></div>
    <div class="toggle"><span>Rappel quotidien (1 par jour maximum)${S.profile && S.profile.moment && S.profile.moment !== 'libre' ? ` · ${h(PQ_LABEL('moment', S.profile.moment).toLowerCase())}` : ''}</span><button class="sw-t" role="switch" aria-checked="${S.reminder}" data-toggle="reminder" aria-label="Rappel quotidien"></button></div>
    <div class="toggle"><span>Sons et vibrations</span><button class="sw-t" role="switch" aria-checked="${S.sound}" data-toggle="sound" aria-label="Sons et vibrations"></button></div>
    ${window.NT_PAY ? '' : `<div class="toggle"><span>Simuler l’abonnement Premium <span class="small">(prototype)</span></span><button class="sw-t" role="switch" aria-checked="${S.premium}" data-toggle="premium" aria-label="Simuler Premium"></button></div>`}
    <div class="toggle"><span>Espaces pros</span><span class="row" style="gap:6px"><button class="btn ghost sm" data-go="campus">Campus</button><button class="btn ghost sm" data-go="pro">Pro</button></span></div>
    <div class="toggle"><span>Offres</span><button class="btn ghost sm" data-go="pricing">Voir les offres</button></div>
    <div class="toggle"><span>Passer au jour suivant <span class="small">(pour tester le prototype)</span></span><button class="btn ghost sm" data-nextday>Jour +1</button></div>
    <div class="toggle"><span>Recommencer le prototype à zéro</span><button class="btn ghost sm" data-reset>Réinitialiser</button></div></div></section>
  ${legal()}</div>${dock()}`; };

/* ---------- Nova Campus (écoles) ---------- */
const DEMO_STUDENTS = [['Léa M.', 412, 14, 'Aujourd’hui'], ['Nathan B.', 268, 9, 'Hier'], ['Sarah K.', 530, 19, 'Aujourd’hui'], ['Adam T.', 96, 3, 'Il y a 6 jours'], ['Emma R.', 344, 12, 'Il y a 2 jours']];
const proShell = (title, sub, body) => `<div class="wrap">${top()}<button class="btn ghost sm" data-go="${S.onb ? 'profile' : 'landing'}">${I.back}Retour</button>
  <div style="margin-top:14px"><span class="eyebrow">${sub}</span><h1 style="font-size:26px;margin-top:6px">${title}</h1></div>${body}${legal()}</div>${S.onb ? dock() : ''}`;
const licence = (who, used, max) => `<div class="card" style="margin-top:12px"><div class="row" style="justify-content:space-between"><b>Licence Nova Pro</b><span class="sample">Exemple</span></div>
  <div class="row" style="margin-top:8px;align-items:flex-end;gap:8px"><b class="tn" style="font-size:26px">${used}</b><span class="small" style="margin-bottom:4px">/ ${max} comptes ${who} actifs</span></div>
  <div class="bar" style="margin-top:8px"><i style="width:${used / max * 100}%"></i></div>
  <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn ghost sm" data-soon="Ajout de comptes">Ajouter des comptes</button><button class="btn ghost sm" data-go="pricing">Voir les tarifs</button></div></div>`;
const assignForm = (who) => `<div class="card" style="margin-top:12px"><b>Imposer une mission</b><form class="form" id="assignF" style="margin-top:10px">
  <label for="aGroup">${who}</label><select id="aGroup">${(S.classes.length ? S.classes : [{ name: who === 'Classe' ? 'BTS Banque — Groupe A (exemple)' : 'Service commercial (exemple)', code:'' }]).map(c => `<option>${h(c.name)}</option>`).join('')}</select>
  <label for="aMis">Mission ou chapitre</label><select id="aMis">${CH.map(c => `<option value="ch${c.id}">Chapitre ${c.id} · ${h(c.title)}</option>`).join('')}${MS.filter(m => m.steps).map(m => `<option value="${m.id}">${h(m.title)}</option>`).join('')}</select>
  <label for="aDate">À faire avant le</label><input id="aDate" type="date" required>
  <button class="btn v" style="margin-top:6px">Imposer</button></form>
  ${S.assigns.length ? `<div style="margin-top:12px">${S.assigns.slice(-5).reverse().map(a => `<p class="small" style="padding:6px 0;border-top:1px solid var(--line)">${h(a.g)} · ${h(a.m)} · avant le ${h(a.d)}</p>`).join('')}</div>` : ''}</div>`;
PAGES.campus = () => proShell('Nova Campus', 'Espace écoles', `
  <p class="muted" style="margin-top:6px">Crée tes classes, impose des missions, suis chaque élève et exporte les résultats.</p>
  ${licence('élèves', 23, 50)}
  <div class="card" style="margin-top:12px"><div class="toggle" style="border:0;padding:0"><span><b>Élèves mineurs : protection renforcée</b><span class="small" style="display:block;margin-top:2px">Recommandé pour les collèges et lycées</span></span><button class="sw-t" role="switch" aria-checked="${S.minors !== false}" data-toggle="minors" aria-label="Protection renforcée des élèves mineurs"></button></div>
    <ul class="rules"><li>Nova Coach (IA) ne reçoit aucune réponse au questionnaire de profil, seulement les résultats d’exercices</li><li>Nova Coach répond uniquement aux questions de cours</li><li>Pas de classement public, pas de publicité, pas d’offre payante montrée aux élèves</li><li>Données hébergées dans l’Union européenne, supprimées en fin d’année scolaire</li></ul>
    <p class="note">Avant tout contrat avec un établissement : contrat de traitement des données (RGPD, art. 28), information des familles, registre des traitements et analyse d’impact si nécessaire. Documents à préparer avec un juriste.</p></div>
  <div class="card" style="margin-top:14px"><b>Créer une classe</b><form class="form" id="classF" style="margin-top:10px"><label for="cName">Nom de la classe</label><input id="cName" placeholder="ex. Licence Éco — TD 3" required><button class="btn v" style="margin-top:6px">Créer et obtenir un code</button></form>
    ${S.classes.length ? S.classes.map(c => `<div class="row" style="justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)"><span style="font-weight:700">${h(c.name)}</span><span class="code">${c.code}</span></div>`).join('') : ''}</div>
  ${assignForm('Classe')}
  <div class="card" style="margin-top:12px"><div class="row" style="justify-content:space-between"><b>Notions où la classe bloque</b><span class="sample">Aperçu · exemple</span></div>
    <p class="small" style="margin-top:4px">Une notion ratée 3 fois déclenche le mode déblocage. Vous voyez combien d’élèves bloquent, jamais leurs messages au coach.</p>
    ${[['Calculer une variation en pourcentage', 7, 4], ['Ordre à cours limité ou au marché', 5, 3], ['Règle des 1 % et taille de position', 4, 1]].map(([t, n, d]) => `<div class="ub-row"><span class="grow small"><b style="color:#fff">${t}</b><br>${n} élèves bloqués · ${d} débloqués</span><button class="btn ghost sm" data-soon="Imposer une mission de rattrapage">Rattrapage</button></div>`).join('')}</div>
  <div class="card" style="margin-top:12px"><div class="row" style="justify-content:space-between"><b>Progression de la classe</b><span class="sample">Aperçu · élèves fictifs</span></div>
    <div class="scroll-x"><table class="tbl" style="margin-top:8px"><thead><tr><th>Élève</th><th>Nova Score</th><th>Missions</th><th>Dernière activité</th></tr></thead><tbody>
    ${DEMO_STUDENTS.map(s => `<tr><td>${s[0]}</td><td class="tn">${s[1]}</td><td class="tn">${s[2]}</td><td>${s[3]}</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-soon="Export des notes (CSV, PDF)">Exporter les notes</button><button class="btn ghost sm" data-soon="Certificats groupés">Certificats</button></div></div>`);
PAGES.pro = () => proShell('Nova Pro', 'Espace entreprises', `
  <p class="muted" style="margin-top:6px">Forme tes équipes à l’épargne et à l’investissement. Les RH ne voient que des statistiques globales : la progression individuelle reste privée.</p>
  ${licence('salariés', 142, 200)}
  <div class="grid3" style="margin-top:14px"><div class="stat"><b class="tn">68 %</b><span>Participation</span></div><div class="stat"><b class="tn">312</b><span>Nova Score moyen</span></div><div class="stat"><b class="tn">41</b><span>Certifiés</span></div></div>
  <p class="note"><span class="sample">Aperçu · chiffres d’exemple</span></p>
  <div class="card" style="margin-top:12px"><b>Parcours entreprise</b><p class="small" style="margin-top:6px">« Comprendre mon épargne salariale » : intéressement, participation, PEE, plan retraite. Missions courtes adaptées au poste. <span class="chip a">En préparation</span></p></div>
  <div class="card" style="margin-top:12px"><b>Créer un groupe</b><form class="form" id="classF" style="margin-top:10px"><label for="cName">Nom du groupe</label><input id="cName" placeholder="ex. Équipe commerciale Lyon" required><button class="btn v" style="margin-top:6px">Créer et obtenir un code</button></form>
    ${S.classes.length ? S.classes.map(c => `<div class="row" style="justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)"><span style="font-weight:700">${h(c.name)}</span><span class="code">${c.code}</span></div>`).join('') : ''}</div>
  ${assignForm('Groupe')}
  <div class="card" style="margin-top:12px"><b>Missions les mieux réussies</b><span class="sample" style="margin-left:6px">exemple</span>
    ${[['Vrai ou arnaque ?', 92], ['PEA ou compte-titres ?', 81], ['La magie des intérêts composés', 77]].map(([t, v]) => `<div style="margin-top:10px"><div class="row" style="justify-content:space-between"><span class="small" style="color:var(--fg2)">${t}</span><span class="small tn">${v} %</span></div><div class="bar" style="margin-top:5px"><i style="width:${v}%"></i></div></div>`).join('')}
    <button class="btn ghost sm" style="margin-top:14px" data-soon="Rapport RH (PDF)">Exporter le rapport</button></div>`);

/* ---------- Tarifs ---------- */
PAGES.pricing = () => proShell('Les offres', 'Tarifs', `
  <div class="plans" style="margin-top:16px">
    <div class="card plan"><span class="eyebrow">Particuliers</span><b class="plan-t">Découverte</b><p class="price" style="margin-top:6px">0 €</p>
      <ul><li>Test de départ et Nova Score</li><li>Chapitres 1 et 2 complets</li><li>Toutes les fiches de cours</li><li>Mission du jour et salle de marché</li><li>Bilan automatique</li></ul>
      <button class="btn ghost full" style="margin-top:14px" data-start="perso">Commencer</button></div>
    <div class="card plan best"><div class="row" style="justify-content:space-between"><span class="eyebrow">Particuliers</span><span class="chip v">Le plus complet</span></div><b class="plan-t">Premium</b>${priceToggle()}<p class="price" style="margin-top:6px">${window.__an !== false ? `${num(PRICE.annuel, 2)} € <small>/ an</small>` : `${num(PRICE.mensuel, 2)} € <small>/ mois</small>`}</p>
      <ul><li>Les 5 niveaux, 15 chapitres, 140+ missions</li><li>Examens et Certificats NovaTitre</li><li>Défi Trader et Certificat Trader</li><li>Suivi personnalisé par l’IA, Nova Coach illimité</li><li>Prépa Certification AMF</li></ul>
      ${S.sub ? `<button class="btn ghost full" style="margin-top:14px" data-managesub>Gérer mon abonnement</button>` : !S.trialUsed ? `<button class="btn v full" style="margin-top:14px" data-trial>Essai gratuit ${PRICE.trialDays} jours</button>` : `<button class="btn v full" style="margin-top:14px" data-subscribe="${window.__an !== false ? 'annuel' : 'mensuel'}">S’abonner</button>`}</div>
    <div class="card plan pro"><span class="eyebrow">Écoles · Entreprises (RH)</span><b class="plan-t">Nova Pro</b>${proQuote()}
      <ul><li>Tout Premium pour chaque compte</li><li>Tableau de bord, groupes et codes d’invitation</li><li>Missions et examens imposés, dates limites</li><li><b>Écoles</b> : suivi élève par élève, notes, export</li><li><b>RH</b> : statistiques globales anonymes (jamais individuelles)</li><li>Bilan de groupe par l’IA, certificats groupés</li></ul>
      <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn v sm" data-go="campus">Espace École</button><button class="btn ghost sm" data-go="pro">Espace RH</button><button class="btn ghost sm" data-soon="Demande de devis">Demander un devis</button></div></div>
  </div><p class="note">Prix indicatifs du prototype, à valider. Prix TTC ou « TVA non applicable, art. 293 B du CGI » selon ton statut (à compléter). Résiliation en 3 clics depuis le profil. Les comptes Nova Pro peuvent être réattribués d’une année sur l’autre.</p>`);
/* Nova Pro : prix selon le nombre de comptes suivis */
const PRO_TIERS = [[10, 49, 4], [50, 199, 3], [200, 499, 2.5]];
function proPrice(n, annual){ const t = PRO_TIERS.find(([a, b]) => n >= a && n <= b); if (!t) return null; const m = n * t[2]; return { unit: t[2], month: m, year: annual ? m * 10 : m * 12 }; }
function proQuote(){ const n = window.__seats || 30, an = window.__annual !== false, pr = proPrice(n, an);
  return `<div class="seats"><label for="seats">Nombre de comptes suivis : <b class="tn" id="seatsV">${n >= 500 ? '500 et plus' : n}</b></label>
    <input id="seats" type="range" min="10" max="500" step="5" value="${n}" data-seats>
    <div class="seg" role="group" aria-label="Facturation"><button data-annual="1" aria-pressed="${an}">À l’année (−2 mois)</button><button data-annual="0" aria-pressed="${!an}">Au mois</button></div>
    <p class="price" style="margin-top:10px" id="seatsP">${pr ? `${num(pr.unit, pr.unit % 1 ? 2 : 0)} € <small>/ compte / mois</small>` : 'Sur devis'}</p>
    <p class="small" id="seatsT">${pr ? (an ? `${eur0(pr.year)} par an pour ${n} comptes` : `${eur0(pr.month)} par mois pour ${n} comptes`) : 'Au-delà de 500 comptes : tarif sur mesure, intégration et formation des équipes.'}</p>
    <p class="small">10 à 49 comptes : 4 € · 50 à 199 : 3 € · 200 à 499 : 2,50 € · 500 et plus : sur devis</p></div>`; }

/* ============================================================
   LECTEUR DE MISSION
   ============================================================ */
let M = null;
const shuffle = (a, seed = 7) => { const b = a.slice(); let x = seed; for (let i = b.length - 1; i > 0; i--){ x = (x * 9301 + 49297) % 233280; const j = Math.floor(x / 233280 * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const sliderVal = (st, y) => { const r = st.rate / 100, g = Math.pow(1 + r, y); return st.capital * g + (st.monthly ? st.monthly * 12 * (g - 1) / r : 0); };
/* Variété : réponses mélangées à chaque essai ; chiffres changés quand on rejoue ou révise */
const seedOf = (k, n) => [...String(k)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 233280, 17 + n * 7919) || 1;
const rngOf = seed => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
function prep(st, key, attempt, si){
  const c = Object.assign({}, st, { key, si, seed: seedOf(key, attempt) }), rnd = rngOf(c.seed);
  if ((st.type === 'qcm' || st.type === 'book') && st.choices){ const perm = shuffle(st.choices.map((_, i) => i), c.seed); c.choices = perm.map(i => st.choices[i]); c.answer = perm.indexOf(st.answer); }
  if (st.type === 'swipe') c.cards = shuffle(st.cards, c.seed);
  if (attempt > 0){
    const g = window.NT_VARIANTS && window.NT_VARIANTS[key];
    if (st.type === 'calc' && g) Object.assign(c, g(list => list[Math.floor(rnd() * list.length)]), { varied: true });
    if (st.type === 'candles' && window.NT_CANDLES){ const alts = []; for (let k = 1; k <= 20; k++) if (k !== st.gen.seed && NT_CANDLES.valid(Object.assign({}, st.gen, { seed: k }), st.show || {})) alts.push(k);
      if (alts.length){ c.gen = Object.assign({}, st.gen, { seed: alts[Math.floor(rnd() * alts.length)] }); c.varied = true; } }
    if (st.type === 'ticket'){ const q0 = st.goal.qty, re = new RegExp('(^|\\D)' + q0 + '(?=\\D)', 'g');
      if ((st.q.match(re) || []).length === 1){ let n = q0; while (n === q0) n = 2 + Math.floor(rnd() * 9); c.q = st.q.replace(re, (_, a) => a + n); c.goal = Object.assign({}, st.goal, { qty: n }); c.varied = true; } }
  }
  return c;
}
/* contexte d'une étape révisée seule (ex. « PER ? » a besoin des chiffres de l'étape d'avant) */
function ctxOf(m, si){ for (let k = si - 1; k >= 0; k--){ const p = m.steps[k], t = p.type === 'brief' ? p.text : p.q; if (t && t.length > 55) return t; } return ''; }
const findMission = id => String(id).startsWith('sess-') ? (themeById(id.slice(5)) ? sessMission(themeById(id.slice(5))) : null) : id === 'daily' ? dailyMission() : (MS.find(x => x.id === id) || STORY.find(x => x.id === id) || POOL.find(x => x.id === id));
function startMission(id, mode = 'full'){
  if (id === 'review') return startReview();
  if (String(id).startsWith('sess-')) return startSession(id.slice(5));
  const m = findMission(id);
  if (!m) return;
  if (!m.steps){ toast('Cette mission est en préparation.'); return; }
  if (m.ch && !chUnlocked(m.ch)){ toast('Termine au moins la moitié du chapitre précédent pour débloquer celui-ci.'); return; }
  if (m.ch && chPremium(m.ch)){ openPaywall(`Le chapitre « ${CH.find(c => c.id === m.ch).title} » fait partie de Premium`); return; }
  if (STORY.includes(m) && !S.story[m.id] && (m !== storyNext() || !storyReady())){ toast('Le prochain épisode arrive demain.'); return; }
  const all = m.steps.map((_, i) => i), refs = mode === 'eclair' ? all.filter(i => gradable(m.steps[i])).slice(0, 3) : all;
  const att = S.plays[m.id] || 0; S.plays[m.id] = att + 1; save();
  M = { m, mode, att, steps: refs.map(i => prep(m.steps[i], m.id + '#' + i, att, i)), i: 0, ok: [], second: [], fb: null, ui: {}, ko: 0, fast: 0, combo: 0, t0: Date.now(), unl0: unlockedNow() };
  if (mode === 'full' && m.ch && !(S.seenVid || {})[m.id]) return vidStart();
  renderPlayer();
}
function startReview(){
  const items = dueReviews().slice(0, 5).map(r => ({ r, m: findMission(r.mid) })).filter(x => x.m && x.m.steps && x.m.steps[x.r.si]);
  if (!items.length){ toast('Rien à revoir pour le moment.'); return; }
  items.forEach(x => { x.r.n = (x.r.n || 0) + 1; }); save();
  M = { m: { id: 'review', title: 'Révision express', goal: 'Revoir les notions ratées au bon moment pour ne pas les oublier.', score: 0, cash: 0 }, mode: 'review',
    steps: items.map(x => { const c = prep(x.m.steps[x.r.si], x.r.mid + '#' + x.r.si, x.r.n, x.r.si); if (!c.varied) c.ctx = ctxOf(x.m, x.r.si); return c; }),
    revs: items.map(x => x.r), i: 0, ok: [], second: [], fb: null, ui: {}, ko: 0, fast: 0, combo: 0, t0: Date.now() };
  renderPlayer();
}
function closePlayer(){ M = null; const p = $('#player'); if (p) p.remove(); document.body.style.overflow = ''; render(); }
function renderPlayer(){
  let p = $('#player');
  if (!p){ p = document.createElement('div'); p.id = 'player'; p.className = 'player'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); document.body.appendChild(p); document.body.style.overflow = 'hidden'; }
  if (M.vid) return renderVid();
  p.setAttribute('aria-label', M.m.title);
  if (M.end){ let dh = M.end.exam ? examDebrief() : M.end.unblock ? unblockDebrief() : debriefHTML();
    const ns = (M.newStuck || []).filter(k => S.stuck && S.stuck[k] && S.stuck[k].state === 'bloque');
    if (ns.length && !M.end.exam && !M.end.unblock) dh = dh.replace('<button class="btn v full"', `<div class="card stuck-card" style="width:100%;text-align:left"><span class="eyebrow">${I.bolt} Mode déblocage</span><b>Une notion te résiste, on la reprend autrement</b><p class="small">« ${h(qText(ns[0]).slice(0, 100))} »</p><button class="btn v sm" style="margin-top:10px" data-ubnow="${h(ns[0])}">Débloquer maintenant</button></div><button class="btn v full"`);
    p.innerHTML = `<div class="in">${dh}</div>`; return; }
  const st = M.steps[M.i], prog = (M.i / M.steps.length) * 100;
  p.innerHTML = `<div class="in">
    <div class="p-top"><button class="ibtn" data-quit aria-label="Quitter la mission">${I.x}</button><div class="bar"><i style="width:${prog}%"></i></div>${M.mode === 'eclair' ? `<span class="chip v">${I.bolt}Éclair</span>` : ''}${M.mode === 'exam' ? `<span class="chip v tn" aria-label="Temps restant">${I.clock}<span id="exTimer">${Math.floor(Math.max(0, M.deadline - Date.now()) / 60000)}:${String(Math.floor(Math.max(0, M.deadline - Date.now()) / 1000) % 60).padStart(2, '0')}</span></span>` : ''}${M.combo >= 2 ? `<span class="combo${M.fb && M.fb.ok ? ' bump' : ''}" aria-label="${M.combo} bonnes réponses d’affilée">${I.flame}${M.combo}</span>` : ''}${askQBtn()}</div>
    <div class="p-body${M.fb && !M.fb.ok ? ' shake' : ''}"><div class="p-kicker"><span class="chip">${M.mode === 'exam' ? `${h(M.m.title)} · ${M.i + 1}/${M.steps.length}` : h(M.m.title)}</span>${st.retry ? '<span class="chip v">Deuxième chance</span>' : ''}${st.varied ? '<span class="chip">Nouveaux chiffres</span>' : ''}</div>${st.ctx ? `<div class="ctx"><span class="eyebrow">Rappel du contexte</span><p>${h(st.ctx)}</p></div>` : ''}${stepHTML(st)}</div>
    <div class="p-foot">${M.fb ? fbHTML() : ''}
      ${footBtn(st)}</div></div>`;
  const f = p.querySelector('.field'); if (f && !M.fb) f.focus();
  if (st.type === 'match') requestAnimationFrame(drawLines);
}
/* explication courte d'abord ; « En savoir plus » pour la suite */
function fbHTML(){
  const fb = M.fb, txt = fb.text || '', cut = txt.length > 110 ? txt.search(/[.!?:]\s/) : -1, short = cut > 20 && cut < txt.length - 10 && !M.ui.more;
  return `<div class="fb ${fb.ok ? 'ok' : 'ko'}" role="status"><b>${fb.ok ? I.check + (fb.title || 'Bien joué !') : I.x + (fb.title || 'Pas tout à fait')}</b>
    ${fb.mine ? `<p class="mine">Ta réponse : « ${h(fb.mine)} »</p>` : ''}
    <p>${h(short ? txt.slice(0, cut + 1) : txt)}${short ? ` <button class="more" data-more>En savoir plus</button>` : ''}</p>
    ${fb.extra ? `<p class="extra">${h(fb.extra)}</p>` : ''}
    ${!fb.ok && M.mode !== 'exam' && reviewable(M.steps[M.i]) ? `<div id="aiExp" class="ai-exp"><button class="btn ghost sm" data-explain>${I.chat}Explique-moi autrement</button></div>` : ''}<span class="coach">${I.chat}Nova Coach${aiOn() ? ' · IA' : ''}</span></div>`
}
function footBtn(st){
  if (st.type === 'lesson') return lessonFoot(st);
  if (M.fb) return `<button class="btn v full" data-next>Continuer</button>`;
  if (st.type === 'apply') return `<button class="btn v full" data-applygo>${I.chart}Aller dans ${st.goal.ev === 'sell' ? 'Portefeuille' : 'Marchés'}</button>`;
  if (st.type === 'unblock') return `<button class="btn v full" data-next>J’ai compris, on essaie</button>`;
  if (st.type === 'brief') return `<button class="btn v full" data-next>${st.help ? 'Compris' : 'C’est parti'}</button>`;
  if (st.type === 'role') return M.ui.end ? `<button class="btn v full" data-rolefin>Continuer</button>` : '';
  if (st.type === 'swipe') return '';
  if (st.type === 'decision') return `<button class="btn v full" data-check${M.ui.sel == null ? ' disabled' : ''}>Lancer la simulation</button>`;
  const ready = st.type === 'qcm' || st.type === 'book' || st.type === 'chart' || st.type === 'candles' ? M.ui.sel != null
    : st.type === 'vf' ? M.ui.sel != null : st.type === 'order' ? (M.ui.seq || []).length === st.items.length
    : st.type === 'calc' ? (M.ui.val ?? '') !== '' : st.type === 'match' ? Object.keys(M.ui.pairs || {}).length === st.pairs.length : true;
  return `<button class="btn v full" data-check${ready ? '' : ' disabled'}>${st.type === 'ticket' ? 'Passer l’ordre' : 'Valider'}</button>`;
}
function stepHTML(st){
  const u = M.ui;
  switch (st.type){
  case 'match': { u.pairs = u.pairs || {}; const order = shuffle(st.pairs.map((_, i) => i), st.seed || st.pairs.length * 7 + 3); const used = Object.values(u.pairs);
    const badge = n => `<span class="mb" style="background:${PC[n % PC.length]}">${n + 1}</span>`;
    return `<span class="eyebrow">Relie</span><p class="p-q">${h(st.q)}</p><p class="small">Touche un mot à gauche, puis sa réponse à droite.</p>
      <div class="match"><svg class="mlines" aria-hidden="true"></svg><div class="mcol">${st.pairs.map((p, i) => `<button class="opt ${M.fb ? (u.pairs[i] === i ? 'ok' : 'ko') : ''}${u.pairs[i] != null ? ' paired' : ''}" style="${u.pairs[i] != null ? `--pc:${PC[i % PC.length]}` : ''}" data-ml="${i}" aria-pressed="${u.left === i}"${M.fb ? ' disabled' : ''}>${u.pairs[i] != null ? badge(i) : ''}${h(p[0])}</button>`).join('')}</div>
      <div class="mcol">${order.map(j => { const li = Object.keys(u.pairs).find(k => u.pairs[k] === j); return `<button class="opt ${M.fb ? (li != null && Number(li) === j ? 'ok' : 'ko') : ''}${li != null ? ' paired' : ''}" style="${li != null ? `--pc:${PC[Number(li) % PC.length]}` : ''}" data-mr="${j}"${M.fb ? ' disabled' : ''}>${li != null ? badge(Number(li)) : ''}${h(st.pairs[j][1])}</button>`; }).join('')}</div></div>`; }
  case 'brief': return `<span class="eyebrow">${I.book} ${st.help ? 'Coup de pouce' : 'Le brief'}</span><p class="p-q">${h(st.title)}</p><p class="p-text">${h(st.text)}</p>
    <div class="card" style="margin-top:6px"><span class="small"><b style="color:#fff">Objectif :</b> ${h(M.m.goal)}</span></div>`;
  case 'lesson': return lessonHTML(st);
  case 'unblock': return unblockHTML(st);
  case 'apply': return applyStepHTML(st);
  case 'decision': return decisionHTML(st);
  case 'candles': { const g = CK.gen(st.gen), sh = st.show || {};
    const levels = (sh.levels || []).map(L => ({ y: CK.levelPrice(g.meta, L), label: L.label, color: L.color }));
    return `<span class="eyebrow">${I.candle} Graphique · données simulées</span><p class="p-q">${h(st.q)}</p>
      <div class="cwrap" aria-hidden="true">${CK.svg(g.cs, { ma: sh.ma, vol: sh.vol, rsi: sh.rsi, levels, marks: sh.marks })}</div>
      <p class="sr">${h(CK.describe(g.cs, { ma: sh.ma, vol: sh.vol, rsi: sh.rsi, levels }))}${(sh.marks || []).length ? ' La bougie A est la dernière.' : ''}</p>
      ${sh.ma ? `<p class="small">${sh.ma.map((n, k) => `<span style="color:${['#8fb4ff', '#66d0ff'][k]}">━</span> moyenne ${n} séances`).join(' · ')}</p>` : ''}
      <div class="opts">${st.choices.map((c, i) => `<button class="opt ${M.fb ? (i === st.answer ? 'ok' : i === u.sel ? 'ko' : '') : ''}" data-sel="${i}" aria-pressed="${u.sel === i}"${M.fb ? ' disabled' : ''}>${h(c)}</button>`).join('')}</div>`; }
  case 'qcm': return `<p class="p-q">${h(st.q)}</p><div class="opts">${st.choices.map((c, i) => `<button class="opt ${M.fb ? (i === st.answer ? 'ok' : i === u.sel ? 'ko' : '') : ''}" data-sel="${i}" aria-pressed="${u.sel === i}"${M.fb ? ' disabled' : ''}>${h(c)}</button>`).join('')}</div>`;
  case 'vf': return `<span class="eyebrow">Vrai ou faux ?</span><p class="p-q">${h(st.q)}</p><div class="vf">${[[true,'Vrai'],[false,'Faux']].map(([v, t]) =>
    `<button class="opt ${M.fb ? (v === st.answer ? 'ok' : v === u.sel ? 'ko' : '') : ''}" data-selb="${v}" aria-pressed="${u.sel === v}"${M.fb ? ' disabled' : ''}>${t}</button>`).join('')}</div>`;
  case 'calc': return `<span class="eyebrow">Calcul express</span><p class="p-q">${h(st.q)}</p><div class="unit"><label class="sr" for="calcIn">Ta réponse</label><input id="calcIn" class="field tn" inputmode="decimal" value="${h(u.val ?? '')}" data-calc${M.fb ? ' disabled' : ''}><span>${h(st.unit)}</span></div>`;
  case 'swipe': {
    u.k = u.k || 0; u.res = u.res || [];
    if (u.k >= st.cards.length) return `<p class="p-q">${h(st.q)}</p><div class="card"><b>${u.res.filter(Boolean).length} / ${st.cards.length} bonnes réponses</b></div>`;
    const c = st.cards[u.k], last = u.last;
    return `<span class="eyebrow">Swipe · ${u.k + 1}/${st.cards.length}</span><p class="p-q">${h(st.q)}</p>
      <div class="deck">${st.cards[u.k + 1] ? `<div class="sw back" aria-hidden="true">${h(st.cards[u.k + 1].t)}</div>` : ''}<div class="sw" id="swCard">${h(c.t)}</div></div>
      <div class="sw-mini" role="status">${last ? `<b style="color:${last.ok ? 'var(--green)' : 'var(--red)'}">${last.ok ? 'Oui !' : 'Non.'}</b> ${h(last.explain)}` : 'Glisse la carte ou utilise les boutons.'}</div>
      <div class="sw-lbl"><button data-swipe="left">← ${h(st.left)}</button><button data-swipe="right">${h(st.right)} →</button></div>`; }
  case 'order': {
    u.seq = u.seq || []; const pool = shuffle(st.items, st.seed || st.items.length * 13).filter(x => !u.seq.includes(x));
    return `<span class="eyebrow">Remets dans l’ordre</span><p class="p-q">${h(st.q)}</p>
      <div class="seq" aria-label="Ton ordre">${u.seq.length ? u.seq.map((x, i) => `<button class="opt ${M.fb ? (st.items[i] === x ? 'ok' : 'ko') : ''}" data-unseq="${i}"${M.fb ? ' disabled' : ''}><i>${i + 1}</i>${h(x)}</button>`).join('') : '<span class="small">Touche les étapes dans l’ordre.</span>'}</div>
      <div class="pool">${pool.map(x => `<button class="opt" data-seq="${h(x)}">${h(x)}</button>`).join('')}</div>`; }
  case 'slider': { u.y = u.y ?? 5; const val = sliderVal(st, u.y);
    const bars = Array.from({ length: st.max }, (_, i) => sliderVal(st, i + 1));
    const mx = bars[bars.length - 1];
    return `<span class="eyebrow">Simulateur</span><p class="p-q">${h(st.q)}</p>
      <div class="card"><div class="sl-out"><div><span class="small">Après ${u.y} an${u.y > 1 ? 's' : ''}</span><b class="tn" style="display:block">${eur0(val)}</b></div><span class="chip ${val >= st.target ? 'g' : ''}">Objectif ${eur0(st.target)}</span></div>
      <div class="bars" style="margin-top:12px" aria-hidden="true">${bars.map((b, i) => `<i class="${i + 1 <= u.y ? (b >= st.target ? 'tg' : '') : ''}" style="height:${(b / mx * 100).toFixed(0)}%;opacity:${i + 1 <= u.y ? 1 : .25}"></i>`).join('')}</div>
      <label class="sr" for="slIn">Nombre d’années</label><input id="slIn" type="range" min="${st.min}" max="${st.max}" value="${u.y}" data-slider${M.fb ? ' disabled' : ''}></div>
      <p class="small">Taux d’exemple, constant. Dans la réalité, les rendements varient chaque année et ne sont jamais garantis.</p>`; }
  case 'ticket': return `<span class="eyebrow">Simulateur d’ordres</span><p class="p-q">${h(st.q)}</p><div class="ticket">${ticketHTML(Object.assign({ price: st.price, side:'buy', type:'market', qty: 1, limit: st.price, guide:true }, u.tk || {}))}</div>`;
  case 'book': return `<span class="eyebrow">Carnet d’ordres · Exemplia (fictive)</span><p class="p-q">${h(st.q)}</p>
    <div class="book"><table class="b"><thead><tr><th>Achat</th><th>Qté</th></tr></thead><tbody>${st.bids.map((b, i) => `<tr class="${i === 0 ? 'best' : ''}"><td class="tn">${num(b[0], 2)}</td><td class="tn">${b[1]}</td></tr>`).join('')}</tbody></table>
    <table class="a"><thead><tr><th>Vente</th><th>Qté</th></tr></thead><tbody>${st.asks.map((a, i) => `<tr class="${i === 0 ? 'best' : ''}"><td class="tn">${num(a[0], 2)}</td><td class="tn">${a[1]}</td></tr>`).join('')}</tbody></table></div>
    <div class="opts">${st.choices.map((c, i) => `<button class="opt ${M.fb ? (i === st.answer ? 'ok' : i === u.sel ? 'ko' : '') : ''}" data-sel="${i}" aria-pressed="${u.sel === i}"${M.fb ? ' disabled' : ''}>${h(c)}</button>`).join('')}</div>`;
  case 'chart': { const w = 320, hh = 150, mn = Math.min(...st.series), mx = Math.max(...st.series);
    const X = i => (i / (st.series.length - 1)) * (w - 20) + 10, Y = v => 12 + (1 - (v - mn) / (mx - mn)) * (hh - 30);
    const pts = st.series.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    return `<span class="eyebrow">Le graphique mystère</span><p class="p-q">${h(st.q)}</p>
      <svg class="chart" viewBox="0 0 ${w} ${hh}" role="img" aria-label="Graphique simplifié avec trois points A, B et C"><polyline points="${pts}" fill="none" stroke="#a68cff" stroke-width="2.5" stroke-linejoin="round"/>
      ${st.marks.map(mk => `<g><circle cx="${X(mk.i)}" cy="${Y(st.series[mk.i])}" r="11" fill="#fff"/><text x="${X(mk.i)}" y="${Y(st.series[mk.i]) + 4.5}" text-anchor="middle" font-size="13" font-weight="800" fill="#0b0912">${mk.label}</text></g>`).join('')}
      <text x="10" y="${hh - 6}" font-size="10" fill="#8d87b0">2019</text><text x="${w - 10}" y="${hh - 6}" font-size="10" fill="#8d87b0" text-anchor="end">2021</text></svg>
      <div class="marks">${st.marks.map(mk => `<button class="opt ${M.fb ? (mk.label === st.answer ? 'ok' : mk.label === u.sel ? 'ko' : '') : ''}" data-selc="${mk.label}" aria-pressed="${u.sel === mk.label}" style="text-align:center;font-weight:800"${M.fb ? ' disabled' : ''}>${mk.label}</button>`).join('')}</div>`; }
  case 'role': { u.node = u.node || 'start'; u.log = u.log || []; const n = st.nodes[u.node];
    return `<span class="eyebrow">Jeu de rôle · ${h(st.title)}</span>
      <div class="chat">${u.log.map(x => `<div class="bub ${x.me ? 'me' : 'them'}"><small>${x.me ? 'Toi' : h(x.who)}</small>${h(x.t)}${x.fb ? `<span style="display:block;margin-top:6px;font-size:13px;opacity:.9">${x.good ? '✓' : '✗'} ${h(x.fb)}</span>` : ''}</div>`).join('')}
      <div class="bub them"><small>${h(st.persona)}</small>${h(n.say)}</div></div>
      ${n.end ? '' : `<div class="opts">${n.options.map((o, i) => `<button class="opt" data-role="${i}">${h(o.t)}</button>`).join('')}</div>`}`; }
  }
  return '';
}
const PC = ['#8f74ff', '#3fd39a', '#8fb4ff', '#5b8cff', '#ff7aa8', '#66d0ff'];
/* trait entre les deux éléments reliés */
function drawLines(){
  const box = document.querySelector('#player .match'), svg = box && box.querySelector('.mlines'); if (!svg || !M) return;
  const R = box.getBoundingClientRect(); let out = '';
  for (const [i, j] of Object.entries(M.ui.pairs || {})){
    const a = box.querySelector(`[data-ml="${i}"]`), b = box.querySelector(`[data-mr="${j}"]`); if (!a || !b) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const x1 = ra.right - R.left - 2, y1 = ra.top + ra.height / 2 - R.top, x2 = rb.left - R.left + 2, y2 = rb.top + rb.height / 2 - R.top, mx = (x1 + x2) / 2;
    out += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="${PC[i % PC.length]}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="${x1}" cy="${y1}" r="4" fill="${PC[i % PC.length]}"/><circle cx="${x2}" cy="${y2}" r="4" fill="${PC[i % PC.length]}"/>`;
  }
  svg.setAttribute('viewBox', `0 0 ${R.width} ${R.height}`); svg.innerHTML = out;
}
window.addEventListener('resize', () => { if (M) drawLines(); });
function ticketHTML(t){
  const amount = t.qty * (t.type === 'limit' ? t.limit : t.price);
  const sp = Math.max(0.01, Math.round(t.price * 0.0006 * 100) / 100);
  return `<div class="tk-head"><div><b>${h(t.name || 'Exemplia')}</b><span class="tk-sub">${h(t.sub || 'Fictive · Euronext (simulé)')}</span></div><span class="tn tk-px">${money(t, t.price)}</span></div>
    <div class="tk-ba"><div><span>Achat (vendeurs)</span><b class="tn">${num(t.price + sp, t.price < 10 ? 4 : 2)}</b></div><div><span>Vente (acheteurs)</span><b class="tn">${num(t.price - sp, t.price < 10 ? 4 : 2)}</b></div></div>
    <div class="seg buy" role="group" aria-label="Sens"><button data-tk="side" data-v="buy" aria-pressed="${t.side === 'buy'}">Acheter</button><button data-tk="side" data-v="sell" aria-pressed="${t.side === 'sell'}">Vendre</button></div>
    <div class="seg" role="group" aria-label="Type d’ordre"><button data-tk="type" data-v="market" aria-pressed="${t.type === 'market'}">Au marché</button><button data-tk="type" data-v="limit" aria-pressed="${t.type === 'limit'}">Cours limité</button></div>
    <div class="tk-f"><label for="tkQty">Quantité</label><input id="tkQty" class="tn" type="number" min="${t.qty % 1 ? 0.0001 : 1}" step="${t.qty % 1 || t.frac ? 'any' : 1}" value="${t.qty}" data-tkin="qty"></div>
    ${t.type === 'limit' ? `<div class="tk-f"><label for="tkLim">Prix limite (${t.cur === 'USD' ? '$' : '€'})</label><input id="tkLim" class="tn" inputmode="decimal" value="${num(t.limit, t.limit < 10 ? 4 : 2)}" data-tkin="limit"></div>` : ''}
    ${t.type === 'limit' ? '<div class="tk-f"><label>Validité</label><span class="tk-val">Jour</span></div>' : ''}
    <div class="tk-sum"><span class="muted">Montant estimé</span><b class="tn">${money(t, amount)}</b></div>${t.cur === 'USD' ? `<p class="small">≈ ${eur(amount / EURUSD)}</p>` : ''}
    <p class="tk-recap">${tkRecap(t)}</p>
    ${t.guide ? `<div class="guide">${t.type === 'market' ? 'Nova Coach : au marché, l’ordre s’exécute tout de suite au meilleur prix disponible, sans garantie de prix.' : 'Nova Coach : à cours limité, tu fixes ton prix maximum à l’achat (minimum à la vente). L’ordre attend s’il n’y a pas preneur.'}</div>` : ''}`;
}
const tkRecap = t => `Tu vas <b>${t.side === 'buy' ? 'acheter' : 'vendre'} ${t.qty}</b> titre${t.qty > 1 ? 's' : ''} ${t.type === 'market' ? '<b>au marché</b>' : `<b>à ${money(t, t.limit)}</b> ${t.side === 'buy' ? 'maximum' : 'minimum'}`}.`;
const tkState = () => M && !M.away ? (M.ui.tk = M.ui.tk || { side:'buy', type:'market', qty:1, limit: M.steps[M.i].price }) : (window.__tk = window.__tk || (s => ({ side:'buy', type:'market', qty: s.frac ? 0.01 : 1, limit: px(s) }))(mkFind(S.arg) || MK[0]));

function check(){
  const st = M.steps[M.i], u = M.ui; let ok = false, title = null;
  if (st.type === 'decision'){ ok = !!st.options[u.sel].fit; title = ok ? `Bon choix pour ${st.persona === 'Toi' ? 'toi' : st.persona}` : `Pas le plus adapté pour ${st.persona === 'Toi' ? 'toi' : st.persona}`; M.dec = st.options[u.sel]; }
  else if (st.type === 'qcm' || st.type === 'book' || st.type === 'candles') ok = u.sel === st.answer;
  else if (st.type === 'vf') ok = u.sel === st.answer;
  else if (st.type === 'chart') ok = u.sel === st.answer;
  else if (st.type === 'calc'){ const v = parseFloat(String(u.val).replace(/\s/g, '').replace(',', '.')); ok = !isNaN(v) && Math.abs(v - st.answer) <= st.tol; }
  else if (st.type === 'order') ok = u.seq.every((x, i) => x === st.items[i]);
  else if (st.type === 'match') ok = st.pairs.every((_, i) => u.pairs[i] === i);
  else if (st.type === 'slider'){ let need = 0; while (sliderVal(st, need) < st.target && need < 200) need++; ok = u.y === need || u.y === need + 1; title = ok ? 'Exactement !' : (u.y < need ? 'Pas encore doublé' : 'Tu peux trouver plus tôt'); }
  else if (st.type === 'ticket'){ const t = tkState(), g = st.goal;
    ok = t.side === g.side && t.type === g.type && Number(t.qty) === g.qty && (g.type !== 'limit' || (g.side === 'buy' ? (t.limit > 0 && t.limit <= g.maxPrice + 1e-9) : (t.limit >= g.minPrice - 1e-9)));
    title = ok ? (g.type === 'market' ? 'Ordre exécuté' : 'Ordre placé dans le carnet') : 'Ordre refusé par la mission'; }
  track(st, ok, M.mode === 'review' ? (M.revs[M.i] || {}).mid : (st.key || '').split('#')[0] || M.m.id);
  if (M.mode === 'exam'){ M.ok.push(ok); if (!ok) M.wrong.push({ q: st.q, explain: st.explain, fiche: (ficheFor((st.key || '').split('#')[0]) || {}).id }); sfx(ok ? 'ok' : 'ko'); return next(); }
  if (st.retry) M.second.push(ok); else M.ok.push(ok);
  let newStuck = false;
  if (M.mode !== 'unblock' && M.mode !== 'exam' && reviewable(st)){ const sk = M.mode === 'review' ? (M.revs[M.i] ? M.revs[M.i].mid + '#' + M.revs[M.i].si : null) : st.key; if (sk && trackStuck(sk, ok)){ newStuck = true; (M.newStuck = M.newStuck || []).push(sk); } }
  if (M.mode === 'review'){ const r = M.revs[M.i];
    if (ok){ r.lvl = (r.lvl || 0) + 1; if (r.lvl > 3) S.reviews = S.reviews.filter(x => x !== r); else r.due = addDays(today(), [1, 3, 7, 21][r.lvl]); }
    else { r.lvl = 0; r.due = addDays(today(), 1); }
    save();
  } else if (M.mode !== 'unblock' && !ok && reviewable(st) && !st.retry && st.si != null){ const si = st.si; if (!S.reviews.some(x => x.mid === M.m.id && x.si === si)){ S.reviews.push({ mid: M.m.id, si, due: addDays(today(), 1), lvl: 0 }); save(); } }
  const fb = { ok, title, text: ok ? st.explain : (st.type === 'ticket' ? hintTicket(st.goal) + ' ' : '') + st.explain };
  if (st.type === 'decision'){ const good = st.options.find(o => o.fit); if (!ok) fb.text = `Le plus adapté était « ${good.name} ». ` + st.explain; if (M.m.session && !(S.sessDone || {})[M.m.theme.id]) fb.extra = `Ton choix (« ${M.dec.name} ») entre dans ton portefeuille fictif avec 1 000 € fictifs : regarde-le bouger demain.`; }
  if (!ok && (st.type === 'qcm' || st.type === 'book' || st.type === 'candles') && st.choices[u.sel] != null) fb.mine = st.choices[u.sel];
  adapt(st, ok, fb);
  if (newStuck) fb.extra = 'Cette notion te résiste : on la reprendra autrement, en mode déblocage, à la fin de la mission.';
  M.fb = fb; sfx(ok ? 'ok' : 'ko');
  renderPlayer();
}
/* Le parcours s'adapte PENDANT la mission */
function adapt(st, ok, fb){
  const quick = Date.now() - (M.t0 || Date.now()) < 9000;
  M.combo = ok ? M.combo + 1 : 0;
  if (ok && M.combo >= 3 && !fb.title) fb.title = `${M.combo} d’affilée !`;
  if (M.mode !== 'full') return;
  if (!ok){
    M.ko++; M.fast = 0;
    if (!st.retry && reviewable(st) && st.key){                                  // la même notion revient, autrement
      const [mid, si] = st.key.split('#'), src = findMission(mid).steps[Number(si)];
      const again = Object.assign(prep(src, st.key, M.att + 5, Number(si)), { retry: true });
      if (M.ko >= 2){                                                             // 2 erreurs d'affilée : coup de pouce tout de suite
        M.steps.splice(M.i + 1, 0, { type: 'brief', title: 'Coup de pouce', text: `On reprend calmement. À retenir : ${st.explain}`, help: true }, again);
        fb.extra = 'Pas de panique : un coup de pouce arrive, puis une deuxième chance.'; M.ko = 0;
      } else {
        M.steps.splice(Math.min(M.i + 3, M.steps.length), 0, again);
        fb.extra = 'Cette notion reviendra un peu plus loin, posée autrement.';
      }
    }
  } else {
    M.ko = 0; M.fast = quick ? M.fast + 1 : 0;
    const rest = M.steps.slice(M.i + 1), last = M.steps[M.steps.length - 1];
    if (M.fast >= 2 && !M.skipped && !M.ok.includes(false) && rest.length >= 1 && last && last.type === 'vf' && !last.retry){
      M.steps.pop(); M.skipped = true; fb.extra = 'Tu vas vite et sans faute : une question facile en moins.';
    }
  }
}
const hintTicket = g => `Il fallait : ${g.side === 'buy' ? 'acheter' : 'vendre'} ${g.qty} titres, ordre ${g.type === 'market' ? 'au marché' : `à cours limité, prix limite ${g.side === 'buy' ? '≤ ' + num(g.maxPrice, 2) : '≥ ' + num(g.minPrice, 2)} €`}.`;
function next(){
  M.i++; M.fb = null; M.ui = {}; M.t0 = Date.now();
  const pl = document.getElementById('player'); if (pl) pl.scrollTo(0, 0);
  if (M.i >= M.steps.length) finish(); else renderPlayer();
}
function finish(){
  if (M.mode === 'exam') return finishExam();
  if (M.mode === 'unblock') return finishUnblock();
  const m = M.m, n = M.ok.length, good = M.ok.filter(Boolean).length, ratio = n ? good / n : 1, td = today();
  if (M.mode === 'review'){ M.end = { review: true, good, n }; renderPlayer(); return; }
  if (M.mode === 'eclair' && good < n){ M.end = { eclairFail: true, good, n }; renderPlayer(); return; }
  const isDaily = POOL.includes(m), isStory = STORY.includes(m), isSess = !!m.session; S.mainDay = td;
  const first = isSess ? !(S.sessDone || {})[m.theme.id] : isDaily ? S.dailyDone !== td : isStory ? !S.story[m.id] : !S.done[m.id];
  const pts = first ? Math.round(m.score * (M.mode === 'eclair' ? 1 : (0.5 + 0.5 * ratio))) - (S.skip[m.id] ? Math.round(m.score * 0.8) : 0) : 0;
  const cash = first ? Math.round(m.cash * (0.5 + 0.5 * ratio)) : 0;
  let relDone = null;
  if (isSess){ S.sessDone = S.sessDone || {}; S.sessDone[m.theme.id] = td; S.sessDay = td;
    if (first && M.dec) addDecisionToPortfolio(M.dec, m.theme.title);
    if (!S.onb) S.firstDone = true;
    const rel = MS.find(x => x.id === m.theme.rel); if (rel && !isDone(rel.id) && !M.ok.includes(false)){ S.done[rel.id] = 1; S.viaSess = S.viaSess || {}; S.viaSess[rel.id] = 1; relDone = rel; } }
  else if (isDaily) S.dailyDone = td; else if (isStory) S.story[m.id] = td; else { S.done[m.id] = 1; if (M.mode === 'eclair') S.eclair[m.id] = 1; }
  const before = S.score; S.score = Math.min(1000, S.score + Math.max(0, pts) + (relDone ? Math.round(relDone.score * 0.8) : 0)); S.cash += cash;
  if (cash) S.history.push(`${td.split('-').reverse().join('/')} · « ${m.title} » : +${eur0(cash)} fictifs`);
  if (S.lastDay !== td){ const diff = S.lastDay ? Math.round((Date.parse(td) - Date.parse(S.lastDay)) / 864e5) : 99; S.streak = diff <= 2 ? S.streak + 1 : 1; S.lastDay = td; }  // 1 jour de pause autorisé
  const beforeCount = todayCount(); S.dayCount[td] = beforeCount + 1;
  save(); M.end = { good, n, pts: S.score - before, cash, first, goalNow: beforeCount < DAILY_GOAL && beforeCount + 1 >= DAILY_GOAL, second: M.second.filter(Boolean).length, secondN: M.second.length, skipped: !!M.skipped, before, newCh: M.unl0 ? unlockedNow().filter(c => !M.unl0.includes(c)) : [], relDone, rule: isSess ? sessionRule(M.steps) : null };
  renderPlayer(); sfx('win');
  requestAnimationFrame(() => setTimeout(() => { const b = document.querySelector('#player .xpbar i'); if (b) b.style.width = b.dataset.to + '%'; }, 120));
  requestAnimationFrame(() => { const a = document.querySelector('#player .arc'); if (a){ a.style.strokeDasharray = `${(before / 10).toFixed(1)} 100`; requestAnimationFrame(() => setTimeout(() => { a.style.strokeDasharray = `${(S.score / 10).toFixed(1)} 100`; }, 60)); } });
}
function xpBar(e){ const { r, nx } = rankOf(S.score), lo = r.min, hi = nx ? nx.min : 1000, pb = Math.max(0, Math.min(100, (e.before - lo) / (hi - lo) * 100)), pa = Math.max(0, Math.min(100, (S.score - lo) / (hi - lo) * 100));
  return `<div class="xp" style="width:100%"><div class="row" style="justify-content:space-between"><b>${h(r.name)}</b><span class="small tn">${S.score} / ${hi} · ${nx ? 'prochain : ' + h(nx.name) : 'rang maximum'}</span></div>
    <div class="xpbar"><i style="width:${pb.toFixed(1)}%" data-to="${pa.toFixed(1)}"></i></div>${e.before < (nx ? lo : 1001) && e.before < lo ? `<p class="small" style="margin-top:6px;color:var(--amber)">Nouveau rang : ${h(r.name)} !</p>` : ''}</div>`; }
function debriefHTML(){
  const e = M.end, m = M.m;
  if (e.review) return `<div class="debrief"><div class="burst"><div>${I.book}</div></div><span class="eyebrow">Révision express</span><h1 style="font-size:26px">${e.good} / ${e.n} retenues</h1>
    <p class="muted" style="max-width:36ch">Les notions réussies reviendront plus tard (3, 7 puis 21 jours). Les autres reviennent demain.</p>
    <button class="btn v full" data-quit>Retour aux missions</button></div>`;
  if (e.eclairFail) return `<div class="debrief"><div class="burst"><div>${I.bolt}</div></div><h1 style="font-size:26px">Presque !</h1>
    <p class="muted" style="max-width:36ch">${e.good} / ${e.n} en mode éclair. Pour valider sans faire la mission, il faut un sans-faute. Fais la mission complète : elle t’explique tout pas à pas.</p>
    <button class="btn v full" data-replay="${m.id}">Faire la mission complète</button><button class="btn ghost full" data-quit>Plus tard</button></div>`;
  const nm = nextMission(), ep = storyNext();
  const tm = themeFor(1), dTom = POOL[(((dayIndex() + 1) % POOL.length) + POOL.length) % POOL.length];
  const teaser = m.teaser || (ep && STORY.includes(m) ? '' : `Demain : la séance « ${tm.title} », la mission du jour « ${dTom.title} », et ton portefeuille fictif aura bougé.`);
  if (!S.onb) return `<div class="debrief"><div class="burst">${Array.from({ length: 14 }, (_, k) => `<i class="cf" style="--a:${k * 360 / 14}deg;--c:${PC[k % PC.length]}"></i>`).join('')}<div>${I.check}</div></div>
    <span class="eyebrow">Ta première séance</span><h1 style="font-size:26px">Bravo, tu viens d’apprendre en jouant !</h1>
    <p class="muted" style="max-width:36ch">${h(m.goal)}</p>${xpBar(e)}
    <div class="card" style="width:100%;text-align:left"><b>${I.target} Maintenant, on adapte tout à toi</b><p class="small" style="margin-top:4px">5 questions rapides et un petit test de niveau (3 minutes) : ton entraînement sera fait sur mesure.</p></div>
    <button class="btn v full big" data-onbgo>Personnaliser mon entraînement</button></div>`;
  return `<div class="debrief"><div class="burst">${Array.from({ length: 14 }, (_, k) => `<i class="cf" style="--a:${k * 360 / 14}deg;--c:${PC[k % PC.length]}"></i>`).join('')}<div>${I.check}</div></div>
    <span class="eyebrow">Débrief Nova Review</span><h1 style="font-size:26px">${m.session ? 'Séance terminée !' : M.mode === 'eclair' ? 'Validée en éclair !' : STORY.includes(m) ? 'Épisode terminé' : 'Mission accomplie'}</h1>
    <p class="muted" style="max-width:38ch">${h(m.goal)}</p>
    <div class="gains"><div class="stat"><b class="tn">${e.good}/${e.n}</b><span>Réussites</span></div><div class="stat"><b class="tn">+${e.pts}</b><span>Expérience</span></div><div class="stat"><b class="tn">+${eur0(e.cash)}</b><span>Fictifs</span></div></div>
    ${xpBar(e)}
    ${e.rule ? `<div class="rule">${[['decouverte', 'Découverte'], ['decision', 'Décision'], ['retour', 'Retour'], ['progression', 'Progression']].map(([k, t]) => `<span class="${e.rule[k] ? 'ok' : ''}">${e.rule[k] ? I.check : I.x}${t}</span>`).join('')}</div>` : ''}
    ${e.relDone ? `<div class="card unlock-card small-u"><b>${I.check} Mission validée : « ${h(e.relDone.title)} »</b><p class="small" style="margin-top:4px">Tu as tout réussi : pas besoin de la refaire.</p></div>` : ''}
    ${(e.newCh || []).map(id => { const c = CH.find(x => x.id === id); return `<div class="card unlock-card"><span class="eyebrow">Nouveau</span><b class="uc-t">${I.star} Chapitre ${c.id} débloqué !</b><p class="small" style="margin-top:4px">« ${h(c.title)} » : ${h(c.sub)}${chPremium(c.id) ? ' (avec Premium)' : ''}</p></div>`; }).join('')}
    ${!e.first ? '<p class="small">Déjà réussie : les points ne comptent qu’une fois.</p>' : ''}
    ${e.secondN ? `<p class="small">Deuxième chance : ${e.second} / ${e.secondN} rattrapée${e.second > 1 ? 's' : ''}. ${e.second === e.secondN ? 'C’est comme ça qu’on apprend.' : ''}</p>` : ''}
    ${e.skipped ? '<p class="small">Tu es allé vite et sans faute : des étapes faciles ont été sautées.</p>' : ''}
    ${e.goalNow ? `<div class="card" style="width:100%;text-align:left;border-color:rgba(63,211,154,.45);background:rgba(63,211,154,.1)"><b>${I.check} Objectif du jour atteint</b><p class="small" style="margin-top:4px">C’est bon pour aujourd’hui. Tu peux continuer si tu en as envie.</p></div>` : ''}
    ${teaser ? `<div class="card" style="width:100%;text-align:left"><span class="eyebrow">À suivre</span><p style="margin-top:6px;font-weight:700">${h(teaser)}</p></div>` : ''}
    ${e.n && e.good < e.n ? '<div class="card" style="width:100%;text-align:left"><b>À revoir</b><p class="small" style="margin-top:4px">Les questions ratées reviendront demain dans « À revoir », pour que tu ne les oublies pas.</p></div>' : ''}
    ${ficheFor(m.id) ? `<button class="btn ghost full" data-fiche="${ficheFor(m.id).id}">${I.book}Relire la fiche : ${h(ficheFor(m.id).title)}</button>` : ''}
    ${nm && !e.goalNow ? `<button class="btn v full" data-replay="${nm.id}">Mission suivante : ${h(nm.title)}</button>` : ''}
    <button class="btn ${nm && !e.goalNow ? 'ghost' : 'v'} full" data-quit>Retour aux missions</button>
    ${nm && e.goalNow ? `<button class="btn ghost full" data-replay="${nm.id}">Continuer quand même</button>` : ''}</div>`;
}

/* ============================================================
   RENDU + ÉVÉNEMENTS
   ============================================================ */
function render(){
  if (!S.onb && !S.guest && !['landing','onb','profilq','campus','pro','pricing'].includes(S.page)) S.page = 'landing';
  if (S.page === 'room' && S.room && S.room.done && !S.room.result) S.room = null;
  refreshSub();
  document.getElementById('app').innerHTML = (PAGES[S.page] || PAGES.home)();
  if (S.page === 'home') syncRail();
  requestAnimationFrame(templeScroll);
  const app = document.getElementById('app'), entering = S.page !== window.__lastPg; window.__lastPg = S.page;
  app.classList.remove('enter'); if (entering){ void app.offsetWidth; app.classList.add('enter'); }
  animate(app, !entering); setTimeout(checkUnlocks, 400);
  oSyncSegs(); oWireRails(); requestAnimationFrame(() => setTimeout(() => app.querySelectorAll('.o-gfg[data-off]').forEach(c => { c.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)'; c.style.strokeDashoffset = c.dataset.off; }), 120));
  const dk = app.querySelector('.dock'); if (dk && dk.dataset.to >= 0) requestAnimationFrame(() => requestAnimationFrame(() => dk.style.setProperty('--i', dk.dataset.to)));
  document.title = 'NovaTitre — ' + ({ landing:'Apprends la bourse en mission', missions:'Mon parcours', markets:'Marchés', stock:'Fiche valeur', portfolio:'Portefeuille', coach:'Nova Coach', profile:'Profil', campus:'Nova Campus', pro:'Nova Pro', pricing:'Offres', onb:'Test de départ', home:'Accueil', carte:'Ma carte', bureau:'Marchés', jeux:'Jeux', cours:'Cours', room:'Salle de marché', certs:'Certificats', plan:'Plan de trading', profilq:'Ton profil', monplan:'Mon plan', amf:'Prépa AMF', suivi:'Mon suivi' }[S.page] || 'Nova Missions');
}

document.addEventListener('click', ev => {
  const t = ev.target.closest('button, [data-go]'); if (!t) return;
  const d = t.dataset;
  if (d.sheetclose !== undefined){ window.__cancelAsk = false; return closeSheet(); }
  if (d.toolinfo){ return toolSheet(d.toolinfo); }
  if (d.allmovers !== undefined){ window.__allMovers = !window.__allMovers; return render(); }
  if (d.cnode){ return chapterSheet(Number(d.cnode)); }
  if (d.event){ return eventSheet(d.event); }
  if (d.career !== undefined){ closeSheet(); return startCareer(); }
  if (d.careerreset !== undefined){ const c = CAR(); c.n = 0; c.cap = 10000; c.last = null; c.runs = (c.runs || 0) + 1; save(); closeSheet(); return startCareer(); }
  if (d.gamestart){ return startGame(d.gamestart); }
  if (XO){
    if (d.xoquit !== undefined) return closeXO();
    if (d.xonext !== undefined) return careerNext();
    if (d.cside){ XO.side = d.cside; if (XO.side === 'out') XO.amt = null; return renderXO(); }
    if (d.camt){ XO.amt = Number(d.camt); return renderXO(); }
    if (d.creason){ XO.reason = d.creason; return renderXO(); }
    if (d.cguess !== undefined){ XO.g[XO.fi] = Number(d.cguess); const cd = RD.FLASH[XO.day.flash].cards[XO.fi]; if (cd.k === 'guess') sfx(Number(d.cguess) === cd.a ? 'ok' : 'ko'); return renderXO(); }
    if (d.gpick !== undefined) return gamePick(d.gpick);
    if (d.gnext !== undefined) return gameNext();
  }
  if (d.paywall !== undefined) return openPaywall();
  if (d.trial !== undefined) return startTrial();
  if (d.subscribe){ return subscribe(d.subscribe); }
  if (d.anp !== undefined){ window.__an = d.anp === '1'; if ($('#sheet.pay-sheet')) return openPaywall(); return render(); }
  if (d.managesub !== undefined) return manageSub();
  if (d.cancelask !== undefined){ window.__cancelAsk = true; return manageSub(); }
  if (d.cancelsub !== undefined){ window.__cancelAsk = false; return cancelSub(); }
  if (d.askhome){ go('coach'); return askCoach(d.askhome); }
  if (d.pqhome){ const q = PQ.find(x => x.id === d.pqhome), P = S.profile;
    if (q.multi){ const k = '_' + q.id; let a = P[k] || []; a = a.includes(d.v) ? a.filter(x => x !== d.v) : a.concat(d.v); P[k] = a; save(); return render(); }
    P[q.id] = d.v; S.pqDay = today(); S.plan2 = Object.assign(buildPlan(P, S.placement || 0), {}); save(); toast('Merci : ton plan est mis à jour.'); return render(); }
  if (d.pqhomeok){ const P = S.profile; P[d.pqhomeok] = P['_' + d.pqhomeok] || []; delete P['_' + d.pqhomeok]; S.pqDay = today(); S.plan2 = buildPlan(P, S.placement || 0); save(); toast('Merci : ton plan est mis à jour.'); return render(); }
  if (d.pqhomeskip !== undefined){ S.pqDay = today(); save(); return render(); }
  if (d.annual !== undefined){ window.__annual = d.annual === '1'; return render(); }
  if (d.aireport !== undefined) return aiReport();
  if (d.aistop !== undefined){ if (AIC) AIC.abort(); return; }
  if (d.roomai !== undefined) return roomAI();
  if (d.planai !== undefined) return planAI();
  if (d.explain !== undefined) return explainAI();
  if (d.sheetplay){ closeSheet(); return startMission(d.sheetplay, 'full'); }
  if (d.fiche) return openFiche(d.fiche);
  if (d.print !== undefined){ document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); return; }
  if (d.certview){ return certView(d.certview); }
  if (d.certname){ const c = S.certs[d.certname]; if (c && !c.name && S.name){ c.name = S.name; save(); toast('Nom fixé sur le certificat.'); } return certView(d.certname); }
  if (d.exam){ if (M){ M = null; const pl = $('#player'); if (pl) pl.remove(); } closeSheet(); return startExam(d.exam); }
  if (d.go){ closeSheet(); if (M && !M.away) closePlayer(); if (XO){ if (XO.tick) clearInterval(XO.tick); XO = null; const x = $('#xo'); if (x) x.remove(); document.body.style.overflow = ''; } return go(d.go); }
  if (d.gotab){ return go('cours', d.gotab); }
  if (d.savename !== undefined){ S.name = ($('#cname').value || '').trim().slice(0, 60); save(); toast('Nom enregistré.'); return render(); }
  if (d.roomnew !== undefined) return roomNew(d.roomnew === '1');
  if (d.roomquit !== undefined){ S.room = null; save(); return render(); }
  if (d.rstep) return roomStep(Number(d.rstep));
  if (d.rend !== undefined){ roomEnd(); save(); return render(); }
  if (d.rs){ window.__rf.side = d.rs; window.__rf.stop = ''; window.__rf.target = ''; return render(); }
  if (d.rt){ window.__rf.type = d.rt; return render(); }
  if (d.rcancel !== undefined){ S.room.pend = null; save(); return render(); }
  if (d.tf){ window.__tf = d.tf; return render(); }
  if (d.rauto !== undefined){ const r = S.room, cs = rcs(), f = window.__rf, last = cs.slice(Math.max(0, r.i - 9), r.i + 1), c = roomPrice(f);
    const st = f.side === 'buy' ? Math.min(c, ...last.map(x => x.l)) * 0.995 : Math.max(c, ...last.map(x => x.h)) * 1.005, d0 = Math.abs(c - st);
    f.stop = num(st, 2).replace(/\s/g, ''); f.target = num(f.side === 'buy' ? c + 2 * d0 : c - 2 * d0, 2).replace(/\s/g, ''); return render(); }
  if (d.ropen !== undefined) return roomOpen();
  if (d.rclose !== undefined){ closePos(rcs()[S.room.i].c, 'Clôture manuelle'); save(); return render(); }
  if (d.rmove !== undefined) return roomMoveStop(($('#mvStop') || {}).value);
  if (d.start !== undefined){ S.audience = d.start; if (S.onb) return go('home'); T = null; window.__pq = 0; window.__pqAll = true; return go('profilq'); }
  if (d.goal){ S.goal = d.goal; save(); return render(); }
  if (d.pqa !== undefined){ const L = pqList(), q = L[Math.min(L.length - 1, window.__pq || 0)], P = S.profile = S.profile || {};
    if (q.multi){ let a = P[q.id] || []; if (d.pqa === 'rien') a = ['rien']; else { a = a.filter(x => x !== 'rien'); a = a.includes(d.pqa) ? a.filter(x => x !== d.pqa) : a.concat(d.pqa); } P[q.id] = a; save(); return render(); }
    P[q.id] = d.pqa; save(); return pqAdvance(); }
  if (d.pqnext !== undefined || d.pqskip !== undefined) return pqAdvance();
  if (d.pqback !== undefined){ window.__pq = Math.max(0, (window.__pq || 0) - 1); return render(); }
  if (d.redoprofile !== undefined){ window.__pq = 0; window.__pqAll = true; return go('profilq'); }
  if (d.onbgo !== undefined){ M = null; const pl = $('#player'); if (pl) pl.remove(); document.body.style.overflow = ''; window.__pq = 0; window.__pqAll = false; return go('profilq'); }
  if (d.pace){ S.pace = d.pace; save(); return render(); }
  if (d.testStart !== undefined){ T.step = 1; return render(); }
  if (d.testSkip !== undefined){ S.onb = true; S.placement = 0; S.plan2 = buildPlan(S.profile, 0); save(); T = { step: 2, validated: 0 }; return go('onb'); }
  if (d.tsel !== undefined){ T.sel = Number(d.tsel); return render(); }
  if (d.tnext !== undefined){ const ok = T.sel === T.cur.answer; T.log.push({ lvl: T.cur.lvl, ok }); T.n++; T.lvl = Math.max(1, Math.min(10, T.lvl + (ok ? 1 : -1))); T.cur = null;
    const lg = T.log, unsure = lg.length >= 2 && lg[lg.length - 1].ok !== lg[lg.length - 2].ok;   // résultat limite : une question de confirmation
    if (T.n >= 12 || (T.n >= 10 && !unsure)) finishTest(); return render(); }
  if (d.chap){ const c = Number(d.chap), el = t.closest('.chap'); S.open[c] = el.dataset.open !== '1'; save(); return render(); }
  if (d.play) return startMission(d.play, 'full');
  if (d.review !== undefined) return startReview();
  if (d.session !== undefined) return startSession(d.session || null);
  if (d.nextday !== undefined){ S.dayOffset = (S.dayOffset || 0) + 1; save(); toast(`Nous sommes le ${today().split('-').reverse().join('/')} (simulation).`); return go('home'); }
  if (d.eclair) return startMission(d.eclair, 'eclair');
  if (d.stock){ window.__tk = null; window.__stab = 'apercu'; closeSheet(); return go('stock', d.stock); }
  if (d.toggle){ S[d.toggle] = d.toggle === 'minors' ? S.minors === false : !S[d.toggle]; save(); toast(d.toggle === 'minors' ? (S.minors ? 'Protection renforcée activée.' : 'Protection renforcée désactivée.') : d.toggle === 'premium' ? (S.premium ? 'Premium simulé : tout est débloqué.' : 'Retour à l’offre Découverte.') : d.toggle === 'sound' ? (S.sound ? 'Sons et vibrations activés.' : 'Sons et vibrations coupés.') : (S.reminder ? 'Rappel activé : 1 par jour maximum.' : 'Rappels désactivés.')); return render(); }
  if (d.premium !== undefined){ S.premium = true; save(); toast('Premium simulé : tous les chapitres sont débloqués.'); return go(S.onb ? 'home' : 'landing'); }
  if (d.cert !== undefined){ return go('certs'); }
  if (d.reset !== undefined){ S = Object.assign({}, DEF); T = null; save(); return go('landing'); }
  if (d.soon){ return toast(`${d.soon} : disponible dans la version finale.`); }
  if (d.ask){ return askCoach(d.ask); }
  if (d.trade){ return trade(d.trade); }
  if (d.tk){ const s = tkState(); s[d.tk] = d.v; if (M && !M.away) renderPlayer(); else if ($('#sheet.tk-sheet')) openTicket(); else render(); return; }
  /* lecteur */
  if (!M) return;
  if (d.quit !== undefined) return closePlayer();
  if (d.ubnow){ const k = d.ubnow; M = null; const pl = $('#player'); if (pl) pl.remove(); document.body.style.overflow = ''; render(); return startUnblock(k); }
  if (d.replay){ const id = d.replay; M = null; return startMission(id, 'full'); }
  if (d.next !== undefined) return next();
  if (d.check !== undefined) return check();
  if (d.sel !== undefined){ M.ui.sel = Number(d.sel); return renderPlayer(); }
  if (d.selb !== undefined){ M.ui.sel = d.selb === 'true'; return renderPlayer(); }
  if (d.selc !== undefined){ M.ui.sel = d.selc; return renderPlayer(); }
  if (d.ml !== undefined){ const i = Number(d.ml), u = M.ui; u.pairs = u.pairs || {}; if (u.pairs[i] != null && u.left !== i){ delete u.pairs[i]; u.left = i; } else u.left = u.left === i ? null : i; return renderPlayer(); }
  if (d.mr !== undefined){ const j = Number(d.mr), u = M.ui; u.pairs = u.pairs || {}; if (u.left == null){ const k = Object.keys(u.pairs).find(k => u.pairs[k] === j); if (k != null) delete u.pairs[k]; return renderPlayer(); }
    for (const k of Object.keys(u.pairs)) if (u.pairs[k] === j) delete u.pairs[k]; u.pairs[u.left] = j; u.left = null; return renderPlayer(); }
  if (d.seq !== undefined){ M.ui.seq = (M.ui.seq || []).concat(d.seq); return renderPlayer(); }
  if (d.unseq !== undefined){ M.ui.seq.splice(Number(d.unseq), 1); return renderPlayer(); }
  if (d.swipe) return swipe(d.swipe);
  if (d.role !== undefined){ const st = M.steps[M.i], u = M.ui, n = st.nodes[u.node], o = n.options[Number(d.role)];
    u.log.push({ who: st.persona, t: n.say }, { me: 1, t: o.t, fb: o.fb, good: o.good }); u.good = (u.good ?? true) && o.good; u.node = o.next; if (st.nodes[o.next].end) u.end = true; return renderPlayer(); }
  if (d.rolefin !== undefined){ M.ok.push(!!M.ui.good); return next(); }
  if (d.more !== undefined){ M.ui.more = true; return renderPlayer(); }
  if (d.lg !== undefined){ M.ui.g = M.ui.g || {}; M.ui.g[M.ui.c || 0] = Number(d.lg); sfx(Number(d.lg) === M.steps[M.i].cards[M.ui.c || 0].a ? 'ok' : 'ko'); return renderPlayer(); }
  if (d.lt !== undefined){ M.ui.rv = M.ui.rv || {}; M.ui.rv[M.ui.c || 0] = 1; return renderPlayer(); }
  if (d.lnext !== undefined){ const st = M.steps[M.i]; if ((M.ui.c || 0) >= st.cards.length - 1) return next(); M.ui.c = (M.ui.c || 0) + 1; return renderPlayer(); }
  if (d.dopt !== undefined){ M.ui.sel = Number(d.dopt); return renderPlayer(); }
  if (d.resim !== undefined){ M.ui.resim = (M.ui.resim || 0) + 1; return renderPlayer(); }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.matches('[data-seats]')){ window.__seats = Number(t.value); const q = document.querySelector('.seats'); if (q){ const tmp = document.createElement('div'); tmp.innerHTML = proQuote(); ['seatsV', 'seatsP', 'seatsT'].forEach(id => { $('#' + id).innerHTML = tmp.querySelector('#' + id).innerHTML; }); } return; }
  if (t.matches('[data-fq]')){ window.__fq = t.value; const pos = t.selectionStart; render(); const n = $('#fq'); if (n){ n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.matches('[data-gq]')){ window.__gq = t.value; const pos = t.selectionStart; render(); const n = $('#gq'); if (n){ n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.matches('[data-rin]') && window.__rf){ const k = t.dataset.rin; window.__rf[k] = k === 'risk' ? Number(t.value) : t.value; if (k === 'risk'){ const v = $('#rRiskV'); if (v) v.textContent = num(Number(t.value), 2) + ' %'; }
    const rc = $('#rRecap'); if (rc) rc.innerHTML = roomRecap(); return; }
  if (M && t.matches('[data-calc]')){ M.ui.val = t.value; const b = $('#player [data-check]'); if (b) b.disabled = t.value.trim() === ''; }
  if (M && t.matches('[data-slider]')){ M.ui.y = Number(t.value); renderPlayer(); const s = $('#slIn'); if (s) s.focus(); }
  if (t.matches('[data-tkin]')){ const s = tkState(), stk = M && !M.away ? null : mkFind(S.arg); s[t.dataset.tkin] = t.dataset.tkin === 'qty' ? (stk && stk.frac ? Math.max(0.0001, parseFloat(String(t.value).replace(',', '.')) || 0.01) : Math.max(1, parseInt(t.value || '1', 10))) : parseFloat(String(t.value).replace(',', '.')) || 0;
    const sum = t.closest('.ticket').querySelector('.tk-sum b'); const price = stk ? px(stk) : M.steps[M.i].price;
    if (sum) sum.textContent = money(stk, s.qty * (s.type === 'limit' ? s.limit : price));
    const rc = t.closest('.ticket').querySelector('.tk-recap'); if (rc) rc.innerHTML = tkRecap(s); }
});
document.addEventListener('submit', ev => {
  ev.preventDefault();
  if (ev.target.id === 'planF') return checkPlan();
  if (ev.target.id === 'coachF'){ const i = $('#coachIn'); askCoach(i.value); }
  if (ev.target.id === 'classF'){ const n = $('#cName').value.trim(); if (!n) return; const code = 'NT-' + Math.random().toString(36).slice(2, 6).toUpperCase(); S.classes.push({ name: n, code }); save(); toast(`Code d’invitation : ${code}`); render(); }
  if (ev.target.id === 'assignF'){ const g = $('#aGroup').value, m = $('#aMis').selectedOptions[0].textContent, dt = $('#aDate').value; if (!dt) return;
    S.assigns.push({ g, m, d: new Date(dt).toLocaleDateString('fr-FR') }); save(); toast('Mission imposée.'); render(); }
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && $('#sheet')) return closeSheet();
  if (ev.key === 'Escape' && XO) return closeXO();
  if (!M || M.end || M.away) return;
  if (ev.key === 'Enter' && ev.target.matches('[data-calc]') && !M.fb && String(M.ui.val ?? '').trim() !== ''){ ev.preventDefault(); return check(); }
  if (ev.key === 'Escape') return M.mode === 'exam' ? null : closePlayer();
  const st = M.steps[M.i];
  if (st && st.type === 'swipe' && !M.fb && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) swipe(ev.key === 'ArrowLeft' ? 'left' : 'right');
});
/* glisser les cartes */
let drag = null;
document.addEventListener('pointerdown', ev => { const c = ev.target.closest('#swCard'); if (!c) return; drag = { x: ev.clientX, el: c }; c.setPointerCapture(ev.pointerId); });
document.addEventListener('pointermove', ev => { if (!drag) return; const dx = ev.clientX - drag.x; drag.el.style.transition = 'none'; drag.el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; });
document.addEventListener('pointerup', ev => { if (!drag) return; const dx = ev.clientX - drag.x, el = drag.el; drag = null; el.style.transition = '';
  if (Math.abs(dx) > 80) swipe(dx < 0 ? 'left' : 'right'); else el.style.transform = ''; });
function swipe(dir){
  const st = M.steps[M.i], u = M.ui; u.k = u.k || 0; u.res = u.res || [];
  const c = st.cards[u.k]; if (!c) return; const ok = c.side === dir;
  u.res.push(ok); u.last = { ok, explain: c.explain }; u.k++;
  if (M.mode === 'full' && !u.cut && u.k >= 4 && u.k < st.cards.length - 1 && u.res.every(Boolean) && (Date.now() - M.t0) / u.k < 2500){   // très rapide et sans faute : fin du paquet
    u.cut = true; M.skipped = true; const full = st.cards.length; st.cards = st.cards.slice(0, u.k); u.cutFrom = full; }
  const el = $('#swCard'); if (el){ el.style.transform = `translateX(${dir === 'left' ? -420 : 420}px) rotate(${dir === 'left' ? -18 : 18}deg)`; el.style.opacity = '0'; }
  setTimeout(() => {
    if (u.k >= st.cards.length){ const good = u.res.filter(Boolean).length; const okAll = good >= st.cards.length - 1; M.ok.push(okAll);
      M.fb = { ok: okAll, title: `${good} / ${st.cards.length}`, text: okAll ? 'Tu as le bon réflexe. ' + c.explain : 'Relis les explications : ces réflexes reviendront dans tes prochaines missions.', extra: u.cut ? `Rapide et sans faute : on saute les ${u.cutFrom - u.k} dernières cartes.` : '' }; M.combo = okAll ? M.combo + 1 : 0; sfx(okAll ? 'ok' : 'ko'); }
    renderPlayer();
  }, 220);
}
function trade(id){
  const s = mkFind(id), t = tkState(); if (!s) return;
  const qty = s.frac ? Math.round((parseFloat(t.qty) || 0) * 10000) / 10000 : Math.max(1, Math.floor(Number(t.qty) || 1)), dt = dateFr(today());
  if (!qty) return toast('Indique une quantité.');
  if (!mkOpen(s)) return toast(`Achat fictif débloqué au chapitre ${s.minCh}.`);
  if (t.type === 'limit' && ((t.side === 'buy' && t.limit < px(s)) || (t.side === 'sell' && t.limit > px(s)))){
    S.history.push(`${dt} · Ordre limité ${t.side === 'buy' ? 'd’achat' : 'de vente'} ${qty} ${s.id} à ${money(s, t.limit)} : en attente`); save(); toast('Ordre à cours limité placé : il attend un preneur à ton prix.');
    closeSheet(); window.__tk = null; applyCheck({ type: 'limit', s, t }); return render(); }
  const pxx = px(s), costE = toEur(s, qty * pxx);
  if (t.side === 'buy'){
    if (costE > S.cash + 1e-9) return toast(`Il faut ${eur(costE)} fictifs, tu as ${eur(S.cash)}.`);
    const p = S.positions[s.id] || { qty: 0, avg: 0 }; p.avg = (p.avg * p.qty + qty * pxx) / (p.qty + qty); p.qty = Math.round((p.qty + qty) * 10000) / 10000; S.positions[s.id] = p; S.cash = Math.round((S.cash - costE) * 100) / 100;
    S.history.push(`${dt} · Achat ${num(qty, qty % 1 ? 4 : 0)} ${s.id} à ${money(s, pxx)}`);
  } else {
    const p = S.positions[s.id]; if (!p || p.qty < qty - 1e-9) return toast('Tu ne détiens pas assez de titres.');
    p.qty = Math.round((p.qty - qty) * 10000) / 10000; if (p.qty <= 0) delete S.positions[s.id]; S.cash = Math.round((S.cash + costE) * 100) / 100; S.history.push(`${dt} · Vente ${num(qty, qty % 1 ? 4 : 0)} ${s.id} à ${money(s, pxx)}`);
  }
  closeSheet(); save(); sfx('ok'); toast('Ordre exécuté (fictif).'); window.__tk = null; applyCheck({ type: t.side, s, t }); render();
}

/* ============================================================
   L'ÉCOLE : COURS, SALLE DE MARCHÉ, EXAMENS, CERTIFICATS, PLAN, PRÉPA AMF
   ============================================================ */
const LV = window.NT_LEVELS, CO = window.NT_COURS, GL = window.NT_GLOSSAIRE, CF = window.NT_EXAM_CFG, CK = window.NT_CANDLES;
const levelOf = ch => LV.find(l => l.ch.includes(ch));
const lvMissions = l => MS.filter(m => l.ch.includes(m.ch));
const lvProgress = l => { const ms = lvMissions(l); return ms.filter(m => isDone(m.id)).length / ms.length; };
const defiPassed = () => (S.roomHist || []).filter(r => r.defi && r.pass).length;
const defiAvg = () => { const l = (S.roomHist || []).filter(r => r.defi).slice(-CF.defiSessions); return l.length ? Math.round(l.reduce((a, r) => a + r.score, 0) / l.length) : 0; };
const defiOK = () => defiPassed() >= CF.defiSessions && defiAvg() >= CF.defiAvg;
const finalReady = () => LV.every(l => S.certs[l.id]) && defiOK() && S.plan && S.plan.ok;
const certCode = (k, d) => { let x = 7; for (const c of `${S.name || ''}|${k}|${d}`) x = (Math.imul(x, 31) + c.charCodeAt(0)) >>> 0; const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++){ s += a[x % 32]; x = Math.floor(x / 32) + (i + 1) * 7919; } return 'NT-' + s.slice(0, 4) + '-' + s.slice(4); };
const tabs = cur => `<div class="tabs" role="tablist">${[['markets','Marchés'],['room','Salle de marché']].map(([k, t]) => `<button role="tab" data-go="${k}" aria-selected="${cur === k}">${t}</button>`).join('')}</div>`;

/* ---------- missions : chapitres regroupés par niveau ---------- */
function levelsHTML(){
  return LV.map(l => { const pr = lvProgress(l), cert = S.certs[l.id], ex = S.exams['lv' + l.id];
    return `<div class="lvl"><div class="lvl-h"><span class="lvl-n">Niveau ${l.id}</span><b>${h(l.title)}</b>${cert ? `<span class="chip g">${I.check}Certifié</span>` : ''}</div>
      ${CH.filter(c => l.ch.includes(c.id)).map(chapCard).join('')}
      <div class="exam-card${cert ? ' ok' : ''}"><div class="grow"><span class="eyebrow">${I.trophy} Examen du niveau ${l.id}</span>
        <b>${cert ? 'Réussi · ' + cert.pct + ' %' : `${l.exam} questions · ${Math.round(l.exam * CF.secondsPerQuestion / 60)} min · 80 % pour valider`}</b>
        <span class="small">${cert ? 'Certificat obtenu le ' + cert.date.split('-').reverse().join('/') : ex ? `Meilleur essai : ${ex.best} %. ` : ''}${cert ? '' : pr < 0.7 ? `Conseillé après 70 % du niveau (tu es à ${Math.round(pr * 100)} %). Tu peux le tenter avant : réussi, il valide le niveau.` : 'Tu es prêt.'}</span></div>
        <button class="btn sm ${cert ? 'ghost' : 'v'}" data-exam="lv${l.id}">${cert ? 'Repasser' : 'Passer'}</button></div></div>`; }).join('');
}

/* ---------- cours ---------- */
PAGES.cours = () => { const tab = S.arg === 'glossaire' ? 'glossaire' : 'fiches', q = (window.__gq || '').toLowerCase();
  return `<div class="wrap">${top()}
  <div class="sec-h" style="margin-top:4px"><h2 style="font-size:24px">Les cours</h2><span>${CO.length} fiches · 2 min chacune</span></div>
  <div class="tabs" role="tablist"><button role="tab" data-go="cours" aria-selected="${tab === 'fiches'}">Fiches</button><button role="tab" data-gotab="glossaire" aria-selected="${tab === 'glossaire'}">Glossaire</button><button role="tab" data-go="amf" aria-selected="false">Prépa AMF</button></div>
  ${tab === 'fiches' ? `<div style="margin-top:12px"><label class="sr" for="fq">Chercher dans les cours</label><input id="fq" class="field sm" style="width:100%" placeholder="Chercher dans les cours (ex. stop, PEA)…" value="${h(window.__fq || '')}" data-fq autocomplete="off"></div>` : ''}
  ${tab === 'fiches' && window.__fq ? (() => { const q = window.__fq.toLowerCase(), res = CO.filter(f => (f.title + ' ' + f.body.join(' ') + ' ' + f.key.join(' ') + ' ' + (f.ex || '')).toLowerCase().includes(q));
      return `<section class="sec"><div class="sec-h"><h2>${res.length} fiche${res.length > 1 ? 's' : ''} trouvée${res.length > 1 ? 's' : ''}</h2></div>${res.map(f => `<button class="fiche-row" data-fiche="${f.id}"><span class="fi">${I.book}</span><span class="grow"><b>${h(f.title)}</b><span class="small">Chapitre ${f.ch} · ${f.min} min</span></span></button>`).join('') || '<p class="small">Aucune fiche. Essaie le glossaire.</p>'}</section>`; })()
  : tab === 'fiches' ? LV.map(l => `<section class="sec"><div class="sec-h"><h2>Niveau ${l.id} · ${h(l.title)}</h2>${S.certs[l.id] ? `<span class="chip g">${I.check}Certifié</span>` : ''}</div>
    ${CH.filter(c => l.ch.includes(c.id)).map(c => `<div class="fiche-grp"><span class="eyebrow" style="color:${c.color}">Chapitre ${c.id} · ${h(c.title)}</span>
      ${CO.filter(f => f.ch === c.id).map(f => `<button class="fiche-row" data-fiche="${f.id}"><span class="fi">${I.book}</span><span class="grow"><b>${h(f.title)}</b><span class="small">${f.min} min · ${f.ms.length} mission${f.ms.length > 1 ? 's' : ''} liée${f.ms.length > 1 ? 's' : ''}</span></span>${(S.read || {})[f.id] ? `<span class="chip g">${I.check}Lue</span>` : ''}</button>`).join('')}</div>`).join('')}</section>`).join('')
  : `<div class="card" style="margin-top:12px"><label class="sr" for="gq">Chercher un mot</label><input id="gq" class="field" placeholder="Chercher un mot (ex. spread, RSI)…" value="${h(window.__gq || '')}" data-gq autocomplete="off">
    <dl class="gloss">${GL.filter(([t, d]) => !q || t.toLowerCase().includes(q) || d.toLowerCase().includes(q)).map(([t, d]) => `<dt>${h(t)}</dt><dd>${h(d)}</dd>`).join('') || '<p class="small">Aucun mot trouvé.</p>'}</dl></div>`}
  ${legal()}</div>${dock()}`; };
function openSheet(html, cls = ''){ closeSheet(); const d = document.createElement('div'); d.id = 'sheet'; d.className = 'sheet ' + cls; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
  d.innerHTML = `<div class="sheet-in"><button class="ibtn sheet-x" data-sheetclose aria-label="Fermer">${I.x}</button>${html}</div>`; document.body.appendChild(d); document.body.style.overflow = 'hidden'; }
function closeSheet(){ const d = $('#sheet'); if (d){ d.remove(); if (!M) document.body.style.overflow = ''; } }
function openFiche(id){ const f = CO.find(x => x.id === id); if (!f) return; S.read = S.read || {}; S.read[id] = 1; save();
  const c = CH.find(x => x.id === f.ch);
  openSheet(`<span class="eyebrow" style="color:${c.color}">Chapitre ${c.id} · ${h(c.title)} · ${f.min} min</span><h2 class="fiche-t">${h(f.title)}</h2>
    ${f.body.map(p => `<p class="fiche-p">${h(p)}</p>`).join('')}
    <div class="fiche-key"><b>À retenir</b><ul>${f.key.map(k => `<li>${h(k)}</li>`).join('')}</ul></div>
    ${f.ex ? `<div class="fiche-ex"><b>Exemple</b><p>${h(f.ex)}</p></div>` : ''}
    <span class="eyebrow" style="display:block;margin-top:16px">Pour pratiquer</span>
    <div class="fiche-ms">${f.ms.map(mid => { const m = MS.find(x => x.id === mid); return m ? `<button class="btn ghost sm" data-sheetplay="${m.id}">${isDone(m.id) ? I.check : I.play}${h(m.title)}</button>` : ''; }).join('')}</div>
    <p class="note">Contenu pédagogique, sans conseil personnalisé. Chiffres fiscaux : règles 2026, à vérifier chaque année.</p>`);
}
const ficheFor = mid => CO.find(f => f.ms.includes(mid));

/* ---------- salle de marché ---------- */
const ROOM_N = 260, ROOM_START = 60, ROOM_LEN = 100, FEE = 0.001;
const roomSeries = r => CK.gen({ kind: 'regime', seed: r.seed, n: ROOM_N, base: 30 + (r.seed * 37) % 70, vol: r.tf === 'heure' ? 0.0055 : 0.013 }).cs;
let RS = null;   // cache de la série de la séance
const rcs = () => (RS && RS.seed === S.room.seed) ? RS.cs : (RS = { seed: S.room.seed, cs: roomSeries(S.room) }).cs;
const roomPrice = f => f.type === 'limit' && parseFloat(String(f.limit).replace(',', '.')) > 0 ? parseFloat(String(f.limit).replace(',', '.')) : rcs()[S.room.i].c;
const rEquity = () => { const r = S.room, c = rcs()[r.i]; return r.cash + (r.pos ? (c.c - r.pos.entry) * r.pos.qty * r.pos.dir : 0); };
function roomNew(defi){ const n = (S.roomHist || []).length + 1;
  S.room = { seed: 1000 + n * 17 + (S.dayOffset || 0), tf: window.__tf || 'jour', pend: null, i: ROOM_START, cap0: 10000, cash: 10000, pos: null, trades: [], viol: [], defi: !!defi, peak: 10000, dd: 0, lastLoss: -99, n };
  window.__rf = { side: 'buy', stop: '', target: '', risk: 1, reason: '' }; save(); render(); }
function addViol(t){ S.room.viol.push({ t, i: S.room.i }); }
function closePos(price, why){ const r = S.room, p = r.pos, cs = rcs(); if (!p) return;
  const gross = (price - p.entry) * p.qty * p.dir, fees = (p.entry + price) * p.qty * FEE, pnl = gross - fees;
  r.cash += pnl - p.fee0 * 0; r.trades.push({ side: p.dir > 0 ? 'Achat' : 'Vente à découvert', entry: p.entry, exit: price, qty: p.qty, pnl, R: pnl / p.riskEur, reason: p.reason, why, at: r.i - ROOM_START });
  if (pnl < 0) r.lastLoss = r.i; r.pos = null; }
function roomStep(k){ const r = S.room, cs = rcs(); if (!r || r.done) return;
  for (let s = 0; s < k; s++){
    if (r.i >= ROOM_START + ROOM_LEN){ break; }
    r.i++; const c = cs[r.i];
    if (r.pend && !r.pos){ const q = r.pend, hit = q.dir > 0 ? c.l <= q.limit : c.h >= q.limit;
      if (hit){ const fill = q.dir > 0 ? Math.min(q.limit, c.o) : Math.max(q.limit, c.o); r.pend = null; openAt(fill, q.f, true); } }
    const p = r.pos;
    if (p){ const hitStop = p.dir > 0 ? c.l <= p.stop : c.h >= p.stop, hitTgt = p.target && (p.dir > 0 ? c.h >= p.target : c.l <= p.target);
      if (hitStop){ const gap = p.dir > 0 ? c.o < p.stop : c.o > p.stop; closePos(gap ? c.o : p.stop, gap ? 'Stop (gap)' : 'Stop'); }
      else if (hitTgt){ const gap = p.dir > 0 ? c.o > p.target : c.o < p.target; closePos(gap ? c.o : p.target, 'Objectif'); } }
    const eq = rEquity(); r.peak = Math.max(r.peak, eq); r.dd = Math.min(r.dd, (eq / r.peak - 1) * 100);
  }
  if (r.i >= ROOM_START + ROOM_LEN) roomEnd();
  save(); render(); }
function roomOpen(){ const r = S.room, f = window.__rf, c = rcs()[r.i], dir = f.side === 'buy' ? 1 : -1;
  if (f.type === 'limit'){ const lim = parseFloat(String(f.limit).replace(',', '.'));
    if (!(lim > 0)) return toast('Indique ton prix limite.');
    if (dir > 0 ? lim >= c.c : lim <= c.c) return toast(dir > 0 ? 'Un achat limité se place SOUS le cours actuel (sinon, utilise « Au marché »).' : 'Une vente limitée se place AU-DESSUS du cours actuel.');
    const chk = openAt(lim, f, false, true); if (chk !== true) return;
    r.pend = { dir, limit: lim, f: Object.assign({}, f) }; f.stop = ''; f.target = ''; f.reason = ''; f.limit = '';
    toast('Ordre à cours limité placé : il attend que le prix vienne à toi.'); save(); return render(); }
  openAt(c.c, f, false); }
function openAt(entry, f, silent, dry){ const r = S.room, dir = f.side === 'buy' ? 1 : -1;
  const stop = parseFloat(String(f.stop).replace(',', '.')), target = parseFloat(String(f.target).replace(',', '.'));
  const fail = t => { if (!silent) toast(t); return false; };
  if (!(stop > 0)) return fail('Place d’abord ton stop : pas de position sans stop.');
  if (dir > 0 ? stop >= entry : stop <= entry) return fail(dir > 0 ? 'À l’achat, le stop doit être SOUS le prix d’entrée.' : 'En vente à découvert, le stop doit être AU-DESSUS du prix d’entrée.');
  if (target && (dir > 0 ? target <= entry : target >= entry)) return fail('L’objectif doit être du côté du gain.');
  const eq = rEquity(), riskEur = eq * f.risk / 100, qty = Math.min(Math.floor(riskEur / Math.abs(entry - stop)), Math.floor(eq / entry));
  if (qty < 1) return fail('Stop trop loin pour ce risque : rapproche-le ou augmente un peu le risque.');
  if (!f.reason) return fail('Choisis la raison du trade : c’est ton journal.');
  if (dry) return true;
  if (f.risk > 2) addViol('Risque supérieur à 2 % du capital');
  const rr = target ? Math.abs(target - entry) / Math.abs(entry - stop) : 0;
  if (!target) addViol('Trade sans objectif de sortie'); else if (rr < 1.5) addViol('Ratio gain/risque inférieur à 1,5');
  if (r.i - r.lastLoss <= 3) addViol('Trade de revanche (juste après une perte)');
  if (eq <= r.cap0 * 0.97) addViol('Trade après la perte maximale de la séance (−3 %)');
  if (f.reason === 'Intuition') addViol('Trade sans raison écrite dans le plan');
  if (r.trades.length >= 8) addViol('Trop de trades dans la séance (plus de 8)');
  r.pos = { dir, entry, stop, target: target || null, qty, riskEur: qty * Math.abs(entry - stop), reason: f.reason, at: r.i, fee0: 0 };
  if (silent){ toast('Ton ordre limité a été exécuté.'); return true; }
  f.stop = ''; f.target = ''; f.reason = '';
  sfx('ok'); save(); render(); return true; }
function roomMoveStop(v){ const r = S.room, p = r.pos; if (!p) return; const ns = parseFloat(String(v).replace(',', '.')); if (!(ns > 0)) return;
  const c = rcs()[r.i].c;
  if (p.dir > 0 ? ns < p.stop : ns > p.stop){ addViol('Tentative d’éloigner le stop'); save(); render(); return toast('Refusé : on rapproche un stop, on ne l’éloigne jamais.'); }
  if (p.dir > 0 ? ns >= c : ns <= c) return toast('Ce stop serait touché tout de suite.');
  p.stop = ns; save(); render(); toast('Stop rapproché.'); }
function roomEnd(){ const r = S.room; if (r.done) return; const c = rcs()[r.i];
  if (r.pos) closePos(c.c, 'Fin de séance');
  const types = {}; r.viol.forEach(v => types[v.t] = (types[v.t] || 0) + 1);
  const pen = { 'Risque supérieur à 2 % du capital': 15, 'Trade sans objectif de sortie': 5, 'Ratio gain/risque inférieur à 1,5': 5, 'Trade de revanche (juste après une perte)': 10, 'Trade après la perte maximale de la séance (−3 %)': 20, 'Trade sans raison écrite dans le plan': 5, 'Trop de trades dans la séance (plus de 8)': 10, 'Tentative d’éloigner le stop': 15 };
  let score = 100; for (const [t, n] of Object.entries(types)) score -= (pen[t] || 5) * (t === 'Trop de trades dans la séance (plus de 8)' ? 1 : n);
  if (r.dd < -6) score -= 20; score = Math.max(0, score);
  const pnl = r.cash - r.cap0, pass = score >= CF.defiMinScore && r.dd >= -6 && r.trades.length >= 2;
  r.done = true; r.result = { score, pnl, pass, types, dd: r.dd, n: r.trades.length };
  S.roomHist = (S.roomHist || []).concat([{ date: today(), defi: r.defi, score, pnl: Math.round(pnl), pass, n: r.trades.length, types }]);
  sfx(pass ? 'win' : 'ko'); }
PAGES.room = () => { const r = S.room;
  if (!r) return `<div class="wrap">${top()}${tabs('room')}
    <div class="sec-h" style="margin-top:8px"><h2 style="font-size:24px">Salle de marché</h2><span class="sample">Données simulées</span></div>
    <div class="card"><p class="fiche-p" style="margin:0">Tu revis une séance bougie par bougie, sans savoir ce qui arrive. Tu places tes ordres avec un stop, un objectif et un risque en %. À la fin, Nova Coach note ta <b>discipline</b>, pas tes gains.</p>
      <ul class="rules"><li>Capital fictif : 10 000 €</li><li>100 bougies par séance</li><li>Stop obligatoire, frais de 0,1 % par ordre</li><li>Règles notées : risque ≤ 2 %, ratio ≥ 1,5, pas de revanche, perte max −3 %, stop jamais éloigné</li></ul></div>
    <div class="card" style="margin-top:12px"><b>Unité de temps</b><div class="seg" role="group" aria-label="Unité de temps"><button data-tf="jour" aria-pressed="${(window.__tf || 'jour') === 'jour'}">1 bougie = 1 jour</button><button data-tf="heure" aria-pressed="${window.__tf === 'heure'}">1 bougie = 1 heure</button></div>
      <p class="small" style="margin-top:8px">En « 1 heure », les mouvements sont plus petits : stops plus serrés, positions plus grosses, même risque en euros.</p></div>
    <div class="grid2" style="margin-top:12px"><button class="tile" data-roomnew="0"><span class="eyebrow">Entraînement</span><b>Séance libre</b><span class="chip">${I.play}100 bougies</span></button>
      <button class="tile" data-roomnew="1"><span class="eyebrow">Défi Trader</span><b>${defiPassed()} / ${CF.defiSessions} séances réussies</b><span class="chip v">${I.trophy}Note ≥ ${CF.defiMinScore}</span></button></div>
    <div class="card" style="margin-top:12px"><b>Régularité</b><p class="small" style="margin-top:4px">Pour valider le Défi : ${CF.defiSessions} séances réussies <b>et</b> une moyenne d’au moins ${CF.defiAvg}/100 sur tes ${CF.defiSessions} dernières séances du Défi. Moyenne actuelle : <b class="tn">${defiAvg() || '—'}</b>${defiOK() ? ' ✓ Défi validé' : ''}.</p></div>
    ${(S.roomHist || []).length ? `<section class="sec"><div class="sec-h"><h2>Mes séances</h2></div><div class="card">${S.roomHist.slice(-8).reverse().map(x => `<div class="row hist"><span>${x.date.split('-').reverse().join('/')} · ${x.defi ? 'Défi' : 'Libre'}</span><span class="tn">${x.n} trades · ${x.pnl >= 0 ? '+' : ''}${eur0(x.pnl)}</span><span class="chip ${x.pass ? 'g' : ''}">${x.score}/100</span></div>`).join('')}</div></section>` : ''}
    <p class="note">Les graphiques sont générés par le simulateur. Sur le site final : vraies séances passées, anonymisées, avec données sous licence. Aucun argent réel.</p>
    ${legal()}</div>${dock()}`;
  const cs = rcs(), c = cs[r.i], from = Math.max(0, r.i - 59), view = cs.slice(0, r.i + 1), eq = rEquity(), p = r.pos, f = window.__rf || (window.__rf = { side: 'buy', stop: '', target: '', risk: 1, reason: '' });
  const lines = []; if (p){ lines.push({ y: p.entry, color: '#c4b5ff', label: 'Entrée' }, { y: p.stop, color: '#ff6b7f', label: 'Stop' }); if (p.target) lines.push({ y: p.target, color: '#3fd39a', label: 'Obj.' }); }
  else { const sv = parseFloat(String(f.stop).replace(',', '.')), tv = parseFloat(String(f.target).replace(',', '.')); if (sv > 0) lines.push({ y: sv, color: '#ff6b7f', label: 'Stop' }); if (tv > 0) lines.push({ y: tv, color: '#3fd39a', label: 'Obj.' }); }
  const left = ROOM_START + ROOM_LEN - r.i, pnl = eq - r.cap0;
  return `<div class="wrap">${top()}${tabs('room')}
  <div class="row" style="justify-content:space-between;margin-top:8px"><div><span class="eyebrow">${r.defi ? `Défi Trader · séance ${defiPassed() + 1}/${CF.defiSessions}` : 'Séance libre'}</span><b style="display:block;font-size:18px">Action mystère #${r.seed} <span class="chip">${r.tf === 'heure' ? '1 h' : '1 j'}</span></b></div><span class="sample">Données simulées</span></div>
  <div class="grid3 rstats"><div class="stat"><b class="tn">${eur0(eq)}</b><span>Capital</span></div><div class="stat"><b class="tn" style="color:${pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${pnl >= 0 ? '+' : ''}${eur0(pnl)}</b><span>Séance</span></div><div class="stat"><b class="tn">${r.done ? 'Fin' : left}</b><span>Bougies restantes</span></div></div>
  <div class="cwrap" style="margin-top:10px" aria-hidden="true">${CK.svg(view, { from, ma: [20], vol: true, lines, w: 350, ph: 200, label: 'Graphique de la séance' })}</div>
  <p class="sr" aria-live="polite">${h(CK.describe(view.slice(from), { ma: [20], vol: true, levels: lines }))}</p>
  <p class="small"><span style="color:#8fb4ff">━</span> Moyenne mobile 20 · Dernier cours <b class="tn" style="color:#fff">${num(c.c, 2)} €</b></p>
  ${r.done ? roomResult() : `
  <div class="row rctl"><button class="btn ghost" data-rstep="1" aria-label="Avancer d’une bougie">+1</button><button class="btn ghost" data-rstep="5">+5</button><button class="btn ghost" data-rend>Terminer</button></div>
  ${r.pend && !p ? `<div class="card rpos"><b>Ordre limité en attente</b><p class="small tn" style="margin-top:4px">${r.pend.dir > 0 ? 'Achat' : 'Vente à découvert'} à ${num(r.pend.limit, 2)} € · stop ${h(r.pend.f.stop)} · ${h(r.pend.f.reason)}</p><button class="btn ghost sm" style="margin-top:8px" data-rcancel>Annuler l’ordre</button></div>` : ''}
  ${p ? `<div class="card rpos"><div class="row" style="justify-content:space-between"><b>${p.dir > 0 ? 'Achat' : 'Vente à découvert'} · ${p.qty} titres</b><span class="tn" style="font-weight:800;color:${(c.c - p.entry) * p.dir >= 0 ? 'var(--green)' : 'var(--red)'}">${(c.c - p.entry) * p.dir >= 0 ? '+' : ''}${eur((c.c - p.entry) * p.qty * p.dir)}</span></div>
      <p class="small tn" style="margin-top:4px">Entrée ${num(p.entry, 2)} · Stop ${num(p.stop, 2)} · Objectif ${p.target ? num(p.target, 2) : '—'} · Risque ${eur0(p.riskEur)}</p>
      <div class="row" style="gap:8px;margin-top:10px"><label class="sr" for="mvStop">Nouveau stop</label><input id="mvStop" class="field sm tn" inputmode="decimal" placeholder="Nouveau stop"><button class="btn ghost sm" data-rmove>Rapprocher le stop</button><button class="btn sm" data-rclose>Clôturer</button></div></div>`
  : r.pend ? '' : `<div class="card rform"><b>Nouvel ordre</b>
      <div class="seg" role="group" aria-label="Sens" style="margin-top:10px"><button data-rs="buy" aria-pressed="${f.side === 'buy'}">Acheter</button><button data-rs="sell" aria-pressed="${f.side === 'sell'}">Vendre à découvert</button></div>
      <div class="seg" role="group" aria-label="Type d’entrée"><button data-rt="market" aria-pressed="${f.type !== 'limit'}">Au marché</button><button data-rt="limit" aria-pressed="${f.type === 'limit'}">Cours limité</button></div>
      ${f.type === 'limit' ? `<div class="tk-f"><label for="rLim">Prix limite</label><input id="rLim" class="tn" inputmode="decimal" value="${h(f.limit || '')}" data-rin="limit" placeholder="${num(c.c * (f.side === 'buy' ? 0.99 : 1.01), 2)}"></div>` : ''}
      <div class="tk-f"><label for="rStop">Stop (obligatoire)</label><input id="rStop" class="tn" inputmode="decimal" value="${h(f.stop)}" data-rin="stop" placeholder="${num(c.c * (f.side === 'buy' ? 0.97 : 1.03), 2)}"></div>
      <button class="link" data-rauto>Placer le stop derrière le dernier ${f.side === 'buy' ? 'creux' : 'sommet'}</button>
      <div class="tk-f"><label for="rTgt">Objectif</label><input id="rTgt" class="tn" inputmode="decimal" value="${h(f.target)}" data-rin="target" placeholder="facultatif"></div>
      <div class="tk-f"><label for="rRisk">Risque : <b id="rRiskV">${num(f.risk, 2)} %</b></label><input id="rRisk" type="range" min="0.25" max="3" step="0.25" value="${f.risk}" data-rin="risk"></div>
      <div class="tk-f"><label for="rReason">Raison</label><select id="rReason" data-rin="reason"><option value="">Choisir…</option>${['Suivi de tendance', 'Cassure', 'Rebond sur support', 'Retour à la moyenne', 'Intuition'].map(x => `<option${f.reason === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
      <p class="tk-recap" id="rRecap">${roomRecap()}</p>
      <button class="btn v full" style="margin-top:10px" data-ropen>${f.type === 'limit' ? 'Placer l’ordre limité' : 'Ouvrir la position'}</button></div>`}`}
  ${r.trades.length ? `<section class="sec"><div class="sec-h"><h2>Journal</h2><span>${r.trades.length} trade${r.trades.length > 1 ? 's' : ''}</span></div><div class="card">${r.trades.slice().reverse().map(t => `<div class="jrow"><span class="tn">${t.side} · ${t.qty} × ${num(t.entry, 2)} → ${num(t.exit, 2)}</span><span class="small">${h(t.reason)} · ${h(t.why)}</span><b class="tn" style="color:${t.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${t.pnl >= 0 ? '+' : ''}${eur0(t.pnl)} · ${t.R >= 0 ? '+' : ''}${num(t.R, 1)} R</b></div>`).join('')}</div></section>` : ''}
  ${r.viol.length && !r.done ? `<div class="card warn" style="margin-top:12px"><b>Règles enfreintes</b>${[...new Set(r.viol.map(v => v.t))].map(t => `<p class="small">• ${h(t)}</p>`).join('')}</div>` : ''}
  <p class="note">Entraînement sur données simulées, sans argent réel. Ce n’est pas un conseil en investissement.</p>
  </div>${dock()}`; };
function roomRecap(){ const r = S.room, f = window.__rf, c = roomPrice(f), stop = parseFloat(String(f.stop).replace(',', '.')), tg = parseFloat(String(f.target).replace(',', '.'));
  if (!(stop > 0)) return 'Place ton stop : la taille de position se calcule toute seule.';
  const d = Math.abs(c - stop), eq = rEquity(), riskEur = eq * f.risk / 100, q0 = d ? Math.floor(riskEur / d) : 0, qty = Math.min(q0, Math.floor(eq / c)), rr = tg > 0 && d ? Math.abs(tg - c) / d : 0;
  return `Taille : <b>${qty} titres</b> (≈ ${eur0(qty * c)}) · risque <b>${eur0(qty * d)}</b>${rr ? ` · ratio <b>${num(rr, 1)}</b>${rr < 1.5 ? ' ⚠' : ''}` : ''}${qty < q0 ? '<br>Taille limitée par ton capital (pas d’effet de levier ici).' : ''}`; }
function roomResult(){ const x = S.room.result;
  return `<div class="card result ${x.pass ? 'ok' : ''}"><span class="eyebrow">Note de discipline</span><div class="row" style="align-items:flex-end;gap:10px"><b class="tn" style="font-size:40px">${x.score}</b><span class="small" style="margin-bottom:8px">/ 100 · ${x.n} trades · pire baisse ${num(x.dd, 1)} % · ${x.pnl >= 0 ? '+' : ''}${eur0(x.pnl)}</span></div>
    ${Object.keys(x.types).length ? `<b style="display:block;margin-top:8px">À corriger</b>${Object.entries(x.types).map(([t, n]) => `<p class="small">• ${h(t)}${n > 1 ? ` (× ${n})` : ''}</p>`).join('')}` : '<p class="small" style="margin-top:6px">Aucune règle enfreinte. C’est exactement ce qu’on attend d’un trader.</p>'}
    ${x.n < 2 ? '<p class="small">Il faut au moins 2 trades pour valider une séance du Défi.</p>' : ''}
    <p class="small" style="margin-top:8px">${S.room.defi ? (x.pass ? `Séance du Défi réussie (${defiPassed()} / ${CF.defiSessions}).` : 'Séance du Défi non validée : note de 70 minimum et baisse maximale de 6 %.') : 'Séance libre : elle ne compte pas pour le Défi.'}</p>
    <p class="small">Le gain ou la perte d’une séance compte peu : ce qui compte, c’est de répéter les bonnes décisions.</p>
    <div id="roomAi" class="ai-exp" style="margin-top:10px"><button class="btn ghost sm" data-roomai>${I.chat}${aiOn() ? 'Débrief de Nova Coach (IA)' : 'Conseils de Nova Coach'}</button></div>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn v" data-roomnew="${S.room.defi ? 1 : 0}">Nouvelle séance</button><button class="btn ghost" data-roomquit>Retour</button></div></div>`; }

/* ---------- examens ---------- */
const EXAM_TYPES = ['qcm', 'vf', 'calc', 'candles', 'book', 'chart'];
function startExam(key){
  if (!S.premium) return openPaywall('Les examens et les Certificats NovaTitre font partie de Premium');
  if (key === 'final' && !finalReady()) return toast('Il faut d’abord les 5 certificats de niveau, le Défi Trader et ton plan validé.');
  const att = (S.exams[key] || {}).n || 0; let pool = [], n;
  if (key === 'amf'){ pool = window.NT_AMF.map((st, i) => prep(st, 'amf#' + i, att + 1, i)); n = 20; }
  else { const lvs = key === 'final' ? LV : [LV.find(l => 'lv' + l.id === key)];
    lvs.forEach(l => lvMissions(l).forEach(m => m.steps.forEach((st, i) => { if (EXAM_TYPES.includes(st.type)) pool.push(Object.assign(prep(st, m.id + '#' + i, att + 1, i), { from: m.title })); })));
    lvs.forEach(l => ((window.NT_EXAM_EXTRA || {})[l.id] || []).forEach((st, i) => pool.push(prep(st, 'x' + l.id + '#' + i, att + 1, i))));
    n = key === 'final' ? CF.finalQuestions : lvs[0].exam; }
  const steps = shuffle(pool, seedOf(key, att + 3)).slice(0, n);
  S.exams[key] = Object.assign({ best: 0 }, S.exams[key], { n: att + 1 }); save();
  const title = key === 'amf' ? 'Entraînement Certification AMF' : key === 'final' ? 'Examen final · Certificat Trader' : `Examen · Niveau ${key.slice(2)}`;
  M = { m: { id: key, title, goal: '', score: 0, cash: 0 }, mode: 'exam', key, att, steps, i: 0, ok: [], second: [], fb: null, ui: {}, ko: 0, fast: 0, combo: 0, t0: Date.now(), deadline: Date.now() + steps.length * CF.secondsPerQuestion * 1000, wrong: [] };
  renderPlayer(); examTick();
}
let EXT = null;
function examTick(){ clearInterval(EXT); EXT = setInterval(() => { if (!M || M.mode !== 'exam' || M.end){ clearInterval(EXT); return; }
  const left = Math.max(0, Math.round((M.deadline - Date.now()) / 1000)), el = $('#exTimer'); if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  if (!left){ clearInterval(EXT); toast('Temps écoulé.'); finishExam(); } }, 1000); }
function finishExam(){
  const n = M.steps.length, good = M.ok.filter(Boolean).length, pct = Math.round(good / n * 100), pass = pct >= CF.pass * 100, key = M.key, td = today();
  const ex = S.exams[key]; ex.best = Math.max(ex.best || 0, pct); ex.last = pct;
  let newCert = false;
  if (pass && key.startsWith('lv')){ const id = Number(key.slice(2)), l = LV.find(x => x.id === id);
    if (!S.certs[id]){ S.certs[id] = { date: td, pct, name: S.name || '' }; newCert = true;
      lvMissions(l).forEach(m => { if (!isDone(m.id)){ S.skip[m.id] = 1; S.score = Math.min(1000, S.score + Math.round(m.score * 0.8)); } }); }
    else S.certs[id].pct = Math.max(S.certs[id].pct, pct); }
  if (pass && key === 'final' && !S.certs.trader){ S.certs.trader = { date: td, pct, name: S.name || '' }; newCert = true; }
  save(); clearInterval(EXT);
  M.end = { exam: true, n, good, pct, pass, newCert }; renderPlayer(); sfx(pass ? 'win' : 'ko');
}
function examDebrief(){ const e = M.end, key = M.key;
  return `<div class="debrief">${e.pass ? `<div class="burst">${Array.from({ length: 14 }, (_, k) => `<i class="cf" style="--a:${k * 360 / 14}deg;--c:${PC[k % PC.length]}"></i>`).join('')}<div>${I.trophy}</div></div>` : `<div class="burst"><div>${I.book}</div></div>`}
    <span class="eyebrow">${h(M.m.title)}</span><h1 style="font-size:30px">${e.pct} %</h1>
    <p class="muted" style="max-width:36ch">${e.good} / ${e.n} bonnes réponses. ${e.pass ? (key === 'amf' ? 'Très bon niveau d’entraînement.' : e.newCert ? 'Examen réussi : ton certificat est prêt.' : 'Examen réussi.') : `Il faut ${Math.round(CF.pass * 100)} %. Relis les fiches liées et réessaie : les questions changent à chaque fois.`}</p>
    ${e.newCert ? `<button class="btn v full" data-certview="${key === 'final' ? 'trader' : key.slice(2)}">Voir mon certificat</button>` : ''}
    ${M.wrong.length ? `<div class="card" style="width:100%;text-align:left"><b>À retravailler</b>${M.wrong.slice(0, 8).map(w => `<div class="wrong"><p class="small" style="color:#fff">${h(w.q)}</p><p class="small">${h(w.explain)}</p>${w.fiche ? `<button class="link" data-fiche="${w.fiche}">Relire la fiche</button>` : ''}</div>`).join('')}</div>` : ''}
    <button class="btn ${e.newCert ? 'ghost' : 'v'} full" data-exam="${key}">${e.pass ? 'Repasser' : 'Réessayer'}</button>
    <button class="btn ghost full" data-quit>Retour</button></div>`; }

/* ---------- certificats ---------- */
const CERTS = () => LV.map(l => ({ k: String(l.id), title: `Niveau ${l.id} · ${l.title}`, sub: l.sub, c: S.certs[l.id] })).concat([{ k: 'trader', title: 'Certificat Trader NovaTitre', sub: '5 niveaux + Défi Trader + plan de trading + examen final', c: S.certs.trader, final: true }]);
PAGES.certs = () => `<div class="wrap">${top()}<button class="btn ghost sm" data-go="profile">${I.back}Profil</button>
  <div class="sec-h" style="margin-top:14px"><h2 style="font-size:24px">Mes certificats</h2><span>${Object.keys(S.certs).length} / ${LV.length + 1}</span></div>
  <p class="small">Chaque certificat se vérifie en ligne avec son code. Tu peux l’ajouter à ton CV ou sur LinkedIn.</p>
  <div class="card" style="margin-top:12px"><label for="cname" class="small">Ton nom pour les prochains certificats (il est figé sur chaque certificat obtenu)</label><div class="row" style="gap:8px;margin-top:6px"><input id="cname" class="field" value="${h(S.name || '')}" placeholder="Prénom Nom" autocomplete="name"><button class="btn sm v" data-savename>Enregistrer</button></div></div>
  <div style="margin-top:12px">${CERTS().map(x => `<div class="certrow ${x.c ? 'ok' : ''}"><span class="ci">${x.c ? I.trophy : I.lock}</span><span class="grow"><b>${h(x.title)}</b><span class="small">${x.c ? `Obtenu le ${x.c.date.split('-').reverse().join('/')} · ${x.c.pct} %` : h(x.sub)}</span></span>
    ${x.c ? `<button class="btn sm ghost" data-certview="${x.k}">Voir</button>` : x.final ? `<button class="btn sm ${finalReady() ? 'v' : 'ghost'}" data-exam="final"${finalReady() ? '' : ' disabled'}>Examen final</button>` : `<button class="btn sm ghost" data-exam="lv${x.k}">Passer</button>`}</div>`).join('')}</div>
  <div class="card" style="margin-top:12px"><b>Pour le Certificat Trader</b>
    ${[[LV.every(l => S.certs[l.id]), `Les 5 certificats de niveau (${LV.filter(l => S.certs[l.id]).length}/5)`, 'missions'], [defiOK(), `Défi Trader : ${defiPassed()}/${CF.defiSessions} séances réussies, moyenne ${defiAvg() || '—'}/100 (${CF.defiAvg} demandés)`, 'room'], [!!(S.plan && S.plan.ok), 'Plan de trading validé par Nova Coach', 'plan'], [!!S.certs.trader, 'Examen final (30 questions)', 'certs']].map(([ok, t, g]) => `<button class="req ${ok ? 'ok' : ''}" data-go="${g}"><span>${ok ? I.check : I.clock}</span>${h(t)}</button>`).join('')}</div>
  <p class="note">Certificats privés délivrés par NovaTitre. Ce ne sont pas des diplômes d’État ni des titres enregistrés au RNCP. Ils attestent la réussite des examens NovaTitre.</p>
  ${legal()}</div>${dock()}`;
function certView(k){ const isT = k === 'trader', l = isT ? null : LV.find(x => String(x.id) === String(k)), c = S.certs[isT ? 'trader' : l.id]; if (!c) return;
  const nm = c.name || '', code = certCode(k + '|' + nm, c.date);
  openSheet(`<div class="certpaper"><div class="cp-top">${I.logo}<span>NovaTitre</span></div>
    <span class="cp-k">Certificat NovaTitre</span><h2>${isT ? 'Trader NovaTitre' : `Niveau ${l.id} · ${h(l.title)}`}</h2>
    <p class="cp-l">délivré à</p><p class="cp-name">${h(nm || 'Nom à fixer')}</p>
    <p class="cp-l">${isT ? 'pour la réussite des 5 niveaux, du Défi Trader, du plan de trading et de l’examen final' : `pour la réussite de l’examen du niveau ${l.id} : ${h(l.sub)}`}</p>
    <div class="cp-row"><div><span>Date</span><b>${c.date.split('-').reverse().join('/')}</b></div><div><span>Résultat</span><b>${c.pct} %</b></div><div><span>Code</span><b>${code}</b></div></div>
    <p class="cp-v">Vérifier : novatitre.com/verifier/${code}</p>
    <p class="cp-m">Certificat privé délivré par NovaTitre. Ce n’est pas un diplôme d’État.</p></div>
    ${nm ? '<p class="small" style="margin-top:10px">Le nom est figé sur ce certificat : il ne peut plus être modifié.</p>' : S.name ? `<button class="btn ghost full" style="margin-top:10px" data-certname="${k}">Fixer « ${h(S.name)} » sur ce certificat (définitif)</button>` : '<p class="small" style="margin-top:10px">Ajoute ton nom dans « Mes certificats » pour pouvoir le fixer sur ce certificat.</p>'}
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn v" data-print>Imprimer / PDF</button><button class="btn ghost" data-sheetclose>Fermer</button></div>
    <p class="note">Prototype : la page de vérification sera créée sur le site (lecture seule, sans données personnelles autres que le nom).</p>`, 'cert-sheet'); }

/* ---------- plan de trading (l'« oral » avec Nova Coach) ---------- */
const PLAN_F = [['style', 'Mon style'], ['marches', 'Mes marchés'], ['horaires', 'Mes horaires'], ['risque', 'Risque par trade (%)'], ['perteJour', 'Perte maximale par jour (%)'], ['entree', 'Mes conditions d’entrée'], ['stop', 'Où je place mon stop'], ['sortie', 'Quand je sors (objectif, sortie)']];
PAGES.plan = () => { const p = (S.plan && S.plan.data) || {}, fb = S.plan && S.plan.fb;
  return `<div class="wrap">${top()}<button class="btn ghost sm" data-go="certs">${I.back}Certificats</button>
  <div style="margin-top:14px"><span class="eyebrow">${I.chat} Avec Nova Coach</span><h1 style="font-size:26px;margin-top:6px">Mon plan de trading</h1>
  <p class="small" style="margin-top:6px">Écris ton plan comme un pro. Nova Coach le vérifie comme lors d’un oral. Dans la version finale, tu le défendras à l’écrit et à l’oral face à l’IA.</p></div>
  <form class="form card" id="planF" style="margin-top:12px">
    <label for="p_style">Mon style</label><select id="p_style">${['Swing trading', 'Day trading', 'Investissement', 'Scalping'].map(x => `<option${p.style === x ? ' selected' : ''}>${x}</option>`).join('')}</select>
    <label for="p_marches">Mes marchés</label><input id="p_marches" value="${h(p.marches || '')}" placeholder="ex. 10 grandes actions européennes liquides">
    <label for="p_horaires">Mes horaires</label><input id="p_horaires" value="${h(p.horaires || '')}" placeholder="ex. le soir après 19 h, ordres posés à l’avance">
    <div class="grid2"><div><label for="p_risque">Risque par trade (%)</label><input id="p_risque" inputmode="decimal" value="${h(p.risque || '')}" placeholder="ex. 1"></div><div><label for="p_perteJour">Perte max par jour (%)</label><input id="p_perteJour" inputmode="decimal" value="${h(p.perteJour || '')}" placeholder="ex. 3"></div></div>
    <label for="p_entree">Mes conditions d’entrée</label><textarea id="p_entree" rows="3" placeholder="Ce qui doit se passer exactement pour que j’entre">${h(p.entree || '')}</textarea>
    <label for="p_stop">Où je place mon stop</label><textarea id="p_stop" rows="2" placeholder="ex. sous le dernier creux ou sous le support">${h(p.stop || '')}</textarea>
    <label for="p_sortie">Quand je sors</label><textarea id="p_sortie" rows="2" placeholder="ex. objectif à 2 fois le risque, ou clôture sous la moyenne 20">${h(p.sortie || '')}</textarea>
    <fieldset class="checks"><legend>Mes règles de discipline</legend>${[['pause', 'Pause après 3 pertes d’affilée'], ['annonce', 'Pas de nouvelle position juste avant une grosse annonce'], ['journal', 'Je note chaque trade dans mon journal'], ['jamaisStop', 'Je n’éloigne jamais mon stop'], ['fatigue', 'Je ne trade pas fatigué ou énervé']].map(([k, t]) => `<label class="chk"><input type="checkbox" id="p_${k}"${p[k] ? ' checked' : ''}> ${t}</label>`).join('')}</fieldset>
    <button class="btn v full" style="margin-top:8px">Faire vérifier par Nova Coach</button></form>
  ${fb ? `<div class="card ${S.plan.ok ? 'result ok' : 'warn'}" style="margin-top:12px"><b>${S.plan.ok ? `${I.check} Plan validé` : 'À améliorer avant validation'}</b>${fb.map(([ok, t]) => `<p class="small">${ok ? '✓' : '✗'} ${h(t)}</p>`).join('')}</div>
  ${aiOn() ? `<div class="card" style="margin-top:12px"><b>${I.chat} L’oral avec Nova Coach (IA)</b><p class="small" style="margin-top:4px">Nova Coach lit ton plan comme un examinateur et te pose des questions de relance.</p><div id="planAi" class="ai-exp" style="margin-top:8px"><button class="btn v sm" data-planai>Passer l’oral</button></div></div>` : ''}` : ''}
  <p class="note">Ton plan reste privé. Nova Coach vérifie la cohérence et la gestion du risque ; il ne te dit pas quoi acheter.</p>
  ${legal()}</div>${dock()}`; };
function checkPlan(){ const v = id => ($('#p_' + id) || {}).value || '', ck = id => !!($('#p_' + id) || {}).checked;
  const d = { style: v('style'), marches: v('marches').trim(), horaires: v('horaires').trim(), risque: v('risque'), perteJour: v('perteJour'), entree: v('entree').trim(), stop: v('stop').trim(), sortie: v('sortie').trim(), pause: ck('pause'), annonce: ck('annonce'), journal: ck('journal'), jamaisStop: ck('jamaisStop'), fatigue: ck('fatigue') };
  const r = parseFloat(String(d.risque).replace(',', '.')), pj = parseFloat(String(d.perteJour).replace(',', '.')), nRules = ['pause', 'annonce', 'journal', 'jamaisStop', 'fatigue'].filter(k => d[k]).length;
  const fb = [
    [r > 0 && r <= 2, r > 0 ? (r <= 1 ? `Risque de ${r} % par trade : prudent, c’est la norme des pros.` : r <= 2 ? `Risque de ${r} % : acceptable, 1 % est plus confortable pour durer.` : `Risque de ${r} % par trade : trop élevé. 10 pertes d’affilée feraient perdre beaucoup trop.`) : 'Indique ton risque par trade en %.'],
    [pj > 0 && pj <= 5 && (!(r > 0) || pj >= r), pj > 0 ? (pj <= 5 ? `Perte maximale par jour de ${pj} % : tu sais quand t’arrêter.` : `Perte maximale de ${pj} % par jour : trop large.`) : 'Fixe une perte maximale par jour.'],
    [d.marches.length >= 8, d.marches.length >= 8 ? 'Marchés définis.' : 'Précise sur quels marchés tu trades (peu, et liquides).'],
    [d.horaires.length >= 5 && !(d.style === 'Scalping' && /soir|week|19|20|21/i.test(d.horaires)), d.style === 'Scalping' && /soir|week|19|20|21/i.test(d.horaires) ? 'Le scalping demande d’être présent pendant les heures de marché : style et horaires ne collent pas.' : d.horaires.length >= 5 ? 'Horaires cohérents avec ton style.' : 'Indique quand tu trades.'],
    [d.entree.length >= 25, d.entree.length >= 25 ? 'Conditions d’entrée écrites.' : 'Tes conditions d’entrée doivent être précises : qu’est-ce qui doit se passer exactement ?'],
    [/creux|support|sommet|résistance|resistance|niveau|sous|au-dessus|atr|%/i.test(d.stop), /creux|support|sommet|résistance|resistance|niveau|sous|au-dessus|atr|%/i.test(d.stop) ? 'Stop placé derrière un niveau logique.' : 'Explique où tu places ton stop (ex. sous le dernier creux, sous un support).'],
    [d.sortie.length >= 10, d.sortie.length >= 10 ? 'Règle de sortie définie.' : 'Indique quand tu prends tes gains ou sors.'],
    [nRules >= 3, nRules >= 3 ? `${nRules} règles de discipline : solide.` : 'Choisis au moins 3 règles de discipline.'],
  ];
  const ok = fb.every(x => x[0]); S.plan = { data: d, fb, ok, date: today() }; save(); sfx(ok ? 'win' : 'ko'); render(); toast(ok ? 'Plan validé par Nova Coach.' : 'Quelques points à améliorer.'); }

/* ---------- prépa Certification AMF ---------- */
PAGES.amf = () => { const ex = S.exams.amf;
  return `<div class="wrap">${top()}
  <div class="tabs" role="tablist"><button role="tab" data-go="cours" aria-selected="false">Fiches</button><button role="tab" data-gotab="glossaire" aria-selected="false">Glossaire</button><button role="tab" data-go="amf" aria-selected="true">Prépa AMF</button></div>
  <div style="margin-top:14px"><span class="eyebrow">${I.shield} Bonus · métiers de la finance</span><h1 style="font-size:26px;margin-top:6px">Prépa Certification AMF</h1>
  <p class="small" style="margin-top:6px">La Certification AMF est un vrai examen officiel, demandé pour de nombreux métiers de la finance (conseil, vente, gestion). C’est un QCM de 120 questions, à passer dans un organisme certifié par l’AMF.</p></div>
  <div class="card" style="margin-top:12px"><b>Ici, tu t’entraînes</b><ul class="rules"><li>20 questions tirées au hasard</li><li>Thèmes : autorités, abus de marché, blanchiment, MIF 2, fonds, garanties, marchés</li><li>20 minutes · objectif 80 %</li></ul>
    ${ex ? `<p class="small">Meilleur score : <b class="tn">${ex.best} %</b> · ${ex.n} essai${ex.n > 1 ? 's' : ''}</p>` : ''}
    <button class="btn v full" style="margin-top:10px" data-exam="amf">Lancer l’entraînement</button></div>
  <p class="note">Entraînement NovaTitre non officiel, inspiré des grands thèmes de l’examen. Il ne remplace pas la préparation d’un organisme certifié et ne donne pas la Certification AMF.</p>
  ${legal()}</div>${dock()}`; };

/* ============================================================
   SUIVI PERSONNALISÉ PAR L'IA (Nova Coach)
   ============================================================ */
const AI = window.NT_AI;
const aiOn = () => AI && AI.mode !== 'local';
const minorMode = () => S.audience === 'campus' && S.minors !== false;
const aiLabel = () => !AI ? 'Analyse automatique' : AI.mode === 'claude' ? 'IA : Claude' : AI.mode === 'api' ? 'IA NovaTitre' : 'Analyse automatique';
/* statistiques d'apprentissage (jamais de nom) */
function track(st, ok, mid){
  if (!mid) return; S.st = S.st || {}; const x = S.st[mid] || [0, 0]; x[0]++; if (ok) x[1]++; S.st[mid] = x;
  if (!ok && st.q){ S.errs = (S.errs || []).concat([{ mid, q: String(st.q).slice(0, 140), d: today() }]).slice(-40); }
  S.tod = S.tod || {}; const hr = new Date().getHours(); S.tod[hr] = (S.tod[hr] || 0) + 1;
}
function learnerProfile(){
  const chs = CH.map(c => { let n = 0, ok = 0; chMissions(c.id).forEach(m => { const x = (S.st || {})[m.id]; if (x){ n += x[0]; ok += x[1]; } });
    return { chapitre: c.id, titre: c.title, progression: Math.round(chProgress(c.id) * 100), reponses: n, reussite: n ? Math.round(ok / n * 100) : null, ouvert: chUnlocked(c.id) && !chPremium(c.id) }; });
  const rooms = S.roomHist || [], viol = {}; rooms.forEach(r => Object.entries(r.types || {}).forEach(([t, k]) => viol[t] = (viol[t] || 0) + k));
  const d7 = Object.keys(S.dayCount || {}).filter(d => d > addDays(today(), -7)).length;
  const hrs = Object.entries(S.tod || {}).sort((a, b) => b[1] - a[1]);
  let tn = 0, tok = 0; Object.values(S.st || {}).forEach(x => { tn += x[0]; tok += x[1]; });
  return { objectif: S.goal, duree_preferee: S.pace, niveau_test_de_depart: S.placement, nova_score: S.score, rang: rankOf(S.score).r.name, serie_jours: S.streak,
    jours_actifs_sur_7: d7, heure_habituelle: hrs[0] ? hrs[0][0] + ' h' : null, missions_terminees: Object.keys(S.done).length, missions_validees_sans_les_faire: Object.keys(S.skip).length,
    reussite_globale: tn ? Math.round(tok / tn * 100) : null, reponses_totales: tn,
    chapitres: chs.filter(c => c.reponses || c.progression), notions_bloquees: stuckList().map(x => qText(x.key).slice(0, 100)).slice(0, 5), erreurs_recentes: (S.errs || []).slice(-12).map(e => e.q), revisions_en_attente: (S.reviews || []).length,
    examens: Object.fromEntries(Object.entries(S.exams || {}).map(([k, v]) => [k, { meilleur: v.best, essais: v.n }])), certificats: Object.keys(S.certs || {}),
    salle_de_marche: { seances: rooms.length, note_moyenne: rooms.length ? Math.round(rooms.reduce((a, r) => a + r.score, 0) / rooms.length) : null, regles_enfreintes: viol, defi_reussi: defiOK() },
    plan_de_trading_valide: !!(S.plan && S.plan.ok), profil_declare: S.profile && !minorMode() ? Object.fromEntries(Object.entries(S.profile).map(([k, v]) => [k, Array.isArray(v) ? v.map(x => PQ_LABEL(k, x)) : PQ_LABEL(k, v)])) : null, plan_actuel: S.plan2 ? S.plan2.plan.map(x => 'chapitre ' + x.ch) : null };
}
/* Analyse automatique (sans IA) : mêmes rubriques que l'IA */
function localReport(p){
  const touched = p.chapitres.filter(c => c.reponses >= 3);
  const forts = touched.filter(c => c.reussite >= 80).sort((a, b) => b.reussite - a.reussite).slice(0, 3);
  const faibles = touched.filter(c => c.reussite < 70).sort((a, b) => a.reussite - b.reussite).slice(0, 3);
  const plan = [];
  if (p.revisions_en_attente) plan.push({ titre: 'Faire ta révision express', pourquoi: `${p.revisions_en_attente} notion${p.revisions_en_attente > 1 ? 's' : ''} ratée${p.revisions_en_attente > 1 ? 's' : ''} à revoir au bon moment.`, type: 'revision' });
  if (faibles[0]){ const f = CO.find(x => x.ch === faibles[0].chapitre); if (f) plan.push({ titre: `Relire « ${f.title} »`, pourquoi: `Chapitre ${faibles[0].chapitre} : ${faibles[0].reussite} % de réussite, c’est ton point le plus fragile.`, type: 'fiche', id: f.id }); }
  const vi = Object.entries(p.salle_de_marche.regles_enfreintes).sort((a, b) => b[1] - a[1])[0];
  if (vi) plan.push({ titre: 'Une séance en salle de marché, avec une seule règle en tête', pourquoi: `Règle la plus souvent oubliée : « ${vi[0]} ».`, type: 'salle' });
  const lv = LV.find(l => !S.certs[l.id] && lvProgress(l) >= 0.7);
  if (lv) plan.push({ titre: `Passer l’examen du niveau ${lv.id}`, pourquoi: `Tu as fait ${Math.round(lvProgress(lv) * 100)} % du niveau : tu es prêt.`, type: 'examen', id: 'lv' + lv.id });
  const nm = suggest()[0]; if (nm) plan.push({ titre: `Mission : ${nm.title}`, pourquoi: 'La suite logique de ton parcours.', type: 'mission', id: nm.id });
  const resume = !p.reponses_totales ? 'Tu débutes : fais quelques missions et ton suivi se remplira tout seul.'
    : `${p.reponses_totales} réponses, ${p.reussite_globale} % de réussite. ${p.jours_actifs_sur_7 >= 4 ? 'Ta régularité est excellente.' : p.jours_actifs_sur_7 >= 2 ? 'Bonne régularité, continue.' : 'Essaie de revenir un peu chaque jour : 1 mission suffit.'}`;
  return { resume, forces: forts.map(c => `« ${c.titre} » : ${c.reussite} % de réussite.`), a_travailler: faibles.map(c => `« ${c.titre} » : ${c.reussite} % de réussite.`), plan: plan.slice(0, 3), encouragement: 'Chaque mission compte : la régularité bat l’intensité.', local: true };
}
function aiCatalog(){
  const ms = MS.filter(m => !isDone(m.id) && chUnlocked(m.ch) && !chPremium(m.ch)).slice(0, 25).map(m => `${m.id} | ch.${m.ch} | ${m.title}`).join('\n');
  return `MISSIONS DISPONIBLES (id | chapitre | titre) :\n${ms || '(aucune)'}\nFICHES DE COURS (id | titre) :\n${CO.map(f => `${f.id} | ${f.title}`).join('\n')}\nEXAMENS NON RÉUSSIS : ${LV.filter(l => !S.certs[l.id]).map(l => 'lv' + l.id).join(', ') || '(aucun)'}`;
}
function validAction(a){ if (!a || !a.type) return false;
  if (a.type === 'mission') return !!(MS.find(m => m.id === a.id) || POOL.find(m => m.id === a.id));
  if (a.type === 'fiche') return !!CO.find(f => f.id === a.id);
  if (a.type === 'examen') return /^lv[1-5]$/.test(a.id || '');
  return a.type === 'salle' || a.type === 'revision'; }
let AIC = null;   // appel en cours
async function aiReport(){
  if (AIC) return; const p = learnerProfile(); AIC = new AbortController(); S.aiBusy = true; render();
  const prompt = `Voici les statistiques d'apprentissage d'un élève (aucune donnée personnelle) :\n${JSON.stringify(p)}\n\n${aiCatalog()}\n\nFais son bilan personnalisé de la semaine. Appuie-toi sur les chiffres. Réponds UNIQUEMENT avec un objet JSON de cette forme :\n{"resume":"2 ou 3 phrases","forces":["..."],"a_travailler":["..."],"plan":[{"titre":"court","pourquoi":"1 phrase","type":"mission|fiche|salle|examen|revision","id":"identifiant exact pris dans les listes, ou vide pour salle/revision"}],"encouragement":"1 phrase"}\nLe plan contient exactement 3 actions concrètes, dans l'ordre où les faire. Maximum 3 forces et 3 points à travailler.`;
  try { const r = await AI.ask(prompt, { json: true, signal: AIC.signal, task: 'bilan', nocache: true });
    r.plan = (Array.isArray(r.plan) ? r.plan : []).filter(validAction).slice(0, 3); r.forces = (r.forces || []).slice(0, 3); r.a_travailler = (r.a_travailler || []).slice(0, 3);
    S.aiReport = Object.assign(r, { date: today() }); toast('Bilan de Nova Coach prêt.'); }
  catch (e){ const t = AI.errorText(e); if (t) toast(t); }
  AIC = null; S.aiBusy = false; save(); render(); }
const actBtn = a => a.type === 'mission' ? `data-play="${a.id}"` : a.type === 'fiche' ? `data-fiche="${a.id}"` : a.type === 'examen' ? `data-exam="${a.id}"` : a.type === 'salle' ? 'data-go="room"' : 'data-review';
PAGES.monplan = () => `<div class="wrap">${top()}${S.justOnb ? `<div class="onb-hero"><span class="eyebrow">${I.check} C’est prêt</span><h1>Ton parcours sur mesure</h1><p class="muted">Fait à partir de tes réponses. Explore l’application, puis lance ton parcours quand tu veux.</p><button class="btn v full big" data-discover>Découvrir NovaTitre</button></div>` : `<button class="btn ghost sm" data-go="profile">${I.back}Profil</button>`}${S.plan2 ? planHTML() : '<div class="card" style="margin-top:14px"><p class="small">Pas encore de plan.</p><button class="btn v sm" style="margin-top:10px" data-redoprofile>Faire mon profil</button></div>'}${legal()}</div>${dock()}`;
PAGES.suivi = () => { const p = learnerProfile(), rep = S.aiReport || localReport(p), isAI = !!S.aiReport;
  const bars = p.chapitres.filter(c => c.reponses);
  return `<div class="wrap">${top()}<button class="btn ghost sm" data-go="home">${I.back}Accueil</button>
  <div class="row" style="justify-content:space-between;margin-top:14px;align-items:flex-start"><div><span class="eyebrow">${I.chat} Nova Coach</span><h1 style="font-size:26px;margin-top:6px">Mon suivi personnalisé</h1></div><span class="chip ${aiOn() ? 'v' : ''}">${aiLabel()}</span></div>
  <div class="grid2" style="margin-top:12px"><div class="stat"><b class="tn">${p.reussite_globale ?? '—'}${p.reussite_globale != null ? ' %' : ''}</b><span>Réussite</span></div><div class="stat"><b class="tn">${p.jours_actifs_sur_7}/7</b><span>Jours actifs</span></div>
    <div class="stat"><b class="tn">${p.missions_terminees}</b><span>Missions faites</span></div><div class="stat"><b class="tn">${p.salle_de_marche.note_moyenne ?? '—'}</b><span>Discipline (salle)</span></div></div>
  ${stuckSuivi()}
  ${bars.length ? `<section class="sec"><div class="sec-h"><h2>Ma réussite par chapitre</h2></div><div class="card">${bars.map(c => `<div style="padding:7px 0"><div class="row" style="justify-content:space-between"><span style="font-size:13.5px;font-weight:700">${c.chapitre}. ${h(c.titre)}</span><span class="small tn" style="color:${c.reussite >= 80 ? 'var(--green)' : c.reussite < 65 ? 'var(--red)' : 'var(--fg2)'}">${c.reussite} %</span></div><div class="bar" style="margin-top:5px"><i style="width:${c.reussite}%;background:${c.reussite >= 80 ? 'var(--green)' : c.reussite < 65 ? 'var(--red)' : 'var(--violet)'}"></i></div></div>`).join('')}</div></section>` : ''}
  <section class="sec"><div class="sec-h"><h2>${isAI ? 'Le bilan de Nova Coach' : 'Mon bilan'}</h2><span>${isAI ? 'IA · ' + rep.date.split('-').reverse().join('/') : 'automatique'}</span></div>
    <div class="card ai-card${isAI ? ' is-ai' : ''}">${S.aiBusy ? `<p class="thinking">${I.chat} Nova Coach analyse ta progression…</p><button class="btn ghost sm" data-aistop>Arrêter</button>` : `
      <p class="fiche-p" style="margin-top:0">${h(rep.resume)}</p>
      ${rep.forces && rep.forces.length ? `<b class="ai-h" style="color:var(--green)">Tes points forts</b><ul class="ai-ul">${rep.forces.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
      ${rep.a_travailler && rep.a_travailler.length ? `<b class="ai-h" style="color:var(--amber)">À travailler</b><ul class="ai-ul">${rep.a_travailler.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
      ${rep.encouragement ? `<p class="small" style="margin-top:10px">${h(rep.encouragement)}</p>` : ''}`}</div>
    ${!S.aiBusy ? (aiOn() ? `<button class="btn v full" style="margin-top:10px" data-aireport>${I.chat}${isAI ? 'Refaire mon bilan avec l’IA' : 'Demander mon bilan à Nova Coach (IA)'}</button>` : `<p class="note">L’IA n’est pas branchée sur cette version : ce bilan est calculé automatiquement. Sur le site NovaTitre et dans la page publiée sur Claude, Nova Coach fait un vrai bilan personnalisé.</p>`) : ''}</section>
  <section class="sec"><div class="sec-h"><h2>Mon plan pour cette semaine</h2></div>
    ${(rep.plan || []).length ? rep.plan.map((a, i) => `<div class="plan-step"><span class="ps-n">${i + 1}</span><div class="grow"><b>${h(a.titre)}</b><span class="small">${h(a.pourquoi || '')}</span></div><button class="btn sm v" ${actBtn(a)}>Go</button></div>`).join('') : '<div class="card"><p class="small">Fais quelques missions : ton plan apparaîtra ici.</p></div>'}</section>
  <p class="note">Nova Coach ne reçoit ni ton nom ni ton adresse : seulement tes statistiques d’apprentissage. Il t’aide à progresser, il ne donne pas de conseil en investissement.</p>
  ${legal()}</div>${dock()}`; };

/* Coach : vraie conversation quand l'IA est là */
async function askCoachAI(q){
  S.coach.push({ me: 1, t: q }); S.coach = S.coach.slice(-30); save(); render();
  const msgs = $('#cmsgs'); const bub = document.createElement('div'); bub.className = 'bub them'; bub.innerHTML = '<small>Nova Coach</small><span class="thinking">Nova Coach réfléchit…</span>'; msgs.appendChild(bub); bub.scrollIntoView({ block: 'end' });
  const p = learnerProfile(), ctx = `Contexte de l'élève (statistiques, sans données personnelles) : réussite ${p.reussite_globale ?? '?'} %, rang ${p.rang}, chapitres en cours : ${p.chapitres.filter(c => c.progression < 100 && c.ouvert).slice(0, 4).map(c => c.titre).join(', ') || 'début'}, erreurs récentes : ${p.erreurs_recentes.slice(-4).join(' / ') || 'aucune'}.
${aiCatalog()}
${minorMode() ? 'L’élève est peut-être mineur : réponds uniquement aux questions de cours, sans parler d’argent réel, de produits à acheter ni de sujets personnels ; sinon, ramène poliment vers le cours. ' : ''}Réponds à la dernière question de l'élève en 120 mots maximum. Quand c'est utile, termine par UNE suggestion de l'école sous la forme exacte [[mission:ID]] ou [[fiche:ID]] avec un identifiant pris dans les listes.`;
  const turns = S.coach.slice(-10).map(m => ({ role: m.me ? 'user' : 'assistant', content: m.t }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  const sp = bub.querySelector('span');
  try { if (AUTH.cfg() && !S.account) throw { code: 'login' };
    const t = await AI.ask(ctx, { turns, nocache: true, task: 'coach', onText: ({ text }) => { sp.className = ''; sp.textContent = text.replace(/\[\[(mission|fiche):[^\]]+\]\]/g, ''); } });
    S.coach.push({ me: 0, t }); }
  catch (e){ const a = (COACH.find(([re]) => re.test(q)) || [null, e && e.code === 'login' ? 'Connecte-toi pour parler à Nova Coach. [[connexion]]' : AI.errorText(e) || 'Je n’ai pas pu répondre. Réessaie.'])[1]; S.coach.push({ me: 0, t: a }); }
  S.coach = S.coach.slice(-30); save(); render(); setTimeout(() => { const c = $('#cmsgs'); if (c) c.lastElementChild.scrollIntoView({ block: 'end' }); }, 30);
}
function coachText(t){ let out = h(t).replace('[[connexion]]', `<button class="btn ghost sm cbtn" data-go="connexion">Se connecter</button>`); out = out.replace(/\[\[(mission|fiche):([\w-]+)\]\]/g, (_, k, id) => { const ok = k === 'mission' ? MS.find(m => m.id === id) || POOL.find(m => m.id === id) : CO.find(f => f.id === id); if (!ok) return '';
  return `<button class="btn ghost sm cbtn" ${k === 'mission' ? `data-play="${id}"` : `data-fiche="${id}"`}>${k === 'mission' ? I.play : I.book}${h(ok.title)}</button>`; }); return out; }

/* « Explique-moi autrement » après une erreur */
async function explainAI(){
  const st = M.steps[M.i], el = $('#aiExp'); if (!st || !el) return;
  if (!aiOn()){ const f = ficheFor((st.key || '').split('#')[0]); el.innerHTML = f ? `<button class="link" data-fiche="${f.id}">Relire la fiche « ${h(f.title)} »</button>` : ''; return; }
  el.innerHTML = '<span class="thinking">Nova Coach cherche une autre façon d’expliquer…</span>';
  const good = st.choices ? st.choices[st.answer] : st.type === 'vf' ? (st.answer ? 'Vrai' : 'Faux') : st.type === 'calc' ? st.answer + ' ' + (st.unit || '') : '';
  const prompt = `Un élève s'est trompé à cet exercice.\nQuestion : ${st.q || st.title || ''}\n${st.choices ? 'Choix : ' + st.choices.join(' | ') + '\n' : ''}${M.fb && M.fb.mine ? 'Sa réponse : ' + M.fb.mine + '\n' : ''}${good ? 'Bonne réponse : ' + good + '\n' : ''}Explication du cours : ${st.explain}\n\nExplique autrement, en 3 phrases maximum, avec un exemple concret de la vie de tous les jours, puis une astuce pour s'en souvenir commençant par « Astuce : ». Pas de titre, pas de liste.`;
  try { await AI.ask(prompt, { tier: 'quick', task: 'explique', onText: ({ text }) => { el.textContent = text; } }); }
  catch (e){ el.textContent = AI.errorText(e); }
}
/* Analyse du journal de la salle de marché */
async function roomAI(){
  const r = S.room, el = $('#roomAi'); if (!r || !el) return;
  if (!aiOn()){ el.innerHTML = `<p class="small">${roomTips(r.result.types)}</p>`; return; }
  el.innerHTML = '<p class="thinking">Nova Coach lit ton journal…</p>';
  const data = { note: r.result.score, baisse_max_pct: Math.round(r.result.dd * 10) / 10, resultat_eur: Math.round(r.result.pnl), regles_enfreintes: r.result.types, trades: r.trades.map(t => ({ sens: t.side, raison: t.reason, sortie: t.why, R: Math.round(t.R * 10) / 10, bougie: t.at })) };
  try { await AI.ask(`Voici le journal d'une séance d'entraînement en salle de marché (données simulées, argent fictif) :\n${JSON.stringify(data)}\n\nFais un débrief de coach en 5 phrases maximum : ce qui était discipliné, ce qui coince (en citant les trades), et UNE règle simple à ajouter à son plan. Juge la discipline, pas le gain. Pas de titre.`, { task: 'salle', onText: ({ text }) => { el.innerHTML = `<p class="fiche-p" style="margin-top:6px">${h(text)}</p>`; } }); }
  catch (e){ el.innerHTML = `<p class="small">${h(AI.errorText(e))} ${roomTips(r.result.types)}</p>`; }
}
function roomTips(types){ const k = Object.keys(types || {}); if (!k.length) return 'Aucune règle enfreinte : garde exactement cette routine.';
  const tips = { 'Risque supérieur à 2 % du capital': 'Bloque ton risque à 1 % : c’est ce qui te garde dans la partie.', 'Trade sans objectif de sortie': 'Écris ton objectif AVANT d’entrer.', 'Ratio gain/risque inférieur à 1,5': 'Ne prends que les trades où tu peux gagner au moins 1,5 fois ton risque.', 'Trade de revanche (juste après une perte)': 'Après une perte, attends 3 bougies avant de reprendre un trade.', 'Trade après la perte maximale de la séance (−3 %)': 'À −3 %, la séance est finie, sans exception.', 'Trade sans raison écrite dans le plan': 'Pas de raison écrite, pas de trade.', 'Trop de trades dans la séance (plus de 8)': 'Moins de trades, mieux choisis.', 'Tentative d’éloigner le stop': 'Ton stop est une promesse : on ne l’éloigne jamais.' };
  return k.map(t => tips[t] || '').filter(Boolean).join(' '); }
/* Oral du plan de trading */
async function planAI(){
  const el = $('#planAi'); if (!el || !S.plan) return;
  el.innerHTML = '<p class="thinking">Nova Coach lit ton plan…</p>';
  try { await AI.ask(`Voici le plan de trading écrit par un élève (entraînement sur simulateur) :\n${JSON.stringify(S.plan.data)}\n\nJoue l'examinateur d'un oral bienveillant mais exigeant. En 6 phrases maximum : 2 points solides, 2 faiblesses ou incohérences concrètes, puis 2 questions de relance précises auxquelles il devra savoir répondre. Ne recommande aucun titre réel.`, { task: 'plan', nocache: true, onText: ({ text }) => { el.innerHTML = `<p class="fiche-p" style="margin-top:6px">${h(text)}</p>`; } }); }
  catch (e){ el.innerHTML = `<p class="small">${h(AI.errorText(e))}</p>`; }
}

/* ============================================================
   LE TEMPLE (emblème de NovaTitre)
   ============================================================ */
const LOGO_PATHS = `<path d="M 770,180 L 781,283 L 781,293 L 783,303 L 784,324 L 802,500 L 803,521 L 808,559 L 808,569 L 810,583 L 815,594 L 828,607 L 1028,718 L 1125,770 L 949,475 Z"/><path d="M 758,181 L 616,414 L 402,770 L 410,766 L 510,699 L 615,626 L 741,535 L 754,520 L 758,508 Z"/><path d="M 410,774 L 1120,774 L 861,663 L 849,659 L 747,615 L 727,608 L 712,608 L 697,614 L 572,686 Z"/>`;
const colonne = (x, i) => `<g class="v-tp" style="animation-delay:${(.34 + i * .05).toFixed(2)}s">
  <path d="M${x - 31} 116h62"/><path d="M${x - 25} 121c-5 2-6 10-1 12 3 1 5-2 2-4M${x + 25} 121c5 2 6 10 1 12-3 1-5-2-2-4"/>
  <path d="M${x - 17} 132 ${x - 12} 122 ${x - 6} 131 ${x} 121 ${x + 6} 131 ${x + 12} 122 ${x + 17} 132" stroke-width="4.2"/><path d="M${x - 21} 139h42"/>
  <rect x="${x - 13.5}" y="143" width="27" height="107" rx="2.5"/><path d="M${x - 4.5} 150v93M${x + 4.5} 150v93" stroke-width="3.2"/><path d="M${x - 18.5} 255h37"/><path d="M${x - 23} 262h46"/></g>`;
const TEMPLE_SVG = `<svg viewBox="0 0 400 294" fill="none" stroke="currentColor" stroke-width="4.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <g class="v-tp" style="animation-delay:0s"><path d="M12 89 200 3 388 89"/><path d="M34 87 200 15 366 87"/><path d="M10 89.5h381" stroke-width="5.6"/></g>
  <g class="v-tp" style="animation-delay:.1s"><svg x="179" y="41" width="41" height="35" viewBox="392 172 742 610" fill="currentColor" stroke="none">${LOGO_PATHS}</svg></g>
  <g class="v-tp" style="animation-delay:.18s"><path d="M18 101h363"/><path d="M28 110.5h343" stroke-width="4"/></g>
  ${[66, 139, 260, 334].map(colonne).join('')}
  <g class="v-tp" style="animation-delay:.6s"><path d="M27 268h347"/><path d="M14 279h373"/><path d="M2 290h396"/></g></svg>`;
let templeSeen = false;
const temple = (cls = '') => { const intro = !templeSeen; templeSeen = true; return `<section class="v-temple ${cls}${intro ? '' : ' no-intro'}" data-temple aria-hidden="true">${TEMPLE_SVG}</section>`; };
function templeScroll(){ document.querySelectorAll('[data-temple]').forEach(t => { if (t.classList.contains('gl')) return; const r = t.getBoundingClientRect(), start = r.height * .15, end = -r.height * .55;
  /* 03/11/2026 : plus de zoom au défilement (demande de Thomas) ; sans 3D, le temple s'efface simplement */
  const k = Math.min(1, Math.max(0, (start - r.top) / (start - end))); t.style.opacity = (1 - k).toFixed(3); t.style.transform = 'none'; }); }
(function(){ let tick = false; addEventListener('scroll', () => { if (tick) return; tick = true; requestAnimationFrame(() => { tick = false; templeScroll(); }); }, { passive: true }); })();

/* ============================================================
   LA SÉANCE DU JOUR (7 min) : découverte, décision, retour, progression
   ============================================================ */
const TH = window.NT_THEMES || [];
const SESSM = {};   // séance « canonique » par thème : [leçon, 3 questions, décision, 2 bonus]
function sessMission(t){
  if (SESSM[t.id]) return SESSM[t.id];
  const rel = MS.find(m => m.id === t.rel), bonus = rel ? rel.steps.filter(st => ['qcm', 'vf', 'calc'].includes(st.type)).slice(0, 2) : [];
  return (SESSM[t.id] = { id: 'sess-' + t.id, title: `${t.title} en 7 minutes`, kind: 'Séance', dur: 7, goal: t.decision.explain, score: 20, cash: 240, session: true, theme: t,
    steps: [t.lesson, ...t.questions, t.decision, ...bonus] });
}
const themeById = id => TH.find(t => t.id === id);
function themeFor(dayOff = 0){
  const done = S.sessDone || {};
  if (!dayOff && S.sessPlan && S.sessPlan.day === today() && themeById(S.sessPlan.theme)) return themeById(S.sessPlan.theme);
  const cur = !dayOff ? null : themeFor(0), left = TH.filter(t => !done[t.id] && t !== cur).sort((a, b) => { const po = (S.plan2 && S.plan2.plan || []).map(x => x.ch), ia = po.indexOf(a.ch), ib = po.indexOf(b.ch); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.ch - b.ch; });   // les bases d'abord
  if (left.length) return left[0];
  const i = ((dayIndex() + dayOff) % TH.length + TH.length) % TH.length; return TH[i] === cur ? TH[(i + 1) % TH.length] : TH[i];
}
const sessDoneToday = () => S.sessDay === today();
function sessRefs(m){ const n = m.theme.questions.length, di = 1 + n;   // index de la décision
  if (S.pace === 'rapide') return [0, di];
  if (S.pace === 'intense') return m.steps.map((_, i) => i);
  return Array.from({ length: di + 1 }, (_, i) => i); }
function startSession(themeId, paceOverride){
  const t = themeId ? themeById(themeId) : themeFor(0); if (!t) return;
  S.sessPlan = { day: today(), theme: t.id };
  const m = sessMission(t), att = S.plays[m.id] || 0; S.plays[m.id] = att + 1; save();
  const p0 = S.pace; if (paceOverride) S.pace = paceOverride; const refs = sessRefs(m); S.pace = p0;
  M = { m, mode: 'full', att, steps: refs.map(i => prep(m.steps[i], m.id + '#' + i, att, i)), i: 0, ok: [], second: [], fb: null, ui: {}, ko: 0, fast: 0, combo: 0, t0: Date.now(), unl0: unlockedNow(), session: true };
  renderPlayer();
}
const unlockedNow = () => CH.filter(c => chUnlocked(c.id)).map(c => c.id);
/* règle produit : découverte, décision, retour, progression */
function sessionRule(steps){ return { decouverte: steps.some(s => s.type === 'lesson' || s.type === 'brief'), decision: steps.some(s => ['decision', 'ticket', 'role'].includes(s.type)), retour: steps.some(s => gradable(s) || s.type === 'decision'), progression: true }; }

/* ---------- la leçon interactive (90 s) ---------- */
const VIZ = {
  basket: `<svg viewBox="0 0 120 80"><rect x="10" y="30" width="100" height="44" rx="10" fill="none" stroke="currentColor" stroke-width="3"/>${Array.from({ length: 24 }, (_, i) => `<circle cx="${20 + (i % 8) * 11.5}" cy="${40 + Math.floor(i / 8) * 11}" r="4" fill="${['#8f74ff', '#3fd39a', '#66d0ff', '#8fb4ff'][i % 4]}"/>`).join('')}<path d="M30 30 45 8M90 30 75 8" stroke="currentColor" stroke-width="3" fill="none"/></svg>`,
  one: `<svg viewBox="0 0 120 80"><rect x="10" y="30" width="100" height="44" rx="10" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="60" cy="52" r="12" fill="#ff7aa8"/><path d="M30 30 45 8M90 30 75 8" stroke="currentColor" stroke-width="3" fill="none"/></svg>`,
  coins: `<svg viewBox="0 0 120 80">${[0, 1, 2, 3].map(i => `<ellipse cx="60" cy="${62 - i * 11}" rx="26" ry="8" fill="#8fb4ff" stroke="#0b1240" stroke-width="1.5"/>`).join('')}<path d="M96 18v26M90 38l6 6 6-6" stroke="#ff6b7f" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  down: `<svg viewBox="0 0 120 80"><polyline points="8,20 30,26 46,18 62,40 76,34 92,62 112,56" fill="none" stroke="#ff6b7f" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
  bars: `<svg viewBox="0 0 120 80">${[8, 11, 15, 20, 27, 36, 48, 63].map((v, i) => `<rect x="${10 + i * 13}" y="${74 - v}" width="9" height="${v}" rx="2" fill="${i > 5 ? '#3fd39a' : '#8f74ff'}"/>`).join('')}</svg>`,
  clock: `<svg viewBox="0 0 120 80"><circle cx="60" cy="40" r="30" fill="none" stroke="currentColor" stroke-width="4"/><path d="M60 22v18l12 8" stroke="#8fb4ff" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  shield: `<svg viewBox="0 0 120 80"><path d="M60 6l30 11v20c0 20-14 32-30 38-16-6-30-18-30-38V17z" fill="rgba(63,211,154,.2)" stroke="#3fd39a" stroke-width="4"/><path d="M48 40l9 9 16-17" stroke="#3fd39a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  scale: `<svg viewBox="0 0 120 80"><path d="M60 10v58M30 68h60M22 26h76" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M22 26 10 50h24zM98 26 86 50h24z" fill="rgba(143,116,255,.3)" stroke="#8f74ff" stroke-width="3"/></svg>`,
  pie: `<svg viewBox="0 0 120 80"><circle cx="60" cy="40" r="30" fill="#66d0ff"/><path d="M60 40V10a30 30 0 1 1-28.5 39.3z" fill="#8f74ff"/></svg>`,
  check: `<svg viewBox="0 0 120 80"><circle cx="60" cy="40" r="30" fill="rgba(63,211,154,.2)" stroke="#3fd39a" stroke-width="4"/><path d="M46 41l10 10 19-21" stroke="#3fd39a" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
};
function lessonHTML(st){
  const u = M.ui; u.c = u.c || 0; u.g = u.g || {}; u.rv = u.rv || {};
  const c = st.cards[u.c];
  return `<span class="eyebrow">${I.book} Leçon · 90 secondes</span><p class="p-q" style="font-size:20px">${h(st.title)}</p>
    <div class="ldots" aria-label="Carte ${u.c + 1} sur ${st.cards.length}">${st.cards.map((_, i) => `<i class="${i < u.c ? 'done' : i === u.c ? 'on' : ''}"></i>`).join('')}</div>
    <div class="lcard" key="${u.c}">${c.viz ? `<div class="lviz" aria-hidden="true">${VIZ[c.viz] || ''}</div>` : ''}
      <b class="lh">${h(c.h)}</b><p class="lt">${h(c.t)}</p>
      ${c.k === 'guess' ? `<div class="opts">${c.opts.map((o, i) => `<button class="opt ${u.g[u.c] != null ? (i === c.a ? 'ok' : i === u.g[u.c] ? 'ko' : '') : ''}" data-lg="${i}"${u.g[u.c] != null ? ' disabled' : ''}>${h(o)}</button>`).join('')}</div>
        ${u.g[u.c] != null ? `<p class="lr ${u.g[u.c] === c.a ? 'ok' : 'ko'}">${u.g[u.c] === c.a ? 'Oui ! ' : 'Pas tout à fait. '}${h(c.r)}</p>` : ''}` : ''}
      ${c.k === 'tap' ? (u.rv[u.c] ? `<p class="lr ok">${h(c.hidden)}</p>` : `<button class="btn ghost full" data-lt>Touche pour découvrir</button>`) : ''}</div>`;
}
function lessonFoot(st){ const u = M.ui, c = st.cards[u.c || 0], need = (c.k === 'guess' && (u.g || {})[u.c || 0] == null) || (c.k === 'tap' && !(u.rv || {})[u.c || 0]);
  return `<button class="btn v full" data-lnext${need ? ' disabled' : ''}>${(u.c || 0) >= st.cards.length - 1 ? 'J’ai compris' : 'Suivant'}</button>`; }

/* ---------- la décision + le simulateur pluriannuel ---------- */
function gaussR(r){ let a = 0, b = 0; while (!a) a = r(); while (!b) b = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); }
const mulb = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function simulate(st, seed){
  const N = st.years;
  if (st.market.trades){   // une période = un trade
    const T = st.market.trades, ru = mulb(seed * 7919 + 13), U = Array.from({ length: N }, () => ru()), Lr = Array.from({ length: N }, () => ru());
    return st.options.map(o => { let v = o.capital || 0, risk = o.risk || 1, streak = 0, pause = 0, best = -1e9, worst = 1e9; const vals = [v];
      for (let i = 0; i < N; i++){
        if (pause > 0){ pause--; vals.push(v); continue; }
        const p = o.p ?? T.p, R = o.R ?? T.R, win = U[i] < p, out = win ? R : (o.bigLoss && Lr[i] < o.bigLoss.prob ? o.bigLoss.R : -1), r = Math.max(-100, out * risk);
        v = Math.max(0, v * (1 + r / 100)); best = Math.max(best, r); worst = Math.min(worst, r);
        if (win){ streak = 0; risk = o.risk || 1; } else { streak++; if (o.martingale) risk = Math.min(64, risk * 2); if (o.pause3 && streak >= 3){ pause = 3; streak = 0; } }
        vals.push(v); }
      return { vals, final: v, inv: o.capital || 0, best, worst }; });
  }
  const rm = mulb(seed * 7919 + 13), mkt = Array.from({ length: N }, (_, y) => st.market.path ? (st.market.path[y] ?? 0) : st.market.rate + st.market.vol * gaussR(rm));
  return st.options.map((o, k) => { const ri = mulb(seed * 104729 + k * 31 + 7); let v = (o.start ? 0 : (o.capital || 0)), inv = v; const vals = [v]; let best = -1e9, worst = 1e9;
    for (let y = 1; y <= N; y++){
      const contrib = (o.monthly || 0) * 12 * (y > (o.start || 0) ? 1 : 0); if (o.start && y === o.start + 1) { v += o.capital || 0; inv += o.capital || 0; }
      let r = o.path ? (o.path[y - 1] ?? 0) : (o.w || 0) * (mkt[y - 1] + (o.idio ? o.idio * gaussR(ri) : 0)) + (1 - Math.min(1, o.w || 0)) * (o.safe || 0) - (o.fee || 0) - (o.drag || 0);
      if (o.wait && y <= o.wait) r = o.safe || 0;
      r = Math.max(-100, r);
      if (v + contrib > 0 || y > (o.start || 0)){ best = Math.max(best, r); worst = Math.min(worst, r); }
      v = Math.max(0, (v + contrib / 2) * (1 + r / 100) + contrib / 2); inv += contrib; vals.push(v); }
    if (o.taxEnd && v > inv){ v = inv + (v - inv) * (1 - o.taxEnd / 100); vals[vals.length - 1] = v; }
    return { vals, final: v, inv, best, worst }; });
}
function decisionHTML(st){
  const u = M.ui, opts = st.options, risk = o => { if (o.path) return ['Risque caché', 'r']; if (st.market.trades){ const x = (o.risk || 1) * (o.martingale ? 6 : 1) * (o.bigLoss ? 3 : 1); return x <= 1.5 ? ['Risque maîtrisé', 'g'] : x <= 5 ? ['Risque moyen', 'a'] : ['Risque élevé', 'r']; } const s = (o.w || 0) * Math.hypot(st.market.vol || 15, o.idio || 0); return s < 1 ? ['Sans risque', 'g'] : s < 9 ? ['Risque faible', 'g'] : s < 17 ? ['Risque moyen', 'a'] : ['Risque élevé', 'r']; };
  let html = `<span class="eyebrow">${I.target} Décision</span><div class="scen"><span class="persona">${h(st.persona.slice(0, 1))}</span><p>${h(st.q)}</p></div>
    <div class="facts">${st.facts.capital ? `<span class="chip">${I.coin}${eur0(st.facts.capital)}</span>` : ''}<span class="chip">${I.clock}${h(st.facts.horizon)}</span></div>
    <div class="dopts">${opts.map((o, i) => { const [rl, rc] = risk(o); return `<button class="dopt ${M.fb ? (o.fit ? 'ok' : i === u.sel ? 'ko' : '') : ''}" data-dopt="${i}" aria-pressed="${u.sel === i}"${M.fb ? ' disabled' : ''}><b>${String.fromCharCode(65 + i)}. ${h(o.name)}</b><span>${h(o.desc)}</span><span class="rk ${rc}">${rl}</span></button>`; }).join('')}</div>`;
  if (M.fb){ const seed = (u.resim || 0) + 1 + M.att * 17, sim = simulate(st, seed), N = st.years;
    const all = sim.flatMap(s => s.vals), mx = Math.max(...all), mn = Math.min(0, ...all), w = 340, hh = 170;
    const X = y => 34 + y / N * (w - 44), Y = v => 10 + (1 - (v - mn) / (mx - mn || 1)) * (hh - 30);
    html += `<div class="simbox"><div class="row" style="justify-content:space-between"><b>Ce que chaque choix aurait donné</b><span class="sample">Simulation d’exemple</span></div>
      <svg class="simchart" viewBox="0 0 ${w} ${hh}" role="img" aria-label="Évolution simulée des trois choix sur ${N} ${st.unit === 'trades' ? 'trades' : 'ans'}">
      ${[0, .5, 1].map(k => { const v = mn + (mx - mn) * k; return `<line x1="34" x2="${w - 10}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/><text x="2" y="${(Y(v) + 3).toFixed(1)}" class="ax">${v >= 1000 ? Math.round(v / 1000) + ' k' : Math.round(v)}</text>`; }).join('')}
      <text x="34" y="${hh - 4}" class="ax">Aujourd’hui</text><text x="${w - 10}" y="${hh - 4}" class="ax" text-anchor="end">${N} ${st.unit === 'trades' ? 'trades' : 'an' + (N > 1 ? 's' : '')}</text>
      ${sim.map((s, i) => `<polyline class="simline${i === u.sel ? ' me' : ''}" pathLength="100" points="${s.vals.map((v, y) => `${X(y).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${PC[i]}" stroke-width="${i === u.sel ? 4 : 2.2}" ${i === u.sel ? '' : 'stroke-dasharray="5 4" opacity=".7"'} stroke-linejoin="round"/>`).join('')}</svg>
      <div class="simtab">${sim.map((s, i) => `<div class="${i === u.sel ? 'me' : ''}"><span class="dot" style="background:${PC[i]}"></span><b>${String.fromCharCode(65 + i)}${i === u.sel ? ' · ton choix' : ''}</b><b class="tn">${eur0(s.final)}</b><span class="small tn">${st.unit === 'trades' ? `départ ${eur0(s.inv)} · meilleur trade ${s.best >= 0 ? '+' : ''}${num(s.best, 1)} % · pire ${num(s.worst, 1)} %` : `versé ${eur0(s.inv)} · meilleure année ${s.best >= 0 ? '+' : ''}${num(s.best, 0)} % · pire ${num(s.worst, 0)} %`}${st.options[i].taxEnd ? ' · après impôts' : ''}</span></div>`).join('')}</div>
      ${(() => { const many = Array.from({ length: 100 }, (_, k) => simulate(st, 1000 + k)), fitI = st.options.findIndex(o => o.fit);
        const stats = st.options.map((o, i) => { const f = many.map(r => r[i].final).sort((a, b) => a - b), inv = sim[i].inv; return { lo: f[4], med: f[50], hi: f[95], under: f.filter(v => v < inv).length }; });
        return `<div class="range"><b>Sur 100 évolutions possibles des marchés</b>${stats.map((x, i) => `<div class="rg"><span class="dot" style="background:${PC[i]}"></span><span class="small"><b>${String.fromCharCode(65 + i)}</b> : de ${eur0(x.lo)} à ${eur0(x.hi)} (médiane ${eur0(x.med)}) · ${x.under ? `<b style="color:var(--red)">${x.under} fois sur 100</b> sous la somme versée` : 'jamais sous la somme versée'}</span></div>`).join('')}
          ${sim[fitI].final < Math.max(...sim.map(x => x.final)) ? `<p class="small" style="margin-top:8px;color:#fff">Le meilleur choix n’est pas toujours celui qui finit le plus haut dans un exemple : c’est celui qui respecte le besoin et le risque supportable de ${st.persona === 'Toi' ? 'chacun' : h(st.persona)}.</p>` : ''}</div>`; })()}
      <button class="link" data-resim>Et si les marchés avaient fait autrement ? Relancer</button>
      <p class="note">Rendements fictifs tirés au hasard autour d’une moyenne : un exemple parmi d’autres, jamais une prévision. Les performances passées ou simulées ne préjugent pas des performances futures.</p></div>`; }
  return html;
}
/* le placement choisi entre dans le portefeuille fictif (1 000 € fictifs offerts) */
function addDecisionToPortfolio(o, label){
  const parts = typeof o.mk === 'string' ? { [o.mk]: 1 } : o.mk || {}; const td = today();
  for (const [id0, w] of Object.entries(parts)){ const s = mkFind(id0); if (!s) continue; const id = s.id, price = px(s), qty = Math.round(1000 * w / toEur(s, price) * 10000) / 10000;
    const p = S.positions[id] || { qty: 0, avg: 0 }; p.avg = (p.avg * p.qty + qty * price) / (p.qty + qty); p.qty = Math.round((p.qty + qty) * 10000) / 10000; S.positions[id] = p; }
  S.history.push(`${td.split('-').reverse().join('/')} · Décision « ${label} » : 1 000 € fictifs placés sur « ${o.name} »`);
}

/* ============================================================
   PROFIL D'APPRENTISSAGE (questionnaire d'accueil) + PLAN SUR MESURE
   Les réponses servent uniquement à adapter l'entraînement.
   Aucune donnée financière personnelle (revenus, patrimoine) n'est demandée.
   ============================================================ */
const PQ = [
  { id: 'qui', q: 'Qui es-tu ?', opts: [['etudiant', 'Élève ou étudiant'], ['salarie', 'Salarié'], ['indep', 'Indépendant ou entrepreneur'], ['retraite', 'Retraité'], ['enseignant', 'Enseignant ou formateur'], ['autre', 'Autre']] },
  { id: 'objectif', core: true, q: 'Ton objectif principal ?', opts: [['comprendre', 'Comprendre la bourse et l’économie'], ['premiers', 'Préparer mes premiers placements'], ['fructifier', 'Mieux gérer une épargne que j’ai déjà'], ['trading', 'Apprendre le trading'], ['metier', 'Préparer un examen ou un métier de la finance'], ['former', 'Former mes élèves ou mes équipes']] },
  { id: 'horizon', core: true, q: 'Si tu investissais, quand aurais-tu besoin de cet argent ?', sub: 'C’est la question n°1 avant tout placement.', opts: [['court', 'Dans moins de 2 ans'], ['moyen', 'Dans 2 à 5 ans'], ['long', 'Dans 5 à 10 ans'], ['tlong', 'Dans plus de 10 ans'], ['pas', 'Je n’investis pas pour l’instant']] },
  { id: 'exp', core: true, q: 'Ton expérience ?', opts: [['jamais', 'Je n’ai jamais placé d’argent'], ['livret', 'Seulement des livrets'], ['enveloppes', 'Assurance-vie, PEA ou épargne salariale'], ['actions', 'J’achète déjà des actions ou des ETF'], ['actif', 'Je fais du trading (levier, CFD, crypto…)']] },
  { id: 'niveau', core: true, q: 'Comment évalues-tu ton niveau ?', opts: [['1', 'Débutant complet'], ['2', 'J’ai quelques bases'], ['3', 'Je me débrouille'], ['4', 'Avancé']] },
  { id: 'connu', core: true, q: 'Qu’est-ce que tu connais déjà ?', sub: 'Plusieurs choix possibles. Aucune question de cours : on te croit sur parole.', multi: true, opts: [['rien', 'Rien encore, je pars de zéro'], ['livret', 'Livrets et épargne'], ['ordres', 'Passer un ordre de bourse'], ['etf', 'Les ETF'], ['actions', 'Lire les résultats d’une entreprise'], ['pea', 'PEA, assurance-vie, fiscalité'], ['crypto', 'Les cryptos et le levier'], ['graphiques', 'Les graphiques en bougies'], ['risque', 'Le stop et la gestion du risque'], ['derives', 'Options, futures, macroéconomie']] },
  { id: 'freins', q: 'Qu’est-ce qui te freine ?', sub: 'Plusieurs choix possibles.', multi: true, opts: [['peur', 'J’ai peur de perdre de l’argent'], ['vocab', 'Le vocabulaire est compliqué'], ['debut', 'Je ne sais pas par où commencer'], ['temps', 'Je manque de temps'], ['perdu', 'J’ai déjà perdu de l’argent'], ['confiance', 'Je ne sais pas à qui faire confiance'], ['rien', 'Rien de particulier']] },
  { id: 'baisse', q: 'Ton placement perd 20 % en un mois. Ta première réaction ?', sub: 'Pas de bonne ou de mauvaise réponse : on veut connaître ton réflexe.', opts: [['vend', 'Je vends tout pour arrêter les pertes'], ['attend', 'J’attends sans rien changer'], ['achete', 'J’en profite pour en racheter'], ['sais', 'Je ne sais pas']] },
  { id: 'sujets', q: 'Qu’est-ce qui t’intéresse le plus ?', sub: 'Plusieurs choix possibles.', multi: true, opts: [['actions', 'Actions et bourse'], ['etf', 'ETF et investissement simple'], ['fisc', 'PEA, assurance-vie, impôts'], ['retraite', 'Préparer ma retraite'], ['trading', 'Trading et graphiques'], ['crypto', 'Crypto (comprendre les risques)'], ['eco', 'Économie et actualité']] },
  { id: 'temps', core: true, q: 'Combien de temps par jour ?', opts: [['rapide', '3 minutes'], ['normal', '7 minutes'], ['intense', '15 minutes ou plus']] },
  { id: 'moment', q: 'Quand préfères-tu t’entraîner ?', sub: 'Pour ton rappel (1 par jour maximum, désactivable).', opts: [['matin', 'Le matin'], ['midi', 'À midi'], ['soir', 'Le soir'], ['libre', 'Peu importe']] },
  { id: 'style', q: 'Tu apprends mieux…', opts: [['pratique', 'En pratiquant (simulateur, décisions)'], ['lire', 'Avec des explications courtes'], ['defi', 'Avec des défis et des classements'], ['coach', 'Avec un coach qui m’explique']] },
  { id: 'contexte', q: 'Tu utilises NovaTitre…', opts: [['seul', 'Pour moi'], ['classe', 'Avec ma classe ou mon école'], ['entreprise', 'Avec mon entreprise']] },
];
const pqList = () => window.__pqAll ? PQ : PQ.filter(q => q.core);
const PQ_LABEL = (id, v) => { const q = PQ.find(x => x.id === id); const o = q && q.opts.find(x => x[0] === v); return o ? o[1] : ''; };

/* Construit le plan à partir des réponses et du test de départ */
function buildPlan(P, v){
  P = P || {}; const covered = plMax(v || 0), steps = [], add = (ch, why) => { if (ch > covered && !steps.some(s => s.ch === ch)) steps.push({ ch, why }); };
  const fr = P.freins || [], su = P.sujets || [];
  if (P.exp === 'actif') add(12, 'Tu fais déjà du trading : la gestion du risque passe avant tout.');
  if (P.baisse === 'vend' || fr.includes('peur') || fr.includes('perdu')) add(5, 'Tu as le réflexe de vendre quand ça baisse : on travaille le calme en pleine tempête.');
  if (P.horizon === 'court' || P.exp === 'jamais' || P.exp === 'livret') add(1, 'Les bases : épargne de précaution, risque, inflation, intérêts composés.');
  if (fr.includes('confiance')) add(6, 'Savoir à qui faire confiance : repérer les arnaques et les faux conseillers.');
  switch (P.objectif){
    case 'comprendre': add(1, 'Comprendre comment fonctionnent l’épargne et la bourse.'); add(2, 'Voir comment marche une vraie plateforme.'); add(4, 'Lire une entreprise et l’actualité.'); break;
    case 'premiers': add(2, 'Ouvrir un compte et passer tes premiers ordres (fictifs).'); add(3, 'Construire un premier portefeuille simple et diversifié.'); add(8, 'Choisir la bonne enveloppe : livret, PEA, assurance-vie.'); add(7, 'Écrire ta stratégie.'); break;
    case 'fructifier': add(3, 'Vérifier ta diversification et tes frais.'); add(8, 'Optimiser tes enveloppes et ta fiscalité.'); add(7, 'Une stratégie claire, avec rééquilibrage.'); break;
    case 'trading': add(2, 'Maîtriser les ordres et le carnet d’ordres.'); add(10, 'Lire les graphiques en bougies.'); add(11, 'Tendances, supports et indicateurs.'); add(12, 'Gérer le risque : stop, taille de position.'); add(13, 'Plan de trading, journal et mental.'); break;
    case 'metier': add(2, 'Le fonctionnement des marchés et des ordres.'); add(6, 'La protection des investisseurs.'); add(8, 'Les produits d’épargne et la fiscalité.'); break;
    case 'former': add(1, 'Le parcours de base que suivront tes élèves ou équipes.'); add(3, 'Les notions clés à imposer en priorité.'); break;
    default: add(1, 'Commencer par les bases.');
  }
  if (su.includes('etf')) add(3, 'Les ETF et l’investissement simple t’intéressent.');
  if (su.includes('fisc') || su.includes('retraite')) add(8, 'Enveloppes, impôts et retraite.');
  if (su.includes('trading')) add(10, 'Les graphiques et le trading t’intéressent.');
  if (su.includes('crypto')) add(9, 'Comprendre les produits risqués avant d’y toucher.');
  if (su.includes('actions')) add(4, 'Analyser une entreprise.');
  if (su.includes('eco')) add(4, 'Lire l’actualité économique sans paniquer.');
  if (P.exp === 'actif') add(9, 'Levier, CFD, crypto : mesurer vraiment le risque.');
  if (!steps.length) add(Math.min(15, covered + 1), 'La suite logique après ton test.');
  const plan = steps.slice(0, 6), mpd = P.temps === 'rapide' ? 3 : P.temps === 'intense' ? 15 : 7;
  const minutes = plan.reduce((a, s) => a + chMissions(s.ch).reduce((b, m) => b + m.dur, 0), 0), days = Math.ceil(minutes / mpd);
  const self = Number(P.niveau || 1), testLvl = v >= 8 ? 4 : v >= 4 ? 3 : v >= 2 ? 2 : 1;
  const calib = !S.testDone ? 'Ton parcours suit tes réponses. Tu as des bases ? Le test de niveau, facultatif, te fera sauter ce que tu maîtrises.' : self > testLvl ? 'Le test montre quelques trous dans des notions que tu pensais maîtriser : ton plan commence par là.' : self < testLvl ? 'Tu te sous-estimes : le test montre que tu en sais plus que tu ne le penses. On passe ce que tu connais déjà.' : 'Ton ressenti et le test sont d’accord : bonne lucidité.';
  const offer = P.contexte === 'classe' || P.contexte === 'entreprise' || P.objectif === 'former' ? 'pro' : plan.some(s => s.ch >= 3) || ['trading', 'metier'].includes(P.objectif) ? 'premium' : 'decouverte';
  const extras = [];
  if (P.objectif === 'metier') extras.push(['amf', 'Prépa Certification AMF', 'Entraînement aux thèmes de l’examen officiel.']);
  if (P.objectif === 'trading' || P.exp === 'actif') extras.push(['room', 'Salle de marché', 'Pratiquer sans risquer un euro, noté sur la discipline.']);
  if (fr.includes('vocab')) extras.push(['cours', 'Glossaire', '55 mots expliqués simplement.']);
  if (P.style === 'coach') extras.push(['suivi', 'Suivi personnalisé', 'Nova Coach fait ton bilan chaque semaine.']);
  return { plan, mpd, minutes, days, calib, offer, extras, date: today() };
}
const planOpen = () => (S.plan2 && S.plan2.plan || []).slice(0, 3).map(s => s.ch);

PAGES.profilq = () => {
  const L = pqList(), i = Math.min(L.length - 1, window.__pq ?? 0), q = L[i], P = S.profile || (S.profile = {}), sel = P[q.id], multi = q.multi, cur = multi ? (sel || []) : sel;
  return `<div class="wrap">${top()}
    <div class="p-top"><div class="bar"><i style="width:${(i / L.length) * 100}%"></i></div><span class="small tn">${i + 1}/${L.length}</span></div>
    <div class="p-body"><div class="p-kicker"><span class="chip v">Ton profil</span><span class="chip">${I.clock}${L.length > 6 ? '2 min' : '1 min'}</span></div>
      <p class="p-q">${h(q.q)}</p>${q.sub ? `<p class="small">${h(q.sub)}</p>` : ''}
      <div class="opts" style="margin-top:12px">${q.opts.map(([v, t]) => `<button class="opt" data-pqa="${v}" aria-pressed="${multi ? cur.includes(v) : cur === v}">${multi ? `<span class="ck">${cur.includes(v) ? I.check : ''}</span>` : ''}${h(t)}</button>`).join('')}</div></div>
    <div class="row" style="gap:8px;margin-top:16px">${i > 0 ? `<button class="btn ghost" data-pqback>${I.back}</button>` : ''}<button class="btn v" style="flex:1" data-pqnext${(multi ? cur.length : cur) ? '' : ' disabled'}>${i === L.length - 1 ? (S.onb ? 'Mettre à jour mon plan' : 'Voir mon parcours') : 'Continuer'}</button></div>
    <button class="link" style="margin-top:12px" data-pqskip>Passer cette question</button>
    <p class="note">Tes réponses servent uniquement à adapter ton entraînement. On ne te demande ni revenus ni patrimoine. Ce n’est pas un conseil en investissement.</p>
  </div>`; };
function pqAdvance(){ const L = pqList(), i = window.__pq || 0;
  if (i < L.length - 1){ window.__pq = i + 1; return render(); }
  applyProfile(); save();
  if (S.onb){ S.plan2 = buildPlan(S.profile, S.placement || 0); window.__pqAll = false; save(); toast('Ton plan est mis à jour.'); return go('monplan'); }
  return finishOnboarding(); }
function applyProfile(){ const P = S.profile || {};
  S.goal = { comprendre: 'comprendre', premiers: 'premiers', fructifier: 'premiers', trading: 'travail', metier: 'travail', former: 'travail' }[P.objectif] || 'curieux';
  if (P.temps) S.pace = P.temps; if (P.contexte === 'classe') S.audience = 'campus'; if (P.contexte === 'entreprise') S.audience = 'pro'; }
function planHTML(){ const pl = S.plan2; if (!pl) return '';
  const P = S.profile || {}, offerCard = { decouverte: ['Découverte', '0 €', 'Ton plan commence par les chapitres gratuits. Tu pourras passer à Premium quand tu veux.'], premium: ['Premium', '7,99 € / mois', 'Ton plan utilise des chapitres Premium (niveaux, examens, certificats, suivi IA). Les chapitres 1 et 2 restent gratuits pour commencer.'], pro: ['Nova Pro', 'selon le nombre de comptes', 'Tu formes un groupe : tableau de bord, missions imposées et suivi de chaque compte.'] }[pl.offer];
  return `<section class="sec"><div class="sec-h"><h2>Ton entraînement sur mesure</h2></div>
    <div class="card"><p class="fiche-p" style="margin-top:0">${h(pl.calib)}</p>
      <div class="grid3" style="margin-top:12px"><div class="stat"><b class="tn">${pl.mpd} min</b><span>par jour</span></div><div class="stat"><b class="tn">${pl.plan.length}</b><span>étapes</span></div><div class="stat"><b class="tn">≈ ${Math.max(1, Math.round(pl.days / 7))} sem.</b><span>pour finir</span></div></div></div>
    ${pl.plan.map((s, i) => { const c = CH.find(x => x.id === s.ch); return `<div class="plan-step"><span class="ps-n" style="background:${c.color};color:#0b0912">${i + 1}</span><div class="grow"><b>Chapitre ${c.id} · ${h(c.title)}</b><span class="small">${h(s.why)}</span></div>${c.id === S.freeCh && !S.premium ? '<span class="chip g">Offert</span>' : chPremium(c.id) ? '<span class="chip a">Premium</span>' : ''}</div>`; }).join('')}
    <div class="plan-step"><span class="ps-n">${I.target}</span><div class="grow"><b>Chaque jour : ta séance de ${pl.mpd} min</b><span class="small">Une découverte, une décision, des retours, de la progression.</span></div></div>
    ${pl.extras.map(([g, t, d]) => `<button class="plan-step as-btn" data-go="${g}"><span class="ps-n">${I.star}</span><div class="grow"><b>${h(t)}</b><span class="small">${h(d)}</span></div></button>`).join('')}
    <div class="card plan-offer ${pl.offer}" style="margin-top:12px"><span class="eyebrow">Offre conseillée pour ton plan</span><div class="row" style="justify-content:space-between;margin-top:4px"><b style="font-size:18px">${offerCard[0]}</b><span class="tn" style="font-weight:800">${offerCard[1]}</span></div><p class="small" style="margin-top:6px">${offerCard[2]}</p>
      <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">${pl.offer === 'pro' ? `<button class="btn v sm" data-go="pricing">Voir Nova Pro</button>` : ''}${!S.trialUsed && pl.offer !== 'decouverte' ? `<button class="btn v sm" data-trial>Essai gratuit ${PRICE.trialDays} jours</button>` : ''}<button class="btn ${pl.offer === 'decouverte' ? 'v' : 'ghost'} sm" data-go="home">Commencer gratuitement</button></div></div>
    ${S.freeCh && !S.premium ? `<div class="card" style="margin-top:10px;border-color:rgba(63,211,154,.45);background:rgba(63,211,154,.08)"><b>${I.star} Cadeau : le chapitre ${S.freeCh} est offert</b><p class="small" style="margin-top:4px">Tu as déjà validé les chapitres gratuits au test : on t’offre « ${h(CH.find(c => c.id === S.freeCh).title)} » pour continuer sans payer.</p></div>` : ''}
    <p class="note">Plan modifiable à tout moment depuis ton profil. Profil : ${h(PQ_LABEL('objectif', P.objectif) || '—')} · ${h(PQ_LABEL('exp', P.exp) || '—')}.</p></section>`; }

/* ============================================================
   ACCUEIL (le temple) — disposé comme l'accueil historique de NovaTitre
   ============================================================ */
const TEMPLE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5 12 4l9 5.5"/><path d="M4 10.5h16"/><path d="M6.5 12.5v6M10.2 12.5v6M13.8 12.5v6M17.5 12.5v6"/><path d="M4.5 20.5h15"/></svg>`;
function homeRail(){
  const nx1 = upNext(), goalOk = todayCount() >= DAILY_GOAL, p = learnerProfile(), rate = p.reussite_globale, rv = dueReviews().length;
  const c1 = nx1.kind ? `<article class="rcard hero-next${goalOk ? ' calm' : ''}"><span class="eyebrow">${h(nx1.eyebrow)}</span><h2>${h(nx1.title)}</h2><p>${h(nx1.sub)}</p>
      <button class="btn v full big" ${nx1.attr}>${I.play}${goalOk ? 'Continuer quand même' : 'Continuer'}</button>${goalOk ? '<p class="small" style="margin-top:8px;text-align:center">Objectif du jour atteint : tu peux t’arrêter là.</p>' : ''}</article>`
    : `<article class="rcard hero-next calm"><h2>${CH.some(c => chPremium(c.id)) ? 'La suite est dans Premium' : 'Tout est fait pour aujourd’hui'}</h2><p>${CH.some(c => chPremium(c.id)) ? 'Débloque les 5 niveaux, les examens et les certificats.' : 'Reviens demain pour ta séance.'}</p>${CH.some(c => chPremium(c.id)) ? '<button class="btn v full" data-paywall>Essayer Premium</button>' : ''}</article>`;
  const c2 = `<article class="rcard coach-card"><div class="cc-h"><span class="cc-ic">${I.chat}</span><span class="eyebrow">Nova Coach${aiOn() ? ' · IA' : ''}</span></div>
      <h2>Ton coach personnel</h2><p>Il t’explique, répond à tes questions et prépare ton plan de la semaine.</p>
      <div class="sugg">${['C’est quoi un ETF ?', 'Comment placer un stop ?'].map(s => `<button data-askhome="${h(s)}">${h(s)}</button>`).join('')}</div>
      <form class="cin" id="homeAsk"><label class="sr" for="homeAskIn">Ta question</label><input id="homeAskIn" placeholder="Écris à Nova Coach…" autocomplete="off"><button class="ibtn v" aria-label="Envoyer">${I.send}</button></form>
      <div class="row" style="gap:8px;margin-top:10px"><button class="btn sm white" data-go="coach">Ouvrir Nova Coach</button><button class="btn sm ghost" data-go="suivi">Mon suivi</button></div></article>`;
  const ringP = rate == null ? 0 : rate;
  const c3 = `<article class="rcard review-card"><div class="cc-h"><span class="cc-ic">${I.target}</span><span class="eyebrow">Nova Review</span></div>
      <div class="rv-ring"><svg viewBox="0 0 100 100"><defs><linearGradient id="gR" x1="0" x2="1"><stop offset="0" stop-color="#ff7aa8"/><stop offset="1" stop-color="#a68cff"/></linearGradient></defs><circle cx="50" cy="50" r="40" class="trk"/><circle cx="50" cy="50" r="40" class="arc" pathLength="100" style="stroke-dasharray:${ringP} 100"/></svg>
        <div><b class="tn">${rate == null ? '—' : rate + ' %'}</b><span>réussites</span></div></div>
      <p class="rv-t">Bilan de la semaine</p><p class="small">${p.reponses_totales} réponse${p.reponses_totales > 1 ? 's' : ''} · ${rv} notion${rv > 1 ? 's' : ''} à revoir · ${p.jours_actifs_sur_7}/7 jours actifs</p>
      <button class="btn sm ghost" style="margin-top:10px" data-go="suivi">Voir mon bilan</button></article>`;
  return `<section class="sec rail-sec"><div class="rail" data-rail>${c1}${c2}${c3}</div><div class="rdots" aria-hidden="true"><i class="on"></i><i></i><i></i></div></section>`;
}
function extraQuestion(){
  if (!S.onb || !S.profile || S.pqDay === today()) return '';
  const q = PQ.find(x => !x.core && S.profile[x.id] == null); if (!q) return '';
  const P = S.profile, cur = q.multi ? (P['_' + q.id] || []) : null;
  return `<section class="sec"><div class="card pq-card"><span class="eyebrow">${I.person} Une question pour mieux t’accompagner</span><p class="p-q" style="font-size:17px;margin:8px 0 10px">${h(q.q)}</p>
    <div class="opts">${q.opts.map(([v, t]) => `<button class="opt sm" data-pqhome="${q.id}" data-v="${v}" aria-pressed="${q.multi ? cur.includes(v) : false}">${q.multi ? `<span class="ck">${cur.includes(v) ? I.check : ''}</span>` : ''}${h(t)}</button>`).join('')}</div>
    ${q.multi ? `<button class="btn v sm" style="margin-top:10px" data-pqhomeok="${q.id}"${cur.length ? '' : ' disabled'}>Valider</button>` : ''}<button class="link" style="margin-left:10px" data-pqhomeskip>Plus tard</button></div></section>`;
}
PAGES.home = () => {
  const { r } = rankOf(S.score), tc = todayCount(), goalOk = tc >= DAILY_GOAL, td = today(), DAILY = dailyMission(), dDone = S.dailyDone === td, rv = dueReviews();
  const ep = storyNext(), epReady = storyReady(), nm = nextMission(), lv = nm ? levelOf(nm.ch) : LV[LV.length - 1], ch = nm ? CH.find(c => c.id === nm.ch) : null;
  const hasPos = Object.keys(S.positions).length, v = portfolioValue(), vp = portfolioValue(true), dv = v - vp;
  const next3 = (() => { const out = []; for (const s of ((S.plan2 && S.plan2.plan) || [])) MS.filter(m => m.ch === s.ch && !isDone(m.id) && chUnlocked(m.ch) && !chPremium(m.ch)).forEach(m => out.length < 3 && !out.includes(m) && out.push(m)); MS.filter(m => !isDone(m.id) && chUnlocked(m.ch) && !chPremium(m.ch)).forEach(m => out.length < 3 && !out.includes(m) && out.push(m)); return out; })();
  const name = (S.name || '').split(' ')[0];
  return `<div class="wrap">${top()}
  ${temple()}
  <div class="v-quick">
    <button data-career><span class="v-ring${careerReady() ? ' live' : ''}">${P('<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M7 12l3-3 2.5 2 4-4.5"/><path d="M9 20h6M12 16v4"/>')}</span>Journée</button>
    <button data-go="room"><span class="v-ring">${I.candle}</span>Salle de marché</button>
    <button data-go="cours"><span class="v-ring">${I.book}</span>Manuel</button>
    <button data-go="coach"><span class="v-ring">${I.chat}</span>Coach IA</button>
  </div>
  <div class="v-hello"><h1>${greet()}${name ? ' ' + h(name) : ''}</h1><p>Voici ton entraînement du jour.</p></div>
  ${askBar()}
  <div class="stats-row"><span class="pill tn ${goalOk ? 'v' : ''}">${goalOk ? I.check : I.clock}Objectif du jour ${Math.min(tc, DAILY_GOAL)}/${DAILY_GOAL}</span>${hasPos || CAR().n ? `<span class="pill tn">${I.coin}${eur0(S.cash)} fictifs</span>` : ''}</div>
  ${stuckCard()}
  ${careerHome()}
  ${homeRail()}
  ${rewardCard()}
  ${gamesHome()}
  <div class="pace mini" role="group" aria-label="Durée de la séance">${[['rapide','3 min'],['normal','7 min'],['intense','15 min']].map(([k,t]) => `<button data-pace="${k}" aria-pressed="${S.pace === k}">${t}</button>`).join('')}</div>
  ${extraQuestion()}
  ${trialBanner()}
  <section class="sec"><div class="sec-h"><h2>Mon parcours</h2><button class="v-link" data-go="carte">Ma carte ${I.chev.replace('<path', '<path transform="rotate(-90 12 12)"')}</button></div>
    <div class="card">${ch ? `<div class="row" style="justify-content:space-between"><span class="eyebrow">Niveau ${lv.id} · ${h(lv.title)}</span><span class="small tn">${Math.round(chProgress(ch.id) * 100)} %</span></div>
      <b style="display:block;margin-top:4px">Chapitre ${ch.id} · ${h(ch.title)}</b><div class="bar" style="margin-top:8px"><i style="width:${(chProgress(ch.id) * 100).toFixed(0)}%;background:${ch.color}"></i></div>` : '<b>Parcours gratuit terminé</b><p class="small">La suite est dans Premium.</p>'}
      <div style="margin-top:8px">${next3.map(m => misRow(m)).join('') || ''}</div></div></section>
  <section class="sec"><div class="sec-h"><h2>Aujourd’hui aussi</h2></div><div class="tiles">
    ${dDone ? `<div class="tile done"><span class="eyebrow">Mission du jour</span><b>${h(DAILY.title)}</b><span class="chip g">${I.check}Faite</span></div>` : `<button class="tile" data-play="daily"><span class="eyebrow">Mission du jour · actualité</span><b>${h(DAILY.title)}</b><span class="chip">${I.clock}${DAILY.dur} min</span></button>`}
    ${ep ? (epReady ? `<button class="tile" data-play="${ep.id}"><span class="eyebrow">Épisode ${STORY.indexOf(ep) + 1}/${STORY.length}</span><b>${h(ep.title)}</b><span class="chip">${I.book}Histoire</span></button>` : `<div class="tile done"><span class="eyebrow">Épisode ${STORY.indexOf(ep) + 1}/${STORY.length}</span><b>${h(ep.title)}</b><span class="chip">${I.clock}Demain</span></div>`) : ''}
    ${rv.length ? `<button class="tile" data-review><span class="eyebrow">À revoir</span><b>${rv.length} notion${rv.length > 1 ? 's' : ''} ratée${rv.length > 1 ? 's' : ''}</b><span class="chip">${I.clock}1 min</span></button>` : ''}
    ${sessDoneToday() ? `<div class="tile done"><span class="eyebrow">Séance du jour</span><b>${h(themeFor(0).title)}</b><span class="chip g">${I.check}Faite · demain : ${h(themeFor(1).title)}</span></div>` : ''}
  </div></section>
  <section class="sec"><div class="sec-h"><h2>Mon portefeuille fictif</h2><button class="v-link" data-go="portfolio">Voir ${I.chev.replace('<path', '<path transform="rotate(-90 12 12)"')}</button></div>
    <div class="card">${hasPos ? `<div class="row" style="justify-content:space-between;align-items:flex-end"><div><span class="eyebrow">Cette nuit · cours simulés</span><b class="tn" style="display:block;font-size:24px;color:${dv >= 0 ? 'var(--green)' : 'var(--red)'}">${dv >= 0 ? '+' : ''}${eur(dv)}</b></div><span class="small tn">Valeur ${eur0(v)}</span></div>
      ${Object.keys(S.positions).slice(0, 3).map(id => { const s = MK.find(x => x.id === id); return `<div class="row prow"><span class="pid">${id}</span><span style="flex:1">${h(s.name)}</span><span class="tn" style="color:${chg(s) >= 0 ? 'var(--green)' : 'var(--red)'}">${chg(s) >= 0 ? '+' : ''}${num(chg(s), 1)} %</span></div>`; }).join('')}`
      : '<p class="small">Fais ta séance du jour : ta première décision placera 1 000 € fictifs ici, et tu les verras bouger demain.</p>'}</div></section>
  <section class="sec"><div class="card league"><div class="row" style="justify-content:space-between"><b>Ligue de la semaine</b><span class="sample">Aperçu · exemple</span></div>
    <ol style="margin-top:8px">${leagueRows().map((x, i) => `<li><span class="pos">${i + 1}</span><span class="${x.me ? 'me' : ''}" style="flex:1">${h(x.n)}</span><span class="tn">${x.p} pts</span></li>`).join('')}</ol>
    <p class="note">Les points se gagnent en apprenant, jamais en pariant.</p></div></section>
  ${!S.premium && !minorMode() ? offerHome() : ''}
  ${legal()}
  </div>${dock()}`;
};
function careerHome(){ const c = CAR(), ready = careerReady(), d = RD.DAYS[c.n], ev = d && RD.ev(d.decide);
  if (!S.firstDone && !S.onb) return '';
  return `<section class="sec"><button class="career hero ${ready ? '' : 'wait'}" data-career><span class="grow"><span class="eyebrow">${IC2.news} Journée de trader · actualité réelle</span>
    <b>${ready && ev ? h(ev.co) + ' : à toi de décider' : c.n >= RD.DAYS.length ? 'Semaine réelle terminée' : 'Prochaine journée demain'}</b>
    <span class="small">${ready && ev ? h(d.label) + ' 2026 · 2 minutes · capital fictif ' + eur0(c.cap) : 'Tes décisions sont gardées dans ta carrière.'}</span></span>${ready ? `<span class="ibtn v">${I.play}</span>` : ''}</button></section>`; }
function syncRail(){ const r = document.querySelector('[data-rail]'); if (!r) return; const dots = r.parentElement.querySelectorAll('.rdots i');
  r.addEventListener('scroll', () => { const i = Math.round(r.scrollLeft / (r.firstElementChild.getBoundingClientRect().width + 12)); dots.forEach((d, k) => d.classList.toggle('on', k === i)); }, { passive: true }); }

/* ============================================================
   VENTE D'ABONNEMENT : essai gratuit, prix annuel, écran Premium
   (prix à valider ; paiement réel via Stripe sur le site)
   ============================================================ */
const PRICE = { mensuel: 7.99, annuel: 59.99, trialDays: 7 };
function refreshSub(){ if (S.trialEnd && !S.sub && S.premium && today() > S.trialEnd){ S.premium = false; S.trialOver = true; save(); } if (S.subEnd && today() > S.subEnd && !S.sub){ S.premium = false; S.subEnd = null; save(); } }
const trialLeft = () => S.trialEnd && !S.sub ? Math.max(0, Math.round((Date.parse(S.trialEnd) - Date.parse(today())) / 864e5)) : null;
function startTrial(){ if (window.NT_PAY) return payerStripe(window.__an !== false ? 'annuel' : 'mensuel'); if (S.trialUsed){ toast('Tu as déjà profité de l’essai gratuit.'); return openPaywall(); } S.premium = true; S.trialUsed = true; S.trialEnd = addDays(today(), PRICE.trialDays); S.trialOver = false; save(); closeSheet(); sfx('win'); toast(`Essai Premium activé jusqu’au ${S.trialEnd.split('-').reverse().join('/')}.`); render(); }
function subscribe(plan){ if (window.NT_PAY) return payerStripe(plan); S.premium = true; S.sub = plan; S.subSince = today(); S.trialEnd = null; S.subEnd = null; save(); closeSheet(); sfx('win'); toast(plan === 'annuel' ? 'Premium annuel activé (simulation).' : 'Premium mensuel activé (simulation).'); render(); }
function cancelSub(){ const end = addDays(today(), S.sub === 'annuel' ? 365 : 30); S.sub = null; S.subEnd = end; save(); closeSheet(); toast(`Abonnement résilié. Premium reste actif jusqu’au ${end.split('-').reverse().join('/')}.`); render(); }
/* Vrai site : paiement et espace client Stripe (js/branchements.js).
   L'offre vient toujours du serveur (/api/me), jamais du navigateur. */
async function payerStripe(plan){
  if (!S.account){ closeSheet(); return authOpen('premium'); }
  try { toast('Ouverture du paiement sécurisé…'); await window.NT_PAY.payer(plan); }
  catch (e){ toast(e.status === 409 ? 'Tu as déjà un abonnement en cours.' : 'Le paiement n’a pas pu s’ouvrir. Réessaie dans un instant.'); } }
async function gererStripe(){
  try { await window.NT_PAY.gerer(); } catch (e){ toast('L’espace abonnement n’a pas pu s’ouvrir. Réessaie dans un instant.'); } }
async function syncPremium(){
  if (!window.NT_PAY) return; let d = null;
  try { d = await window.NT_PAY.statut(); } catch (e){ return; }
  const avant = JSON.stringify([S.premium, S.sub, S.subEnd, S.trialUsed]), premium = !!(d && d.plan && d.plan !== 'free');
  if (premium){ S.premium = true; S.sub = d.cancelAtPeriodEnd ? null : (d.facturation || 'mensuel'); S.subSince = S.subSince || today();
    S.subEnd = d.cancelAtPeriodEnd && d.subscriptionPeriodEnd ? d.subscriptionPeriodEnd.slice(0, 10) : null; S.trialEnd = null; }
  else { S.premium = false; S.sub = null; S.subEnd = null; S.trialEnd = null; }
  S.trialUsed = d ? !d.essaiPossible : false;   // sans compte : essai proposé ; connecté : le serveur décide
  if (JSON.stringify([S.premium, S.sub, S.subEnd, S.trialUsed]) !== avant){ save(); render(); }
  if (premium && /[?&]paiement=ok/.test(location.search)) toast('Premium activé.'); }
const priceToggle = () => { const an = window.__an !== false; return `<div class="seg" role="group" aria-label="Facturation"><button data-anp="1" aria-pressed="${an}">Annuel · ${num(PRICE.annuel, 2)} €</button><button data-anp="0" aria-pressed="${!an}">Mensuel · ${num(PRICE.mensuel, 2)} €</button></div>
  <p class="small" style="margin-top:6px">${an ? `Soit ${num(PRICE.annuel / 12, 2)} € par mois, ${Math.round((1 - PRICE.annuel / (PRICE.mensuel * 12)) * 100)} % de moins que le mensuel.` : 'Sans engagement, résiliable à tout moment.'}</p>`; };
function openPaywall(reason){
  const plan = (S.plan2 && S.plan2.plan || []).filter(x => chPremium(x.ch)).slice(0, 3).map(x => CH.find(c => c.id === x.ch));
  openSheet(`<span class="eyebrow">${I.star} Premium</span><h2 class="fiche-t">${h(reason || 'Débloque toute l’école')}</h2>
    ${plan.length ? `<p class="small">Ton plan continue avec : ${plan.map(c => `« ${h(c.title)} »`).join(', ')}.</p>` : ''}
    <ul class="rules"><li>Les 5 niveaux, 15 chapitres, 160 missions</li><li>Examens et Certificats NovaTitre, Certificat Trader</li><li>Suivi personnalisé et Nova Coach par l’IA</li><li>Toutes les séances du jour, la salle de marché et la Prépa AMF</li></ul>
    ${priceToggle()}
    ${!S.trialUsed ? `<button class="btn v full big" style="margin-top:12px" data-trial>Essayer gratuitement ${PRICE.trialDays} jours</button><p class="small" style="text-align:center;margin-top:6px">Puis ${window.__an !== false ? num(PRICE.annuel, 2) + ' € par an' : num(PRICE.mensuel, 2) + ' € par mois'}. Annulable avant la fin de l’essai, sans frais.</p>`
      : `<button class="btn v full big" style="margin-top:12px" data-subscribe="${window.__an !== false ? 'annuel' : 'mensuel'}">S’abonner</button>`}
    <button class="btn ghost full" style="margin-top:8px" data-sheetclose>Plus tard</button>
    <p class="note">${window.NT_PAY ? 'Paiement sécurisé par Stripe. Résiliable à tout moment.' : 'Prototype : aucun paiement réel. Sur le site, paiement sécurisé par Stripe après acceptation des CGV ; rétractation et résiliation en 3 clics. Prix indicatifs, à valider.'}</p>`, 'pay-sheet');
}
function trialBanner(){ const tl = trialLeft();
  if (tl != null && S.premium) return `<section class="sec"><div class="card trial-card"><b>${I.star} Essai Premium : ${tl} jour${tl > 1 ? 's' : ''} restant${tl > 1 ? 's' : ''}</b><p class="small" style="margin-top:4px">Tout est débloqué. Garde Premium pour ne pas perdre ta progression dans les niveaux avancés.</p><button class="btn v sm" style="margin-top:10px" data-paywall>Garder Premium</button></div></section>`;
  if (S.trialOver && !S.premium) return `<section class="sec"><div class="card trial-card"><b>Ton essai Premium est terminé</b><p class="small" style="margin-top:4px">Ta progression est gardée. Abonne-toi pour reprendre les niveaux avancés là où tu t’es arrêté.</p><button class="btn v sm" style="margin-top:10px" data-paywall>Voir les offres</button></div></section>`;
  return ''; }
function offerHome(){ return `<section class="sec"><div class="card offer-home"><span class="eyebrow">${I.star} Premium</span><h3 style="font-size:20px;margin:6px 0">Toute l’école, de zéro à trader</h3>
  <p class="small">5 niveaux, examens et certificats, suivi par l’IA, salle de marché, Prépa AMF.</p>
  <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">${!S.trialUsed ? `<button class="btn v sm" data-trial>Essai gratuit ${PRICE.trialDays} jours</button>` : `<button class="btn v sm" data-paywall>S’abonner</button>`}<button class="btn ghost sm" data-go="pricing">Toutes les offres</button></div>
  <p class="small" style="margin-top:8px">Dès ${num(PRICE.annuel / 12, 2)} € par mois avec l’offre annuelle.</p></div></section>`; }
function subRow(){ const tl = trialLeft();
  const st = S.sub ? `Premium ${S.sub} depuis le ${S.subSince.split('-').reverse().join('/')}` : tl != null && S.premium ? `Essai Premium · ${tl} jour${tl > 1 ? 's' : ''} restant${tl > 1 ? 's' : ''}` : S.subEnd && S.premium ? `Résilié · actif jusqu’au ${S.subEnd.split('-').reverse().join('/')}` : S.premium ? 'Premium (simulé)' : 'Découverte (gratuit)';
  return `<div class="toggle"><span>Mon abonnement<span class="small" style="display:block">${h(st)}</span></span><button class="btn ghost sm" data-managesub>${S.sub ? 'Gérer' : 'Voir'}</button></div>`; }
function manageSub(){
  if (window.NT_PAY && (S.sub || S.subEnd)) return gererStripe();
  if (!S.sub) return openPaywall();
  openSheet(`<span class="eyebrow">Mon abonnement</span><h2 class="fiche-t">Premium ${S.sub}</h2><p class="small">Depuis le ${S.subSince.split('-').reverse().join('/')}. ${S.sub === 'annuel' ? num(PRICE.annuel, 2) + ' € par an' : num(PRICE.mensuel, 2) + ' € par mois'}.</p>
    <button class="btn ghost full" style="margin-top:12px" data-subscribe="${S.sub === 'annuel' ? 'mensuel' : 'annuel'}">Passer en ${S.sub === 'annuel' ? 'mensuel' : 'annuel'}</button>
    ${window.__cancelAsk ? `<div class="card warn" style="margin-top:12px"><b>Confirmer la résiliation ?</b><p class="small" style="margin-top:4px">Premium reste actif jusqu’à la fin de la période payée. Ta progression est conservée.</p><button class="btn v full" style="margin-top:10px" data-cancelsub>Oui, résilier</button></div>`
      : `<button class="btn ghost full" style="margin-top:8px" data-cancelask>Résilier mon abonnement</button>`}
    <p class="note">Résiliation en 3 clics (obligation légale). Sur le site : portail client Stripe.</p>`); }

/* ============================================================
   V9 — CARRIÈRE DE TRADER (actualité réelle), MINI-JEUX,
   OUTILS À DÉBLOQUER, CARTE DE PROGRESSION, BUREAU, ANIMATIONS
   ============================================================ */
const RD = window.NT_REAL;
const IC2 = {
  map: P('<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>'),
  game: P('<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>'),
  desk: P('<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M7 12l3-3 2.5 2 4-4.5"/><path d="M9 20h6M12 16v4"/>'),
  news: P('<rect x="3" y="4" width="15" height="16" rx="2.5"/><path d="M18 8h3v9.5a2.5 2.5 0 0 1-5 0"/><path d="M7 8h7M7 12h7M7 16h4"/>'),
  gift: P('<rect x="3.5" y="9" width="17" height="11.5" rx="2"/><path d="M2.5 9h19M12 9v11.5"/><path d="M12 9c-1.5-3.5-6-4-6-1.5S10 9 12 9zM12 9c1.5-3.5 6-4 6-1.5S14 9 12 9z"/>'),
  up: P('<path d="M4 17l6-6 4 4 6-7"/><path d="M14 8h6v6"/>'),
  down: P('<path d="M4 7l6 6 4-4 6 7"/><path d="M14 16h6v-6"/>'),
  pause: P('<path d="M9 6v12M15 6v12"/>'),
  ext: P('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/>'),
};
const dec = v => Math.min(2, (String(v).split('.')[1] || '').length);
const fmtPct = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v), d) + ' %';
const srcLink = k => { const s = RD.SRC[k]; return s ? `<a class="src" href="${h(s.u)}" target="_blank" rel="noopener">${IC2.ext}${h(s.t)}</a>` : ''; };
const REAL_TAG = `<span class="realtag">Données réelles au ${RD.MARKET.asOf}</span>`;

/* ---------- outils à débloquer (liés aux chapitres) ---------- */
const TOOLS = [
  { id: 'market', ch: 0, name: 'Ordre au marché', ic: I.bolt, what: 'Acheter ou vendre tout de suite, au prix du moment.', go: 'markets' },
  { id: 'limit', ch: 2, name: 'Ordre à cours limité', ic: I.target, what: 'Tu fixes ton prix : pas plus cher à l’achat, pas moins cher à la vente.', game: 'ordre', flash: ['Au marché, tu prends le prix du moment. À cours limité, tu fixes ton prix maximum (achat) ou minimum (vente).', 'L’ordre attend dans le carnet tant que personne n’accepte ton prix.'] },
  { id: 'etf', ch: 3, name: 'Indice de solidité du portefeuille', ic: I.shield, what: 'Mesure la diversification de ton portefeuille fictif.', go: 'portfolio', flash: ['Un portefeuille solide mélange des secteurs et évite qu’une seule ligne pèse trop.', 'Le 30 octobre 2026, Soitec, STMicro et Schneider ont baissé ensemble : un panier trop concentré aurait souffert.'] },
  { id: 'analyse', ch: 4, name: 'Lecture des résultats', ic: I.book, what: 'Comparer un résultat à ce que le marché attendait.', go: 'markets', flash: ['L’action réagit surtout à l’écart entre le résultat publié et l’attente des analystes.', 'Sanofi, 30/10/2026 : 14,44 milliards de ventes contre 13,66 attendus, le titre a monté de 4,7 %.'] },
  { id: 'bougies', ch: 10, name: 'Graphique en bougies', ic: I.candle, what: 'Lire ouverture, plus haut, plus bas et clôture d’un coup d’œil.', game: 'support', flash: ['Une bougie résume une période : le corps va de l’ouverture à la clôture, les mèches montrent les extrêmes.', 'Nouveau jeu débloqué : la chasse au support.'] },
  { id: 'indic', ch: 11, name: 'Indicateurs : moyenne mobile et RSI', ic: I.chart, what: 'Repérer une tendance et un excès.', go: 'room', flash: ['La moyenne mobile lisse les prix pour voir la tendance. Le RSI mesure si la hausse ou la baisse a été très rapide.'] },
  { id: 'stop', ch: 12, name: 'Stop et taille de position automatique', ic: I.shield, what: 'Ta perte maximale décidée avant d’entrer.', go: 'room', flash: ['Le stop coupe la position si le cours va contre toi. La règle des 1 % : ne jamais risquer plus de 1 % du capital par trade.'] },
  { id: 'salle', ch: 13, name: 'Salle de marché notée', ic: I.candle, what: 'Trader en conditions réelles, noté sur ta discipline.', go: 'room', flash: ['Dans la salle de marché, tu es noté sur le respect de ton plan, pas sur la chance.'] },
  { id: 'short', ch: 14, name: 'Vente à découvert (simulée)', ic: IC2.down, what: 'Miser sur la baisse d’une action.', go: 'markets', flash: ['Vendre à découvert, c’est vendre une action empruntée pour la racheter plus bas. Si elle monte, la perte n’a pas de limite : le stop est obligatoire.'] },
];
const toolOn = t => t.ch === 0 || chProgress(t.ch) >= 0.5 || plMax(S.placement || 0) >= t.ch;
const nextTool = () => TOOLS.find(t => !toolOn(t));
function toolNeed(t){ const l = chMissions(t.ch), need = Math.ceil(l.length * 0.5) - l.filter(m => isDone(m.id)).length; return Math.max(1, need); }
function checkUnlocks(){
  if (!S.onb || M || XO) return;
  if (!S.toolsSeen){ S.toolsSeen = {}; TOOLS.forEach(t => { if (toolOn(t)) S.toolsSeen[t.id] = 1; }); save(); return; }
  const t = TOOLS.find(x => toolOn(x) && !S.toolsSeen[x.id]); if (!t) return;
  S.toolsSeen[t.id] = 1; save();
  document.querySelectorAll('.unlock-pop').forEach(x => x.remove());
  const d = document.createElement('div'); d.className = 'unlock-pop'; d.setAttribute('role', 'status');
  d.innerHTML = `<span class="up-ic">${t.ic}</span><span class="grow"><span class="eyebrow">Nouvel outil débloqué</span><b>${h(t.name)}</b></span><button class="btn v sm" data-toolinfo="${t.id}">Voir</button>`;
  document.body.appendChild(d); sfx('win'); setTimeout(() => d.classList.add('out'), 7000); setTimeout(() => d.remove(), 7600);
}
function toolSheet(id){ const t = TOOLS.find(x => x.id === id); if (!t) return; const on = toolOn(t);
  document.querySelectorAll('.unlock-pop').forEach(x => x.remove());
  openSheet(`<div class="tool-hero ${on ? 'on' : ''}">${t.ic}</div><span class="eyebrow">${on ? 'Outil débloqué' : 'Outil verrouillé'}</span><h2 class="fiche-t">${h(t.name)}</h2>
    <p class="small">${h(t.what)}</p>
    ${on && t.flash ? `<div class="flash-mini">${t.flash.map(x => `<p>${h(x)}</p>`).join('')}</div>` : ''}
    ${on ? (t.game ? `<button class="btn v full" style="margin-top:14px" data-gamestart="${t.game}">Essayer dans un jeu</button>` : t.go ? `<button class="btn v full" style="margin-top:14px" data-go="${t.go}">L’utiliser</button>` : '')
      : `<p class="small" style="margin-top:10px">Se débloque en validant la moitié du chapitre ${t.ch} : ${h(CH.find(c => c.id === t.ch).title)} (encore ${toolNeed(t)} mission${toolNeed(t) > 1 ? 's' : ''}).</p><button class="btn v full" style="margin-top:14px" data-cnode="${t.ch}">Voir le chapitre</button>`}`); }
const toolStrip = () => `<div class="tools">${TOOLS.map(t => `<button class="tool ${toolOn(t) ? 'on' : ''}" data-toolinfo="${t.id}" aria-label="${h(t.name)}${toolOn(t) ? '' : ' (verrouillé)'}"><span>${toolOn(t) ? t.ic : I.lock}</span><small>${h(t.name.split(' ').slice(0, 3).join(' '))}</small></button>`).join('')}</div>`;

/* ---------- la prochaine récompense, toujours visible ---------- */
function nextReward(){
  const t = nextTool(), nm = nextMission(), lv = nm ? levelOf(nm.ch) : null;
  const opts = [];
  if (t){ const l = chMissions(t.ch), done = l.filter(m => isDone(m.id)).length, goal = Math.ceil(l.length * 0.5); opts.push({ kind: 'tool', t, need: toolNeed(t), pct: Math.min(100, done / goal * 100), title: t.name, ic: t.ic, ch: t.ch }); }
  if (lv && !S.certs[lv.id]){ const ms = lvMissions(lv), d = ms.filter(m => isDone(m.id)).length, goal = Math.ceil(ms.length * 0.7); opts.push({ kind: 'cert', lv, need: Math.max(0, goal - d), pct: Math.min(100, d / goal * 100), title: `Certificat du niveau ${lv.id}`, ic: I.trophy }); }
  opts.sort((a, b) => a.need - b.need); return opts[0] || null;
}
const rewardCard = (cls = '') => { const r = nextReward(); if (!r) return '';
  return `<button class="reward ${cls}" ${r.kind === 'tool' ? `data-toolinfo="${r.t.id}"` : `data-go="carte"`}><span class="rw-ic">${r.ic}</span><span class="grow"><span class="eyebrow">Prochaine récompense</span><b>${h(r.title)}</b>
    <span class="rw-bar"><i style="width:${r.pct.toFixed(0)}%"></i></span><span class="small">${r.need ? `Encore ${r.need} mission${r.need > 1 ? 's' : ''}` : 'Examen disponible'}</span></span></button>`; };

/* ---------- carte de progression ---------- */
const MAPX = [50, 72, 80, 66, 44, 26, 20, 34];
PAGES.carte = () => {
  const nm = nextMission(), curCh = nm ? nm.ch : null, items = []; let y = 0, k = 0;
  LV.forEach(l => { items.push({ t: 'lv', l, y }); y += 92;
    CH.filter(c => l.ch.includes(c.id)).forEach(c => { items.push({ t: 'ch', c, y, x: MAPX[k++ % MAPX.length] }); y += 112; });
    items.push({ t: 'ex', l, y, x: MAPX[k++ % MAPX.length] }); y += 112; });
  const pts = items.filter(i => i.t !== 'lv'), H = y + 20, cy = i => i.y + 40;
  const path = arr => arr.map((p, i) => i ? `C ${arr[i - 1].x} ${cy(arr[i - 1]) + 56}, ${p.x} ${cy(p) - 56}, ${p.x} ${cy(p)}` : `M ${p.x} ${cy(p)}`).join(' ');
  const curIdx = Math.max(0, pts.findIndex(p => p.t === 'ch' && p.c.id === curCh));
  const doneMs = MS.filter(m => isDone(m.id)).length;
  const node = it => {
    if (it.t === 'lv'){ const pr = lvProgress(it.l), cert = S.certs[it.l.id];
      return `<div class="map-lv" style="top:${it.y}px"><span class="eyebrow">Niveau ${it.l.id}</span><b>${h(it.l.title)}</b><span class="map-lv-p tn">${cert ? I.check + 'Certifié' : Math.round(pr * 100) + ' %'}</span></div>`; }
    if (it.t === 'ex'){ const cert = S.certs[it.l.id];
      return `<button class="mnode ex ${cert ? 'done' : ''}" style="left:${it.x}%;top:${it.y}px" data-exam="lv${it.l.id}" aria-label="Examen du niveau ${it.l.id}"><span class="mn-c">${I.trophy}</span><span class="mn-l"><b>Examen ${it.l.id}</b><span>${cert ? cert.pct + ' %' : it.l.exam + ' questions'}</span></span></button>`; }
    const c = it.c, pr = chProgress(c.id), un = chUnlocked(c.id), prem = chPremium(c.id), cur = c.id === curCh, tool = TOOLS.find(t => t.ch === c.id);
    const cls = pr >= 1 ? 'done' : !un ? 'lock' : prem ? 'prem' : cur ? 'cur' : pr > 0 ? 'part' : 'todo';
    return `<button class="mnode ${cls}" style="left:${it.x}%;top:${it.y}px;--c:${c.color};--p:${(pr * 100).toFixed(0)}" data-cnode="${c.id}" aria-label="Chapitre ${c.id} : ${h(c.title)}, ${Math.round(pr * 100)} %">
      ${cur ? '<span class="mn-here">Tu es ici</span>' : ''}<span class="mn-c"><span class="mn-in">${!un ? I.lock : pr >= 1 ? I.check : c.id}</span></span>
      <span class="mn-l"><b>${h(c.title)}</b><span>${prem ? 'Premium' : Math.round(pr * 100) + ' %'}</span></span>
      ${tool ? `<span class="mn-tool ${toolOn(tool) ? 'on' : ''}" title="Débloque : ${h(tool.name)}">${toolOn(tool) ? tool.ic : IC2.gift}</span>` : ''}</button>`; };
  return `<div class="wrap">${top()}
  <div class="pg-h"><h1>Ton parcours</h1><button class="v-link" data-go="missions">Vue liste</button></div>
  <div class="map-sum"><div><b class="tn" data-count="${doneMs}">${doneMs}</b><span>/ ${MS.length} missions</span></div><div><b class="tn" data-count="${Object.keys(S.certs).length}">${Object.keys(S.certs).length}</b><span>certificats</span></div><div><b class="tn" data-count="${TOOLS.filter(toolOn).length}">${TOOLS.filter(toolOn).length}</b><span>/ ${TOOLS.length} outils</span></div></div>
  ${rewardCard('sticky')}
  <section class="sec"><div class="sec-h"><h2>Mes outils</h2><span class="small tn">${TOOLS.filter(toolOn).length} / ${TOOLS.length}</span></div>${toolStrip()}</section>
  <div class="map" style="height:${H}px">
    <svg class="map-path" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="mpG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4b5ff"/><stop offset="1" stop-color="#5b8cff"/></linearGradient></defs>
      <path d="${path(pts)}" class="mp-bg" vector-effect="non-scaling-stroke"/><path d="${path(pts.slice(0, curIdx + 1))}" class="mp-on" vector-effect="non-scaling-stroke"/></svg>
    ${items.map(node).join('')}
  </div>
  ${legal()}</div>${dock()}`;
};
function chapterSheet(c){
  const ch = CH.find(x => x.id === c); if (!ch) return; const un = chUnlocked(c), prem = chPremium(c), list = chMissions(c), cur = list.find(m => !isDone(m.id)), tool = TOOLS.find(t => t.ch === c);
  openSheet(`<span class="eyebrow">Chapitre ${c} · Niveau ${levelOf(c).id}</span><h2 class="fiche-t">${h(ch.title)}</h2><p class="small">${h(ch.sub)}</p>
    <div class="bar" style="margin:12px 0 4px"><i style="width:${(chProgress(c) * 100).toFixed(0)}%;background:${ch.color}"></i></div>
    ${tool ? `<button class="reward slim" data-toolinfo="${tool.id}"><span class="rw-ic">${toolOn(tool) ? tool.ic : IC2.gift}</span><span class="grow"><span class="eyebrow">${toolOn(tool) ? 'Outil débloqué' : 'À débloquer ici'}</span><b>${h(tool.name)}</b></span></button>` : ''}
    ${!un ? `<p class="small" style="margin-top:12px">Valide la moitié du chapitre précédent pour ouvrir celui-ci.</p>` : prem ? `<button class="btn v full" style="margin-top:12px" data-paywall>Débloquer avec Premium</button>` : cur ? `<button class="btn v full big" style="margin-top:12px" data-sheetplay="${cur.id}">${I.play}Jouer : ${h(cur.title)}</button>` : ''}
    <div class="sheet-list">${list.map(m => { const d = isDone(m.id), lk = !un || prem; return `<button class="srow ${d ? 'done' : lk ? 'lock' : ''}" ${lk ? 'disabled' : `data-sheetplay="${m.id}"`}><span class="st">${d ? I.check : lk ? I.lock : I.play}</span><span class="grow"><b>${h(m.title)}</b><span>${h(m.kind)} · ${m.dur} min</span></span></button>`; }).join('')}</div>`);
}

/* ---------- carrière de trader : une journée réelle par jour ---------- */
let XO = null;   // écran plein (carrière ou jeu) en cours
const CAR = () => (S.career = S.career || { n: 0, last: null, cap: 10000, log: [], runs: 0 });
const careerReady = () => { const c = CAR(); return c.n < RD.DAYS.length && c.last !== today(); };
const REASONS = [['ecart', 'Je compare la nouvelle à ce que le marché attendait', true], ['intuition', 'J’ai un bon pressentiment', false], ['prudence', 'C’est incertain : je limite le risque', true]];
const AMTS = [5, 10, 25, 50];
function startCareer(){ const c = CAR();
  if (c.n >= RD.DAYS.length){ return openSheet(`<span class="eyebrow">Carrière de trader</span><h2 class="fiche-t">Semaine terminée</h2><p class="small">Tu as rejoué la semaine réelle du ${RD.MARKET.week}. Sur le site, une nouvelle journée arrive chaque matin avec l’actualité de la veille.</p><button class="btn v full" style="margin-top:14px" data-careerreset>Rejouer la semaine</button>`); }
  if (c.last === today()) return toast('Ta prochaine journée de trader arrive demain.');
  XO = { kind: 'career', day: RD.DAYS[c.n], step: 'brief', side: null, amt: null, reason: null, fi: 0, g: {} }; renderXO(); }
function xoShell(inner, prog, label){
  let p = $('#xo'); if (!p){ p = document.createElement('div'); p.id = 'xo'; p.className = 'player xo'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); document.body.appendChild(p); document.body.style.overflow = 'hidden'; }
  const key = XO ? (XO.kind === 'game' ? 'g' + XO.i + (XO.done ? 'd' : '') : XO.step + XO.fi) : ''; const entering = key !== p.dataset.k; p.dataset.k = key; p.classList.toggle('enter', entering);
  p.setAttribute('aria-label', label); p.innerHTML = `<div class="in"><div class="p-top"><button class="ibtn" data-xoquit aria-label="Quitter">${I.x}</button><div class="bar"><i style="width:${prog}%"></i></div>${XO && XO.kind === 'game' ? `<span class="chip v tn" id="gTimer">${I.clock}${Math.ceil(Math.max(0, XO.end - Date.now()) / 1000)} s</span>` : ''}${XO && XO.step !== 'end' ? askQBtn() : ''}</div>${inner}</div>`;
  if (entering) p.scrollTop = 0; animate(p, !entering); }
function closeXO(){ if (XO && XO.tick) clearInterval(XO.tick); XO = null; const p = $('#xo'); if (p) p.remove(); document.body.style.overflow = ''; render(); }
const cacOf = d => RD.MARKET.cacDays[d.n - 1];
function renderXO(){
  if (!XO) return; if (XO.kind === 'game') return renderGame();
  const c = CAR(), d = XO.day, ev = RD.ev(d.decide), br = RD.ev(d.brief), cac = cacOf(d), steps = ['brief', 'decide', 'reveal', 'flash', 'end'], prog = steps.indexOf(XO.step) / (steps.length - 1) * 100;
  const shortOn = toolOn(TOOLS.find(t => t.id === 'short'));
  let body = '', foot = '';
  if (XO.step === 'brief'){
    body = `<div class="p-body"><div class="p-kicker"><span class="chip v">Journée ${d.n} / ${RD.DAYS.length}</span>${REAL_TAG}</div>
      <h2 class="xo-h">${h(d.label)} 2026</h2><p class="muted">Tu arrives au bureau. Voici le marché ce jour-là.</p>
      <div class="mkt-big"><span class="eyebrow">CAC 40 à la clôture</span><b class="tn" data-count="${cac[1]}" data-d="2">${num(cac[1], 2)}</b><span class="tn ${cac[2] >= 0 ? 'pos' : 'neg'}">${fmtPct(cac[2], 2)}</span></div>
      ${br && br.id !== ev.id ? `<div class="news"><span class="eyebrow">${IC2.news} À la une · ${h(br.sector)}</span><b>${h(br.co)}</b><p>${h(br.head)}</p>${br.move != null ? `<span class="mv ${br.move >= 0 ? 'pos' : 'neg'} tn">${br.approx ? 'environ ' : ''}${fmtPct(br.move, dec(br.move))}</span>` : ''}${br.extra ? `<p class="small">${h(br.extra)}</p>` : ''}</div>` : ''}
      <div class="kpis"><div><span>Capital de carrière</span><b class="tn">${eur0(c.cap)}</b></div><div><span>Brent (30/10)</span><b class="tn">${num(RD.MARKET.brent.price, 2)} $</b></div><div><span>Taux BCE</span><b class="tn">${num(RD.MARKET.bce.depot, 2)} %</b></div></div>
      <p class="note">Événements réels et passés, rejoués pour apprendre. Ce n’est pas un conseil et cela ne prédit rien. Ton capital est fictif.</p></div>`;
    foot = `<button class="btn v full big" data-xonext>Voir la nouvelle du jour</button>`;
  } else if (XO.step === 'decide'){
    const can = XO.side && (XO.side === 'out' || XO.amt) && XO.reason;
    body = `<div class="p-body"><div class="p-kicker"><span class="chip v">Ta décision</span><span class="chip">${h(ev.day)}</span></div>
      <div class="news big"><span class="eyebrow">${IC2.news} ${h(ev.sector)}</span><b>${h(ev.co)}</b><p>${h(ev.head)}</p></div>
      <p class="p-q">Que fais-tu avec ton capital fictif ?</p>
      <div class="sides"><button class="side up" data-cside="buy" aria-pressed="${XO.side === 'buy'}">${IC2.up}<b>Acheter</b><span>Je mise sur la hausse</span></button>
        <button class="side down" ${shortOn ? 'data-cside="short"' : 'data-toolinfo="short"'} aria-pressed="${XO.side === 'short'}">${shortOn ? IC2.down : I.lock}<b>Vendre à découvert</b><span>${shortOn ? 'Je mise sur la baisse' : 'Débloqué au chapitre 14'}</span></button>
        <button class="side out" data-cside="out" aria-pressed="${XO.side === 'out'}">${IC2.pause}<b>Rester à l’écart</b><span>Je ne prends pas de risque</span></button></div>
      ${XO.side && XO.side !== 'out' ? `<p class="p-q sm">Quelle part du capital ?</p><div class="amts">${AMTS.map(a => `<button data-camt="${a}" aria-pressed="${XO.amt === a}"><b class="tn">${a} %</b><span class="tn">${eur0(c.cap * a / 100)}</span></button>`).join('')}</div>` : ''}
      ${XO.side ? `<p class="p-q sm">Pourquoi ?</p><div class="opts">${REASONS.map(([k, t]) => `<button class="opt sm" data-creason="${k}" aria-pressed="${XO.reason === k}">${h(t)}</button>`).join('')}</div>` : ''}</div>`;
    foot = `<button class="btn v full big" data-xonext${can ? '' : ' disabled'}>Valider ma décision</button>`;
  } else if (XO.step === 'reveal'){
    const r = XO.res;
    body = `<div class="p-body"><div class="p-kicker"><span class="chip v">Ce qui s’est vraiment passé</span>${REAL_TAG}</div>
      <div class="reveal ${ev.move >= 0 ? 'pos' : 'neg'}"><span class="eyebrow">${h(ev.co)} · ${h(ev.day)}</span><b class="tn" data-count="${ev.move}" data-d="${dec(ev.move)}" data-fmt="pct">${fmtPct(ev.move, dec(ev.move))}</b>${ev.approx ? '<span class="small">environ</span>' : ''}</div>
      ${ev.extra ? `<p class="small" style="text-align:center">${h(ev.extra)}</p>` : ''}
      <div class="kpis"><div><span>Ton résultat</span><b class="tn ${r.pl > 0 ? 'pos' : r.pl < 0 ? 'neg' : ''}" data-count="${r.pl}" data-fmt="eur" data-sign="1">${(r.pl > 0 ? '+' : '') + eur0(r.pl)}</b></div><div><span>Ta méthode</span><b>${r.good ? 'Solide' : 'À revoir'}</b></div><div><span>Expérience</span><b class="tn">+${r.xp}</b></div></div>
      <div class="why"><span class="eyebrow">Pourquoi</span><p>${h(ev.why)}</p></div>
      <p class="small">${XO.side === 'out' ? 'Rester à l’écart est une vraie décision : un trader ne joue pas chaque nouvelle.' : r.good ? 'Bonne méthode, quel que soit le résultat.' : 'Un pressentiment n’est pas une méthode : la prochaine fois, compare la nouvelle aux attentes.'} Les points récompensent ta méthode, pas la chance.</p>
      ${srcLink(ev.src)}</div>`;
    foot = `<button class="btn v full big" data-xonext>Comprendre en 30 secondes</button>`;
  } else if (XO.step === 'flash'){
    const F = RD.FLASH[d.flash], cd = F.cards[XO.fi], g = XO.g[XO.fi];
    body = `<div class="p-body"><div class="p-kicker"><span class="chip v">Leçon flash · ${XO.fi + 1}/${F.cards.length}</span></div><h2 class="xo-h">${h(F.title)}</h2>
      <div class="lcard"><div class="viz">${VIZ[cd.viz] || ''}</div><b>${h(cd.h)}</b><p>${h(cd.t)}</p>
      ${cd.k === 'guess' ? `<div class="opts">${cd.opts.map((o, i) => `<button class="opt sm ${g != null ? (i === cd.a ? 'ok' : i === g ? 'ko' : '') : ''}" data-cguess="${i}"${g != null ? ' disabled' : ''}>${h(o)}</button>`).join('')}</div>${g != null ? `<p class="small fbline">${h(cd.r)}</p>` : ''}` : ''}
      ${cd.k === 'tap' ? (g != null ? `<p class="fbline">${h(cd.hidden)}</p>` : `<button class="btn ghost sm" data-cguess="0">Voir la réponse</button>`) : ''}</div></div>`;
    foot = `<button class="btn v full big" data-xonext${cd.k !== 'info' && g == null ? ' disabled' : ''}>${XO.fi < F.cards.length - 1 ? 'Suivant' : 'Terminer la journée'}</button>`;
  } else {
    const nxt = RD.DAYS[c.n];
    body = `<div class="p-body center"><div class="win-badge">${I.trophy}</div><h2 class="xo-h">Journée ${d.n} terminée</h2>
      <div class="kpis"><div><span>Capital</span><b class="tn" data-count="${c.cap}" data-from="${XO.capBefore}" data-fmt="eur">${eur0(c.cap)}</b></div><div><span>Expérience</span><b class="tn">+${XO.res.xp}</b></div><div><span>Série</span><b class="tn">${S.streak} j</b></div></div>
      ${xpBar({ before: XO.scoreBefore })}
      <div class="week">${RD.DAYS.map((x, i) => `<span class="${i < c.n ? 'on' : ''}">${h(x.label.split(' ')[0].slice(0, 3))}</span>`).join('')}</div>
      <p class="small">${nxt ? `Demain : ${h(nxt.label)}. Une journée par jour, pour garder le rythme sans t’épuiser.` : 'Semaine réelle terminée. Bravo.'}</p></div>`;
    foot = `<button class="btn v full big" data-xoquit>Retour</button>`;
  }
  xoShell(`${body}<div class="p-foot">${foot}</div>`, prog, 'Journée de trader');
  if (XO.step === 'end') requestAnimationFrame(() => setTimeout(() => { const b = document.querySelector('#xo .xpbar i'); if (b) b.style.width = b.dataset.to + '%'; }, 150));
}
function careerNext(){
  const c = CAR(), d = XO.day, ev = RD.ev(d.decide);
  if (XO.step === 'brief') XO.step = 'decide';
  else if (XO.step === 'decide'){
    const stake = XO.side === 'out' ? 0 : c.cap * XO.amt / 100, dir = XO.side === 'buy' ? 1 : XO.side === 'short' ? -1 : 0;
    const pl = Math.round(stake * ev.move / 100 * dir), good = REASONS.find(r => r[0] === XO.reason)[2] && (XO.side === 'out' || XO.amt <= 25);
    const first = !c.runs, xp = first ? 15 + (good ? 15 : 0) : 0;
    XO.res = { pl, good, xp }; XO.capBefore = c.cap; XO.step = 'reveal'; sfx(good ? 'ok' : 'ko');
  } else if (XO.step === 'reveal'){ XO.step = 'flash'; XO.fi = 0; }
  else if (XO.step === 'flash'){ const F = RD.FLASH[d.flash]; if (XO.fi < F.cards.length - 1){ XO.fi++; } else {
    const td = today(); c.cap += XO.res.pl; c.log.push({ d: d.n, co: ev.co, side: XO.side, amt: XO.amt, move: ev.move, pl: XO.res.pl, good: XO.res.good }); c.n++; c.last = td;
    XO.scoreBefore = S.score; S.score = Math.min(1000, S.score + XO.res.xp);
    if (S.lastDay !== td){ const diff = S.lastDay ? Math.round((Date.parse(td) - Date.parse(S.lastDay)) / 864e5) : 99; S.streak = diff <= 2 ? S.streak + 1 : 1; S.lastDay = td; }
    S.dayCount[td] = todayCount() + 1;
    S.history.push(`${td.split('-').reverse().join('/')} · Journée de trader ${d.n} (${ev.co}) : ${XO.res.pl >= 0 ? '+' : ''}${eur0(XO.res.pl)} fictifs`);
    XO.step = 'end'; save(); sfx('win'); } }
  renderXO();
}

/* ---------- mini-jeux de 45 secondes ---------- */
const shuf = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const ORDRES = [['Tu veux acheter tout de suite, le prix exact importe peu.', 0, 'Au marché : exécution immédiate au prix du moment.'], ['Tu veux acheter, mais pas plus cher que 42 €.', 1, 'Limité : tu fixes ton prix maximum.'], ['Tu détiens des actions et veux vendre automatiquement si le cours tombe sous 38 €.', 2, 'Stop : il se déclenche si le cours franchit ton seuil.'], ['Tu veux vendre, mais pas moins de 55 €.', 1, 'Limité : tu fixes ton prix minimum à la vente.'], ['Action peu échangée, gros écart entre achat et vente : tu veux maîtriser ton prix.', 1, 'Quand le spread est large, l’ordre limité évite une mauvaise surprise.'], ['Tu veux protéger un gain : vendre si le cours repasse sous 60 €.', 2, 'Stop : il protège le gain déjà fait.'], ['Marché très liquide, tu veux être exécuté immédiatement.', 0, 'Au marché : sur un titre liquide, l’écart de prix est faible.'], ['Tu pars en vacances et veux limiter ta perte maximale.', 2, 'Stop : ta perte maximale est décidée à l’avance.'], ['Tu veux acheter seulement si l’action redescend à 30 €.', 1, 'Limité à 30 € : l’ordre attend que le cours vienne à toi.']];
const ARNAQUES = [['« Placement garanti 12 % par mois, places limitées, répondez avant ce soir. »', 0, 'Rendement garanti très élevé et urgence : deux signaux d’arnaque.'], ['« Votre banque vous propose un livret réglementé à taux fixé par l’État. »', 1, 'Les livrets réglementés existent et leur taux est public.'], ['« Un conseiller vous contacte sur WhatsApp pour investir en crypto via un virement à l’étranger. »', 0, 'Contact non sollicité, messagerie, virement à l’étranger : arnaque classique.'], ['« Un ETF sur le CAC 40, frais 0,25 % par an, peut baisser comme l’indice. »', 1, 'Frais affichés et risque annoncé : c’est sérieux.'], ['« Doublez votre argent en 30 jours grâce à notre robot de trading. »', 0, 'Personne ne peut promettre de doubler un capital : arnaque.'], ['« Avant d’investir, vérifiez l’autorisation de la société sur REGAFI et les listes noires de l’AMF. »', 1, 'C’est le bon réflexe recommandé par l’AMF.'], ['« Investissez dans le vin, rendement sans risque, une star l’a fait. »', 0, 'Placement atypique, « sans risque » et célébrité : signaux d’alerte.'], ['« Le capital investi en actions n’est pas garanti : vous pouvez perdre une partie de votre mise. »', 1, 'Un message honnête rappelle le risque.'], ['« Payez des frais de déblocage pour récupérer vos gains. »', 0, 'Demander de payer pour récupérer son argent : arnaque de recouvrement.'], ['« Votre épargne de précaution : 3 à 6 mois de dépenses sur un livret disponible. »', 1, 'Conseil général prudent et sérieux.']];
function calcItem(){ const r = Math.random, k = Math.floor(r() * 4);
  if (k === 0){ const a = 20 + Math.floor(r() * 60), p = [5, 10, 20, 25, -10, -20][Math.floor(r() * 6)], b = Math.round(a * (1 + p / 100) * 100) / 100; return { q: `Une action passe de ${num(a, 0)} € à ${num(b, 2)} €. Variation ?`, opts: shuf([p, -p, p * 2, p / 2].map(x => fmtPct(x, 0))), a: fmtPct(p, 0), ex: `(${num(b, 2)} − ${a}) ÷ ${a} = ${fmtPct(p, 0)}.` }; }
  if (k === 1){ const n = [10, 20, 50][Math.floor(r() * 3)], px0 = [20, 40, 50][Math.floor(r() * 3)], p = [5, 10, 20][Math.floor(r() * 3)], g = n * px0 * p / 100; return { q: `Tu as ${n} actions à ${px0} €. Le cours monte de ${p} %. Ton gain ?`, opts: shuf([g, g * 2, g / 2, g * 10].map(x => eur0(x))), a: eur0(g), ex: `${n} × ${px0} € = ${eur0(n * px0)} ; ${p} % de cette somme = ${eur0(g)}.` }; }
  if (k === 2){ const cap = [5000, 10000, 20000][Math.floor(r() * 3)], st = [1, 2, 5][Math.floor(r() * 3)], q = cap * 0.01 / st; return { q: `Capital ${eur0(cap)}, règle des 1 %, stop à ${st} € sous ton prix d’achat. Combien d’actions au maximum ?`, opts: shuf([q, q * 2, q / 2, q * 10].map(x => num(x, 0))), a: num(q, 0), ex: `1 % de ${eur0(cap)} = ${eur0(cap * 0.01)} de risque ; ÷ ${st} € par action = ${num(q, 0)} actions.` }; }
  const m = [5000, 10000, 20000][Math.floor(r() * 3)], f = [0.2, 1, 2][Math.floor(r() * 3)], c = m * f / 100; return { q: `Frais de ${num(f, 1)} % par an sur ${eur0(m)}. Combien par an ?`, opts: shuf([c, c * 10, c / 2, c * 2].map(x => eur0(x))), a: eur0(c), ex: `${num(f, 1)} % de ${eur0(m)} = ${eur0(c)} chaque année.` }; }
function supportItem(seed){ const { cs, meta } = CK.gen({ kind: 'range', seed, n: 40, base: 50 }), lv = shuf([['s', meta.lo], ['r', meta.hi], ['m', (meta.lo + meta.hi) / 2 * 1.002]]), L = ['A', 'B', 'C'];
  const svgS = CK.svg(cs, { w: 340, levels: lv.map(([, y], i) => ({ y, label: L[i], color: '#c4b5ff', dash: '5 4' })), label: 'Graphique en bougies avec trois lignes A, B et C' });
  return { q: 'Où est le support ?', viz: svgS, opts: L.map(x => 'Ligne ' + x), a: 'Ligne ' + L[lv.findIndex(x => x[0] === 's')], ex: 'Le support est le niveau bas où le prix a rebondi plusieurs fois.' }; }
const GAMES = [
  { id: 'sens', name: 'Hausse ou baisse ?', sub: 'Vraies nouvelles du 26 au 30/10/2026', ic: IC2.up, dur: 45, real: true, items: () => shuf(RD.EVENTS.filter(e => e.move != null)).map(e => ({ q: e.co, sub: e.head, opts: ['Hausse', 'Baisse'], a: e.move > 0 ? 'Hausse' : 'Baisse', ex: `${e.co} : ${e.approx ? 'environ ' : ''}${fmtPct(e.move, dec(e.move))} (${e.day}). ${e.why}` })) },
  { id: 'calc', name: 'Calcul flash', sub: 'Pourcentages, gains, risque, frais', ic: I.bolt, dur: 45, items: () => Array.from({ length: 30 }, calcItem) },
  { id: 'arnaque', name: 'Arnaque ou pas ?', sub: 'Repère les pièges en un coup d’œil', ic: I.shield, dur: 45, items: () => shuf(ARNAQUES).map(([q, a, ex]) => ({ q, opts: ['Arnaque', 'Sérieux'], a: a ? 'Sérieux' : 'Arnaque', ex })) },
  { id: 'ordre', name: 'Ordre express', sub: 'Le bon ordre pour chaque situation', ic: I.target, dur: 40, tool: 'limit', items: () => shuf(ORDRES).map(([q, a, ex]) => ({ q, opts: ['Au marché', 'À cours limité', 'Stop'], a: ['Au marché', 'À cours limité', 'Stop'][a], ex })) },
  { id: 'support', name: 'Chasse au support', sub: 'Trouve le bon niveau sur le graphique', ic: I.candle, dur: 45, tool: 'bougies', items: () => Array.from({ length: 12 }, (_, i) => supportItem(Math.floor(Math.random() * 9999) + i)) },
];
const gameOn = g => !g.tool || toolOn(TOOLS.find(t => t.id === g.tool));
function startGame(id){ const g = GAMES.find(x => x.id === id); if (!g) return;
  if (!gameOn(g)) return toolSheet(g.tool);
  closeSheet(); if (XO && XO.tick) clearInterval(XO.tick);
  XO = { kind: 'game', g, items: g.items(), i: 0, score: 0, combo: 0, fb: null, end: Date.now() + g.dur * 1000, n: 0 };
  XO.tick = setInterval(() => { if (!XO || XO.kind !== 'game') return; if (XO.pauseAt) return; const left = XO.end - Date.now(), el = $('#gTimer');
    if (el) el.innerHTML = `${I.clock}${Math.ceil(Math.max(0, left) / 1000)} s`; if (left <= 0 && !XO.done){ endGame(); } }, 250);
  renderGame(); }
function renderGame(){
  const G = XO, g = G.g;
  if (G.done){ const st = (S.games || {})[g.id] || {};
    return xoShell(`<div class="p-body center"><div class="win-badge">${g.ic}</div><span class="eyebrow">${h(g.name)}</span><h2 class="xo-h"><span class="tn" data-count="${G.score}">${G.score}</span> bonne${G.score > 1 ? 's' : ''} réponse${G.score > 1 ? 's' : ''}</h2>
      <div class="kpis"><div><span>Réponses</span><b class="tn">${G.n}</b></div><div><span>Record</span><b class="tn">${st.best || 0}</b></div><div><span>Expérience</span><b class="tn">+${G.xp}</b></div></div>
      ${G.newBest ? '<p class="chip v" style="margin:10px auto 0">Nouveau record</p>' : ''}
      ${G.xpCap ? '<p class="small" style="margin-top:10px">Expérience des jeux plafonnée à 30 points par jour : le reste se gagne en apprenant.</p>' : ''}
      ${g.real ? `<p class="note">Événements réels et passés (${RD.MARKET.week}). Ce n’est pas un conseil.</p>` : ''}</div>
      <div class="p-foot"><button class="btn v full big" data-gamestart="${g.id}">Rejouer</button><button class="btn ghost full" data-xoquit>Retour</button></div>`, 100, g.name); }
  const it = G.items[G.i % G.items.length];
  xoShell(`<div class="p-body${G.fb && !G.fb.ok ? ' shake' : ''}"><div class="p-kicker"><span class="chip v">${h(g.name)}</span><span class="chip tn">${G.score} pt${G.score > 1 ? 's' : ''}</span>${G.combo >= 2 ? `<span class="combo bump">${I.flame}${G.combo}</span>` : ''}${g.real ? REAL_TAG : ''}</div>
    <div class="gcard"><b class="g-q">${h(it.q)}</b>${it.sub ? `<p>${h(it.sub)}</p>` : ''}${it.viz ? `<div class="g-viz">${it.viz}</div>` : ''}</div>
    <div class="gopts n${it.opts.length}">${it.opts.map(o => `<button class="gopt ${G.fb ? (o === it.a ? 'ok' : o === G.fb.pick ? 'ko' : '') : ''} ${o === 'Hausse' ? 'up' : o === 'Baisse' ? 'down' : ''}" data-gpick="${h(o)}"${G.fb ? ' disabled' : ''}>${o === 'Hausse' ? IC2.up : o === 'Baisse' ? IC2.down : ''}${h(o)}</button>`).join('')}</div>
    ${G.fb ? `<p class="g-ex">${h(it.ex)}</p>` : ''}</div>
    <div class="p-foot">${G.fb ? `<button class="btn v full big" data-gnext>Suivant</button>` : '<p class="small" style="text-align:center">Réponds vite : chaque bonne réponse compte.</p>'}</div>`, Math.min(100, (1 - Math.max(0, G.end - Date.now()) / (g.dur * 1000)) * 100), g.name);
}
function gamePick(o){ const G = XO, it = G.items[G.i % G.items.length]; if (G.fb || G.done) return; const ok = o === it.a; G.n++;
  if (ok){ G.score++; G.combo++; } else G.combo = 0; G.fb = { ok, pick: o }; sfx(ok ? 'ok' : 'ko');
  G.pauseAt = Date.now();   // le chrono s'arrête pendant la lecture de l'explication
  renderGame(); }
function gameNext(){ if (XO.pauseAt){ XO.end += Date.now() - XO.pauseAt; XO.pauseAt = null; } XO.i++; XO.fb = null; if (XO.end - Date.now() <= 0) return endGame(); renderGame(); }
function endGame(){ const G = XO; if (!G || G.done) return; G.done = true; clearInterval(G.tick);
  S.games = S.games || {}; const st = S.games[G.g.id] = S.games[G.g.id] || { best: 0, plays: 0 }; st.plays++; st.last = today(); G.newBest = G.score > st.best && st.plays > 1; st.best = Math.max(st.best, G.score);
  const td = today(); if (!S.gameXP || S.gameXP.d !== td) S.gameXP = { d: td, xp: 0 };
  const want = Math.min(15, G.score * 2), got = Math.max(0, Math.min(want, 30 - S.gameXP.xp)); G.xp = got; G.xpCap = got < want; S.gameXP.xp += got; S.score = Math.min(1000, S.score + got);
  save(); sfx('win'); renderGame(); }
/* Les jeux du jour, sur l'accueil : 3 jeux à compléter chaque jour */
function dailyGames(){ const on = GAMES.filter(gameOn), d = ((dayIndex() % on.length) + on.length) % on.length; return on.length <= 3 ? on : [0, 1, 2].map(i => on[(d + i) % on.length]); }
function gamesHome(){ if (!S.onb) return ''; const l = dailyGames(), done = l.filter(g => ((S.games || {})[g.id] || {}).last === today()).length, locked = GAMES.filter(g => !gameOn(g));
  return `<section class="sec"><div class="sec-h"><h2>Jeux du jour</h2><span class="small tn">${done} / ${l.length}${done === l.length ? ' · terminé' : ''}</span></div>
    <div class="gday-bar"><i style="width:${(done / l.length * 100).toFixed(0)}%"></i></div>
    <div class="gday">${l.map(g => { const st = (S.games || {})[g.id] || {}, ok = st.last === today();
      return `<button class="gd ${ok ? 'done' : ''}" data-gamestart="${g.id}"><span class="g-ic">${ok ? I.check : g.ic}</span><b>${h(g.name)}</b><small>${ok ? 'Fait · record ' + (st.best || 0) : '45 secondes'}</small></button>`; }).join('')}</div>
    ${locked.length ? `<p class="small" style="margin-top:8px">${locked.length} jeu${locked.length > 1 ? 'x' : ''} à débloquer sur ta carte. <button class="link" data-go="jeux">Tous les jeux</button></p>` : `<button class="link" style="margin-top:8px" data-go="jeux">Tous les jeux</button>`}</section>`; }
PAGES.jeux = () => `<div class="wrap">${top()}<button class="btn ghost sm" data-go="home">${I.back}Accueil</button>
  <div class="pg-h" style="margin-top:12px"><h1>Jeux</h1><span class="small">45 secondes chacun</span></div>
  <p class="muted" style="margin-bottom:14px">Des réflexes de trader, en jouant. L’expérience gagnée est plafonnée à 30 points par jour.</p>
  <div class="games">${GAMES.map(g => { const on = gameOn(g), st = (S.games || {})[g.id], tool = g.tool && TOOLS.find(t => t.id === g.tool);
    return `<button class="game ${on ? '' : 'lock'}" ${on ? `data-gamestart="${g.id}"` : `data-toolinfo="${g.tool}"`}><span class="g-ic">${on ? g.ic : I.lock}</span><span class="grow"><b>${h(g.name)}</b><span>${on ? h(g.sub) : `Débloqué avec l’outil « ${h(tool.name)} » (chapitre ${tool.ch})`}</span></span>${on ? `<span class="g-best tn">${st ? 'Record ' + st.best : 'Nouveau'}</span>` : ''}</button>`; }).join('')}</div>
  ${legal()}</div>${dock()}`;

/* ---------- le bureau du trader ---------- */
/* ---------- le vrai marché (en haut de la page Marchés) ---------- */
function realMarketHTML(){ const c = CAR(), Mk = RD.MARKET, ready = careerReady(), d = RD.DAYS[c.n];
  const cd = Mk.cacDays, mn = Math.min(...cd.map(x => x[1])), mx = Math.max(...cd.map(x => x[1]));
  const spark = `<svg viewBox="0 0 200 60" class="spark" aria-label="CAC 40 du 26 au 30 octobre 2026"><defs><linearGradient id="gVm" x1="0" x2="1"><stop offset="0" stop-color="#c4b5ff"/><stop offset="1" stop-color="#5b8cff"/></linearGradient></defs><polyline points="${cd.map((x, i) => `${(i / (cd.length - 1) * 196 + 2).toFixed(1)},${(52 - (x[1] - mn) / (mx - mn || 1) * 44).toFixed(1)}`).join(' ')}" fill="none" stroke="url(#gVm)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  const movers = RD.EVENTS.filter(e => e.move != null).slice().sort((a, b) => Math.abs(b.move) - Math.abs(a.move)), all = window.__allMovers;
  return `<div class="sec-h" style="margin-top:4px"><h2>Le vrai marché</h2>${REAL_TAG}</div>
  <div class="card mkt"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><span class="eyebrow">CAC 40 · ${h(Mk.week)}</span><b class="tn big" data-count="${Mk.cac.close}" data-d="2">${num(Mk.cac.close, 2)}</b><span class="tn pos">${fmtPct(Mk.cac.week)} sur la semaine</span></div>${spark}</div>
    <div class="kpis"><div><span>Brent</span><b class="tn">${num(Mk.brent.price, 2)} $</b></div><div><span>Euro / dollar</span><b class="tn">${num(Mk.eurusd.v, 4)}</b></div><div><span>Taux BCE</span><b class="tn">${num(Mk.bce.depot, 2)} %</b></div><div><span>OAT 10 ans</span><b class="tn">${num(Mk.oat10.v, 2)} %</b></div></div>
    <p class="note">Données réelles au ${Mk.asOf}, figées pour la démonstration. Sur le site : données en direct sous licence.</p></div>
  <button class="career ${ready ? '' : 'wait'}" data-career><span class="c-ic">${IC2.desk}</span><span class="grow"><span class="eyebrow">Carrière de trader · ${c.n} / ${RD.DAYS.length} journées</span><b>${c.n >= RD.DAYS.length ? 'Semaine réelle terminée' : ready ? 'Jouer : ' + h(d.label) : 'Prochaine journée demain'}</b><span class="small tn">Capital fictif ${eur0(c.cap)}</span></span>${ready ? `<span class="ibtn v">${I.play}</span>` : ''}</button>
  <section class="sec"><div class="sec-h"><h2>Ce qui a bougé</h2><span class="small">semaine réelle</span></div>
    <div class="movers">${(all ? movers : movers.slice(0, 5)).map(e => `<button class="mover" data-event="${e.id}"><span class="grow"><b>${h(e.co)}</b><span>${h(e.day)} · ${h(e.sector)}</span></span><span class="mv ${e.move >= 0 ? 'pos' : 'neg'} tn">${e.approx ? '≈ ' : ''}${fmtPct(e.move, dec(e.move))}</span></button>`).join('')}</div>
    ${movers.length > 5 ? `<button class="v-link" style="margin-top:8px" data-allmovers>${all ? 'Voir moins' : `Voir les ${movers.length}`}</button>` : ''}</section>`; }
const contextHTML = () => `<section class="sec"><div class="sec-h"><h2>Le contexte de la semaine</h2></div>${RD.CONTEXT.map(x => `<div class="card ctxc"><b>${h(x.h)}</b><p class="small">${h(x.t)}</p>${srcLink(x.src)}</div>`).join('')}</section>`;
function eventSheet(id){ const e = RD.ev(id); if (!e) return;
  openSheet(`<span class="eyebrow">${h(e.day)} · ${h(e.sector)}</span><h2 class="fiche-t">${h(e.co)}</h2>${e.move != null ? `<b class="mv big ${e.move >= 0 ? 'pos' : 'neg'} tn">${e.approx ? 'environ ' : ''}${fmtPct(e.move, dec(e.move))}</b>` : ''}
    <p style="margin-top:10px">${h(e.head)}</p>${e.extra ? `<p class="small" style="margin-top:6px">${h(e.extra)}</p>` : ''}<div class="why"><span class="eyebrow">Pourquoi</span><p>${h(e.why)}</p></div>${srcLink(e.src)}
    <p class="note">Événement réel et passé, présenté pour apprendre. Ce n’est pas un conseil d’achat ou de vente.</p>`); }

/* ---------- animations : chiffres qui défilent, entrées en cascade ---------- */
const RM = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function animate(root = document, still = false){
  root.querySelectorAll('[data-count]').forEach(el => { if (el.dataset.counted) return; el.dataset.counted = 1; if (RM() || still) return;
    const to = Number(el.dataset.count), from = Number(el.dataset.from || 0), d = Number(el.dataset.d || 0), fmt = el.dataset.fmt, t0 = performance.now(), dur = 900, final = el.textContent;
    const show = v => fmt === 'pct' ? fmtPct(v, d) : fmt === 'eur' ? (el.dataset.sign && v > 0 ? '+' : '') + eur0(Math.round(v)) : num(v, d);
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = k >= 1 ? final : show(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step); });
}

/* ============================================================
   V10 — DEMANDER AU COACH SUR LA QUESTION EN COURS + BARRE DE RECHERCHE
   ============================================================ */
const SEARCH_IC = P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>');
let QA = null;   // conversation sur la question en cours
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
/* Ce que voit le coach : la question en cours, sans données personnelles */
function qContext(){
  if (M && !M.end && M.mode !== 'exam'){ const st = M.steps[M.i], answered = !!M.fb, mid = (st.key || M.m.id || '').split('#')[0];
    const sw = st.type === 'swipe' && st.cards[Math.min(M.ui.k || 0, st.cards.length - 1)];
    const q = (st.q || st.title || st.prompt || (st.cards && st.cards[M.ui.c || 0] && (st.cards[M.ui.c || 0].h + ' : ' + st.cards[M.ui.c || 0].t)) || M.m.title) + (sw ? ` (${st.left} ou ${st.right}) — carte : « ${sw.t} »` : '');
    const good = st.choices && st.answer != null ? st.choices[st.answer] : st.type === 'vf' ? (st.answer ? 'Vrai' : 'Faux') : st.type === 'calc' ? st.answer + ' ' + (st.unit || '') : '';
    return { key: 'm:' + (st.key || M.m.id) + ':' + M.i, title: q, mid,
      text: `Mission « ${M.m.title} » (${M.m.goal || ''}).\nExercice : ${q}\n${st.choices ? 'Choix proposés : ' + st.choices.join(' | ') + '\n' : ''}${answered && good ? 'Bonne réponse : ' + good + '\n' : ''}${answered && st.explain ? 'Explication du cours : ' + st.explain + '\n' : ''}`, answered, explain: answered ? st.explain : '' }; }
  if (XO && XO.kind === 'career'){ const ev = RD.ev(XO.day.decide), shown = ['reveal', 'flash', 'end'].includes(XO.step);
    return { key: 'c:' + XO.day.n + ':' + (shown ? 1 : 0), title: ev.co + ' : ' + ev.head, mid: '',
      text: `Journée de trader (événement réel et passé, ${ev.day} 2026, capital fictif).\nNouvelle : ${ev.co} (${ev.sector}) — ${ev.head}\nChoix possibles : acheter, vendre à découvert, rester à l'écart, avec une part du capital et une raison.\n${shown ? `Réaction réelle du cours : ${fmtPct(ev.move, dec(ev.move))}. Pourquoi : ${ev.why}\n` : 'La réaction du cours n’est pas encore révélée : ne la donne pas et ne la devine pas.\n'}`, answered: shown, explain: shown ? ev.why : '' }; }
  if (XO && XO.kind === 'game' && !XO.done && XO.fb){ const it = XO.items[XO.i % XO.items.length];
    return { key: 'g:' + XO.g.id + ':' + XO.i, title: it.q, mid: '', text: `Mini-jeu « ${XO.g.name} ».\nQuestion : ${it.q}${it.sub ? ' — ' + it.sub : ''}\nChoix : ${it.opts.join(' | ')}\nBonne réponse : ${it.a}\nExplication : ${it.ex}\n`, answered: true, explain: it.ex }; }
  return null;
}
const canAskQ = () => !!qContext();
const askQBtn = () => canAskQ() ? `<button class="askq" data-askq aria-label="Poser une question au coach sur cette question">${I.chat}<span>Une question ?</span></button>` : '';
function openAskQ(){ const c = qContext(); if (!c) return;
  if (!QA || QA.key !== c.key) QA = { key: c.key, msgs: [] }; QA.c = c; renderAskQ(); setTimeout(() => { const i = $('#qaIn'); if (i) i.focus(); }, 60); }
function renderAskQ(){ const c = QA.c, sug = c.answered ? ['Pourquoi c’est la bonne réponse ?', 'Donne-moi un exemple concret', 'Explique le mot difficile'] : ['Je ne comprends pas la question', 'Donne-moi un indice', 'Explique le mot difficile'];
  openSheet(`<span class="eyebrow">${I.chat} Nova Coach · sur cette question</span>
    <div class="qctx"><p>${h(c.title)}</p></div>
    <div class="cmsgs qa-msgs" id="qaMsgs">${QA.msgs.length ? '' : `<div class="bub them"><small>Nova Coach</small>${c.answered ? 'Pose-moi ta question : je t’explique la réponse.' : 'Pose-moi ta question. Je ne te donne pas la réponse, mais je t’aide à la trouver.'}</div>`}
      ${QA.msgs.map(m => `<div class="bub ${m.me ? 'me' : 'them'}"><small>${m.me ? 'Toi' : 'Nova Coach'}</small>${m.me ? h(m.t) : coachText(m.t)}</div>`).join('')}</div>
    <div class="sugg">${sug.map(s => `<button data-qask="${h(s)}">${h(s)}</button>`).join('')}</div>
    <form class="cin" id="qaF"><label class="sr" for="qaIn">Ta question</label><input id="qaIn" placeholder="Ta question sur cet exercice…" autocomplete="off"><button class="ibtn v" aria-label="Envoyer">${I.send}</button></form>
    <p class="note">${aiOn() ? 'Réponse de l’intelligence artificielle : elle peut se tromper.' : 'L’IA n’est pas branchée sur cette version : réponses automatiques.'} Pas de conseil en investissement.</p>`, 'qa-sheet');
  const m = $('#qaMsgs'); if (m && m.lastElementChild) m.lastElementChild.scrollIntoView({ block: 'end' }); }
function localQA(q, c){
  const wordIn = (t, s) => new RegExp('(^|[^a-z0-9])' + norm(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(s);
  const txt = norm(c.title) + (/quoi|veut dire|definition|mot|signifie/.test(norm(q)) ? ' ' + norm(q) : ''), gl = GL.filter(([t]) => t.length > 2 && t !== 'Range' && wordIn(t, txt)).slice(0, 2), f = c.mid ? ficheFor(c.mid) : null;
  let a = '';
  if (c.answered && c.explain && !/mot|definition|veut dire/.test(norm(q))) a = c.explain;
  else if (gl.length) a = gl.map(([t, d]) => `« ${t} » : ${d}`).join(' ');
  else if (!c.answered && c.key[0] === 'c') a = 'Pour décider, compare la nouvelle à ce que le marché attendait, puis choisis la part de capital que tu acceptes de risquer. Rester à l’écart est aussi une décision.';
  else if (!c.answered) a = 'Indice : relis la question en cherchant le mot clé, puis élimine d’abord les réponses les plus extrêmes.';
  else a = c.explain || 'Relis l’explication sous la question.';
  return a + (f ? ` [[fiche:${f.id}]]` : ''); }
async function askQ(q){
  q = String(q || '').trim(); if (!q || !QA) return; const c = QA.c;
  QA.msgs.push({ me: 1, t: q }); QA.msgs = QA.msgs.slice(-12); renderAskQ();
  if (!aiOn()){ QA.msgs.push({ me: 0, t: localQA(q, c) }); return renderAskQ(); }
  const box = $('#qaMsgs'), bub = document.createElement('div'); bub.className = 'bub them'; bub.innerHTML = '<small>Nova Coach</small><span class="thinking">Nova Coach réfléchit…</span>'; box.appendChild(bub); bub.scrollIntoView({ block: 'end' });
  const sp = bub.querySelector('span'), f = c.mid ? ficheFor(c.mid) : null;
  const ctx = `L'élève travaille sur cet exercice et te pose une question dessus.\n${c.text}\n${c.answered ? 'Il a déjà répondu : tu peux expliquer la bonne réponse.' : 'Il n’a PAS encore répondu : ne donne jamais la bonne réponse, ne dis pas quel choix est correct et ne l’élimine pas pour lui. Aide avec une définition, un exemple de la vie courante ou un indice qui le fait réfléchir.'}\n${minorMode() ? 'L’élève est peut-être mineur : reste sur le cours. ' : ''}Réponds à sa dernière question en 90 mots maximum, phrases courtes, tutoiement.${f ? ` Tu peux terminer par [[fiche:${f.id}]] si relire la fiche aide.` : ''}`;
  const turns = QA.msgs.map(m => ({ role: m.me ? 'user' : 'assistant', content: m.t }));
  try { const t = await AI.ask(ctx, { turns, nocache: true, tier: 'quick', task: 'question', onText: ({ text }) => { sp.className = ''; sp.textContent = text.replace(/\[\[(mission|fiche):[^\]]+\]\]/g, ''); } }); QA.msgs.push({ me: 0, t }); }
  catch (e){ QA.msgs.push({ me: 0, t: (AI.errorText(e) ? AI.errorText(e) + ' ' : '') + localQA(q, c) }); }
  if (QA && $('#qaMsgs')) renderAskQ(); }

/* Barre de recherche : un mot, une fiche, une mission… ou une question au coach */
const askBar = () => `<div class="askwrap"><form class="askbar" id="askF" role="search"><span class="ab-ic">${SEARCH_IC}</span><label class="sr" for="askIn">Rechercher ou demander à Nova Coach</label><input id="askIn" data-askin type="search" placeholder="Un mot, une notion, une question…" autocomplete="off" enterkeyhint="send"><button class="ibtn v" aria-label="Demander à Nova Coach">${I.chat}</button></form><div class="askres" id="askRes" role="listbox"></div></div>`;
function askResults(q){
  const n = norm(q.trim()); if (n.length < 2) return '';
  const fi = CO.filter(f => norm(f.title).includes(n) || norm(f.key || '').includes(n)).slice(0, 3);
  const gl = GL.filter(([t, d]) => norm(t).includes(n)).slice(0, 3);
  const ms = MS.filter(m => m.steps && norm(m.title).includes(n)).slice(0, 3);
  return `<button class="ar ask" data-askhome="${h(q.trim())}"><span class="ar-ic">${I.chat}</span><span class="grow"><b>Demander à Nova Coach</b><span>« ${h(q.trim())} »</span></span></button>
    ${gl.map(([t, d]) => `<div class="ar gl"><span class="ar-ic">${I.book}</span><span class="grow"><b>${h(t)}</b><span>${h(d)}</span></span></div>`).join('')}
    ${fi.map(f => `<button class="ar" data-fiche="${f.id}"><span class="ar-ic">${I.book}</span><span class="grow"><b>${h(f.title)}</b><span>Fiche · ${f.min} min</span></span></button>`).join('')}
    ${ms.map(m => `<button class="ar" data-play="${m.id}"><span class="ar-ic">${I.play}</span><span class="grow"><b>${h(m.title)}</b><span>Mission · chapitre ${m.ch}</span></span></button>`).join('')}`; }
document.addEventListener('input', ev => { if (ev.target.matches('[data-askin]')){ const r = $('#askRes'); if (r) r.innerHTML = askResults(ev.target.value); } });
document.addEventListener('submit', ev => {
  if (ev.target.id === 'askF'){ const v = ($('#askIn').value || '').trim(); if (!v) return; go('coach'); askCoach(v); }
  if (ev.target.id === 'qaF'){ const i = $('#qaIn'); const v = i.value; i.value = ''; askQ(v); } });
document.addEventListener('click', ev => { const t = ev.target.closest('button'); if (!t) return;
  if (t.dataset.askq !== undefined) return openAskQ();
  if (t.dataset.qask) return askQ(t.dataset.qask); });

/* ============================================================
   V11 — MODE DÉBLOCAGE : quand une notion résiste, on change de méthode
   Détection : la même notion ratée 3 fois (missions + révisions).
   L'IA (ou les règles, sans IA) réexplique autrement, choisit une
   question plus facile parmi celles qui existent, puis on retente
   la notion avec de nouveaux chiffres. Aucun point perdu.
   ============================================================ */
const STUCK_N = 3;
const stepOf = key => { const [mid, si] = String(key || '').split('#'); if (si == null || String(mid).startsWith('sess-')) return null; const m = findMission(mid); return m && m.steps && m.steps[Number(si)] ? { m, mid, st: m.steps[Number(si)], si: Number(si) } : null; };
const qText = key => { const s = stepOf(key); return s ? String(s.st.q || s.st.title || s.m.title) : ''; };
const stuckList = () => Object.entries(S.stuck || {}).filter(([k, x]) => x.state === 'bloque' && stepOf(k)).map(([k, x]) => Object.assign({ key: k }, x));
function trackStuck(key, ok){
  if (!stepOf(key)) return false; S.stuck = S.stuck || {}; const x = S.stuck[key] = S.stuck[key] || { n: 0, state: 'ok' };
  if (ok) return false;
  x.n++; x.last = today();
  if (x.n >= STUCK_N && x.state !== 'bloque'){ x.state = 'bloque'; x.since = today(); return true; }
  return false; }
/* questions plus faciles : même mission d'abord, puis missions précédentes du chapitre ; vrai/faux et QCM en priorité */
function easierCands(key){
  const s = stepOf(key); if (!s) return []; const out = [], ch = s.m.ch, rank = st => st.type === 'vf' ? 0 : st.type === 'qcm' ? 1 : 2;
  const add = (m, st, si) => { const k = m.id + '#' + si; if (k === key || !['qcm', 'vf', 'calc'].includes(st.type) || (S.stuck && S.stuck[k] && S.stuck[k].state === 'bloque')) return; out.push({ key: k, st, si, m }); };
  s.m.steps.forEach((st, si) => add(s.m, st, si));
  if (ch){ const list = chMissions(ch), idx = list.findIndex(m => m.id === s.m.id); list.slice(0, Math.max(0, idx)).reverse().forEach(m => (m.steps || []).forEach((st, si) => add(m, st, si))); }
  return out.sort((a, b) => rank(a.st) - rank(b.st)).slice(0, 6); }
function baseMission(key){ const s = stepOf(key); if (!s || !s.m.ch) return null; const list = chMissions(s.m.ch), idx = list.findIndex(m => m.id === s.m.id);
  return idx > 0 ? list[idx - 1] : s.m.ch > 1 ? chMissions(s.m.ch - 1).slice(-1)[0] : null; }
function localUnblock(s){ const f = ficheFor(s.mid), txt = norm(String(s.st.q || '')), gl = GL.filter(([t]) => t.length > 2 && t !== 'Range' && new RegExp('(^|[^a-z0-9])' + norm(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(txt)).slice(0, 2);
  const etapes = gl.map(([t, d]) => `${t} : ${d}`);
  if (f && f.body) etapes.push(...f.body.slice(0, 2).map(p => String(p).split(/(?<=[.!?])\s/)[0]));
  return { explication: `On reprend autrement, sans se presser. L’idée à retenir : ${s.st.explain}`, etapes: etapes.slice(0, 3), pick: 0, ai: false }; }
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), ms))]);
async function startUnblock(key){
  const s = stepOf(key); if (!s) return; if (M) return;
  const cands = easierCands(key), errs = (S.errs || []).filter(e => e.mid === s.mid).slice(-3).map(e => e.q);
  let plan = localUnblock(s);
  if (aiOn()){
    openSheet(`<div class="ub-load"><div class="win-badge">${I.bolt}</div><h2 class="fiche-t">Nova Coach prépare ton déblocage</h2><p class="small thinking">Il cherche une autre façon d’expliquer et la bonne question pour repartir…</p></div>`);
    const good = s.st.choices ? s.st.choices[s.st.answer] : s.st.type === 'vf' ? (s.st.answer ? 'Vrai' : 'Faux') : s.st.type === 'calc' ? s.st.answer + ' ' + (s.st.unit || '') : '';
    const prompt = `Un élève bloque sur cette notion : il l'a ratée ${S.stuck[key].n} fois (missions et révisions).
Exercice : ${s.st.q || s.st.title || ''}
${s.st.choices ? 'Choix : ' + s.st.choices.join(' | ') + '\n' : ''}${good ? 'Bonne réponse : ' + good + '\n' : ''}Explication du cours (qui n'a pas suffi) : ${s.st.explain}
${errs.length ? 'Questions ratées récemment dans la même mission : ' + errs.join(' / ') + '\n' : ''}Questions plus faciles disponibles (choisis-en UNE, la plus utile pour remonter vers la notion) :
${cands.map((c, i) => `${i} : ${c.st.q}`).join('\n') || '(aucune)'}

Réponds uniquement en JSON : {"explication": "4 phrases maximum, une AUTRE façon d'expliquer que le cours, avec une image ou une comparaison de la vie courante", "etapes": ["2 à 4 étapes très courtes du raisonnement ; s'il y a un calcul, pas à pas avec des chiffres simples"], "question": numéro de la question plus facile choisie}`;
    try { const r = await withTimeout(AI.ask(prompt, { json: true, task: 'deblocage', nocache: true }), 25000);
      if (r && typeof r.explication === 'string' && r.explication.trim()) plan = { explication: r.explication.trim().slice(0, 700), etapes: (Array.isArray(r.etapes) ? r.etapes : []).filter(x => typeof x === 'string').slice(0, 4).map(x => x.slice(0, 220)), pick: Number.isInteger(r.question) && r.question >= 0 && r.question < cands.length ? r.question : 0, ai: true }; }
    catch (e){}
    closeSheet();
  }
  const easy = cands[plan.pick], att = (S.plays[s.mid] || 0) + 9;
  const steps = [{ type: 'unblock', title: 'On reprend autrement', text: plan.explication, etapes: plan.etapes, ai: plan.ai, fiche: (ficheFor(s.mid) || {}).id, notion: s.st.q || s.st.title }];
  if (easy) steps.push(Object.assign(prep(easy.st, easy.key, att, easy.si), { ub: 'easy' }));
  steps.push(Object.assign(prep(s.st, key, att + 1, s.si), { ub: 'target' }));
  M = { m: { id: 'unblock', title: 'Mode déblocage', goal: 'Comprendre autrement une notion qui résiste.', score: 0, cash: 0 }, mode: 'unblock', ukey: key, steps, i: 0, ok: [], second: [], fb: null, ui: {}, ko: 0, fast: 0, combo: 0, t0: Date.now(), revs: [] };
  renderPlayer(); }
function unblockHTML(st){ return `<span class="eyebrow">${I.bolt} Mode déblocage${st.ai ? ' · IA' : ''}</span><p class="p-q">${h(st.title)}</p>
  <div class="qctx"><p>${h(st.notion)}</p></div>
  <div class="ub-card"><p>${h(st.text)}</p>${st.etapes && st.etapes.length ? `<ol class="ub-steps">${st.etapes.map(x => `<li>${h(x)}</li>`).join('')}</ol>` : ''}</div>
  ${st.fiche ? `<button class="link" data-fiche="${st.fiche}">${I.book} Relire la fiche</button>` : ''}
  <p class="small" style="margin-top:10px">Ensuite : une question plus facile, puis la notion avec de nouveaux chiffres. Aucun point perdu, ta série est gardée.</p>`; }
function finishUnblock(){
  const key = M.ukey, x = (S.stuck || {})[key] || {}, okT = M.ok[M.ok.length - 1], okE = M.steps.some(s => s.ub === 'easy') ? M.ok[0] : null;
  x.tries = (x.tries || 0) + 1;
  if (okT){ x.state = 'debloque'; x.d = today(); const [mid, si] = key.split('#'), r = S.reviews.find(y => y.mid === mid && String(y.si) === si); if (r){ r.lvl = 1; r.due = addDays(today(), 3); } }
  const td = today(); if (S.lastDay !== td){ const diff = S.lastDay ? Math.round((Date.parse(td) - Date.parse(S.lastDay)) / 864e5) : 99; S.streak = diff <= 2 ? S.streak + 1 : 1; S.lastDay = td; }
  save(); M.end = { unblock: true, okT, okE, base: okT ? null : baseMission(key) }; renderPlayer(); sfx(okT ? 'win' : 'ok'); }
function unblockDebrief(){ const e = M.end;
  return `<div class="debrief"><div class="burst"><div>${e.okT ? I.check : I.bolt}</div></div><span class="eyebrow">Mode déblocage</span>
    <h1 style="font-size:26px">${e.okT ? 'Notion débloquée' : 'On y est presque'}</h1>
    <p class="muted" style="max-width:36ch">${e.okT ? 'Tu as réussi la notion qui te résistait. Elle reviendra en révision dans 3 jours pour bien l’ancrer.' : e.base ? `Cette notion repose sur une base à consolider. On fait d’abord « ${h(e.base.title)} », puis on revient ici.` : 'On réessaiera demain avec une autre explication. Tu peux aussi en parler à Nova Coach.'}</p>
    ${!e.okT && e.base ? `<button class="btn v full" data-replay="${e.base.id}">${I.play}Faire « ${h(e.base.title)} »</button>` : ''}
    ${!e.okT ? `<button class="btn ghost full" data-go="coach">${I.chat}En parler à Nova Coach</button>` : ''}
    <button class="btn ${e.okT ? 'v' : 'ghost'} full" data-quit>Retour</button></div>`; }
function stuckCard(){ const l = stuckList(); if (!l.length || !S.onb) return '';
  const x = l[0];
  return `<section class="sec"><div class="card stuck-card"><span class="eyebrow">${I.bolt} On reprend autrement</span><b>Cette notion te résiste</b><p class="small">« ${h(qText(x.key).slice(0, 110))} »</p>
    <p class="small" style="margin-top:4px">Nova Coach te l’explique d’une autre façon, puis une question plus facile pour repartir. 3 minutes, aucun point perdu.</p>
    <button class="btn v sm" style="margin-top:10px" data-unblock="${h(x.key)}">Débloquer${l.length > 1 ? ` (${l.length} notions)` : ''}</button></div></section>`; }
function stuckSuivi(){ const all = Object.entries(S.stuck || {}).filter(([k, x]) => x.state !== 'ok' && stepOf(k)); if (!all.length) return '';
  return `<section class="sec"><div class="sec-h"><h2>Notions en déblocage</h2></div><div class="card">${all.map(([k, x]) => `<div class="ub-row"><span class="grow small">${h(qText(k).slice(0, 90))}</span>${x.state === 'bloque' ? `<button class="chip a" data-unblock="${h(k)}">En cours · reprendre</button>` : `<span class="chip g">${I.check}Débloquée</span>`}</div>`).join('')}</div></section>`; }
document.addEventListener('click', ev => { const t = ev.target.closest('button[data-unblock]'); if (t){ closeSheet(); startUnblock(t.dataset.unblock); } });

/* ============================================================
   V14 — DÉFIS DU JOUR + ÉPREUVES D'APPLICATION DANS MARCHÉS / PORTEFEUILLE
   ============================================================ */
const EPREUVES = [
  { id: 'buy-paris', t: 'Achète une action de Paris au marché', goal: { ev: 'buy', type: 'market', zone: 'Paris' }, hint: 'Stellantis coûte environ 4 € : parfait pour un petit budget.', page: 'markets' },
  { id: 'buy-usa', t: 'Achète une valeur américaine', goal: { ev: 'buy', zone: 'USA' }, hint: 'Le prix est en dollars : regarde l’équivalent en euros sous le cours.', page: 'markets' },
  { id: 'buy-etf', t: 'Ajoute un ETF à ton portefeuille', goal: { ev: 'buy', kind: 'etf' }, hint: 'Un ETF réunit des centaines d’entreprises en une seule ligne.', tool: 'etf', page: 'markets' },
  { id: 'limit', t: 'Place un ordre à cours limité sous le cours actuel', goal: { ev: 'limit' }, hint: 'Choisis « Cours limité » et mets un prix un peu plus bas que le cours.', tool: 'limit', page: 'markets' },
  { id: 'sectors', t: 'Aie au moins 2 secteurs dans ton portefeuille', goal: { ev: 'sectors', n: 2 }, hint: 'Ajoute une valeur d’un secteur différent de celui que tu as déjà.', page: 'markets' },
  { id: 'sell', t: 'Vends une partie d’une position', goal: { ev: 'sell' }, hint: 'Ouvre une valeur que tu détiens, choisis « Vendre ».', page: 'portfolio', needPos: true },
];
const epOk = e => (!e.tool || toolOn(TOOLS.find(t => t.id === e.tool))) && (!e.needPos || Object.keys(S.positions).length);
function epreuveDuJour(){ const l = EPREUVES.filter(epOk); return l[((dayIndex() % l.length) + l.length) % l.length]; }
const sectorsHeld = () => new Set(Object.keys(S.positions).map(id => (mkFind(id) || {}).sector).filter(Boolean)).size;
function giveBudget(key){ S.budget = S.budget || {}; if (S.cash >= 150 || S.budget[key]) return; S.budget[key] = 1; S.cash += 300; S.history.push(`${dateFr(today())} · Budget d’épreuve : +300 € fictifs`); toast('Budget d’épreuve : +300 € fictifs pour t’entraîner.'); }
function startApply(goal, opts){ S.apply = Object.assign({ goal, ok: false }, opts); giveBudget(opts.key || 'ep'); save();
  if (goal.ev === 'sectors' && sectorsHeld() >= goal.n){ S.apply.ok = true; save(); } }
function applyCheck(e){ const A = S.apply; if (!A || A.ok) return; const g = A.goal; let ok = false;
  if (g.ev === 'buy') ok = e.type === 'buy' && (!g.type || e.t.type === g.type) && (!g.zone || e.s.zone === g.zone) && (!g.kind || e.s.kind === g.kind);
  else if (g.ev === 'limit') ok = e.type === 'limit';
  else if (g.ev === 'sell') ok = e.type === 'sell';
  else if (g.ev === 'sectors') ok = sectorsHeld() >= g.n;
  if (!ok) return; A.ok = true; if (A.src === 'defi'){ S.epDone = S.epDone || {}; S.epDone[today()] = A.id; } save(); sfx('win'); toast('Épreuve réussie.'); }
function applyBanner(){ const A = S.apply; if (!A) return '';
  return `<div class="apply ${A.ok ? 'ok' : ''}"><span class="ap-ic">${A.ok ? I.check : I.target}</span><span class="grow"><span class="eyebrow">${A.ok ? 'Épreuve réussie' : A.src === 'mission' ? 'Épreuve de ta mission' : 'Épreuve du jour'}</span><b>${h(A.t)}</b>${!A.ok && A.hint ? `<span class="small">${h(A.hint)}</span>` : ''}</span>
    ${A.src === 'mission' ? `<button class="btn ${A.ok ? 'v' : 'ghost'} sm" data-applyback>${A.ok ? 'Continuer la mission' : 'Mission'}</button>` : A.ok ? `<button class="btn v sm" data-applyclose>OK</button>` : `<button class="ibtn" data-applyclose aria-label="Fermer">${I.x}</button>`}</div>`; }
const applyMini = () => M && M.away ? `<button class="apply-mini" data-applyback>${I.target}<span>${S.apply && S.apply.ok ? 'Épreuve réussie · revenir' : 'Mission en pause'}</span></button>` : '';
/* étape « apply » dans une mission : on part dans Marchés, on revient */
function applyStepHTML(st){ return `<span class="eyebrow">${I.target} Épreuve d’application</span><p class="p-q">${h(st.title)}</p><p class="p-text">${h(st.text)}</p>
  <div class="apply-goal"><b>${h(st.goalText)}</b>${st.hint ? `<span class="small">${h(st.hint)}</span>` : ''}</div>
  <p class="small" style="margin-top:10px">Tu pars dans ${st.goal.ev === 'sell' ? 'ton portefeuille' : 'les marchés'}, avec de vraies valeurs et de l’argent fictif. Ta mission t’attend.</p>`; }
function applyGo(){ const st = M.steps[M.i]; startApply(st.goal, { t: st.goalText, hint: st.hint, src: 'mission', key: 'm:' + M.m.id });
  M.away = true; const p = $('#player'); if (p) p.style.display = 'none'; document.body.style.overflow = ''; go(st.goal.ev === 'sell' ? 'portfolio' : 'markets'); }
function applyBack(){ if (!M || !M.away) return; const ok = S.apply && S.apply.ok; M.away = false; const p = $('#player'); if (p) p.style.display = ''; document.body.style.overflow = 'hidden';
  if (ok){ S.apply = null; save(); M.ok.push(true); M.combo++; render(); return next(); } render(); renderPlayer(); }

/* ---------- défis du jour (selon le temps choisi) ---------- */
function defis(){ const td = today(), n = S.pace === 'rapide' ? 2 : S.pace === 'intense' ? 5 : 3, u = upNext(), gs = dailyGames(), L = [];
  L.push({ id: 'main', ic: I.play, t: u.title || 'Ta mission du jour', s: (u.eyebrow || '').split('·')[0].trim() || 'Mission', done: S.mainDay === td, attr: u.attr || 'data-go="carte"' });
  if (gs[0]) L.push({ id: 'jeu', ic: gs[0].ic, t: gs[0].name, s: 'Jeu · 45 s', done: ((S.games || {})[gs[0].id] || {}).last === td, attr: `data-gamestart="${gs[0].id}"` });
  const rv = dueReviews().length; if (rv) L.push({ id: 'rv', ic: I.book, t: `Révision : ${rv} notion${rv > 1 ? 's' : ''}`, s: '1 min', done: false, attr: 'data-review' });
  const ep = epreuveDuJour(); if (ep) L.push({ id: 'ep', ic: I.wallet, t: ep.t, s: 'Épreuve · vraies valeurs', done: (S.epDone || {})[td] === ep.id, attr: `data-epreuve="${ep.id}"` });
  if (CAR().n < RD.DAYS.length || CAR().last === td) L.push({ id: 'jt', ic: IC2.news, t: 'Journée de trader', s: 'Actualité réelle · 2 min', done: CAR().last === td, attr: 'data-career' });
  if (gs[1]) L.push({ id: 'jeu2', ic: gs[1].ic, t: gs[1].name, s: 'Jeu · 45 s', done: ((S.games || {})[gs[1].id] || {}).last === td, attr: `data-gamestart="${gs[1].id}"` });
  return L.slice(0, n); }
function defisHTML(){ const L = defis(), done = L.filter(x => x.done).length, all = done === L.length, td = today();
  if (all && S.defisDay !== td){ S.defisDay = td; S.score = Math.min(1000, S.score + 10); save(); setTimeout(() => toast('Défis du jour terminés : +10 points.'), 500); }
  const R = 20, C = 2 * Math.PI * R;
  return `<section class="sec defis"><div class="df-h"><div><h2>Défis du jour</h2><span class="small">${all ? 'Tout est fait. À demain.' : `${L.length - done} à faire`}</span></div>
    <svg class="df-ring" viewBox="0 0 48 48" aria-label="${done} sur ${L.length}"><circle cx="24" cy="24" r="${R}" class="trk"/><circle cx="24" cy="24" r="${R}" class="arc" style="stroke-dasharray:${(done / L.length * C).toFixed(1)} ${C.toFixed(1)}"/><text x="24" y="28" text-anchor="middle">${done}/${L.length}</text></svg></div>
    <div class="seg pace3" role="group" aria-label="Temps du jour">${[['rapide', '3 min'], ['normal', '7 min'], ['intense', '15 min']].map(([k, t]) => `<button data-pace="${k}" aria-pressed="${S.pace === k}">${t}</button>`).join('')}</div>
    <div class="df-list">${L.map((x, i) => `<button class="defi ${x.done ? 'done' : ''}" ${x.done ? 'disabled' : x.attr} style="--d:${i * 0.06}s"><span class="df-ic">${x.done ? I.check : x.ic}</span><span class="grow"><b>${h(x.t)}</b><span>${h(x.s)}</span></span>${x.done ? '' : `<span class="df-go">${I.chev.replace('<path', '<path transform="rotate(-90 12 12)"')}</span>`}</button>`).join('')}</div></section>`; }

/* ---------- l'accueil, court ---------- */
PAGES.home = () => { const name = (S.name || '').split(' ')[0], { r } = rankOf(S.score);
  return `<div class="wrap">${top()}
  ${temple()}
  <div class="v-hello"><h1>${greet()}${name ? ' ' + h(name) : ''}</h1><p>${S.streak ? `${h(r.name)} · ${S.streak} jour${S.streak > 1 ? 's' : ''} de suite` : 'Bienvenue sur NovaTitre'}</p></div>
  ${(() => { const L = defis(), nx = L.find(x => !x.done), fresh = !Object.keys(S.done).length && !(S.sessDone && Object.keys(S.sessDone).length), fm = fresh && nextMission();
    if (fm) return `<button class="cta" data-play="${fm.id}"><span class="grow"><span class="eyebrow">Lancer mon parcours · vidéo 20 s</span><b>${h(fm.title)}</b></span><span class="cta-go">${I.play}</span></button>`;
    return nx ? `<button class="cta" ${nx.attr}><span class="grow"><span class="eyebrow">Continuer · défi ${L.indexOf(nx) + 1} sur ${L.length}</span><b>${h(nx.t)}</b></span><span class="cta-go">${I.play}</span></button>` : `<div class="cta done"><span class="grow"><span class="eyebrow">Défis du jour terminés</span><b>Bravo, à demain</b></span><span class="cta-go">${I.check}</span></div>`; })()}
  ${stuckCard()}
  ${defisHTML()}
  ${levelTestCard()}
  ${askBar()}
  ${extraQuestion()}
  ${trialBanner()}
  ${rewardCard()}
  ${!S.premium && !minorMode() ? offerHome() : ''}
  ${legal()}
  </div>${dock()}`; };
document.addEventListener('click', ev => { const t = ev.target.closest('button'); if (!t) return; const d = t.dataset;
  if (d.epreuve){ const e = EPREUVES.find(x => x.id === d.epreuve); if (!e) return; startApply(e.goal, { id: e.id, t: e.t, hint: e.hint, src: 'defi', key: 'd:' + today() });
    if (S.apply.ok){ S.epDone = S.epDone || {}; S.epDone[today()] = e.id; save(); } return go(e.page); }
  if (d.applyclose !== undefined){ S.apply = null; save(); return render(); }
  if (d.applyback !== undefined) return applyBack();
  if (d.applygo !== undefined && M) return applyGo();
  if (d.mz){ window.__mz = d.mz; return render(); } });

/* ============================================================
   V15 — LE COURS VIDÉO DE 20 SECONDES AU DÉBUT DE CHAQUE MISSION
   Animation dans le site (pas un fichier) : texte qui défile, transitions,
   musique douce générée (WebAudio, coupée si « Sons » est désactivé).
   Voix : à ajouter plus tard (window.NT_VOICE[idMission] = 'fichier.mp3').
   ============================================================ */
const VIZ_CH = { 1: 'coins', 2: 'bars', 3: 'basket', 4: 'bars', 5: 'down', 6: 'shield', 7: 'pie', 8: 'scale', 9: 'down', 10: 'bars', 11: 'bars', 12: 'shield', 13: 'check', 14: 'bars', 15: 'scale' };
const words = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 3);
function vidScenes(m){
  const ch = CH.find(c => c.id === m.ch), f = ficheFor(m.id) || CO.find(x => x.ch === m.ch), kw = new Set(words(m.title + ' ' + m.goal));
  const sents = f ? f.body.flatMap(p => String(p).split(/(?<=[.!?])\s+/)).filter(x => x.length > 25 && x.length < 170) : [];
  const score = s => words(s).filter(w => kw.has(w)).length;
  const best = sents.map((s, i) => ({ s, i, k: score(s) })).sort((a, b) => b.k - a.k || a.i - b.i).slice(0, 2).sort((a, b) => a.i - b.i).map(x => x.s);
  const key = f && f.key ? f.key.slice().sort((a, b) => score(b) - score(a))[0] : null;
  const L = [{ k: 'title', eyebrow: ch ? `Chapitre ${ch.id} · ${ch.title}` : 'Mission', big: m.title },
    { k: 'goal', eyebrow: 'En 20 secondes', big: String(m.id).startsWith('i-') && ch ? ch.sub : m.goal }];
  best.forEach((s, i) => L.push({ k: 'idea', eyebrow: i ? 'Et surtout' : 'L’idée', big: s, viz: i ? null : VIZ_CH[m.ch] }));
  if (key) L.push({ k: 'key', eyebrow: 'À retenir', big: key });
  L.push({ k: 'go', eyebrow: 'Prêt ?', big: 'À toi de jouer.' });
  const per = Math.min(4200, Math.max(2600, 20000 / L.length));
  return L.map(x => Object.assign(x, { ms: x.k === 'go' ? 1800 : x.k === 'title' ? 2600 : per }));
}
const vidWords = t => String(t).split(' ').map((w, i) => `<span class="vw" style="--i:${i}">${h(w)}</span>`).join(' ');
/* musique douce : 4 accords, nappes filtrées */
let VA = null;
function vidMusic(on){
  try { if (VA){ VA.g.gain.setTargetAtTime(0.0001, VA.c.currentTime, 0.25); const old = VA; setTimeout(() => { try { old.o.forEach(x => x.stop()); } catch(e){} }, 900); VA = null; } } catch(e){}
  if (!on || !S.sound) return;
  try { const c = AC = AC || new (window.AudioContext || window.webkitAudioContext)(), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; g.gain.value = 0.0001; lp.connect(g).connect(c.destination);
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]], t0 = c.currentTime + 0.05, dur = 2.6, o = [];
    for (let k = 0; k < 8; k++) chords[k % 4].forEach((f, j) => { const os = c.createOscillator(), og = c.createGain(); os.type = j ? 'triangle' : 'sine'; os.frequency.value = f; os.detune.value = (j - 1) * 6;
      const s = t0 + k * dur; og.gain.setValueAtTime(0.0001, s); og.gain.exponentialRampToValueAtTime(0.05, s + 0.6); og.gain.exponentialRampToValueAtTime(0.0001, s + dur + 0.4); os.connect(og).connect(lp); os.start(s); os.stop(s + dur + 0.5); o.push(os); });
    g.gain.exponentialRampToValueAtTime(0.9, t0 + 0.8); VA = { c, g, o }; } catch(e){}
}
function vidStart(){ const V = M.vid = { sc: vidScenes(M.m), i: 0, paused: false }; vidMusic(true);
  const vo = (window.NT_VOICE || {})[M.m.id]; if (vo){ try { V.audio = new Audio(vo); V.audio.play().catch(() => {}); } catch(e){} }
  renderPlayer(); vidNext(); }
function vidNext(){ const V = M && M.vid; if (!V) return; clearTimeout(V.t); if (V.paused) return;
  V.t = setTimeout(() => { if (!M || M.vid !== V) return; if (V.i >= V.sc.length - 1) return vidEnd(); V.i++; renderVid(); vidNext(); }, V.sc[V.i].ms); }
function vidEnd(){ const V = M && M.vid; if (!V) return; clearTimeout(V.t); vidMusic(false); if (V.audio) try { V.audio.pause(); } catch(e){}
  S.seenVid = S.seenVid || {}; S.seenVid[M.m.id] = 1; save(); M.vid = null; M.t0 = Date.now(); renderPlayer(); }
function renderVid(){ const V = M.vid, s = V.sc[V.i], p = $('#player');
  p.innerHTML = `<div class="vid" data-k="${s.k}"><div class="vid-bg"><i></i><i></i><i></i></div>
    <div class="vid-top"><div class="vid-seg">${V.sc.map((x, i) => `<span class="${i < V.i ? 'on' : i === V.i ? 'cur' : ''}" style="--ms:${x.ms}ms"><i></i></span>`).join('')}</div>
      <div class="row" style="justify-content:space-between;margin-top:12px"><span class="vid-brand">${I.logo}NovaTitre · cours vidéo</span><span class="row" style="gap:6px"><button class="ibtn vid-b" data-vidsound aria-label="${S.sound ? 'Couper le son' : 'Activer le son'}">${S.sound ? P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>') : P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>')}</button><button class="ibtn vid-b" data-quit aria-label="Quitter">${I.x}</button></span></div></div>
    <button class="vid-stage" data-vidtap aria-label="${V.paused ? 'Reprendre' : 'Pause'}"><div class="vid-sc k-${s.k}" key="${V.i}">
      <span class="vid-eb">${h(s.eyebrow)}</span><p class="vid-big">${vidWords(s.big)}</p>${s.viz && VIZ[s.viz] ? `<div class="vid-viz">${VIZ[s.viz]}</div>` : ''}
      ${V.paused ? `<span class="vid-pause">${I.play} Reprendre</span>` : ''}</div></button>
    ${V.audio ? `<p class="vid-sub" aria-live="polite">${h(s.big)}</p>` : ''}
    <div class="vid-foot">${s.k === 'go' ? `<button class="btn v full big" data-vidskip>${I.play}C’est parti</button>` : `<button class="btn ghost full" data-vidskip>Passer la vidéo</button>`}</div></div>`;
  p.setAttribute('aria-label', 'Cours vidéo : ' + M.m.title); }
document.addEventListener('click', ev => { const t = ev.target.closest('button'); if (!t || !M || !M.vid) return; const d = t.dataset;
  if (d.vidskip !== undefined){ ev.stopImmediatePropagation(); return vidEnd(); }
  if (d.vidsound !== undefined){ ev.stopImmediatePropagation(); S.sound = !S.sound; save(); vidMusic(S.sound); return renderVid(); }
  if (d.vidtap !== undefined){ ev.stopImmediatePropagation(); const V = M.vid; V.paused = !V.paused; if (V.paused){ clearTimeout(V.t); vidMusic(false); } else { vidMusic(true); vidNext(); } return renderVid(); }
  if (d.quit !== undefined){ clearTimeout(M.vid.t); vidMusic(false); } }, true);

/* ---------- nouveau départ : uniquement des questions sur toi, puis liberté ---------- */
const KNOWN_CH = { livret: 1, ordres: 2, etf: 3, actions: 4, pea: 8, crypto: 9, graphiques: 10, risque: 12, derives: 15 };
function knownChapters(){ return ((S.profile || {}).connu || []).map(k => KNOWN_CH[k]).filter(Boolean); }
function markKnown(plan){ const kn = knownChapters(); if (!plan) return plan; (plan.plan || []).forEach(s => { if (kn.includes(s.ch)){ s.known = true; if (!/valide-le/.test(s.why)) s.why += ' Tu dis le connaître : valide-le en 3 questions pour avancer plus vite.'; } }); return plan; }
function finishOnboarding(){ applyProfile(); S.onb = true; S.firstDone = true; S.placement = S.placement || 0; S.plan2 = markKnown(buildPlan(S.profile, S.placement)); S.justOnb = true; window.__pqAll = false; save(); go('monplan'); }
function levelTestCard(){ const P = S.profile || {}; if (!S.onb || S.testDone || S.testLater === 'non' || (S.placement || 0) > 0) return '';
  if (!(Number(P.niveau) >= 2 || ['enveloppes', 'actions', 'actif'].includes(P.exp) || (P.connu || []).filter(x => x !== 'rien').length >= 2)) return '';
  return `<section class="sec"><div class="card lvtest"><span class="eyebrow">${I.bolt} Tu as déjà des bases ?</span><b>Passe le test de niveau</b><p class="small">5 minutes, quand tu veux. Il valide les chapitres que tu maîtrises pour aller plus vite.</p>
    <div class="row" style="gap:8px;margin-top:10px"><button class="btn v sm" data-testlater>Passer le test</button><button class="link" data-testno>Plus tard</button></div></div></section>`; }
document.addEventListener('click', ev => { const t = ev.target.closest('button'); if (!t) return; const d = t.dataset;
  if (d.testlater !== undefined){ T = null; S.profile = S.profile || {}; return go('onb'); }
  if (d.testno !== undefined){ S.testLater = 'non'; save(); return render(); }
  if (d.discover !== undefined){ S.justOnb = false; save(); return go('home'); } });

const OI = {
  rook:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h2v2h2V3h4v2h2V3h2v5l-2 2v6l2 2v2H6v-2l2-2v-6L6 8z"/></svg>',
  knight:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 21h11v-2l-1-1V9c0-3-2.5-6-6-6l-1 2-2 1-2 4 1 2 3-1 1 1-4 5v2l-1 1z"/></svg>',
  bishop:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="3.5" r="1.5"/><path d="M12 6c-3 2.5-4 5-4 7 0 1.8 1 3 2 3.5L8 19v2h8v-2l-2-2.5c1-.5 2-1.7 2-3.5 0-2-1-4.5-4-7z"/></svg>',
  pawn:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="3"/><path d="M9.5 10h5l1 6 2 3v2h-11v-2l2-3z"/></svg>',
  chev:'<svg class="o-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
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
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  bulb:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  pie:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3v9h9a9 9 0 1 1-9-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/></svg>',
  hist:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
  lockic2:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>',
  arrowr:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  tag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5" fill="currentColor"/></svg>',
  flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  plug:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/></svg>',
  back:'<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m15 6-6 6 6 6"/></svg>',
};
/* ============================================================
   V16 — RETOUR AU DESIGN DU SITE NOVATITRE (maquette v2)
   Mêmes composants que le site réel (classes o- = maquette v2) pour que
   l'élève retrouve, une fois formé, l'interface du vrai site :
   héros en carrousel, Ma liste, Les plus populaires, Marchés, fiche valeur.
   Logos : pastilles avec le symbole (sur le vrai site : les vrais logos).
   ============================================================ */
const oNf = (v, d = 0) => Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const oCls = v => v == null ? '' : v >= 0 ? 'o-up' : 'o-down';
const oVar = v => v == null ? '—' : `${v >= 0 ? '▲' : '▼'} ${oNf(Math.abs(v), 2)} %`;
let oGid = 0;
function oArea(data, color, { h: hh = 100, fill = true, base = false } = {}){
  if (!Array.isArray(data) || data.length < 2) return '';
  const w = 300, min = Math.min(...data), max = Math.max(...data), r = (max - min) || 1;
  const pts = data.map((v, i) => [i / (data.length - 1) * w, hh - 6 - (v - min) / r * (hh - 14)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++){ const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
  const id = 'og' + (oGid++);
  return `<svg viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none" class="o-draw"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${base ? `<line x1="0" x2="${w}" y1="${pts[0][1]}" y2="${pts[0][1]}" stroke="rgba(255,255,255,.25)" stroke-dasharray="2 5"/>` : ''}${fill ? `<path d="${d} L${w},${hh} L0,${hh}Z" fill="url(#${id})"/>` : ''}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" vector-effect="non-scaling-stroke" pathLength="1" class="o-line"/></svg>`; }
const SECT_BG = { 'Luxe': '#3b2a1a', 'Énergie': '#1d4a3a', 'Santé': '#1f4a6b', 'Banque': '#1e3a7a', 'Aéronautique': '#2b3f6b', 'Équipements électriques': '#1f5a4a', 'Cosmétiques': '#5a2547', 'Automobile': '#4a2a2a', 'Technologie': '#2a2347', 'Logiciels': '#24406b', 'Semi-conducteurs': '#2f4a1f', 'Internet': '#2a3a7a', 'Commerce en ligne': '#5a3a12' };
const oLogo = (s, size) => { const bg = s.id === 'BTC' ? '#f7931a' : s.id === 'ETH' ? '#627eea' : s.kind === 'etf' ? '#3a2f78' : SECT_BG[s.sector] || '#2a2347';
  return `<span class="o-logo-c" style="background:${bg};color:#fff${size ? `;width:${size}px;height:${size}px` : ''}">${h(s.id.slice(0, 4))}</span>`; };
const oSpark = s => { const v = series(s.id); return v.length > 1 ? oArea(v, (chg(s) ?? 0) >= 0 ? 'var(--o-up)' : 'var(--o-down)', { h: 28, fill: false }) : `<span class="o-sp-dot" title="Cours réel : la courbe se construit jour après jour"></span>`; };
function oRow(s, opts = {}){ const v = chg(s), p = px(s);
  const right = opts.right || `<b class="o-num">${s.cur === 'USD' ? '' : ''}${oNf(p, p < 100 ? 2 : 0)}${s.cur === 'USD' ? ' $' : ' €'}</b><span class="${oCls(v)}">${oVar(v)}</span>`;
  return `<button class="o-row" data-stock="${s.id}">${oLogo(s)}<span class="o-t"><b>${opts.title || h(s.name)}</b><span>${opts.sub || h(s.id + ' · ' + s.sector)}</span></span>
    ${opts.spark ? `<span class="o-spark">${oSpark(s)}</span>` : ''}<span class="o-p">${right}</span></button>`; }
const oTiles = list => list.map(s => `<button class="o-tile" data-stock="${s.id}">${oLogo(s)}<b>${h(s.id)}</b><span class="${oCls(chg(s))}">${oVar(chg(s))}</span></button>`).join('');
const OSEG = window.__oseg = window.__oseg || {};
const oSeg = (key, opts, cur) => `<div class="o-seg" data-oseg="${key}"><span class="o-knob"></span>${opts.map(([v, l]) => `<button type="button" data-osegv="${v}" class="${v === cur ? 'o-on' : ''}">${l}</button>`).join('')}</div>`;
function oSyncSegs(){ document.querySelectorAll('.o-seg').forEach(s => { const on = s.querySelector('button.o-on'), k = s.querySelector('.o-knob'); if (on && k){ k.style.left = on.offsetLeft + 'px'; k.style.width = on.offsetWidth + 'px'; } }); }
function oWireRails(){ document.querySelectorAll('[data-orail]').forEach(r => { if (r.dataset.w) return; r.dataset.w = 1; const dots = document.getElementById(r.dataset.orail); if (!dots) return;
  r.addEventListener('scroll', () => { const i = Math.round(r.scrollLeft / (r.firstElementChild.getBoundingClientRect().width + 12)); dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('o-on', k === i)); }, { passive: true }); }); }
const WATCH = () => (S.watch = S.watch || ['AAPL', 'MC', 'SPY']);
const POP = { actions: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'TSLA', 'META', 'ASML'], etf: ['SPY', 'QQQ', 'VTI', 'IWM', 'GLD', 'EEM', 'AGG', 'VNQ'], paris: ['MC', 'TTE', 'SAN', 'BNP', 'AIR', 'SU', 'OR', 'STLA'] };
const initial = () => (S.name || 'Moi').trim()[0].toUpperCase();

/* ---------- barre du haut (comme le site) ---------- */
const oTop = () => `<header class="o-top nt-top">
  <button class="o-logo" data-go="${S.onb ? 'home' : 'landing'}" aria-label="NovaTitre, accueil">${I.logo}NovaTitre</button>
  ${applyMini()}${S.onb ? `<span class="o-live-dot" title="Cours réels datés"></span>
  <button class="o-ibtn" data-osearch aria-label="Rechercher">${OI.search}</button>
  <button class="o-ibtn o-avatar" data-go="profile" aria-label="Profil">${h(initial())}</button>` : ''}</header>`;

/* ---------- les 3 héros de l'accueil ---------- */
function heroMission(){ const L = defis(), nx = L.find(x => !x.done), done = L.filter(x => x.done).length, fresh = !Object.keys(S.done).length && !(S.sessDone && Object.keys(S.sessDone).length), fm = fresh && nextMission();
  const t = fm ? fm.title : nx ? nx.t : 'Défis du jour terminés', attr = fm ? `data-play="${fm.id}"` : nx ? nx.attr : 'data-go="carte"';
  return `<article class="o-hero o-bot"><div class="o-hero-tag"><span class="o-chess">${OI.rook}</span>Nova Missions<span class="o-status"><i></i>${done}/${L.length} défis</span></div>
    <p class="o-big o-big-txt">${h(t)}</p>
    <p class="o-sub">${fm ? 'Lance ton parcours : cours vidéo de 20 secondes, puis la mission.' : nx ? h(nx.s) : 'Bravo. Reviens demain pour la suite.'}</p>
    <div class="o-hero-prog"><span>${(() => { const { r, nx: n2 } = rankOf(S.score); return `${h(r.name)} · ${S.score} pts${n2 ? ' · prochain rang : ' + h(n2.name) : ''}`; })()}</span><i style="--w:${(() => { const { r, nx: n2 } = rankOf(S.score), lo = r.min, hi = n2 ? n2.min : 1000; return Math.max(4, Math.min(100, (S.score - lo) / (hi - lo) * 100)).toFixed(0); })()}%"></i></div>
    <div class="o-bot-links"><button ${attr}>${fm ? 'Lancer mon parcours' : 'Continuer'} ${OI.arrowr}</button><button data-go="carte">Mon parcours ${OI.arrowr}</button></div></article>`; }
function heroCoach(){ return `<article class="o-hero o-bot o-coach"><div class="o-hero-tag"><span class="o-chess">${OI.bishop}</span>Nova Coach<span class="o-status"><i></i>${aiOn() ? 'IA' : 'Prêt'}</span></div>
    <p class="o-big o-big-txt">Ton coach IA</p><p class="o-sub">Explique une notion, une valeur, une question de mission. Jamais de conseil d’achat.</p>
    <div class="o-sugg">${['C’est quoi un ETF ?', 'Explique-moi le PER'].map(q => `<button type="button" data-askhome="${h(q)}">${h(q)}</button>`).join('')}</div>
    <form class="o-ask" id="askF" style="margin-top:14px"><label class="sr" for="askIn">Écris à Nova Coach</label><input id="askIn" placeholder="Écris à Nova…" autocomplete="off"><button class="o-send" aria-label="Envoyer">${OI.up}</button></form></article>`; }
function heroReviewSchool(){ const p = learnerProfile(), rate = p.reussite_globale, C = 2 * Math.PI * 50, sc = rate ?? 0, off = C * (1 - sc / 100), rv = dueReviews().length;
  return `<article class="o-hero o-rev"><div class="o-hero-tag"><span class="o-chess">${OI.knight}</span>Nova Review</div>
    <div class="o-gauge-wrap"><div class="o-gauge"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" stroke="rgba(255,255,255,.1)" stroke-width="12" fill="none"/>
      <circle class="o-gfg" cx="60" cy="60" r="50" stroke="url(#ogr)" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${off.toFixed(1)}"/>
      <defs><linearGradient id="ogr"><stop offset="0" stop-color="#ff8fd0"/><stop offset="1" stop-color="#a68cff"/></linearGradient></defs></svg>
      <div class="o-v"><div><b class="o-num">${rate == null ? '0' : rate}</b><small>${rate == null ? 'à venir' : '% réussies'}</small></div></div></div>
      <div class="o-kpis"><p class="o-label" style="color:#ff8fd0">Bilan de la semaine</p>
        ${rate == null ? '<span class="o-kpi" style="font-size:14px;color:var(--o-ink2)">Fais ta première mission pour voir ton bilan.</span>' : `<span class="o-kpi"><i style="background:var(--o-up)"></i>${p.missions_terminees} mission${p.missions_terminees > 1 ? 's' : ''}</span><span class="o-kpi"><i style="background:var(--o-down)"></i>${rv} notion${rv > 1 ? 's' : ''} à revoir</span>`}</div></div>
    <div class="o-tip"><b>Comment ça marche</b>Nova Review relit tes réponses et te montre ce qu’il faut revoir, au bon moment.</div>
    <div class="o-cta-row"><button class="o-cta" data-go="suivi">Voir mon analyse</button></div></article>`; }

/* ---------- accueil (structure du site + l'école) ---------- */
PAGES.home = () => { const name = (S.name || '').split(' ')[0], ws = WATCH().map(mkFind).filter(Boolean), tab = OSEG.pop || 'actions', c = CAR(), d = RD.DAYS[c.n], ev = d && RD.ev(d.decide), ep = epreuveDuJour();
  return `<div class="wrap o-root-page">${oTop()}
  ${temple()}
  <div class="o-quick">
    <button data-osearch><span class="o-ring">${OI.search}</span>Rechercher</button>
    <button data-go="coach"><span class="o-ring">${OI.rook}</span>Coach IA</button>
    <button data-go="jeux"><span class="o-ring">${IC2.game}</span>Jeux</button>
    <button data-go="carte"><span class="o-ring">${IC2.map}</span>Parcours</button>
  </div>
  <div class="o-hello"><h1>${greet()}${name ? ' ' + h(name) : ''}</h1><p>Voici ton entraînement du jour.</p></div>
  ${stuckCard()}
  <section class="o-sec"><div class="o-rail" data-orail="heroDots">${heroMission()}${heroCoach()}${heroReviewSchool()}</div><div class="o-dots" id="heroDots"><i class="o-on"></i><i></i><i></i></div></section>
  <section class="o-sec o-card o-mini" style="padding:6px 18px">
    <button class="o-mini-row" data-career><span class="o-chess" style="background:#2e3a7a">${OI.bishop}</span><span class="o-t" style="text-align:left"><b>Nova News · journée de trader</b><span>${careerReady() && ev ? h(ev.co + ' : ' + ev.head) : c.n >= RD.DAYS.length ? 'Semaine réelle terminée' : 'Prochaine journée demain'}</span></span>${OI.chev}</button>
    ${ep ? `<button class="o-mini-row" data-epreuve="${ep.id}"><span class="o-chess" style="background:#1f4a6b">${OI.pawn}</span><span class="o-t" style="text-align:left"><b>Nova Event · épreuve du jour</b><span>${h(ep.t)}</span></span>${OI.chev}</button>` : ''}
    <button class="o-mini-row" data-go="jeux"><span class="o-chess" style="background:#4a2a6b">${OI.queen || OI.knight}</span><span class="o-t" style="text-align:left"><b>Nova Jeux</b><span>Hausse ou baisse, calcul flash, arnaque ou pas : 45 secondes</span></span>${OI.chev}</button>
  </section>
  ${defisHTML()}
  ${levelTestCard()}${extraQuestion()}${trialBanner()}
  <section class="o-sec"><div class="o-sec-h"><h2>Ma liste</h2><button class="o-link" data-go="markets">Tout voir ${OI.chev}</button></div>
    <div class="o-card" style="padding:8px 18px 18px">${ws.length ? ws.slice(0, 5).map(s => oRow(s, { spark: true })).join('') : `<p class="o-sub" style="padding:12px 0 0">Touche l’étoile sur une valeur pour la suivre ici.</p>`}</div></section>
  <section class="o-sec"><div class="o-sec-h"><h2>Les plus populaires</h2><button class="o-link" data-go="markets">Marchés ${OI.chev}</button></div>
    <div class="o-card">${oSeg('pop', [['actions', 'Actions'], ['paris', 'Paris'], ['etf', 'ETF']], tab)}<div class="o-grid4">${oTiles(POP[tab].map(mkFind).filter(Boolean))}</div></div></section>
  ${rewardCard()}
  ${!S.premium && !minorMode() ? offerHome() : ''}
  ${legal()}
  </div>${dock()}`; };

/* ---------- Marchés (comme le site) ---------- */
PAGES.markets = () => { const z = window.__mz || 'all', q = norm(window.__mq || ''), all = MK.filter(s => !s.hidden), mv = OSEG.movers || 'top', c = CAR(), ready = careerReady(), d = RD.DAYS[c.n];
  const list = all.filter(s => (z === 'all' || s.zone === z) && (!q || norm(s.name + ' ' + s.id + ' ' + s.sector).includes(q)));
  const withChg = all.filter(s => chg(s) != null).sort((a, b) => chg(b) - chg(a)), movers = mv === 'top' ? withChg.slice(0, 8) : withChg.slice(-8).reverse();
  const cryptos = ['BTC', 'ETH'].map(mkFind);
  return `<div class="wrap o-root-page">${oTop()}
  <div class="o-ph"><h1>Marchés</h1><span class="realtag" style="margin-left:auto">Vraies valeurs</span></div>
  <div class="o-search" style="margin-top:14px">${OI.search}<label class="sr" for="mq">Rechercher une valeur</label><input id="mq" data-mq placeholder="Action, ETF, crypto…" value="${h(window.__mq || '')}" autocomplete="off"></div>
  <div class="o-chips" style="margin-top:14px"><button class="o-chip" data-go="room"><span class="o-rec"></span>Salle de marché</button>${MZ.map(([k, t]) => `<button class="o-chip ${z === k ? 'o-on' : ''}" data-mz="${k}" aria-pressed="${z === k}">${t}</button>`).join('')}</div>
  ${q ? '' : `<section class="o-sec o-duo">${cryptos.map(s => `<button class="o-card" data-stock="${s.id}" style="text-align:left"><div class="o-h"><span class="o-label">${s.id}</span>${oLogo(s)}</div>
      <p class="o-val o-num">${oNf(toEur(s, px(s)), toEur(s, px(s)) < 10000 ? 2 : 0)} €</p><span class="${oCls(chg(s))}" style="font-weight:700;font-size:14px">${oVar(chg(s))}</span>
      <div class="o-chart">${series(s.id).length > 1 ? oArea(series(s.id), (chg(s) ?? 0) >= 0 ? 'var(--o-up)' : 'var(--o-down)', { base: true }) : '<span class="o-sp-dot big"></span>'}</div></button>`).join('')}</section>
  <button class="career ${ready ? '' : 'wait'}" data-career><span class="c-ic">${IC2.news}</span><span class="grow"><span class="eyebrow">Journée de trader · ${c.n}/${RD.DAYS.length}</span><b>${c.n >= RD.DAYS.length ? 'Semaine terminée' : ready && d ? h(RD.ev(d.decide).co) + ' : à toi de décider' : 'Prochaine journée demain'}</b></span>${ready ? `<span class="ibtn v">${I.play}</span>` : ''}</button>
  <section class="o-sec"><div class="o-sec-h"><h2>Plus fortes variations</h2></div>
    <div class="o-card">${oSeg('movers', [['top', 'En hausse'], ['flop', 'En baisse']], mv)}<div class="o-grid4">${oTiles(movers)}</div></div></section>`}
  <section class="o-sec"><div class="o-sec-h"><h2>${q ? 'Résultats' : 'Toutes les valeurs'}</h2><span class="o-label">${list.length}</span></div>
    <div class="o-card" style="padding:8px 18px">${list.map(s => oRow(s, { spark: true })).join('') || '<p class="o-sub" style="padding:14px 0">Aucune valeur trouvée.</p>'}</div></section>
  <p class="note">Cours réels relevés au 30/10/2026 (date et source sur chaque fiche), puis évolution simulée. Sur le site : cours en direct. Ce n’est pas un conseil.</p>
  ${q ? '' : `<section class="o-sec"><div class="o-sec-h"><h2>Les nouvelles de la semaine</h2></div><div class="news-row">${RD.EVENTS.filter(e => e.move != null).map(e => `<button class="nchip" data-event="${e.id}"><b>${h(e.co)}</b><span class="tn ${chgCls(e.move)}">${e.approx ? '≈ ' : ''}${pctTxt(e.move)}</span><small>${h(e.day)}</small></button>`).join('')}</div></section>
  ${learnHere('markets')}`}
  ${legal()}</div>${dock()}`; };

/* ---------- fiche valeur (comme le site) ---------- */
const STAB = [['apercu', 'Aperçu'], ['donnees', 'Données'], ['apprendre', 'Apprendre'], ['actus', 'Actus']];
PAGES.stock = () => { const s = mkFind(S.arg) || MK[0], pos = S.positions[s.id], v = chg(s), open = mkOpen(s), src = SRCM[s.src], tab = window.__stab || 'apercu', watched = WATCH().includes(s.id);
  __sd = s.date ? dateFr(s.date).slice(0, 5) : 'récent';
  const evs = RD.EVENTS.filter(e => norm(e.co).includes(norm(s.name.split(' ')[0])));
  const place = s.zone === 'Paris' ? 'Euronext Paris' : s.zone === 'Crypto' ? 'Crypto' : s.kind === 'etf' ? 'New York (ETF)' : 'New York';
  const body = tab === 'apercu' ? `<section class="o-sec o-card" style="padding:18px"><div style="display:flex;justify-content:space-between;align-items:center"><span class="o-label">Cours</span>${priceTag(s)}</div><div class="chart-wrap o-chartwrap">${sparkSVG(series(s.id))}</div></section>
      <div class="o-grid3">${[['Cours réel', money(s, s.price)], ['Date', s.date ? dateFr(s.date) : 'récent'], ['Var. réelle', s.chg != null ? pctTxt(s.chg) : '—'], ['Place', place], ['Devise', s.cur === 'USD' ? 'Dollar' : 'Euro'], ['PEA', s.pea ? 'Oui' : 'Non']].map(([k, x]) => `<div class="o-stat"><span>${k}</span><b class="o-num">${x}</b></div>`).join('')}</div>`
    : tab === 'donnees' ? `<section class="o-sec o-card" style="padding:8px 18px">${[['Nom', s.name], ['Symbole', s.id], ['Secteur', s.sector], ['Place de cotation', place], ['Type', s.kind === 'etf' ? 'ETF (fonds coté)' : s.kind === 'crypto' ? 'Crypto-actif' : 'Action'], ['Éligible PEA', s.pea ? 'Oui' : 'Non (compte-titres)'], ['Cours réel de départ', money(s, s.price) + (s.date ? ' le ' + dateFr(s.date) : '')], ['Cours affiché', money(s, px(s)) + (isSim(s) ? ' (simulé)' : '')]].map(([k, x]) => `<div class="o-statrow"><span>${k}</span><b>${h(x)}</b></div>`).join('')}</section>
      ${src ? `<a class="src" href="${h(src.u)}" target="_blank" rel="noopener">${IC2.ext}Source du cours réel : ${h(src.t)}</a>` : ''}${s.note ? `<p class="small" style="margin-top:8px">${h(s.note)}</p>` : ''}`
    : tab === 'apprendre' ? learnHere('stock')
    : `<section class="o-sec o-card news" style="padding:6px 18px">${evs.length ? evs.map(e => `<button class="o-mini-row" data-event="${e.id}"><span class="o-t" style="text-align:left"><b>${h(e.head)}</b><span>${h(e.day)} · ${e.move != null ? pctTxt(e.move) : ''}</span></span>${OI.chev}</button>`).join('') : '<p class="o-sub" style="padding:14px 0">Pas d’actualité réelle enregistrée pour cette valeur cette semaine. Sur le site : actualités en direct.</p>'}</section>`;
  return `<div class="wrap o-root-page">${oTop()}
  <div class="o-sk-top"><button class="o-circ" data-go="markets" aria-label="Retour">${OI.back}</button><span style="flex:1"></span><button class="o-circ ${watched ? 'o-on' : ''}" data-watch="${s.id}" aria-label="${watched ? 'Retirer de ma liste' : 'Suivre'}">${OI.star.replace('fill="none"', watched ? 'fill="currentColor"' : 'fill="none"')}</button></div>
  <div class="o-sk-id">${oLogo(s)}<div><h1>${h(s.name)}</h1><p>${h(s.id)} · ${place} · ${h(s.sector)}</p></div></div>
  <div class="o-sk-price"><p class="o-v o-num">${oNf(px(s), px(s) < 10 ? 4 : 2)}<small>${s.cur === 'USD' ? '$' : '€'}</small></p><p class="o-d ${oCls(v)}">${oVar(v)} <span>${isSim(s) ? 'aujourd’hui (simulé)' : 'le ' + (s.date ? dateFr(s.date) : 'dernier jour connu')}</span></p></div>
  <p class="o-label" style="font-weight:500;margin-top:6px">${s.cur === 'USD' ? `≈ ${eur(toEur(s, px(s)))} · ` : ''}Cours réel du ${s.date ? dateFr(s.date) : 'jour récent'}${isSim(s) ? ', puis simulé' : ''}</p>
  ${s.kind === 'crypto' ? `<div class="card warn" style="margin-top:12px"><b>Actif très risqué</b><p class="small" style="margin-top:4px">Le prix peut chuter de moitié en quelques semaines. Achat fictif ouvert après le chapitre 9.</p></div>` : ''}
  ${applyBanner()}
  ${pos ? `<div class="o-card o-pos"><span class="o-label">Ta position</span><div class="row" style="justify-content:space-between;margin-top:6px"><b class="tn">${num(pos.qty, pos.qty % 1 ? 4 : 0)} × ${money(s, px(s))}</b><span class="tn ${chgCls(px(s) - pos.avg)}">${(px(s) - pos.avg >= 0 ? '+' : '') + eur(toEur(s, (px(s) - pos.avg) * pos.qty))}</span></div></div>` : ''}
  ${open ? `<div class="o-trade"><button class="o-big-cta" data-buyopen="buy">Acheter</button><button class="o-big-cta o-out" data-buyopen="sell">Vendre</button></div>` : `<button class="btn ghost full" style="margin-top:14px" data-cnode="${s.minCh}">${I.lock}Achat fictif débloqué au chapitre ${s.minCh}</button>`}
  <p class="note" style="text-align:center">Argent fictif disponible : ${eur(S.cash)}</p>
  <div class="o-qa">
    <button data-askhome="${h('Explique-moi simplement ce que fait ' + s.name + ' et ce qui peut faire bouger son cours.')}"><span class="o-ring" style="background:var(--o-accent)">${OI.spark}</span>Nova Coach</button>
    <button data-stab="apprendre"><span class="o-ring">${I.book}</span>Apprendre</button>
    <button data-watch="${s.id}"><span class="o-ring">${OI.list}</span>${watched ? 'Dans ma liste' : 'Ma liste'}</button>
    <button data-soon="Alertes de cours"><span class="o-ring">${OI.bell}</span>Alerte</button>
  </div>
  <div class="o-tabs">${STAB.map(([k, l]) => `<button data-stab="${k}" class="${tab === k ? 'o-on' : ''}">${l}</button>`).join('')}</div>
  ${body}
  ${legal()}</div>${dock()}`; };
function openTicket(side){ const s = mkFind(S.arg); if (!s) return; const t = window.__tk = Object.assign({ side: 'buy', type: 'market', qty: s.frac ? 0.01 : 1, limit: px(s) }, window.__tk || {}); if (side) t.side = side;
  openSheet(`<span class="eyebrow">${t.side === 'buy' ? 'Acheter' : 'Vendre'} · argent fictif</span><h2 class="fiche-t">${h(s.name)}</h2>
    <div class="ticket" id="tradeTk" style="margin-top:10px">${ticketHTML(Object.assign({ name: s.name, price: px(s), cur: s.cur, sub: `${s.id}${isSim(s) ? ' · cours simulé' : ' · cours réel'}` }, t))}</div>
    <button class="btn v full big" style="margin-top:12px" data-trade="${s.id}">Passer l’ordre (fictif)</button><p class="note">Disponible : ${eur(S.cash)} fictifs. Aucun argent réel.</p>`, 'tk-sheet'); }

/* ---------- Portefeuille (comme le site) ---------- */
PAGES.portfolio = () => { const val = portfolioValue(), prev = portfolioValue(true), ids = Object.keys(S.positions).filter(id => mkFind(id));
  const cost = ids.reduce((t, id) => { const s = mkFind(id), p = S.positions[id]; return t + toEur(s, p.avg * p.qty); }, 0), pl = val - cost, perf = cost ? pl / cost * 100 : 0;
  const bySec = {}; ids.forEach(id => { const s = mkFind(id); bySec[s.sector] = (bySec[s.sector] || 0) + toEur(s, px(s) * S.positions[id].qty); });
  const secs = Object.entries(bySec).sort((x, y) => y[1] - x[1]), maxW = ids.length ? Math.max(...ids.map(id => toEur(mkFind(id), px(mkFind(id)) * S.positions[id].qty))) / (val || 1) : 0;
  const solid = !ids.length ? null : Math.round(Math.min(100, secs.length * 18 + (1 - maxW) * 40 + (ids.some(id => mkFind(id).kind === 'etf') ? 10 : 0)));
  return `<div class="wrap o-root-page">${oTop()}
  <div class="o-ph"><h1>Portefeuille</h1><span class="o-badge">Argent fictif</span></div>
  <section class="o-sec" style="margin-top:16px"><div class="o-rail" data-orail="pfDots">
    <article class="o-card o-analysis" style="display:flex;flex-direction:column"><p class="o-label">Valeur totale</p>
      <div style="margin-top:6px"><span class="o-big o-num" style="font-size:40px;margin:0" data-count="${Math.round(val + S.cash)}" data-fmt="eur">${eur0(val + S.cash)}</span><span class="o-delta ${oCls(val - prev)}">${ids.length ? (val - prev >= 0 ? '▲ ' : '▼ ') + eur0(Math.abs(val - prev)) : ''}</span></div>
      <div class="o-pf-split"><div><span>Investi</span><b class="tn">${eur0(val)}</b></div><div><span>Disponible</span><b class="tn">${eur0(S.cash)}</b></div></div>
      ${secs.length ? `<div class="alloc">${secs.map(([n, x], i) => `<i style="--w:${(x / val * 100).toFixed(1)}%;--c:${SECT_C[i % SECT_C.length]};--d:${i * 0.08}s" title="${h(n)}"></i>`).join('')}</div><div class="alloc-leg">${secs.slice(0, 4).map(([n, x], i) => `<span><i style="background:${SECT_C[i % SECT_C.length]}"></i>${h(n)} <b class="tn">${num(x / val * 100, 0)} %</b></span>`).join('')}</div>` : '<p class="o-sub" style="margin-top:auto">Achète ta première vraie valeur dans Marchés.</p>'}</article>
    <article class="o-card o-analysis" style="display:flex;flex-direction:column"><p class="o-label">Indice de solidité</p>
      <div style="margin-top:6px"><span class="o-big o-num" style="font-size:40px;margin:0">${solid == null ? '—' : solid}</span><span class="o-sub" style="margin-left:6px">/ 100</span></div>
      <div class="bar" style="margin-top:16px"><i style="width:${solid || 0}%"></i></div>
      <p class="o-sub" style="margin-top:auto">${secs.length} secteur${secs.length > 1 ? 's' : ''} · plus grosse ligne ${num(maxW * 100)} %. On gagne en solidité, jamais en pariant.</p></article>
  </div><div class="o-dots" id="pfDots"><i class="o-on"></i><i></i></div></section>
  <div class="o-actions">
    <button class="o-act" data-go="markets"><span class="o-ring">${OI.plus}</span>Acheter</button>
    <button class="o-act" ${epreuveDuJour() ? `data-epreuve="${epreuveDuJour().id}"` : 'data-go="markets"'}><span class="o-ring">${I.target}</span>Épreuve</button>
    <button class="o-act" data-go="carte"><span class="o-ring">${I.book}</span>Apprendre</button>
    <button class="o-act" data-pfhist><span class="o-ring">${OI.hist || OI.list}</span>Historique</button>
  </div>
  ${applyBanner()}
  <section class="o-sec o-duo">
    <article class="o-card" style="display:flex;flex-direction:column;min-height:150px"><p class="o-label">Performance</p><p class="o-big2 o-num ${oCls(perf)}">${ids.length ? (perf >= 0 ? '+' : '') + num(perf, 2) + ' %' : '—'}</p><p class="o-sub" style="margin-top:auto">depuis tes achats</p></article>
    <article class="o-card" style="display:flex;flex-direction:column;min-height:150px"><p class="o-label">Gain / perte</p><p class="o-big2 o-num ${oCls(pl)}">${ids.length ? (pl >= 0 ? '+' : '') + eur0(pl) : '—'}</p><p class="o-split o-num">${ids.length ? `${(val - prev >= 0 ? '+' : '') + eur0(val - prev)} <span>cette nuit</span>` : '<span>argent fictif</span>'}</p></article>
  </section>
  <section class="o-sec"><div class="o-sec-h"><h2>Positions</h2><span class="o-label">${ids.length} ligne${ids.length > 1 ? 's' : ''}</span></div>
    ${ids.length ? `<div class="o-card" style="padding:8px 18px">${ids.map(id => { const s = mkFind(id), p = S.positions[id], pv = toEur(s, (px(s) - p.avg) * p.qty);
      return oRow(s, { sub: `${num(p.qty, p.qty % 1 ? 4 : 0)} titre${p.qty > 1 ? 's' : ''} · ${num(toEur(s, px(s) * p.qty) / (val || 1) * 100, 0)} %`, right: `<b class="o-num">${eur0(toEur(s, px(s) * p.qty))}</b><span class="${oCls(pv)}">${(pv >= 0 ? '+' : '') + eur(pv)}</span>` }); }).join('')}</div>`
    : `<div class="o-card" style="text-align:center;padding:24px"><b>Ton portefeuille est vide</b><p class="o-sub">Choisis une vraie valeur et achète-la avec ton argent fictif.</p><button class="o-big-cta" data-go="markets">Aller aux marchés</button></div>`}</section>
  ${learnHere('portfolio')}
  <p class="o-legal">Simulation pédagogique avec de l’argent fictif. Investir comporte un risque de perte en capital.</p>
  </div>${dock()}`; };

/* ---------- recherche (sheet) et petites interactions ---------- */
function openSearch(){ openSheet(`<span class="eyebrow">${OI.search} Rechercher</span><h2 class="fiche-t">Une valeur, un mot, une question</h2>${askBar()}
  <div class="o-chips" style="margin-top:12px">${['AAPL', 'MC', 'SPY', 'BTC'].map(id => `<button class="o-chip" data-stock="${id}">${h(mkFind(id).name)}</button>`).join('')}</div>`, 'search-sheet'); setTimeout(() => { const i = $('#askIn'); if (i) i.focus(); }, 60); }
const _askResults0 = askResults;
askResults = function(q){ const n = norm(q.trim()); if (n.length < 2) return ''; const st = MK.filter(s => !s.hidden && norm(s.name + ' ' + s.id).includes(n)).slice(0, 4);
  return st.map(s => `<button class="ar" data-stock="${s.id}"><span class="ar-ic">${oLogo(s, 34)}</span><span class="grow"><b>${h(s.name)}</b><span>${h(s.id)} · ${money(s, px(s))}</span></span></button>`).join('') + _askResults0(q); };
document.addEventListener('click', ev => { const t = ev.target.closest('button'); if (!t) return; const d = t.dataset;
  if (d.osearch !== undefined) return openSearch();
  if (d.osegv){ const k = t.closest('[data-oseg]').dataset.oseg; OSEG[k] = d.osegv; return render(); }
  if (d.watch){ const w = WATCH(), i = w.indexOf(d.watch); if (i >= 0) w.splice(i, 1); else w.unshift(d.watch); save(); toast(i >= 0 ? 'Retirée de ta liste.' : 'Ajoutée à ta liste : tu la suis depuis l’accueil.'); return render(); }
  if (d.stab && !d.go){ window.__stab = d.stab; return render(); }
  if (d.buyopen){ window.__tk = null; return openTicket(d.buyopen); }
  if (d.pfhist !== undefined) return openSheet(`<span class="eyebrow">Historique</span><h2 class="fiche-t">Tes opérations</h2><div class="card" style="margin-top:10px">${S.history.length ? S.history.slice(-15).reverse().map(x => `<p class="small tn hist">${h(x)}</p>`).join('') : '<p class="small">Rien pour l’instant.</p>'}</div>`); });
document.addEventListener('input', ev => { if (ev.target.matches('[data-mq]')){ window.__mq = ev.target.value; const pos = ev.target.selectionStart; render(); const n = $('#mq'); if (n){ n.focus(); n.setSelectionRange(pos, pos); } } });

/* ============================================================
   V17 — COURS VIDÉO « CINÉMA » (style de la vidéo de référence)
   Particules qui se rassemblent en texte, spirale, barre de saisie
   qui s'écrit toute seule, sphère lumineuse, transitions floues.
   Un seul canvas, ~900 particules, 60 FPS ; tout s'arrête si
   « réduire les animations » est demandé (texte simple à la place).
   ============================================================ */
const VFX = (() => {
  let cv, cx, W = 0, H = 0, P = [], mode = 'stars', raf = 0, t0 = 0, orb = 0, dpr = 1;
  const N = () => (W * H > 500000 ? 1100 : 850);
  function size(){ dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function textPts(txt, n, cy){ const o = document.createElement('canvas'), ow = Math.floor(W), oh = Math.floor(H * 0.5); o.width = ow; o.height = oh; const g = o.getContext('2d');
    const lines = []; let fs = Math.min(64, W / 6.2); g.font = `900 ${fs}px Inter, system-ui, sans-serif`;
    const words = String(txt).split(' '); let cur = '';
    for (const w of words){ const tt = cur ? cur + ' ' + w : w; if (g.measureText(tt).width > ow * 0.86 && cur){ lines.push(cur); cur = w; } else cur = tt; } lines.push(cur);
    if (lines.length > 3){ fs *= 0.72; g.font = `900 ${fs}px Inter, system-ui, sans-serif`; }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; const lh = fs * 1.08, top = oh / 2 - (lines.length - 1) * lh / 2;
    lines.slice(0, 4).forEach((l, i) => g.fillText(l, ow / 2, top + i * lh));
    const d = g.getImageData(0, 0, ow, oh).data, pts = [], step = Math.max(2, Math.round(Math.sqrt(ow * oh / 9000)));
    for (let y = 0; y < oh; y += step) for (let x = 0; x < ow; x += step) if (d[(y * ow + x) * 4 + 3] > 128) pts.push([x, y + cy - oh / 2]);
    for (let i = pts.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    return pts.slice(0, n); }
  function targets(m, txt){
    const n = P.length, cxm = W / 2, cym = H * 0.45; let T = [];
    if (m === 'text'){ T = textPts(txt, Math.floor(n * 0.8), cym); }
    else if (m === 'spiral'){ for (let i = 0; i < n * 0.75; i++){ const a = i * 0.11, r = 4 + i * 0.32 * (W / 400); T.push([cxm + Math.cos(a) * r * 0.9, cym * 0.62 + Math.sin(a) * r * 0.42]); } }
    else if (m === 'chart'){ const k = Math.floor(n * 0.6); for (let i = 0; i < k; i++){ const u = i / k, x = W * 0.08 + u * W * 0.84, y = H * 0.27 - (Math.sin(u * 9) * 0.04 + u * 0.12) * H + (Math.random() - 0.5) * 8; T.push([x, y]); } }
    else if (m === 'orb'){ const R = Math.min(W, H) * 0.41, k = Math.floor(n * 0.75); for (let i = 0; i < k; i++){ const a = Math.random() * Math.PI * 2, r = R * (0.8 + 0.2 * Math.sqrt(Math.random())); T.push([cxm + Math.cos(a) * r, cym + Math.sin(a) * r]); } }
    /* V18 : formes autour du texte (le texte reste lisible au centre) */
    else if (m === 'ring'){ const k = Math.floor(n * 0.7), rx = W * 0.47, ry = Math.min(H * 0.24, W * 0.62); for (let i = 0; i < k; i++){ const a = Math.random() * Math.PI * 2, j = 0.86 + Math.random() * 0.22; T.push([cxm + Math.cos(a) * rx * j, cym + Math.sin(a) * ry * j]); } }
    else if (m === 'wave'){ const k = Math.floor(n * 0.7); for (let i = 0; i < k; i++){ const u = i / k, band = i % 2 ? 1 : -1, x = W * 0.02 + u * W * 0.96; T.push([x, cym + band * H * 0.2 + Math.sin(u * 7 + band) * H * 0.04 + (Math.random() - 0.5) * 10]); } }
    else if (m === 'grid'){ const k = Math.floor(n * 0.6), cols = 13; for (let i = 0; i < k; i++){ const c = i % cols, r = Math.floor(i / cols) % 22, x = W * 0.06 + c * (W * 0.88 / (cols - 1)), y = H * 0.12 + r * (H * 0.76 / 21); if (Math.abs(y - cym) < H * 0.13) continue; T.push([x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3]); } }
    P.forEach((p, i) => { const t = T[i]; if (t){ p.tx = t[0]; p.ty = t[1]; p.on = 1; } else { p.tx = Math.random() * W; p.ty = Math.random() * H; p.on = 0; } p.d = Math.random() * 0.4; }); }
  function frame(t){ raf = requestAnimationFrame(frame); const dt = Math.min(50, t - (t0 || t)); t0 = t;
    cx.clearRect(0, 0, W, H);
    if (orb > 0.01){ const R = Math.min(W, H) * 0.30, g = cx.createRadialGradient(W / 2, H * 0.45, R * 0.1, W / 2, H * 0.45, R * 1.6); g.addColorStop(0, `rgba(196,181,255,${0.32 * orb})`); g.addColorStop(0.45, `rgba(124,92,255,${0.16 * orb})`); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
    cx.globalCompositeOperation = 'lighter';
    const k = mode === 'stars' ? 0.012 : 0.075, tt = t / 1000;
    for (const p of P){ const delay = p.d * 1000; if ((p.since = (p.since || 0) + dt) > delay){ p.x += (p.tx - p.x) * k * (dt / 16); p.y += (p.ty - p.y) * k * (dt / 16); }
      if (!p.on){ p.tx += Math.sin(tt * 0.3 + p.s * 9) * 0.08; p.ty += Math.cos(tt * 0.25 + p.s * 7) * 0.06; }
      if (mode === 'spiral' && p.on){ const dx = p.tx - W / 2, dy = (p.ty - H * 0.279) / 0.466, a = 0.0016 * dt / 16; const nx = dx * Math.cos(a) - dy * Math.sin(a), ny = dx * Math.sin(a) + dy * Math.cos(a); p.tx = W / 2 + nx; p.ty = H * 0.279 + ny * 0.466; }
      const tw = p.on ? 0.85 : 0.25 + 0.25 * Math.sin(tt * 2 + p.s * 20);
      cx.fillStyle = p.on ? `rgba(${p.c},${tw})` : `rgba(220,215,255,${tw})`; cx.beginPath(); cx.arc(p.x, p.y, p.on ? p.r : p.r * 0.7, 0, 6.283); cx.fill(); }
    cx.globalCompositeOperation = 'source-over'; }
  function start(canvas){ stop(); cv = canvas; cx = cv.getContext('2d'); size(); P = Array.from({ length: N() }, () => ({ x: Math.random() * W, y: Math.random() * H, tx: 0, ty: 0, r: 0.6 + Math.random() * 1.4, s: Math.random(), c: Math.random() < 0.7 ? '255,255,255' : Math.random() < 0.5 ? '196,181,255' : '143,176,255' }));
    targets('stars'); raf = requestAnimationFrame(frame); window.addEventListener('resize', size); }
  function scene(m, txt){ if (!cx) return; mode = ['text', 'orb', 'chart', 'spiral', 'ring', 'wave', 'grid'].includes(m) ? m : 'stars'; P.forEach(p => p.since = 0); targets(mode, txt); const goal = m === 'orb' ? 1 : 0, o0 = orb, s0 = performance.now();
    const fade = () => { const u = Math.min(1, (performance.now() - s0) / 900); orb = o0 + (goal - o0) * u; if (u < 1) requestAnimationFrame(fade); }; fade(); }
  function burst(){ P.forEach(p => { p.x += (Math.random() - 0.5) * 60; p.y += (Math.random() - 0.5) * 60; }); }
  function stop(){ cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', size); cx = null; }
  return { start, scene, burst, stop };
})();
/* petit souffle sonore aux transitions */
function vidWhoosh(){ if (!S.sound) return; try { const c = AC = AC || new (window.AudioContext || window.webkitAudioContext)(), len = c.sampleRate * 0.6, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2); const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); src.buffer = b; f.type = 'bandpass'; f.Q.value = 0.8;
  f.frequency.setValueAtTime(400, c.currentTime); f.frequency.exponentialRampToValueAtTime(2400, c.currentTime + 0.5); g.gain.value = 0.06; src.connect(f).connect(g).connect(c.destination); src.start(); } catch(e){} }
const VMODE = { title: 'text', goal: 'spiral', idea: 'chart', key: 'orb', go: 'orb' };
function vidTyping(el, txt){ if (!el) return; let i = 0; const sp = Math.max(14, Math.min(34, 2400 / txt.length));
  const tick = () => { if (!el.isConnected) return; i++; el.textContent = txt.slice(0, i); if (i < txt.length) setTimeout(tick, sp); else el.classList.add('done'); }; tick(); }
renderVid = function(){ const V = M.vid, s = V.sc[V.i], p = $('#player'), rm = RM();
  if (!p.querySelector('.vidc')){ p.innerHTML = `<div class="vidc"><canvas class="vid-cv" id="vidCv" aria-hidden="true"></canvas><div class="vid-vign"></div>
      <div class="vid-top"><div class="vid-seg"></div><div class="row" style="justify-content:space-between;margin-top:12px"><span class="vid-brand">${I.logo}NovaTitre · cours vidéo</span><span class="row" style="gap:6px"><button class="ibtn vid-b" data-vidsound></button><button class="ibtn vid-b" data-quit aria-label="Quitter">${I.x}</button></span></div></div>
      <button class="vid-stage" data-vidtap><div class="vid-ov"></div></button><div class="vid-foot"></div></div>`;
    if (!rm) VFX.start($('#vidCv')); }
  p.querySelector('.vid-seg').innerHTML = V.sc.map((x, i) => `<span class="${i < V.i ? 'on' : i === V.i && !V.paused ? 'cur' : i === V.i ? 'cur paused' : ''}" style="--ms:${x.ms}ms"><i></i></span>`).join('');
  const sb = p.querySelector('[data-vidsound]'); sb.setAttribute('aria-label', S.sound ? 'Couper le son' : 'Activer le son'); sb.innerHTML = S.sound ? P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>') : P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>');
  p.querySelector('.vid-stage').setAttribute('aria-label', V.paused ? 'Reprendre' : 'Pause');
  const key = V.i + (V.paused ? 'p' : ''); const ov = p.querySelector('.vid-ov');
  if (ov.dataset.k !== String(V.i)){ ov.dataset.k = V.i; if (!rm){ VFX.scene(VMODE[s.k], s.big); if (V.i) vidWhoosh(); }
    const k = s.k;
    ov.className = 'vid-ov k-' + k;
    ov.innerHTML = k === 'title' ? `<span class="vid-eb">${h(s.eyebrow)}</span><p class="${rm ? 'vid-big' : 'sr'}">${h(s.big)}</p><div class="vid-title-space"></div>`
      : k === 'goal' ? `<div class="vid-low"><span class="vid-eb">${h(s.eyebrow)}</span><p class="vid-big">${vidWords(s.big)}</p></div>`
      : k === 'idea' ? `<div class="vid-low"><span class="vid-eb">${h(s.eyebrow)}</span><div class="vid-bar"><span class="vb-ic">${OI.spark}</span><p class="vb-tx" aria-label="${h(s.big)}"></p></div></div>`
      : k === 'key' ? `<div class="vid-orbtx"><span class="vid-eb">${h(s.eyebrow)}</span></div><div class="vid-low"><p class="vid-big sm">${vidWords(s.big)}</p></div>`
      : `<div class="vid-orbtx"><span class="vid-logo">${I.logo}</span></div><div class="vid-low"><p class="vid-big go">${h(s.big)}</p></div>`;
    if (k === 'idea'){ const tx = ov.querySelector('.vb-tx'); if (rm) tx.textContent = s.big; else vidTyping(tx, s.big); } }
  ov.querySelector('.vid-pause') && ov.querySelector('.vid-pause').remove(); if (V.paused) ov.insertAdjacentHTML('beforeend', `<span class="vid-pause">${I.play} Reprendre</span>`);
  p.querySelector('.vid-foot').innerHTML = s.k === 'go' ? `<button class="btn v full big" data-vidskip>${I.play}C’est parti</button>` : `<button class="btn ghost full" data-vidskip>Passer la vidéo</button>`;
  p.setAttribute('aria-label', 'Cours vidéo : ' + M.m.title); };
const _vidEnd0 = vidEnd; vidEnd = function(){ VFX.stop(); return _vidEnd0(); };
document.addEventListener('click', ev => { const t = ev.target.closest('button'); if (t && t.dataset.quit !== undefined && M && M.vid) VFX.stop(); }, true);

/* outil de test automatique (sans effet pour l'utilisateur) */
if (window.NT_AI) NT_AI.init().then(() => { if (!M) render(); });
window.NT_DEBUG = { sessStart: id => startSession(id), pq: () => PQ, plan: (P, v) => buildPlan(P, v), next: () => (nextMission() || {}).ch, start: id => { const m = findMission(id); if (m){ S.seenVid = S.seenVid || {}; S.seenVid[m.id] = 1; } startMission(id); }, video: id => { const m = findMission(id); if (m && S.seenVid) delete S.seenVid[m.id]; startMission(id); }, sess: id => sessMission(themeById(id)), rule(m, pace){ const p0 = S.pace; S.pace = pace; const st = sessRefs(m).map(i => m.steps[i]); S.pace = p0; return sessionRule(st); }, play(id, att = 0, mode = 'full'){ const m = findMission(id); S.plays[id] = att; startMissionRaw(m, mode); }, step: () => M && !M.end ? M.steps[M.i] : null, state: () => M && { i: M.i, n: M.steps.length, end: !!M.end }, ids: () => [...MS, ...POOL, ...STORY].map(m => m.id), applyPass(){ if (M && M.steps[M.i] && M.steps[M.i].type === 'apply'){ M.ok.push(true); next(); } } };
function startMissionRaw(m, mode){ const all = m.steps.map((_, i) => i), refs = mode === 'eclair' ? all.filter(i => gradable(m.steps[i])).slice(0, 3) : all; const att = S.plays[m.id] || 0; S.plays[m.id] = att + 1;
  M = { m, mode, att, steps: refs.map(i => prep(m.steps[i], m.id + '#' + i, att, i)), i: 0, ok: [], second: [], fb: null, ui: {}, ko: 0, fast: 0, combo: 0, t0: Date.now() }; renderPlayer(); }

/* ============================================================
   V18 — LE COURS VIDÉO COMPLET (03/11/2026, demande de Thomas)
   - La vidéo raconte TOUT le cours : objectif, cartes de leçon,
     briefs, chaque phrase de la fiche, chaque point « À retenir »
     et l'exemple. Sa durée vient du texte (environ 0,4 s par mot) :
     elle dure le temps du cours.
   - Le texte est dans la scène, au centre, entouré par les
     particules (plus de cadre ni de barre en bas).
   - Voix : synthèse vocale du navigateur en français, si le son est
     activé. La scène attend la fin de la phrase avant de changer.
     Sans voix (son coupé ou navigateur sans voix), le rythme de
     lecture suffit.
   ============================================================ */
const V18_MODES = ['wave', 'ring', 'chart', 'grid', 'spiral'];
const v18Sents = t => String(t || '').split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Ý0-9«])/).map(x => x.trim()).filter(x => x.length > 3);
const v18ms = t => { const n = String(t).split(/\s+/).length; return Math.round(Math.min(12000, Math.max(2800, 1300 + n * 400))); };
vidScenes = function(m){
  const ch = CH.find(c => c.id === m.ch), f = ficheFor(m.id) || (String(m.id).startsWith('i-') ? CO.find(x => x.ch === m.ch) : null), L = [], seen = new Set();
  const add = (o) => { const k = norm(o.big).replace(/[^a-z0-9]+/g, '').slice(0, 28); if (!o.big || seen.has(k)) return; seen.add(k); L.push(o); };
  add({ k: 'title', mode: 'text', eyebrow: ch ? `Chapitre ${ch.id} · ${ch.title}` : 'Mission', big: m.title, ms: 3200 });
  add({ k: 'say', mode: 'spiral', eyebrow: 'L’objectif', big: String(m.id).startsWith('i-') && ch ? ch.sub : m.goal });
  let j = 0; const mode = () => V18_MODES[j++ % V18_MODES.length];
  (m.steps || []).forEach(st => {
    if (st.type === 'lesson') (st.cards || []).forEach(c => v18Sents(c.t).forEach((x, i) => add({ k: 'say', mode: mode(), eyebrow: i ? '' : (c.h || st.title), big: x })));
    if (st.type === 'brief') v18Sents(st.text).forEach((x, i) => add({ k: 'say', mode: mode(), eyebrow: i ? '' : st.title, big: x }));
  });
  if (f){
    f.body.forEach((p, pi) => v18Sents(p).forEach((x, i) => add({ k: 'say', mode: mode(), eyebrow: !pi && !i ? f.title : '', big: x })));
    if (f.key && f.key.length){ L.push({ k: 'mark', mode: 'text', eyebrow: f.title, big: 'À retenir', ms: 2300, silent: true }); f.key.forEach((x, i) => add({ k: 'key', mode: 'orb', eyebrow: `À retenir · ${i + 1}/${f.key.length}`, big: x })); }
    if (f.ex) add({ k: 'say', mode: 'chart', eyebrow: 'Exemple', big: f.ex });
  }
  L.push({ k: 'go', mode: 'text', eyebrow: 'Prêt ?', big: 'À toi de jouer', ms: 2600, say: 'À toi de jouer.' });
  return L.map(x => Object.assign(x, { ms: x.ms || v18ms(x.big) }));
};
/* --- voix --- */
const V18V = { ok: 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined', voice: null };
function v18Voice(){ if (!V18V.ok) return null; if (V18V.voice) return V18V.voice; const vs = speechSynthesis.getVoices().filter(v => /^fr/i.test(v.lang));
  V18V.voice = vs.find(v => /fr-FR/i.test(v.lang) && /google|amélie|amelie|thomas|audrey|marie|natural|premium|enhanced/i.test(v.name)) || vs.find(v => /fr-FR/i.test(v.lang)) || vs[0] || null; return V18V.voice; }
if (V18V.ok) try { speechSynthesis.onvoiceschanged = () => { V18V.voice = null; v18Voice(); }; } catch(e){}
const v18Hush = () => { if (V18V.ok) try { speechSynthesis.cancel(); } catch(e){} };
function v18Say(text, done){ if (!V18V.ok || !S.sound || !v18Voice()) return false;
  try { v18Hush(); const u = new SpeechSynthesisUtterance(String(text).replace(/≈/g, 'environ').replace(/→/g, ', donc').replace(/÷/g, 'divisé par').replace(/ ?= ?/g, ' égale ').replace(/€/g, ' euros').replace(/%/g, ' pour cent'));
    u.lang = 'fr-FR'; u.voice = v18Voice(); u.rate = 1.02; u.pitch = 1; u.onend = u.onerror = () => done(); speechSynthesis.speak(u); return true; } catch(e){ return false; } }
/* --- déroulé : une scène change quand le temps de lecture est passé ET que la voix a fini --- */
vidNext = function(){ const V = M && M.vid; if (!V) return; clearTimeout(V.t); if (V.paused) return; const s = V.sc[V.i], my = V.tok = (V.tok || 0) + 1;
  let timeUp = false, said = true; V.t0 = performance.now() - (V.into || 0);
  const adv = () => { if (!M || M.vid !== V || V.tok !== my || V.paused || !timeUp || !said) return; V.into = 0; if (V.i >= V.sc.length - 1) return vidEnd(); V.i++; renderVid(); vidNext(); };
  if (!s.silent){ said = false; if (!v18Say(s.say || s.big, () => { said = true; setTimeout(adv, 350); })) said = true; }
  V.t = setTimeout(() => { timeUp = true; adv(); }, Math.max(300, s.ms - (V.into || 0)));
  V.cap = setTimeout(() => { said = true; adv(); }, s.ms + 9000); };
const _v18End = vidEnd; vidEnd = function(){ v18Hush(); const V = M && M.vid; if (V){ clearTimeout(V.cap); clearInterval(V.tick); } return _v18End(); };
const v18Total = V => V.sc.reduce((a, x) => a + x.ms, 0), v18Before = V => V.sc.slice(0, V.i).reduce((a, x) => a + x.ms, 0);
const v18Clock = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function v18Progress(){ const V = M && M.vid, p = $('#player'); if (!V || !p) return; const tot = v18Total(V), el = Math.min(V.sc[V.i].ms, V.paused ? (V.into || 0) : performance.now() - (V.t0 || performance.now())), now = v18Before(V) + el;
  const b = p.querySelector('.v18-bar i'), c = p.querySelector('.v18-time'); if (b) b.style.transform = `scaleX(${Math.min(1, now / tot).toFixed(4)})`; if (c) c.textContent = `${v18Clock(now)} / ${v18Clock(tot)}`; }
const v18Text = (s, rm) => s.mode === 'text' && !rm ? `<p class="sr">${h(s.big)}</p>` : `<p class="v18-t${s.k === 'key' ? ' key' : ''}${s.k === 'go' ? ' go' : ''}">${vidWords(s.big)}</p>`;
renderVid = function(){ const V = M.vid, s = V.sc[V.i], p = $('#player'), rm = RM();
  if (!p.querySelector('.vidc.v18')){ p.innerHTML = `<div class="vidc v18"><canvas class="vid-cv" id="vidCv" aria-hidden="true"></canvas><div class="vid-vign"></div>
      <div class="vid-top"><div class="v18-bar" aria-hidden="true"><i></i></div><div class="row" style="justify-content:space-between;margin-top:12px"><span class="vid-brand">${I.logo}NovaTitre · cours vidéo <span class="v18-time tn"></span></span><span class="row" style="gap:6px"><button class="ibtn vid-b" data-vidsound></button><button class="ibtn vid-b" data-quit aria-label="Quitter">${I.x}</button></span></div></div>
      <button class="vid-stage v18-stage" data-vidtap><div class="v18-ov" aria-live="polite"></div></button><div class="vid-foot"></div></div>`;
    if (!rm) VFX.start($('#vidCv')); clearInterval(V.tick); V.tick = setInterval(v18Progress, 200); }
  const sb = p.querySelector('[data-vidsound]'); sb.setAttribute('aria-label', S.sound ? 'Couper le son et la voix' : 'Activer le son et la voix'); sb.innerHTML = S.sound ? P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>') : P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>');
  p.querySelector('.vid-stage').setAttribute('aria-label', V.paused ? 'Reprendre' : 'Pause');
  const ov = p.querySelector('.v18-ov');
  if (ov.dataset.k !== String(V.i)){ ov.dataset.k = V.i; if (!rm){ VFX.scene(s.mode, s.big); if (V.i) vidWhoosh(); }
    ov.className = `v18-ov k-${s.k} m-${s.mode}`;
    ov.innerHTML = `${s.eyebrow ? `<span class="vid-eb">${h(s.eyebrow)}</span>` : ''}${s.k === 'go' ? `<span class="vid-logo">${I.logo}</span>` : ''}${v18Text(s, rm)}`; }
  ov.querySelector('.vid-pause') && ov.querySelector('.vid-pause').remove(); if (V.paused) ov.insertAdjacentHTML('beforeend', `<span class="vid-pause">${I.play} Reprendre</span>`);
  p.querySelector('.vid-foot').innerHTML = s.k === 'go' ? `<button class="btn v full big" data-vidskip>${I.play}C’est parti</button>` : `<button class="btn ghost full" data-vidskip>Passer la vidéo</button>`;
  p.setAttribute('aria-label', 'Cours vidéo : ' + M.m.title); v18Progress(); };
/* pause, son, quitter : la voix suit (écouté avant les autres gestionnaires) */
window.addEventListener('click', ev => { const t = ev.target.closest('button'); if (!t || !M || !M.vid) return; const d = t.dataset, V = M.vid;
  if (d.vidtap !== undefined){ if (!V.paused){ V.into = Math.min(V.sc[V.i].ms - 300, performance.now() - (V.t0 || performance.now())); v18Hush(); clearTimeout(V.cap); } }
  if (d.vidsound !== undefined && S.sound) v18Hush();
  if (d.quit !== undefined){ v18Hush(); clearTimeout(V.cap); clearInterval(V.tick); } }, true);
/* outil de test automatique du cours vidéo (sans effet pour l'utilisateur) */
if (window.NT_DEBUG) Object.assign(window.NT_DEBUG, { vid: () => M && M.vid && { n: M.vid.sc.length, i: M.vid.i, total: v18Total(M.vid), sc: M.vid.sc.map(x => ({ k: x.k, mode: x.mode, ms: x.ms, big: x.big })) }, vidGo(i){ if (M && M.vid){ M.vid.i = i; M.vid.into = 0; renderVid(); vidNext(); } } });


/* ============================================================
   V18 — PAGE MISSION VIVANTE (03/11/2026, demande de Thomas)
   - Fond animé violet → bleu (nappes lumineuses + étoiles), dessiné
     sur un canvas qui survit aux changements de question.
   - Chaque question entre en douceur ; les choix arrivent un par un.
   - Le bas de page n'est plus vide : « Le cours en bref » rappelle
     un point de la fiche, et la progression montre où on en est.
   - Rien de tout ça en examen (pas d'aide), ni avec
     « réduire les animations » (fond fixe, pas de mouvement).
   ============================================================ */
const PLFX = (() => { let cv = null, cx = null, raf = 0, W = 0, H = 0, stars = [];
  function size(){ const d = 0.2; W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.ceil(W * d); cv.height = Math.ceil(H * d); cx.setTransform(d, 0, 0, d, 0, 0);
    stars = Array.from({ length: Math.round(W * H / 7000) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.4 + Math.random() * 1.1, s: Math.random() * 6.28, v: 0.04 + Math.random() * 0.12 })); }
  const blobs = [[0.15, 0.18, '124,92,255', 0.55], [0.85, 0.72, '23,55,143', 0.75], [0.6, 0.35, '143,116,255', 0.3], [0.3, 0.9, '91,140,255', 0.35]];
  let lt = 0;
  function draw(t){ if (!cv || !cv.isConnected){ raf = 0; return; } raf = requestAnimationFrame(draw); if (t - lt < 32) return; lt = t; const tt = t / 1000; cx.clearRect(0, 0, W, H);
    blobs.forEach(([bx, by, c, a], i) => { const x = W * (bx + Math.sin(tt * 0.11 + i * 1.7) * 0.12), y = H * (by + Math.cos(tt * 0.09 + i * 2.1) * 0.08), R = Math.max(W, H) * (0.42 + 0.05 * Math.sin(tt * 0.2 + i));
      const g = cx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, `rgba(${c},${a * 0.55})`); g.addColorStop(1, `rgba(${c},0)`); cx.fillStyle = g; cx.fillRect(0, 0, W, H); });
    for (const p of stars){ p.y -= p.v; if (p.y < -2){ p.y = H + 2; p.x = Math.random() * W; } const o = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(tt * 1.6 + p.s)); cx.fillStyle = `rgba(226,220,255,${(o * 0.6).toFixed(3)})`; cx.fillRect(p.x, p.y, 5, 5); } }
  function mount(host){ if (!cv){ cv = document.createElement('canvas'); cv.className = 'pl-fx'; cv.setAttribute('aria-hidden', 'true'); cx = cv.getContext('2d'); }
    if (cv.parentNode !== host) host.prepend(cv); size(); if (RM()){ cancelAnimationFrame(raf); raf = 0; draw(0); cancelAnimationFrame(raf); raf = 0; return; } if (!raf) raf = requestAnimationFrame(draw); }
  addEventListener('resize', () => { if (cv && cv.isConnected) size(); });
  return { mount }; })();
const PL_KIND = { qcm: 'Choisis la bonne réponse', vf: 'Vrai ou faux', swipe: 'Range les cartes', order: 'Remets dans l’ordre', calc: 'Calcule', match: 'Relie', ticket: 'Passe l’ordre', book: 'Lis le carnet', chart: 'Lis le graphique', slider: 'Simule', candles: 'Lis les bougies', brief: 'À lire', lesson: 'Leçon', decision: 'Décide', role: 'Mise en situation' };
function plAside(){ if (!M || M.mode === 'exam' || M.fb) return ''; const st = M.steps[M.i], f = ficheFor(M.m.id) || CO.find(x => x.ch === M.m.ch), n = M.steps.length;
  const keys = f ? [...(f.key || [])] : [], k = keys.length ? keys[M.i % keys.length] : null;
  const dots = Array.from({ length: n }, (_, i) => `<i class="${i < M.i ? (M.ok[i] === false ? 'ko' : 'ok') : i === M.i ? 'cur' : ''}"></i>`).join('');
  return `<div class="pl-aside" aria-label="Progression et rappel">
    <div class="pl-prog"><span class="eyebrow">${h(PL_KIND[st.type] || 'Étape')} · ${M.i + 1}/${n}</span><div class="pl-dots" aria-hidden="true">${dots}</div></div>
    ${k ? `<div class="pl-tip"><span class="pl-tip-ic" aria-hidden="true">${I.book}</span><div><span class="eyebrow">Le cours en bref${f ? ' · ' + h(f.title) : ''}</span><p>${h(k)}</p></div></div>` : ''}
  </div>`; }
const _plRender = renderPlayer;
renderPlayer = function(){ const prevI = renderPlayer._i, prevM = renderPlayer._m; _plRender(); const p = $('#player'); if (!p || !M || M.vid || M.end) return;
  PLFX.mount(p); const body = p.querySelector('.p-body'); if (!body) return;
  if (prevI !== M.i || prevM !== M.m.id){ body.classList.add('pl-enter'); body.querySelectorAll('.opt, .opts > button, .sw-btns button, .choice').forEach((b, i) => b.style.setProperty('--d', `${0.12 + i * 0.06}s`)); }
  body.insertAdjacentHTML('beforeend', plAside()); renderPlayer._i = M.i; renderPlayer._m = M.m.id; };


/* ============================================================
   V19 — ÉCHANTILLON DE REFONTE (03/11/2026)
   Style : minimaliste et épuré (esprit Revolut + Apple), couleurs
   actuelles (violet → bleu sur fond sombre), beaucoup d'animation.
   1. Fond animé sur tout le site.
   2. Les blocs apparaissent au défilement ; les chiffres comptent.
   3. Accueil réduit à 4 éléments : temple, prochaine mission,
      Nova Coach, portefeuille fictif.
   4. Cours vidéo de 15 à 20 s : phrases courtes affichées mot à mot
      (prêtes pour une voix enregistrée), et les points lumineux
      dessinent ce dont parle la phrase (voiture, billets, courbe…).
      Deux boutons seulement : Retour et Passer la vidéo.
   ============================================================ */

/* ---------- 1. fond animé (canvas fixe derrière les pages) ---------- */
const BGFX = (() => {
  /* Fond animé « sans coût » (03/11/2026) : aucune image n'est redessinée pendant l'animation.
     - 4 nappes bleues (dégradés CSS) qui glissent lentement : la carte graphique se contente de les déplacer ;
     - 2 couches d'étoiles dessinées UNE fois au démarrage, puis qui montent lentement ;
     - plus on descend, plus les nappes bleues s'allument (une seule opacité qui change) ;
     - tout se fige quand une mission, une vidéo ou l'ouverture couvre la page. */
  let root, blobs, raf = 0;
  function starTile(n, r0, r1, a0){ const c = document.createElement('canvas'), W = 420, H = 840; c.width = W; c.height = H; const g = c.getContext('2d');
    for (let i = 0; i < n; i++){ const x = Math.random() * W, y = Math.random() * H, r = r0 + Math.random() * (r1 - r0); g.fillStyle = `rgba(226,220,255,${(a0 + Math.random() * 0.35).toFixed(2)})`; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
    return c.toDataURL('image/png'); }
  function onScroll(){ if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const sp = Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)); const lvl = window.__ntLvl || 0; blobs.style.opacity = Math.min(1, (0.35 + 0.65 * sp) * (0.85 + 0.35 * lvl)).toFixed(3); }); }
  function mount(){ if (root) return; root = document.createElement('div'); root.className = 'z-bgw'; root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `<div class="z-blobs"><i></i><i></i></div><div class="z-stars a"></div>`;
    document.body.prepend(root); blobs = root.querySelector('.z-blobs');
    root.querySelector('.z-stars.a').style.backgroundImage = `url(${starTile(90, 0.4, 1.4, 0.2)})`;
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    /* une mission, une vidéo ou l'ouverture couvre tout l'écran : on fige et on cache la page derrière (fluidité) */
    const cover = () => { const c = !!document.getElementById('player') || !!document.querySelector('.nt-intro'); root.classList.toggle('off', c); document.body.classList.toggle('nt-covered', !!document.getElementById('player')); };
    new MutationObserver(cover).observe(document.body, { childList: true }); cover(); }
  return { mount }; })();

/* ---------- 2. apparition au défilement + chiffres qui comptent ----------
   Sans risque (03/11/2026) : un bloc n'est JAMAIS caché d'avance. Il n'est caché que si le navigateur
   confirme qu'il est hors de l'écran, puis il apparaît quand on arrive dessus. Si le navigateur ne
   répond pas (aperçu, vieux téléphone), tout reste visible. */
const zIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { const el = e.target;
    if (!el.dataset.rvs){ el.dataset.rvs = 1; if (!e.isIntersecting){ el.classList.add('z-rv'); return; } zIO.unobserve(el); el.querySelectorAll('[data-count]').forEach(zCount); return; }
    if (e.isIntersecting){ el.classList.add('z-in'); zIO.unobserve(el); el.querySelectorAll('[data-count]').forEach(zCount); } }), { threshold: 0.01 }) : null;
function zCount(el){ if (el.dataset.counted) return; el.dataset.counted = 1; const to = Number(el.dataset.count), dec = Number(el.dataset.dec || 0), suf = el.dataset.suf || '', pre = el.dataset.pre || '';
  if (!isFinite(to) || RM()){ return; } const t0 = performance.now(), dur = 1100;
  const f = t => { const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3); el.textContent = pre + num(to * e, dec) + suf; if (u < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
function zReveal(root){ if (!root || !zIO || RM()) return; root.querySelectorAll('.wrap > .sec, .wrap > section.sec, .wrap > .o-sec, .wrap > section').forEach(el => { if (el.dataset.rv) return; el.dataset.rv = 1; zIO.observe(el); }); }
(function(){ const app = document.getElementById('app'); if (!app) return; new MutationObserver(() => zReveal(app)).observe(app, { childList: true }); BGFX.mount(); zReveal(app); })();

/* ---------- 3. (03/11/2026) l'accueil réduit est retiré à la demande de Thomas : l'accueil complet d'origine revient ---------- */
/* ---------- 4. cours vidéo court, illustré par les points ---------- */
/* Dessins en traits (repère 100 × 100) : les points se posent sur ces traits. */
const ZSHAPE = {
  car: 'M8 66 V58 Q8 52 14 51 L22 49 L32 37 Q35 34 40 34 H62 Q67 34 70 38 L79 49 L86 51 Q92 52 92 58 V66 Z M30 49 L37 40 H49 V49 Z M55 40 H65 L72 49 H55 Z M30 66 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M72 66 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0',
  money: 'M10 28 H90 V68 H10 Z M18 36 H82 V60 H18 Z M50 48 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M14 76 H86 M20 84 H80',
  coins: 'M30 74 m-20 0 a20 6 0 1 0 40 0 a20 6 0 1 0 -40 0 M10 74 V62 M50 62 V74 M30 62 m-20 0 a20 6 0 1 0 40 0 a20 6 0 1 0 -40 0 M10 62 V50 M50 50 V62 M30 50 m-20 0 a20 6 0 1 0 40 0 a20 6 0 1 0 -40 0 M70 38 m-20 0 a20 6 0 1 0 40 0 a20 6 0 1 0 -40 0 M50 38 V74 M90 38 V74 M70 74 m-20 0 a20 6 0 1 0 40 0',
  up: 'M8 10 V90 H94 M14 80 C28 74 32 58 44 62 S62 40 72 36 S84 24 90 16 M80 15 L90 16 L89 26',
  down: 'M8 10 V90 H94 M14 22 L28 36 L38 30 L52 58 L64 50 L88 82 M78 82 H88 V72',
  house: 'M10 50 L50 14 L90 50 M20 41 V88 H80 V41 M42 88 V64 H58 V88 M64 24 V16 H74 V33',
  shield: 'M50 8 L86 20 V46 C86 70 70 84 50 92 C30 84 14 70 14 46 V20 Z M34 50 L46 62 L68 38',
  clock: 'M50 52 m-38 0 a38 38 0 1 0 76 0 a38 38 0 1 0 -76 0 M50 26 V52 L68 62 M42 8 H58',
  building: 'M18 88 V30 L50 12 L82 30 V88 Z M30 42 H42 M58 42 H70 M30 58 H42 M58 58 H70 M30 74 H42 M58 74 H70 M8 88 H92',
  scale: 'M50 12 V84 M32 86 H68 M16 26 H84 M16 26 L6 54 H26 Z M84 26 L74 54 H94 Z M50 12 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0',
  pie: 'M50 52 m-38 0 a38 38 0 1 0 76 0 a38 38 0 1 0 -76 0 M50 52 V14 M50 52 L83 71 M50 52 L17 71',
  warn: 'M50 10 L92 86 H8 Z M50 36 V62 M50 72 V74',
  target: 'M50 50 m-38 0 a38 38 0 1 0 76 0 a38 38 0 1 0 -76 0 M50 50 m-24 0 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0 M50 50 m-10 0 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0',
  calendar: 'M14 22 H86 V88 H14 Z M14 38 H86 M30 12 V28 M70 12 V28 M28 52 H36 M46 52 H54 M64 52 H72 M28 68 H36 M46 68 H54',
};
/* Mot de la phrase → dessin (le premier trouvé dans la phrase gagne). */
const ZMAP = [['car', /voiture|permis|\bauto\b/], ['house', /maison|immobilier|logement|loyer|appartement/], ['warn', /arnaque|piege|escroc|mefie|attention/],
  ['shield', /precaution|imprevu|garanti|securi|prot[eè]g|sans risque/], ['money', /argent|euro|€|budget|depense|salaire|billet|somme|payer/], ['coins', /epargn|livret|economi|interet/],
  ['down', /baisse|perte|perdre|krach|chute|varie|risque/], ['up', /rendement|hausse|gagn|croissan|compos|monte|plus-value|viser plus/], ['clock', /\bans?\b|horizon|temps|duree|attend|long terme/],
  ['calendar', /mois|chaque mois|regulier|calendrier/], ['building', /entreprise|action|societe|cotee|bourse/], ['pie', /diversif|repart|etf|portefeuille|panier/], ['scale', /equilibr|compar|choisir|ou bien|\bvs\b|=/], ['target', /objectif|but|cible/]];
const zPick = (t, fb) => { const n = norm(t); let best = null, at = 1e9; for (const [k, re] of ZMAP){ const m = n.match(re); if (m && m.index < at){ at = m.index; best = k; } } return best || fb || 'target'; };
/* Scénarios écrits à la main pour l'échantillon (15 à 20 s). */
const ZSCRIPT = {
  'm1-1': [
    { t: 'Ton permis dans 6 mois ? Cet argent reste sur un livret.', shape: 'car' },
    { t: 'D’abord, une épargne de précaution : 3 à 6 mois de dépenses.', shape: 'shield' },
    { t: 'Investir, c’est accepter que la valeur varie pour viser plus.', shape: 'up' },
    { t: 'Rendement élevé = risque élevé. Toujours.', shape: 'scale' },
  ],
};
const zWords = t => String(t).split(/\s+/).filter(Boolean);
const zWordMs = w => 175 + Math.min(190, w.length * 20) + (/[.,:;?!]$/.test(w) ? 200 : 0);
function zScenes(m){ let L = ZSCRIPT[m.id];
  if (!L){ const f = ficheFor(m.id) || CO.find(x => x.ch === m.ch), keys = f ? (f.key || []) : [], body = f ? f.body.flatMap(v18Sents).filter(x => x.length < 110) : [];
    L = [...(body.length ? [body[0]] : [m.goal]), ...keys].slice(0, 4).map(t => ({ t })); }
  const out = L.map(x => { const w = zWords(x.t), times = []; let acc = 380; w.forEach(x2 => { times.push(acc); acc += zWordMs(x2); }); return { k: 'say', t: x.t, shape: x.shape || zPick(x.t), words: w, times, ms: acc + 700 }; });
  let tot = out.reduce((a, x) => a + x.ms, 0);
  while (tot > 20000 && out.length > 2){ tot -= out.pop().ms; }
  out.push({ k: 'go', t: 'À toi de jouer', shape: 'logo', words: zWords('À toi de jouer'), times: [300, 520, 700, 900], ms: 2200 });
  return out; }
/* Moteur de points : forme dessinée → points ; transition « vitesse lumière » entre deux scènes. */
const ZFX = (() => { let cv, cx, W, H, P = [], raf = 0, warp = 0, cxm, cym, sz;
  function size(){ const d = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); cxm = W / 2; cym = H * 0.38; sz = Math.min(W * 0.78, H * 0.42, 420); }
  function pts(shape, n){ const o = document.createElement('canvas'), S2 = 240; o.width = o.height = S2; const g = o.getContext('2d'); g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
    if (shape === 'logo'){ g.fillStyle = '#fff'; g.translate(20, 20); g.scale(200 / 742, 200 / 742); g.translate(-392, -172); ['M 770,180 L 781,283 L 781,293 L 783,303 L 784,324 L 802,500 L 803,521 L 808,559 L 808,569 L 810,583 L 815,594 L 828,607 L 1028,718 L 1125,770 L 949,475 Z', 'M 758,181 L 616,414 L 402,770 L 410,766 L 510,699 L 615,626 L 741,535 L 754,520 L 758,508 Z', 'M 410,774 L 1120,774 L 861,663 L 849,659 L 747,615 L 727,608 L 712,608 L 697,614 L 572,686 Z'].forEach(d => g.fill(new Path2D(d))); }
    else { g.lineWidth = 7; g.scale(S2 / 100, S2 / 100); g.lineWidth = 2.6; g.stroke(new Path2D(ZSHAPE[shape] || ZSHAPE.target)); }
    const d = g.getImageData(0, 0, S2, S2).data, out = []; for (let y = 0; y < S2; y += 2) for (let x = 0; x < S2; x += 2) if (d[(y * S2 + x) * 4 + 3] > 100) out.push([x / S2, y / S2]);
    for (let i = out.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out.slice(0, n).map(([u, v]) => [cxm + (u - 0.5) * sz, cym + (v - 0.5) * sz]); }
  function shape(name){ if (!cx) return; const n = P.length, T = pts(name, Math.floor(n * 0.72)); warp = 1;
    P.forEach((p, i) => { const t = T[i % Math.max(1, T.length)]; if (i < T.length){ p.tx = t[0] + (Math.random() - 0.5) * 1.5; p.ty = t[1] + (Math.random() - 0.5) * 1.5; p.on = 1; } else { p.tx = Math.random() * W; p.ty = Math.random() * H; p.on = 0; } p.d = Math.random() * 260; p.age = 0;
      const a = Math.atan2(p.y - cym, p.x - cxm); p.vx = Math.cos(a) * (3 + Math.random() * 6); p.vy = Math.sin(a) * (3 + Math.random() * 6); }); }
  function frame(t){ raf = requestAnimationFrame(frame); const dt = 16; cx.fillStyle = 'rgba(5,4,12,0.32)'; cx.fillRect(0, 0, W, H); const tt = t / 1000; warp *= 0.94;
    cx.globalCompositeOperation = 'lighter';
    for (const p of P){ p.age += dt; if (p.age < p.d * 0.5 && warp > 0.05){ p.x += p.vx * warp; p.y += p.vy * warp; } else { const k = p.on ? 0.085 : 0.02; p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
      if (p.on){ p.tx += Math.sin(tt * 1.1 + p.s * 20) * 0.04; p.ty += Math.cos(tt * 0.9 + p.s * 17) * 0.04; }
      const a = p.on ? 0.9 : 0.22 + 0.2 * Math.sin(tt * 2 + p.s * 20); cx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`; cx.beginPath(); cx.arc(p.x, p.y, p.on ? p.r : p.r * 0.6, 0, 6.283); cx.fill(); }
    cx.globalCompositeOperation = 'source-over'; }
  function start(c){ stop(); cv = c; cx = cv.getContext('2d'); size(); cx.fillStyle = '#05040c'; cx.fillRect(0, 0, W, H);
    P = Array.from({ length: W * H > 500000 ? 1400 : 1050 }, () => ({ x: Math.random() * W, y: Math.random() * H, tx: Math.random() * W, ty: Math.random() * H, r: 0.6 + Math.random() * 1.3, s: Math.random(), on: 0, d: 0, age: 0, vx: 0, vy: 0, c: Math.random() < 0.6 ? '255,255,255' : Math.random() < 0.5 ? '196,181,255' : '143,180,255' }));
    raf = requestAnimationFrame(frame); addEventListener('resize', size); }
  function stop(){ cancelAnimationFrame(raf); raf = 0; removeEventListener('resize', size); cx = null; }
  return { start, shape, stop }; })();

vidScenes = zScenes;
vidStart = function(){ const V = M.vid = { sc: zScenes(M.m), i: 0, z: 1 }; vidMusic(true); const vo = (window.NT_VOICE || {})[M.m.id];
  if (vo && vo.src){ try { V.audio = new Audio(vo.src); V.audio.play().catch(() => {}); } catch(e){} }
  renderPlayer(); vidNext(); };
vidNext = function(){ const V = M && M.vid; if (!V) return; clearTimeout(V.t); const s = V.sc[V.i], my = V.tok = (V.tok || 0) + 1;
  /* les mots apparaissent à leur moment (plus tard : temps lus dans le fichier de voix) */
  (V.wt || []).forEach(clearTimeout); V.wt = s.times.map((ms, i) => setTimeout(() => { const w = document.querySelector(`.zv-t .zw[data-i="${i}"]`); if (w) w.classList.add('on'); }, RM() ? 0 : ms));
  V.t = setTimeout(() => { if (!M || M.vid !== V || V.tok !== my) return; if (V.i >= V.sc.length - 1) return vidEnd(); V.i++; renderVid(); vidNext(); }, s.ms); };
const _zEnd = vidEnd; vidEnd = function(){ const V = M && M.vid; if (V){ (V.wt || []).forEach(clearTimeout); clearTimeout(V.t); } ZFX.stop(); return _zEnd(); };
renderVid = function(){ const V = M.vid, s = V.sc[V.i], p = $('#player'), rm = RM();
  if (!p.querySelector('.zv')){ p.innerHTML = `<div class="zv"><canvas class="zv-cv" aria-hidden="true"></canvas>
      <button class="zv-back" data-quit aria-label="Retour">${I.back}</button>
      <div class="zv-t" aria-live="polite"></div>
      <div class="zv-foot"><button class="zv-skip" data-vidskip>Passer la vidéo</button></div></div>`;
    if (!rm) ZFX.start(p.querySelector('.zv-cv')); }
  const box = p.querySelector('.zv-t');
  if (box.dataset.k !== String(V.i)){ box.dataset.k = V.i; if (!rm) ZFX.shape(s.shape); if (V.i) vidWhoosh();
    const kw = new Set(); const re = ZMAP.find(([k]) => k === s.shape); s.words.forEach((w, i) => { const n = norm(w); if (/\d/.test(w) || (re && re[1].test(n))) kw.add(i); });
    box.className = 'zv-t k-' + s.k; box.innerHTML = `<p>${s.words.map((w, i) => `<span class="zw${kw.has(i) ? ' kw' : ''}${rm ? ' on' : ''}" data-i="${i}">${h(w)}</span>`).join(' ')}</p>`; }
  p.setAttribute('aria-label', 'Cours vidéo : ' + M.m.title); };

window.addEventListener('click', ev => { const t = ev.target.closest('button'); if (!t || !M || !M.vid) return; if (t.dataset.quit !== undefined){ (M.vid.wt || []).forEach(clearTimeout); ZFX.stop(); } }, true);

/* ============================================================
   V20 — VERSION 3D (03/11/2026) : moteur js/gl.js (Three.js)
   1. Ouverture du site : le temple se construit en points lumineux.
   2. Accueil : le temple est fait de points, il suit le doigt.
   3. Cours vidéo en 3D : les points se transforment d'un dessin à
      l'autre, effet « vitesse lumière », étoiles en profondeur,
      petite note sur les mots importants.
   4. La carte « Continuer » s'agrandit et devient la mission.
   Sans WebGL ou avec « réduire les animations » : version 2D.
   ============================================================ */
const GL_OK = () => !!(window.NTGL && NTGL.ok) && !RM();
const TEMPLE_W = () => TEMPLE_SVG.replace(/currentColor/g, '#ffffff');
const LAV = { c1: '#ece8ff', c2: '#c9c2ea', c3: '#a9a3cc' };
const glTint = (P, c) => { P.u.uC1.value.set(c.c1); P.u.uC2.value.set(c.c2); P.u.uC3.value.set(c.c3); };

/* ---------- 1. ouverture du site ----------
   Les points arrivent en « vitesse lumière » et dessinent le temple ; puis ils
   deviennent le VRAI temple (le dessin d'origine, traits nets), qui glisse à sa
   place sur la page pendant que l'écran d'ouverture s'efface. */
const TEMPLE_COLOR = '#9e99b6';
function ntIntro(){ if (!GL_OK()) return; try { if (sessionStorage.getItem('ntIntro')) return; sessionStorage.setItem('ntIntro', '1'); } catch(e){ return; }
  window.__ntIntro = true; document.body.classList.add('nt-intro-on'); const o = document.createElement('div'); o.className = 'nt-intro'; o.setAttribute('aria-hidden', 'true');
  o.innerHTML = `<canvas></canvas><div class="nt-intro-svg">${TEMPLE_SVG}</div><div class="nt-intro-w"><b>NovaTitre</b><span>L’école de Bourse, en mission</span></div>`; document.body.appendChild(o);
  let P; try { P = new NTGL.Particles(o.querySelector('canvas'), { stars: true, camZ: 6, spread: 4, sway: 0, camSway: 0, count: NTGL.mobile ? 6500 : 12000 }); } catch(e){ o.remove(); return; }
  glTint(P, LAV); P.u.uScale.value = 10.5; P.warp(1.4);
  const svgBox = o.querySelector('.nt-intro-svg'); let done = false;
  NTGL.loadSVG('temple', TEMPLE_W()).then(im => { if (!P.alive) return; const v = P.view(), W = innerWidth, H = innerHeight, w = Math.min(v.w * 0.84, 4.2), y = v.h * 0.15;
    /* même place et même taille, en pixels, pour le vrai temple */
    const pw = w * W / v.w, cy = H / 2 - y * H / v.h; Object.assign(svgBox.style, { width: pw + 'px', left: (W - pw) / 2 + 'px', top: (cy - pw * 294 / 400 / 2) + 'px' });
    P.morph(NTGL.imgPts(im, Math.floor(P.N * 0.85), { w, y, depth: 0.04 }), 2000, { order: 'build' }); });
  setTimeout(() => { o.classList.add('w'); }, 1500);
  setTimeout(() => { o.classList.add('solid'); }, 2300);            /* les points deviennent le vrai temple */
  const end = () => { if (done) return; done = true; o.classList.add('solid');
    const tgt = document.querySelector('[data-temple] > svg'), a = svgBox.getBoundingClientRect();
    /* le vrai temple glisse exactement sur celui de la page (coin haut-gauche sur coin haut-gauche, même largeur) */
    if (tgt){ scrollTo(0, 0); const b = tgt.getBoundingClientRect(); if (b.width > 10){ const sx = b.width / a.width; svgBox.animate([{ transform: 'translate(0px,0px) scale(1)' }, { transform: `translate(${b.left - a.left}px,${b.top - a.top}px) scale(${sx})` }], { duration: 800, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }); } }
    o.classList.add('out');
    setTimeout(() => { document.body.classList.remove('nt-intro-on'); svgBox.classList.add('fade'); templeGlint(); }, 820); setTimeout(() => { P.dispose(); o.remove(); }, 1450); };
  setTimeout(end, 3500); o.addEventListener('pointerdown', end); }

/* ---------- 2. temple de l'accueil ----------
   Au repos : le vrai temple (dessin d'origine). Quand on descend : il se défait en
   points qui s'éparpillent ; quand on remonte : les points se rassemblent et le
   vrai temple revient. Plus de zoom. */
/* 03/11/2026 : le reflet de lumière sur le temple est retiré (Thomas ne l'aime pas) ; il reste l'allumage des colonnes */
function templeGlint(){}
const GLT = { P: null, cv: null, ready: false, k: 0 };
function glTempleMount(){ if (!GL_OK()) return; const host = document.querySelector('#app [data-temple]'); if (!host) return;
  if (!GLT.cv){ GLT.cv = document.createElement('canvas'); GLT.cv.className = 'gl-temple'; }
  host.classList.add('gl'); if (GLT.ready) host.classList.add('solid'); if (GLT.cv.parentNode !== host) host.appendChild(GLT.cv);
  if (!GLT.P){ try { GLT.P = new NTGL.Particles(GLT.cv, { count: NTGL.mobile ? 5200 : 12000, dprMax: 1.5, camZ: 5, sway: 0, camSway: 0, spread: 3, maxFps: 60,
        pauseIf: () => !!document.getElementById('player') || (GLT.ready && GLT.k < 0.005 && !GLT.sp) }); } catch(e){ host.classList.remove('gl'); GLT.cv.remove(); return; }
    glTint(GLT.P, LAV); GLT.P.u.uScale.value = 10;
    NTGL.loadSVG('temple', TEMPLE_W()).then(im => { const sv = host.querySelector(':scope > svg'), at = sv ? NTGL.rectToWorld(GLT.P, sv) : { w: GLT.P.view().w * 0.92, x: 0, y: 0 }, pts = NTGL.imgPts(im, Math.floor(GLT.P.N * 0.94), { w: at.w, x: at.x, y: at.y, depth: 0.03 });
      if (window.__ntIntro){ GLT.P.morph(pts, 0); GLT.ready = true; document.querySelectorAll('[data-temple].gl').forEach(t => t.classList.add('solid')); return; }
      GLT.P.morph(pts, 2400, { order: 'build' }); setTimeout(() => { GLT.ready = true; document.querySelectorAll('[data-temple].gl').forEach(t => t.classList.add('solid')); templeGlint(); }, 2500); }); }
  else GLT.P.size();
  templeScroll(); }
addEventListener('pointermove', ev => { if (GLT.P && GLT.cv.isConnected && !GLT.ready) GLT.P.pointer(ev.clientX / innerWidth - 0.5, ev.clientY / innerHeight - 0.5); }, { passive: true });
const _tsOld = templeScroll;
templeScroll = function(){ document.querySelectorAll('[data-temple]').forEach(t => { if (!t.classList.contains('gl')) return; const hh = t.__h || (t.__h = t.offsetHeight || 260);
    /* 0 tant qu'on n'a pas fait défiler la page (temple net au repos), 1 quand le temple est sorti de l'écran.
       Fluidité : on ne lit plus la position (hauteur gardée en mémoire) et on n'écrit que si la valeur change. */
    const k = Math.min(1, Math.max(0, (scrollY - 4) / (hh * 0.9))), kv = k.toFixed(3); GLT.k = k; if (t.__kv === kv) return; t.__kv = kv; if (t.style.transform !== 'none') t.style.transform = 'none';
    t.style.setProperty('--k', kv); t.style.opacity = k > 0.75 ? (1 - (k - 0.75) / 0.25).toFixed(3) : '1';
    if (GLT.P){ GLT.tg = Math.pow(k, 1.3); templeSpring(); } });
  _tsOld(); };
/* ---------- 3. cours vidéo en 3D ---------- */
const LOGO_D = ['M 770,180 L 781,283 L 781,293 L 783,303 L 784,324 L 802,500 L 803,521 L 808,559 L 808,569 L 810,583 L 815,594 L 828,607 L 1028,718 L 1125,770 L 949,475 Z', 'M 758,181 L 616,414 L 402,770 L 410,766 L 510,699 L 615,626 L 741,535 L 754,520 L 758,508 Z', 'M 410,774 L 1120,774 L 861,663 L 849,659 L 747,615 L 727,608 L 712,608 L 697,614 L 572,686 Z'];
function zv3(canvas){ let P; try { P = new NTGL.Particles(canvas, { stars: true, camZ: 6, spread: 3.2 }); } catch(e){ return null; }
  let first = true;
  return { _P: P, shape(name){ const v = P.view(), w = Math.min(v.w * 0.8, v.h * 0.4), y = v.h * 0.12, n = Math.floor(P.N * 0.7);
      const pts = name === 'logo' ? NTGL.fromCanvas(g => { g.translate(28, 28); g.scale(200 / 742, 200 / 742); g.translate(-392, -172); LOGO_D.forEach(d => g.fill(new Path2D(d))); }, n, { w: w * 0.8, y, depth: 0.3 })
        : NTGL.pathPts(ZSHAPE[name] || ZSHAPE.target, n, { w, y, depth: 0.22 });
      P.warp(first ? 1.3 : 0.75); P.morph(pts, first ? 1700 : 1250); first = false; },
    stop(){ P.dispose(); } }; }
let ZV = null;
const zvStop = () => { if (ZV){ ZV.stop(); ZV = null; } ZFX.stop(); };
function zChime(){ if (!S.sound) return; try { const c = AC = AC || new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.type = 'sine'; o.frequency.setValueAtTime(1046.5, t); o.frequency.exponentialRampToValueAtTime(1318.5, t + 0.08); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.55); } catch(e){} }
vidNext = function(){ const V = M && M.vid; if (!V) return; clearTimeout(V.t); const s = V.sc[V.i], my = V.tok = (V.tok || 0) + 1;
  (V.wt || []).forEach(clearTimeout); V.wt = s.times.map((ms, i) => setTimeout(() => { const w = document.querySelector(`.zv-t .zw[data-i="${i}"]`); if (w && !w.classList.contains('on')){ w.classList.add('on'); if (w.classList.contains('kw')) zChime(); } }, RM() ? 0 : ms));
  V.t = setTimeout(() => { if (!M || M.vid !== V || V.tok !== my) return; if (V.i >= V.sc.length - 1) return vidEnd(); V.i++; renderVid(); vidNext(); }, s.ms); };
const _z3End = vidEnd; vidEnd = function(){ zvStop(); return _z3End(); };
renderVid = function(){ const V = M.vid, s = V.sc[V.i], p = $('#player'), rm = RM();
  if (!p.querySelector('.zv')){ p.innerHTML = `<div class="zv"><canvas class="zv-cv" aria-hidden="true"></canvas>
      <button class="zv-back" data-quit aria-label="Retour">${I.back}</button>
      <div class="zv-t" aria-live="polite"></div>
      <div class="zv-foot"><button class="zv-skip" data-vidskip>Passer la vidéo</button></div></div>`;
    zvStop(); if (!rm){ ZV = GL_OK() ? zv3(p.querySelector('.zv-cv')) : null; if (!ZV) ZFX.start(p.querySelector('.zv-cv')); } }
  const box = p.querySelector('.zv-t');
  if (box.dataset.k !== String(V.i)){ box.dataset.k = V.i; if (!rm){ if (ZV) ZV.shape(s.shape); else ZFX.shape(s.shape); } if (V.i) vidWhoosh();
    const kw = new Set(), res = (s.beats || [[0, s.shape]]).map(([, sh]) => (ZMAP.find(([k]) => k === sh) || [])[1]).filter(Boolean); s.words.forEach((w, i) => { if (/\d/.test(w) || res.some(re => re.test(norm(w)))) kw.add(i); });
    box.className = 'zv-t k-' + s.k; box.innerHTML = `<p>${s.words.map((w, i) => `<span class="zw${kw.has(i) ? ' kw' : ''}${rm ? ' on' : ''}" data-i="${i}">${h(w)}</span>`).join(' ')}</p>`; }
  p.setAttribute('aria-label', 'Cours vidéo : ' + M.m.title); };
window.addEventListener('click', ev => { const t = ev.target.closest('button'); if (t && M && M.vid && t.dataset.quit !== undefined) zvStop(); }, true);

/* ---------- 4. la carte « Continuer » s'agrandit ---------- */
window.addEventListener('click', ev => { const b = ev.target.closest('.z-next'); if (!b || b.dataset.zgo || RM() || !b.matches('[data-play],[data-review],[data-sess],[data-sessstart],[data-career]')) return;
  ev.stopPropagation(); ev.preventDefault(); const r = b.getBoundingClientRect(), f = document.createElement('div'); f.className = 'z-fly'; document.body.appendChild(f);
  Object.assign(f.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const a = f.animate([{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: '30px' }, { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px', borderRadius: '0px' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  a.onfinish = () => { b.dataset.zgo = 1; b.click(); delete b.dataset.zgo; f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' }).onfinish = () => f.remove(); }; }, true);

/* branchement : après chaque affichage de page */
(function(){ const app = document.getElementById('app'); if (!app) return; new MutationObserver(() => { if (S.page === 'home' || S.page === 'landing') glTempleMount(); }).observe(app, { childList: true });
  ntIntro(); if (S.page === 'home' || S.page === 'landing') glTempleMount(); })();


/* ============================================================
   V22 — FINITIONS DU TEMPLE (03/11/2026)
   1. Les quatre colonnes s'allument une par une en arrivant sur l'accueil.
   2. Le logo du toit brille doucement de temps en temps (CSS).
   3. Quand on remonte, les points reviennent avec un petit rebond (ressort).
   ============================================================ */
let SPR = { x: 0, v: 0 };
function templeSpring(){ if (GLT.sp || !GLT.P) return; GLT.sp = true; const step = () => { if (!GLT.P){ GLT.sp = false; return; }
    const tg = GLT.tg || 0; SPR.v += (tg - SPR.x) * 0.14; SPR.v *= 0.74; SPR.x += SPR.v;
    GLT.P.u.uScatter.value = SPR.x; GLT.P.last = 0;
    if (Math.abs(tg - SPR.x) < 0.0008 && Math.abs(SPR.v) < 0.0008){ SPR.x = tg; GLT.P.u.uScatter.value = tg; GLT.sp = false; return; }
    requestAnimationFrame(step); }; requestAnimationFrame(step); }
function templeColumns(){ if (RM()) return; const sv = document.querySelector('[data-temple].solid > svg'); if (!sv) return;
  const g = [...sv.querySelectorAll(':scope > g.v-tp')].slice(3, 7);
  g.forEach((el, i) => el.animate([{ color: '#9e99b6' }, { color: '#ffffff', offset: 0.35 }, { color: '#9e99b6' }], { duration: 900, delay: 250 + i * 170, easing: 'ease-out' })); }
const _v22Glint = templeGlint; templeGlint = function(){ _v22Glint(); setTimeout(templeColumns, 500); };
/* en revenant sur l'accueil (le temple est déjà là) : les colonnes s'allument */
(function(){ const app = document.getElementById('app'); if (!app) return; let last = S.page;
  new MutationObserver(() => { if (S.page === 'home' && last !== 'home' && GLT.ready) setTimeout(templeColumns, 350); last = S.page; }).observe(app, { childList: true }); })();


/* V24 (03/11/2026) : en arrivant sur le site, après l'animation d'ouverture, on est directement sur l'accueil
   (visiteur « invité »). La page de présentation reste accessible par le logo ; les questions de départ restent proposées. */
if (!S.onb && !S.guest){ S.guest = true; if (S.page === 'landing') S.page = 'home'; save(); }


/* ============================================================
   V25 — EFFETS « 2030 », LOT 1 (03/11/2026)
   Chaque effet a son interrupteur (NT_FX). Pour en couper un :
   localStorage 'nt-fx' = {"sound":false} par exemple, ou NT_FX.sound = false.
   Rien de tout ça ne change le contenu ni les boutons : ce sont des
   couches visuelles posées par-dessus. Avec « réduire les animations »,
   tout est coupé sauf les sons (eux suivent le réglage « Sons et vibrations »).
   ============================================================ */
const NT_FX = window.NT_FX = Object.assign({ pages: true, fly: true, touch: true, numbers: true, mission: true, level: true, sound: true }, (() => { try { return JSON.parse(localStorage.getItem('nt-fx') || '{}'); } catch(e){ return {}; } })());
const FXON = k => NT_FX[k] !== false && !RM();

/* 1. transitions entre pages : la page glisse dans le sens de la barre (gauche ↔ droite) */
(function(){ const app = document.getElementById('app'); if (!app) return; let lastPg = S.page;
  new MutationObserver(() => { if (S.page === lastPg) return; const order = DOCK.map(([k]) => k), gi = k => order.findIndex(x => DOCK_GROUP[x].includes(k)), a = gi(lastPg), b = gi(S.page); lastPg = S.page;
    if (!FXON('pages')) return; const w = app.querySelector('.wrap'); if (!w) return; const dir = a < 0 || b < 0 || a === b ? 0 : (b > a ? 1 : -1);
    w.animate([{ opacity: 0, transform: `translate3d(${dir * 28}px,${dir ? 0 : 14}px,0)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' }); }).observe(app, { childList: true }); })();

/* 1 bis. une carte de mission s'agrandit et devient la mission */
window.addEventListener('click', ev => { if (!FXON('fly')) return; const b = ev.target.closest('#app :is([data-play],[data-session],[data-epreuve],[data-gamestart],[data-career],[data-stock])'); if (!b || b.dataset.zgo || M || b.disabled) return; const r = b.getBoundingClientRect(); if (r.width < 200 || r.height < 56) return;
  ev.stopPropagation(); ev.preventDefault(); const f = document.createElement('div'); f.className = 'z-fly'; document.body.appendChild(f);
  const br = getComputedStyle(b).borderRadius || '24px';
  const a = f.animate([{ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', borderRadius: br, opacity: 0.6 }, { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px', borderRadius: '0px', opacity: 1 }], { duration: 430, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
  a.onfinish = () => { b.dataset.zgo = 1; b.click(); delete b.dataset.zgo; f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, fill: 'forwards' }).onfinish = () => f.remove(); }; }, true);

/* 2. cartes qui réagissent : inclinaison 3D à la souris (ordinateur), petite vibration au toucher (Android) */
const TILT_SEL = '.rcard, .tile, .o-card, .card, .z-pf';
let tiltEl = null;
addEventListener('pointermove', ev => { if (!FXON('touch') || ev.pointerType !== 'mouse') return; const el = ev.target.closest && ev.target.closest(TILT_SEL);
  if (tiltEl && tiltEl !== el){ tiltEl.style.transform = ''; tiltEl.classList.remove('z-tilt'); tiltEl = null; }
  if (!el || el.closest('#player')) return; const r = el.getBoundingClientRect(); if (r.width > 700) return; const x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
  tiltEl = el; el.classList.add('z-tilt'); el.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateZ(0)`;
  el.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%'); el.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%'); }, { passive: true });
addEventListener('pointerdown', ev => { if (!FXON('touch') || !S.sound) return; if (ev.target.closest && ev.target.closest('button') && navigator.vibrate) try { navigator.vibrate(8); } catch(e){} }, { passive: true });

/* 3. chiffres qui comptent jusqu'à leur valeur (une fois par page), puis texte d'origine remis à l'identique */
const NUM_RE = /^([▲▼+−-]?\s?)(\d{1,3}(?:[\s  ]\d{3})*|\d+)(,\d+)?(\s?(?:€|\$|%|pts))?$/;
function countUpIn(root){ if (!FXON('numbers')) return; root.querySelectorAll('.tn, .o-num, .o-up, .o-down, .o-price, .o-big').forEach(el => { if (el.dataset.cu || el.children.length) return; const t = el.textContent.trim(); if (t.length > 16) return; const m = t.match(NUM_RE); if (!m) return;
    const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; el.dataset.cu = 1;
    const ip = Number(m[2].replace(/[\s  ]/g, '')), dec = m[3] ? m[3].length - 1 : 0, to = ip + (m[3] ? Number('0.' + m[3].slice(1)) : 0); if (!isFinite(to) || to === 0) return;
    const t0 = performance.now(), dur = 900, fmt = v => m[1] + v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (m[4] || '');
    const step = now => { if (!el.isConnected) return; const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3); if (u < 1){ el.textContent = fmt(to * e); requestAnimationFrame(step); } else el.textContent = t; }; requestAnimationFrame(step); }); }
(function(){ const app = document.getElementById('app'); if (!app) return; let lp = null;
  new MutationObserver(() => { if (S.page === lp) return; lp = S.page; requestAnimationFrame(() => countUpIn(app)); }).observe(app, { childList: true });
  let tk = 0; addEventListener('scroll', () => { if (tk) return; tk = setTimeout(() => { tk = 0; requestAnimationFrame(() => countUpIn(app)); }, 300); }, { passive: true }); })();

/* 4. la mission réagit aux réponses : onde verte + éclat de points si c'est juste, lueur rouge si c'est faux */
function fxBurst(ok){ const host = $('#player'); if (!host) return;
  const o = document.createElement('div'); o.className = 'z-react ' + (ok ? 'ok' : 'ko'); o.setAttribute('aria-hidden', 'true'); host.appendChild(o); setTimeout(() => o.remove(), 1100);
  if (!ok) return; const fb = host.querySelector('.fb') || host.querySelector('.p-foot'); const r = fb ? fb.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight * 0.7, width: 0 };
  const cx = r.left + 36, cy = r.top + 18;
  for (let i = 0; i < 22; i++){ const d = document.createElement('i'); d.className = 'z-spark'; d.setAttribute('aria-hidden', 'true'); host.appendChild(d); const a = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 90;
    d.style.left = cx + 'px'; d.style.top = cy + 'px';
    d.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist - 20}px)) scale(.2)`, opacity: 0 }], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }).onfinish = () => d.remove(); } }
function fxTone(ok){ if (!S.sound || NT_FX.sound === false) return; try { const c = AC = AC || new (window.AudioContext || window.webkitAudioContext)(), t = c.currentTime, g = c.createGain(); g.connect(c.destination);
  const notes = ok ? [880, 1318.5] : [220, 196]; notes.forEach((f, i) => { const o = c.createOscillator(), og = c.createGain(); o.type = ok ? 'sine' : 'triangle'; o.frequency.value = f; const s0 = t + i * 0.09;
    og.gain.setValueAtTime(0.0001, s0); og.gain.exponentialRampToValueAtTime(ok ? 0.05 : 0.035, s0 + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, s0 + (ok ? 0.45 : 0.3)); o.connect(og).connect(g); o.start(s0); o.stop(s0 + 0.5); }); } catch(e){} }
const _v25Render = renderPlayer;
renderPlayer = function(){ const had = renderPlayer._fb; _v25Render(); const fb = M && !M.vid && !M.end ? M.fb : null; renderPlayer._fb = fb;
  if (fb && fb !== had){ if (FXON('mission')) fxBurst(!!fb.ok); fxTone(!!fb.ok); }
  /* cartes à glisser : chaque carte rangée réagit aussi */
  const last = M && !M.vid && !M.end && M.ui ? M.ui.last : null; if (last && last !== renderPlayer._last && !fb){ if (FXON('mission')) fxBurst(!!last.ok); fxTone(!!last.ok); } renderPlayer._last = last; };

/* 6. le site évolue avec ton niveau : plus tu progresses, plus les lumières bleues sont vives */
function fxLevel(){ if (NT_FX.level === false) return; const lvl = Math.max(0, Math.min(1, (S.score || 0) / 880)); document.documentElement.style.setProperty('--lvl', lvl.toFixed(3)); if (window.__ntLvl !== lvl){ window.__ntLvl = lvl; dispatchEvent(new Event('scroll')); } }
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(fxLevel).observe(app, { childList: true }); fxLevel(); })();

/* 9. sons discrets : un « tic » très doux sur les boutons (si « Sons et vibrations » est activé) */
addEventListener('pointerdown', ev => { if (!S.sound || NT_FX.sound === false) return; const b = ev.target.closest && ev.target.closest('button'); if (!b || b.closest('.zv')) return;
  try { const c = AC = AC || new (window.AudioContext || window.webkitAudioContext)(), t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.06); } catch(e){} }, { passive: true });


/* ============================================================
   V26 — LES VIDÉOS EXPLIQUENT TOUT CE QUI SERA DEMANDÉ (03/11/2026)
   - Chaque notion testée dans la mission est enseignée dans la vidéo,
     AVANT les questions (écrit à la main pour le chapitre 1, fabriqué à
     partir des explications des questions pour les autres missions).
   - Durée selon la mission : 25 à 45 secondes environ.
   - Plus animées : plusieurs dessins par phrase (ils changent au mot
     clé), la caméra avance doucement, les mots clés font pulser les points.
   ============================================================ */
Object.assign(ZSHAPE, {
  globe: 'M50 50 m-38 0 a38 38 0 1 0 76 0 a38 38 0 1 0 -76 0 M12 50 H88 M50 12 C30 30 30 70 50 88 M50 12 C70 30 70 70 50 88 M18 32 H82 M18 68 H82',
  piggy: 'M22 52 C22 34 40 26 56 28 C70 30 80 38 82 48 L90 46 L88 56 L82 58 C80 66 74 72 68 74 V84 H58 V77 H42 V84 H32 V72 C26 68 22 60 22 52 Z M44 28 L48 20 L56 28 M64 44 a2 2 0 1 0 0.1 0 M40 36 H54',
  arrows: 'M10 70 L30 50 L45 60 L62 34 L76 44 L90 24 M80 24 H90 V34 M10 88 H90',
});
ZMAP.unshift(['globe', /pays|monde|mondial|france|allemagne|japon|etats-unis|americain/], ['piggy', /tirelire|mettre de cote|livret/]);
/* scénarios écrits à la main : chapitre 1 (chaque phrase enseigne ce qu'une question va demander) */
Object.assign(ZSCRIPT, {
  'i-1': [
    { t: 'Épargner, c’est mettre de côté sans risque.', s: ['piggy'] },
    { t: 'Investir, c’est accepter que la valeur varie pour viser plus.', s: ['down', 'up'] },
    { t: 'Très rentable et sans risque à la fois ? Ça n’existe pas.', s: ['scale', 'warn'] },
    { t: 'Au programme : risque, inflation, intérêts composés, actions, obligations et indices.', s: ['pie', 'building'] } ],
  'm1-1': [
    { t: 'Besoin d’argent bientôt, comme le permis dans 6 mois ? Aucun risque : il reste sur un livret.', s: ['car', 'piggy'] },
    { t: 'Pas besoin avant 15 ans ? On peut accepter que ça varie pour viser plus.', s: ['clock', 'up'] },
    { t: 'L’imprévu, comme une voiture en panne : c’est l’épargne de précaution, disponible et sans risque.', s: ['car', 'shield'] },
    { t: 'Une action peut monter ou baisser : c’est un investissement.', s: ['building', 'arrows'] },
    { t: 'La précaution d’abord : elle évite de vendre tes placements au mauvais moment.', s: ['shield'] },
    { t: 'Investir, c’est accepter le risque pour un meilleur rendement. Rien n’est garanti.', s: ['scale', 'warn'] } ],
  'm1-2': [
    { t: 'Livret réglementé, compte à terme : capital garanti. C’est prudent.', s: ['piggy', 'shield'] },
    { t: 'L’action d’une petite entreprise peut varier très fortement : c’est risqué.', s: ['building', 'arrows'] },
    { t: 'Un ETF mondial est diversifié, mais investi en actions : il peut baisser.', s: ['globe', 'down'] },
    { t: '« 10 % par mois garantis » ? Promesse impossible : c’est une arnaque.', s: ['money', 'warn'] },
    { t: 'Règle d’or : rendement élevé et absence de risque ne vont jamais ensemble.', s: ['scale'] } ],
  'm1-3': [
    { t: 'Intérêts composés : tes gains produisent à leur tour des gains.', s: ['coins', 'up'] },
    { t: '1 000 € placés à 5 % par an doublent en 15 ans environ : 2 079 €.', s: ['money', 'up'] },
    { t: 'Règle de 72 : 72 divisé par le taux donne les années pour doubler. À 6 %, 12 ans.', s: ['clock', 'calendar'] },
    { t: 'Pour l’effet boule de neige : réinvestir et laisser le temps faire. Retraits et frais le freinent.', s: ['up', 'warn'] } ],
  'm1-4': [
    { t: 'L’inflation, c’est la hausse générale des prix.', s: ['money', 'up'] },
    { t: 'Avec 2 % par an pendant 10 ans, 1 000 € n’achètent plus que l’équivalent de 820 € d’aujourd’hui.', s: ['money', 'down'] },
    { t: 'Rendement réel : rendement moins inflation. 1 % moins 3 %, c’est −2 % : tu t’appauvris.', s: ['scale', 'down'] },
    { t: 'Un argent qui ne rapporte rien perd lentement de sa valeur.', s: ['piggy', 'down'] } ],
  'm1-5': [
    { t: 'Une action, c’est une part du capital d’une entreprise : tu en deviens copropriétaire.', s: ['building', 'pie'] },
    { t: 'Le dividende : une part du bénéfice versée aux actionnaires. Il n’est jamais garanti.', s: ['coins', 'warn'] },
    { t: 'Le cours, c’est le prix de l’action. Il bouge chaque jour selon l’offre et la demande.', s: ['arrows', 'scale'] } ],
  'm1-6': [
    { t: 'Une obligation, c’est un prêt à une entreprise ou à un État : l’émetteur.', s: ['building', 'money'] },
    { t: 'Tu touches des intérêts, le coupon, puis tu es remboursé à l’échéance.', s: ['coins', 'calendar'] },
    { t: 'Le risque principal : le défaut, l’emprunteur ne rembourse pas. Plus il est fragile, plus son taux est élevé.', s: ['warn', 'up'] },
    { t: 'Quand les taux montent, le prix des anciennes obligations baisse.', s: ['up', 'down'] } ],
  'm1-7': [
    { t: 'Tu passes un ordre, ton courtier le transmet au marché, il rencontre un vendeur, les titres arrivent sur ton compte.', s: ['target', 'building', 'coins'] },
    { t: 'Tu ne vas jamais toi-même en bourse : un courtier agréé fait l’intermédiaire.', s: ['shield'] },
    { t: 'Le CAC 40 : un indice qui suit 40 grandes entreprises cotées à Paris.', s: ['building', 'pie'] },
    { t: 'Être coté ne protège de rien : une entreprise peut faire faillite. D’où la diversification.', s: ['warn', 'pie'] } ],
  'm1-8': [
    { t: 'L’épargne de précaution : 3 à 6 mois de dépenses, à garder avant d’investir.', s: ['shield', 'calendar'] },
    { t: 'Exemple : 1 100 € de dépenses par mois, fois 3 mois, égale 3 300 €.', s: ['money'] },
    { t: 'Où la garder ? Sur un livret, disponible à tout moment et sans risque.', s: ['piggy'] },
    { t: 'Pas en actions, qui peuvent baisser, ni bloquée 5 ans : il faut pouvoir la prendre tout de suite.', s: ['down', 'clock'] } ],
  'm1-9': [
    { t: 'Rendement : le gain divisé par le prix de départ. De 50 € à 55 €, c’est +10 %.', s: ['money', 'up'] },
    { t: 'Une baisse se calcule pareil. De 55 € à 44 €, c’est −20 %.', s: ['down'] },
    { t: 'Piège : après −50 %, il faut +100 % pour revenir au point de départ.', s: ['down', 'warn'] } ],
  'm1-10': [
    { t: 'Chaque marché a son indice, comme un thermomètre.', s: ['globe'] },
    { t: 'CAC 40 : la France. DAX : l’Allemagne. S&P 500 : les États-Unis. Nikkei 225 : le Japon.', s: ['globe', 'pie'] },
    { t: 'Le S&P 500 suit environ 500 grandes entreprises américaines : c’est l’indice le plus suivi au monde.', s: ['building', 'globe'] },
    { t: 'Beaucoup d’ETF reproduisent ces indices.', s: ['pie'] } ],
  'm1-11': [
    { t: '50 € par mois à 4 % par an : après 14 ans environ, tu dépasses 10 000 €.', s: ['calendar', 'up'] },
    { t: 'Tu n’as versé que 8 400 € : le reste vient des intérêts composés.', s: ['coins', 'up'] },
    { t: 'Ce qui compte le plus quand on commence : commencer tôt et être régulier.', s: ['clock', 'calendar'] },
    { t: 'C’est un exemple simplifié : le taux n’est jamais garanti.', s: ['warn'] } ],
  'm1-12': [
    { t: 'La base : une épargne de précaution avant d’investir.', s: ['shield'] },
    { t: 'Une action peut perdre bien plus que 10 % : jusqu’à 100 % en cas de faillite.', s: ['building', 'down'] },
    { t: 'Jamais l’argent dont tu as besoin bientôt, comme le loyer du mois prochain.', s: ['house', 'warn'] },
    { t: 'Règle d’or : plus le rendement promis est élevé, plus le risque l’est aussi.', s: ['scale'] },
    { t: '+10 % puis −10 % ne s’annulent pas : on finit un peu en dessous du départ.', s: ['up', 'down'] },
    { t: 'Le facteur le plus puissant des intérêts composés : la durée.', s: ['clock'] } ],
});
/* fabrication automatique pour les autres missions : une scène par notion testée */
const firstSents = (t, max = 26) => { const ss = v18Sents(t); let out = ''; for (const x of ss){ const n = (out + ' ' + x).trim(); if (n.split(/\s+/).length > max && out) break; out = n; } return out || String(t || ''); };
function zNotions(m){ const L = [], add = t => { t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length > 6) L.push(t); };
  const shortQ = q => String(q || '').replace(/…$/, '').trim();
  (m.steps || []).forEach(st => { switch (st.type){
    case 'lesson': (st.cards || []).forEach(c => add(c.t)); break;
    case 'brief': add(st.text); break;
    case 'swipe': (st.cards || []).forEach(c => add(c.explain ? `${c.t} : ${firstSents(c.explain, 16)}` : '')); break;
    case 'qcm': { const q = shortQ(st.q), c = st.choices && st.choices[st.answer]; add(q.split(/\s+/).length <= 12 && c ? `${q} ${c}.`.replace(/\?\s/, ' ? ') : firstSents(st.explain)); break; }
    case 'vf': add(st.answer ? `${firstSents(st.q, 16)} ${firstSents(st.explain, 14)}` : `Faux : « ${firstSents(st.q, 14)} » ${firstSents(st.explain, 14)}`); break;
    case 'calc': add(`${firstSents(st.q, 16)} ${firstSents(st.explain, 14)}`); break;
    case 'order': add(`Dans l’ordre : ${st.items.join(', puis ')}.`); break;
    case 'match': add((st.pairs || []).map(p => `${p[0]} : ${p[1]}`).join('. ') + '.'); break;
    default: if (st.explain) add(firstSents(st.explain)); } });
  const seen = new Set(); return L.filter(t => { const k = norm(t).replace(/[^a-z0-9]+/g, '').slice(0, 30); if (seen.has(k)) return false; seen.add(k); return true; }); }
/* complément tiré de la fiche de cours, si la mission a peu de questions expliquées */
function zFill(m, have){ const f = ficheFor(m.id) || CO.find(x => x.ch === m.ch); if (!f) return []; const seen = new Set(have.map(t => norm(t).replace(/[^a-z0-9]+/g, '').slice(0, 30)));
  return [...f.body.flatMap(v18Sents), ...(f.key || []), ...(f.ex ? [f.ex] : [])].filter(t => { const k = norm(t).replace(/[^a-z0-9]+/g, '').slice(0, 30); if (seen.has(k)) return false; seen.add(k); return true; }); }
function zShapesFor(t, fb){ const n = norm(t), hits = []; for (const [k, re] of ZMAP){ const mm = n.match(re); if (mm) hits.push([mm.index, k]); } hits.sort((a, b) => a[0] - b[0]); const out = []; hits.forEach(([, k]) => { if (!out.includes(k) && out.length < 3) out.push(k); }); return out.length ? out : [fb || 'target']; }
vidScenes = zScenes = function(m){
  const L = (ZSCRIPT[m.id] || zNotions(m).map(t => ({ t }))).map(x => ({ t: x.t, s: x.s || (x.shape ? [x.shape] : zShapesFor(x.t)) }));
  const mk = x => { const w = zWords(x.t), times = []; let acc = 380; w.forEach(x2 => { times.push(acc); acc += zWordMs(x2); });
    /* les dessins changent au mot clé (sinon à intervalles réguliers) */
    const beats = [[0, x.s[0]]]; x.s.slice(1).forEach((sh, j) => { const re = (ZMAP.find(([k]) => k === sh) || [])[1]; let at = -1; if (re) at = w.findIndex((ww, i) => i > beats[beats.length - 1][0] && re.test(norm(ww))); if (at < 0) at = Math.round(w.length * (j + 1) / x.s.length); beats.push([at, sh]); });
    return { k: 'say', t: x.t, shape: x.s[0], beats: beats.map(([i, sh]) => [times[Math.min(i, times.length - 1)] || 0, sh]), words: w, times, ms: acc + 650 }; };
  let out = L.map(mk), tot = out.reduce((a, x) => a + x.ms, 0);
  /* moins de 25 s : on complète avec la fiche de cours (sans dépasser 45 s) */
  if (!ZSCRIPT[m.id] && tot < 25000) for (const t of zFill(m, L.map(x => x.t))){ const sc = mk({ t, s: zShapesFor(t) }); if (tot + sc.ms > 45000) break; out.push(sc); L.push({ t, s: zShapesFor(t) }); tot += sc.ms; if (tot >= 25000) break; }
  /* au-delà de 45 s : on raccourcit les phrases, puis on retire les notions déjà dites ailleurs */
  if (tot > 45000) out = L.map(x => mk({ t: firstSents(x.t, 14), s: x.s })); tot = out.reduce((a, x) => a + x.ms, 0);
  while (tot > 45000 && out.length > 3) tot -= out.splice(out.length - 2, 1)[0].ms;
  out.push({ k: 'go', t: 'À toi de jouer', shape: 'logo', beats: [[0, 'logo']], words: zWords('À toi de jouer'), times: [300, 520, 700, 900], ms: 2200 });
  return out; };
/* déroulé : mots au bon moment, dessins qui changent pendant la phrase, caméra qui avance */
vidNext = function(){ const V = M && M.vid; if (!V) return; clearTimeout(V.t); const s = V.sc[V.i], my = V.tok = (V.tok || 0) + 1;
  (V.wt || []).forEach(clearTimeout); const rm = RM();
  V.wt = s.times.map((ms, i) => setTimeout(() => { const w = document.querySelector(`.zv-t .zw[data-i="${i}"]`); if (w && !w.classList.contains('on')){ w.classList.add('on'); if (w.classList.contains('kw')){ zChime(); if (ZV && ZV.pulse) ZV.pulse(); } } }, rm ? 0 : ms));
  if (!rm) (s.beats || []).slice(1).forEach(([ms, sh]) => V.wt.push(setTimeout(() => { if (ZV) ZV.shape(sh, true); else ZFX.shape(sh); }, ms)));
  if (ZV && ZV.dolly) ZV.dolly(s.ms);
  V.t = setTimeout(() => { if (!M || M.vid !== V || V.tok !== my) return; if (V.i >= V.sc.length - 1) return vidEnd(); V.i++; renderVid(); vidNext(); }, s.ms); };
/* moteur 3D de la vidéo : changement doux dans la phrase, pulsation, travelling */
const _zv3 = zv3;
zv3 = function(canvas){ const A = _zv3(canvas); if (!A) return null; const P = A._P; const shape0 = A.shape;
  A.shape = (name, soft) => { if (!soft || !P) return shape0(name); const v = P.view(), w = Math.min(v.w * 0.8, v.h * 0.4), y = v.h * 0.12, n = Math.floor(P.N * 0.7);
    P.warp(0.22); P.morph(NTGL.pathPts(ZSHAPE[name] || ZSHAPE.target, n, { w, y, depth: 0.22 }), 950); };
  A.pulse = () => { if (P) P.warp(0.16); };
  A.dolly = ms => { if (P){ P.cz = 6.5; P.dolly(5.7, ms); } };
  return A; };

if (window.NT_DEBUG) NT_DEBUG.scenes = id => { const m = findMission(id); return m ? zScenes(m).map(x => ({ t: x.t, s: (x.beats || []).map(b => b[1]), ms: x.ms })) : null; };

/* ============================================================
   V27 — LA « PRISE » DES VRAIES DONNÉES (03/11/2026)
   Le site sait maintenant aller chercher, sur TON serveur, les vrais cours,
   les vraies courbes et les vraies actualités. Tant que le serveur ne les
   fournit pas (ou s'il renvoie quelque chose de faux), rien ne change :
   le site garde les données datées et sourcées actuelles. Il ne casse jamais.

   Adresses attendues (à créer plus tard dans api/, après validation de Thomas) :
     GET {base}/marche            → { asOf, delay: "live"|"15min"|"close", source: { name, url },
                                      quotes: [ { id, price, chg, cur } ] }
     GET {base}/historique?id=AAPL → { id, interval: "1d"|"15m", source: { name, url },
                                      bars: [ [ "2026-10-30", ouverture, haut, bas, clôture, volume ], … ] }
     GET {base}/news              → { asOf, source: { name, url },
                                      items: [ { title, date, source, url, ids: ["AAPL"] } ] }
   {base} = window.NT_FEED_BASE : à ajouter dans index.html (ex. window.NT_FEED_BASE = '/api') quand les routes existent.
   Aucune clé n'est dans le navigateur : c'est le serveur qui parle au fournisseur.
   Les données ne servent qu'à l'école (argent fictif) : jamais de conseil.
   ============================================================ */
const NT_FEED = window.NT_FEED = (() => {
  /* éteint tant que le serveur n'a pas ces routes : on l'allume en ajoutant window.NT_FEED_BASE = '/api' dans index.html (évite des erreurs 404 inutiles) */
  const base = typeof window.NT_FEED_BASE === 'string' && window.NT_FEED_BASE ? window.NT_FEED_BASE : null;
  const st = { base, quotes: null, news: null, hist: {}, last: null, err: null };
  const num = v => typeof v === 'number' && isFinite(v);
  const okDate = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) && !isNaN(Date.parse(d));
  async function get(path, ms = 6000){ if (!st.base) return null; const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(st.base + path, { signal: c.signal, headers: { Accept: 'application/json' }, cache: 'no-store' }); if (!r.ok) return null; const ct = r.headers.get('content-type') || ''; if (!/json/.test(ct)) return null; return await r.json(); }
    catch(e){ st.err = String(e && e.message || e); return null; } finally { clearTimeout(t); } }
  /* cours : seulement des valeurs déjà connues du site, avec un prix positif et une variation plausible */
  function applyQuotes(j){ if (!j || !Array.isArray(j.quotes)) return 0; const today = new Date().toISOString().slice(0, 10), delay = ['live', '15min', 'close'].includes(j.delay) ? j.delay : 'close';
    const srcName = j.source && typeof j.source.name === 'string' ? j.source.name.slice(0, 80) : 'Flux de cours';
    SRCM.live = { t: `${srcName}${delay === 'live' ? ' · en direct' : delay === '15min' ? ' · différé de 15 min' : ' · dernière clôture'}`, u: j.source && /^https:\/\//.test(j.source.url || '') ? j.source.url : '' };
    let n = 0; for (const q of j.quotes){ const s = q && mkFind(String(q.id || '')); if (!s || !num(q.price) || q.price <= 0 || (q.chg != null && (!num(q.chg) || Math.abs(q.chg) > 60))) continue;
      if (q.cur && q.cur !== s.cur) continue; s.price = q.price; s.chg = q.chg ?? s.chg; s.date = okDate(q.date) ? q.date.slice(0, 10) : today; s.src = 'live'; s.live = delay;
      delete ANCH[s.id]; Object.keys(PX).forEach(k => { if (k.startsWith(s.id + ':')) delete PX[k]; }); n++; }
    st.quotes = n ? { n, asOf: j.asOf || null, delay } : null; return n; }
  /* historique : barres datées, dans l'ordre, prix positifs */
  function applyHist(id, j){ if (!j || !Array.isArray(j.bars)) return false; const bars = j.bars.filter(b => Array.isArray(b) && okDate(String(b[0])) && [1, 2, 3, 4].every(i => num(b[i]) && b[i] > 0) && b[2] >= b[3]);
    if (bars.length < 2) return false; bars.sort((a, b) => Date.parse(a[0]) - Date.parse(b[0])); st.hist[id] = { bars, interval: j.interval || '1d', source: j.source && j.source.name ? String(j.source.name).slice(0, 80) : '' }; return true; }
  function applyNews(j){ if (!j || !Array.isArray(j.items)) return 0;
    const items = j.items.filter(x => x && typeof x.title === 'string' && x.title.length > 3 && okDate(String(x.date || '')) && /^https:\/\//.test(x.url || '')).slice(0, 30)
      .map(x => ({ title: x.title.slice(0, 160), date: String(x.date), source: String(x.source || (j.source && j.source.name) || '').slice(0, 60), url: x.url, ids: Array.isArray(x.ids) ? x.ids.map(String).slice(0, 5) : [] }));
    st.news = items.length ? { items, asOf: j.asOf || null } : null; return items.length; }
  async function refresh(){ if (!st.base) return; const [m, n] = await Promise.all([get('/marche'), get('/news')]); const a = applyQuotes(m), b = applyNews(n); st.last = Date.now();
    if ((a || b) && !M) render(); }
  async function history(id){ if (!st.base || st.hist[id] !== undefined) return st.hist[id] || null; st.hist[id] = null; const j = await get('/historique?id=' + encodeURIComponent(id)); if (applyHist(id, j) && !M) render(); return st.hist[id]; }
  return { st, refresh, history, applyQuotes, applyNews, applyHist };
})();
/* les courbes utilisent le vrai historique quand il existe (sinon : comme avant) */
const _series = series;
series = function(id){ const s = mkFind(id), H = s && NT_FEED.st.hist[s.id]; if (H && H.bars.length > 1){ const v = H.bars.map(b => b[4]); if (s.live && v[v.length - 1] !== s.price) v.push(s.price); return v; } return _series(id); };
/* étiquette : « en direct » / « différé 15 min » quand le cours vient du flux */
const _priceTag = priceTag;
priceTag = s => s && s.live ? `<span class="realtag sm">${s.live === 'live' ? 'en direct' : s.live === '15min' ? 'différé 15 min' : 'clôture · ' + dateFr(s.date).slice(0, 5)}</span>` : _priceTag(s);
/* fiche d'une valeur : on demande son historique en arrivant dessus */
(function(){ const app = document.getElementById('app'); if (!app) return; new MutationObserver(() => { if (S.page === 'stock'){ const s = mkFind(S.arg) || MK[0]; if (s) NT_FEED.history(s.id); } liveNews(); }).observe(app, { childList: true }); })();
/* actualités en direct : un bloc en plus dans Marchés (les nouvelles datées restent) */
function liveNews(){ const N = NT_FEED.st.news; if (!N || S.page !== 'markets') return; const w = document.querySelector('#app .wrap'); if (!w || w.querySelector('.live-news')) return;
  const sec = document.createElement('section'); sec.className = 'o-sec live-news';
  sec.innerHTML = `<div class="o-sec-h"><h2>Nova News · en direct</h2></div><div class="o-card" style="padding:6px 16px">${N.items.slice(0, 8).map(x => `<a class="ln-row" href="${h(x.url)}" target="_blank" rel="noopener noreferrer"><b>${h(x.title)}</b><small>${h(x.source)} · ${h(dateFr(x.date.slice(0, 10)))}${x.ids.length ? ' · ' + h(x.ids.join(', ')) : ''}</small></a>`).join('')}</div><p class="note">Actualités d’un fournisseur sous licence, pour apprendre à lire le marché. Ce ne sont pas des conseils.</p>`;
  const first = w.querySelector('.o-sec, .sec'); if (first && first.nextSibling) w.insertBefore(sec, first.nextSibling); else w.appendChild(sec); }
/* au démarrage puis toutes les 5 minutes (seulement si la page est visible) */
if (NT_FEED.st.base){ setTimeout(() => NT_FEED.refresh(), 1200); setInterval(() => { if (!document.hidden) NT_FEED.refresh(); }, 5 * 60 * 1000); }


/* ============================================================
   V28 — NOUVEL ACCUEIL « VIVANT » (03/11/2026)
   Tout le contenu et tous les boutons d'avant sont gardés (mêmes fonctions,
   mêmes data-*), ainsi que le temple et ses animations. Nouveautés :
   1. salutation qui s'écrit lettre par lettre + date + état de la Bourse de Paris ;
   2. « Ta journée » : 3 anneaux qui se remplissent (objectif, série, score) ;
   3. les 3 grandes cartes Nova en perspective (carrousel 3D) avec bordure lumineuse ;
   4. bandeau des cours qui défile (valeurs suivies + populaires), étiquetées réel / simulé ;
   5. liste Nova News / Event / Jeux en verre, avec icônes qui brillent ;
   6. sur ordinateur : halo qui suit la souris et boutons « magnétiques ».
   Interrupteur : NT_FX.home = false → accueil d'avant.
   ============================================================ */
NT_FX.home = NT_FX.home !== false;
const PARIS_OPEN = () => { const f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()), g = k => (f.find(x => x.type === k) || {}).value || '';
  const wd = g('weekday').toLowerCase(), hm = Number(g('hour')) * 60 + Number(g('minute')); const open = !/sam|dim/.test(wd) && hm >= 540 && hm < 1050; return open; };
const hLetters = t => [...String(t)].map((c, i) => c === ' ' ? ' ' : `<span class="h-l" style="--i:${i}">${h(c)}</span>`).join('');
function hRing(val, max, label, sub, cls){ const C = 2 * Math.PI * 34, p = Math.max(0, Math.min(1, max ? val / max : 0));
  return `<div class="h-ring ${cls || ''}"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="h-trk"/><circle cx="40" cy="40" r="34" class="h-arc" style="--c:${C.toFixed(1)};--o:${(C * (1 - p)).toFixed(1)}"/></svg>
    <div class="h-rv"><b class="tn">${val}</b><small>${h(sub)}</small></div><span class="h-rl">${h(label)}</span></div>`; }
function hDay(){ const { r, nx } = rankOf(S.score), tc = todayCount(), goal = DAILY_GOAL, st = S.streak || 0, hi = nx ? nx.min : Math.max(S.score, 1);
  return `<section class="h-day" aria-label="Ta journée">${hRing(Math.min(tc, goal), goal, 'Objectif du jour', tc >= goal ? 'fait' : 'à faire', 'g1')}${hRing(st, Math.max(7, st), 'Série', st > 1 ? 'jours' : 'jour', 'g2')}${hRing(S.score, hi, r.name, 'pts', 'g3')}</section>`; }
function hTape(){ const ids = [...new Set([...WATCH(), ...POP.actions, ...POP.paris.slice(0, 4), ...POP.etf.slice(0, 3)])], L = ids.map(mkFind).filter(Boolean); if (!L.length) return '';
  const one = L.map(s => { const v = chg(s); return `<button class="h-tk" data-stock="${s.id}" tabindex="-1"><b>${h(s.id)}</b><span class="tn">${money(s, px(s))}</span><span class="tn ${v == null ? '' : v >= 0 ? 'up' : 'down'}">${v == null ? '' : (v >= 0 ? '▲ ' : '▼ ') + num(Math.abs(v), 2) + ' %'}</span></button>`; }).join('');
  const sim = L.some(isSim);
  return `<section class="h-tape" aria-label="Cours des valeurs"><div class="h-tape-in"><div class="h-half">${one}</div><div class="h-half" aria-hidden="true">${one}</div></div></section><p class="h-tape-note">${sim ? 'Cours réels relevés le 30/10/2026, puis évolution simulée' : 'Cours réels'} · argent fictif</p>`; }
const _homeV27 = PAGES.home;
PAGES.home = () => { if (!NT_FX.home) return _homeV27();
  const name = (S.name || '').split(' ')[0], ws = WATCH().map(mkFind).filter(Boolean), tab = OSEG.pop || 'actions', c = CAR(), d = RD.DAYS[c.n], ev = d && RD.ev(d.decide), ep = epreuveDuJour();
  const dt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), open = PARIS_OPEN();
  return `<div class="wrap o-root-page h-home">${oTop()}
  ${temple()}
  <div class="o-quick h-quick">
    <button data-osearch><span class="o-ring">${OI.search}</span>Rechercher</button>
    <button data-go="coach"><span class="o-ring">${OI.rook}</span>Coach IA</button>
    <button data-go="jeux"><span class="o-ring">${IC2.game}</span>Jeux</button>
    <button data-go="carte"><span class="o-ring">${IC2.map}</span>Parcours</button>
  </div>
  <header class="o-hello h-hello"><p class="h-date"><span class="h-dot ${open ? 'on' : ''}"></span>${h(dt.charAt(0).toUpperCase() + dt.slice(1))} · Bourse de Paris ${open ? 'ouverte' : 'fermée'}</p>
    <h1 aria-label="${h(greet() + (name ? ' ' + name : ''))}">${hLetters(greet())}${name ? ' <span class="h-name">' + hLetters(name) + '</span>' : ''}</h1><p>Voici ton entraînement du jour.</p></header>
  ${hDay()}
  ${stuckCard()}
  <section class="o-sec h-cf-sec"><div class="o-rail h-cf" data-orail="heroDots">${heroMission()}${heroCoach()}${heroReviewSchool()}</div><div class="o-dots" id="heroDots"><i class="o-on"></i><i></i><i></i></div></section>
  ${hTape()}
  <section class="o-sec o-card o-mini h-glass" style="padding:6px 18px">
    <button class="o-mini-row" data-career><span class="o-chess" style="background:#2e3a7a">${OI.bishop}</span><span class="o-t" style="text-align:left"><b>Nova News · journée de trader</b><span>${careerReady() && ev ? h(ev.co + ' : ' + ev.head) : c.n >= RD.DAYS.length ? 'Semaine réelle terminée' : 'Prochaine journée demain'}</span></span>${OI.chev}</button>
    ${ep ? `<button class="o-mini-row" data-epreuve="${ep.id}"><span class="o-chess" style="background:#1f4a6b">${OI.pawn}</span><span class="o-t" style="text-align:left"><b>Nova Event · épreuve du jour</b><span>${h(ep.t)}</span></span>${OI.chev}</button>` : ''}
    <button class="o-mini-row" data-go="jeux"><span class="o-chess" style="background:#4a2a6b">${OI.queen || OI.knight}</span><span class="o-t" style="text-align:left"><b>Nova Jeux</b><span>Hausse ou baisse, calcul flash, arnaque ou pas : 45 secondes</span></span>${OI.chev}</button>
  </section>
  ${defisHTML()}
  ${levelTestCard()}${extraQuestion()}${trialBanner()}
  <section class="o-sec"><div class="o-sec-h h-sh"><h2>Ma liste</h2><button class="o-link" data-go="markets">Tout voir ${OI.chev}</button></div>
    <div class="o-card" style="padding:8px 18px 18px">${ws.length ? ws.slice(0, 5).map(s => oRow(s, { spark: true })).join('') : `<p class="o-sub" style="padding:12px 0 0">Touche l’étoile sur une valeur pour la suivre ici.</p>`}</div></section>
  <section class="o-sec"><div class="o-sec-h h-sh"><h2>Les plus populaires</h2><button class="o-link" data-go="markets">Marchés ${OI.chev}</button></div>
    <div class="o-card">${oSeg('pop', [['actions', 'Actions'], ['paris', 'Paris'], ['etf', 'ETF']], tab)}<div class="o-grid4">${oTiles(POP[tab].map(mkFind).filter(Boolean))}</div></div></section>
  ${rewardCard()}
  ${!S.premium && !minorMode() ? offerHome() : ''}
  ${legal()}
  </div>${dock()}`; };
/* carrousel en perspective : la carte du centre est droite et grande, les autres tournent et reculent */
function hCoverflow(){ const r = document.querySelector('.h-cf'); if (!r || r.dataset.cf) return; r.dataset.cf = 1; let raf = 0;
  const upd = () => { raf = 0; const rr = r.getBoundingClientRect(), cx = rr.left + rr.width / 2; [...r.children].forEach(el => { const b = el.getBoundingClientRect(), d = Math.max(-1, Math.min(1, (b.left + b.width / 2 - cx) / b.width));
      el.style.transform = RM() ? '' : `perspective(1000px) rotateY(${(-d * 16).toFixed(2)}deg) scale(${(1 - Math.abs(d) * 0.09).toFixed(3)})`; el.style.opacity = (1 - Math.abs(d) * 0.35).toFixed(3); el.classList.toggle('h-on', Math.abs(d) < 0.3); }); };
  r.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); addEventListener('resize', upd); upd(); }
/* halo qui suit la souris (ordinateur) + boutons magnétiques */
const HALO = (() => { let el = null; return { on(){ if (el || RM() || !matchMedia('(pointer:fine)').matches) return; el = document.createElement('div'); el.className = 'h-halo'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); },
  move(x, y){ if (el) el.style.transform = `translate3d(${x - 300}px,${y - 300}px,0)`; }, show(v){ if (el) el.style.opacity = v ? '1' : '0'; } }; })();
addEventListener('pointermove', ev => { if (ev.pointerType !== 'mouse' || S.page !== 'home' || !NT_FX.home || M) return; HALO.on(); HALO.move(ev.clientX, ev.clientY);
  const b = ev.target.closest && ev.target.closest('.h-home .o-bot-links button, .h-home .o-cta, .h-home .o-quick button'); document.querySelectorAll('.h-mag').forEach(x => { if (x !== b){ x.style.transform = ''; x.classList.remove('h-mag'); } });
  if (b && !RM()){ const r = b.getBoundingClientRect(), dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2); b.classList.add('h-mag'); b.style.transform = `translate(${(dx * 0.18).toFixed(1)}px,${(dy * 0.25).toFixed(1)}px)`; } }, { passive: true });
(function(){ const app = document.getElementById('app'); if (!app) return; new MutationObserver(() => { const home = S.page === 'home' && NT_FX.home; HALO.show(home); if (home) hCoverflow(); }).observe(app, { childList: true }); })();




/* ============================================================
   V29 — ACCUEIL IMMERSIF (03/11/2026, inspiré des sites « 2026 »)
   - Trois scènes plein écran qui restent en place pendant qu'on descend :
     « Ta prochaine mission », « Les marchés », « Nova Coach ».
   - Un objet de points lumineux en 3D, derrière, se transforme selon la
     scène : une cible, la vraie courbe d'une valeur en ruban 3D, une sphère.
   - Typographie géante dont les mots arrivent avec le défilement ; lignes
     de cours géantes qui glissent en sens inverse.
   - Le temple, ses animations et tout le contenu restent (mêmes boutons).
   Interrupteur : NT_FX.immersive = false → accueil V28.
   ============================================================ */
NT_FX.immersive = NT_FX.immersive !== false;
const hsWords = t => String(t).split(/ +/).map((w, i) => `<span class="hs-w" style="--i:${i}">${h(w)}</span>`).join(' ');
function hsMission(){ const L = defis(), nx = L.find(x => !x.done), done = L.filter(x => x.done).length, fresh = !Object.keys(S.done).length && !(S.sessDone && Object.keys(S.sessDone).length), fm = fresh && nextMission();
  const t = fm ? fm.title : nx ? nx.t : 'Défis du jour terminés', attr = fm ? `data-play="${fm.id}"` : nx ? nx.attr : 'data-go="carte"';
  return `<section class="hs" data-hs="mission"><div class="hs-pin">
    <p class="hs-eb"><span class="hs-dot"></span>Ta prochaine mission · ${done}/${L.length} défis</p>
    <h2 class="hs-big">${hsWords(t)}</h2>
    <p class="hs-sub">${fm ? 'Un cours vidéo qui t’explique tout ce qui sera demandé, puis la mission.' : nx ? h(nx.s) : 'Bravo. Reviens demain pour la suite.'}</p>
    <div class="hs-cta"><button class="hs-btn" ${attr}><span>${fm ? 'Lancer mon parcours' : 'Continuer'}</span>${OI.arrowr}</button><button class="hs-btn2" data-go="carte">Mon parcours</button></div></div></section>`; }
function hsMarket(){ const ids = [...new Set([...WATCH(), ...POP.actions, ...POP.paris])], L = ids.map(mkFind).filter(Boolean); if (!L.length) return '';
  const tk = s => { const v = chg(s); return `<span class="hs-tk"><b>${h(s.id)}</b> ${money(s, px(s))} <i class="${v == null ? '' : v >= 0 ? 'up' : 'down'}">${v == null ? '' : (v >= 0 ? '▲' : '▼') + ' ' + num(Math.abs(v), 2) + ' %'}</i></span>`; };
  const half = Math.ceil(L.length / 2), r1 = L.slice(0, half).map(tk).join(''), r2 = L.slice(half).map(tk).join(''), sim = L.some(isSim);
  return `<section class="hs" data-hs="market"><div class="hs-pin">
    <p class="hs-eb"><span class="hs-dot b"></span>Les marchés · vraies valeurs, argent fictif</p>
    <div class="hs-rows" aria-hidden="true"><div class="hs-row r1">${r1}${r1}</div><div class="hs-row r2">${r2}${r2}</div></div>
    <h2 class="hs-big sm">${hsWords('Entraîne-toi sur de vraies valeurs.')}</h2>
    <p class="hs-sub">${sim ? 'Cours réels relevés le 30/10/2026, puis évolution simulée.' : 'Cours réels.'} Aucun ordre réel, aucun conseil.</p>
    <div class="hs-cta"><button class="hs-btn" data-go="markets"><span>Entrer en salle de marché</span>${OI.arrowr}</button></div></div></section>`; }
function hsCoach(){ return `<section class="hs" data-hs="coach"><div class="hs-pin">
    <p class="hs-eb"><span class="hs-dot v"></span>Nova Coach ${aiOn() ? '· IA' : '· prêt'}</p>
    <h2 class="hs-big sm">${hsWords('Une question\u00a0? Il t’explique.')}</h2>
    <p class="hs-sub">Une notion, une valeur, une question de mission. Jamais de conseil d’achat.</p>
    <div class="o-sugg hs-sugg">${['C’est quoi un ETF ?', 'Explique-moi le PER'].map(q => `<button type="button" data-askhome="${h(q)}">${h(q)}</button>`).join('')}</div>
    <form class="o-ask hs-ask" id="askF"><label class="sr" for="askIn">Écris à Nova Coach</label><input id="askIn" placeholder="Écris à Nova…" autocomplete="off"><button class="o-send" aria-label="Envoyer">${OI.up}</button></form></div></section>`; }
const _homeV28 = PAGES.home;
PAGES.home = () => { if (!NT_FX.immersive || !NT_FX.home) return _homeV28();
  const name = (S.name || '').split(' ')[0], ws = WATCH().map(mkFind).filter(Boolean), tab = OSEG.pop || 'actions', c = CAR(), d = RD.DAYS[c.n], ev = d && RD.ev(d.decide), ep = epreuveDuJour();
  const dt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), open = PARIS_OPEN();
  return `<div class="wrap o-root-page h-home hs-home">${oTop()}
  ${temple()}
  <div class="o-quick h-quick">
    <button data-osearch><span class="o-ring">${OI.search}</span>Rechercher</button>
    <button data-go="coach"><span class="o-ring">${OI.rook}</span>Coach IA</button>
    <button data-go="jeux"><span class="o-ring">${IC2.game}</span>Jeux</button>
    <button data-go="carte"><span class="o-ring">${IC2.map}</span>Parcours</button>
  </div>
  <header class="o-hello h-hello"><p class="h-date"><span class="h-dot ${open ? 'on' : ''}"></span>${h(dt.charAt(0).toUpperCase() + dt.slice(1))} · Bourse de Paris ${open ? 'ouverte' : 'fermée'}</p>
    <h1 aria-label="${h(greet() + (name ? ' ' + name : ''))}">${hLetters(greet())}${name ? ' <span class="h-name">' + hLetters(name) + '</span>' : ''}</h1><p>Voici ton entraînement du jour.</p></header>
  ${hDay()}
  ${stuckCard()}
  ${hsMission()}
  ${hsMarket()}
  ${hsCoach()}
  <section class="o-sec hs-rev">${heroReviewSchool()}</section>
  <section class="o-sec o-card o-mini h-glass" style="padding:6px 18px">
    <button class="o-mini-row" data-career><span class="o-chess" style="background:#2e3a7a">${OI.bishop}</span><span class="o-t" style="text-align:left"><b>Nova News · journée de trader</b><span>${careerReady() && ev ? h(ev.co + ' : ' + ev.head) : c.n >= RD.DAYS.length ? 'Semaine réelle terminée' : 'Prochaine journée demain'}</span></span>${OI.chev}</button>
    ${ep ? `<button class="o-mini-row" data-epreuve="${ep.id}"><span class="o-chess" style="background:#1f4a6b">${OI.pawn}</span><span class="o-t" style="text-align:left"><b>Nova Event · épreuve du jour</b><span>${h(ep.t)}</span></span>${OI.chev}</button>` : ''}
    <button class="o-mini-row" data-go="jeux"><span class="o-chess" style="background:#4a2a6b">${OI.queen || OI.knight}</span><span class="o-t" style="text-align:left"><b>Nova Jeux</b><span>Hausse ou baisse, calcul flash, arnaque ou pas : 45 secondes</span></span>${OI.chev}</button>
  </section>
  ${defisHTML()}
  ${levelTestCard()}${extraQuestion()}${trialBanner()}
  <section class="o-sec"><div class="o-sec-h h-sh"><h2>Ma liste</h2><button class="o-link" data-go="markets">Tout voir ${OI.chev}</button></div>
    <div class="o-card" style="padding:8px 18px 18px">${ws.length ? ws.slice(0, 5).map(s => oRow(s, { spark: true })).join('') : `<p class="o-sub" style="padding:12px 0 0">Touche l’étoile sur une valeur pour la suivre ici.</p>`}</div></section>
  <section class="o-sec"><div class="o-sec-h h-sh"><h2>Les plus populaires</h2><button class="o-link" data-go="markets">Marchés ${OI.chev}</button></div>
    <div class="o-card">${oSeg('pop', [['actions', 'Actions'], ['paris', 'Paris'], ['etf', 'ETF']], tab)}<div class="o-grid4">${oTiles(POP[tab].map(mkFind).filter(Boolean))}</div></div></section>
  ${rewardCard()}
  ${!S.premium && !minorMode() ? offerHome() : ''}
  ${legal()}
  </div>${dock()}`; };

/* ---------- scène 3D de l'accueil : un seul canvas fixe, piloté par le défilement ---------- */
const HS = { P: null, cv: null, cur: null, vis: 0, raf: 0 };
function hsPts(kind){ const P = HS.P, v = P.view(), n = Math.floor(P.N * 0.85), y = v.h * 0.22, w = Math.min(v.w * 0.8, v.h * 0.36);
  if (kind === 'coach'){ const out = [], R = w * 0.5; for (let i = 0; i < n; i++){ const u = Math.random() * 2 - 1, a = Math.random() * 6.283, rr = R * (0.96 + Math.random() * 0.08), sq = Math.sqrt(1 - u * u); out.push([Math.cos(a) * sq * rr, y + u * rr, Math.sin(a) * sq * rr]); } return out; }
  if (kind === 'market'){ const s = mkFind(WATCH()[0]) || MK[0], vals = series(s.id).slice(-60), use = vals.length > 4 ? vals : Array.from({ length: 40 }, (_, i) => 1 + Math.sin(i / 5) * 0.08 + i * 0.006);
    const mn = Math.min(...use), mx = Math.max(...use), out = [], L = use.length; for (let i = 0; i < n; i++){ const u = Math.random() * (L - 1), k = Math.floor(u), f = u - k, val = use[k] + (use[Math.min(L - 1, k + 1)] - use[k]) * f, yy = (val - mn) / (mx - mn || 1);
      const z = (Math.random() - 0.5) * w * 0.55, fall = Math.random() < 0.35 ? Math.random() : 0; out.push([(u / (L - 1) - 0.5) * w * 1.25, y - w * 0.25 + yy * w * 0.5 - fall * yy * w * 0.5, z]); } return out; }
  return NTGL.pathPts(ZSHAPE.target, n, { w, y, depth: 0.25 }); }
function hsMount(){ if (!GL_OK() || !NT_FX.immersive || S.page !== 'home' || !document.querySelector('.hs')) { if (HS.cv) HS.cv.style.opacity = '0'; return; }
  if (!HS.cv){ HS.cv = document.createElement('canvas'); HS.cv.className = 'hs-gl'; HS.cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(HS.cv);
    try { HS.P = new NTGL.Particles(HS.cv, { stars: false, camZ: 6, spread: 3.4, sway: 0.25, camSway: 0.6, pauseIf: () => HS.vis < 0.02 || !!document.getElementById('player') || S.page !== 'home' }); glTint(HS.P, { c1: '#ffffff', c2: '#d9d0ff', c3: '#a9c4ff' }); HS.P.u.uScale.value = 17; }
    catch(e){ HS.cv.remove(); HS.cv = null; return; } }
  hsScroll(); }
function hsScroll(){ if (HS.raf) return; HS.raf = requestAnimationFrame(() => { HS.raf = 0; const secs = [...document.querySelectorAll('.hs')]; if (!secs.length) return; let best = null, bv = 0;
    secs.forEach(sec => { const r = sec.getBoundingClientRect(), H = innerHeight, e = Math.max(0, Math.min(1, (H - r.top) / H)), p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - H)));
      sec.style.setProperty('--e', e.toFixed(3)); sec.style.setProperty('--p', p.toFixed(3));
      const vis = Math.min(e, 1 - Math.max(0, (p - 0.8) / 0.2)); if (vis > bv){ bv = vis; best = { sec, p, e }; } });
    HS.vis = bv; if (!HS.P) return; HS.cv.style.opacity = Math.min(1, bv * 1.25).toFixed(3);
    if (best){ const k = best.sec.dataset.hs; if (k !== HS.cur && bv > 0.25){ HS.cur = k; HS.P.warp(0.7); HS.P.morph(hsPts(k), 1500); } HS.P.pointer((best.p - 0.5) * 1.8, 0); HS.P.last = 0; } }); }
addEventListener('scroll', () => { if (S.page === 'home' && HS.cv) hsScroll(); }, { passive: true });
addEventListener('resize', () => { if (HS.P && HS.cur){ const k = HS.cur; HS.cur = null; hsScroll(); } }, { passive: true });
(function(){ const app = document.getElementById('app'); if (!app) return; new MutationObserver(() => { if (S.page !== 'home'){ if (HS.cv) HS.cv.style.opacity = '0'; HS.vis = 0; HS.cur = null; return; } hsMount(); }).observe(app, { childList: true }); })();


/* ============================================================
   V31 — OBJETS 3D « WAOUH » + MANIFESTE (03/11/2026)
   Les objets de l'accueil immersif deviennent de vrais volumes, denses et
   lumineux, qui bougent :
   - Mission : une fusée inclinée, sa flamme coule en continu ;
   - Marchés : une ville de barres 3D construite avec les VRAIES variations
     affichées (au-dessus du sol si ça monte, en dessous si ça baisse) ;
   - Coach : un noyau lumineux entouré de trois orbites.
   Et un manifeste dont les mots s'allument un à un quand on fait défiler.
   Interrupteur : NT_FX.objects = false → objets V29.
   ============================================================ */
NT_FX.objects = NT_FX.objects !== false;
const R3 = () => Math.random();
function rot2(p, a){ const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2], p[3] || 0]; }
function genRocket(n, w, y){ const H = w * 1.5, r = w * 0.17, out = [], tilt = -0.5, J = () => (R3() - 0.5) * w * 0.006;
  const add = (x, yy, z, f) => out.push(rot2([x + J(), yy + J(), z + J(), f], tilt));
  for (let i = 0; i < n; i++){ const k = R3(), a = R3() * 6.283;
    if (k < 0.38){ const yy = -0.30 * H + R3() * 0.52 * H; add(Math.cos(a) * r, yy, Math.sin(a) * r); }
    else if (k < 0.52){ const u = Math.pow(R3(), 0.8), rr = r * Math.cos(u * Math.PI / 2); add(Math.cos(a) * rr, 0.22 * H + u * 0.28 * H, Math.sin(a) * rr); }
    else if (k < 0.64){ const f = Math.floor(R3() * 4) * Math.PI / 2 + Math.PI / 4, v = R3(), d = r + R3() * 0.16 * w * (1 - v); add(Math.cos(f) * d, -0.30 * H + v * 0.2 * H, Math.sin(f) * d); }
    else if (k < 0.69){ const u = R3(), rr = r * (0.6 + 0.2 * u); add(Math.cos(a) * rr, -0.30 * H - u * 0.06 * H, Math.sin(a) * rr); }
    else if (k < 0.73){ const rr = r * 0.34; add(Math.cos(a) * rr, 0.1 * H + Math.sin(a) * rr, r * 0.98); }
    else { const rr = r * 0.55 * Math.sqrt(R3()); add(Math.cos(a) * rr, -0.36 * H, Math.sin(a) * rr, 1); } }
  out.forEach(p => { p[1] += y; }); return { pts: out, opts: { flow: { dir: [Math.sin(tilt), -Math.cos(tilt), 0], len: H * 0.85, speed: 0.9 }, spin: 0.22, tint: ['#ffffff', '#8fb4ff', '#c4b5ff'] } }; }
function genBars(n, w, y){ const ids = [...new Set([...WATCH(), ...POP.actions, ...POP.paris])].map(mkFind).filter(Boolean).slice(0, 9), vals = ids.map(s => chg(s) || 0);
  const mx = Math.max(0.5, ...vals.map(Math.abs)), cols = 3, sp = w / 2.6, b = sp * 0.42, out = [], y0 = y - w * 0.1;
  const bars = ids.map((s, i) => ({ x: (i % cols - 1) * sp, z: (Math.floor(i / cols) - 1) * sp, h: (0.14 + 0.75 * Math.abs(vals[i]) / mx) * w * (vals[i] >= 0 ? 0.9 : -0.55) }));
  for (let i = 0; i < n; i++){ const k = R3();
    if (k < 0.14){ const g = Math.floor(R3() * 7), t = (R3() - 0.5) * sp * 3.4, c = (g / 6 - 0.5) * sp * 3.4; out.push(R3() < 0.5 ? [t, y0, c] : [c, y0, t]); continue; }
    const B = bars[Math.floor(R3() * bars.length)] || { x: 0, z: 0, h: w * 0.3 }, hb = b / 2, y1 = y0 + B.h, u = R3() - 0.5, v2 = R3();
    if (R3() < 0.35){ /* arêtes */ const e = Math.floor(R3() * 12), sx = [-1, 1];
      out.push(e < 4 ? [B.x + sx[e & 1] * hb, y0 + (y1 - y0) * v2, B.z + sx[e >> 1] * hb] : e < 8 ? [B.x + u * b, (e & 1 ? y1 : y0), B.z + sx[(e >> 1) & 1] * hb] : [B.x + sx[e & 1] * hb, (e & 2 ? y1 : y0), B.z + u * b]); }
    else { /* faces : 4 côtés + dessus */ const f = Math.floor(R3() * 5); const yy = y0 + (y1 - y0) * v2;
      out.push(f === 0 ? [B.x - hb, yy, B.z + u * b] : f === 1 ? [B.x + hb, yy, B.z + u * b] : f === 2 ? [B.x + u * b, yy, B.z - hb] : f === 3 ? [B.x + u * b, yy, B.z + hb] : [B.x + u * b, y1, B.z + (R3() - 0.5) * b]); } }
  return { pts: out, opts: { spin: 0.16, tint: ['#eef1ff', '#5b8cff', '#c4b5ff'] } }; }
function genOrb(n, w, y){ const R = w * 0.3, out = [];
  for (let i = 0; i < n; i++){ const k = R3();
    if (k < 0.45){ const u = R3() * 2 - 1, a = R3() * 6.283, q = Math.sqrt(1 - u * u), rr = R * (0.97 + R3() * 0.06); out.push([Math.cos(a) * q * rr, y + u * rr, Math.sin(a) * q * rr]); }
    else if (k < 0.58){ const u = R3() * 2 - 1, a = R3() * 6.283, q = Math.sqrt(1 - u * u), rr = R * 0.35 * Math.cbrt(R3()); out.push([Math.cos(a) * q * rr, y + u * rr, Math.sin(a) * q * rr]); }
    else { const ring = Math.floor(R3() * 3), a = R3() * 6.283, rr = R * (1.55 + ring * 0.28), tilt = [0.5, -0.8, 1.25][ring], p = [Math.cos(a) * rr, Math.sin(a) * rr * 0.28, Math.sin(a) * rr];
      const c = Math.cos(tilt), s2 = Math.sin(tilt); out.push([p[0], y + p[1] * c - p[2] * s2, p[1] * s2 + p[2] * c]); } }
  return { pts: out, opts: { spin: 0.32, tint: ['#ffffff', '#c4b5ff', '#8fb4ff'] } }; }
const _hsPts = hsPts;
hsPts = function(kind){ if (!NT_FX.objects || !HS.P) { HS.lastOpts = null; return _hsPts(kind); } const P = HS.P, v = P.view(), n = Math.floor(P.N * 0.9), y = v.h * 0.2, w = Math.min(v.w * 0.92, v.h * 0.42);
  const g = kind === 'mission' ? genRocket(n, Math.min(v.w * 0.62, v.h * 0.28), y) : kind === 'market' ? genBars(n, Math.min(v.w * 0.8, v.h * 0.36), y) : kind === 'coach' ? genOrb(n, Math.min(v.w * 0.62, v.h * 0.3), y) : null;
  if (!g){ HS.lastOpts = null; return _hsPts(kind); } HS.lastOpts = g.opts; return g.pts; };
const _hsMount = hsMount;
hsMount = function(){ if (!HS.cv && NT_FX.objects && GL_OK() && NT_FX.immersive && S.page === 'home' && document.querySelector('.hs')){ /* scène plus dense pour des objets « pleins » */
    HS.cv = document.createElement('canvas'); HS.cv.className = 'hs-gl'; HS.cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(HS.cv);
    try { HS.P = new NTGL.Particles(HS.cv, { count: NTGL.mobile ? 11000 : 18000, stars: false, camZ: 6, spread: 3.4, sway: 0.25, camSway: 0.6, pauseIf: () => HS.vis < 0.02 || !!document.getElementById('player') || S.page !== 'home' }); } catch(e){ HS.cv.remove(); HS.cv = null; HS.P = null; } }
  _hsMount(); if (HS.P && !HS.P._v31){ HS.P._v31 = true; HS.P.u.uScale.value = 15; HS.P.u.uAlpha.value = 1.7; const m0 = HS.P.morph.bind(HS.P); HS.P.morph = (pts, dur, o) => m0(pts, dur, Object.assign({ spin: 0 }, HS.lastOpts || {}, o || {})); } };

/* manifeste : les mots s'allument un à un au défilement */
const MANIF = 'Ici, on n’apprend pas la Bourse en lisant. On l’apprend en jouant. Une mission par jour, de vraies valeurs, de l’argent fictif. Et à chaque erreur, une explication.';
function manifMount(){ if (S.page !== 'home' || !NT_FX.immersive) return; const w = document.querySelector('.h-home'); if (!w || w.querySelector('.hm')) return; const after = w.querySelector('.h-day'); if (!after) return;
  const sec = document.createElement('section'); sec.className = 'hm'; sec.setAttribute('aria-label', MANIF);
  sec.innerHTML = `<p aria-hidden="true">${MANIF.split(' ').map((x, i) => `<span class="hm-w" data-i="${i}">${h(x)}</span>`).join(' ')}</p>`; after.insertAdjacentElement('afterend', sec); manifScroll(); }
let manifRaf = 0;
function manifScroll(){ if (manifRaf) return; manifRaf = requestAnimationFrame(() => { manifRaf = 0; const sec = document.querySelector('.hm'); if (!sec) return; const r = sec.getBoundingClientRect(), H = innerHeight;
  const p = RM() ? 1 : Math.max(0, Math.min(1, (H * 0.85 - r.top) / (r.height + H * 0.45))); const ws = sec.querySelectorAll('.hm-w'), lit = Math.round(p * ws.length);
  ws.forEach((el, i) => el.classList.toggle('on', i < lit)); }); }
addEventListener('scroll', () => { if (S.page === 'home') manifScroll(); }, { passive: true });
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(manifMount).observe(app, { childList: true }); manifMount(); })();

hsMount();

/* V31 bis : sol lumineux en perspective sous le temple (comme une scène), accueil seulement */
function gridMount(){ if (S.page !== 'home' || RM()) return; const t = document.querySelector('.h-home [data-temple]'); if (!t || t.querySelector('.h-floor')) return;
  const f = document.createElement('div'); f.className = 'h-floor'; f.setAttribute('aria-hidden', 'true'); f.innerHTML = '<div class="h-floor-in"></div><i class="h-horizon"></i>'; t.appendChild(f); }
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(gridMount).observe(app, { childList: true }); gridMount(); })();


/* ============================================================
   V32 — ACCUEIL COMPLET + SCÈNE 3D DERRIÈRE L'INFORMATION (03/11/2026)
   Thomas : « Où sont toutes les informations de l'accueil ? Remets-les. »
   - TOUT revient, dans l'ordre d'origine : les 3 cartes Nova (Missions avec
     rang et défis, Coach, Review), le bandeau des cours, Nova News / Event /
     Jeux, défis du jour, Ma liste, populaires, récompense, offre.
   - Les effets restent, mais AUTOUR de l'information au lieu de la remplacer :
     un seul objet 3D derrière la page qui change selon la partie regardée
     (anneaux → fusée / noyau / cible selon la carte au centre → barres →
     globe → cible → pièces → logo), titres géants, lignes de cours géantes.
   - La page retrouve une longueur normale.
   Interrupteur : NT_FX.v32 = false → accueil immersif V29/V31.
   ============================================================ */
NT_FX.v32 = NT_FX.v32 !== false;
function genRings(n, w, y){ const out = []; for (let i = 0; i < n; i++){ const k = Math.floor(R3() * 3), R = w * (0.22 + k * 0.13), a = R3() * 6.283, tube = w * 0.018 * (R3() - 0.5);
  const tilt = [0.35, -0.55, 1.1][k], p = [Math.cos(a) * (R + tube), Math.sin(a) * (R + tube) * 0.18, Math.sin(a) * (R + tube)], c = Math.cos(tilt), s2 = Math.sin(tilt);
  out.push([p[0], y + p[1] * c - p[2] * s2, p[1] * s2 + p[2] * c]); } return { pts: out, opts: { spin: 0.45, tint: ['#ffffff', '#3fd39a', '#8fb4ff'] } }; }
function genGlobe(n, w, y){ const R = w * 0.36, out = []; for (let i = 0; i < n; i++){ const k = R3();
  if (k < 0.55){ const lat = (Math.floor(R3() * 7) - 3) * 0.4, a = R3() * 6.283; out.push([Math.cos(a) * Math.cos(lat) * R, y + Math.sin(lat) * R, Math.sin(a) * Math.cos(lat) * R]); }
  else if (k < 0.9){ const lon = Math.floor(R3() * 8) * Math.PI / 8, t = R3() * 6.283; out.push([Math.cos(t) * Math.cos(lon) * R, y + Math.sin(t) * R, Math.cos(t) * Math.sin(lon) * R]); }
  else { const u = R3() * 2 - 1, a = R3() * 6.283, q = Math.sqrt(1 - u * u); out.push([Math.cos(a) * q * R * 1.5, y + u * R * 0.2, Math.sin(a) * q * R * 1.5]); } }
  return { pts: out, opts: { spin: 0.28, tint: ['#ffffff', '#8fb4ff', '#5b8cff'] } }; }
function genCoins(n, w, y){ const r = w * 0.2, th = w * 0.035, out = [], stacks = [[-w * 0.24, 6], [w * 0.02, 9], [w * 0.28, 4]];
  for (let i = 0; i < n; i++){ const [sx, cnt] = stacks[Math.floor(R3() * 3)], c = Math.floor(R3() * cnt), a = R3() * 6.283, yy = y - w * 0.25 + c * th * 1.15, f = R3();
    if (f < 0.6) out.push([sx + Math.cos(a) * r, yy + R3() * th, Math.sin(a) * r * 0.9]);
    else { const rr = r * Math.sqrt(R3()); out.push([sx + Math.cos(a) * rr, yy + th, Math.sin(a) * rr * 0.9]); } }
  return { pts: out, opts: { spin: 0.2, tint: ['#ffffff', '#c4b5ff', '#8fb4ff'] } }; }
function genTarget(n, w, y){ const out = []; for (let i = 0; i < n; i++){ const k = Math.floor(R3() * 4), R = w * (0.08 + k * 0.11), a = R3() * 6.283, d = (R3() - 0.5) * w * 0.02;
  out.push([Math.cos(a) * (R + d), y + Math.sin(a) * (R + d), (k - 1.5) * w * 0.06]); } return { pts: out, opts: { spin: 0.3, tint: ['#ffffff', '#c4b5ff', '#ff8fd0'] } }; }
const LOGO_CACHE = {};
function genLogo(n, w, y){ const key = n + ':' + w.toFixed(3) + ':' + y.toFixed(3); if (LOGO_CACHE[key]) return LOGO_CACHE[key]; return (LOGO_CACHE[key] = genLogo0(n, w, y)); }
function genLogo0(n, w, y){ const pts = NTGL.fromCanvas(g => { g.translate(28, 28); g.scale(200 / 742, 200 / 742); g.translate(-392, -172); LOGO_D.forEach(d => g.fill(new Path2D(d))); }, n, { w, y, depth: 0.0 });
  pts.forEach(p => { p[2] = (R3() - 0.5) * w * 0.14; }); return { pts, opts: { spin: 0.35, tint: ['#ffffff', '#c4b5ff', '#8fb4ff'] } }; }
const V32GEN = { rings: genRings, rocket: genRocket, orb: genOrb, target: genTarget, bars: genBars, globe: genGlobe, coins: genCoins, logo: genLogo };
/* titres géants dont les mots montent quand ils arrivent à l'écran */
const bigT = (t, cls = '') => `<h2 class="v32-big ${cls}" aria-label="${h(t)}">${String(t).split(' ').map((w, i) => `<span class="v32-wm"><span style="--i:${i}">${h(w)}</span></span>`).join(' ')}</h2>`;
function v32Rows(){ const ids = [...new Set([...WATCH(), ...POP.actions, ...POP.paris])], L = ids.map(mkFind).filter(Boolean); if (!L.length) return '';
  const tk = s => { const v = chg(s); return `<span class="hs-tk"><b>${h(s.id)}</b> ${money(s, px(s))} <i class="${v == null ? '' : v >= 0 ? 'up' : 'down'}">${v == null ? '' : (v >= 0 ? '▲' : '▼') + ' ' + num(Math.abs(v), 2) + ' %'}</i></span>`; };
  const half = Math.ceil(L.length / 2), r1 = L.slice(0, half).map(tk).join(''), r2 = L.slice(half).map(tk).join('');
  return `<div class="v32-rows" aria-hidden="true"><div class="hs-row r1">${r1}${r1}</div><div class="hs-row r2">${r2}${r2}</div></div>`; }
const _homeV31 = PAGES.home;
PAGES.home = () => { if (!NT_FX.v32 || !NT_FX.home) return _homeV31();
  const name = (S.name || '').split(' ')[0], ws = WATCH().map(mkFind).filter(Boolean), tab = OSEG.pop || 'actions', c = CAR(), d = RD.DAYS[c.n], ev = d && RD.ev(d.decide), ep = epreuveDuJour();
  const dt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), open = PARIS_OPEN();
  return `<div class="wrap o-root-page h-home v32-home">${oTop()}
  ${temple()}
  <div class="o-quick h-quick">
    <button data-osearch><span class="o-ring">${OI.search}</span>Rechercher</button>
    <button data-go="coach"><span class="o-ring">${OI.rook}</span>Coach IA</button>
    <button data-go="jeux"><span class="o-ring">${IC2.game}</span>Jeux</button>
    <button data-go="carte"><span class="o-ring">${IC2.map}</span>Parcours</button>
  </div>
  <header class="o-hello h-hello"><p class="h-date"><span class="h-dot ${open ? 'on' : ''}"></span>${h(dt.charAt(0).toUpperCase() + dt.slice(1))} · Bourse de Paris ${open ? 'ouverte' : 'fermée'}</p>
    <h1 aria-label="${h(greet() + (name ? ' ' + name : ''))}">${hLetters(greet())}${name ? ' <span class="h-name">' + hLetters(name) + '</span>' : ''}</h1><p>Voici ton entraînement du jour.</p></header>
  <div data-scene="rings">${hDay()}</div>
  ${stuckCard()}
  <section class="v32-chap" data-scene="cards">${bigT('Tes missions.')}
    <div class="o-sec h-cf-sec"><div class="o-rail h-cf" data-orail="heroDots">${heroMission()}${heroCoach()}${heroReviewSchool()}</div><div class="o-dots" id="heroDots"><i class="o-on"></i><i></i><i></i></div></div></section>
  <section class="v32-chap" data-scene="bars">${bigT('Le marché.', 'r')}${v32Rows()}
    ${hTape()}
    <div class="o-sec o-card o-mini h-glass" style="padding:6px 18px">
      <button class="o-mini-row" data-career><span class="o-chess" style="background:#2e3a7a">${OI.bishop}</span><span class="o-t" style="text-align:left"><b>Nova News · journée de trader</b><span>${careerReady() && ev ? h(ev.co + ' : ' + ev.head) : c.n >= RD.DAYS.length ? 'Semaine réelle terminée' : 'Prochaine journée demain'}</span></span>${OI.chev}</button>
      ${ep ? `<button class="o-mini-row" data-epreuve="${ep.id}"><span class="o-chess" style="background:#1f4a6b">${OI.pawn}</span><span class="o-t" style="text-align:left"><b>Nova Event · épreuve du jour</b><span>${h(ep.t)}</span></span>${OI.chev}</button>` : ''}
      <button class="o-mini-row" data-go="jeux"><span class="o-chess" style="background:#4a2a6b">${OI.queen || OI.knight}</span><span class="o-t" style="text-align:left"><b>Nova Jeux</b><span>Hausse ou baisse, calcul flash, arnaque ou pas : 45 secondes</span></span>${OI.chev}</button>
    </div></section>
  <div data-scene="target">${defisHTML()}</div>
  ${levelTestCard()}${extraQuestion()}${trialBanner()}
  <section class="v32-chap" data-scene="globe">${bigT('Ta liste.')}
    <div class="o-sec"><div class="o-sec-h h-sh"><h2>Ma liste</h2><button class="o-link" data-go="markets">Tout voir ${OI.chev}</button></div>
      <div class="o-card" style="padding:8px 18px 18px">${ws.length ? ws.slice(0, 5).map(s => oRow(s, { spark: true })).join('') : `<p class="o-sub" style="padding:12px 0 0">Touche l’étoile sur une valeur pour la suivre ici.</p>`}</div></div>
    <div class="o-sec"><div class="o-sec-h h-sh"><h2>Les plus populaires</h2><button class="o-link" data-go="markets">Marchés ${OI.chev}</button></div>
      <div class="o-card">${oSeg('pop', [['actions', 'Actions'], ['paris', 'Paris'], ['etf', 'ETF']], tab)}<div class="o-grid4">${oTiles(POP[tab].map(mkFind).filter(Boolean))}</div></div></div></section>
  <div data-scene="coins">${rewardCard()}</div>
  <div data-scene="logo">${!S.premium && !minorMode() ? offerHome() : ''}</div>
  ${legal()}
  </div>${dock()}`; };
/* la scène 3D suit la partie de la page qu'on regarde */
const V32 = { cur: null, raf: 0 };
function v32Shape(){ const zones = [...document.querySelectorAll('.v32-home [data-scene]')]; if (!zones.length || !HS.P) return null; const mid = innerHeight * 0.5; let best = null, bd = 1e9;
  zones.forEach(z => { const r = z.getBoundingClientRect(); if (r.height < 10) return; const d = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0; if (d < bd){ bd = d; best = z; } });
  if (!best || bd > innerHeight * 0.6) return null; let k = best.dataset.scene;
  if (k === 'cards'){ const on = best.querySelector('.h-cf > .h-on'), i = on ? [...on.parentElement.children].indexOf(on) : 0; k = ['rocket', 'orb', 'target'][i] || 'rocket'; }
  return k; }
function v32Update(){ if (V32.raf) return; V32.raf = requestAnimationFrame(() => { V32.raf = 0; if (S.page !== 'home' || !NT_FX.v32 || !HS.P || !document.querySelector('.v32-home')) return;
  const top = document.querySelector('.v32-home [data-temple]'), th = top ? top.getBoundingClientRect().bottom : 0, fadeIn = Math.max(0, Math.min(1, (innerHeight * 0.55 - th) / (innerHeight * 0.4)));
  HS.vis = fadeIn; HS.cv.style.opacity = (fadeIn * 0.9).toFixed(3); const k = fadeIn > 0.05 ? v32Shape() : null;
  if (k && k !== V32.cur){ V32.cur = k; const P = HS.P, v = P.view(), n = Math.floor(P.N * 0.88), w = Math.min(v.w * 0.86, v.h * 0.4), g = V32GEN[k](n, k === 'rocket' ? w * 0.72 : w, 0); HS.lastOpts = g.opts; P.warp(0.6); P.morph(g.pts, 1400); }
  if (HS.P) HS.P.last = 0; }); }
const _hsMountV31 = hsMount;
hsMount = function(){ if (!NT_FX.v32 || !NT_FX.home || S.page !== 'home' || !document.querySelector('.v32-home')) return _hsMountV31();
  if (!GL_OK()) return; if (!HS.cv){ HS.cv = document.createElement('canvas'); HS.cv.className = 'hs-gl'; HS.cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(HS.cv);
    try { HS.P = new NTGL.Particles(HS.cv, { count: NTGL.mobile ? 8000 : 16000, dprMax: NTGL.mobile ? 1 : 1.25, maxFps: NTGL.mobile ? 45 : 60, stars: false, camZ: 6, spread: 3.4, sway: 0.25, camSway: 0.6, pauseIf: () => HS.vis < 0.02 || !!document.getElementById('player') || S.page !== 'home' }); } catch(e){ HS.cv.remove(); HS.cv = null; HS.P = null; return; } }
  if (!HS.P._v31){ HS.P._v31 = true; HS.P.u.uScale.value = NTGL.mobile ? 17 : 15; HS.P.u.uAlpha.value = 1.5; const m0 = HS.P.morph.bind(HS.P); HS.P.morph = (pts, dur, o) => m0(pts, dur, Object.assign({ spin: 0 }, HS.lastOpts || {}, o || {})); }
  V32.cur = null; v32Update(); };
addEventListener('scroll', () => { if (S.page === 'home') { v32Update(); v32Chap(); } }, { passive: true });
/* titres géants : les mots montent ; lignes de cours géantes : glissent avec le défilement */
let v32cRaf = 0;
function v32Chap(){ if (v32cRaf) return; v32cRaf = requestAnimationFrame(() => { v32cRaf = 0; const H = innerHeight, cs = [...document.querySelectorAll('.v32-chap')], rs = cs.map(c => c.getBoundingClientRect());
  cs.forEach((c, i) => { const r = rs[i], p = Math.max(0, Math.min(1, (H - r.top) / (H + r.height))), v = p.toFixed(3); if (c.__p !== v){ c.__p = v; c.style.setProperty('--p', v); } if (r.top < H * 0.86 && !c.classList.contains('in')) c.classList.add('in'); }); }); }
(function(){ const app = document.getElementById('app'); if (!app) return; new MutationObserver(() => { if (S.page === 'home' && NT_FX.v32){ hsMount(); v32Chap(); const r = document.querySelector('.h-cf'); if (r && !r.dataset.v32){ r.dataset.v32 = 1; r.addEventListener('scroll', () => v32Update(), { passive: true }); } } }).observe(app, { childList: true }); })();
hsMount(); v32Chap();


/* ============================================================
   V33 — PARCOURS IMMERSIF (03/11/2026)
   Thomas : « revoir tout le parcours ».
   Rien n'est retiré : nœuds des chapitres (data-cnode), examens (data-exam),
   outils (data-toolinfo), prochaine récompense, résumé, vue liste
   (data-go="missions"), feuille de chapitre, « Tu es ici » (.mnode.cur).
   En plus : le sommet (Certificat Trader NovaTitre, certificat interne),
   qu'on ne voyait que dans « Mes certificats ».
   - En haut : grand titre, anneau de progression, « Tu es ici » + Continuer.
   - Chaque niveau : grand numéro, titre, progression et son propre chemin
     lumineux, qui se dessine quand le niveau arrive à l'écran.
   - Derrière : une scène 3D en points qui change selon le niveau regardé
     (spirale → anneaux → pièces → barres → bougies → cible → fusée → temple).
   Interrupteur : NT_FX.parcours = false → parcours d'avant.
   ============================================================ */
NT_FX.parcours = NT_FX.parcours !== false;
const PC_SCENE = { 1: 'coins', 2: 'bars', 3: 'candles', 4: 'target', 5: 'rocket' };
const pad2 = n => String(n).padStart(2, '0');
/* nouvelles formes en points */
function genHelix(n, w, y){ const out = [], R = w * 0.34, Ht = w * 1.15, turns = 1.6;
  for (let i = 0; i < n; i++){ const k = R3();
    if (k < 0.72){ const t = R3(), a = t * turns * 6.283, rr = R + (R3() - 0.5) * w * 0.05; out.push([Math.cos(a) * rr, y + (t - 0.5) * Ht + (R3() - 0.5) * w * 0.012, Math.sin(a) * rr]); }
    else { const j = Math.floor(R3() * 6), t = j / 5, a = t * turns * 6.283, b = R3() * 6.283, rr = w * (0.05 + (j === 5 ? 0.03 : 0)); out.push([Math.cos(a) * R + Math.cos(b) * rr, y + (t - 0.5) * Ht + Math.sin(b) * rr, Math.sin(a) * R]); } }
  return { pts: out, opts: { spin: 0.3, tint: ['#ffffff', '#c4b5ff', '#8fb4ff'] } }; }
function genCandles(n, w, y){ const s = mkFind(WATCH()[0]) || MK[0], raw = series(s.id).slice(-48), v = raw.length >= 8 ? raw : Array.from({ length: 48 }, (_, i) => 1 + Math.sin(i / 4) * 0.05 + i * 0.002);
  const per = Math.max(2, Math.floor(v.length / 12)), cs = []; for (let i = 0; i + per <= v.length; i += per){ const b = v.slice(i, i + per); cs.push({ o: b[0], c: b[b.length - 1], h: Math.max(...b), l: Math.min(...b) }); }
  const mn = Math.min(...cs.map(c => c.l)), mx = Math.max(...cs.map(c => c.h)), Y = q => y - w * 0.32 + (q - mn) / (mx - mn || 1) * w * 0.64, L = cs.length, sp = w * 1.1 / L, bw = sp * 0.55, out = [];
  for (let i = 0; i < n; i++){ const k = R3(), ci = Math.floor(R3() * L), C = cs[ci], x = (ci - (L - 1) / 2) * sp;
    if (k < 0.2){ out.push([x + (R3() - 0.5) * w * 0.006, Y(C.l) + (Y(C.h) - Y(C.l)) * R3(), (R3() - 0.5) * w * 0.006]); continue; }
    if (k < 0.3){ const u = R3() * (L - 1), a = Math.floor(u), f = u - a, q = cs[a].c + (cs[Math.min(L - 1, a + 1)].c - cs[a].c) * f; out.push([(u - (L - 1) / 2) * sp, Y(q) + w * 0.06, w * 0.12]); continue; }
    const y0 = Y(Math.min(C.o, C.c)), y1 = Math.max(y0 + w * 0.012, Y(Math.max(C.o, C.c))), u = R3() - 0.5, f = Math.floor(R3() * 5), yy = y0 + (y1 - y0) * R3(), hb = bw / 2;
    out.push(f === 0 ? [x - hb, yy, u * bw] : f === 1 ? [x + hb, yy, u * bw] : f === 2 ? [x + u * bw, yy, -hb] : f === 3 ? [x + u * bw, yy, hb] : [x + u * bw, R3() < 0.5 ? y0 : y1, (R3() - 0.5) * bw]); }
  return { pts: out, opts: { spin: 0.14, tint: ['#ffffff', '#8fb4ff', '#3fd39a'] } }; }
const PC_GEN = Object.assign({ helix: genHelix, candles: genCandles }, V32GEN);

/* anneau de progression */
function pcRing(p){ const r = 52, c = 2 * Math.PI * r; return `<svg class="pc-ring" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="pcRG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#c4b5ff"/><stop offset="1" stop-color="#5b8cff"/></linearGradient></defs><circle cx="60" cy="60" r="${r}" class="pc-ring-bg"/><circle cx="60" cy="60" r="${r}" class="pc-ring-on" stroke-dasharray="${c.toFixed(1)}" style="--c0:${c.toFixed(1)};--off:${(c * (1 - Math.max(0.004, p))).toFixed(1)}"/></svg>`; }
/* un nœud : mêmes classes, mêmes attributs qu'avant */
function pcNode(it, curCh, n){
  if (it.t === 'ex'){ const cert = S.certs[it.l.id];
    return `<button class="mnode ex ${cert ? 'done' : ''}" style="left:${it.x}%;top:${it.y}px;--n:${n}" data-exam="lv${it.l.id}" aria-label="Examen du niveau ${it.l.id}"><span class="mn-c">${I.trophy}</span><span class="mn-l"><b>Examen ${it.l.id}</b><span>${cert ? cert.pct + ' %' : it.l.exam + ' questions'}</span></span></button>`; }
  const c = it.c, pr = chProgress(c.id), un = chUnlocked(c.id), prem = chPremium(c.id), cur = c.id === curCh, tool = TOOLS.find(t => t.ch === c.id);
  const cls = pr >= 1 ? 'done' : !un ? 'lock' : prem ? 'prem' : cur ? 'cur' : pr > 0 ? 'part' : 'todo';
  return `<button class="mnode ${cls}" style="left:${it.x}%;top:${it.y}px;--c:${c.color};--p:${(pr * 100).toFixed(0)};--n:${n}" data-cnode="${c.id}" aria-label="Chapitre ${c.id} : ${h(c.title)}, ${Math.round(pr * 100)} %">
    ${cur ? '<span class="pc-halo" aria-hidden="true"><i></i><i></i></span><span class="mn-here">Tu es ici</span>' : ''}<span class="mn-c"><span class="mn-in">${!un ? I.lock : pr >= 1 ? I.check : c.id}</span></span>
    <span class="mn-l"><b>${h(c.title)}</b><span>${prem ? 'Premium' : Math.round(pr * 100) + ' %'}</span></span>
    ${tool ? `<span class="mn-tool ${toolOn(tool) ? 'on' : ''}" title="Débloque : ${h(tool.name)}">${toolOn(tool) ? tool.ic : IC2.gift}</span>` : ''}</button>`; }
/* un niveau : grand numéro + son morceau de chemin */
function pcLevel(l, ctx){
  const chs = CH.filter(c => l.ch.includes(c.id)), its = []; let y = 70;
  chs.forEach(c => { its.push({ t: 'ch', c, y, x: MAPX[ctx.k++ % MAPX.length], g: ctx.g++ }); y += 128; });
  its.push({ t: 'ex', l, y, x: MAPX[ctx.k++ % MAPX.length], g: ctx.g++ }); y += 124;
  const H = y, cy = p => p.y + 34, P = [{ x: 50, y: -34 }].concat(its, [{ x: 50, y: H - 34 }]);
  const path = a => a.map((p, i) => i ? `C ${a[i - 1].x} ${cy(a[i - 1]) + 58}, ${p.x} ${cy(p) - 58}, ${p.x} ${cy(p)}` : `M ${p.x} ${cy(p)}`).join(' ');
  const reached = its.filter(p => p.g <= ctx.reach).length, onA = reached ? P.slice(0, 1 + reached + (reached === its.length && its[its.length - 1].g < ctx.reach ? 1 : 0)) : null;
  const pr = lvProgress(l), cert = S.certs[l.id], pct = Math.round(pr * 100), isCur = chs.some(c => c.id === ctx.curCh);
  return `<section class="pc-lv v32-chap ${cert ? 'ok' : ''} ${isCur ? 'now' : ''}" data-scene="${PC_SCENE[l.id] || 'orb'}" data-lv="${l.id}" data-rv="1">
    <header class="pc-lvh map-lv-h"><span class="pc-num" aria-hidden="true">${pad2(l.id)}</span>
      <div class="pc-lvt"><span class="pc-eb">Niveau ${l.id} · ${chs.length} chapitre${chs.length > 1 ? 's' : ''} · examen de ${l.exam} questions</span><h2>${h(l.title)}</h2><p>${h(l.sub)}</p>
        <div class="pc-lvp"><span class="pc-bar"><i style="width:${pct}%"></i></span><b class="tn">${cert ? I.check + 'Certifié' : pct + ' %'}</b></div></div></header>
    <div class="map pc-map" style="height:${H}px">
      <svg class="map-path" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${path(P)}" class="mp-bg" vector-effect="non-scaling-stroke"/></svg>
      ${onA ? `<svg class="map-path pc-on" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${path(onA)}" class="mp-glow" vector-effect="non-scaling-stroke"/><path d="${path(onA)}" class="mp-on" vector-effect="non-scaling-stroke"/></svg>` : ''}
      ${its.map((it, i) => pcNode(it, ctx.curCh, i)).join('')}
    </div></section>`; }
/* le sommet : le Certificat Trader (certificat interne), mêmes conditions que dans « Mes certificats » */
function pcSummit(){ const tr = S.certs.trader, nOk = LV.filter(l => S.certs[l.id]).length;
  const req = [[LV.every(l => S.certs[l.id]), `Les 5 certificats de niveau (${nOk}/5)`, 'missions'], [defiOK(), `Défi Trader : ${defiPassed()}/${CF.defiSessions} séances réussies, moyenne ${defiAvg() || '—'}/100 (${CF.defiAvg} demandés)`, 'room'], [!!(S.plan && S.plan.ok), 'Plan de trading validé par Nova Coach', 'plan'], [!!tr, `Examen final (${CF.finalQuestions} questions)`, 'certs']];
  return `<section class="pc-top v32-chap" data-scene="logo" data-rv="1">${bigT('Le sommet.')}
    <div class="pc-cert ${tr ? 'ok' : ''}"><span class="pc-eb">${I.trophy}Certificat Trader NovaTitre · certificat interne</span>
      <b>${tr ? `Obtenu le ${tr.date.split('-').reverse().join('/')} · ${tr.pct} %` : 'Les 5 niveaux, le Défi Trader, ton plan, puis l’examen final.'}</b>
      <div class="pc-reqs">${req.map(([ok, t, g]) => `<button class="req ${ok ? 'ok' : ''}" data-go="${g}"><span>${ok ? I.check : I.clock}</span>${h(t)}</button>`).join('')}</div>
      <div class="pc-cta">${tr ? `<button class="hs-btn" data-certview="trader"><span>Voir mon certificat</span>${OI.arrowr}</button>` : `<button class="hs-btn" data-exam="final"${finalReady() ? '' : ' disabled'}><span>Examen final</span>${OI.arrowr}</button>`}<button class="hs-btn2" data-go="certs">Mes certificats</button></div></div>
    <p class="note">Certificats internes délivrés par NovaTitre : ils attestent la réussite des examens NovaTitre. Ce ne sont pas des titres d’État ni des titres enregistrés au RNCP.</p></section>`; }
/* la carte « Tu es ici » en haut de page */
function pcHere(nm, curCh){
  if (nm){ const c = CH.find(x => x.id === curCh), lv = levelOf(curCh), pr = chProgress(curCh);
    return `<div class="pc-here" style="--c:${c.color}"><span class="pc-eb"><i class="pc-dot"></i>Tu es ici · Niveau ${lv.id} · Chapitre ${c.id}</span><b>${h(c.title)}</b>
      <span class="pc-next">Prochaine mission : ${h(nm.title)} · ${nm.dur} min</span><span class="pc-bar"><i style="width:${Math.round(pr * 100)}%"></i></span>
      <div class="pc-cta"><button class="hs-btn" data-play="${nm.id}"><span>Continuer</span>${OI.arrowr}</button><button class="hs-btn2" data-pcfind>Voir sur la carte</button></div></div>`; }
  const premLeft = MS.some(m => !isDone(m.id) && chPremium(m.ch));
  return `<div class="pc-here"><span class="pc-eb"><i class="pc-dot"></i>${premLeft ? 'La suite du parcours' : 'Parcours terminé'}</span><b>${premLeft ? 'Les chapitres suivants sont dans Premium.' : 'Toutes les missions disponibles sont faites.'}</b>
    <div class="pc-cta">${premLeft ? `<button class="hs-btn" data-paywall><span>Voir Premium</span>${OI.arrowr}</button>` : `<button class="hs-btn" data-go="certs"><span>Mes certificats</span>${OI.arrowr}</button>`}<button class="hs-btn2" data-go="missions">Vue liste</button></div></div>`; }

const _carteV32 = PAGES.carte;
PAGES.carte = () => { if (!NT_FX.parcours) return _carteV32();
  const nm = nextMission(), curCh = nm ? nm.ch : null, doneMs = MS.filter(m => isDone(m.id)).length, nCert = Object.keys(S.certs).length, nTool = TOOLS.filter(toolOn).length;
  /* jusqu'où le chemin est allumé : le chapitre en cours, sinon le dernier nœud réussi */
  const order = []; LV.forEach(l => { CH.filter(c => l.ch.includes(c.id)).forEach(c => order.push({ t: 'ch', c })); order.push({ t: 'ex', l }); });
  let reach = order.findIndex(p => p.t === 'ch' && p.c.id === curCh);
  if (reach < 0) order.forEach((p, i) => { if (p.t === 'ch' ? chProgress(p.c.id) >= 1 : S.certs[p.l.id]) reach = i; });
  const ctx = { k: 0, g: 0, reach, curCh }, lvNow = levelOf(curCh || (MS[MS.length - 1] || {}).ch || 1) || LV[0];
  return `<div class="wrap pc-page">${top()}
  <section class="pc-hero v32-chap" data-scene="helix">
    <div class="pc-hh"><span class="pc-eb"><i class="pc-dot"></i>Niveau ${lvNow.id} · ${h(lvNow.title)}</span><button class="pc-list" data-go="missions">Vue liste ${OI.chev}</button></div>
    ${bigT('Ton parcours.')}
    <div class="pc-hrow"><div class="pc-ringbox">${pcRing(doneMs / MS.length)}<div class="pc-ring-t"><b class="tn" data-count="${Math.round(doneMs / MS.length * 100)}">${Math.round(doneMs / MS.length * 100)}</b><span>%</span><small>du parcours</small></div></div>
      <div class="map-sum pc-sum"><div><b class="tn" data-count="${doneMs}">${doneMs}</b><span>/ ${MS.length} missions</span></div><div><b class="tn" data-count="${nCert}">${nCert}</b><span>certificats</span></div><div><b class="tn" data-count="${nTool}">${nTool}</b><span>/ ${TOOLS.length} outils</span></div></div></div>
    ${pcHere(nm, curCh)}
  </section>
  ${rewardCard('sticky')}
  <section class="sec pc-tools v32-chap" data-scene="rings"><div class="sec-h"><h2>Mes outils</h2><span class="small tn">${nTool} / ${TOOLS.length}</span></div>${toolStrip()}</section>
  ${LV.map(l => pcLevel(l, ctx)).join('')}
  ${pcSummit()}
  ${legal()}</div>${dock()}`; };

/* ---------- scène 3D du parcours : un canvas fixe, piloté par le défilement ---------- */
const PCS = { P: null, cv: null, cur: null, raf: 0, vis: 0, lastOpts: null };
const pcBusy = () => !!(document.getElementById('player') || document.getElementById('xo') || document.getElementById('sheet') || document.body.classList.contains('nt-covered'));
function pcMount(){
  const page = NT_FX.parcours && S.page === 'carte' && document.querySelector('.pc-page');
  if (!page){ if (PCS.cv) PCS.cv.style.opacity = '0'; PCS.op = null; PCS.vis = 0; PCS.cur = null; return; }
  /* la scène 3D se crée APRÈS l'arrivée de la page (la page s'affiche d'abord, la 3D apparaît ensuite en fondu) */
  if (GL_OK() && !PCS.cv && !PCS.wait){ PCS.wait = setTimeout(() => { PCS.wait = 0; if (S.page !== 'carte' || PCS.cv || !document.querySelector('.pc-page')) return; pcGL(); PCS.cur = null; pcScroll(); }, 700); }
  PCS.cur = null; pcScroll(); }
function pcGL(){ { PCS.cv = document.createElement('canvas'); PCS.cv.className = 'pc-gl'; PCS.cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(PCS.cv);
    try { PCS.P = new NTGL.Particles(PCS.cv, { count: NTGL.mobile ? 7000 : 14000, dprMax: NTGL.mobile ? 1 : 1.25, maxFps: NTGL.mobile ? 45 : 60, stars: false, camZ: 6, spread: 3.4, sway: 0.25, camSway: 0.6, pauseIf: () => PCS.vis < 0.02 || S.page !== 'carte' || pcBusy() });
      PCS.P.u.uScale.value = NTGL.mobile ? 16 : 14; PCS.P.u.uAlpha.value = 1.25;
      const m0 = PCS.P.morph.bind(PCS.P); PCS.P.morph = (pts, dur, o) => m0(pts, dur, Object.assign({ spin: 0 }, PCS.lastOpts || {}, o || {})); }
    catch(e){ PCS.cv.remove(); PCS.cv = null; PCS.P = null; } } }
function pcScroll(){ if (PCS.raf) return; PCS.raf = requestAnimationFrame(() => { PCS.raf = 0; if (S.page !== 'carte' || !NT_FX.parcours) return;
  const H = innerHeight, mid = H * 0.5, zones = [...document.querySelectorAll('.pc-page [data-scene]')], rs = zones.map(z => z.getBoundingClientRect());
  /* lecture finie : on écrit */
  let best = null, bd = 1e9; zones.forEach((z, i) => { const r = rs[i]; if (r.height < 10) return; if (z.classList.contains('pc-lv') && r.top < H * 0.92) { z.classList.add('in'); }
    const d = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0; if (d < bd){ bd = d; best = z; } });
  if (!PCS.P) return; const k = best && bd < H * 0.6 ? best.dataset.scene : null;
  PCS.vis = 1; const op = k === 'helix' || k === 'logo' ? '0.9' : NT_FX.pcobj ? '0.62' : '0.5'; if (PCS.op !== op){ PCS.op = op; PCS.cv.style.opacity = op; }
  if (k && k !== PCS.cur && PC_GEN[k]){ PCS.cur = k; const P = PCS.P, v = P.view(), n = Math.floor(P.N * 0.88), w = Math.min(v.w * 0.86, v.h * 0.4), g = PC_GEN[k](n, k === 'rocket' ? w * 0.72 : w, 0); PCS.lastOpts = g.opts; if (!g.opts.spin) P.spinA = Math.round((P.spinA || 0) / 6.2832) * 6.2832; /* objets plats : bien de face */ P.warp(0.5); P.morph(g.pts, 1400); }
  PCS.P.last = 0; }); }
addEventListener('scroll', () => { if (S.page === 'carte' && NT_FX.parcours){ pcScroll(); v32Chap(); } }, { passive: true });
addEventListener('resize', () => { if (PCS.P && S.page === 'carte'){ PCS.cur = null; pcScroll(); } }, { passive: true });
(function(){ const app = document.getElementById('app'); if (!app) return; new MutationObserver(() => { pcMount(); if (S.page === 'carte' && NT_FX.parcours) v32Chap(); }).observe(app, { childList: true }); })();
/* « Voir sur la carte » : on descend jusqu'au chapitre en cours, qui clignote une fois */
document.addEventListener('click', ev => { const b = ev.target.closest('[data-pcfind]'); if (!b) return; const n = document.querySelector('.pc-page .mnode.cur'); if (!n) return;
  scrollTo({ top: scrollY + n.getBoundingClientRect().top - innerHeight * 0.42, behavior: RM() ? 'auto' : 'smooth' }); n.classList.remove('pc-ping'); void n.offsetWidth; n.classList.add('pc-ping'); });
pcMount(); if (S.page === 'carte') v32Chap();

/* V33 bis — la vue liste et la feuille de chapitre dans le même style (mêmes boutons, mêmes attributs) */
const _missionsV32 = PAGES.missions;
PAGES.missions = () => { if (!NT_FX.parcours) return _missionsV32();
  const done = MS.filter(m => isDone(m.id)).length, lvNow = levelOf((nextMission() || MS[MS.length - 1]).ch), nc = Object.keys(S.certs).length;
  return `<div class="wrap pc-page pc-listp">${top()}
  <section class="pc-hero v32-chap"><div class="pc-hh"><button class="pc-list pc-back" data-go="carte">${I.back}Ma carte</button><span class="pc-eb tn">${done} / ${MS.length} missions</span></div>
    ${bigT('En liste.')}
    <div class="pc-here"><div class="row" style="justify-content:space-between;gap:10px"><span class="pc-eb"><i class="pc-dot"></i>En cours</span>${S.plan2 ? '<button class="pc-list" data-go="monplan">Mon plan</button>' : ''}</div>
      <b>Niveau ${lvNow.id} · ${h(lvNow.title)}</b><span class="pc-bar"><i style="width:${(done / MS.length * 100).toFixed(1)}%"></i></span>
      <span class="pc-next" style="margin-top:10px">${nc} certificat${nc > 1 ? 's' : ''} · ${S.streak} jour${S.streak > 1 ? 's' : ''} de série</span></div>
    <div class="pace mini" role="group" aria-label="Durée de la séance">${[['rapide','3 min'],['normal','7 min'],['intense','15 min']].map(([k,t]) => `<button data-pace="${k}" aria-pressed="${S.pace === k}">${t}</button>`).join('')}</div></section>
  <section class="sec">${LV.map(l => { const pr = lvProgress(l), cert = S.certs[l.id], ex = S.exams['lv' + l.id];
    return `<div class="lvl pc-lvl ${cert ? 'ok' : ''}"><div class="lvl-h pc-lvh2"><span class="pc-num sm" aria-hidden="true">${pad2(l.id)}</span><span class="grow"><span class="lvl-n">Niveau ${l.id}</span><b>${h(l.title)}</b></span>${cert ? `<span class="chip g">${I.check}Certifié</span>` : `<span class="pc-pct tn">${Math.round(pr * 100)} %</span>`}</div>
      ${CH.filter(c => l.ch.includes(c.id)).map(chapCard).join('')}
      <div class="exam-card${cert ? ' ok' : ''}"><div class="grow"><span class="eyebrow">${I.trophy} Examen du niveau ${l.id}</span>
        <b>${cert ? 'Réussi · ' + cert.pct + ' %' : `${l.exam} questions · ${Math.round(l.exam * CF.secondsPerQuestion / 60)} min · 80 % pour valider`}</b>
        <span class="small">${cert ? 'Certificat obtenu le ' + cert.date.split('-').reverse().join('/') : ex ? `Meilleur essai : ${ex.best} %. ` : ''}${cert ? '' : pr < 0.7 ? `Conseillé après 70 % du niveau (tu es à ${Math.round(pr * 100)} %). Tu peux le tenter avant : réussi, il valide le niveau.` : 'Tu es prêt.'}</span></div>
        <button class="btn sm ${cert ? 'ghost' : 'v'}" data-exam="lv${l.id}">${cert ? 'Repasser' : 'Passer'}</button></div></div>`; }).join('')}</section>
  ${legal()}
  </div>${dock()}`; };
const _chapterSheetV32 = chapterSheet;
chapterSheet = function(c){ if (!NT_FX.parcours) return _chapterSheetV32(c);
  const ch = CH.find(x => x.id === c); if (!ch) return; const un = chUnlocked(c), prem = chPremium(c), list = chMissions(c), cur = list.find(m => !isDone(m.id)), tool = TOOLS.find(t => t.ch === c), pr = chProgress(c), nd = list.filter(m => isDone(m.id)).length;
  openSheet(`<div class="pcs-hero" style="--c:${ch.color}"><span class="pc-num sm" aria-hidden="true">${pad2(c)}</span><div class="pcs-t"><span class="eyebrow">Chapitre ${c} · Niveau ${levelOf(c).id}</span><h2 class="fiche-t">${h(ch.title)}</h2><p class="small">${h(ch.sub)}</p></div></div>
    <div class="pcs-prog"><span class="pc-bar"><i style="width:${(pr * 100).toFixed(0)}%;background:linear-gradient(90deg,${ch.color},#c4b5ff)"></i></span><b class="tn">${nd} / ${list.length}</b></div>
    ${tool ? `<button class="reward slim" data-toolinfo="${tool.id}"><span class="rw-ic">${toolOn(tool) ? tool.ic : IC2.gift}</span><span class="grow"><span class="eyebrow">${toolOn(tool) ? 'Outil débloqué' : 'À débloquer ici'}</span><b>${h(tool.name)}</b></span></button>` : ''}
    ${!un ? `<p class="small" style="margin-top:12px">Valide la moitié du chapitre précédent pour ouvrir celui-ci.</p>` : prem ? `<button class="btn v full" style="margin-top:12px" data-paywall>Débloquer avec Premium</button>` : cur ? `<button class="btn v full big" style="margin-top:12px" data-sheetplay="${cur.id}">${I.play}Jouer : ${h(cur.title)}</button>` : ''}
    <div class="sheet-list pcs-list" style="--c:${ch.color}">${list.map((m, i) => { const d = isDone(m.id), lk = !un || prem, now = m === cur && !lk; return `<button class="srow ${d ? 'done' : lk ? 'lock' : ''} ${now ? 'now' : ''}" style="--n:${i}" ${lk ? 'disabled' : `data-sheetplay="${m.id}"`}><span class="st">${d ? I.check : lk ? I.lock : I.play}</span><span class="grow"><b>${h(m.title)}</b><span>${h(m.kind)} · ${m.dur} min</span></span>${now ? '<span class="pcs-now">À faire</span>' : ''}</button>`; }).join('')}</div>`, 'pc-sheet');
};


/* ============================================================
   V34 — CARTES DE L'ACCUEIL ÉPURÉES (03/11/2026)
   Thomas : Missions, Coach et Défis du jour « beaucoup plus épurés,
   minimalistes au maximum », sans flèches ; on doit pouvoir entrer dans
   Nova Coach ; le bouton d'envoi était mal calibré.
   - Une seule surface sombre, un fin liseré. Pas d'icône en pastille, pas de dégradé.
   - Un titre, une ligne, un trait de progression, des boutons de même taille, sans flèche.
   - Coach : toute la carte ouvre Nova Coach ; les deux questions toutes prêtes
     restent des raccourcis ; la barre « Écris à Nova… » ouvre la conversation.
   - Défis : des lignes simples avec une case ronde à cocher, sans chevrons.
   - Review suit le même style (elle est dans le même carrousel).
   Mêmes actions qu'avant (data-play, data-go, data-askhome, data-pace, data-gamestart…).
   Interrupteur : NT_FX.cards = false → cartes d'avant.
   V35 (même jour) : on garde les COULEURS d'origine de chaque carte (violet
   pour Missions, bleu pour Coach, rose pour Review), les noms « Nova … » et
   le point vert des statuts. Le reste du design épuré ne change pas.
   ============================================================ */
NT_FX.cards = NT_FX.cards !== false;
const ncStrip = (t, kind) => kind && String(t).toLowerCase().startsWith(String(kind).toLowerCase() + ' : ') ? String(t).slice(String(kind).length + 3) : t;
const _heroMissionV33 = heroMission, _heroCoachV33 = heroCoach, _heroReviewV33 = heroReviewSchool, _defisV33 = defisHTML;
heroMission = function(){ if (!NT_FX.cards) return _heroMissionV33();
  const L = defis(), nx = L.find(x => !x.done), done = L.filter(x => x.done).length, fresh = !Object.keys(S.done).length && !(S.sessDone && Object.keys(S.sessDone).length), fm = fresh && nextMission();
  const t = fm ? ncStrip(fm.title, fm.kind) : nx ? nx.t : 'Défis du jour terminés', attr = fm ? `data-play="${fm.id}"` : nx ? nx.attr : '';
  const sub = fm ? `${h(fm.kind)} · ${fm.dur} min · une courte vidéo, puis la mission` : nx ? h(nx.s) : 'Bravo. Reviens demain pour la suite.';
  const { r, nx: n2 } = rankOf(S.score), lo = r.min, hi = n2 ? n2.min : 1000, w = Math.max(3, Math.min(100, (S.score - lo) / (hi - lo) * 100));
  return `<article class="nc-card nc-mis"><div class="nc-h"><span class="nc-k">Nova Missions</span><span class="nc-m nc-ok tn"><i class="nc-dot"></i>${done}/${L.length} défis</span></div>
    <div class="nc-body"><p class="nc-t">${h(t)}</p><p class="nc-s">${sub}</p></div>
    <div class="nc-prog"><div class="nc-pl"><span>${h(r.name)} · ${S.score} pts</span>${n2 ? `<span>${h(n2.name)}</span>` : ''}</div><i><b style="width:${w.toFixed(0)}%"></b></i></div>
    <div class="nc-acts">${attr ? `<button class="nc-b1" ${attr}>${fm ? 'Commencer' : 'Continuer'}</button><button class="nc-b2" data-go="carte">Parcours</button>` : `<button class="nc-b1" data-go="carte">Mon parcours</button>`}</div></article>`; };
heroCoach = function(){ if (!NT_FX.cards) return _heroCoachV33();
  return `<article class="nc-card nc-coach" data-go="coach"><div class="nc-h"><span class="nc-k">Nova Coach</span><span class="nc-m nc-ok"><i class="nc-dot"></i>${aiOn() ? 'IA' : 'Prêt'}</span></div>
    <div class="nc-body"><p class="nc-t">Ton coach IA</p><p class="nc-s">Une notion, une valeur, une question de mission. Jamais de conseil d’achat.</p></div>
    <div class="nc-qs">${['C’est quoi un ETF ?', 'Explique-moi le PER'].map(q => `<button type="button" data-askhome="${h(q)}">${h(q)}</button>`).join('')}</div>
    <button class="nc-in" data-go="coach" data-coachfocus aria-label="Écrire à Nova Coach"><span>Écris à Nova…</span><i aria-hidden="true">${OI.spark}</i></button></article>`; };
heroReviewSchool = function(){ if (!NT_FX.cards) return _heroReviewV33();
  const p = learnerProfile(), rate = p.reussite_globale, rv = dueReviews().length, n = p.missions_terminees;
  return `<article class="nc-card nc-rev"><div class="nc-h"><span class="nc-k">Nova Review</span><span class="nc-m">Ta semaine</span></div>
    <div class="nc-body">${rate == null ? '<p class="nc-t">Ton bilan</p>' : `<p class="nc-t nc-num tn">${rate}<small>%</small></p>`}
      <p class="nc-s">${rate == null ? 'Fais ta première mission pour le voir apparaître ici.' : `de bonnes réponses · ${n} mission${n > 1 ? 's' : ''} · ${rv} notion${rv > 1 ? 's' : ''} à revoir`}</p></div>
    <div class="nc-prog"><div class="nc-pl"><span>Nova Review relit tes réponses et te dit quoi revoir.</span></div><i><b style="width:${rate == null ? 0 : rate}%"></b></i></div>
    <div class="nc-acts"><button class="nc-b1" data-go="suivi">Voir mon analyse</button></div></article>`; };
defisHTML = function(){ if (!NT_FX.cards) return _defisV33();
  const L = defis(), done = L.filter(x => x.done).length, all = done === L.length, td = today();
  if (all && S.defisDay !== td){ S.defisDay = td; S.score = Math.min(1000, S.score + 10); save(); setTimeout(() => toast('Défis du jour terminés : +10 points.'), 500); }
  return `<section class="sec nc-card nc-defis"><div class="nc-dh"><h2>Défis du jour</h2><span class="nc-m tn" aria-label="${done} sur ${L.length}">${done}/${L.length}</span></div>
    <div class="nc-bars" aria-hidden="true">${L.map(x => `<i class="${x.done ? 'on' : ''}"></i>`).join('')}</div>
    <div class="nc-pace" role="group" aria-label="Temps du jour">${[['rapide', '3 min'], ['normal', '7 min'], ['intense', '15 min']].map(([k, t]) => `<button data-pace="${k}" aria-pressed="${S.pace === k}">${t}</button>`).join('')}</div>
    <div class="nc-list">${L.map(x => `<button class="nc-row ${x.done ? 'done' : ''}" ${x.done ? 'disabled' : x.attr}><span class="nc-ck">${x.done ? I.check : ''}</span><span class="nc-rt"><b>${h(x.t)}</b><span>${h(x.s)}</span></span></button>`).join('')}</div>
    ${all ? '<p class="nc-s nc-end">Tout est fait. À demain.</p>' : ''}</section>`; };
/* la barre « Écris à Nova… » : on arrive dans Nova Coach, le champ prêt à écrire */
document.addEventListener('click', ev => { if (!NT_FX.cards || !ev.target.closest('[data-coachfocus]')) return; setTimeout(() => { const i = document.getElementById('coachIn'); if (i) i.focus({ preventScroll: true }); }, 380); });


/* ============================================================
   V36 — NOVA COACH « COMME CHATGPT » + MON SUIVI EN PLEIN ÉCRAN (03/11/2026)
   Thomas : retirer la barre de navigation sur Nova Coach et Mon suivi, et
   donner à Nova Coach un design proche de ChatGPT, dans l'ambiance NovaTitre.
   - Les deux pages deviennent deux « applis » plein écran : plus de barre du
     bas ni de bouton rond. En haut : le logo (retour à l'accueil), le
     sélecteur Coach | Suivi, et « Nouvelle conversation ».
   - Coach : écran calme au départ (logo lumineux + une question), questions
     toutes prêtes au-dessus de la barre d'écriture, tes messages dans une
     bulle violette à droite, les réponses en texte libre à gauche, barre
     d'écriture arrondie qui reste au-dessus du clavier.
   - Mêmes éléments que le reste du code utilise : #cmsgs, .bub, #coachF,
     #coachIn, data-ask. L'avertissement IA reste sous la barre.
   Interrupteur : NT_FX.coachapp = false → pages d'avant.
   ============================================================ */
NT_FX.coachapp = NT_FX.coachapp !== false;
const CG_SUGG = ['C’est quoi un ETF ?', 'Le spread ?', 'PEA ou compte-titres ?', 'Je dois acheter quoi ?'];
const CG_NEW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l.9-4.4A8.5 8.5 0 1 1 20.5 12Z"/><path d="M12 8.6v6.8M8.6 12h6.8"/></svg>';
const cgBar = cur => `<header class="cg-top"><button class="cg-ib cg-home" data-go="home" aria-label="Retour à l’accueil">${I.logo}</button>
  <div class="cg-seg" role="tablist" aria-label="Nova Coach"><button role="tab" data-go="coach" aria-selected="${cur === 'coach'}">Coach</button><button role="tab" data-go="suivi" aria-selected="${cur === 'suivi'}">Suivi</button></div>
  ${cur === 'coach' ? `<button class="cg-ib" data-coachnew aria-label="Nouvelle conversation"${S.coach.length ? '' : ' disabled'}>${CG_NEW}</button>` : '<span class="cg-ib cg-ghost" aria-hidden="true"></span>'}</header>`;
const _coachV35 = PAGES.coach;
PAGES.coach = () => { if (!NT_FX.coachapp) return _coachV35();
  const empty = !S.coach.length;
  return `<div class="cg ${empty ? 'cg-empty' : ''}">${cgBar('coach')}
  <main class="cg-main">
    ${empty ? `<div class="cg-hello"><span class="cg-orb" aria-hidden="true">${I.logo}</span><h1>Que <span class="cg-nw">veux-tu</span> comprendre&nbsp;?</h1><p>Une notion, une mission, un mot difficile. Nova Coach t’explique, il ne te conseille pas.</p><span class="cg-chip">${aiLabel()}</span></div>` : ''}
    <div class="cg-msgs" id="cmsgs" aria-live="polite">${S.coach.map(m => `<div class="bub ${m.me ? 'me' : 'them'}"><small>${m.me ? 'Toi' : 'Nova Coach'}</small>${m.me ? h(m.t) : coachText(m.t)}</div>`).join('')}</div>
  </main>
  <div class="cg-dock">
    ${empty ? `<div class="cg-sugg">${CG_SUGG.map(s => `<button data-ask="${h(s)}">${h(s)}</button>`).join('')}</div>` : ''}
    <form class="cg-in" id="coachF"><label class="sr" for="coachIn">Ta question</label><input id="coachIn" placeholder="Demander à Nova Coach" autocomplete="off" enterkeyhint="send"><button class="cg-send" aria-label="Envoyer">${OI.spark}</button></form>
    <p class="cg-note">Nova Coach est une IA : il explique, ne donne pas de conseil en investissement personnalisé et peut se tromper.${aiOn() ? '' : ' Ici, ses réponses sont préparées à l’avance.'}</p>
  </div></div>`; };
/* Mon suivi : même contenu qu'avant, dans l'appli plein écran (sans barre du bas) */
const _suiviV35 = PAGES.suivi;
PAGES.suivi = () => { if (!NT_FX.coachapp) return _suiviV35();
  const p = learnerProfile(), rep = S.aiReport || localReport(p), isAI = !!S.aiReport, bars = p.chapitres.filter(c => c.reponses);
  return `<div class="wrap cg-wrap">${cgBar('suivi')}
  <div class="cg-sh"><div><span class="eyebrow">${I.chat} Nova Coach</span><h1>Mon suivi personnalisé</h1></div><span class="cg-chip">${aiLabel()}</span></div>
  <div class="grid2 cg-stats"><div class="stat"><b class="tn">${p.reussite_globale ?? '—'}${p.reussite_globale != null ? ' %' : ''}</b><span>Réussite</span></div><div class="stat"><b class="tn">${p.jours_actifs_sur_7}/7</b><span>Jours actifs</span></div>
    <div class="stat"><b class="tn">${p.missions_terminees}</b><span>Missions faites</span></div><div class="stat"><b class="tn">${p.salle_de_marche.note_moyenne ?? '—'}</b><span>Discipline (salle)</span></div></div>
  ${stuckSuivi()}
  ${bars.length ? `<section class="sec"><div class="sec-h"><h2>Ma réussite par chapitre</h2></div><div class="card">${bars.map(c => `<div style="padding:7px 0"><div class="row" style="justify-content:space-between"><span style="font-size:13.5px;font-weight:700">${c.chapitre}. ${h(c.titre)}</span><span class="small tn" style="color:${c.reussite >= 80 ? 'var(--green)' : c.reussite < 65 ? 'var(--red)' : 'var(--fg2)'}">${c.reussite} %</span></div><div class="bar" style="margin-top:5px"><i style="width:${c.reussite}%;background:${c.reussite >= 80 ? 'var(--green)' : c.reussite < 65 ? 'var(--red)' : 'var(--violet)'}"></i></div></div>`).join('')}</div></section>` : ''}
  <section class="sec"><div class="sec-h"><h2>${isAI ? 'Le bilan de Nova Coach' : 'Mon bilan'}</h2><span>${isAI ? 'IA · ' + rep.date.split('-').reverse().join('/') : 'automatique'}</span></div>
    <div class="card ai-card${isAI ? ' is-ai' : ''}">${S.aiBusy ? `<p class="thinking">${I.chat} Nova Coach analyse ta progression…</p><button class="btn ghost sm" data-aistop>Arrêter</button>` : `
      <p class="fiche-p" style="margin-top:0">${h(rep.resume)}</p>
      ${rep.forces && rep.forces.length ? `<b class="ai-h" style="color:var(--green)">Tes points forts</b><ul class="ai-ul">${rep.forces.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
      ${rep.a_travailler && rep.a_travailler.length ? `<b class="ai-h" style="color:var(--amber)">À travailler</b><ul class="ai-ul">${rep.a_travailler.map(x => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
      ${rep.encouragement ? `<p class="small" style="margin-top:10px">${h(rep.encouragement)}</p>` : ''}`}</div>
    ${!S.aiBusy ? (aiOn() ? `<button class="btn v full" style="margin-top:10px" data-aireport>${I.chat}${isAI ? 'Refaire mon bilan avec l’IA' : 'Demander mon bilan à Nova Coach (IA)'}</button>` : `<p class="note">L’IA n’est pas branchée sur cette version : ce bilan est calculé automatiquement. Sur le site NovaTitre et dans la page publiée sur Claude, Nova Coach fait un vrai bilan personnalisé.</p>`) : ''}</section>
  <section class="sec"><div class="sec-h"><h2>Mon plan pour cette semaine</h2></div>
    ${(rep.plan || []).length ? rep.plan.map((a, i) => `<div class="plan-step"><span class="ps-n">${i + 1}</span><div class="grow"><b>${h(a.titre)}</b><span class="small">${h(a.pourquoi || '')}</span></div><button class="btn sm v" ${actBtn(a)}>Go</button></div>`).join('') : '<div class="card"><p class="small">Fais quelques missions : ton plan apparaîtra ici.</p></div>'}</section>
  <p class="note">Nova Coach ne reçoit ni ton nom ni ton adresse : seulement tes statistiques d’apprentissage. Il t’aide à progresser, il ne donne pas de conseil en investissement.</p>
  ${legal()}</div>`; };
/* « Nouvelle conversation » */
document.addEventListener('click', ev => { const b = ev.target.closest('[data-coachnew]'); if (!b || b.disabled || !NT_FX.coachapp) return; S.coach = []; save(); render(); });
/* après un envoi, le clavier reste ouvert (comme ChatGPT) */
document.addEventListener('submit', ev => { if (ev.target.id !== 'coachF' || !NT_FX.coachapp) return; const i = document.getElementById('coachIn'); if (i) i.focus({ preventScroll: true }); });
/* la barre d'écriture reste au-dessus du clavier ; la conversation s'ouvre sur le dernier message */
function cgVV(){ const vv = window.visualViewport; if (!vv) return; const kb = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)); document.documentElement.style.setProperty('--cg-kb', kb + 'px'); }
if (window.visualViewport){ visualViewport.addEventListener('resize', cgVV, { passive: true }); visualViewport.addEventListener('scroll', cgVV, { passive: true }); }
function cgMount(){ const on = NT_FX.coachapp && (S.page === 'coach' || S.page === 'suivi'); document.body.classList.toggle('nt-app', on); if (!on || S.page !== 'coach') return;
  const cg = document.querySelector('.cg'), dk = document.querySelector('.cg-dock'); if (!cg || !dk) return; cgVV();
  const setH = () => cg.style.setProperty('--cgd', dk.offsetHeight + 'px'); setH(); if ('ResizeObserver' in window && !dk.__ro){ dk.__ro = new ResizeObserver(setH); dk.__ro.observe(dk); }
  if (S.coach.length) requestAnimationFrame(() => scrollTo(0, document.documentElement.scrollHeight)); }
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(cgMount).observe(app, { childList: true }); cgMount(); })();


/* ============================================================
   V37 — NOVA COACH : SOBRE COMME CHATGPT + TEMPLE LUMINEUX (03/11/2026)
   Thomas : « pas assez comme ChatGPT, trop vide, couleurs, tailles » →
   direction choisie : « ChatGPT + effet NovaTitre ».
   - Fond noir, gris de ChatGPT, tailles calquées sur l'appli ChatGPT.
   - Au centre : le temple NovaTitre en points lumineux. Quand tu envoies une
     question, les points se dispersent en tourbillon (Nova réfléchit) ; quand
     Nova répond, le temple se reconstruit de bas en haut.
   - La réponse s'écrit mot à mot. Bulle grise à droite pour toi, texte libre
     pour Nova. Barre d'écriture : pilule, puis rectangle arrondi quand on écrit.
   - Questions toutes prêtes en petites cartes, comme les suggestions de ChatGPT.
   Interrupteurs : NT_FX.coachapp = false → ancien Coach ; NT_FX.coachgl = false → sans temple 3D.
   ============================================================ */
NT_FX.coachgl = NT_FX.coachgl !== false;
const CG_CARDS = [['C’est quoi un ETF ?', 'en une minute'], ['Le spread ?', 'expliqué simplement'], ['PEA ou compte-titres ?', 'les différences'], ['Je dois acheter quoi ?', 'ce que Nova peut te dire']];
const CGW = { busy: false, type: false };
const _coachV36 = PAGES.coach;
PAGES.coach = () => { if (!NT_FX.coachapp) return _coachV36();
  const empty = !S.coach.length, gl = GL_OK() && NT_FX.coachgl;
  return `<div class="cg cg2 ${empty ? 'cg-empty' : ''}">${cgBar('coach')}
  <main class="cg-main">
    ${empty ? `<div class="cg-hello"><div class="cg-tpl ${gl ? 'gl' : ''}" aria-hidden="true">${TEMPLE_SVG}</div><h1>Que <span class="cg-nw">veux-tu</span> comprendre&nbsp;?</h1></div>` : ''}
    <div class="cg-msgs" id="cmsgs" aria-live="polite">${S.coach.map(m => `<div class="bub ${m.me ? 'me' : 'them'}"><small>${m.me ? 'Toi' : 'Nova Coach'}</small>${m.me ? h(m.t) : coachText(m.t)}</div>`).join('')}</div>
  </main>
  <div class="cg-dock">
    ${empty ? `<div class="cg-cards">${CG_CARDS.map(([q, s]) => `<button data-ask="${h(q)}"><b>${h(q)}</b><span>${h(s)}</span></button>`).join('')}</div>` : ''}
    <form class="cg-in" id="coachF"><label class="sr" for="coachIn">Ta question</label><input id="coachIn" placeholder="Demander à Nova Coach" autocomplete="off" enterkeyhint="send"><button class="cg-send" aria-label="Envoyer">${OI.spark}</button></form>
    <p class="cg-note">Nova Coach peut se tromper. Il explique, il ne donne pas de conseil en investissement.${aiOn() ? '' : ' Réponses préparées à l’avance.'}</p>
  </div></div>`; };
/* les questions : « réfléchit » (points en tourbillon), puis la réponse s'écrit et le temple se reconstruit */
const _askCoachV36 = askCoach;
askCoach = function(q){ q = String(q || '').trim(); if (!NT_FX.coachapp || !q) return _askCoachV36(q);
  if (CGW.busy) return; cglThink();
  if (aiOn()){ CGW.busy = true; const pr = _askCoachV36(q); Promise.resolve(pr).finally(() => { CGW.busy = false; cglAnswer(); }); return pr; }
  const a = (COACH.find(([re]) => re.test(q)) || [null, 'Bonne question ! Dans la vraie version, je te réponds en détail avec des exemples. Ici, essaie : ETF, spread, PEA, dividende ou arnaque.'])[1];
  /* la page n'est redessinée qu'au premier message (l'écran de départ disparaît) : ensuite on ajoute les bulles, le clavier reste ouvert */
  const first = !S.coach.length || !$('#cmsgs'); S.coach.push({ me: 1, t: q }); S.coach = S.coach.slice(-30); save(); CGW.busy = true;
  if (first) render(); else { const u = document.createElement('div'); u.className = 'bub me'; u.innerHTML = `<small>Toi</small>${h(q)}`; $('#cmsgs').appendChild(u); const i = $('#coachIn'); if (i) i.value = ''; }
  const msgs = $('#cmsgs'); let tb = null; if (msgs){ tb = document.createElement('div'); tb.className = 'bub them'; tb.innerHTML = '<small>Nova Coach</small><span class="thinking">Nova Coach réfléchit…</span>'; msgs.appendChild(tb); tb.scrollIntoView({ block: 'end', behavior: RM() ? 'auto' : 'smooth' }); }
  setTimeout(() => { CGW.busy = false; S.coach.push({ me: 0, t: a }); S.coach = S.coach.slice(-30); save();
    if (tb && tb.isConnected && S.page === 'coach'){ tb.innerHTML = `<small>Nova Coach</small>${coachText(a)}`; CGW.type = true; cgType(tb); tb.scrollIntoView({ block: 'end', behavior: RM() ? 'auto' : 'smooth' }); } else render();
    cglAnswer(); }, RM() ? 0 : 750); };
/* la réponse locale s'écrit mot à mot (simple apparition, le texte est déjà à sa place) */
function cgType(el){ if (!CGW.type) return; CGW.type = false; if (RM()) return; const all = document.querySelectorAll('#cmsgs .bub.them'), b = el && el.nodeType === 1 ? el : all[all.length - 1]; if (!b) return;
  const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('small, button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT }), nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
  let k = 0; const total = nodes.reduce((s, n) => s + n.nodeValue.split(/\s+/).length, 0), step = Math.min(26, 1500 / Math.max(1, total));
  nodes.forEach(n => { const f = document.createDocumentFragment(); n.nodeValue.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) return f.appendChild(document.createTextNode(w)); const s = document.createElement('span'); s.className = 'cg-w'; s.style.animationDelay = Math.round(k++ * step) + 'ms'; s.textContent = w; f.appendChild(s); }); n.replaceWith(f); });
  b.querySelectorAll('.cbtn').forEach(x => { x.classList.add('cg-w'); x.style.animationDelay = Math.round(k * step) + 'ms'; }); }
/* le temple en points lumineux */
const CGL = { P: null, cv: null, im: null, kind: null, idle: 0, t: 0 };
function cglView(){ const P = CGL.P, v = P.view(), empty = !!document.querySelector('.cg-empty'), w = Math.min(v.w * 0.74, v.h * 0.4);
  if (empty){ const el = document.querySelector('.cg-tpl'); if (el){ const r = NTGL.rectToWorld(P, el); return { w: r.w, x: r.x, y: r.y }; } } return { w, x: 0, y: v.h * 0.04 }; }
function cglShape(kind, dur = 1500, o = {}){ const P = CGL.P; if (!P || !CGL.im) return; CGL.kind = kind; const n = Math.floor(P.N * 0.92), at = cglView();
  if (kind === 'orb'){ const g = genOrb(n, at.w * 0.95, at.y); g.pts.forEach(p => { p[0] += at.x; }); P.warp(0.55); P.morph(g.pts, 900, { spin: 0.9, tint: ['#ffffff', '#c4b5ff', '#8fb4ff'] }); return; }
  const pts = NTGL.imgPts(CGL.im, n, { w: at.w, x: at.x, y: at.y, depth: 0.09 }); P.morph(pts, dur, Object.assign({ spin: 0, tint: ['#ffffff', '#d9d0ff', '#a9c4ff'] }, o)); }
function cglOpacity(v){ if (CGL.cv) CGL.cv.style.opacity = String(v); }
function cglRest(){ CGL.react = false; cglOpacity(document.querySelector('.cg-empty') ? 0.95 : 0.16); if (CGL.P) CGL.P.o.maxFps = 30; }
function cglThink(){ if (!CGL.P) return; clearTimeout(CGL.t); CGL.react = true; CGL.P.o.maxFps = 60; cglOpacity(0.6); cglShape('orb'); }
/* retour de face : la rotation du tourbillon se termine sur un tour complet, le temple revient bien de face */
function cglAnswer(){ if (!CGL.P) return; clearTimeout(CGL.t); CGL.react = true; const P = CGL.P, T2 = Math.PI * 2; P.spinA = Math.ceil((P.spinA || 0) / T2) * T2; P.o.maxFps = 60; cglOpacity(0.6); cglShape('temple', 1700, { order: 'build' }); CGL.t = setTimeout(cglRest, 2600); }
function cglMount(){ const on = NT_FX.coachapp && NT_FX.coachgl && S.page === 'coach' && document.querySelector('.cg2');
  document.body.classList.toggle('cg-black', !!(NT_FX.coachapp && S.page === 'coach'));
  if (!on){ if (CGL.cv) cglOpacity(0); return; } if (!GL_OK()) return;
  if (!CGL.cv){ CGL.cv = document.createElement('canvas'); CGL.cv.className = 'cg-gl'; CGL.cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(CGL.cv);
    try { CGL.P = new NTGL.Particles(CGL.cv, { count: NTGL.mobile ? 6000 : 12000, dprMax: NTGL.mobile ? 1.25 : 1.5, maxFps: 30, stars: false, camZ: 6, spread: 3.2, sway: 0.3, camSway: 0.35,
        pauseIf: () => S.page !== 'coach' || !!document.getElementById('player') || document.body.classList.contains('nt-covered') });
      CGL.P.u.uScale.value = NTGL.mobile ? 19 : 16; CGL.P.u.uAlpha.value = 1.9; }
    catch(e){ CGL.cv.remove(); CGL.cv = null; CGL.P = null; return; }
    NTGL.loadSVG('temple', TEMPLE_W()).then(im => { CGL.im = im; if (S.page === 'coach'){ cglShape('temple', 2000, { order: 'build' }); cglRest(); } }); return; }
  if (CGL.react) return; if (CGL.im && !CGW.busy && CGL.kind !== 'orb'){ cglShape('temple', 1200); } cglRest(); }
/* le bouton d'envoi garde le clavier ouvert (pas de saut de mise en page au moment du toucher) */
['pointerdown', 'mousedown'].forEach(t => document.addEventListener(t, ev => { if (ev.target.closest && ev.target.closest('.cg2 .cg-send')) ev.preventDefault(); }));
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(() => { cglMount(); if (S.page === 'coach') cgType(); }).observe(app, { childList: true }); cglMount(); })();
addEventListener('resize', () => { if (CGL.P && S.page === 'coach' && CGL.kind === 'temple') cglShape('temple', 600); }, { passive: true });


/* ============================================================
   V38 — CONNEXION : GOOGLE OU CODE PAR E-MAIL (03/11/2026)
   Thomas : connexion Google + connexion par e-mail (code à 6 chiffres,
   sans mot de passe). Le compte est OBLIGATOIRE pour faire le parcours
   (missions, séances, examens, épreuves, révisions) ; le reste du site
   (accueil, marchés, coach, jeux) reste ouvert.
   - Page « connexion » plein écran : Continuer avec Google, ou e-mail →
     code reçu → connecté. Après la connexion, l'action demandée reprend
     toute seule (ex. la mission qu'on voulait lancer).
   - Branchement (aucune clé ajoutée ici) : window.NT_AUTH
       { mode: 'supabase', client: <client Supabase déjà créé par le site> }
       ou { mode: 'api', base: '/api/auth' }   (contrat : docs/CONNEXION.md)
   - Sans branchement : sur novatitre.com et *.vercel.app, la connexion est
     « indisponible » et rien n'est bloqué ; ailleurs (aperçu), mode
     démonstration clairement indiqué (aucun e-mail envoyé, code 123456).
   - L'e-mail ne part jamais vers l'IA.
   Interrupteur : NT_FX.auth = false → pas de connexion, rien de bloqué.
   ============================================================ */
NT_FX.auth = NT_FX.auth !== false;
const AUTH = {
  cfg(){ const c = window.NT_AUTH; return c && (c.mode === 'supabase' ? c.client && c.client.auth : c.mode === 'api') ? c : null; },
  demo(){ return !this.cfg() && !/(^|\.)novatitre\.com$|\.vercel\.app$/i.test(location.hostname || ''); },
  ready(){ return NT_FX.auth && (!!this.cfg() || this.demo()); },
  base(){ return (this.cfg().base || '/api/auth').replace(/\/$/, ''); },
  back(){ return location.origin && location.origin !== 'null' ? location.origin + location.pathname : location.href.split('#')[0]; },
  async j(path, body){ const r = await fetch(this.base() + path, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {}, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) return null; if (!r.ok){ const e = new Error('http ' + r.status); e.status = r.status; throw e; } return r.status === 204 ? {} : r.json().catch(() => ({})); },
  user(u, p){ return u ? { email: u.email || '', provider: p || (u.app_metadata && u.app_metadata.provider) || 'email', since: today() } : null; },
  async google(){ const c = this.cfg();
    if (!c){ return this.user({ email: 'compte Google (aperçu)' }, 'google'); }
    if (c.mode === 'supabase'){ const { error } = await c.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: this.back() } }); if (error) throw error; return 'redirect'; }
    location.href = this.base() + '/google?redirect=' + encodeURIComponent(this.back()); return 'redirect'; },
  async sendCode(email){ const c = this.cfg(); if (!c) return;
    if (c.mode === 'supabase'){ const { error } = await c.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }); if (error) throw error; return; }
    await this.j('/email/start', { email }); },
  async verify(email, code){ const c = this.cfg();
    if (!c){ if (code !== '123456'){ const e = new Error('code'); e.status = 400; throw e; } return this.user({ email }, 'email'); }
    if (c.mode === 'supabase'){ const { data, error } = await c.client.auth.verifyOtp({ email, token: code, type: 'email' }); if (error) throw error; return this.user(data.user, 'email'); }
    const r = await this.j('/email/verify', { email, code }); if (!r || !r.user){ const e = new Error('code'); e.status = 400; throw e; } return this.user(r.user, 'email'); },
  async session(){ const c = this.cfg(); if (!c) return undefined;
    if (c.mode === 'supabase'){ const { data } = await c.client.auth.getSession(); return this.user(data && data.session && data.session.user); }
    const r = await this.j('/session'); return this.user(r && r.user); },
  async logout(){ const c = this.cfg(); if (!c) return; if (c.mode === 'supabase') await c.client.auth.signOut(); else await this.j('/logout', {}); },
  err(e){ const s = e && (e.status || 0), m = String((e && e.message) || '');
    return /code|token|otp|expired|invalid/i.test(m) || s === 400 || s === 403 ? 'Code incorrect ou expiré. Vérifie les 6 chiffres ou demande un nouveau code.'
      : s === 429 || /rate|many/i.test(m) ? 'Trop d’essais d’un coup. Attends une minute, puis réessaie.'
      : /fetch|network|failed/i.test(m) ? 'Pas de connexion internet. Vérifie ton réseau, puis réessaie.' : 'La connexion n’a pas marché. Réessaie dans un instant.'; } };
const AU = { step: 'start', email: '', busy: false, err: '', resendAt: 0, from: 'home', reason: '' };
const authed = () => !AUTH.ready() || !!S.account;
const AU_GATE = ['play', 'sheetplay', 'eclair', 'replay', 'session', 'exam', 'epreuve', 'review'];
const AU_KEY = 'nt-auth-next';
function authOpen(reason, next){ if (S.page !== 'connexion') AU.from = S.page || 'home'; AU.reason = reason || ''; AU.err = ''; AU.busy = false; if (AU.step !== 'code') AU.step = 'start';
  try { if (next) sessionStorage.setItem(AU_KEY, JSON.stringify(next)); } catch(e){} go('connexion'); }
function authDone(u){ S.account = u; save(); syncPremium(); AU.step = 'start'; AU.err = ''; AU.busy = false; toast(u.provider === 'google' ? 'Connecté avec Google.' : 'Connecté.');
  let next = null; try { next = JSON.parse(sessionStorage.getItem(AU_KEY) || 'null'); sessionStorage.removeItem(AU_KEY); } catch(e){}
  go(next && next.page ? next.page : AU.from && AU.from !== 'connexion' ? AU.from : 'home');
  if (next && next.k && AU_GATE.includes(next.k)) setTimeout(() => { const b = document.createElement('button'); b.hidden = true; b.dataset[next.k] = next.v; document.body.appendChild(b); b.click(); b.remove(); }, 350); }
/* le parcours demande un compte : on intercepte le clic AVANT les autres actions */
window.addEventListener('click', ev => { if (authed() || !ev.target.closest) return; const b = ev.target.closest(AU_GATE.map(k => `[data-${k}]`).join(',')); if (!b || b.disabled) return;
  const k = AU_GATE.find(x => b.dataset[x] !== undefined); ev.preventDefault(); ev.stopImmediatePropagation();
  authOpen('parcours', { k, v: b.dataset[k], page: S.page === 'connexion' ? 'home' : S.page }); }, true);
/* logo Google : le fichier OFFICIEL fourni par Google (règles de marque) est à ajouter par le site ; on l'affiche seulement s'il est déclaré */
const AU_G = () => window.NT_GOOGLE_ICON ? `<img class="au-g" src="${h(window.NT_GOOGLE_ICON)}" alt="" width="20" height="20">` : '';
PAGES.connexion = () => { const ok = AUTH.ready(), demo = AUTH.demo() && NT_FX.auth, wait = Math.max(0, Math.ceil((AU.resendAt - Date.now()) / 1000));
  return `<div class="au">
  <header class="au-top"><button class="cg-ib" data-authclose aria-label="Fermer">${I.x}</button></header>
  <main class="au-main">
    <div class="au-tpl" aria-hidden="true">${TEMPLE_SVG}</div>
    ${S.account ? `<h1>Tu es connecté.</h1><p class="au-sub">${h(S.account.email)}</p><div class="au-acts"><button class="au-b1" data-go="home">Aller à l’accueil</button><button class="au-b2" data-authlogout>Se déconnecter</button></div>`
    : !ok ? `<h1>Connexion bientôt disponible.</h1><p class="au-sub">La connexion n’est pas encore branchée sur cette version. Tu peux continuer à découvrir NovaTitre.</p><div class="au-acts"><button class="au-b1" data-authclose>Continuer</button></div>`
    : AU.step === 'code' ? `<h1>Entre ton code.</h1><p class="au-sub">On a envoyé un code à 6 chiffres à <b>${h(AU.email)}</b>.</p>
      <form class="au-form" id="authCode" novalidate><label class="sr" for="authOtp">Code à 6 chiffres</label><input id="authOtp" class="au-otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="······" ${AU.busy ? 'disabled' : ''}>
        <button class="au-b1" ${AU.busy ? 'disabled' : ''}>${AU.busy ? 'Vérification…' : 'Se connecter'}</button></form>
      ${AU.err ? `<p class="au-err" role="alert">${h(AU.err)}</p>` : ''}
      <div class="au-links"><button data-authresend ${wait ? 'disabled' : ''}>${wait ? `Renvoyer le code (${wait} s)` : 'Renvoyer le code'}</button><button data-authback>Changer d’e-mail</button></div>`
    : `<h1>${AU.reason === 'parcours' ? 'Connecte-toi pour faire ton parcours.' : 'Bienvenue sur NovaTitre.'}</h1>
      <p class="au-sub">Ta progression, tes certificats et ton portefeuille fictif restent sauvegardés sur tous tes appareils.</p>
      <button class="au-google" data-authgoogle ${AU.busy ? 'disabled' : ''}>${AU_G()}<span>Continuer avec Google</span></button>
      <div class="au-or" aria-hidden="true"><i></i><span>ou</span><i></i></div>
      <form class="au-form" id="authMail" novalidate><label class="sr" for="authEmail">Ton adresse e-mail</label><input id="authEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="Ton adresse e-mail" value="${h(AU.email)}" ${AU.busy ? 'disabled' : ''}>
        <button class="au-b2" ${AU.busy ? 'disabled' : ''}>${AU.busy ? 'Envoi…' : 'Recevoir un code par e-mail'}</button></form>
      ${AU.err ? `<p class="au-err" role="alert">${h(AU.err)}</p>` : ''}`}
    ${demo && !S.account ? `<p class="au-demo">Aperçu : la connexion n’est pas encore branchée, aucun e-mail n’est envoyé.${AU.step === 'code' ? ' Tape 123456 pour continuer.' : ''}</p>` : ''}
  </main>
  <footer class="au-legal">En continuant, tu acceptes les conditions d’utilisation et la politique de confidentialité de NovaTitre. NovaTitre est une école : argent fictif uniquement, aucun conseil en investissement.</footer></div>`; };
/* actions de la page */
document.addEventListener('click', async ev => { if (!ev.target.closest) return; const t = ev.target.closest('[data-authclose],[data-authgoogle],[data-authresend],[data-authback],[data-authlogout]'); if (!t || t.disabled) return; const d = t.dataset;
  if (d.authclose !== undefined){ AU.step = 'start'; AU.err = ''; try { sessionStorage.removeItem(AU_KEY); } catch(e){} return go(AU.from && AU.from !== 'connexion' ? AU.from : 'home'); }
  if (d.authback !== undefined){ AU.step = 'start'; AU.err = ''; return render(); }
  if (d.authlogout !== undefined){ try { await AUTH.logout(); } catch(e){} S.account = null; save(); syncPremium(); toast('Tu es déconnecté.'); return render(); }
  if (d.authgoogle !== undefined){ AU.busy = true; AU.err = ''; render(); try { const r = await AUTH.google(); if (r && r !== 'redirect') authDone(r); } catch(e){ AU.busy = false; AU.err = AUTH.err(e); render(); } return; }
  if (d.authresend !== undefined){ AU.busy = true; render(); try { await AUTH.sendCode(AU.email); AU.resendAt = Date.now() + 30000; toast('Nouveau code envoyé.'); } catch(e){ AU.err = AUTH.err(e); } AU.busy = false; render(); } });
document.addEventListener('submit', async ev => { const id = ev.target.id; if (id !== 'authMail' && id !== 'authCode') return; ev.preventDefault();
  if (id === 'authMail'){ const v = (document.getElementById('authEmail').value || '').trim().toLowerCase(); AU.email = v;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)){ AU.err = 'Cette adresse e-mail ne semble pas valide.'; return render(); }
    AU.busy = true; AU.err = ''; render(); try { await AUTH.sendCode(v); AU.step = 'code'; AU.resendAt = Date.now() + 30000; } catch(e){ AU.err = AUTH.err(e); } AU.busy = false; render(); setTimeout(() => { const i = document.getElementById('authOtp'); if (i) i.focus(); }, 60); return; }
  const code = (document.getElementById('authOtp').value || '').replace(/\D/g, ''); if (code.length !== 6){ AU.err = 'Le code fait 6 chiffres.'; return render(); }
  AU.busy = true; AU.err = ''; render(); try { authDone(await AUTH.verify(AU.email, code)); } catch(e){ AU.busy = false; AU.err = AUTH.err(e); render(); } });
/* le code se valide tout seul quand les 6 chiffres sont là ; le compte à rebours de « Renvoyer » avance */
document.addEventListener('input', ev => { if (ev.target.id !== 'authOtp') return; const v = ev.target.value.replace(/\D/g, '').slice(0, 6); if (ev.target.value !== v) ev.target.value = v; if (v.length === 6 && !AU.busy) ev.target.form.requestSubmit ? ev.target.form.requestSubmit() : ev.target.form.dispatchEvent(new Event('submit', { cancelable: true })); });
setInterval(() => { if (S.page === 'connexion' && AU.step === 'code' && AU.resendAt > Date.now() - 1000){ const b = document.querySelector('[data-authresend]'); if (b){ const w = Math.max(0, Math.ceil((AU.resendAt - Date.now()) / 1000)); b.disabled = !!w; b.textContent = w ? `Renvoyer le code (${w} s)` : 'Renvoyer le code'; } } }, 1000);
/* le compte dans le Profil */
const _profileV37 = PAGES.profile;
PAGES.profile = () => { const out = _profileV37(); if (!NT_FX.auth || !AUTH.ready()) return out; const at = '<section class="card"><div class="scorebox">'; if (out.indexOf(at) < 0) return out;
  const card = S.account ? `<section class="au-card"><span class="au-card-k">Mon compte</span><b>${h(S.account.email)}</b><span class="au-card-s">${S.account.provider === 'google' ? 'Connecté avec Google' : 'Connecté par e-mail'}</span><button class="au-b2 sm" data-authlogout>Se déconnecter</button></section>`
    : `<section class="au-card"><span class="au-card-k">Mon compte</span><b>Pas encore connecté</b><span class="au-card-s">Connecte-toi pour faire ton parcours et garder ta progression.</span><button class="au-b1 sm" data-go="connexion">Se connecter</button></section>`;
  return out.replace(at, card + at); };
/* au chargement : on récupère la session (retour de Google compris) et on reprend l'action en attente */
(function(){ document.body.classList.toggle('nt-app', S.page === 'connexion'); syncPremium();
  const app = document.getElementById('app'); if (app) new MutationObserver(() => { if (S.page === 'connexion'){ document.body.classList.add('nt-app'); document.title = 'NovaTitre — Connexion'; } }).observe(app, { childList: true });
  if (!AUTH.cfg()) return; const was = !!S.account;
  AUTH.session().then(u => { if (u === undefined) return; if (u){ let next = null; try { next = sessionStorage.getItem(AU_KEY); } catch(e){} if (!was || next){ AU.from = S.page; return authDone(u); } S.account = Object.assign({}, S.account, u); save(); }
    else if (was){ S.account = null; save(); render(); } }).catch(() => {});
  const c = AUTH.cfg(); if (c.mode === 'supabase' && c.client.auth.onAuthStateChange) c.client.auth.onAuthStateChange((ev2, sess) => { if (ev2 === 'SIGNED_OUT' && S.account){ S.account = null; save(); render(); } }); })();


/* ============================================================
   V39 — LE MONDE DE LA BOURSE : FOND 3D DE L'ACCUEIL (03/11/2026)
   Thomas : « revoir les animations de fond… que je me dise waouh »,
   inspiré des sites Montfort (voyage continu, traversée de nuages) et
   Valmora (blocs qui s'ouvrent). Le CONTENU de l'accueil ne change pas.
   - Derrière l'accueil : un paysage de montagnes fait de courbes de Bourse
     lumineuses (formes décoratives, pas des données). Des impulsions de
     lumière courent le long des courbes.
   - En descendant, la caméra survole le paysage avec de l'inertie, traverse
     deux bancs de nuages entre les parties, et finit en regardant le ciel.
   - Le ciel passe du noir au bleu (comme le dégradé d'avant). Des cotations
     (mêmes valeurs que l'accueil) flottent dans l'air.
   - À l'arrivée sur l'accueil, la caméra plonge en douceur vers sa place.
   - Économie : une seule scène, image figée quand une mission, une vidéo ou
     une fenêtre couvre l'écran, qualité qui baisse seule si l'appareil peine.
   Interrupteur : NT_FX.world = false → fond d'avant. Sans 3D ou avec
   « réduire les animations » : fond d'avant.
   ============================================================ */
NT_FX.world = NT_FX.world === true;   /* V41 : le paysage 3D n'est plus affiché par défaut (Thomas : « ça ne va pas avec la Bourse ») */
const MW = { r: null, cv: null, scene: null, cam: null, u: null, t: -0.14, tt: 0, last: 0, raf: 0, run: false, ft: [], q: ((navigator.deviceMemory || 8) < 4 || (navigator.hardwareConcurrency || 8) <= 4) ? 0.8 : 1, px: 0, py: 0, roll: 0, prevX: 0, sprites: [] };
function mwRnd(seed){ let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* une « courbe de Bourse » : marche au hasard avec des régimes (tendance, calme, choc), normalisée de 0 à 1 */
function mwWalk(n, seed){ const r = mwRnd(seed), out = []; let p = 0, v = 0, dr = (r() - 0.5) * 0.05, vol = 1;
  for (let i = 0; i < n; i++){ if (r() < 0.05) dr = (r() - 0.5) * 0.09; if (r() < 0.04) vol = 0.5 + r() * 1.4; v = v * 0.35 + (r() - 0.5) * 0.42 * vol + dr; if (r() < 0.01) v += (r() - 0.5) * 2.2; p += v; out.push(p); }
  const mn = Math.min(...out), mx = Math.max(...out); return out.map(x => (x - mn) / (mx - mn || 1)); }
const MW_KEYS = [ /* t, position caméra, point regardé */
  [-0.15, [0, 15, 36], [0, 4, -40]],
  [0.00, [0, 7.6, 15], [0, 3.0, -40]],
  [0.14, [0, 5.0, 2], [0, 1.9, -45]],
  [0.30, [-2.6, 2.7, -22], [1.2, 1.5, -62]],
  [0.44, [0.4, 2.3, -50], [0, 1.8, -92]],
  [0.60, [3.0, 2.0, -73], [-2, 2.6, -112]],
  [0.76, [-2.2, 1.5, -95], [2, 1.4, -132]],
  [0.88, [0, 3.0, -111], [0, 2.4, -150]],
  [1.00, [0, 17, -122], [0, -2, -178]] ];
const MW_SKY = [ /* t, haut du ciel, horizon */
  [0.0, '#000000', '#0a1033'], [0.3, '#01030c', '#0c1d5a'], [0.6, '#030b2c', '#1540a8'], [1.0, '#071640', '#2a63e6'] ];
/* V40 (même soir) — QUALITÉ : Thomas « la qualité, c'est super important ».
   - Les courbes ne sont plus des traits de 1 pixel : ce sont de vrais rubans lumineux,
     lissés (sans crénelage), avec un cœur net et un halo doux, nets sur les écrans Retina.
   - Plus les anciens points (sommets du paysage, objets en points de l'accueil).
   - Nuages en vraies nappes de brume (texture douce), étoiles rondes qui scintillent,
     ciel sans bandes (léger grain), cotations nettes (texture double résolution).
   - Rendu jusqu'à 2× la résolution de l'écran ; la qualité ne baisse que si l'appareil peine. */
function mwCloudTex(){ const T = window.THREE, c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), r = mwRnd(7);
  for (let k = 0; k < 46; k++){ const a = r() * 6.283, d = Math.pow(r(), 0.7) * 70, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * 0.55, R = 26 + r() * 62, gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, 'rgba(255,255,255,' + (0.10 + r() * 0.08).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  const im = g.getImageData(0, 0, 256, 256), dd = im.data; for (let i = 0; i < 256 * 256; i++){ const x = i % 256 - 128, y = (i >> 8) - 128, f = Math.max(0, 1 - Math.sqrt(x * x + y * y) / 128); dd[i * 4 + 3] = dd[i * 4 + 3] * f * f; } g.putImageData(im, 0, 0);
  const t = new T.CanvasTexture(c); return t; }
function mwBuild(){ const T = window.THREE, mob = NTGL.mobile, W = 48, D = 200, nx = mob ? 170 : 240, nz = mob ? 92 : 130, VW = mob ? 9 : 14;
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(58, 1, 0.1, 400);
  const u = { uTime: { value: 0 }, uFog: { value: new T.Color('#0a1033') }, uNear: { value: 18 }, uFar: { value: 120 }, uPix: { value: 1 }, uRes: { value: new T.Vector2(1, 1) }, uW: { value: mob ? 1.9 : 1.6 },
    uC1: { value: new T.Color('#3a3fb0') }, uC2: { value: new T.Color('#e4ddff') }, uC3: { value: new T.Color('#9fe8ff') }, uTop: { value: new T.Color('#000') }, uHor: { value: new T.Color('#0a1033') } };
  /* ciel : dôme dégradé + lueur d'horizon + léger grain (pas de bandes de couleur) */
  const sky = new T.Mesh(new T.SphereGeometry(300, 48, 24), new T.ShaderMaterial({ uniforms: u, side: T.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uHor; varying vec3 vP; void main(){ float h = clamp(vP.y, -1.0, 1.0); float k = smoothstep(-0.05, 0.6, h); vec3 c = mix(uHor, uTop, k); c += uHor * 0.6 * exp(-abs(h - 0.015) * 24.0) + vec3(0.03, 0.05, 0.12) * exp(-abs(h) * 6.0); float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); c += (n - 0.5) * (2.0 / 255.0); gl_FragColor = vec4(c, 1.0); }' }));
  sky.renderOrder = -10; scene.add(sky);
  /* paysage : vallée au centre, montagnes sur les côtés, crêtes en zigzag comme des cours */
  const K = 14, walks = Array.from({ length: K }, (_, i) => mwWalk(nx, 1000 + i * 77)), ys = new Float32Array(nx * nz), hs = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++){ const f = j / (nz - 1) * (K - 1), a = Math.floor(f), b = Math.min(K - 1, a + 1), m = f - a, s = m * m * (3 - 2 * m), z = 10 - j / (nz - 1) * D;
    for (let i = 0; i < nx; i++){ const x = (i / (nx - 1) - 0.5) * W, w = walks[a][i] * (1 - s) + walks[b][i] * s, env = Math.pow(Math.min(1, Math.abs(x) / VW), 1.6);
      const peak = 6.5 * Math.exp(-(((x - 9) / 6) ** 2) - (((z + 66) / 14) ** 2)) + 5.2 * Math.exp(-(((x + 11) / 7) ** 2) - (((z + 104) / 16) ** 2));
      const y = -1.1 + 0.55 * w + env * (1.6 + 5.2 * w) + peak * (0.55 + 0.45 * w); ys[j * nx + i] = y; hs[j * nx + i] = Math.min(1, Math.max(0, (y + 1.1) / 9)); } }
  /* rubans : 2 sommets par point, écartés à l'écran d'une largeur fixe en pixels */
  const NV = nx * nz * 2, P = new Float32Array(NV * 3), PV = new Float32Array(NV * 3), NX = new Float32Array(NV * 3), SD = new Float32Array(NV), RW = new Float32Array(NV), HH = new Float32Array(NV);
  const at = (i, j, o, arr, n) => { arr[n * 3] = (i / (nx - 1) - 0.5) * W; arr[n * 3 + 1] = ys[j * nx + i]; arr[n * 3 + 2] = 10 - j / (nz - 1) * D; };
  let v = 0; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) for (const sd of [-1, 1]){ at(i, j, 0, P, v); at(Math.max(0, i - 1), j, 0, PV, v); at(Math.min(nx - 1, i + 1), j, 0, NX, v); SD[v] = sd; RW[v] = j; HH[v] = hs[j * nx + i]; v++; }
  const NI = (nx - 1) * nz * 6, IX = NV > 65535 ? new Uint32Array(NI) : new Uint16Array(NI); let q = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx - 1; i++){ const a = (j * nx + i) * 2; IX[q++] = a; IX[q++] = a + 1; IX[q++] = a + 2; IX[q++] = a + 1; IX[q++] = a + 3; IX[q++] = a + 2; }
  const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(P, 3)); rg.setAttribute('aPrev', new T.BufferAttribute(PV, 3)); rg.setAttribute('aNext', new T.BufferAttribute(NX, 3));
  rg.setAttribute('aSide', new T.BufferAttribute(SD, 1)); rg.setAttribute('aRow', new T.BufferAttribute(RW, 1)); rg.setAttribute('aH', new T.BufferAttribute(HH, 1)); rg.setIndex(new T.BufferAttribute(IX, 1)); rg.boundingSphere = new T.Sphere(new T.Vector3(0, 0, -60), 400);
  const ribbons = new T.Mesh(rg, new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    vertexShader: 'uniform float uTime; uniform float uPix; uniform float uW; uniform vec2 uRes; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uFog; uniform float uNear; uniform float uFar; attribute vec3 aPrev; attribute vec3 aNext; attribute float aSide; attribute float aRow; attribute float aH; varying float vS; varying vec3 vC; varying float vA;\n' +
      'void main(){ mat4 m = projectionMatrix * modelViewMatrix; vec4 c = m * vec4(position, 1.0); float d = c.w; if (d < 0.35){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vS = 0.0; vA = 0.0; vC = vec3(0.0); return; }\n' +
      ' vec4 p = m * vec4(aPrev, 1.0); vec4 n = m * vec4(aNext, 1.0); vec2 h = uRes * 0.5; vec2 dir = (n.xy / max(n.w, 0.05) - p.xy / max(p.w, 0.05)) * h; float L = length(dir); dir = L > 1e-4 ? dir / L : vec2(1.0, 0.0); vec2 nor = vec2(-dir.y, dir.x);\n' +
      ' float pl = pow(0.5 + 0.5 * sin(position.x * 0.32 - uTime * 1.7 + aRow * 1.37), 18.0); float fog = smoothstep(uNear, uFar, d);\n' +
      ' float w = uW * uPix * (0.8 + 0.6 * aH + pl * 0.9) * mix(1.0, 0.5, smoothstep(10.0, 80.0, d)); c.xy += nor * aSide * w / h * c.w;\n' +
      ' vec3 col = mix(uC1, uC2, aH * aH); col = mix(col, uC3, pl); vC = mix(col, uFog, fog); vA = (0.3 + 0.7 * aH + pl * 1.25) * (1.0 - fog) * smoothstep(0.6, 3.2, d) * mix(0.5, 1.0, smoothstep(3.0, 16.0, d)); vS = aSide; gl_Position = c; }',
    fragmentShader: 'varying float vS; varying vec3 vC; varying float vA; void main(){ float s = vS * vS; float a = exp(-s * 7.5) + 0.32 * exp(-s * 1.6); gl_FragColor = vec4(vC * vA * a * 0.78, 1.0); }' }));
  scene.add(ribbons);
  /* nuages : nappes de brume (texture douce), deux bancs traversés par la caméra */
  const r = mwRnd(42), tex = mwCloudTex(), nc = mob ? 46 : 74, clouds = [];
  for (let i = 0; i < nc; i++){ const band = i % 2 ? [-45, -61] : [-103, -119], sp = new T.Sprite(new T.SpriteMaterial({ map: tex, color: 0xbcd0ff, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    const s = 9 + r() * 14; sp.scale.set(s, s * (0.55 + r() * 0.25), 1); sp.position.set((r() - 0.5) * 40, 0.6 + r() * 5.5, band[0] + (band[1] - band[0]) * r()); sp.material.rotation = r() * 6.283; sp.userData.o = 0.35 + r() * 0.35; sp.userData.x = sp.position.x; scene.add(sp); clouds.push(sp); }
  /* étoiles rondes qui scintillent */
  const ns = mob ? 520 : 900, stp = new Float32Array(ns * 3), sts = new Float32Array(ns); for (let i = 0; i < ns; i++){ const a = r() * 6.283, b = Math.acos(0.12 + r() * 0.88), R = 220; stp[i * 3] = Math.sin(b) * Math.cos(a) * R; stp[i * 3 + 1] = Math.cos(b) * R * 0.9 + 6; stp[i * 3 + 2] = Math.sin(b) * Math.sin(a) * R - 80; sts[i] = r(); }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(stp, 3)); sg.setAttribute('aS', new T.BufferAttribute(sts, 1)); sg.boundingSphere = new T.Sphere(new T.Vector3(), 500);
  scene.add(new T.Points(sg, new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: 'uniform float uTime; uniform float uPix; attribute float aS; varying float vA; void main(){ vA = (0.45 + 0.55 * aS) * (0.65 + 0.35 * sin(uTime * (0.8 + aS * 2.2) + aS * 40.0)); gl_PointSize = uPix * (1.1 + aS * 1.8); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float a = exp(-dot(q, q) * 16.0); gl_FragColor = vec4(vec3(0.88, 0.91, 1.0) * a * vA, 1.0); }' })));
  /* voile de brume devant la caméra quand elle traverse un banc */
  const haze = new T.Mesh(new T.PlaneGeometry(4, 4), new T.MeshBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false })); haze.position.z = -0.5; haze.renderOrder = 10; cam.add(haze); scene.add(cam);
  MW.scene = scene; MW.cam = cam; MW.u = u; MW.sky = sky; MW.ribbons = ribbons; MW.clouds = clouds; MW.haze = haze; MW.dots = null;
  MW.cp = new T.CatmullRomCurve3(MW_KEYS.map(k => new T.Vector3(...k[1]))); MW.cl = new T.CatmullRomCurve3(MW_KEYS.map(k => new T.Vector3(...k[2])));
  mwTickers(); }
/* cotations qui flottent (mêmes valeurs que les lignes de l'accueil : cours réels datés, puis simulés) */
function mwTickers(){ const T = window.THREE, ids = [...new Set([...WATCH(), ...POP.actions, ...POP.paris])].map(mkFind).filter(Boolean).slice(0, NTGL.mobile ? 6 : 10);
  MW.sprites.forEach(s => { MW.scene.remove(s); s.material.map.dispose(); s.material.dispose(); }); MW.sprites = [];
  ids.forEach((s, i) => { const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const g = c.getContext('2d'), v = chg(s);
    g.font = '700 92px Inter, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.94)'; g.textBaseline = 'middle'; g.fillText(s.id, 28, 128); const w0 = g.measureText(s.id).width;
    g.font = '500 76px Inter, system-ui, sans-serif'; g.fillStyle = 'rgba(214,220,255,.78)'; g.fillText(money(s, px(s)), 80 + w0, 128); const w1 = g.measureText(money(s, px(s))).width;
    if (v != null){ g.fillStyle = v >= 0 ? 'rgba(63,211,154,.96)' : 'rgba(255,107,127,.96)'; g.fillText((v >= 0 ? '▲ ' : '▼ ') + num(Math.abs(v), 2) + ' %', 132 + w0 + w1, 128); }
    const tex = new T.CanvasTexture(c); tex.anisotropy = MW.r ? MW.r.capabilities.getMaxAnisotropy() : 1; const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    const side = i % 2 ? 1 : -1; sp.position.set(side * ((NTGL.mobile ? 3.4 : 5.2) + (i % 3) * 1.2), 3.6 + (i % 4) * 0.9, -12 - i * (NTGL.mobile ? 17 : 11)); sp.scale.set(5.2, 1.3, 1); sp.userData.base = sp.position.y; sp.userData.ph = i * 1.3;
    MW.scene.add(sp); MW.sprites.push(sp); }); }
function mwSkyAt(t){ const T = window.THREE; let a = MW_SKY[0], b = MW_SKY[MW_SKY.length - 1]; for (let i = 0; i < MW_SKY.length - 1; i++) if (t >= MW_SKY[i][0] && t <= MW_SKY[i + 1][0]){ a = MW_SKY[i]; b = MW_SKY[i + 1]; break; }
  const f = Math.max(0, Math.min(1, (t - a[0]) / ((b[0] - a[0]) || 1))); MW.u.uTop.value.set(a[1]).lerp(new T.Color(b[1]), f); MW.u.uHor.value.set(a[2]).lerp(new T.Color(b[2]), f); MW.u.uFog.value.copy(MW.u.uHor.value); }
function mwCamAt(t){ const K = MW_KEYS, n = K.length; let i = 0; while (i < n - 2 && t > K[i + 1][0]) i++; const f = Math.max(0, Math.min(1, (t - K[i][0]) / (K[i + 1][0] - K[i][0]))), e = f * f * (3 - 2 * f), uu = (i + e) / (n - 1);
  return [MW.cp.getPoint(uu), MW.cl.getPoint(uu)]; }
function mwTarget(){ const H = document.documentElement.scrollHeight - innerHeight; return H > 0 ? Math.max(0, Math.min(1, scrollY / H)) : 0; }
function mwSize(){ if (!MW.r) return; const w = innerWidth, h = innerHeight, d = Math.max(1, Math.min(2, devicePixelRatio || 1) * MW.q); MW.r.setPixelRatio(d); MW.r.setSize(w, h, false); MW.cam.aspect = w / h; MW.cam.updateProjectionMatrix(); MW.u.uPix.value = d; MW.u.uRes.value.set(w * d, h * d); }
const mwBusy = () => !!(document.getElementById('player') || document.getElementById('xo') || document.getElementById('sheet') || document.querySelector('.nt-intro') || document.body.classList.contains('nt-covered'));
function mwLoop(now){ MW.raf = requestAnimationFrame(mwLoop); if (!MW.run || document.hidden || mwBusy()){ MW.last = 0; return; }
  const mf = NTGL.mobile ? 50 : 60; if (MW.last && now - MW.last < 1000 / mf - 3) return; const dt = MW.last ? Math.min(100, now - MW.last) : 16.7; MW.last = now;
  /* qualité automatique */ MW.ft.push(dt); if (MW.ft.length >= 50){ const avg = MW.ft.reduce((a, b) => a + b, 0) / MW.ft.length; MW.ft = []; if (avg > 26 && MW.q > 0.65){ MW.q = MW.q === 1 ? 0.8 : 0.65; mwSize(); } }
  const tg = mwTarget(); MW.t += (tg - MW.t) * (1 - Math.exp(-dt / 1000 * 2.6));
  const [p, l] = mwCamAt(MW.t); MW.px += ((MW.ptx || 0) - MW.px) * 0.04; MW.py += ((MW.pty || 0) - MW.py) * 0.04;
  MW.cam.position.set(p.x + MW.px * 0.8, p.y + MW.py * 0.35, p.z); MW.cam.lookAt(l.x, l.y, l.z);
  const vx = (p.x - MW.prevX) / Math.max(1, dt) * 1000; MW.prevX = p.x; MW.roll += (Math.max(-0.12, Math.min(0.12, -vx * 0.035)) - MW.roll) * 0.05; MW.cam.rotateZ(MW.roll);
  MW.sky.position.copy(MW.cam.position); mwSkyAt(Math.max(0, MW.t)); MW.u.uTime.value = now / 1000;
  const cz = MW.cam.position.z, hz = Math.max(Math.exp(-(((cz + 53) / 6.5) ** 2)), Math.exp(-(((cz + 111) / 6.5) ** 2))) * (MW.cam.position.y < 6.5 ? 1 : 0); MW.haze.material.opacity = hz * 0.3;
  MW.clouds.forEach((c, i) => { const d = c.position.distanceTo(MW.cam.position); c.material.opacity = c.userData.o * Math.min(1, Math.max(0, (d - 2.5) / 7)) * (1 - Math.max(0, Math.min(1, (d - 40) / 30))); c.position.x = c.userData.x + Math.sin(now / 9000 + i) * 1.2; });
  const vel = Math.abs(MW.t - (MW.pt == null ? MW.t : MW.pt)) / Math.max(1, dt) * 1000; MW.pt = MW.t; const fv = 58 + Math.min(9, vel * 55); if (Math.abs(fv - MW.cam.fov) > 0.02){ MW.cam.fov += (fv - MW.cam.fov) * 0.08; MW.cam.updateProjectionMatrix(); }
  MW.sprites.forEach(s => { const d = s.position.distanceTo(MW.cam.position); s.material.opacity = Math.max(0, Math.min(1, (d - 3) / 4)) * (1 - Math.max(0, Math.min(1, (d - 26) / 14))) * 0.5; s.position.y = s.userData.base + Math.sin(now / 1400 + s.userData.ph) * 0.18; });
  MW.r.render(MW.scene, MW.cam); }
function mwMount(){ const want = NT_FX.world && S.page === 'home' && GL_OK() && !!document.querySelector('.h-home');
  document.body.classList.toggle('mw-on', want && !!MW.r);
  if (!want){ MW.run = false; if (MW.cv) MW.cv.style.opacity = '0'; return; }
  if (!MW.r){ try { MW.cv = document.createElement('canvas'); MW.cv.className = 'mw-gl'; MW.cv.setAttribute('aria-hidden', 'true'); document.body.prepend(MW.cv);
      MW.r = new window.THREE.WebGLRenderer({ canvas: MW.cv, antialias: false, alpha: false, powerPreference: 'high-performance' }); mwBuild(); mwSize(); addEventListener('resize', mwSize, { passive: true });
      MW.t = scrollY > 40 ? mwTarget() : -0.14; MW.raf = requestAnimationFrame(mwLoop); }
    catch(e){ if (MW.cv) MW.cv.remove(); MW.cv = null; MW.r = null; return; } document.body.classList.add('mw-on'); }
  else if (!MW.run){ MW.t = Math.min(MW.t, mwTarget() - 0.06); mwTickers(); }
  MW.run = true; requestAnimationFrame(() => { if (MW.cv) MW.cv.style.opacity = '1'; }); }
addEventListener('pointermove', ev => { if (ev.pointerType !== 'mouse' || !MW.run) return; MW.ptx = (ev.clientX / innerWidth - 0.5) * 2; MW.pty = -(ev.clientY / innerHeight - 0.5) * 2; }, { passive: true });
/* les blocs de l'accueil s'ouvrent comme une fenêtre en arrivant (style Valmora) : on ajoute aussi les zones
   qui n'étaient pas suivies ; même règle sans risque qu'avant (caché seulement si confirmé hors de l'écran) */
function mwReveal(){ if (!zIO || RM() || !NT_FX.world || S.page !== 'home') return; document.querySelectorAll('.v32-home > [data-scene], .v32-home > .h-hello, .v32-home > .hm').forEach(el => { if (el.dataset.rv) return; el.dataset.rv = 1; zIO.observe(el); }); }
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(() => { mwMount(); mwReveal(); }).observe(app, { childList: true }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (MW.r) mwTickers(); }); mwMount(); mwReveal(); })();


/* V40 : les anciens objets en points de l'accueil (fusée, anneaux, barres…) sont retirés quand le monde 3D est là */
const _v32UpdateV39 = v32Update;
v32Update = function(){ if (document.body.classList.contains('nt-fond')){ if (HS.cv) HS.cv.style.opacity = '0'; HS.vis = 0; return; } return _v32UpdateV39(); };


/* ============================================================
   V41 — FOND « BOURSE » DE L'ACCUEIL (03/11/2026)
   Thomas : le paysage 3D « ne va pas avec la Bourse ». Ses choix :
   graphique vivant + salle des marchés + globe des Bourses, UNIQUEMENT
   bleu et violet, discret, et qui défile quand on défile.
   - Un seul canevas 2D net (jusqu'à 2× la résolution de l'écran), transparent
     au-dessus du dégradé noir → bleu d'origine.
   - En haut (temple, bonjour, missions) : un grand graphique de cours qui se
     dessine et avance quand on descend (courbe, moyenne mobile, volumes, point
     « maintenant » qui pulse). Courbe décorative : ce ne sont pas des données.
   - Partie « Le marché » : une salle des marchés, des bandeaux de cotations
     (mêmes valeurs que l'accueil) qui glissent dans les deux sens au défilement.
   - Partie « Ta liste » et la suite : le globe des Bourses qui monte et tourne
     au défilement ; les places sont reliées par des arcs de lumière ; une place
     brille plus quand elle est dans ses horaires habituels (hors jours fériés).
   - Les anciens points restent retirés. Le paysage 3D (V39-V40) n'est plus
     affiché (on peut le rallumer : NT_FX.world = true).
   Interrupteur : NT_FX.bourse = false → fond d'avant.
   ============================================================ */
NT_FX.bourse = NT_FX.bourse !== false;
const MB = { cv: null, g: null, w: 0, h: 0, d: 1, run: false, raf: 0, last: 0, sy: -1, t0: performance.now(), walk: null, ma: null, vol: null, lo: 0, hi: 1, tapes: [], gdots: null };
const MB_C = { v1: '143,116,255', v2: '196,181,255', b1: '91,140,255', b2: '143,180,255', w: '232,236,255' };
/* places boursières : coordonnées et horaires habituels (heure locale, du lundi au vendredi) */
const MB_PL = [
  ['PARIS', 48.86, 2.35, 'Europe/Paris', [[9, 0, 17, 30]], 1, 10], ['LONDRES', 51.51, -0.13, 'Europe/London', [[8, 0, 16, 30]], -1, -4], ['FRANCFORT', 50.11, 8.68, 'Europe/Berlin', [[9, 0, 17, 30]], 1, -8],
  ['NEW YORK', 40.71, -74.0, 'America/New_York', [[9, 30, 16, 0]], 1, 6], ['TORONTO', 43.65, -79.38, 'America/Toronto', [[9, 30, 16, 0]], -1, -6], ['SÃO PAULO', -23.55, -46.63, 'America/Sao_Paulo', [[10, 0, 17, 0]]],
  ['TOKYO', 35.68, 139.69, 'Asia/Tokyo', [[9, 0, 11, 30], [12, 30, 15, 30]]], ['HONG KONG', 22.32, 114.17, 'Asia/Hong_Kong', [[9, 30, 12, 0], [13, 0, 16, 0]]], ['SHANGHAI', 31.23, 121.47, 'Asia/Shanghai', [[9, 30, 11, 30], [13, 0, 15, 0]]],
  ['BOMBAY', 19.08, 72.88, 'Asia/Kolkata', [[9, 15, 15, 30]]], ['SYDNEY', -33.87, 151.21, 'Australia/Sydney', [[10, 0, 16, 0]]], ['JOHANNESBURG', -26.2, 28.05, 'Africa/Johannesburg', [[9, 0, 17, 0]]] ];
function mbOpen(tz, slots){ try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()), g = k => (p.find(x => x.type === k) || {}).value;
  const wd = g('weekday'); if (wd === 'Sat' || wd === 'Sun') return false; const m = Number(g('hour')) % 24 * 60 + Number(g('minute')); return slots.some(([a, b, c, d]) => m >= a * 60 + b && m < c * 60 + d); } catch(e){ return false; } }
function mbData(){ const N = 900, r = mwRnd(2026), w = mwWalk(N, 2026), ma = [], vol = []; let s = 0;
  for (let i = 0; i < N; i++){ s += w[i]; if (i >= 20) s -= w[i - 20]; ma.push(s / Math.min(i + 1, 20)); const dv = i ? Math.abs(w[i] - w[i - 1]) : 0; vol.push(Math.min(1, 0.18 + r() * 0.35 + dv * 14)); }
  MB.walk = w; MB.ma = ma; MB.vol = vol;
  const dots = []; for (let la = -84; la <= 84; la += 4.5){ const n = Math.max(8, Math.round(76 * Math.cos(la * Math.PI / 180))); for (let k = 0; k < n; k++) dots.push([la * Math.PI / 180, ((k + (la % 8 ? 0.5 : 0)) / n) * 2 * Math.PI]); } MB.gdots = dots; }
/* V42 (même soir) — TOUT EN PETITS POINTS. Thomas : « j'aime énormément, mais fais-le en petits points ».
   Comme un tableau lumineux de Bourse : le graphique est une matrice de points (la courbe en points
   brillants, la surface en points qui s'éteignent vers le bas, les volumes en colonnes de points),
   les bandeaux de cotations sont écrits en points (afficheur à LED), le globe et ses arcs sont en points.
   Dessin groupé par intensité pour rester rapide. */
const MBQ = Array.from({ length: 11 }, () => []);
const mbDot = (x, y, s, a) => { const k = Math.round(Math.max(0, Math.min(1, a)) * 10); if (k) MBQ[k].push(x, y, s); };
function mbFlush(g, rgb){ for (let k = 1; k <= 10; k++){ const q = MBQ[k]; if (!q.length) continue; g.fillStyle = `rgba(${rgb},${(k / 10).toFixed(2)})`; for (let i = 0; i < q.length; i += 3){ const s = q[i + 2]; g.fillRect(q[i] - s / 2, q[i + 1] - s / 2, s, s); } q.length = 0; } }
/* bandeaux : le texte est écrit une fois, puis « relu » sur une grille pour devenir un afficheur à points */
function mbTapes(){ const ids = [...new Set([...WATCH(), ...POP.actions, ...POP.paris, ...(POP.etf || [])])].map(mkFind).filter(Boolean); if (!ids.length){ MB.tapes = []; return; }
  const rows = MB.w < 700 ? 5 : 6, d = MB.d; MB.tapes = [];
  for (let r = 0; r < rows; r++){ const k = r / (rows - 1), fs = Math.round((MB.w < 700 ? 16 : 18) + k * (MB.w < 700 ? 18 : 26)), list = ids.slice(r % ids.length).concat(ids.slice(0, r % ids.length));
    const t = document.createElement('canvas'), g = t.getContext('2d', { willReadFrequently: true }), font = `800 ${fs}px Inter, system-ui, sans-serif`, small = `800 ${Math.round(fs * 0.86)}px Inter, system-ui, sans-serif`;
    const parts = list.map(s => { const v = chg(s); return { id: s.id, p: money(s, px(s)), c: v == null ? '' : (v >= 0 ? '▲ ' : '▼ ') + num(Math.abs(v), 2) + ' %', up: v == null || v >= 0 }; });
    let W = 0; const gap = fs * 2.4; parts.forEach(q => { g.font = font; q.w0 = g.measureText(q.id).width; g.font = small; q.w1 = g.measureText(q.p).width; q.w2 = g.measureText(q.c).width; q.x = W; W += q.w0 + q.w1 + q.w2 + fs * 1.4 + gap; });
    W = Math.ceil(W); const Hh = Math.ceil(fs * 1.5); t.width = W; t.height = Hh; g.textBaseline = 'middle'; const y = Hh / 2;
    /* trois couches de couleur : nom (blanc), prix (bleu), variation (bleu si hausse, violet si baisse) dans les canaux R, G, B */
    parts.forEach(q => { g.font = font; g.fillStyle = '#f00'; g.fillText(q.id, q.x, y); g.font = small; g.fillStyle = '#0f0'; g.fillText(q.p, q.x + q.w0 + fs * 0.6, y); g.fillStyle = q.up ? '#0f0' : '#00f'; g.fillText(q.c, q.x + q.w0 + q.w1 + fs * 1.2, y); });
    const px0 = g.getImageData(0, 0, W, Hh).data, st = Math.max(1.6, fs / 9), sz = st * 0.66, c = document.createElement('canvas'); c.width = Math.ceil(W * d); c.height = Math.ceil(Hh * d); const o = c.getContext('2d'); o.scale(d, d);
    const cols = { r: `rgba(${MB_C.w},.95)`, g: `rgba(${MB_C.b2},.95)`, b: `rgba(${MB_C.v2},.95)` }, lit = { r: [], g: [], b: [] };
    for (let yy = st / 2; yy < Hh; yy += st) for (let xx = st / 2; xx < W; xx += st){ const i = (Math.floor(yy) * W + Math.floor(xx)) * 4, R = px0[i], G = px0[i + 1], B = px0[i + 2], A = px0[i + 3]; if (A < 90) continue; (R >= G && R >= B ? lit.r : G >= B ? lit.g : lit.b).push(xx, yy); }
    for (const kk of ['r', 'g', 'b']){ o.fillStyle = cols[kk]; const L = lit[kk]; for (let i = 0; i < L.length; i += 2) o.fillRect(L[i] - sz / 2, L[i + 1] - sz / 2, sz, sz); }
    MB.tapes.push({ c, W, fs, Hh, k, dir: r % 2 ? 1 : -1, sp: 10 + k * 22 }); } }
function mbSize(){ if (!MB.cv) return; const w = innerWidth, h = Math.max(innerHeight, document.documentElement.clientHeight); if (Math.abs(w - MB.w) < 1 && Math.abs(h - MB.h) < 120 && MB.g) return;
  MB.w = w; MB.h = h; MB.d = Math.min(2, devicePixelRatio || 1); MB.cv.width = Math.round(w * MB.d); MB.cv.height = Math.round(h * MB.d); MB.cv.style.height = h + 'px'; MB.g = MB.cv.getContext('2d'); mbTapes(); MB.sy = -1; }
const mbS = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/* les trois zones suivent les vraies parties de l'accueil */
function mbZones(){ const H = MB.h, bars = document.querySelector('.v32-home [data-scene="bars"]'), glo = document.querySelector('.v32-home [data-scene="globe"]');
  if (!bars || !glo){ const t = mwTarget(); return { a: mbS(0.25, 0.45, t), b: mbS(0.55, 0.75, t) }; }
  const tb = bars.getBoundingClientRect().top, tg = glo.getBoundingClientRect().top; return { a: mbS(H * 0.95, H * 0.35, tb), b: mbS(H * 1.05, H * 0.35, tg) }; }
function mbChart(g, W, H, T, al){ if (al < 0.01) return; const N = MB.walk.length, mob = W < 700, vis = mob ? 96 : 170, dx = W / vis, now = 0.74, pan = mwTarget() * (N - vis - 210) + (T * 0.35) % 200;
  const ni = Math.min(N - 1, Math.floor(vis * now + pan)), fi = Math.max(0, ni - Math.ceil(vis * now) - 1), X = i => (i - pan) * dx;
  let lo = 1e9, hi = -1e9; for (let i = fi; i <= ni; i++){ lo = Math.min(lo, MB.walk[i]); hi = Math.max(hi, MB.walk[i]); } MB.lo += (lo - MB.lo) * 0.08; MB.hi += (hi - MB.hi) * 0.08;
  const y0 = H * (mob ? 0.44 : 0.36), y1 = H * (mob ? 0.78 : 0.8), Y = v => y1 - (v - MB.lo) / Math.max(0.05, MB.hi - MB.lo) * (y1 - y0);
  const at = (arr, x) => { const p = x / dx + pan, i = Math.floor(p), f = p - i, a = arr[Math.max(0, Math.min(N - 1, i))], b = arr[Math.max(0, Math.min(N - 1, i + 1))]; return a + (b - a) * f; };
  const st = mob ? 5 : 6, ds = mob ? 1.8 : 2, nx = W * now, sh = -((pan * dx) % st);
  g.save(); g.globalAlpha = al;
  /* grille de points qui avance avec le graphique */ const gs = st * 5, gx = -((pan * dx) % gs); for (let x = gx; x < W; x += gs) for (let y = y0 - 24; y < y1 + 52; y += gs) mbDot(x, y, 1.3, 0.16); mbFlush(g, MB_C.b2);
  /* surface sous la courbe : colonnes de points qui s'éteignent vers le bas (et vers le passé, à gauche) */
  const top = [];
  for (let x = sh; x <= nx; x += st){ const yc = Y(at(MB.walk, x)), k = 0.35 + 0.65 * Math.max(0, x / nx); top.push(x, yc, k);
    const c0 = Math.round((x + pan * dx) / st); for (let y = yc + st, r = 1; y < y1; y += st, r++){ if ((c0 + r) & 1) continue; const f = 1 - (y - yc) / (y1 - yc + 1); mbDot(x, y, ds * 0.9, (0.07 + 0.36 * f * f) * k); } }
  mbFlush(g, MB_C.v1);
  /* volumes : petites colonnes de points */ for (let i = fi; i <= ni; i++){ const x = X(i); if (x > nx) break; const n = Math.round(MB.vol[i] * 6); for (let j = 0; j < n; j++) mbDot(x, y1 + 46 - j * 4.2, 1.6, 0.22); } mbFlush(g, MB_C.b1);
  /* moyenne mobile : points espacés */ for (let x = sh; x <= nx; x += st * 2) mbDot(x, Y(at(MB.ma, x)), 1.6, 0.42); mbFlush(g, MB_C.b2);
  /* la courbe : points brillants, de plus en plus blancs vers « maintenant » */
  /* points sans trou : entre deux colonnes, on ajoute des points le long de la pente */
  for (let i = 0; i < top.length; i += 3){ const k = top[i + 2]; mbDot(top[i], top[i + 1], ds + 1.1, k); if (i + 3 < top.length){ const x2 = top[i + 3], y2 = top[i + 4], dy = y2 - top[i + 1], n = Math.floor(Math.abs(dy) / (st * 0.8)); for (let j = 1; j <= n; j++){ const f = j / (n + 1); mbDot(top[i] + (x2 - top[i]) * f, top[i + 1] + dy * f, ds + 0.6, k * 0.85); } } } mbFlush(g, MB_C.v2);
  for (let i = 0; i < top.length; i += 3){ const x = top[i]; if (x > nx * 0.82) mbDot(x, top[i + 1], ds + 0.6, (x - nx * 0.82) / (nx * 0.18)); } mbFlush(g, MB_C.w);
  /* « maintenant » : niveau en points + couronne de points qui s'agrandit */ const ny = Y(at(MB.walk, nx)); for (let x = nx + st * 2; x < W; x += st * 2) mbDot(x, ny, 1.5, 0.42); mbFlush(g, MB_C.v2);
  const ph = (T * 0.8) % 1, rr = 5 + ph * 16; for (let a = 0; a < 16; a++){ const an = a / 16 * 6.283; mbDot(nx + Math.cos(an) * rr, ny + Math.sin(an) * rr, 1.8, 0.6 * (1 - ph)); } mbFlush(g, MB_C.v2);
  for (const [ox, oy] of [[0, 0], [-2.6, 0], [2.6, 0], [0, -2.6], [0, 2.6]]) mbDot(nx + ox, ny + oy, 2.3, ox || oy ? 0.7 : 1); mbFlush(g, MB_C.w);
  g.restore(); }
function mbTape(g, W, H, T, al){ if (al < 0.01 || !MB.tapes.length) return; g.save(); const n = MB.tapes.length, top = H * 0.16, bot = H * 0.8, sy = scrollY;
  MB.tapes.forEach((tp, r) => { const y = top + (bot - top) * (r / (n - 1)) - tp.Hh / 2, off = (((T * tp.sp + sy * (0.25 + tp.k * 0.35)) * tp.dir) % tp.W + tp.W) % tp.W;
    g.globalAlpha = al * (0.16 + tp.k * 0.26); for (let x = -off; x < W; x += tp.W) g.drawImage(tp.c, x, y, tp.W, tp.Hh); });
  g.restore(); }
function mbGlobe(g, W, H, T, al, b){ if (al < 0.01) return; const mob = W < 700, R = mob ? Math.min(W * 0.46, H * 0.3) : Math.min(W * 0.26, H * 0.36), cx = mob ? W * 0.5 : W * 0.5 + 116, cy = H * (0.6 + (1 - b) * 0.55);
  const rot = -0.4 + scrollY * 0.0016 + T * 0.02, tl = 0.38, ct = Math.cos(tl), st = Math.sin(tl);
  const P = (la, lo, h = 1) => { const x = Math.cos(la) * Math.sin(lo + rot), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo + rot); return [cx + x * R * h, cy - (y * ct - z * st) * R * h, y * st + z * ct]; };
  g.save(); g.globalAlpha = al;
  const atm = g.createRadialGradient(cx, cy, R * 0.75, cx, cy, R * 1.3); atm.addColorStop(0, `rgba(${MB_C.b1},.08)`); atm.addColorStop(1, `rgba(${MB_C.b1},0)`); g.fillStyle = atm; g.fillRect(cx - R * 1.4, cy - R * 1.4, R * 2.8, R * 2.8);
  /* contour en points */ for (let a = 0; a < 150; a++){ const an = a / 150 * 6.283; mbDot(cx + Math.cos(an) * R, cy + Math.sin(an) * R, 1.3, 0.3); } mbFlush(g, MB_C.b2);
  /* sphère en points (face visible seulement) */ for (const [la, lo] of MB.gdots){ const p = P(la, lo); if (p[2] > 0) mbDot(p[0], p[1], 0.9 + 1 * p[2], 0.1 + 0.55 * p[2] * p[2]); } mbFlush(g, MB_C.b2);
  /* arcs de lumière en points entre Paris et les autres places */
  const rad = d => d * Math.PI / 180, pa = MB_PL[0], v3 = (la, lo) => [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)], heads = [];
  MB_PL.slice(1).forEach((q, i) => { const A = v3(rad(pa[1]), rad(pa[2])), B = v3(rad(q[1]), rad(q[2])), om = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))), so = Math.sin(om) || 1, seg = Math.max(24, Math.round(om * 60));
    const hs = (T * 0.16 + i * 0.137) % 1;
    for (let k = 0; k <= seg; k++){ const s = k / seg, a = Math.sin((1 - s) * om) / so, c = Math.sin(s * om) / so, v = [A[0] * a + B[0] * c, A[1] * a + B[1] * c, A[2] * a + B[2] * c], p = P(Math.asin(v[1]), Math.atan2(v[2], v[0]), 1 + 0.22 * Math.sin(Math.PI * s) * om / Math.PI);
      if (p[2] < -0.08) continue; const dh = s - hs, tail = dh <= 0 && dh > -0.08 ? 1 + dh / 0.08 : 0; mbDot(p[0], p[1], 1.4, 0.26 + 0.1 * p[2]); if (tail > 0 && p[2] > 0) heads.push(p[0], p[1], tail); } });
  mbFlush(g, MB_C.v2); for (let i = 0; i < heads.length; i += 3) mbDot(heads[i], heads[i + 1], 2.2, heads[i + 2]); mbFlush(g, MB_C.w);
  /* les places : petits groupes de points, plus brillants pendant leurs horaires habituels */
  if (!MB.openAt || T - MB.openAt > 30){ MB.openAt = T; MB.open = MB_PL.map(q => mbOpen(q[3], q[4])); }
  g.font = `600 ${mob ? 9.5 : 10.5}px Inter, system-ui, sans-serif`; g.textBaseline = 'middle';
  MB_PL.forEach((q, i) => { const p = P(rad(q[1]), rad(q[2])); if (p[2] < 0.05) return; const op = MB.open && MB.open[i];
    if (op){ const ph = (T * 0.7 + i * 0.3) % 1, rr = 4 + ph * 12; for (let a = 0; a < 12; a++){ const an = a / 12 * 6.283; mbDot(p[0] + Math.cos(an) * rr, p[1] + Math.sin(an) * rr, 1.5, 0.6 * (1 - ph)); } mbFlush(g, MB_C.v2); }
    for (const [ox, oy] of [[0, 0], [-2.4, 0], [2.4, 0], [0, -2.4], [0, 2.4]]) mbDot(p[0] + ox, p[1] + oy, op ? 2.1 : 1.6, op ? (ox || oy ? 0.75 : 1) : 0.6); mbFlush(g, op ? MB_C.w : MB_C.b2);
    if (q[5] === 0) return; g.fillStyle = `rgba(${MB_C.v2},${(0.25 + 0.5 * p[2]).toFixed(3)})`; g.textAlign = q[5] === -1 ? 'right' : 'left'; g.fillText(q[0], p[0] + (q[5] === -1 ? -8 : 8), p[1] + (q[6] || 0)); g.textAlign = 'left'; });
  g.restore(); }
function mbDraw(T){ const g = MB.g; if (!g) return; const W = MB.w, H = MB.h; g.setTransform(MB.d, 0, 0, MB.d, 0, 0); g.clearRect(0, 0, W, H);
  const z = mbZones(); mbChart(g, W, H, T, (1 - z.a) * 0.9 + z.b * 0); mbTape(g, W, H, T, z.a * (1 - z.b)); mbGlobe(g, W, H, T, z.b, z.b); }
function mbLoop(now){ MB.raf = requestAnimationFrame(mbLoop); if (!MB.run || document.hidden || mwBusy()){ MB.last = 0; return; }
  const moving = Math.abs(scrollY - MB.sy) > 0.5, fps = moving ? 60 : 24; if (MB.last && now - MB.last < 1000 / fps - 3) return; MB.last = now; MB.sy = scrollY; mbDraw((now - MB.t0) / 1000); }
function mbMount(){ const want = NT_FX.bourse && !(NT_FX.world === true) && S.page === 'home' && !!document.querySelector('.h-home');
  document.body.classList.toggle('mb-on', want); document.body.classList.toggle('nt-fond', want || document.body.classList.contains('mw-on'));
  if (!want){ MB.run = false; if (MB.cv) MB.cv.style.opacity = '0'; return; }
  if (!MB.cv){ MB.cv = document.createElement('canvas'); MB.cv.className = 'mb-cv'; MB.cv.setAttribute('aria-hidden', 'true'); document.body.prepend(MB.cv); mbData(); addEventListener('resize', mbSize, { passive: true }); }
  mbSize(); mbTapes(); MB.run = !RM(); requestAnimationFrame(() => { if (MB.cv) MB.cv.style.opacity = '1'; });
  if (RM()) mbDraw(0); else if (!MB.raf) MB.raf = requestAnimationFrame(mbLoop); }
if (RM()) addEventListener('scroll', () => { if (S.page === 'home' && MB.g && NT_FX.bourse) requestAnimationFrame(() => mbDraw(0)); }, { passive: true });
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(mbMount).observe(app, { childList: true }); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (MB.cv) mbTapes(); }); mbMount(); })();


/* ============================================================
   V42 — NOUVEAU PARCOURS : « LE GRAPHIQUE DE TA PROGRESSION » (04/11/2026)
   Thomas : « quelque chose de similaire [au fond de l'accueil] sans copier
   pour le parcours, et on revoit entièrement le design du parcours ».
   - Fond (canevas 2D net, bleu et violet, discret, lié au défilement) :
     un graphique en bougies, UNE BOUGIE PAR CHAPITRE, sur une tendance qui
     monte jusqu'au Sommet ; les niveaux sont des lignes de prix sur l'axe de
     droite. En haut : vue d'ensemble ; en descendant, le graphique se
     rapproche et suit le chapitre regardé ; ta bougie actuelle pulse.
     Tracé avec la VRAIE progression de l'élève (pas des données de marché).
   - Design : carte « ta cotation » (ton parcours comme une valeur : % du
     parcours, missions de la semaine, activité réelle des 14 derniers jours),
     niveaux présentés comme des listes de valeurs (chapitres + examen),
     outils en ligne, prochaine récompense, sommet (certificat interne).
   - Mêmes actions qu'avant : data-cnode (feuille du chapitre), data-exam,
     data-toolinfo, data-play (Continuer), data-go="missions" (vue liste).
   - Les anciens points 3D du parcours ne sont plus affichés.
   Interrupteur : NT_FX.parcours2 = false → parcours V33.
   ============================================================ */
NT_FX.parcours2 = NT_FX.parcours2 === true;   /* Thomas préfère le Parcours d'avant (V33) : celui-ci n'est plus affiché par défaut */
/* l'ordre du parcours : chapitres puis examen, niveau par niveau */
function prItems(){ const nm = nextMission(), curCh = nm ? nm.ch : null, out = [];
  LV.forEach(l => { CH.filter(c => l.ch.includes(c.id)).forEach(c => { const pr = chProgress(c.id), un = chUnlocked(c.id), prem = chPremium(c.id);
      out.push({ t: 'ch', c, l, pr, st: pr >= 1 ? 'done' : !un ? 'lock' : prem ? 'prem' : c.id === curCh ? 'cur' : pr > 0 ? 'part' : 'todo', n: chMissions(c.id).length }); });
    out.push({ t: 'ex', l, st: S.certs[l.id] ? 'done' : 'todo' }); });
  return out; }
/* activité réelle : missions terminées par jour (14 derniers jours) */
function prActivity(){ const td = today(), d = Array.from({ length: 14 }, (_, i) => (S.dayCount || {})[addDays(td, i - 13)] || 0); return { d, week: d.slice(7).reduce((a, b) => a + b, 0) }; }
function prBars(d){ const mx = Math.max(1, ...d), W = 280, H = 56, bw = W / d.length;
  return `<svg class="pr-q-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${d.map((v, i) => { const h = v ? 6 + (H - 8) * v / mx : 3; return `<rect x="${(i * bw + bw * 0.22).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw * 0.56).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="${i === d.length - 1 ? 'now' : v ? 'on' : ''}"/>`; }).join('')}</svg>`; }
function prQuote(nm, its){ const done = MS.filter(m => isDone(m.id)).length, pct = Math.round(done / MS.length * 100), nCert = Object.keys(S.certs).length, nTool = TOOLS.filter(toolOn).length, a = prActivity();
  const lv = levelOf(nm ? nm.ch : (MS[MS.length - 1] || {}).ch || 1) || LV[0], tk = ((S.name || '').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3) || 'TOI').toUpperCase(), cur = its.find(x => x.st === 'cur');
  return `<section class="pr-quote">
    <div class="pr-q-top"><span class="pr-tk">${h(tk)}<i>· NOVATITRE</i></span><span class="pr-q-lv">Niveau ${lv.id} · ${h(lv.title)}</span></div>
    <div class="pr-q-mid"><b class="pr-q-v tn" data-count="${pct}">${pct}</b><span class="pr-q-u">%</span><span class="pr-q-ch ${a.week ? 'up' : ''}">${a.week ? `▲ ${a.week} mission${a.week > 1 ? 's' : ''} cette semaine` : 'Aucune mission cette semaine'}</span></div>
    <div class="pr-q-chart">${prBars(a.d)}<div class="pr-q-ax"><span>il y a 14 jours</span><span>aujourd’hui</span></div></div>
    <div class="pr-q-stats"><span><b class="tn" data-count="${done}">${done}</b> / ${MS.length} missions</span><span><b class="tn" data-count="${nCert}">${nCert}</b> certificat${nCert > 1 ? 's' : ''}</span><span><b class="tn" data-count="${nTool}">${nTool}</b> / ${TOOLS.length} outils</span></div>
    ${nm ? `<div class="pr-q-next"><span class="pr-q-k">Prochaine mission${cur ? ' · chapitre ' + cur.c.id : ''}</span><b>${h(nm.title)}</b><span>${h(nm.kind)} · ${nm.dur} min</span></div>
      <div class="pr-cta"><button class="pr-b1" data-play="${nm.id}">Continuer</button><button class="pr-b2" data-prfind>Voir sur la carte</button></div>`
    : MS.some(m => !isDone(m.id) && chPremium(m.ch)) ? `<div class="pr-cta"><button class="pr-b1" data-paywall>Voir Premium</button><button class="pr-b2" data-go="missions">Vue liste</button></div>`
    : `<div class="pr-cta"><button class="pr-b1" data-go="certs">Mes certificats</button><button class="pr-b2" data-go="missions">Vue liste</button></div>`}
  </section>`; }
function prRow(it, k){ if (it.t === 'ex'){ const cert = S.certs[it.l.id], ex = S.exams['lv' + it.l.id];
    return `<button class="pr-ex ${cert ? 'ok' : ''}" data-exam="lv${it.l.id}" data-prk="${k}"><span class="pr-dot">${cert ? I.check : I.trophy}</span><span class="pr-t"><b>Examen du niveau ${it.l.id}</b><span>${cert ? 'Réussi · ' + cert.pct + ' % · certificat obtenu' : `${it.l.exam} questions · 80 % pour valider${ex ? ' · meilleur essai ' + ex.best + ' %' : ''}`}</span></span><span class="pr-go">${cert ? 'Repasser' : 'Passer'}</span></button>`; }
  const c = it.c, tool = TOOLS.find(t => t.ch === c.id), ms = chMissions(c.id), nd = ms.filter(m => isDone(m.id)).length;
  return `<button class="pr-ch ${it.st}" style="--c:${c.color}" data-cnode="${c.id}" data-prk="${k}" aria-label="Chapitre ${c.id} : ${h(c.title)}, ${nd} missions sur ${ms.length}">
    <span class="pr-dot">${it.st === 'done' ? I.check : it.st === 'lock' || it.st === 'prem' ? I.lock : c.id}</span>
    <span class="pr-t"><b>${h(c.title)}</b><span>${it.st === 'prem' ? 'Premium · ' : ''}${nd} / ${ms.length} missions${it.st === 'cur' ? ' · <em>tu es ici</em>' : ''}</span>
      <span class="pr-ticks" aria-hidden="true">${ms.map(m => `<i class="${isDone(m.id) ? 'on' : ''}"></i>`).join('')}</span></span>
    ${tool ? `<span class="pr-tool ${toolOn(tool) ? 'on' : ''}" title="Débloque : ${h(tool.name)}">${toolOn(tool) ? tool.ic : IC2.gift}</span>` : ''}
    <span class="pr-pct tn">${Math.round(it.pr * 100)} %</span></button>`; }
const _carteV33 = PAGES.carte;
PAGES.carte = () => { if (!NT_FX.parcours2) return _carteV33();
  const nm = nextMission(), its = prItems(); let k = 0;
  return `<div class="wrap pr-page">${top()}
  <section class="pr-hero v32-chap"><div class="pr-hh"><span class="pr-eb"><i class="pr-live"></i>Ton parcours</span><button class="pr-pill" data-go="missions">Vue liste</button></div>${bigT('Ton parcours.')}</section>
  ${prQuote(nm, its)}
  ${rewardCard('pr-rw')}
  <section class="pr-sec"><div class="pr-sh"><h2>Mes outils</h2><span class="tn">${TOOLS.filter(toolOn).length} / ${TOOLS.length}</span></div>${toolStrip()}</section>
  ${LV.map(l => { const lis = its.filter(x => x.l.id === l.id), pr = lvProgress(l), cert = S.certs[l.id], isCur = lis.some(x => x.st === 'cur');
    return `<section class="pr-lv ${cert ? 'ok' : ''} ${isCur ? 'now' : ''}" data-prlv="${l.id}">
      <header class="pr-lvh"><span class="pr-lvn">N${l.id}</span><div class="pr-lvt"><h2>${h(l.title)}</h2><p>${h(l.sub)}</p></div><span class="pr-lvs tn">${cert ? I.check + 'Certifié' : Math.round(pr * 100) + ' %'}</span></header>
      <span class="pr-bar"><i style="width:${Math.round(pr * 100)}%"></i></span>
      <div class="pr-rows">${lis.map(it => prRow(it, k++)).join('')}</div></section>`; }).join('')}
  ${pcSummit()}
  ${legal()}</div>${dock()}`; };
/* « Voir sur la carte » : on descend jusqu'au chapitre en cours */
document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-prfind]'); if (!b) return; const n = document.querySelector('.pr-page .pr-ch.cur'); if (!n) return;
  scrollTo({ top: scrollY + n.getBoundingClientRect().top - innerHeight * 0.45, behavior: RM() ? 'auto' : 'smooth' }); n.classList.remove('pr-ping'); void n.offsetWidth; n.classList.add('pr-ping'); });

/* ---------- le fond : graphique en bougies de ta progression ---------- */
const PB = { cv: null, g: null, w: 0, h: 0, d: 1, run: false, raf: 0, last: 0, sy: -1, t0: performance.now(), its: [], cam: null, tg: null };
const PB_C = { v1: '143,116,255', v2: '196,181,255', b1: '91,140,255', b2: '143,180,255', w: '232,236,255' };
function pbPrep(){ const its = prItems(); let p = 0; const r = mwRnd(77);
  /* prix de chaque bougie : la tendance monte d'un cran par chapitre, avec un petit écart au hasard (toujours le même) */
  PB.its = its.map((it, i) => { const o = p, body = it.t === 'ex' ? 0 : 0.95, wl = 0.15 + r() * 0.3, wh = 0.15 + r() * 0.35, dip = r() < 0.25 ? 0.25 : 0; p += it.t === 'ex' ? 0.6 : 0.82 - dip; return Object.assign({}, it, { po: o - dip, pc: o + body, plo: o - dip - wl, phi: o + body + wh, i }); });
  PB.top = p + 0.6; }
function pbSize(){ if (!PB.cv) return; const w = innerWidth, h = Math.max(innerHeight, document.documentElement.clientHeight); if (Math.abs(w - PB.w) < 1 && Math.abs(h - PB.h) < 120 && PB.g) return;
  PB.w = w; PB.h = h; PB.d = Math.min(2, devicePixelRatio || 1); PB.cv.width = Math.round(w * PB.d); PB.cv.height = Math.round(h * PB.d); PB.cv.style.height = h + 'px'; PB.g = PB.cv.getContext('2d'); PB.sy = -1; }
/* où regarder : vue d'ensemble en haut, le chapitre au centre de l'écran ensuite, le sommet en bas */
function pbTarget(){ const H = PB.h, n = PB.its.length, mid = H * 0.5, rows = [...document.querySelectorAll('.pr-page [data-prk], .pc-page .pc-map .mnode')], hero = document.querySelector('.pr-quote, .pc-page .pc-here'), top = document.querySelector('.pr-page .pc-top, .pc-page .pc-top');
  const fitSy = Math.min(H * 0.5 / Math.max(1, PB.top), (PB.w * 0.86 / (n + 2)) * 3), all = { x: (n - 1) / 2, y: PB.top / 2, span: n + 2, sy: fitSy };
  let best = null, bd = 1e9; rows.forEach(el => { const r = el.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < bd){ bd = d; best = el; } });
  const hb = hero ? hero.getBoundingClientRect().bottom : -1, tt = top ? top.getBoundingClientRect().top : 1e9;
  if (tt < H * 0.55) return { x: n - 2, y: PB.top - 2.2, span: W_SPAN() + 2, sy: (PB.w * 0.86 / (W_SPAN() + 2)) * 0.95 };
  if (!best || hb > H * 0.45) return all;
  const k = best.dataset.prk != null ? Number(best.dataset.prk) : rows.indexOf(best), it = PB.its[k]; return it ? { x: k, y: (it.po + it.pc) / 2, span: W_SPAN(), sy: (PB.w * 0.86 / W_SPAN()) * 1.05 } : all; }
const W_SPAN = () => PB.w < 700 ? 6.5 : 11;
function pbDraw(T, dt){ const g = PB.g; if (!g || !PB.its.length) return; const W = PB.w, H = PB.h, n = PB.its.length; g.setTransform(PB.d, 0, 0, PB.d, 0, 0); g.clearRect(0, 0, W, H);
  const tg = pbTarget(); if (!PB.cam) PB.cam = Object.assign({}, tg); const kk = RM() ? 1 : 1 - Math.exp(-(dt || 16) / 1000 * 2.4); ['x', 'y', 'span', 'sy'].forEach(q => { PB.cam[q] += (tg[q] - PB.cam[q]) * kk; });
  const cw = (W * 0.86) / PB.cam.span, cy0 = H * 0.58, sy = PB.cam.sy, X = i => W * 0.46 + (i - PB.cam.x) * cw, Y = v => cy0 - (v - PB.cam.y) * sy;
  g.save();
  /* grille (elle suit le graphique) */ g.lineWidth = 1; g.strokeStyle = `rgba(${PB_C.b2},.06)`; g.beginPath();
  for (let i = Math.floor(PB.cam.x - PB.cam.span); i <= PB.cam.x + PB.cam.span; i++){ const x = Math.round(X(i)) + 0.5; g.moveTo(x, 0); g.lineTo(x, H); }
  for (let v = Math.floor(PB.cam.y - 12); v <= PB.cam.y + 12; v++){ const y = Math.round(Y(v)) + 0.5; g.moveTo(0, y); g.lineTo(W, y); } g.stroke();
  /* lignes des niveaux (comme des niveaux de prix) + l'axe de droite */
  g.font = `700 ${W < 700 ? 9.5 : 11}px Inter, system-ui, sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'right';
  PB.its.forEach(it => { if (it.t !== 'ex') return; const y = Y(it.po + 0.3), ok = it.st === 'done'; if (y < -20 || y > H + 20) return; g.setLineDash(ok ? [] : [4, 6]); g.strokeStyle = `rgba(${PB_C.v2},${ok ? 0.42 : 0.22})`; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = `rgba(${PB_C.v2},${ok ? 0.85 : 0.5})`; g.fillText(`NIVEAU ${it.l.id}${ok ? ' · CERTIFIÉ' : ''}`, W - 12, y - 9); });
  const ys = Y(PB.top); if (ys > -20 && ys < H + 20){ g.strokeStyle = `rgba(${PB_C.w},.5)`; g.beginPath(); g.moveTo(0, ys); g.lineTo(W, ys); g.stroke(); g.fillStyle = `rgba(${PB_C.w},.9)`; g.fillText('SOMMET', W - 12, ys - 9); }
  /* volumes : le nombre de missions de chaque chapitre */ g.fillStyle = `rgba(${PB_C.b1},.12)`; PB.its.forEach(it => { if (it.t !== 'ch') return; const x = X(it.i); if (x < -cw || x > W + cw) return; const hh = 8 + it.n * 3.2; g.fillRect(x - cw * 0.18, H - 24 - hh, cw * 0.36, hh); });
  /* ta courbe de progression : pleine et lumineuse jusqu'à aujourd'hui, en pointillé pour la suite */
  const ci = Math.max(0, PB.its.findIndex(it => it.st === 'cur')), lastDone = PB.its.reduce((a, it, i) => it.st === 'done' ? i : a, -1), reach = Math.max(ci, lastDone), py = it => Y(it.t === 'ex' ? it.po + 0.3 : it.pc);
  if (reach > 0){ const ga = g.createLinearGradient(0, Y(PB.its[reach].pc || 0), 0, H); ga.addColorStop(0, `rgba(${PB_C.v1},.18)`); ga.addColorStop(1, `rgba(${PB_C.v1},0)`);
    g.beginPath(); g.moveTo(X(0), H); for (let i = 0; i <= reach; i++) g.lineTo(X(i), py(PB.its[i])); g.lineTo(X(reach), H); g.closePath(); g.fillStyle = ga; g.fill();
    g.beginPath(); for (let i = 0; i <= reach; i++){ const x = X(i), y = py(PB.its[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.lineJoin = 'round'; g.strokeStyle = `rgba(${PB_C.v1},.22)`; g.lineWidth = 6; g.stroke(); g.strokeStyle = `rgba(${PB_C.v2},.85)`; g.lineWidth = 1.6; g.stroke(); }
  g.setLineDash([3, 6]); g.beginPath(); for (let i = reach; i < n; i++){ const x = X(i), y = py(PB.its[i]); i === reach ? g.moveTo(x, y) : g.lineTo(x, y); } g.strokeStyle = `rgba(${PB_C.b2},.25)`; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]);
  /* les bougies */
  PB.its.forEach(it => { if (it.t !== 'ch') return; const x = X(it.i), w = Math.max(6, cw * 0.42); if (x < -cw || x > W + cw) return; const yo = Y(it.po), yc = Y(it.pc), yl = Y(it.plo), yh = Y(it.phi), st = it.st;
    const ghost = st === 'todo' || st === 'lock' || st === 'prem'; g.lineWidth = 1.2;
    g.strokeStyle = ghost ? `rgba(${PB_C.b2},.22)` : `rgba(${PB_C.v2},.6)`; g.beginPath(); g.moveTo(x, yh); g.lineTo(x, yl); g.stroke();
    if (ghost){ g.setLineDash([3, 4]); g.strokeStyle = `rgba(${PB_C.b2},.32)`; g.strokeRect(x - w / 2, yc, w, yo - yc); g.setLineDash([]); return; }
    const fill = st === 'done' ? 1 : Math.max(0.12, it.pr), yf = yo - (yo - yc) * fill, gr = g.createLinearGradient(0, yc, 0, yo); gr.addColorStop(0, `rgba(${PB_C.v2},.9)`); gr.addColorStop(1, `rgba(${PB_C.v1},.55)`);
    g.shadowColor = `rgba(${PB_C.v1},.8)`; g.shadowBlur = 16; g.fillStyle = gr; g.fillRect(x - w / 2, yf, w, yo - yf); g.shadowBlur = 0; if (fill < 1){ g.strokeStyle = `rgba(${PB_C.v2},.45)`; g.setLineDash([3, 4]); g.strokeRect(x - w / 2, yc, w, yo - yc); g.setLineDash([]); }
    if (st === 'cur'){ const ph = (T * 0.7) % 1; g.strokeStyle = `rgba(${PB_C.w},${(0.6 * (1 - ph)).toFixed(3)})`; g.lineWidth = 1.5; g.strokeRect(x - w / 2 - ph * 10, yc - ph * 10, w + ph * 20, yo - yc + ph * 20);
      g.setLineDash([2, 5]); g.strokeStyle = `rgba(${PB_C.w},.45)`; g.lineWidth = 1; g.beginPath(); g.moveTo(x + w / 2 + 4, yf); g.lineTo(W, yf); g.stroke(); g.setLineDash([]);
      g.fillStyle = `rgba(${PB_C.w},.95)`; g.fillText('TU ES ICI', W - 12, yf + 10); } });
  g.restore(); }
function pbLoop(now){ PB.raf = requestAnimationFrame(pbLoop); if (!PB.run || document.hidden || mwBusy()){ PB.last = 0; return; }
  const moving = Math.abs(scrollY - PB.sy) > 0.5 || (PB.cam && PB.tgMove), fps = moving ? 60 : 30; if (PB.last && now - PB.last < 1000 / fps - 3) return; const dt = PB.last ? now - PB.last : 16; PB.last = now; PB.sy = scrollY; pbDraw((now - PB.t0) / 1000, dt);
  const tg = pbTarget(); PB.tgMove = PB.cam && (Math.abs(tg.x - PB.cam.x) > 0.01 || Math.abs(tg.span - PB.cam.span) > 0.01 || Math.abs(tg.y - PB.cam.y) > 0.01); }
function pbMount(){ const want = S.page === 'carte' && ((NT_FX.parcours2 && !!document.querySelector('.pr-page')) || (NT_FX.pcchart && !!document.querySelector('.pc-page')));
  document.body.classList.toggle('pb-on', want);
  if (!want){ PB.run = false; if (PB.cv) PB.cv.style.opacity = '0'; return; }
  if (!PB.cv){ PB.cv = document.createElement('canvas'); PB.cv.className = 'pb-cv'; PB.cv.setAttribute('aria-hidden', 'true'); document.body.prepend(PB.cv); addEventListener('resize', pbSize, { passive: true }); }
  pbPrep(); pbSize(); PB.cam = null; PB.run = !RM(); requestAnimationFrame(() => { if (PB.cv) PB.cv.style.opacity = document.querySelector('.pc-page') ? '0.7' : '1'; });
  if (RM()) pbDraw(0, 16); else if (!PB.raf) PB.raf = requestAnimationFrame(pbLoop); }
if (RM()) addEventListener('scroll', () => { if (S.page === 'carte' && PB.g && document.body.classList.contains('pb-on')) requestAnimationFrame(() => pbDraw(0, 16)); }, { passive: true });
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(pbMount).observe(app, { childList: true }); pbMount(); })();


/* ============================================================
   V43 — PARCOURS D'AVANT, CHEMIN ET NŒUDS PLUS BEAUX (04/11/2026)
   Thomas : « je préférais le parcours d'avant, je voulais juste que tu
   l'améliores » → choix : chemin et nœuds plus beaux ; points 3D gardés.
   Même page (V33), mêmes classes et attributs (mnode, data-cnode, data-exam,
   .mnode.cur, mn-here…). Ce qui change :
   - nœuds : anneau de progression net (tracé, bouts arrondis), disque
     brillant, couleur du chapitre quand il est fini, halo pour « Tu es ici » ;
   - noms des chapitres lisibles : posés sur une petite pastille sombre ;
   - « Tu es ici » placé sur le côté (il ne cache plus le nom du chapitre d'avant) ;
   - examens : tuile brillante bleu-violet (plus de vert) ;
   - chemin : tube lumineux en couches (halo, cœur, reflet) et de petites
     lumières qui avancent le long de la partie faite, jusqu'à « Tu es ici ».
   Interrupteur : NT_FX.nodes = false → nœuds et chemin V33.
   ============================================================ */
NT_FX.nodes = NT_FX.nodes !== false;
const _pcNodeV33 = pcNode, _pcLevelV33 = pcLevel;
const pcRing2 = (p, R = 30) => { const C = 2 * Math.PI * R; return `<svg class="mn-ring" viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="${R}" class="mn-trk"/>${p > 0 ? `<circle cx="34" cy="34" r="${R}" class="mn-arc" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - p)).toFixed(1)}"/>` : ''}</svg>`; };
pcNode = function(it, curCh, n){ if (!NT_FX.nodes) return _pcNodeV33(it, curCh, n);
  if (it.t === 'ex'){ const cert = S.certs[it.l.id];
    return `<button class="mnode ex nx ${cert ? 'done' : ''}" style="left:${it.x}%;top:${it.y}px;--n:${n}" data-exam="lv${it.l.id}" aria-label="Examen du niveau ${it.l.id}"><span class="mn-c">${I.trophy}${cert ? `<i class="nx-ok">${I.check}</i>` : ''}</span><span class="mn-l"><b>Examen ${it.l.id}</b><span>${cert ? 'Réussi · ' + cert.pct + ' %' : it.l.exam + ' questions'}</span></span></button>`; }
  const c = it.c, pr = chProgress(c.id), un = chUnlocked(c.id), prem = chPremium(c.id), cur = c.id === curCh, tool = TOOLS.find(t => t.ch === c.id);
  const cls = pr >= 1 ? 'done' : !un ? 'lock' : prem ? 'prem' : cur ? 'cur' : pr > 0 ? 'part' : 'todo', side = it.x < 50 ? 'r' : 'l';
  return `<button class="mnode nx ${cls}" style="left:${it.x}%;top:${it.y}px;--c:${c.color};--p:${(pr * 100).toFixed(0)};--n:${n}" data-cnode="${c.id}" aria-label="Chapitre ${c.id} : ${h(c.title)}, ${Math.round(pr * 100)} %">
    ${cur ? `<span class="pc-halo" aria-hidden="true"><i></i><i></i></span><span class="mn-here nx-${side}"><i></i>Tu es ici</span>` : ''}<span class="mn-c">${pcRing2(un && !prem ? pr : 0)}<span class="mn-in">${!un || prem ? I.lock : pr >= 1 ? I.check : c.id}</span></span>
    <span class="mn-l"><b>${h(c.title)}</b><span>${prem ? 'Premium' : Math.round(pr * 100) + ' %'}</span></span>
    ${tool ? `<span class="mn-tool ${toolOn(tool) ? 'on' : ''}" title="Débloque : ${h(tool.name)}">${toolOn(tool) ? tool.ic : IC2.gift}</span>` : ''}</button>`; };
/* le chemin : on garde le même tracé, en couches, et on note ses points pour les petites lumières */
pcLevel = function(l, ctx){ const html = _pcLevelV33(l, ctx); if (!NT_FX.nodes) return html;
  return html.replace(/<svg class="map-path pc-on"([^>]*)><path d="([^"]+)" class="mp-glow" vector-effect="non-scaling-stroke"\/><path d="[^"]+" class="mp-on" vector-effect="non-scaling-stroke"\/><\/svg>/,
    (m, attrs, d) => `<svg class="map-path pc-on nx-on"${attrs} data-d="${d}"><path d="${d}" class="mp-halo" vector-effect="non-scaling-stroke"/><path d="${d}" class="mp-glow" vector-effect="non-scaling-stroke"/><path d="${d}" class="mp-on" vector-effect="non-scaling-stroke"/><path d="${d}" class="mp-hi" vector-effect="non-scaling-stroke"/></svg>`); };
/* petites lumières qui avancent le long de la partie faite (déplacements seulement : la carte graphique s'en charge) */
function nxFlow(){ if (!NT_FX.nodes || RM() || S.page !== 'carte') return; document.querySelectorAll('.pc-map').forEach(map => { const sv = map.querySelector('.nx-on'); map.querySelectorAll('.nx-spark').forEach(x => x.remove()); if (!sv || !sv.dataset.d) return;
  const W = map.clientWidth; if (!W) return; const nums = sv.dataset.d.match(/-?[\d.]+/g).map(Number); if (nums.length < 8) return;
  /* M x y, puis des courbes : C x1 y1, x2 y2, x y */ const pts = []; let x0 = nums[0], y0 = nums[1];
  for (let i = 2; i + 5 < nums.length; i += 6){ const [x1, y1, x2, y2, x3, y3] = nums.slice(i, i + 6); for (let k = 0; k <= 16; k++){ const t = k / 16, u = 1 - t;
      pts.push([(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3) / 100 * W, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]); } x0 = x3; y0 = y3; }
  if (pts.length < 4) return; let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const kf = pts.map(p => ({ transform: `translate3d(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px,0)` })), dur = Math.max(2400, L / 70 * 1000), n = Math.min(3, Math.max(1, Math.round(L / 260)));
  for (let j = 0; j < n; j++){ const s = document.createElement('i'); s.className = 'nx-spark'; s.setAttribute('aria-hidden', 'true'); map.appendChild(s);
    try { s.animate(kf.concat([{ transform: kf[kf.length - 1].transform, opacity: 0 }]).map((f, i, a) => Object.assign({}, f, { opacity: i === 0 ? 0 : i === a.length - 1 ? 0 : 1 })), { duration: dur, iterations: Infinity, delay: -dur * j / n, easing: 'linear' }); } catch(e){ s.remove(); } } }); }
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(() => { if (S.page === 'carte') requestAnimationFrame(nxFlow); }).observe(app, { childList: true }); let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(nxFlow, 200); }, { passive: true }); if (S.page === 'carte') requestAnimationFrame(nxFlow); })();


/* ============================================================
   V44 — PARCOURS : NOUVELLES ANIMATIONS DE FOND (04/11/2026)
   Thomas : « mettre d'autres animations derrière » → choix : le graphique
   de ta progression + de nouveaux objets 3D en points, qui REMPLACENT les
   anciens (spirale, pièces, barres, fusée…). La page reste celle d'avant.
   - Graphique de ta progression (2D, discret) : une bougie par chapitre,
     les niveaux en lignes de prix, ta bougie qui pulse ; il suit le
     chapitre au centre de l'écran quand on défile.
   - Objets 3D, un par partie : un escalier (ton parcours), un engrenage
     (tes outils), une tirelire (N1 Les bases), des immeubles (N2
     Investisseur), des bougies en 3D (N3 Lire un graphique), un bouclier
     (N4 Trader : le risque), un globe relié (N5 Trader avancé : macro),
     une coupe (le sommet).
   Interrupteurs : NT_FX.pcchart = false (sans graphique) ; NT_FX.pcobj = false (anciens objets).
   ============================================================ */
NT_FX.pcchart = NT_FX.pcchart !== false;
NT_FX.pcobj = NT_FX.pcobj !== false;
const G3 = { cache: {} };
const gPick = W => { let r = R3() * W.reduce((a, b) => a + b[0], 0); for (const [w, f] of W){ if ((r -= w) <= 0) return f(); } return W[W.length - 1][1](); };
function gBox(cx, cy, cz, sx, sy, sz, e = 0.6){ const u = () => R3() - 0.5;
  if (R3() < e){ const ax = Math.floor(R3() * 3), a = R3() < 0.5 ? -0.5 : 0.5, b = R3() < 0.5 ? -0.5 : 0.5, t = u();
    return ax === 0 ? [cx + t * sx, cy + a * sy, cz + b * sz] : ax === 1 ? [cx + a * sx, cy + t * sy, cz + b * sz] : [cx + a * sx, cy + b * sy, cz + t * sz]; }
  const A = [sy * sz, sx * sz, sx * sy], r = R3() * (A[0] + A[1] + A[2]), f = r < A[0] ? 0 : r < A[0] + A[1] ? 1 : 2, s = R3() < 0.5 ? -0.5 : 0.5;
  return f === 0 ? [cx + s * sx, cy + u() * sy, cz + u() * sz] : f === 1 ? [cx + u() * sx, cy + s * sy, cz + u() * sz] : [cx + u() * sx, cy + u() * sy, cz + s * sz]; }
const gRotX = (p, a, y) => { const c = Math.cos(a), s = Math.sin(a), yy = p[1] - y; return [p[0], y + yy * c - p[2] * s, yy * s + p[2] * c]; };
const gRotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
const gCached = (key, f) => G3.cache[key] || (G3.cache[key] = f());
const G_TINT = ['#ffffff', '#c4b5ff', '#8fb4ff'];
/* un escalier qui monte, et un drapeau en haut : ton parcours */
function genStairs(n, w, y){ const out = [], st = 6, sw = w * 0.15, y0 = y - w * 0.4, x0 = -w * 0.45;
  for (let i = 0; i < n; i++) out.push(gRotY(gPick([
    [0.86, () => { const k = Math.floor(R3() * st), hh = w * (0.1 + k * 0.11); return gBox(x0 + (k + 0.5) * sw, y0 + hh / 2, 0, sw * 0.96, hh, w * 0.42, 0.62); }],
    [0.06, () => [x0 + 5.5 * sw, y0 + w * 0.65 + R3() * w * 0.32, 0]],
    [0.08, () => { const a = R3(), b = R3() * (1 - a); return [x0 + 5.5 * sw + a * w * 0.2, y0 + w * 0.97 - b * w * 0.14 - a * w * 0.07, 0]; }] ]), -0.55));
  return { pts: out, opts: { spin: 0.2, tint: G_TINT } }; }
/* un engrenage (et un petit à côté) : tes outils */
function gGear(cx, cy, R, r0, rh, T, th, ph){ const prof = a => { const f = ((a * T / 6.2832) + ph) % 1; const t = f < 0.35 ? 1 : f < 0.5 ? 1 - (f - 0.35) / 0.15 : f < 0.85 ? 0 : (f - 0.85) / 0.15; return r0 + (R - r0) * t; };
  const a = R3() * 6.2832, k = R3(), z = (R3() < 0.5 ? -0.5 : 0.5) * th;
  if (k < 0.62){ const rr = prof(a); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z]; }
  if (k < 0.72){ const rr = prof(a); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, (R3() - 0.5) * th]; }
  if (k < 0.86) return [cx + Math.cos(a) * rh, cy + Math.sin(a) * rh, z];
  const sp = Math.floor(R3() * 5) * 1.2566, rr = rh + (r0 - rh) * R3(); return R3() < 0.6 ? [cx + Math.cos(sp) * rr, cy + Math.sin(sp) * rr, z] : [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, z * 0.6]; }
function genGear(n, w, y){ const out = []; for (let i = 0; i < n; i++){ const p = R3() < 0.72 ? gGear(-w * 0.08, y + w * 0.02, w * 0.34, w * 0.28, w * 0.09, 10, w * 0.09, 0) : gGear(w * 0.39, y - w * 0.27, w * 0.17, w * 0.13, w * 0.045, 7, w * 0.08, 0.5); out.push(gRotY(gRotX(p, 0.28, y), -0.32)); }
  return { pts: out, opts: { spin: 0, tint: G_TINT } }; }
/* une tirelire et sa pièce : Les bases (épargne) */
function genPiggy(n, w, y){ const rx = w * 0.4, ry = w * 0.27, rz = w * 0.26, out = [], cyl = (x0, x1, yc, zc, r) => { const a = R3() * 6.2832; return [x0 + (x1 - x0) * R3(), yc + Math.cos(a) * r, zc + Math.sin(a) * r]; };
  for (let i = 0; i < n; i++) out.push(gPick([
    [0.55, () => { const u = R3() * 2 - 1, a = R3() * 6.2832, q = Math.sqrt(1 - u * u); return [Math.cos(a) * q * rx, y + u * ry, Math.sin(a) * q * rz]; }],
    [0.08, () => { const a = R3() * 6.2832, r = w * (R3() < 0.7 ? 0.1 : 0.1 * Math.sqrt(R3())); return [rx * 1.08, y + w * 0.02 + Math.cos(a) * r, Math.sin(a) * r * 1.1]; }],
    [0.03, () => { const a = R3() * 6.2832, s = R3() < 0.5 ? -1 : 1; return [rx * 1.09, y + w * 0.02 + Math.cos(a) * w * 0.022, s * w * 0.04 + Math.sin(a) * w * 0.022]; }],
    [0.05, () => { const x = rx * (0.95 + R3() * 0.13), a = R3() * 6.2832; return [x, y + w * 0.02 + Math.cos(a) * w * 0.1, Math.sin(a) * w * 0.11]; }],
    [0.12, () => { const L = Math.floor(R3() * 4), sx = L & 1 ? 1 : -1, sz = L & 2 ? 1 : -1; const a = R3() * 6.2832, yy = y - w * (0.17 + R3() * 0.2); return [sx * w * 0.2 + Math.cos(a) * w * 0.055, yy, sz * w * 0.12 + Math.sin(a) * w * 0.055]; }],
    [0.06, () => { const s = R3() < 0.5 ? -1 : 1, a = R3(), b = R3() * (1 - a); return [w * 0.2 + (a - 0.5) * w * 0.12, y + w * 0.2 + b * w * 0.15, s * (w * 0.11 + (R3() - 0.5) * w * 0.02)]; }],
    [0.03, () => { const t = R3() * 9; return [-rx * 1.02 - t * w * 0.006, y + w * 0.06 + Math.sin(t) * w * 0.035, Math.cos(t) * w * 0.035]; }],
    [0.04, () => [(R3() - 0.5) * w * 0.2, y + ry * 1.01, (R3() - 0.5) * w * 0.02]],
    [0.02, () => { const s = R3() < 0.5 ? -1 : 1, a = R3() * 6.2832; return [rx * 0.72 + Math.cos(a) * w * 0.016, y + w * 0.08 + Math.sin(a) * w * 0.016, s * w * 0.165]; }],
    [0.12, () => { const a = R3() * 6.2832, r = w * 0.095 * (R3() < 0.55 ? 1 : Math.sqrt(R3())); return [Math.cos(a) * r, y + ry + w * 0.2 + Math.sin(a) * r, (R3() - 0.5) * w * 0.02]; }] ]));
  return { pts: out, opts: { spin: 0.24, tint: G_TINT } }; }
/* des immeubles avec leurs fenêtres : Investisseur (les entreprises) */
function genBuilding(n, w, y){ const y0 = y - w * 0.42, T = [[-w * 0.13, w * 0.34, w * 0.98, w * 0.32], [w * 0.23, w * 0.27, w * 0.66, w * 0.27], [-w * 0.42, w * 0.18, w * 0.42, w * 0.2]], out = [];
  const win = t => { const [cx, sx, hy, sz] = t, front = R3() < 0.6, cols = front ? Math.max(3, Math.round(sx / (w * 0.065))) : Math.max(3, Math.round(sz / (w * 0.065))), rows = Math.round(hy / (w * 0.075));
    const c = Math.floor(R3() * cols), r = Math.floor(R3() * (rows - 1)) + 1, cw = (front ? sx : sz) / cols, rh = hy / rows, u = (c + 0.25 + R3() * 0.5) * cw - (front ? sx : sz) / 2, v = y0 + (r + 0.2 + R3() * 0.45) * rh;
    return front ? [cx + u, v, sz / 2 + 0.001] : [cx + sx / 2 + 0.001, v, u]; };
  for (let i = 0; i < n; i++){ const k = Math.floor(R3() * 3), t = T[k];
    out.push(gPick([[0.42, () => gBox(t[0], y0 + t[2] / 2, 0, t[1], t[2], t[3], 0.85)], [0.48, () => win(t)], [0.03, () => [T[0][0], y0 + T[0][2] + R3() * w * 0.2, 0]], [0.07, () => [(R3() - 0.5) * w * 1.1, y0, (R3() - 0.5) * w * 0.6]]])); }
  return { pts: out.map(p => gRotY(p, -0.5)), opts: { spin: 0.18, tint: G_TINT } }; }
/* des bougies en 3D sur une tendance qui monte : Lire un graphique */
function genCandles3(n, w, y){ const C = [[-0.1, 0.05], [0.05, 0.18], [0.18, 0.09], [0.09, 0.28], [0.28, 0.2], [0.2, 0.42], [0.42, 0.58]], b0 = y - w * 0.3, s = w * 0.15, out = [];
  for (let i = 0; i < n; i++){ const k = R3();
    if (k < 0.1){ const t = R3() * 6, i0 = Math.floor(t), f = t - i0, a = C[i0], b = C[Math.min(6, i0 + 1)], m = ((a[0] + a[1]) / 2) * (1 - f) + ((b[0] + b[1]) / 2) * f; out.push([(t - 3) * s, b0 + m * w + w * 0.05, w * 0.1]); continue; }
    if (k < 0.16){ out.push([(R3() - 0.5) * w * 1.15, b0 - w * 0.16, (R3() - 0.5) * w * 0.5]); continue; }
    const j = Math.floor(R3() * 7), [o, c] = C[j], up = c >= o, lo = Math.min(o, c), hi = Math.max(o, c), x = (j - 3) * s;
    if (R3() < 0.2){ out.push([x, b0 + (lo - 0.05 + (hi - lo + 0.11) * R3()) * w, 0]); continue; }
    out.push(gBox(x, b0 + (lo + hi) / 2 * w, 0, w * 0.095, Math.max(w * 0.02, (hi - lo) * w), w * 0.095, up ? 0.45 : 1)); }
  return { pts: out.map(p => gRotY(p, -0.42)), opts: { spin: 0, tint: ['#ffffff', '#8fb4ff', '#c4b5ff'] } }; }
/* un bouclier avec une coche : Trader (gérer le risque) */
function genShield(n, w, y){ return gCached('sh' + n + ':' + w.toFixed(3) + ':' + y.toFixed(3), () => { const ww = w * 0.95, o = 'M50 6 L86 19 V47 C86 71 70 85 50 94 C30 85 14 71 14 47 V19 Z', i2 = 'M50 17 L76 27 V47 C76 65 65 76 50 83 C35 76 24 65 24 47 V27 Z', ck = 'M34 50 L46 62 L67 38';
  const rim = NTGL.pathPts(o, Math.floor(n * 0.42), { w: ww, y, depth: 0, lw: 3.2 }).map(p => [p[0], p[1], (R3() < 0.5 ? -1 : 1) * w * 0.06 + (R3() - 0.5) * w * 0.01]);
  const side = NTGL.pathPts(o, Math.floor(n * 0.1), { w: ww, y, depth: 0, lw: 2.2 }).map(p => [p[0], p[1], (R3() - 0.5) * w * 0.12]);
  const inn = NTGL.pathPts(i2, Math.floor(n * 0.16), { w: ww, y, depth: 0, lw: 1.6 }).map(p => [p[0], p[1], w * 0.06]);
  const chk = NTGL.pathPts(ck, Math.floor(n * 0.22), { w: ww, y, depth: 0, lw: 6 }).map(p => [p[0], p[1], w * 0.07 + R3() * w * 0.04]);
  const fil = NTGL.pathPts('M0 0', n - Math.floor(n * 0.42) - Math.floor(n * 0.1) - Math.floor(n * 0.16) - Math.floor(n * 0.22), { w: ww, y, depth: 0, lw: 0.1, fill: i2 }).map(p => [p[0], p[1], w * 0.06]);
  const all = rim.concat(side, inn, chk, fil).map(q => gRotY(q, -0.3)); for (let i = all.length - 1; i > 0; i--){ const j = Math.floor(R3() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; } /* mélangés : si l'appareil n'affiche qu'une partie des points, toutes les parties restent visibles */
  return { pts: all, opts: { spin: 0, tint: G_TINT } }; }); }
/* un globe de points relié par des arcs : Trader avancé (macroéconomie) */
function genGlobe2(n, w, y){ const R = w * 0.36, F = 1100, ga = Math.PI * (3 - Math.sqrt(5)), fib = i => { const yy = 1 - (i + 0.5) / F * 2, r = Math.sqrt(1 - yy * yy), t = i * ga; return [Math.cos(t) * r, yy, Math.sin(t) * r]; };
  const cities = [[48.9, 2.3], [40.7, -74], [35.7, 139.7], [51.5, -0.1], [22.3, 114.2], [-33.9, 151.2], [19.1, 72.9], [-23.5, -46.6]].map(([la, lo]) => { la *= Math.PI / 180; lo *= Math.PI / 180; return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]; });
  const pairs = [[0, 1], [0, 2], [0, 4], [3, 1], [1, 7], [2, 5], [0, 6], [4, 5]], out = [];
  for (let i = 0; i < n; i++){ const p = gPick([
      [0.58, () => { const q = fib(Math.floor(R3() * F)); return [q[0] * R, q[1] * R, q[2] * R]; }],
      [0.26, () => { const [a, b] = pairs[Math.floor(R3() * pairs.length)], A = cities[a], B = cities[b], om = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]))), s = R3(), so = Math.sin(om) || 1, ka = Math.sin((1 - s) * om) / so, kb = Math.sin(s * om) / so, h = R * (1 + 0.28 * Math.sin(Math.PI * s) * om / Math.PI); return [(A[0] * ka + B[0] * kb) * h, (A[1] * ka + B[1] * kb) * h, (A[2] * ka + B[2] * kb) * h]; }],
      [0.08, () => { const c = cities[Math.floor(R3() * cities.length)], j = w * 0.018; return [c[0] * R + (R3() - 0.5) * j, c[1] * R + (R3() - 0.5) * j, c[2] * R + (R3() - 0.5) * j]; }],
      [0.08, () => { const a = R3() * 6.2832, r = R * (1.32 + (R3() - 0.5) * 0.03); return [Math.cos(a) * r, (R3() - 0.5) * w * 0.01, Math.sin(a) * r]; }] ]);
    out.push(gRotX([p[0], y + p[1], p[2]], 0.38, y)); }
  return { pts: out, opts: { spin: 0.26, tint: G_TINT } }; }
/* une coupe et une étoile : le sommet */
function genTrophy(n, w, y){ const out = [], rev = (yy, r) => { const a = R3() * 6.2832; return [Math.cos(a) * r, y + yy, Math.sin(a) * r]; };
  for (let i = 0; i < n; i++) out.push(gPick([
    [0.44, () => { const t = R3(), yy = w * (-0.1 + t * 0.36), r = w * (0.06 + 0.21 * Math.sqrt(t)); return rev(yy, r); }],
    [0.1, () => rev(w * 0.26, w * 0.27)],
    [0.08, () => { const t = R3(); return rev(w * (-0.3 + t * 0.2), w * (0.045 + 0.015 * (1 - t))); }],
    [0.14, () => { const t = R3(); return R3() < 0.5 ? rev(w * (-0.42 + t * 0.1), w * 0.2) : rev(w * -0.32, w * 0.2 * Math.sqrt(R3())); }],
    [0.14, () => { const s = R3() < 0.5 ? -1 : 1, th = (R3() - 0.5) * Math.PI, b = R3() * 6.2832, rt = w * 0.014; return [s * (w * 0.25 + Math.cos(th) * w * 0.1 + Math.cos(b) * rt), y + w * 0.1 + Math.sin(th) * w * 0.1 + Math.sin(b) * rt, Math.sin(b) * rt]; }],
    [0.1, () => { const k = Math.floor(R3() * 10), P = m => { const a = m * Math.PI / 5 - Math.PI / 2, r = m % 2 ? w * 0.036 : w * 0.09; return [Math.cos(a) * r, Math.sin(a) * r]; }, A = P(k), B = P((k + 1) % 10), t = R3(); return [A[0] + (B[0] - A[0]) * t, y + w * 0.47 - (A[1] + (B[1] - A[1]) * t), 0]; }] ]));
  return { pts: out, opts: { spin: 0.32, tint: G_TINT } }; }
/* on branche les nouveaux objets à la place des anciens */
if (NT_FX.pcobj){ Object.assign(PC_SCENE, { 1: 'piggy', 2: 'building', 3: 'candles3', 4: 'shield', 5: 'globe2' });
  Object.assign(PC_GEN, { helix: genStairs, rings: genGear, logo: genTrophy, piggy: genPiggy, building: genBuilding, candles3: genCandles3, shield: genShield, globe2: genGlobe2 }); }


/* ============================================================
   V45 — COURS VIDÉO EN SCHÉMAS ANIMÉS (04/11/2026)
   Thomas : remettre la vidéo au début de chaque cours, avec de belles
   transitions et « énormément d'images qui suivent exactement ce que le
   texte dit » (petits schémas), qui parle de TOUT le cours, le temps qu'il
   faut ; le plus important : contenu, transitions, animations, qualité.
   - Le script couvre tout : titre et objectif, la fiche de cours entière,
     CHAQUE question de la mission (expliquée avant d'être posée), l'exemple,
     « À retenir », puis « À toi de jouer ». Pas de durée maximale.
   - Chaque phrase a son schéma, choisi d'après ce qu'elle dit : graphique
     qui monte / baisse / varie, calcul pas à pas, chiffre qui compte,
     « de … à … », comparaison, question et bonne réponse, vrai ou faux,
     étapes, paires, panier diversifié, balance risque / rendement, carnet
     d'ordres, bougie, inflation, dessins (bouclier, tirelire…), fiche valeur
     ligne par ligne, avant / après en barres (1 000 € → 820 €), série de
     valeurs en barres, calcul écrit en mots (« 1 % moins 3 %, c'est −2 % »),
     dessin barré pour « jamais / interdit », 17 dessins en plus (document,
     alerte, cadenas, stop, volume, supports, loupe-œil, banque, taux…).
   - Rien n'est inventé : les barres et les écarts en % viennent des nombres
     du texte ; les parts du camembert restent un dessin, sans chiffre.
   - Les éléments du schéma apparaissent AU MOT où le texte en parle ; les
     mots s'allument au fil de la lecture.
   - Tout est dessiné en vectoriel (net sur tous les écrans) ; transitions
     variées entre les scènes (zoom, glissé, ouverture en cercle, montée).
   - La vidéo se lance au début de chaque mission et de chaque séance.
     Deux boutons seulement : Retour et Passer la vidéo.
   Interrupteurs : NT_FX.vid5 = false (ancienne vidéo) ; NT_FX.vidalways = false (vidéo la 1re fois seulement).
   ============================================================ */
NT_FX.vid5 = NT_FX.vid5 !== false;
NT_FX.vidalways = NT_FX.vidalways !== false;
const V5 = { skipOnce: false, uid: 0 };
const V5_NUM = '[−+-]?\\d{1,3}(?:[ \\u00a0\\u202f]\\d{3})+(?:,\\d+)?|[−+-]?\\d+(?:,\\d+)?';
const v5Val = s => parseFloat(String(s).replace(/[ \u00a0\u202f]/g, '').replace('−', '-').replace(',', '.'));
const v5Dec = s => { const m = String(s).match(/,(\d+)/); return m ? m[1].length : 0; };
const v5Clean = t => String(t || '').replace(/\s+/g, ' ').replace(/\s([,.])/g, '$1').trim();
const v5Short = (t, n = 5) => { const w = v5Clean(t).replace(/[.?!:;]+$/, '').split(' '); return w.length > n ? w.slice(0, n).join(' ') + '…' : w.join(' '); };
const v5Hash = s => { let x = 7; for (const c of String(s)) x = (Math.imul(x, 31) + c.charCodeAt(0)) >>> 0; return x; };
const v5Rnd = seed => { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
/* nouveaux dessins (traits sur 100 × 100) pour que l'image suive le texte : documents, alerte, cadenas, stop, volume, niveaux, émotions… */
Object.assign(ZSHAPE, {
  doc: 'M28 12 H60 L76 28 V88 H28 Z M60 12 V28 H76 M38 44 H66 M38 56 H66 M38 68 H56',
  book: 'M50 26 Q34 16 12 20 V80 Q34 76 50 86 Q66 76 88 80 V20 Q66 16 50 26 Z M50 26 V86 M22 34 Q32 32 40 36 M22 46 Q32 44 40 48 M60 36 Q68 32 78 34 M60 48 Q68 44 78 46',
  check: 'M10 50 A40 40 0 1 1 90 50 A40 40 0 1 1 10 50 Z M32 51 L45 64 L69 38',
  cross: 'M10 50 A40 40 0 1 1 90 50 A40 40 0 1 1 10 50 Z M36 36 L64 64 M64 36 L36 64',
  lock: 'M28 46 H72 Q78 46 78 52 V82 Q78 88 72 88 H28 Q22 88 22 82 V52 Q22 46 28 46 Z M34 46 V32 Q34 14 50 14 Q66 14 66 32 V46 M50 60 V72',
  stop: 'M33.4 10 H66.6 L90 33.4 V66.6 L66.6 90 H33.4 L10 66.6 V33.4 Z M30 50 H70',
  megaphone: 'M14 42 V60 H28 L66 80 V22 L28 42 Z M28 60 L34 84 H44 L40 64 M76 38 Q84 51 76 64 M84 30 Q96 51 84 72',
  bars: 'M12 88 H90 M22 84 V62 M36 84 V44 M50 84 V68 M64 84 V28 M78 84 V52',
  levels: 'M8 28 H92 M8 72 H92 M12 64 L24 40 L36 58 L50 34 L62 56 L74 36 L88 48',
  pulse: 'M10 50 A40 40 0 1 1 90 50 A40 40 0 1 1 10 50 Z M18 52 H34 L41 34 L51 70 L60 42 L65 52 H82',
  eye: 'M8 50 Q50 12 92 50 Q50 88 8 50 Z M38 50 A12 12 0 1 1 62 50 A12 12 0 1 1 38 50 Z',
  link: 'M 42.7 57.3 L 57.3 42.7 M 37.8 47.6 L 25.6 59.8 Q 13.4 72 25.6 84.2 Q 37.8 96.4 50 84.2 L 62.2 72 M 62.2 52.4 L 74.4 40.2 Q 86.6 28 74.4 15.8 Q 62.2 3.6 50 15.8 L 37.8 28',
  percent: 'M76 16 L24 84 M20 30 A12 12 0 1 1 44 30 A12 12 0 1 1 20 30 Z M56 70 A12 12 0 1 1 80 70 A12 12 0 1 1 56 70 Z',
  bank: 'M10 34 L50 12 L90 34 Z M20 42 V76 M35 42 V76 M50 42 V76 M65 42 V76 M80 42 V76 M10 84 H90',
  thermo: 'M44 62 V20 Q44 12 50 12 Q56 12 56 20 V62 A14 14 0 1 1 44 62 Z M50 44 V72',
  bulb: 'M36 62 Q22 52 22 38 Q22 12 50 12 Q78 12 78 38 Q78 52 64 62 V70 H36 Z M40 80 H60 M44 89 H56',
  tag: 'M14 50 V16 H48 L88 56 L58 86 Z M26 32 A6 6 0 1 1 38 32 A6 6 0 1 1 26 32 Z' });
ZMAP.push(['cross', /impossible|jamais|interdit|ignorer|non verifi|sans source|rumeur|opinion|aucun outil|ne s.annulent pas|pas eligible|ne compte pas|ne dit pas|n.est pas la tienne/],
  ['warn', /signal d.alerte|suspect|mefiance|urgence|chantage|usurpation|faux site|non sollicit|manipul|non autoris|speculation|imitent/],
  ['doc', /document|recapitulatif|\bifu\b|definition|publie|contrat|\bfiche|rapport|declar|mention/], ['book', /journal|bilan|\bnotes?\b|ecri[st]|carnet/],
  ['check', /bon signe|bonne source|solide|verifi|fiable|serieux|exonere|officiel|vont dans le meme sens|marchent vraiment/], ['lock', /fuite|mot de passe|identifiant|\bportes?\b|cle de/],
  ['stop', /\bstop|tu sors|sortir/], ['megaphone', /publicite|promotion|influenceu|annonce/], ['bars', /volume|echanges|participation/],
  ['levels', /support|resistance|\bzones?\b|niveau|cassure|au-dessus|en dessous|retombe/], ['pulse', /emotion|humeur|stress|fatigu|presse|envie|peur|panique|ressenti|bruit/],
  ['eye', /repere|surveill|regard|observ|indecision|revele/], ['link', /\blien|sms|correle/], ['percent', /\btaux|pourcentage|surachete|survendu|\brsi\b/],
  ['bank', /banque|\bbce\b|\bfed\b|\bloi\b|\bamf\b|autorit|reglement|agrement|agree/], ['thermo', /thermometre|temperature/], ['bulb', /\bidee|astuce|lecon|\bregles?\b|\bplan\b|decide|definir/],
  ['tag', /\bprix\b|plus cher|tarif|\bcoute|facture|frais/], ['car', /carburant|essence/], ['calendar', /hebdomadaire|chaque annee|chaque semaine/], ['clock', /retard|\bavant\b/]);
const v5Icon = (name, sz = 100) => { const d = ZSHAPE[name] || ZSHAPE.target; return `<svg class="v5-svgic" viewBox="0 0 100 100" width="${sz}" height="${sz}" aria-hidden="true"><path d="${d}" class="vgl"/><path d="${d}" class="vln vdr" pathLength="1"/></svg>`; };

/* ---------- 1. le script : tout le cours, dans l'ordre ---------- */
function v5Parts(t){ /* un paragraphe → des phrases lisibles (24 mots max par scène) */
  const out = []; v18Sents(t).forEach(s => { const w = s.split(/\s+/); if (w.length <= 26) return out.push(s); const k = s.search(/[:;]\s/); if (k > 20 && k < s.length - 20){ out.push(s.slice(0, k + 1)); out.push(s.slice(k + 2).replace(/^./, c => c.toUpperCase())); } else out.push(s); });
  return out; }
function v5Script(m){ const L = [], seen = new Set(), key = t => norm(t).replace(/[^a-z0-9]+/g, '').slice(0, 42);
  const add = it => { const k = key((it.q || '') + (it.t || '') + (it.head || '')); if (!k || seen.has(k)) return; seen.add(k); L.push(it); };
  const ch = m.ch ? CH.find(c => c.id === m.ch) : null, f = (m.ch && ficheFor(m.id)) || (m.ch ? CO.find(x => x.ch === m.ch && x.ms.includes(m.id)) : null);
  L.push({ k: 'title', eb: ch ? `Chapitre ${ch.id} · ${ch.title}` : m.session ? 'Ta séance du jour' : 'Cours', head: m.title, t: m.goal || (f ? f.title : ''), n: ch ? ch.id : m.dur || null, nl: ch ? 'CHAPITRE' : m.dur ? 'MINUTES' : 'NOVATITRE' });
  /* le cours écrit à la main (chapitre 1) */
  (ZSCRIPT[m.id] || []).forEach(x => add({ k: 'say', t: x.t, hint: x.s || (x.shape ? [x.shape] : null), eb: 'Le cours' }));
  /* la fiche de cours, en entier */
  if (f) f.body.forEach(p => { const ps = v5Parts(p); if (ps.length === 2 && /c[’']est/.test(ps[0]) && /c[’']est/.test(ps[1]) && p.split(/\s+/).length <= 42) add({ k: 'say', t: p, eb: 'Le cours', tpl: 'vs2' }); else ps.forEach(s => add({ k: 'say', t: s, eb: 'Le cours' })); });
  /* chaque question de la mission, expliquée avant d'être posée */
  const stepsN = (m.steps || []).length; let qi = 0;
  /* le chapitre 1 a son cours écrit à la main, qui explique déjà chaque question */
  (ZSCRIPT[m.id] ? [] : (m.steps || [])).forEach(st => { const eb = () => `Notion ${++qi}`; switch (st.type){
    case 'lesson': (st.cards || []).forEach(c => { if (c.k === 'guess' && c.opts) add({ k: 'qa', eb: c.h || 'À ton avis', q: c.t, choices: c.opts, a: c.a, t: c.r || '' });
        else if (c.k === 'tap' && c.hidden) add({ k: 'vf', eb: c.h || 'Attention', q: c.t, ans: /^oui\b/i.test(c.hidden) ? true : /^non\b/i.test(c.hidden) ? false : null, t: c.hidden });
        else add({ k: 'say', eb: c.h || 'Le cours', t: c.t, viz: c.viz }); }); break;
    case 'brief': add({ k: 'say', eb: 'Le contexte', t: st.text }); break;
    case 'qcm': if (st.choices && st.q) add({ k: 'qa', eb: eb(), q: st.q, choices: st.choices, a: st.answer, t: st.explain || '' }); break;
    case 'vf': add({ k: 'vf', eb: eb(), q: st.q, ans: !!st.answer, t: st.explain || '' }); break;
    case 'calc': add({ k: 'say', eb: eb(), head: v5Clean(st.q).replace(/\s*\?$/, ' ?'), t: st.explain || '', calcAns: st.answer, unit: st.unit }); break;
    case 'order': if (st.items) add({ k: 'steps', eb: eb(), head: st.q || 'Dans l’ordre', items: st.items, t: st.explain || `Dans l’ordre : ${st.items.join(', puis ')}.` }); break;
    case 'match': if (st.pairs) add({ k: 'pairs', eb: eb(), head: st.q || 'Les bonnes paires', pairs: st.pairs, t: st.explain || st.pairs.map(p => `${p[0]} : ${p[1]}`).join('. ') + '.' }); break;
    case 'swipe': (st.cards || []).forEach(c => { if (c.explain) add({ k: 'say', eb: eb(), head: v5Short(c.t, 9), t: c.explain }); }); break;
    case 'decision': if (st.explain) add({ k: 'say', eb: 'La bonne décision', t: st.explain }); break;
    default: if (st.explain) add({ k: 'say', eb: eb(), t: st.explain }); } });
  if (f && f.ex) add({ k: 'say', eb: 'Exemple', t: f.ex });
  if (f && f.key && f.key.length) add({ k: 'recap', eb: 'À retenir', head: 'À retenir', items: f.key.slice(0, 4), t: f.key.slice(0, 4).join(' ') });
  L.push({ k: 'go', t: 'À toi de jouer', eb: stepsN ? `${stepsN} question${stepsN > 1 ? 's' : ''} t’attendent` : '' });
  return L.map((it, i) => v5Scene(it, i, L)); }

/* ---------- 2. choisir le schéma d'après ce que dit la phrase ---------- */
const V5_RE = {
  calc: new RegExp(`(${V5_NUM})\\s?(Md€|M€|k€|€|%)?\\s([−+×÷])\\s(${V5_NUM})\\s?(Md€|M€|k€|€|%)?(?:\\s([−+×÷])\\s(${V5_NUM})\\s?(Md€|M€|k€|€|%)?)?\\s[=≈]\\s(${V5_NUM})\\s?(Md€|M€|k€|€|%|ans?|mois)?`),
  fromto: new RegExp(`\\b[Dd]e\\s(${V5_NUM})\\s?(Md€|M€|€|%)?\\s(?:à|a)\\s(${V5_NUM})\\s?(Md€|M€|€|%)?`),
  numu: new RegExp(`(${V5_NUM})\\s?(Md€|M€|k€|€|%|ans|an|mois|fois|entreprises|valeurs)`, 'g') };
function v5Pick(it){ if (it.tpl) return it.tpl; const t = it.t || '', n = norm(t + ' ' + (it.head || ''));
  if (it.calcAns != null || V5_RE.calc.test(t) || v5Ops(t) || v5WOps(t)) return V5_RE.calc.test(t) || v5Ops(t) || v5WOps(t) ? 'calc' : 'num';
  if (v5KV(t)) return 'kv';
  if (v5Fiche(t)) return 'fiche';
  if (/→/.test(t) && t.split('→').length <= 4) return 'flow';
  /* cours écrit à la main : ses dessins prévus, sauf si la phrase décrit une courbe */
  if (it.hint && it.hint.length){ const n0 = norm(t), H = it.hint; if (/monter ou baisser|monte ou baisse|varie|volatil/.test(n0)) return 'chart'; if (V5_RE.fromto.test(t)) return 'fromto'; if (v5AB(t)) return 'ab'; if (/faible au debut|s.accelere|exponenti|de plus en plus vite|boule de neige/.test(n0)) return 'chart'; if (v5List(t)) return 'steps'; if (H.includes('pie') && /entreprises|indice|diversif|etf|repart/.test(n0)) return 'pie'; if (H[0] === 'scale' && /risque|rendement/.test(n0)) return 'scale'; return 'icon'; }
  if (v5DefM(t)) return 'def';
  if (V5_RE.fromto.test(t)) return 'fromto';
  if (v5AB(t)) return 'ab';
  const pieOk = !/frais/.test(n) && !new RegExp(`${V5_NUM}\\s?(€|%)`).test(t);
  if (it.viz === 'basket' && pieOk && /diversif|repart|panier|etf|indice|portefeuille|entreprises|plusieurs/.test(n)) return 'pie'; if (it.viz === 'down') return 'chart';
  if (/spread|carnet d.ordres|meilleur prix (de vente|d.achat)/.test(n)) return 'book';
  if (/bougie|meche|cloture|ouverture et|plus haut|plus bas|doji|seance precedente/.test(n)) return 'candle';
  if (/inflation|pouvoir d.achat|hausse (generale )?des prix/.test(n)) return 'infl';
  if (/rendement[^.]*risque|risque[^.]*rendement|equilibr/.test(n)) return 'scale';
  if (pieOk && /diversif|repart|panier|\betf\b|plusieurs (entreprises|secteurs)|un indice (boursier|qui|mesure|suit)|indice boursier|cac 40|s&p 500|msci/.test(n)) return 'pie';
  if (/monter ou baisser|monte ou baisse|varie|volatil|fluctu|hausse ou baisse/.test(n) || /krach|chute|baisse|perd|recul|negatif|[−-]\d+ ?%/.test(n) || /compos|doubl|boule de neige|faible au debut|s.accelere|exponenti|de plus en plus vite|croissance|grimpe|hausse|progress/.test(n)) return 'chart';
  if ((t.replace(/\([^)]*\)/g, '').match(V5_RE.numu) || []).length) return 'num';
  const items = v5List(t); if (items) return 'steps';
  if (v5Vs(t)) return 'vs';
  return 'icon'; }
function v5List(t){ const s = v5Clean(t).replace(/[.!]$/, ''), k = s.indexOf(' : '), body = (k > 0 && k < 60 ? s.slice(k + 3) : s).replace(/\([^)]*\)/g, m => m.replace(/,/g, '\u0001')), parts = body.split(/,\s|\spuis\s|;\s|\set\s(?=[a-zà-ÿ]+\s)/).map(x => x.trim().replace(/\u0001/g, ',')).filter(Boolean);
  if (parts.length < 3 || parts.length > 5 || parts.some(x => x.split(' ').length > 8 || x.length < 3)) return null; return parts.map(x => x.replace(/^(et|puis|ou)\s/, '').replace(/^./, c => c.toUpperCase())); }
function v5Vs(t){ const s = v5Clean(t), pz = s.match(/(?:^|:\s)([A-ZÀ-Ýa-zà-ÿ’'-]{2,20}(?:\s[A-ZÀ-Ýa-zà-ÿ’'-]{2,14})?)\s\(([^)]{2,50})\)\s+ou\s+([A-ZÀ-Ýa-zà-ÿ’'-]{2,20}(?:\s[A-ZÀ-Ýa-zà-ÿ’'-]{2,14})?)\s\(([^)]{2,60})\)/);
  if (pz){ const r = [pz[1], pz[3]].map(x => x.replace(/^./, c => c.toUpperCase())); r.sub = [pz[2], pz[4]].map(x => x.replace(/^./, c => c.toUpperCase())); return r; }
  const q = s.match(/^(?:[^?]*?\b)?([A-ZÀ-Ýa-zà-ÿ’' -]{2,26}?)\s+ou\s+([A-ZÀ-Ýa-zà-ÿ’' -]{2,26}?)\s*\?/);
  if (q) return [q[1], q[2]].map(x => x.trim().split(' ').slice(-3).join(' ')).map(x => x.replace(/^./, c => c.toUpperCase()));
  const c = s.match(/(?:^|\.\s)([A-ZÀ-Ý][^,.]{1,24}),\s*c[’']est.+?\.\s+([A-ZÀ-Ý][^,.]{1,24}),\s*c[’']est/); if (c) return [c[1], c[2]];
  return null; }
const V5_WOP = { moins: '−', plus: '+', fois: '×', 'divisé par': '÷' };
const v5WOps = t => { const s = v5Clean(t), m = s.match(new RegExp(`(${V5_NUM})\\s?(%|€)?\\s(moins|plus|fois|divisé par)\\s(${V5_NUM})\\s?(%|€)?,?\\s(?:c[’']est|ça fait|soit|donne|égale?)\\s(${V5_NUM})\\s?(%|€)?`));
  if (!m) return null; const u = (n, x) => n.trim() + (x ? ' ' + x : ''); return { m, s, tk: [{ s: u(m[1], m[2]), f: m[1].trim() }, { s: V5_WOP[m[3]], op: 1, f: m[3] }, { s: u(m[4], m[5]), f: m[4].trim() }, { s: '=', op: 1 }, { s: u(m[6], m[7]), res: 1, f: m[6].trim() }] }; };
const v5AB = t => { const s = v5Clean(t), n = norm(s); if (/par mois|[×÷]/.test(n)) return null;
  const L = [...s.matchAll(new RegExp(`(${V5_NUM})\\s?(Md€|M€|k€|€)`, 'g'))]; if (L.length !== 2) return null; const mid = norm(s.slice(L[0].index + L[0][0].length, L[1].index)); if (!/≈|equivalent|devient|n.achet|ne vaut|ne valent|plus que|donne|rapporte|grimpe|passe a|atteint/.test(mid) || /[(+−=]/.test(mid)) return null; const a = v5Val(L[0][1]), b = v5Val(L[1][1]); if (!isFinite(a) || !isFinite(b) || a <= 0 || b <= 0 || a === b) return null;
  const y = s.match(/(?:pendant|après|dans|au bout de)\s(\d+)\s(ans|mois)/); return { s, A: L[0], B: L[1], a, b, y: y ? `${/mois/.test(y[2]) ? 'Après' : 'Après'} ${y[1]} ${y[2]}` : 'Après', infl: /equivalent|n.achet|pouvoir d.achat|inflation/.test(n) }; };
const v5NB = (a, b) => (/^[−+-]?\d{1,3}$/.test(a) && /^\d{3}/.test(b)) || /^(%|€|Md€|M€|k€|\?|!|:|;|»)[.,;:!?)]*$/.test(b) || a === '«';
/* typographie : pas de coupure dans « 1 000 € », « 2 % », « PEA : » (texte des schémas seulement, jamais dans les attributs) */
const v5NBT = t => t.replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0').replace(/ (Md€|M€|k€|€|%)/g, '\u00a0$1').replace(/ ([?!:;»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');
const v5NBH = html => String(html).replace(/>([^<]+)</g, (m, t) => '>' + v5NBT(t) + '<');
const v5Wi = (s, pos) => zWords(s.slice(0, pos)).length;
const v5Ops = t => { const s0 = v5Clean(t), first = (v18Sents(s0)[0] || s0).replace(/[.]$/, ''); if (!/\s=\s/.test(first)) return null; const parts = first.split(/\s([−+×÷=])\s/); if (parts.length < 3 || parts.length > 11) return null;
  if (!parts.some((p, i) => i % 2 === 1 && p !== '=') && !/\d/.test(first)) return null;
  const toks = parts.map((p, i) => ({ s: i % 2 ? p : p.split(/\s:\s|,\s/)[i === parts.length - 1 ? 0 : 0].trim(), op: i % 2 === 1 })); if (toks.some(x => !x.op && (zWords(x.s).length > 6 || !x.s))) return null;
  const lastEq = parts.lastIndexOf('='); toks.forEach((x, i) => { x.res = !x.op && i > lastEq; }); return toks; };
const v5KV = t => { const re = new RegExp(`([A-ZÀ-Ýa-zà-ÿ][A-Za-zÀ-ÿ’' ]{0,16}?(?:\\s\\d{1,2})?)\\s?:\\s(?:[a-zà-ÿ’' ]{0,14}\\s)?(${V5_NUM})\\s?(€|%)`, 'g'), L = [...String(t).matchAll(re)].map(m => ({ l: m[1].trim(), v: v5Val(m[2]), s: m[2].trim() + ' ' + m[3], u: m[3] })); return L.length >= 3 && L.length <= 7 && L.every(x => x.u === L[0].u && isFinite(x.v)) ? L : null; };
const v5Fiche = t => { const s = v5Clean(t).replace(/[.]$/, ''), P = s.split(/\s·\s/); if (P.length < 3 || P.length > 6) return null; let pos = 0;
  const L = P.map(x => { const m = x.match(/^([A-Za-zÀ-ÿ’' ]*?)\s?([−+-]?\d[\d\s,.]*.*)$/); const k = s.indexOf(x, pos); pos = k + x.length; return m && x.split(' ').length <= 5 ? { l: m[1].trim() || (/^[+−-].*%$/.test(m[2].trim()) ? 'Variation' : ''), v: m[2].trim(), k } : null; });
  return L.every(Boolean) ? { s, L } : null; };
const v5DefM = t => { const s = v5Clean(t).replace(/[.]$/, ''), m = s.match(/^(.{2,44}?)\s(=|:)\s(.{2,110})$/); if (!m || /^(faux|vrai|exemple|attention)$/i.test(m[1]) || zWords(m[1]).length > 6 || zWords(m[3]).length > 18) return null; return { L: m[1].replace(/^(L[ea]\s|Les\s|L’)/, s0 => s0), op: m[2], R: m[3] }; };
const v5Term = t => { const s = v5Clean(t); let m = s.match(/^(?:L[ea]\s|Les\s|L’|Un\s|Une\s)?([^:,.?]{3,30})\s:\s/); if (m) return m[1]; m = s.match(/^(?:L[ea]\s|Les\s|L’|Un\s|Une\s)?([^:,.?]{3,30}),\s*c[’']est/); return m ? m[1] : null; };
function v5ChartMode(it){ const n = norm((it.t || '') + ' ' + (it.head || ''));
  if (/monter ou baisser|monte ou baisse|hausse ou baisse|varie|volatil|fluctu/.test(n)) return 'both';
  if (/compos|doubl|boule de neige|faible au debut|s.accelere|exponenti|de plus en plus vite/.test(n)) return 'expo';
  if (/krach|chute|baisse|perd|recul|negatif|[−-]\d+ ?%/.test(n) || it.viz === 'down') return 'down';
  return 'up'; }

/* ---------- 3. fabriquer une scène : schéma + texte + moments clés ---------- */
function v5Words(t){ const w = zWords(t || ''), times = []; let acc = 0; w.forEach(x => { times.push(acc); acc += zWordMs(x); }); return { w, times, len: acc }; }
function v5Scene(it, idx, L){ const id = 'v5' + (++V5.uid), tpl = it.k === 'say' ? v5Pick(it) : it.k, cues = [];
  /* le texte de la question / du titre est lu avant l'explication */
  const headW = it.head ? zWords(it.head).length : 0, qW = it.q ? zWords(it.q).length : 0;
  const capStart = { title: 900, go: 600, qa: 900 + qW * 230 + 1100, vf: 800 + qW * 230 + 900, steps: 700, pairs: 700, recap: 600 }[tpl] ?? (700 + headW * 160);
  const C = v5Words(it.t), at = i => capStart + (C.times[Math.max(0, Math.min(C.times.length - 1, i))] || 0), wAt = re => { const i = C.w.findIndex(x => re.test(norm(x))); return i < 0 ? -1 : at(i); };
  const cue = (ms, k) => cues.push([Math.max(0, Math.round(ms)), String(k)]);
  const X = { it, id, tpl, C, at, wAt, cue, capStart, end: capStart + C.len };
  const viz = v5NBH((V5T[tpl] || V5T.icon)(X));
  const kw = new Set(); const kre = /\d|risque|rendement|garanti|interet|inflation|diversif|frais|action|obligation|etf|indice|dividende|precaution|arnaque|spread|stop|benefice|marge|dette|taux|impot|pea|livret/;
  C.w.forEach((w, i) => { if (kre.test(norm(w))) kw.add(i); });
  const min = { title: 3800, go: 2600, calc: 4200, def: 3400, flow: 4200, qa: 3800, vf: 3800, steps: 3600, pairs: 3600, recap: 3600 }[tpl] || 3600;
  return { k: it.k === 'go' ? 'go' : 'say', tpl, id, eb: it.eb || '', head: it.head || '', t: it.t || '', q: it.q || '', words: C.w, times: C.times.map(x => x + capStart), kw: [...kw], viz, cues: cues.sort((a, b) => a[0] - b[0]), ms: Math.max(min, X.end + (it.k === 'go' ? 900 : 1300)), shape: 'logo' }; }

/* ---------- 4. les schémas ---------- */
const V5_TINT = `<defs><linearGradient id="IDg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c4b5ff"/><stop offset="1" stop-color="#6f8dff"/></linearGradient>
  <linearGradient id="IDa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f74ff" stop-opacity=".42"/><stop offset="1" stop-color="#8f74ff" stop-opacity="0"/></linearGradient>
  <linearGradient id="IDr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8fb1" stop-opacity=".35"/><stop offset="1" stop-color="#ff8fb1" stop-opacity="0"/></linearGradient>
  <radialGradient id="IDh"><stop offset="0" stop-color="#8f74ff" stop-opacity=".45"/><stop offset="1" stop-color="#8f74ff" stop-opacity="0"/></radialGradient></defs>`;
const v5Defs = id => V5_TINT.replace(/ID/g, id);
const V5T = {
  /* titre : grand anneau, numéro du chapitre, orbite */
  title(X){ const n = X.it.n, C = 2 * Math.PI * 62; X.cue(0, 0); X.cue(250, 1); X.cue(700, 2);
    return `<svg class="v5-svg" viewBox="0 0 320 220">${v5Defs(X.id)}<circle cx="160" cy="110" r="96" fill="url(#${X.id}h)"/>
      <g data-c="0"><circle cx="160" cy="110" r="62" class="vtrk"/><circle cx="160" cy="110" r="62" class="varc vdr" pathLength="1" stroke="url(#${X.id}g)" transform="rotate(-90 160 110)"/></g>
      <g data-c="1" class="vspin"><circle cx="160" cy="110" r="82" class="vorb"/><circle cx="242" cy="110" r="3.5" fill="#fff"/></g>
      <g data-c="2"><text x="160" y="${n ? 126 : 122}" text-anchor="middle" class="vbig">${n ? n : 'N'}</text><text x="160" y="150" text-anchor="middle" class="vsm">${X.it.nl || 'NOVATITRE'}</text></g></svg>`; },
  /* fin : le logo se dessine */
  go(X){ X.cue(0, 0); X.cue(500, 1);
    return `<div class="v5-go"><svg data-c="0" class="v5-logo" viewBox="392 172 742 610" aria-hidden="true">${LOGO_D.map(d => `<path d="${d}"/>`).join('')}</svg><span data-c="1" class="v5-go-t">C’est parti</span></div>`; },
  /* dessin(s) : 1 ou 2 dessins ; le 2e arrive au mot qui en parle */
  icon(X){ let hint = (X.it.hint && X.it.hint.length ? X.it.hint : zShapesFor(X.it.t)).filter(s => ZSHAPE[s]);
    /* « pas de… » : on barre le dessin au lieu d'en mettre deux contradictoires */ if (hint.includes('cross') && hint.includes('check')) hint = hint.filter(k => k !== (hint.indexOf('cross') < hint.indexOf('check') ? 'check' : 'cross')); let no = false; if (!X.it.hint && hint.length > 1 && (hint[0] === 'cross' || (hint.includes('cross') && /interdit/.test(norm(X.it.t))))){ hint = [hint.find(k => k !== 'cross')]; no = true; }
    hint = hint.slice(0, 2); const sh = hint.length ? hint : ['target'], term = v5Term(X.it.t);
    X.cue(80, 0); X.cue(150, 'o'); if (no){ const tn = X.wAt(/jamais|\bpas\b|aucun|sans|impossible|interdit|\bni\b/); X.cue(Math.max(900, tn > 0 ? tn : 900), 'n'); }
    if (sh[1]){ const re = (ZMAP.find(([k]) => k === sh[1]) || [])[1]; let t2 = re ? X.wAt(re) : -1; if (t2 < 900) t2 = X.at(Math.floor(X.C.w.length * 0.45)); X.cue(t2, 'b1'); X.cue(t2 + 120, 1); }
    return `<div class="v5-icon ${sh[1] ? 'vtwo' : ''}"><i class="vhalo"></i><i data-c="o" class="vring"></i><div class="vi0" data-c="0">${v5Icon(sh[0], 132)}</div>${no ? `<svg class="vno" viewBox="0 0 100 100" data-c="n" aria-hidden="true"><path d="M14 86 L86 14" class="vln vdr" pathLength="1"/></svg>` : ''}${sh[1] ? `<span class="varw" data-c="1"></span><div class="vi1" data-c="1">${v5Icon(sh[1], 132)}</div>` : ''}
      ${term && zWords(term).length <= 3 ? `<span class="v5-term" data-c="0">${h(term)}</span>` : ''}</div>`; },
  /* graphique : monte, baisse, varie (deux chemins) ou effet boule de neige */
  chart(X){ const mode = v5ChartMode(X.it), r = v5Rnd(v5Hash(X.it.t)), N = 34, x0 = 26, x1 = 300, y0 = 30, y1 = 176, P = [];
    const fy = u => mode === 'up' ? 0.15 + 0.62 * u + (r() - 0.5) * 0.12 : mode === 'expo' ? 0.08 + 0.82 * (Math.exp(2.6 * u) - 1) / (Math.exp(2.6) - 1) + (r() - 0.5) * 0.03 : mode === 'down' ? (u < 0.62 ? 0.45 + 0.35 * u + (r() - 0.5) * 0.1 : 0.66 - (u - 0.62) * 1.45 + (r() - 0.5) * 0.06) : 0.5 + (r() - 0.5) * 0.36;
    const pt = (u, v) => [x0 + (x1 - x0) * u, y1 - (y1 - y0) * Math.max(0, Math.min(1, v))];
    const nB = mode === 'both' ? 18 : N; for (let i = 0; i < nB; i++){ const u = mode === 'both' ? i / (N - 1) : i / (N - 1); P.push(pt(u, mode === 'both' ? 0.5 + (r() - 0.5) * 0.14 : fy(u))); }
    const d = a => a.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), area = a => d(a) + ` L${a[a.length - 1][0].toFixed(1)} ${y1} L${a[0][0].toFixed(1)} ${y1} Z`;
    let up = null, dn = null; if (mode === 'both'){ const s = P[P.length - 1]; up = [s]; dn = [s]; const u0 = (nB - 1) / (N - 1); for (let i = 1; i <= N - nB; i++){ const u = u0 + i / (N - 1); up.push(pt(u, 0.5 + (u - u0) * 1.05 + (r() - 0.5) * 0.06)); dn.push(pt(u, 0.5 - (u - u0) * 0.95 + (r() - 0.5) * 0.06)); } }
    const nums = (X.it.t.match(new RegExp(`(${V5_NUM})\\s?%`, 'g')) || []).map(x => x.replace(/\s/g, ' ')), lab = nums.length ? nums[nums.length - 1] : mode === 'expo' && /doubl/.test(norm(X.it.t)) ? '×2' : '';
    const last = mode === 'both' ? null : P[P.length - 1], tw = X.wAt(/hausse|monte|gagn|baiss|chute|perd|krach|varie|compos|doubl|monter|baisser/); X.cue(0, 0); X.cue(250, 1); X.cue(Math.max(1200, tw > 0 ? tw : 1400), 2);
    return `<svg class="v5-svg" viewBox="0 0 320 210">${v5Defs(X.id)}
      <g data-c="0" class="vgrid">${[0, 1, 2, 3].map(k => `<line x1="${x0}" x2="${x1}" y1="${y0 + k * (y1 - y0) / 3}" y2="${y0 + k * (y1 - y0) / 3}"/>`).join('')}<line x1="${x0}" x2="${x0}" y1="${y0 - 8}" y2="${y1}" class="vax"/><line x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}" class="vax"/></g>
      <g data-c="1"><path d="${area(P)}" fill="url(#${X.id}a)" class="vfade"/><path d="${d(P)}" class="vglw"/><path d="${d(P)}" class="vln vdr" pathLength="1" stroke="url(#${X.id}g)"/></g>
      ${mode === 'both' ? `<g data-c="2"><path d="${d(up)}" class="vln vdr" pathLength="1" stroke="#c4b5ff"/><path d="${d(dn)}" class="vln vdr vdn" pathLength="1"/><circle cx="${up[up.length - 1][0]}" cy="${up[up.length - 1][1]}" r="5" class="vdot"/><circle cx="${dn[dn.length - 1][0]}" cy="${dn[dn.length - 1][1]}" r="5" class="vdot vdn"/>
        <text x="${up[up.length - 1][0] - 8}" y="${up[up.length - 1][1] - 12}" text-anchor="end" class="vlab">hausse</text><text x="${dn[dn.length - 1][0] - 8}" y="${dn[dn.length - 1][1] + 22}" text-anchor="end" class="vlab vdn">baisse</text></g>`
      : `<g data-c="2"><circle cx="${last[0]}" cy="${last[1]}" r="12" class="vpulse ${mode === 'down' ? 'vdn' : ''}"/><circle cx="${last[0]}" cy="${last[1]}" r="5" class="vdot ${mode === 'down' ? 'vdn' : ''}"/>${lab ? `<g class="vpill ${mode === 'down' ? 'vdn' : ''}"><rect x="${Math.min(232, last[0] - 40)}" y="${Math.max(6, last[1] - 46)}" width="80" height="28" rx="14"/><text x="${Math.min(232, last[0] - 40) + 40}" y="${Math.max(6, last[1] - 46) + 19}" text-anchor="middle">${h(lab)}</text></g>` : ''}</g>`}</svg>`; },
  /* calcul pas à pas : chaque nombre arrive, puis le résultat */
  calc(X){ const ops = v5Ops(X.it.t); if (ops){ let wi = 0; const tk = ops.map(o => { const at = X.at(wi); wi += o.op ? 1 : zWords(o.s).length; return { s: o.s, c: o.op ? 'vop' : o.res ? 'vres' : '', at }; });
      tk.forEach((t, i) => X.cue(Math.max(250 + i * 120, t.at - 60), i)); X.cue(Math.max(300 + tk.length * 140, (tk[tk.length - 1] || {}).at || 0) + 250, 'rv');
      return `<div class="v5-calc"><div class="vrow">${tk.map((t, i) => `<span data-c="${i}" class="vtk ${t.c} ${zWords(t.s).length > 2 ? 'vwd' : ''}">${h(t.s)}</span>`).join('')}</div><i class="vund"></i></div>`; }
    const wo = v5WOps(X.it.t); if (wo && !V5_RE.calc.test(X.it.t)){ let pos = wo.m.index; const tk = wo.tk.map(o => { let at = null; if (o.f){ const k = wo.s.indexOf(o.f, pos); if (k >= 0){ at = X.at(v5Wi(wo.s, k)); pos = k + o.f.length; } } return Object.assign({}, o, { at }); });
      tk.forEach((o, i) => { if (o.at == null) o.at = i ? tk[i - 1].at + 200 : 300; X.cue(Math.max(250 + i * 120, o.at - 60), i); }); X.cue(tk[tk.length - 1].at + 400, 'rv'); const lab = X.it.head ? '' : v5Term(X.it.t);
      return `<div class="v5-calc">${lab ? `<span class="v5-eq-l" data-c="0">${h(lab)}</span>` : ''}<div class="vrow">${tk.map((o, i) => `<span data-c="${i}" class="vtk ${o.op ? 'vop' : o.res ? 'vres' : ''}">${h(o.s)}</span>`).join('')}</div><i class="vund"></i></div>`; }
    const m = X.it.t.match(V5_RE.calc); if (!m) return V5T.num(X); const tk = []; const push = (s, c) => s && tk.push({ s: s.trim(), c });
    push(m[1] + (m[2] ? ' ' + m[2] : ''), ''); push(m[3], 'vop'); push(m[4] + (m[5] ? ' ' + m[5] : ''), ''); if (m[6]){ push(m[6], 'vop'); push(m[7] + (m[8] ? ' ' + m[8] : ''), ''); } push(/\s≈\s/.test(m[0]) ? '≈' : '=', 'vop'); push(m[9] + (m[10] ? ' ' + m[10] : ''), 'vres');
    tk.forEach((t, i) => X.cue(300 + i * 420, i)); X.cue(300 + tk.length * 420 + 200, 'rv');
    const lab = X.it.head ? '' : v5Term(X.it.t);
    return `<div class="v5-calc">${lab ? `<span class="v5-eq-l" data-c="0">${h(lab)}</span>` : ''}<div class="vrow">${tk.map((t, i) => `<span data-c="${i}" class="vtk ${t.c}">${h(t.s)}</span>`).join('')}</div><i class="vund"></i></div>`; },
  /* un chiffre qui compte (ou une fourchette) */
  num(X){ let all = [...X.it.t.matchAll(V5_RE.numu)].filter(m => !/^(19|20)\d\d$/.test(m[1].trim()));
    if (!all.length && X.it.calcAns != null) all = [[`${X.it.calcAns} ${X.it.unit || ''}`, String(X.it.calcAns).replace('.', ','), X.it.unit || '']];
    if (!all.length) return V5T.icon(X);
    const pick = all.find(m => /%|€/.test(m[2])) || all[0], val = v5Val(pick[1]), dec = v5Dec(pick[1]), unit = pick[2], sign = /^[+]/.test(pick[1].trim()) ? '+' : /^[−-]/.test(pick[1].trim()) ? '−' : '';
    const two = /\b(entre|et|ou)\b/.test(norm(X.it.t)) ? all.find(m => m !== pick && m[2] === pick[2] && m.index > pick.index && v5Val(m[1]) !== val) || null : null;
    const tw = X.at(Math.max(0, X.C.w.findIndex(w => w.includes(pick[1].trim().split(/[ \u00a0\u202f]/)[0].replace(/^[−+-]/, ''))))); X.cue(0, 'o'); X.cue(Math.max(300, tw - 150), 0); X.cue(Math.max(600, tw + 500), 1);
    const pct = unit === '%' && Math.abs(val) <= 100 ? Math.abs(val) / 100 : null, Cc = 2 * Math.PI * 88;
    const ctx = v5Short(X.it.t.slice(Math.max(0, X.it.t.indexOf(pick[0]) + pick[0].length)).replace(/^[\s,:;.)]+/, ''), 6);
    return `<div class="v5-num">${pct != null ? `<svg class="v5-ring" viewBox="0 0 200 200" data-c="o">${v5Defs(X.id)}<circle cx="100" cy="100" r="88" class="vtrk"/><circle cx="100" cy="100" r="88" class="varc" stroke="url(#${X.id}g)" stroke-dasharray="${Cc.toFixed(1)}" style="--off:${(Cc * (1 - pct)).toFixed(1)};--c0:${Cc.toFixed(1)}" transform="rotate(-90 100 100)"/></svg>` : `<i class="vhalo" data-c="o"></i>`}
      <b class="v5-n" data-c="0" data-n="${Math.abs(val)}" data-d="${dec}" data-pre="${sign}" data-suf="${unit ? (unit === '%' ? ' %' : ' ' + unit) : ''}">${sign}0${unit === '%' ? ' %' : unit ? ' ' + h(unit) : ''}</b>
      ${two ? `<span class="v5-n2" data-c="1">à ${h(two[1].trim())} ${h(two[2])}</span>` : ctx && ctx.length > 3 ? `<span class="v5-n2" data-c="1">${h(ctx)}</span>` : ''}</div>`; },
  /* de … à … : deux valeurs, une flèche, l'écart */
  fromto(X){ const m = X.it.t.match(V5_RE.fromto); if (!m) return V5T.num(X); const a = v5Val(m[1]), b = v5Val(m[3]), ua = m[2] || m[4] || '', ub = m[4] || m[2] || '';
    const pc = X.it.t.match(new RegExp(`([−+-]\\s?\\d+(?:,\\d+)?)\\s?%`)), delta = pc ? pc[1].replace(/\s/g, '') + ' %' : (a ? ((b - a) / a * 100 >= 0 ? '+' : '−') + num(Math.abs((b - a) / a * 100), Math.abs((b - a) / a * 100) % 1 ? 1 : 0) + ' %' : '');
    const t1 = X.at(Math.max(0, X.C.w.findIndex(w => /^[Dd]e$/.test(w)))), t2 = X.at(Math.max(1, X.C.w.findIndex((w, i) => i > 0 && /^(à|a)$/.test(w)) + 1)); X.cue(Math.max(200, t1), 0); X.cue(Math.max(700, t2 - 100), 1); X.cue(Math.max(900, t2 + 150), 2); X.cue(Math.max(1500, t2 + 900), 3);
    const down = b < a; return `<div class="v5-ft ${down ? 'vdn' : ''}"><div class="vrow"><span class="v5-n vsm" data-c="0">${h(m[1].trim())} ${h(ua)}</span>
      <svg class="varw" data-c="1" viewBox="0 0 80 24"><path d="M2 12 H72 M62 3 L74 12 L62 21" class="vln vdr" pathLength="1"/></svg>
      <span class="v5-n" data-c="2" data-n="${b}" data-d="${v5Dec(m[3])}" data-suf=" ${h(ub)}">${h(m[1].trim())} ${h(ub)}</span></div>${delta ? `<span class="v5-delta" data-c="3">${h(delta)}</span>` : ''}</div>`; },
  /* définition : le mot, le signe, ce qu'il veut dire (ou la formule, terme par terme) */
  def(X){ const d = v5DefM(X.it.t); if (!d) return V5T.icon(X); const parts = d.R.split(/\s([÷×+−])\s/), lw = zWords(d.L).length;
    X.cue(150, 0); X.cue(Math.max(500, X.at(lw) - 120), 1);
    if (parts.length >= 3){ let wi = lw + 1; const tk = parts.map((p, i) => { const k = i % 2 ? 'vop' : ''; const at = X.at(wi); wi += zWords(p).length; return { p, k, at }; }); tk.forEach((t, i) => X.cue(Math.max(700, t.at - 80) + i * 40, 'f' + i));
      return `<div class="v5-def"><span class="vterm" data-c="0">${h(d.L)}</span><span class="veq" data-c="1">${d.op === '=' ? '=' : '↓'}</span><div class="vform">${tk.map((t, i) => `<span class="vtk ${t.k}" data-c="f${i}">${h(t.p)}</span>`).join('')}</div></div>`; }
    X.cue(Math.max(800, X.at(lw + 1)), 2);
    return `<div class="v5-def"><span class="vterm" data-c="0">${h(d.L)}</span><span class="veq" data-c="1">${d.op === '=' ? '=' : '↓'}</span><span class="vdef" data-c="2">${h(d.R.replace(/^./, c => c.toUpperCase()))}</span></div>`; },
  /* enchaînement : A → B → C (exemples chiffrés) */
  flow(X){ const raw = v5Clean(X.it.t).replace(/[.]$/, ''), segs = raw.split(/\s*→\s*/); let parts = []; segs.forEach((sg, i) => { const it = i === 0 && sg.includes(', ') && sg.split(', ').length <= 3 ? sg.split(', ') : [sg]; it.forEach((x, j) => parts.push({ t: x, arrow: i > 0 && j === 0, last: i === segs.length - 1 })); });
    parts = parts.slice(0, 5); let wi = 0; parts.forEach((p, i) => { p.at = X.at(wi); wi += zWords(p.t).length + (p.arrow ? 1 : 0); X.cue(Math.max(200, p.at - 120), i); });
    return `<div class="v5-flow">${parts.map((p, i) => `${p.arrow ? `<span class="vfa" data-c="${i}"></span>` : ''}<span class="vfb ${p.last ? 'vres' : ''}" data-c="${i}">${h(p.t.replace(/^./, c => c.toUpperCase()))}</span>`).join('')}</div>`; },
  /* une série de valeurs (Mois 1 : 20 €, Mois 2 : 25 €…) en barres */
  kv(X){ const L = v5KV(X.it.t) || [], mx = Math.max(...L.map(x => Math.abs(x.v)), 1), n = L.length, bw = Math.min(56, 220 / n), gap = (280 - bw * n) / Math.max(1, n - 1), y1 = 176;
    L.forEach((x, i) => { const wi = X.C.w.findIndex(w => w.includes(x.s.split(' ')[0])); X.cue(Math.max(300 + i * 200, wi >= 0 ? X.at(wi) - 100 : 600 + i * 500), i); });
    return `<svg class="v5-svg v5-kv" viewBox="0 0 320 210">${v5Defs(X.id)}<line x1="18" x2="302" y1="${y1}" y2="${y1}" class="vax"/>${L.map((x, i) => { const hh = Math.max(8, Math.abs(x.v) / mx * 126), xx = 20 + i * (bw + gap); return `<g data-c="${i}"><rect x="${xx.toFixed(1)}" y="${(y1 - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="8" fill="url(#${X.id}g)" class="vkvb"/>
      <text x="${(xx + bw / 2).toFixed(1)}" y="${(y1 - hh - 9).toFixed(1)}" text-anchor="middle" class="vkvv">${h(x.s)}</text><text x="${(xx + bw / 2).toFixed(1)}" y="${y1 + 20}" text-anchor="middle" class="vlab">${h(x.l)}</text></g>`; }).join('')}</svg>`; },
  /* deux montants dans le temps : avant / après, l'écart en % */
  ab(X){ const d = v5AB(X.it.t); if (!d) return V5T.num(X); const mx = Math.max(d.a, d.b), y1 = 172, H = 118, ha = Math.max(14, d.a / mx * H), hb = Math.max(14, d.b / mx * H), dn = d.b < d.a, pc = (d.b - d.a) / d.a * 100;
    const ta = X.at(v5Wi(d.s, d.A.index)), tb = X.at(v5Wi(d.s, d.B.index)); X.cue(Math.max(200, ta - 120), 0); X.cue(Math.max(900, tb - 500), 1); X.cue(Math.max(1200, tb - 120), 2); X.cue(Math.max(1700, tb + 600), 3);
    const xa = 62, xb = 198, bw = 60, fa = v5Dec(d.A[1]), fb = v5Dec(d.B[1]), ua = ' ' + d.A[2], ub = ' ' + d.B[2], ytop = Math.min(y1 - ha, y1 - hb) - 50;
    return `<svg class="v5-svg v5-ab ${dn ? 'vdn' : ''}" viewBox="0 0 320 210">${v5Defs(X.id)}<line x1="24" x2="296" y1="${y1}" y2="${y1}" class="vax"/>
      <g data-c="0"><rect x="${xa}" y="${(y1 - ha).toFixed(1)}" width="${bw}" height="${ha.toFixed(1)}" rx="10" class="vkvb vaba"/><text x="${xa + bw / 2}" y="${(y1 - ha - 10).toFixed(1)}" text-anchor="middle" class="vkvv" data-c="0" data-n="${d.a}" data-d="${fa}" data-suf="${h(ua)}" data-f="${h(d.A[1].trim() + ua)}">${h(d.A[1].trim() + ua)}</text><text x="${xa + bw / 2}" y="${y1 + 21}" text-anchor="middle" class="vlab">${d.infl ? 'Aujourd’hui' : 'Au départ'}</text></g>
      <g data-c="1"><path d="M${xa + bw / 2 + 18} ${(ytop + 6).toFixed(1)} Q160 ${(ytop - 26).toFixed(1)} ${xb + bw / 2 - 18} ${(ytop + 6).toFixed(1)}" class="vln vdr varc2" pathLength="1"/><path d="M${xb + bw / 2 - 28} ${(ytop - 2).toFixed(1)} L${xb + bw / 2 - 17} ${(ytop + 7).toFixed(1)} L${xb + bw / 2 - 30} ${(ytop + 11).toFixed(1)}" class="vln vdr varc2" pathLength="1"/></g>
      <g data-c="2"><rect x="${xb}" y="${(y1 - hb).toFixed(1)}" width="${bw}" height="${hb.toFixed(1)}" rx="10" fill="url(#${X.id}g)" class="vkvb vabb"/><text x="${xb + bw / 2}" y="${(y1 - hb - 10).toFixed(1)}" text-anchor="middle" class="vkvv" data-c="2" data-n="${d.b}" data-d="${fb}" data-suf="${h(ub)}" data-f="${h(d.B[1].trim() + ub)}">${h(d.B[1].trim() + ub)}</text><text x="${xb + bw / 2}" y="${y1 + 21}" text-anchor="middle" class="vlab">${h(d.y)}</text></g>
      <g data-c="3" class="vpill ${dn ? 'vdn' : ''}"><rect x="128" y="${(ytop - 44).toFixed(1)}" width="64" height="26" rx="13"/><text x="160" y="${(ytop - 26).toFixed(1)}" text-anchor="middle">${pc >= 0 ? '+' : '−'}${num(Math.abs(pc), Math.abs(pc) < 10 && Math.abs(pc) % 1 ? 1 : 0)} %</text></g></svg>`; },
  /* une fiche valeur : chaque ligne arrive quand elle est dite */
  fiche(X){ const F = v5Fiche(X.it.t); if (!F) return V5T.num(X); const vr = F.L.find(x => x.l === 'Variation'), dn = vr && /^[−-]/.test(vr.v), r = v5Rnd(v5Hash(X.it.t)), P = [];
    for (let i = 0; i < 24; i++){ const u = i / 23; P.push([4 + u * 152, 34 - (dn ? -1 : 1) * (u * 18) + (r() - 0.5) * 9]); } const d = P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    X.cue(100, 'c'); F.L.forEach((x, i) => X.cue(Math.max(300 + i * 160, X.at(v5Wi(F.s, x.k)) - 80), i)); X.cue(Math.max(900, X.at(v5Wi(F.s, F.L[0].k)) + 300), 'sp');
    return `<div class="v5-fiche ${dn ? 'vdn' : ''}" data-c="c"><svg class="vspk" viewBox="0 0 160 60" data-c="sp">${v5Defs(X.id)}<path d="${d} L156 60 L4 60 Z" fill="url(#${X.id}a)"/><path d="${d}" class="vln vdr" pathLength="1" stroke="url(#${X.id}g)"/></svg>
      ${F.L.map((x, i) => `<div class="vfr ${i ? '' : 'big'}" data-c="${i}"><span>${h(x.l.replace(/^./, c => c.toUpperCase()))}</span><b>${h(x.v)}</b></div>`).join('')}</div>`; },
  /* deux idées face à face */
  vs(X){ const p = v5Vs(X.it.t) || ['Épargner', 'Investir']; const ia = zShapesFor(p[0], 'piggy')[0], ib = zShapesFor(p[1], 'up')[0], t2 = X.wAt(new RegExp(norm(p[1]).split(' ')[0].slice(0, 6)));
    X.cue(150, 0); X.cue(Math.max(900, t2 > 0 ? t2 - 400 : X.at(Math.floor(X.C.w.length / 2)) - 400), 1); X.cue(Math.max(1200, t2 > 0 ? t2 : X.at(Math.floor(X.C.w.length / 2))), 2);
    return `<div class="v5-vs"><div class="vc" data-c="0">${v5Icon(ZSHAPE[ia] ? ia : 'piggy', 72)}<b>${h(p[0])}</b>${p.sub ? `<small>${h(p.sub[0])}</small>` : ''}</div><span class="vx" data-c="1">ou</span><div class="vc r" data-c="2">${v5Icon(ZSHAPE[ib] ? ib : 'up', 72)}<b>${h(p[1])}</b>${p.sub ? `<small>${h(p.sub[1])}</small>` : ''}</div></div>`; },
  vs2(X){ return V5T.vs(X); },
  /* question : les choix, puis la bonne réponse s'allume */
  qa(X){ const ch = X.it.choices || [], rv = X.capStart - 500; X.cue(100, 0); ch.forEach((_, i) => X.cue(500 + i * 180, 'c' + i)); X.cue(rv, 'rv');
    return `<div class="v5-qa"><p class="vq" data-c="0">${h(v5Clean(X.it.q))}</p><div class="opts">${ch.map((c, i) => `<span class="qo ${i === X.it.a ? 'vok' : ''}" data-c="c${i}">${i === X.it.a ? `<i class="vck">${I.check}</i>` : ''}${h(c)}</span>`).join('')}</div></div>`; },
  /* vrai ou faux : la phrase, puis le tampon */
  vf(X){ const ans = X.it.ans, rv = X.capStart - 400; X.cue(100, 0); X.cue(rv, 'rv');
    const qq = /\?\s*$/.test(v5Clean(X.it.q)); return `<div class="v5-vf ${ans === true ? 't' : ans === false ? 'f' : 'n'} ${qq ? 'qq' : ''}"><div class="vcard" data-c="0"><span class="vqm">“</span><p>${h(v5Clean(X.it.q))}</p></div>${ans == null ? '' : `<span class="vstamp">${qq ? (ans ? 'Oui' : 'Non') : ans ? 'Vrai' : 'Faux'}</span>`}</div>`; },
  /* étapes */
  steps(X){ const items = X.it.items || v5List(X.it.t) || []; const n = items.length; X.cue(0, 'r'); items.forEach((_, i) => X.cue(X.at(Math.floor(X.C.w.length * i / Math.max(1, n))) - (i ? 200 : 0) + 100, i));
    return `<div class="v5-steps"><i class="vrail" data-c="r"></i>${items.slice(0, 6).map((t, i) => `<div class="vst" data-c="${i}"><b>${i + 1}</b><span>${h(v5Clean(t))}</span></div>`).join('')}</div>`; },
  /* paires */
  pairs(X){ const P = (X.it.pairs || []).slice(0, 5); P.forEach((_, i) => X.cue(300 + i * 650, i));
    return `<div class="v5-pairs">${P.map(([a, b], i) => `<div class="vpr" data-c="${i}"><span class="va">${h(a)}</span><i class="vln"></i><span class="vb">${h(b)}</span></div>`).join('')}</div>`; },
  /* à retenir */
  recap(X){ const it = X.it.items || []; it.forEach((_, i) => X.cue(X.at(X.C.w.findIndex((w, k) => k >= zWords(it.slice(0, i).join(' ')).length)) + 60, i));
    return `<div class="v5-rc">${it.map((t, i) => `<div class="vit" data-c="${i}"><svg class="vck" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11"/><path d="M6.5 12.5 l3.6 3.6 l7.6 -8.2" class="vdr" pathLength="1"/></svg><span>${h(t)}</span></div>`).join('')}</div>`; },
  /* panier diversifié */
  pie(X){ const seg = [24, 19, 17, 14, 12, 8], gap = 1.2, Cl = 100; let acc = 0; const lab1 = ((X.it.t.match(new RegExp(`(${V5_NUM})\\s?(?:grandes\\s|petites\\s)?(entreprises|valeurs|actions|pays)`)) || [])[0] || '').replace(/\s(grandes|petites)\s/, ' ') || null; const lab = lab1 || (/etf/i.test(X.it.t) ? 'ETF' : /indice/i.test(X.it.t) ? 'Indice' : 'Diversifié');
    seg.forEach((_, i) => X.cue(200 + i * 230, i)); X.cue(200 + seg.length * 230 + 100, 'm');
    return `<svg class="v5-svg v5-pie" viewBox="0 0 320 210">${v5Defs(X.id)}<circle cx="160" cy="105" r="92" fill="url(#${X.id}h)"/><g transform="rotate(-90 160 105)">${seg.map((v, i) => { const s = `<circle data-c="${i}" cx="160" cy="105" r="66" pathLength="100" class="vsg" style="--v:${(v - gap).toFixed(1)};--o:${(-acc).toFixed(1)};stroke:${['#ffffff', '#d9d0ff', '#c4b5ff', '#a99bff', '#8fb4ff', '#6f8dff'][i]}"/>`; acc += v; return s; }).join('')}</g>
      <g data-c="m"><text x="160" y="${/\d/.test(lab) ? 102 : 111}" text-anchor="middle" class="vmid" style="font-size:${String(lab).split(/\s(?=[a-z])/)[0].length > 7 ? 21 : 30}px">${h(/\d/.test(lab) ? lab.split(/\s(?=[a-z])/)[0] : lab)}</text>${/\d/.test(lab) ? `<text x="160" y="124" text-anchor="middle" class="vsm">${h(lab.split(/\s(?=[a-z])/)[1] || '')}</text>` : ''}</g></svg>`; },
  /* balance risque / rendement */
  scale(X){ const p = v5Vs(X.it.t), L1 = p ? p[0] : 'Risque', L2 = p ? p[1] : 'Rendement'; X.cue(100, 0); X.cue(500, 1); X.cue(Math.max(1400, X.wAt(/rendement|risque|equilibr/) || 1400), 'rv');
    return `<svg class="v5-svg v5-scale" viewBox="0 0 320 210">${v5Defs(X.id)}<g data-c="0"><path d="M160 46 L160 182 M122 186 H198" class="vln2"/><circle cx="160" cy="44" r="7" class="vdot"/></g>
      <g data-c="1"><g class="vbeam"><path d="M70 60 H250" class="vln2"/><path d="M70 60 L48 116 H92 Z M250 60 L228 116 H272 Z" class="vpan"/><text x="70" y="140" text-anchor="middle" class="vlab">${h(L1)}</text><text x="250" y="140" text-anchor="middle" class="vlab">${h(L2)}</text></g></g></svg>`; },
  /* carnet d'ordres */
  book(X){ const r = v5Rnd(v5Hash(X.it.t)), A = [0.9, 0.55, 0.7, 0.4].map(v => v * (0.8 + r() * 0.4)), B = [0.45, 0.8, 0.6, 0.95].map(v => v * (0.8 + r() * 0.4)); [0, 1, 2, 3].forEach(i => { X.cue(200 + i * 160, 'a' + i); X.cue(900 + i * 160, 'b' + i); }); X.cue(Math.max(1700, X.wAt(/spread|ecart/) || 1700), 'g');
    return `<div class="v5-book"><span class="vhd">Vendeurs · prix demandés</span>${A.map((v, i) => `<div class="vbar va" data-c="a${3 - i}"><i style="width:${(v * 100).toFixed(0)}%"></i></div>`).join('')}
      <div class="vgap" data-c="g"><span>Spread : l’écart entre les deux meilleurs prix</span></div>${B.map((v, i) => `<div class="vbar vb" data-c="b${i}"><i style="width:${(v * 100).toFixed(0)}%"></i></div>`).join('')}<span class="vhd">Acheteurs · prix proposés</span></div>`; },
  /* bougie : anatomie */
  candle(X){ X.cue(150, 0); X.cue(700, 1); X.cue(1300, 2); X.cue(1900, 3);
    return `<svg class="v5-svg v5-cdl" viewBox="0 0 320 220">${v5Defs(X.id)}<g data-c="0"><path d="M130 18 V200" class="vwick"/><rect x="108" y="62" width="44" height="96" rx="5" fill="url(#${X.id}g)"/></g>
      <g data-c="1"><path d="M136 18 H200" class="vln3"/><text x="206" y="23" class="vlab">Plus haut</text></g><g data-c="2"><path d="M156 62 H200" class="vln3"/><text x="206" y="67" class="vlab">Clôture</text><path d="M156 158 H200" class="vln3"/><text x="206" y="163" class="vlab">Ouverture</text></g>
      <g data-c="3"><path d="M136 200 H200" class="vln3"/><text x="206" y="205" class="vlab">Plus bas</text><text x="40" y="114" class="vlab dim">Hausse</text></g></svg>`; },
  /* inflation : le panier coûte plus cher, l'argent achète moins */
  infl(X){ const pc = (X.it.t.match(new RegExp(`(${V5_NUM})\\s?%`)) || [])[0]; X.cue(100, 0); X.cue(700, 1); X.cue(1500, 2);
    return `<div class="v5-infl"><div class="vtag" data-c="0"><span>Les prix</span><b>${pc ? '+' + h(pc.replace(/^[+]/, '')) : 'montent'}</b><svg viewBox="0 0 24 24"><path d="M5 17 L12 8 L19 17" class="vln vdr" pathLength="1"/></svg></div>
      <div class="vbag" data-c="1">${v5Icon('money', 96)}<span>Ton argent achète moins</span></div><i class="vshr" data-c="2"></i></div>`; },
};

/* ---------- 5. le lecteur ---------- */
const V5_TR = ['push', 'slide', 'iris', 'rise'];
function v5Count(el){ if (el.dataset.done) return; el.dataset.done = 1; const to = Number(el.dataset.n), d = Number(el.dataset.d || 0), pre = el.dataset.pre || '', suf = el.dataset.suf || ''; if (!isFinite(to)) return;
  const fin = el.dataset.f; if (RM()){ el.textContent = fin || pre + num(to, d) + suf; return; } const t0 = performance.now(), dur = 1100; const f = t => { const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3); el.textContent = u >= 1 && fin ? fin : pre + num(to * e, d) + suf; if (u < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
function v5Shell(V){ const p = $('#player'), m = M.m, ch = m.ch ? CH.find(c => c.id === m.ch) : null;
  p.innerHTML = `<div class="zv v5"><div class="v5-bg" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><div class="v5-grid"></div><div class="v5-stars"></div></div>
    <div class="v5-top"><button class="zv-back v5-back" data-quit aria-label="Retour">${I.back}</button><div class="v5-seg">${V.sc.map((s, i) => `<span style="--ms:${s.ms}ms"><i></i></span>`).join('')}</div></div>
    <p class="v5-meta">${h(ch ? `Chapitre ${ch.id} · ${m.title}` : m.title)}</p>
    <div class="v5-stage" aria-live="polite"></div>
    <div class="zv-foot v5-foot"><button class="zv-skip" data-vidskip>Passer la vidéo</button></div></div>`;
  p.setAttribute('aria-label', 'Cours vidéo : ' + m.title); }
function v5Show(V){ const p = $('#player'); if (!p) return; if (!p.querySelector('.v5')) v5Shell(V); const s = V.sc[V.i], st = p.querySelector('.v5-stage'), rm = RM(), tr = s.tpl === 'title' ? 'iris' : s.tpl === 'go' ? 'push' : V5_TR[V.i % V5_TR.length];
  p.querySelectorAll('.v5-seg > span').forEach((x, i) => { x.className = i < V.i ? 'on' : i === V.i ? 'cur' : ''; });
  const root = p.querySelector('.v5'); root.style.setProperty('--bx', (20 + (V.i * 37) % 60) + '%'); root.style.setProperty('--by', (18 + (V.i * 23) % 40) + '%'); root.dataset.tpl = s.tpl;
  const old = st.querySelector('.v5-sc:not(.out)'); if (old){ old.classList.add('out', 'o-' + tr); setTimeout(() => old.remove(), rm ? 0 : 750); }
  const el = document.createElement('section'); el.className = `v5-sc t-${s.tpl} i-${tr}${rm ? ' rm' : ''}`;
  const kw = new Set(s.kw);
  el.innerHTML = `<div class="v5-viz">${s.viz}</div><div class="v5-cap">${s.eb ? `<span class="v5-eb">${h(s.eb)}</span>` : ''}${s.head ? `<h3 class="v5-h">${zWords(s.head).map((w, i) => `<span style="--i:${i}">${h(w)}</span>`).join(' ')}</h3>` : ''}${s.tpl === 'go' ? `<h3 class="v5-h v5-go-h">${zWords(s.t).map((w, i) => `<span style="--i:${i}">${h(w)}</span>`).join(' ')}</h3>` : s.words.length ? `<p class="v5-t">${s.words.map((w, i) => `<span class="w${kw.has(i) ? ' kw' : ''}" data-i="${i}">${h(w)}</span>`).reduce((acc, x, i, a) => acc + x + (i < a.length - 1 ? (v5NB(s.words[i], s.words[i + 1]) ? '\u00a0' : ' ') : ''), '')}</p>` : ''}</div>`;
  st.appendChild(el); if (rm){ el.querySelectorAll('[data-c]').forEach(x => { x.classList.add('on'); if (x.dataset.n) v5Count(x); }); el.querySelectorAll('.w').forEach(x => x.classList.add('on')); ['rv', 'b1'].forEach(c => el.classList.add(c)); }
  if (V.i) vidWhoosh(); return el; }
function v5Run(){ const V = M && M.vid; if (!V || !V.v5) return; clearTimeout(V.t); (V.wt || []).forEach(clearTimeout); V.wt = []; const s = V.sc[V.i], my = V.tok = (V.tok || 0) + 1, rm = RM(), el = v5Show(V); if (!el) return;
  const T = (ms, f) => V.wt.push(setTimeout(() => { if (!M || M.vid !== V || V.tok !== my) return; f(); }, rm ? 0 : ms));
  if (!rm){ s.cues.forEach(([ms, k]) => T(ms, () => { if (k === 'rv' || k === 'b1'){ el.classList.add(k); if (k === 'rv') zChime(); return; } el.querySelectorAll(`[data-c="${k}"]`).forEach(x => { x.classList.add('on'); if (x.dataset.n) v5Count(x); }); }));
    let chimed = false; s.times.forEach((ms, i) => T(ms, () => { const w = el.querySelector(`.w[data-i="${i}"]`); if (!w) return; w.classList.add('on'); if (!chimed && w.classList.contains('kw')){ chimed = true; zChime(); } })); }
  if (V.hold) return; V.t = setTimeout(() => { if (!M || M.vid !== V || V.tok !== my) return; if (V.i >= V.sc.length - 1) return vidEnd(); V.i++; v5Run(); }, s.ms); }
const _vidStartV44 = vidStart, _renderVidV44 = renderVid;
vidStart = function(){ if (!NT_FX.vid5) return _vidStartV44(); const V = M.vid = { sc: v5Script(M.m), i: 0, v5: true }; vidMusic(true); renderPlayer(); v5Run(); };
renderVid = function(){ const V = M && M.vid; if (V && V.v5){ const p = $('#player'); if (p && !p.querySelector('.v5')) v5Shell(V); return; } return _renderVidV44(); };
/* la vidéo au début de chaque mission et de chaque séance */
const _startMissionV44 = startMission;
startMission = function(id, mode = 'full'){ const r = _startMissionV44(id, mode);
  if (NT_FX.vid5 && NT_FX.vidalways && !V5.skipOnce && M && !M.vid && !M.end && mode === 'full' && M.mode === 'full' && M.m && M.m.ch && M.i === 0 && document.getElementById('player')) vidStart(); return r; };
const _startSessionV44 = startSession;
startSession = function(...a){ const r = _startSessionV44(...a); if (NT_FX.vid5 && NT_FX.vidalways && !V5.skipOnce && M && M.session && !M.vid && !M.end && M.i === 0) vidStart(); return r; };
if (window.NT_DEBUG){ const s0 = NT_DEBUG.start, ss0 = NT_DEBUG.sessStart; NT_DEBUG.start = id => { V5.skipOnce = true; try { return s0(id); } finally { V5.skipOnce = false; } };
  NT_DEBUG.sessStart = id => { V5.skipOnce = true; try { return ss0(id); } finally { V5.skipOnce = false; } };
  NT_DEBUG.v5jump = (i, hold) => { const V = M && M.vid; if (!V || !V.v5) return null; V.hold = !!hold; V.i = Math.max(0, Math.min(V.sc.length - 1, i)); v5Run(); const s = V.sc[V.i]; return { tpl: s.tpl, ms: s.ms, n: V.sc.length }; };
  NT_DEBUG.zs = t => zShapesFor(t).filter(s => ZSHAPE[s]);
  NT_DEBUG.v5 = id => { const m = findMission(id) || (id && id.startsWith('sess-') ? NT_DEBUG.sess(id.slice(5)) : null); return m ? v5Script(m).map(s => ({ tpl: s.tpl, eb: s.eb, head: s.head, t: s.t, q: s.q, ms: s.ms, cues: s.cues.length })) : null; }; }


/* ============================================================
   V46 — VIDÉOS DE COURS PLUS VIVANTES (09/11/2026)
   Thomas : « c'est pas mal, est-ce que tu penses pouvoir encore
   l'améliorer, toutes les vidéos ? »
   Ce que montrait une vidéo regardée en entier : des scènes figées
   plusieurs secondes une fois le schéma posé, un début de scène parfois
   vide (le schéma attendait le mot), « À retenir » écrit deux fois, et
   aucun moyen de revenir en arrière si on n'a pas compris.
   - vidnav   : toucher à droite = scène suivante, à gauche = revenir,
                appui long = pause (Espace, ← et → au clavier) ; pause
                automatique quand on quitte l'onglet.
   - vidfill  : le premier élément du schéma arrive tout de suite.
   - vidcam   : caméra lente sur chaque scène et petits mouvements
                continus (dessins qui flottent, lueurs qui respirent).
   - vidrecap : « À retenir » se lit dans les cartes (plus de texte en double).
   - vidpts   : poussière lumineuse qui vient se poser sur ce qui se dessine
                (traits, courbes, flèches), et entoure les cartes ; si
                l'appareil rame, moins de grains puis plus du tout.
   - vidmusic : la musique douce dure toute la vidéo (avant : 21 s).
   - Grand écran : les schémas en cartes et les dessins sont 25 % plus grands ;
     « = résultat » d'un calcul ne se coupe plus en fin de ligne.
   Chaque effet a son interrupteur NT_FX ; sans canvas ou avec « réduire les
   animations », la vidéo reste celle de V45.
   ============================================================ */
NT_FX.vidnav = NT_FX.vidnav !== false;
NT_FX.vidfill = NT_FX.vidfill !== false;
NT_FX.vidcam = NT_FX.vidcam !== false;
NT_FX.vidrecap = NT_FX.vidrecap !== false;
NT_FX.vidpts = NT_FX.vidpts !== false;
const V6 = { hintKey: 'nt-v6hint' };

/* ---------- 1. programmation d'une scène, reprise possible au milieu ---------- */
const V6_FILL = new Set(['ab', 'kv', 'chart', 'pie', 'scale', 'book', 'candle', 'infl', 'fromto', 'num', 'fiche', 'icon', 'vs', 'vs2']);
function v6Cues(s){ const c = s.cues.map(x => x.slice()); if (!NT_FX.vidfill || !V6_FILL.has(s.tpl)) return c;
  /* le premier élément du schéma ne doit pas laisser l'écran vide : au plus tard à 0,45 s */
  let f = null; c.forEach(x => { if (x[1] === 'rv' || x[1] === 'b1') return; if (!f || x[0] < f[0]) f = x; });
  if (f && f[0] > 650){ const k = f[1]; c.forEach(x => { if (x[1] === k) x[0] = Math.min(x[0], 420); }); }
  return c; }
function v6Sched(V, el, off){ const s = V.sc[V.i], my = V.tok = (V.tok || 0) + 1, rm = RM(); clearTimeout(V.t); (V.wt || []).forEach(clearTimeout); V.wt = []; V.el = el; V.t0 = performance.now() - off;
  const T = (ms, f) => { if (ms < off) return; V.wt.push(setTimeout(() => { if (!M || M.vid !== V || V.tok !== my || V.paused) return; f(); }, rm ? 0 : ms - off)); };
  if (!rm){ v6Cues(s).forEach(([ms, k]) => T(ms, () => { if (k === 'rv' || k === 'b1'){ el.classList.add(k); if (k === 'rv') zChime(); V6P.cue(); return; }
      el.querySelectorAll(`[data-c="${k}"]`).forEach(x => { x.classList.add('on'); if (x.dataset.n) v5Count(x); }); V6P.cue(); }));
    let chimed = off > 0; s.times.forEach((ms, i) => T(ms, () => { el.querySelectorAll(`.w[data-i="${i}"]`).forEach(w => w.classList.add('on')); const w = el.querySelector(`.w[data-i="${i}"]`); if (!chimed && w && w.classList.contains('kw')){ chimed = true; zChime(); } })); }
  if (V.hold) return; V.t = setTimeout(() => { if (!M || M.vid !== V || V.tok !== my || V.paused) return; if (V.i >= V.sc.length - 1) return vidEnd(); V.i++; v5Run(); }, Math.max(0, s.ms - off)); }
const _v5RunV45 = v5Run, _v5ShowV45 = v5Show, _v5ShellV45 = v5Shell;
const v6On = () => NT_FX.vidnav || NT_FX.vidfill || NT_FX.vidcam || NT_FX.vidrecap || NT_FX.vidpts;
v5Run = function(){ const V = M && M.vid; if (!V || !V.v5) return; if (!v6On()) return _v5RunV45();
  clearTimeout(V.t); (V.wt || []).forEach(clearTimeout); V.wt = []; V.paused = false; const p = $('#player'), root = p && p.querySelector('.v5'); if (root) root.classList.remove('v6-paused');
  const el = v5Show(V); if (!el) return; v6Sched(V, el, 0); V6P.scene(el); };

/* ---------- 2. la scène : caméra, « À retenir » dans les cartes ---------- */
v5Show = function(V){ const el = _v5ShowV45(V); if (!el || !v6On()) return el; const s = V.sc[V.i], root = el.closest('.v5');
  root.classList.add('v6'); root.classList.toggle('v6cam', !!NT_FX.vidcam && !RM()); root.classList.toggle('v6rc', !!NT_FX.vidrecap);
  el.style.setProperty('--sms', s.ms + 'ms'); el.classList.add('cm' + (V.i % 4));
  /* barre de progression : la scène en cours repart de zéro, même si on y revient */
  const seg = root.querySelectorAll('.v5-seg > span')[V.i]; if (seg){ seg.className = ''; void seg.offsetWidth; seg.className = 'cur'; }
  if (s.tpl === 'calc'){ el.querySelectorAll('.v5-calc .vrow').forEach(r => { const k = [...r.children], res = k.findIndex(x => x.classList.contains('vres')); if (res > 0 && k[res - 1].classList.contains('vop')){ const g = document.createElement('span'); g.className = 'v6-grp'; r.insertBefore(g, k[res - 1]); g.appendChild(k[res - 1]); g.appendChild(k[res]); } }); }
  if (NT_FX.vidrecap && s.tpl === 'recap'){ const its = s.items || [], v = el.querySelector('.v5-rc'); if (v && its.length){ let k = 0;
      v.querySelectorAll('.vit > span').forEach((sp, i) => { const w = zWords(its[i] || ''); sp.innerHTML = w.map(x => `<span class="w" data-i="${k++}">${h(x)}</span>`).reduce((a, x, j) => a + x + (j < w.length - 1 ? (v5NB(w[j], w[j + 1]) ? ' ' : ' ') : ''), ''); }); el.classList.add('v6-rc'); } }
  return el; };
/* garder les éléments « items » dans la scène, pour lire « À retenir » dans les cartes */
const _v5SceneV45 = v5Scene; v5Scene = function(it, idx, L){ const r = _v5SceneV45(it, idx, L); if (r && it && it.items) r.items = it.items; return r; };

/* ---------- 3. pause, avancer, revenir ---------- */
function v6Root(){ const p = $('#player'); return p && p.querySelector('.v5'); }
function v6Pause(why){ const V = M && M.vid; if (!V || !V.v5 || V.paused || !V.el) return; V.paused = why || 'tap'; V.off = Math.min(performance.now() - V.t0, V.sc[V.i].ms); clearTimeout(V.t); (V.wt || []).forEach(clearTimeout); V.wt = [];
  const r = v6Root(); if (r) r.classList.add('v6-paused'); V6P.pause(true); try { if (AC && AC.state === 'running') AC.suspend(); } catch(e){} }
function v6Resume(){ const V = M && M.vid; if (!V || !V.v5 || !V.paused) return; V.paused = false; const r = v6Root(); if (r) r.classList.remove('v6-paused'); V6P.pause(false); try { if (AC && AC.state === 'suspended') AC.resume(); } catch(e){}
  v6Sched(V, V.el, V.off || 0); }
function v6Go(d){ const V = M && M.vid; if (!V || !V.v5) return; const j = V.i + d; if (j >= V.sc.length) return vidEnd(); V.i = Math.max(0, j); try { if (AC && AC.state === 'suspended') AC.resume(); } catch(e){} v5Run(); }
function v6Hint(root){ let seen = false; try { seen = localStorage.getItem(V6.hintKey) === '1'; localStorage.setItem(V6.hintKey, '1'); } catch(e){} if (seen) return;
  const d = document.createElement('div'); d.className = 'v6-hint'; d.setAttribute('aria-hidden', 'true');
  d.innerHTML = `<span><b>←</b> Touche à gauche : revenir</span><span><b>II</b> Appui long : pause</span><span><b>→</b> Touche à droite : avancer</span>`; root.appendChild(d); setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 5000); }
v5Shell = function(V){ _v5ShellV45(V); const root = v6Root(); if (!root || !v6On()) return; V6P.mount(root);
  if (!NT_FX.vidnav) return; const st = root.querySelector('.v5-stage'); if (!st) return; st.classList.add('v6-tap');
  const pz = document.createElement('div'); pz.className = 'v6-pz'; pz.setAttribute('aria-hidden', 'true'); pz.innerHTML = '<i></i><i></i>'; root.appendChild(pz);
  let t0 = 0, hold = 0, held = false, x0 = 0;
  st.addEventListener('pointerdown', e => { if (e.button > 0) return; t0 = performance.now(); x0 = e.clientX; held = false; clearTimeout(hold); hold = setTimeout(() => { held = true; v6Pause('hold'); }, 280); });
  const up = e => { clearTimeout(hold); const V = M && M.vid; if (!V || !V.v5) return; if (held){ held = false; if (V.paused === 'hold') v6Resume(); return; }
    if (!t0 || performance.now() - t0 > 600) return; t0 = 0; if (V.paused){ v6Resume(); return; } const w = st.clientWidth || innerWidth; v6Go(x0 < w * 0.3 ? -1 : 1); };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', () => { clearTimeout(hold); if (held){ held = false; v6Resume(); } t0 = 0; });
  st.addEventListener('contextmenu', e => e.preventDefault()); v6Hint(root); };
addEventListener('keydown', e => { const V = M && M.vid; if (!V || !V.v5 || !NT_FX.vidnav || !v6Root()) return; if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight'){ e.preventDefault(); v6Go(1); } else if (e.key === 'ArrowLeft'){ e.preventDefault(); v6Go(-1); }
  else if (e.key === ' ' && !(e.target && e.target.closest && e.target.closest('button'))){ e.preventDefault(); V.paused ? v6Resume() : v6Pause('key'); } });
document.addEventListener('visibilitychange', () => { const V = M && M.vid; if (!V || !V.v5 || !NT_FX.vidnav) return; if (document.hidden) v6Pause('hidden'); else if (V.paused === 'hidden') v6Resume(); });

/* ---------- 4. poussière lumineuse qui se pose sur ce qui se dessine ---------- */
const V6P = (() => { const PC = new WeakMap(); let cv = null, cx = null, W = 0, H = 0, D = 1, P = [], raf = 0, on = false, frozen = false, el = null, T = [], halo = null, warp = 0, last = 0, rt = 0, nt = 0, fa = 0, fn = 0;
  const COL = ['255,255,255', '196,181,255', '143,180,255'], ALV = [0.1, 0.24, 0.48, 0.85], BK = Array.from({ length: 12 }, () => []);
  const warp_ok = () => warp > 0.2;
  const ok = () => NT_FX.vidpts && !RM() && !!window.HTMLCanvasElement;
  function size(){ if (!cv) return; D = Math.min(1.5, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = Math.round(W * D); cv.height = Math.round(H * D); cx.setTransform(D, 0, 0, D, 0, 0); }
  function mount(root){ stop(); if (!ok()) return; cv = document.createElement('canvas'); cv.className = 'v6-cv'; cv.setAttribute('aria-hidden', 'true'); const st = root.querySelector('.v5-stage'); root.insertBefore(cv, st);
    cx = cv.getContext('2d'); if (!cx){ cv.remove(); cv = null; return; } size(); const n = W * H > 600000 ? 680 : 440;
    P = Array.from({ length: n }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, tx: 0, ty: 0, k: Math.random(), r: 0.55 + Math.random() * 1.25, s: Math.random() * 6.28, ci: i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0, vx: 0, vy: 0, jx: 0, jy: 0 })); P.forEach(p => { const a = Math.random() * 6.283, d = 2 + Math.pow(Math.random(), 1.6) * 11; p.jx = Math.cos(a) * d; p.jy = Math.sin(a) * d; });
    on = true; frozen = false; addEventListener('resize', onRs); raf = requestAnimationFrame(frame); }
  function onRs(){ size(); target(); }
  /* les traits dessinés de la scène (déjà apparus) : points pris le long de chaque trait, en coordonnées d'écran */
  function target(){ if (!cv || !el || !el.isConnected) { T = []; halo = null; return; } const cr = cv.getBoundingClientRect(), pts = [], vis = x => { const c = x.closest('[data-c]'); return !c || c.classList.contains('on'); };
    const L = [...el.querySelectorAll('.v5-viz .vln, .v5-viz .vdr, .v5-viz .varc')].filter(x => x.getTotalLength && vis(x) && !x.closest('.vgrid'));
    /* densité fixe (dans les unités du dessin) : la caméra qui bouge ne mélange pas les points */ const cap = Math.floor(P.length * 0.62);
    L.forEach(x => { const m = x.getScreenCTM && x.getScreenCTM(); if (!m) return; let U = PC.get(x); if (!U){ U = []; let l = 0; try { l = x.getTotalLength(); } catch(e){} if (l > 0){ const n = Math.max(2, Math.round(l / (l < 3 ? 0.02 : 2.4))); for (let i = 0; i < n; i++){ try { const q = x.getPointAtLength((i + 0.5) / n * l); U.push([q.x, q.y]); } catch(e){} } } PC.set(x, U); }
      for (let i = 0; i < U.length && pts.length < cap; i++){ const q = U[i]; pts.push([m.a * q[0] + m.c * q[1] + m.e - cr.left, m.b * q[0] + m.d * q[1] + m.f - cr.top]); } });
    T = pts; const box = [...el.querySelectorAll('.v5-viz [data-c].on')].map(x => x.getBoundingClientRect()).filter(r => r.width > 4 && r.height > 4);
    if (box.length){ const l = Math.min(...box.map(r => r.left)), t = Math.min(...box.map(r => r.top)), r2 = Math.max(...box.map(r => r.right)), b = Math.max(...box.map(r => r.bottom)); halo = { x: (l + r2) / 2 - cr.left, y: (t + b) / 2 - cr.top, rx: Math.min(W * 0.48, (r2 - l) / 2 + 26), ry: (b - t) / 2 + 22 }; } else halo = null; }
  function scene(e){ if (!on) return; el = e; /* deux scènes liées (V48) : la poussière glisse vers le nouveau schéma au lieu d'éclater */ if (e && e.classList.contains('i-cont')){ clearTimeout(rt); rt = setTimeout(target, 300); return; } warp = 1; P.forEach(p => { const a = Math.atan2(p.y - H * 0.42, p.x - W / 2); p.vx = Math.cos(a) * (2 + p.k * 5); p.vy = Math.sin(a) * (2 + p.k * 5); });
    T = []; halo = null; clearTimeout(rt); rt = setTimeout(target, 380); }
  function cue(){ if (!on) return; clearTimeout(rt); target(); setTimeout(target, 520); setTimeout(target, 1100); }
  function pause(b){ frozen = b; if (!b && on && !raf){ last = 0; raf = requestAnimationFrame(frame); } }
  function frame(t){ raf = 0; if (!on || !cv || !cv.isConnected){ stop(); return; } if (frozen) return; raf = requestAnimationFrame(frame);
    /* appareil trop lent : moins de grains, puis plus de poussière du tout (la vidéo reste celle de V45) */
    if (last && !warp_ok()){ fa += t - last; fn++; if (fn >= 120){ const avg = fa / fn; fa = fn = 0; if (avg > 30){ if (P.length > 240) P.length = Math.floor(P.length * 0.6); else { stop(); return; } } } }
    const dt = last ? Math.min(48, t - last) / 16.7 : 1; last = t; const tt = t / 1000; if (t > nt){ nt = t + 400; target(); }
    cx.clearRect(0, 0, W, H); cx.globalCompositeOperation = 'lighter'; warp *= Math.pow(0.93, dt); const nT = T.length; const B = BK; for (let q = 0; q < 12; q++) B[q].length = 0;
    for (let i = 0; i < P.length; i++){ const p = P[i]; let tx, ty, a, rr = p.r;
      if (i < nT){ const q = T[i]; tx = q[0] + p.jx + Math.sin(tt * 1.3 + p.s) * 2.2; ty = q[1] + p.jy + Math.cos(tt * 1.1 + p.s) * 2.2; a = 0.55 + 0.45 * Math.sin(tt * 3 + p.s * 3); rr = p.r * 1.05; }
      else if (halo && i % 3 !== 0){ const ang = p.s + tt * (0.05 + p.k * 0.08) * (i % 2 ? 1 : -1), jit = 0.86 + p.k * 0.32; tx = halo.x + Math.cos(ang) * halo.rx * jit; ty = halo.y + Math.sin(ang) * halo.ry * jit; a = 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(tt * 2 + p.s * 5)); }
      else { tx = (p.s / 6.28) * W + Math.sin(tt * 0.12 + p.s * 3) * 40; ty = ((p.k * H + tt * (6 + p.k * 10)) % (H + 20)) - 10; a = 0.07 + 0.12 * (0.5 + 0.5 * Math.sin(tt * 1.6 + p.s * 4)); rr = p.r * 0.7; }
      if (warp > 0.08){ p.x += p.vx * warp * 2 * dt; p.y += p.vy * warp * 2 * dt; }
      const kk = (warp > 0.25 ? 0.03 : 0.075) * dt; if (i >= nT && !(halo && i % 3 !== 0) && Math.abs(ty - p.y) > H * 0.5){ p.y = ty; p.x = tx; } p.x += (tx - p.x) * kk; p.y += (ty - p.y) * kk;
      const lv = a < 0.14 ? 0 : a < 0.32 ? 1 : a < 0.62 ? 2 : 3; B[p.ci * 4 + lv].push(p.x, p.y, rr); }
    for (let q = 0; q < 12; q++){ const L2 = B[q]; if (!L2.length) continue; cx.fillStyle = `rgba(${COL[q >> 2]},${ALV[q & 3]})`; cx.beginPath(); for (let j = 0; j < L2.length; j += 3){ cx.moveTo(L2[j] + L2[j + 2], L2[j + 1]); cx.arc(L2[j], L2[j + 1], L2[j + 2], 0, 6.283); } cx.fill(); }
    cx.globalCompositeOperation = 'source-over'; }
  function stop(){ on = false; cancelAnimationFrame(raf); raf = 0; clearTimeout(rt); removeEventListener('resize', onRs); if (cv && cv.isConnected) cv.remove(); cv = cx = el = null; P = []; T = []; halo = null; }
  return { mount, scene, cue, pause, stop }; })();
/* ---------- 5. musique douce pendant toute la vidéo (avant : 21 s puis silence) ---------- */
NT_FX.vidmusic = NT_FX.vidmusic !== false;
const _vidMusicV45 = vidMusic; let V6M = null;
vidMusic = function(on){ if (!NT_FX.vidmusic) return _vidMusicV45(on);
  if (V6M){ const o = V6M; V6M = null; clearTimeout(o.t); try { o.g.gain.setTargetAtTime(0.0001, o.c.currentTime, 0.3); setTimeout(() => o.o.forEach(x => { try { x.stop(); } catch(e){} }), 1400); } catch(e){} }
  _vidMusicV45(false); if (!on || !S.sound) return;
  try { const c = AC = AC || new (window.AudioContext || window.webkitAudioContext)(), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; g.gain.value = 0.0001; lp.connect(g).connect(c.destination); g.gain.exponentialRampToValueAtTime(0.9, c.currentTime + 1);
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]], dur = 2.6, me = V6M = { c, g, o: [], t: 0, k: 0, at: c.currentTime + 0.05 };
    const chunk = () => { if (V6M !== me) return; if (c.state === 'running' && me.at - c.currentTime < 8){ for (let j = 0; j < 4; j++){ const k = me.k++, s0 = me.at; me.at += dur;
          chords[k % 4].forEach((f, i) => { const os = c.createOscillator(), og = c.createGain(); os.type = i ? 'triangle' : 'sine'; os.frequency.value = f * (k % 8 >= 4 && i === 2 ? 2 : 1); os.detune.value = (i - 1) * 6;
            og.gain.setValueAtTime(0.0001, s0); og.gain.exponentialRampToValueAtTime(0.05, s0 + 0.6); og.gain.exponentialRampToValueAtTime(0.0001, s0 + dur + 0.4); os.connect(og).connect(lp); os.start(s0); os.stop(s0 + dur + 0.5); me.o.push(os); os.onended = () => { const q = me.o.indexOf(os); if (q >= 0) me.o.splice(q, 1); }; }); } }
      me.t = setTimeout(chunk, 2000); };
    chunk(); } catch(e){} };
const _vidEndV45 = vidEnd; vidEnd = function(){ V6P.stop(); return _vidEndV45(); };
if (window.NT_DEBUG){ NT_DEBUG.v6music = () => V6M ? { prevues: V6M.o.length, accords: V6M.k, avance: +(V6M.at - V6M.c.currentTime).toFixed(1), etat: V6M.c.state } : null; NT_DEBUG.v6pause = () => v6Pause('debug'); NT_DEBUG.v6resume = v6Resume; NT_DEBUG.v6go = v6Go; NT_DEBUG.v6state = () => { const V = M && M.vid; return V ? { i: V.i, n: V.sc.length, ms: V.sc[V.i].ms, paused: !!V.paused, pts: !!document.querySelector(".v6-cv") } : null; }; }


/* ============================================================
   V47 — FOND « VRAIE COURBE » : ACCUEIL ET PARCOURS (09/11/2026)
   Thomas : « je ne veux plus de petits points pour le fond dans l'accueil,
   je veux une vraie courbe, belle ; mets le même fond pour le parcours ».
   - Une seule grande courbe de cours tracée d'un trait (plus aucun point) :
     trait lisse en dégradé bleu → violet → blanc vers « maintenant », halo
     doux, surface dégradée dessous, moyenne mobile fine, grille très légère,
     point « maintenant » qui respire et son niveau en tirets jusqu'au bord.
   - Elle avance quand on défile (et très lentement toute seule). Le passé
     s'efface vers la gauche.
   - Même fond sur le Parcours : il remplace le graphique de progression et
     les objets 3D en points (nœuds, chemin et pages ne changent pas).
   - Courbe décorative : aucun chiffre, ce ne sont pas des données.
   - Les canevas, le défilement et « réduire les animations » restent ceux
     de V41 (accueil) et V42 (parcours) : seul le dessin change.
   Interrupteur : NT_FX.courbe = false → fonds d'avant (points).
   ============================================================ */
NT_FX.courbe = NT_FX.courbe !== false;
const CB = { walk: null, ma: null, st: {} };
const CB_C = { v1: '124,92,255', v2: '143,116,255', v3: '196,181,255', b1: '91,140,255', b2: '143,180,255', w: '236,238,255' };
function cbData(){ if (CB.walk) return; const N = 2200, w = mwWalk(N, 2026);
  /* lissage très léger (1-2-1) : la courbe reste nette et garde l'allure d'un vrai cours */
  const sm = w.map((_, i) => (w[Math.max(0, i - 1)] + 2 * w[i] + w[Math.min(N - 1, i + 1)]) / 4);
  const ma = []; let acc = 0; for (let i = 0; i < N; i++){ acc += sm[i]; if (i >= 26) acc -= sm[i - 26]; ma.push(acc / Math.min(i + 1, 26)); }
  CB.walk = sm; CB.ma = ma; }
/* tracé lisse qui passe par les points (milieux + courbes de Bézier) */
function cbPath(g, P){ if (P.length < 2) return; g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length - 1; i++){ const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; g.quadraticCurveTo(P[i][0], P[i][1], mx, my); } const L = P[P.length - 1]; g.lineTo(L[0], L[1]); }
function cbDraw(g, W, H, T, key, prog, al = 1){ cbData(); const N = CB.walk.length, mob = W < 700, vis = mob ? 130 : 240, dx = W / vis, now = 0.72, nx = W * now, rm = RM();
  const st = CB.st[key] || (CB.st[key] = { pan: null, lo: 0, hi: 0 }), first = st.pan == null;
  /* départ choisi sur un passage calme qui monte doucement (pas de saut juste avant « maintenant ») */ const tgt = 630 + prog * (N - vis - 1050) + (rm ? 0 : (T * 0.45) % 400); st.pan = st.pan == null || rm ? tgt : st.pan + (tgt - st.pan) * 0.14; const pan = st.pan;
  const at = (arr, p) => { const i = Math.floor(p), f = p - i, a = arr[Math.max(0, Math.min(N - 1, i))], b = arr[Math.max(0, Math.min(N - 1, i + 1))]; return a + (b - a) * f; };
  const pNow = pan + vis * now, i0 = Math.max(0, Math.floor(pan) - 2), i1 = Math.floor(pNow);
  let lo = 1e9, hi = -1e9; for (let i = Math.max(0, i0 - Math.round(vis * 0.6)); i <= i1 + 1; i++){ const v = CB.walk[Math.min(N - 1, i)]; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad; if (first || rm){ st.lo = lo; st.hi = hi; } else { st.lo += (lo - st.lo) * 0.12; st.hi += (hi - st.hi) * 0.12; }
  const y0 = H * (mob ? 0.43 : 0.5), y1 = H * (mob ? 0.8 : 0.9), Y = v => y1 - (v - st.lo) / Math.max(0.04, st.hi - st.lo) * (y1 - y0), X = p => (p - pan) * dx;
  const P = [], Q = []; for (let i = i0; i <= i1; i++){ P.push([X(i), Y(CB.walk[i])]); Q.push([X(i), Y(CB.ma[i])]); } const ny = Y(at(CB.walk, pNow)); P.push([nx, ny]); Q.push([nx, Y(at(CB.ma, pNow))]);
  if (al < 0.01) return; g.save(); g.globalAlpha = al; g.lineJoin = 'round'; g.lineCap = 'round';
  /* grille très légère : lignes de niveau fixes, lignes de temps qui avancent avec la courbe */
  g.lineWidth = 1; g.strokeStyle = `rgba(${CB_C.b2},0.055)`; g.beginPath(); for (let k = 0; k <= 4; k++){ const y = Math.round(y0 - 26 + (y1 - y0 + 52) * k / 4) + 0.5; g.moveTo(0, y); g.lineTo(W, y); }
  const gs = mob ? 30 : 40; for (let i = Math.ceil(pan / gs) * gs; X(i) < W; i += gs){ const x = Math.round(X(i)) + 0.5; g.moveTo(x, y0 - 26); g.lineTo(x, y1 + 26); } g.stroke();
  /* surface sous la courbe */
  const fill = g.createLinearGradient(0, y0 - 10, 0, y1 + 40); fill.addColorStop(0, `rgba(${CB_C.v1},0.22)`); fill.addColorStop(0.55, `rgba(${CB_C.b1},0.07)`); fill.addColorStop(1, `rgba(${CB_C.b1},0)`);
  g.beginPath(); cbPath(g, P); g.lineTo(nx, y1 + 40); g.lineTo(P[0][0], y1 + 40); g.closePath(); g.fillStyle = fill; g.fill();
  /* moyenne mobile : trait fin bleu */
  g.beginPath(); cbPath(g, Q); g.lineWidth = 1.4; g.strokeStyle = `rgba(${CB_C.b1},0.5)`; g.stroke();
  /* halo du trait, puis le trait : bleu dans le passé, violet, blanc à « maintenant » */
  g.beginPath(); cbPath(g, P); g.lineWidth = mob ? 8 : 10; g.strokeStyle = `rgba(${CB_C.v2},0.14)`; g.stroke();
  const ln = g.createLinearGradient(0, 0, nx, 0); ln.addColorStop(0, `rgba(${CB_C.b1},0.5)`); ln.addColorStop(0.55, `rgba(${CB_C.v2},0.95)`); ln.addColorStop(0.9, `rgba(${CB_C.v3},1)`); ln.addColorStop(1, `rgba(${CB_C.w},1)`);
  g.lineWidth = mob ? 2.1 : 2.5; g.strokeStyle = ln; g.stroke();
  /* le passé s'efface vers la gauche */
  g.globalCompositeOperation = 'destination-out'; const fade = g.createLinearGradient(0, 0, W * 0.3, 0); fade.addColorStop(0, 'rgba(0,0,0,0.92)'); fade.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fade; g.fillRect(0, y0 - 60, W * 0.3, y1 - y0 + 120); g.globalCompositeOperation = 'source-over';
  /* « maintenant » : niveau en tirets jusqu'au bord, point qui respire */
  g.setLineDash([5, 7]); g.lineWidth = 1.2; g.strokeStyle = `rgba(${CB_C.v3},0.42)`; g.beginPath(); g.moveTo(nx + 14, Math.round(ny) + 0.5); g.lineTo(W, Math.round(ny) + 0.5); g.stroke(); g.setLineDash([]);
  const ph = rm ? 0.4 : (T * 0.6) % 1, hr = g.createRadialGradient(nx, ny, 0, nx, ny, 34); hr.addColorStop(0, `rgba(${CB_C.v2},0.45)`); hr.addColorStop(1, `rgba(${CB_C.v2},0)`); g.fillStyle = hr; g.beginPath(); g.arc(nx, ny, 34, 0, 6.2832); g.fill();
  if (!rm){ g.lineWidth = 1.5; g.strokeStyle = `rgba(${CB_C.v3},${(0.55 * (1 - ph)).toFixed(3)})`; g.beginPath(); g.arc(nx, ny, 6 + ph * 18, 0, 6.2832); g.stroke(); }
  g.fillStyle = `rgba(${CB_C.w},1)`; g.beginPath(); g.arc(nx, ny, mob ? 4.2 : 4.8, 0, 6.2832); g.fill(); g.lineWidth = 2; g.strokeStyle = `rgba(${CB_C.v2},0.9)`; g.stroke();
  g.restore(); }
/* le globe des Bourses, en traits fins (plus de points) : parallèles et méridiens, arcs lumineux depuis Paris
   avec une petite comète qui les parcourt, places plus brillantes pendant leurs horaires habituels */
const CB_DEG = Math.PI / 180;
function cbGlobe(g, W, H, T, al, b){ if (al < 0.01) return; const mob = W < 700, rm = RM(), R = mob ? Math.min(W * 0.45, H * 0.3) : Math.min(W * 0.25, H * 0.35), cx = mob ? W * 0.5 : W * 0.5 + 116, cy = H * (0.6 + (1 - b) * 0.55);
  const rot = -0.4 + scrollY * 0.0016 + (rm ? 0 : T * 0.02), tl = 0.38, ct = Math.cos(tl), stl = Math.sin(tl);
  const P = (la, lo, hh = 1) => { const x = Math.cos(la) * Math.sin(lo + rot), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo + rot); return [cx + x * R * hh, cy - (y * ct - z * stl) * R * hh, y * stl + z * ct]; };
  g.save(); g.globalAlpha = al; g.lineJoin = 'round'; g.lineCap = 'round';
  /* atmosphère et volume */
  const atm = g.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.38); atm.addColorStop(0, `rgba(${CB_C.b1},0.13)`); atm.addColorStop(1, `rgba(${CB_C.b1},0)`); g.fillStyle = atm; g.beginPath(); g.arc(cx, cy, R * 1.38, 0, 6.2832); g.fill();
  const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R); body.addColorStop(0, `rgba(${CB_C.v2},0.16)`); body.addColorStop(0.7, `rgba(${CB_C.b1},0.06)`); body.addColorStop(1, `rgba(${CB_C.b1},0.02)`); g.fillStyle = body; g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.fill();
  /* parallèles et méridiens : seulement la face visible, plus clairs vers l'avant */
  const B = [[], [], [], []], seg = (a, c) => { const z = (a[2] + c[2]) / 2; if (z <= 0.02) return; B[z < 0.25 ? 0 : z < 0.5 ? 1 : z < 0.75 ? 2 : 3].push(a[0], a[1], c[0], c[1]); };
  for (let la = -60; la <= 60; la += 20){ let pv = null; for (let k = 0; k <= 72; k++){ const q = P(la * CB_DEG, k / 72 * 6.2832); if (pv) seg(pv, q); pv = q; } }
  for (let m = 0; m < 18; m++){ let pv = null; const lo = m * 20 * CB_DEG; for (let k = 0; k <= 36; k++){ const q = P((-90 + k * 5) * CB_DEG, lo); if (pv) seg(pv, q); pv = q; } }
  const AL = [0.05, 0.1, 0.17, 0.25]; g.lineWidth = 1; B.forEach((L, k) => { if (!L.length) return; g.strokeStyle = `rgba(${CB_C.b2},${AL[k]})`; g.beginPath(); for (let i = 0; i < L.length; i += 4){ g.moveTo(L[i], L[i + 1]); g.lineTo(L[i + 2], L[i + 3]); } g.stroke(); });
  /* contour net + léger halo */
  g.lineWidth = 6; g.strokeStyle = `rgba(${CB_C.v1},0.08)`; g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.stroke(); g.lineWidth = 1.4; g.strokeStyle = `rgba(${CB_C.b2},0.5)`; g.stroke();
  /* arcs depuis Paris, et une comète sur chacun */
  const v3 = (la, lo) => [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)], pa = MB_PL[0], A = v3(pa[1] * CB_DEG, pa[2] * CB_DEG);
  MB_PL.slice(1).forEach((q, i) => { const Bv = v3(q[1] * CB_DEG, q[2] * CB_DEG), om = Math.acos(Math.max(-1, Math.min(1, A[0] * Bv[0] + A[1] * Bv[1] + A[2] * Bv[2]))), so = Math.sin(om) || 1, n = Math.max(24, Math.round(om * 50)), pts = [];
    for (let k = 0; k <= n; k++){ const s2 = k / n, a = Math.sin((1 - s2) * om) / so, c = Math.sin(s2 * om) / so, v = [A[0] * a + Bv[0] * c, A[1] * a + Bv[1] * c, A[2] * a + Bv[2] * c]; pts.push(P(Math.asin(v[1]), Math.atan2(v[2], v[0]), 1 + 0.22 * Math.sin(Math.PI * s2) * om / Math.PI)); }
    g.lineWidth = 1.3; g.strokeStyle = `rgba(${CB_C.v3},0.34)`; g.beginPath(); let on = false; pts.forEach(p => { if (p[2] < -0.06){ on = false; return; } if (!on){ g.moveTo(p[0], p[1]); on = true; } else g.lineTo(p[0], p[1]); }); g.stroke();
    if (rm) return; const hs = (T * 0.16 + i * 0.137) % 1, k1 = Math.round(hs * n), k0 = Math.max(0, k1 - Math.round(n * 0.12));
    for (let k = k0; k < k1; k++){ const p = pts[k], p2 = pts[k + 1]; if (p[2] < 0 || p2[2] < 0) continue; const f = (k - k0 + 1) / Math.max(1, k1 - k0); g.lineWidth = 1 + f * 1.6; g.strokeStyle = `rgba(${CB_C.w},${(f * 0.9).toFixed(3)})`; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p2[0], p2[1]); g.stroke(); } });
  /* les places : rondes, plus brillantes pendant leurs horaires habituels (hors jours fériés) */
  const nowS = performance.now() / 1000; if (!CB.openAt || nowS - CB.openAt > 30){ CB.openAt = nowS; CB.open = MB_PL.map(q => mbOpen(q[3], q[4])); }
  g.font = `600 ${mob ? 9.5 : 10.5}px Inter, system-ui, sans-serif`; g.textBaseline = 'middle';
  MB_PL.forEach((q, i) => { const p = P(q[1] * CB_DEG, q[2] * CB_DEG); if (p[2] < 0.05) return; const op = CB.open && CB.open[i];
    if (op && !rm){ const ph = (T * 0.7 + i * 0.3) % 1; g.lineWidth = 1.4; g.strokeStyle = `rgba(${CB_C.v3},${(0.6 * (1 - ph)).toFixed(3)})`; g.beginPath(); g.arc(p[0], p[1], 4 + ph * 12, 0, 6.2832); g.stroke(); }
    g.fillStyle = op ? `rgba(${CB_C.w},1)` : `rgba(${CB_C.b2},0.75)`; g.beginPath(); g.arc(p[0], p[1], op ? 3.2 : 2.4, 0, 6.2832); g.fill(); if (op){ g.lineWidth = 1.6; g.strokeStyle = `rgba(${CB_C.v2},0.9)`; g.stroke(); }
    if (q[5] === 0) return; let sd = q[5] === -1 ? -1 : 1; const tw = g.measureText(q[0]).width; if (sd > 0 && p[0] + 8 + tw > W - 6) sd = -1; else if (sd < 0 && p[0] - 8 - tw < 6) sd = 1;
    g.fillStyle = `rgba(${CB_C.v3},${(0.25 + 0.5 * p[2]).toFixed(3)})`; g.textAlign = sd < 0 ? 'right' : 'left'; g.fillText(q[0], p[0] + sd * 8, p[1] + (q[6] || 0)); g.textAlign = 'left'; });
  g.restore(); }
/* légèreté : quand une page arrive, le fond attend un peu (les blocs de la page apparaissent d'abord) ;
   immobile, environ 16 images par seconde suffisent (la courbe avance de 3 px par seconde) */
const CBT = { calm: 0, last: {}, sy: {} };
(function(){ const app = document.getElementById('app'); if (app) new MutationObserver(() => { CBT.calm = performance.now() + 900; if (CBT.page !== S.page){ CBT.page = S.page; CB.st = {}; CBT.last = {}; } }).observe(app, { childList: true }); })();
function cbGate(key){ if (RM()) return true; const n = performance.now(), sy = scrollY, mv = Math.abs(sy - (CBT.sy[key] == null ? -1 : CBT.sy[key])) > 0.5, l = CBT.last[key] || 0;
  if (l && n < CBT.calm) return false; if (l && !mv && n - l < 62) return false; CBT.last[key] = n; CBT.sy[key] = sy; return true; }
/* branchement : accueil (canevas V41) et parcours (canevas V42) ; plus de bandeaux ni d'objets 3D en points */
const _mbDrawV41 = mbDraw, _mbTapesV41 = mbTapes, _pbDrawV42 = pbDraw, _pcGLV33 = pcGL;
mbDraw = function(T){ if (!NT_FX.courbe) return _mbDrawV41(T); const g = MB.g; if (!g || !cbGate('home')) return; g.setTransform(MB.d, 0, 0, MB.d, 0, 0); g.clearRect(0, 0, MB.w, MB.h);
  /* la courbe en haut ; le globe revient à partir de « Ta liste », comme avant */ const b = mbZones().b; cbDraw(g, MB.w, MB.h, T, 'home', mwTarget(), 1 - b); cbGlobe(g, MB.w, MB.h, T, b, b); };
mbTapes = function(){ if (NT_FX.courbe){ MB.tapes = []; return; } return _mbTapesV41(); };
pbDraw = function(T, dt){ if (!NT_FX.courbe) return _pbDrawV42(T, dt); const g = PB.g; if (!g || !cbGate('carte')) return; g.setTransform(PB.d, 0, 0, PB.d, 0, 0); g.clearRect(0, 0, PB.w, PB.h);
  if (PB.cv && PB.cv.style.opacity && PB.cv.style.opacity !== '0' && PB.cv.style.opacity !== '1') PB.cv.style.opacity = '1'; const pr = mwTarget(), b = mbS(0.62, 0.86, pr); cbDraw(g, PB.w, PB.h, T, 'carte', pr, 1 - b); cbGlobe(g, PB.w, PB.h, T, b, b); };
pcGL = function(){ if (NT_FX.courbe) return; return _pcGLV33(); };
const _pbTargetV42 = pbTarget; pbTarget = function(){ if (NT_FX.courbe && !PB.cam) return { x: 0, y: 0, span: 1, sy: 1 }; return _pbTargetV42(); };


/* ============================================================
   V48 — NOUVEAUX SCHÉMAS POUR LES NOTIONS QUI REVIENNENT (09/11/2026)
   Thomas : « fais deux et trois » → 2 = de vrais schémas à la place des
   simples dessins, 3 = vitesse de lecture + transitions qui enchaînent.
   Notions repérées dans les 201 vidéos (phrases qui n'avaient qu'un dessin
   ou une carte de texte) et leur nouveau schéma :
   - sr     : tendance, support, résistance, range, cassure, fausse cassure,
              stop sous le support (le cours se dessine et touche les niveaux) ;
   - stopl  : stop-loss (le cours tombe sur le stop : vente, perte limitée) ;
   - bond   : obligation (prêt → coupons → remboursement, selon ce qui est dit) ;
   - rates  : « taux en hausse → prix des obligations en baisse » (balançoire) ;
   - fees   : les frais freinent (deux courbes : sans frais / avec frais) ;
   - emo    : émotions (peur, panique, euphorie, FOMO…) posées sur un cycle ;
   - share  : une action = une part d'entreprise ; dividende = part du
              bénéfice versée aux actionnaires ;
   - horizon: le long terme (zoom arrière : une baisse passagère dans une hausse) ;
   - benef  : bénéfice = ventes − charges ;
   - pair2  : deux valeurs comparées (« ETF A : 0,20 % ; ETF B : 0,60 % ») ;
   - flags  : signaux d'alerte d'une arnaque, un par un ;
   - scam   : une promesse entre guillemets, tamponnée « Arnaque ».
   Règles : les mots affichés viennent de la phrase ; aucun chiffre inventé
   (les schémas sans chiffre restent des dessins) ; une phrase ne change de
   schéma que si elle n'avait qu'un dessin, une carte de texte, un graphique
   général ou une balance.
   Interrupteur : NT_FX.vidschema = false → schémas de V45.
   ============================================================ */
NT_FX.vidschema = NT_FX.vidschema !== false;
const V8_BASE = new Set(['icon', 'def', 'chart', 'scale', 'num', 'candle']);
const v8W = (X, re, d) => { const t = X.wAt(re); return t > 0 ? t : d; };
const v8D = P => P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
const v8S = P => { if (P.length < 3) return v8D(P); let s = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`; for (let i = 1; i < P.length - 1; i++){ const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2; s += ` Q${P[i][0].toFixed(1)} ${P[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; } const L = P[P.length - 1]; return s + ` L${L[0].toFixed(1)} ${L[1].toFixed(1)}`; };
/* un cours réaliste entre des points clés (petites oscillations entre deux appuis) */
function v8Walk(K, r, x0 = 24, x1 = 296, sub = 3, amp = 4){ const P = []; for (let i = 0; i < K.length; i++){ const [u, y] = K[i]; P.push([x0 + (x1 - x0) * u, y]); if (i < K.length - 1){ const [u2, y2] = K[i + 1]; for (let k = 1; k < sub; k++){ const f = k / sub; P.push([x0 + (x1 - x0) * (u + (u2 - u) * f), y + (y2 - y) * f + (r() - 0.5) * amp * 2]); } } } return P; }
const v8Pill = (x, y, t, cls = '', anchor = 'middle') => { const w = Math.max(34, String(t).length * 6.6 + 16), xx = Math.max(4, Math.min(316 - w, anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2));
  return `<g class="v8-pill ${cls}"><rect x="${xx.toFixed(1)}" y="${(y - 11).toFixed(1)}" width="${w.toFixed(1)}" height="22" rx="11"/><text x="${(xx + w / 2).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${h(t)}</text></g>`; };
const v8Cap = s => String(s).replace(/^./, c => c.toUpperCase());
/* ---------- choix des schémas ---------- */
function v8SrMode(n){ const sup = /\bsupports?\b|plancher/.test(n), res = /resistances?\b|plafond(?! de versement)/.test(n), stop = /\bstop\b/.test(n);
  if (/tendance baissiere|sommets et (des )?creux (de plus en plus bas|descendants)|^baissiere\b/.test(n)) return { k: 'down', sup, res, stop };
  if (/tendance haussiere|sommets et (des )?creux (de plus en plus hauts|ascendants)|creux ascendants|marche en tendance|^haussiere\b/.test(n)) return { k: 'up', sup, res, stop };
  if (/range entre/.test(n)) return { k: 'range', sup: true, res: true, stop };
  if (/sort du range|sortie du range|range par le haut/.test(n)) return { k: 'break', sup: true, res: true, stop };
  if (/\brange\b|entre un plancher et un plafond|rebondit entre/.test(n) || (sup && res)) return { k: 'range', sup: true, res: true, stop };
  if (/fausse cassure|est retombe|puis est retombe/.test(n)) return { k: 'fake', sup, res: true, stop };
  if (/sort du range|sortie du range|par le haut/.test(n)) return { k: 'break', sup: true, res: true, stop };
  if (sup && /casse|cassure|enfonce/.test(n)) return { k: 'breakdown', sup: true, res, stop };
  if (/cassure|casse|franchit|au-dessus/.test(n) && !sup) return { k: 'break', sup, res: true, stop };
  if (sup) return { k: 'support', sup: true, res, stop };
  if (res) return { k: 'res', sup, res: true, stop };
  return null; }
function v8Pick(it, base){ if (!NT_FX.vidschema || !V8_BASE.has(base)) return null; const t = v5Clean(it.t || ''), n = norm(t), many = (t.match(/,/g) || []).length >= 3, list = v5List(t) || (many ? true : null), qq = t.match(/«\s?([^»]{4,60}?)\s?»/);
  if (v8Pair(t)) return 'pair2';
  if (/signaux d.alerte|drapeaux? rouges?/.test(n) && v8Flags(t)) return 'flags';
  if (qq && /arnaque|escroc/.test(n) && /garanti|%|gain|rendement|par mois/.test(norm(qq[1]))) return 'scam';
  if (base === 'num') return /range entre/.test(n) && v8Rng(t) ? 'sr' : null;
  if (base === 'candle' && !/sommets et (des )?creux/.test(n)) return null;
  if ((!many || /:\s/.test(t) && /support/.test(n) && /resistance/.test(n)) && /\bsupports?\b|plancher|resistances?\b|plafond(?! de versement)|\brange\b|sommets et (des )?creux|creux ascendants|tendance (haussiere|baissiere)|marche en tendance|fausse cassure|passe au-dessus.*retomb|^(haussiere|baissiere)\b/.test(n) && v8SrMode(n)) return 'sr';
  if (!list && /cassure/.test(n) && !/,.*,/.test(t) && v8SrMode(n)) return 'sr';
  if (!list && /stop-loss|\bstop\b/.test(n) && !/journal/.test(n)) return 'stopl';
  if (/taux (montent|en hausse|monte|augmentent)|hausse des taux/.test(n) && /obligation/.test(n) && /baiss|prix/.test(n)) return 'rates';
  if (/obligation/.test(n) && /\bpret\b|coupon|interets|rembours|emetteur|echeance/.test(n) && !/eligible|pea/.test(n)) return 'bond';
  if (/frais/.test(n) && (/frein|grignot|mange|reduis/.test(n) || /coute|pese|oubli|compris/.test(n) && !list)) return 'fees';
  if (/dividende/.test(n) && /benefice|actionnaires|verse/.test(n)) return 'share';
  if (/\bactions?\b[^.]{0,40}\b(part|morceau|fraction)\b[^.]{0,30}entreprise|actionnaire|coproprietaire/.test(n)) return 'share';
  if (/benefice/.test(n) && /reste|charges/.test(n) && !new RegExp(V5_NUM).test(t)) return 'benef';
  const emo = v8Emo(t); if (emo.length >= 2 || (emo.length && /panique/.test(n) && /vend/.test(n))) return 'emo';
  if (!many && /long terme|horizon (est )?long|plus l.horizon|baisses temporaires|laisser le temps|patience/.test(n) && !/inadapte|pea/.test(n) && !new RegExp(`${V5_NUM}\\s?%`).test(t)) return 'horizon';
  return null; }
const _v5PickV45 = v5Pick; v5Pick = function(it){ const b = _v5PickV45(it); if (it.tpl) return b; return v8Pick(it, b) || b; };
/* ---------- aides de lecture du texte ---------- */
/* « range entre 47 € et 52 € … stop sous 46,50 € » : les vrais niveaux de la phrase */
function v8Rng(t){ const m = String(t).match(new RegExp(`entre (${V5_NUM})\\s?€ et (${V5_NUM})\\s?€`)), st = String(t).match(new RegExp(`stop (?:sous|à|a) (${V5_NUM})\\s?€`)); return m ? { lo: m[1].trim() + ' €', hi: m[2].trim() + ' €', stop: st ? st[1].trim() + ' €' : null } : null; }
function v8Pair(t){ const re = new RegExp(`([A-ZÀ-Ý][A-Za-zÀ-ÿ’' ]{0,14}?)\\s:\\s(?:[a-zà-ÿ’' ]{0,16}\\s)?(${V5_NUM})\\s?(€|%)`, 'g'), L = [...String(t).matchAll(re)].map(m => ({ l: m[1].trim(), v: v5Val(m[2]), s: m[2].trim() + ' ' + m[3], u: m[3], i: m.index }));
  return L.length === 2 && L[0].u === L[1].u && L.every(x => isFinite(x.v) && x.v >= 0) && L[0].l !== L[1].l ? L : null; }
function v8Flags(t){ const s = v5Clean(t).replace(/[.…!]+$/, ''), k = s.indexOf(' : '); if (k < 0) return null; const parts = s.slice(k + 3).split(/,\s|;\s/).map(x => x.trim().replace(/…$/, '')).filter(x => x.length > 2);
  return parts.length >= 2 && parts.length <= 6 ? { head: s.slice(0, k), items: parts.map(v8Cap) } : null; }
const V8_EMO = [['euphorie', 't'], ['fomo', 't'], ['avidité', 't'], ['excès de confiance', 't'], ['envie de se refaire', 'b'], ['revenge trading', 'b'], ['aversion à la perte', 'b'], ['panique', 'b'], ['peur', 'b'], ['stress', 'b'], ['fatigue', 'm'], ['envie', 'm']];
function v8Emo(t){ const n = norm(t), out = []; V8_EMO.forEach(([w, p]) => { const nw = norm(w); if (new RegExp(`\\b${nw}\\b`).test(n) && !out.some(o => norm(o.w).includes(nw))){ const m = String(t).match(new RegExp(w.replace(/[àâ]/g, '[àâa]').replace(/[éèê]/g, '[éèêe]'), 'i')); out.push({ w: v8Cap(m ? m[0] : w), p, re: new RegExp(nw.split(' ')[0]) }); } }); return out.slice(0, 4); }
/* ---------- les schémas ---------- */
Object.assign(V5T, {
  /* tendance, supports, résistances, cassures */
  sr(X){ const n = norm(X.it.t), m = v8SrMode(n) || { k: 'up' }, r = v5Rnd(v5Hash(X.it.t)), yR = 62, yS = 150;
    const KS = { up: [[0, 176], [.1, 134], [.18, 150], [.3, 108], [.4, 126], [.52, 84], [.62, 102], [.75, 60], [.84, 78], [1, 34]],
      range: [[0, 112], [.1, yR + 3], [.22, yS - 3], [.36, yR + 3], [.5, yS - 3], [.64, yR + 3], [.78, yS - 3], [.9, 96], [1, 108]],
      support: [[0, 52], [.14, 104], [.24, yS - 3], [.36, 104], [.46, 124], [.56, yS - 3], [.68, 96], [.8, 120], [.9, yS - 3], [1, 100]],
      res: [[0, 170], [.14, 118], [.24, yR + 3], [.36, 112], [.46, 92], [.56, yR + 3], [.68, 118], [.8, 92], [.9, yR + 3], [1, 112]],
      break: [[0, 126], [.12, yR + 3], [.24, yS - 6], [.38, yR + 3], [.5, yS - 10], [.62, yR + 3], [.72, 98], [.84, 40], [.92, 52], [1, 22]],
      fake: [[0, 132], [.14, yR + 3], [.28, 126], [.42, yR + 3], [.54, 110], [.66, yR - 26], [.74, yR + 8], [.86, 122], [1, 142]],
      breakdown: [[0, 82], [.14, yS - 3], [.28, 100], [.42, yS - 3], [.56, 96], [.7, yS - 2], [.82, 176], [1, 192]] };
    let K = m.k === 'down' ? KS.up.map(([u, y]) => [u, 210 - y]) : KS[m.k] || KS.up; const P = v8Walk(K, r), pts = K.map(([u, y]) => [24 + 272 * u, y]);
    const RG = v8Rng(v5Clean(X.it.t)), supW = RG ? RG.lo : /plancher/.test(n) && !/\bsupport/.test(n) ? 'Plancher' : 'Support', resW = RG ? RG.hi : /plafond/.test(n) && !/resistance/.test(n) ? 'Plafond' : 'Résistance';
    const tS = v8W(X, RG ? /^\d/ : /support|plancher/, 500), tR = v8W(X, RG ? /^\d/ : /resistance|plafond/, 500), dur = 2400, tP = 250;
    X.cue(0, 'g'); X.cue(tP, 'p'); if (m.sup || m.k === 'range') X.cue(Math.min(tS, 1200), 's'); if (m.res || m.k === 'range') X.cue(Math.min(tR, 1400), 'r');
    const touch = []; pts.forEach(([x, y], i) => { if (i && i < pts.length - 1 && ((m.sup || m.k === 'range') && Math.abs(y - yS) < 7 || (m.res || m.k === 'range' || m.k === 'fake' || m.k === 'break') && Math.abs(y - yR) < 7)) touch.push([x, y]); });
    touch.forEach(([x], i) => X.cue(tP + dur * ((x - 24) / 272) * 0.95 + 120, 't' + i));
    let extra = '';
    if (m.k === 'up' || m.k === 'down'){ /* hausse : la ligne passe sous les creux ; baisse : au-dessus des sommets */ const lows = pts.filter((_, i) => i % 2 === 0), off = m.k === 'up' ? 10 : -10, a = lows[0], b = lows[lows.length - 1], ex = (b[1] - a[1]) / (b[0] - a[0]);
      X.cue(Math.max(tP + dur * 0.7, v8W(X, /creux|tendance|sommets/, 0)), 'tl');
      extra += `<g data-c="tl"><path d="M${a[0]} ${a[1] + off} L${b[0] + 16} ${b[1] + off + ex * 16}" class="v8-tl vdr" pathLength="1"/>${/sommets|creux/.test(n) ? v8Pill(294, m.k === 'up' ? 194 : 18, m.k === 'up' ? 'Creux plus hauts' : 'Sommets plus bas', 'sm', 'end') : ''}</g>`; }
    if (m.k === 'fake'){ const top = pts[5]; X.cue(Math.max(tP + dur * 0.8, v8W(X, /fausse|retomb|piege/, 0)), 'x');
      extra += `<g data-c="x"><circle cx="${top[0]}" cy="${top[1]}" r="11" class="v8-bad"/><path d="M${top[0] - 5} ${top[1] - 5} L${top[0] + 5} ${top[1] + 5} M${top[0] + 5} ${top[1] - 5} L${top[0] - 5} ${top[1] + 5}" class="v8-badx"/>${/fausse cassure/.test(n) ? v8Pill(top[0], top[1] - 24, 'Fausse cassure', 'bad') : ''}</g>`; }
    if (m.k === 'break'){ const c = P.find(p => p[0] > 24 + 272 * 0.72 && p[1] < yR) || pts[7]; X.cue(Math.max(tP + dur * 0.8, v8W(X, /cassure|casse|franchi/, 0)), 'x');
      extra += `<g data-c="x"><circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="9" class="v8-burst"/>${/cassure/.test(n) ? v8Pill(c[0] - 6, c[1] - 24, 'Cassure', 'hi') : ''}</g>`; }
    if (m.k === 'breakdown' && !m.stop && /sors|sortie|sortir/.test(n)){ const ex = P.find(p => p[1] > yS + 4) || pts[6]; X.cue(Math.max(tP + dur * 0.9, v8W(X, /sors|sortie|sortir/, 0)), 'ex'); extra += `<g data-c="ex"><circle cx="${ex[0].toFixed(1)}" cy="${ex[1].toFixed(1)}" r="8" class="v8-bad"/>${v8Pill(ex[0] - 14, ex[1] + 4, 'Sortie', 'bad', 'end')}</g>`; }
    if (m.stop && (m.sup || m.k === 'breakdown' || m.k === 'support')){ const yT = yS + 16, buy = pts.filter(p => Math.abs(p[1] - yS) < 7).slice(-1)[0] || pts[3]; X.cue(v8W(X, /\bstop/, tP + dur), 'st'); if (/achat|achet|entr/.test(n)) X.cue(v8W(X, /achat|achet|entr/, tP + dur * 0.6), 'b');
      extra += `${/achat|achet|entr/.test(n) ? `<g data-c="b"><circle cx="${buy[0].toFixed(1)}" cy="${buy[1].toFixed(1)}" r="6" class="v8-buy"/>${v8Pill(buy[0] - 10, buy[1] - 24, /entr/.test(n) && !/achat|achet/.test(n) ? 'Entrée' : 'Achat', 'hi', 'end')}</g>` : ''}
        <g data-c="st"><line x1="24" x2="296" y1="${yT}" y2="${yT}" class="v8-lvl v8-stop"/>${v8Pill(26, yT + 18, RG && RG.stop ? 'Stop ' + RG.stop : 'Stop', 'bad', 'start')}</g>`;
      if (m.k === 'breakdown'){ const ex = P.find(p => p[1] > yT) || pts[6]; X.cue(Math.max(tP + dur * 0.9, v8W(X, /sors|sortie|sortir|vend/, 0)), 'ex'); extra += `<g data-c="ex"><circle cx="${ex[0].toFixed(1)}" cy="${ex[1].toFixed(1)}" r="7" class="v8-bad"/>${/sors|sortie|sortir/.test(n) ? v8Pill(ex[0] - 30, ex[1] + 4, 'Sortie', 'bad', 'end') : ''}</g>`; } }
    return `<svg class="v5-svg v8-sr" viewBox="0 0 320 210">${v5Defs(X.id)}
      <g data-c="g" class="vgrid">${[30, 75, 120, 165].map(y => `<line x1="24" x2="296" y1="${y}" y2="${y}"/>`).join('')}</g>
      <g data-c="p"><path d="${v8D(P)} L296 210 L24 210 Z" fill="url(#${X.id}a)" class="vfade"/><path d="${v8D(P)}" class="vglw"/><path d="${v8D(P)}" class="vln vdr v8-price" pathLength="1" stroke="url(#${X.id}g)"/></g>
      ${m.res || m.k === 'range' ? `<g data-c="r"><rect x="24" y="${yR - 7}" width="272" height="14" class="v8-zone r"/><line x1="24" x2="296" y1="${yR}" y2="${yR}" class="v8-lvl r"/>${v8Pill(26, yR - 18, resW, 'r', 'start')}</g>` : ''}
      ${m.sup || m.k === 'range' ? `<g data-c="s"><rect x="24" y="${yS - 7}" width="272" height="14" class="v8-zone s"/><line x1="24" x2="296" y1="${yS}" y2="${yS}" class="v8-lvl s"/>${v8Pill(26, m.stop ? yS - 18 : yS + 20, supW, 's', 'start')}</g>` : ''}
      ${touch.map(([x, y], i) => `<g data-c="t${i}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" class="v8-touch"/></g>`).join('')}${extra}</svg>`; },
  /* stop-loss : le cours tombe sur le stop, la position est vendue, la perte s'arrête là */
  stopl(X){ const n = norm(X.it.t), r = v5Rnd(v5Hash(X.it.t)), yE = 78, yT = 128, K = [[0, 96], [.16, yE], [.3, 92], [.42, 84], [.56, 110], [.64, yT], [.78, 162], [1, 186]], P = v8Walk(K, r), cut = P.findIndex(p => p[0] >= 24 + 272 * 0.64);
    const A = P.slice(0, cut + 1), B = P.slice(cut), hit = P[cut], ent = [24 + 272 * 0.16, yE], vend = /vend|sortie|sors|coupe/.test(n);
    X.cue(0, 'g'); X.cue(250, 'p'); X.cue(v8W(X, /\bstop|niveau/, 700), 'st'); X.cue(250 + 1900, 'h'); X.cue(Math.max(2600, v8W(X, /vend|sort|perte|limit|fausse/, 0)), 'b');
    return `<svg class="v5-svg v8-stopl" viewBox="0 0 320 210">${v5Defs(X.id)}
      <g data-c="g" class="vgrid">${[30, 75, 120, 165].map(y => `<line x1="24" x2="296" y1="${y}" y2="${y}"/>`).join('')}</g>
      <g data-c="st"><line x1="24" x2="296" y1="${yT}" y2="${yT}" class="v8-lvl v8-stop"/>${v8Pill(294, yT + 18, 'Stop', 'bad', 'end')}</g>
      <g data-c="p"><path d="${v8D(A)}" class="vglw"/><path d="${v8D(A)}" class="vln vdr v8-price" pathLength="1" stroke="url(#${X.id}g)"/><circle cx="${ent[0].toFixed(1)}" cy="${ent[1]}" r="5" class="vdot"/></g>
      <g data-c="h"><circle cx="${hit[0].toFixed(1)}" cy="${hit[1].toFixed(1)}" r="9" class="v8-bad"/>${vend ? v8Pill(hit[0], hit[1] - 26, /automatiquement/.test(n) ? 'Vente automatique' : 'Vente', 'bad') : ''}</g>
      <g data-c="b"><path d="${v8D(B)}" class="v8-after"/><path d="M${(hit[0] + 26).toFixed(1)} ${yE} L${(hit[0] + 26).toFixed(1)} ${yT}" class="v8-brk"/>${/perte|limit|risque/.test(n) ? v8Pill(hit[0] + 32, (yE + yT) / 2, 'Perte limitée', 'sm', 'start') : ''}</g></svg>`; },
  /* obligation : un prêt, des coupons, le remboursement — seulement ce que dit la phrase */
  bond(X){ const n = norm(X.it.t), who = /etat/.test(n) && /entreprise/.test(n) ? 'État ou entreprise' : /etat/.test(n) ? 'État' : /entreprise/.test(n) ? 'Entreprise' : 'Émetteur', cp = /coupon|interets/.test(n), rb = /rembours|echeance/.test(n);
    const tL = v8W(X, /\bpret|preter/, 450), tC = v8W(X, /coupon|interets/, 1400), tB = v8W(X, /rembours|echeance/, 2200);
    X.cue(80, 'a'); X.cue(Math.min(tL, 900), 'l'); if (cp) [0, 1, 2, 3].forEach(i => X.cue(tC + i * 260, 'c' + i)); if (rb) X.cue(tB, 'b');
    const person = `<circle cx="58" cy="48" r="11" class="v8-ico"/><path d="M38 84 Q58 58 78 84" class="v8-ico"/>`, bank = `<path d="M232 54 L262 38 L292 54 Z M238 60 V82 M252 60 V82 M266 60 V82 M280 60 V82 M230 88 H294" class="v8-ico"/>`;
    return `<svg class="v5-svg v8-bond" viewBox="0 0 320 210">${v5Defs(X.id)}
      <g data-c="a">${person}<text x="58" y="104" text-anchor="middle" class="v8-t">Toi</text>${bank}<text x="262" y="106" text-anchor="middle" class="v8-t">${h(who)}</text></g>
      <g data-c="l"><path d="M92 64 L222 64" class="v8-arw vdr" pathLength="1"/><path d="M212 56 L223 64 L212 72" class="v8-arw vdr" pathLength="1"/>${v8Pill(157, 46, 'Prêt', 'hi')}</g>
      ${cp || rb ? `<g data-c="a"><line x1="40" x2="284" y1="160" y2="160" class="vax"/><text x="40" y="182" class="v8-t sm">Aujourd’hui</text>${rb ? `<text x="284" y="182" text-anchor="end" class="v8-t sm">Échéance</text>` : ''}</g>` : ''}
      ${cp ? [0, 1, 2, 3].map(i => `<g data-c="c${i}"><circle cx="${84 + i * 46}" cy="160" r="10" class="v8-coin"/><text x="${84 + i * 46}" y="164" text-anchor="middle" class="v8-coint">€</text></g>`).join('') + `<g data-c="c3">${v8Pill(153, 132, /coupon/.test(n) ? 'Coupons' : 'Intérêts', 'sm')}</g>` : ''}
      ${rb ? `<g data-c="b"><circle cx="270" cy="160" r="15" class="v8-coin big"/><text x="270" y="165" text-anchor="middle" class="v8-coint">€</text><path d="M262 108 Q200 122 76 112" class="v8-arw back vdr" pathLength="1"/>${v8Pill(196, 132, 'Remboursement', 'hi')}</g>` : ''}</svg>`; },
  /* taux en hausse → prix des obligations en baisse : une balançoire */
  rates(X){ const n = norm(X.it.t), right = /prix/.test(n) ? 'Prix des obligations' : 'Obligations', tU = v8W(X, /montent|hausse|augment|monte/, 900), tD = v8W(X, /baiss/, tU + 900);
    X.cue(80, 'a'); X.cue(tU, 'u'); X.cue(tU + 150, 'b1'); X.cue(Math.max(tU + 600, tD), 'd');
    return `<div class="v8-rates"><svg class="v5-svg" viewBox="0 0 320 210">${v5Defs(X.id)}
      <g data-c="a"><path d="M160 150 L144 178 L176 178 Z" class="v8-pivot"/><line x1="40" x2="280" y1="186" y2="186" class="vax"/></g>
      <g class="v8-plank"><line x1="44" x2="276" y1="150" y2="150" class="v8-beam"/><circle cx="60" cy="138" r="13" class="v8-end l"/><circle cx="260" cy="138" r="13" class="v8-end rr"/>
        <g class="v8-lab l">${v8Pill(66, 108, 'Taux', 'hi')}</g><g class="v8-lab rr">${v8Pill(254, 108, right, 'bad')}</g></g>
      <g data-c="u"><path d="M60 92 L60 66 M50 76 L60 64 L70 76" class="v8-up"/></g>
      <g data-c="d"><path d="M260 84 L260 110 M250 100 L260 112 L270 100" class="v8-dn"/></g></svg></div>`; },
  /* les frais freinent : deux courbes qui s'écartent */
  fees(X){ const n = norm(X.it.t), ex = /boule de neige|compos|temps|annees|long terme/.test(n), N = 30, A = [], B = [];
    for (let i = 0; i < N; i++){ const u = i / (N - 1), g1 = ex ? (Math.exp(2.2 * u) - 1) / (Math.exp(2.2) - 1) : u, g2 = ex ? (Math.exp(1.55 * u) - 1) / (Math.exp(2.2) - 1) : u * 0.62; A.push([28 + 260 * u, 176 - 136 * g1]); B.push([28 + 260 * u, 176 - 136 * g2]); }
    const gap = v8D(A) + ' ' + B.slice().reverse().map(p => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z', a = A[N - 1], b = B[N - 1], tF = v8W(X, /frais/, 1400);
    X.cue(0, 'g'); X.cue(250, 'p'); X.cue(Math.max(1600, tF), 'f'); X.cue(Math.max(2100, tF + 400), 'l');
    return `<svg class="v5-svg v8-fees" viewBox="0 0 320 210">${v5Defs(X.id)}
      <g data-c="g" class="vgrid">${[40, 85, 130].map(y => `<line x1="28" x2="288" y1="${y}" y2="${y}"/>`).join('')}<line x1="28" x2="288" y1="176" y2="176" class="vax"/></g>
      <g data-c="f"><path d="${gap}" class="v8-gap"/></g>
      <g data-c="p"><path d="${v8D(A)}" class="vglw"/><path d="${v8D(A)}" class="vln vdr" pathLength="1" stroke="url(#${X.id}g)"/><path d="${v8D(B)}" class="vln vdr v8-net" pathLength="1"/></g>
      <g data-c="l">${v8Pill(a[0] - 2, a[1] - 18, 'Sans frais', 'hi', 'end')}${v8Pill(b[0] - 2, b[1] + 22, 'Avec frais', 'bad', 'end')}<path d="M296 ${a[1].toFixed(1)} L296 ${b[1].toFixed(1)}" class="v8-brk"/><text x="300" y="${((a[1] + b[1]) / 2 + 4).toFixed(1)}" class="v8-t sm bad" text-anchor="start">Frais</text></g></svg>`; },
  /* émotions : posées sur un cycle de marché, au mot où elles sont dites */
  emo(X){ const n = norm(X.it.t), r = v5Rnd(v5Hash(X.it.t)), E = v8Emo(X.it.t), K = [[0, 132], [.16, 112], [.34, 40], [.48, 92], [.64, 170], [.82, 128], [1, 104]], P = v8Walk(K, r, 24, 296, 4, 3), sell = /panique/.test(n) && /vend/.test(n), rec = /temporaire|remont|reprise|rebond/.test(n);
    const top = [24 + 272 * 0.34, 40], bot = [24 + 272 * 0.64, 170], mid = [24 + 272 * 0.9, 116]; let ti = 0, bi = 0, mi = 0;
    X.cue(0, 'g'); X.cue(250, 'p');
    /* en haut : 1re au sommet, 2e à droite ; en bas : 1re au creux, 2e à gauche ; au milieu : empilées à droite */
    const labs = E.map((e, i) => { const at = e.p === 't' ? (ti++ ? [top[0] + 124, 22] : [top[0], 18]) : e.p === 'b' ? (bi++ ? [bot[0] - 128, 194] : [bot[0], 196]) : [mid[0], 64 + 28 * mi++]; X.cue(Math.max(600, v8W(X, e.re, 900 + i * 500)), 'e' + i);
      return `<g data-c="e${i}">${v8Pill(at[0], at[1], e.w, e.p === 't' ? 'hi' : e.p === 'b' ? 'bad' : 'sm')}</g>`; }).join('');
    const cut = P.findIndex(p => p[0] >= bot[0]);
    if (sell) X.cue(Math.max(1500, v8W(X, /vend/, 1500)), 'v');
    return `<svg class="v5-svg v8-emo" viewBox="0 0 320 210">${v5Defs(X.id)}
      <g data-c="g" class="vgrid">${[50, 100, 150].map(y => `<line x1="24" x2="296" y1="${y}" y2="${y}"/>`).join('')}</g>
      <g data-c="p">${sell ? `<path d="${v8D(P.slice(0, cut + 1))}" class="vglw"/><path d="${v8D(P.slice(0, cut + 1))}" class="vln vdr" pathLength="1" stroke="url(#${X.id}g)"/><path d="${v8D(P.slice(cut))}" class="${rec ? 'v8-after up' : 'v8-after'}"/>` : `<path d="${v8D(P)}" class="vglw"/><path d="${v8D(P)}" class="vln vdr" pathLength="1" stroke="url(#${X.id}g)"/>`}
        <circle cx="${top[0].toFixed(1)}" cy="${top[1]}" r="4" class="vdot"/><circle cx="${bot[0].toFixed(1)}" cy="${bot[1]}" r="4" class="vdot vdn"/></g>
      ${sell ? `<g data-c="v"><circle cx="${bot[0].toFixed(1)}" cy="${bot[1]}" r="10" class="v8-bad"/>${v8Pill(bot[0] + 14, bot[1] - 20, 'Vente', 'bad', 'start')}${rec ? v8Pill(272, 86, 'Reprise', 'sm', 'end') : ''}</g>` : ''}${labs}</svg>`; },
  /* une action = une part d'entreprise ; le dividende = une part du bénéfice versée aux actionnaires */
  share(X){ const n = norm(X.it.t), div = /dividende/.test(n), cols = 8, rows = 4, cw = 22, ch = 16, gx = 72, gy = 52, pick = 13;
    const tE = v8W(X, /entreprise|capital|societe/, 300), tP = v8W(X, /\bpart\b|morceau|fraction|actionnaire|coproprietaire|dividende/, 1200), tD = v8W(X, /verse|actionnaires/, tP + 800);
    X.cue(80, 'c'); X.cue(Math.min(tE, 700), 'g'); X.cue(Math.max(900, tP), 'k'); if (div) X.cue(Math.max(1500, tD), 'd');
    const cells = []; for (let i = 0; i < rows * cols; i++){ const x = gx + (i % cols) * (cw + 3), y = gy + Math.floor(i / cols) * (ch + 3); cells.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="3" class="v8-cell" style="--i:${i}"/>`); }
    const px = gx + (pick % cols) * (cw + 3), py = gy + Math.floor(pick / cols) * (ch + 3);
    return `<svg class="v5-svg v8-share" viewBox="0 0 320 210">${v5Defs(X.id)}
      <g data-c="c"><rect x="58" y="22" width="${cols * (cw + 3) + 25}" height="${rows * (ch + 3) + 48}" rx="16" class="v8-card"/><text x="72" y="42" class="v8-t">${div ? 'Entreprise · bénéfice' : 'Entreprise'}</text></g>
      <g data-c="g" class="v8-cells">${cells.join('')}</g>
      <g data-c="k"><rect x="${px - 2}" y="${py - 2}" width="${cw + 4}" height="${ch + 4}" rx="4" class="v8-mine"/>${div ? '' : v8Pill(px + cw / 2, py + ch + 70, /coproprietaire/.test(n) ? 'Copropriétaire' : 'Ta part', 'hi')}${div ? '' : `<path d="M${px + cw / 2} ${py + ch + 4} L${px + cw / 2} ${py + ch + 58}" class="v8-brk"/>`}</g>
      ${div ? `<g data-c="d"><circle cx="${px + cw / 2}" cy="${py + ch / 2}" r="5" class="v8-drop" style="--dy:${(166 - py - ch / 2).toFixed(1)}px"/><circle cx="${px + cw / 2}" cy="166" r="14" class="v8-coin big"/><text x="${px + cw / 2}" y="171" text-anchor="middle" class="v8-coint">€</text>${v8Pill(160, 198, /actionnaires/.test(n) ? 'Dividende → actionnaires' : 'Dividende', 'hi')}</g>` : ''}</svg>`; },
  /* le long terme : zoom arrière, une baisse passagère dans une hausse */
  horizon(X){ const r = v5Rnd(v5Hash(X.it.t) + 7), N = 90, P = []; let v = 0;
    for (let i = 0; i < N; i++){ const u = i / (N - 1); v = 0.12 + 0.72 * u + 0.05 * Math.sin(u * 19) + (r() - 0.5) * 0.05 - (u > 0.56 && u < 0.7 ? 0.16 * Math.sin((u - 0.56) / 0.14 * Math.PI) : 0); P.push([24 + 272 * u, 180 - 150 * Math.max(0, Math.min(1, v))]); }
    const a = Math.floor(N * 0.55), b = Math.floor(N * 0.71), seg = P.slice(a, b + 1), sx0 = seg[0][0], sx1 = seg[seg.length - 1][0], ys = seg.map(p => p[1]), sy0 = Math.min(...ys), sy1 = Math.max(...ys);
    const s = Math.min(272 / (sx1 - sx0), 120 / Math.max(10, sy1 - sy0)) * 0.9, tx = 160 - s * (sx0 + sx1) / 2, ty = 105 - s * (sy0 + sy1) / 2, tZ = v8W(X, /long|horizon|temps|annees|patience|plus l/, 1800);
    X.cue(0, 'g'); X.cue(200, 'p'); X.cue(Math.max(1500, tZ), 'b1');
    return `<svg class="v5-svg v8-hz" viewBox="0 0 320 210" style="--zt:translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${s.toFixed(3)})">${v5Defs(X.id)}<clipPath id="${X.id}k"><rect x="14" y="14" width="292" height="184" rx="14"/></clipPath>
      <g data-c="g"><rect x="14" y="14" width="292" height="184" rx="14" class="v8-frame"/></g>
      <g clip-path="url(#${X.id}k)"><g data-c="p" class="v8-zw"><g class="v8-zg"><path d="${v8D(P)} L296 200 L24 200 Z" fill="url(#${X.id}a)" class="v8-za"/><path d="${v8D(P)}" class="vglw v8-ns"/><path d="${v8D(P)}" class="vln v8-zl v8-ns" stroke="url(#${X.id}g)"/></g></g></g>
      <g class="v8-hzl"><g class="v8-c1">${v8Pill(160, 34, 'Court terme', 'bad')}</g><g class="v8-c2">${v8Pill(160, 34, 'Long terme', 'hi')}</g></g></svg>`; },
  /* bénéfice = ventes − charges */
  benef(X){ const n = norm(X.it.t), tC = v8W(X, /charges/, 1100), tB = v8W(X, /benefice|reste/, 600);
    X.cue(80, 'v'); X.cue(Math.max(700, tC), 'c'); X.cue(Math.max(tC + 500, tB, 1400), 'b');
    return `<svg class="v5-svg v8-benef" viewBox="0 0 320 210">${v5Defs(X.id)}<line x1="30" x2="290" y1="178" y2="178" class="vax"/>
      <g data-c="v"><rect x="44" y="40" width="62" height="138" rx="9" class="v8-bar w"/><text x="75" y="198" text-anchor="middle" class="v8-t">Ventes</text></g>
      <g data-c="c"><rect x="129" y="40" width="62" height="96" rx="9" class="v8-bar p"/><text x="160" y="198" text-anchor="middle" class="v8-t">Charges</text><path d="M106 40 L129 40" class="v8-brk"/>${/toutes/.test(n) ? `<text x="160" y="92" text-anchor="middle" class="v8-in">− toutes</text>` : ''}</g>
      <g data-c="b"><rect x="214" y="136" width="62" height="42" rx="9" fill="url(#${X.id}g)" class="v8-bar"/><text x="245" y="198" text-anchor="middle" class="v8-t">Bénéfice</text><path d="M191 136 L214 136" class="v8-brk"/>${v8Pill(245, 116, /reste/.test(n) ? 'Ce qui reste' : 'Bénéfice', 'hi')}</g></svg>`; },
  /* deux valeurs comparées */
  pair2(X){ const L = v8Pair(v5Clean(X.it.t)) || [], mx = Math.max(...L.map(x => x.v), 1e-9), y1 = 172, bw = 70, xs = [70, 180];
    L.forEach((x, i) => X.cue(Math.max(300 + i * 400, X.at(v5Wi(v5Clean(X.it.t), x.i)) - 80), i));
    const big = L.length === 2 ? (L[0].v > L[1].v ? 0 : L[1].v > L[0].v ? 1 : -1) : -1;
    return `<svg class="v5-svg v5-kv v8-pair" viewBox="0 0 320 210">${v5Defs(X.id)}<line x1="30" x2="290" y1="${y1}" y2="${y1}" class="vax"/>${L.map((x, i) => { const hh = Math.max(10, x.v / mx * 120); return `<g data-c="${i}"><rect x="${xs[i]}" y="${(y1 - hh).toFixed(1)}" width="${bw}" height="${hh.toFixed(1)}" rx="10" ${i === big && /frais|cout|risque/.test(norm(X.it.t)) ? 'class="vkvb v8-hi-bad"' : `fill="url(#${X.id}g)" class="vkvb"`}/>
      <text x="${xs[i] + bw / 2}" y="${(y1 - hh - 10).toFixed(1)}" text-anchor="middle" class="vkvv">${h(x.s)}</text><text x="${xs[i] + bw / 2}" y="${y1 + 20}" text-anchor="middle" class="vlab">${h(x.l)}</text></g>`; }).join('')}</svg>`; },
  /* signaux d'alerte, un par un */
  flags(X){ const F = v8Flags(X.it.t) || { head: '', items: [] }, s = v5Clean(X.it.t); let pos = 0;
    const tm = F.items.map(it => { const k = s.toLowerCase().indexOf(it.toLowerCase().slice(0, 12), pos); if (k >= 0) pos = k + 1; return k >= 0 ? X.at(v5Wi(s, k)) - 60 : null; });
    X.cue(80, 'h'); tm.forEach((t, i) => X.cue(t == null ? 500 + i * 450 : Math.max(300 + i * 150, t), i));
    return `<div class="v8-flags ${F.items.length > 4 ? 'many' : ''}"><div class="v8-fh" data-c="h">${h(v8Cap(F.head))}</div>${F.items.map((x, i) => `<div class="v8-fi" data-c="${i}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 L22 20 H2 Z" class="v8-tri"/><path d="M12 9 V14 M12 17 V17.2" class="v8-ex"/></svg><span>${h(x)}</span></div>`).join('')}</div>`; },
  /* une promesse entre guillemets, tamponnée « Arnaque » */
  scam(X){ const q = (v5Clean(X.it.t).match(/«\s?([^»]{4,60}?)\s?»/) || [])[1] || '', tq = v8W(X, /«|garanti|%/, 400), tA = v8W(X, /arnaque|escroc/, tq + 1400);
    X.cue(80, 'm'); X.cue(Math.min(tq, 900), 'q'); X.cue(Math.max(tA, 1500), 'a');
    return `<div class="v8-scam"><div class="v8-msg" data-c="m"><div class="v8-mh"><i></i><span>Nouveau message</span></div><p data-c="q">« ${h(q)} »</p></div><span class="v8-stamp" data-c="a">Arnaque</span></div>`; }
});

/* ---------- 3a. vitesse de lecture : 0,75× · 1× · 1,25× · 1,5× (gardée d'une vidéo à l'autre) ---------- */
NT_FX.vidspeed = NT_FX.vidspeed !== false;
NT_FX.vidcont = NT_FX.vidcont !== false;
const V8_SP = [0.75, 1, 1.25, 1.5];
function v8Speed(){ if (!NT_FX.vidspeed) return 1; let v = 1; try { v = Number(localStorage.getItem('nt-vspeed')) || 1; } catch(e){} return V8_SP.includes(v) ? v : 1; }
const v8Lab = v => String(v).replace('.', ',') + '×';
/* même programmation que V46, avec tous les temps divisés par la vitesse */
v6Sched = function(V, el, off){ const s = V.sc[V.i], my = V.tok = (V.tok || 0) + 1, rm = RM(), k = 1 / v8Speed(); clearTimeout(V.t); (V.wt || []).forEach(clearTimeout); V.wt = []; V.el = el; V.k = k; V.t0 = performance.now() - off;
  const T = (ms, f) => { ms *= k; if (ms < off) return; V.wt.push(setTimeout(() => { if (!M || M.vid !== V || V.tok !== my || V.paused) return; f(); }, rm ? 0 : ms - off)); };
  if (!rm){ v6Cues(s).forEach(([ms, c]) => T(ms, () => { if (c === 'rv' || c === 'b1'){ el.classList.add(c); if (c === 'rv') zChime(); V6P.cue(); return; }
      el.querySelectorAll(`[data-c="${c}"]`).forEach(x => { x.classList.add('on'); if (x.dataset.n) v5Count(x); }); V6P.cue(); }));
    let chimed = off > 0; s.times.forEach((ms, i) => T(ms, () => { el.querySelectorAll(`.w[data-i="${i}"]`).forEach(w => w.classList.add('on')); const w = el.querySelector(`.w[data-i="${i}"]`); if (!chimed && w && w.classList.contains('kw')){ chimed = true; zChime(); } })); }
  const seg = el.closest('.v5') && el.closest('.v5').querySelectorAll('.v5-seg > span')[V.i]; if (seg){ seg.style.setProperty('--ms', Math.round(s.ms * k) + 'ms'); const bar = seg.querySelector('i'); if (bar) bar.style.animationDelay = (-Math.round(off)) + 'ms'; seg.className = ''; void seg.offsetWidth; seg.className = 'cur'; }
  if (V.hold) return; V.t = setTimeout(() => { if (!M || M.vid !== V || V.tok !== my || V.paused) return; if (V.i >= V.sc.length - 1) return vidEnd(); V.i++; v5Run(); }, Math.max(0, s.ms * k - off)); };
const _v6PauseV46 = v6Pause; v6Pause = function(why){ _v6PauseV46(why); const V = M && M.vid; if (V && V.paused && V.t0 != null) V.off = Math.min(performance.now() - V.t0, V.sc[V.i].ms * (V.k || 1)); };
function v8SetSpeed(v){ try { localStorage.setItem('nt-vspeed', String(v)); } catch(e){} const V = M && M.vid, b = document.querySelector('.v8-spd'); if (b){ b.textContent = v8Lab(v); b.setAttribute('aria-label', 'Vitesse de lecture : ' + v8Lab(v)); }
  if (!V || !V.v5 || !V.el) return; const pos = (V.paused ? V.off : performance.now() - V.t0) / (V.k || 1), nk = 1 / v; if (V.paused){ V.off = pos * nk; V.k = nk; return; } v6Sched(V, V.el, pos * nk); }
const _v5ShellV46 = v5Shell; v5Shell = function(V){ _v5ShellV46(V); if (!NT_FX.vidspeed) return; const top = document.querySelector('#player .v5 .v5-top'); if (!top || top.querySelector('.v8-spd')) return;
  const b = document.createElement('button'); b.className = 'v8-spd'; b.type = 'button'; const v = v8Speed(); b.textContent = v8Lab(v); b.setAttribute('aria-label', 'Vitesse de lecture : ' + v8Lab(v)); b.title = 'Vitesse de lecture';
  b.addEventListener('click', e => { e.stopPropagation(); const c = v8Speed(), nx = V8_SP[(V8_SP.indexOf(c) + 1) % V8_SP.length]; v8SetSpeed(nx); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }); b.addEventListener('pointerup', () => setTimeout(() => b.blur(), 0)); top.appendChild(b); };
/* ---------- 3b. deux scènes liées s'enchaînent sur place (même graphique, même dessin) ---------- */
const V8_LINK = new Set(['chart', 'sr', 'stopl', 'fees', 'emo', 'horizon', 'ab', 'kv', 'pie', 'book', 'candle', 'share', 'bond', 'rates', 'benef', 'scale', 'infl']);
const v8IconKey = s => (String(s.viz).match(/<path d="([^"]{6,80})/) || [])[1] || '';
const _v5ShowV46 = v5Show; v5Show = function(V){ const prev = V.i > 0 ? V.sc[V.i - 1] : null, cur = V.sc[V.i], st0 = document.querySelector('#player .v5-stage'), old = st0 && st0.querySelector('.v5-sc:not(.out)');
  const el = _v5ShowV46(V); if (!el) return el; el.style.setProperty('--sms', Math.round(cur.ms / v8Speed()) + 'ms');
  const linked = NT_FX.vidcont && !RM() && prev && old && prev.tpl === cur.tpl && (V8_LINK.has(cur.tpl) || (cur.tpl === 'icon' && v8IconKey(prev) === v8IconKey(cur)));
  if (linked){ el.className = el.className.replace(/\bi-[a-z]+\b/, 'i-cont'); old.className = old.className.replace(/\bo-[a-z]+\b/, 'o-cont'); }
  return el; };
if (window.NT_DEBUG){ NT_DEBUG.v8speed = v => v8SetSpeed(v); NT_DEBUG.v8state = () => { const V = M && M.vid; return V ? { i: V.i, k: V.k, vitesse: v8Speed(), tr: (document.querySelector('#player .v5-sc:not(.out)') || {}).className } : null; }; }


/* ============================================================
   V49 — QUATRE SCHÉMAS DE PLUS POUR LES CHAPITRES LES PLUS FAIBLES (09/11/2026)
   Thomas : « alors tu peux » (proposition 1 : arnaques, enveloppes, bougies,
   plan de trading étaient encore surtout des dessins ou des cartes de texte).
   - env   : enveloppes (livret, PEA, PER, PEE, compte-titres, assurance-vie) :
             une boîte par enveloppe, ses règles qui s'allument au mot dit, le
             cadenas des années bloquées, la jauge d'impôt, l'éligibilité ;
   - verif : vérifier un acteur (REGAFI, ORIAS, listes noires), vérifier avant
             le dépôt, faux site à une lettre près, contact non sollicité, faux
             conseiller, publicité et influenceurs, courtier agréé ;
   - cdl2  : la bougie expliquée (anatomie, verte/rouge, marteau, étoile filante,
             doji, avalement, marteau sur support, volume) ;
   - plan  : plan de trading, journal, bilan, règle du 1 %, ratio gain/risque.
   Mêmes règles que V48 : les mots et les chiffres affichés viennent de la phrase
   (seule exception : les deux adresses du faux site, marquées « fictives ») ;
   seules les phrases qui n'avaient qu'un dessin, une carte, un graphique
   général, un nombre seul ou la bougie générique changent.
   Couleurs : bleu et violet partout ; vert et rouge seulement pour les bougies,
   parce que la phrase dit « verte » ou « rouge » (mêmes teintes que le site).
   Interrupteur : NT_FX.vidschema2 = false → schémas de V48.
   ============================================================ */
NT_FX.vidschema2 = NT_FX.vidschema2 !== false;
const V9_ENVW = 'livrets? r[ée]glement[ée]s?|livret a|livrets?|pea-pme|pea|per|pee|compte-titres|compte [àa] terme|assurance-vie|[ée]pargne salariale';
const V9_ENV = new RegExp(`^(?:${V9_ENVW})$`, 'i');
const V9_Q = '[’\']';
/* « a, b ; c » hors parenthèses et hors nombres (« 12,8 % ») */
function v9Split(s){ const out = []; let d = 0, cur = ''; s = String(s); for (let i = 0; i < s.length; i++){ const c = s[i]; if (c === '(') d++; else if (c === ')') d = Math.max(0, d - 1);
    if (!d && (c === ';' || (c === ',' && !(/\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || ''))))){ out.push(cur); cur = ''; continue; } cur += c; }
  out.push(cur); return out.map(x => x.trim().replace(/^(et|puis)\s/, '')).filter(Boolean); }
/* moment où un morceau de la phrase est dit */
const v9At = (X, sub, d, from = 0) => { const s = v5Clean(X.it.t), key = norm(String(sub || '')).replace(/[«»]/g, '').trim().slice(0, 14); if (!key) return d; const k = norm(s).indexOf(key, from); return k >= 0 ? Math.max(150, X.at(v5Wi(s, k)) - 60) : d; };
const v9Par = t => h(v5NBT(v8Cap(t))).replace(/\(([^)]*)\)/g, '<small>($1)</small>');
const v9Name = t => /^(pea|per|pee|pea-pme|ldds|lep)$/i.test(t) ? t.toUpperCase() : v8Cap(t);
const V9_IC = {
  env: '<path d="M3.5 6.5 H20.5 V18 H3.5 Z"/><path d="M3.5 6.5 L12 12.5 L20.5 6.5"/>',
  shield: '<path d="M12 3 L19 6 V11.5 C19 15.8 16 19 12 21 C8 19 5 15.8 5 11.5 V6 Z"/><path d="M9 12 L11.2 14.2 L15.2 10"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8.5 11 V7.5 A3.5 3.5 0 0 1 15.3 6.4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8.5 11 V7.5 A3.5 3.5 0 0 1 15.5 7.5 V11"/>',
  pct: '<path d="M6 18 L18 6"/><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/>',
  nofee: '<circle cx="12" cy="12" r="8.5"/><path d="M9 15 L15 9"/><circle cx="9.4" cy="9.4" r="1.1"/><circle cx="14.6" cy="14.6" r="1.1"/>',
  cap: '<path d="M4 5.5 H20"/><path d="M7.5 20 V10 M12 20 V8.5 M16.5 20 V12"/>',
  nocap: '<path d="M4 9 H8 M11 9 H13 M16 9 H20"/><path d="M12 20 V4 M8.5 7.5 L12 4 L15.5 7.5"/>',
  minus: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12 H16"/>',
  gift: '<circle cx="10" cy="8" r="3.2"/><path d="M4 19.5 C4.6 15.6 7 13.5 10 13.5 C13 13.5 15.4 15.6 16 19.5"/><path d="M18.5 7 V13 M15.5 10 H21.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11 V16.5 M12 7.8 V8"/>',
  chart: '<path d="M4 18 L9.5 12.5 L13 15.5 L20 8"/><path d="M15.5 8 H20 V12.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5 V12 L15 14"/>',
  check: '<path d="M5 12.5 L10 17 L19 7.5"/>',
  euro: '<path d="M17 7.2 A6.5 6.5 0 1 0 17 16.8"/><path d="M5 10.3 H13.5 M5 13.7 H13.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15 L20 20"/>',
  phone: '<path d="M6.5 3.5 H9.5 L11 8 L8.8 9.5 C9.8 11.8 12.2 14.2 14.5 15.2 L16 13 L20.5 14.5 V17.5 C20.5 19 19.2 20.5 17.5 20.3 C10.5 19.6 4.4 13.5 3.7 6.5 C3.5 4.8 5 3.5 6.5 3.5 Z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12 H20.5 M12 3.5 C9.5 6.5 9.5 17.5 12 20.5 M12 3.5 C14.5 6.5 14.5 17.5 12 20.5"/>',
  doc: '<path d="M6.5 3 H14.5 L18.5 7 V21 H6.5 Z"/><path d="M14.5 3 V7 H18.5 M9.5 12 H15.5 M9.5 15.5 H15.5"/>',
  book: '<path d="M4.5 5 C7.5 4 10 4.5 12 6 C14 4.5 16.5 4 19.5 5 V19 C16.5 18 14 18.5 12 20 C10 18.5 7.5 18 4.5 19 Z"/><path d="M12 6 V20"/>',
  tri: '<path d="M12 3.5 L21.5 20 H2.5 Z"/><path d="M12 10 V14.5 M12 17.2 V17.4"/>',
  flag: '<path d="M6 21 V4"/><path d="M6 4.5 H18 L15.5 8.5 L18 12.5 H6"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6 L18 18"/>',
  x: '<path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5"/>',
  dot: '<circle cx="12" cy="12" r="3"/>'
};
const v9Ic = (k, cls = '') => `<svg class="v9-ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${V9_IC[k] || V9_IC.dot}</svg>`;
const v9IcAt = (k, x, y, s, cls = '') => `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 24 24" class="v9-ics ${cls}">${V9_IC[k] || V9_IC.dot}</svg>`;

/* ---------- 1. lecture des phrases ---------- */
const v9RIco = n => /garanti/.test(n) ? 'shield' : /disponible/.test(n) ? 'unlock' : /exoner|avantage fiscal/.test(n) ? 'nofee' : /sans plafond/.test(n) ? 'nocap' : /plafond/.test(n) ? 'cap' : /prelevement|impot|tax|flat/.test(n) ? 'pct' : /abattement|deductible/.test(n) ? 'minus' : /abonde|employeur/.test(n) ? 'gift' : /\bsauf\b|deblocage/.test(n) ? 'info' : /actions?\b|\btout\b|obligation|fonds/.test(n) ? 'chart' : /\bans?\b/.test(n) ? 'clock' : 'check';
/* impôt : « flat tax de 31,4 % (12,8 % d'impôt + 18,6 % de prélèvements sociaux) », « gains taxés à 31,4 % » */
function v9Tax(p){ const tot = String(p).match(new RegExp(`(?:flat tax de|tax[ée]s? à)\\s(${V5_NUM})\\s?%`, 'i')); if (!tot) return null; const T = v5Val(tot[1]); if (!(T > 0 && T < 100)) return null;
  const parts = [...String(p).matchAll(new RegExp(`(${V5_NUM})\\s?% (d[e’'] ?[^+)]+)`, 'g'))].map(x => ({ v: v5Val(x[1]), l: (x[1].trim() + ' % ' + x[2]).trim() })), ok = parts.length >= 2 && Math.abs(parts.reduce((a, x) => a + x.v, 0) - T) < 0.05;
  return { tot: tot[1].trim() + ' %', v: T, parts: ok ? parts : [], gains: /\bgains?\b/i.test(p) }; }
function v9Rules(rest){ let lock = null, tax = null; const props = [];
  v9Split(rest).forEach(p0 => { const p = p0.replace(/^argent\s/i, ''), tx = !tax && v9Tax(p);
    if (tx){ tax = Object.assign(tx, { src: p0, head: tx.parts.length ? p.replace(/\s*\([^)]*\)/g, '') : p }); return; }
    const lk = !lock && p.match(new RegExp(`^(après \\d+ ans|bloqué (?:\\d+ ans|jusqu${V9_Q}à la retraite))(?:,?\\s(.+))?$`, 'i'));
    if (lk){ lock = { lab: v8Cap(lk[1]), open: /^après/i.test(lk[1]), src: p0 }; if (lk[2]) props.push({ t: lk[2], src: lk[2], ico: v9RIco(norm(lk[2])) }); return; }
    props.push({ t: p, src: p0, ico: v9RIco(norm(p)) }); });
  return { lock, tax, props }; }
function v9Env(t){ const s = v5Clean(t).replace(/[.…]+$/, ''), n = norm(s); let m;
  /* éligibilité : refusé, accepté, n'existe qu'en… */
  if ((m = s.match(new RegExp(`^(?:Les |Le |La |L${V9_Q})?(.{3,40}?) (?:ne sont pas|n${V9_Q}est pas) (éligibles? (?:au |à l${V9_Q}|à la )(${V9_ENVW})(?: .{0,30})?)$`, 'i')))) return { k: 'elig', name: m[3], ok: [], no: v8Cap(m[1]), lab: 'Pas ' + m[2], src: m[2] };
  if ((m = s.match(new RegExp(`^(.{3,30}?) \\+ (.{3,30}?) : (.{3,40}?(?:du |de l${V9_Q}|de la )(${V9_ENVW}))$`, 'i')))) return { k: 'elig', name: m[4], ok: [v8Cap(m[1]), v8Cap(m[2])], no: null, lab: v8Cap(m[3]), src: m[3] };
  if ((m = s.match(new RegExp(`^(?:Le |La |Les |L${V9_Q})?(.{3,30}?) (n${V9_Q}existe qu${V9_Q}en (${V9_ENVW}))$`, 'i')))) return { k: 'elig', name: m[3], ok: [v8Cap(m[1])], no: null, lab: v8Cap(m[2]), src: m[2] };
  if ((m = s.match(new RegExp(`^L${V9_Q}(${V9_ENVW}) offre (?:un |une )?(.{6,60})$`, 'i')))) return { k: 'box', boxes: [{ name: m[1], off: 0, props: [{ t: m[2], src: m[2], ico: 'check' }] }] };
  if ((m = s.match(new RegExp(`^Le (taux) des (${V9_ENVW}) est (.{6,50})$`, 'i')))) return { k: 'box', boxes: [{ name: m[2], off: 0, props: [{ t: m[1] + ' ' + m[3], src: m[3], ico: 'pct' }] }] };
  if (/compte-titres/.test(n) && !/ : /.test(s)){ const tx = v9Tax(s); if (tx) return { k: 'box', boxes: [{ name: 'compte-titres', off: 0, props: [], tax: Object.assign(tx, { src: 'flat tax', head: 'Flat tax de ' + tx.tot }) }] }; }
  /* définitions « NOM : règles. NOM : règles. » */
  const segs = s.split(/\.\s(?=[A-ZÀ-Ý])/), defs = []; let pos = 0, bad = false;
  segs.forEach(sg => { const off = s.indexOf(sg, pos); pos = off + sg.length; const k = sg.indexOf(' : '), names = k > 0 ? sg.slice(0, k).split(/,\s/).map(x => x.trim()) : null;
    if (names && names.every(x => V9_ENV.test(x))) defs.push({ names, rest: sg.slice(k + 3), off: off + k + 3, noff: off }); else if (sg.length > 40 || !defs.length) bad = true; });
  if (bad || !defs.length) return null;
  if (defs.length === 1 && defs[0].names.length >= 3) return defs[0].names.length <= 6 ? { k: 'list', names: defs[0].names, tail: defs[0].rest } : null;
  const boxes = []; defs.forEach(d => d.names.forEach(nm => boxes.push(Object.assign({ name: nm, off: d.off, noff: d.noff }, v9Rules(d.rest)))));
  return boxes.length && boxes.length <= 2 && boxes.every(b => b.props.length + (b.lock ? 1 : 0) + (b.tax ? 1 : 0) >= 1 && b.props.length + (b.lock ? 1 : 0) + (b.tax ? 1 : 0) <= 4 && b.props.every(p => p.t.length <= 90)) ? { k: 'box', boxes } : null; }
function v9Verif(t){ const s = v5Clean(t).replace(/[.…]+$/, ''), n = norm(s); let m;
  if ((m = s.match(/^(V[ée]rifier[^:]{0,30}) : (.+)$/))){ const it = v9Split(m[2]); if (it.length >= 2 && it.length <= 5 && it.every(x => x.length <= 34)) return { k: 'reg', head: m[1], items: it }; }
  if (/verifier avant (tout )?depot/.test(n)) return { k: 'gate', bl: /listes? noires?/.test(n) };
  if (/faux sites?/.test(n) && /lettre/.test(n)) return { k: 'url' };
  if (/contact non sollicite/.test(n)) return { k: 'call', al: /signal d.alerte/.test(n), maj: /majeur/.test(n) };
  if (/faux conseiller/.test(n) && /virement/.test(n)){ const q = s.match(/«\s?([^»]{2,30}?)\s?»/); return { k: 'msg', from: 'Conseiller' + (q ? ' « ' + q[1] + ' »' : ''), body: 'Demande un virement', stamp: /arnaque/.test(n) }; }
  if (/^payer pour recuperer son argent/.test(n)) return { k: 'msg', from: null, body: 'Payer pour récupérer son argent', stamp: /arnaque/.test(n) };
  if (/usurpent le nom/.test(n) && /recuperer/.test(n)) return { k: 'msg', from: 'Nom d’une vraie entreprise ou de l’AMF', tag: 'Usurpé', body: '« Récupérer » l’argent perdu', sub: /contre des frais/.test(n) ? 'Contre des frais' : null, stamp: /arnaque/.test(n) };
  if (/influenceur/.test(n) && /encadre/.test(n)) return { k: 'ad', m: 'law', yr: (s.match(/loi de (\d{4})/) || [])[1] || null, what: /produits financiers/.test(n) ? 'Promotion de produits financiers' : 'Promotion' };
  if ((m = s.match(/^La (publicité|promotion) de certains (produits .{4,40}?) est interdite$/i))) return { k: 'ad', m: 'ban', what: v8Cap(m[1]) + ' · ' + m[2] };
  if (/mention de publicite est obligatoire/.test(n)) return { k: 'ad', m: 'tag' };
  if (/gains spectaculaires/.test(n) && /drapeau rouge/.test(n)) return { k: 'ad', m: 'flag', sr: /sans risques?/.test(n) };
  if (/courtier agree/.test(n) && /intermediaire/.test(n)) return { k: 'broker', never: /jamais/.test(n) };
  return null; }
function v9CdlMode(n){
  if (/resume une periode/.test(n) && /ouverture/.test(n) && /cloture/.test(n)) return 'anat';
  if (/^(verte|rouge)\s?[:=]/.test(n)) return 'color';
  if (/^marteau \(/.test(n) && /etoile filante/.test(n) && /doji/.test(n)) return 'figs';
  if (/^marteau :/.test(n) && /vendeurs/.test(n)) return 'hammer';
  if (/^etoile filante :/.test(n) && /monte/.test(n)) return 'star';
  if (/marteau sur un support/.test(n)) return 'hsup';
  if (/\bdoji\b/.test(n) && /indecision/.test(n) && !/,.*,/.test(n)) return 'doji';
  if (/grande bougie (rouge|verte) avale la (verte|rouge)/.test(n)) return 'engulf';
  if (/\d+ fois le volume moyen/.test(n)) return 'volx';
  if (/^le volume = |volume = nombre/.test(n)) return 'vol';
  if (/beaucoup (de volume|d.echanges)/.test(n) && /participation/.test(n)) return 'volp';
  return null; }
function v9Plan(t){ const s = v5Clean(t).replace(/[.…]+$/, ''), n = norm(s); let m;
  if ((m = s.match(/^Un plan( écrit)? répond à : (.+)$/i))){ const it = v9Split(m[2]); if (it.length >= 3 && it.length <= 8 && it.every(x => x.length <= 40)) return { k: 'sheet', title: m[1] ? 'Plan écrit' : 'Plan', items: it }; }
  if ((m = s.match(/^Plan : (.+)$/))){ const it = v9Split(m[1]); if (it.length >= 2 && it.length <= 6 && it.every(x => x.length <= 46)) return { k: 'sheet', title: 'Plan', items: it }; }
  if ((m = s.match(/^Le journal note chaque trade : (.+)$/i))){ const it = v9Split(m[1]); if (it.length >= 3 && it.length <= 6 && it.every(x => x.length <= 10)) return { k: 'journal', cols: it }; }
  if (/bilan hebdomadaire/.test(n) && /erreurs/.test(n)) return { k: 'review' };
  if (/^on ecrit une regle contre chacun/.test(n)) return { k: 'rules' };
  if ((m = s.match(new RegExp(`^Gain (${V5_NUM}) ?€, risque (${V5_NUM}) ?€ : ratio (${V5_NUM})$`)))){ const g = v5Val(m[1]), r = v5Val(m[2]); if (g > 0 && r > 0 && g / r <= 6) return { k: 'rr', g: m[1], r: m[2], q: m[3] }; }
  if (/du capital/.test(n) && (/risquer/.test(n) || /^exemple :/.test(n)) && (m = s.match(new RegExp(`(${V5_NUM}) ?%`)))){ const mx = s.match(new RegExp(`au maximum (${V5_NUM}) ?%`)), pv = v5Val(m[1]), mv = mx ? v5Val(mx[1]) : 0;
    if (pv >= 1 && pv <= 10 && Number.isInteger(pv) && (!mx || Number.isInteger(mv) && mv > pv && mv <= 10)) return { k: 'risk', p: m[1], max: mx ? mx[1] : null, par: /par trade/.test(n) }; }
  return null; }
function v9Pick(it){ const t = v5Clean(it.t || ''), n = norm(t);
  if (v9CdlMode(n)) return 'cdl2'; if (v9Plan(t)) return 'plan'; if (v9Verif(t)) return 'verif'; if (v9Env(t)) return 'env'; return null; }
/* seulement si V48 n'a rien trouvé de mieux qu'un dessin, une carte, un graphique général, un nombre ou la bougie générique */
const _v5PickV48 = v5Pick; v5Pick = function(it){ const b = _v5PickV48(it); if (!it.tpl && NT_FX.vidschema2 && V8_BASE.has(b)){ const k = v9Pick(it); if (k) return k; } return b; };
['env', 'cdl2', 'plan'].forEach(k => V8_LINK.add(k));

/* ---------- 2. les schémas ---------- */
const v9Cd = (x, o, c, hi, lo, w = 22) => `<g class="v9-cd ${c <= o ? 'up' : 'dn'}"><line x1="${x}" x2="${x}" y1="${hi}" y2="${lo}" class="v9-wk"/><rect x="${x - w / 2}" y="${Math.min(o, c)}" width="${w}" height="${Math.max(2, Math.abs(o - c))}" rx="${Math.min(4, w / 6).toFixed(1)}" class="v9-bd"/></g>`;
const v9Grid = (ys = [40, 85, 130, 175]) => `<g data-c="g" class="vgrid">${ys.map(y => `<line x1="24" x2="296" y1="${y}" y2="${y}"/>`).join('')}</g>`;
const v9Arw = (x, y1, y2, cls = '') => { const d = y2 < y1 ? 8 : -8; return `<path d="M${x} ${y1} L${x} ${y2} M${x - 6} ${y2 + d} L${x} ${y2} L${x + 6} ${y2 + d}" class="v9-ar2 ${cls}"/>`; };
Object.assign(V5T, {
  /* enveloppes : une boîte, ses règles, son cadenas, son impôt */
  env(X){ const E = v9Env(X.it.t) || { k: 'box', boxes: [] };
    if (E.k === 'list'){ E.names.forEach((nm, i) => X.cue(Math.max(150 + i * 180, v9At(X, nm, 300 + i * 300)), 'n' + i)); X.cue(Math.max(400 + E.names.length * 200, v9At(X, E.tail, 1800)), 'tl');
      return `<div class="v9-env ls"><div class="v9-tiles">${E.names.map((nm, i) => `<div class="v9-tile" data-c="n${i}">${v9Ic('env')}<b>${h(v9Name(nm))}</b></div>`).join('')}</div><div class="v9-tail" data-c="tl">${h(v8Cap(E.tail))}</div></div>`; }
    if (E.k === 'elig'){ X.cue(80, 'bx0'); E.ok.forEach((x, i) => X.cue(Math.max(400 + i * 300, v9At(X, x, 600 + i * 500)), 'o' + i)); if (E.no) X.cue(Math.max(450, v9At(X, E.no, 600)), 'rj'); if (E.lab) X.cue(Math.max(E.no ? 1100 : 900, v9At(X, E.src, 1400)), 'tl');
      return `<div class="v9-env el"><div class="v9-box" data-c="bx0"><div class="v9-bh">${v9Ic('env')}<b>${h(v9Name(E.name))}</b></div><div class="v9-in">${E.ok.map((x, i) => `<div class="v9-pr ok" data-c="o${i}">${v9Ic('check')}<span>${h(x)}</span></div>`).join('')}${E.ok.length ? '' : '<i class="v9-slot"></i>'}</div></div>${E.no ? `<div class="v9-rej" data-c="rj">${v9Ic('x')}<span>${h(E.no)}</span></div>` : ''}${E.lab ? `<div class="v9-tail ${E.no ? 'bad' : ''}" data-c="tl">${h(v5NBT(E.lab))}</div>` : ''}</div>`; }
    const html = E.boxes.map((b, bi) => { const tb = bi ? Math.max(900, v9At(X, b.name, 1300, b.noff || 0)) : 80, from = b.off || 0; X.cue(tb, 'bx' + bi);
      if (b.lock) X.cue(Math.max(tb + 250, v9At(X, b.lock.src, tb + 500, from)), 'k' + bi);
      b.props.forEach((p, i) => X.cue(Math.max(tb + 350 + i * 220, v9At(X, p.src, tb + 800 + i * 450, from)), `p${bi}_${i}`));
      if (b.tax) X.cue(Math.max(tb + 500, v9At(X, b.tax.src, tb + 1000, from)), 'tx' + bi);
      const T = b.tax, tax = T ? `<div class="v9-tax" data-c="tx${bi}"><div class="v9-th2">${v9Ic('pct')}<span>${v9Par(T.head)}</span></div><div class="v9-tbar">${(T.parts.length ? T.parts : [{ v: T.v }]).map((p, i) => `<i class="s${i}" style="--w:${p.v}%"></i>`).join('')}${T.gains ? '<em>Gains</em>' : ''}</div>${T.parts.length ? `<div class="v9-tleg">${T.parts.map((p, i) => `<span class="s${i}">${h(v5NBT(p.l))}</span>`).join('<b>+</b>')}<b>= ${h(v5NBT(T.tot))}</b></div>` : ''}</div>` : '';
      return `<div class="v9-box" data-c="bx${bi}"><div class="v9-bh">${v9Ic('env')}<b>${h(v9Name(b.name))}</b></div>${b.lock ? `<div class="v9-lock ${b.lock.open ? 'op' : ''}" data-c="k${bi}"><span class="v9-lki">${v9Ic('lock', 'lk')}${v9Ic('unlock', 'ul')}</span><i class="v9-trk"><i></i></i><span>${h(b.lock.lab)}</span></div>` : ''}${b.props.map((p, i) => `<div class="v9-pr" data-c="p${bi}_${i}">${v9Ic(p.ico)}<span>${v9Par(p.t)}</span></div>`).join('')}${tax}</div>`; }).join('');
    return `<div class="v9-env n${E.boxes.length}">${html}</div>`; },
  /* vérifier un acteur, repérer un faux */
  verif(X){ const V = v9Verif(X.it.t) || { k: 'call' }, W = re => X.wAt(re);
    if (V.k === 'reg'){ X.cue(80, 'h'); V.items.forEach((x, i) => X.cue(Math.max(350 + i * 260, v9At(X, x, 600 + i * 500)), 'i' + i));
      return `<div class="v9-reg"><div class="v9-rh" data-c="h">${v9Ic('search')}<span>${h(v8Cap(V.head))}</span></div>${V.items.map((x, i) => `<div class="v9-ri" data-c="i${i}"><span class="v9-mg">${v9Ic('search')}</span><b>${h(v5NBT(v8Cap(x)))}</b><svg class="v9-ok" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7 12.5 L10.5 16 L17 9" class="vdr" pathLength="1"/></svg></div>`).join('')}</div>`; }
    if (V.k === 'gate'){ const tv = Math.max(200, W(/verifier/)), tA = Math.max(tv + 500, W(/avant/)), tD = Math.max(tA + 300, W(/depot/)); X.cue(80, 'a'); X.cue(tv + 150, 'ok'); X.cue(tA, 'ar'); X.cue(tD, 'd'); X.cue(tD + 800, 'u'); if (V.bl) X.cue(Math.max(tD + 500, W(/noires/)), 'l');
      return `<div class="v9-gate"><div class="v9-st" data-c="a"><span class="v9-n">1</span>${v9Ic('search')}<b>Vérifier</b><span class="v9-ck" data-c="ok">${v9Ic('check')}</span></div><div class="v9-ar" data-c="ar"><i></i><span>Avant</span></div><div class="v9-st b" data-c="d"><span class="v9-n">2</span>${v9Ic('euro')}<b>Dépôt</b><span class="v9-lk2">${v9Ic('lock')}<span class="v9-ul2" data-c="u">${v9Ic('unlock')}</span></span></div>${V.bl ? `<div class="v9-tail v9-sub" data-c="l">${v9Ic('search')}<span>Et consulter les listes noires</span></div>` : ''}</div>`; }
    if (V.k === 'url'){ X.cue(80, 'a'); X.cue(Math.max(700, W(/faux/)), 'f'); X.cue(Math.max(1500, W(/lettre/)), 'd');
      return `<div class="v9-url"><div class="v9-ub" data-c="a"><span class="v9-ul">Vrai site</span><div class="v9-bar">${v9Ic('globe')}<span>www.courtier-exemple.fr</span></div></div><div class="v9-ub bad" data-c="f"><span class="v9-ul">Faux site</span><div class="v9-bar">${v9Ic('globe')}<span>www.court<b class="v9-diff">l<i class="v9-ring" data-c="d"></i></b>er-exemple.fr</span></div></div><div class="v9-tail bad" data-c="d">À une lettre près</div><small class="v9-fict" data-c="a">Adresses fictives</small></div>`; }
    if (V.k === 'call'){ X.cue(80, 'a'); X.cue(Math.max(450, W(/contact|sollicite/)), 'b'); if (V.al) X.cue(Math.max(1200, W(/signal|alerte/)), 'c');
      return `<div class="v9-call"><div class="v9-ph" data-c="a"><i class="v9-rg"></i><i class="v9-rg r2"></i>${v9Ic('phone')}</div><div class="v9-tail" data-c="b">Contact non sollicité</div>${V.al ? `<div class="v9-al" data-c="c">${v9Ic('tri')}<span>Signal d’alerte${V.maj ? ' majeur' : ''}</span></div>` : ''}</div>`; }
    if (V.k === 'msg'){ const tq = Math.max(450, W(/virement|payer|recuperer/)), ta = Math.max(tq + 900, W(/arnaque/)); X.cue(80, 'm'); X.cue(tq, 'q'); if (V.sub) X.cue(Math.max(tq + 700, W(/frais/)), 'f'); if (V.stamp) X.cue(ta, 'st');
      return `<div class="v8-scam v9-msg"><div class="v8-msg" data-c="m"><div class="v8-mh"><i></i><span>${h(V.from || 'Nouveau message')}</span>${V.tag ? `<em class="v9-us">${h(V.tag)}</em>` : ''}</div><p data-c="q">${h(V.body)}</p>${V.sub ? `<div class="v9-due" data-c="f">${v9Ic('euro')}<span>${h(V.sub)}</span></div>` : ''}</div>${V.stamp ? '<span class="v8-stamp" data-c="st">Arnaque</span>' : ''}</div>`; }
    if (V.k === 'ad'){ X.cue(80, 'a'); let inP = '', below = '', cap = V.what || '';
      if (V.m === 'law'){ X.cue(Math.max(900, W(/encadree/)), 'f'); inP = '<i class="v9-frame" data-c="f"></i>'; below = `<div class="v9-tail" data-c="f">Encadrée</div>${V.yr ? `<div class="v9-yr" data-c="y">Loi de ${h(V.yr)} sur les influenceurs</div>` : ''}`; if (V.yr) X.cue(Math.max(500, W(/loi/)), 'y'); }
      if (V.m === 'ban'){ X.cue(Math.max(1000, W(/interdite/)), 'x'); inP = `<span class="v9-ban" data-c="x">${v9Ic('ban')}</span>`; below = '<div class="v9-tail bad" data-c="x">Interdite</div>'; }
      if (V.m === 'tag'){ X.cue(Math.max(600, W(/publicite/)), 't'); X.cue(Math.max(1100, W(/obligatoire/)), 'o'); below = '<div class="v9-tail" data-c="o">Mention obligatoire</div>'; }
      if (V.m === 'flag'){ X.cue(Math.max(300, W(/spectaculaires/)), 'gs'); if (V.sr) X.cue(Math.max(800, W(/risques?$/)), 's'); X.cue(Math.max(1300, W(/drapeau/)), 'x'); below = `<div class="v9-tail bad" data-c="x">${v9Ic('flag')}<span>Drapeau rouge</span></div>`; }
      const big = V.m === 'flag';
      return `<div class="v9-ad"><div class="v9-post" data-c="a"><div class="v9-pt"><i class="v9-av"></i>${V.m === 'law' ? '<span>Influenceur</span>' : '<i class="v9-sk"></i>'}${V.m === 'tag' ? '<em class="v9-ptag" data-c="t">Publicité</em>' : ''}</div><div class="v9-img"><svg viewBox="0 0 276 96" preserveAspectRatio="none" aria-hidden="true"><path d="${big ? 'M8 88 C90 86 170 66 268 10' : 'M8 72 L52 60 L92 68 L136 46 L178 54 L220 32 L268 38'}" class="v9-pl2 vdr" pathLength="1"/></svg>${big ? '<b class="v9-big" data-c="gs">Gains spectaculaires</b>' : ''}</div>${cap ? `<p>${h(cap)}</p>` : ''}${V.sr ? '<em class="v9-srk" data-c="s">Sans risques</em>' : ''}${inP}</div>${below}</div>`; }
    if (V.k === 'broker'){ X.cue(80, 'a'); X.cue(Math.max(300, W(/bourse/)), 'z'); if (V.never) X.cue(Math.max(700, W(/jamais/) + 250), 'nv'); X.cue(Math.max(1200, W(/courtier/)), 'c'); X.cue(Math.max(1700, W(/intermediaire/)), 'r');
      return `<svg class="v5-svg v9-brk" viewBox="0 0 320 210">${v5Defs(X.id)}
        <g data-c="a"><circle cx="44" cy="92" r="11" class="v8-ico"/><path d="M24 128 Q44 100 64 128" class="v8-ico"/><text x="44" y="152" text-anchor="middle" class="v8-t">Toi</text></g>
        <g data-c="z"><path d="M248 98 L276 82 L304 98 Z M254 104 V124 M267 104 V124 M281 104 V124 M294 104 V124 M246 130 H306" class="v8-ico"/><text x="276" y="152" text-anchor="middle" class="v8-t">Bourse</text></g>
        ${V.never ? `<g data-c="nv"><path d="M66 80 Q160 14 246 80" class="v9-nope"/><circle cx="157" cy="48" r="11" class="v8-bad"/><path d="M152 43 L162 53 M162 43 L152 53" class="v8-badx"/></g>` : ''}
        <g data-c="c"><rect x="124" y="84" width="72" height="50" rx="14" class="v9-bk"/>${v9IcAt('shield', 146, 95, 28, 'v9-sh2')}<text x="160" y="152" text-anchor="middle" class="v8-t">Courtier agréé</text></g>
        <g data-c="r"><path d="M72 110 L116 110 M108 103 L117 110 L108 117" class="v8-arw"/><path d="M204 110 L240 110 M232 103 L241 110 L232 117" class="v8-arw"/>${v8Pill(160, 184, 'Intermédiaire', 'hi')}</g></svg>`; }
    return ''; },
  /* la bougie expliquée */
  cdl2(X){ const n = norm(v5Clean(X.it.t)), m = v9CdlMode(n) || 'anat', id = X.id, W = re => X.wAt(re), svg = inner => `<svg class="v5-svg v9-cdl" viewBox="0 0 320 210">${v5Defs(id)}${inner}</svg>`;
    if (m === 'anat'){ const O = 140, C = 64, HI = 30, LO = 178, cx = 204, L = [[28, 140], [44, 150], [62, LO], [78, 152], [94, 124], [110, 100], [128, HI], [142, 56], [158, C]], tc = Math.max(1300, W(/resume|periode/));
      X.cue(0, 'g'); X.cue(150, 'l'); X.cue(tc, 'c'); const lab = (k, re, d) => X.cue(Math.max(tc + 250, W(re) > 0 ? W(re) : d), k);
      lab('o', /^ouverture/, tc + 600); lab('k', /^cloture/, tc + 1000); lab('h', /^haut/, tc + 1400); lab('w', /^bas\b/, tc + 1800); if (/corps/.test(n)) lab('co', /corps/, tc + 2000); if (/meches/.test(n)) lab('me', /meches/, tc + 2400);
      return svg(`${v9Grid()}<g data-c="l"><path d="${v8D(L)}" class="vglw"/><path d="${v8D(L)}" class="vln vdr" pathLength="1" stroke="url(#${id}g)"/><circle cx="28" cy="140" r="3.5" class="vdot"/></g>
        <g data-c="c" class="v9-grow">${v9Cd(cx, O, C, HI, LO, 30)}</g>
        <g data-c="o"><line x1="32" x2="${cx - 16}" y1="${O}" y2="${O}" class="v9-gd"/>${v8Pill(226, O, 'Ouverture', '', 'start')}</g>
        <g data-c="k"><line x1="162" x2="${cx - 16}" y1="${C}" y2="${C}" class="v9-gd"/>${v8Pill(226, C, 'Clôture', '', 'start')}</g>
        <g data-c="h"><line x1="132" x2="${cx - 3}" y1="${HI}" y2="${HI}" class="v9-gd"/>${v8Pill(226, HI, 'Plus haut', '', 'start')}</g>
        <g data-c="w"><line x1="66" x2="${cx - 3}" y1="${LO}" y2="${LO}" class="v9-gd"/>${v8Pill(226, LO, 'Plus bas', '', 'start')}</g>
        ${/corps/.test(n) ? `<g data-c="co"><rect x="${cx - 19}" y="${C - 4}" width="38" height="${O - C + 8}" rx="7" class="v9-hl"/>${v8Pill(cx - 24, 110, 'Le corps', 'hi', 'end')}</g>` : ''}
        ${/meches/.test(n) ? `<g data-c="me"><line x1="${cx}" x2="${cx}" y1="${HI}" y2="${C}" class="v9-hlw"/><line x1="${cx}" x2="${cx}" y1="${O}" y2="${LO}" class="v9-hlw"/>${v8Pill(cx - 24, 160, 'Les mèches', 'hi', 'end')}</g>` : ''}`); }
    if (m === 'color'){ const sg = /verte/.test(n), sr = /rouge|en dessous/.test(n), both = (sg && sr) || (!sg && !sr), G = { x: 108, o: 150, c: 70, hi: 48, lo: 170 }, R = { x: 212, o: 70, c: 150, hi: 52, lo: 176 };
      const tg = sg ? Math.max(100, W(/verte/)) : 100, tr = sr ? Math.max(100, W(/rouge/)) : 100; X.cue(0, 'g'); X.cue(tg, 'v'); X.cue(tg + 500, 'vl'); X.cue(tr, 'r'); X.cue(tr + 500, 'rl');
      return svg(`${v9Grid()}
        <g class="${!both && !sg ? 'v9-dim' : ''}"><g data-c="v" class="v9-grow">${v9Cd(G.x, G.o, G.c, G.hi, G.lo, 34)}</g><g data-c="vl">${v9Arw(G.x, 136, 86)}${v8Pill(G.x - 26, G.c, 'Clôture', '', 'end')}${v8Pill(G.x - 26, G.o, 'Ouverture', '', 'end')}<text x="${G.x}" y="198" text-anchor="middle" class="v9-nm up">Verte</text></g></g>
        <g class="${!both && !sr ? 'v9-dim' : ''}"><g data-c="r" class="v9-grow">${v9Cd(R.x, R.o, R.c, R.hi, R.lo, 34)}</g><g data-c="rl">${v9Arw(R.x, 84, 134)}${v8Pill(R.x + 26, R.o, 'Ouverture', '', 'start')}${v8Pill(R.x + 26, R.c, 'Clôture', '', 'start')}<text x="${R.x}" y="198" text-anchor="middle" class="v9-nm dn">Rouge</text></g></g>`); }
    if (m === 'hammer' || m === 'star'){ const st = m === 'star', f = y => st ? 210 - y : y, cx = 200;
      const ctx = [[40, 52, 76], [74, 70, 96], [108, 90, 116], [142, 108, 134]].map(([x, o, c]) => v9Cd(x, f(o), f(c), Math.min(f(o), f(c)) - 6, Math.max(f(o), f(c)) + 6, 20)).join('');
      const o = f(146), c = f(134), hi = Math.min(f(130), f(196)), lo = Math.max(f(130), f(196)), bt = Math.min(o, c), bb = Math.max(o, c);
      const t1 = Math.max(450, W(st ? /monte/ : /vendeurs/)), t2 = Math.max(t1 + 700, W(st ? /rejete/ : /acheteurs/)), t3 = Math.max(t2 + 600, W(st ? /essouffl/ : /rebond/)), more = st ? /essouffl/.test(n) : /rebond/.test(n);
      X.cue(0, 'g'); X.cue(100, 'x'); X.cue(Math.max(250, W(st ? /etoile/ : /marteau/)), 'nm'); X.cue(t1, 's'); X.cue(t2, 'a'); X.cue(t2 + 350, 'bd'); if (more) X.cue(t3, 'r');
      const sideS = st ? `${v9Arw(178, 66, 20)}${v8Pill(168, 30, 'Monté', 'hi', 'end')}` : `${v9Arw(176, 150, 192, 'bad')}${v8Pill(168, 184, 'Vendeurs', 'bad', 'end')}`;
      const sideA = st ? `${v9Arw(224, 18, 62, 'bad')}${v8Pill(232, 40, 'Rejeté', 'bad', 'start')}` : `${v9Arw(224, 192, 148)}${v8Pill(232, 170, 'Acheteurs', 'hi', 'start')}`;
      const after = !more ? '' : st ? `<path d="M226 118 L282 168 M272 167 L283 169 L281 158" class="v9-dash"/>${v8Pill(262, 190, 'Essoufflement', 'sm')}` : `<path d="M236 126 L288 72 M278 72 L289 71 L288 82" class="v9-dash"/>${v8Pill(262, 52, 'Rebond possible', 'sm')}${/confirmer/.test(n) ? '<text x="262" y="30" text-anchor="middle" class="v8-t sm">À confirmer</text>' : ''}`;
      return svg(`${v9Grid()}<g data-c="x">${ctx}</g>
        <g data-c="s"><path d="M${cx} ${st ? bt : bb} L${cx} ${st ? hi : lo}" class="v9-wkd ${st ? 'dn' : 'up'} vdr" pathLength="1"/>${sideS}</g>
        <g data-c="a">${sideA}</g><g data-c="bd" class="v9-grow">${v9Cd(cx, o, c, hi, lo, 26)}</g>
        <g data-c="nm">${st ? v8Pill(214, 100, 'Étoile filante', 'hi') : v8Pill(200, 108, 'Marteau', 'hi')}</g>${more ? `<g data-c="r">${after}</g>` : ''}`); }
    if (m === 'doji'){ const cx = 150, q = /sens/.test(n); X.cue(0, 'g'); X.cue(150, 'c'); X.cue(Math.max(400, W(/doji/)), 'nm'); X.cue(Math.max(800, W(/indecision/)), 'i'); if (q) X.cue(Math.max(1400, W(/sens|partir/)), 'q');
      return svg(`${v9Grid()}<g data-c="c"><line x1="${cx}" x2="${cx}" y1="38" y2="176" class="v9-wkd mid"/><rect x="${cx - 24}" y="104" width="48" height="4" rx="2" class="v9-dj"/></g>
        <g data-c="nm">${v8Pill(cx, 22, 'Doji', 'hi')}</g><g data-c="i">${v8Pill(70, 106, 'Indécision', '')}</g>
        ${q ? `<g data-c="q"><path d="M184 96 L244 50" class="v9-dash"/><path d="M184 116 L244 162" class="v9-dash"/><circle cx="256" cy="42" r="13" class="v9-q"/><text x="256" y="47" text-anchor="middle" class="v9-qt">?</text><circle cx="256" cy="170" r="13" class="v9-q"/><text x="256" y="175" text-anchor="middle" class="v9-qt">?</text></g>` : ''}`); }
    if (m === 'engulf'){ const mm = n.match(/grande bougie (rouge|verte) avale la (verte|rouge)/), bigUp = mm[1] === 'verte', sx = 124, bx = 192;
      X.cue(0, 'g'); X.cue(150, 'a'); X.cue(Math.max(700, W(/grande/)), 'b'); X.cue(Math.max(1300, W(/avale/)), 'e');
      return svg(`${v9Grid()}<g data-c="a">${v9Cd(sx, bigUp ? 92 : 120, bigUp ? 120 : 92, 84, 128, 24)}${v8Pill(118, 170, bigUp ? 'Rouge précédente' : 'Verte précédente', 'sm')}</g>
        <g data-c="b" class="v9-grow">${v9Cd(bx, bigUp ? 140 : 80, bigUp ? 80 : 140, 70, 150, 36)}</g><g data-c="b">${v8Pill(232, 196, 'Grande bougie ' + mm[1], '')}</g>
        <g data-c="e"><line x1="104" x2="${bx - 19}" y1="80" y2="80" class="v9-gd"/><line x1="104" x2="${bx - 19}" y1="140" y2="140" class="v9-gd"/>${v8Pill(bx, 46, 'Avale', 'hi')}</g>`); }
    if (m === 'figs'){ const xs = [50, 122, 198, 272], F = [
        { re: /^marteau/, g: v9Cd(50, 82, 72, 68, 124, 16), nm: ['Marteau'] },
        { re: /^etoile/, g: v9Cd(122, 112, 122, 66, 126, 16), nm: ['Étoile', 'filante'] },
        { re: /^doji/, g: '<line x1="198" x2="198" y1="66" y2="124" class="v9-wkd mid"/><rect x="186" y="94" width="24" height="3" rx="1.5" class="v9-dj"/>', nm: ['Doji'] },
        { re: /^avalement/, g: v9Cd(263, 104, 88, 84, 108, 12) + v9Cd(282, 80, 116, 74, 122, 16), nm: ['Avalements'] }];
      X.cue(0, 'g'); F.forEach((f, i) => X.cue(Math.max(200 + i * 300, W(f.re)), 'f' + i));
      return svg(`${v9Grid([50, 95, 140])}${F.map((f, i) => `<g data-c="f${i}">${f.g}${f.nm.map((t, k) => `<text x="${xs[i]}" y="${154 + k * 15}" text-anchor="middle" class="v9-fn">${h(t)}</text>`).join('')}</g>`).join('')}`); }
    if (m === 'hsup'){ X.cue(0, 'g'); X.cue(100, 'x'); X.cue(Math.max(300, W(/support/)), 's'); X.cue(Math.max(650, W(/marteau/)), 'h'); X.cue(Math.max(1200, W(/confirme|verte/)), 'v'); X.cue(Math.max(1800, W(/rebond/)), 'r'); X.cue(Math.max(2300, W(/stop/)), 'st');
      const ctx = [[40, 56, 80], [74, 76, 100], [108, 96, 120], [142, 114, 140]].map(([x, o, c]) => v9Cd(x, o, c, o - 6, c + 6, 20)).join('');
      return svg(`${v9Grid()}<g data-c="x">${ctx}</g>
        <g data-c="s"><line x1="24" x2="296" y1="150" y2="150" class="v8-lvl s"/>${v8Pill(296, 138, 'Support', 's', 'end')}</g>
        <g data-c="h" class="v9-grow">${v9Cd(176, 140, 130, 126, 162, 20)}</g><g data-c="h"><path d="M127 184 L170 164" class="v8-brk"/>${v8Pill(92, 186, 'Marteau', 'hi')}</g>
        <g data-c="v" class="v9-grow">${v9Cd(210, 134, 96, 90, 138, 22)}</g><g data-c="v">${v8Pill(196, 72, 'Bougie verte', '')}</g>
        <g data-c="r"><path d="M232 100 L290 46 M280 46 L291 45 L290 56" class="v9-dash"/>${v8Pill(258, 30, 'Scénario de rebond', 'sm')}</g>
        <g data-c="st"><line x1="150" x2="296" y1="172" y2="172" class="v8-lvl v8-stop"/>${v8Pill(296, 190, 'Stop sous la mèche', 'bad', 'end')}</g>`); }
    /* volume : bougies en haut, barres de volume en bas */
    const xs = [...Array(8)].map((_, i) => 44 + i * 33), base = 196, tv = Math.max(500, W(/volume|echanges/));
    const C = m === 'volx' ? [[92, 80], [80, 94], [94, 76], [76, 88], [88, 72], [72, 84], [84, 70], [70, 26]] : m === 'volp' ? [[96, 100], [100, 92], [92, 96], [96, 90], [90, 94], [94, 72], [72, 50], [50, 26]] : [[80, 66], [66, 74], [74, 58], [58, 70], [70, 54], [54, 62], [62, 48], [48, 56]];
    const V = m === 'volx' ? [20, 23, 18, 21, 19, 22, 20, 60] : m === 'volp' ? [18, 22, 16, 20, 18, 46, 58, 70] : [28, 20, 36, 24, 40, 22, 32, 26];
    X.cue(0, 'g'); X.cue(100, 'c'); V.forEach((_, i) => X.cue(tv + i * 90, 'v' + i));
    let extra = '';
    if (m === 'vol'){ X.cue(Math.max(tv, W(/^volume/)), 'l1'); X.cue(Math.max(tv + 600, W(/titres/)), 'l2'); extra = `<g data-c="l1">${v8Pill(26, 122, 'Volume', 'hi', 'start')}</g><g data-c="l2">${v8Pill(296, 122, 'Nombre de titres échangés', '', 'end')}</g>`; }
    if (m === 'volp'){ X.cue(Math.max(tv + 500, W(/beaucoup/)), 'l1'); X.cue(Math.max(tv + 1100, W(/participation/)), 'l2'); extra = `<g data-c="l1">${v8Pill(26, 140, /beaucoup de volume/.test(n) ? 'Beaucoup de volume' : 'Beaucoup d’échanges', 'hi', 'start')}</g><g data-c="l2">${v8Pill(26, 18, 'Vraie participation', '', 'start')}</g>`; }
    if (m === 'volx'){ const k = (n.match(/(\d+) fois le volume moyen/) || [])[1]; X.cue(Math.max(200, W(/resistance/)), 'rs'); X.cue(Math.max(tv + 800, W(/fois/)), 'l1'); X.cue(Math.max(tv + 1300, W(/cassure|credible/)), 'l2');
      extra = `<g data-c="rs"><line x1="24" x2="296" y1="56" y2="56" class="v8-lvl r"/>${v8Pill(26, 44, 'Résistance', 'r', 'start')}</g><g data-c="l1"><line x1="24" x2="296" y1="${base - 20}" y2="${base - 20}" class="v9-avg"/><text x="26" y="${base - 25}" class="v8-t sm">Volume moyen</text>${v8Pill(296, 122, `${k} fois le volume moyen`, 'hi', 'end')}</g>${/cassure|credible/.test(n) ? `<g data-c="l2">${v8Pill(150, 16, 'Cassure plus crédible', '', 'middle')}</g>` : ''}`; }
    return svg(`<g data-c="g" class="vgrid"><line x1="24" x2="296" y1="${base}" y2="${base}"/></g><g data-c="c">${C.map(([o, c], i) => v9Cd(xs[i], o, c, Math.min(o, c) - 6, Math.max(o, c) + 6, 18)).join('')}</g>
      ${V.map((v, i) => `<g data-c="v${i}" class="v9-vbg"><rect x="${xs[i] - 9}" y="${base - v}" width="18" height="${v}" rx="3" class="v9-vb ${(m === 'volp' && i >= 5) || (m === 'volx' && i === 7) ? 'hi' : ''}"/></g>`).join('')}${extra}`); },
  /* plan de trading, journal, règle du 1 %, ratio */
  plan(X){ const P = v9Plan(X.it.t) || { k: 'review' };
    if (P.k === 'sheet'){ X.cue(80, 'h'); P.items.forEach((x, i) => X.cue(Math.max(300 + i * 180, v9At(X, x, 500 + i * 400)), 'i' + i));
      return `<div class="v9-sheet ${P.items.length > 5 ? 'many' : ''}"><div class="v9-sh" data-c="h">${v9Ic('doc')}<b>${h(P.title)}</b></div>${P.items.map((x, i) => `<div class="v9-row" data-c="i${i}"><svg class="v9-cb" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M7.5 12.5 L10.8 15.8 L16.8 9" class="vdr" pathLength="1"/></svg><span>${h(v5NBT(v8Cap(x)))}</span></div>`).join('')}</div>`; }
    if (P.k === 'journal'){ X.cue(80, 'h'); const tc = P.cols.map((c, i) => Math.max(300 + i * 200, v9At(X, c, 600 + i * 400))); tc.forEach((t, i) => X.cue(t, 'c' + i)); const tr = Math.max(...tc) + 300; [0, 1, 2].forEach(r => X.cue(tr + r * 220, 'r' + r));
      return `<div class="v9-jr" style="--n:${P.cols.length}"><div class="v9-sh" data-c="h">${v9Ic('book')}<b>Journal</b><span>Chaque trade</span></div><div class="v9-tr v9-thd">${P.cols.map((c, i) => `<span data-c="c${i}">${h(v8Cap(c))}</span>`).join('')}</div>${[0, 1, 2].map(r => `<div class="v9-tr" data-c="r${r}">${P.cols.map(() => '<i></i>').join('')}</div>`).join('')}</div>`; }
    if (P.k === 'review'){ const tb = Math.max(300, X.wAt(/bilan/)), te = Math.max(tb + 900, X.wAt(/erreurs/)), bad = [1, 3, 4]; X.cue(80, 'h'); [0, 1, 2, 3, 4, 5].forEach(r => X.cue(150 + r * 90, 'r' + r)); X.cue(tb, 'sc'); X.cue(te, 'e'); X.cue(te + 500, 'l');
      return `<div class="v9-jr rvw" style="--n:4"><div class="v9-sh" data-c="h">${v9Ic('book')}<b>Bilan hebdomadaire</b></div>${[0, 1, 2, 3, 4, 5].map(r => `<div class="v9-tr" data-c="r${r}">${bad.includes(r) ? '<b class="v9-erbg" data-c="e"></b>' : ''}<i></i><i></i><i></i><i></i>${bad.includes(r) ? `<span class="v9-em" data-c="e">${v9Ic('tri')}</span>` : ''}</div>`).join('')}<i class="v9-scan" data-c="sc"></i><div class="v9-tail bad" data-c="l">Erreurs qui reviennent</div></div>`; }
    if (P.k === 'rules'){ const tr = Math.max(600, X.wAt(/regle/)); X.cue(80, 'e'); [0, 1, 2].forEach(i => X.cue(tr + i * 280, 'g' + i));
      return `<div class="v9-rules">${[0, 1, 2].map(i => `<div class="v9-rl"><span class="v9-er" data-c="e">${v9Ic('tri')}<i></i></span><span class="v9-arw" data-c="g${i}"></span><span class="v9-rg2" data-c="g${i}">${v9Ic('check')}<b>Règle</b></span></div>`).join('')}</div>`; }
    if (P.k === 'risk'){ const pv = Math.round(v5Val(P.p)), mv = P.max ? Math.round(v5Val(P.max)) : 0, cs = 13, gp = 3, gx = 146, gy = 40, cell = i => [gx + (i % 10) * (cs + gp), gy + Math.floor(i / 10) * (cs + gp)];
      const tp = Math.max(600, v9At(X, P.p + ' %', 900)), tm = Math.max(tp + 700, v9At(X, 'au maximum', tp + 900)); X.cue(0, 'cp'); X.cue(150, 'g'); X.cue(tp, 'p'); if (mv > pv) X.cue(tm, 'm');
      const box = (i, cls) => { const [x, y] = cell(i); return `<rect x="${x - 1}" y="${y - 1}" width="${cs + 2}" height="${cs + 2}" rx="3.5" class="${cls}"/>`; }, [x0, y0] = cell(0), [x1, y1] = cell(pv);
      return `<svg class="v5-svg v9-risk" viewBox="0 0 320 210">${v5Defs(X.id)}<g data-c="cp"><text x="${gx + 78}" y="${gy - 14}" text-anchor="middle" class="v8-t">Capital</text></g>
        <g data-c="g" class="v9-cells">${[...Array(100)].map((_, i) => { const [x, y] = cell(i); return `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" rx="3" class="v9-cl" style="--i:${i}"/>`; }).join('')}</g>
        <g data-c="p">${[...Array(pv)].map((_, i) => box(i, 'v9-cl1')).join('')}<path d="M128 ${y0 + 6} L${x0 - 4} ${y0 + 6}" class="v8-brk"/>${v8Pill(126, y0 + 6, P.par ? `${P.p} % par trade` : `${P.p} % du capital`, 'hi', 'end')}</g>
        ${mv > pv ? `<g data-c="m">${[...Array(mv - pv)].map((_, k) => box(pv + k, 'v9-cl2')).join('')}<path d="M128 ${y1 + 46} L${x1 + 6} ${y1 + 46} L${x1 + 6} ${y1 + 16}" class="v8-brk"/>${v8Pill(126, y1 + 46, `Au maximum ${P.max} %`, 'bad', 'end')}</g>` : ''}</svg>`; }
    if (P.k === 'rr'){ const g = v5Val(P.g), r = v5Val(P.r), q = g / r, u = Math.min(28, 100 / Math.max(1, q)), hg = u * q, hr = u, y0 = 132, x0 = 150, w = 92;
      X.cue(0, 'e'); X.cue(Math.max(250, X.wAt(/^gain/)), 'gn'); X.cue(Math.max(700, X.wAt(/^risque/)), 'rk'); X.cue(Math.max(1300, X.wAt(/^ratio/)), 'q');
      return `<svg class="v5-svg v9-rr" viewBox="0 0 320 210">${v5Defs(X.id)}
        <g data-c="e"><path d="M30 112 L56 124 L80 114 L106 128 L${x0} ${y0}" class="vln vdr" pathLength="1" stroke="url(#${X.id}g)"/><line x1="${x0}" x2="${x0 + w}" y1="${y0}" y2="${y0}" class="v9-en"/><circle cx="${x0}" cy="${y0}" r="5" class="vdot"/></g>
        <g data-c="gn" class="v9-rrb up"><rect x="${x0}" y="${(y0 - hg).toFixed(1)}" width="${w}" height="${hg.toFixed(1)}" rx="6" class="v9-rg3"/>${v8Pill(x0 - 10, y0 - hg / 2, `Gain ${P.g} €`, 'hi', 'end')}</g>
        <g data-c="rk" class="v9-rrb dn"><rect x="${x0}" y="${y0}" width="${w}" height="${hr.toFixed(1)}" rx="6" class="v9-rk3"/>${v8Pill(x0 - 10, y0 + hr / 2 + 8, `Risque ${P.r} €`, 'bad', 'end')}</g>
        <g data-c="q"><path d="M${x0 + w + 5} ${(y0 - hg).toFixed(1)} L${x0 + w + 5} ${(y0 + hr).toFixed(1)}" class="v8-brk"/>${v8Pill(x0 + w + 12, y0 - hg / 2, `Ratio ${P.q}`, 'hi', 'start')}</g></svg>`; }
    return ''; }
});
if (window.NT_DEBUG){ NT_DEBUG.v9 = t => ({ tpl: v9Pick({ t }), env: v9Env(t), verif: v9Verif(t), plan: v9Plan(t), cdl: v9CdlMode(norm(v5Clean(t))) }); }


/* ============================================================
   V50 — BARRE DE NAVIGATION EN VERRE LIQUIDE (09/11/2026)
   Thomas : « exactement comme la vidéo » (verre liquide : formes qui
   fusionnent comme des gouttes, bords brillants, reflets arc-en-ciel).
   Sur téléphone et tablette (barre du bas), pas sur ordinateur (barre de gauche).
   - la barre devient du verre (flou de ce qui passe derrière + liseré + reflets) ;
   - la marque de l'onglet choisi devient une goutte : elle coule d'un onglet à
     l'autre en s'étirant et déborde de la barre quand elle va vite ;
   - glisser le doigt sur la barre : la goutte suit le doigt, grossit, et l'onglet
     le plus proche est ouvert au lâcher ;
   - le bouton rond Nova Coach est une seconde goutte : quand on descend dans la
     page, il tombe dans la barre et s'y fond ; quand on remonte, il ressort avec
     un pont liquide qui s'étire puis se casse ;
   - les boutons, icônes et textes restent les vrais boutons du site (rien n'est
     renommé), le verre est dessiné dessous.
   Repli automatique : sans WebGL, avec « réduire les animations », sur ordinateur,
   ou si l'appareil est trop lent → la barre d'avant, inchangée.
   Interrupteur : NT_FX.liquid = false.
   ============================================================ */
NT_FX.liquid = NT_FX.liquid !== false;
const LQ = { on: false, ok: null, cv: null, gl: null, back: null, bar: null, bub: null, u: {}, raf: 0, last: 0, t: 0,
  B: null, btn: [], idx: -1, dpr: 1, top: 0, W: 0, H: 0, slow: 0, frames: 0,
  drop: { x: null, vx: 0, hw: 0, vhw: 0, hh: 0, vhh: 0, on: 0, von: 0, tx: 0, bhw: 0, bhh: 0 },
  bb: { x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, rx: 0, ry: 0, R: 28, cx0: 0, cy0: 0, st: 'in', has: false, press: 0 },
  pd: null, near: -1, suppress: 0, allow: false };
const LQ_LIFT = 16, LQ_K = 24;
const LQ_VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';
const LQ_FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;uniform float uDpr;uniform vec4 uBar;uniform float uBarR;uniform vec4 uDrop;uniform float uDropR;uniform float uDropOn;
uniform vec3 uBub;uniform float uK;uniform float uKd;uniform float uT;uniform float uIr;
float sdB(vec2 p,vec2 b,float r){r=min(r,min(b.x,b.y));vec2 q=abs(p)-b+r;return length(max(q,0.0))+min(max(q.x,q.y),0.0)-r;}
float smin(float a,float b,float k){float h=max(k-abs(a-b),0.0)/k;return min(a,b)-h*h*k*0.25;}
float fBar(vec2 p){return sdB(p-uBar.xy,uBar.zw,uBarR);}
float fDrop(vec2 p){return uDropOn>0.001?sdB(p-uDrop.xy,uDrop.zw,uDropR):1e3;}
float fBub(vec2 p){return uBub.z>0.3?length(p-uBub.xy)-uBub.z:1e3;}
float scene(vec2 p){return smin(smin(fBar(p),fDrop(p),uKd),fBub(p),uK);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
void main(){
  vec2 p=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uDpr;
  float d=scene(p);
  if(d>34.0){gl_FragColor=vec4(0.0);return;}
  float ins=clamp(0.5-d/0.8,0.0,1.0);
  vec2 e=vec2(1.0,0.0);
  vec2 n=normalize(vec2(scene(p+e.xy)-d,scene(p+e.yx)-d)+1e-6);
  vec2 L=normalize(vec2(-0.45,-0.9));float fl=dot(n,L);
  /* ombre douce sous le verre */
  float ds=scene(p-vec2(0.0,7.0));
  vec4 col=vec4(0.0,0.0,0.0,(1.0-ins)*0.32*exp(-max(ds,0.0)/11.0));
  /* là où le flou du site n'existe pas (pont liquide, goutte qui déborde) : verre teinté */
  float dom=min(fBar(p),fBub(p));float fa=ins*clamp(0.5+dom/0.8,0.0,1.0)*0.8;
  col=vec4(vec3(0.11,0.09,0.25)*fa,fa)+col*(1.0-fa);
  /* épaisseur du verre : bord plus clair, reflets arc-en-ciel, fin liseré */
  float t=clamp(-d/18.0,0.0,1.0);float bev=pow(1.0-t,2.2)*ins;
  float rim=smoothstep(1.7,0.2,abs(d+0.9))*ins;
  float rimI=rim*(0.2+0.75*max(fl,0.0)+0.38*max(-fl,0.0));
  float nz=vn(p*0.035+vec2(uT*0.12,-uT*0.07));float nz2=vn(p*0.08-vec2(uT*0.05,uT*0.02));
  float ph=-d*0.1+nz*1.7+atan(n.y,n.x)*0.32;
  vec3 rb=0.5+0.5*cos(6.28318*(ph+vec3(0.0,0.33,0.67)));
  float irA=bev*uIr*(0.22+0.78*smoothstep(0.3,0.78,nz2))*0.6;
  /* la goutte de l'onglet choisi : une lentille plus claire, avec son propre bord */
  float dd=fDrop(p);float lin=clamp(0.5-dd/0.8,0.0,1.0)*uDropOn*ins;
  float lbev=pow(1.0-clamp(-dd/12.0,0.0,1.0),2.0)*lin;
  vec2 nd=normalize(vec2(fDrop(p+e.xy)-dd,fDrop(p+e.yx)-dd)+1e-6);float fd=dot(nd,L);
  float lrim=smoothstep(1.5,0.1,abs(dd+0.8))*uDropOn*ins*(0.22+0.62*max(fd,0.0)+0.32*max(-fd,0.0));
  vec3 lc=vec3(1.0)*(rimI+lrim)+rb*(irA+lbev*0.32*uIr)+vec3(0.8,0.74,1.0)*(lin*0.11+bev*0.09*max(fl,0.0)+ins*0.025);
  float la=clamp(max(max(lc.r,lc.g),lc.b),0.0,1.0);
  gl_FragColor=vec4(lc,la)+col*(1.0-la);
}`;
function lqGL(){ if (LQ.ok === false) return null; if (LQ.gl) return LQ.gl;
  try { const cv = document.createElement('canvas'); cv.className = 'lq-gl'; cv.setAttribute('aria-hidden', 'true');
    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }); if (!gl) throw 0;
    const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, LQ_VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, LQ_FS)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link'); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uDpr', 'uBar', 'uBarR', 'uDrop', 'uDropR', 'uDropOn', 'uBub', 'uK', 'uKd', 'uT', 'uIr'].forEach(k => LQ.u[k] = gl.getUniformLocation(pr, k));
    cv.addEventListener('webglcontextlost', ev => { ev.preventDefault(); LQ.ok = false; lqOff(); });
    /* le flou et le verre vivent DANS la barre (sous ses boutons) : la page entière est dans #app, on ne peut pas glisser une couche entre la page et les boutons depuis l'extérieur */
    const bar = document.createElement('i'); bar.className = 'lq-bar'; bar.setAttribute('aria-hidden', 'true');
    LQ.cv = cv; LQ.gl = gl; LQ.bar = bar; LQ.ok = true; return gl;
  } catch(e){ LQ.ok = false; return null; } }
const lqMQ = window.matchMedia ? window.matchMedia('(max-width: 999px)') : null;
function lqWanted(){ let slow = false; try { slow = sessionStorage.getItem('nt-lq-slow') === '1'; } catch(e){} return NT_FX.liquid && !RM() && (!lqMQ || lqMQ.matches) && !slow && LQ.ok !== false; }
function lqOff(){ LQ.on = false; document.documentElement.classList.remove('nt-lq'); cancelAnimationFrame(LQ.raf); LQ.raf = 0;
  if (LQ.cv) LQ.cv.remove(); if (LQ.bar) LQ.bar.remove(); document.querySelectorAll('.lq-fbk').forEach(x => x.remove());
  const f = document.querySelector('#app .fab'); if (f){ f.style.transform = ''; f.style.opacity = ''; f.style.pointerEvents = ''; }
  document.querySelectorAll('#app .dock button.lq-near').forEach(b => b.classList.remove('lq-near')); }
/* ---------- lecture de la barre et du bouton rond après chaque affichage ---------- */
function lqSync(first){ if (!lqWanted()){ if (LQ.on) lqOff(); return; }
  const dk = document.querySelector('#app .dock'), r = dk && dk.getBoundingClientRect();
  if (!dk || !r.width || getComputedStyle(dk).display === 'none'){ if (LQ.on) lqOff(); return; }
  if (!lqGL()) return; LQ.on = true; document.documentElement.classList.add('nt-lq');
  if (LQ.bar.parentNode !== dk) dk.prepend(LQ.bar); if (LQ.cv.parentNode !== dk) LQ.bar.after(LQ.cv);
  const btn = [...dk.querySelectorAll('button[data-go]')], n = btn.length || 1, idx = Number(dk.dataset.to);
  LQ.B = { l: r.left, t: r.top, w: r.width, h: r.height }; LQ.btn = btn.map(b => { const q = b.getBoundingClientRect(); return q.left + q.width / 2; });
  /* zone dessinée : de 70 px au-dessus du bouton rond jusqu'en bas de l'écran */
  const f = document.querySelector('#app .fab'); let fr = null; if (f){ f.style.transform = ''; fr = f.getBoundingClientRect(); }
  const top = Math.max(0, Math.min(r.top, fr ? fr.top - LQ_LIFT : r.top) - 70), W = window.innerWidth, H = window.innerHeight - top, dpr = Math.min(1.5, window.devicePixelRatio || 1);
  if (W !== LQ.W || H !== LQ.H || dpr !== LQ.dpr || top !== LQ.top){ LQ.W = W; LQ.H = H; LQ.top = top; LQ.dpr = dpr; LQ.cv.width = Math.round(W * dpr); LQ.cv.height = Math.round(H * dpr); LQ.cv.style.width = W + 'px'; LQ.cv.style.height = H + 'px'; LQ.gl.viewport(0, 0, LQ.cv.width, LQ.cv.height); }
  /* la toile part du coin de l'écran : on la décale de la position de la barre */
  const bw = parseFloat(getComputedStyle(dk).borderLeftWidth) || 0; LQ.cv.style.left = (-r.left - bw).toFixed(2) + 'px'; LQ.cv.style.top = (top - r.top - bw).toFixed(2) + 'px';
  /* goutte de l'onglet : même taille que l'ancienne pastille */
  const D = LQ.drop, pad = 8; D.bhw = (r.width - pad * 2) / n / 2; D.bhh = r.height / 2 - pad; LQ.idx = idx;
  if (idx >= 0 && LQ.btn[idx] != null){ D.tx = LQ.btn[idx]; if (D.x == null || first){ D.x = D.tx; D.hw = D.bhw; D.hh = D.bhh; } D.ton = 1; } else D.ton = 0;
  /* bouton rond Nova Coach */
  const bb = LQ.bb; bb.has = !!fr;
  if (fr){ bb.cx0 = fr.left + fr.width / 2; bb.cy0 = fr.top + fr.height / 2; bb.R = (f.offsetWidth || fr.width) / 2; bb.rx = bb.cx0; bb.ry = bb.cy0 - LQ_LIFT; if (!f.querySelector('.lq-fbk')){ const k = document.createElement('i'); k.className = 'lq-fbk'; k.setAttribute('aria-hidden', 'true'); f.prepend(k); }
    if (first || bb.x === 0){ bb.x = bb.rx; bb.y = r.top + 8; bb.r = 0; bb.st = window.scrollY > 120 ? 'in' : 'rest'; } }
  lqApply(); lqKick(); }
/* ---------- ressorts ---------- */
const lqSp = (o, k, tg, kk, c, dt) => { const v = 'v' + k; o[v] += (kk * (tg - o[k]) - c * o[v]) * dt; o[k] += o[v] * dt; return Math.abs(tg - o[k]) > 0.05 || Math.abs(o[v]) > 0.5; };
function lqStep(dt){ const D = LQ.drop, B = LQ.B, bb = LQ.bb; let m = false;
  const drag = LQ.pd && LQ.pd.drag, tx = drag ? Math.max(B.l + D.bhw + 8, Math.min(B.l + B.w - D.bhw - 8, LQ.pd.x)) : D.tx;
  m = lqSp(D, 'x', tx, drag ? 520 : 240, drag ? 40 : 24, dt) || m;
  const sp = Math.abs(D.vx), press = LQ.pd ? 1 : 0;
  m = lqSp(D, 'hw', D.bhw + Math.min(30, sp * 0.035) + (drag ? 6 : press * 2), 320, 17, dt) || m;
  m = lqSp(D, 'hh', D.bhh + Math.min(20, sp * 0.028) + (drag ? 13 : press * 3), 320, 15, dt) || m;
  m = lqSp(D, 'on', D.ton || 0, 140, 22, dt) || m;
  if (bb.has){ const inn = bb.st === 'in', tx2 = inn ? Math.min(bb.rx, B.l + B.w - 46) : bb.rx, ty2 = inn ? B.t + 8 : bb.ry;
    /* en tombant, la goutte garde sa taille jusqu'à toucher la barre (le pont liquide se forme), puis fond dedans */
    const tr = inn ? bb.R * Math.min(1, Math.max(0, (B.t + 8 - bb.y) - 6) / 34) : bb.R * (1 + bb.press * 0.1);
    m = lqSp(bb, 'x', tx2, 120, 15, dt) || m; m = lqSp(bb, 'y', ty2, inn ? 150 : 110, inn ? 17 : 12, dt) || m; m = lqSp(bb, 'r', tr, inn ? 90 : 150, inn ? 14 : 13, dt) || m; if (bb.r < 0) bb.r = 0; }
  return m || !!LQ.pd; }
function lqApply(){ const bb = LQ.bb, f = document.querySelector('#app .fab');
  if (f && bb.has){ const s = Math.max(0.001, bb.r / bb.R); f.style.transform = `translate(${(bb.x - bb.cx0).toFixed(2)}px,${(bb.y - bb.cy0).toFixed(2)}px) scale(${s.toFixed(3)})`; f.style.opacity = Math.min(1, Math.max(0, (s - 0.35) / 0.4)).toFixed(3); f.style.pointerEvents = s > 0.7 ? '' : 'none'; } }
function lqDraw(){ const gl = LQ.gl, u = LQ.u, B = LQ.B, D = LQ.drop, bb = LQ.bb, top = LQ.top; if (!gl || !B) return;
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(u.uRes, LQ.cv.width, LQ.cv.height); gl.uniform1f(u.uDpr, LQ.dpr);
  gl.uniform4f(u.uBar, B.l + B.w / 2, B.t + B.h / 2 - top, B.w / 2, B.h / 2); gl.uniform1f(u.uBarR, B.h / 2);
  gl.uniform4f(u.uDrop, D.x, B.t + B.h / 2 - top, Math.max(1, D.hw), Math.max(1, D.hh)); gl.uniform1f(u.uDropR, Math.min(D.hw, D.hh)); gl.uniform1f(u.uDropOn, Math.max(0, Math.min(1, D.on)));
  gl.uniform3f(u.uBub, bb.x, bb.y - top, bb.has ? Math.max(0, bb.r) : 0); gl.uniform1f(u.uK, LQ_K); gl.uniform1f(u.uKd, 6 + Math.min(16, Math.abs(D.vx) * 0.02) + (LQ.pd && LQ.pd.drag ? 10 : 0));
  gl.uniform1f(u.uT, LQ.t); gl.uniform1f(u.uIr, 1); gl.drawArrays(gl.TRIANGLES, 0, 3); }
function lqKick(){ if (LQ.on && !LQ.raf) LQ.raf = requestAnimationFrame(lqLoop); }
function lqLoop(ts){ LQ.raf = 0; if (!LQ.on) return; const dt = LQ.last ? Math.min(0.034, (ts - LQ.last) / 1000) : 1 / 60;
  /* appareil trop lent pendant une animation → on garde la barre d'avant */
  if (LQ.last && !LQ.force){ LQ.frames++; if (ts - LQ.last > 70) LQ.slow++; if (LQ.frames > 45 && LQ.slow / LQ.frames > 0.6){ try { sessionStorage.setItem('nt-lq-slow', '1'); } catch(e){} return lqOff(); } }
  LQ.last = ts; LQ.t += dt; let moving = false; for (let i = 0; i < 2; i++) moving = lqStep(dt / 2) || moving;
  lqApply(); lqDraw(); if (moving) LQ.raf = requestAnimationFrame(lqLoop); else LQ.last = 0; }
/* ---------- gestes ---------- */
function lqNearest(x){ let k = -1, b = 1e9; LQ.btn.forEach((c, i) => { const d = Math.abs(c - x); if (d < b){ b = d; k = i; } }); return k; }
document.addEventListener('pointerdown', e => { if (!LQ.on) return; const dk = e.target.closest && e.target.closest('#app .dock'), fb = e.target.closest && e.target.closest('#app .fab');
  if (fb){ LQ.bb.press = 1; lqKick(); return; } if (!dk) return; LQ.pd = { x: e.clientX, x0: e.clientX, y0: e.clientY, drag: false, id: e.pointerId }; lqKick(); }, { passive: true });
document.addEventListener('pointermove', e => { const pd = LQ.pd; if (!pd || e.pointerId !== pd.id) return; pd.x = e.clientX; if (!pd.drag && Math.abs(pd.x - pd.x0) > 10) pd.drag = true;
  if (pd.drag){ const k = lqNearest(pd.x); if (k !== LQ.near){ document.querySelectorAll('#app .dock button.lq-near').forEach(b => b.classList.remove('lq-near')); const b = document.querySelectorAll('#app .dock button[data-go]')[k]; if (b) b.classList.add('lq-near'); LQ.near = k; } lqKick(); } }, { passive: true });
function lqUp(e){ LQ.bb.press = 0; const pd = LQ.pd; if (!pd || (e.pointerId !== undefined && e.pointerId !== pd.id)) { lqKick(); return; } LQ.pd = null; document.querySelectorAll('#app .dock button.lq-near').forEach(b => b.classList.remove('lq-near')); LQ.near = -1;
  if (pd.drag && e.type === 'pointerup'){ const k = lqNearest(pd.x), b = document.querySelectorAll('#app .dock button[data-go]')[k]; LQ.suppress = performance.now();
    if (b && k !== LQ.idx){ LQ.drop.tx = LQ.btn[k]; LQ.allow = true; try { b.click(); } finally { LQ.allow = false; } } }
  lqKick(); }
document.addEventListener('pointerup', lqUp, { passive: true }); document.addEventListener('pointercancel', lqUp, { passive: true });
/* le clic que le navigateur envoie à la fin d'un glissé ne doit pas ouvrir un autre onglet */
document.addEventListener('click', e => { if (LQ.allow || !LQ.suppress) return; if (performance.now() - LQ.suppress < 450 && e.target.closest && e.target.closest('#app .dock')){ e.stopPropagation(); e.preventDefault(); } LQ.suppress = 0; }, true);
/* défilement : le bouton rond tombe dans la barre quand on descend, ressort quand on remonte */
(function(){ let lastY = window.scrollY, acc = 0;
  window.addEventListener('scroll', () => { const y = window.scrollY, dy = y - lastY; lastY = y; if (!LQ.on || !LQ.bb.has) return; if ((dy > 0) !== (acc > 0)) acc = 0; acc += dy;
    const bb = LQ.bb; if (bb.st === 'rest' && acc > 42 && y > 120){ bb.st = 'in'; lqKick(); } else if (bb.st === 'in' && (acc < -28 || y < 60)){ bb.st = 'rest'; lqKick(); } }, { passive: true }); })();
/* après chaque affichage de page, au changement de taille, de mode d'écran ou de réglage */
(function(){ const app = document.getElementById('app'); if (!app) return; let q = 0, firstDone = false;
  const now = () => { const f = !firstDone; lqSync(f); if (LQ.on) firstDone = true; }, go = () => { if (q) return; q = requestAnimationFrame(() => { q = 0; now(); }); };
  /* juste après l'affichage, avant que l'écran ne soit peint : pas d'image où le bouton rond serait à la mauvaise place */
  new MutationObserver(now).observe(app, { childList: true }); window.addEventListener('resize', go); if (lqMQ && lqMQ.addEventListener) lqMQ.addEventListener('change', go);
  const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)'); if (rm && rm.addEventListener) rm.addEventListener('change', go); go(); })();
if (window.NT_DEBUG){ NT_DEBUG.lq = () => ({ on: LQ.on, ok: LQ.ok, idx: LQ.idx, goutte: LQ.drop.x == null ? null : Math.round(LQ.drop.x), cible: Math.round(LQ.drop.tx), bouton: LQ.bb.st, rayon: Math.round(LQ.bb.r), anime: !!LQ.raf });
  NT_DEBUG.lqForce = () => { LQ.force = true; try { sessionStorage.removeItem('nt-lq-slow'); } catch(e){} lqSync(true); };
  NT_DEBUG.lqBub = st => { LQ.bb.st = st; lqKick(); };
  /* pose figée (pour les aperçus) : on place les gouttes et on dessine une seule image */
  NT_DEBUG.lqPose = o => { cancelAnimationFrame(LQ.raf); LQ.raf = 0; Object.assign(LQ.bb, o.bb || {}); Object.assign(LQ.drop, o.drop || {}); if (o.t != null) LQ.t = o.t; lqApply(); lqDraw(); return { barre: LQ.B, bouton: { x: LQ.bb.rx, y: LQ.bb.ry, R: LQ.bb.R }, onglets: LQ.btn }; }; }


/* ============================================================
   V51 — LE BOUTON NOVA COACH PARTOUT, EN VERRE, QUI CONNAÎT LA QUESTION (09/11/2026)
   Thomas : « partout le petit bouton en bas à droite Nova Coach ; si je suis sur
   une question et que j'appuie dessus, Nova Coach a accès à la question et peut
   expliquer davantage ; il peut poser des questions : c'est pour apprendre »
   + « avec gouttes ».
   - Pendant une mission, un mini-jeu, une journée de trader et une vidéo de cours :
     une goutte de verre Nova Coach en bas à droite. Elle ouvre Nova Coach SUR la
     question (ou la phrase de la vidéo) : même fenêtre que « Une question ? »,
     avec la règle d'or : tant que l'élève n'a pas répondu, pas de réponse donnée,
     seulement des indices. La vidéo se met en pause et repart à la fermeture.
   - Pendant un examen : pas de bouton (un examen se passe sans aide).
   - Sur ordinateur, sur toutes les pages : la même goutte remplace l'ancien rond violet.
   - Sur téléphone, dans les pages avec la barre : c'est la goutte de V50 (inchangée).
   - Gouttes : elle sort en goutte quand elle apparaît, s'écrase quand on appuie,
     et une petite goutte s'en détache puis y revient à chaque nouvelle question
     (« Nova a vu la nouvelle question »).
   - Nova Coach pose une question à l'élève à la fin de ses réponses (pour vérifier
     qu'il a compris), en mode IA comme en réponses automatiques.
   L'IA ne reçoit toujours que l'exercice (jamais le nom ni l'e-mail).
   Sans WebGL ou avec « réduire les animations » : même bouton, en rond violet simple.
   Interrupteur : NT_FX.novadrop = false.
   ============================================================ */
NT_FX.novadrop = NT_FX.novadrop !== false;
/* le verre de la goutte : mêmes conditions que la barre, sauf la taille d'écran (la goutte existe aussi sur ordinateur) */
const ndGlassOK = () => { let slow = false; try { slow = sessionStorage.getItem('nt-lq-slow') === '1'; } catch(e){} return NT_FX.liquid && !RM() && !slow; };
const ND = { el: null, cv: null, gl: null, u: {}, inner: null, where: null, key: '', raf: 0, last: 0, t: 0, R: 28, glass: false,
  r: 0, vr: 0, sx: 0, vsx: 0, sy: 0, vsy: 0, sr: 0, vsr: 0, sat: 0, press: 0, hover: 0, satT: 0, paused: false, PAD: 54, PR: 10, PB: 14 };
/* ---------- le contexte d'une vidéo de cours : la phrase à l'écran ---------- */
const _qContextV50 = qContext;
qContext = function(){ if (M && M.vid && M.vid.sc && M.mode !== 'exam'){ const s = M.vid.sc[M.vid.i] || {}, t = v5Clean(s.t || s.head || '');
    if (t) return { key: 'v:' + M.m.id + ':' + M.vid.i, title: t, mid: (M.m.id || '').split('#')[0], vid: true, answered: true, explain: '',
      text: `Vidéo de cours de la mission « ${M.m.title} »${M.m.goal ? ' (' + M.m.goal + ')' : ''}.\nPhrase à l'écran au moment où l'élève a appuyé : « ${t} »\nL'élève veut mieux comprendre ce passage du cours.\n` }; }
  return _qContextV50(); };
/* la fenêtre « sur cette vidéo » : bons mots et bonnes suggestions */
const _renderAskQV50 = renderAskQ;
renderAskQ = function(){ _renderAskQV50(); const c = QA && QA.c; if (!c || !c.vid) return; const sh = document.getElementById('sheet'); if (!sh) return;
  const eb = sh.querySelector('.eyebrow'); if (eb) eb.innerHTML = `${I.chat} Nova Coach · sur cette vidéo`;
  const sg = sh.querySelector('.sugg'); if (sg) sg.innerHTML = ['Explique-moi cette phrase', 'Donne-moi un exemple concret', 'Explique le mot difficile'].map(s => `<button data-qask="${h(s)}">${h(s)}</button>`).join('');
  const first = sh.querySelector('#qaMsgs .bub.them'); if (first && !QA.msgs.length) first.innerHTML = '<small>Nova Coach</small>Pose-moi ta question sur ce passage : je te l’explique autrement.';
  const inp = sh.querySelector('#qaIn'); if (inp) inp.placeholder = 'Ta question sur ce passage…'; };
/* ---------- Nova Coach pose une question à l'élève ---------- */
/* le type d'exercice en cours (calcul, cartes à ranger, vrai/faux, choix) */
const ndType = () => { try { const st = M && !M.vid && M.steps && M.steps[M.i]; return st ? { t: st.type, st } : null; } catch(e){ return null; } };
const ndAsk = c => { const n = norm(c.title || ''), ty = ndType(), t = ty && ty.t;
  if (c.vid) return 'À toi : peux-tu redire cette idée avec tes mots, en une phrase ?';
  if (!c.answered){ if (t === 'calc') return 'À toi : quel calcul ferais-tu en premier ?'; if (t === 'swipe') return 'À toi : de quel côté la rangerais-tu, et pourquoi ?'; if (t === 'vf' || /vrai|faux/.test(n)) return 'À toi : qu’est-ce qui rendrait cette phrase vraie ? Et fausse ?'; if (t === 'lesson' || t === 'apply') return 'À toi : qu’est-ce que tu retiens de cette étape, en une phrase ?'; if (ty && !ty.st.choices) return 'À toi : qu’est-ce que tu cherches à obtenir ici, en une phrase ?'; return 'À toi : quelle réponse peux-tu éliminer en premier, et pourquoi ?'; }
  return 'À toi : peux-tu expliquer avec tes mots pourquoi c’est la bonne réponse ?'; };
const _localQAV50 = localQA;
localQA = function(q, c){ let a = _localQAV50(q, c);
  /* l'indice général d'avant (« élimine les réponses extrêmes ») ne va pas à un calcul ni à des cartes à ranger */
  const ty = ndType(); if (c && !c.answered && ty && /^Indice : relis la question/.test(a)){ const f = a.match(/\s?\[\[fiche:[\w-]+\]\]$/), tail = f ? f[0] : '';
    if (ty.t === 'calc') a = 'Indice : repère les nombres de la question et l’opération à faire, puis pose le calcul étape par étape.' + tail;
    else if (ty.t === 'swipe' && ty.st.left && ty.st.right) a = `Indice : pour cette carte, cherche ce qui la rapproche de « ${ty.st.left} » ou de « ${ty.st.right} ».` + tail;
    else if (!ty.st.choices && ty.t !== 'vf') a = 'Indice : relis la consigne mot à mot : elle dit exactement ce qu’il faut faire, et le cours en bref plus bas peut t’aider.' + tail; }
  if (c && c.vid && /^Relis l’explication/.test(a)) a = `Dans ce passage : « ${c.title.replace(/[.!…]+$/, '')} ». Retiens l’idée principale : c’est elle que les questions vont vérifier.`;
  if (/^\s*(merci|ok|d.accord|super|top)\b/i.test(q)) return a; const m = a.match(/\s?\[\[fiche:[\w-]+\]\]$/), body = m ? a.slice(0, m.index) : a;
  return body + ' ' + ndAsk(c) + (m ? m[0] : ''); };
if (AI && typeof AI.ask === 'function'){ const _aiAskV50 = AI.ask;
  AI.ask = (prompt, opts = {}) => _aiAskV50(opts.task === 'question' ? prompt + '\nTermine par UNE seule petite question à l’élève, qui le fait réfléchir ou vérifie qu’il a compris (sauf s’il demande seulement le sens d’un mot ou s’il dit merci). C’est pour apprendre : jamais une question piège.' : prompt, opts); }

/* ---------- la goutte Nova Coach (hors de la barre) ---------- */
function ndWhere(){ if (!NT_FX.novadrop) return null; const pl = document.getElementById('player'), pc = lqMQ && !lqMQ.matches;
  if (pl){ if (M && (M.mode === 'exam' || M.end)) return null; if (M && M.vid) return M.vid.v5 ? 'video' : null; try { return canAskQ() ? 'q' : null; } catch(e){ return null; } }
  if (document.getElementById('sheet')) return ND.where === 'page' && pc ? 'page' : null;
  return pc && document.querySelector('#app .fab') ? 'page' : null; }
function ndBuild(){ if (ND.el) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'ndq'; b.setAttribute('aria-label', 'Nova Coach : poser une question sur ce que tu fais');
  b.innerHTML = `<canvas class="ndq-gl" aria-hidden="true"></canvas><span class="ndq-in"><i class="ndq-bk" aria-hidden="true"></i>${I.chat}</span>`; document.body.appendChild(b);
  ND.el = b; ND.cv = b.querySelector('canvas'); ND.inner = b.querySelector('.ndq-in');
  /* même verre que la barre : même programme WebGL */
  ND.glass = false; if (ndGlassOK()) try { const gl = ND.cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (gl){ const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw 0; return s; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, LQ_VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, LQ_FS)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw 0; gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uDpr', 'uBar', 'uBarR', 'uDrop', 'uDropR', 'uDropOn', 'uBub', 'uK', 'uKd', 'uT', 'uIr'].forEach(k => ND.u[k] = gl.getUniformLocation(pr, k));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      /* la toile ne dépasse JAMAIS de l'écran à droite ni en bas (sinon le téléphone élargit la page et la dézoome) : large à gauche et en haut (la petite goutte part par là), étroite à droite et en bas */
      const CW = ND.PAD + ND.R * 2 + ND.PR, CH = ND.PAD + ND.R * 2 + ND.PB; ND.cv.width = Math.round(CW * dpr); ND.cv.height = Math.round(CH * dpr); ND.dpr = dpr; gl.viewport(0, 0, ND.cv.width, ND.cv.height);
      ND.cv.addEventListener('webglcontextlost', ev => { ev.preventDefault(); ND.glass = false; ndClass(); });
      ND.gl = gl; ND.glass = true; } } catch(e){ ND.glass = false; }
  ndClass();
  b.addEventListener('click', ev => { ev.stopPropagation(); ndOpen(); });
  b.addEventListener('pointerdown', () => { ND.press = 1; ndKick(); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(k => b.addEventListener(k, () => { ND.press = 0; if (k === 'pointerleave') ND.hover = 0; ndKick(); }));
  b.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse'){ ND.hover = 1; ndKick(); } }); }
const ndClass = () => { if (ND.el) ND.el.classList.toggle('glass', ND.glass && ndGlassOK()); };
function ndOpen(){ const w = ND.where; if (!w) return;
  if (w === 'page'){ const f = document.querySelector('#app .fab'); if (f) f.click(); return; }
  if (w === 'video'){ const V = M && M.vid; if (V && !V.paused){ try { v6Pause('nova'); ND.paused = true; } catch(e){} } }
  openAskQ(); }
/* à la fermeture de la fenêtre, la vidéo repart si c'est la goutte qui l'avait arrêtée */
/* (la fenêtre se redessine en se fermant puis en se rouvrant : on attend un instant pour savoir si elle est vraiment fermée) */
const _closeSheetV50 = closeSheet; closeSheet = function(){ _closeSheetV50(); setTimeout(() => { if (ND.paused && !document.getElementById('sheet')){ ND.paused = false; const V = M && M.vid; if (V && V.paused === 'nova') try { v6Resume(); } catch(e){} } ndSync(); }, 0); };
function ndSync(){ const w = ndWhere();
  if (w && !ND.el) ndBuild(); if (!ND.el) return;
  const was = ND.where; ND.where = w; const html = document.documentElement;
  /* noms uniques (« nd » et « nd-in » existaient déjà ailleurs : collision) */ html.classList.toggle('ndq-pc', w === 'page'); html.classList.toggle('ndq-mis', !!w && w !== 'page' && !!(lqMQ && lqMQ.matches));
  ND.el.classList.toggle('on', !!w); ndClass();
  if (w && !was){ ND.r = ND.glass ? 0 : ND.R * 0.4; ND.vr = 0; }
  let key = ''; if (w === 'q'){ try { const c = qContext(); key = c ? c.key : ''; } catch(e){} }
  if (w && was && key && key !== ND.key) ND.satT = performance.now(); ND.key = key;
  ndKick(); }
const ndSp = (k, tg, kk, c, dt) => { const v = 'v' + k; ND[v] += (kk * (tg - ND[k]) - c * ND[v]) * dt; ND[k] += ND[v] * dt; return Math.abs(tg - ND[k]) > 0.04 || Math.abs(ND[v]) > 0.4; };
function ndStep(dt){ let m = false; const R = ND.R, on = !!ND.where;
  m = ndSp('r', on ? R * (1 - ND.press * 0.1 + ND.hover * 0.06) : 0, ND.press ? 420 : 170, ND.press ? 26 : 13, dt) || m;
  /* la petite goutte : sort en haut à gauche, attend, puis revient se fondre */
  const age = performance.now() - ND.satT, out = on && ND.satT && age < 700;
  m = ndSp('sx', out ? -R * 1.45 : -R * 0.2, 90, 12, dt) || m; m = ndSp('sy', out ? -R * 1.25 : -R * 0.15, 90, 12, dt) || m; m = ndSp('sr', out ? R * 0.36 : 0, 120, 14, dt) || m;
  if (ND.satT && age < 1600) m = true; if (ND.sr < 0) ND.sr = 0; if (ND.r < 0) ND.r = 0;
  return m || ND.press > 0; }
function ndDraw(){ const s = Math.max(0.001, ND.r / ND.R); ND.inner.style.transform = `scale(${s.toFixed(3)})`; ND.inner.style.opacity = Math.min(1, Math.max(0, (s - 0.3) / 0.45)).toFixed(3);
  ND.el.style.pointerEvents = ND.where && s > 0.6 ? '' : 'none';
  if (!ND.glass || !ND.gl) return; const gl = ND.gl, u = ND.u, c = ND.R + ND.PAD, sr = ND.sr; /* centre de la goutte dans la toile (même décalage en x et en y) */
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform2f(u.uRes, ND.cv.width, ND.cv.height); gl.uniform1f(u.uDpr, ND.dpr);
  /* la petite goutte prend la place de « la barre » dans le même programme (un rond = une barre carrée très arrondie) */
  if (sr > 0.4){ gl.uniform4f(u.uBar, c + ND.sx, c + ND.sy, sr, sr); gl.uniform1f(u.uBarR, sr); } else { gl.uniform4f(u.uBar, -9999, -9999, 1, 1); gl.uniform1f(u.uBarR, 1); }
  gl.uniform4f(u.uDrop, -9999, -9999, 1, 1); gl.uniform1f(u.uDropR, 1); gl.uniform1f(u.uDropOn, 0);
  gl.uniform3f(u.uBub, c, c, ND.r); gl.uniform1f(u.uK, 20); gl.uniform1f(u.uKd, 6); gl.uniform1f(u.uT, ND.t); gl.uniform1f(u.uIr, 1); gl.drawArrays(gl.TRIANGLES, 0, 3); }
function ndKick(){ if (ND.el && !ND.raf) ND.raf = requestAnimationFrame(ndLoop); }
function ndLoop(ts){ ND.raf = 0; const dt = ND.last ? Math.min(0.034, (ts - ND.last) / 1000) : 1 / 60; ND.last = ts; ND.t += dt;
  let m = false; if (RM() || !ND.glass){ ND.r = ND.where ? ND.R : 0; ND.sr = 0; m = false; } else for (let i = 0; i < 2; i++) m = ndStep(dt / 2) || m;
  ndDraw(); if (m) ND.raf = requestAnimationFrame(ndLoop); else ND.last = 0; }
/* quand une fenêtre s'ouvre ou se ferme, qu'une mission avance, qu'une page change */
(function(){ let plObs = null, q = 0; const later = () => { if (q) return; q = requestAnimationFrame(() => { q = 0; ndSync(); }); };
  new MutationObserver(() => { const pl = document.getElementById('player'); if (pl && (!plObs || plObs.t !== pl)){ if (plObs) plObs.o.disconnect(); const o = new MutationObserver(later); o.observe(pl, { childList: true, subtree: false }); plObs = { o, t: pl }; } if (!pl && plObs){ plObs.o.disconnect(); plObs = null; } later(); }).observe(document.body, { childList: true });
  const app = document.getElementById('app'); if (app) new MutationObserver(later).observe(app, { childList: true });
  window.addEventListener('resize', later); if (lqMQ && lqMQ.addEventListener) lqMQ.addEventListener('change', later);
  /* une réponse donnée (M.fb) ou une scène de vidéo qui change ne recrée pas toujours le lecteur : petit contrôle léger */
  document.addEventListener('click', () => setTimeout(later, 60), true); later(); })();
if (window.NT_DEBUG){ NT_DEBUG.nd = () => ({ ou: ND.where, verre: ND.glass, cle: ND.key, rayon: Math.round(ND.r), visible: !!(ND.el && ND.el.classList.contains('on')) });
  NT_DEBUG.ndPose = o => { cancelAnimationFrame(ND.raf); ND.raf = 0; Object.assign(ND, o); ndDraw(); }; }


/* ============================================================
   V52 — EFFET MIROIR SUR LES BOUTONS D'ACTION + ÉTIREMENT EN GELÉE (09/11/2026)
   Thomas : mélange A + B, tous les boutons d'action, « gelée qui suit le doigt ».
   - Bouton principal (blanc : « Lancer la mission », « Valider », « Continuer »…) :
     il reste plein, avec un bord arc-en-ciel et un reflet miroir (B).
   - Les autres (« Voir sur la carte », « Plus tard », « Passer la vidéo »…) :
     verre comme la barre (A) : flou de ce qui est derrière, liseré, reflet.
   - On appuie et on glisse : le bouton s'étire vers le doigt comme une gelée,
     le reflet suit le doigt, puis il revient en rebondissant. Un simple toucher :
     il s'écrase un peu puis rebondit. Sur ordinateur, le reflet suit la souris.
   - Rien n'est renommé : seules les classes .btn, .o-big-cta, .o-cta, .zv-skip (« Passer la vidéo ») et .askq (« Une question ? ») reçoivent
     l'effet ; le clic reste celui du site ; un glissé de plus de 40 px est un jeu, pas un clic.
   Repli : « réduire les animations » → l'effet miroir reste, sans étirement.
   Interrupteur : NT_FX.mirror = false.
   ============================================================ */
NT_FX.mirror = NT_FX.mirror !== false;
const MIR_SEL = '.btn, .o-big-cta, .o-cta, .zv-skip, .askq';
const MIR = { act: new Set(), st: new WeakMap(), raf: 0, last: 0, pd: null };
function mirSet(){ document.documentElement.classList.toggle('mir-on', !!NT_FX.mirror); }
mirSet();
const mirS = el => { let s = MIR.st.get(el); if (!s){ s = { x: 0, y: 0, sx: 1, sy: 1, vx: 0, vy: 0, vsx: 0, vsy: 0, tx: 0, ty: 0, tsx: 1, tsy: 1 }; MIR.st.set(el, s); } return s; };
/* étirement « élastique » : de moins en moins quand on tire loin */
const mirRub = a => Math.sign(a) * (1 - Math.exp(-Math.abs(a) * 1.6)) / (1 - Math.exp(-1.6));
const mirSheen = (el, x, r) => el.style.setProperty('--mx', Math.max(0, Math.min(100, (x - r.left) / r.width * 100)).toFixed(1) + '%');
function mirTarget(s, dx, dy, r, press){ const ax = Math.max(-1.6, Math.min(1.6, dx / Math.max(70, r.width * 0.45))), ay = Math.max(-1.6, Math.min(1.6, dy / Math.max(50, r.height * 1.2))), rx = mirRub(ax), ry = mirRub(ay);
  s.tx = 20 * rx; s.ty = 11 * ry;
  s.tsx = (press ? 0.975 : 1) + 0.14 * Math.abs(rx) - 0.05 * Math.abs(ry);
  s.tsy = (press ? 0.955 : 1) + 0.16 * Math.abs(ry) - 0.09 * Math.abs(rx); }
function mirKick(){ if (!MIR.raf) MIR.raf = requestAnimationFrame(mirLoop); }
function mirLoop(ts){ MIR.raf = 0; const dt = MIR.last ? Math.min(0.034, (ts - MIR.last) / 1000) : 1 / 60; MIR.last = ts; let any = false;
  MIR.act.forEach(el => { const s = mirS(el), held = MIR.pd && MIR.pd.el === el, k = held ? 520 : 260, c = held ? 30 : 11; let m = false;
    for (const [p, t] of [['x', 'tx'], ['y', 'ty'], ['sx', 'tsx'], ['sy', 'tsy']]){ const v = 'v' + p; s[v] += (k * (s[t] - s[p]) - c * s[v]) * dt; s[p] += s[v] * dt; if (Math.abs(s[t] - s[p]) > (p.length > 1 ? 0.0015 : 0.06) || Math.abs(s[v]) > (p.length > 1 ? 0.01 : 0.4)) m = true; }
    if (!el.isConnected || (!m && !held)){ el.classList.remove('mir-act'); el.style.removeProperty('--mirT'); MIR.act.delete(el); return; }
    el.style.setProperty('--mirT', `translate(${s.x.toFixed(2)}px,${s.y.toFixed(2)}px) scale(${s.sx.toFixed(4)},${s.sy.toFixed(4)})`); any = true; });
  if (any) MIR.raf = requestAnimationFrame(mirLoop); else MIR.last = 0; }
document.addEventListener('pointerdown', e => { if (!NT_FX.mirror || RM() || e.button > 0) return; const el = e.target.closest && e.target.closest(MIR_SEL); if (!el || el.disabled) return;
  const r = el.getBoundingClientRect(), s = mirS(el); MIR.pd = { el, id: e.pointerId, x0: e.clientX, y0: e.clientY, r }; mirTarget(s, 0, 0, r, true); mirSheen(el, e.clientX, r);
  el.classList.add('mir-act'); MIR.act.add(el); mirKick(); }, { passive: true });
document.addEventListener('pointermove', e => { const pd = MIR.pd;
  if (pd && e.pointerId === pd.id){ mirTarget(mirS(pd.el), e.clientX - pd.x0, e.clientY - pd.y0, pd.r, true); mirSheen(pd.el, e.clientX, pd.r); mirKick(); return; }
  /* souris : le reflet suit le pointeur au survol */
  if (e.pointerType === 'mouse' && NT_FX.mirror){ const el = e.target.closest && e.target.closest(MIR_SEL); if (el) mirSheen(el, e.clientX, el.getBoundingClientRect()); } }, { passive: true });
function mirUp(e){ const pd = MIR.pd; if (!pd || (e.pointerId !== undefined && e.pointerId !== pd.id)) return; MIR.pd = null; const s = mirS(pd.el); s.tx = 0; s.ty = 0; s.tsx = 1; s.tsy = 1;
  /* on a joué avec la gelée (doigt déplacé de plus de 40 px) : ce n'est pas un clic, même si on lâche sur le bouton */
  if (e.type === 'pointerup' && Math.hypot(e.clientX - pd.x0, e.clientY - pd.y0) > 40){ MIR.noClick = { el: pd.el, t: performance.now() }; }
  /* petit élan au lâcher : la gelée rebondit */ s.vsx -= 0.9 * (s.sx - 1) / 0.05; s.vsy -= 0.9 * (s.sy - 1) / 0.05; mirKick(); }
document.addEventListener('click', e => { const n = MIR.noClick; if (!n) return; MIR.noClick = null; if (performance.now() - n.t < 400 && e.target.closest && e.target.closest(MIR_SEL) === n.el){ e.stopPropagation(); e.preventDefault(); } }, true);
document.addEventListener('pointerup', mirUp, { passive: true }); document.addEventListener('pointercancel', mirUp, { passive: true });
if (window.matchMedia){ const rm = window.matchMedia('(prefers-reduced-motion: reduce)'); if (rm.addEventListener) rm.addEventListener('change', mirSet); }
if (window.NT_DEBUG){ NT_DEBUG.mir = () => ({ actif: document.documentElement.classList.contains('mir-on'), boutons: document.querySelectorAll(MIR_SEL).length, en_mouvement: MIR.act.size }); }


/* ============================================================
   V53 — DES QUESTIONS QUI FONT VRAIMENT APPRENDRE (09/11/2026)
   Thomas : « fais toutes ces améliorations ».
   Constat : dans 62 QCM sur 80, la bonne réponse était la plus longue (28 après), face à
   des réponses absurdes (« Une banque », « Nulle part »…) ; 54 vrai/faux « Vrai »
   pour 27 « Faux » ; aucune explication de l'erreur choisie.
   - QCM : mauvaises réponses crédibles (vraies erreurs de débutant), de longueur
     proche de la bonne ; la bonne réponse et son explication ne changent pas.
   - Pour chaque mauvaise réponse : « Pourquoi pas ta réponse » (affiché quand
     l'élève la choisit).
   - Vrai/faux : 14 affirmations vraies deviennent leur version fausse crédible
     (même notion, même explication, adaptée) → 40 « Vrai » / 41 « Faux ».
   Le texte d'origine des missions n'est pas modifié : tout est appliqué ici, au
   chargement. Interrupteur : NT_FX.quiz2 = false → questions d'avant.
   ============================================================ */
NT_FX.quiz2 = NT_FX.quiz2 !== false;
/* x : textes des mauvaises réponses, dans l'ordre où elles apparaissent (0 = on garde l'ancienne) ;
   w : « pourquoi pas » pour chacune, même ordre ; q : nouvelle question (rare) */
const QZ2 = {
'm1-1#2': { x: ['mettre son argent sur un livret pour qu’il rapporte sans aucun risque', 'acheter des biens qui gardent leur valeur, comme une voiture neuve'], w: ['Ça, c’est épargner : l’argent est protégé, mais il rapporte peu. Investir, c’est accepter que la valeur varie.', 'Une voiture perd de la valeur avec le temps : c’est une dépense, pas un placement.'] },
'm1-3#2': { x: ['Retirer ses gains chaque année pour les mettre de côté', 'Changer de placement dès qu’un autre a mieux marché'], w: ['Les gains retirés ne produisent plus rien : la boule de neige repart à chaque fois de plus petit.', 'Changer souvent coûte des frais et casse l’effet du temps : on rachète souvent ce qui a déjà monté.'] },
'm1-4#0': { x: [0, '800 €'], w: ['Le billet affiche toujours 1 000 €, mais avec des prix plus élevés il achète moins.', '2 % × 10 = 20 % d’un coup, c’est l’erreur classique : la hausse des prix se calcule chaque année sur des prix déjà plus hauts, d’où environ 820 €.'] },
'm1-5#2': { x: ['Parce que l’AMF le met à jour chaque jour', 'Parce qu’il suit les ventes de l’entreprise du jour'], w: ['L’AMF surveille les marchés, mais elle ne fixe aucun prix : ce sont les échanges qui le font.', 'Les ventes ne sont publiées que quelques fois par an. Le cours bouge chaque jour selon ce que les gens attendent.'] },
'm1-6#1': { x: ['Que ses dividendes soient supprimés', 'Qu’elle ne puisse jamais être revendue'], w: ['Une obligation ne verse pas de dividende : elle verse des intérêts (coupons) prévus d’avance.', 'La plupart des obligations peuvent être revendues avant l’échéance. Le risque principal reste que l’emprunteur ne rembourse pas.'] },
'm1-7#1': { x: ['Un fonds qui investit dans 40 grandes entreprises françaises', 'La liste des 40 entreprises les plus rentables de France'], w: ['Un indice ne possède rien : il mesure. Pour investir dessus, on passe par un fonds, par exemple un ETF.', 'Ce ne sont pas les plus rentables : ce sont parmi les plus grosses et les plus échangées de la Bourse de Paris.'] },
'm1-11#1': { x: ['Choisir l’action qui a le plus monté', 'Attendre d’avoir une grosse somme'], w: ['Ce qui a beaucoup monté peut aussi beaucoup baisser. Le temps et la régularité comptent plus.', 'Attendre fait perdre des années d’intérêts composés. Même de petits montants réguliers comptent.'] },
'm1-12#2': { x: ['Le montant de départ', 'Le nombre de placements'], w: ['Il compte, mais moins que le temps : une petite somme placée longtemps peut dépasser une grosse somme placée peu de temps.', 'Avoir plusieurs placements sert à répartir le risque, pas à faire grossir les intérêts.'] },
'm2-4#1': { x: [0, 0], w: ['42,48 € est un prix d’acheteur : un achat au marché prend le prix du meilleur vendeur.', '42,56 € ne serait atteint que si le meilleur vendeur n’avait pas assez de titres. Ici il en a 250 : tes 100 actions passent à 42,52 €.'] },
'm2-6#1': { x: [0, 'Il passe tout de suite à 42,00 €, ton prix'], w: ['Un ordre limité n’achète jamais au-dessus de ta limite : à 42,52 €, il ne passe pas.', 'Personne ne vend à 42,00 € pour l’instant : l’ordre attend. Fixer un prix ne force pas les vendeurs.'] },
'm2-10#1': { x: ['Dans le DIC de chaque action achetée', 'Sur les comparateurs, toujours complets'], w: ['Le DIC décrit un fonds (ses risques, ses frais). Les frais de ton courtier sont dans sa brochure tarifaire.', 'Les comparateurs aident, mais ils peuvent oublier des frais. La source complète, c’est la brochure du courtier.'] },
'm2-11#1': { x: ['La Bourse fixe un nouveau prix chaque matin', 'Les dividendes sont versés chaque matin'], w: ['La Bourse organise l’ouverture, mais le prix vient des ordres des acheteurs et des vendeurs.', 'Les dividendes sont versés une à quelques fois par an, pas chaque matin.'] },
'm3-2#1': { x: [0, 'évite les baisses du CAC 40 grâce à sa diversification'], w: ['Battre l’indice, c’est le but d’un fonds géré activement. Un ETF, lui, le copie.', 'Il suit l’indice dans les deux sens : si le CAC 40 baisse, l’ETF baisse aussi.'] },
'm3-3#2': { x: ['La brochure tarifaire du courtier', 'La fiche commerciale du fonds'], w: ['Elle donne les frais du courtier, pas les risques ni les frais du fonds.', 'Une fiche commerciale présente le fonds, mais le document officiel et obligatoire, c’est le DIC.'] },
'm3-4#1': { x: ['l’Europe de l’Ouest', 'les pays émergents'], w: ['L’Europe pèse beaucoup moins : dans un indice mondial, les grandes entreprises américaines prennent la plus grande place.', 'Beaucoup d’ETF « Monde » ne contiennent que des pays développés, sans les émergents (Chine, Inde…). Et quand ils y sont, ils pèsent bien moins que les États-Unis.'] },
'm3-10#1': { x: ['Un frais unique de 5 € payé une seule fois à l’achat'], w: ['5 € une seule fois, c’est peu. 1 % chaque année se répète sur un capital qui grossit : sur 20 ans, c’est bien plus.'] },
'm4-1#0': { x: [0, 0], w: ['10 M€, c’est le chiffre d’affaires : tout ce qui a été vendu, avant de payer les dépenses.', '9,2 M€, ce sont les dépenses. Le bénéfice, c’est ce qui reste : 10 − 9,2.'] },
'm4-4#1': { x: [0, 'elle verse un gros dividende'], w: ['Pas forcément : si les bénéfices grandissent vite, un PER élevé peut se justifier. On compare au secteur.', 'Le PER compare le prix au bénéfice : il ne dit rien du dividende.'] },
'm4-6#1': { x: ['agir avant que les autres réagissent', 'suivre l’avis le plus partagé en ligne'], w: ['Agir vite sur une info non vérifiée, c’est le piège des rumeurs. D’abord la source et la date.', 'Une info très partagée n’est pas forcément vraie : vérifie d’abord qui la publie et quand.'] },
'm4-7#1': { x: ['aux résultats seuls, qu’ils soient bons ou mauvais', 'à la taille de l’entreprise'], w: ['Des résultats en hausse peuvent faire baisser l’action s’ils sont moins bons que prévu : c’est l’écart avec les attentes qui compte.', 'Petite ou grande, une entreprise voit son action bouger selon l’écart entre ses résultats et ce qui était attendu.'] },
'm4-9#0': { x: ['l’entreprise devient forcément plus endettée', 'chaque actionnaire reçoit des actions gratuites en compensation'], w: ['Elle peut payer avec sa trésorerie, sans s’endetter. L’effet sûr, c’est qu’il reste moins d’actions.', 'Personne ne reçoit d’actions : il y en a simplement moins en circulation, donc chacune pèse un peu plus.'] },
'm4-11#4': { x: ['trop endettée pour investir', 'impossible à juger sans son cours'], w: ['2 ans de bénéfices pour rembourser, c’est généralement un niveau raisonnable. On compare quand même au secteur.', 'Le cours ne sert pas à juger la dette : on la compare aux bénéfices, ici 800 ÷ 400 = 2 ans.'] },
'm5-3#1': { x: [0, 'Excès de confiance'], w: ['Le FOMO, c’est la peur de rater une hausse : on achète trop vite. Ici, on refuse de vendre.', 'L’excès de confiance pousse à trop risquer. Ici, c’est la douleur de « réaliser » la perte qui bloque.'] },
'm5-6#1': { x: ['Suivre ses placements plusieurs fois par jour', 'Vendre dès la première baisse pour être tranquille'], w: ['Regarder trop souvent pousse à réagir aux variations du jour : c’est l’inverse de la patience.', 'Vendre à chaque baisse fait souvent vendre au plus bas. Un plan écrit dit quoi faire à l’avance.'] },
'm5-8#0': { x: ['Chaque jour, pour réagir vite', 'Jamais : on ne touche à rien pendant 15 ans'], w: ['Sur 15 ans, les variations du jour comptent peu, et réagir vite coûte souvent cher.', 'Sans contrôle, la répartition dérive et le risque change. Quelques points par an suffisent.'] },
'm6-4#1': { x: ['Je lui demande son nom pour vérifier son identité', 'J’accepte si le numéro affiché est bien celui de ma banque'], w: ['Un escroc a toujours un nom et un discours prêts. Seul le numéro officiel, que tu composes toi-même, est sûr.', 'Le numéro affiché peut être falsifié. On raccroche et on rappelle soi-même.'] },
'm6-6#1': { x: ['Ils sont réservés aux professionnels', 'Ils ne sont surveillés par aucune autorité, même en France'], w: ['Ils sont accessibles aux particuliers, et c’est bien le problème : le levier fait perdre très vite.', 'Les plateformes autorisées sont surveillées (en France, par l’AMF). Le danger vient du levier, qui multiplie les pertes.'] },
'm6-8#1': { x: ['Payer un service qui promet de récupérer les fonds', 'Contacter la plateforme pour négocier un remboursement'], w: ['C’est souvent une seconde arnaque : ces « récupérateurs » réclament des frais et disparaissent.', 'Les escrocs promettent souvent un remboursement contre de nouveaux frais. On porte plainte et on prévient sa banque.'] },
'm7-4#2': { x: ['Chaque semaine, pour coller exactement à son plan', 'Seulement quand les marchés baissent fortement'], w: ['Trop souvent : chaque mouvement coûte des frais, pour une précision qui n’apporte presque rien.', 'On rééquilibre aussi après des hausses : c’est un rythme régulier, pas une réaction à la peur.'] },
'm7-11#3': { x: ['Vendre dès les premières baisses', 'Avoir choisi les meilleures actions'], w: ['Vendre au début d’une crise fait souvent rater la reprise. Ce qui protège : répartition, plan, horizon.', 'Personne ne sait à l’avance lesquelles résisteront. La répartition protège sans avoir besoin de deviner.'] },
'm8-3#2': { x: ['garantit le capital, comme le fonds euros', 'est bloquée pendant 8 ans'], w: ['C’est le fonds euros qui garantit le capital. Les unités de compte peuvent baisser.', 'L’assurance-vie n’est pas bloquée : après 8 ans, la fiscalité devient plus douce, c’est tout.'] },
'm8-4#1': { x: ['Ils rapportent chaque année un taux garanti fixé par l’État', 'On peut les retirer quand on veut, sans impôt'], w: ['Ça, c’est un livret réglementé. Un PER est investi : sa valeur peut varier selon les supports.', 'L’argent est bloqué jusqu’à la retraite, sauf cas prévus, et la sortie sera imposée.'] },
'm8-8#1': { x: ['Un impôt spécial sur les plus-values', 'Le formulaire pour ouvrir un compte-titres'], w: ['Ce n’est pas un impôt : c’est un document qui récapitule dividendes et plus-values pour ta déclaration.', 'On le reçoit chaque année, une fois le compte ouvert. Il sert à préparer la déclaration de revenus.'] },
'm9-2#1': { x: ['La part des clients qui gagnent de l’argent chaque mois', 'Le gain moyen réalisé par les clients sur une année'], w: ['Le chiffre affiché est la part des comptes qui PERDENT de l’argent, et il est souvent très élevé.', 'Aucun gain moyen n’est affiché : la mention obligatoire porte sur les comptes perdants.'] },
'm9-2#2': { x: ['adaptés s’il garde un petit levier', 'un bon moyen de se diversifier'], w: ['Même avec un petit levier, ce sont des produits de court terme, coûteux à garder longtemps.', 'On se diversifie avec des placements de long terme comme les ETF, pas avec des produits spéculatifs.'] },
'm9-5#1': { x: ['Le gain est illimité : on est tenté de trop miser', 'On ne peut racheter qu’à une date fixée à l’avance'], w: ['C’est l’inverse : le gain est limité (un cours ne descend pas sous zéro), alors que la perte, elle, n’a pas de limite si le cours monte.', 'On peut racheter à tout moment pour fermer la position. Le vrai danger : un cours peut monter sans limite, donc la perte aussi.'] },
'm10-2#0': { x: ['une heure de cotation', 'un échange entre deux personnes'], w: ['Ça, c’est un graphique « 1 heure ». Sur « 1 jour », chaque bougie résume une journée.', 'Une bougie résume TOUS les échanges d’une période : ouverture, clôture, plus haut, plus bas.'] },
'm10-2#2': { x: ['les graphiques à la minute, pour bien entrer', 'uniquement le cours du jour'], w: ['Sur un horizon de plusieurs années, les variations à la minute sont du bruit.', 'Un seul cours ne montre pas la tendance : il faut une vue longue, en semaines ou en mois.'] },
'm10-5#0': { x: ['la variation du prix sur la période', 'le nombre d’ordres en attente dans le carnet'], w: ['La variation, c’est l’écart de prix. Le volume compte combien de titres ont changé de main.', 'Ça, c’est ce qu’affiche le carnet d’ordres : des ordres pas encore exécutés. Le volume compte les échanges réalisés.'] },
'm10-6#1': { x: [0, 'aucune : l’échelle ne change rien au dessin'], w: ['En linéaire, +10 € pèse pareil à 20 € qu’à 1 000 € : sur 20 ans, les débuts paraissent tout plats.', 'Elle change tout : en logarithmique, une même distance = un même %, ce qui rend 20 ans lisibles.'] },
'm10-7#2': { x: ['J’achète tout de suite, le signal est clair', 'Je vends, le support va sûrement casser'], w: ['Une figure est un indice, pas une certitude : on attend une confirmation et on prépare un stop.', 'Rien n’indique une cassure : une figure haussière sur un support suggère plutôt un rebond, à confirmer.'] },
'm11-2#1': { x: ['un prix exact que le cours ne peut pas casser', 'le prix le plus bas de toute l’histoire'], w: ['C’est une zone, et elle peut casser : on prévoit toujours un stop.', 'Un support peut être à n’importe quel niveau : c’est une zone où les acheteurs sont revenus plusieurs fois.'] },
'm11-3#2': { x: ['achète dès que le prix touche le niveau, pour être le premier', 'renforce sa position si le prix repasse sous le niveau'], w: ['Entrer au premier contact expose aux fausses cassures. Attendre une clôture filtre une partie des pièges.', 'Si le prix repasse sous le niveau, la cassure a échoué : on applique le stop au lieu d’ajouter.'] },
'm11-4#0': { x: [0, 'la moyenne des 20 plus hauts de l’année'], w: ['Une moyenne regarde le passé : elle ne prévoit rien.', 'Elle utilise les 20 dernières clôtures, pas les plus hauts : elle lisse le prix récent.'] },
'm11-5#1': { x: ['« suracheté » : forte hausse récente', 'un signal d’achat sûr'], w: ['Suracheté, c’est au-dessus de 70. Sous 30, on parle de survendu.', 'Ce n’est qu’un indice : une baisse peut continuer longtemps.'] },
'm11-6#0': { x: ['le prix et le volume échangé sur les 26 dernières séances', 'le plus haut et le plus bas des 12 dernières séances'], w: ['Le MACD n’utilise pas le volume : il compare deux moyennes mobiles du prix.', 'D’autres indicateurs utilisent les plus hauts et plus bas. Le MACD, lui, compare deux moyennes mobiles exponentielles.'] },
'm11-6#2': { x: ['Le plus possible, pour confirmer', 'Un nouveau après chaque perte'], w: ['Empiler des indicateurs qui disent souvent la même chose donne une fausse impression de certitude.', 'Changer d’outil après chaque perte empêche d’en maîtriser un seul. On garde 2 ou 3 outils et on les apprend.'] },
'm11-7#1': { x: ['Prévoir le prix exact de demain', 'Se passer de stop grâce aux signaux'], w: ['Aucun outil ne prévoit le prix exact. L’analyse technique aide à structurer la décision.', 'Les signaux se trompent souvent : le stop reste indispensable.'] },
'm12-1#0': { x: ['un ordre qui vend automatiquement quand le gain prévu est atteint', 'une protection qui garantit le prix de vente exact'], w: ['Ça, c’est un objectif de gain (« take profit »). Le stop-loss, lui, limite la perte.', 'En cas de saut de prix, la vente peut se faire plus bas que le stop : il limite la perte, il ne garantit pas le prix.'] },
'm12-2#2': { x: ['Pour gagner plus souvent : un petit risque rend chaque trade plus sûr', 'Parce que les courtiers l’imposent à tous leurs clients particuliers'], w: ['La taille du risque ne change pas la part de trades gagnants. Elle permet de tenir pendant les mauvaises séries.', 'Aucune règle ne l’impose : c’est une discipline que le trader se donne pour rester dans la partie.'] },
'm12-4#1': { q: 'Avec un ratio de 3, combien de gagnants sur 10 trades faut-il au minimum pour ne pas perdre (hors frais) ?', x: [0, '2 sur 10'], w: ['5 suffit, mais ce n’est pas le minimum : avec 3 gagnants, +9 − 7 = +2.', 'Avec 2 gagnants : +6 − 8 = −2, encore une perte. Il en faut 3.'] },
'm12-6#2': { x: ['la plus grosse perte sur un seul trade', 'la baisse moyenne des trades perdants'], w: ['Le drawdown additionne les pertes à la suite, depuis un sommet du capital, pas un seul trade.', 'Ça, c’est une moyenne : le drawdown maximal mesure la pire chute du capital.'] },
'm12-8#3': { x: [0, 'Je rachète au même prix en attendant la remontée'], w: ['C’est le « revenge trading » : on augmente le risque sous le coup de l’émotion.', 'Racheter tout de suite revient à annuler son stop : la perte peut grossir. On note, on analyse, puis on suit son plan.'] },
'm13-1#1': { x: ['Pour être sûr que chaque trade gagne', 'Parce que le courtier le demande'], w: ['Un plan n’empêche pas les pertes : il évite les décisions prises sous le stress.', 'Aucun courtier ne le demande : c’est un outil pour toi, pour décider avant l’émotion.'] },
'm13-3#1': { x: [0, 'Changer de stratégie tout de suite'], w: ['C’est le chemin classique vers la grosse perte : la colère pousse à trop risquer.', 'Trois pertes peuvent arriver avec une bonne stratégie. On fait une pause et on relit le journal avant de changer quoi que ce soit.'] },
'm13-4#0': { x: ['connaître à l’avance le résultat des annonces', 'savoir quels jours la Bourse est fermée'], w: ['Il donne les dates, pas les résultats : personne ne connaît le chiffre avant sa publication.', 'Les jours de fermeture sont dans le calendrier de la Bourse. Le calendrier économique liste les annonces : taux, inflation, emploi, résultats.'] },
'm13-5#1': { x: ['le scalping, à la pause déjeuner', 'le day trading avec des alertes sur le téléphone'], w: ['Le scalping demande d’être devant l’écran en continu. Le swing se gère le soir.', 'Le day trading demande de surveiller toute la journée : peu compatible avec un travail.'] },
'm13-8#0': { x: ['Je le prends, mais avec un risque réduit de moitié', 'Je le prends : un signal aussi clair est une exception'], w: ['La règle dit stop pour aujourd’hui, même pour un petit risque : c’est justement ces jours-là qu’elle protège.', 'Le « super signal » qui justifie une exception, c’est exactement le piège que la règle évite.'] },
'm14-2#0': { x: ['tester une stratégie en direct avec de l’argent réel', 'simuler les prix futurs pour prévoir les gains'], w: ['Ça, c’est trader en réel. Le backtest se fait sur le passé, sans argent engagé.', 'Un backtest regarde le passé. Il ne prévoit rien : le futur peut être différent.'] },
'm14-3#1': { x: ['Refaire le test plusieurs fois sur la même période, pour vérifier', 'Ajouter des réglages pour mieux coller au passé'], w: ['Refaire le test sur les mêmes données redonne le même résultat flatteur. Il faut des données nouvelles.', 'Plus on ajuste au passé, plus on risque le sur-ajustement : c’est le problème, pas la solution.'] },
'm14-3#2': { x: ['une bonne pratique : les données sont plus propres', 'le biais de confirmation : on cherche ce qui arrange'], w: ['Les entreprises disparues manquent : le passé paraît plus rose qu’il ne l’était.', 'Le biais de confirmation existe, mais ici le problème vient des entreprises disparues absentes du test : c’est le biais du survivant.'] },
'm14-3#3': { x: ['Confiance : 2 ans de données, c’est suffisant', 'Je garde seulement la meilleure année et je relance'], w: ['2 ans et 15 réglages, c’est le profil typique d’un résultat trop ajusté. On teste hors échantillon.', 'Garder la meilleure année aggrave le problème : on choisit encore le passé qui arrange.'] },
'm14-4#2': { x: ['plus de la moitié des trades sont gagnants', 'la stratégie gagnera aussi à l’avenir'], w: ['Pas forcément : on peut gagner plus avec peu de trades gagnants s’ils rapportent beaucoup. Le facteur compare des montants.', 'Il décrit le passé. Il faut aussi assez de trades et un test hors échantillon.'] },
'm14-5#0': { x: ['Oui, 100 % de réussite, c’est solide', 'Oui, si chaque trade avait un stop'], w: ['Le hasard peut donner 5 gains de suite. Il faut des dizaines, voire des centaines de trades.', 'Le stop limite les pertes, il ne prouve rien sur la stratégie. L’échantillon reste trop petit.'] },
'm14-5#2': { x: ['Non, sauf si la stratégie est mauvaise'], w: ['Même une bonne stratégie connaît de longues séries de pertes : c’est pour ça qu’on risque peu par trade.'] },
'm14-6#0': { x: [0, 'divisent le risque par deux'], w: ['Des positions corrélées bougent ensemble : elles ne se compensent pas, elles s’additionnent.', 'Deux banques réagissent souvent aux mêmes nouvelles : c’est presque un seul gros trade, pas un risque divisé.'] },
'm14-6#2': { x: ['Aucune limite globale, puisque chaque trade a déjà son propre stop', 'Un seul trade par semaine, pas plus'], w: ['Même avec des stops, 10 positions à 1 % = 10 % de risque si tout casse en même temps.', 'Le nombre de trades ne dit rien du risque engagé : on limite le risque total ouvert.'] },
'm14-7#1': { x: ['Fiable, si les 12 trades sont récents', 'Fiable : les frais ne changent presque rien au résultat'], w: ['Récents ou pas, 12 trades c’est trop peu, et sans frais le résultat est trop beau.', 'Les frais pèsent sur chaque trade : sur une stratégie active, ils peuvent faire basculer le résultat.'] },
'm15-1#0': { x: ['un droit, sans obligation, d’acheter à un prix fixé', 'une action d’entreprise qui ne sera cotée qu’à une date future'], w: ['Ça, c’est une option. Le future est un engagement : les deux parties doivent l’exécuter.', 'Ce n’est pas une action : c’est un contrat sur un actif (blé, indice, pétrole…) à une date future.'] },
'm15-1#1': { x: ['Un trader qui parie sur la hausse du blé', 'Un épargnant qui cherche un placement garanti à long terme'], w: ['Parier sur la hausse, c’est spéculer. Se couvrir, c’est fixer un prix pour se protéger, comme le producteur.', 'Les futures ne garantissent rien et utilisent souvent un levier : ce n’est pas un placement d’épargne.'] },
'm15-3#2': { x: ['risque au maximum la prime qu’il a reçue au départ', 'est protégé si l’action monte'], w: ['La prime, c’est son gain maximal, pas sa perte. Si l’action s’envole, sa perte n’a pas de limite.', 'C’est l’inverse : si l’action monte au-dessus du prix d’exercice, il perd, et sans limite.'] },
'm15-4#0': { x: ['profiter d’une hausse en engageant moins d’argent', 'toucher un revenu chaque mois'], w: ['Ça, c’est l’achat d’un call. Le put prend de la valeur quand l’action baisse.', 'Acheter un put coûte une prime : on paie pour être protégé, on ne touche pas de revenu.'] },
'm15-4#2': { x: ['Elles coûtent toujours plus cher que d’acheter directement l’action', 'On ne peut les revendre qu’à l’échéance, jamais avant'], w: ['Une option coûte souvent bien moins qu’une action. Le risque vient de sa valeur qui varie vite et peut tomber à zéro.', 'On peut les revendre avant. Mais le temps joue contre l’acheteur : elles perdent un peu de valeur chaque jour.'] },
'm15-5#0': { x: [0, 'ne change pas, le coupon étant fixe'], w: ['C’est l’inverse : les nouvelles obligations rapportent plus, donc les anciennes valent moins.', 'Le coupon reste fixe, et c’est justement pour ça que le prix baisse : il doit s’ajuster pour rester attractif.'] },
'm15-5#1': { x: ['Le gouvernement de chaque pays', 'La Commission européenne'], w: ['Dans la zone euro, les gouvernements ne fixent pas les taux directeurs : c’est la BCE, indépendante.', 'La Commission propose des lois et surveille les budgets. Les taux directeurs, c’est la BCE.'] },
'm15-6#0': { x: [0, 'créer plus de monnaie'], w: ['Baisser les taux relance le crédit et la demande : les prix monteraient encore plus.', 'Créer plus de monnaie alimente plutôt l’inflation. Pour la freiner, on monte les taux.'] },
'm15-6#1': { x: [0, 'Les éditeurs de logiciels'], w: ['Elles vendent le pétrole : un prix plus haut les avantage souvent.', 'Leurs coûts dépendent peu du pétrole. Les compagnies aériennes, elles, achètent énormément de kérosène.'] },
'm15-6#3': { x: ['les entreprises européennes qui vendent aux États-Unis', 'les touristes américains en Europe'], w: ['Au contraire : leurs ventes en dollars valent plus d’euros, ce qui les aide souvent.', 'Avec un dollar plus fort, ils peuvent acheter plus en Europe : ils en profitent.'] },
'm15-7#3': { x: ['J’entre tout de suite pour profiter du mouvement', 'J’entre, mais je retire mon stop pour ne pas être sorti'], w: ['Personne ne sait dans quel sens le prix partira, et il peut sauter au-delà de ton stop.', 'Sans stop, un saut de prix peut coûter très cher. On attend l’annonce.'] },
'm15-7#4': { x: ['Un indicateur fiable, suivi à la lettre à chaque signal', 'Un gros capital de départ pour encaisser'], w: ['Aucun indicateur n’est fiable à chaque fois. Ce qui fait durer : peu de risque, un plan, un journal.', 'Un gros capital s’use aussi vite si on risque trop. La méthode compte plus que le montant.'] },
};
/* vrai/faux : affirmations vraies passées en version fausse crédible (même notion) */
const VF2 = {
'm1-4#2': ['L’inflation, c’est la hausse du prix d’un seul produit, comme l’essence.', 'L’inflation, c’est la hausse générale des prix, pas d’un seul produit. C’est pour cela qu’un argent qui ne rapporte rien perd lentement de sa valeur.'],
'm1-6#2': ['Si les taux d’intérêt montent, le prix des obligations déjà émises a tendance à monter.', 'Il a tendance à baisser. Les nouvelles obligations rapportent plus : les anciennes, moins rémunératrices, valent moins.'],
'm1-7#2': ['Une entreprise cotée en bourse ne peut pas faire faillite.', 'Être coté ne protège de rien. C’est pour cela qu’on diversifie.'],
'm2-4#2': ['Sur une petite entreprise peu échangée, le spread est souvent plus étroit.', 'Il est souvent plus large. Moins d’acheteurs et de vendeurs = écart plus grand.'],
'm3-2#2': ['Un ETF ne peut pas perdre de valeur, puisqu’il est diversifié.', 'Si l’indice baisse, l’ETF baisse aussi. La diversification réduit le risque, elle ne le supprime pas.'],
'm4-7#0': ['Quand le bénéfice d’une entreprise progresse, son cours monte forcément.', 'Si le marché attendait mieux, la déception peut faire baisser le cours.'],
'm8-4#0': ['L’argent d’un PER peut être retiré à tout moment, comme sur un livret.', 'Il est en principe bloqué jusqu’à la retraite, sauf cas prévus par la loi (achat de la résidence principale, invalidité, surendettement, fin des droits au chômage…).'],
'm11-4#2': ['Une moyenne mobile annonce les mouvements avant qu’ils arrivent.', 'Elle est calculée sur le passé, donc elle réagit avec retard. Elle confirme, elle ne prédit pas.'],
'm11-6#1': ['Les indicateurs techniques permettent de connaître les prix futurs.', 'Ils sont calculés à partir des données passées. Ils décrivent ce qui s’est passé ; aucun ne voit l’avenir.'],
'm12-3#2': ['Plus le stop est loin, plus la position peut être grosse pour garder le même risque.', 'C’est l’inverse. Taille = risque en € ÷ distance au stop : plus le stop est loin, plus la position doit être petite.'],
'm13-6#2': ['Trader souvent coûte peu : chaque ordre ne coûte que quelques euros.', 'Quelques euros répétés sur des centaines d’ordres finissent par peser lourd. Plus on trade, plus on paie de frais, même si on ne gagne pas plus : les frais sont certains, les gains ne le sont pas.'],
'm14-5#1': ['Quelques trades suffisent pour juger une stratégie.', 'Il en faut beaucoup. La chance « s’efface » seulement sur un grand nombre de trades.'],
'm15-2#1': ['L’acheteur d’une option peut perdre beaucoup plus que la prime payée.', 'Au pire, l’option ne vaut plus rien à l’échéance et il perd la prime. C’est le vendeur qui peut perdre beaucoup plus.'],
'm15-5#3': ['Une baisse des taux directeurs rend en général le crédit plus cher.', 'Elle le rend en général moins cher. Les banques empruntent moins cher et prêtent souvent moins cher.'],
};
/* ---------- application au chargement (les missions sont déjà dans window.NT_MISSIONS) ---------- */
const QZ2_LOG = { qcm: 0, vf: 0, manquants: [] };
if (NT_FX.quiz2) (window.NT_MISSIONS || []).forEach(m => (m.steps || []).forEach((st, i) => { const k = m.id + '#' + i, e = QZ2[k], v = VF2[k];
  if (e && st.type === 'qcm' && Array.isArray(st.choices)){ const wrong = st.choices.map((_, j) => j).filter(j => j !== st.answer);
    if (wrong.length !== e.x.length || wrong.length !== e.w.length){ QZ2_LOG.manquants.push(k + ' (nombre de réponses)'); return; }
    const ch = st.choices.slice(), why = st.choices.map(() => null); wrong.forEach((j, n) => { if (e.x[n]) ch[j] = e.x[n]; why[j] = e.w[n]; });
    if (new Set(ch).size !== ch.length){ QZ2_LOG.manquants.push(k + ' (doublon)'); return; }
    st.choices = ch; st.why = why; if (e.q) st.q = e.q; QZ2_LOG.qcm++; }
  else if (v && st.type === 'vf' && st.answer === true){ st._orig = { q: st.q, answer: true, explain: st.explain }; st.q = v[0]; st.answer = false; st.explain = v[1]; QZ2_LOG.vf++; } }));
if (NT_FX.quiz2) Object.keys(QZ2).concat(Object.keys(VF2)).forEach(k => { const [id, i] = k.split('#'), m = (window.NT_MISSIONS || []).find(x => x.id === id); if (!m || !m.steps || !m.steps[+i]) QZ2_LOG.manquants.push(k + ' (introuvable)'); });
/* les vidéos racontent la notion juste : pour un vrai/faux retourné, elles gardent l'affirmation vraie d'origine
   (la question pose ensuite la version fausse : on vérifie qu'on a compris, pas qu'on a retenu une phrase) */
const qz2Orig = m => !m || !Array.isArray(m.steps) || !m.steps.some(x => x && x._orig) ? m : Object.assign({}, m, { steps: m.steps.map(x => x && x._orig ? Object.assign({}, x, x._orig) : x) });
const _zNotionsV52 = zNotions; zNotions = function(m){ return _zNotionsV52(qz2Orig(m)); };
const _v5ScriptV52 = v5Script; v5Script = function(m){ return _v5ScriptV52(qz2Orig(m)); };
/* le mélange des réponses à l'écran garde chaque « pourquoi » avec sa réponse */
const _prepV52 = prep;
prep = function(st, key, attempt, si){ const c = _prepV52(st, key, attempt, si); if (st.why && Array.isArray(c.choices) && Array.isArray(st.choices)) c.why = c.choices.map(x => st.why[st.choices.indexOf(x)] || null); return c; };
/* « Pourquoi pas ta réponse » sous la correction */
const _fbHTMLV52 = fbHTML;
fbHTML = function(){ let s = _fbHTMLV52(); try { const fb = M.fb, st = M.steps[M.i], u = M.ui || {}, w = fb && !fb.ok && M.mode !== 'exam' && st && st.why && u.sel != null ? st.why[u.sel] : null;
    if (w){ const p = `<p class="why2"><b>Pourquoi pas ta réponse :</b> ${h(w)}</p>`; s = /<p class="mine">[\s\S]*?<\/p>/.test(s) ? s.replace(/(<p class="mine">[\s\S]*?<\/p>)/, '$1' + p) : s.replace('</b>', '</b>' + p); } } catch(e){}
  return s; };
if (window.NT_DEBUG){ NT_DEBUG.quiz2 = () => QZ2_LOG; }


/* ============================================================
   V54 — VIDÉOS : MOINS DE RÉPÉTITIONS + UNE VOIX (09/11/2026)
   Thomas : « fais toutes ces améliorations ».
   1. Rappel au lieu de répéter (NT_FX.vidrappel) : chaque vidéo relisait la fiche de
      cours en entier, même quand l'élève avait déjà fait une mission sur cette fiche
      (490 scènes répétées sur 1 506, soit 53 min sur 2 h 34 de vidéo).
      Si une autre mission de la même fiche est déjà terminée, la fiche, l'exemple et
      « À retenir » sont remplacés par UNE scène « Rappel » (les points à retenir).
      La première fois, la vidéo reste complète. Les questions de la mission restent.
   2. Voix (NT_FX.vidvoice) : bouton haut-parleur en haut de la vidéo. La voix de
      l'appareil (synthèse vocale du téléphone ou de l'ordinateur, gratuite, sans
      serveur) lit chaque scène ; la scène suivante attend la fin de la phrase.
      Coupée par défaut ; le choix est gardé. Pause, scène suivante, « Passer la
      vidéo », quitter : la voix s'arrête net. Suit la vitesse 0,75× à 1,5×.
      La musique baisse pendant que la voix parle.
   ============================================================ */
NT_FX.vidrappel = NT_FX.vidrappel !== false;
NT_FX.vidvoice = NT_FX.vidvoice !== false;

/* ---------- 1. Rappel au lieu de relire toute la fiche ---------- */
const v54Key = t => norm(t).replace(/[^a-z0-9]+/g, '').slice(0, 42);
const v54Fiche = m => m && m.ch ? (ficheFor(m.id) || CO.find(x => x.ch === m.ch && x.ms.includes(m.id)) || null) : null;
const v54Seen = (m, f) => !!(S.done && f.ms.some(id => id !== m.id && S.done[id]));
const _v5ScriptV53 = v5Script;
v5Script = function(m){ const sc = _v5ScriptV53(m); try {
    if (!NT_FX.vidrappel || !m || !m.ch || m.session) return sc; const f = v54Fiche(m); if (!f || !v54Seen(m, f)) return sc;
    const keys = new Set(); (f.body || []).forEach(p => { keys.add(v54Key(p)); v5Parts(p).forEach(x => keys.add(v54Key(x))); });
    const isF = s => (s.eb === 'Le cours' && keys.has(v54Key(s.t))) || (s.eb === 'Exemple' && !!f.ex && v54Key(s.t) === v54Key(f.ex)) || (s.eb === 'À retenir' && s.tpl === 'recap');
    const first = sc.findIndex(isF); if (first < 0) return sc;
    const items = (f.key && f.key.length ? f.key : (f.body || []).map(p => firstSents(p, 12))).slice(0, 3);
    const rap = v5Scene({ k: 'recap', eb: 'Rappel · ' + f.title, head: 'Rappel', items, t: items.join(' ') }, first, []); rap.rappel = true;
    const out = sc.filter(s => !isF(s)); out.splice(first, 0, rap); return out;
  } catch(e){ return sc; } };

/* ---------- 2. la voix ---------- */
const VV = { on: false, tok: 0, n: 0, last: '', speaking: false };
try { VV.on = localStorage.getItem('nt-vvoice') === '1'; } catch(e){}
const vvOK = () => !!NT_FX.vidvoice && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
const vvActive = () => vvOK() && VV.on && !!(M && M.vid && M.vid.v5);
function vvVoice(){ let L = []; try { L = speechSynthesis.getVoices() || []; } catch(e){}
  return L.find(v => /^fr[-_]FR/i.test(v.lang) && v.localService) || L.find(v => /^fr[-_]FR/i.test(v.lang)) || L.find(v => /^fr\b/i.test(v.lang)) || null; }
/* ce qu'on lit à voix haute : symboles en mots, nombres d'un seul tenant */
const vvSay = t => String(t || '').replace(/(\d)[   ](?=\d{3}\b)/g, '$1').replace(/(\d)[   ](?=\d{3}\b)/g, '$1')
  .replace(/\s?Md€/g, ' milliards d’euros').replace(/\s?M€/g, ' millions d’euros').replace(/\s?k€/g, ' mille euros').replace(/\s?€/g, ' euros')
  .replace(/\s?%/g, ' pour cent').replace(/×/g, ' fois ').replace(/÷/g, ' divisé par ').replace(/−/g, ' moins ').replace(/≈/g, ' environ ').replace(/\s=\s/g, ' égale ').replace(/→/g, ', ')
  .replace(/[«»“”"]/g, '').replace(/·/g, ', ').replace(/…/g, '.').replace(/\s+/g, ' ').trim();
function vvDuck(on){ try { if (V6M && V6M.g) V6M.g.gain.setTargetAtTime(on ? 0.3 : 0.9, V6M.c.currentTime, 0.25); } catch(e){} }
function vvStop(){ VV.tok++; VV.speaking = false; try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch(e){} vvDuck(false); }
function vvSpeak(text, done){ vvStop(); const my = VV.tok, say = vvSay(text); if (!say){ if (done) done(); return; }
  const fin = () => { if (VV.tok !== my) return; VV.tok++; VV.speaking = false; vvDuck(false); if (done) done(); };
  try { const u = new SpeechSynthesisUtterance(say), v = vvVoice(); u.lang = v ? v.lang : 'fr-FR'; if (v) u.voice = v;
    u.rate = Math.max(0.7, Math.min(1.6, (typeof v8Speed === 'function' ? v8Speed() : 1) * 1.02)); u.pitch = 1; u.onend = fin; u.onerror = fin;
    VV.speaking = true; VV.n++; VV.last = say; vvDuck(true); speechSynthesis.speak(u); } catch(e){ fin(); } }
/* le texte d'une scène, tel qu'on le voit : titre, question, réponse, explication */
function vvSceneText(s, off, k){ if (off > 0){ const rest = (s.words || []).filter((_, i) => (s.times[i] || 0) * k >= off); return rest.join(' '); }
  const P = [], dot = x => { x = String(x || '').trim(); if (x) P.push(/[.?!:]$/.test(x) ? x : x + '.'); };
  if (s.tpl === 'go'){ dot(s.t); dot(s.eb); return P.join(' '); }
  if (s.tpl === 'title'){ dot(s.head); dot(s.t); return P.join(' '); }
  if (s.rappel) dot('Petit rappel du cours');
  else if (s.head && !/^(À retenir|Rappel)$/.test(s.head)) dot(s.head);
  if (s.q) dot(s.q);
  if (s.tpl === 'qa' && s.qaGood) dot('Réponse : ' + s.qaGood);
  if (s.tpl === 'vf' && s.vfAns != null) dot(s.vfAns ? 'Vrai' : 'Faux');
  dot(s.t); return P.join(' '); }
/* garder dans la scène la bonne réponse (qa) et vrai / faux (vf), pour les dire */
const _v5SceneV53 = v5Scene; v5Scene = function(it, idx, L){ const r = _v5SceneV53(it, idx, L); if (r && it){ if (it.k === 'qa' && it.choices && it.a != null) r.qaGood = it.choices[it.a]; if (it.k === 'vf' && it.ans != null) r.vfAns = !!it.ans; } return r; };
/* la scène suivante attend la fin de la phrase (et un filet de 20 s si la voix ne répond pas) */
const _v6SchedV53 = v6Sched;
v6Sched = function(V, el, off){ _v6SchedV53(V, el, off); clearTimeout(V.vvCap); if (!vvActive() || M.vid !== V){ if (VV.speaking) vvStop(); return; }
  const s = V.sc[V.i], my = V.tok, k = V.k || 1, wait = Math.max(0, s.ms * k - off); let timeUp = false, spoken = false;
  const adv = () => { if (!M || M.vid !== V || V.tok !== my || V.paused || V.hold || !timeUp || !spoken) return; clearTimeout(V.vvCap); if (V.i >= V.sc.length - 1) return vidEnd(); V.i++; v5Run(); };
  if (!V.hold){ clearTimeout(V.t); V.t = setTimeout(() => { timeUp = true; adv(); }, wait); }
  V.vvCap = setTimeout(() => { spoken = true; adv(); }, wait + 20000);
  vvSpeak(vvSceneText(s, off, k), () => setTimeout(() => { spoken = true; adv(); }, 350)); };
const _v6PauseV53 = v6Pause; v6Pause = function(why){ _v6PauseV53(why); const V = M && M.vid; if (V && V.paused){ clearTimeout(V.vvCap); vvStop(); } };
const _vidEndV53 = vidEnd; vidEnd = function(){ const V = M && M.vid; if (V) clearTimeout(V.vvCap); vvStop(); return _vidEndV53(); };
const _closePlayerV53 = closePlayer; closePlayer = function(){ const V = M && M.vid; if (V) clearTimeout(V.vvCap); vvStop(); return _closePlayerV53(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && VV.speaking) vvStop(); });
/* le bouton haut-parleur, à côté de la vitesse */
const VV_IC = { on: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.2 6.5a7.8 7.8 0 0 1 0 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>' };
function vvBtn(b){ b.innerHTML = VV.on ? VV_IC.on : VV_IC.off; b.setAttribute('aria-pressed', String(VV.on)); b.setAttribute('aria-label', VV.on ? 'Voix activée : couper la voix' : 'Voix coupée : faire lire la vidéo'); b.title = VV.on ? 'Couper la voix' : 'Lire à voix haute'; }
function vvToggle(){ VV.on = !VV.on; try { localStorage.setItem('nt-vvoice', VV.on ? '1' : '0'); } catch(e){} document.querySelectorAll('.v54-vx').forEach(vvBtn);
  if (VV.on && !vvVoice()) toast('Voix de l’appareil : si tu n’entends rien, ajoute une voix française dans les réglages du téléphone.');
  const V = M && M.vid; if (!V || !V.v5 || !V.el) return; if (!VV.on){ vvStop(); clearTimeout(V.vvCap); }
  if (!V.paused && V.t0 != null) v6Sched(V, V.el, Math.max(0, performance.now() - V.t0)); }
const _v5ShellV53 = v5Shell; v5Shell = function(V){ _v5ShellV53(V); if (!vvOK()) return; const top = document.querySelector('#player .v5 .v5-top'); if (!top || top.querySelector('.v54-vx')) return;
  const b = document.createElement('button'); b.className = 'v54-vx'; b.type = 'button'; vvBtn(b);
  b.addEventListener('click', e => { e.stopPropagation(); vvToggle(); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }); b.addEventListener('pointerup', () => setTimeout(() => b.blur(), 0));
  const sp = top.querySelector('.v8-spd'); if (sp) top.insertBefore(b, sp); else top.appendChild(b); };
if ('speechSynthesis' in window){ try { speechSynthesis.getVoices(); if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', () => {}); } catch(e){} }
if (window.NT_DEBUG){ NT_DEBUG.vv = () => ({ dispo: vvOK(), on: VV.on, lues: VV.n, parle: VV.speaking, derniere: VV.last, voix: (vvVoice() || {}).name || null }); }


/* ============================================================
   V55 — VIDÉOS : 5 NOUVEAUX SCHÉMAS POUR LES SCÈNES ENCORE GÉNÉRIQUES (09/11/2026)
   Thomas : « fais toutes ces améliorations ». Après V49, 422 scènes affichaient
   encore un dessin, une carte, un graphique général ou un nombre seul.
   - tri : les cartes « à ranger » (98 scènes). La question, la carte en entier,
     les deux bacs (« Fiable » / « Arnaque », « Oui » / « Non »…) ; la carte part
     dans le bon bac au moment où la voix / le texte donne la réponse.
   - grow : intérêts composés (placement unique, versements par mois, règle de 72,
     deux taux comparés). La courbe est CALCULÉE avec les chiffres de la phrase ;
     si le calcul ne retombe pas sur le chiffre écrit, le schéma n'est pas utilisé.
   - seq : enchaînement de pourcentages (+10 % puis −10 %, −50 % puis +100 %),
     vendre à 70 € puis racheter à 95 €. Barres calculées, base 100.
   - split : répartition d'un portefeuille (7 000 € / 3 000 €, cible 60/40 → 70/30).
   - ind : indicateurs (moyenne mobile, RSI 30/70, MACD) : un cours d'exemple
     dessiné sans chiffre, et l'indicateur vraiment calculé sur ce cours.
   Comme V49 : uniquement à la place d'un schéma générique ; les autres ne bougent pas.
   Interrupteur : NT_FX.vidschema3 = false.
   ============================================================ */
NT_FX.vidschema3 = NT_FX.vidschema3 !== false;
const v10N = t => norm(v5Clean(t));
/* ---------- cartes à ranger : retrouver la carte, ses deux bacs et le bon côté ---------- */
let V10_SW = null;
function v10Sw(){ if (V10_SW) return V10_SW; V10_SW = new Map();
  (window.NT_MISSIONS || []).forEach(m => (m.steps || []).forEach(st => { if (st.type !== 'swipe' || !Array.isArray(st.cards)) return;
    st.cards.forEach(c => { if (c && c.t && c.explain) V10_SW.set(v10N(v5Short(c.t, 9)) + '|' + v10N(c.explain), { q: st.q, L: st.left, R: st.right, side: c.side, t: c.t }); }); }));
  return V10_SW; }
const v10SwOf = it => it && it.head ? v10Sw().get(v10N(it.head) + '|' + v10N(it.t)) || null : null;
const V10_NEG = /^(alerte|arnaque|piege|danger|fausse idee|flou|trop concentree|concentre|opinion \/ rumeur|pas adapte|pas utile|non|faux|mythe|speculation|j.ecarte|pas dans le plan|peu probable)$/;
const V10_POS = /^(bon reflexe|plutot fiable|fiable|serieux|normal|ok|rassurant|clair|adapte|oui|vrai|realite|dans le plan|plutot sain|equilibree|diversifie|fait|je garde|long terme|prudence raisonnable)$/;
const v10Tone = l => { const n = norm(String(l || '')).trim(); return V10_NEG.test(n) ? (/alerte|arnaque|piege|danger/.test(n) ? 'alert' : 'no') : V10_POS.test(n) ? 'yes' : 'neu'; };
const V10_IC = { yes: 'check', no: 'x', alert: 'tri', neu: 'dot' };
/* ---------- intérêts composés : on ne garde que ce qui se recalcule ---------- */
function v10Grow(t){ const n = v10N(t), T = v5Clean(t); let m;
  if (/regle de 72/.test(n)){ m = n.match(/a (\d+(?:,\d+)?) ?%,? (\d+) ans/); if (!m) return null; const r = v5Val(m[1]), y = +m[2]; return Math.abs(72 / r - y) <= 1 ? { k: 'r72', r, y } : null; }
  const pr = [...n.matchAll(/(\d+) ans a (\d+(?:,\d+)?) ?%/g)];
  if (pr.length >= 2 && /contre/.test(n)){ const P = pr.slice(0, 2).map(x => ({ y: +x[1], r: v5Val(x[2]) })); return P.every(p => Math.abs(Math.pow(1 + p.r / 100, p.y) - 2) < 0.12) ? { k: 'cmp', P } : null; }
  const r = n.match(/a (\d+(?:,\d+)?) ?% par an/), y = n.match(/(\d+) ans/), am = [...T.matchAll(new RegExp(`(${V5_NUM})\\s?€`, 'g'))].map(x => ({ s: x[1], v: v5Val(x[1]) }));
  if (!r || !y || !am.length) return null; const rr = v5Val(r[1]) / 100, Y = +y[1]; if (!(rr > 0 && rr < 0.3 && Y > 0 && Y <= 60)) return null;
  if (/par mois/.test(n)){ const M = am[0].v, thr = am[1]; if (!thr) return null; let v = 0; for (let i = 0; i < Y * 12; i++) v = v * (1 + rr / 12) + M; return v >= thr.v * 0.98 ? { k: 'month', M, r: rr * 100, y: Y, thr: thr.v, thrS: thr.s } : null; }
  if (/doubl|interets composes|place/.test(n)){ const A = am[0].v, E = am[1], c = A * Math.pow(1 + rr, Y); if (E && Math.abs(c - E.v) / E.v > 0.03) return null; return { k: 'lump', A, As: am[0].s, r: rr * 100, y: Y, E: E ? E.v : null, Es: E ? E.s : null, dbl: /doubl/.test(n) }; }
  return null; }
/* ---------- pourcentages enchaînés ---------- */
function v10Seq(t){ const n = v10N(t); let m;
  if ((m = n.match(/([+−-]\d+(?:,\d+)?) ?% puis ([+−-]\d+(?:,\d+)?) ?%/))){ const a = v5Val(m[1]), b = v5Val(m[2]), v1 = 100 * (1 + a / 100), v2 = v1 * (1 + b / 100); return { k: 'pp', V: [100, v1, v2], S: [m[1], m[2]] }; }
  if ((m = n.match(/([−-]\d+(?:,\d+)?) ?%[^%]{0,40}?(?:il faut|demande) \+?(\d+(?:,\d+)?) ?%/))){ const a = v5Val(m[1]), b = v5Val(m[2]), v1 = 100 * (1 + a / 100), v2 = v1 * (1 + b / 100); return Math.abs(v2 - 100) < 1 ? { k: 'back', V: [100, v1, v2], S: [m[1], '+' + m[2]] } : null; }
  if ((m = n.match(/vendre a (\d+(?:,\d+)?) ?€ et (?:a )?racheter a (\d+(?:,\d+)?) ?€/))){ const a = v5Val(m[1]), b = v5Val(m[2]), g = n.match(/(\d+(?:,\d+)?) ?€ perdus/); if (g && Math.abs(v5Val(g[1]) - (b - a)) > 0.01) return null; return { k: 'sell', a: m[1], b: m[2], av: a, bv: b }; }
  return null; }
/* ---------- répartition d'un portefeuille ---------- */
function v10Split(t){ const n = v10N(t), T = v5Clean(t); let m;
  if ((m = n.match(/cible (\d+) ?\/ ?(\d+) devenue (\d+) ?\/ ?(\d+)/)) && +m[1] + +m[2] === 100 && +m[3] + +m[4] === 100) return { k: 'two', A: [+m[1], +m[2]], B: [+m[3], +m[4]] };
  if ((m = T.match(new RegExp(`(${V5_NUM}) ?€ d[’']actions et (${V5_NUM}) ?€ d[’']obligations`)))){ const a = v5Val(m[1]), b = v5Val(m[2]); if (a > 0 && b > 0) return { k: 'one', P: [a / (a + b) * 100, b / (a + b) * 100], E: [m[1] + ' €', m[2] + ' €'], tot: (n.match(/portefeuille de (\d[\d  ]*) ?€/) || [])[1] || null }; }
  return null; }
/* ---------- indicateurs ---------- */
function v10Ind(t){ const n = v10N(t); if ((String(t).match(/,/g) || []).length >= 3) return null; /* une liste de notions : pas un indicateur */
  if (/\brsi\b/.test(n) || (/\b70\b/.test(n) && /\b30\b/.test(n) && /surachete|survendu/.test(n))) return { k: 'rsi', z: /\b70\b/.test(n) && /\b30\b/.test(n), low: /rsi bas/.test(n) };
  if (/macd|deux moyennes/.test(n)) return { k: 'macd' };
  if (/moins de seances|reaction plus rapide/.test(n)) return { k: 'ma', two: true };
  if (/reagit avec retard/.test(n) || (/moyenne/.test(n) && /(mobile|cours|retard|direction|au-dessus|sous une)/.test(n))) return { k: 'ma', dir: /(sous une|baisse|degrade)/.test(n) ? -1 : /(au-dessus|monte|haussier)/.test(n) ? 1 : 0, lag: /retard/.test(n) };
  return null; }
function v10Pick(it){ if (v10SwOf(it)) return 'tri'; const t = it.t || ''; if (v10Grow(t)) return 'grow'; if (v10Seq(t)) return 'seq'; if (v10Split(t)) return 'split'; if (v10Ind(t)) return 'ind'; return null; }
const _v5PickV54 = v5Pick; v5Pick = function(it){ const b = _v5PickV54(it); if (!it.tpl && NT_FX.vidschema3 && V8_BASE.has(b)){ try { const k = v10Pick(it); if (k) return k; } catch(e){} } return b; };

/* ---------- dessin ---------- */
const v10Fmt = (v, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: 0 }).replace(/ | /g, ' ');
const v10Pct = v => (v > 0 ? '+' : v < 0 ? '−' : '') + v10Fmt(Math.abs(v), 1) + ' %';
/* repère : x de 46 à 292, y de 172 (bas) à 40 (haut) */
const v10Plot = (X0, X1, Y0, Y1) => ({ x: v => 46 + (v - X0) / (X1 - X0 || 1) * 246, y: v => 172 - (v - Y0) / (Y1 - Y0 || 1) * 132 });
const v10Path = P => P.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
const v10Frame = (id, xl, xr) => `<g data-c="f"><rect x="14" y="14" width="292" height="184" rx="14" class="v10-fr"/><path d="M46 172 H292" class="v10-ax"/>${xl ? `<text x="46" y="190" class="v10-tk" text-anchor="middle">${h(xl)}</text>` : ''}${xr ? `<text x="292" y="190" class="v10-tk" text-anchor="end">${h(xr)}</text>` : ''}</g>`;
/* un cours d'exemple (sans chiffre) : stable d'un affichage à l'autre */
function v10Price(seed, N, dir, turn){ const r = v5Rnd(seed), P = []; let v = 0.5, tr = dir * 0.006;
  for (let i = 0; i < N; i++){ if (turn && i === Math.floor(N * 0.55)) tr = -tr * 1.3; v += tr + (r() - 0.5) * 0.045 + Math.sin(i / 5.5) * 0.006; v = Math.max(0.08, Math.min(0.92, v)); P.push(v); } return P; }
const v10SMA = (P, w) => P.map((_, i) => { const a = P.slice(Math.max(0, i - w + 1), i + 1); return a.reduce((s, x) => s + x, 0) / a.length; });
const v10EMA = (P, w) => { const k = 2 / (w + 1); let e = P[0]; return P.map(x => (e = x * k + e * (1 - k))); };
function v10RSI(P, w = 14){ const out = []; let g = 0, l = 0; for (let i = 1; i < P.length; i++){ const d = P[i] - P[i - 1], gu = Math.max(0, d), lo = Math.max(0, -d);
    if (i <= w){ g += gu / w; l += lo / w; } else { g = (g * (w - 1) + gu) / w; l = (l * (w - 1) + lo) / w; } out.push(i < w ? null : l === 0 ? 100 : 100 - 100 / (1 + g / l)); } return out; }

Object.assign(V5T, {
  /* la carte part dans le bon bac */
  tri(X){ const S = v10SwOf(X.it); if (!S) return V5T.icon(X); const L = S.side === 'left', go = Math.max(1300, X.at(0));
    X.cue(0, 'q'); X.cue(150, 'c'); X.cue(380, 'b'); X.cue(go, 'go');
    const bin = (lab, side) => { const tn = v10Tone(lab), hit = (side === 'l') === L; return `<div class="v10-bin ${side} t-${tn}${hit ? ' hit' : ''}"><span class="v10-slot"></span><span class="v10-bl">${v9Ic(V10_IC[tn])}<b>${h(lab)}</b></span>${hit ? '<i class="v10-glow" data-c="go"></i>' : ''}</div>`; };
    return `<div class="v10-tri"><div class="v10-tq" data-c="q">${h(S.q)}</div><div class="v10-cw ${L ? 'to-l' : 'to-r'}" data-c="go"><div class="v10-card" data-c="c">${h(v5NBT(S.t))}</div></div><div class="v10-bins" data-c="b">${bin(S.L, 'l')}${bin(S.R, 'r')}</div></div>`; },
  /* intérêts composés, calculés */
  grow(X){ const G = v10Grow(X.it.t); if (!G) return V5T.icon(X); const id = X.id;
    if (G.k === 'lump' || G.k === 'r72'){ const A = G.k === 'lump' ? G.A : 1, Y = G.y, rr = G.r / 100, end = A * Math.pow(1 + rr, Y), top = Math.max(end, A * 2) * 1.12, S = v10Plot(0, Y, 0, top);
      const P = [...Array(41)].map((_, i) => { const t = Y * i / 40; return [S.x(t), S.y(A * Math.pow(1 + rr, t))]; }), d2 = S.y(A * 2);
      const tE = Math.max(1100, G.Es ? v9At(X, G.Es, 1800) : X.wAt(/ans/)), tD = Math.max(900, X.wAt(/doubl|72/));
      X.cue(0, 'f'); X.cue(250, 'p'); X.cue(300, 's'); X.cue(tD, 'd'); X.cue(tE, 'e');
      const startL = G.k === 'lump' ? G.As + ' €' : 'Départ', endL = G.k === 'lump' ? (G.Es ? G.Es + ' €' : '') : `72 ÷ ${v10Fmt(G.r, 1)} = ${Y} ans`;
      return `<svg class="v5-svg v10-g" viewBox="0 0 320 210">${v5Defs(id)}${v10Frame(id, '0', Y + ' ans')}
        <g data-c="d"><path d="M46 ${d2.toFixed(1)} H292" class="v10-dash"/><text x="50" y="${(d2 - 6).toFixed(1)}" class="v10-tk">× 2</text></g>
        <g data-c="p"><path d="${v10Path(P)} L292 172 L46 172 Z" fill="url(#${id}a)" class="v10-area"/><path d="${v10Path(P)}" class="v10-ln v10-dr" pathLength="1" stroke="url(#${id}g)"/></g>
        <g data-c="s">${v8Pill(46, Math.min(160, S.y(A) - 14), startL, '', 'start')}</g>
        <g data-c="e"><circle cx="${S.x(Y).toFixed(1)}" cy="${S.y(end).toFixed(1)}" r="5" class="v10-dot"/>${endL ? v8Pill(292, S.y(end) - 18, endL, 'hi', 'end') : ''}</g></svg>`; }
    if (G.k === 'month'){ const Y = G.y, M = G.M, rr = G.r / 100, tot = [], paid = []; let v = 0; for (let i = 0; i <= Y * 12; i++){ if (i) v = v * (1 + rr / 12) + M; if (i % 3 === 0){ tot.push([i / 12, v]); paid.push([i / 12, M * i]); } }
      const top = Math.max(v, G.thr) * 1.12, S = v10Plot(0, Y, 0, top), pT = tot.map(p => [S.x(p[0]), S.y(p[1])]), pP = paid.map(p => [S.x(p[0]), S.y(p[1])]), yT = S.y(G.thr);
      const tP = Math.max(1000, X.wAt(/mois/)), tH = Math.max(tP + 700, v9At(X, G.thrS, 2200)); X.cue(0, 'f'); X.cue(250, 'v'); X.cue(tP, 'p'); X.cue(tH, 'e');
      return `<svg class="v5-svg v10-g" viewBox="0 0 320 210">${v5Defs(id)}${v10Frame(id, '0', Y + ' ans')}
        <g data-c="v"><path d="${v10Path(pP)} L292 172 L46 172 Z" class="v10-paid"/>${v8Pill(170, Math.min(160, S.y(M * Y * 12 * 0.5) + 18), `Versé : ${v10Fmt(M * Y * 12)} €`, '')}</g>
        <g data-c="p"><path d="${v10Path(pT)} L${v10Path(pP.slice().reverse()).slice(1)} Z" fill="url(#${id}a)" class="v10-area"/><path d="${v10Path(pT)}" class="v10-ln v10-dr" pathLength="1" stroke="url(#${id}g)"/>${v8Pill(110, 52, 'Intérêts composés', 'hi')}</g>
        <g data-c="e"><path d="M46 ${yT.toFixed(1)} H292" class="v10-dash"/>${v8Pill(292, yT - 14, G.thrS + ' €', 'hi', 'end')}</g></svg>`; }
    /* deux taux : qui double le plus vite */
    const Ymax = Math.max(...G.P.map(p => p.y)), S = v10Plot(0, Ymax, 1, 2.25), d2 = S.y(2), srt = G.P.slice().sort((a, b) => b.r - a.r);
    X.cue(0, 'f'); X.cue(200, 'd'); srt.forEach((p, i) => X.cue(Math.max(400 + i * 900, v9At(X, p.y + ' ans', 900 + i * 900)), 'c' + i));
    return `<svg class="v5-svg v10-g" viewBox="0 0 320 210">${v5Defs(id)}${v10Frame(id, '0', Ymax + ' ans')}<g data-c="d"><path d="M46 ${d2.toFixed(1)} H292" class="v10-dash"/><text x="50" y="${(d2 - 6).toFixed(1)}" class="v10-tk">× 2</text></g>
      ${srt.map((p, i) => { const P = [...Array(31)].map((_, k) => { const t = p.y * k / 30; return [S.x(t), S.y(Math.pow(1 + p.r / 100, t))]; }), ex = S.x(p.y);
        return `<g data-c="c${i}"><path d="${v10Path(P)}" class="v10-ln v10-dr ${i ? 'v10-l2' : ''}" pathLength="1" ${i ? '' : `stroke="url(#${id}g)"`}/><path d="M${ex.toFixed(1)} ${d2.toFixed(1)} V172" class="v10-dash"/>${v8Pill(i ? 292 : ex - 8, i ? d2 - 16 : d2 + 24, `${v10Fmt(p.r, 1)} % : ${p.y} ans`, i ? '' : 'hi', 'end')}</g>`; }).join('')}</svg>`; },
  /* pourcentages enchaînés : barres calculées, base 100 */
  seq(X){ const Q = v10Seq(X.it.t); if (!Q) return V5T.icon(X); const id = X.id;
    if (Q.k === 'sell'){ const top = Q.bv * 1.18, S = v10Plot(0, 1, 0, top), bw = 64, xa = 98, xb = 222, ya = S.y(Q.av), yb = S.y(Q.bv), tB = Math.max(1100, v9At(X, Q.b + ' €', 1500)), tG = Math.max(tB + 600, X.wAt(/perdu/));
      X.cue(0, 'f'); X.cue(250, 'a'); X.cue(tB, 'b'); X.cue(tG, 'g');
      return `<svg class="v5-svg v10-s" viewBox="0 0 320 210">${v5Defs(id)}<g data-c="f"><rect x="14" y="14" width="292" height="184" rx="14" class="v10-fr"/><path d="M40 172 H280" class="v10-ax"/></g>
        <g data-c="a"><rect x="${xa - bw / 2}" y="${ya.toFixed(1)}" width="${bw}" height="${(172 - ya).toFixed(1)}" rx="8" class="v10-bar b2"/><text x="${xa}" y="190" class="v10-tk" text-anchor="middle">Je revends</text>${v8Pill(xa, ya - 14, Q.a + ' €', '')}</g>
        <g data-c="b"><rect x="${xb - bw / 2}" y="${yb.toFixed(1)}" width="${bw}" height="${(172 - yb).toFixed(1)}" rx="8" class="v10-bar"/><text x="${xb}" y="190" class="v10-tk" text-anchor="middle">Je rachète</text>${v8Pill(xb, yb - 14, Q.b + ' €', 'hi')}</g>
        <g data-c="g"><path d="M${xa + bw / 2 + 6} ${ya.toFixed(1)} H${xb - bw / 2 - 6}" class="v10-dash"/><path d="M${xb - bw / 2 - 12} ${yb.toFixed(1)} V${ya.toFixed(1)}" class="v10-gap"/>${v8Pill(xb - bw / 2 - 16, (ya + yb) / 2, '−' + v10Fmt(Q.bv - Q.av, 2) + ' € par action', 'bad', 'end')}</g></svg>`; }
    const V = Q.V, top = Math.max(...V) * 1.2, S = v10Plot(0, 1, 0, top), xs = [74, 160, 246], bw = 54, ys = V.map(v => S.y(v));
    const t1 = Math.max(900, v9At(X, Q.S[0].replace(/^[+−-]/, ''), 1100)), t2 = Math.max(t1 + 900, X.wAt(/puis|faut|demande/) + 350); X.cue(0, 'f'); X.cue(220, 'b0'); X.cue(t1, 'b1'); X.cue(t2, 'b2'); X.cue(t2 + 700, 'r');
    const dv = V[2] - 100, res = Q.k === 'back' ? 'Retour au départ' : Math.abs(dv) < 0.05 ? 'Retour au départ' : `${v10Pct(dv)} au total`;
    return `<svg class="v5-svg v10-s" viewBox="0 0 320 210">${v5Defs(id)}<g data-c="f"><rect x="14" y="14" width="292" height="184" rx="14" class="v10-fr"/><path d="M36 172 H284" class="v10-ax"/><path d="M36 ${S.y(100).toFixed(1)} H284" class="v10-dash"/></g>
      ${V.map((v, i) => `<g data-c="b${i}"><rect x="${xs[i] - bw / 2}" y="${ys[i].toFixed(1)}" width="${bw}" height="${(172 - ys[i]).toFixed(1)}" rx="8" class="v10-bar${i === 1 ? ' b2' : ''}"/><text x="${xs[i]}" y="${(ys[i] - 8).toFixed(1)}" class="v10-val" text-anchor="middle">${v10Fmt(v, 1)}</text>${i === 0 ? `<text x="${xs[0]}" y="190" class="v10-tk" text-anchor="middle">Base 100</text>` : v8Pill((xs[i - 1] + xs[i]) / 2, 30, Q.S[i - 1].replace('-', '−') + ' %', /^[−-]/.test(Q.S[i - 1]) ? 'bad' : 'hi')}</g>`).join('')}
      <g data-c="r"><text x="${xs[2]}" y="190" class="v10-tk v10-res" text-anchor="middle">${h(res)}</text></g></svg>`; },
  /* répartition d'un portefeuille */
  split(X){ const Q = v10Split(X.it.t); if (!Q) return V5T.icon(X);
    const bar = (P, lab, E, c) => `<div class="v10-sb" data-c="${c}"><span class="v10-sl">${h(lab)}</span><div class="v10-st">${P.map((p, i) => `<i class="s${i}" style="flex:${p.toFixed(2)}"><b>${v10Fmt(p)} %</b>${E ? `<small>${h(E[i])}</small>` : ''}</i>`).join('')}</div></div>`;
    const key = `<div class="v10-sk" data-c="k"><span><i class="s0"></i>Actions</span><span><i class="s1"></i>Obligations</span></div>`;
    if (Q.k === 'two'){ const tB = Math.max(1100, X.wAt(/devenue/)), tV = Math.max(tB + 700, X.wAt(/vend/)); X.cue(0, 'k'); X.cue(200, 'a'); X.cue(tB, 'b'); X.cue(tV, 'v');
      return `<div class="v10-split">${key}${bar(Q.A, 'Cible', null, 'a')}${bar(Q.B, 'Aujourd’hui', null, 'b')}<div class="v9-tail" data-c="v">On vend ${Q.B[0] - Q.A[0]} points d’actions</div></div>`; }
    X.cue(0, 'k'); X.cue(250, 'a'); return `<div class="v10-split">${key}${bar(Q.P, Q.tot ? `Portefeuille de ${v5NBT(Q.tot.trim())} €` : 'Portefeuille', Q.E, 'a')}</div>`; },
  /* indicateurs, calculés sur un cours d'exemple */
  ind(X){ const Q = v10Ind(X.it.t); if (!Q) return V5T.icon(X); const id = X.id, N = 72, seed = v5Hash(X.it.t) + 11;
    if (Q.k === 'rsi'){ const P = v10Price(seed, N + 54, 1, true), R = v10RSI(P).slice(53), S = v10Plot(0, R.length - 1, 0, 100), pts = R.map((v, i) => [S.x(i), S.y(v)]), y70 = S.y(70), y30 = S.y(30);
      const tZ = Math.max(900, X.wAt(/70|surachet/)), tS = Math.max(tZ + 500, X.wAt(/30|survend/)); X.cue(0, 'f'); X.cue(250, 'p'); if (Q.z){ X.cue(tZ, 'h'); X.cue(tS, 'l'); } else { X.cue(900, 'h'); X.cue(900, 'l'); }
      return `<svg class="v5-svg v10-i" viewBox="0 0 320 210">${v5Defs(id)}<g data-c="f"><rect x="14" y="14" width="292" height="184" rx="14" class="v10-fr"/><text x="40" y="${S.y(100) + 4}" class="v10-tk" text-anchor="end">100</text><text x="40" y="${S.y(0) + 4}" class="v10-tk" text-anchor="end">0</text><path d="M46 ${S.y(100)} H292 M46 ${S.y(0)} H292" class="v10-ax"/></g>
        ${Q.z ? `<g data-c="h"><rect x="46" y="${S.y(100)}" width="246" height="${(y70 - S.y(100)).toFixed(1)}" class="v10-zone hi"/><path d="M46 ${y70.toFixed(1)} H292" class="v10-dash"/><text x="40" y="${(y70 + 4).toFixed(1)}" class="v10-tk" text-anchor="end">70</text>${v8Pill(286, y70 - 13, 'Suracheté', '', 'end')}</g>
        <g data-c="l"><rect x="46" y="${y30.toFixed(1)}" width="246" height="${(S.y(0) - y30).toFixed(1)}" class="v10-zone lo"/><path d="M46 ${y30.toFixed(1)} H292" class="v10-dash"/><text x="40" y="${(y30 + 4).toFixed(1)}" class="v10-tk" text-anchor="end">30</text>${v8Pill(286, y30 + 13, 'Survendu', 'bad', 'end')}</g>` : ''}
        <g data-c="p"><path d="${v10Path(pts)}" class="v10-ln v10-dr" pathLength="1" stroke="url(#${id}g)"/>${v8Pill(60, 30, 'RSI', 'hi', 'start')}</g></svg>`; }
    const P = v10Price(seed, N, Q.k === 'ma' && Q.dir < 0 ? -1 : 1, Q.k === 'ma' && (Q.lag || Q.two || !Q.dir)), lo = Math.min(...P) - 0.05, hi = Math.max(...P) + 0.05, S = v10Plot(0, N - 1, lo, hi), line = A => v10Path(A.map((v, i) => [S.x(i), S.y(v)]));
    const tM = Math.max(1000, X.wAt(/moyenne|mm|macd|retard|seances/)); X.cue(0, 'f'); X.cue(200, 'p'); X.cue(tM, 'm');
    let extra = '', lab = '';
    if (Q.k === 'macd'){ const F = v10EMA(P, 8), L = v10EMA(P, 21);
      const Fp = F.map((v, i) => [S.x(i), S.y(v)]), Lp = L.map((v, i) => [S.x(i), S.y(v)]); extra = `<path d="${v10Path(Fp)} L${v10Path(Lp.slice().reverse()).slice(1)} Z" class="v10-gapf"/><path d="${v10Path(Fp)}" class="v10-ln v10-dr" pathLength="1" stroke="url(#${id}g)"/><path d="${v10Path(Lp)}" class="v10-ln v10-l2 v10-dr" pathLength="1"/>`;
      lab = v8Pill(286, 30, 'Écart entre 2 moyennes', 'hi', 'end'); }
    else if (Q.two){ const F = v10SMA(P, 6), L = v10SMA(P, 24); extra = `<path d="${line(F)}" class="v10-ln v10-dr" pathLength="1" stroke="url(#${id}g)"/><path d="${line(L)}" class="v10-ln v10-l2 v10-dr" pathLength="1"/>`; lab = `${v8Pill(60, 30, 'Courte : rapide', 'hi', 'start')}${v8Pill(286, 30, 'Longue : lente', '', 'end')}`; }
    else { const L = v10SMA(P, 16); extra = `<path d="${line(L)}" class="v10-ln v10-dr" pathLength="1" stroke="url(#${id}g)"/>`; lab = v8Pill(286, 30, Q.lag ? 'La moyenne suit avec retard' : Q.dir < 0 ? 'Cours sous la moyenne' : Q.dir > 0 ? 'Cours au-dessus de la moyenne' : 'Moyenne mobile', Q.dir < 0 ? 'bad' : 'hi', 'end'); }
    return `<svg class="v5-svg v10-i" viewBox="0 0 320 210">${v5Defs(id)}<g data-c="f"><rect x="14" y="14" width="292" height="184" rx="14" class="v10-fr"/></g>
      <g data-c="p"><path d="${line(P)}" class="v10-px"/>${v8Pill(24, 186, 'Cours', '', 'start')}</g><g data-c="m">${extra}${lab}</g></svg>`; }
});
/* le titre de la scène « tri » est déjà écrit sur la carte : on ne le répète pas à l'écran (la voix, elle, le lit) */
if (window.NT_DEBUG){ NT_DEBUG.v10 = t => ({ tri: !!v10SwOf({ head: '', t }), grow: v10Grow(t), seq: v10Seq(t), split: v10Split(t), ind: v10Ind(t) }); }


/* ============================================================
   V56 — MIEUX APPRENDRE, MIEUX S'Y RETROUVER (10/11/2026)
   Thomas : « aller tu peux ».
   1. Accueil (NT_FX.homenext) : dès le premier écran, une carte « À faire maintenant »
      avec UN bouton (la même suite que le site calcule déjà : séance, révision,
      mission du jour, mission suivante). Avant, le premier bouton était 2 écrans plus bas.
   2. Bilan de fin de mission (NT_FX.bilan) : la liste de TES questions, une par une :
      réussie, rattrapée à la deuxième chance, ou à revoir (avec le jour où elle revient).
      Remplace la phrase générale « Les questions ratées reviendront demain ».
   3. Vidéo sans la réponse toute faite (NT_FX.vidnospoil) : la vidéo montrait la
      question exacte, ses choix et la bonne réponse juste avant de la poser. Elle
      enseigne maintenant la notion (l'explication) sans montrer la question ni les choix,
      quand l'explication se comprend seule ; sinon la scène d'avant est gardée.
   4. Scènes « paires » : ne passent plus sous le texte sur petit écran (CSS).
   Rien n'est renommé. Chaque point a son interrupteur.
   ============================================================ */
NT_FX.homenext = NT_FX.homenext !== false;
NT_FX.bilan = NT_FX.bilan !== false;
NT_FX.vidnospoil = NT_FX.vidnospoil !== false;

/* ---------- 1. accueil : une chose à faire, tout de suite ---------- */
function v56Next(){ try { if (!NT_FX.homenext || S.page !== 'home') return; const rings = document.querySelector('#app [data-scene="rings"]'); if (!rings) return;
    const old = document.querySelector('#app .v56-next'); const n = upNext(); if (!n || !n.attr){ if (old) old.remove(); return; }
    const rv = dueReviews().length, sig = n.attr + '|' + n.title + '|' + rv; if (old && old.dataset.sig === sig) return; if (old) old.remove();
    const el = document.createElement('section'); el.className = 'v56-next'; el.dataset.sig = sig; el.setAttribute('aria-label', 'À faire maintenant');
    el.innerHTML = `<span class="v56-eb">À faire maintenant</span><h2>${h(n.title || '')}</h2><span class="v56-meta">${h(n.eyebrow || '')}</span>${n.sub ? `<p>${h(n.sub)}</p>` : ''}
      <div class="v56-row"><button class="btn v" ${n.attr}>Commencer</button>${rv && n.kind !== 'review' ? `<button class="btn ghost" data-review>Révision : ${rv} notion${rv > 1 ? 's' : ''} · 1 min</button>` : ''}</div>`;
    rings.parentNode.insertBefore(el, rings); } catch(e){} }
const _renderV55 = render; render = function(){ const r = _renderV55.apply(this, arguments); v56Next(); return r; };

/* ---------- 2. bilan : tes questions, une par une ---------- */
const _checkV55 = check;
check = function(){ const st = M && M.steps && M.steps[M.i], had = !!(M && M.fb); const r = _checkV55.apply(this, arguments);
  try { if (M && M.fb && !had && st && st.q && M.mode !== 'exam') (M.v56 = M.v56 || []).push({ q: st.q, k: st.key || (st.si != null ? 'si' + st.si : st.q), ok: !!M.fb.ok, retry: !!st.retry, rev: typeof reviewable === 'function' ? !!reviewable(st) : true }); } catch(e){}
  return r; };
function v56Bilan(){ const L = (M && M.v56) || [], first = L.filter(x => !x.retry); if (!first.length) return '';
  const rows = first.map(x => { const again = L.find(y => y.retry && y.k === x.k), st = x.ok ? 'ok' : again && again.ok ? 'mid' : 'ko';
    const lab = st === 'ok' ? 'Réussie' : st === 'mid' ? 'Rattrapée à la deuxième chance' + (x.rev ? ' · revient demain' : '') : (x.rev ? 'À revoir · revient demain' : 'À revoir');
    return `<li class="b-${st}"><span class="v56-bi">${st === 'ok' ? I.check : st === 'mid' ? I.check : I.x}</span><span class="v56-bt"><b>${h(v5Short(x.q, 14))}</b><small>${lab}</small></span></li>`; }).join('');
  const ok = first.filter(x => x.ok).length, ko = first.length - ok;
  return `<div class="card v56-bilan"><span class="eyebrow">Ton bilan</span><b class="v56-bh">${ko ? `${ok} réussie${ok > 1 ? 's' : ''} du premier coup, ${ko} à consolider` : 'Tout réussi du premier coup'}</b><ul>${rows}</ul>${ko ? '<p class="small">Les questions à revoir reviennent dans « À revoir » : demain, puis après 3, 7 et 21 jours si tu les réussis.</p>' : ''}</div>`; }
const _debriefHTMLV55 = debriefHTML;
debriefHTML = function(){ let s = _debriefHTMLV55(); try { const e = M.end; if (!NT_FX.bilan || !e || e.review || e.eclairFail || !S.onb) return s; const b = v56Bilan(); if (!b) return s;
    s = s.replace(/<div class="card"[^>]*><b>À revoir<\/b><p class="small"[^>]*>[^<]*<\/p><\/div>/, '');
    const i = s.indexOf('<button class="btn'); if (i > 0) s = s.slice(0, i) + b + s.slice(i); } catch(e){} return s; };

/* ---------- 3. la vidéo enseigne la notion, sans montrer la question et sa réponse ---------- */
const v56Alone = t => { const x = String(t || '').trim(); return x.length >= 60 && !/^(il|elle|ils|elles|c[’']est|ce|cela|ça|oui|non|ici|on|là|pas|parce|car|même|aucun|aucune|personne|vrai|faux)\b/i.test(x) && !/^[\d+−-]/.test(x); };
const _v5SceneV55 = v5Scene;
v5Scene = function(it, idx, L){ try { if (NT_FX.vidnospoil && it && !it.tpl){
      if (it.k === 'qa' && v56Alone(it.t)) it = { k: 'say', eb: it.eb, t: it.t, v56: 'qa' };
      else if (it.k === 'vf' && it.ans === true && it.q) it = { k: 'say', eb: it.eb, t: /[.!?…]$/.test(it.q.trim()) ? it.q.trim() + (it.t && it.t.length < 120 ? ' ' + it.t : '') : it.q, v56: 'vf' };
      else if (it.k === 'vf' && it.ans === false && v56Alone(it.t)) it = { k: 'say', eb: it.eb, t: it.t, v56: 'vf' }; } } catch(e){}
  const r = _v5SceneV55(it, idx, L); if (r && it && it.v56) r.v56 = it.v56; return r; };
if (window.NT_DEBUG){ NT_DEBUG.v56 = () => ({ next: !!document.querySelector('.v56-next'), bilan: (M && M.v56) || null }); }


/* ============================================================
   V57 — LES VIDÉOS DEVIENNENT LA LEÇON (10/11/2026)
   Thomas : « je veux que les leçons soient les vidéos… plus d'informations,
   expliquées simplement… tous les chapitres ».
   1. Plus de leçons à lire dans les missions (NT_FX.nolesson) : les 15 étapes
      « leçon » sont déjà racontées dans la vidéo du début ; quand la vidéo est
      active, la mission commence directement par les questions.
      Le texte des leçons reste dans les fichiers (rien n'est effacé).
   2. Vidéos plus complètes (NT_FX.vidplus) : pour les 36 fiches de cours,
      3 scènes en plus, écrites simplement :
      « En clair » (la notion en une phrase), « Autre exemple » (des chiffres,
      entreprises fictives) et « Le piège » (l'erreur de débutant à éviter).
      Ordre : titre, En clair, le cours, l'exemple, autre exemple, le piège,
      à retenir, puis les questions.
   ============================================================ */
NT_FX.nolesson = NT_FX.nolesson !== false;
NT_FX.vidplus = NT_FX.vidplus !== false;
const V57 = {
'c1-1': ['Épargner, c’est garder ton argent à l’abri. Investir, c’est le faire travailler, en acceptant qu’il monte et descende.',
  'Sur un livret, 1 000 € restent 1 000 €, plus quelques intérêts. En actions, ils peuvent valoir 900 € une année et 1 200 € la suivante.',
  'Investir l’argent du loyer ou des vacances. S’il baisse au mauvais moment, tu dois vendre à perte.'],
'c1-2': ['Intérêts composés : tes gains rapportent à leur tour. Inflation : les prix montent, donc ton argent achète un peu moins chaque année.',
  '100 € à 5 % : 105 € après un an, puis 110,25 € après deux ans. Les 5 € gagnés ont eux aussi rapporté 0,25 €.',
  'Croire qu’un placement à 1 % fait gagner de l’argent quand les prix montent de 3 %. En réalité, tu perds environ 2 % par an.'],
'c1-3': ['Avec une action, tu deviens un petit propriétaire de l’entreprise. Avec une obligation, tu lui prêtes de l’argent. Un indice, c’est un thermomètre.',
  'Avec 10 actions d’une entreprise qui en compte 1 million, tu possèdes un cent-millième de cette entreprise.',
  'Penser qu’une obligation ne peut jamais perdre. Si l’emprunteur ne rembourse pas, tu peux perdre une partie de ton argent.'],
'c2-1': ['Le courtier, c’est ton intermédiaire avec la Bourse. Ton compte, c’est le portefeuille où il range tes titres.',
  'Exemplia (fictive) à 42,52 €, +1,2 % dans la journée : pour 10 actions, cela fait environ 5 € de hausse.',
  'Ouvrir un compte sur un site inconnu vu dans une publicité. Vérifie toujours que le courtier est autorisé.'],
'c2-2': ['Au marché : tu achètes tout de suite, au prix du moment. À cours limité : tu choisis ton prix, et tu attends.',
  'Tu veux acheter à 42,00 € au maximum. Tant que personne ne vend à ce prix, ton ordre attend dans le carnet.',
  'Passer un ordre au marché sur une petite valeur peu échangée. Le prix payé peut être bien plus haut que prévu.'],
'c2-3': ['Les frais, c’est ce que tu paies pour acheter, vendre ou garder tes placements. Ils sont sûrs ; les gains, non.',
  'Avec 0,5 % de frais, acheter puis revendre 2 000 € coûte 20 €. Il faut gagner 1 % juste pour rembourser les frais.',
  'Faire beaucoup de petits ordres. Avec un minimum de 5 € par ordre, un achat de 100 € coûte 5 % de frais.'],
'c3-1': ['Diversifier, c’est ne pas mettre tous ses œufs dans le même panier. Un ETF, c’est un panier tout prêt.',
  'Dans un panier de 100 entreprises à parts égales, si une seule fait faillite, tu perds environ 1 %, pas tout.',
  'Acheter 5 ETF qui contiennent les mêmes grandes entreprises. Tu crois être diversifié, mais tu as presque 5 fois le même panier.'],
'c3-2': ['L’horizon, c’est dans combien de temps tu auras besoin de l’argent. Plus il est loin, plus tu peux attendre que les baisses passent.',
  '100 € par mois : quand la part vaut 10 €, tu en achètes 10 ; quand elle vaut 5 €, tu en achètes 20. Tu achètes plus quand c’est moins cher.',
  'Arrêter les versements pendant une baisse. C’est justement à ce moment qu’ils achètent le moins cher.'],
'c4-1': ['Le chiffre d’affaires, c’est tout ce que l’entreprise vend. Le bénéfice, c’est ce qui reste quand elle a tout payé.',
  'Novix (fictive) vend pour 2 M€ et dépense 1,8 M€ : bénéfice de 0,2 M€, soit une marge nette de 10 %.',
  'Ne regarder que les ventes. Une entreprise peut vendre de plus en plus et perdre quand même de l’argent.'],
'c4-2': ['Le dividende, c’est une part du bénéfice qu’on te verse. Le PER dit combien de fois le bénéfice annuel coûte l’action.',
  'Action à 40 €, dividende de 2 € par an : rendement de 5 %. Ce dividende peut baisser ou disparaître l’année suivante.',
  'Choisir une action seulement pour son gros dividende. Un dividende très élevé cache parfois une entreprise en difficulté.'],
'c4-3': ['Une nouvelle compte si elle change ce que l’entreprise gagnera sur plusieurs années. Sinon, c’est souvent du bruit.',
  'Une usine arrêtée une semaine pour une panne : effet passager. Un client qui fait 40 % des ventes s’en va : effet durable.',
  'Acheter ou vendre juste après un titre choc. Lis la source, la date, puis demande-toi si l’effet va durer.'],
'c5-1': ['Un krach, c’est une forte baisse en peu de temps. Il fait peur, mais la Bourse en a déjà connu plusieurs.',
  '10 000 € tombent à 7 000 €. Si tu vends, tu perds 3 000 € pour de bon. Si tu gardes, la perte peut se réduire, sans garantie.',
  'Tout vendre au milieu de la panique, puis racheter plus cher une fois rassuré.'],
'c5-2': ['Un biais, c’est un réflexe du cerveau qui nous fait mal décider, surtout quand on a peur ou qu’on est trop sûr de soi.',
  'Tout le monde parle d’une action qui a pris 50 % en un mois. Tu achètes par peur de rater, souvent après la plus grosse hausse.',
  'Croire qu’on n’a pas de biais. Tout le monde en a : la parade, ce sont des règles écrites à l’avance.'],
'c6-1': ['Une arnaque promet beaucoup, vite, sans risque, et te presse de décider. Ces signes ensemble suffisent pour fuir.',
  '10 % par mois, cela ferait plus de 200 % en un an. Aucun placement honnête ne peut garantir ça.',
  'Faire confiance parce que le site est beau ou que des amis ont gagné au début. Les premiers gains servent à attirer.'],
'c6-2': ['Usurpation : un escroc se fait passer pour une vraie banque, une vraie entreprise ou l’AMF.',
  'Un mail « de l’AMF » propose de récupérer tes pertes contre 500 € de frais : c’est une deuxième arnaque.',
  'Suivre le conseil d’un influenceur sans vérifier qui le paie et si le produit est autorisé.'],
'c7-1': ['Ta stratégie, c’est ton plan : pourquoi tu investis, pour quand, combien par mois, et quelle baisse tu peux supporter.',
  'Objectif 6 000 € dans 2 ans : 250 € par mois. Avec un horizon si court, on garde surtout de l’argent sûr.',
  'Choisir ses placements avant de connaître son objectif. On finit avec un portefeuille qui ne colle pas à sa vie.'],
'c7-2': ['Tenir sa stratégie, c’est suivre son plan même quand le marché fait peur ou fait rêver.',
  'Cible : 70 % d’actions. Après une forte hausse, elles pèsent 80 % : on en vend un peu pour revenir à 70 %.',
  'Changer de stratégie à chaque baisse. Un plan qui change tout le temps n’est plus un plan.'],
'c8-1': ['Une enveloppe, c’est le contenant de ton épargne. Elle change surtout les impôts et le moment où tu peux retirer.',
  'Sur un livret réglementé, 1 000 € restent disponibles à tout moment, et les intérêts ne sont pas imposés.',
  'Croire que l’assurance-vie est bloquée 8 ans. On peut retirer avant ; c’est l’impôt qui devient plus doux après 8 ans.'],
'c8-2': ['Le PER prépare la retraite. Le PEE, c’est l’épargne proposée par l’employeur. Le compte-titres n’a pas d’avantage fiscal.',
  'Tu verses 100 € sur ton PEE et ton employeur ajoute 50 € : 150 € placés pour 100 € sortis de ta poche (exemple).',
  'Mettre sur un PER l’argent d’un projet proche. Il reste bloqué jusqu’à la retraite, sauf cas prévus.'],
'c9-1': ['Le levier, c’est jouer avec plus d’argent que tu n’en as. Les gains grossissent, et les pertes aussi, à la même vitesse.',
  '1 000 € avec un levier de 10 : tu joues 10 000 €. Une baisse de 5 % te fait perdre 500 €, la moitié de ta mise.',
  'Regarder seulement le gain possible. Avec le levier, quelques mauvaises journées suffisent à tout perdre.'],
'c10-1': ['Une bougie résume le prix sur une période : d’où il part, où il finit, et jusqu’où il est monté ou descendu.',
  'Ouverture 50 €, clôture 52 €, plus haut 53 €, plus bas 49 € : bougie verte, corps de 50 à 52 €, mèches jusqu’à 53 et 49 €.',
  'Juger une tendance sur une seule bougie. Il faut regarder la suite, et l’unité de temps plus longue.'],
'c10-2': ['Une figure de bougies, c’est une forme qui montre qui gagne la bataille du moment : les acheteurs ou les vendeurs.',
  'Après une baisse, un marteau : le prix est descendu très bas, puis les acheteurs l’ont fait remonter avant la clôture.',
  'Acheter dès qu’une figure apparaît. Sans contexte ni confirmation, elle se trompe souvent.'],
'c10-3': ['Le volume, c’est le nombre d’actions échangées. Il montre si beaucoup de monde participe au mouvement.',
  'D’habitude, 100 000 actions par jour. Aujourd’hui, 400 000 pendant une hausse : 4 fois plus d’échanges que d’habitude.',
  'Croire une cassure faite avec très peu de volume. Elle peut vite échouer.'],
'c11-1': ['Support : un prix où les acheteurs reviennent souvent. Résistance : un prix où les vendeurs reviennent souvent.',
  'Le prix rebondit trois fois vers 47 € : c’est une zone de support. S’il passe nettement dessous, la zone peut céder.',
  'Voir un support comme un mur. C’est une zone, elle peut casser : on garde toujours un stop.'],
'c11-2': ['Un indicateur, c’est un calcul fait sur les prix passés pour les rendre plus lisibles. Il ne voit pas l’avenir.',
  'Moyenne sur 5 jours avec des clôtures de 10, 11, 12, 11 et 12 € : 56 ÷ 5 = 11,20 €.',
  'Vendre dès que le RSI dépasse 70. Dans une forte hausse, il peut rester au-dessus longtemps.'],
'c11-3': ['L’analyse technique aide à décider où entrer et où sortir. Elle ne dit pas ce qui va se passer.',
  'Un robot promet 20 % par mois. Sur un an, cela ferait environ 9 fois la mise : une promesse impossible.',
  'Payer des « signaux » ou une méthode « infaillible ». Personne ne gagne à tous les coups.'],
'c12-1': ['Le stop-loss, c’est ta sortie de secours, prévue avant d’entrer : si le prix descend jusque-là, tu sors.',
  'Achat à 50 €, stop à 48 € : si le prix touche 48 €, tu vends. En général, tu perds 2 € par action, comme prévu.',
  'Descendre son stop quand le prix s’en approche. La petite perte prévue devient une grosse perte.'],
'c12-2': ['Risquer 1 %, c’est accepter de perdre au maximum 1 % de ton capital si le trade tourne mal.',
  'Capital 5 000 €, risque 1 % = 50 €. Entrée 20 €, stop 19 € : 1 € de risque par action, donc 50 actions.',
  'Choisir la taille selon l’envie ou la confiance. C’est le stop et le risque fixé qui décident.'],
'c12-3': ['Ratio : ce que tu vises pour 1 € risqué. Drawdown : de combien ton capital est descendu depuis son plus haut.',
  'Tu risques 100 € pour viser 300 € : ratio de 3. Avec 3 gagnants sur 10, tu finis à +200 € (hors frais).',
  'Couper vite les gains et laisser courir les pertes. C’est l’inverse qui fait durer.'],
'c13-1': ['Un plan de trading, c’est ta liste de règles, écrite à froid : quoi, quand, combien, et quand t’arrêter.',
  'Règle écrite : au maximum 2 trades par jour, 1 % de risque chacun, et arrêt après −2 % dans la journée.',
  'Écrire un plan puis le changer en pleine séance. Les règles ne servent que si on les suit.'],
'c13-2': ['Le journal, c’est ton carnet de bord : chaque trade, pourquoi tu l’as pris, et ce que tu as ressenti.',
  'Ligne de journal : achat Exemplia 42 €, stop 41 €, sorti à 41 €, « j’étais pressé ». Le « pressé » est l’info la plus utile.',
  'Ne noter que les trades gagnants. On apprend surtout de ceux qu’on a perdus.'],
'c13-3': ['Le calendrier économique donne les dates des annonces qui peuvent faire bouger fortement les prix.',
  '50 allers-retours par an à 4 € de frais chacun : 200 € de frais, même si tu ne gagnes rien.',
  'Oublier les frais et l’impôt dans ses résultats. On peut croire qu’on gagne alors qu’on perd.'],
'c14-1': ['Une famille de stratégies, c’est une façon de jouer : suivre la tendance, parier sur un retour, ou acheter et garder.',
  'Suivi de tendance : on achète un titre qui fait des sommets de plus en plus hauts, avec un stop sous le dernier creux.',
  'Utiliser la même stratégie partout. Suivre la tendance marche mal quand le prix tourne en rond.'],
'c14-2': ['Un backtest, c’est vérifier sur le passé ce qu’aurait donné une règle précise, frais compris.',
  'Une règle réglée sur 2015 à 2020, puis vérifiée sur 2021 à 2023, des années jamais utilisées : c’est le test honnête.',
  'Régler sa stratégie jusqu’à ce que le passé soit parfait. Elle colle au passé et rate l’avenir.'],
'c15-1': ['Un future, c’est une promesse d’acheter ou de vendre plus tard, à un prix fixé aujourd’hui. Une option, c’est un droit qu’on paie.',
  'Put à 50 €, prime 3 €. L’action tombe à 40 € : tu vends à 50 €, soit 10 € moins 3 € de prime, 7 € gagnés par action.',
  'Acheter des options parce qu’elles coûtent peu. Beaucoup finissent sans valeur à l’échéance.'],
'c15-2': ['La macroéconomie, c’est la santé de l’économie entière : taux, inflation, emploi, prix du pétrole.',
  'La BCE monte ses taux : emprunter coûte plus cher, les anciennes obligations perdent de la valeur, la croissance ralentit souvent.',
  'Ouvrir une position juste avant une annonce importante. Le prix peut sauter au-delà de ton stop.'],
};
/* ---------- 1. la vidéo remplace la leçon à lire ---------- */
const _startMissionV56 = startMission;
startMission = function(id, mode = 'full'){ const r = _startMissionV56(id, mode);
  try { const m = M && M.m; if (NT_FX.nolesson && NT_FX.vid5 && NT_FX.vidalways && m && m.id === id && mode === 'full' && M.mode === 'full' && M.i === 0 && !M.end && m.ch && !m.session && M.steps.some(s => s.type === 'lesson')){
      const keep = M.steps.filter(s => s.type !== 'lesson'); if (keep.length){ M.steps = keep; M.noLesson = true; if (!M.vid) renderPlayer(); } else M.lessonOnly = true; } } catch(e){}
  return r; };
/* mission « Leçon » (les introductions de chapitre) : la vidéo vue jusqu'au bout valide la leçon ;
   si on passe la vidéo, la leçon à lire reste là (pour ne rien rater) */
const _vidEndV56 = vidEnd;
vidEnd = function(){ const V = M && M.vid, full = !!(V && V.sc && V.i >= V.sc.length - 1), lo = !!(M && M.lessonOnly); const r = _vidEndV56.apply(this, arguments);
  try { if (lo && full && M && !M.end && !M.vid){ M.i = M.steps.length - 1; finish(); } } catch(e){} return r; };
/* ---------- 2. trois scènes de plus par fiche ---------- */
const _v5ScriptV56 = v5Script;
v5Script = function(m){ const sc = _v5ScriptV56(m); try {
    if (!NT_FX.vidplus || !m || !m.ch || m.session) return sc; const f = v54Fiche(m), X = f && V57[f.id]; if (!X) return sc;
    const keys = new Set(); (f.body || []).forEach(p => { keys.add(v54Key(p)); v5Parts(p).forEach(x => keys.add(v54Key(x))); });
    const isB = s => s.eb === 'Le cours' && keys.has(v54Key(s.t)); const iB = sc.findIndex(isB); if (iB < 0) return sc;   // déjà vu : la scène « Rappel » suffit
    let iE = sc.findIndex(s => s.eb === 'Exemple' && f.ex && v54Key(s.t) === v54Key(f.ex)); if (iE < 0){ sc.forEach((s, i) => { if (isB(s)) iE = i; }); }
    const mk = (eb, t, i, k) => { let s = v5Scene(k ? { k: 'say', eb, t, tpl: 'v57', v57k: k } : { k: 'say', eb, t }, i, []); if (!k && !V57_OK.has(s.tpl)) s = v5Scene({ k: 'say', eb, t, tpl: 'v57', v57k: 'ex' }, i, []); s.v57 = eb; return s; };
    const out = sc.slice(); out.splice(iE + 1, 0, mk('Autre exemple', X[1], iE + 1), mk('Le piège', X[2], iE + 2, 'piege')); out.splice(iB, 0, mk('En clair', X[0], iB, 'clair')); return out;
  } catch(e){ return sc; } };
if (window.NT_DEBUG){ NT_DEBUG.v57 = id => { const m = (window.NT_MISSIONS || []).find(x => x.id === id); return m ? (NT_DEBUG.v5(id) || []).map(s => (s.v57 ? '+ ' : '  ') + s.eb + ' | ' + (s.t || '').slice(0, 70)) : null; }; }
/* fin d'une leçon-vidéo : pas de « 0/0 réussites » */
const _debriefHTMLV56 = debriefHTML;
debriefHTML = function(){ let s = _debriefHTMLV56(); try { if (M && M.lessonOnly && M.end && !M.end.n){ s = s.replace('>Mission accomplie<', '>Leçon vue en vidéo<').replace(/<b class="tn">0\/0<\/b><span>Réussites<\/span>/, '<b class="tn">Vue</b><span>Vidéo leçon</span>'); } } catch(e){} return s; };
/* « En clair » et « Le piège » : un visuel simple et sûr (pas de schéma deviné à partir de la phrase) */
/* schémas qui suivent fidèlement la phrase ; sinon, carte « exemple » avec les chiffres tels qu'écrits */
const V57_OK = new Set(['calc', 'def', 'candle', 'grow', 'seq', 'split', 'ind', 'tri']);
V5T.v57 = function(X){ const k = X.it.v57k === 'piege' ? 'piege' : X.it.v57k === 'ex' ? 'ex' : 'clair'; X.cue(0, 'a'); X.cue(280, 'b');
  if (k === 'ex'){ const N = [...new Set([...String(X.it.t).matchAll(new RegExp(`[+−-]?${V5_NUM}\\s?(?:M€|Md€|€|%)`, 'g'))].map(m => m[0].trim()))].slice(0, 4);
    N.forEach((n, j) => { const w = X.C.w.findIndex(x => x.includes(n.split(/[\s\u00a0\u202f]/)[0].replace(/^[+−-]/, ''))); X.cue(Math.max(400 + j * 200, w >= 0 ? X.at(w) - 120 : 600 + j * 500), 'n' + j); });
    return `<div class="v57-card k-ex"><b class="v57-lb" data-c="a">Exemple chiffré</b>${N.length ? `<div class="v57-nums">${N.map((n, j) => `<span data-c="n${j}">${h(v5NBT(n))}</span>`).join('')}</div>` : ''}</div>`; }
  const ic = k === 'piege' ? '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 L44 40 H4 Z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><path d="M24 19 v10" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/><circle cx="24" cy="34.5" r="2.3" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 a13 13 0 0 0 -8 23.3 c1.6 1.3 2.6 3 2.6 5 V36 h10.8 v-1.7 c0 -2 1 -3.7 2.6 -5 A13 13 0 0 0 24 6 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M19 41 h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  return `<div class="v57-card k-${k}"><div class="v57-ic" data-c="a">${ic}</div><b class="v57-lb" data-c="b">${k === 'piege' ? 'L’erreur à éviter' : 'En une phrase'}</b></div>`; };
/* une explication longue découpée en « étapes » (une étape par virgule) déborde sur téléphone : simple dessin à la place */
const _v5SceneV57 = v5Scene;
v5Scene = function(it, idx, L){ const r = _v5SceneV57(it, idx, L); try { if (r && r.tpl === 'steps' && r.v56 && ((r.t || '').match(/,/g) || []).length >= 3){ const x = _v5SceneV57({ k: 'say', eb: r.eb, t: r.t, tpl: 'icon' }, idx, L); x.v56 = r.v56; return x; } } catch(e){} return r; };

render();
})();
