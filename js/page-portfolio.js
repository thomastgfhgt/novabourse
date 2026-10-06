PAGES.portfolio = () => {
  const pf = portfolioValue();
  const palette = ['#00a651','#0071e3','#e0407a','#c47f0a','#5b4ae0','#0891b2'];
  const bySector = {}; pf.lines.forEach(l => { if (l.priceAvailable && l.stock) bySector[l.stock.sector] = (bySector[l.stock.sector]||0)+l.value; });
  const byCur = {}; pf.lines.forEach(l => { if (l.priceAvailable && l.stock) byCur[l.cur] = (byCur[l.cur]||0)+l.value; });
  /* Ajout (audit "Portfolio DNA partiel", 2026-09-17, §12 du PRD) : seules
     secteur/devise étaient ventilés jusqu'ici, alors que pays et type
     d'actif sont déjà présents sur chaque ligne (l.stock.country,
     l.stock.type) — aucune donnée nouvelle, seulement deux répartitions
     de plus construites de la même façon que celles déjà en place.
     MARKET_CATEGORIES fournit déjà le libellé français de chaque type
     (voir plus haut) — jamais un second dictionnaire de traduction. */
  const byCountry = {}; pf.lines.forEach(l => { if (l.priceAvailable && l.stock){
    const pays = paysAffiche(l.stock.country); if (pays) byCountry[pays] = (byCountry[pays]||0)+l.value;
  } });
  const byType = {}; pf.lines.forEach(l => { if (l.priceAvailable && l.stock){
    const label = MARKET_CATEGORIES.find(c => c.id === l.stock.type)?.label || l.stock.type;
    byType[label] = (byType[label]||0)+l.value;
  } });
  const parts = o => Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k2,v],i)=>({k:k2,v,c:palette[i%palette.length]}));

  const pfPeriod = PF_PERIODS.includes(state.ui.pfPeriod) ? state.ui.pfPeriod : '1A';
  const histPts = walletHistoryPourPeriode(pfPeriod);
  const first = histPts[0], last = histPts[histPts.length - 1];
  /* Gain/perte et performance AFFICHÉS DANS LE SÉLECTEUR DE PÉRIODE portent
     sur LA PÉRIODE choisie (comme le graphique de cours d'un titre : voir
     chartProShell) — first/last DE CETTE PÉRIODE, pas depuis l'ouverture du
     portefeuille. Le badge du bloc "Valeur totale" ci-dessus, lui, reste le
     gain latent total depuis l'ouverture (pf.gain), toujours visible quelle
     que soit la période choisie ci-dessous — deux informations différentes,
     jamais confondues.
     CORRECTIF (2026-10-05, §36 du prompt maître) : la variation brute
     (last - first) comptait tout dépôt/retrait survenu PENDANT la période
     comme si c'était un gain/perte de marché — fluxNetPeriode() (voir
     page-watchlist.js, à côté de walletHistoryPourPeriode) retire cet
     effet avant de calculer la performance de la période. */
  const fluxPeriode = (first && last) ? fluxNetPeriode(first.t, last.t) : 0;
  const periodeGain = (first && last) ? (last.totalValue - first.totalValue) - fluxPeriode : null;
  const periodePct = (first && last && first.totalValue) ? (periodeGain / first.totalValue) * 100 : null;
  /* Benchmark (§37 du prompt maître) : null tant que les données ne sont
     pas prêtes (déclenché par assurerBenchmarkPortefeuille(), voir le
     hook route.page==='portfolio' dans index.html) — la ligne
     correspondante n'apparaît alors simplement pas, jamais un chiffre à
     blanc/zéro affiché comme une vraie comparaison. */
  const benchmark = benchmarkPourPeriode(pfPeriod);
  const ecartPts = (benchmark && periodePct !== null) ? periodePct - benchmark.pct : null;

  return `<div class="page-in">
    <h1 class="title">Portefeuille</h1>
    <p class="lead" style="margin-top:10px">Portefeuille <b>virtuel</b> : suivez vos positions sans engager d'argent réel.</p>

    <div class="card" style="margin-top:22px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <p class="small">Valeur totale</p>
        <button type="button" class="nova-add-funds" data-cashflow-open="deposit"
          aria-label="Déposer ou retirer des fonds">${svg(ICON.plus,2.4)}</button>
      </div>
      <p class="price" style="font-size:clamp(34px,7vw,52px);margin-top:4px">${fmt.eur(pf.total)}</p>
      <span class="tag ${pf.gain>=0?'tag-up':'tag-down'}" style="margin-top:10px">
        ${trendTxt(pf.gainPct)} · ${fmt.eur(pf.gain)}</span>
      <p class="tiny" style="margin-top:10px">Gain latent depuis l'ouverture du portefeuille
        (positions actuellement détenues, hors ventes déjà réalisées).</p>
      ${pf.realizedPnL ? `<p class="small" style="margin-top:10px">
        Gain/perte <b>réalisé</b> (positions déjà vendues) :
        <b class="${pf.realizedPnL>=0?'up-t':'down-t'}">${pf.realizedPnL>=0?'+':''}${fmt.eur(pf.realizedPnL)}</b></p>` : ''}
      ${pf.unresolvedCount ? `<p class="tiny" style="margin-top:10px;color:var(--warn)">
        ${pf.unresolvedCount} position(s) non reconnue(s) n'entrent pas dans ce total.</p>` : ''}
    </div>

    <!-- Accès Nova (2026-09-23, "préparer visuellement les prochaines
         fonctionnalités") : NovaBot/Nova Review ont une page de
         présentation dédiée (novaFeaturePage) ; Nova AI n'en a
         volontairement PAS (consigne explicite : jamais sur l'accueil
         ni une page dédiée, seulement contextuel), d'où data-soon direct
         plutôt que data-go pour ce 3e bouton. -->
    ${novaSuiteRow([
      { key:'novabot', page:'novabot' },
      { key:'novareview', page:'novareview' },
      { icon:'spark', accent:'#6d28d9', rgb:'109,40,217', title:'Nova AI',
        soon:'Nova AI — bientôt disponible.' },
    ])}

    <section class="section">
      <div class="section-h"><h2 class="h2">Évolution</h2>
        <div class="seg" data-seg="pfPeriod">${PF_PERIODS.map(p=>`<button data-pf-period="${p}"
          aria-pressed="${pfPeriod===p}">${p}</button>`).join('')}</div>
      </div>
      <div class="card" style="margin-top:14px">
        ${histPts.length >= 2 ? `
          ${areaChart(histPts.map(p=>p.totalValue), { color: periodeGain>=0 ? 'var(--up)' : 'var(--down)', id:'pf' })}
          <div class="chart-stats" style="margin-top:14px">
            <div><span class="tiny">Valeur du portefeuille</span><b class="tabular-nums">${fmt.eur(last.totalValue)}</b></div>
            <div><span class="tiny">Capital net apporté</span><b class="tabular-nums">${Number.isFinite(last.netDeposits) ? fmt.eur(last.netDeposits) : '—'}</b></div>
            <div><span class="tiny">Gain/perte (période)</span><b class="tabular-nums ${periodeGain>=0?'up-t':'down-t'}">${periodeGain>=0?'+':''}${fmt.eur(periodeGain)}</b></div>
            <div><span class="tiny">Performance (période)</span><b class="tabular-nums ${periodePct>=0?'up-t':'down-t'}">${periodePct===null?'—':(periodePct>=0?'+':'')+fmt.num(periodePct,2)+' %'}</b></div>
            ${benchmark ? `
            <div><span class="tiny">Benchmark (${esc(benchmark.name)})</span><b class="tabular-nums ${benchmark.pct>=0?'up-t':'down-t'}">${benchmark.pct>=0?'+':''}${fmt.num(benchmark.pct,2)} %</b></div>
            <div><span class="tiny">Écart</span><b class="tabular-nums ${ecartPts>=0?'up-t':'down-t'}">${ecartPts>=0?'+':''}${fmt.num(ecartPts,1)} pt${Math.abs(ecartPts)>=2?'s':''}</b></div>` : ''}
          </div>
          <p class="tiny" style="margin-top:10px;color:var(--ink-4)">${histPts.length} relevé(s) réel(s) sur cette période
            · premier relevé le ${new Date(state.walletHistory[0].t).toLocaleDateString('fr-FR')}</p>
          ${fluxPeriode ? `<p class="tiny" style="margin-top:6px;color:var(--ink-4)">
            Performance ajustée : ${fluxPeriode>0?'dépôt':'retrait'} net de ${fmt.eur(Math.abs(fluxPeriode))}
            pendant cette période, exclu du calcul de gain/perte.</p>` : ''}`
        : `<p class="small" style="padding:16px 0;text-align:center">
            ${state.walletHistory.length ? `Pas encore assez d'historique réel sur ${pfPeriod} : le portefeuille
              n'a commencé à être enregistré que le ${new Date(state.walletHistory[0].t).toLocaleDateString('fr-FR')}.`
            : `L'historique se constitue à partir de maintenant : achetez ou vendez une position, ou revenez
              plus tard, pour voir apparaître une première courbe.`}</p>`}
      </div>
    </section>

    <section class="section">
      <h2 class="h2">Positions</h2>
      <div class="card" style="margin-top:14px">${pf.lines.length ? `<div class="rows">
        ${pf.lines.map(l=>{
          if (!l.stock){
            return `<div class="row">
              <span class="row-main"><span class="row-t">${esc(l.id)}</span>
                <span class="row-s">Société non reconnue</span></span>
              <span class="row-end"><span class="tiny">indisponible</span></span>
            </div>`;
          }
          return `<div class="row">
            <button style="display:flex;align-items:center;gap:13px;flex:1;min-width:0;text-align:left"
              data-stock="${esc(l.stock.id)}">
              ${avatar(l.stock)}
              <span class="row-main"><span class="row-t">${esc(l.stock.name)}</span>
                <span class="row-s">${fmt.num(l.qty,4)} × PRU ${fmt.cur(l.avg, l.cur)}${l.priceAvailable ? ` → cours ${fmt.cur(l.localValue/l.qty, l.cur)}` : ''}</span>
                <span class="row-s tabular-nums">Capital investi : ${fmt.eur(l.costBasis)}</span></span>
            </button>
            <span class="row-end">
              ${l.priceAvailable ? `
                <div class="tabular-nums" style="font-weight:650">${fmt.eur(l.marketValue)}</div>
                <div class="tabular-nums ${l.unrealizedPnL>=0?'up-t':'down-t'}" style="font-size:13px;margin-top:2px">
                  ${l.unrealizedPnL>=0?'+':''}${fmt.eur(l.unrealizedPnL)} · ${trendTxt(l.unrealizedPnLPercent)}</div>
              ` : `<div class="tiny" style="color:var(--ink-4)">cours indisponible</div>`}
            </span>
          </div>`;
        }).join('')}
      </div>
      <p class="tiny" style="margin-top:14px">Chaque position est convertie en euros avant addition (taux
        de conversion simulé, pas un flux de change en direct) :
        ${Object.entries(FX).filter(([c])=>c!=='EUR').map(([c,v])=>`1 ${c} = ${v} €`).join(' · ')}.</p>`
      : emptyState('Aucune position', 'Achetez une valeur depuis sa fiche pour la voir apparaître ici.')}
      </div>
    </section>

    ${pf.value > 0 ? `<section class="section">
      <div class="grid g-2">
        ${[['Par secteur',parts(bySector)],['Par devise',parts(byCur)],['Par pays',parts(byCountry)],['Par type d\'actif',parts(byType)]]
          .filter(([,ps])=>ps.length).map(([t2,ps])=>`
          <div class="card"><h3 class="h3" style="margin-bottom:14px">${t2}</h3>
            <div style="display:flex;justify-content:center">${donut(ps)}</div>
            <div class="rows" style="margin-top:14px">
              ${ps.map(x=>`<div class="row" style="padding:9px 0">
                <span style="display:flex;align-items:center;gap:9px;flex:1;min-width:0">
                  <i style="width:11px;height:11px;border-radius:3px;background:${x.c};flex:0 0 auto"></i>
                  <span class="row-t" style="font-size:14px">${esc(x.k)}</span></span>
                <span class="tabular-nums" style="font-size:13.5px">${Math.round(x.v/pf.value*100)} %</span></div>`).join('')}
            </div>
            <p class="tiny" style="margin-top:10px">Hors liquidités.</p></div>`).join('')}
      </div>
    </section>` : ''}

    ${pf.value > 0 ? (() => {
      /* Ajout (audit "Portfolio Health absent", 2026-09-17, §47 du PRD) :
         AUCUN score composite unique ici — plusieurs métriques réelles
         affichées séparément, chacune calculée directement depuis
         pf.lines/pf.value (aucune donnée nouvelle, rien de fabriqué).
         Volontairement PAS de note globale sur 100 : un blend pondéré de
         ces facteurs serait une méthodologie que je n'ai ni conçue ni
         validée avec le même soin que NovaScore (_novascore.js, ses
         seuils documentés empiriquement) — préférer des chiffres bruts
         honnêtes à un score composite qui semblerait plus rigoureux qu'il
         ne l'est. Corrélation et volatilité du portefeuille dans son
         ensemble restent hors de portée : nécessiteraient l'historique de
         PRIX de chaque position, jamais chargé en bloc (coût API), donc
         non affichées plutôt que devinées. */
      const positionsValides = pf.lines.filter(l => l.priceAvailable && l.value > 0);
      const maxPosition = positionsValides.reduce((max, l) => Math.max(max, l.value), 0);
      const maxPositionPct = pf.value ? Math.round(maxPosition / pf.value * 100) : 0;
      const secteursDistincts = Object.keys(bySector).length;
      const cashPct = pf.total ? Math.round(pf.cash / pf.total * 100) : 0;
      const maxDevise = Object.values(byCur).reduce((max, v) => Math.max(max, v), 0);
      const maxDevisePct = pf.value ? Math.round(maxDevise / pf.value * 100) : 0;

      const metrics = [
        { label: 'Position la plus importante', value: `${maxPositionPct} %`,
          note: maxPositionPct >= 30 ? 'Concentrée sur une seule valeur' : 'Raisonnablement répartie' },
        { label: 'Secteurs représentés', value: String(secteursDistincts),
          note: secteursDistincts <= 1 && positionsValides.length > 1 ? 'Un seul secteur pour plusieurs positions' : `${positionsValides.length} position${positionsValides.length>1?'s':''} au total` },
        { label: 'Liquidités', value: `${cashPct} %`, note: 'Part du portefeuille non investie' },
        { label: 'Devise dominante', value: `${maxDevisePct} %`,
          note: maxDevisePct >= 70 ? 'Faible diversification de change' : 'Exposition change répartie' },
      ];

      return `<section class="section">
        <div class="section-h"><h2 class="h2">Diversification</h2></div>
        <div class="card">
          <dl>
            ${metrics.map(m => `<div class="kv"><dt>${esc(m.label)}</dt><dd class="tabular-nums" style="text-align:right">
              ${esc(m.value)}<br><span class="tiny" style="color:var(--ink-4);font-weight:400">${esc(m.note)}</span></dd></div>`).join('')}
          </dl>
          <p class="tiny" style="margin-top:14px;color:var(--ink-4)">Volatilité et corrélation du portefeuille ne sont pas encore calculées : elles demanderaient l'historique de prix de chaque position.</p>
        </div>
      </section>`;
    })() : ''}

    ${(() => {
      /* "Et si je n'avais rien fait ?" (§30) : ne montre QUE les ventes
         réelles (state.transactions, ajouté 2026-09-17), les plus
         récentes d'abord, avec un lien de comparaison par vente. Aucune
         section si aucune vente n'a encore eu lieu — jamais une liste
         vide présentée comme une fonctionnalité active. */
      const ventes = state.transactions.filter(t => t.type === 'sell').slice().reverse().slice(0, 10);
      if (!ventes.length) return '';
      return `<section class="section">
        <div class="section-h"><h2 class="h2">Et si je n'avais rien fait ?</h2></div>
        <div class="card"><div class="rows">
          ${ventes.map(tx => {
            const q = queSiRienFait(tx);
            const dateAffichee = new Date(tx.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
            return `<div class="row" style="padding:11px 0;align-items:flex-start">
              <span class="row-main">
                <span class="row-t">${esc(tx.name)}</span>
                <span class="row-s">Vendu le ${dateAffichee} · ${fmt.eur(tx.amountEUR)} récupérés</span>
              </span>
              <span style="text-align:right;flex:0 0 auto">
                ${q === null
                  ? `<span class="tiny" style="color:var(--ink-4)">Cours actuel indisponible</span>`
                  : `<span class="tabular-nums ${q.difference >= 0 ? 'up-t' : 'down-t'}" style="font-size:13.5px;font-weight:600">
                      ${q.difference >= 0 ? '+' : ''}${fmt.eur(q.difference)}</span><br>
                    <span class="tiny" style="color:var(--ink-4)">en gardant, vaudrait ${fmt.eur(q.valeurAujourdhui)} aujourd'hui</span>`}
              </span>
            </div>`;
          }).join('')}
        </div></div>
      </section>`;
    })()}
    </div>`;
};

/* ---------- COMPTE ---------- */