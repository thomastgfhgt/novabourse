const QUOTES = new Map();
/* Cache 2 min (localStorage) : peuple QUOTES dès le chargement de ce
   script, AVANT le tout premier rendu, pour un affichage "cache
   d'abord" instantané avec les derniers prix connus -- chargerCotations()
   rafraîchit ensuite normalement en arrière-plan et écrase ces valeurs
   dès qu'une réponse fraîche arrive (jamais un remplacement du vrai
   fetch, seulement un premier paint plus rapide). N'affecte jamais la
   fraîcheur affichée à l'utilisateur (FRESHNESS_LABEL) : elle vient
   toujours de la réponse serveur, jamais de ce cache local. */
const QUOTES_CACHE_KEY = 'novabourse_quotes_cache_v1';
const QUOTES_CACHE_TTL_MS = 120000;
(function hydrateQuotesCache(){
  try {
    const raw = localStorage.getItem(QUOTES_CACHE_KEY);
    if (!raw) return;
    const cache = JSON.parse(raw);
    const maintenant = Date.now();
    for (const [id, entry] of Object.entries(cache)){
      if (entry && entry.q && Number.isFinite(entry.at) && (maintenant - entry.at) < QUOTES_CACHE_TTL_MS){
        QUOTES.set(id, entry.q);
      }
    }
  } catch {}
})();
/* Écrit l'état ACTUEL de QUOTES dans le cache (jamais partiel) : un id
   qui sort de QUOTES entre deux appels (rare, jamais aujourd'hui) sort
   aussi du cache au prochain write, pas de désynchronisation possible. */
function persisterQuotesCache(){
  try {
    const maintenant = Date.now();
    const out = {};
    for (const [id, q] of QUOTES.entries()) out[id] = { q, at: maintenant };
    localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify(out));
  } catch {}
}
/* HIST stocke un état explicite par société :
     { status:'loading' | 'ready' | 'empty' | 'error', data:[{date,close}] }
   'loading'  -> requête en cours ou pas encore lancée
   'ready'    -> data contient au moins 2 points réels, datés
   'empty'    -> le serveur a répondu mais sans historique exploitable
   'error'    -> la requête a échoué (réseau/HTTP) ; on retente au prochain appel */
const HIST = new Map();

/* Priorité à exchangeCode (code exact renvoyé par le backend/search), avec
   repli sur l'ancienne table MARKET_CODE pour compatibilité descendante.
   Avant cette correction, symboleDe passait TOUJOURS par MARKET_CODE[s.market],
   qui ne connaît que des libellés lisibles ("Euronext Paris") : toute société
   dont `market` contenait déjà un code brut ("PA") tombait sur `undefined`
   puis une chaîne vide, cassant silencieusement le symbole envoyé au backend.
   CORRECTIF (audit routage multi-actifs) : le type est désormais TOUJOURS
   transmis (3e segment "@type") à /api/market/quotes — sans lui, le backend
   traitait tout symbole comme une action, envoyant crypto/forex/index/
   commodity à EODHD avec un symbole d'action invalide (cause racine
   confirmée du bug "ALGO/USD cours indisponible" en production). */
const symboleDe = s => `${s.ticker}@${s.exchangeCode || MARKET_CODE[s.market] || ''}@${s.type || 'stock'}`;
/* Le backend (voir api/market/_providers.js, idDe()) identifie toujours
   une cotation par SEULEMENT ticker+exchange (2 segments), jamais le type
   — chaque `quote.symbol` renvoyé par /api/market/quotes a cette forme.
   symboleDe() ci-dessus a 3 segments (ticker@exchange@type) UNIQUEMENT
   pour que le backend sache router la requête ; il ne faut donc PAS
   l'utiliser pour faire correspondre une réponse à sa société d'origine
   (ça ne matcherait jamais, 3 segments ≠ 2) — idDeCotation() reproduit
   exactement le format 2-segments attendu en retour. */
const idDeCotation = s => `${s.ticker}@${s.exchangeCode || MARKET_CODE[s.market] || ''}`;
const MARKET_CODE = { NASDAQ:'NASDAQ', NYSE:'NYSE', 'Euronext Paris':'PA',
  'Euronext Amsterdam':'AS', Xetra:'DE', SIX:'SW', LSE:'L' };

