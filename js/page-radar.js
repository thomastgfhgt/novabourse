PAGES.radar = () => {
  const f = state.filters;
  return `<div class="page-in">
  <div class="section-h" style="margin-bottom:20px">
    <div><p class="eyebrow">Radar</p>
      <h1 class="title">Radar</h1>
      <p class="lead measure-l" style="margin-top:10px">Filtrez par critères. Trouvez votre prochain investissement.</p></div>
  </div>

  <div class="card" style="margin-bottom:18px">
    <!-- CORRECTIF (audit "recherche sans effet", 2026-09-17) : ce bouton
         ouvrait auparavant la recherche universelle (data-search -> openSearch,
         navigation vers une fiche), sans aucun rapport avec les filtres
         ci-dessous malgré le texte "décrivez ce que vous cherchez" - une
         requête tapée là n'affectait jamais radarQ ni aucun filtre. Remplacé
         par une vraie saisie de requête, avec interprétation locale instantanée
         (parseNaturalQuery) et, en option, une interprétation par IA réelle
         (/api/analyze, mode screener) pour les requêtes que la regex ne couvre pas. -->
    <button class="search-btn" style="margin:0 0 16px;max-width:100%" data-describe-search>
      ${svg(ICON.search)}<span>${f.radarQ ? esc(f.radarQ) : 'Décrire ce que vous cherchez…'}</span></button>
    <div class="chips" style="margin-bottom:10px">
      ${['Une grande entreprise américaine solide','Peu risqué et rentable','Croissance forte']
        .map(q=>`<button class="chip" data-nl="${esc(q)}">${svg(ICON.spark,2)}${esc(q)}</button>`).join('')}
    </div>
    <div class="divider"></div>
    ${filterRow('Trier par', 'radarSort', [['perf','Performance du jour'],['score','Nova Score'],['name','Nom']])}
    ${filterRow('Nova Score minimum', 'radarMin', [['0','Tous'],['50','50+'],['60','60+'],['70','70+']])}
    ${f.radarMin > 0 ? `<p class="tiny" style="margin-top:6px;color:var(--ink-4)">Ne porte que sur les valeurs déjà analysées (bouton « Analyse » sur une fiche) — les autres n'ont pas encore de Nova Score.</p>` : ''}
    ${filterRow('Pays', 'radarCountry', [['tous','Tous'],
      ...[...new Set(stocks.map(x=>paysAffiche(x.country)).filter(Boolean))].map(c=>[c,c])])}
    ${filterRow('Secteur', 'radarSector', [['tous','Tous'],...SECTORS.map(x=>[x,x])])}
  </div>

  <div id="radarOut"></div></div>`;
};
function filterRow(label, key, options){
  const cur = String(state.filters[key]);
  return `<div style="margin-top:14px">
    <p class="tiny" style="margin-bottom:8px;font-weight:600;color:var(--ink-3)">${esc(label)}</p>
    <div class="chips">${options.map(([v,l])=>`
      <button class="chip" data-filter="${key}" data-val="${esc(String(v))}"
        aria-pressed="${cur===String(v)}">${esc(l)}</button>`).join('')}</div>
  </div>`;
}
function parseNaturalQuery(q){
  const t = q.toLowerCase(), f = { radarMin:0, radarCountry:'tous', radarSector:'tous' };
  const applied = [];
  /* "Risque" retiré (audit "screener sans effet", 2026-09-17) : aucune
     métrique de risque n'est réellement calculée nulle part dans NovaTitre
     à ce jour (s.volRisk n'est jamais assigné) — le filtre correspondant a
     été retiré de l'UI pour la même raison. Ne pas en réintroduire un ici
     sans construire d'abord le calcul réel derrière. */
  if (/solide|s[ûu]r|qualit[ée]|rentable/.test(t)){ f.radarMin=70; applied.push('Nova Score de 70 et plus'); }
  if (/croissance|qui grandit|en forte hausse/.test(t)){ f.radarMin=Math.max(f.radarMin,60); applied.push('croissance recherchée'); }
  if (/am[ée]ricain|[ée]tats-unis|usa/.test(t)){ f.radarCountry='États-Unis'; applied.push('États-Unis'); }
  if (/fran[çc]ais|france/.test(t)){ f.radarCountry='France'; applied.push('France'); }
  if (/allemand|allemagne/.test(t)){ f.radarCountry='Allemagne'; applied.push('Allemagne'); }
  SECTORS.forEach(sec => { if (t.includes(sec.toLowerCase().slice(0,6))){ f.radarSector=sec; applied.push(sec.toLowerCase()); } });
  if (/grosse|grande|g[ée]ant|large/.test(t)) applied.push('grande capitalisation');
  return { filters:f, applied, big:/grosse|grande|g[ée]ant|large/.test(t) };
}
function radarResults(){
  const f = state.filters;
  let list = [...stocks];
  if (f.radarCountry !== 'tous') list = list.filter(s => paysAffiche(s.country) === f.radarCountry);
  if (f.radarSector !== 'tous')  list = list.filter(s => s.sector === f.radarSector);
  if (f.radarQ){ const q = f.radarQ.toLowerCase();
    list = list.filter(s => (s.name + ' ' + s.ticker + ' ' + s.sector).toLowerCase().includes(q)); }
  /* CORRECTIF (audit "screener sans effet", 2026-09-17) : ce filtre existait
     dans state.filters et dans le sélecteur ci-dessus mais n'était encore
     appliqué nulle part ici — activer "60+" ne changeait donc jamais la
     liste. Ne porte QUE sur les valeurs ayant un score RÉELLEMENT calculé
     (Number.isFinite) : jamais un score à 0/deviné pour une valeur jamais
     analysée, qui serait simplement exclue plutôt que faussement notée. */
  if (f.radarMin > 0) list = list.filter(s => Number.isFinite(s.score) && s.score >= f.radarMin);

  /* CORRECTIF (audit "tri Radar", 2026-09-17) : radarSort existait dans
     state.filters (valeur par défaut 'score') depuis le début, sans aucun
     contrôle UI ni lecture ici — le tri était TOUJOURS par variation du
     jour, quelle que soit sa valeur. Ajout d'un vrai sélecteur (voir
     filterRow ci-dessous dans PAGES.radar) + application réelle ici. */
  const varDe = s => { const q = QUOTES.get(s.id);
    return q && Number.isFinite(q.changePercent) ? q.changePercent : null; };
  const sortKey = f.radarSort || 'perf';
  list.sort((a, b) => {
    if (sortKey === 'score') {
      const sa = Number.isFinite(a.score) ? a.score : null, sb = Number.isFinite(b.score) ? b.score : null;
      if (sa === null && sb === null) return a.name.localeCompare(b.name, 'fr');
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sb - sa;
    }
    if (sortKey === 'name') return a.name.localeCompare(b.name, 'fr');
    const va = varDe(a), vb = varDe(b);
    if (va === null && vb === null) return a.name.localeCompare(b.name, 'fr');
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  });

  if (!list.length) return `<div class="card">${emptyState('Aucune entreprise ne correspond',
    'Élargissez un critère : le Radar n’ajoute jamais de résultat approchant.')}</div>`;

  return `
    <p class="small" style="margin-bottom:12px">${list.length} résultat${list.length>1?'s':''}</p>
    <div class="card"><div class="rows rows-grid">
      ${list.slice(0, 40).map(s => stockRow(s)).join('')}
    </div></div>`;
}

/* ---------- MARCHÉS ----------
   Fusionnée avec Explorer le 2026-09-23 (voir NAV plus bas) : Explorer
   affichait en permanence un "mur" de puces secteur/pays au-dessus d'un
   catalogue d'entreprises uniquement ; Marchés couvrait déjà toutes les
   catégories (actions/ETF/forex/crypto/indices/matières premières) mais
   sans secteur/pays. Cette page réunit les deux : recherche + bouton
   Filtres (panneau) + puces des filtres RÉELLEMENT actifs + liste,
   plutôt que deux pages et deux jeux de filtres séparés. Aucune capacité
   de filtrage perdue : secteur/pays d'Explorer sont repris tels quels
   (voir marketsSector/marketsCountry), simplement déplacés dans le
   panneau au lieu d'être affichés en permanence. Chargement léger
   uniquement : identité + quote déjà connue via QUOTES (lazy-loading
   intact — aucun graphique/fondamentaux/actualité chargé depuis cette
   page). */
/* Types du catalogue mondial réellement utiles à une catégorie Marchés
   donnée — voir CATALOG_TYPES : jamais forex/crypto (dataset sans ces
   actifs, voir plus haut), 'tous' réclame donc les deux types couverts.
   Secteur/pays n'ont de sens que pour les actions (voir plus bas) : pas
   besoin d'étendre cette liste pour eux, un secteur/pays sélectionné sur
   une autre catégorie donne simplement 0 résultat (aucune société ETF/
   forex/crypto n'a de secteur ou de pays renseigné — comportement logique,
   pas un bug). */