function typesCatalogueUtiles(cat){
  if (cat === 'stock') return ['stock'];
  if (cat === 'etf') return ['etf'];
  if (cat === 'tous') return ['stock', 'etf'];
  return [];
}
let marketsCatalogGen = 0;
async function garantirCatalogueMarkets(){
  const gen = ++marketsCatalogGen;
  const cat = state.filters.marketsCategory || 'tous';
  const minimum = Math.max(20, state.filters.marketsVisibles || 20);
  const resultats = await Promise.all(
    typesCatalogueUtiles(cat).map(type => assurerCatalogueSuffisant(type, minimum))
  );
  const changement = resultats.some(Boolean);
  if (changement && gen === marketsCatalogGen && route.page === 'markets'){
    const out = document.getElementById('marketsOut');
    if (out) out.innerHTML = marketsRows();
  }
}
/* Liste des pays réellement présents dans le catalogue ACTIONS (même
   source que l'ancien filtre pays d'Explorer) — noms français canoniques
   via paysAffiche(), jamais de "null"/"—"/doublon anglais (voir son
   commentaire). Recalculée à chaque ouverture du panneau plutôt que mise
   en cache : le catalogue mondial grandit au fil du chargement. */
function marketsPaysDisponibles(){
  return [...new Set(stocks.filter(s=>s.type==='stock').map(x=>paysAffiche(x.country)))]
    .filter(Boolean).sort((a,b)=>a.localeCompare(b,'fr'));
}
/* Valeurs "connues" (2026-09-29, retour utilisateur explicite : "je
   voudrais que les actions qu'on puisse voir en premier soit les plus
   connues"). Un premier essai de tri par PLACE prioritaire (NASDAQ, NYSE,
   Euronext...) a été testé en direct contre l'API réelle et écarté : il
   n'améliorait quasiment rien (34/40 vs 35/40 avec un prix réel), parce
   que les trous de couverture sont dispersés société par société, pas
   liés à la place elle-même. Liste ci-dessous testée différemment :
   chaque ticker+place vérifié un à un dans le catalogue (aucune
   substitution devinée), PUIS testé en direct contre /api/market/quotes
   (21 échantillon testés, 21/21 avec un prix réel) — les grandes
   capitalisations mondialement reconnues sont quasiment toujours
   couvertes, contrairement aux petites capitalisations obscures qui
   dominaient le tri alphabétique précédent. Ce n'est PAS une mesure de
   popularité réelle (aucune donnée d'usage/volume de consultation
   n'existe dans ce catalogue) : une sélection éditoriale honnête,
   utilisée UNIQUEMENT pour l'ordre d'affichage — chaque société affiche
   ensuite ses vrais chiffres réels, exactement comme toute autre entrée
   du catalogue. Tri alphabétique conservé pour tout le reste. */
const MARKETS_VALEURS_CONNUES = [
  'AAPL@NASDAQ', 'MSFT@NASDAQ', 'GOOGL@NASDAQ', 'GOOG@NASDAQ', 'AMZN@NASDAQ', 'NVDA@NASDAQ',
  'META@NASDAQ', 'TSLA@NASDAQ', 'AVGO@NASDAQ', 'NFLX@NASDAQ', 'ADBE@NASDAQ', 'INTC@NASDAQ',
  'AMD@NASDAQ', 'QCOM@NASDAQ', 'CSCO@NASDAQ', 'PEP@NASDAQ', 'COST@NASDAQ', 'PYPL@NASDAQ',
  'WMT@NASDAQ',
  'JPM@NYSE', 'V@NYSE', 'MA@NYSE', 'BAC@NYSE', 'KO@NYSE', 'DIS@NYSE',
  'MCD@NYSE', 'NKE@NYSE', 'XOM@NYSE', 'CVX@NYSE', 'PG@NYSE', 'JNJ@NYSE', 'UNH@NYSE',
  'HD@NYSE', 'ORCL@NYSE', 'CRM@NYSE', 'IBM@NYSE', 'GE@NYSE', 'BA@NYSE', 'GS@NYSE',
  'BP@NYSE',
  'MC@PA', 'OR@PA', 'SAN@PA', 'BNP@PA', 'TTE@PA', 'SU@PA', 'CAP@PA',
  'RMS@PA', 'DG@PA', 'EL@PA', 'SAF@PA',
  'SAP@DE', 'SIE@DE', 'BAS@DE', 'BMW@DE', 'VOW3@DE', 'DTE@DE', 'MBG@DE',
  'SHEL@L', 'AZN@L', 'HSBA@L', 'ULVR@L', 'GSK@L', 'RIO@L', 'DGE@L',
  'NESN@SW', 'NOVN@SW', 'RO@SW', 'UBSG@SW',
  'ASML@AS', 'ADYEN@AS', 'ITX@MC', 'IBE@MC',
  '005930@KO', '2330@TW', 'SHOP@TO', 'RY@TO',
  'BHP@AU', 'CBA@AU',
];
const MARKETS_RANG_CONNU = new Map(MARKETS_VALEURS_CONNUES.map((id, i) => [id, i]));
/* Accepte un jeu de filtres optionnel (le brouillon du panneau, voir
   marketsFilterDraft) pour calculer un compte de résultats "en direct"
   SANS toucher state.filters ni re-rendre la page derrière le panneau —
   state.filters par défaut pour tous les appels existants (liste
   affichée, pagination, rafraîchissement vivant). */