/* --------------------------------------------------------------------
   RAFRAÎCHISSEMENT VIVANT — "quelques secondes de retard", pas du vrai
   streaming WebSocket (qu'on n'a pas). Budget calibré prudemment sur le
   palier d'ENTRÉE de Twelve Data Grow : 55 crédits/minute (confirmé par
   leur documentation officielle — les paliers supérieurs de Grow, 144 et
   377 crédits/min, ont simplement plus de marge, jamais moins).
   Chaque symbole interrogé consomme 1 crédit PAR APPEL — et ce cycle
   utilise `fresh=1` volontairement : sans ça, le cache serveur d'1 minute
   (voir _cache.js, TTL.quote=60000) renverrait le même prix à chaque
   tick pendant la minute en cours, rendant ce rafraîchissement inutile.
   Budget respecté : (nb symboles) × (cycles/minute) ≤ 55.
   Calibrage retenu : 7 symboles maximum, toutes les 8 secondes
   → 7 × 7,5 = 52,5 crédits/min, marge de sécurité incluse.
   Ne suit QUE les instruments réellement visibles sur la page courante
   (fiche ouverte, Comparer, Marchés/Watchlist visibles, positions du
   portefeuille) — jamais tout le catalogue. Coupé quand l'onglet est
   masqué (aucun crédit consommé pendant ce temps), repris à la reprise
   de visibilité. */
const LIVE_INTERVALLE_MS = 8000;
const LIVE_MAX_SYMBOLES = 7;
let liveTimer = null;
let liveIds = [];
/* AnimatedFinancialNumber : direction du dernier changement RÉEL de prix
   par société ('up'/'down'), lue une seule fois par PAGES.stock() puis
   effacée — jamais réappliquée à un render() qui suit sans nouveau
   changement de cours. Jamais posée au premier chargement d'une cotation
   (ancien === undefined) : ce n'est pas une variation, juste l'arrivée
   de la donnée. */
const PRICE_FLASH = new Map();
/* Même idée pour le curseur des segmented controls (voir syncSegPill()
   plus bas) : position de départ, par clé de .seg, posée juste avant le
   changement d'état qui déclenche le prochain render(). */
const SEG_FROM = new Map();

/* Vérifie les alertes de prix actives sur ce titre à chaque cotation
   reçue par le rafraîchissement vivant (voir liveTick ci-dessous et
   l'ajout de leurs stockId à idsVisibles, plus bas dans render()).
   Déclenchée au FRANCHISSEMENT du seuil, pas à chaque tick où le prix
   reste au-delà/en-deçà — sinon la même alerte redéclencherait un toast
   toutes les ~8s tant que le cours ne revient pas sous le seuil. */
function verifierAlertes(stockId, price){
  if (!Number.isFinite(price)) return;
  const st = byId[stockId];
  let touched = false;
  for (const a of state.alerts){
    if (a.triggered || a.stockId !== stockId) continue;
    const franchie = a.direction === 'above' ? price >= a.target : price <= a.target;
    if (!franchie) continue;
    a.triggered = true;
    touched = true;
    toast(`Alerte : ${st ? st.name : stockId} ${a.direction === 'above' ? 'a dépassé' : 'est passé sous'} ${fmt.cur(a.target, st?.cur || 'EUR')}`);
  }
  if (touched) saveState();
}
async function liveTick(){
  const cibles = liveIds.map(id => byId[id]).filter(s => s && s.ticker);
  if (!cibles.length) return;
  try {
    const r = await fetch('/api/market/quotes?fresh=1&symbols='
      + encodeURIComponent(cibles.map(symboleDe).join(',')));
    if (!r.ok) return;
    const d = await r.json();
    const parId = new Map(cibles.map(s => [idDeCotation(s), s]));
    let misAJour = false;
    for (const q of d.quotes || []){
      const s = parId.get(q.symbol);
      if (!s || !Number.isFinite(q.price) || q.price <= 0) continue;
      /* CORRECTIF (page qui "recharge" toutes les 8s) : recevoir une
         réponse HTTP valide ne signifie pas que la donnée a changé — un
         cours différé/EOD reste souvent identique d'un cycle à l'autre.
         Avant ce correctif, misAJour passait à true dès qu'UN SEUL cycle
         réussissait, quel que soit son contenu, ce qui déclenchait un
         render() complet (view.innerHTML remplacé en entier) toutes les
         8 secondes même sans aucun changement réel — exactement le
         symptôme "la page se recharge toutes les quelques secondes"
         rapporté. Le render() complet n'a plus de raison d'être appelé
         que lorsqu'au moins une valeur RÉELLEMENT affichée diffère. */
      const ancien = QUOTES.get(s.id);
      const aChange = !ancien
        || ancien.price !== q.price
        || ancien.changePercent !== q.changePercent
        || ancien.change !== q.change
        || ancien.timestamp !== q.timestamp;
      if (ancien && Number.isFinite(ancien.price) && q.price !== ancien.price){
        PRICE_FLASH.set(s.id, q.price > ancien.price ? 'up' : 'down');
      }
      QUOTES.set(s.id, q);
      if (aChange) misAJour = true;
      verifierAlertes(s.id, q.price);
    }
    if (misAJour){ state.ui.liveAt = Date.now(); render(); }
  } catch { /* un cycle raté n'interrompt pas les suivants, le prochain tick réessaiera */ }
}

