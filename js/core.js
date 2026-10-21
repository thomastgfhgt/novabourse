
"use strict";
/* CORRECTIF (bug réel, 2026-09-23, signalé par l'utilisateur : "on ne
   voit plus du tout le temple") : sur un rechargement (F5, retour
   après que Chrome ait déchargé l'onglet pour libérer de la mémoire,
   etc.), le NAVIGATEUR restaure lui-même l'ancienne position de scroll
   AVANT que le moindre JS de cette page ne s'exécute — confirmé en
   direct (history.scrollRestoration par défaut, scrollY non nul dès
   le tout premier tick après un location.reload() effectué en étant
   descendu dans la page). Le fondu du temple au scroll (--temple-fade,
   voir plus bas) se calculait alors immédiatement sur cette position
   restaurée, AVANT même que render() n'ait eu la chance de remettre le
   scroll à 0 (qu'il ne fait de toute façon que sur une navigation
   interne "navigated", pas sur un rechargement complet) — un
   utilisateur qui rechargeait la page après avoir déjà descendu la
   page d'accueil retrouvait donc le temple déjà fondu, parfois presque
   invisible (plancher .08 × opacité de base .55 ≈ 4%), sans jamais
   l'avoir vu apparaître normalement. 'manual' désactive cette
   restauration native : cette appli gère déjà elle-même son scroll
   (voir le "if (navigated)" dans render()), le navigateur n'a plus de
   raison de s'en mêler. Posé tout en haut du script, avant absolument
   tout le reste, pour laisser le minimum de fenêtre possible à une
   restauration native. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
/* Filet de sécurité : sur ce rechargement PRÉCIS, le navigateur avait
   déjà restauré le scroll avant même d'atteindre cette ligne (confirmé
   en direct — 'manual' ci-dessus empêche les PROCHAINES restaurations,
   pas nécessairement celle déjà en cours). window.scrollTo(0,0) annule
   explicitement ce qui a pu être restauré, pour que le calcul initial
   de --temple-fade parte toujours d'un scroll à 0, comme un premier
   affichage normal. */
window.scrollTo(0, 0);
const BUILD = 'v2-9';
console.log('%cNovaTitre ' + BUILD, 'color:#00a651;font-weight:700');

/* ============================================================
   0. FONDATIONS RESTAURÉES
   ------------------------------------------------------------
   Ce bloc était manquant dans le fichier reçu (state, esc, fmt,
   toEUR, catalogue, PERIODS, etc. n'existaient nulle part alors
   que tout le reste du fichier les appelle). Il a été reconstruit
   ici a minima pour rendre le fichier exécutable, SANS fabriquer
   de données financières : le catalogue ci-dessous ne contient que
   des métadonnées stables (nom, ticker, place, secteur, devise).
   Aucun prix, variation, NovaScore, fondamentaux, volatilité ou
   momentum statique n'y figure — ces valeurs doivent provenir de
   QUOTES / HIST / d'un futur cache COMPANY alimenté par
   /api/market/company, jamais du catalogue.
   ============================================================ */

/* ---- échappement HTML ---- */
function esc(v){
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}
/* CORRECTIF (audit sécurité, 2026-09-21) : esc() échappe les caractères
   HTML mais ne valide jamais le SCHÉMA d'une URL — un lien "javascript:"
   ou "data:" venu d'un fournisseur externe (actualités, site web d'une
   société) passerait esc() sans encombre et s'exécuterait au clic.
   safeHref() n'autorise que http(s), sinon renvoie null (jamais un lien
   cliquable dangereux, jamais un throw qui casserait le rendu). */
function safeHref(url){
  const v = String(url ?? '').trim();
  return /^https?:\/\//i.test(v) ? v : null;
}

/* ---- devises ---- */
const CUR_SYMBOL = { EUR:'€', USD:'$', GBP:'£', CHF:'CHF', JPY:'¥', HKD:'HK$' };
/* Taux indicatifs et fixes, utilisés uniquement pour agréger le portefeuille
   virtuel en euros. Ce ne sont PAS des taux de change en temps réel : le
   portefeuille reste une simulation et l'affiche comme telle. */
const FX = { EUR:1, USD:0.92, GBP:1.17, CHF:1.04, JPY:0.0061, HKD:0.118 };
function toEUR(amount, cur){
  if (!Number.isFinite(amount)) return 0;
  const rate = FX[cur];
  return Number.isFinite(rate) ? amount * rate : amount;
}

/* ---- mouvement (motion design premium, phase 1, 2026-10-15) ----
   prefersReducedMotion() centralise ce qu'index.html déclarait seul
   jusqu'ici (REDUCED_MOTION, utilisé par le fondu/zoom du temple au
   scroll) — nécessaire pour que tout futur fichier JS (novabot-chat.js,
   page-home.js...) puisse vérifier la préférence sans dupliquer
   matchMedia(). animationsDisabled() ajoute le réglage applicatif
   "Animations" (state.settings.animations, déjà respecté côté CSS via
   .no-anim{animation:none!important} — voir styles.css) : toute
   DÉCISION PRISE EN JS (pas une simple règle CSS) doit vérifier les DEUX
   signaux, jamais un seul, sinon désactiver les animations dans les
   réglages ne suffirait pas à arrêter un minuteur JS déjà en cours. */
function prefersReducedMotion(){
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function animationsDisabled(){
  return prefersReducedMotion() || state.settings.animations === false;
}

/* ---- formatage ---- */
const fmt = {
  num(v, d = 0){
    return Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits:d, maximumFractionDigits:d }) : '—';
  },
  int(v){
    return Number.isFinite(v) ? Math.round(v).toLocaleString('fr-FR') : '—';
  },
  eur(v){
    return Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits:0, maximumFractionDigits:0 }) + ' €' : '—';
  },
  cur(v, cur){
    if (!Number.isFinite(v)) return '—';
    const sym = CUR_SYMBOL[cur] || (cur ? cur + ' ' : '');
    return v.toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + ' ' + sym;
  },
  pct(v, d = 2){
    return Number.isFinite(v) ? (v >= 0 ? '+' : '') + v.toLocaleString('fr-FR', { minimumFractionDigits:d, maximumFractionDigits:d }) + ' %' : '—';
  },
  /* Pour un ratio décimal réellement fourni par le backend (roe,
     profitMargin, operatingMargin : ex. 0.3322 = 33,22 %) — ×100 puis
     formaté. Ne jamais utiliser sur un champ dont l'unité n'est pas
     confirmée (ex. dividendYield, dont Finnhub renvoie une valeur déjà en
     points de pourcentage — voir plainFundamentals). '—' si non fini. */
  pctRatio(v, d = 1){
    return Number.isFinite(v) ? (v * 100).toLocaleString('fr-FR', { minimumFractionDigits:d, maximumFractionDigits:d }) + ' %' : '—';
  },
  /* Multiplicateur (PER, PriceToBook, EV/EBITDA…) : "27,5 ×", jamais
     "undefined ×" ni "NaN ×". */
  mult(v, d = 1){
    return Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits:d, maximumFractionDigits:d }) + ' ×' : '—';
  },
};

/* ---- état applicatif ---- */

/* Verrou produit (2026-10-15, mission "NovaTitre : passage au trading
   réel") — décision DÉLIBÉRÉE et confirmée explicitement par l'utilisateur
   (reformulée deux fois pour éviter toute ambiguïté) : le portefeuille
   fictif historique (state.wallet, les 5 000€/15 480€ de départ, les
   achats/ventes simulés) ne doit plus être présenté comme utilisable dans
   l'expérience publique. CETTE CONSTANTE NE SUPPRIME AUCUNE DONNÉE :
   state.wallet, portfolio_transactions et portfolio_snapshots restent
   intacts en base et en localStorage — seul ce que l'UI AFFICHE change
   (voir PAGES.portfolio dans page-portfolio.js et le bloc "Mes positions"
   dans page-home.js). Le lever exige de modifier cette ligne, donc un
   commit et une revue — jamais une variable d'environnement ni un
   réglage utilisateur. */
const PORTEFEUILLE_FICTIF_PUBLIC = false;

const STORAGE_KEY = 'novabourse_state_v1';
const deepClone = (o) => JSON.parse(JSON.stringify(o));

/* auth est TOUJOURS ré-initialisé à 'loading' au démarrage (voir loadState) :
   aucune valeur restaurée depuis le stockage local ne doit pouvoir authentifier
   quelqu'un. Supabase est la seule source de vérité de la session. */
const DEFAULT_STATE = {
  page:'home',
  stockId:null,

  watchlist:[],
  recent:[],
  compare:[],

  /* Listes organisées (§9 du PRD) : DISTINCTES de `watchlist` ci-dessus
     (l'étoile rapide, comportement inchangé) — un dossier nommé/coloré
     dans lequel ranger des valeurs, plusieurs par société possibles.
     `items` = tableau d'id de `stocks`, jamais de doublon (contrôlé par
     toggleItemListe, jamais construit à la main ailleurs). */
  lists:[],

  /* Alertes de prix (2026-09-23, raccourci "Créer une alerte" de
     l'accueil) : { id, stockId, target, direction:'above'|'below',
     createdAt, triggered:false }. Vérifiées pendant que l'app est
     ouverte (voir verifierAlertes(), branchée sur le même mécanisme de
     rafraîchissement vivant que le reste du site) — HONNÊTETÉ : aucune
     notification push, aucun serveur ne surveille les prix en arrière-
     plan (aurait exigé un backend/webhook, explicitement hors périmètre
     de cette passe). Une alerte déclenchée reste consultable/déclenchée
     une seule fois, jamais répétée en boucle. */
  alerts:[],

  wallet:{
    cash:15480,
    invested:110000,
    positions:[],
    /* Somme cumulée des gains/pertes RÉALISÉS (positions vendues), en euros.
       Jamais recalculée depuis l'historique des positions (qui ne garde pas
       trace d'une position déjà entièrement vendue) : alimentée uniquement
       par sellStock() au moment de chaque vente, sur la méthode du coût
       moyen pondéré (pos.avg). */
    realizedPnL:0
  },

  /* Historique RÉEL du portefeuille : un point par événement (achat, vente,
     ouverture) plus au plus un point par jour (snapshot quotidien, voir
     snapshotPortfolio()). Jamais de passé reconstitué : si le portefeuille
     est ouvert aujourd'hui, cette liste commence aujourd'hui — la période
     "MAX" du graphique portefeuille reflète alors exactement ce fait,
     jamais une courbe antidatée. */
  walletHistory:[],

  /* Journal des transactions (§22-33/§30 du PRD, ajouté 2026-09-17) :
     une ligne par achat/vente réel, jamais reconstituée depuis
     walletHistory (qui ne garde que la VALEUR totale du portefeuille à
     un instant donné, pas le détail par titre). Fondation nécessaire à
     Nova Review et à "Et si je n'avais rien fait ?" — aucune des deux
     n'est possible sans savoir QUEL titre a été acheté/vendu, QUAND et
     à QUEL prix précisément. */
  transactions:[],

  /* Métadonnées (jamais de prix/score/fondamentaux) des sociétés créées à la
     volée par /api/market/search, pour pouvoir les rematérialiser via
     ensureRuntimeStock() après un rechargement — sans quoi une position ou
     une sélection Comparer sur une société hors catalogue deviendrait
     invisible tant que l'utilisateur ne la recherche pas à nouveau. */
  runtimeCatalog:{},

  /* NovaBot (LOT I, Étape 3, 2026-09-24) : SIMULATION UNIQUEMENT, jamais un
     ordre réel sur les marchés — voir evaluerNovaBot()/novabotAcheter()/
     novabotVendre() plus bas. wallet/transactions ISOLÉS de state.wallet/
     state.transactions (le portefeuille réel de l'utilisateur) : les mêler
     fausserait à la fois Nova Review (qui suppose que state.transactions ne
     contient que des décisions VOLONTAIRES) et la valorisation du
     portefeuille réel. N'agit QUE sur state.watchlist (jamais tout le
     catalogue), jamais en arrière-plan côté serveur — évalué uniquement
     pendant que la page NovaBot est consultée, même principe que le
     rafraîchissement vivant (LIVE_MAX_SYMBOLES) et les alertes de prix
     (verifierAlertes) : aucun serveur ne surveille les prix pour vous. */
  novabot:{
    enabled:false,
    scoreAchat:70,      // NovaScore minimum pour déclencher un achat simulé
    stopLossPct:10,     // vente simulée si une position perd ce pourcentage
    takeProfitPct:20,   // vente simulée si une position gagne ce pourcentage
    tradeAmountEUR:500, // montant simulé par achat
    /* Mandat (§21/§24 du prompt maître NovaTitre, 2026-10-06) : "Garde 20%
       de cash" et "maximum 10% par position" sont les 2 exemples donnés
       en toutes lettres au §24 — jusqu'ici aucune des deux contraintes
       n'existait, seul tradeAmountEUR bornait un achat (voir
       evaluerNovaBot() : "if (cash < tradeAmountEUR) break" empêchait
       seulement d'acheter à découvert, jamais de préserver une vraie
       réserve ; rien n'empêchait de répéter le même achat sur plusieurs
       passages et de concentrer une position au-delà de tout raisonnable).
       Exprimées en % du portefeuille simulé TOTAL (cash + positions),
       jamais une valeur en euros figée : une contrainte en % reste
       cohérente quelle que soit la taille du portefeuille. */
    cashMinPct:20,      // liquidités minimales à préserver (% du portefeuille total)
    maxPositionPct:10,  // poids maximum d'une seule position (% du portefeuille total)
    /* Mandat — étendu (refonte fonctionnelle, tranche B, 2026-10-08, §3 :
       "différencier clairement PREFERENCE et HARD RULE"). null = aucune
       limite de ce type. hardRules/preferences : tableau de
       {type, value, note?} — ex. hardRules: [{type:'excluded_sector',
       value:'Énergie'}]. Une hard rule ne peut JAMAIS être outrepassée par
       une décision (voir novabotRiskCheck()) ; une préférence n'influence
       que le choix entre plusieurs candidats valides, jamais un refus. */
    maxPositionsCount:null,
    hardRules:[],
    preferences:[],
    /* Collectés par la conversation (refonte expérience, 2026-10-08) —
       informatifs pour l'instant (aucune logique ne les lit encore en
       dehors de novabotConfirmerMandat(), qui en déduit cashMinPct/
       maxPositionPct à la confirmation), mais persistés pour que le
       résumé du mandat reste cohérent d'une session à l'autre. */
    objective:null,
    riskLevel:null,
    horizonYears:null,
    /* CORRECTIF (2026-10-08, refonte expérience) : valait {cash:10000,
       invested:10000} comme capital implicite "gratuit", jamais déposé
       explicitement — convenait tant que rien ne modélisait le "capital
       confié" (§1 du brief). Depuis novabotConfirmerMandat() (plus bas),
       le capital choisi PAR LA CONVERSATION devient une vraie transaction
       'deposit' rejouée par rejouerNovaBot() — un capital de départ non
       nul ICI aurait doublé le résultat (10000 implicite + 10000 déposé =
       20000, bug réel trouvé en testant ce tour visuellement). 0 : aucun
       capital tant qu'aucun mandat n'a été confirmé, cohérent avec
       mandateConfirmed=false par défaut. */
    wallet:{ cash:0, invested:0, positions:[], realizedPnL:0 },
    transactions:[],
    /* Courbe de valorisation (refonte UX, 2026-10-08, §5 : "une grande
       courbe interactive 1J/1S/1M/3M/1A/MAX") — même principe exact que
       state.walletHistory du portefeuille personnel (snapshotPortfolio()/
       assurerRelevéQuotidien(), plus haut dans ce fichier) : un point à
       chaque mouvement de cash (dépôt/retrait/achat/vente) + au moins un
       par jour de visite, jamais un point antidaté ou fictif. */
    walletHistory:[],
    /* Journal des décisions (§14) — une entrée par décision SIGNIFICATIVE
       (buy/sell exécutés, reject, watch nouveau), jamais une entrée à
       chaque passage pour chaque position inchangée (§14 : "même HOLD/
       WATCH peut être enregistré LORSQUE LA DÉCISION EST SIGNIFICATIVE").
       Voir novabotEnregistrerDecision()/evaluerNovaBot() plus bas. */
    decisions:[],
    /* Raisonnement IA (tranche C, §9/§12, 2026-10-08) : DÉSACTIVÉ par
       défaut — "NovaBot ne doit jamais consommer le quota d'analyses IA
       de l'utilisateur sans action explicite" (principe déjà posé pour
       novaScoreDe(), gratuit, étendu ici au raisonnement payant). Tant que
       false, evaluerNovaBot() reste 100% déterministe, comportement
       inchangé depuis la tranche B. Local uniquement (non synchronisé
       serveur) pour l'instant : c'est un réglage d'EXÉCUTION, pas une
       règle du mandat lui-même. */
    aiReasoning:false,
    /* Mode d'autonomie (§22) — collecté par la conversation (refonte
       expérience, 2026-10-08) et synchronisé avec novabot_accounts.
       autonomy_mode (voir pushNovaBot()/syncNovaBot()) : "advice" par
       défaut, le plus prudent, jamais "auto" tant que l'utilisateur ne
       l'a pas explicitement choisi. */
    autonomyMode:'advice',
    /* Compte confirmé : passe à true seulement quand l'utilisateur a
       validé le mandat proposé par la conversation (novabotConfirmerMandat()
       plus bas) — avant ça, la page NovaBot affiche la conversation
       d'onboarding plutôt que le tableau de bord (voir PAGES.novabot,
       js/nova.js). Distinct de `enabled` : un mandat confirmé peut être
       mis en pause (enabled=false) sans perdre sa confirmation. */
    mandateConfirmed:false,
    lastRunAt:null,
    lastConversationId:null,
    /* NOUVEAU (2026-10-15, pilotage du mandat depuis le chat) : rien ne
       suivait jusqu'ici la ligne novabot_mandates réellement courante côté
       client — nécessaire pour la vérification de concurrence optimiste
       (baseMandateId) avant d'appliquer une modification proposée par la
       conversation. mandateHistory : juste assez pour permettre une
       restauration (ids/dates), jamais le contenu complet de chaque
       version en mémoire. cancelled : distinct de `enabled`, même principe
       que mandateConfirmed ci-dessus — annuler le mandat n'est PAS la même
       chose que le mettre en pause (voir novabotAnnulerMandat() plus bas). */
    mandateId:null,
    mandateHistory:[],
    cancelled:false,
  },

  auth:{
    status:'loading',   // 'loading' | 'guest' | 'authenticated'
    signedIn:false,
    name:null,
    email:null,
    since:null
  },

  account:null,

  onboarding:{
    done:false,
    step:0,
    level:null,
    goal:null,
    interests:[],
    capital:null,
    introSlide:0
  },

  settings:{
    level:'debutant',
    mode:'debutant',
    /* Retour utilisateur (2026-10-05) : "la version bleu marine activée
       en premier sur tout le site lorsqu'on rentre dessus pour la
       première fois" — thème sombre par défaut pour tout nouveau
       visiteur (aucun state.settings sauvegardé en localStorage). Le
       thème clair reste disponible, mais seulement si l'utilisateur le
       choisit explicitement dans les paramètres (voir applyTheme() /
       le cycle du bouton data-theme-toggle dans index.html). */
    theme:'dark',
    currency:'EUR',
    lang:'fr',
    plan:'free',
    cycle:'mensuel',
    animations:true,
    sparklines:true,
    showCoverage:true,
    fontSize:'normal',
    /* CONNU, VOLONTAIREMENT NON câblé (audit "réglage sans effet",
       2026-09-17) : ce réglage existe dans Réglages > Langue et région
       mais aucun formatage réel ne le lit — fmt.num/fmt.cur/fmt.pct
       utilisent 'fr-FR' en dur (9 occurrences). Le corriger toucherait
       l'objet `fmt`, utilisé partout où un prix/pourcentage s'affiche
       dans l'application entière — un risque de régression visuelle
       large que je ne peux pas vérifier sans navigateur dans cette
       session. Laissé en l'état plutôt que risqué à l'aveugle ou
       supprimé sans certitude que ce soit la bonne décision produit. */
    numFormat:'fr',
    notifScore:false,
    notifPrice:false,
    notifWeekly:false,

    /* §7 de la mission "Alpaca Sandbox Trading" : "Nova AI reçoit, AVEC
       L'ACCORD DE L'UTILISATEUR (interrupteur dans les paramètres), un
       résumé en lecture seule du portefeuille Sandbox." Faux par défaut —
       jamais un partage activé en silence. N'a AUCUN effet pour l'instant
       (le résumé serveur existe, api/_alpaca/portfolio.js, mais n'est pas
       encore injecté dans un prompt IA — intégration délibérément
       reportée, trop risqué de la greffer à la hâte sur le système de
       prompts NovaBot déjà complexe, voir api/analyze.js). Le préparer
       maintenant évite de devoir migrer les préférences sauvegardées plus
       tard.*/
    novaAiPortefeuilleAlpaca:false,
  },

  filters:{
    /* CORRECTIF (audit "tri Radar", 2026-09-17) : valait 'score' par défaut
       depuis le début, mais radarSort n'était lu nulle part — le tri réel
       était toujours "variation du jour". Mis à jour vers cette même valeur
       ('perf') pour que le comportement par défaut ne change PAS au moment
       où ce champ devient enfin réellement utilisé (voir radarResults) —
       un changement de tri par défaut n'est pas anodin pour un utilisateur
       déjà habitué à l'ordre actuel. 'score' reste un choix explicite
       disponible via le sélecteur, jamais imposé. */
    radarSort:'perf',
    radarSector:'tous',
    radarQ:'',
    radarMin:0,
    radarCountry:'tous',
    /* exploreSector/exploreCountry/exploreQ/exploreVisibles retirés le
       2026-09-23 (fusion Explorer -> Marchés, voir PAGES.markets) —
       remplacés par marketsSector/marketsCountry ci-dessous, un seul
       jeu de filtres et une seule pagination pour la page fusionnée. */
    marketsCategory:'tous',
    marketsRegion:'Monde',
    marketsSector:'tous',
    marketsCountry:'tous',
    marketsVisibles:20,
  },

  ui:{
    pfPeriod:'1A',
    chartPeriod:'3m',
    chartMode:'line',
    stockTab:'apercu',
  },
};

