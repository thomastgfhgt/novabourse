const ICON = {
  brand:'<path fill="currentColor" stroke="none" d="M 770,180 L 781,283 L 781,293 L 783,303 L 784,324 L 802,500 L 803,521 L 808,559 L 808,569 L 810,583 L 815,594 L 828,607 L 1028,718 L 1125,770 L 949,475 Z"/><path fill="currentColor" stroke="none" d="M 758,181 L 616,414 L 402,770 L 410,766 L 510,699 L 615,626 L 741,535 L 754,520 L 758,508 Z"/><path fill="currentColor" stroke="none" d="M 410,774 L 1120,774 L 861,663 L 849,659 L 747,615 L 727,608 L 712,608 L 697,614 L 572,686 Z"/>',
  home:'<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/><path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21"/>',
  list:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  wallet:'<path d="M3 8.5h18v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/><path d="M8 8.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5M3 13h18"/>',
  user:'<circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  star:'<path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  sun:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
  moon:'<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  bell:'<path d="M18 15v-4a6 6 0 1 0-12 0v4l-2 3h16zM10 21h4"/>',
  brain:'<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 6 17a3 3 0 0 0 3 3z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2A3 3 0 0 1 18 17a3 3 0 0 1-3 3z"/><path d="M12 4v16"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z"/>',
  scale:'<path d="M12 4v16M5 8h14M7 8l-3 6h6zM17 8l-3 6h6z"/>',
  chart:'<path d="M4 18l5-6 4 3.5 7-8.5"/><path d="M4 21h17"/>',
  arrow:'<path d="M9 5l7 7-7 7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/>',
  trash:'<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  spark:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  filter:'<path d="M4 7h16M4 12h10M4 17h6"/><circle cx="17" cy="7" r="2"/><circle cx="11" cy="12" r="2"/><circle cx="7" cy="17" r="2"/>',
  /* Ajoutées 2026-09-23 pour la passe "architecture visuelle" (NovaBot/
     Nova Review/Nova Event/Nova News/Nova AI) — Nova AI réutilise
     volontairement spark, déjà dans ce fichier (Analyse), plutôt que
     d'en redessiner une variante quasi identique sans raison. */
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.8h17M8 3v4M16 3v4"/><circle cx="8.2" cy="14.2" r="1"/><circle cx="12" cy="14.2" r="1"/><circle cx="15.8" cy="14.2" r="1"/>',
  news:'<path d="M4.5 6h12a2 2 0 0 1 2 2v10a1.5 1.5 0 0 1-1.5 1.5H6.5A2 2 0 0 1 4.5 17.5z"/><path d="M18.5 9v8a1.5 1.5 0 0 0 1.5 1.5"/><path d="M8 9.6h6.5M8 12.8h6.5M8 16h4"/>',
  /* Enveloppe (2026-09-24, bouton "Continuer avec une adresse e-mail") :
     "book" existait déjà mais ne se lit pas comme un e-mail à cette
     taille (vérifié en direct) — jamais forcé la réutilisation d'une
     icône juste pour éviter d'en ajouter une. */
  mail:'<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4.5 7.2 12 12.5 19.5 7.2"/>',
  /* NovaBot (2026-09-24, retour utilisateur : "mettre le logo de
     NovaTitre en robot") — remplace le bot générique du premier jet :
     tête TRIANGULAIRE (même silhouette que le fronton du temple/le
     logo NovaTitre du header, jamais redessinée à l'identique faute de
     place à cette taille, mais reconnaissable) plutôt qu'une tête
     rectangulaire anonyme, avec 2 yeux ronds à l'intérieur, corps
     arrondi et 2 petits bras. */
  bot:'<path d="M12 3.5 L18 12.5 L6 12.5 Z"/><circle cx="10" cy="10.3" r=".9" fill="currentColor" stroke="none"/><circle cx="14" cy="10.3" r=".9" fill="currentColor" stroke="none"/><rect x="7" y="14" width="10" height="7" rx="2.5"/><path d="M4.5 16.5v2.5M19.5 16.5v2.5"/>',
  /* Jeu d'échecs complet (6 pièces, un code chacune) — mapping module <->
     pièce CENTRALISÉ dans NOVA_FEATURES (plus bas dans ce fichier),
     jamais ici : ces icônes sont de pures silhouettes, réutilisables
     pour n'importe quel module. 2e refonte du mapping (2026-10-07,
     retour utilisateur : "NovaBot = tour, Nova Review = fou, Nova News
     = cavalier, Nova Event = pion, Nova AI = reine" — remplace le tout
     premier mapping de la même journée). Base à 2 niveaux commune aux 6
     pièces (collerette + socle) pour une famille visuellement cohérente. */
  rook:'<path d="M7 3.2V7M10.33 3.2V7M13.67 3.2V7M17 3.2V7M6.2 7H17.8L16.3 18.1H7.7Z"/><path d="M6.3 20.4h11.4M7.6 20.4v-1.9M16.4 20.4v-1.9"/>',
  king:'<path d="M12 2v3.1M10.4 3.6h3.2"/><circle cx="12" cy="7" r="1.4"/><path d="M8.2 13.2Q7.7 9.6 12 8.4Q16.3 9.6 15.8 13.2Z"/><path d="M8 13.2h8l1.3 5.1H6.7Z"/><path d="M6.3 20.4h11.4M7.6 20.4v-2M16.4 20.4v-2"/>',
  bishop:'<circle cx="12" cy="3.4" r="1.25"/><path d="M12 4.65v1.55"/><path d="M8 13.4Q7.3 8 12 6.2Q16.7 8 16 13.4Z"/><path d="M9.3 9.6 14.7 11.3" stroke-linecap="round"/><path d="M7.7 13.4h8.6l1.1 4.6H6.6Z"/><path d="M6.3 20.4h11.4M7.6 20.4v-2M16.4 20.4v-2"/>',
  pawn:'<circle cx="12" cy="6.2" r="2.85"/><path d="M9.1 11.3Q12 9.3 14.9 11.3L16.3 18.1H7.7Z"/><path d="M6.3 20.4h11.4M7.6 20.4v-1.9M16.4 20.4v-1.9"/>',
  /* Reine d'échec (NOUVELLE, 2026-10-07, "Nova AI = une reine") — couronne
     à 3 pointes (3 petites boules pleines, convention classique pour la
     distinguer du roi à croix unique), corps fuselé, même base que les
     5 autres pièces. */
  queen:'<circle cx="7.7" cy="5.1" r=".95" fill="currentColor" stroke="none"/><circle cx="12" cy="3.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.3" cy="5.1" r=".95" fill="currentColor" stroke="none"/><path d="M7.7 6.1 12 7.9 16.3 6.1 15.5 10.3H8.5Z"/><path d="M8.3 13.3Q7.9 11.5 8.7 10.3h6.6Q16.1 11.5 15.7 13.3Z"/><path d="M8 13.3h8l1.3 5.1H6.7Z"/><path d="M6.3 20.4h11.4M7.6 20.4v-2M16.4 20.4v-2"/>',
  /* Cavalier d'échec (NOUVEAU, 2026-10-07, "Nova News = un cavalier") —
     profil de tête de cheval stylisé (encolure, chanfrein, oreille,
     crinière), la pièce la plus reconnaissable de l'échiquier par sa
     silhouette ; même base que les 5 autres pièces. */
  knight:'<path d="M8.3 18.2c-.4-2.9.1-5.3 1.5-7 1.1-1.3 1.3-2.2.6-3.1-.3-.4-.9-.4-1.2 0M9.4 7.6C9.9 5.9 11.2 4.8 13 4.7c1.8-.1 3.3 1 3.9 2.6.5 1.4.1 2.8-1 3.8-.8.7-1.7 1-2.7.9"/><circle cx="10.9" cy="8.6" r=".55" fill="currentColor" stroke="none"/><path d="M13 11.2 15.3 13.3Q16 15.6 15.4 18.2"/><path d="M6.3 20.4h11.4M7.6 20.4v-2M16.4 20.4v-2"/>',
};
const ICON_SHIFT = {
  home:[0.03,-1.95], list:[1.65,-3.56], wallet:[0,-0.41], star:[0,-0.46],
  check:[-0.04,-0.83], moon:[1.82,-1.87], bell:[-0.04,-1.52], shield:[0,0.38],
  scale:[0.02,0.89], chart:[-0.24,-4.31], arrow:[-0.46,0], book:[0.86,0.81],
  trash:[0.04,0.45], spark:[0,2.04],
};
const ICON_NAME = new Map(Object.entries(ICON).map(([k, v]) => [v, k]));
const svg = (d, w = 1.8) => {
  const shift = ICON_SHIFT[ICON_NAME.get(d)];
  const body = shift ? `<g transform="translate(${shift[0]},${shift[1]})">${d}</g>` : d;
  return `<svg viewBox="${d === ICON.brand ? '0 0 1536 1024' : '0 0 24 24'}" fill="none" stroke="currentColor"
    stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"
    preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${body}</svg>`;
};