/* Remplace tout abonnement précédent — jamais deux minuteurs en parallèle
   (ex. navigation rapide entre deux fiches). `ids` au-delà de
   LIVE_MAX_SYMBOLES est tronqué, jamais étendu.
   GARDE-FOU ESSENTIEL : si la liste demandée est EXACTEMENT celle déjà
   suivie, ne rien faire — ni redémarrer le minuteur, ni retirer un tick
   immédiat. Sans ce garde-fou, un tick réussi déclenche render(), qui
   rappelle cette fonction avec les mêmes ids (puisque render() relit la
   même route), qui relance un tick immédiat, qui réussit, qui rappelle
   render()... : une boucle non bornée, confirmée en test réel, où le
   rafraîchissement se déclenche en continu au lieu de toutes les 8
   secondes. Ce garde-fou la supprime sans changer le comportement
   attendu (nouveaux ids -> toujours un tick immédiat + minuteur relancé). */
function demarrerRafraichissementVivant(ids){
  const nouveaux = [...new Set(ids.filter(Boolean))].slice(0, LIVE_MAX_SYMBOLES);
  const inchange = nouveaux.length === liveIds.length
    && nouveaux.every(id => liveIds.includes(id));
  if (inchange && liveTimer) return;
  arreterRafraichissementVivant();
  liveIds = nouveaux;
  if (!liveIds.length) return;
  /* Premier tick IMMÉDIAT (pas d'attente des 8 premières secondes) : une
     société fraîchement ajoutée par recherche, ou tout simplement la
     fiche qu'on vient d'ouvrir, obtient un prix tout de suite plutôt que
     d'attendre le premier cycle programmé. */
  liveTick();
  liveTimer = setInterval(liveTick, LIVE_INTERVALLE_MS);
}
function arreterRafraichissementVivant(){
  if (liveTimer){ clearInterval(liveTimer); liveTimer = null; }
  liveIds = [];
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden){
    if (liveTimer){ clearInterval(liveTimer); liveTimer = null; }
  } else if (liveIds.length && !liveTimer){
    liveTimer = setInterval(liveTick, LIVE_INTERVALLE_MS);
  }
});

/* Chargement en masse (catalogue entier au démarrage) : contrairement au
   rafraîchissement vivant ci-dessus (déjà sûr par construction, 7 symboles
   max), CE chargement peut porter sur ~70 instruments d'un coup — bien
   au-delà du palier d'ENTRÉE de Twelve Data Grow (55 crédits/minute).
   Sans précaution, `Promise.all` sur tous les lots partirait en une seule
   salve et dépasserait le budget dès le premier appel. On regroupe donc
   les lots en VAGUES dont la somme de symboles reste sûre, avec une pause
   d'une minute entre deux vagues si le catalogue en réclame plusieurs —
   jamais un pic qui dépasse le crédit disponible. */
const CHARGEMENT_MASSE_MAX_SYMBOLES = 50;
const CHARGEMENT_MASSE_PAUSE_MS = 61000;

/* Enveloppe de déduplication : NE demande jamais une cotation déjà connue
   (QUOTES.has), NI une cotation dont la dernière tentative a échoué il y
   a moins de COTATION_COOLDOWN_MS — sans ce délai de recul, un symbole
   qui ne se résout JAMAIS (ticker invalide, fournisseur en panne)
   redéclencherait une tentative à chaque render(), donc une boucle sans
   fin (confirmé en test réel). Le délai laisse une chance de réessayer
   plus tard sans marteler un symbole cassé à chaque rendu.
   C'est ELLE qu'il faut appeler partout dans l'application — jamais
   chargerCotations() directement — pour que "catalogue large" ne rime
   jamais avec "tout charger". */