function loadState(){
  let merged;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw){
      merged = deepClone(DEFAULT_STATE);
    } else {
      const saved = JSON.parse(raw);
      merged = {
        ...deepClone(DEFAULT_STATE),
        ...saved,
        settings:{ ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
        filters:{ ...DEFAULT_STATE.filters, ...(saved.filters || {}) },
        ui:{ ...DEFAULT_STATE.ui, ...(saved.ui || {}) },
        /* Fusion CHAMP PAR CHAMP, jamais un simple spread au niveau wallet :
           un wallet sauvegardé partiel/corrompu (ex. positions absent après
           une ancienne version, ou cash explicitement null) ne doit écraser
           que les champs réellement absents ou invalides, jamais un cash=0
           ou des positions=[] valides (0 et [] sont des valeurs légitimes,
           pas des indicateurs d'absence — d'où Number.isFinite/Array.isArray
           explicites plutôt qu'un `saved.wallet.cash || 15480`). */
        wallet:{
          cash: Number.isFinite(saved.wallet?.cash) ? saved.wallet.cash : DEFAULT_STATE.wallet.cash,
          invested: Number.isFinite(saved.wallet?.invested) ? saved.wallet.invested : DEFAULT_STATE.wallet.invested,
          positions: Array.isArray(saved.wallet?.positions) ? saved.wallet.positions : DEFAULT_STATE.wallet.positions,
          realizedPnL: Number.isFinite(saved.wallet?.realizedPnL) ? saved.wallet.realizedPnL : DEFAULT_STATE.wallet.realizedPnL,
        },
        walletHistory: Array.isArray(saved.walletHistory) ? saved.walletHistory : DEFAULT_STATE.walletHistory,
        /* Même garde-fou élément par élément que `lists` plus haut : une
           entrée corrompue/incomplète est retirée individuellement, jamais
           tout le journal. 'deposit'/'withdraw'/'fee' (§35 du prompt maître,
           2026-10-05) n'ont ni qty ni stockId (aucun titre concerné) : exiger
           Number.isFinite(t.qty) pour ces types aurait silencieusement
           effacé tout dépôt/retrait à chaque rechargement de page — bug
           réel trouvé en écrivant ce correctif, pas seulement théorique. */
        transactions: Array.isArray(saved.transactions)
          ? saved.transactions.filter(t => t && typeof t.id === 'string' && typeof t.date === 'string'
              && Number.isFinite(t.amountEUR)
              && (((t.type === 'buy' || t.type === 'sell') && Number.isFinite(t.qty))
                || ((t.type === 'deposit' || t.type === 'withdraw' || t.type === 'fee'))))
          : [],
        /* Validation stricte élément par élément : un stockage corrompu/ancien
           (avant l'ajout de cette fonctionnalité) ne doit jamais produire une
           liste avec un id/name absent en aval (rendu, toggleItemListe). Un
           élément invalide est retiré silencieusement, jamais tout le tableau. */
        lists: Array.isArray(saved.lists)
          ? saved.lists.filter(l => l && typeof l.id === 'string' && typeof l.name === 'string')
            .map(l => ({
              id: l.id, name: l.name,
              color: typeof l.color === 'string' ? l.color : '#e67e22',
              icon: typeof l.icon === 'string' ? l.icon : 'star',
              items: Array.isArray(l.items) ? [...new Set(l.items.filter(x => typeof x === 'string'))] : [],
            }))
          : [],
        runtimeCatalog: (saved.runtimeCatalog && typeof saved.runtimeCatalog === 'object' && !Array.isArray(saved.runtimeCatalog))
          ? saved.runtimeCatalog : {},
        onboarding:{ ...DEFAULT_STATE.onboarding, ...(saved.onboarding || {}) },
        /* Même garde-fou champ-par-champ que `wallet` ci-dessus, appliqué au
           portefeuille papier ISOLÉ de NovaBot (voir DEFAULT_STATE.novabot). */
        novabot:{
          enabled: saved.novabot?.enabled === true,
          scoreAchat: Number.isFinite(saved.novabot?.scoreAchat) ? saved.novabot.scoreAchat : DEFAULT_STATE.novabot.scoreAchat,
          stopLossPct: Number.isFinite(saved.novabot?.stopLossPct) ? saved.novabot.stopLossPct : DEFAULT_STATE.novabot.stopLossPct,
          takeProfitPct: Number.isFinite(saved.novabot?.takeProfitPct) ? saved.novabot.takeProfitPct : DEFAULT_STATE.novabot.takeProfitPct,
          tradeAmountEUR: Number.isFinite(saved.novabot?.tradeAmountEUR) ? saved.novabot.tradeAmountEUR : DEFAULT_STATE.novabot.tradeAmountEUR,
          cashMinPct: Number.isFinite(saved.novabot?.cashMinPct) ? saved.novabot.cashMinPct : DEFAULT_STATE.novabot.cashMinPct,
          maxPositionPct: Number.isFinite(saved.novabot?.maxPositionPct) ? saved.novabot.maxPositionPct : DEFAULT_STATE.novabot.maxPositionPct,
          maxPositionsCount: Number.isInteger(saved.novabot?.maxPositionsCount) ? saved.novabot.maxPositionsCount : null,
          hardRules: Array.isArray(saved.novabot?.hardRules)
            ? saved.novabot.hardRules.filter(r => r && typeof r.type === 'string' && typeof r.value === 'string') : [],
          preferences: Array.isArray(saved.novabot?.preferences)
            ? saved.novabot.preferences.filter(r => r && typeof r.type === 'string' && typeof r.value === 'string') : [],
          objective: ['growth','income','preserve'].includes(saved.novabot?.objective) ? saved.novabot.objective : null,
          riskLevel: ['low','moderate','high'].includes(saved.novabot?.riskLevel) ? saved.novabot.riskLevel : null,
          horizonYears: Number.isFinite(saved.novabot?.horizonYears) ? saved.novabot.horizonYears : null,
          wallet:{
            cash: Number.isFinite(saved.novabot?.wallet?.cash) ? saved.novabot.wallet.cash : DEFAULT_STATE.novabot.wallet.cash,
            invested: Number.isFinite(saved.novabot?.wallet?.invested) ? saved.novabot.wallet.invested : DEFAULT_STATE.novabot.wallet.invested,
            positions: Array.isArray(saved.novabot?.wallet?.positions) ? saved.novabot.wallet.positions : DEFAULT_STATE.novabot.wallet.positions,
            realizedPnL: Number.isFinite(saved.novabot?.wallet?.realizedPnL) ? saved.novabot.wallet.realizedPnL : DEFAULT_STATE.novabot.wallet.realizedPnL,
          },
          transactions: Array.isArray(saved.novabot?.transactions)
            ? saved.novabot.transactions.filter(t => t && typeof t.id === 'string' && (t.type === 'buy' || t.type === 'sell')
                && Number.isFinite(t.qty) && Number.isFinite(t.amountEUR) && typeof t.date === 'string')
            : [],
          decisions: Array.isArray(saved.novabot?.decisions)
            ? saved.novabot.decisions.filter(d => d && typeof d.id === 'string' && typeof d.action === 'string' && typeof d.date === 'string')
            : [],
          walletHistory: Array.isArray(saved.novabot?.walletHistory)
            ? saved.novabot.walletHistory.filter(s => s && Number.isFinite(s.t) && Number.isFinite(s.totalValue))
            : [],
          aiReasoning: saved.novabot?.aiReasoning === true,
          autonomyMode: ['advice','semi_auto','auto'].includes(saved.novabot?.autonomyMode) ? saved.novabot.autonomyMode : 'advice',
          mandateConfirmed: saved.novabot?.mandateConfirmed === true,
          lastRunAt: Number.isFinite(saved.novabot?.lastRunAt) ? saved.novabot.lastRunAt : null,
          /* V5 Phase A (§2 : "Conserver la conversation active après
             actualisation") : identifiant (uuid serveur, donc une string)
             de la dernière conversation ouverte — novabotConversationsCharger()
             le préfère à list[0] s'il existe toujours dans la liste reçue. */
          lastConversationId: typeof saved.novabot?.lastConversationId === 'string' ? saved.novabot.lastConversationId : null,
        },
      };
    }
  } catch {
    merged = deepClone(DEFAULT_STATE);
  }

  /* Correction du bug d'authentification : même si un ancien
     novabourse_state_v1 contient un auth.signedIn=true, il ne doit JAMAIS
     être considéré comme une preuve de connexion. On repart toujours en
     'loading' ; seule la confirmation Supabase (voir applySession) peut
     ensuite passer l'état à 'authenticated' ou 'guest'. */
  merged.auth = {
    status:'loading',
    signedIn:false,
    name:null,
    email:null,
    since:null
  };

  if (!Array.isArray(merged.wallet.positions)) merged.wallet.positions = [];
  if (!Array.isArray(merged.walletHistory)) merged.walletHistory = [];

  return merged;
}

let saveTimer = null;

/* Corps réel de l'écriture, partagé par la version debouncée (saveState) et
   la version immédiate (flushSaveState). Rien ici ne change de comportement
   par rapport à avant : mêmes clés, auth toujours exclue. */
function writeStateNow(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      watchlist:state.watchlist,
      lists:state.lists,
      recent:state.recent,
      compare:state.compare,
      settings:state.settings,
      filters:state.filters,
      ui:state.ui,
      onboarding:state.onboarding,
      runtimeCatalog:state.runtimeCatalog,
      /* Le portefeuille virtuel est un état utilisateur réel (positions
         qu'il a lui-même prises), pas une donnée de marché : il est
         légitime de le conserver localement pour qu'il survive à un
         rechargement. Aucune valeur de marché n'est stockée ici, ni la
         session (voir auth, jamais sauvegardé). */
      wallet:state.wallet,
      /* Historique réel du portefeuille (voir snapshotPortfolio()) : même
         raisonnement que wallet ci-dessus — état utilisateur, pas donnée de
         marché, légitime à conserver localement. */
      walletHistory:state.walletHistory,
      /* Journal des transactions — même raisonnement, voir DEFAULT_STATE. */
      transactions:state.transactions,
    }));
  } catch {}
}

/* Version normale, debouncée (200ms) : évite de ré-écrire le stockage à
   chaque frappe/toggle. */
function saveState(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeStateNow, 200);
}

/* Écriture IMMÉDIATE, sans attendre le debounce. Nécessaire pour deux cas :
   1) les actions financièrement significatives (achat/vente/capital initial)
      ne doivent jamais dépendre d'un setTimeout qui pourrait ne jamais se
      déclencher si l'utilisateur ferme l'onglet/l'app dans les 200ms qui
      suivent (scénario mobile très plausible : acheter puis quitter) ;
   2) un flush de sécurité sur pagehide/visibilitychange (voir plus bas)
      pour ne perdre aucune écriture encore en attente, quelle qu'elle soit. */
function flushSaveState(){
  clearTimeout(saveTimer);
  writeStateNow();
}

const state = loadState();

/* ---- catalogue : métadonnées stables uniquement ----
   Volontairement réduit et honnête : aucun prix, variation, NovaScore,
   fondamentaux, volatilité ou momentum statique n'est inclus. Ces champs
   n'existent que lorsqu'ils proviennent réellement de QUOTES / HIST / d'un
   dossier company chargé depuis le backend. Une fiche sans ces données
   affichera « indisponible », jamais une valeur inventée. */
/* 'Matériaux'/'Immobilier'/'Services publics' ajoutés pour accueillir les
   secteurs GICS du catalogue mondial (voir SECTEUR_CATALOGUE plus bas) qui
   n'avaient pas d'équivalent dans la liste d'origine (calibrée sur les ~10
   sociétés codées en dur). Aucune donnée : uniquement 3 nouvelles étiquettes
   de filtre. */
const SECTORS = ['Technologie','Finance','Santé','Industrie','Énergie','Consommation','Automobile','Luxe','Télécommunications','Matériaux','Immobilier','Services publics'];

/* Traduction des secteurs GICS bruts du catalogue mondial (colonne
   stock_sector de free-ticker-database, en anglais) vers les libellés
   français déjà utilisés par Explorer. Traduction déterministe d'une
   taxonomie connue, pas une donnée inventée. Un secteur absent de cette
   table (rare, dataset non exhaustif) redevient simplement null ->
   'Non classé' via BLANK_FIELDS()/ensureRuntimeStock, comme aujourd'hui
   pour toute société sans secteur connu. */
const SECTEUR_CATALOGUE = {
  'Information Technology': 'Technologie',
  'Financials': 'Finance',
  'Health Care': 'Santé',
  'Industrials': 'Industrie',
  'Energy': 'Énergie',
  'Consumer Discretionary': 'Consommation',
  'Consumer Staples': 'Consommation',
  'Communication Services': 'Télécommunications',
  'Materials': 'Matériaux',
  'Real Estate': 'Immobilier',
  'Utilities': 'Services publics',
};

/* Libellés de fraîcheur (voir api/market/_freshness.js) : affichés tels
   quels dès qu'une cotation a une valeur `freshness` connue. UNKNOWN a
   volontairement SON PROPRE libellé (pas de repli silencieux) : c'est une
   valeur explicite du backend, distincte d'une cotation pas encore
   chargée (où `freshness` est simplement absent et n'affiche donc rien). */
/* Libellés de statut de séance (voir api/market/_marketHours.js) : 'unknown'
   n'a volontairement AUCUN libellé (contrairement à FRESHNESS_LABEL.UNKNOWN
   ci-dessous) — c'est la valeur attendue et fréquente pour crypto/forex/
   indices/matières premières ou une place non couverte, pas une anomalie à
   signaler comme "fraîcheur inconnue" l'est pour une cotation. */
/* Libellé de fraîcheur MESURÉ (2026-10-21, "la bourse en temps réel") :
   le fournisseur marque "Différé" des cours américains qui, mesurés,
   n'ont que quelques secondes de retard. On affiche l'âge RÉEL du cours :
   "Temps réel" sous 60 s pendant la séance, "Différé de X min" au-delà,
   "Clôture" quand le marché est fermé. Sans horodatage : libellé du
   fournisseur, tel quel. */
function libelleFraicheur(q){
  if (!q) return '';
  const t = q.timestamp ? new Date(q.timestamp).getTime() : NaN;
  if (q.marketStatus === 'closed') return 'Clôture';
  if (Number.isFinite(t)){
    const ageS = (Date.now() - t) / 1000;
    if (q.marketStatus === 'open' || ageS < 3600){
      if (ageS < 60) return 'Temps réel';
      if (ageS < 3600) return `Différé de ${Math.max(1, Math.round(ageS / 60))} min`;
    }
  }
  return FRESHNESS_LABEL[q.freshness] || '';
}

const MARKET_STATUS_LABEL = {
  open: 'Séance en cours',
  closed: 'Séance fermée',
};

const FRESHNESS_LABEL = {
  LIVE: 'Temps réel',
  DELAYED: 'Différé',
  END_OF_DAY: 'Clôture',
  HISTORICAL: 'Historique',
  UNKNOWN: 'Fraîcheur inconnue',
};

/* --------------------------------------------------------------------
   MARCHÉS — catégories et zones géographiques réellement fonctionnelles.
   Seules les catégories pour lesquelles un provider a été vérifié
   fonctionnel apparaissent ici. Aucune catégorie vide/non testée n'est
   listée — conformément à la consigne : "une catégorie devient visible
   uniquement lorsque nous disposons d'un provider réellement fonctionnel
   pour cette catégorie".

   'index'/'commodity' AJOUTÉS à cette passe : symboles vérifiés
   empiriquement via l'API publique de référence Twelve Data, sans clé
   (https://api.twelvedata.com/indices et /commodities — réponses réelles
   inspectées, pas une supposition), voir les entrées correspondantes dans
   `stocks` ci-dessous pour le détail par instrument.

   Obligations, fonds, futures, options ne sont TOUJOURS PAS dans cette
   liste : aucune convention de symbole n'a pu être vérifiée sans clé API
   payante (EODHD documente des exchanges virtuels GBOND/EUFUND mais sans
   exemple de ticker consultable publiquement — voir le rapport de cette
   passe). Ajouter une entrée ici quand (et seulement quand) un provider
   aura été testé et confirmé pour cette catégorie. */
const MARKET_CATEGORIES = [
  { id:'tous',      label:'Tous' },
  { id:'stock',     label:'Actions' },
  { id:'etf',       label:'ETF' },
  { id:'forex',     label:'Devises' },
  { id:'crypto',    label:'Crypto' },
  { id:'index',     label:'Indices' },
  { id:'commodity', label:'Matières premières' },
];

/* Zone géographique déduite du pays — uniquement pertinent pour les
   actions (une paire de devises ou une crypto n'a pas de "pays coté").
   Liste volontairement alignée sur les zones demandées ; toute valeur de
   `country` absente de cette table n'est simplement pas filtrable par
   zone (elle reste visible sous "Monde"). */
/* CORRECTIF (audit "région Marchés incorrecte", 2026-09-17) : cette table
   ne couvrait que 16 pays, exclusivement en anglais ("Germany", "Spain"...)
   — un reliquat d'avant l'expansion du catalogue (11 281 valeurs, voir
   historique de cette session), qui utilise systématiquement des noms de
   pays en FRANÇAIS. Conséquence réelle vérifiée : sur les 44 pays
   distincts aujourd'hui présents dans `stocks`, 40 tombaient dans "Monde"
   faute de correspondance — y compris l'Espagne, l'Italie, la Suède, le
   Danemark, la Finlande, la Norvège, les Pays-Bas et la Belgique, pourtant
   déjà couverts par des places vérifiées. Reconstruite pour couvrir les 44
   pays réellement présents ; un pays qui apparaîtrait plus tard sans
   correspondance ici reste honnêtement classé "Monde", jamais deviné —
   même principe qu'avant, cohérence en plus. */
const REGION_OF_COUNTRY = {
  'France': 'France',

  'Allemagne': 'Europe', 'Autriche': 'Europe', 'Belgique': 'Europe',
  'Danemark': 'Europe', 'Espagne': 'Europe', 'Finlande': 'Europe',
  'Irlande': 'Europe', 'Italie': 'Europe', 'Luxembourg': 'Europe',
  'Norvège': 'Europe', 'Pays-Bas': 'Europe', 'Pologne': 'Europe',
  'Portugal': 'Europe', 'Royaume-Uni': 'Europe', 'Russie': 'Europe',
  'Suède': 'Europe', 'Suisse': 'Europe', 'Turquie': 'Europe',
  'Zone euro': 'Europe', 'Cyprus': 'Europe', 'Faroe Islands': 'Europe',

  'États-Unis': 'Amériques', 'Canada': 'Amériques', 'Brésil': 'Amériques',
  'Mexique': 'Amériques', 'Bermuda': 'Amériques', 'Cayman Islands': 'Amériques',
  'British Virgin Islands': 'Amériques',

  'Chine': 'Asie/Pacifique', 'Hong Kong': 'Asie/Pacifique', 'Japon': 'Asie/Pacifique',
  'Corée du Sud': 'Asie/Pacifique', 'Inde': 'Asie/Pacifique', 'Indonésie': 'Asie/Pacifique',
  'Malaisie': 'Asie/Pacifique', 'Singapour': 'Asie/Pacifique', 'Taïwan': 'Asie/Pacifique',
  'Vietnam': 'Asie/Pacifique', 'Australie': 'Asie/Pacifique', 'New Zealand': 'Asie/Pacifique',
  'Philippines': 'Asie/Pacifique',

  'Arabie saoudite': 'Moyen-Orient', 'Israël': 'Moyen-Orient',

  'Afrique du Sud': 'Afrique',

  /* Formes anglaises historiques conservées en repli — un ancien
     enregistrement en localStorage/runtimeCatalog matérialisé avant cette
     passe peut encore porter ces valeurs ; jamais recalculées, seulement
     tolérées ici pour ne pas régresser silencieusement vers "Monde". */
  'United States': 'Amériques', 'Germany': 'Europe', 'Netherlands': 'Europe',
  'Belgium': 'Europe', 'Switzerland': 'Europe', 'United Kingdom': 'Europe',
  'Spain': 'Europe', 'Italy': 'Europe', 'Sweden': 'Europe', 'Denmark': 'Europe',
  'Finland': 'Europe', 'Norway': 'Europe', 'Austria': 'Europe', 'Brazil': 'Amériques',
  'China': 'Asie/Pacifique', 'Mexico': 'Amériques',

  /* Expansion du catalogue mondial (2026-09-24, scripts/build-catalog.js,
     11 243 -> 36 765 entreprises) : 34 nouveaux pays réellement présents,
     ajoutés ici pour qu'ils restent filtrables par région plutôt que de
     tomber silencieusement dans "Monde". Bermudes/Îles Caïmans/Îles
     Vierges britanniques/Îles Féroé existaient déjà ci-dessus en anglais
     (repli legacy) : ajoutées ici en français, la forme désormais utilisée
     par catalog.json. */
  'Bulgarie': 'Europe', 'Chypre': 'Europe', 'Gibraltar': 'Europe',
  'Grèce': 'Europe', 'Guernesey': 'Europe', 'Hongrie': 'Europe',
  'Jersey': 'Europe', 'Liechtenstein': 'Europe', 'Malte': 'Europe',
  'Monaco': 'Europe', 'Roumanie': 'Europe', 'République tchèque': 'Europe',
  'Slovénie': 'Europe', 'Île de Man': 'Europe', 'Îles Féroé': 'Europe',

  'Bahamas': 'Amériques', 'Bermudes': 'Amériques', 'Chili': 'Amériques',
  'Colombie': 'Amériques', 'Panama': 'Amériques', 'Porto Rico': 'Amériques',
  'Pérou': 'Amériques', 'Îles Caïmans': 'Amériques',
  'Îles Vierges britanniques': 'Amériques',

  'Nouvelle-Zélande': 'Asie/Pacifique', 'Pakistan': 'Asie/Pacifique',
  'Papouasie-Nouvelle-Guinée': 'Asie/Pacifique', 'Îles Marshall': 'Asie/Pacifique',
  'Kazakhstan': 'Asie/Pacifique',

  'Bahreïn': 'Moyen-Orient',

  'Gabon': 'Afrique', 'Maurice': 'Afrique', 'Nigeria': 'Afrique', 'Égypte': 'Afrique',
  'Ghana': 'Afrique',

  /* Ajoutés (2026-09-28, chantier "couverture mondiale") : réellement
     présents dans catalog.json après régénération (scripts/build-catalog.js,
     dataset source mis à jour en amont depuis la dernière passe), jamais
     liés aux nouvelles places TSXV/WSE/Bursa ajoutées dans ce même commit
     — simplement de nouveaux émetteurs apparus dans le dataset GitHub
     source entre-temps. */
  'Estonie': 'Europe', 'Lituanie': 'Europe',
};
const REGIONS = ['Monde','France','Europe','Amériques','Asie/Pacifique','Moyen-Orient','Afrique'];

/* CORRECTIF (bug réel de filtrage, audit complet 2026-09-17) : le filtre
   "Pays" (Radar et Explorer) construisait sa liste de puces directement
   depuis stock.country BRUT, sans aucune normalisation — vérifié en
   direct sur le catalogue déployé : "USA" (1 valeur isolée, à côté de
   "États-Unis" pour 4115 sociétés), "New Zealand", "Peru", "Cyprus",
   "Bermuda", "Cayman Islands", "British Virgin Islands", "Faroe Islands"
   restaient en anglais, et 1047 sociétés portaient la CHAÎNE "null"
   comme pays, affichée comme une puce "null" cliquable au milieu des
   vrais pays. Au-delà du visuel : choisir "États-Unis" ratait aussi la
   société tagguée "USA", un vrai bug de résultats manquants, pas
   seulement d'affichage. paysAffiche() renvoie null pour toute valeur
   inexploitable (pays réellement inconnu pour cette société, jamais
   une puce factice), sinon le libellé français canonique. */
const COUNTRY_ALIASES = {
  'USA':'États-Unis', 'United States':'États-Unis', 'Germany':'Allemagne',
  'New Zealand':'Nouvelle-Zélande', 'Peru':'Pérou', 'Cyprus':'Chypre',
  'Bermuda':'Bermudes', 'Cayman Islands':'Îles Caïmans',
  'British Virgin Islands':'Îles Vierges britanniques', 'Faroe Islands':'Îles Féroé',
  'Netherlands':'Pays-Bas', 'Belgium':'Belgique', 'Switzerland':'Suisse',
  'United Kingdom':'Royaume-Uni', 'Spain':'Espagne', 'Italy':'Italie',
  'Sweden':'Suède', 'Denmark':'Danemark', 'Finland':'Finlande', 'Norway':'Norvège',
  'Austria':'Autriche', 'Brazil':'Brésil', 'China':'Chine', 'Mexico':'Mexique',
};
function paysAffiche(raw){
  if (!raw || raw === '—' || raw === 'null') return null;
  return COUNTRY_ALIASES[raw] || raw;
}

const BLANK_FIELDS = () => ({
  /* Explicitement null/false plutôt qu'absents : le reste du fichier (tests,
     strengths/weaknesses, radar) distingue "donnée absente" (null) de
     "donnée à zéro". Rien ici n'est une valeur de marché. */
  score:null, scores:{}, coverage:0, partial:true,
  fundamentals:null, hasFundamentals:false, fundamentalsSource:null,
  /* Ajout (audit "fiche entreprise") : description/site web/effectifs,
     chargés par le même appel que `fundamentals` ci-dessus (voir
     chargerFondamentaux) — jamais une requête séparée. */
  companyIdentity:null,
  /* État explicite à 4 valeurs pour le chargement à la demande :
     'idle' (jamais demandé) | 'loading' | 'loaded' | 'error'. */
  fundamentalsStatus:'idle',
  volatility:null, volRisk:null, momentum:null,
  marketCapEUR:null,
  /* Type par défaut 'stock' — rétrocompatible : toutes les entrées créées
     avant cette passe (catalogue + sociétés déjà en localStorage) étaient
     implicitement des actions ; ce champ le rend simplement explicite,
     sans rien changer pour elles. Les nouveaux types (forex, crypto...)
     l'écrasent explicitement dans leur propre littéral. */
  type:'stock',
});

const stocks = [];
/* Catalogue chargé de façon asynchrone (2026-09-24, retour utilisateur :
   "le site est super lent") — voir loadCatalog() plus bas et son appel
   dans boot(). Auparavant : 11 243 entrées codées en dur ici, soit 2,37 Mo
   sur les 2,85 Mo de ce fichier (83%) — analysées/compilées par le
   moteur JS À CHAQUE chargement de page, avant même le premier rendu.
   Extraites vers /catalog.json (même structure exacte, BLANK_FIELDS()
   déjà appliqué à l'extraction, aucune valeur inventée), récupéré via
   fetch() en parallèle du reste du démarrage — JSON.parse() natif est
   nettement plus rapide que l'analyse JS équivalente pour la même
   donnée, et ce fichier est mis en cache par le navigateur d'une visite
   à l'autre (jamais l'index.html, qui change trop souvent).
   stocks/byId restent le MÊME tableau/objet tout du long (jamais
   réassignés, seulement remplis via push()/affectation de propriété) :
   tout code qui capture une référence à `stocks` ou `byId` avant la fin
   du chargement continue de voir les bonnes données une fois le
   catalogue arrivé, sans rien recâbler ailleurs dans ce fichier. */
const byId = {};

