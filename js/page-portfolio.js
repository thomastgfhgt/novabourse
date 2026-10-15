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

    <!-- Bloc Alpaca Sandbox réel (Phase 3) : rempli/affiché par
         assurerPortefeuilleAlpacaReel() (index.html, hook route.page===
         'portfolio'), UNIQUEMENT si le serveur confirme un compte Sandbox
         réellement lié (double porte déjà en place côté serveur :
         TRADING_ENABLED + TRADING_ADMIN_EMAILS). Masqué par défaut :
         zéro changement visuel pour quiconque n'est pas dans ce cas —
         voir #pfFictifContenu plus bas, cette portion n'est jamais
         touchée par ce qui précède. -->
    <div id="alpacaRealPortfolioBlock" hidden></div>

    <div id="pfFictifContenu">
    ${!PORTEFEUILLE_FICTIF_PUBLIC ? `
      <div class="card" style="margin-top:22px;text-align:center;padding:48px 24px">
        <p class="small" style="font-weight:600;font-size:16px">Compte d'investissement non encore disponible</p>
        <p class="small" style="color:var(--ink-4);margin-top:10px;max-width:420px;margin-inline:auto">
          NovaTitre ne propose pas encore l'ouverture d'un compte de courtage réel.
          Aucune donnée financière n'est affichée ici tant qu'aucun compte réel
          n'est connecté — jamais un solde ou un historique inventé.
        </p>
      </div>
    ` : `
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
         plutôt que data-go pour ce 3e bouton. CORRECTIF (2026-10-07,
         refonte visuelle) : icône/couleur/titre de Nova AI venaient en
         dur ici (dupliqués à l'identique dans page-stock.js) — lus
         depuis NOVA_FEATURES.novaai (ui-primitives.js) désormais, seul
         endroit à modifier pour que la reine/le bleu électrique de Nova
         AI changent partout à la fois. -->
    ${novaSuiteRow([
      { key:'novabot', page:'novabot' },
      { key:'novareview', page:'novareview' },
      { key:'novaai', soon:'Nova AI — bientôt disponible.' },
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
          /* Flash de prix (motion design premium, phase 2, 2026-10-15) :
             réutilise EXACTEMENT le même mécanisme partagé que stockRow()
             (js/ui-primitives.js) — PRICE_FLASH (js/data-services.js) est
             déjà alimenté par le sondage de cotations pour TOUT stockId,
             y compris ceux détenus ici. Consommé (supprimé) à la première
             lecture, même règle que stockRow() : une position affichée
             ailleurs au même instant ne rejoue pas deux fois le flash,
             la donnée reste correcte dans tous les cas. */
          const flashRow = PRICE_FLASH.get(l.stock.id);
          if (flashRow) PRICE_FLASH.delete(l.stock.id);
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
                <div class="tabular-nums pf-value${flashRow ? ` flash-${flashRow}` : ''}" style="font-weight:650">${fmt.eur(l.marketValue)}</div>
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
    </div>
    `}
    </div>
    </div>`;
};

/* Bascule entre le vrai compte Alpaca Sandbox et le journal fictif —
   appelée depuis render() (index.html, hook route.page==='portfolio'),
   jamais depuis PAGES.portfolio() elle-même (fonction synchrone, ne doit
   jamais déclencher de fetch à chaque rendu — même règle que
   assurerBenchmarkPortefeuille()). Double porte déjà appliquée côté
   serveur (TRADING_ENABLED + TRADING_ADMIN_EMAILS) : un utilisateur
   normal reçoit 'disabled'/403 et ne voit JAMAIS ce bloc — zéro risque
   pour qui n'est pas en bêta. */
async function assurerPortefeuilleAlpacaReel(){
  const bloc = document.getElementById('alpacaRealPortfolioBlock');
  const fictif = document.getElementById('pfFictifContenu');
  if (!bloc || !fictif) return;

  try {
    const r = await authFetch('/api/me?resource=alpaca&action=account');
    const compte = await r.json();
    if (compte.status !== 'linked'){
      bloc.hidden = true; fictif.hidden = false;
      return;
    }

    const rs = await authFetch('/api/me?resource=alpaca&action=portfolio-summary');
    const resume = await rs.json();
    if (resume.status !== 'ok'){
      bloc.hidden = true; fictif.hidden = false;
      return;
    }

    const devise = resume.currency || 'USD';
    bloc.innerHTML = `
      <div class="notice" style="margin-bottom:18px"><b>Simulation — argent fictif.</b>
        Compte Alpaca Sandbox réel n° ${esc(String(compte.accountNumber || '—'))}, statut ${esc(String(compte.accountStatus || '—'))}.
        Montants en ${esc(devise)} (référence officielle) — jamais convertis en euros ici.</div>
      <div class="card" style="margin-top:4px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <p class="small">Valeur du portefeuille</p>
          <button type="button" class="nova-add-funds" data-alpaca-depot-open aria-label="Ajouter des fonds fictifs">${svg(ICON.plus,2.4)}</button>
        </div>
        <p class="price" style="font-size:clamp(34px,7vw,52px);margin-top:4px">${fmt.cur(resume.portfolioValue, devise)}</p>
        <div class="kv" style="margin-top:14px"><dt>Liquidités</dt><dd>${fmt.cur(resume.cash, devise)}</dd></div>
        <div class="kv"><dt>Pouvoir d'achat</dt><dd>${fmt.cur(resume.buyingPower, devise)}</dd></div>
        <div class="kv"><dt>Valeur nette (equity)</dt><dd>${fmt.cur(resume.equity, devise)}</dd></div>
        <button class="btn btn-a btn-sm" style="margin-top:14px" data-alpaca-achat-open>Acheter des actions</button>
      </div>
      <div class="card" style="margin-top:18px">
        <p class="small" style="margin-bottom:12px">Positions (${resume.positionCount})</p>
        ${resume.positions.length ? `<div class="rows rows-grid">${resume.positions.map(p => `
          <div class="row">
            <span class="row-main"><span class="row-t">${esc(p.symbol)}</span>
              <span class="row-s">${fmt.num(p.qty, 4)} titres · entrée ${fmt.cur(p.avgEntryPrice, devise)}</span></span>
            <span style="text-align:right">
              <span class="tabular-nums">${fmt.cur(p.marketValue, devise)}</span><br>
              <span class="tiny ${p.unrealizedPl >= 0 ? 'up-t' : 'down-t'}">${fmt.cur(p.unrealizedPl, devise)} (${fmt.pct(p.unrealizedPlPc * 100)})</span>
            </span>
            <button type="button" class="btn btn-s btn-sm" style="margin-left:10px"
              data-alpaca-vente-open="${esc(p.symbol)}" data-qty="${esc(String(p.qty))}">Vendre</button>
          </div>`).join('')}</div>`
          : `<p class="small" style="color:var(--ink-4)">Aucune position — le compte n'a pas encore été financé ou aucun ordre n'a encore été exécuté.</p>`}
      </div>
      <div class="card" style="margin-top:18px" id="alpacaHistoriqueCard">
        <p class="small" style="margin-bottom:12px">Historique des ordres</p>
        <p class="tiny" style="color:var(--ink-4)">Chargement…</p>
      </div>`;
    bloc.hidden = false; fictif.hidden = true;
    alpacaChargerHistorique();
  } catch {
    bloc.hidden = true; fictif.hidden = false;
  }
}

/* ---------- Dépôt fictif ---------- */
function alpacaOuvrirDepot(){
  openSheet(`<div class="buy">
    <h3 id="sheetTitle" class="buy-title">Ajouter des fonds fictifs</h3>
    <div class="buy-big"><span id="alpDepBig">1000</span><small>$</small></div>
    <input class="buy-range" id="alpDepAmt" type="range" min="100" max="50000" step="100" value="1000" aria-label="Montant à déposer">
    <div class="buy-chips">
      ${[500,1000,5000,10000].map(a=>`<button class="chip" data-alpaca-depot-montant="${a}">${a} $</button>`).join('')}
    </div>
    <p class="buy-note">Simulation — aucune donnée bancaire réelle n'est demandée. Le règlement peut prendre plusieurs minutes (délai ACH simulé par Alpaca).</p>
    <button class="btn btn-a btn-lg buy-cta" data-alpaca-depot-ok>Déposer</button>
    <button class="btn btn-g" style="width:100%;margin-top:10px" data-close>Annuler</button>
  </div>`);
  const input = document.getElementById('alpDepAmt');
  input.addEventListener('input', () => { document.getElementById('alpDepBig').textContent = fmt.int(+input.value); });
}
async function alpacaConfirmerDepot(){
  const montant = +document.getElementById('alpDepAmt').value;
  const bouton = document.querySelector('[data-alpaca-depot-ok]');
  if (bouton) bouton.disabled = true;
  try {
    const r = await authFetch('/api/me?resource=alpaca&action=deposit', { method:'POST', body: JSON.stringify({ amount: montant }) });
    const data = await r.json();
    if (data.statut === 'depot_soumis'){
      toast('Dépôt soumis — le règlement peut prendre quelques minutes.');
      closeSheet();
    } else if (data.statut === 'relation_en_preparation'){
      toast('Configuration en cours — réessaie dans une minute.');
      if (bouton) bouton.disabled = false;
    } else {
      toast('Dépôt impossible : ' + (data.message || data.status || 'erreur inconnue'));
      if (bouton) bouton.disabled = false;
    }
  } catch {
    toast('Dépôt impossible.');
    if (bouton) bouton.disabled = false;
  }
}

/* ---------- Achat réel ---------- */
function alpacaOuvrirAchat(){
  openSheet(`<div class="buy">
    <h3 id="sheetTitle" class="buy-title">Acheter des actions (Sandbox)</h3>
    <input class="field" id="alpAchatSymbole" type="text" placeholder="Symbole (ex. AAPL)" style="margin-bottom:14px;text-transform:uppercase">
    <div class="buy-big"><span id="alpAchatBig">500</span><small>$</small></div>
    <input class="buy-range" id="alpAchatMontant" type="range" min="10" max="20000" step="10" value="500" aria-label="Montant à investir">
    <div class="buy-chips">
      ${[100,250,500,1000].map(a=>`<button class="chip" data-alpaca-achat-montant="${a}">${a} $</button>`).join('')}
    </div>
    <p class="buy-note">Ordre au marché, en dollars américains — Sandbox, aucun argent réel.</p>
    <button class="btn btn-a btn-lg buy-cta" data-alpaca-achat-suivant>Vérifier l'ordre</button>
  </div>`);
  const input = document.getElementById('alpAchatMontant');
  input.addEventListener('input', () => { document.getElementById('alpAchatBig').textContent = fmt.int(+input.value); });
}
function alpacaReviewAchat(){
  const symbole = document.getElementById('alpAchatSymbole').value.trim().toUpperCase();
  const montant = +document.getElementById('alpAchatMontant').value;
  if (!symbole){ toast('Indique un symbole.'); return; }
  openSheet(`<div class="buy">
    <p class="buy-co">${esc(symbole)}</p>
    <h3 id="sheetTitle" class="buy-title">Vérifiez votre ordre</h3>
    <dl class="buy-rows">
      <div><dt>Type d'ordre</dt><dd>Achat au marché</dd></div>
      <div><dt>Symbole</dt><dd>${esc(symbole)}</dd></div>
      <div class="buy-total"><dt>Montant</dt><dd>${fmt.int(montant)} $</dd></div>
    </dl>
    <p class="buy-note">Simulation Sandbox — exécution réelle sur le compte de simulation, aucun argent réel.</p>
    <button class="btn btn-a btn-lg buy-cta" data-alpaca-achat-ok="${esc(symbole)}" data-montant="${montant}">Confirmer l'achat</button>
    <button class="btn btn-g" style="width:100%;margin-top:10px" data-close>Annuler</button>
  </div>`);
}
async function alpacaConfirmerAchat(symbole, montant){
  const bouton = document.querySelector('[data-alpaca-achat-ok]');
  if (bouton) bouton.disabled = true;
  try {
    const r = await authFetch('/api/me?resource=alpaca&action=order-create', { method:'POST',
      body: JSON.stringify({ symbol: symbole, side:'buy', notional: montant }) });
    const data = await r.json();
    if (data.status === 'submitted'){
      toast('Ordre d\'achat soumis — statut : ' + data.order.status);
      closeSheet();
      assurerPortefeuilleAlpacaReel();
    } else if (data.status === 'validation_error'){
      toast('Ordre invalide : ' + data.erreurs.join(', '));
      if (bouton) bouton.disabled = false;
    } else {
      toast('Ordre refusé : ' + (data.alpacaBody?.message || data.message || data.status));
      if (bouton) bouton.disabled = false;
    }
  } catch {
    toast('Ordre impossible.');
    if (bouton) bouton.disabled = false;
  }
}

/* ---------- Vente réelle ---------- */
function alpacaOuvrirVente(symbole, qty){
  openSheet(`<div class="buy">
    <p class="buy-co">${esc(symbole)}</p>
    <h3 id="sheetTitle" class="buy-title">Vérifiez votre vente</h3>
    <dl class="buy-rows">
      <div><dt>Type d'ordre</dt><dd>Vente au marché</dd></div>
      <div><dt>Symbole</dt><dd>${esc(symbole)}</dd></div>
      <div class="buy-total"><dt>Quantité</dt><dd>${fmt.num(qty, 4)} (position entière)</dd></div>
    </dl>
    <p class="buy-note">Simulation Sandbox — exécution réelle sur le compte de simulation, aucun argent réel.</p>
    <button class="btn btn-a btn-lg buy-cta" data-alpaca-vente-ok="${esc(symbole)}" data-qty="${esc(String(qty))}">Confirmer la vente</button>
    <button class="btn btn-g" style="width:100%;margin-top:10px" data-close>Annuler</button>
  </div>`);
}
async function alpacaConfirmerVente(symbole, qty){
  const bouton = document.querySelector('[data-alpaca-vente-ok]');
  if (bouton) bouton.disabled = true;
  try {
    const r = await authFetch('/api/me?resource=alpaca&action=order-create', { method:'POST',
      body: JSON.stringify({ symbol: symbole, side:'sell', qty }) });
    const data = await r.json();
    if (data.status === 'submitted'){
      toast('Ordre de vente soumis — statut : ' + data.order.status);
      closeSheet();
      assurerPortefeuilleAlpacaReel();
    } else if (data.status === 'validation_error'){
      toast('Ordre invalide : ' + data.erreurs.join(', '));
      if (bouton) bouton.disabled = false;
    } else {
      toast('Ordre refusé : ' + (data.alpacaBody?.message || data.message || data.status));
      if (bouton) bouton.disabled = false;
    }
  } catch {
    toast('Ordre impossible.');
    if (bouton) bouton.disabled = false;
  }
}

/* ---------- Historique + annulation ---------- */
const ALPACA_STATUTS_ANNULABLES = ['new','accepted','pending_new','accepted_for_bidding','partially_filled'];
async function alpacaChargerHistorique(){
  const carte = document.getElementById('alpacaHistoriqueCard');
  if (!carte) return;
  try {
    const r = await authFetch('/api/me?resource=alpaca&action=orders');
    const data = await r.json();
    if (data.status !== 'ok' || !data.orders.length){
      carte.innerHTML = `<p class="small" style="margin-bottom:12px">Historique des ordres</p>
        <p class="small" style="color:var(--ink-4)">Aucun ordre pour l'instant.</p>`;
      return;
    }
    carte.innerHTML = `<p class="small" style="margin-bottom:12px">Historique des ordres</p>
      <div class="rows">${data.orders.map(o => `
        <div class="row row-static">
          <span class="row-main"><span class="row-t">${o.side === 'buy' ? 'Achat' : 'Vente'} ${esc(o.symbol)}</span>
            <span class="row-s">${esc(o.status)}${o.filledQty ? ` · ${fmt.num(+o.filledQty, 4)} exécuté${+o.filledQty>1?'s':''}` : ''}</span></span>
          ${ALPACA_STATUTS_ANNULABLES.includes(o.status)
            ? `<button type="button" class="btn btn-s btn-sm" data-alpaca-annuler-ordre="${esc(o.id)}">Annuler</button>` : ''}
        </div>`).join('')}</div>`;
  } catch {
    carte.innerHTML = `<p class="small">Historique indisponible.</p>`;
  }
}
async function alpacaAnnulerOrdre(orderId){
  try {
    const r = await authFetch('/api/me?resource=alpaca&action=order-cancel', { method:'POST', body: JSON.stringify({ orderId }) });
    const data = await r.json();
    if (data.status === 'cancel_requested'){
      toast('Annulation demandée.');
    } else if (data.status === 'not_cancelable'){
      toast('Cet ordre n\'est plus annulable (déjà exécuté).');
    } else {
      toast('Annulation impossible : ' + (data.message || data.status));
    }
    alpacaChargerHistorique();
  } catch {
    toast('Annulation impossible.');
  }
}

/* ---------- COMPTE ---------- */