/* CORRECTIF PERF (2026-09-29, mesuré en direct) : render() appelle
   marketsListeFiltree() (via marketsListeFiltree()) TROIS FOIS pour un
   seul rendu de la page Marchés — une fois dans marketsRows() (affichage),
   une fois via listesParRoute.markets (cotations à combler) et une fois
   via liveParRoute.markets (rafraîchissement vivant), toutes les trois
   avec EXACTEMENT les mêmes filtres. Confirmé par compteur d'appels en
   direct : 3 appels par navigation vers Marchés, donc 3× le coût du tri
   (déjà optimisé, voir plus bas) pour un résultat strictement identique
   à chaque fois. Mémoïsé ici par valeur de filtres (jamais par identité
   d'objet, `state.filters` pouvant être muté sans être remplacé) — clé
   incluant `stocks.length` pour invalider automatiquement si le
   catalogue s'enrichit en cours de session (recherche/catalogue runtime),
   jamais un résultat obsolète. Uniquement pour l'appel SANS argument
   explicite (les filtres RÉELLEMENT actifs) : un appel avec un brouillon
   de filtres (panneau Filtres, aperçu "en direct") n'est jamais mis en
   cache, car chaque frappe y change potentiellement le résultat. */
let _marketsListeCache = null;
function marketsListeFiltree(f){
  const utiliseFiltresCourants = !f;
  f = f || state.filters;
  const cat = f.marketsCategory || 'tous';
  const region = f.marketsRegion || 'Monde';
  const sector = f.marketsSector || 'tous';
  const country = f.marketsCountry || 'tous';
  if (utiliseFiltresCourants){
    const cle = `${cat}|${region}|${sector}|${country}|${stocks.length}`;
    if (_marketsListeCache && _marketsListeCache.cle === cle) return _marketsListeCache.resultat;
  }
  let list = cat === 'tous' ? [...stocks] : stocks.filter(s => s.type === cat);
  if (region !== 'Monde') list = list.filter(s => REGION_OF_COUNTRY[s.country] === region);
  if (sector !== 'tous') list = list.filter(s => s.sector === sector);
  if (country !== 'tous') list = list.filter(s => paysAffiche(s.country) === country);
  /* CORRECTIF PERF (2026-09-29, mesuré en direct) : recalculer
     `${ticker}@${exchangeCode}` + interroger MARKETS_RANG_CONNU À
     CHAQUE COMPARAISON coûtait 739ms sur les ~46 000 valeurs du
     catalogue (comparateur appelé O(n log n) fois, soit ~1,4 M
     concaténations de chaînes) — un vrai temps de blocage synchrone à
     chaque ouverture de Marchés, ironiquement introduit par le
     correctif de tri précédent. Rang précalculé UNE FOIS par élément
     (transformation de Schwartz) avant le tri : 177ms mesuré, retombe
     quasiment au coût du tri alphabétique d'origine (134ms). */
  const decore = list.map(s => ({
    s,
    rang: MARKETS_RANG_CONNU.get(`${s.ticker}@${s.exchangeCode}`) ?? Infinity,
  }));
  decore.sort((a,b) => a.rang !== b.rang ? a.rang - b.rang : a.s.name.localeCompare(b.s.name,'fr'));
  const resultat = decore.map(d => d.s);
  if (utiliseFiltresCourants){
    _marketsListeCache = { cle: `${cat}|${region}|${sector}|${country}|${stocks.length}`, resultat };
  }
  return resultat;
}
/* Exactement les instruments actuellement révélés à l'écran (après
   pagination) — c'est CETTE liste, jamais la catégorie entière, qui doit
   servir à charger des cotations ou à alimenter le rafraîchissement
   vivant. */