/* CORRECTIF (audit 2026-10-13, bug réel rapporté : "Apple et bien
   d'autres entreprises apparaissent en plusieurs fois" sur Marchés) —
   cette fonction PRÉTENDAIT déjà produire "le même id" que le catalogue
   statique (voir commentaire ci-dessous, jamais vérifié jusqu'ici), mais
   ne le faisait PAS réellement pour NASDAQ/NYSE/NYSE ARCA : catalog.json
   (scripts/build-catalog.js, table ID_SUFFIX) abrège ces 3 places
   précises dans l'ID ("AAPL-NAS"), alors que remoteId() utilisait le nom
   complet tel que renvoyé par /api/market/search ou le catalogue distant
   ("AAPL-NASDAQ") — DEUX ids différents pour la MÊME société réelle dès
   qu'elle existe dans les deux sources, donc DEUX cartes dans la liste.
   Un correctif antérieur (js/data-services.js, TOP_SYMBOLES_PRECHARGES)
   avait déjà documenté exactement ce mécanisme pour UN SEUL cas précis
   (le préchargement de cotations) sans jamais corriger la cause réelle
   ici — ensureRuntimeStock()/searchProviders()/searchCatalog(), qui
   alimentent TOUTE la page Marchés, restaient donc affectés pour
   N'IMPORTE QUELLE société de ces 3 places. ID_EXCHANGE_SUFFIX reproduit
   EXACTEMENT la table ID_SUFFIX de scripts/build-catalog.js (à garder
   synchronisées manuellement) — UNIQUEMENT pour le calcul de l'id
   (dédoublonnage) : exchangeCode lui-même (stocké sur l'objet stock,
   transmis tel quel à /api/market/history|fundamentals|quotes) n'est
   JAMAIS abrégé, aucun risque de casser un appel API existant. */
const ID_EXCHANGE_SUFFIX = { NASDAQ:'NAS', NYSE:'NYS', 'NYSE ARCA':'NYA' };
function remoteId(ticker, exchangeCode){
  const t = String(ticker || '').toUpperCase().trim();
  const eBrut = String(exchangeCode || '').toUpperCase().trim();
  const e = ID_EXCHANGE_SUFFIX[eBrut] || eBrut;
  return e ? `${t}-${e}` : t;
}

/* Transforme un résultat de recherche externe (métadonnées seulement) en
   objet "stock" exploitable par le reste du fichier (fiche, achat, watchlist,
   comparateur…), sans jamais fabriquer de prix, score ou fondamentaux : ces
   champs restent BLANK_FIELDS() et ne se rempliront que si QUOTES/HIST ou un
   futur cache COMPANY reçoivent une vraie réponse serveur pour cet id.
   Le catalogue local n'est donc plus une limite : c'est un noyau de départ,
   pas un plafond — toute société renvoyée par /api/market/search peut
   rejoindre `stocks`/`byId` à la demande. */
function ensureRuntimeStock(meta, persist = true){
  if (!meta || !meta.ticker) return null;
  /* L'id est TOUJOURS dérivé de ticker+exchangeCode, jamais d'un éventuel
     champ `meta.id` du backend : ça garantit que l'id calculé ici est
     identique à celui déjà calculé par searchRemote() pour le même résultat
     (déduplication, navigation, Comparer, portefeuille cohérents). */
  const code = pickExchangeCode(meta);
  const id = remoteId(meta.ticker, code);
  console.debug('[NovaTitre][ensureRuntimeStock]', { ticker:meta.ticker, rawExchange:meta.exchange,
    rawExchangeCode:meta.exchangeCode, codeRetenu:code, idCalcule:id, dejaConnue:!!byId[id] });
  if (byId[id]) return byId[id];
  const s = {
    id,
    name: meta.name || meta.ticker,
    ticker: String(meta.ticker).toUpperCase(),
    /* `market` = libellé lisible pour l'affichage uniquement.
       `exchangeCode` = code exact tel que renvoyé par /api/market/search,
       transmis TEL QUEL (sans passer par MARKET_CODE) à /api/market/history,
       /api/market/fundamentals et /api/market/quotes. C'est ce champ qui
       manquait pour les sociétés hors catalogue : voir chargerGraphique,
       chargerFondamentaux et symboleDe ci-dessous. */
    market: meta.market || meta.exchange || code || '—',
    exchangeCode: code,
    sector: meta.sector || 'Non classé',
    /* industry : conservée seulement si réellement fournie par le search
       (jamais déduite) — utile pour ne pas la renvoyer null à l'analyse
       alors que NovaTitre la connaît déjà (voir runAnalysis). */
    industry: meta.industry || null,
    country: meta.country || '—',
    cur: meta.currency || meta.cur || 'USD',
    curSymbol: CUR_SYMBOL[meta.currency || meta.cur] || (meta.currency || meta.cur || ''),
    ...BLANK_FIELDS(),
    /* assetType vient de search.js (typeInterne()) — 'stock' par défaut si
       absent, cohérent avec BLANK_FIELDS() et le comportement précédent. */
    type: meta.assetType || 'stock',
  };
  stocks.push(s);
  byId[s.id] = s;

  if (persist){
    /* Mémorise les SEULES métadonnées (jamais prix/score/fondamentaux) pour
       pouvoir recréer cette société au prochain chargement, sans quoi une
       position achetée ou une sélection Comparer sur une société hors
       catalogue redeviendrait invisible tant qu'elle n'est pas recherchée à
       nouveau. Écriture immédiate : peu fréquent, coût négligeable, et on ne
       veut pas perdre cette entrée si l'onglet se ferme juste après. */
    state.runtimeCatalog[id] = {
      ticker:s.ticker, name:s.name, exchangeCode:s.exchangeCode,
      market:s.market, sector:s.sector, industry:s.industry, country:s.country, cur:s.cur,
      assetType:s.type,
    };
    flushSaveState();
  }

  return s;
}

/* Recrée, au démarrage, toutes les sociétés hors catalogue déjà rencontrées
   (positions du portefeuille, sélection Comparer…) à partir des seules
   métadonnées persistées. Appelé une fois dans boot(), avant tout rendu, de
   sorte que byId soit complet avant que portfolioValue()/PAGES.compare()
   n'essaient de résoudre un id. persist:false : on ne fait que rejouer des
   entrées déjà enregistrées, pas la peine de les ré-écrire ni de reflush. */
function restoreRuntimeCatalog(){
  Object.values(state.runtimeCatalog || {}).forEach(meta => ensureRuntimeStock(meta, false));
}

/* CORRECTIF (gap trouvé en test live, 2026-10-06) : byId ne contient pas de
   façon fiable les valeurs suivies/détenues sur un chargement "froid" quand
   runtimeCatalog n'a jamais été peuplé pour cet id (achat/suivi antérieur à
   la persistance systématique d'ensureRuntimeStock(), ou entrée perdue) —
   confirmé en direct : byId['AAPL-NAS'] undefined malgré une position
   AAPL-NAS réelle, ce qui faisait silencieusement échouer la pertinence
   Nova News (§29/§33, nomsEntreprisesPertinentes() dans js/nova.js) et
   aurait aussi affecté PAGES.stock (js/page-stock.js, aucun repli propre,
   simple "Entreprise introuvable") — seul PAGES.portfolio dégrade déjà
   proprement vers "Société non reconnue" (js/page-portfolio.js:117-123).
   Résout chaque id watchlist/position encore absent de byId en recherchant
   son ticker via searchRemote() (mêmes fournisseurs + catalogue mondial que
   la barre de recherche) et en matérialisant le résultat dont l'id calculé
   correspond EXACTEMENT (remoteId(), même convention) via ensureRuntimeStock(),
   qui le persiste aussi dans runtimeCatalog : ce correctif n'a donc plus
   besoin de s'appliquer une 2e fois pour le même id. `identitesConnuesEnCours`
   évite de relancer une recherche déjà en vol si render() rappelle cette
   fonction avant sa résolution (même garde que catalogueGlobalRenderArme/
   accueilApercuRenderArme dans index.html). N'élargit jamais au catalogue
   complet (20,8 Mo) : une poignée d'ids connus, jamais un chargement de
   masse. ticker = id.split('-')[0] : suppose, comme remoteId() lui-même,
   qu'un ticker ne contient jamais de '-' (convention déjà en place, pas
   une nouvelle hypothèse). */
const identitesConnuesEnCours = new Set();
function assurerIdentitesConnues(){
  const ids = new Set([...state.watchlist, ...state.wallet.positions.map(p => p.id)]);
  const manquants = [...ids].filter(id => id && !byId[id] && !identitesConnuesEnCours.has(id));
  if (!manquants.length) return null;
  manquants.forEach(id => identitesConnuesEnCours.add(id));
  return Promise.all(manquants.map(async (id) => {
    const ticker = String(id).split('-')[0];
    if (!ticker || ticker.length < 2) return false;
    try {
      const hits = await searchRemote(ticker);
      const hit = hits.find(h => h.id === id);
      if (hit){ ensureRuntimeStock(hit.meta); return true; }
    } catch {}
    return false;
  })).then(resultats => resultats.some(Boolean));
}

/* CORRECTIF (bug réel trouvé en test live, 2026-10-07) : l'aperçu "Marché"
   de l'accueil (page-home.js, `stocks.slice(0,6)`) prenait les 6 premières
   entrées de `stocks` dans l'ordre où elles ont été chargées — depuis que
   le catalogue Supabase est peuplé (~63 404 lignes, triées par
   listing_key croissant), ce sont les 6 premières par ordre alphabétique
   de place::ticker, PAS les plus connues. Vérifié en direct : l'accueil
   affichait "Hermes Transporte Blindados S.A." (une société de transport
   blindé brésilienne, rien à voir avec Hermès) et "MacDonald Mines
   Exploration" (micro-valeur minière) à côté d'actions sans AUCUN cours
   disponible ("—") — inacceptable pour la toute première chose vue sur
   l'accueil d'un produit fintech.
   Liste FIXE de grandes capitalisations mondiales, jamais choisies pour
   leur ordre alphabétique : résolues par recherche exacte (même mécanisme
   que assurerIdentitesConnues() ci-dessus), jamais par pagination du
   catalogue. Tickers volontairement sans AUCUNE ambiguïté connue
   (contrairement à "MC"=LVMH/Moelis/MC Group, voir
   sql/2026-09-15_market_catalog.sql) : AAPL/MSFT/GOOGL/AMZN/NVDA/ASML
   n'ont pas d'homonyme coté connu — le premier résultat de recherche
   PAR TICKER est donc fiable ici, ce qui ne serait pas vrai pour un
   ticker court générique. */
const TICKERS_APERCU_ACCUEIL = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'ASML'];
let apercuAccueilEnCours = null;
/* "Résolu" exige le TICKER *et* la place NASDAQ (vraie pour les 6 valeurs
   de TICKERS_APERCU_ACCUEIL) — jamais le ticker seul. CORRECTIF (bug réel
   confirmé en direct, 2026-10-07) : avant ce garde-fou, un compte ayant
   chargé la mauvaise entité "MSFT" (le clone européen "Leverage Shares 1x
   Microsoft Tracker ETP", mis en cache dans runtimeCatalog AVANT le
   correctif ci-dessous) gardait cette entité pour toujours — le ticker
   "MSFT" était déjà présent dans `stocks`, donc plus jamais re-résolu,
   même après correction du code. Auto-réparateur pour tout compte déjà
   affecté, sans script de nettoyage à part. */
function stockApercuAccueilValide(ticker){
  return stocks.some(s => s.ticker === ticker && String(s.exchangeCode || '').toUpperCase() === 'NASDAQ');
}
function assurerApercuMarcheAccueil(){
  if (apercuAccueilEnCours) return apercuAccueilEnCours;
  const manquants = TICKERS_APERCU_ACCUEIL.filter(t => !stockApercuAccueilValide(t));
  if (!manquants.length) return null;
  apercuAccueilEnCours = Promise.all(manquants.map(async (ticker) => {
    try {
      const hits = await searchRemote(ticker);
      /* CORRECTIF (bug réel confirmé en direct, 2026-10-07) : matcher sur
         le seul ticker a fait remonter "Leverage Shares 1x Microsoft
         Tracker ETP" (un produit européen qui partage le ticker "MSFT")
         à la place de Microsoft Corporation elle-même — même famille de
         collision que "MC"=LVMH/Moelis déjà documentée. Exige maintenant
         EXPLICITEMENT NASDAQ comme place (vrai pour les 6 tickers de
         TICKERS_APERCU_ACCUEIL) : un résultat de la bonne place, pas
         seulement du bon ticker. */
      const hit = hits.find(h => String(h.meta?.ticker || '').toUpperCase() === ticker
        && String(h.meta?.exchange || pickExchangeCode(h.meta) || '').toUpperCase() === 'NASDAQ');
      if (hit){ ensureRuntimeStock(hit.meta); return true; }
    } catch {}
    return false;
  })).then(resultats => resultats.some(Boolean));
  return apercuAccueilEnCours;
}

/* Indices boursiers réels — jamais dans catalog.json (bâti depuis
   free-ticker-database, qui ne couvre que sociétés/ETF cotés, pas les
   indices) ni renvoyés par /api/market/search pour des requêtes usuelles
   ("CAC 40", "S&P 500"...) : avant cette liste, AUCUN indice n'était
   accessible nulle part dans l'app, malgré un pipeline backend complet et
   fonctionnel pour eux (eodhdIndexSymbol(), voir _providers.js) — un
   ancien commentaire affirmait par erreur que "41 indices réels" existaient
   déjà dans `stocks` ; vérifié empiriquement (stocks.filter(type==='index')
   = 0) : c'était faux, jamais implémenté.
   Chaque entrée ci-dessous est VÉRIFIÉE EMPIRIQUEMENT (2026-09-30, clé de
   production réelle, pas "demo") : prix réel ET historique intraday du
   jour réel reçus via /api/market/quotes et /api/market/history?period=1j
   pour CHACUNE — jamais une convention supposée. D'autres indices (FTSE
   100, FTSE MIB, Russell 2000 essayés) n'ont renvoyé aucune donnée
   exploitable sous aucune convention de ticker testée : volontairement
   absents plutôt qu'une entrée qui afficherait "—" en permanence. */
const INDICES_VERIFIES = [
  { ticker:'GSPC',     name:'S&P 500',                  country:'États-Unis',  cur:'USD' },
  { ticker:'DJI',      name:'Dow Jones Industrial Average', country:'États-Unis', cur:'USD' },
  { ticker:'IXIC',     name:'Nasdaq Composite',         country:'États-Unis',  cur:'USD' },
  { ticker:'NDX',      name:'Nasdaq 100',               country:'États-Unis',  cur:'USD' },
  { ticker:'VIX',      name:'CBOE Volatility Index (VIX)', country:'États-Unis', cur:'USD' },
  { ticker:'GSPTSE',   name:'S&P/TSX Composite',        country:'Canada',      cur:'CAD' },
  { ticker:'BVSP',     name:'Ibovespa',                 country:'Brésil',      cur:'BRL' },
  { ticker:'FCHI',     name:'CAC 40',                   country:'France',      cur:'EUR' },
  { ticker:'GDAXI',    name:'DAX',                      country:'Allemagne',   cur:'EUR' },
  { ticker:'STOXX50E', name:'EURO STOXX 50',            country:'Zone euro',   cur:'EUR' },
  { ticker:'IBEX',     name:'IBEX 35',                  country:'Espagne',     cur:'EUR' },
  { ticker:'AEX',      name:'AEX',                      country:'Pays-Bas',    cur:'EUR' },
  { ticker:'SSMI',     name:'Swiss Market Index (SMI)', country:'Suisse',      cur:'CHF' },
  { ticker:'N225',     name:'Nikkei 225',               country:'Japon',       cur:'JPY' },
  { ticker:'HSI',      name:'Hang Seng',                country:'Hong Kong',   cur:'HKD' },
  { ticker:'KS11',     name:'KOSPI',                    country:'Corée du Sud', cur:'KRW' },
  { ticker:'AXJO',     name:'S&P/ASX 200',              country:'Australie',   cur:'AUD' },
];
function seedIndices(){
  for (const idx of INDICES_VERIFIES){
    ensureRuntimeStock({
      ticker: idx.ticker, name: idx.name, exchangeCode:'INDX', exchange:'Indice',
      sector:'Indice', country: idx.country, currency: idx.cur, assetType:'index',
    }, false);
  }
}

/* Matières premières — même constat et même mécanisme que les indices
   ci-dessus (ni dans catalog.json, ni découvrables via /api/market/search
   pour "Gold"/"Silver"/"Crude Oil"...). Seulement 3 tickers ont une
   convention EODHD vérifiée (EODHD_COMMODITY_FOREX, _providers.js) :
   XPD/USD (palladium), XPT/USD (platine), XBR/USD (Brent) — Gold/Silver/
   WTI/Copper essayés par le passé sans convention fonctionnelle trouvée,
   volontairement exclus (même discipline que pour les indices).
   NUANCE IMPORTANTE, vérifiée empiriquement (2026-10-01) et différente des
   indices : le PRIX fonctionne (dérivé de la dernière clôture EODHD, même
   mécanisme que les indices sans flux temps réel), mais le GRAPHIQUE DU
   JOUR ne fonctionnera jamais pour ces 3 — le flux intraday d'EODHD
   renvoie 0 ligne pour ces symboles (`aucune_ligne_recue`), quel que soit
   le fournisseur tenté (Twelve Data n'a ces symboles qu'à partir d'un
   forfait payant supérieur). Ajoutées quand même : un prix réel et
   consultable vaut mieux qu'une absence totale, et c'est le même état
   honnête ("pas de courbe aujourd'hui") que de nombreuses actions déjà
   dans le catalogue. */
const COMMODITIES_VERIFIEES = [
  { ticker:'XPD/USD', name:'Palladium', country:'International', cur:'USD' },
  { ticker:'XPT/USD', name:'Platine',   country:'International', cur:'USD' },
  { ticker:'XBR/USD', name:'Pétrole Brent', country:'International', cur:'USD' },
];
function seedCommodities(){
  for (const c of COMMODITIES_VERIFIEES){
    ensureRuntimeStock({
      ticker: c.ticker, name: c.name, exchangeCode:'FOREX', exchange:'Matière première',
      sector:'Matières premières', country: c.country, currency: c.cur, assetType:'commodity',
    }, false);
  }
}

/* --------------------------------------------------------------------
   CATALOGUE MONDIAL (Explorer/Marchés) — parcours par pages de 20, jamais
   la recherche comme seul point d'entrée. S'appuie sur
   /api/market/extra?kind=catalog (2026-09-24 : fusionnée avec news.js et
   health.js pour rester sous la limite de fonctions serverless du plan
   Vercel — voir la note en tête d'api/market/extra.js), lui-même
   alimenté par free-ticker-database.

   IMPORTANT — couverture réelle du dataset : uniquement 'stock' et 'etf'
   (colonnes asset_type constatées = Stock/ETF uniquement, aucune ligne
   forex/crypto/indice/matière première/obligation). Forex et Crypto
   restent donc sur leur liste statique existante (déjà 20 entrées chacune)
   : aucun appel catalogue n'est fait pour ces deux types, pour ne jamais
   laisser croire à une couverture qui n'existe pas dans la source.

   Chaque société matérialisée passe par ensureRuntimeStock(), exactement
   comme un résultat de recherche : même garantie qu'aucun prix/score n'est
   jamais fabriqué, seule l'identité (ticker/nom/ISIN/secteur/place) vient
   du catalogue — le cours reste à charger en direct via QUOTES. */
const CATALOG_TYPES = new Set(['stock', 'etf']);
const CATALOG_PAGE_SIZE = 20;

const catalogState = {};
function etatCatalogue(type){
  if (!catalogState[type]) catalogState[type] = { cursor:null, done:false, loading:false };
  return catalogState[type];
}

/* Charge UNE page (20 au plus) depuis le catalogue mondial et matérialise
   chaque résultat. Retourne le nombre de sociétés réellement ajoutées
   (0 si épuisé, en erreur, ou déjà en cours de chargement — jamais deux
   requêtes concurrentes pour le même type). N'est JAMAIS appelée pour
   forex/crypto (voir CATALOG_TYPES). */
async function chargerPageCatalogue(type){
  if (!CATALOG_TYPES.has(type)) return 0;
  const st = etatCatalogue(type);
  if (st.done || st.loading) return 0;
  st.loading = true;
  try {
    const url = '/api/market/extra?kind=catalog&type=' + encodeURIComponent(type)
      + '&limit=' + CATALOG_PAGE_SIZE
      + (st.cursor ? '&cursor=' + encodeURIComponent(st.cursor) : '');
    const r = await fetch(url);
    if (!r.ok) return 0;   // erreur transitoire : pas de `done`, un futur essai pourra réussir
    const d = await r.json();
    const results = Array.isArray(d.results) ? d.results : [];
    let ajoutees = 0;
    for (const x of results){
      if (!x || !x.ticker) continue;
      const avant = stocks.length;
      ensureRuntimeStock({ ...x, sector: SECTEUR_CATALOGUE[x.sector] || null });
      if (stocks.length > avant) ajoutees++;
    }
    st.cursor = d.nextCursor || null;
    if (!d.nextCursor) st.done = true;
    return ajoutees;
  } catch {
    return 0;   // hors-ligne/erreur réseau : pas de `done`, retentable plus tard
  } finally {
    st.loading = false;
  }
}

/* Charge des pages successives jusqu'à atteindre `minimum` instruments de
   ce type dans `stocks`, ou jusqu'à épuisement réel du catalogue (`done`).
   Ne boucle jamais indéfiniment : chaque page vide ou en erreur arrête la
   boucle immédiatement (voir chargerPageCatalogue). */
async function assurerCatalogueSuffisant(type, minimum){
  if (!CATALOG_TYPES.has(type)) return false;
  const st = etatCatalogue(type);
  let changement = false;
  while (!st.done && stocks.filter(s => s.type === type).length < minimum){
    const ajoutees = await chargerPageCatalogue(type);
    if (ajoutees > 0) changement = true;
    if (ajoutees === 0) break;
  }
  return changement;
}

/* Composantes du NovaScore : cette liste décrit le MOTEUR (backend
   _novascore.js), affichée à titre pédagogique dans « Comment fonctionne le
   NovaScore ». Elle ne calcule rien ici et n'attribue aucune note. */
const COMPONENTS = [
  { key:'quality',    label:'Qualité',        weight:15, from:"Marge opérationnelle" },
  { key:'growth',     label:'Croissance',     weight:15, from:"Chiffre d'affaires et bénéfice" },
  { key:'profit',     label:'Rentabilité',    weight:15, from:"ROE" },
  { key:'debt',       label:'Endettement',    weight:15, from:"Dette / fonds propres" },
  { key:'valuation',  label:'Valorisation',   weight:15, from:"PER" },
  { key:'volatility', label:'Volatilité',     weight:10, from:"Écart-type des cours" },
  { key:'momentum',   label:'Momentum',       weight:5,  from:"Tendance à six mois" },
  { key:'regularity', label:'Régularité',     weight:10, from:"Part de mois en hausse" },
];
const WEIGHT_TOTAL = COMPONENTS.reduce((a, c) => a + c.weight, 0);

/* Profil textuel dérivé d'un NovaScore réel (fourni par le backend). Gère
   explicitement l'absence de score : jamais de profil par défaut inventé. */
function profileOf(score){
  if (score === null || score === undefined || !Number.isFinite(score))
    return { short:'Non calculable', detail:"Données insuffisantes pour produire un NovaScore." };
  if (score >= 80) return { short:'Très solide',  detail:'Profil très solide sur les critères mesurés.' };
  if (score >= 65) return { short:'Solide',       detail:'Profil solide sur les critères mesurés.' };
  if (score >= 50) return { short:'Équilibré',    detail:'Profil équilibré, sans signal dominant.' };
  if (score >= 35) return { short:'Prudent',      detail:'Profil prudent : plusieurs points de vigilance.' };
  return { short:'Risque élevé', detail:'Profil marqué par un risque élevé sur les critères mesurés.' };
}

/* Aucun score statique n'existe dans ce catalogue : la liste triée par score
   utilisée par l'onboarding reste donc vide tant qu'aucune analyse réelle n'a
   été calculée pour ces sociétés. On ne trie jamais sur une valeur inventée. */
const scored = stocks.filter(s => Number.isFinite(s.score));

const isExpert = () => state.settings.mode === 'expert';
/* Niveau Nova Explain (2026-09-28, pivot NovaTitre — onboarding adaptatif
   "règle tout") : state.settings.mode porte désormais les 3 valeurs
   réelles choisies à l'onboarding ('debutant'/'intermediaire'/'expert',
   voir ONB_LEVELS) au lieu d'être aplati en binaire — correctif au
   passage : un utilisateur "intermédiaire" était jusqu'ici traité
   IDENTIQUEMENT à un débutant partout où isExpert() était consulté (le
   mode était forcé à 'debutant' dès que level !== 'expert'), perdant
   toute distinction entre les deux. isExpert() reste valide tel quel
   (seule la comparaison 'expert' compte pour son usage existant, non
   affectée). novaLevel() est le nouveau point d'entrée à 3 valeurs,
   utilisé par le système Nova Explain (popovers, [data-nova-level] CSS). */
const novaLevel = () => state.settings.mode || 'intermediaire';

/* Périodes proposées sur la fiche action. Ne couvre que ce que
   /api/market/company peut raisonnablement fournir en clôtures quotidiennes.
   1J et 1S (intraday) ne sont volontairement pas proposés : aucune source
   intraday n'est branchée dans ce fichier, et il est hors de question de
   simuler de l'intraday à partir de clôtures journalières. */
