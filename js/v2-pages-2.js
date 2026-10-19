/* ============================================================
   DESIGN V2 — Radar, Portefeuille, Compte (maquette novatitre-v2.html)
   ============================================================
   Suite de js/v2-pages.js (mêmes principes : balisage exact de la
   maquette, données réelles, gestionnaires existants réutilisés). */

/* ---------- Radar (PAGES.radar de la maquette) ----------
   Mêmes filtres réels qu'avant (state.filters.radar*, data-filter, data-nl,
   data-describe-search) ; résultats rendus par radarResults() dans #radarOut. */
const V2_RADAR_PAYS = [['tous', 'Tous'], ['États-Unis', 'États-Unis'], ['France', 'France']];
PAGES.radar = () => {
  const f = state.filters;
  const paysCourant = String(f.radarCountry);
  const paysHorsListe = !V2_RADAR_PAYS.some(([v]) => v === paysCourant);
  const autres = (f.radarSector !== 'tous' ? 1 : 0) + ((f.radarSort || 'perf') !== 'perf' ? 1 : 0);
  return `<div class="v-page">
  <div class="v-ph"><h1>Radar</h1></div>
  <p class="v-sub" style="font-size:15px">Filtre par critères et trouve ton prochain investissement.</p>
  <button class="v-search" style="margin-top:16px;width:100%" data-describe-search>${V2ICON.search}<span style="flex:1;text-align:left;font-size:16px${f.radarQ ? ';color:#fff' : ''}">${f.radarQ ? esc(f.radarQ) : 'Décris ce que tu cherches…'}</span></button>
  <div class="v-chips" style="margin-top:12px">${['Grande entreprise américaine solide', 'Peu risqué et rentable', 'Croissance forte']
    .map(x => `<button class="v-chip" data-nl="${esc(x)}">✦ ${esc(x)}</button>`).join('')}</div>
  <section class="v-sec v-card">
    <p class="v-label">Pays</p>
    <div class="v-chips" style="margin:10px -20px 0;padding:2px 20px">${V2_RADAR_PAYS.map(([v, l]) =>
      `<button class="v-chip ${paysCourant === v ? 'v-on' : ''}" data-filter="radarCountry" data-val="${esc(v)}">${esc(l)}</button>`).join('')}
      ${paysHorsListe ? `<button class="v-chip v-on" data-filter="radarCountry" data-val="${esc(paysCourant)}">${esc(paysCourant)}</button>` : ''}
      <button class="v-chip" data-v2radar-plus>Plus de critères${autres ? ` (${autres})` : ''} ${V2ICON.chev}</button></div>
    <p class="v-label" style="margin-top:18px">Nova Score minimum</p>
    ${v2seg('v2radarMin', [['0', 'Tous'], ['50', '50+'], ['60', '60+'], ['70', '70+']], String(f.radarMin))}
    ${f.radarMin > 0 ? `<p class="v-legal" style="text-align:left;margin-top:10px">Ne porte que sur les valeurs déjà analysées — les autres n'ont pas encore de Nova Score.</p>` : ''}
  </section>
  <div id="radarOut"></div>
  </div>`;
};
V2_SEG_HANDLERS.v2radarMin = v => {
  state.filters.radarMin = +v;
  saveState();
  render();
};
/* Pays, secteur et tri complets dans un panneau (la maquette n'affiche
   que les pays principaux) — mêmes puces data-filter qu'avant. */
document.addEventListener('click', e => {
  if (!e.target.closest('[data-v2radar-plus]')) return;
  const pays = [...new Set(stocks.map(x => paysAffiche(x.country)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  openSheet(`<h3 id="sheetTitle">Plus de critères</h3>
    ${filterRow('Trier par', 'radarSort', [['perf', 'Performance du jour'], ['score', 'Nova Score'], ['name', 'Nom']])}
    ${filterRow('Secteur', 'radarSector', [['tous', 'Tous'], ...SECTORS.map(x => [x, x])])}
    ${filterRow('Pays', 'radarCountry', [['tous', 'Tous'], ...pays.map(c => [c, c])])}
    <button class="v-big-cta" data-v2radar-fermer style="margin-top:20px">Voir les résultats</button>`);
});
document.addEventListener('click', e => {
  if (!e.target.closest('[data-v2radar-fermer]')) return;
  closeSheet();
  render();
});

/* ---------- Portefeuille (PAGES.portfolio de la maquette) ----------
   Aucun compte d'investissement réel n'existe encore : même mise en page
   que la maquette, sans aucun montant inventé. Le bloc Sandbox (admins)
   reste rempli par assurerPortefeuilleAlpacaReel(). */
PAGES.portfolio = () => {
  const vide = `<span class="v-big v-num" style="font-size:40px;margin:0">—</span>`;
  return `<div class="v-page">
  <div class="v-ph"><h1>Portefeuille</h1><span class="v-badge" style="background:rgba(255,255,255,.08);color:var(--v-ink2)">Bientôt</span></div>
  <div id="alpacaRealPortfolioBlock" hidden></div>
  <section class="v-sec" style="margin-top:16px"><div class="v-rail" data-v2rail="pfDots">
    <article class="v-card v-analysis" style="display:flex;flex-direction:column">
      <p class="v-label">Valeur totale</p>
      <div style="margin-top:6px">${vide}</div>
      <p class="v-sub" style="margin-top:auto">Compte d'investissement non encore disponible. Aucun solde n'est affiché tant qu'aucun compte réel n'est connecté.</p>
    </article>
    <article class="v-card v-analysis" style="display:flex;flex-direction:column">
      <p class="v-label">Géré par NovaBot</p>
      <div style="margin-top:6px">${vide}</div>
      <p class="v-sub" style="margin-top:auto">NovaBot pourra suivre un vrai portefeuille une fois un compte connecté. En attendant, il analyse et explique.</p>
    </article></div>
    <div class="v-dots" id="pfDots"><i class="v-on"></i><i></i></div></section>
  <div class="v-actions">
    ${[['plus', 'Déposer'], ['minus', 'Retirer'], ['swap', 'Transférer'], ['bank', 'Relevés']].map(([ic, l]) =>
      `<button class="v-act" data-v2indispo><span class="v-ring" style="opacity:.55">${V2ICON[ic]}</span>${l}</button>`).join('')}
  </div>
  <section class="v-sec v-duo">
    <article class="v-card" style="display:flex;flex-direction:column;min-height:190px"><p class="v-label">Performance</p>
      <p class="v-big2 v-num">—</p></article>
    <article class="v-card" style="display:flex;flex-direction:column;min-height:190px"><p class="v-label">Gain / perte</p>
      <p class="v-big2 v-num">—</p></article>
  </section>
  <section class="v-sec"><div class="v-sec-h"><h2>Positions</h2><span class="v-label">0 titre</span></div>
    <div class="v-card" style="padding:18px"><p class="v-sub">Aucune position. Les achats seront possibles dès qu'un compte d'investissement réel sera ouvert.</p></div></section>
  <p class="v-legal">Investir comporte un risque de perte en capital. Les performances passées ne préjugent pas des performances futures.</p>
  </div>`;
};
document.addEventListener('click', e => {
  if (e.target.closest('[data-v2indispo]')) toast("Compte d'investissement non encore disponible.");
});

/* ---------- Compte (PAGES.account de la maquette) ---------- */
PAGES.account = () => {
  const P = V2_PLANS.find(p => p.id === (state.settings.plan || 'free')) || V2_PLANS[0];
  const nom = String(state.auth.name || '');
  const affiche = nom && !nom.includes('@') ? nom : (state.auth.email || 'Non connecté');
  const ini = document.getElementById('avatarBtn')?.textContent || '·';
  const lignes = [
    ['settings', 'Préférences'],
    ['watchlist', 'Ma liste de suivi'],
    ['lists', 'Mes listes'],
    ['method', 'Comment fonctionne le Nova Score'],
    ['trust', 'Aide et transparence'],
  ];
  const ligne = (attr, titre, sous) => `<button class="v-mini-row" ${attr}><span class="v-t" style="text-align:left"><b>${titre}</b>${sous ? `<span>${sous}</span>` : ''}</span>${V2ICON.chev}</button>`;
  return `<div class="v-page">
  <div class="v-ph"><h1>Compte</h1></div>
  <section class="v-sec v-card" style="display:flex;align-items:center;gap:14px">
    <span class="v-logo-c" style="background:var(--v-accent);color:#fff;width:56px;height:56px;font-size:18px">${esc(ini)}</span>
    <div style="flex:1;min-width:0"><b style="font-size:18px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(affiche)}</b><p class="v-label" style="margin-top:2px">Offre ${esc(P.nom)}</p></div>
    <button class="v-pill-btn" data-v2offres>Offres</button></section>
  <section class="v-sec v-card v-mini" style="padding:6px 18px">
    ${lignes.map(([g, l]) => ligne(`data-go="${g}"`, esc(l))).join('')}
    ${state.settings.plan && state.settings.plan !== 'free' ? ligne('data-portal', 'Gérer mon abonnement') : ''}
    ${ligne('data-guide', 'Revoir les premiers pas')}
    ${ligne('data-go="alpacaStatus"', 'Statut Alpaca (admin)')}
  </section>
  <section class="v-sec v-card v-mini" style="padding:6px 18px">
    ${ligne('data-reset', 'Effacer mes données locales', 'Liste de suivi et préférences')}
    <button class="v-mini-row" data-signout><span class="v-t" style="text-align:left"><b style="color:var(--v-down)">Se déconnecter</b></span></button>
  </section>
  <p class="v-legal">NovaTitre ne fournit pas de conseil en investissement personnalisé. Investir comporte un risque de perte en capital.</p>
  </div>`;
};
/* "Offres" : section offres de l'accueil, comme dans la maquette. */
document.addEventListener('click', e => {
  if (!e.target.closest('[data-v2offres]')) return;
  go('home');
  setTimeout(() => document.getElementById('offres')?.scrollIntoView({ behavior:'smooth' }), 400);
});