const SECTOR_HUE = { 'Technologie':'#0071e3','Finance':'#5b4ae0','Santé':'#e0407a','Industrie':'#c47f0a',
  'Énergie':'#d2691e','Consommation':'#00a651','Automobile':'#0891b2','Luxe':'#a855c7',
  'Télécommunications':'#64748b' };
/* Logo réel (financialmodelingprep.com/image-stock/, endpoint public sans
   clé, vérifié empiriquement le 2026-09-29 : par ticker nu pour le
   composite US ("AAPL.png" -> 200 réel, "AAPL.US.png"/"AAPL.NASDAQ.png"
   -> 404), par "TICKER.SUFFIXE" pour les places hors US en réutilisant
   directement exchangeCode, déjà la même convention que eodhdSymbol()
   côté serveur pour PA/MI/HK — vérifié sur MC.PA, ISP.MI, 0700.HK -> 200
   réels. Couverture partielle assumée (ex. AAPL lui-même 404 malgré sa
   taille) : jamais bloquant, voir LOGO_OK/LOGO_FAILED ci-dessous.
   CORRECTIF (bug réel confirmé en test : image jamais chargée, case
   blanche vide au lieu des initiales) — view.innerHTML est reconstruit en
   entier à CHAQUE render() (confirmé : 7 fois en 3s rien qu'au premier
   affichage de Marchés, un par cotation/graphique qui arrive). Un <img>
   posé directement dans le HTML généré est donc détruit et recréé à
   chaque render(), avant que sa requête réseau ait la moindre chance
   d'aboutir — un verrou mort (livelock), jamais un simple ralentissement.
   Solution : précharger via new Image() (objet JS détaché du DOM, jamais
   affecté par la reconstruction de view.innerHTML), et ne poser un <img>
   dans le template QUE lorsque l'URL est déjà confirmée en cache
   navigateur (LOGO_OK) — le <img> alors rendu se peint instantanément
   depuis le cache, sans nouvelle requête réseau ni risque de coupure. */
