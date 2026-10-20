/* ============================================================
   DESIGN V2 — pages de la maquette novatitre-v2.html (2026-10-19)
   ============================================================
   Chaque PAGES.x ci-dessous REMPLACE la version précédente (chargé après
   les fichiers page-*.js) avec le balisage exact de la maquette, alimenté
   par les vraies données. Les gestionnaires d'événements existants
   (data-stock, data-go, data-search, data-plan, data-cycle...) sont
   réutilisés tels quels : aucune fonctionnalité dupliquée. */

/* Valeurs "Les plus populaires" (8 tuiles, comme la maquette). */
const V2_POPULAIRES = {
  actions: ['AAPL-NAS', 'MSFT-NAS', 'NVDA-NAS', 'GOOGL-NAS', 'AMZN-NAS', 'TSLA-NAS', 'META-NAS', 'ASML-NAS'],
  etf: ['SPY-NYA', 'QQQ-NAS', 'VTI-NYA', 'IWM-NYA', 'GLD-NYA', 'EEM-NYA', 'AGG-NYA', 'VNQ-NYA'],
};
/* Fiches catalogue des 16 valeurs "Les plus populaires" (extraites de
   catalog.json le 2026-10-19), enregistrées tout de suite pour que l'accueil
   n'attende pas le catalogue complet (~930 Ko), même principe que
   TOP_SYMBOLES_PRECHARGES. Ignorées si le catalogue les a déjà fournies. */