const PERIODS_DISPO = ['1S','1M','3M','6M','AAJ','1A'];

/* Périodes du graphique professionnel de la fiche instrument (distinctes de
   PERIODS_DISPO ci-dessus, encore utilisé par Comparer/Réglages/Portefeuille
   sur l'ancien graphique SVG — non touché dans cette refonte). `api` est la
   valeur exacte attendue par /api/market/history?period=, résolue et bornée
   côté serveur (voir PERIOD_SPECS dans api/market/history.js) : chaque
   période n'est proposée que si le backend a une vraie stratégie pour elle,
   jamais une période "décorative" sans données réelles derrière. */
const CHART_PERIODS = [
  { api:'1j',  label:'1J'  },
  { api:'5j',  label:'5J'  },
  { api:'1s',  label:'1S'  },
  { api:'1m',  label:'1M'  },
  { api:'3m',  label:'3M'  },
  { api:'6m',  label:'6M'  },
  { api:'ytd', label:'AAJ' },
  { api:'1a',  label:'1A'  },
  { api:'2a',  label:'2A'  },
  { api:'5a',  label:'5A'  },
  { api:'10a', label:'10A' },
  { api:'max', label:'MAX' },
];

/* SUPPRIMÉ (audit "indices sans graphique", 2026-09-17) : l'ancien tableau
   INDICES (8 indices, valeurs `value`/`chg` figées en dur dans le code,
   jamais mises à jour — un reliquat de prototype antérieur à l'intégration
   des providers réels) et marketOpen() (qui n'en calculait le statut que
   pour CE tableau, jamais appelée ailleurs). Les mêmes 8 indices existent
   déjà comme entrées RÉELLES dans `stocks` (type:'index' — voir plus haut,
   ex. id:'FCHI' pour le CAC 40, id:'N225' pour le Nikkei 225) avec cours/
   historique en direct via le pipeline provider standard. Seul usage de
   INDICES (searchAll()) est retiré dans le même commit — aucune autre
   fonctionnalité n'en dépendait. */
function localTime(tz){
  try { return new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:tz}).format(new Date()); }
  catch { return '—'; }
}

/* Market Pulse : agrégat des seules données réellement disponibles (QUOTES).
   Si aucune quote n'est encore arrivée, chaque facteur reste indisponible et
   le score global est null plutôt que calculé sur du vide. */