const COTATION_COOLDOWN_MS = 30000;
const derniereTentativeEchouee = new Map();

/* Suivi "en cours" (distinct du cooldown ci-dessus) : permet à stockRow()
   de savoir si l'absence de prix est un chargement RÉEL en cours (afficher
   "Chargement…") ou un échec déjà retenté puis mis en recul (rester sur
   "—" honnête, jamais faire croire qu'un chargement va aboutir alors
   qu'il vient d'échouer — voir aussi console.warn ci-dessous, retour
   utilisateur explicite : "Debug: vois ce qui se passe"). */
const COTATION_EN_COURS = new Set();
function cotationEnCours(id){ return COTATION_EN_COURS.has(id); }

function assurerCotations(liste){
  const maintenant = Date.now();
  const manquantes = liste.filter(s => {
    if (!s || !s.ticker || QUOTES.has(s.id)) return false;
    const derniere = derniereTentativeEchouee.get(s.id);
    return !derniere || (maintenant - derniere) > COTATION_COOLDOWN_MS;
  });
  if (!manquantes.length) return Promise.resolve();
  return chargerCotations(manquantes);
}

async function chargerCotations(liste){
  const cibles = liste.filter(s => s && s.ticker);
  if (!cibles.length) return;
  for (const s of cibles) COTATION_EN_COURS.add(s.id);

  const TAILLE_LOT = 8;
  const lots = [];
  for (let i = 0; i < cibles.length; i += TAILLE_LOT) lots.push(cibles.slice(i, i + TAILLE_LOT));

  const vagues = [];
  let vagueCourante = [], compteurCourant = 0;
  for (const lot of lots){
    if (compteurCourant + lot.length > CHARGEMENT_MASSE_MAX_SYMBOLES && vagueCourante.length){
      vagues.push(vagueCourante); vagueCourante = []; compteurCourant = 0;
    }
    vagueCourante.push(lot); compteurCourant += lot.length;
  }
  if (vagueCourante.length) vagues.push(vagueCourante);

  let reçus = 0, source = null, echecs = 0, totalLots = 0;

  for (let v = 0; v < vagues.length; v++){
    if (v > 0) await new Promise(res => setTimeout(res, CHARGEMENT_MASSE_PAUSE_MS));
    totalLots += vagues[v].length;
    await Promise.all(vagues[v].map(async lot => {
      try {
        const r = await fetch('/api/market/quotes?symbols='
          + encodeURIComponent(lot.map(symboleDe).join(',')));
        if (!r.ok){ echecs++; return; }
        const d = await r.json();
        const parId = new Map(lot.map(s => [idDeCotation(s), s]));
        for (const q of d.quotes || []){
          const s = parId.get(q.symbol);
          if (s && Number.isFinite(q.price) && q.price > 0){ QUOTES.set(s.id, q); reçus++; }
        }
        if (d.source) source = d.source;
        if (!d.quotes || !d.quotes.length) echecs++;
      } catch { echecs++; }
    }));
    /* Dès la 1ère vague reçue, on affiche déjà ce qu'on a — l'utilisateur
       voit des prix réels tout de suite plutôt que d'attendre la fin de
       toutes les vagues (pertinent seulement si le catalogue en réclame
       plusieurs). */
    if (vagues.length > 1) render();
  }

  /* Enregistre un délai de recul pour tout symbole demandé qui reste
     inconnu après cette tentative — voir COTATION_COOLDOWN_MS ci-dessus,
     c'est ce qui empêche une boucle sans fin sur un symbole qui ne se
     résout jamais. */
  const maintenant = Date.now();
  const restesSansPrix = [];
  for (const s of cibles){
    COTATION_EN_COURS.delete(s.id);
    if (!QUOTES.has(s.id)){
      derniereTentativeEchouee.set(s.id, maintenant);
      restesSansPrix.push(s);
    }
  }
  /* Debug (retour utilisateur explicite : "vois ce qui se passe") : un
     seul avertissement groupé plutôt qu'un par symbole, avec de quoi
     investiguer directement -- symboleDe() donne l'exact symbole envoyé
     au backend, et /api/market/company?ticker=X&exchange=Y&fresh=1
     (déjà utilisé partout dans ce fichier pour diagnostiquer un fournisseur)
     reste la seule source fiable de LA vraie raison (403/404/429/vide) :
     /api/market/quotes ne renvoie pas ce détail par symbole, seulement
     une liste de cotations reçues -- jamais deviner la cause ici. */
  if (restesSansPrix.length){
    console.warn(
      `[NovaTitre][chargerCotations] ${restesSansPrix.length}/${cibles.length} symbole(s) sans prix après cette tentative`
      + ` (source=${source||'aucune'}, échecs de lot=${echecs}/${totalLots}) :`,
      restesSansPrix.map(s => ({ id:s.id, symbole:symboleDe(s) })),
      `\nPour la vraie raison, tester : /api/market/company?ticker=${encodeURIComponent(restesSansPrix[0].ticker)}`
      + `&exchange=${encodeURIComponent(restesSansPrix[0].exchangeCode||'')}&fresh=1`
    );
  }

  if (!reçus){
    DATA.mode = 'unavailable';
    DATA.reason = echecs === totalLots ? 'fournisseur_indisponible' : null;
  } else {
    DATA.mode = 'live';
    DATA.covered = QUOTES.size;
    DATA.provider = source;
    DATA.at = Date.now();
    persisterQuotesCache();
  }
  paintSource();
  /* CORRECTIF — bug réel trouvé en test : appeler render() sans condition
     ici, même quand reçus===0, recrée exactement la liste "encore
     manquante" à l'identique au prochain rendu -> assurerCotations()
     la redemande -> chargerCotations() la re-échoue -> render() de
     nouveau : une boucle sans fin dès qu'un symbole ne se résout jamais
     (fournisseur en panne, ticker invalide, ou — comme dans ce test —
     un mock qui ne le satisfait jamais). Un aller simple sans rien de
     nouveau à afficher ne doit jamais redéclencher un rendu. */
  if (reçus) render();
}