function marketsListeVisible(){
  return marketsListeFiltree().slice(0, state.filters.marketsVisibles || 20);
}
function marketsRows(){
  const list = marketsListeFiltree();
  if (!list.length) return emptyState('Aucun instrument','Aucun instrument ne correspond à ce filtre.');
  /* Pagination : "20 minimum accessibles" ne veut pas dire "20 affichés
     et chargés d'un coup pour toujours" — marketsVisibles suit combien
     sont actuellement révélés (20 par défaut, +20 à chaque clic "Voir
     plus"), réinitialisé à 20 dès qu'on applique de nouveaux filtres. */
  const visibles = state.filters.marketsVisibles || 20;
  const page = list.slice(0, visibles);
  /* logo:false au-delà de CHARGEMENT_MASSE_MAX_SYMBOLES : même plafond
     et même raison que pour les sparklines juste au-dessus (render()) —
     "Voir plus" répété fait grimper `visibles` sans limite, un logo
     encore INCONNU au-delà de ce plafond ne doit pas lancer sa propre
     requête (un déjà en cache s'affiche quand même, voir avatar()). */
  return page.map((s,i)=>stockRow(s, {spark:true, logo: i < CHARGEMENT_MASSE_MAX_SYMBOLES})).join('') + (list.length > page.length
    ? `<button class="btn btn-ghost btn-sm" style="width:100%;margin-top:12px" data-markets-plus="1">
        Voir plus (${list.length - page.length} restants)</button>`
    : '');
}
/* Puces "filtres actifs" affichées sous la recherche — uniquement ceux
   réellement différents de leur valeur par défaut (jamais un mur de
   puces permanent, voir MARKETS_FILTER_DEFAULTS plus bas pour les
   valeurs de repli utilisées aussi par Réinitialiser et par le ×). */
const MARKETS_FILTER_DEFAULTS = { marketsCategory:'tous', marketsRegion:'Monde', marketsSector:'tous', marketsCountry:'tous' };
function marketsFiltresActifs(){
  const f = state.filters;
  const out = [];
  const cat = f.marketsCategory || 'tous';
  if (cat !== 'tous'){
    const c = MARKET_CATEGORIES.find(x=>x.id===cat);
    out.push({ key:'marketsCategory', label: c ? c.label : cat });
  }
  if ((f.marketsRegion||'Monde') !== 'Monde') out.push({ key:'marketsRegion', label:f.marketsRegion });
  if ((f.marketsSector||'tous') !== 'tous') out.push({ key:'marketsSector', label:f.marketsSector });
  if ((f.marketsCountry||'tous') !== 'tous') out.push({ key:'marketsCountry', label:f.marketsCountry });
  return out;
}
/* Puces de filtre rapide (demande explicite : "All | US | EU | FR | DE |
   UK") : région pour "Tous"/"Europe" (large), pays pour le reste
   (précis) — deux dimensions de state.filters déjà existantes
   (marketsRegion/marketsCountry), jamais un nouvel état inventé. Noms
   de pays/région exacts vérifiés dans REGION_OF_COUNTRY/COUNTRY_ALIASES
   (core.js) avant de les utiliser ici. */