const V2_POPULAIRES_FICHES = [{"id":"AAPL-NAS","name":"Apple Inc","ticker":"AAPL","market":"NASDAQ","exchangeCode":"NASDAQ","sector":"Technologie","country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"stock"},{"id":"MSFT-NAS","name":"Microsoft Corporation","ticker":"MSFT","market":"NASDAQ","exchangeCode":"NASDAQ","sector":"Technologie","country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"stock"},{"id":"NVDA-NAS","name":"NVIDIA Corporation","ticker":"NVDA","market":"NASDAQ","exchangeCode":"NASDAQ","sector":"Technologie","country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"stock"},{"id":"GOOGL-NAS","name":"Alphabet Inc Class A","ticker":"GOOGL","market":"NASDAQ","exchangeCode":"NASDAQ","sector":"Télécommunications","country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"stock"},{"id":"AMZN-NAS","name":"Amazon.com Inc","ticker":"AMZN","market":"NASDAQ","exchangeCode":"NASDAQ","sector":"Consommation","country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"stock"},{"id":"TSLA-NAS","name":"Tesla Inc","ticker":"TSLA","market":"NASDAQ","exchangeCode":"NASDAQ","sector":"Consommation","country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"stock"},{"id":"META-NAS","name":"Meta Platforms Inc.","ticker":"META","market":"NASDAQ","exchangeCode":"NASDAQ","sector":"Télécommunications","country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"stock"},{"id":"ASML-NAS","name":"ASML Holding N.V.","ticker":"ASML","market":"NASDAQ","exchangeCode":"NASDAQ","sector":"Technologie","country":"Pays-Bas","cur":"EUR","curSymbol":"€","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"stock"},{"id":"SPY-NYA","name":"SPDR S&P 500 ETF Trust","ticker":"SPY","market":"NYSE Arca","exchangeCode":"NYSE ARCA","sector":null,"country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"etf"},{"id":"QQQ-NAS","name":"Invesco QQQ Trust","ticker":"QQQ","market":"NASDAQ","exchangeCode":"NASDAQ","sector":null,"country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"etf"},{"id":"VTI-NYA","name":"Vanguard Total Stock Market Index Fund ETF Shares","ticker":"VTI","market":"NYSE Arca","exchangeCode":"NYSE ARCA","sector":null,"country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"etf"},{"id":"IWM-NYA","name":"iShares Russell 2000 ETF","ticker":"IWM","market":"NYSE Arca","exchangeCode":"NYSE ARCA","sector":null,"country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"etf"},{"id":"GLD-NYA","name":"SPDR® Gold Shares","ticker":"GLD","market":"NYSE Arca","exchangeCode":"NYSE ARCA","sector":null,"country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"etf"},{"id":"EEM-NYA","name":"iShares MSCI Emerging Markets ETF","ticker":"EEM","market":"NYSE Arca","exchangeCode":"NYSE ARCA","sector":null,"country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"etf"},{"id":"AGG-NYA","name":"iShares Core U.S. Aggregate Bond ETF","ticker":"AGG","market":"NYSE Arca","exchangeCode":"NYSE ARCA","sector":null,"country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"etf"},{"id":"VNQ-NYA","name":"Vanguard Real Estate Index Fund ETF Shares","ticker":"VNQ","market":"NYSE Arca","exchangeCode":"NYSE ARCA","sector":null,"country":"États-Unis","cur":"USD","curSymbol":"$","score":null,"scores":{},"coverage":0,"partial":true,"fundamentals":null,"hasFundamentals":false,"fundamentalsSource":null,"companyIdentity":null,"fundamentalsStatus":"idle","volatility":null,"volRisk":null,"momentum":null,"marketCapEUR":null,"type":"etf"}];
for (const s of V2_POPULAIRES_FICHES){ if (!byId[s.id]){ stocks.push(s); byId[s.id] = s; } }
const V2_UI = { marketTab: 'actions' };
function v2populaires(){
  return V2_POPULAIRES[V2_UI.marketTab].map(id => byId[id]).filter(Boolean);
}

/* ---------- héros NovaBot (heroBot() de la maquette) ----------
   Pas de portefeuille réel à afficher : le même cadre présente NovaBot
   comme analyste conversationnel, champ "Écris à Nova…" réellement
   branché sur la conversation. */
function v2heroBot(){
  const cfg = state.novabot;
  const actif = cfg.mandateConfirmed && cfg.enabled;
  return `<article class="v-hero v-bot">
    <div class="v-hero-tag"><span class="v-chess">${V2ICON.rook}</span>NovaBot${actif ? '<span class="v-status"><i></i>Actif</span>' : ''}</div>
    <p class="v-big v2-big-txt">Ton analyste IA</p>
    <p class="v-sub">Analyse une entreprise, explique une stratégie, répond à tes questions.</p>
    <div class="v-sugg v2-hero-sugg">${["Que penses-tu d'Apple ?", 'Explique-moi le PER'].map(q =>
      `<button type="button" data-v2ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form class="v-ask" data-v2ask-form style="margin-top:14px"><input placeholder="Écris à Nova…" aria-label="Écrire à NovaBot"><button class="v-send" aria-label="Envoyer">${V2ICON.up}</button></form>
  </article>`;
}

/* ---------- héros Nova Review (heroReview() de la maquette) ----------
   Jauge = part réelle de bonnes décisions de la semaine (resumeNova-
   ReviewPourCarte), jamais un score inventé. */
function v2heroReview(){
  const r = resumeNovaReviewPourCarte();
  const avecBilan = r && r.total > 0;
  const part = avecBilan ? Math.round(r.bonnes / r.total * 100) : 0;
  return `<article class="v-hero v-rev">
    <div class="v-hero-tag"><span class="v-chess">${V2ICON.knight}</span>Nova Review</div>
    <div class="v-gauge-wrap">
      ${v2gauge(part, avecBilan ? '% réussies' : 'à venir', ['#ff8fd0', '#a68cff'])}
      <div class="v-kpis"><p class="v-label" style="color:#ff8fd0">Bilan de la semaine</p>
        ${avecBilan ? `
        <span class="v-kpi"><i style="background:var(--v-up)"></i>${r.bonnes} bonne${r.bonnes > 1 ? 's' : ''} décision${r.bonnes > 1 ? 's' : ''}</span>
        <span class="v-kpi"><i style="background:var(--v-down)"></i>${r.erreurs + r.surveiller} à revoir</span>`
        : `<span class="v-kpi" style="font-size:14px;color:var(--v-ink2)">Aucune décision à analyser cette semaine.</span>`}
      </div>
    </div>
    <div class="v-tip"><b>Comment ça marche</b>Nova Review relit chacune de tes décisions et te montre ce que tu aurais pu faire autrement.</div>
    <div class="v-cta-row"><button class="v-cta" data-go="novareview">Voir mon analyse</button></div>
  </article>`;
}

/* ---------- lignes compactes Nova News / Nova Event ---------- */
function v2miniNova(){
  const news = WORLD_NEWS.status === 'loaded' && WORLD_NEWS.items.length ? WORLD_NEWS.items[0] : null;
  const evts = stocksSuivisPourEvenements().length ? evenementsSuivis() : [];
  const p = evts[0] || null;
  return `<section class="v-sec v-card v-mini" style="padding:6px 18px">
    <button class="v-mini-row" data-go="novanews"><span class="v-chess" style="background:#2e3a7a">${V2ICON.bishop}</span>
      <span class="v-t" style="text-align:left"><b>Nova News</b><span>${news ? esc(news.title) : "L'actualité qui peut influencer tes investissements"}</span></span>${V2ICON.chev}</button>
    <button class="v-mini-row" data-go="novaevent"><span class="v-chess" style="background:#1f4a6b">${V2ICON.pawn}</span>
      <span class="v-t" style="text-align:left"><b>Nova Event</b><span>${p
        ? `${p.type === 'earnings' ? 'Résultats' : 'Dividende'} ${esc(p.ticker)} le ${dateEvenementAffichee(p.date)} · ${evts.length} événement${evts.length > 1 ? 's' : ''}`
        : 'Résultats et dividendes de tes entreprises'}</span></span>${V2ICON.chev}</button>
  </section>`;
}

/* ---------- offres (offersSection() de la maquette) ---------- */
const V2_PLANS = [
  { id:'free', nom:'Découverte', mois:0, an:0, icon:'pawn', col:'#2e3a7a',
    pitch:'Comprendre les marchés et suivre quelques entreprises.',
    feat:['Cours et fondamentaux réels', '10 entreprises suivies', '5 analyses Nova AI par mois'] },
  { id:'pro', nom:'Pro', mois:9.99, an:79, icon:'knight', col:'var(--v-accent)', best:true,
    pitch:'Analyser sérieusement, sans limite de suivi.',
    feat:['Tout Découverte', 'Suivi et alertes illimités', '200 analyses Nova AI par mois', 'Comparateur', 'Historique complet des scores'] },
  { id:'elite', nom:'Elite', mois:19.99, an:159, icon:'rook', col:'#c9a227',
    pitch:"L'analyse la plus poussée, sans plafond.",
    feat:['Tout Pro', 'Analyses illimitées', "Comparateur jusqu'à 5 entreprises", 'NovaBot avancé', 'Support prioritaire'] },
];
function v2offerCards(){
  const annuel = CONFIG.annualBilling && state.settings.cycle === 'annuel';
  return V2_PLANS.map(P => {
    const current = (state.settings.plan || 'free') === P.id;
    const price = P.id === 'free' ? 'Gratuit'
      : annuel ? `${v2nf(P.an / 12, 2)} €<small>/ mois</small>` : `${v2nf(P.mois, 2)} €<small>/ mois</small>`;
    const per = P.id === 'free' ? 'Pour toujours'
      : annuel ? `soit ${P.an} € par an · 34 % d'économie` : CONFIG.annualBilling ? `ou ${P.an} € par an en annuel` : '';
    return `<article class="v-plan ${P.best ? 'v-best' : ''}">${P.best ? '<span class="v-ribbon">Le plus choisi</span>' : ''}
      <div class="v-nm"><span class="v-chess" style="background:${P.col}">${V2ICON[P.icon]}</span>${P.nom}</div>
      <p class="v-price v-num">${price}</p><p class="v-per">${per}</p><p class="v-pitch">${P.pitch}</p>
      <ul>${P.feat.map(f => `<li>${V2ICON.check}${f}</li>`).join('')}</ul>
      ${current ? '<button class="v-big-cta v-cur" disabled>Offre actuelle</button>'
        : P.id === 'free' ? '' : `<button class="v-big-cta ${P.best ? 'v-violet' : ''}" data-plan="${P.id}">Choisir ${P.nom}</button>`}
    </article>`;
  }).join('');
}
function v2offersSection(){
  const annuel = state.settings.cycle === 'annuel';
  return `<section class="v-offers" id="offres"><p class="v-eyebrow">Offres</p><h2>Commencez gratuitement.</h2>
    <p class="v-lead">L'essentiel est gratuit. Passe à la vitesse supérieure quand tu veux.</p>
    ${CONFIG.annualBilling ? `<div class="v-bill"><div class="v-seg"><span class="v-knob"></span>
      <button type="button" data-cycle="mensuel" class="${annuel ? '' : 'v-on'}">Mensuel</button>
      <button type="button" data-cycle="annuel" class="${annuel ? 'v-on' : ''}">Annuel −34 %</button></div></div>` : ''}
    <div id="offerCards">${v2offerCards()}</div>
    <p class="v-trust">Sans engagement · Paiement sécurisé · Résiliable en un clic</p></section>`;
}