/* Préchargement des 7 méga-capitalisations les plus consultées, au
   démarrage.
   CORRECTIF (bug réel trouvé en test) : la première version passait par
   ensureRuntimeStock(), qui calcule l'id via remoteId() = "TICKER-" +
   exchangeCode ("AAPL-NASDAQ"). Mais catalog.json (vérifié directement,
   2026-09-30) stocke ces mêmes sociétés sous "AAPL-NAS" (exchangeCode
   déjà "NASDAQ" en toutes lettres, mais l'id lui-même abrégé -- un
   écart préexistant entre la construction d'id du catalogue statique et
   remoteId(), indépendant de ce préchargement). Résultat observé : DEUX
   cartes "Apple Inc" sur Marchés (l'entrée du catalogue ET celle créée
   ici, avec deux id différents) -- et pire, la cotation préchargée
   n'aurait de toute façon jamais profité à la VRAIE entrée affichée
   (clé QUOTES différente).
   Corrigé : construit ici un objet minimal avec l'id RÉEL du catalogue
   (vérifié empiriquement, pas deviné), jamais ajouté à stocks/byId --
   chargerCotations() n'a besoin que de {id, ticker, exchangeCode, type}
   pour fonctionner, pas d'une société "enregistrée". Aucun risque de
   doublon visuel possible, et QUOTES.set(id,...) profite directement à
   la vraie entrée du catalogue dès qu'elle charge (même id). */
const TOP_SYMBOLES_PRECHARGES = [
  { id:'AAPL-NAS', ticker:'AAPL', exchangeCode:'NASDAQ', type:'stock' },
  { id:'MSFT-NAS', ticker:'MSFT', exchangeCode:'NASDAQ', type:'stock' },
  { id:'GOOGL-NAS', ticker:'GOOGL', exchangeCode:'NASDAQ', type:'stock' },
  { id:'AMZN-NAS', ticker:'AMZN', exchangeCode:'NASDAQ', type:'stock' },
  { id:'NVDA-NAS', ticker:'NVDA', exchangeCode:'NASDAQ', type:'stock' },
  { id:'TSLA-NAS', ticker:'TSLA', exchangeCode:'NASDAQ', type:'stock' },
  { id:'META-NAS', ticker:'META', exchangeCode:'NASDAQ', type:'stock' },
];
function prechargerTopSymboles(){
  chargerCotations(TOP_SYMBOLES_PRECHARGES);
}