const LOGO_PLACES_US = new Set(['NASDAQ','NYSE','NYSE ARCA','US']);
function logoUrl(s){
  if (!s || !s.ticker || (s.type !== 'stock' && s.type !== 'etf')) return null;
  const suffixe = s.exchangeCode && !LOGO_PLACES_US.has(s.exchangeCode) ? '.' + s.exchangeCode : '';
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(s.ticker + suffixe)}.png`;
}
const LOGO_OK = new Set();
const LOGO_FAILED = new Set();
function assurerLogo(url){
  if (!url || LOGO_OK.has(url) || LOGO_FAILED.has(url)) return;
  LOGO_FAILED.add(url);   // pose immédiatement : une seule tentative par URL, jamais de boucle si onload ne répond jamais
  const img = new Image();
  img.onload = () => { LOGO_OK.add(url); LOGO_FAILED.delete(url); render(); };
  img.src = url;
}
/* `eager` (2e paramètre, true par défaut) : laisse tel quel tous les
   appels existants (fiche action, Comparer, Radar — quelques avatars à
   la fois, jamais un souci). Passé à false par marketsRows() au-delà de
   CHARGEMENT_MASSE_MAX_SYMBOLES lignes visibles (voir son propre
   commentaire, même bug de fluidité que pour les sparklines) : un logo
   DÉJÀ en cache (LOGO_OK) s'affiche quand même, seule une NOUVELLE
   tentative de chargement est différée plutôt que lancée pour une carte
   loin sous le pli. */
const avatar = (s, eager = true) => {
  const url = logoUrl(s);
  const pret = url && LOGO_OK.has(url);
  if (eager && url && !pret && !LOGO_FAILED.has(url)) assurerLogo(url);
  return `<span class="av" style="background:${SECTOR_HUE[s.sector]||'#64748b'}">${esc(s.ticker.slice(0,2))}${pret
    ? `<img src="${esc(url)}" alt="" decoding="async">` : ''}</span>`;
};
const scoreColor = (v) => v === null || v === undefined ? 'var(--ink-4)' : v >= 70 ? 'var(--up)' : v >= 50 ? 'var(--warn)' : 'var(--down)';

const starBtn = (id) => {
  const on = state.watchlist.includes(id);
  return `<button class="star" data-star="${esc(id)}" aria-pressed="${on}"
    aria-label="${on?'Retirer de la liste de suivi':'Suivre cette entreprise'}">
    <svg viewBox="0 0 24 24" fill="${on?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7"
      stroke-linejoin="round">${ICON.star}</svg></button>`;
};
const infoBtn = (term) => `<button class="info" data-term="${esc(term)}" aria-label="Comprendre : ${esc(term)}">?</button>`;
const emptyState = (title, text, action) => `
  <div class="empty">
    <div class="empty-i">${svg(ICON.spark)}</div>
    <h3>${esc(title)}</h3><p>${text}</p>
    ${action?`<button class="btn btn-a btn-sm" style="margin-top:20px" data-go="${action.go}">${esc(action.label)}</button>`:''}
  </div>`;
/* ============================================================
   NOVA — architecture visuelle (2026-09-23)
   ============================================================
   Passe explicitement demandée comme "visuel uniquement" : emplacements,
   identité, points d'accès des futures fonctions NovaBot/Nova Review/
   Nova Event/Nova News. AUCUN moteur derrière — data-soon déclenche un
   simple toast "bientôt disponible" (voir le gestionnaire de clic),
   jamais un faux résultat. Config centralisée une seule fois ici,
   réutilisée par la grille de l'accueil (novaHubCard) ET les pages de
   présentation (novaFeaturePage) plutôt que dupliquée à chaque endroit
   où une de ces 4 fonctions apparaît. rgb (triplet, pas un hex) permet
   les fonds teintés en rgba() — jamais color-mix(), voir la note sur
   .logo-m plus haut dans ce fichier pour pourquoi ce fichier évite
   color-mix(). */
/* Jeu d'échecs complet — mapping CENTRALISÉ module <-> pièce <-> couleur,
   seul endroit à modifier pour tout changer partout où un module Nova
   apparaît (accueil, Portefeuille, fiche action...). 2e refonte du
   mapping (2026-10-07, retour utilisateur détaillé : "NOVA AI = reine,
   NOVABOT = tour, NOVA REVIEW = fou, NOVA NEWS = cavalier, NOVA EVENT =
   pion" — remplace le tout premier mapping, fait plus tôt le même jour).
   accent/rgb = teintes dédiées §4 de la demande ("une couleur TRÈS
   subtile par Nova, jamais toute la carte recolorée") — identiques aux
   tokens --nova-ai/--nova-bot/--nova-review/--nova-news/--nova-event
   (styles.css) ; dupliquées ici en hex+rgb plutôt que lues depuis les
   tokens CSS car ce fichier JS n'a aucun moyen de résoudre une variable
   CSS à la génération du HTML (calculé dans le navigateur, pas ici) —
   SI la palette change, modifier les deux endroits ensemble (déjà le
   cas pour --accent/orange ailleurs dans le projet, même contrainte). */
const NOVA_FEATURES = {
  /* Nova AI n'a JAMAIS de page de présentation dédiée (consigne déjà en
     place avant cette refonte, voir novaSuiteRow() plus bas) — figure
     ici uniquement pour centraliser son icône/couleur/titre, repris par
     page-portfolio.js et page-stock.js au lieu de les redéfinir en dur
     à chaque endroit (c'était le cas avant cette passe). */
  novaai: { icon:'queen', accent:'#4D7CFF', rgb:'77,124,255',
    title:'Nova AI', tag:"L'intelligence NovaTitre",
    desc:"Nova AI analyse une action à la demande en croisant plusieurs modèles de langage — jamais un chiffre inventé, uniquement vos données réelles." },
  novabot: { icon:'rook', accent:'#805DFF', rgb:'128,93,255',
    title:'NovaBot', tag:'Automatisation intelligente',
    desc:"NovaBot pourra bientôt gérer une partie de vos investissements selon des règles que vous aurez vous-même définies — jamais un ordre passé sans votre accord explicite." },
  novareview: { icon:'bishop', accent:'#E653A5', rgb:'230,83,165',
    title:'Nova Review', tag:'Revoir vos décisions',
    desc:"Nova Review reviendra sur vos décisions d'investissement passées pour vous aider à comprendre ce qui a fonctionné, ou non, et pourquoi." },
  /* Description corrigée (2026-10-06, prompt maître §34) : la version
     d'origine (2026-09-23, passe "visuel uniquement", AUCUN moteur
     derrière à l'époque) décrivait un futur journal des nouveautés de
     l'app elle-même — un produit différent de celui demandé par le
     prompt maître (§34 : calendrier résultats/dividendes/événements
     économiques des valeurs suivies/détenues). Le prompt maître prévaut
     : Nova Event a maintenant un vrai moteur (voir PAGES.novaevent,
     evenementsSuivis()) construit sur cette définition-ci. */
  novaevent: { icon:'pawn', accent:'#45C8FF', rgb:'69,200,255',
    title:'Nova Event', tag:'Vos prochains événements',
    desc:"Nova Event rassemble les prochains résultats et dividendes des valeurs que vous suivez ou détenez — jamais une date devinée, seulement ce qui est réellement connu." },
  novanews: { icon:'knight', accent:'#6D94FF', rgb:'109,148,255',
    title:'Nova News', tag:"L'actualité qui compte",
    desc:"Nova News réunira l'actualité économique, financière et géopolitique susceptible d'influencer vos investissements — dans chaque fiche, l'actualité propre à l'entreprise consultée." },
};
/* ChessNovaIcon (§3 de la refonte visuelle, 2026-10-07) : le petit carré
   arrondi teinté + pièce d'échec blanche, SEUL endroit qui génère ce
   balisage — avant cette fonction, chaque xxxHomeCard() (js/nova.js)
   dupliquait exactement le même <span class="nova-big-icon">...</span>
   avec seulement la clé NOVA_FEATURES qui changeait (5 copies quasi
   identiques, §11 de la demande : "ne pas dupliquer 5 fois le même
   CSS/code"). `cls` optionnel : la classe CSS réelle du carré diffère
   selon le contexte (.nova-big-icon pour les grandes cartes,
   .nova-hub-i pour l'ancienne grille compacte) — toujours la MÊME
   pièce/couleur pour un module donné, seule la taille du conteneur
   change. */
function chessNovaIcon(key, cls = 'nova-big-icon'){
  const f = NOVA_FEATURES[key];
  if (!f) return '';
  return `<span class="${cls}" style="--nf-accent:${f.accent};--nf-accent-rgb:${f.rgb}">${svg(ICON[f.icon],1.8)}</span>`;
}
/* Carte compacte de la grille d'accueil (2x2 mobile → 4 colonnes
   desktop, voir le CSS .nova-hub) — icône + titre + accroche d'une
   ligne, jamais un pavé qui rallonge la page (refusé explicitement). */
const novaHubCard = (key) => {
  const f = NOVA_FEATURES[key];
  return `<button type="button" class="nova-hub-card" data-go="${key}">
    ${chessNovaIcon(key, 'nova-hub-i')}
    <span class="nova-hub-t">${esc(f.title)}</span>
    <span class="nova-hub-s">${esc(f.tag)}</span>
  </button>`;
};
/* Page de présentation générique des 4 fonctions Nova — réutilise
   .empty/.empty-i (déjà utilisé partout ailleurs pour les états vides)
   plutôt qu'un nouveau composant, seule la teinte de l'icône change par
   fonction. "Bientôt disponible" honnête plutôt qu'un faux contenu —
   consigne explicite de cette passe. */
const novaFeaturePage = (key) => {
  const f = NOVA_FEATURES[key];
  return `<div class="page-in">
    <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>
    <div class="empty" style="padding-top:8px">
      <div class="empty-i" style="background:rgba(${f.rgb},.14);color:${f.accent}">${svg(ICON[f.icon],1.7)}</div>
      <h3 style="font-size:22px;margin-top:18px">${esc(f.title)}</h3>
      <p style="max-width:46ch">${esc(f.desc)}</p>
      <span class="tag" style="margin-top:16px;background:rgba(${f.rgb},.14);color:${f.accent}">Bientôt disponible</span>
    </div>
  </div>`;
};
/* Rangée compacte de 2-3 accès Nova (2026-09-23) — réutilisée sur le
   Portefeuille (NovaBot/Nova Review/Nova AI) et la fiche action (Nova
   AI/Nova Review). Défilement horizontal plutôt que retour à la ligne :
   ne se compresse ni ne chevauche jamais, quelle que soit la largeur
   d'écran (§15 du brief, testé 320-430px). `go` navigue vers une page
   de présentation existante (NovaBot/Nova Review) ; `soon` (sans page
   dédiée) affiche juste un toast ; `attr` (retour utilisateur : "Analyser
   une action c'est Nova AI") permet de brancher le bouton sur une action
   RÉELLE déjà existante (ex. data-nova, l'analyse multi-IA déjà en place
   sur la fiche action) plutôt que systématiquement data-soon — Nova AI
   n'est fictif que là où rien de réel n'existe encore derrière. */
const novaSuiteRow = (items) => `<div class="nova-suite" role="group" aria-label="Nova">
  ${items.map(it => {
    const f = NOVA_FEATURES[it.key];
    const icon = f ? f.icon : it.icon, accent = f ? f.accent : it.accent, rgb = f ? f.rgb : it.rgb,
      title = f ? f.title : it.title;
    const attr = it.attr ? it.attr
      : it.page ? `data-go="${it.page}"`
      : `data-soon="${esc(it.soon || title + ' — bientôt disponible.')}"`;
    return `<button type="button" class="nova-suite-btn" ${attr}
      style="--nf-accent:${accent};--nf-accent-rgb:${rgb}">
      ${svg(ICON[icon],1.9)}<span>${esc(title)}</span></button>`;
  }).join('')}