/* ---------- Accueil (PAGES.home de la maquette) ---------- */
PAGES.home = () => {
  const suivies = state.watchlist.map(id => byId[id]).filter(Boolean);
  const prenom = v2prenom();
  const intro = !v2TempleVu;
  v2TempleVu = true;
  return `<div class="v-page">
  <section class="v-temple${intro ? '' : ' v2-no-intro'}" id="v2temple">${V2_TEMPLE}</section>
  <div class="v-quick">
    <button data-search><span class="v-ring">${V2ICON.search}</span>Rechercher</button>
    <button data-search data-search-intent="analyze"><span class="v-ring">${V2ICON.rook}</span>Analyser avec l'IA</button>
    <button data-search data-search-intent="buy"><span class="v-ring">${V2ICON.plus}</span>Ajouter</button>
    <button data-search data-search-intent="alert"><span class="v-ring">${V2ICON.bell}</span>Alerte</button>
  </div>
  <div class="v-hello"><h1>${esc(saluationJour())}${prenom ? ' ' + esc(prenom) : ''}</h1><p>Voici ce qui bouge sur les marchés aujourd'hui.</p></div>
  <section class="v-sec"><div class="v-rail" data-v2rail="heroDots">${v2heroBot()}${v2heroReview()}</div>
    <div class="v-dots" id="heroDots"><i class="v-on"></i><i></i></div></section>
  ${v2miniNova()}
  <section class="v-sec"><div class="v-sec-h"><h2>Ma liste</h2>${suivies.length ? `<button class="v-link" data-go="watchlist">Tout voir ${V2ICON.chev}</button>` : ''}</div>
    <div class="v-card" style="padding:8px 18px 18px">${suivies.length
      ? suivies.slice(0, 3).map(s => v2row(s, { spark:true })).join('')
      : `<p class="v-sub" style="padding:12px 0 0">Touche l'étoile sur une entreprise pour la suivre ici.</p>`}</div></section>
  <section class="v-sec"><div class="v-sec-h"><h2>Les plus populaires</h2><button class="v-link" data-go="markets">Marchés ${V2ICON.chev}</button></div>
    <div class="v-card">${v2seg('v2marketTab', [['actions', 'Actions'], ['etf', 'ETF']], V2_UI.marketTab)}
      <div class="v-grid4" id="v2popGrid">${v2tiles(v2populaires())}</div></div></section>
  ${v2offersSection()}
  </div>`;
};

/* ---------- interactions propres au design v2 ---------- */
document.addEventListener('click', e => {
  const sv = e.target.closest('[data-v2segv]');
  if (sv){
    const seg = sv.closest('[data-v2seg]');
    const key = seg.dataset.v2seg;
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('v-on', b === sv));
    v2syncSegs(seg.parentElement);
    if (key === 'v2marketTab'){
      V2_UI.marketTab = sv.dataset.v2segv;
      const grid = document.getElementById('v2popGrid');
      if (grid){
        grid.style.opacity = 0;
        setTimeout(() => { grid.innerHTML = v2tiles(v2populaires()); grid.style.opacity = 1; assurerCotations(v2populaires()); }, 150);
      }
    }
    if (typeof V2_SEG_HANDLERS === 'object' && V2_SEG_HANDLERS[key]) V2_SEG_HANDLERS[key](sv.dataset.v2segv, sv);
    return;
  }
  const ask = e.target.closest('[data-v2ask]');
  if (ask){ v2envoyerANova(ask.dataset.v2ask); }
});
document.addEventListener('submit', e => {
  const form = e.target.closest('[data-v2ask-form]');
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector('input');
  const v = input.value.trim();
  input.value = '';
  v2envoyerANova(v);
});
/* Champ "Écris à Nova…" : ouvre la conversation NovaBot et envoie le
   message par le même chemin que la saisie normale. */
function v2envoyerANova(texte){
  NOVABOT_UI.view = 'chat';
  go('novabot');
  if (texte) setTimeout(() => novabotChatEnvoyer(texte), 60);
}
const V2_SEG_HANDLERS = {};

/* ---------- données supplémentaires par page (cotations / courbes) ---------- */
const V2_EXTRAS = {
  cotations: {
    markets: () => [...v2cryptos(), ...v2universMouvements()],
    radar: () => RADAR_AFFICHES,
  },
  courbes: {
    home: () => state.watchlist.slice(0, 3).map(id => byId[id]),
    markets: () => v2cryptos(),
    radar: () => RADAR_AFFICHES.slice(0, CHARGEMENT_MASSE_MAX_SYMBOLES),
    watchlist: () => state.watchlist.map(id => byId[id]),
  },
};
function v2extrasCotations(page){ return ((V2_EXTRAS.cotations[page] || (() => []))()).filter(Boolean); }
function v2extrasCourbes(page){ return ((V2_EXTRAS.courbes[page] || (() => []))()).filter(Boolean); }

/* Bitcoin / Ethereum : même mécanisme que les résultats de recherche
   (ensureRuntimeStock), symbole "BTC-USD" sur la place crypto CC —
   vérifié sur l'API de cotations et d'historique en production. */
let V2_CRYPTOS = null;
function v2cryptos(){
  if (!V2_CRYPTOS) V2_CRYPTOS = [
    ensureRuntimeStock({ ticker:'BTC-USD', name:'Bitcoin', exchangeCode:'CC', assetType:'crypto', currency:'USD', sector:'Crypto' }, false),
    ensureRuntimeStock({ ticker:'ETH-USD', name:'Ethereum', exchangeCode:'CC', assetType:'crypto', currency:'USD', sector:'Crypto' }, false),
  ].filter(Boolean);
  return V2_CRYPTOS;
}

/* Plus fortes variations : calculées sur les valeurs réellement cotées
   (populaires + liste affichée + liste de suivi), jamais inventées. */
function v2universMouvements(){
  const ids = new Set([...V2_POPULAIRES.actions, ...V2_POPULAIRES.etf, ...state.watchlist]);
  marketsListeVisible().forEach(s => s && ids.add(s.id));
  return [...ids].map(id => byId[id]).filter(Boolean);
}
function v2mouvements(sens){
  const cotees = v2universMouvements()
    .map(s => ({ s, v: v2quote(s).varPct }))
    .filter(x => x.v !== null && (sens === 'top' ? x.v > 0 : x.v < 0));
  cotees.sort((a, b) => sens === 'top' ? b.v - a.v : a.v - b.v);
  return cotees.slice(0, 8).map(x => x.s);
}

/* ---------- Marchés (PAGES.markets de la maquette) ---------- */
V2_UI.moversTab = 'top';
const V2_CATS = [['stock', 'Actions'], ['etf', 'ETF'], ['crypto', 'Crypto'], ['index', 'Indices'], ['forex', 'Devises']];
function v2cryptoCard(c){
  const { prix, varPct } = v2quote(c);
  const sd = v2sparkData(c);
  return `<button class="v-card" data-stock="${esc(c.id)}" style="text-align:left"><div class="v-h"><span class="v-label">${esc(c.ticker.split('-')[0])}</span>${v2logo(c)}</div>
    <p class="v-val v-num">${prix === null ? '—' : v2nf(prix, prix < 10000 ? 2 : 0) + ' $'}</p><span class="${varPct === null ? '' : v2cls(varPct)}" style="font-weight:700;font-size:14px">${varPct === null ? '' : v2var(varPct)}</span>
    <div class="v-chart">${sd ? v2area(sd, (varPct ?? 0) >= 0 ? 'var(--v-up)' : 'var(--v-down)', { base:true }) : ''}</div></button>`;
}
function v2moversGrid(){
  const m = v2mouvements(V2_UI.moversTab);
  return m.length ? v2tiles(m) : `<p class="v-sub" style="grid-column:1/-1;text-align:center">Les variations apparaissent dès que les cours sont reçus.</p>`;
}
PAGES.markets = () => {
  const f = state.filters;
  const cat = f.marketsCategory || 'tous';
  const live = DATA.mode === 'live';
  const list = marketsListeFiltree();
  const visibles = f.marketsVisibles || 20;
  const page = list.slice(0, visibles);
  const filtres = marketsFiltresActifs();
  return `<div class="v-page">
  <div class="v-ph"><h1>Marchés</h1></div>
  <button class="v-search" style="margin-top:14px;width:100%" data-search>${V2ICON.search}<span style="flex:1;text-align:left;font-size:16px">Action, ETF, crypto…</span></button>
  <div class="v-chips" style="margin-top:14px">
    <span class="v-chip"><span class="v-rec"${live ? '' : ' style="background:#e0a63a;box-shadow:0 0 0 3px rgba(224,166,58,.16)"'}></span>${live ? 'Live' : 'Différé'}</span>
    ${V2_CATS.map(([v, l]) => `<button class="v-chip ${cat === v ? 'v-on' : ''}" data-v2cat="${v}">${l}</button>`).join('')}
  </div>
  <section class="v-sec v-duo">${v2cryptos().map(v2cryptoCard).join('')}</section>
  <section class="v-sec"><div class="v-sec-h"><h2>Plus fortes variations</h2></div>
    <div class="v-card">${v2seg('v2movers', [['top', 'En hausse'], ['flop', 'En baisse']], V2_UI.moversTab)}<div class="v-grid4" id="v2moversGrid">${v2moversGrid()}</div></div></section>
  <section class="v-sec"><div class="v-sec-h"><h2>${cat === 'tous' ? 'Toutes les valeurs' : esc((MARKET_CATEGORIES.find(c => c.id === cat) || {}).label || 'Valeurs')}</h2><button class="v-link" data-open-market-filters>Filtres${filtres.length ? ` (${filtres.length})` : ''} ${V2ICON.chev}</button></div>
    <div class="v-card" style="padding:8px 18px">${page.length
      ? page.map(s => v2row(s, { spark:true })).join('')
        + (list.length > page.length ? `<button class="v-more" data-markets-plus="1">Voir plus (${list.length - page.length} restants)</button>` : '')
      : `<p class="v-sub" style="padding:14px 0">Aucun instrument ne correspond à ce filtre.</p>`}</div></section>
  </div>`;
};
V2_SEG_HANDLERS.v2movers = v => {
  V2_UI.moversTab = v;
  const grid = document.getElementById('v2moversGrid');
  if (grid){ grid.style.opacity = 0; setTimeout(() => { grid.innerHTML = v2moversGrid(); grid.style.opacity = 1; }, 150); }
};
document.addEventListener('click', e => {
  const c = e.target.closest('[data-v2cat]');
  if (!c) return;
  const v = c.dataset.v2cat;
  /* Re-cliquer la catégorie active revient à "Tous", comme un filtre. */
  state.filters.marketsCategory = state.filters.marketsCategory === v ? 'tous' : v;
  state.filters.marketsVisibles = 20;
  saveState();
  render();
});