/* Séances par période, sur des données journalières uniquement. 1J/1S
   intraday ne sont pas proposés (voir PERIODS_DISPO) : aucune donnée
   intraday n'est chargée par ce fichier. */
const SEANCES = { '1S':5, '1M':21, '3M':63, '6M':126, '1A':252 };

/* Filtre l'historique réel par période. Ne complète JAMAIS artificiellement :
   si moins de deux points réels existent pour la période demandée, retourne
   null et laisse l'appelant afficher "données insuffisantes". */
function histPeriode(stockId, periodId){
  const entry = HIST.get(stockId);
  if (!entry || entry.status !== 'ready' || !Array.isArray(entry.data) || entry.data.length < 2) return null;
  /* AAJ (année à ce jour) : filtre par date réelle plutôt qu'un nombre de
     séances fixe — calculable immédiatement à partir de l'historique
     quotidien déjà chargé, sans appel supplémentaire. Contrairement à un
     graphique "à la seconde", ceci n'exige aucune infrastructure de
     streaming : c'est un simple filtre sur des données déjà en main. */
  if (periodId === 'AAJ'){
    const debutAnnee = `${new Date().getFullYear()}-01-01`;
    const pts = entry.data.filter(p => p.date >= debutAnnee);
    return pts.length >= 2 ? pts : null;
  }
  const n = SEANCES[periodId];
  if (!n) return null;
  const pts = entry.data.slice(-n);
  return pts.length >= 2 ? pts : null;
}

const HIST_ENCOURS = new Set();

/* Historique réel, daté. Conserve tous les points renvoyés par le serveur
   (aucune troncature arbitraire à 60) et distingue explicitement : en cours,
   prêt, vide, en erreur. Une requête déjà en cours n'est jamais dupliquée. */
/* --------------------------------------------------------------------
   CHARGEMENT À LA DEMANDE — historique et fondamentaux sont désormais
   deux appels réseau INDÉPENDANTS, déclenchés uniquement par une action
   explicite de l'utilisateur ("Voir le graphique" / "Voir les chiffres"
   / ouverture de Comparer), plus jamais automatiquement à l'ouverture
   d'une fiche ou de l'accueil/watchlist. Chacun a son propre état
   explicite à 4 valeurs (idle/loading/loaded/error), sur le modèle déjà
   existant de HIST, pour permettre d'étendre facilement à d'autres
   catégories de données plus tard.
   -------------------------------------------------------------------- */

/* Historique réel, daté. Conserve tous les points renvoyés par le serveur
   (aucune troncature arbitraire à 60) et distingue explicitement : en cours,
   prêt, vide, en erreur. Une requête déjà en cours n'est jamais dupliquée.
   N'appelle plus que /api/market/history (jamais /company) : les
   fondamentaux sont désormais chargés séparément par chargerFondamentaux(). */
async function chargerGraphique(stock){
  if (!stock) return;
  const existing = HIST.get(stock.id);
  if (existing && existing.status !== 'error') return;   // déjà chargé ou en cours
  if (HIST_ENCOURS.has(stock.id)) return;

  HIST_ENCOURS.add(stock.id);
  HIST.set(stock.id, { status:'loading', data:[] });
  render();
  try {
    /* exchangeCode (code brut attendu par le backend, ex. "PA", "DE",
       "NASDAQ") en priorité, MARKET_CODE[stock.market] en repli — voir
       correctif exchangeCode documenté ailleurs dans ce fichier. */
    const exch = stock.exchangeCode || MARKET_CODE[stock.market] || '';
    const r = await fetch(`/api/market/history?ticker=${encodeURIComponent(stock.ticker)}`
      + `&exchange=${encodeURIComponent(exch)}&type=${encodeURIComponent(stock.type || 'stock')}`);
    if (!r.ok){
      HIST.set(stock.id, { status:'error', data:[] });
      return;
    }
    const d = await r.json();
    const points = (d.history?.ohlcv || [])
      .filter(x => x && typeof x.date === 'string' && Number.isFinite(x.close) && x.close > 0)
      .map(x => ({ date:x.date, close:x.close }));
    HIST.set(stock.id, points.length >= 2
      ? { status:'ready', data:points }
      : { status:'empty', data:[] });
  } catch {
    HIST.set(stock.id, { status:'error', data:[] });
  } finally {
    HIST_ENCOURS.delete(stock.id);
    render();
  }
}