</div>`;

function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._x); t._x = setTimeout(() => t.classList.remove('on'), 2600);
}
/* Abstraction haptics (§55 du brief design system, 2026-09-21) : noop
   volontaire sur web — le but n'est pas de vibrer le téléphone
   maintenant (jamais demandé, et une appli financière qui vibre sans
   qu'on le lui demande serait plus agaçante qu'utile), mais de fixer
   dès aujourd'hui les points d'appel qu'une future app native
   (React Native/Capacitor) n'aura qu'à intercepter avec sa propre
   implémentation, sans devoir les retrouver un par un dans 17 000
   lignes. Câblée ci-dessous aux mêmes moments que les confirmations
   visuelles déjà en place (achat/vente confirmés, erreur) — jamais un
   nouveau chemin de décision, uniquement un appel de plus au même
   endroit qu'un toast existant. */
const haptics = {
  light(){ /* noop sur web */ },
  success(){ /* noop sur web */ },
  error(){ /* noop sur web */ },
};
let lastFocus = null;
function openSheet(html){
  lastFocus = document.activeElement;
  document.getElementById('sheet').innerHTML =
    `<div class="sheet-h"><div style="min-width:0;flex:1">${html}</div>
      <button class="x" data-close aria-label="Fermer">${svg(ICON.x, 2.2)}</button></div>`;
  const bg = document.getElementById('sheetBg');
  bg.hidden = false; bg.classList.add('on');
  document.body.style.overflow = 'hidden';
  (bg.querySelector('input,button:not([data-close])') || bg.querySelector('[data-close]'))?.focus();
}
function closeSheet(){
  const bg = document.getElementById('sheetBg');
  bg.classList.remove('on'); bg.hidden = true;
  const corps = document.getElementById('sheet');
  if (corps) corps.innerHTML = '';
  document.body.style.overflow = '';
  lastFocus?.focus?.(); lastFocus = null;
}

/* --- graphiques ---
   areaChart/spark ne fabriquent jamais de point : elles se contentent de
   refuser de dessiner quand l'entrée est vide, unique ou non finie (NaN /
   Infinity), au lieu de produire un path SVG invalide. */
function areaChart(vals, { h = 200, color = 'var(--accent)', id = 'c', labels = null } = {}){
  if (!Array.isArray(vals) || vals.length < 2
      || !vals.every(v => typeof v === 'number' && Number.isFinite(v))) return '';
  const w = 800, pad = { t:16, b: labels ? 28 : 12, l:4, r:56 };
  const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
  const X = i => pad.l + (i / (vals.length - 1)) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - min) / span) * (h - pad.t - pad.b);
  const d = vals.map((v,i) => `${i?'L':'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `${d} L${X(vals.length-1).toFixed(1)},${h-pad.b} L${pad.l},${h-pad.b} Z`;
  const grid = [0,.5,1].map(f => { const v = min + span*f; return `
    <line x1="${pad.l}" y1="${Y(v).toFixed(1)}" x2="${w-pad.r}" y2="${Y(v).toFixed(1)}"
      stroke="var(--line-2)" stroke-width="1"/>
    <text x="${w-pad.r+10}" y="${(Y(v)+4).toFixed(1)}" fill="var(--ink-4)" font-size="12"
      font-family="ui-monospace,monospace">${fmt.int(v)}</text>`; }).join('');
  const xl = labels ? labels.map(l => `<text x="${X(l.i).toFixed(1)}" y="${h-6}" fill="var(--ink-4)"
    font-size="12" text-anchor="middle">${esc(l.t)}</text>`).join('') : '';
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Évolution">
    <defs><linearGradient id="g${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".20"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#g${id})"/>
    <path class="chart-line" d="${d}" fill="none" stroke="${color}" stroke-width="2.6"
      stroke-linejoin="round" stroke-linecap="round"/>${xl}</svg>`;
}
function spark(vals, color){
  if (!Array.isArray(vals) || vals.length < 2
      || !vals.every(v => typeof v === 'number' && Number.isFinite(v))) return '';
  const w=110,h=32,pad=3,min=Math.min(...vals),max=Math.max(...vals),sp=(max-min)||1;
  const d = vals.map((v,i)=>`${i?'L':'M'}${(i/(vals.length-1)*w).toFixed(1)},${(pad+(1-(v-min)/sp)*(h-pad*2)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function ring(score, size = 150){
  const R = size/2 - 12, C = 2*Math.PI*R, p = (score === null || score === undefined) ? 0 : score/100;
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="bg" cx="${size/2}" cy="${size/2}" r="${R}"/>
      <circle class="fg" cx="${size/2}" cy="${size/2}" r="${R}" stroke="${scoreColor(score)}"
        stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-ring="${(C*(1-p)).toFixed(1)}"/>
    </svg>
    <div class="ring-c"><div>
      <div class="ring-v tabular-nums" style="color:${scoreColor(score)}">${(score===null||score===undefined)?'—':score}</div>
      <div class="ring-l">${(score===null||score===undefined)?'non calculable':'sur 100'}</div>
    </div></div></div>`;
}
/* Motion des graphiques — donut (§43 du brief design system, 2026-09-21) :
   chaque arc a son propre stroke-dasharray/dashoffset CALCULÉ à partir
   des données (longueurs différentes par part) — contrairement à
   .chart-line (une seule ligne, un seul dasharray constant), une vraie
   animation "balayage" par segment demanderait de passer une valeur de
   départ différente par cercle. Plus sûr et toujours une vraie
   apparition progressive plutôt qu'un pop instantané : le donut entier
   se matérialise (fondu + échelle), en CSS pur, sans dépendre des
   valeurs data par segment. */
function donut(parts, size = 150){
  const clean = (parts || []).filter(p => Number.isFinite(p.v) && p.v >= 0);
  const total = clean.reduce((s,p)=>s+p.v,0) || 1, R = size/2 - 13, C = 2*Math.PI*R;
  let acc = 0;
  return `<svg class="donut-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
    aria-hidden="true">
    <circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke="var(--bg-3)" stroke-width="17"/>
    ${clean.map(p=>{ const len=(p.v/total)*C, off=C-acc; acc+=len;
      return `<circle cx="${size/2}" cy="${size/2}" r="${R}" fill="none" stroke="${p.c}" stroke-width="17"
        stroke-dasharray="${len.toFixed(1)} ${(C-len).toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>`;
    }).join('')}</svg>`;
}

/* --- ligne d'entreprise, réutilisée partout ---
   Uniquement ce que QUOTES/HIST ont réellement renvoyé : cours, variation, et
   un mini-graphe seulement si un historique existe. Aucune note, aucun score. */
function stockRow(s, opts = {}){
  const q = QUOTES.get(s.id) || null;
  const prix = q && Number.isFinite(q.price) ? q.price : null;
  const varPct = q && Number.isFinite(q.changePercent) ? q.changePercent : null;
  /* Sparkline = séance du JOUR (période "1j", intraday 5min — voir
     chargerGraphiquePeriode() dans render()), jamais le HIST par défaut
     (~1 an quotidien, réservé à Comparer/volatilité) : une courbe d'un an
     pourrait monter alors que le titre est en baisse aujourd'hui,
     contredisant visuellement sa propre couleur verte/rouge.
     CORRECTIF (retour utilisateur explicite : "je veux que les courbes
     soient effectivement celle d'aujourd'hui, ne mets pas des courbes qui
     ne sont pas celle de l'action") — vérifié en direct sur la vraie
     réponse EODHD (fresh=1) : le fournisseur d'historique intraday de ce
     forfait a un décalage d'environ 1 jour calendaire (la requête "1j"
     redescend bien la fenêtre glissante des dernières 24h, mais EODHD n'a
     pas encore publié les barres du jour même — dernier point observé à
     la clôture d'HIER, pas la séance en cours). Twelve Data (fournisseur
     de repli) était aussi à quota épuisé au moment du test. Plutôt que
     d'afficher silencieusement une courbe d'hier comme si c'était
     aujourd'hui, on vérifie explicitement que le DERNIER point reçu
     tombe bien à la date du jour (UTC) avant de la considérer valide —
     sinon aucune courbe n'est affichée pour cette ligne (même état
     honnête que "pas encore chargé"), jamais une courbe du mauvais jour.
     Dès qu'EODHD publiera les barres du jour (généralement après un
     certain délai, parfois le lendemain), cette vérification laissera
     la courbe réapparaître automatiquement, sans aucun changement de
     code supplémentaire. */
  const hEntry = opts.spark === true ? HISTP.get(cleHISTP(s.id, '1j')) : null;
  const dernierPointEstAujourdhui = hEntry && hEntry.status === 'ready' && hEntry.data.length
    && hEntry.data[hEntry.data.length - 1].date.slice(0, 10) === new Date().toISOString().slice(0, 10);
  const hist = dernierPointEstAujourdhui ? hEntry.data.map(p => p.close) : null;
  /* Fraîcheur (voir api/market/_freshness.js / FRESHNESS_LABEL) : n'affiche
     rien tant qu'aucune cotation n'a été reçue pour cette ligne (prix = —
     déjà suffisamment honnête) ; sinon montre TOUJOURS le libellé exact
     renvoyé par le serveur, y compris "Fraîcheur inconnue" — jamais un
     silence qui laisserait sous-entendre du temps réel par défaut. */
  const labelFraicheur = (prix !== null && q) ? (FRESHNESS_LABEL[q.freshness] || '') : '';
  /* AnimatedFinancialNumber, même mécanisme que la fiche action
     (voir PRICE_FLASH plus bas) — mais une ligne peut apparaître dans
     plusieurs listes à la fois (ex. "Ma liste" ET "Marché" sur l'accueil) ;
     consommé (supprimé) seulement à la PREMIÈRE lecture, les occurrences
     suivantes de rendu ne rejouent pas le flash, c'est acceptable : la
     donnée reste correcte, seule l'animation ne se répète pas partout. */
  const flashRow = PRICE_FLASH.get(s.id);
  if (flashRow) PRICE_FLASH.delete(s.id);

  /* "Chargement…" vs "—" (retour utilisateur explicite : "Affiche
     'Chargement...' au lieu de '-' - Si pas de prix encore") : distingue
     un chargement RÉELLEMENT en cours (cotationEnCours(), voir
     data-services.js) d'un échec déjà retenté puis mis en recul par
     COTATION_COOLDOWN_MS — pour ce second cas on reste sur "—", jamais
     "Chargement…" qui laisserait croire qu'une réponse va encore
     arriver alors que la tentative vient d'échouer. */
  const enChargement = prix === null && cotationEnCours(s.id);
  const texteVide = enChargement ? 'Chargement…' : '—';

  return `<div class="row">
    <button style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;text-align:left"
      data-stock="${esc(s.id)}">
      ${avatar(s, opts.logo !== false)}
      <span class="row-main">
        <span class="row-t">${esc(s.ticker)}</span>
        <span class="row-s">${esc(s.name)}</span>
      </span>
    </button>
    ${hist && hist.length >= 2
      ? `<span class="row-spark">${spark(hist, varPct !== null && varPct < 0 ? 'var(--down)' : 'var(--up)')}</span>`
      : ''}
    <span class="row-end">
      <span class="row-px tabular-nums${flashRow ? ` flash-${flashRow}` : ''}">${prix === null ? texteVide : fmt.num(prix)}</span>
      <span class="row-var tabular-nums ${varPct === null ? 'na' : varPct >= 0 ? 'up-t' : 'down-t'}">
        ${varPct === null ? (enChargement ? '' : '—') : fmt.pct(varPct)}</span>
      ${labelFraicheur ? `<span class="tiny" style="color:var(--ink-4);display:block;text-align:right">${esc(labelFraicheur)}</span>` : ''}
    </span>
  </div>`;
}

/* Cotations et historiques réellement reçus du serveur. Vides au départ :
   les lignes affichent « — » jusqu'à la réponse. Rien n'est pré-rempli. */