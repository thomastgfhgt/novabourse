const PAGES = {};

/* Générateur pseudo-aléatoire PUREMENT DÉCORATIF, local à cette fonction :
   il dessine la courbe animée d'illustration du bandeau d'accueil et ne lit,
   n'écrit ni ne touche à aucune donnée financière (QUOTES/HIST/portefeuille).
   Ce n'est pas le rng()/series() supprimé ailleurs : celui-ci n'a jamais
   existé dans ce fichier et n'a pas été recréé. Renommé sans ambiguïté. */
function heroChart(){
  const W = 1000, H = 700;
  let heroSeed = 777;
  const r = () => { heroSeed = (heroSeed * 1103515245 + 12345) % 2147483648; return heroSeed / 2147483648; };
  const n = 54;
  const pts = [];
  let v = 0;
  for (let i = 0; i < n; i++){
    const t = i / (n - 1);
    let step = 2.6 + (r() - 0.34) * 3.2;
    const nearEnd = i > n - 6;
    if (!nearEnd && i && i % 7 === 0) step -= 5.4 + r() * 4.2;
    if (!nearEnd && i && i % 13 === 0) step -= 7.5 + r() * 3;
    if (nearEnd) step = 4.6 + r() * 2.4;
    v = Math.max(0, v + step);
    pts.push({ x: 30 + t * (W - 190), y: v });
  }
  const min = Math.min(...pts.map(p => p.y)), max = Math.max(...pts.map(p => p.y));
  const span = (max - min) || 1;
  pts.forEach(p => { p.y = H - 70 - ((p.y - min) / span) * (H - 190); });

  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < n; i++){
    const a = pts[i - 1], b = pts[i], cx = (a.x + b.x) / 2;
    d += ` C${cx.toFixed(1)},${a.y.toFixed(1)} ${cx.toFixed(1)},${b.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }

  const cols = 14, rows = 9;
  const grid = [
    ...Array.from({ length: cols + 1 }, (_, i) =>
      `<line x1="${((i / cols) * W).toFixed(1)}" y1="0" x2="${((i / cols) * W).toFixed(1)}" y2="${H}"/>`),
    ...Array.from({ length: rows + 1 }, (_, i) =>
      `<line x1="0" y1="${((i / rows) * H).toFixed(1)}" x2="${W}" y2="${((i / rows) * H).toFixed(1)}"/>`),
  ].join('');

  const area = `${d} L${pts[n - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
  const last = pts[n - 1], before = pts[n - 4];
  const angle = Math.atan2(last.y - before.y, last.x - before.x) * 180 / Math.PI;

  return `<div class="hero-chart" aria-hidden="true">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="hcFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity=".16"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="hcStroke" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity=".3"/>
          <stop offset="100%" stop-color="var(--accent)"/>
        </linearGradient>
      </defs>
      <g class="hc-grid">${grid}</g>
      <path class="hc-area" d="${area}" fill="url(#hcFill)"/>
      <path class="hc-line" d="${d}" fill="none" stroke="url(#hcStroke)" stroke-width="4"
        stroke-linecap="round" stroke-linejoin="round"/>
      <g class="hc-tip" transform="translate(${last.x.toFixed(1)},${last.y.toFixed(1)})">
        <circle class="hc-halo" r="17" fill="var(--accent)" opacity=".16"/>
        <circle r="7" fill="var(--accent)" stroke="var(--bg)" stroke-width="3"/>
        <g transform="rotate(${angle.toFixed(1)})">
          <path class="hc-arrow" d="M14 0 L52 0 M39 -12 L52 0 L39 12" fill="none"
            stroke="var(--accent)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </g>
    </svg>
  </div>`;
}

/* Les 4 raccourcis passent tous par la VRAIE recherche existante
   (openSearch/pick, voir plus bas) plutôt que par un flux dédié
   inventé pour chacun — searchIntent (module-level, consommé et remis
   à null dans pick()) indique simplement ce qu'il faut faire du
   résultat choisi : ouvrir sa fiche (défaut, intent absent), lancer
   runAnalysis() dessus, ouvrir l'achat, ou ouvrir la création d'alerte.
   Aucun nouveau parcours de recherche, aucune donnée inventée. Icônes
   reprises telles quelles du brief (2026-09-23, passe 2) — pas les
   ICON.search/spark/plus/radar déjà existants dans ce fichier, qui ont
   des tracés légèrement différents. */
const NB_QUICK = [
  { intent:'', title:'Rechercher',
    desc:"Trouver instantanément une action, ETF, crypto ou entreprise.",
    icon:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/>' },
  { intent:'analyze', title:'Analyser avec l’IA',
    desc:"Entrer un actif et lancer directement l’analyse NovaTitre.",
    icon:'<path d="M12 2C12.8 7.2 16.8 11.2 22 12C16.8 12.8 12.8 16.8 12 22C11.2 16.8 7.2 12.8 2 12C7.2 11.2 11.2 7.2 12 2Z"/>' },
  { intent:'buy', title:'Ajouter au portefeuille',
    desc:"Ajouter rapidement une position ou un actif à suivre.",
    icon:'<path d="M12 4 V20"/><path d="M4 12 H20"/>' },
  { intent:'alert', title:'Créer une alerte',
    desc:"Prix cible, variation, actualité importante, signal Radar, etc.",
    icon:'<path d="M18 8A6 6 0 0 0 6 8C6 14 4 16 3 17H21C20 16 18 14 18 8"/><path d="M10 20Q12 22 14 20"/>' },
];
/* Rejouée une seule fois par session (2026-09-23, voir .no-intro dans
   le CSS du temple) : PAGES.home() est appelée à CHAQUE navigation vers
   l'accueil, pas seulement au premier chargement — sans ce drapeau,
   l'effet d'entrée du temple (cascade + scale-in, jusqu'à ~1,4s
   d'opacity:0) rejouerait à chaque retour sur la page, perçu comme un
   bug ("le temple a disparu") plutôt qu'un effet d'entrée voulu. Lu ET
   mis à jour ici (avant le retour du HTML), jamais ailleurs : la
   décision "déjà vu ou non" doit être prise au moment exact où ce HTML
   précis est généré. */
let templeIntroPlayed = false;
PAGES.home = () => {
  const suivies = state.watchlist.map(id => byId[id]).filter(Boolean);
  const marche = stocks.slice(0, 6);
  const pf = portfolioValue();
  const hasPositions = state.wallet.positions.length > 0;
  const templeSeenBefore = templeIntroPlayed;
  templeIntroPlayed = true;

  return `
  <section class="nb-hero-v2">
    <section class="nova-temple-section">
      <svg class="nova-temple${templeSeenBefore ? ' no-intro' : ''}" viewBox="0 0 1000 720" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Temple NovaTitre">
        <!-- Entrée en scène par blocs (2026-09-23, "un maximum d'animation
             autour de cette architecture romaine") : chaque groupe
             ci-dessous porte sa propre classe .temple-part + un délai
             inline, pour un effet "le temple se construit" plutôt qu'une
             apparition d'un seul bloc — voir les classes temple-top/
             nova-temple-brand/temple-col/temple-steps dans le CSS. -->
        <g class="temple-top temple-part" style="animation-delay:0s">
          <path d="M70 245 L500 45 L930 245" class="temple-line temple-main"/>
          <path d="M110 245 L500 70 L890 245" class="temple-line temple-secondary"/>
          <line x1="65" y1="245" x2="935" y2="245" class="temple-line temple-main"/>
          <line x1="85" y1="270" x2="915" y2="270" class="temple-line temple-main"/>
          <line x1="105" y1="292" x2="895" y2="292" class="temple-line temple-secondary"/>
        </g>
        <!-- Logo NovaTitre réel (ICON.brand, voir header) recentré/mis à
             l'échelle autour de son propre centre géométrique (763.5,477 —
             calculé depuis ses tracés, pas estimé) pour une largeur cible
             d'environ 95px, puis positionné au centre du fronton. Jamais
             redessiné : mêmes 3 <path> que .logo-m dans le header. -->
        <g class="nova-temple-brand temple-part" style="animation-delay:.08s"
           transform="translate(500 170) scale(.1314) translate(-763.5 -477)">
          <path d="M 770,180 L 781,283 L 781,293 L 783,303 L 784,324 L 802,500 L 803,521 L 808,559 L 808,569 L 810,583 L 815,594 L 828,607 L 1028,718 L 1125,770 L 949,475 Z"/>
          <path d="M 758,181 L 616,414 L 402,770 L 410,766 L 510,699 L 615,626 L 741,535 L 754,520 L 758,508 Z"/>
          <path d="M 410,774 L 1120,774 L 861,663 L 849,659 L 747,615 L 727,608 L 712,608 L 697,614 L 572,686 Z"/>
        </g>
        ${[125,295,575,745].map((tx,i) => `
        <g class="temple-col temple-part" style="animation-delay:${(.15 + i*.06).toFixed(2)}s" transform="translate(${tx} 0)">
          <line x1="0" y1="305" x2="130" y2="305" class="temple-line temple-main"/>
          <line x1="12" y1="323" x2="118" y2="323" class="temple-line temple-secondary"/>
          <path d="M20 348 Q32 312 49 340 Q65 305 78 340 Q96 312 110 348" class="temple-line temple-main"/>
          <line x1="28" y1="358" x2="102" y2="358" class="temple-line temple-secondary"/>
          <rect x="40" y="368" width="50" height="238" rx="3" class="temple-line temple-main"/>
          <line x1="51" y1="378" x2="51" y2="596" class="temple-line temple-flute"/>
          <line x1="65" y1="378" x2="65" y2="596" class="temple-line temple-flute"/>
          <line x1="79" y1="378" x2="79" y2="596" class="temple-line temple-flute"/>
          <line x1="30" y1="615" x2="100" y2="615" class="temple-line temple-secondary"/>
          <line x1="18" y1="635" x2="112" y2="635" class="temple-line temple-main"/>
        </g>`).join('')}
        <g class="temple-steps temple-part" style="animation-delay:.42s">
          <line x1="105" y1="655" x2="895" y2="655" class="temple-line temple-main"/>
          <line x1="75" y1="680" x2="925" y2="680" class="temple-line temple-main"/>
          <line x1="45" y1="705" x2="955" y2="705" class="temple-line temple-main"/>
        </g>
      </svg>
    </section>

    <section class="nova-quick-actions" aria-label="Actions rapides">
      ${NB_QUICK.map(a => `
        <button type="button" class="nova-quick-action" data-search ${a.intent ? `data-search-intent="${a.intent}"` : ''}
          aria-label="${esc(a.title)}">
          <span class="nova-action-circle" aria-hidden="true"><svg viewBox="0 0 24 24">${a.icon}</svg></span>
          <span class="nova-action-title">${esc(a.title)}</span>
          <span class="nova-action-description">${esc(a.desc)}</span>
        </button>`).join('')}
    </section>

    <h1 class="nb-hero-title">Prêt à investir ?</h1>
    <p class="nb-hero-sub2">Données en temps réel.</p>
    <div class="nb-cta-row">
      <button class="nb-cta-a" data-search data-search-intent="analyze">Analyser</button>
      <button class="nb-cta-s" data-search>Rechercher</button>
    </div>
  </section>

  <article class="nb-pf2">
    <p class="nb-pf2-eyebrow">Mes positions</p>
    ${hasPositions ? `
      <p class="nb-pf2-val tabular-nums">${fmt.eur(pf.total)}</p>
      <p class="nb-pf2-var ${pf.gain >= 0 ? 'up-t' : 'down-t'} tabular-nums">
        ${arrow(pf.gainPct)} ${fmt.eur(Math.abs(pf.gain))} · ${fmt.pct(pf.gainPct)}</p>
      <button class="nb-pf2-detail" data-go="portfolio">Voir le détail</button>
    ` : `
      <div class="nb-pf2-empty">
        <p>Votre portefeuille est vide.</p>
        <button class="nb-cta-a" style="width:100%;margin-top:14px" data-search data-search-intent="buy">Ajouter une position</button>
      </div>
    `}
  </article>

  <!-- Grande carte Nova Review (2026-10-06, §54-56 du prompt maître
       NovaTitre : "les quatre modules Nova [...] deviennent le cœur de
       l'accueil") — premier module à recevoir sa vraie grande carte
       (données réelles, voir novaReviewHomeCard()/js/nova.js). Les 3
       autres (NovaBot/Nova Event/Nova News) restent pour l'instant dans
       la grille compacte juste en dessous, inchangée : aucun des 3 n'a
       encore de données/logique prêtes pour sa propre grande carte —
       prochaine étape une fois celle-ci éprouvée en usage réel, jamais
       les 4 reconstruites d'un coup (§87). -->
  ${novaReviewHomeCard()}
  <!-- NovaBot (2026-10-06) : 2e des 4 modules à recevoir sa grande carte
       (données réelles, novabotHomeCard()/js/nova.js) — même principe et
       même décision que pour Nova Review juste au-dessus : Nova Event/
       Nova News restent dans la grille compacte, aucun des deux n'a
       encore de données/logique prêtes pour sa propre grande carte. -->
  ${novabotHomeCard()}
  <!-- Nova News (2026-10-06) : 3e des 4 modules à recevoir sa grande
       carte (novaNewsHomeCard()/js/nova.js). -->
  ${novaNewsHomeCard()}
  <!-- Nova Event (2026-10-06) : 4e et dernier des 4 modules à recevoir sa
       grande carte (novaEventHomeCard()/js/nova.js) — calendrier résultats/
       dividendes réel, voir _nasdaqCalendar.js. Les 4 grandes cartes sont
       maintenant toutes branchées sur de vraies données (§87/§54-60). -->
  ${novaEventHomeCard()}

  <!-- Grille Nova (2026-09-23, "préparer visuellement les prochaines
       fonctionnalités") : NovaBot/Nova Review/Nova Event/Nova News,
       voir novaHubCard()/NOVA_FEATURES/.nova-hub plus haut. Volontai-
       rement APRÈS "Mes positions" plutôt qu'en tout premier : le
       contenu personnel de l'utilisateur (position, montant) prime sur
       la découverte de nouvelles fonctions. -->
  <nav class="nova-hub" aria-label="Fonctions NovaTitre">
    ${novaHubCard('novabot')}${novaHubCard('novareview')}${novaHubCard('novaevent')}${novaHubCard('novanews')}
  </nav>

  <article class="card" style="margin-top:16px">
    <div class="section-h" style="margin-bottom:14px">
      <p class="eyebrow">Ma liste</p>
      ${suivies.length ? `<button class="btn btn-ghost btn-sm" data-go="watchlist">Tout voir</button>` : ''}
    </div>
    ${suivies.length
      ? `<div class="rows">${suivies.slice(0, 3).map(x => stockRow(x)).join('')}</div>`
      : `<p class="small">Touchez l'étoile sur une entreprise pour la suivre.</p>`}
    <button class="btn btn-ghost btn-sm" style="margin-top:12px" data-go="lists">
      ${svg(ICON.list,2)} Mes listes${state.lists.length ? ` (${state.lists.length})` : ''}</button>
  </article>

  <section class="section">
    <div class="section-h">
      <h2 class="h2">Marché</h2>
      <button class="btn btn-ghost btn-sm" data-go="markets">Tout voir</button>
    </div>
    <div class="card"><div class="rows rows-grid">${marche.map(x => stockRow(x)).join('')}</div></div>
  </section>

  ${pricingBlock(true)}`;
};

function pricingBlock(compact = false){
  const yearly = state.settings.cycle === 'annuel';
  const P = [
    { id:'free', n:'Découverte', price:0, yr:0,
      d:"Comprendre les marchés et suivre quelques entreprises.",
      f:['Cours et fondamentaux réels','10 entreprises suivies','Portefeuille virtuel',
         '5 analyses multi-modèles par mois'] },
    { id:'pro', n:'Pro', price:9.99, yr:79, hot:true,
      d:"Analyser sérieusement, sans limite de suivi.",
      f:['Tout Découverte','Suivi et alertes illimités','200 analyses par mois',
         'Comparateur','Historique complet des scores'] },
    { id:'elite', n:'Elite', price:19.99, yr:159,
      d:"L'analyse la plus poussée, sans plafond.",
      f:['Tout Pro','Analyses illimitées','Comparateur jusqu’à 5 entreprises',
         'Alertes de prix personnalisées','Support prioritaire'] },
  ];
  const save = p => p.price ? Math.round((1 - p.yr / (p.price * 12)) * 100) : 0;
  return `
  <section class="section" id="tarifs">
    <div class="center">
      <p class="eyebrow">Offres</p>
      <h2 class="title" style="margin-top:6px">Commencez gratuitement.</h2>
      <p class="lead measure-l" style="margin:12px auto 0">
        L'essentiel est gratuit.</p>
      ${CONFIG.annualBilling ? `<div class="seg" data-seg="cycle" style="margin-top:24px" role="group" aria-label="Périodicité">
        <button data-cycle="mensuel" aria-pressed="${!yearly}">Mensuel</button>
        <button data-cycle="annuel" aria-pressed="${yearly}">Annuel <span class="save">−34 %</span></button>
      </div>` : ''}
    </div>
    <div class="plans">
      ${P.map((p,i)=>`
        <div class="plan ${p.hot?'hot':''}">
          ${p.hot?'<span class="plan-b">Le plus choisi</span>':''}
          <div class="plan-n">${p.n}</div>
          <div class="plan-p tabular-nums">${p.price===0 ? 'Gratuit'
            : (yearly ? fmt.int(p.yr) : fmt.num(p.price,2))+' €<small> / '+(yearly?'an':'mois')+'</small>'}</div>
          ${p.price>0 && yearly ? `<span class="tag tag-up" style="margin-top:8px">
            ${save(p)} % d'économie · ${fmt.num(p.yr/12,2)} € par mois</span>` : ''}
          ${p.price>0 && !yearly ? `<p class="tiny" style="margin-top:8px">soit ${fmt.int(p.yr)} € par an en annuel</p>` : ''}
          <p class="plan-d">${esc(p.d)}</p>
          <ul>${p.f.map(x=>`<li>${svg(ICON.check,2.6)}<span>${esc(x)}</span></li>`).join('')}</ul>
          <button class="btn ${p.hot?'btn-a':p.id===state.settings.plan?'btn-g':'btn-s'}"
            data-plan="${p.id}">${p.id===state.settings.plan?'Offre actuelle'
              :p.price===0?'Continuer gratuitement':'Choisir '+p.n}</button>
        </div>`).join('')}
    </div>
    <p class="tiny center" style="margin-top:20px">
      Sans engagement · Paiement sécurisé</p>
  </section>`;
}
/* Nova Review (LOT H, Étape 3, 2026-09-24) : plus une page de présentation
   ("bientôt disponible") mais une vraie revue, construite uniquement à
   partir de données réelles déjà en base — state.transactions (chaque
   vente réelle, voir sellStock()/enregistrerTransaction()) et la thèse
   Nova Memory éventuellement renseignée à l'achat (openBuyReview,
   "Pourquoi cet achat ?", §27). Esprit "chess.com" du cahier des charges :
   séparer la QUALITÉ DU PROCESSUS (a-t-on tenu l'horizon qu'on s'était
   soi-même fixé ?) du RÉSULTAT (gain/perte réalisé) — jamais un jugement
   "bonne/mauvaise décision" inventé, seulement des faits comparés à ce que
   l'utilisateur avait lui-même déclaré. Aucune vente -> état honnête,
   jamais un faux contenu de démonstration. */