const MARKETS_QUICK_FILTERS = [
  { id:'tous', label:'Tous', region:'Monde', country:'tous' },
  { id:'us', label:'US', region:'Monde', country:'États-Unis' },
  { id:'eu', label:'EU', region:'Europe', country:'tous' },
  { id:'fr', label:'FR', region:'Monde', country:'France' },
  { id:'de', label:'DE', region:'Monde', country:'Allemagne' },
  { id:'uk', label:'UK', region:'Monde', country:'Royaume-Uni' },
];
function marketsQuickFilterActif(f){
  const region = f.marketsRegion || 'Monde', country = f.marketsCountry || 'tous';
  const trouve = MARKETS_QUICK_FILTERS.find(q => q.region === region && q.country === country);
  return trouve ? trouve.id : null;
}
PAGES.markets = () => {
  /* Déclenche (sans bloquer ce rendu) le chargement du catalogue mondial
     pour stock/etf si nécessaire — voir garantirCatalogueMarkets(). */
  garantirCatalogueMarkets();
  const chips = marketsFiltresActifs();
  const quickActif = marketsQuickFilterActif(state.filters);
  return `<div class="page-in">
    <p class="eyebrow">Marchés</p>
    <h1 class="title">Marchés</h1>
    <p class="lead measure-l" style="margin-top:10px">Actions • ETF • Cryptos • Devises</p>
    <div style="display:flex;gap:10px;margin-top:22px">
      <button class="search-btn" style="margin:0;max-width:none;flex:1" data-search>
        ${svg(ICON.search)}<span>Rechercher une entreprise…</span></button>
      <button class="btn btn-s" data-open-market-filters
        style="flex:0 0 auto;display:inline-flex;align-items:center;gap:7px">
        ${svg(ICON.filter,2)} Filtres</button>
    </div>
    <div class="chips chips-scroll" style="margin-top:14px">
      ${MARKETS_QUICK_FILTERS.map(f=>`<button class="chip" data-mf-quick="${f.id}"
        aria-pressed="${quickActif===f.id}">${esc(f.label)}</button>`).join('')}
    </div>
    ${chips.length ? `<div class="chips" style="margin-top:10px">
      ${chips.map(c=>`<button class="chip" aria-pressed="true" data-mf-remove="${c.key}">
        ${esc(c.label)} <span aria-hidden="true">×</span></button>`).join('')}
    </div>` : ''}
    <div class="card" style="margin-top:18px"><div class="rows rows-grid" id="marketsOut">${marketsRows()}</div></div>
  </div>`;
};
/* ---------- Panneau Filtres de Marchés ----------
   Brouillon séparé de state.filters : les puces à l'intérieur du panneau
   ne s'appliquent qu'au clic sur "Afficher X résultats" (exigence
   explicite du brief), jamais immédiatement comme les puces classiques
   `[data-filter]` (Radar) — sinon fermer le panneau sans confirmer
   laisserait quand même les filtres modifiés. */