function marketPulse(){
  const avg = (list, get) => {
    const vals = list.map(get).filter(v => Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const clamp = v => v === null ? null : Math.max(0, Math.min(100, Math.round(v)));

  const changesOf = s => { const q = QUOTES.get(s.id); return q && Number.isFinite(q.changePercent) ? q.changePercent : null; };
  const rated = stocks.map(changesOf).filter(v => v !== null);
  const advancing = rated.filter(v => v > 0).length;
  const breadth = rated.length ? clamp(advancing / rated.length * 100) : null;

  const factors = [
    { k:'Largeur du marché', v:breadth,
      d: breadth === null ? 'Cotations pas encore reçues.' : `${advancing} sociétés en hausse sur ${rated.length}.` },
  ].filter(f => f.v !== null);

  const score = factors.length ? Math.round(factors.reduce((a, f) => a + f.v, 0) / factors.length) : null;
  return { score, factors };
}

/* Recherche : catalogue local uniquement dans ce fichier. La recherche
   mondiale via /api/market/search n'est pas câblée ici (voir rapport) ; ce
   n'est pas une régression introduite par cette passe, la fonctionnalité
   n'existait déjà pas dans le fichier reçu. */
function searchAll(q){
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const hits = [];
  /* CORRECTIF (bug réel confirmé en test, 2026-09-30 — retour utilisateur :
     "50%+ des actions sans données") : cette boucle ne classait les
     résultats que par ORDRE D'APPARITION dans `stocks` (ordre d'import du
     catalogue), jamais par pertinence. Conséquence mesurée : chercher
     "RIO" remontait Azerion/Kendrion/Chariot Resources/Patriot Resources/
     Alurion (dont le NOM contient "rio" en sous-chaîne — "chaRIOt",
     "patRIOt"...), jamais Rio Tinto (ticker EXACT "RIO") ; chercher "SPA"
     remontait CleanSpace/Space Hellas/IboveSPA, jamais 1Spatial (ticker
     EXACT "SPA") ; "Unilever" ne remontait QUE des filiales sans rapport
     (Unilever Indonesia, Pakistan...), jamais Unilever PLC elle-même.
     L'utilisateur tombait donc sur des valeurs obscures/peu liquides
     (souvent mal couvertes par les fournisseurs de cours, d'où le "—"),
     alors que la société cherchée existait bel et bien dans le catalogue
     avec une cotation fiable (vérifié : RIO-L, HSBA-L, ULVR-L, HSBC-NYS,
     TMC-NAS ont tous un prix réel via /api/market/quotes).
     Priorité de pertinence ajoutée ci-dessous (0 = meilleur) : ticker
     EXACT, puis ticker qui COMMENCE par la requête, puis nom qui COMMENCE
     par la requête, puis toute autre correspondance (comportement
     d'origine, inchangé). Tri stable : au sein d'un même rang, l'ordre
     d'origine (catalogue) est conservé. */
  for (const s of stocks){
    const ticker = (s.ticker || '').toLowerCase();
    const nom = (s.name || '').toLowerCase();
    const hay = (s.name+' '+s.ticker+' '+s.sector+' '+s.market).toLowerCase();
    if (!hay.includes(t)) continue;
    const rang = ticker === t ? 0
      : ticker.startsWith(t) ? 1
      : nom.startsWith(t) ? 2
      : 3;
    hits.push({ rang, type:'action', id:s.id, title:s.name,
      sub:`${s.ticker} · ${s.sector} · ${s.market}` });
  }
  hits.sort((a, b) => a.rang - b.rang);
  /* CORRECTIF (audit "indices sans graphique", 2026-09-17) : cette fonction
     interrogeait AUSSI l'ancien tableau INDICES (données figées en dur,
     value/chg jamais mis à jour — un reliquat de prototype) et poussait un
     hit `type:'indice'` que pick() route vers un toast "page indice
     bientôt disponible", cul-de-sac confirmé (voir pick() plus bas). Les
     41 indices RÉELS (CAC 40, DAX, FTSE 100, Nikkei 225, Hang Seng,
     Nasdaq 100, Dow Jones, S&P 500...) existent déjà dans `stocks`
     (type:'index', cotation/historique en direct via le même pipeline
     que les actions) et sont déjà couverts par la boucle ci-dessus, avec
     `type:'action'` — pick() les ouvre donc déjà correctement. Le tableau
     INDICES et marketOpen() (jamais appelée ailleurs) ont été supprimés :
     aucune autre fonctionnalité n'en dépendait (vérifié par recherche
     globale avant suppression). */
  return hits.slice(0, 8);
}

/* Recherche distante : /api/market/search permet d'ouvrir une société absente
   du catalogue local, qui ne sert plus que de noyau rapide et hors-ligne.
   Contrat ASSUMÉ d'après la documentation de passation (non vérifié en
   exécution, aucun backend disponible ici) : GET /api/market/search?q=...
   -> { results: [{ ticker, name, exchange, exchangeCode, country, currency,
   sector }] }. Lecture défensive : accepte aussi `matches`/`items`, ignore
   tout élément sans ticker, et échoue silencieusement (recherche locale
   seule) si l'endpoint est absent, en erreur, ou renvoie autre chose. */
/* Reconnaissance élargie du code de place boursière dans un résultat de
   /api/market/search : le contrat exact de cet endpoint n'a jamais été
   vérifié contre une vraie réponse (contrairement à /api/market/company,
   confirmé par des réponses réelles). "exchangeCode"/"exchange" étaient une
   hypothèse ; on essaie ici plusieurs noms plausibles, dans l'ordre, sans
   jamais en inventer la valeur — seulement élargir où on va la chercher. */
function pickExchangeCode(x){
  if (!x) return '';
  return x.exchangeCode || x.exchange_code || x.exchangeMic || x.mic || x.micCode
    || x.exchangeShort || x.marketCode || x.exchange || '';
}

async function searchProviders(t){
  if (!CONFIG.marketConnected) return [];
  try {
    const r = await fetch('/api/market/search?q=' + encodeURIComponent(t));
    if (!r.ok) return [];
    const d = await r.json();
    const list = Array.isArray(d.results) ? d.results
      : Array.isArray(d.matches) ? d.matches
      : Array.isArray(d.items) ? d.items
      : [];
    /* Diagnostic temporaire, sans effet sur l'UI : permet de retrouver dans
       la console du navigateur la forme RÉELLE renvoyée par le backend pour
       confirmer/corriger ce mapping (voir rapport — jamais vérifié avant). */
    console.debug('[NovaTitre][searchProviders] réponse brute pour', JSON.stringify(t), ':', d);
    return list.filter(x => x && x.ticker).slice(0, 8).map(x => {
      const code = pickExchangeCode(x);
      return {
        type:'action', remote:true,
        id: remoteId(x.ticker, code),
        title: x.name || x.ticker,
        sub: `${x.ticker} · ${x.sector || 'Non classé'} · ${x.exchange || code || '—'}`,
        meta: x,
      };
    });
  } catch {
    return [];   // recherche locale conservée en repli, aucune erreur affichée
  }
}

/* Catalogue mondial (free-ticker-database, importé côté serveur — voir
   scripts/import-catalog.js) : identité seule (ticker/nom/ISIN/place),
   jamais de prix. Même mapping que searchProviders() pour que les deux
   sources produisent des résultats strictement interchangeables du point
   de vue de ensureRuntimeStock(). Un instrument sans exchangeCode reste
   affichable (cours "indisponible", comportement déjà existant) : aucune
   UI nouvelle n'est nécessaire pour ce cas. */
async function searchCatalog(t){
  try {
    const r = await fetch('/api/market/extra?kind=catalog&q=' + encodeURIComponent(t) + '&limit=8');
    if (!r.ok) return [];
    const d = await r.json();
    const list = Array.isArray(d.results) ? d.results : [];
    return list.map(x => {
      const code = pickExchangeCode(x);
      return {
        type:'action', remote:true,
        id: remoteId(x.ticker, code),
        title: x.name || x.ticker,
        sub: `${x.ticker} · ${x.sector || 'Non classé'} · ${x.exchange || code || '—'}`,
        meta: x,
      };
    });
  } catch {
    return [];
  }
}

/* Fusionne les deux sources distantes (fournisseurs payants + catalogue
   mondial importé) : searchProviders() passe en premier (couverture déjà
   éprouvée), searchCatalog() complète sans jamais dupliquer un id déjà
   trouvé. Ni l'un ni l'autre ne bloque si l'autre échoue (Promise.all sur
   des fonctions qui catchent déjà leurs propres erreurs). */
async function searchRemote(q){
  const t = q.trim();
  if (t.length < 2) return [];
  const [providers, catalogue] = await Promise.all([
    searchProviders(t),
    searchCatalog(t),
  ]);
  const vus = new Set();
  const fusion = [];
  for (const hit of [...providers, ...catalogue]){
    if (vus.has(hit.id)) continue;
    vus.add(hit.id);
    fusion.push(hit);
  }
  return fusion.slice(0, 8);
}
/* CORRECTIF (audit LOT F, 2026-09-24) : les limites Free/Pro/Elite
   (LIMITS.watchlist dans api/me.js, déjà affichées sur la page Offres)
   n'étaient JAMAIS vérifiées ici — un compte Free pouvait suivre un
   nombre illimité de valeurs malgré la limite annoncée à 10. `state.
   account?.limits` peut être absent un court instant après connexion
   (refreshAccount() pas encore résolu) : dans ce cas précis on laisse
   passer plutôt que de bloquer une action légitime sur une simple
   course de latence, même logique de dégradation gracieuse que
   quotaLigne() plus haut dans ce fichier. */
function toggleWatch(id){
  const i = state.watchlist.indexOf(id);
  if (i >= 0){ state.watchlist.splice(i, 1); toast('Retiré de la watchlist'); saveState(); return; }
  const limits = state.account?.limits;
  if (limits && !limits.watchlistUnlimited && state.watchlist.length >= limits.watchlist){
    toast(`Watchlist limitée à ${limits.watchlist} valeurs en offre ${state.account.planLabel || 'Découverte'} — passez à l'offre supérieure pour en suivre plus.`);
    return;
  }
  state.watchlist.push(id);
  toast('★ ' + (byId[id] ? byId[id].name : id) + ' ajouté à votre watchlist');
  saveState();
}
const inWatch = (id) => state.watchlist.includes(id);

/* ============================================================
   LISTES ORGANISÉES (§9) — distinctes de watchlist/inWatch ci-dessus.
   ============================================================ */
const LIST_COLORS = ['#e67e22','#21c984','#e0407a','#0066ff','#5b4ae0','#0891b2','#dc2626','#64748b'];
/* Réutilise des icônes déjà existantes dans ICON (voir plus bas) plutôt que
   d'en dessiner de nouvelles — aucun nouvel asset SVG pour cette passe. */
const LIST_ICONS = ['star','shield','chart','wallet','list','book'];

function creerListe(nom, color, icon){
  const nomPropre = String(nom || '').trim().slice(0, 60);
  if (!nomPropre) return null;
  const id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const liste = {
    id, name: nomPropre,
    color: LIST_COLORS.includes(color) ? color : LIST_COLORS[state.lists.length % LIST_COLORS.length],
    icon: LIST_ICONS.includes(icon) ? icon : 'star',
    items: [],
  };
  state.lists.push(liste);
  saveState();
  return liste;
}
function renommerListe(id, nom){
  const l = state.lists.find(x => x.id === id);
  if (!l) return;
  const nomPropre = String(nom || '').trim().slice(0, 60);
  if (nomPropre) l.name = nomPropre;
  saveState();
}
function recolorerListe(id, color, icon){
  const l = state.lists.find(x => x.id === id);
  if (!l) return;
  if (LIST_COLORS.includes(color)) l.color = color;
  if (LIST_ICONS.includes(icon)) l.icon = icon;
  saveState();
}
function supprimerListe(id){
  const i = state.lists.findIndex(x => x.id === id);
  if (i < 0) return;
  state.lists.splice(i, 1);
  saveState();
}
function toggleItemListe(listeId, stockId){
  const l = state.lists.find(x => x.id === listeId);
  if (!l) return;
  const i = l.items.indexOf(stockId);
  if (i >= 0) l.items.splice(i, 1);
  else l.items.push(stockId);
  saveState();
}
/* Listes contenant CE stock précis — utilisé par le sélecteur "Ajouter à
   une liste" sur la fiche pour cocher les cases déjà vraies, jamais
   recalculé à la main ailleurs. */
const listesAvec = (stockId) => state.lists.filter(l => l.items.includes(stockId));

function pushRecent(label){
  state.recent = [label, ...state.recent.filter(x => x !== label)].slice(0, 5);
  saveState();
}
function clearRecent(){ state.recent = []; saveState(); toast('Historique de recherche effacé'); }

/* Chaque position achetée reste visible même si sa cotation est
   momentanément indisponible : une quote manquante est un état runtime
   temporaire, pas une preuve que la position n'existe plus (voir position
   vs valorisation). Seules les positions dont le prix est connu contribuent
   à `value`/`gain` ; les autres apparaissent avec priceAvailable:false et un
   état "cours indisponible" plutôt que de disparaître silencieusement. */
/* Formules (voir cahier des charges) — costBasis/marketValue/unrealizedPnL
   sont des ALIAS explicites de cost/value/gain ci-dessous (mêmes valeurs,
   deux noms) : cost/value/gain restent le nom historique utilisé par le
   reste du fichier, costBasis/marketValue/unrealizedPnL(Percent) le
   vocabulaire demandé, pour ne renommer nulle part ailleurs par prudence.
     costBasis          = quantité × prix moyen d'achat (PRU)
     marketValue         = quantité × cours actuel
     unrealizedPnL        = marketValue - costBasis
     unrealizedPnLPercent = unrealizedPnL / costBasis × 100 */
/* CORRECTIF (LOT I, 2026-09-24, préparation NovaBot) : paramètre `wallet`
   ajouté avec `state.wallet` en valeur par défaut — tous les appels
   existants (aucun ne passe d'argument) gardent exactement le même
   comportement. Permet de réutiliser cette même valorisation pour le
   portefeuille PAPIER isolé de NovaBot (state.novabot.wallet, voir
   novabotPortfolioValue()) sans dupliquer cette logique. */
function portfolioValue(wallet = state.wallet){
  let value = 0, cost = 0, unresolvedCount = 0;
  const lines = wallet.positions.map(pos => {
    const st = byId[pos.id];
    if (!st){
      unresolvedCount++;
      return { ...pos, stock:null, priceAvailable:false, cur:null,
        localValue:null, localCost:null, value:0, cost:0, gain:0, gainPct:0,
        costBasis:0, marketValue:0, unrealizedPnL:0, unrealizedPnLPercent:0 };
    }
    const cours = prixDe(st);
    if (cours === null){
      const localCost = pos.avg * pos.qty;
      return { ...pos, stock:st, priceAvailable:false, cur:st.cur,
        localValue:null, localCost, value:0, cost:0, gain:0, gainPct:0,
        costBasis:toEUR(localCost, st.cur), marketValue:0, unrealizedPnL:0, unrealizedPnLPercent:0 };
    }
    const localValue = cours * pos.qty;
    const localCost  = pos.avg  * pos.qty;
    const eurValue = toEUR(localValue, st.cur);
    const eurCost  = toEUR(localCost,  st.cur);
    value += eurValue; cost += eurCost;
    const gain = eurValue - eurCost;
    const gainPct = eurCost ? (eurValue/eurCost-1)*100 : 0;
    return { ...pos, stock:st, priceAvailable:true, localValue, localCost, cur:st.cur,
      value:eurValue, cost:eurCost, gain, gainPct,
      costBasis:eurCost, marketValue:eurValue, unrealizedPnL:gain, unrealizedPnLPercent:gainPct,
      fx: FX[st.cur] };
  });
  const total = value + wallet.cash;
  const invested = cost + wallet.cash;
  const gain = total - invested;
  const realizedPnL = Number.isFinite(wallet.realizedPnL) ? wallet.realizedPnL : 0;
  const netDeposits = Number.isFinite(wallet.invested) ? wallet.invested : null;
  return { lines, value, cost, total, cash:wallet.cash, invested,
    unresolvedCount,
    gain, gainPct: invested > 0 ? (gain / invested) * 100 : 0,
    /* unrealizedPnL du portefeuille = somme des unrealizedPnL de chaque
       position = value - cost (cash exclu : les liquidités ne gagnent ni ne
       perdent). realizedPnL = cumul des ventes déjà exécutées (voir
       sellStock()). Le gain "depuis l'ouverture" du portefeuille (comparé à
       netDeposits) est réalisé + latent, jamais l'un sans l'autre. */
    unrealizedPnL: gain,
    unrealizedPnLPercent: cost > 0 ? (gain / cost) * 100 : (invested > 0 ? (gain / invested) * 100 : 0),
    realizedPnL,
    netDeposits,
  };
}

/* Nombre maximal de points conservés dans l'historique du portefeuille —
   même logique de garde-fou que MAX_HISTORY_POINTS/joursHistorique côté
   marché : borne large (≈13 ans de relevés quotidiens), jamais atteinte en
   usage normal, purge les plus anciens plutôt que de planter. */
const MAX_WALLET_SNAPSHOTS = 5000;

/* Enregistre un point RÉEL de l'historique du portefeuille — jamais de
   valeur reconstituée pour le passé. Appelé après chaque achat/vente (voir
   buyStock/sellStock) et une fois par jour au plus lors de la consultation
   de la page Portefeuille (voir PAGES.portfolio) : ce n'est pas un minuteur
   qui tourne en arrière-plan, seulement une garde "un point par jour déjà
   là ?" posée à chaque affichage réel de la page. */
function snapshotPortfolio(reason){
  const pf = portfolioValue();
  state.walletHistory.push({
    t: Date.now(),
    totalValue: pf.total,
    cash: pf.cash,
    investedValue: pf.value,
    netDeposits: pf.netDeposits,
    unrealizedPnL: pf.unrealizedPnL,
    realizedPnL: pf.realizedPnL,
    reason,
  });
  if (state.walletHistory.length > MAX_WALLET_SNAPSHOTS){
    state.walletHistory.splice(0, state.walletHistory.length - MAX_WALLET_SNAPSHOTS);
  }
}

/* Ajoute un relevé quotidien si celui d'aujourd'hui (heure locale) n'existe
   pas déjà — appelée à l'affichage de la page Portefeuille, jamais par un
   minuteur. Si l'historique est totalement vide (portefeuille déjà actif
   avant l'introduction de cette fonctionnalité, ou première visite de la
   page avant tout achat), ce premier appel POSE le point de départ
   aujourd'hui — jamais un passé reconstitué : "MAX" commencera simplement à
   cet instant, conformément à la consigne de ne rien antidater. */
function assurerRelevéQuotidien(){
  const aujourdHui = new Date().toDateString();
  const dernier = state.walletHistory[state.walletHistory.length - 1];
  if (dernier && new Date(dernier.t).toDateString() === aujourdHui) return;
  snapshotPortfolio(dernier ? 'daily' : 'first');
  saveState();
  /* Le HTML déjà produit par ce même render() utilisait l'ancien
     walletHistory (un point manquant) : un second passage l'affiche
     immédiatement, sur le même modèle que chargerGraphique()/
     chargerFondamentaux() ailleurs dans ce fichier. Aucune boucle possible :
     au second passage, le relevé du jour existe déjà et la garde ci-dessus
     retourne aussitôt. */
  render();
}

function strengths(st){
  return COMPONENTS.filter(c => st.scores[c.key] !== null && st.scores[c.key] !== undefined && st.scores[c.key] >= 62)
    .sort((a,b) => st.scores[b.key]*b.weight - st.scores[a.key]*a.weight)
    .slice(0,3)
    .map(c => `<b>${esc(c.label)}</b> — ${esc(measureText(st, c.key))} (${st.scores[c.key]}/100)`);
}
function weaknesses(st){
  return COMPONENTS.filter(c => st.scores[c.key] !== null && st.scores[c.key] !== undefined && st.scores[c.key] <= 46)
    .sort((a,b) => st.scores[a.key]*a.weight - st.scores[b.key]*b.weight)
    .slice(0,3)
    .map(c => `<b>${esc(c.label)}</b> — ${esc(measureText(st, c.key))} (${st.scores[c.key]}/100)`);
}
/* Capitalisation : les fournisseurs ne renvoient pas la même unité pour
   marketCap (confirmé : Finnhub renvoie des MILLIONS de dollars — ex.
   3 680 323 pour MSFT = 3 680,3 Md $ — alors qu'EODHD renvoie généralement
   une valeur absolue). Conversion adaptée à la source réellement reçue ;
   à terme, cette normalisation devrait se faire côté backend (_providers.js)
   pour qu'une seule unité soit renvoyée quelle que soit la source. */
function capEnMilliards(marketCap, source){
  if (!Number.isFinite(marketCap)) return null;
  if (source === 'finnhub') return marketCap / 1000;       // millions -> milliards
  return marketCap / 1e9;                                   // valeur absolue supposée (EODHD) -> milliards
}

/* Croissance annuelle simple à partir d'une série réelle (revenueSeries /
   epsSeries, telles que renvoyées par EODHD : [{date, annee, valeur}, ...]).
   Ne calcule QUE si deux exercices réellement consécutifs existent — jamais
   d'estimation. Finnhub ne fournit actuellement aucune de ces séries
   (revenueSeries/epsSeries valent null dans son payload confirmé) : la
   croissance reste donc "—" pour toute société dont les fondamentaux
   viennent de Finnhub, ce qui est honnête plutôt qu'inventé. */
function croissanceSerie(serie){
  if (!Array.isArray(serie)) return null;
  const valides = serie
    .filter(x => x && Number.isInteger(x.annee) && Number.isFinite(x.valeur))
    .sort((a, b) => b.annee - a.annee);
  if (valides.length < 2) return null;
  const [recent, precedent] = valides;
  if (recent.annee - precedent.annee !== 1) return null;
  if (precedent.valeur === 0) return null;
  return (recent.valeur - precedent.valeur) / precedent.valeur * 100;
}

/* Noms de champs alignés sur le contrat réel confirmé (test MSFT, via
   Finnhub) : profitMargin/operatingMargin/roe sont des ratios décimaux
   (0.3322 = 33,22 %) ; pe est un multiplicateur ; marketCap nécessite
   capEnMilliards(). dividendYield n'est PAS multiplié par 100 : Finnhub le
   renvoie déjà en points de pourcentage (ex. 0.79485 = 0,79 %, un rendement
   réaliste pour MSFT) — à confirmer/normaliser côté backend si un autre
   provider utilisait une unité différente. */
function measureText(st, key){
  const f = st.fundamentals;
  if (!f) return '';
  switch(key){
    case 'quality':    return Number.isFinite(f.profitMargin) ? `marge nette de ${fmt.pctRatio(f.profitMargin)}` : '';
    case 'growth':     { const g = croissanceSerie(f.revenueSeries); return g !== null ? `chiffre d'affaires ${g > 0 ? '+' : ''}${fmt.num(g,1)} %` : ''; }
    case 'profit':     return Number.isFinite(f.roe) ? `ROE de ${fmt.pctRatio(f.roe)}` : '';
    case 'valuation':  return Number.isFinite(f.pe) ? `PER de ${fmt.mult(f.pe)}` : '';
    default: return '';
  }
}
function plainFundamentals(st){
  const f = st.fundamentals;
  if (!f) return '';
  const bits = [];
  if (Number.isFinite(f.profitMargin)) bits.push(`sur 100 € de ventes, il reste environ ${Math.round(f.profitMargin * 100)} € de bénéfice net`);
  if (Number.isFinite(f.pe)) bits.push(`vous payez ${Math.round(f.pe)} années de bénéfices au cours actuel`);
  if (Number.isFinite(f.roe)) bits.push(`l'entreprise dégage ${fmt.pctRatio(f.roe)} de rentabilité sur les capitaux propres`);
  return bits.length ? esc(bits.join(' ; ')) + '.' : '';
}

const GLOSSARY = {
  'PER':{ court:"Le PER indique combien vous payez pour 1 € de bénéfice annuel de l'entreprise.",
    long:"Un PER de 20 signifie qu'au cours actuel, vous payez vingt années de bénéfices. Un PER élevé traduit des attentes de croissance fortes : si elles déçoivent, le cours corrige souvent brutalement. Un PER très bas n'est pas forcément une bonne affaire, il signale parfois un problème." },
  'ROE':{ court:"Le ROE mesure ce que l'entreprise gagne rapporté à l'argent confié par ses actionnaires.",
    long:"Un ROE de 15 % signifie que pour 100 € de capitaux propres, l'entreprise dégage 15 € de bénéfice annuel. Attention : un ROE élevé peut aussi venir d'un fort endettement plutôt que d'une vraie performance." },
  'Marge':{ court:"La marge opérationnelle, c'est ce qui reste sur 100 € de ventes après les coûts d'exploitation.",
    long:"Elle mesure l'efficacité du modèle économique. Les marges varient énormément d'un secteur à l'autre : comparer une marge de distribution à une marge de logiciel n'a pas de sens." },
  'BPA':{ court:"Le bénéfice par action, c'est le bénéfice total divisé par le nombre d'actions.",
    long:"Sa croissance est plus instable que celle du chiffre d'affaires, car elle dépend aussi des rachats d'actions et d'éléments exceptionnels." },
  'Dette':{ court:"La dette rapportée aux fonds propres montre à quel point l'entreprise dépend de ses créanciers.",
    long:"Au-delà de 100 %, l'entreprise doit plus qu'elle ne possède en propre. Ce n'est pas anormal dans certains secteurs comme la banque ou l'industrie lourde, mais cela réduit la marge de manœuvre en cas de retournement." },
  'Volatilité':{ court:"La volatilité mesure l'amplitude des variations du cours.",
    long:"Une volatilité de 30 % par an signifie que le cours s'écarte typiquement de 30 % de sa moyenne sur un an. Elle décrit le passé et ne prédit pas les mouvements futurs." },
  'Momentum':{ court:"Le momentum, c'est la tendance récente du cours.",
    long:"C'est la composante la moins pondérée du Nova Score, volontairement : une bonne tendance passée ne garantit rien pour la suite." },
  'Régularité':{ court:"La régularité mesure la constance de la progression d'un mois à l'autre.",
    long:"Une hausse régulière est généralement mieux supportée qu'une hausse concentrée sur quelques séances suivie de longues baisses." },
  'Capitalisation':{ court:"La capitalisation, c'est la valeur totale de l'entreprise en Bourse.",
    long:"Elle se calcule en multipliant le cours par le nombre d'actions. Les grandes capitalisations sont généralement moins volatiles que les petites." },
  'Dividende':{ court:"Le dividende est la part du bénéfice reversée chaque année aux actionnaires.",
    long:"Un rendement élevé peut être attractif, mais il traduit parfois un cours qui a beaucoup baissé plutôt qu'une générosité particulière." },
  'Couverture':{ court:"La couverture indique la part des composantes du score réellement calculables.",
    long:"En dessous de 40 %, aucun score n'est publié. Entre 40 et 70 %, le score est marqué partiel : il n'est pas comparable à un score complet." },
  'Nova Score':{ court:"Un indice de 0 à 100 qui résume la solidité financière et le risque mesurés.",
    long:"Il additionne huit composantes pondérées, calculées à partir de données observables. Il ne prédit pas l'évolution du cours : une note élevée signifie « solide sur les critères mesurés », pas « action qui va monter »." },
  /* Ajout (audit "glossaire incomplet", 2026-09-17) : ces 5 termes ont un
     bouton "?" (infoBtn) sur la fiche action depuis l'ajout des champs
     week52High/beta/avgVolume3M/currentRatio/priceToSales plus tôt cette
     session, mais aucune entrée correspondante n'existait ici — cliquer
     dessus affichait "Aucune explication disponible", contraire au §45
     du PRD (le mode débutant doit pouvoir tout expliquer). */
  '52 semaines':{ court:"Le plus haut et le plus bas atteints par le cours au cours des douze derniers mois.",
    long:"Un cours proche de son plus haut annuel peut signaler une dynamique forte ou une valorisation tendue selon le contexte ; proche de son plus bas, l'inverse. Ni l'un ni l'autre ne prédit la suite." },
  'Bêta':{ court:"Le bêta mesure la sensibilité du cours aux mouvements du marché dans son ensemble.",
    long:"Un bêta de 1 signifie que le titre bouge en moyenne comme le marché. Au-dessus de 1, il amplifie les mouvements (à la hausse comme à la baisse) ; en dessous, il les atténue. C'est une mesure historique, pas une garantie de comportement futur." },
  'Volume':{ court:"Le volume, c'est le nombre d'actions échangées sur une période donnée.",
    long:"Un volume élevé signifie que beaucoup d'acheteurs et de vendeurs sont actifs sur le titre : les ordres s'exécutent plus facilement, à un prix plus proche du cours affiché. Un volume très faible peut rendre l'achat ou la vente plus difficile sans faire bouger le cours." },
  'Liquidité':{ court:"Le ratio de liquidité générale compare ce que l'entreprise possède à court terme à ce qu'elle doit à court terme.",
    long:"Un ratio supérieur à 1 signifie que l'entreprise peut a priori couvrir ses dettes à moins d'un an avec ses actifs les plus rapidement mobilisables. En dessous de 1, elle pourrait avoir besoin de financement supplémentaire pour y faire face." },
  'PSR':{ court:"Le PSR (prix / chiffre d'affaires) indique combien vous payez pour 1 € de ventes annuelles de l'entreprise.",
    long:"Utile pour comparer des entreprises qui ne sont pas encore rentables (où le PER n'a pas de sens). Un PSR élevé suppose des attentes fortes sur la capacité future à transformer ces ventes en bénéfices." },
};

/* Diagnostic manuel (console : runNovaTests()). Les anciennes assertions
   portant sur consensus()/aiAnalyses() ont été retirées : ces fonctions
   appartenaient au sous-système de "consensus multi-IA" simulé côté client
   qui a disparu avec le bloc de code manquant, et ne doivent de toute façon
   pas être recréées côté frontend (le NovaScore et l'analyse doivent venir
   du serveur, jamais d'une simulation locale). */
function runNovaTests(){
  const results = [];
  const ok = (name, cond, detail='') => results.push({ name, pass:Boolean(cond), detail });

  ok('les poids somment à 100', WEIGHT_TOTAL === 100, 'total = ' + WEIGHT_TOTAL);
  ok('tous les scores sont dans 0-100 ou null',
    stocks.every(s => s.score === null || (s.score >= 0 && s.score <= 100)));
  ok('les composantes absentes valent null, jamais 0',
    stocks.every(s => COMPONENTS.every(c => s.scores[c.key] === null || s.scores[c.key] === undefined || s.scores[c.key] > 0)));

  ok('conversion USD vers EUR', Math.abs(toEUR(100, 'USD') - 92) < 0.01);
  ok('la devise EUR reste inchangée', toEUR(100, 'EUR') === 100);
  const pf = portfolioValue();
  ok('le portefeuille additionne des euros', pf.lines.every(l => l.value === toEUR(l.localValue, l.cur)));
  ok('la valeur totale inclut les liquidités', Math.abs(pf.total - (pf.value + pf.cash)) < 0.01);

  const snapshot = [...state.watchlist];
  state.watchlist.length = 0;
  toggleWatch('AAPL-NAS'); const added = state.watchlist.length === 1;
  toggleWatch('AAPL-NAS'); const removed = state.watchlist.length === 0;
  state.watchlist.push(...snapshot);
  ok('la watchlist ajoute puis retire', added && removed);

  ok('areaChart ne plante pas sur un tableau vide', areaChart([]) === '');
  ok('areaChart ne plante pas sur un seul point', areaChart([100]) === '');
  ok('spark ne plante pas sur des NaN', spark([100, NaN, 102]) === '');

  const passed = results.filter(r => r.pass).length;
  console.group(`NovaTitre — tests internes : ${passed}/${results.length}`);
  results.forEach(r => console[r.pass ? 'log' : 'error'](
    `${r.pass ? '✔' : '✘'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  console.groupEnd();
  return { passed, total:results.length, results };
}
window.runNovaTests = runNovaTests;

const arrow = (v) => v > 0 ? '▲' : v < 0 ? '▼' : '■';
function absChange(st){
  const q = QUOTES.get(st.id);
  if (!q || !Number.isFinite(q.price) || !Number.isFinite(q.changePercent)) return '—';
  const prev = q.price / (1 + q.changePercent/100);
  const d = q.price - prev;
  return (d >= 0 ? '+' : '−') + fmt.num(Math.abs(d)) + ' ' + (CUR_SYMBOL[st.cur] || st.cur);
}
const trendTxt = (v,d=2) => Number.isFinite(v) ? `${arrow(v)} ${fmt.pct(v,d)}` : '—';

/* Cours réellement reçu du serveur pour cette valeur, ou null. Number.isFinite
   exclut aussi NaN et +/-Infinity, qu'un simple test "> 0" laisserait passer
   (Infinity > 0 est vrai). Aucun achat/valorisation ne peut se faire sur un
   prix qui n'existe pas ou n'est pas fini. */
function prixDe(st){
  const q = st && QUOTES.get(st.id);
  return q && Number.isFinite(q.price) && q.price > 0 ? q.price : null;
}

/* Identifiant local simple. Depuis la persistance serveur du portefeuille
   (2026-09-24, LOT D — voir pushPortfolio()/syncPortfolio() plus bas), cet
   id EST envoyé au serveur : il sert de clé d'upsert idempotente pour
   portfolio_transactions (api/me.js, resource=portfolio), pas seulement
   d'identifiant local — même schéma que creerListe() plus haut, réutilisé
   par simplicité (collision négligeable, et de toute façon scopée par
   utilisateur côté base). */
function enregistrerTransaction(entree){
  state.transactions.push({ id: 'tx' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(), ...entree });
  pushPortfolio();
}

/* Reconstruit cash/positions/realizedPnL depuis ZÉRO en rejouant un journal
   de transactions dans l'ordre chronologique — même arithmétique que
   buyStock()/sellStock() (coût moyen pondéré), mais à partir du qty/prix
   DÉJÀ figés de chaque transaction passée (jamais recalculés depuis un
   cours actuel, contrairement à un achat en direct). Utilisée uniquement
   par syncPortfolio() pour fusionner l'historique local avec celui reçu du
   serveur (ex. nouvel appareil) — jamais appelée pendant un achat/vente
   normal, qui continue de passer par buyStock()/sellStock() ci-dessous. */
function rejouerTransactions(transactions){
  const wallet = { cash: DEFAULT_STATE.wallet.cash, invested: DEFAULT_STATE.wallet.invested, positions: [], realizedPnL: 0 };
  const triees = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const tx of triees){
    if (tx.type === 'buy'){
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos){
        const totalQty = pos.qty + tx.qty;
        pos.avg = ((pos.avg * pos.qty) + (tx.priceLocal * tx.qty)) / totalQty;
        pos.qty = totalQty;
      } else {
        wallet.positions.push({ id: tx.stockId, qty: tx.qty, avg: tx.priceLocal });
      }
      wallet.cash -= tx.amountEUR;
    } else if (tx.type === 'sell'){
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos){
        pos.qty -= tx.qty;
        if (pos.qty <= 0.0001) wallet.positions = wallet.positions.filter(p => p.id !== tx.stockId);
      }
      wallet.cash += tx.amountEUR;
      if (Number.isFinite(tx.realizedGain)) wallet.realizedPnL += tx.realizedGain;
    } else if (tx.type === 'deposit'){
      /* §35 du prompt maître NovaTitre : un dépôt est un flux de trésorerie
         apporté par l'utilisateur, jamais une performance — augmente le
         cash ET le capital net apporté (netDeposits/wallet.invested) à
         parts égales, pour que portfolioValue() continue de pouvoir
         distinguer gain réel et argent simplement déposé (§36). */
      wallet.cash += tx.amountEUR;
      wallet.invested += tx.amountEUR;
    } else if (tx.type === 'withdraw'){
      wallet.cash -= tx.amountEUR;
      wallet.invested -= tx.amountEUR;
    } else if (tx.type === 'fee'){
      /* Un frais est un COÛT, pas un retrait voulu par l'utilisateur : sort
         du cash uniquement, jamais du capital net apporté (le faire
         sortirait aussi de netDeposits ferait disparaître le coût de la
         mesure de performance au lieu de l'y faire apparaître comme une
         perte, voir §36). */
      wallet.cash -= tx.amountEUR;
    }
  }
  return wallet;
}

/* Envoie tout l'historique local (transactions + relevés) vers le serveur —
   jamais un diff, l'upsert (id pour les transactions, user_id+occurred_at
   pour les relevés, voir sql/2026-09-24_portfolio_persistence.sql) rend
   l'opération idempotente. Silencieuse en cas d'échec (hors-ligne, non
   connecté...) : le prochain achat/vente ou la prochaine connexion
   réessaiera, la copie locale reste toujours la référence immédiate. */
async function pushPortfolio(){
  if (!sbClient || state.auth.status !== 'authenticated') return;
  try {
    await authFetch('/api/me?resource=portfolio', { method:'POST',
      body: JSON.stringify({ transactions: state.transactions, snapshots: state.walletHistory }) });
  } catch (e){ console.warn('[portfolio] envoi impossible :', e); }
}

/* Appelée une fois après connexion (voir applySession()) : récupère
   l'historique serveur, le fusionne (dédoublonné par id/instant) avec
   l'historique local de CET appareil — utile si l'utilisateur avait déjà
   acheté/vendu ailleurs, ou si ce navigateur vient d'être vidé — puis
   rejoue le journal fusionné pour reconstruire cash/positions/realizedPnL.
   Termine en repoussant la fusion au serveur (couvre le cas d'un tout
   premier login avec un historique local jamais encore envoyé). */
async function syncPortfolio(){
  if (!sbClient || state.auth.status !== 'authenticated') return;
  try {
    const r = await authFetch('/api/me?resource=portfolio');
    if (!r.ok) return;
    const data = await r.json();
    const serverTx = Array.isArray(data.transactions) ? data.transactions : [];
    const serverSnap = Array.isArray(data.snapshots) ? data.snapshots : [];
    if (!serverTx.length && !serverSnap.length && !state.transactions.length){
      return; // rien à fusionner, pousse simplement l'historique local (vide) au premier login
    }

    const txById = new Map();
    for (const tx of state.transactions) txById.set(tx.id, tx);
    for (const tx of serverTx) txById.set(tx.id, tx);
    state.transactions = [...txById.values()].sort((a, b) => new Date(a.date) - new Date(b.date));

    const snapByT = new Map();
    for (const s of state.walletHistory) snapByT.set(s.t, s);
    for (const s of serverSnap) snapByT.set(s.t, s);
    state.walletHistory = [...snapByT.values()].sort((a, b) => a.t - b.t);

    const rejoue = rejouerTransactions(state.transactions);
    state.wallet.cash = rejoue.cash;
    state.wallet.invested = rejoue.invested;
    state.wallet.positions = rejoue.positions;
    state.wallet.realizedPnL = rejoue.realizedPnL;
    saveState();
    render();
  } catch (e){ console.warn('[portfolio] synchronisation impossible :', e); return; }
  pushPortfolio();
}

/* `these` (Nova Memory, §27, optionnel) : { reason, horizon } tel que saisi
   dans openBuyReview, ou null si l'utilisateur n'a rien renseigné. Jamais
   requis par cette fonction — un appel existant sans 3e argument continue
   de fonctionner exactement comme avant. */
function buyStock(id, amountEUR, these){
  const st = byId[id];
  if (!st) return { ok:false, msg:'Entreprise inconnue' };
  if (!(amountEUR > 0)) return { ok:false, msg:'Montant invalide' };
  if (amountEUR > state.wallet.cash) return { ok:false, msg:'Liquidités insuffisantes' };

  const prix = prixDe(st);
  if (prix === null) return { ok:false, msg:'Cours indisponible pour cette valeur' };
  const priceEUR = toEUR(prix, st.cur);
  const qty = amountEUR / priceEUR;
  if (!Number.isFinite(qty) || !(qty > 0)) return { ok:false, msg:'Quantité invalide' };
  const pos = state.wallet.positions.find(p => p.id === id);
  if (pos){
    const totalQty = pos.qty + qty;
    pos.avg = ((pos.avg * pos.qty) + (prix * qty)) / totalQty;
    pos.qty = totalQty;
  } else {
    state.wallet.positions.push({ id, qty, avg: prix });
  }
  state.wallet.cash -= amountEUR;
  snapshotPortfolio('buy');
  enregistrerTransaction({ stockId: id, ticker: st.ticker, name: st.name, type: 'buy',
    qty, priceLocal: prix, currency: st.cur, amountEUR,
    thesisReason: these?.reason || null, thesisHorizon: these?.horizon || null });
  /* Écriture immédiate (pas la version debouncée) : un achat ne doit jamais
     dépendre d'un setTimeout qui n'a pas eu le temps de se déclencher si
     l'utilisateur ferme l'app juste après — c'est la cause la plus probable
     de la perte de portefeuille constatée en production. */
  flushSaveState();
  return { ok:true, qty, msg:`${fmt.num(qty,2)} titre(s) de ${st.name} achetés` };
}
/* P&L réalisé, méthode du coût moyen pondéré (même PRU que buyStock ci-dessus
   utilise pour l'achat) : pour une vente PARTIELLE, seul le coût des titres
   RÉELLEMENT vendus sort du coût moyen — pos.avg ne change jamais lors d'une
   vente (seul un nouvel achat le recalcule), cohérent avec la méthode du coût
   moyen pondéré standard. */
function sellStock(id, part = 1){
  const i = state.wallet.positions.findIndex(p => p.id === id);
  if (i < 0) return { ok:false, msg:'Aucune position sur cette valeur' };
  const pos = state.wallet.positions[i], st = byId[id];
  const prix = prixDe(st);
  if (prix === null) return { ok:false, msg:'Cours indisponible : vente impossible' };
  const qty = pos.qty * Math.max(0, Math.min(1, part));
  if (!Number.isFinite(qty) || !(qty > 0)) return { ok:false, msg:'Quantité invalide' };
  const proceeds = toEUR(prix * qty, st.cur);
  const costBasisVendu = toEUR(pos.avg * qty, st.cur);
  const realizedGain = proceeds - costBasisVendu;
  pos.qty -= qty;
  if (pos.qty <= 0.0001) state.wallet.positions.splice(i, 1);
  state.wallet.cash += proceeds;
  state.wallet.realizedPnL = (Number.isFinite(state.wallet.realizedPnL) ? state.wallet.realizedPnL : 0) + realizedGain;
  snapshotPortfolio('sell');
  enregistrerTransaction({ stockId: id, ticker: st.ticker, name: st.name, type: 'sell',
    qty, priceLocal: prix, currency: st.cur, amountEUR: proceeds, realizedGain });
  flushSaveState();
  return { ok:true, msg:`Vente de ${fmt.num(qty,2)} titre(s) · ${fmt.eur(proceeds)} récupérés `
    + `· ${realizedGain >= 0 ? 'gain réalisé de ' + fmt.eur(realizedGain) : 'perte réalisée de ' + fmt.eur(Math.abs(realizedGain))}`,
    realizedGain };
}
/* Dépôt/retrait/frais (§35 du prompt maître NovaTitre, 2026-10-05) : le
   portefeuille ne connaissait jusqu'ici que 'buy'/'sell' — tout capital de
   départ était une valeur fictive figée (DEFAULT_STATE.wallet), jamais un
   vrai flux saisi par l'utilisateur, ce qui empêchait de distinguer
   proprement performance et argent simplement apporté/retiré (§36). Même
   discipline que buyStock()/sellStock() : code déterministe, jamais de
   LLM dans ce calcul (§47), écriture immédiate via flushSaveState(). */
function depositCash(amountEUR){
  if (!(amountEUR > 0)) return { ok:false, msg:'Montant invalide' };
  state.wallet.cash += amountEUR;
  state.wallet.invested = (Number.isFinite(state.wallet.invested) ? state.wallet.invested : 0) + amountEUR;
  snapshotPortfolio('deposit');
  enregistrerTransaction({ type:'deposit', amountEUR });
  flushSaveState();
  return { ok:true, msg:`${fmt.eur(amountEUR)} déposés` };
}
function withdrawCash(amountEUR){
  if (!(amountEUR > 0)) return { ok:false, msg:'Montant invalide' };
  if (amountEUR > state.wallet.cash) return { ok:false, msg:'Liquidités insuffisantes' };
  state.wallet.cash -= amountEUR;
  state.wallet.invested = (Number.isFinite(state.wallet.invested) ? state.wallet.invested : 0) - amountEUR;
  snapshotPortfolio('withdraw');
  enregistrerTransaction({ type:'withdraw', amountEUR });
  flushSaveState();
  return { ok:true, msg:`${fmt.eur(amountEUR)} retirés` };
}
/* Un frais est un coût, jamais un flux voulu par l'utilisateur — ne touche
   jamais wallet.invested (voir la note correspondante dans
   rejouerTransactions() plus haut). Aucun déclencheur UI pour l'instant
   (aucun courtier réel connecté, voir §49 du prompt maître) : fonction et
   schéma prêts pour quand un frais réel (courtage, tenue de compte) devra
   être journalisé. */
function payFee(amountEUR, label){
  if (!(amountEUR > 0)) return { ok:false, msg:'Montant invalide' };
  if (amountEUR > state.wallet.cash) return { ok:false, msg:'Liquidités insuffisantes' };
  state.wallet.cash -= amountEUR;
  snapshotPortfolio('fee');
  enregistrerTransaction({ type:'fee', amountEUR, name: label || 'Frais' });
  flushSaveState();
  return { ok:true, msg:`${fmt.eur(amountEUR)} de frais enregistrés` };
}
const positionOf = (id) => state.wallet.positions.find(p => p.id === id) || null;

/* "Et si je n'avais rien fait ?" (§30 du PRD) : pour une transaction de
   VENTE réelle, compare ce qui a été effectivement récupéré (tx.amountEUR,
   déjà réalisé) à ce que vaudraient aujourd'hui les mêmes titres au cours
   ACTUEL, s'ils avaient été conservés. Renvoie null si le cours actuel de
   ce titre n'est plus disponible — jamais une estimation depuis un
   dernier prix connu périmé ou une extrapolation. Achats non concernés :
   la position existe toujours, "et si je n'avais rien fait" n'a de sens
   que pour un titre qu'on ne détient plus. */
function queSiRienFait(tx){
  if (!tx || tx.type !== 'sell') return null;
  const st = byId[tx.stockId];
  if (!st) return null;
  const prixActuel = prixDe(st);
  if (prixActuel === null) return null;
  const valeurAujourdhui = toEUR(prixActuel * tx.qty, st.cur);
  const difference = valeurAujourdhui - tx.amountEUR;
  return { valeurAujourdhui, montantRecu: tx.amountEUR, difference,
    differencePct: tx.amountEUR ? (difference / tx.amountEUR) * 100 : null };
}

/* ============================================================
   NOVA CORE — conversations (§4, §8, 2026-10-05)
   ------------------------------------------------------------
   "Une seule intelligence Nova [...] une mémoire commune." Socle partagé
   par tous les modules Nova (Review/NovaBot/News/Event/fiche action) —
   aucune de ces 4 fonctions n'est propre à un module en particulier,
   voir sql/2026-10-05_nova_core_conversations.sql. Même discipline que
   pushPortfolio()/syncPortfolio() plus haut : échec silencieux (hors
   ligne, non connecté...), jamais une exception qui casserait l'appelant
   — c'est à l'appelant de décider quoi faire d'un retour null.
   Portée minimale pour l'instant (§87) : créer, lister, charger, envoyer
   un message — aucun module réel ne les appelle encore dans cette passe,
   c'est le socle sur lequel le premier module Nova connecté à une vraie
   conversation (prochaine étape) s'appuiera.
   CORRECTIF (2026-10-05) : ces 4 fonctions appelaient d'abord un fichier
   dédié api/nova/conversations.js — déploiement en échec silencieux
   (build OK, mais échoue à l'étape "Deploying outputs", jamais une
   erreur de code) : le plan Vercel Hobby de ce projet plafonne à 12
   Fonctions Serverless par déploiement, exactement le compte déjà
   atteint sans ce fichier. Repliée dans /api/me?resource=conversations
   à la place (même fonction serverless existante que le portefeuille,
   voir handleNovaConversations() dans api/me.js) — zéro fonction
   supplémentaire, même logique, seule l'URL change ici. */
async function novaConversationCreer(moduleId, { title, context } = {}){
  if (!sbClient || state.auth.status !== 'authenticated') return null;
  try {
    const r = await authFetch('/api/me?resource=conversations', { method:'POST',
      body: JSON.stringify({ module: moduleId, title: title || null, context: context || null }) });
    if (!r.ok) return null;
    return await r.json(); // { id, createdAt, updatedAt }
  } catch (e){ console.warn('[nova] création conversation impossible :', e); return null; }
}
async function novaMessageEnvoyer(conversationId, role, content, metadata){
  if (!sbClient || state.auth.status !== 'authenticated') return null;
  try {
    const r = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(conversationId)}&action=message`,
      { method:'POST', body: JSON.stringify({ role, content, metadata: metadata || null }) });
    if (!r.ok) return null;
    return await r.json(); // { id, date }
  } catch (e){ console.warn('[nova] envoi message impossible :', e); return null; }
}
async function novaConversationsLister(){
  if (!sbClient || state.auth.status !== 'authenticated') return [];
  try {
    const r = await authFetch('/api/me?resource=conversations');
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.conversations) ? d.conversations : [];
  } catch (e){ console.warn('[nova] liste conversations impossible :', e); return []; }
}
async function novaConversationCharger(conversationId){
  if (!sbClient || state.auth.status !== 'authenticated') return null;
  try {
    const r = await authFetch(`/api/me?resource=conversations&id=${encodeURIComponent(conversationId)}`);
    if (!r.ok) return null;
    return await r.json(); // { id, module, title, context, messages:[...] }
  } catch (e){ console.warn('[nova] chargement conversation impossible :', e); return null; }
}

/* ============================================================
   NOVABOT — SIMULATION UNIQUEMENT (LOT I, Étape 3, 2026-09-24)
   ------------------------------------------------------------
   Aucun ordre réel sur les marchés, jamais. Portefeuille et journal
   ISOLÉS de state.wallet/state.transactions (voir DEFAULT_STATE.novabot
   pour la justification complète). N'agit QUE sur state.watchlist,
   jamais en tâche de fond côté serveur : évalué uniquement pendant que
   la page NovaBot est ouverte, sur demande explicite de l'utilisateur
   (bouton) — jamais un minuteur invisible qui continuerait à passer des
   ordres simulés hors de sa vue.
   ============================================================ */
const novabotPortfolioValue = () => portfolioValue(state.novabot.wallet);

/* Même principe exact que snapshotPortfolio()/assurerRelevéQuotidien()
   (portefeuille personnel, plus haut) — voir DEFAULT_STATE.novabot.
   walletHistory pour le contexte. Appelée à chaque mouvement de cash
   (novabotConfirmerMandat/novabotAjouterFonds/novabotRetirerFonds/
   novabotAcheter/novabotVendre) et au moins une fois par jour de visite
   de la page NovaBot (voir le hook route.page==='novabot', index.html). */
function novabotSnapshotPortfolio(reason){
  const pf = novabotPortfolioValue();
  state.novabot.walletHistory.push({
    t: Date.now(), totalValue: pf.total, cash: pf.cash, investedValue: pf.value,
    netDeposits: pf.netDeposits, unrealizedPnL: pf.unrealizedPnL, realizedPnL: pf.realizedPnL, reason,
  });
  if (state.novabot.walletHistory.length > MAX_WALLET_SNAPSHOTS){
    state.novabot.walletHistory.splice(0, state.novabot.walletHistory.length - MAX_WALLET_SNAPSHOTS);
  }
}
/* Courbe interactive (refonte UX, 2026-10-08, §5 : "1J/1S/1M/3M/1A/MAX")
   — même principe exact que walletHistoryPourPeriode()/fluxNetPeriode()
   (portefeuille personnel, js/page-watchlist.js), scopé à NovaBot. Liste
   de périodes volontairement différente (6 au lieu de 7 : pas de "6M",
   non demandé) — jamais réutilisé PF_PERIODS telle quelle pour ne pas
   lier les deux courbes à une même liste qui pourrait diverger plus tard. */
const NOVABOT_PF_PERIODS = ['1J','1S','1M','3M','1A','MAX'];
const NOVABOT_PF_PERIOD_MS = { '1J':86400000, '1S':7*86400000, '1M':30*86400000,
  '3M':90*86400000, '1A':365*86400000, MAX:Infinity };
function novabotWalletHistoryPourPeriode(period){
  const ms = NOVABOT_PF_PERIOD_MS[period] ?? NOVABOT_PF_PERIOD_MS['1A'];
  if (!Number.isFinite(ms)) return state.novabot.walletHistory;
  const cutoff = Date.now() - ms;
  return state.novabot.walletHistory.filter(p => p.t >= cutoff);
}
function novabotFluxNetPeriode(startMs, endMs){
  let net = 0;
  for (const tx of state.novabot.transactions){
    if (tx.type !== 'deposit' && tx.type !== 'withdraw') continue;
    const t = new Date(tx.date).getTime();
    if (!(t > startMs && t <= endMs)) continue;
    net += tx.type === 'deposit' ? tx.amountEUR : -tx.amountEUR;
  }
  return net;
}

function novabotAssurerReleveQuotidien(){
  const aujourdHui = new Date().toDateString();
  const dernier = state.novabot.walletHistory[state.novabot.walletHistory.length - 1];
  if (dernier && new Date(dernier.t).toDateString() === aujourdHui) return;
  novabotSnapshotPortfolio(dernier ? 'daily' : 'first');
  saveState();
  render();
}

/* NovaScore RÉEL, calculé gratuitement par /api/market/company (voir le
   champ additif `novaScore` ajouté dans api/market/company.js pour ce
   lot) — jamais le NovaScore payant d'/api/analyze (qui appelle un
   modèle de langage et consomme le quota d'analyses IA de
   l'utilisateur) : NovaBot ne doit jamais consommer ce quota tout seul,
   sans action explicite de l'utilisateur. Renvoie null si le moteur a
   refusé de noter (couverture de données insuffisante) — jamais une
   estimation. */
async function novaScoreDe(st){
  try {
    const exch = st.exchangeCode || MARKET_CODE[st.market] || '';
    const r = await fetch(`/api/market/company?ticker=${encodeURIComponent(st.ticker)}`
      + `&exchange=${encodeURIComponent(exch)}&type=${encodeURIComponent(st.type || 'stock')}`);
    if (!r.ok) return null;
    const d = await r.json();
    return Number.isFinite(d.novaScore?.score) ? d.novaScore.score : null;
  } catch { return null; }
}

/* Même endpoint gratuit que novaScoreDe() (UN seul appel réseau, jamais
   deux), mais garde le dossier complet (fondamentaux/identité) au lieu de
   n'en extraire que le score — tranche C, §9 : "NovaBot doit récupérer les
   données via les outils NovaTitre [...] puis seulement ensuite utiliser
   Nova Core pour raisonner sur ces données." Sert à la fois au filtre
   déterministe (score) ET, pour les candidats qui le franchissent, de
   contexte réel pour novabotRaisonnementIA() ci-dessous. */
async function novabotDonneesMarche(st){
  try {
    const exch = st.exchangeCode || MARKET_CODE[st.market] || '';
    const r = await fetch(`/api/market/company?ticker=${encodeURIComponent(st.ticker)}`
      + `&exchange=${encodeURIComponent(exch)}&type=${encodeURIComponent(st.type || 'stock')}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (!Number.isFinite(d.novaScore?.score)) return null;
    /* volatility/maxDrawdown/coverage/confidence (audit 2026-10-13,
       "calcul intelligent des montants investis") : réels, déjà calculés
       par le moteur NovaScore à partir de l'historique de prix (voir
       api/market/company.js, api/market/_novascore.js metriquesMarche())
       — jamais recalculés ni approximés ici, seulement transmis. null si
       l'historique est trop court pour un calcul fiable (<25 points),
       jamais une estimation de repli. */
    return { score: d.novaScore.score, fundamentals: d.fundamentals || null,
      volatility: d.novaScore.volatility, maxDrawdown: d.novaScore.maxDrawdown,
      coverage: d.novaScore.coverage, confidence: d.novaScore.confidence };
  } catch { return null; }
}

/* Appelle Nova Core (mode 'novabot', §12) pour un second avis qualitatif
   sur UN candidat ayant déjà franchi le seuil NovaScore déterministe.
   Consomme le quota d'analyses mensuel de l'utilisateur (même mécanisme
   que l'analyse d'une fiche action — voir la note d'api/analyze.js) :
   n'est appelée QUE si l'utilisateur a explicitement activé
   state.novabot.aiReasoning, et au plus NOVABOT_LLM_MAX fois par passage
   (voir evaluerNovaBot()). Ne lève JAMAIS : tout échec (quota épuisé,
   réseau, réponse illisible) renvoie null, et l'appelant retombe sur le
   comportement déterministe de la tranche B — jamais un passage NovaBot
   interrompu par une panne du modèle de langage. */
async function novabotRaisonnementIA(st, donnees, mandate, pf, prix){
  try {
    const r = await authFetch('/api/analyze', { method:'POST', body: JSON.stringify({
      mode:'novabot',
      candidate: { ticker:st.ticker, name:st.name, sector:st.sector, price:prix, currency:st.cur, novaScore:donnees.score, fundamentals:donnees.fundamentals },
      mandate: { cashMinPct:mandate.cashMinPct, maxPositionPct:mandate.maxPositionPct, maxPositionsCount:mandate.maxPositionsCount },
      portfolio: { cashPct: pf.total > 0 ? (state.novabot.wallet.cash / pf.total) * 100 : 100, numPositions: state.novabot.wallet.positions.length, totalValue: pf.total },
    })});
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.decision || !['buy','watch','reject'].includes(d.decision.action)) return null;
    return { ...d.decision, provider:d.provider, model:d.model };
  } catch (e){ console.warn('[novabot] raisonnement IA indisponible :', e); return null; }
}

/* Même arithmétique que buyStock()/sellStock() (coût moyen pondéré),
   mais écrite exclusivement dans state.novabot.wallet/transactions —
   jamais state.wallet/state.transactions. `motif` documente la règle
   utilisateur qui a déclenché la décision (transparence, §I du cahier
   des charges : "explications transparentes des décisions"). */
function novabotAcheter(id, montantEUR, prix, motif){
  const st = byId[id];
  if (!st) return;
  const priceEUR = toEUR(prix, st.cur);
  const qty = montantEUR / priceEUR;
  if (!Number.isFinite(qty) || !(qty > 0)) return;
  const w = state.novabot.wallet;
  const pos = w.positions.find(p => p.id === id);
  if (pos){
    const totalQty = pos.qty + qty;
    pos.avg = ((pos.avg * pos.qty) + (prix * qty)) / totalQty;
    pos.qty = totalQty;
  } else {
    w.positions.push({ id, qty, avg: prix });
  }
  w.cash -= montantEUR;
  state.novabot.transactions.push({ id:'nb'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    date:new Date().toISOString(), stockId:id, ticker:st.ticker, name:st.name, type:'buy',
    qty, priceLocal:prix, currency:st.cur, amountEUR:montantEUR, motif });
  novabotSnapshotPortfolio('buy');
  pushNovaBot();
}
function novabotVendre(id, prix, motif){
  const w = state.novabot.wallet;
  const i = w.positions.findIndex(p => p.id === id);
  if (i < 0) return;
  const pos = w.positions[i], st = byId[id];
  if (!st) return;
  const qty = pos.qty;
  const proceeds = toEUR(prix * qty, st.cur);
  const costBasis = toEUR(pos.avg * qty, st.cur);
  const realizedGain = proceeds - costBasis;
  w.positions.splice(i, 1);
  w.cash += proceeds;
  w.realizedPnL = (Number.isFinite(w.realizedPnL) ? w.realizedPnL : 0) + realizedGain;
  state.novabot.transactions.push({ id:'nb'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    date:new Date().toISOString(), stockId:id, ticker:st.ticker, name:st.name, type:'sell',
    qty, priceLocal:prix, currency:st.cur, amountEUR:proceeds, realizedGain, motif });
  novabotSnapshotPortfolio('sell');
  pushNovaBot();
}

/* ============================================================
   MANDATE ENGINE + RISK ENGINE (refonte fonctionnelle, tranche B,
   2026-10-08)
   ------------------------------------------------------------
   §12 du brief : "le LLM ne doit pas contrôler directement le
   portefeuille [...] chaque intention de transaction doit avoir un schéma
   structuré, puis le backend valide tout." Il n'y a pas encore de LLM
   (tranche C) — mais la porte existe déjà, pour que l'ajout de l'IA plus
   tard n'ait qu'à produire des `intent`, jamais à toucher wallet/
   transactions directement. novabotRiskCheck() est une fonction PURE
   (aucun accès réseau, aucune mutation) : seule porte par laquelle un
   achat peut s'exécuter. Ne vérifie QUE les hard rules (§3 : "une
   décision ne doit JAMAIS pouvoir violer une HARD RULE") — jamais une
   préférence, qui n'a pas vocation à bloquer quoi que ce soit ici. */
function novabotMandat(){
  const cfg = state.novabot;
  return {
    /* id (2026-10-15) : identité de la ligne novabot_mandates actuellement
       courante — jamais utilisée par novabotRiskCheck() ni le moteur de
       décision, UNIQUEMENT pour la vérification de concurrence optimiste
       avant une modification confirmée depuis le chat (voir
       novabotChatContexte(), js/novabot-chat.js). */
    id: cfg.mandateId || null,
    cashMinPct: cfg.cashMinPct,
    maxPositionPct: cfg.maxPositionPct,
    maxPositionsCount: Number.isFinite(cfg.maxPositionsCount) ? cfg.maxPositionsCount : null,
    hardRules: Array.isArray(cfg.hardRules) ? cfg.hardRules : [],
    preferences: Array.isArray(cfg.preferences) ? cfg.preferences : [],
    objective: cfg.objective || null,
    riskLevel: cfg.riskLevel || null,
    horizonYears: Number.isFinite(cfg.horizonYears) ? cfg.horizonYears : null,
  };
}
/* V6 §6 ("mémoire commune", "interface permettant de consulter, corriger
   et supprimer les souvenirs") : préférences NON contraignantes capturées
   en passant par Nova (voir novabotAppelerModeleEtRepondre(), d.newPreferences)
   — contrairement à hardRules/objective/etc., jamais besoin d'une
   confirmation explicite (non liant), mais TOUJOURS visible et supprimable
   par l'utilisateur (novabotSupprimerPreference ci-dessous). */
function novabotAjouterPreferences(nouvelles){
  if (!Array.isArray(nouvelles) || !nouvelles.length) return;
  const existantes = Array.isArray(state.novabot.preferences) ? state.novabot.preferences : [];
  const vus = new Set(existantes.map(p => (p.type + '|' + p.value).toLowerCase()));
  const ajoutees = [];
  for (const p of nouvelles){
    if (!p || typeof p.type !== 'string' || typeof p.value !== 'string' || !p.value.trim()) continue;
    const cle = (p.type + '|' + p.value).toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    ajoutees.push({ type:p.type, value:p.value.trim() });
  }
  if (!ajoutees.length) return;
  state.novabot.preferences = [...existantes, ...ajoutees];
  saveState();
  toast(`Nova a retenu : ${ajoutees.map(p => p.value).join(', ')}`);
}
function novabotSupprimerPreference(index){
  const existantes = Array.isArray(state.novabot.preferences) ? state.novabot.preferences : [];
  if (index < 0 || index >= existantes.length) return;
  state.novabot.preferences = existantes.filter((_, i) => i !== index);
  saveState();
  render();
}
function novabotSupprimerHardRule(index){
  const existantes = Array.isArray(state.novabot.hardRules) ? state.novabot.hardRules : [];
  if (index < 0 || index >= existantes.length) return;
  state.novabot.hardRules = existantes.filter((_, i) => i !== index);
  saveState();
  render();
  toast('Règle supprimée');
}
function novabotRiskCheck(intent, wallet, mandate){
  const violations = [];
  const pf = portfolioValue(wallet);

  const secteurInterdit = mandate.hardRules.find(r => r.type === 'excluded_sector' && r.value === intent.sector);
  if (secteurInterdit) violations.push({ type:'secteur_interdit', message:`Secteur "${intent.sector}" exclu par le mandat.` });

  const actifInterdit = mandate.hardRules.find(r => r.type === 'excluded_asset'
    && (r.value === intent.stockId || r.value === intent.ticker));
  if (actifInterdit) violations.push({ type:'actif_interdit', message:`${intent.ticker} exclu explicitement par le mandat.` });

  if (intent.action === 'buy'){
    if (intent.amountEUR > wallet.cash){
      violations.push({ type:'cash_insuffisant', message:'Liquidités simulées insuffisantes pour cet achat.' });
    } else {
      const cashApres = wallet.cash - intent.amountEUR;
      const cashMin = (mandate.cashMinPct / 100) * pf.total;
      if (cashApres < cashMin){
        violations.push({ type:'cash_min', message:`Ferait passer le cash sous le minimum du mandat (${mandate.cashMinPct} %).` });
      }
    }
    const posExistante = wallet.positions.find(p => p.id === intent.stockId);
    const valeurExistanteEUR = posExistante ? toEUR(posExistante.avg * posExistante.qty, intent.currency) : 0;
    const poidsApresPct = pf.total > 0 ? ((valeurExistanteEUR + intent.amountEUR) / pf.total) * 100 : 100;
    if (poidsApresPct > mandate.maxPositionPct + 1e-9){
      violations.push({ type:'position_max', message:`Dépasserait le maximum par position du mandat (${mandate.maxPositionPct} %).` });
    }
    if (!posExistante && mandate.maxPositionsCount !== null && wallet.positions.length >= mandate.maxPositionsCount){
      violations.push({ type:'positions_max_count', message:`Le mandat limite le portefeuille à ${mandate.maxPositionsCount} positions.` });
    }
  }

  return { allowed: violations.length === 0, violations };
}

/* Journal des décisions (§14) — enregistre localement (synchronisé par
   pushNovaBot() comme le reste de state.novabot) ; `d` porte déjà les
   clés attendues côté serveur (voir novabot_decisions, sql/2026-10-08_
   novabot_decisions.sql), la conversion snake_case se fait uniquement
   dans pushNovaBot(). */
function novabotEnregistrerDecision(d){
  const dec = { id:'nd'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    date:new Date().toISOString(), executionStatus:'simulated', ...d };
  state.novabot.decisions.push(dec);
  return dec;
}

/* Accepter/refuser une décision EN ATTENTE (§22, mode "conseil"/"semi-
   autonome") — geste explicite de l'utilisateur, jamais automatique.
   novabotAccepterDecision() REVALIDE via le Risk Engine avec l'état
   ACTUEL du portefeuille/du mandat avant d'exécuter : le temps écoulé
   depuis la proposition a pu changer le cash disponible ou le mandat
   lui-même — jamais un rejeu aveugle d'une décision devenue invalide
   entre-temps. */
function novabotAccepterDecision(id){
  const d = state.novabot.decisions.find(x => x.id === id);
  if (!d || d.executionStatus !== 'pending' || d.action !== 'buy') return { ok:false, msg:'Décision introuvable ou déjà traitée' };
  const st = byId[d.stockId];
  if (!st) return { ok:false, msg:'Entreprise introuvable dans le catalogue' };
  const prix = prixDe(st);
  if (prix === null) return { ok:false, msg:'Cours indisponible pour le moment' };
  const mandate = novabotMandat();
  const priceEUR = toEUR(prix, st.cur);
  const intent = { action:'buy', stockId:d.stockId, ticker:d.ticker, sector:st.sector,
    amountEUR:d.amountEUR, priceLocal:prix, currency:st.cur, qty:d.amountEUR / priceEUR };
  const verdict = novabotRiskCheck(intent, state.novabot.wallet, mandate);
  if (!verdict.allowed){
    d.executionStatus = 'rejected';
    d.reason += ` — Refusé à l'exécution (conditions changées) : ${verdict.violations.map(v => v.message).join(' ')}`;
    saveState(); pushNovaBot(); render();
    return { ok:false, msg:'Le Risk Engine refuse cette décision maintenant — les conditions ont changé depuis la proposition.' };
  }
  novabotAcheter(d.stockId, d.amountEUR, prix, d.reason);
  d.executionStatus = 'simulated';
  d.priceObserved = prix; // prix RÉEL d'exécution, jamais celui (plus ancien) de la proposition
  saveState(); pushNovaBot(); render();
  return { ok:true, msg:`Achat confirmé : ${fmt.eur(d.amountEUR)} sur ${d.name || d.ticker}` };
}
function novabotRefuserDecision(id){
  const d = state.novabot.decisions.find(x => x.id === id);
  if (!d || d.executionStatus !== 'pending') return;
  d.executionStatus = 'skipped';
  saveState(); pushNovaBot(); render();
}

/* 1. DISCOVERY (§8/§7) : "NovaBot ne doit surtout PAS analyser uniquement
   la watchlist [...] il doit pouvoir découvrir une entreprise que
   l'utilisateur n'a jamais ajoutée." Watchlist d'abord (comportement
   historique inchangé), puis un sous-ensemble BORNÉ du catalogue complet,
   filtré par les hard rules du mandat AVANT même d'être considéré (une
   entreprise d'un secteur exclu n'est pas un "candidat" qui serait ensuite
   rejeté — elle n'entre jamais dans la liste). Priorité aux titres ayant
   déjà un NovaScore connu (une analyse précédente, gratuite ou payante) :
   même budget réseau que l'existant, novaScoreDe() (gratuit) reste le seul
   appel fait PAR CANDIDAT plus bas, jamais plus de NOVABOT_DISCOVERY_MAX
   appels supplémentaires par passage — même discipline que
   LIVE_MAX_SYMBOLES ailleurs dans ce fichier. */
const NOVABOT_DISCOVERY_MAX = 20;
/* Borne les appels Nova Core (tranche C, §23/§24) : au plus ce nombre de
   candidats reçoivent un second avis IA par passage d'evaluerNovaBot(),
   quel que soit le nombre de candidats qui franchissent le seuil
   NovaScore — jamais un passage qui consommerait tout le quota mensuel
   d'un plan Découverte (5 analyses) d'un coup. */
const NOVABOT_LLM_MAX = 3;
/* CORRECTIF (audit NovaBot V7, 2026-10-12, §3 — bug confirmé par capture
   d'écran : "dizaines de lignes similaires Refusé pour risque — Alphabet
   Inc. — 500€" sur un portefeuille de 500€) : cfg.tradeAmountEUR (500€
   par défaut, montant FIXE par achat) était utilisé tel quel comme
   montant de l'intention d'achat, sans jamais être réduit pour respecter
   la réserve de liquidités du mandat (cashMinPct) ni le maximum par
   position (maxPositionPct) — le Risk Engine ne faisait que REJETER
   après coup un montant déjà voué à l'échec. Avec un portefeuille DE LA
   TAILLE du montant par défaut (500€ cash = 500€ tradeAmountEUR) et
   n'importe quelle réserve minimale > 0 %, CHAQUE tentative d'achat
   dépense 100% du cash, ce qui viole TOUJOURS la réserve — un rejet
   mathématiquement garanti, identique à chaque passage, pour n'importe
   quel candidat. MONTANT_MIN_INVESTISSABLE : en dessous, une "position"
   serait dérisoire (quelques centimes) — on considère qu'il n'y a plus
   rien d'investissable plutôt que de proposer un montant symbolique. */
const NOVABOT_MONTANT_MIN_INVESTISSABLE = 5;

/* ============================================================
   POSITION SIZING ENGINE (audit 2026-10-13, "calcul intelligent des
   montants investis")

   PROBLÈME SIGNALÉ : NovaBot a investi exactement 75€ dans Apple,
   Microsoft, Nvidia, Alphabet ET ASML — la même somme partout.

   AUDIT (étape 1 demandée) — origine EXACTE confirmée par le calcul :
   75 = 15% × 500. Ce n'est PAS une valeur codée en dur : c'est
   montantInvestissableServeur()/le calcul équivalent ci-dessous
   (correctif du 2026-10-12, voir plus haut) appliquant SES TROIS bornes
   — cfg.tradeAmountEUR (500€), le cash disponible (~450€), et
   mandate.maxPositionPct (15% × 500€ = 75€ pour CHAQUE nouvelle ligne,
   puisqu'aucune des deux n'a de position existante et que le total du
   portefeuille reste ~constant d'un candidat à l'autre dans le même
   passage). La borne la plus stricte était TOUJOURS le plafond par
   position, IDENTIQUE pour tout candidat qui le franchit — le calcul
   fonctionnait exactement comme conçu, mais sa conception ne faisait
   AUCUNE différence entre les candidats au-delà de ce plafond uniforme.
   Ce n'est donc pas un bug au sens d'un calcul faux : c'est l'absence
   du moteur demandé ici.

   PRINCIPE : le plafond par position (mandat) reste la limite ABSOLUE,
   jamais dépassée. À l'intérieur de cette limite, le montant RÉELLEMENT
   proposé varie selon deux facteurs, tous deux dérivés de données
   RÉELLEMENT mesurées (jamais une estimation inventée) :
     - qualité de l'opportunité : NovaScore, déjà déterministe et
       traçable (api/market/_novascore.js) ;
     - risque propre à l'instrument : volatilité annualisée + drawdown
       maximum, réellement calculés par ce même moteur à partir de
       l'historique de prix (novabotDonneesMarche() les transmet
       maintenant, voir plus haut) — null si l'historique est trop
       court, JAMAIS remplacé par une supposition.
   Liquidité, corrélations inter-actions : non calculées ici — aucune
   donnée de volume ni de séries de rendements appariées n'est
   actuellement disponible côté NovaBot pour les mesurer réellement ;
   limitation assumée et documentée plutôt qu'une valeur inventée pour
   remplir la case. Concentration sectorielle : calculée (voir
   novabotPlafondSecteur ci-dessous), à partir des positions RÉELLES du
   portefeuille. */

/* Mêmes seuils EXACTEMENT que SCALES.volatility/SCALES.maxDrawdown et la
   même interpolation linéaire que bareme() dans api/market/_novascore.js
   — jamais une nouvelle échelle inventée côté client : la volatilité et
   le drawdown doivent se lire de la même façon partout dans l'app. Ces
   deux fichiers doivent rester synchronisés manuellement (même
   compromis assumé que _novabotEngine.js, voir son grand commentaire
   d'en-tête) : _novascore.js est un module serveur, non importable
   depuis le navigateur. */
const NOVABOT_ECHELLE_VOLATILITE = [[0.12,100],[0.20,78],[0.30,52],[0.42,25],[0.55,0]];
const NOVABOT_ECHELLE_DRAWDOWN   = [[0.08,100],[0.18,75],[0.30,48],[0.45,20],[0.60,0]];
function novabotBareme(points, v){
  if (!Number.isFinite(v)) return null;
  if (v <= points[0][0]) return points[0][1];
  if (v >= points[points.length-1][0]) return points[points.length-1][1];
  for (let i = 1; i < points.length; i++){
    if (v <= points[i][0]){
      const [x0,y0] = points[i-1], [x1,y1] = points[i];
      return Math.round(y0 + ((v-x0)/(x1-x0)) * (y1-y0));
    }
  }
  return null;
}
/* Score de risque 0-100 (100 = le plus stable) : moyenne des deux
   signaux disponibles. Si UN SEUL est disponible, la moyenne porte sur
   celui-là seul (jamais un null pollue la moyenne). Si AUCUN n'est
   disponible (historique trop court), renvoie null — l'appelant traite
   explicitement ce cas comme une INCERTITUDE, jamais comme "risque
   neutre" par optimisme. */
function novabotScoreRisque(donnees){
  const notes = [novabotBareme(NOVABOT_ECHELLE_VOLATILITE, donnees.volatility),
    novabotBareme(NOVABOT_ECHELLE_DRAWDOWN, donnees.maxDrawdown)].filter(n => n !== null);
  return notes.length ? Math.round(notes.reduce((a,b) => a+b, 0) / notes.length) : null;
}
/* Exposition sectorielle actuelle (valeur de marché des positions du
   même secteur que le candidat) — données RÉELLES du portefeuille,
   jamais une estimation. */
function novabotExpositionSecteur(wallet, secteur){
  if (!secteur) return 0;
  return wallet.positions.reduce((somme, pos) => {
    const st = byId[pos.id];
    if (!st || st.sector !== secteur) return somme;
    const cours = prixDe(st);
    return somme + (cours !== null ? toEUR(cours * pos.qty, st.cur) : toEUR(pos.avg * pos.qty, st.cur));
  }, 0);
}
/* FACTEUR_SECTEUR : un secteur dans son ensemble peut peser jusqu'à 2,5×
   le plafond d'UNE SEULE position — hypothèse de diversification
   raisonnable et documentée (jamais demandée en valeur exacte par
   l'utilisateur, donc explicitée ici plutôt que silencieuse), pas une
   limite réglementaire. Avec maxPositionPct=15%, un secteur plafonne
   donc à 37,5% du portefeuille — large mais empêche la concentration
   totale sur un seul secteur. */
const NOVABOT_FACTEUR_SECTEUR = 2.5;
/* PLANCHER_ALLOCATION : même un candidat tout juste au-dessus du seuil
   NovaScore (score == cfg.scoreAchat) et au risque inconnu reçoit encore
   40% du plafond théorique — l'opportunité a déjà été jugée valable pour
   être examinée (elle a franchi le seuil), un montant quasi nul serait
   une décision "achat" en apparence mais sans substance réelle. Au-delà
   de ce plancher, le reste (60%) varie selon la qualité et le risque. */
const NOVABOT_PLANCHER_ALLOCATION = 0.4;
/* Poids qualité vs risque dans le facteur d'allocation : la qualité de
   l'opportunité (NovaScore, déjà validé par le seuil d'achat) pèse
   légèrement plus que le risque pur, mais le risque reste significatif
   — ni ignoré, ni dominant au point d'écraser le NovaScore. Choix
   documenté, pas une constante magique sans justification. */
const NOVABOT_POIDS_QUALITE = 0.6, NOVABOT_POIDS_RISQUE = 0.4;

/* Moteur principal : calcule le montant RÉELLEMENT proposé pour CE
   candidat précis, dans la limite du plafond déterministe déjà existant
   (cash disponible, plafond par position du mandat). Retourne un objet
   détaillé — jamais juste un nombre — pour que CHAQUE euro investi soit
   explicable après coup (§5 de la demande) à partir de données
   réellement enregistrées, pas reconstruites a posteriori. */
function novabotDimensionnerPosition({ cfg, mandate, st, prix, donnees, pfTotal, valeurExistanteEUR }){
  const cashDispo = cfg.wallet.cash - (mandate.cashMinPct / 100) * pfTotal;
  const plafondPosition = (mandate.maxPositionPct / 100) * pfTotal - valeurExistanteEUR;
  const plafondTheorique = Math.min(cfg.tradeAmountEUR, cashDispo, plafondPosition);

  const scoreRisque = novabotScoreRisque(donnees);
  const facteurQualite = Math.max(0, Math.min(1, (donnees.score - cfg.scoreAchat) / Math.max(1, 100 - cfg.scoreAchat)));
  /* Risque inconnu (historique insuffisant) : facteur neutre (0.5),
     jamais 1 (ce serait traiter l'incertitude comme une garantie de
     stabilité) ni 0 (ce serait pénaliser une donnée simplement absente
     comme si elle était mauvaise — deux suppositions également
     injustifiées). */
  const facteurRisque = scoreRisque === null ? 0.5 : scoreRisque / 100;
  const facteurAllocation = NOVABOT_POIDS_QUALITE * facteurQualite + NOVABOT_POIDS_RISQUE * facteurRisque;
  const montantPropose = plafondTheorique * (NOVABOT_PLANCHER_ALLOCATION + (1 - NOVABOT_PLANCHER_ALLOCATION) * facteurAllocation);

  const expositionSecteur = novabotExpositionSecteur(cfg.wallet, st.sector);
  const plafondSecteur = (mandate.maxPositionPct * NOVABOT_FACTEUR_SECTEUR / 100) * pfTotal - expositionSecteur;

  const bornes = [
    { type:'tradeAmountEUR', valeur:cfg.tradeAmountEUR },
    { type:'cash_disponible', valeur:cashDispo },
    { type:'plafond_position', valeur:plafondPosition },
    { type:'allocation_qualite_risque', valeur:montantPropose },
    { type:'plafond_secteur', valeur:Math.max(0, plafondSecteur) },
  ];
  const borneActive = bornes.reduce((min, b) => b.valeur < min.valeur ? b : min, bornes[0]);
  const montant = Math.max(0, borneActive.valeur);

  return {
    montant,
    detail: {
      prix, instrument:st.ticker, secteur:st.sector || null,
      novaScore:donnees.score, scoreRisque, volatility:donnees.volatility, maxDrawdown:donnees.maxDrawdown,
      coverage:donnees.coverage ?? null, confidence:donnees.confidence ?? null,
      facteurQualite:Math.round(facteurQualite*100)/100, facteurRisque:Math.round(facteurRisque*100)/100,
      facteurAllocation:Math.round(facteurAllocation*100)/100,
      cashDispo, plafondPosition, plafondTheorique, plafondSecteur:Math.max(0, plafondSecteur), expositionSecteurAvant:expositionSecteur,
      montantProposeAvantContraintes:Math.round(montantPropose*100)/100,
      bornePlusStricte:borneActive.type, montantFinal:Math.round(montant*100)/100,
    },
  };
}

function novabotDiscoveryCandidats(mandate){
  const dejaDetenus = new Set(state.novabot.wallet.positions.map(p => p.id));
  const estAutorise = st => {
    if (!st) return false;
    if (mandate.hardRules.some(r => r.type === 'excluded_sector' && r.value === st.sector)) return false;
    if (mandate.hardRules.some(r => r.type === 'excluded_asset' && (r.value === st.id || r.value === st.ticker))) return false;
    return true;
  };
  const watch = state.watchlist.filter(id => !dejaDetenus.has(id) && estAutorise(byId[id]));
  const dejaVus = new Set([...dejaDetenus, ...watch]);
  const reste = stocks
    .filter(st => !dejaVus.has(st.id) && estAutorise(st))
    .sort((a, b) => (Number.isFinite(b.score) ? b.score : -1) - (Number.isFinite(a.score) ? a.score : -1))
    .slice(0, NOVABOT_DISCOVERY_MAX)
    .map(st => st.id);
  return [...watch, ...reste];
}

/* Pipeline complet (§8) : Discovery -> Data validation -> Analysis ->
   Candidate generation -> Portfolio impact -> Risk/Mandate check ->
   Decision -> Execution simulation -> Logging. Toujours déterministe à ce
   stade (aucun LLM, tranche C à venir) : "Analysis" = NovaScore gratuit
   (novaScoreDe()), "Decision" = seuil déclaré par l'utilisateur. 2 passes
   dans cet ordre précis (sortir avant d'entrer, inchangé depuis la 1ʳᵉ
   version) : une position en perte au-delà du stop-loss doit être
   liquidée avant d'envisager un nouvel achat. */
async function evaluerNovaBot(){
  if (!state.novabot.enabled) return;
  const cfg = state.novabot;
  const mandate = novabotMandat();
  let changed = false;
  /* Panneau "NovaBot travaille" (audit 2026-10-13, V7 §4) — fonctions
     no-op si jamais appelées hors contexte navigateur (ex. un futur
     appelant serveur) : garde défensive, pas une dépendance dure. */
  const activite = typeof novabotActiviteDemarrer === 'function';
  if (activite) novabotActiviteDemarrer();

  /* --- sorties : positions détenues --- */
  const nbPositionsDepart = cfg.wallet.positions.length;
  const etapePositions = activite ? novabotActiviteDebuter(`Vérification de ${nbPositionsDepart} position(s) détenue(s)`) : null;
  for (const pos of [...cfg.wallet.positions]){
    const st = byId[pos.id];
    const prix = st ? prixDe(st) : null;
    if (prix === null) continue; // §32 : cours indisponible -> pas d'ordre
    const gainPct = ((prix - pos.avg) / pos.avg) * 100;
    if (gainPct <= -cfg.stopLossPct || gainPct >= cfg.takeProfitPct){
      const motif = gainPct <= -cfg.stopLossPct
        ? `Stop-loss déclenché : position à ${fmt.num(gainPct,1)} %`
        : `Take-profit déclenché : position à +${fmt.num(gainPct,1)} %`;
      const cashAvant = cfg.wallet.cash;
      const pfAvant = portfolioValue(cfg.wallet);
      const poidsAvant = pfAvant.total > 0 ? (toEUR(pos.avg * pos.qty, st.cur) / pfAvant.total) * 100 : 0;
      novabotVendre(pos.id, prix, motif);
      novabotEnregistrerDecision({ action:'sell', stockId:pos.id, ticker:st.ticker, name:st.name,
        priceObserved:prix, qty:pos.qty, cashBefore:cashAvant, cashAfter:cfg.wallet.cash,
        weightBeforePct:poidsAvant, weightAfterPct:0, reason:motif, dataUsed:{ gainPct } });
      changed = true;
      if (activite) novabotActiviteEtapeDirecte(`Vente simulée : ${st.ticker}`, 'terminee', motif);
    }
  }
  if (activite) novabotActiviteConclure(etapePositions, 'terminee',
    nbPositionsDepart ? 'Positions vérifiées.' : 'Aucune position détenue pour l\'instant.');

  /* --- entrées : discovery au-delà de la seule watchlist (§7) --- */
  /* CORRECTIF (audit V7 §3) : calculé UNE SEULE FOIS avant la boucle (le
     cash disponible ne change pas entre candidats tant qu'aucun achat
     n'a eu lieu ce passage-ci) — si la réserve minimale du mandat
     n'autorise déjà plus aucun montant sensé, aucun candidat n'a besoin
     d'être évalué individuellement : UNE décision explique la vraie
     cause ("liquidités déjà au minimum du mandat"), jamais une décision
     "Refusé" par candidat qui répéterait la même information. */
  const pfInitial = portfolioValue(cfg.wallet);
  const cashMinGlobal = (mandate.cashMinPct / 100) * pfInitial.total;
  const cashDisponiblePourInvestir = cfg.wallet.cash - cashMinGlobal;
  if (cashDisponiblePourInvestir < NOVABOT_MONTANT_MIN_INVESTISSABLE){
    /* Même garde-fou "jamais réémis dans les 24h" que pour les décisions
       `watch` plus bas dans cette fonction (dejaWatch) — même situation
       de cash inchangée, même raison, pas d'information nouvelle tant
       que rien n'a bougé (dépôt, retrait, vente). */
    const dejaSignale = cfg.decisions.some(d => d.dataUsed?.raison === 'cash_reserve_globale'
      && (Date.now() - new Date(d.date).getTime()) < 24 * 3600 * 1000);
    if (!dejaSignale){
      /* name explicite (jamais null) : d.name est interpolé tel quel dans
         novabotOuvrirDecision() (js/nova.js, bouton "Demander à Nova
         pourquoi") — un null y afficherait littéralement "null" dans la
         question posée au modèle. */
      novabotEnregistrerDecision({ action:'reject', stockId:null, ticker:null, name:'Réserve de liquidités',
        executionStatus:'skipped',
        reason:`Liquidités disponibles (${fmt.eur(cfg.wallet.cash)}) déjà au minimum du mandat (${mandate.cashMinPct} % de réserve) — aucun nouvel achat n'est possible avant un dépôt ou une vente.`,
        dataUsed:{ raison:'cash_reserve_globale', cash:cfg.wallet.cash, cashMinGlobal } });
      changed = true;
    }
    state.novabot.lastRunAt = Date.now();
    saveState();
    pushNovaBot();
    if (activite) novabotActiviteTerminer('Décision : conserver les liquidités (déjà au minimum du mandat).');
    if (changed) render();
    return;
  }
  const candidats = novabotDiscoveryCandidats(mandate);
  const etapeDecouverte = activite ? novabotActiviteDebuter(`Recherche d'opportunités (${candidats.length} candidat(s) à examiner)`) : null;
  /* Préférence de prix (2026-10-15, "recherche des actions à moins de
     X€") : NON contraignante (§0.A du plan — une préférence, jamais une
     hard rule), donc filtrée ICI à la découverte plutôt que dans
     novabotRiskCheck(), qui reste strictement réservé aux hard rules.
     Hoisté hors de la boucle : une seule lecture de mandate.preferences
     pour tous les candidats, pas une par candidat. */
  const maxPriceEUR = Number(mandate.preferences?.find(p => p.type === 'max_price_eur')?.value);
  const prixPlafond = Number.isFinite(maxPriceEUR) ? maxPriceEUR : null;
  let appelsIA = 0; // borne les appels Nova Core de CE passage (§23/§24, voir plus bas)
  let nbAchats = 0, nbVentes = (nbPositionsDepart - cfg.wallet.positions.length);
  for (const id of candidats){
    const st = byId[id];
    const etapeCandidat = activite ? novabotActiviteDebuter(`Analyse de ${st ? st.ticker : id}`) : null;
    if (!st){ if (activite) novabotActiviteConclure(etapeCandidat, 'echouee', 'Instrument introuvable dans le catalogue.'); continue; } // §33 : instrument ambigu/introuvable -> pas d'ordre
    const prix = prixDe(st);
    if (prix === null){ if (activite) novabotActiviteConclure(etapeCandidat, 'echouee', 'Cours indisponible.'); continue; } // §32
    if (prixPlafond !== null && toEUR(prix, st.cur) > prixPlafond){
      if (activite) novabotActiviteConclure(etapeCandidat, 'echouee', `Au-dessus de la préférence de prix (≤ ${fmt.eur(prixPlafond)}).`);
      continue;
    }
    const donnees = await novabotDonneesMarche(st);
    if (donnees === null){ if (activite) novabotActiviteConclure(etapeCandidat, 'echouee', 'NovaScore indisponible (données insuffisantes).'); continue; } // §32 : NovaScore indisponible -> pas d'ordre, WATCH non plus (rien à dire)
    const score = donnees.score;
    if (activite) novabotActiviteConclure(etapeCandidat, 'terminee', `NovaScore ${score}/100${Number.isFinite(donnees.volatility) ? ` · volatilité ${(donnees.volatility*100).toFixed(0)}%` : ''}`);

    if (score >= cfg.scoreAchat){
      /* Second avis Nova Core (tranche C, §1/§9) : UNIQUEMENT si
         l'utilisateur a explicitement activé state.novabot.aiReasoning, et
         au plus NOVABOT_LLM_MAX fois par passage — §23 : "ne pas créer de
         boucle incontrôlée [...] je veux maîtriser les coûts API". Un
         candidat au-delà de cette borne retombe simplement sur la
         décision déterministe de la tranche B (seuil franchi -> achat),
         jamais bloqué en attente d'un avis IA qui ne viendra pas ce
         passage-ci. Tout échec de l'appel (quota épuisé, réseau, réponse
         illisible) fait de même : novabotRaisonnementIA() ne lève jamais,
         `avisIA` reste simplement null. */
      let avisIA = null;
      if (cfg.aiReasoning && appelsIA < NOVABOT_LLM_MAX){
        appelsIA++;
        const pfPourIA = portfolioValue(cfg.wallet);
        avisIA = await novabotRaisonnementIA(st, donnees, mandate, pfPourIA, prix);
      }
      const actionDecidee = avisIA ? avisIA.action : 'buy';

      if (actionDecidee === 'buy'){
        const priceEUR = toEUR(prix, st.cur);
        /* CORRECTIF (audit 2026-10-13, "calcul intelligent des montants
           investis") : remplace le plafond uniforme (qui donnait
           systématiquement le même montant — 15% du portefeuille — à
           CHAQUE candidat franchissant le seuil, cause exacte des 75€
           répétés) par novabotDimensionnerPosition() : même plafond
           ABSOLU (jamais dépassé), mais le montant RÉELLEMENT proposé à
           l'intérieur varie selon le NovaScore et le risque (volatilité/
           drawdown) réels de CE candidat précis. Recalculé à chaque
           itération (le cash/les positions ont pu changer si un
           candidat précédent de ce même passage vient d'acheter).
           novabotRiskCheck() reste appelé ensuite : filet de sécurité
           final (secteur/actif interdit, nombre max de positions...),
           jamais redondant avec le dimensionnement. */
        const pfCourant = portfolioValue(cfg.wallet);
        const posExistante = cfg.wallet.positions.find(p => p.id === id);
        const valeurExistanteEUR = posExistante ? toEUR(posExistante.avg * posExistante.qty, st.cur) : 0;
        const sizing = novabotDimensionnerPosition({ cfg, mandate, st, prix, donnees, pfTotal:pfCourant.total, valeurExistanteEUR });
        const montantInvestissable = sizing.montant;
        if (montantInvestissable < NOVABOT_MONTANT_MIN_INVESTISSABLE){
          /* Pas assez de place pour CE candidat précisément (position déjà
             proche du max, cash épuisé par un achat précédent dans ce
             même passage, ou secteur déjà concentré) — on passe au
             suivant plutôt que de proposer un montant symbolique ou de
             répéter le même rejet. */
          continue;
        }
        const intent = { action:'buy', stockId:id, ticker:st.ticker, sector:st.sector,
          amountEUR:montantInvestissable, priceLocal:prix, currency:st.cur, qty:montantInvestissable / priceEUR };
        const verdict = novabotRiskCheck(intent, cfg.wallet, mandate);
        /* Justification (§5 : "pourquoi as-tu investi davantage dans
           cette action que dans une autre ?") — entièrement dérivée de
           sizing.detail, déjà calculé, jamais reconstruite après coup. */
        const motifRisque = sizing.detail.scoreRisque === null
          ? 'risque non mesurable (historique de prix insuffisant)'
          : `risque ${sizing.detail.scoreRisque}/100 (volatilité ${sizing.detail.volatility !== null ? (sizing.detail.volatility*100).toFixed(0)+'%' : '—'}, drawdown max ${sizing.detail.maxDrawdown !== null ? (sizing.detail.maxDrawdown*100).toFixed(0)+'%' : '—'})`;
        const motifMontant = `Montant ${fmt.eur(sizing.detail.montantFinal)} = ${fmt.eur(sizing.detail.plafondTheorique)} plafond × facteur qualité/risque ${(sizing.detail.facteurAllocation*100).toFixed(0)}% (borne la plus stricte : ${sizing.detail.bornePlusStricte})`;
        const motif = (avisIA
          ? `NovaScore ${score} ≥ seuil ${cfg.scoreAchat} ; Nova AI : ${avisIA.reasoning}`
          : `NovaScore ${score} ≥ seuil ${cfg.scoreAchat}`) + ` ; ${motifRisque}. ${motifMontant}`;
        if (verdict.allowed && cfg.autonomyMode !== 'auto'){
          /* §22 : "conseil" demande toujours confirmation ; "semi-autonome"
             aussi POUR LES ACHATS dans cette passe (distinction plus fine
             entre "petite" et "importante" décision non spécifiée, jamais
             inventée sans critère donné — limite assumée, documentée au
             rapport). Les SORTIES (stop-loss/take-profit, plus haut dans
             cette fonction) restent TOUJOURS immédiates quel que soit le
             mode : différer une protection de risque en attendant un
             accord irait à l'encontre de son but. */
          const pfAvant = portfolioValue(cfg.wallet);
          const posExistante = cfg.wallet.positions.find(p => p.id === id);
          const poidsAvant = pfAvant.total > 0 && posExistante ? (toEUR(posExistante.avg * posExistante.qty, st.cur) / pfAvant.total) * 100 : 0;
          novabotEnregistrerDecision({ action:'buy', stockId:id, ticker:st.ticker, name:st.name,
            priceObserved:prix, qty:intent.qty, amountEUR:intent.amountEUR,
            cashBefore:cfg.wallet.cash, cashAfter:cfg.wallet.cash, weightBeforePct:poidsAvant, weightAfterPct:poidsAvant,
            reason:`${motif} (en attente de ton accord — mode ${cfg.autonomyMode === 'advice' ? 'conseil' : 'semi-autonome'})`,
            executionStatus:'pending',
            dataUsed:{ novaScore:score, fundamentals:donnees.fundamentals, sizing:sizing.detail }, mandateSnapshot:mandate, riskResult:verdict,
            aiProvider:avisIA?.provider || null, aiModel:avisIA?.model || null, confidence:avisIA?.confidence ?? null });
          changed = true;
        } else if (verdict.allowed){
          const cashAvant = cfg.wallet.cash;
          const pfAvant = portfolioValue(cfg.wallet);
          const posExistante = cfg.wallet.positions.find(p => p.id === id);
          const poidsAvant = pfAvant.total > 0 && posExistante ? (toEUR(posExistante.avg * posExistante.qty, st.cur) / pfAvant.total) * 100 : 0;
          novabotAcheter(id, intent.amountEUR, prix, motif);
          const pfApres = portfolioValue(cfg.wallet);
          const posApres = cfg.wallet.positions.find(p => p.id === id);
          const poidsApres = pfApres.total > 0 && posApres ? (toEUR(posApres.avg * posApres.qty, st.cur) / pfApres.total) * 100 : 0;
          novabotEnregistrerDecision({ action:'buy', stockId:id, ticker:st.ticker, name:st.name,
            priceObserved:prix, qty:intent.qty, amountEUR:intent.amountEUR,
            cashBefore:cashAvant, cashAfter:cfg.wallet.cash, weightBeforePct:poidsAvant, weightAfterPct:poidsApres,
            reason:motif, dataUsed:{ novaScore:score, fundamentals:donnees.fundamentals, sizing:sizing.detail }, mandateSnapshot:mandate, riskResult:verdict,
            aiProvider:avisIA?.provider || null, aiModel:avisIA?.model || null, confidence:avisIA?.confidence ?? null });
          changed = true;
          nbAchats++;
          if (activite) novabotActiviteEtapeDirecte(`Achat simulé : ${st.ticker}`, 'terminee', `${fmt.eur(intent.amountEUR)} — ${motifMontant}`);
        } else {
          const bloqueCash = verdict.violations.some(v => v.type === 'cash_insuffisant' || v.type === 'cash_min');
          novabotEnregistrerDecision({ action:'reject', stockId:id, ticker:st.ticker, name:st.name,
            priceObserved:prix, amountEUR:intent.amountEUR, executionStatus:'rejected',
            reason:verdict.violations.map(v => v.message).join(' '),
            dataUsed:{ novaScore:score, sizing:sizing.detail }, mandateSnapshot:mandate, riskResult:verdict,
            aiProvider:avisIA?.provider || null, aiModel:avisIA?.model || null, confidence:avisIA?.confidence ?? null });
          changed = true;
          /* Cash insuffisant/sous le minimum ne va pas s'améliorer pour le
             candidat suivant à montant fixe (§21 : la taille de position
             intelligente est une tranche ultérieure) — jamais un "reject"
             par candidat restant qui n'apporterait aucune information
             nouvelle. Secteur/actif interdit, position_max : propres à CE
             candidat, les suivants continuent d'être évalués normalement. */
          if (bloqueCash) break;
        }
      } else if (actionDecidee === 'reject'){
        /* Nova AI a vu le NovaScore franchir le seuil mais déconseille
           malgré tout (§1 : "ne rien faire" est une décision à part
           entière, pas seulement un silence) — jamais exécuté, le Risk
           Engine n'a même pas à se prononcer sur une intention que l'avis
           qualitatif a déjà écartée. */
        novabotEnregistrerDecision({ action:'reject', stockId:id, ticker:st.ticker, name:st.name,
          priceObserved:prix, executionStatus:'skipped', reason:avisIA.reasoning,
          dataUsed:{ novaScore:score, keyFactors:avisIA.keyFactors },
          aiProvider:avisIA.provider, aiModel:avisIA.model, confidence:avisIA.confidence });
        changed = true;
      } else { // 'watch' décidé par Nova AI malgré un NovaScore au-dessus du seuil
        const dejaWatch = state.novabot.decisions.some(d => d.action === 'watch' && d.stockId === id
          && (Date.now() - new Date(d.date).getTime()) < 24 * 3600 * 1000);
        if (!dejaWatch){
          novabotEnregistrerDecision({ action:'watch', stockId:id, ticker:st.ticker, name:st.name,
            priceObserved:prix, reason:avisIA.reasoning,
            dataUsed:{ novaScore:score, keyFactors:avisIA.keyFactors },
            aiProvider:avisIA.provider, aiModel:avisIA.model, confidence:avisIA.confidence });
          changed = true;
        }
      }
    } else if (score >= cfg.scoreAchat - 10){
      /* WATCH (§13) déterministe : "opportunité intéressante mais les
         conditions ne sont pas encore réunies" — jamais réémis pour le
         même titre dans les 24h (§14 : "lorsque la décision est
         significative", pas à chaque passage pour une situation
         inchangée). */
      const dejaWatch = state.novabot.decisions.some(d => d.action === 'watch' && d.stockId === id
        && (Date.now() - new Date(d.date).getTime()) < 24 * 3600 * 1000);
      if (!dejaWatch){
        novabotEnregistrerDecision({ action:'watch', stockId:id, ticker:st.ticker, name:st.name,
          priceObserved:prix, reason:`NovaScore ${score}, proche du seuil (${cfg.scoreAchat}) sans l'atteindre encore.`,
          dataUsed:{ novaScore:score } });
        changed = true;
      }
    }
  }

  if (activite){
    novabotActiviteConclure(etapeDecouverte, 'terminee', `${candidats.length} candidat(s) examiné(s).`);
    const resume = nbAchats || nbVentes
      ? `${nbAchats} achat(s), ${nbVentes} vente(s) simulé(s).`
      : 'Décision : conserver les liquidités — aucune opportunité ne satisfait les critères du mandat pour l\'instant.';
    novabotActiviteTerminer(resume);
  }
  state.novabot.lastRunAt = Date.now();
  saveState();
  pushNovaBot();
  if (changed) render();
}

/* Bornes de saisie généreuses mais réelles (jamais un cash négatif, un
   pourcentage aberrant, ou un NaN silencieux depuis un champ vidé) —
   même esprit que setCapital() plus haut. Appelée par un `onchange`
   direct depuis PAGES.novabot (cohérent avec "chaque réglage s'applique
   immédiatement", même principe que Réglages). */
const NOVABOT_BORNES = {
  scoreAchat:[0,100], stopLossPct:[1,90], takeProfitPct:[1,500], tradeAmountEUR:[10,1000000],
  cashMinPct:[0,100], maxPositionPct:[1,100],
};
function novabotSetRegle(cle, valeurBrute){
  const [min, max] = NOVABOT_BORNES[cle] || [0, Infinity];
  const v = Number(valeurBrute);
  if (!Number.isFinite(v)) return;
  state.novabot[cle] = Math.max(min, Math.min(max, v));
  saveState();
  pushNovaBot();
}

/* Confirme le mandat construit par la conversation (refonte expérience,
   2026-10-08, §2/§10 : "NovaBot construit le mandat, présente un résumé
   compréhensible et demande confirmation") — appelée UNIQUEMENT sur un
   geste explicite de l'utilisateur (bouton "Confirmer" affiché par
   PAGES.novabot quand la conversation signale readyToConfirm), jamais
   automatiquement par la conversation elle-même (§12 : le modèle ne
   contrôle jamais directement le portefeuille).
   Le capital confié devient une VRAIE transaction 'deposit' (jamais une
   simple réécriture de wallet.cash/invested) : même principe que
   rejouerNovaBot()/pushPortfolio() partout ailleurs dans ce fichier — le
   journal reste l'unique source de vérité, aucune deuxième représentation
   qui pourrait diverger. Limite assumée de cette passe (documentée au
   rapport) : autonomyMode est collecté et persisté, mais son application
   fine dans le pipeline de décision (ex. "advice" = demander confirmation
   avant CHAQUE transaction) n'est pas encore câblée — le pipeline exécute
   des transactions SIMULÉES comme avant, quel que soit le mode choisi. */
/* CORRECTIF (2026-10-16, "passage au trading réel") : verrou central,
   même principe qu'openBuyAmount()/openSellReview() (index.html) —
   confirmer un mandat crée un dépôt SIMULÉ ; tant que le fictif est
   retiré de l'expérience publique, aucun NOUVEAU mandat ne peut naître,
   quel que soit le chemin (bouton, ancien brouillon). Les mandats déjà
   confirmés (données existantes) ne passent jamais par ici : intacts. */
function novabotConfirmerMandat(draft){
  if (!PORTEFEUILLE_FICTIF_PUBLIC && !state.novabot.mandateConfirmed){
    toast("Compte d'investissement non encore disponible.");
    return false;
  }
  const capital = Number.isFinite(draft.initialCapital) ? draft.initialCapital : 10000;
  state.novabot.transactions = [{ id:'nb'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    date:new Date().toISOString(), type:'deposit', amountEUR:capital,
    motif:'Capital confié à NovaBot (mandat initial, voir la conversation).' }];
  const rejoue = rejouerNovaBot(state.novabot.transactions);
  state.novabot.wallet.cash = rejoue.cash;
  state.novabot.wallet.invested = rejoue.invested;
  state.novabot.wallet.positions = rejoue.positions;
  state.novabot.wallet.realizedPnL = rejoue.realizedPnL;

  state.novabot.riskLevel = ['low','moderate','high'].includes(draft.riskLevel) ? draft.riskLevel : 'moderate';
  if (state.novabot.riskLevel === 'low'){ state.novabot.cashMinPct = 30; state.novabot.maxPositionPct = 6; }
  else if (state.novabot.riskLevel === 'high'){ state.novabot.cashMinPct = 10; state.novabot.maxPositionPct = 15; }
  else { state.novabot.cashMinPct = 20; state.novabot.maxPositionPct = 10; } // 'moderate'
  if (Array.isArray(draft.hardRules)) state.novabot.hardRules = draft.hardRules;
  state.novabot.autonomyMode = ['advice','semi_auto','auto'].includes(draft.autonomyMode) ? draft.autonomyMode : 'advice';
  state.novabot.objective = ['growth','income','preserve'].includes(draft.objective) ? draft.objective : null;
  state.novabot.horizonYears = Number.isFinite(draft.horizonYears) ? draft.horizonYears : null;

  state.novabot.mandateConfirmed = true;
  state.novabot.enabled = true;
  novabotSnapshotPortfolio('first');
  saveState();
  pushNovaBot();
}

/* Ajouter/retirer des fonds simulés (refonte UX, 2026-10-08, §6 : "+
   Ajouter des fonds" / retrait). Même convention exacte que depositCash()/
   withdrawCash() (portefeuille personnel, plus haut dans ce fichier) :
   mutation directe + transaction journalisée, { ok, msg } en retour — un
   dépôt/retrait n'est PAS une performance (§6 : "ne PAS considérer le
   dépôt comme un gain financier"), exactement comme pour le portefeuille
   personnel (voir rejouerNovaBot()/rejouerTransactions() : 'deposit'/
   'withdraw' modifient cash ET invested à parts égales, jamais
   realizedPnL). Jamais appelable avant un mandat confirmé — appeler
   depuis l'UI nécessite déjà un compte actif. */
function novabotAjouterFonds(amountEUR){
  if (!(amountEUR > 0)) return { ok:false, msg:'Montant invalide' };
  state.novabot.wallet.cash += amountEUR;
  state.novabot.wallet.invested += amountEUR;
  state.novabot.transactions.push({ id:'nb'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    date:new Date().toISOString(), type:'deposit', amountEUR, motif:'Dépôt simulé ajouté par l\'utilisateur.' });
  novabotSnapshotPortfolio('deposit');
  saveState();
  pushNovaBot();
  return { ok:true, msg:`${fmt.eur(amountEUR)} ajoutés au portefeuille NovaBot (simulation)` };
}
function novabotRetirerFonds(amountEUR){
  if (!(amountEUR > 0)) return { ok:false, msg:'Montant invalide' };
  if (amountEUR > state.novabot.wallet.cash) return { ok:false, msg:'Liquidités simulées insuffisantes' };
  state.novabot.wallet.cash -= amountEUR;
  state.novabot.wallet.invested -= amountEUR;
  state.novabot.transactions.push({ id:'nb'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    date:new Date().toISOString(), type:'withdraw', amountEUR, motif:'Retrait simulé demandé par l\'utilisateur.' });
  novabotSnapshotPortfolio('withdraw');
  saveState();
  pushNovaBot();
  return { ok:true, msg:`${fmt.eur(amountEUR)} retirés du portefeuille NovaBot (simulation)` };
}

/* ============================================================
   NOVABOT — PERSISTANCE SERVEUR (refonte fonctionnelle, 2026-10-07,
   tranche A "fondation")
   ------------------------------------------------------------
   Jusqu'ici, state.novabot ne vivait QUE dans ce navigateur
   (localStorage) — un changement d'appareil ou un cache vidé effaçait
   tout le "portefeuille" NovaBot, contrairement au portefeuille
   personnel (pushPortfolio()/syncPortfolio() plus haut, LOT D). Ce bloc
   reproduit EXACTEMENT le même mécanisme (compte-rendu complet,
   idempotent par id/instant, fusion-puis-rejeu au login), scopé à
   ?resource=novabot (voir api/me.js) au lieu de ?resource=portfolio.
   AUCUN changement de comportement visible pour l'utilisateur dans cette
   tranche : evaluerNovaBot()/novabotAcheter()/novabotVendre() restent
   inchangées, ce bloc ajoute seulement une sauvegarde serveur silencieuse
   en plus du localStorage existant. */
function rejouerNovaBot(transactions){
  /* 0, jamais DEFAULT_STATE.novabot.wallet.cash (lui-même 0 depuis le
     correctif ci-dessus, mais explicite ici à dessein) : depuis
     novabotConfirmerMandat(), le capital de départ EST une transaction
     'deposit' comme une autre — partir d'un cash non nul ici le compterait
     deux fois. */
  const wallet = { cash: 0, invested: 0, positions: [], realizedPnL: 0 };
  const triees = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const tx of triees){
    if (tx.type === 'buy'){
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos){
        const totalQty = pos.qty + tx.qty;
        pos.avg = ((pos.avg * pos.qty) + (tx.priceLocal * tx.qty)) / totalQty;
        pos.qty = totalQty;
      } else {
        wallet.positions.push({ id: tx.stockId, qty: tx.qty, avg: tx.priceLocal });
      }
      wallet.cash -= tx.amountEUR;
    } else if (tx.type === 'sell'){
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos){
        pos.qty -= tx.qty;
        if (pos.qty <= 0.0001) wallet.positions = wallet.positions.filter(p => p.id !== tx.stockId);
      }
      wallet.cash += tx.amountEUR;
      if (Number.isFinite(tx.realizedGain)) wallet.realizedPnL += tx.realizedGain;
    } else if (tx.type === 'deposit'){
      wallet.cash += tx.amountEUR; wallet.invested += tx.amountEUR;
    } else if (tx.type === 'withdraw'){
      wallet.cash -= tx.amountEUR; wallet.invested -= tx.amountEUR;
    } else if (tx.type === 'fee'){
      wallet.cash -= tx.amountEUR;
    }
  }
  return wallet;
}