/* ============================================================
   GRAPHIQUE PROFESSIONNEL — historique paramétré par période
   ============================================================
   Distinct de HIST/chargerGraphique ci-dessus (qui reste utilisé tel quel
   par Comparer/le score de volatilité/les sparklines de ligne). Cache
   client par COUPLE instrument+période — ouvrir 1M puis 5A charge deux
   séries différentes, indépendamment mises en cache ; rouvrir 1M ensuite
   ne redéclenche aucune requête tant que l'entrée est déjà 'ready'.
   OHLCV complet conservé (pas seulement `close`) pour permettre chandeliers,
   volume et statistiques réelles de période. */
const HISTP = new Map();          // clé "stockId::period" -> {status,kind,interval,source,data}
const HISTP_ENCOURS = new Set();

function cleHISTP(stockId, period){ return `${stockId}::${period}`; }

/* CORRECTIF (bug réel mesuré en test, 2026-09-30) : la grille Marchés
   (20 lignes) déclenche jusqu'à 20 appels chargerGraphiquePeriode() en
   parallèle (une sparkline par ligne) -- chacun appelait render() DEUX
   fois (début et fin de chargement), soit jusqu'à 42 reconstructions
   complètes de la page (view.innerHTML) mesurées pour une seule visite
   de Marchés, la quasi-totalité pour un résultat visuel identique aux
   renders juste avant/après. Les fetches eux-mêmes n'étaient PAS
   dupliqués (vérifié : 20 requêtes réelles pour 20 lignes, aucun
   doublon) -- uniquement le rendu. Regroupe les demandes de rendu
   rapprochées en UN SEUL render() réel via microtask -- n'affecte QUE
   ces deux appels, jamais render() lui-même ni ses autres appelants. */
let _renderSparklinesPlanifie = false;
function renderSparklinesGroupe(){
  if (_renderSparklinesPlanifie) return;
  _renderSparklinesPlanifie = true;
  queueMicrotask(() => { _renderSparklinesPlanifie = false; render(); });
}

async function chargerGraphiquePeriode(stock, period){
  if (!stock || !period) return;
  const cle = cleHISTP(stock.id, period);
  const existing = HISTP.get(cle);
  if (existing && existing.status !== 'error') return;   // déjà chargé ou en cours
  if (HISTP_ENCOURS.has(cle)) return;

  HISTP_ENCOURS.add(cle);
  HISTP.set(cle, { status:'loading', data:[] });
  renderSparklinesGroupe();
  const exch = stock.exchangeCode || MARKET_CODE[stock.market] || '';
  try {
    const r = await fetch(`/api/market/history?ticker=${encodeURIComponent(stock.ticker)}`
      + `&exchange=${encodeURIComponent(exch)}&type=${encodeURIComponent(stock.type || 'stock')}`
      + `&period=${encodeURIComponent(period)}`);
    if (!r.ok){
      console.warn(`[NovaTitre][chargerGraphiquePeriode] HTTP ${r.status} pour ${stock.ticker}@${exch} (période ${period})`);
      HISTP.set(cle, { status:'error', data:[] });
      return;
    }
    const d = await r.json();
    const points = (d.history?.ohlcv || [])
      .filter(x => x && typeof x.date === 'string' && Number.isFinite(x.close) && x.close > 0)
      .map(x => ({ date:x.date, open:x.open, high:x.high, low:x.low, close:x.close, volume:x.volume }));
    if (points.length < 2){
      console.warn(`[NovaTitre][chargerGraphiquePeriode] historique insuffisant pour ${stock.ticker}@${exch} (période ${period}) : ${points.length} point(s) exploitable(s)`);
    }
    HISTP.set(cle, points.length >= 2
      ? { status:'ready', kind:d.kind || 'daily', interval:d.interval || null, source:d.source || null, data:points }
      : { status:'empty', data:[] });
  } catch (e) {
    console.warn(`[NovaTitre][chargerGraphiquePeriode] exception pour ${stock.ticker}@${exch} (période ${period}) :`, e);
    HISTP.set(cle, { status:'error', data:[] });
  } finally {
    HISTP_ENCOURS.delete(cle);
    renderSparklinesGroupe();
  }
}