let marketsFilterDraft = null;
function openMarketsFilters(){
  marketsFilterDraft = {
    marketsCategory: state.filters.marketsCategory || 'tous',
    marketsRegion: state.filters.marketsRegion || 'Monde',
    marketsSector: state.filters.marketsSector || 'tous',
    marketsCountry: state.filters.marketsCountry || 'tous',
    _paysQ: '',
  };
  openSheet(`<h3 id="sheetTitle">Filtres</h3><div id="mfBody">${marketsFilterBodyHTML(marketsFilterDraft)}</div>`);
  wireMarketsPaysSearch();
}
function marketsFilterGroupe(titre, options, key, draft){
  return `<p class="tiny" style="text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin:16px 0 8px">${esc(titre)}</p>
    <div class="chips">${options.map(o=>`<button class="chip" data-mf="${key}" data-mf-val="${esc(o.val)}"
      aria-pressed="${String(draft[key])===o.val}">${esc(o.label)}</button>`).join('')}</div>`;
}
function marketsFilterBodyHTML(draft){
  const count = marketsListeFiltree(draft).length;
  const paysQ = (draft._paysQ || '').toLowerCase();
  const paysTous = marketsPaysDisponibles();
  const paysVisibles = paysQ ? paysTous.filter(p => p.toLowerCase().includes(paysQ)) : paysTous;
  return `<div style="max-height:52vh;overflow-y:auto;padding-right:2px;margin-top:2px">
      ${marketsFilterGroupe('Type d’actif', MARKET_CATEGORIES.map(c=>({val:c.id,label:c.label})), 'marketsCategory', draft)}
      ${marketsFilterGroupe('Zone géographique', REGIONS.map(r=>({val:r,label:r})), 'marketsRegion', draft)}
      ${marketsFilterGroupe('Secteur', ['tous',...SECTORS].map(s=>({val:s,label:s==='tous'?'Tous les secteurs':s})), 'marketsSector', draft)}
      <p class="tiny" style="text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin:16px 0 8px">Pays</p>
      <input class="field" id="mfPaysQ" type="text" placeholder="Rechercher un pays…"
        value="${esc(draft._paysQ||'')}" style="margin-bottom:10px">
      <div class="chips" id="mfPaysChips">
        <button class="chip" data-mf="marketsCountry" data-mf-val="tous"
          aria-pressed="${draft.marketsCountry==='tous'}">Tous les pays</button>
        ${paysVisibles.map(p=>`<button class="chip" data-mf="marketsCountry" data-mf-val="${esc(p)}"
          aria-pressed="${draft.marketsCountry===p}">${esc(p)}</button>`).join('')}
      </div>
    </div>
    <div class="btns" style="margin-top:18px">
      <button class="btn btn-s" data-mf-reset style="flex:1">Réinitialiser</button>
      <button class="btn btn-a" data-mf-apply style="flex:1">Afficher ${fmt.int(count)} résultat${count>1?'s':''}</button>
    </div>`;
}
function paintMarketsFilters(){
  const body = document.getElementById('mfBody');
  if (!body || !marketsFilterDraft) return;
  body.innerHTML = marketsFilterBodyHTML(marketsFilterDraft);
  wireMarketsPaysSearch();
}
/* Recherche dans la liste des pays (brief : "éventuellement recherche
   dans les pays") — ne filtre QUE les puces affichées dans le panneau,
   jamais la liste de résultats elle-même (aucun pays n'est sélectionné
   tant qu'on n'a pas cliqué une puce). Écouteur direct sur l'input
   (même schéma que la recherche globale, #sq) plutôt que la délégation
   de clic générique : ré-attaché à chaque re-rendu de #mfBody. */
function wireMarketsPaysSearch(){
  const input = document.getElementById('mfPaysQ');
  if (!input) return;
  input.addEventListener('input', () => {
    marketsFilterDraft._paysQ = input.value;
    const paysQ = input.value.toLowerCase();
    const paysTous = marketsPaysDisponibles();
    const paysVisibles = paysQ ? paysTous.filter(p => p.toLowerCase().includes(paysQ)) : paysTous;
    document.getElementById('mfPaysChips').innerHTML = `
      <button class="chip" data-mf="marketsCountry" data-mf-val="tous"
        aria-pressed="${marketsFilterDraft.marketsCountry==='tous'}">Tous les pays</button>
      ${paysVisibles.map(p=>`<button class="chip" data-mf="marketsCountry" data-mf-val="${esc(p)}"
        aria-pressed="${marketsFilterDraft.marketsCountry===p}">${esc(p)}</button>`).join('')}`;
  });
}

/* ---------- FICHE ENTREPRISE ---------- */
/* CORRECTIF (bug réel confirmé en test : ouvrir AAPL, cliquer l'onglet
   "Actions" — quasi vide, seulement Comparer/Liste/Alerte — puis revenir
   et ouvrir une AUTRE société rouvre AUSSI sur "Actions", donnant
   l'impression que "plein d'actions n'affichent absolument rien" alors
   que Vue d'ensemble (graphique, cours, fondamentaux) existe bel et bien
   mais n'est jamais affiché. Cause : state.ui.stockTab est UNE SEULE
   valeur globale persistée (localStorage), jamais réinitialisée par
   société. derniereFicheStockId permet de ne réinitialiser sur "Vue
   d'ensemble" QUE lors d'un changement RÉEL de société (jamais lors d'un
   simple re-render de la même fiche, ex. rafraîchissement du cours). */