/* Envoie tout ce qui doit exister côté serveur : crée le compte au tout
   premier appel (capital = state.novabot.wallet.invested, le capital
   "confié" tel qu'il existe aujourd'hui — §1 du brief NovaBot, "je confie
   10 000 € à NovaBot"), synchronise le mandat complet (tranche B : tous
   les champs déjà réels côté client, voir novabotMandat()) et pousse le
   journal + les décisions. Silencieuse en cas d'échec, même principe que
   pushPortfolio(). */
async function pushNovaBot(){
  if (!sbClient || state.auth.status !== 'authenticated') return;
  try {
    const mandate = novabotMandat();
    const body = {
      /* CORRECTIF (2026-10-08) : n'envoie account QUE si un mandat a
         réellement été confirmé — sinon un simple clic sur un réglage
         secondaire (ex. le second avis IA) avant toute conversation
         créerait un compte serveur fantôme à 0 €, jamais voulu par
         l'utilisateur. Idempotent côté serveur de toute façon (un compte
         existant n'est jamais recréé), mais mieux vaut ne pas tenter la
         création avant le bon moment. */
      account: state.novabot.mandateConfirmed
        ? { initialCapital: state.novabot.wallet.invested, autonomyMode: state.novabot.autonomyMode }
        : undefined,
      status: state.novabot.enabled ? 'active' : 'paused',
      mandate: { cashMinPct: mandate.cashMinPct, maxPositionPct: mandate.maxPositionPct,
        maxPositionsCount: mandate.maxPositionsCount, hardRules: mandate.hardRules, preferences: mandate.preferences,
        objective: mandate.objective, riskLevel: mandate.riskLevel, horizonYears: mandate.horizonYears,
        /* CORRECTIF (audit 2026-10-14) : jusqu'ici jamais transmis au
           serveur — le cycle automatique (api/market/extra.js, kind=
           novabot-cron) utilisait donc toujours ses valeurs par défaut au
           lieu d'un réglage personnalisé par l'utilisateur. */
        tradingRules: { scoreAchat: state.novabot.scoreAchat, stopLossPct: state.novabot.stopLossPct,
          takeProfitPct: state.novabot.takeProfitPct, tradeAmountEUR: state.novabot.tradeAmountEUR } },
      transactions: state.novabot.transactions.map(tx => ({ ...tx, reason: tx.motif })),
      snapshots: state.novabot.walletHistory || [],
      decisions: state.novabot.decisions.map(d => ({ ...d, occurredAt: d.date })),
    };
    await authFetch('/api/me?resource=novabot', { method:'POST', body: JSON.stringify(body) });
  } catch (e){ console.warn('[novabot] envoi impossible :', e); }
}