/* Ensemble des sociétés dont les fondamentaux sont en cours de chargement,
   sur le modèle de HIST_ENCOURS : protège contre une double requête
   identique (ex. clic répété sur "Voir les chiffres"). */
const FUND_ENCOURS = new Set();

/* Fondamentaux réels, chargés uniquement à la demande (bouton "Voir les
   chiffres"). `stock.fundamentalsStatus` reflète explicitement l'état :
   'idle' (jamais demandé) | 'loading' | 'loaded' | 'error'. Contrat des
   champs confirmé par test réel (MSFT via Finnhub) : revenue,
   revenuePerShare, revenueSeries, epsSeries, fcfSeries, netIncome, eps,
   profitMargin, operatingMargin, roe, debt, cash, freeCashFlow, pe,
   forwardPE, priceToBook, evToEbitda, dividendYield, marketCap. */
async function chargerFondamentaux(stock){
  if (!stock) return;
  if (stock.fundamentalsStatus === 'loaded' || stock.fundamentalsStatus === 'loading') return;
  if (FUND_ENCOURS.has(stock.id)) return;

  FUND_ENCOURS.add(stock.id);
  stock.fundamentalsStatus = 'loading';
  render();
  try {
    const exch = stock.exchangeCode || MARKET_CODE[stock.market] || '';
    const r = await fetch(`/api/market/fundamentals?ticker=${encodeURIComponent(stock.ticker)}`
      + `&exchange=${encodeURIComponent(exch)}&type=${encodeURIComponent(stock.type || 'stock')}`);
    if (!r.ok){
      stock.fundamentals = null;
      stock.hasFundamentals = false;
      stock.fundamentalsStatus = 'error';
      return;
    }
    const d = await r.json();
    stock.fundamentals = d.fundamentals ?? null;
    stock.hasFundamentals = Boolean(d.fundamentals);
    stock.fundamentalsSource = d.source ?? null;
    /* Ajout (audit "fiche entreprise") : description/site web/effectifs,
       chargés par le même appel, sans requête supplémentaire. */
    stock.companyIdentity = d.identity ?? null;
    /* 'loaded' dès que la requête a abouti, que des données exploitables
       existent ou non — symétrique à l'historique (ready/empty relèvent
       tous deux de "loaded", la nuance est affichée séparément via
       hasFundamentals). 'error' reste réservé à un échec réel de la
       requête (ci-dessus et dans le catch), jamais à "chargé mais vide". */
    stock.fundamentalsStatus = 'loaded';
  } catch {
    stock.fundamentals = null;
    stock.hasFundamentals = false;
    stock.fundamentalsStatus = 'error';
  } finally {
    FUND_ENCOURS.delete(stock.id);
    render();
  }
}

/* Actualités réelles, chargées uniquement à la demande (bouton "Voir les
   actualités"). Même modèle à 4 états que chargerFondamentaux ci-dessus :
   'idle' | 'loading' | 'loaded' | 'error'. Un fournisseur unique aujourd'hui
   (EODHD, voir NEWS dans _providers.js) — stock/etf uniquement, le backend
   répond directement articles:null pour les autres types sans appel réseau
   (déjà géré côté serveur, pas besoin de le reproduire ici). */
const NEWS_ENCOURS = new Set();
async function chargerActualites(stock){
  if (!stock) return;
  if (stock.newsStatus === 'loaded' || stock.newsStatus === 'loading') return;
  if (NEWS_ENCOURS.has(stock.id)) return;

  NEWS_ENCOURS.add(stock.id);
  stock.newsStatus = 'loading';
  render();
  try {
    const exch = stock.exchangeCode || MARKET_CODE[stock.market] || '';
    const r = await fetch(`/api/market/extra?kind=news&ticker=${encodeURIComponent(stock.ticker)}`
      + `&exchange=${encodeURIComponent(exch)}&type=${encodeURIComponent(stock.type || 'stock')}&limit=8`);
    if (!r.ok){
      stock.news = null;
      stock.newsStatus = 'error';
      return;
    }
    const d = await r.json();
    stock.news = Array.isArray(d.articles) ? d.articles : null;
    stock.newsSource = d.source ?? null;
    stock.newsStatus = 'loaded';
  } catch {
    stock.news = null;
    stock.newsStatus = 'error';
  } finally {
    NEWS_ENCOURS.delete(stock.id);
    render();
  }
}
