/* ---------- LISTE DE SUIVI ---------- */
PAGES.watchlist = () => {
  const list = state.watchlist.map(id=>byId[id]).filter(Boolean);
  return `<div class="page-in">
    <p class="eyebrow">Suivi</p>
    <h1 class="title">Ma liste</h1>
    <p class="lead" style="margin-top:10px">${list.length} entreprise${list.length>1?'s':''} suivie${list.length>1?'s':''}.</p>
    <div class="card" style="margin-top:22px">
      ${list.length ? `<div class="rows rows-grid">${list.map(x=>stockRow(x)).join('')}</div>`
        : emptyState('Votre liste est vide',
            'Touchez l’étoile pour suivre une valeur. Sa note et son évolution vous attendront ici.',
            { go:'radar', label:'Parcourir le Radar' })}
    </div></div>`;
};

/* ---------- LISTES ORGANISÉES (§9) ---------- */
PAGES.lists = () => {
  const lists = state.lists;
  return `<div class="page-in">
    <div class="section-h" style="margin-bottom:20px">
      <div><p class="eyebrow">Organisation</p>
        <h1 class="title">Mes listes</h1>
        <p class="lead measure-l" style="margin-top:10px">Rangez vos valeurs par thème — dividendes, à surveiller, technologie…</p></div>
    </div>
    <button class="btn btn-a" style="margin-bottom:18px" data-new-list>${svg(ICON.plus,2)} Nouvelle liste</button>
    ${lists.length ? `<div class="rows">${lists.map(l => `
      <button class="row" data-go="listDetail" data-arg="${esc(l.id)}">
        <span class="av" style="background:${esc(l.color)}">${svg(ICON[l.icon] || ICON.star, 1.8)}</span>
        <span class="row-main"><span class="row-t">${esc(l.name)}</span>
          <span class="row-s">${l.items.length} valeur${l.items.length > 1 ? 's' : ''}</span></span>
      </button>`).join('')}</div>`
      : emptyState('Aucune liste pour l’instant',
          'Créez une première liste pour regrouper les valeurs qui vous intéressent par thème.', null)}
  </div>`;
};

PAGES.listDetail = (listId) => {
  const l = state.lists.find(x => x.id === listId);
  if (!l) return emptyState('Liste introuvable', 'Cette liste a peut-être été supprimée.', { go:'lists', label:'Retour à mes listes' });
  const items = l.items.map(id => byId[id]).filter(Boolean);
  return `<div class="page-in">
    <div class="section-h" style="margin-bottom:20px">
      <div><span class="av" style="background:${esc(l.color)}">${svg(ICON[l.icon] || ICON.star, 1.8)}</span>
        <h1 class="title" style="margin-top:10px">${esc(l.name)}</h1>
        <p class="lead" style="margin-top:6px">${items.length} valeur${items.length > 1 ? 's' : ''}</p></div>
    </div>
    <div class="btns" style="margin-bottom:18px">
      <button class="btn btn-s btn-sm" data-rename-list="${esc(l.id)}">Renommer</button>
      <button class="btn btn-s btn-sm" data-recolor-list="${esc(l.id)}">Couleur/icône</button>
      <button class="btn btn-s btn-sm" data-delete-list="${esc(l.id)}">Supprimer</button>
    </div>
    <div class="card">
      ${items.length ? `<div class="rows rows-grid">${items.map(x => stockRow(x)).join('')}</div>`
        : emptyState('Cette liste est vide',
            'Ouvrez une fiche action et utilisez « Ajouter à une liste » pour la remplir.',
            { go:'markets', label:'Explorer les entreprises' })}
    </div>
  </div>`;
};

/* ---------- PORTEFEUILLE ---------- */
/* Périodes de la courbe portefeuille — bornées par une durée réelle en
   millisecondes (pas des "séances" comme pour un titre coté : le
   portefeuille peut avoir des relevés les week-ends/jours fériés). */
const PF_PERIODS = ['1J','1S','1M','3M','6M','1A','MAX'];
const PF_PERIOD_MS = { '1J':86400000, '1S':7*86400000, '1M':30*86400000,
  '3M':90*86400000, '6M':180*86400000, '1A':365*86400000, MAX:Infinity };

/* Sous-ensemble RÉEL de walletHistory pour la période demandée — jamais un
   point interpolé/fabriqué. `Infinity` (MAX) renvoie tout l'historique tel
   quel : s'il commence aujourd'hui, la courbe MAX commence aujourd'hui. */
function walletHistoryPourPeriode(period){
  const ms = PF_PERIOD_MS[period] ?? PF_PERIOD_MS['1A'];
  if (!Number.isFinite(ms)) return state.walletHistory;
  const cutoff = Date.now() - ms;
  return state.walletHistory.filter(p => p.t >= cutoff);
}
/* §36 du prompt maître NovaTitre : "Différencier performance et flux de
   trésorerie [...] 10 000 € → dépôt de 5 000 € ne signifie PAS +50% de
   performance." Un dépôt/retrait survenu STRICTEMENT APRÈS le relevé de
   départ (startMs exclu — s'il a eu lieu AU relevé de départ, son effet
   est déjà dans sa totalValue, le compter une 2e fois serait l'erreur
   inverse) et jusqu'au relevé de fin inclus doit être retiré du gain de
   la période avant de calculer une performance, sinon l'argent simplement
   apporté/retiré se confond avec un vrai gain/perte de marché. */
function fluxNetPeriode(startMs, endMs){
  let net = 0;
  for (const tx of state.transactions){
    if (tx.type !== 'deposit' && tx.type !== 'withdraw') continue;
    const t = new Date(tx.date).getTime();
    if (!(t > startMs && t <= endMs)) continue;
    net += tx.type === 'deposit' ? tx.amountEUR : -tx.amountEUR;
  }
  return net;
}