/* Appelée une fois après connexion (voir applySession()), juste après
   syncPortfolio() — même rôle exact, scopé à NovaBot : récupère l'état
   serveur, fusionne avec l'historique local de cet appareil (dédoublonné
   par id de transaction), rejoue le journal fusionné pour reconstruire
   cash/positions/realizedPnL, puis repousse la fusion au serveur (couvre
   le tout premier login avec un historique local jamais encore envoyé). */
async function syncNovaBot(){
  if (!sbClient || state.auth.status !== 'authenticated') return;
  try {
    const r = await authFetch('/api/me?resource=novabot');
    if (!r.ok) return;
    const data = await r.json();
    const serverTx = Array.isArray(data.transactions) ? data.transactions.map(tx => ({ ...tx, motif: tx.reason })) : [];
    if (!serverTx.length && !state.novabot.transactions.length && !data.account){
      return; // rien côté serveur, rien en local : pousse simplement au prochain achat/activation
    }

    const txById = new Map();
    for (const tx of state.novabot.transactions) txById.set(tx.id, tx);
    for (const tx of serverTx) txById.set(tx.id, tx);
    state.novabot.transactions = [...txById.values()].sort((a, b) => new Date(a.date) - new Date(b.date));

    const rejoue = rejouerNovaBot(state.novabot.transactions);
    state.novabot.wallet.cash = rejoue.cash;
    state.novabot.wallet.invested = rejoue.invested;
    state.novabot.wallet.positions = rejoue.positions;
    state.novabot.wallet.realizedPnL = rejoue.realizedPnL;
    if (data.mandate){
      /* NOUVEAU (2026-10-15) : identité de la ligne courante, nécessaire à
         la vérification de concurrence optimiste avant une modification
         confirmée depuis le chat (voir novabotChatConfirmerAmendement()). */
      if (typeof data.mandate.id === 'string') state.novabot.mandateId = data.mandate.id;
      if (Number.isFinite(data.mandate.cashMinPct)) state.novabot.cashMinPct = data.mandate.cashMinPct;
      if (Number.isFinite(data.mandate.maxPositionPct)) state.novabot.maxPositionPct = data.mandate.maxPositionPct;
      state.novabot.maxPositionsCount = Number.isFinite(data.mandate.maxPositionsCount) ? data.mandate.maxPositionsCount : null;
      if (Array.isArray(data.mandate.hardRules)) state.novabot.hardRules = data.mandate.hardRules;
      if (Array.isArray(data.mandate.preferences)) state.novabot.preferences = data.mandate.preferences;
      if (['growth','income','preserve'].includes(data.mandate.objective)) state.novabot.objective = data.mandate.objective;
      if (['low','moderate','high'].includes(data.mandate.riskLevel)) state.novabot.riskLevel = data.mandate.riskLevel;
      if (Number.isFinite(data.mandate.horizonYears)) state.novabot.horizonYears = data.mandate.horizonYears;
      /* CORRECTIF (audit 2026-10-14) : relu depuis le serveur comme le
         reste du mandat (ex. un réglage fait sur un autre appareil doit
         se refléter ici) — mêmes bornes que NOVABOT_BORNES (js/core.js)
         pour ne jamais accepter une valeur hors limites venue du serveur. */
      const tr = data.mandate.tradingRules;
      if (tr && typeof tr === 'object'){
        if (Number.isFinite(tr.scoreAchat)) state.novabot.scoreAchat = Math.max(0, Math.min(100, tr.scoreAchat));
        if (Number.isFinite(tr.stopLossPct)) state.novabot.stopLossPct = Math.max(1, Math.min(90, tr.stopLossPct));
        if (Number.isFinite(tr.takeProfitPct)) state.novabot.takeProfitPct = Math.max(1, Math.min(500, tr.takeProfitPct));
        if (Number.isFinite(tr.tradeAmountEUR)) state.novabot.tradeAmountEUR = Math.max(10, Math.min(1000000, tr.tradeAmountEUR));
      }
    }
    if (data.account){
      if (['advice','semi_auto','auto'].includes(data.account.autonomyMode)) state.novabot.autonomyMode = data.account.autonomyMode;
      /* mandateConfirmed dérivé du statut serveur plutôt que stocké en
         double : novabot_accounts.status vaut 'setup' jusqu'à la
         confirmation explicite du mandat (novabotConfirmerMandat() plus
         bas), 'active'/'paused' ensuite — une seule source de vérité. */
      state.novabot.mandateConfirmed = data.account.status !== 'setup';
      /* CORRECTIF (2026-10-13, bug réel confirmé en base : un compte
         NovaBot resté "paused" côté serveur alors que rien n'indiquait
         pourquoi) — state.novabot.enabled était poussé VERS le serveur
         (pushNovaBot(), plus bas) mais jamais relu DEPUIS lui : un
         changement fait ailleurs (autre appareil, ou ici même côté
         serveur pour déboguer) était silencieusement écrasé par le
         prochain pushNovaBot() déclenché par CE navigateur, qui renvoyait
         aveuglément son propre état local périmé. Synchronisé comme
         mandateConfirmed, une seule source de vérité au chargement —
         un nouveau appui sur le bouton Activer/Désactiver (index.html)
         reste bien sûr prioritaire ensuite pour CETTE session. */
      state.novabot.enabled = data.account.status === 'active';
      /* NOUVEAU (2026-10-15) : annulation EXPLICITE du mandat, distincte
         de "paused" — même source unique (le statut serveur) que
         mandateConfirmed/enabled ci-dessus. */
      state.novabot.cancelled = data.account.status === 'cancelled';
    }
    if (Array.isArray(data.mandateHistory)){
      state.novabot.mandateHistory = data.mandateHistory.map(m => ({ id: m.id, createdAt: m.createdAt }));
    }
    const serverDec = Array.isArray(data.decisions) ? data.decisions.map(d => ({ ...d, date: d.occurredAt })) : [];
    const decById = new Map();
    for (const d of state.novabot.decisions) decById.set(d.id, d);
    for (const d of serverDec) decById.set(d.id, d);
    state.novabot.decisions = [...decById.values()].sort((a, b) => new Date(a.date) - new Date(b.date));

    /* Fusion des relevés par instant — même principe exact que syncPortfolio()
       (portefeuille personnel, plus haut) pour state.walletHistory. */
    const serverSnap = Array.isArray(data.snapshots) ? data.snapshots : [];
    const snapByT = new Map();
    for (const s of state.novabot.walletHistory) snapByT.set(s.t, s);
    for (const s of serverSnap) snapByT.set(s.t, s);
    state.novabot.walletHistory = [...snapByT.values()].sort((a, b) => a.t - b.t);
    saveState();
    render();
  } catch (e){ console.warn('[novabot] synchronisation impossible :', e); return; }
  pushNovaBot();
}

/* Annulation EXPLICITE du mandat (2026-10-15, pilotage depuis le chat) —
   DISTINCTE de la mise en pause (state.novabot.enabled=false, réversible
   en un clic) : annuler signifie "arrête tout, il faudra refaire
   l'onboarding pour relancer NovaBot". N'envoie STRICTEMENT que {status},
   jamais wallet/transactions/positions — ne peut donc, par construction,
   jamais déclencher une vente. `await` réel (pas de pushNovaBot()
   silencieux) : l'état local n'est mis à jour qu'après une réponse serveur
   réussie, pour que le chat n'annonce jamais un succès qui n'a pas eu
   lieu (voir novabotTraiterAction(), js/novabot-chat.js). */
async function novabotAnnulerMandat(){
  const r = await authFetch('/api/me?resource=novabot', {
    method:'POST', body: JSON.stringify({ status:'cancelled' }),
  });
  if (!r.ok) return false;
  state.novabot.enabled = false;
  state.novabot.cancelled = true;
  saveState();
  render();
  return true;
}

/* Restaure la version du mandat précédant la dernière modification
   confirmée (2026-10-15) — réutilise l'historique déjà présent côté
   serveur (novabot_mandates, append-only) : state.novabot.mandateHistory
   est trié du plus récent au plus ancien (voir syncNovaBot() ci-dessus),
   l'index 1 est donc la version AVANT le dernier changement. Restaurer
   crée une NOUVELLE version côté serveur (jamais une réécriture) —
   syncNovaBot() relit ensuite l'état réellement appliqué, une seule
   source de vérité plutôt qu'une supposition locale. */
async function novabotRestaurerVersionPrecedente(){
  const cible = state.novabot.mandateHistory?.[1];
  if (!cible?.id) return false;
  const r = await authFetch('/api/me?resource=novabot', {
    method:'POST', body: JSON.stringify({ action:'restore_mandate_version', targetMandateId: cible.id }),
  });
  if (!r.ok) return false;
  await syncNovaBot();
  return true;
}
