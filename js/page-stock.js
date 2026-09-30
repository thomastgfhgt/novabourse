let derniereFicheStockId = null;
PAGES.stock = (id) => {
  const s = byId[id]; if (!s) return emptyState('Entreprise introuvable',
    'Cette entreprise ne figure pas dans le catalogue actuel.');
  if (derniereFicheStockId !== id){
    derniereFicheStockId = id;
    state.ui.stockTab = 'apercu';
  }
  const p = profileOf(s.score), pos = positionOf(s.id);
  const f = s.fundamentals;
  const strong = strengths(s), weak = weaknesses(s);
  const canBuy = prixDe(s) !== null;
  /* Fiche action en onglets (2026-09-28, pivot NovaTitre) : l'en-tête
     (identité/cours/CTA) reste commun à tous les onglets, comme sur
     toute fiche produit — seul le contenu SOUS l'en-tête change selon
     l'onglet choisi (state.ui.stockTab, voir le gestionnaire de clic
     data-stock-tab). Le découpage reprend EXACTEMENT le contenu déjà
     existant (aucune section supprimée ni réécrite), seulement regroupé
     différemment : les 3 onglets Données/Analyse/Actualités restent
     réservés à isStock, exactement comme l'était déjà l'unique ternaire
     `s.type === 'stock' ? ... : ''` qu'ils remplacent — un ETF/crypto/
     forex n'affiche toujours aucune métrique absurde (pas de PER pour
     EUR/USD, pas de ROE pour Bitcoin), même garantie qu'avant. */
  const isStock = s.type === 'stock';

  const header = `
  <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>

  <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
    ${avatar(s)}
    <div style="flex:1;min-width:200px">
      <h1 class="title" style="font-size:clamp(24px,4vw,34px)">${esc(s.name)}</h1>
      <p class="small" style="margin-top:4px">${[s.ticker, s.market, s.sector].filter(Boolean).map(esc).join(' · ')}</p>
    </div>
    <div style="text-align:right">
      ${(() => {
        const q = QUOTES.get(s.id);
        if (!q || !Number.isFinite(q.price))
          return `<div class="price" style="color:var(--ink-4)">—</div>
            <div class="tiny" style="margin-top:6px">Cours indisponible pour cette place</div>`;
        const v = Number.isFinite(q.changePercent) ? q.changePercent : null;
        /* Indicateur honnête : n'apparaît qu'après un vrai cycle de
           rafraîchissement vivant sur CETTE fiche (state.ui.liveAt posé
           par liveTick), jamais une horloge qui tourne toute seule sans
           donnée réelle derrière. */
        /* Préfixe de fraîcheur (voir FRESHNESS_LABEL, constante partagée
           avec stockRow() plus haut) : évite que "Actualisé à HH:MM:SS" ne
           laisse croire à du temps réel alors que la cotation est en
           réalité différée (cas par défaut aujourd'hui, EODHD documentant
           explicitement 15-20 min de délai). Rien n'apparaît si
           `freshness` est absent (ancienne réponse serveur en cache, ou
           fournisseur non reconnu) plutôt que d'inventer un libellé —
           mais "Fraîcheur inconnue" s'affiche bien si le serveur renvoie
           explicitement UNKNOWN. */
        const labelFraicheur = FRESHNESS_LABEL[q.freshness] || '';
        /* Statut de séance (voir MARKET_STATUS_LABEL) : ajouté au même
           préfixe que la fraîcheur, jamais à sa place — un "Différé ·
           Séance fermée" reste avant tout une info de FRAÎCHEUR ; le
           statut de séance n'est qu'un contexte de plus. Rien n'apparaît
           pour 'unknown' (crypto/forex/indices/place non couverte). */
        const labelSeance = MARKET_STATUS_LABEL[q.marketStatus] || '';
        const fraicheur = (state.ui.liveAt && route.page === 'stock' && route.arg === s.id)
          ? `<div class="tiny" style="margin-top:4px;color:var(--ink-4)">${labelFraicheur ? esc(labelFraicheur) + ' · ' : ''}Actualisé à ${new Date(state.ui.liveAt).toLocaleTimeString('fr-FR')}${labelSeance ? ' · ' + esc(labelSeance) : ''}</div>`
          : '';
        const flash = PRICE_FLASH.get(s.id);
        PRICE_FLASH.delete(s.id);
        return `<div class="price${flash ? ` flash-${flash}` : ''}">${fmt.num(q.price)}<small>${esc(s.curSymbol)}</small></div>
          ${v === null ? '' : `<div class="price-chg ${v >= 0 ? 'up-t' : 'down-t'}">
            ${arrow(v)} ${fmt.pct(v)}</div>`}${fraicheur}`;
      })()}
    </div>
    ${starBtn(s.id)}
  </div>

  ${(() => {
    const q = QUOTES.get(s.id);
    if (!q) return '';
    /* Champs déjà présents dans la cotation batch (aucun appel
       supplémentaire) — affichés seulement s'ils existent réellement,
       jamais de "—" en série pour un instrument qui n'en a simplement
       pas (ex. Forex n'a pas de volume chez tous les providers). */
    const champs = [
      ['Ouverture', q.open], ['Plus haut', q.high], ['Plus bas', q.low],
      ['Clôture préc.', q.previousClose],
    ].filter(([, v]) => Number.isFinite(v));
    if (Number.isFinite(q.volume) && q.volume > 0) champs.push(['Volume', q.volume]);
    if (!champs.length) return '';
    return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px;margin-top:16px">
      ${champs.map(([label, v]) => `<div class="card" style="padding:10px 12px">
        <div class="tiny" style="color:var(--ink-4)">${esc(label)}</div>
        <div class="small tabular-nums" style="margin-top:2px;font-weight:600">${label === 'Volume' ? fmt.int(v) : fmt.num(v, 2)}</div>
      </div>`).join('')}
    </div>`;
  })()}

  <div class="stk-cta">
    <button class="btn btn-a btn-lg" data-buy="${esc(s.id)}" style="flex:1"
      ${canBuy ? '' : 'disabled aria-disabled="true"'}>Acheter</button>
    ${pos ? `<button class="btn btn-blue btn-lg" data-sell="${esc(s.id)}">Vendre</button>` : ''}
  </div>
  ${!canBuy ? `<p class="tiny" style="margin-top:8px;color:var(--ink-4)">
    Cours temporairement indisponible pour cette valeur : achat désactivé tant qu'aucun prix vérifié n'est reçu.</p>` : ''}
  ${(() => {
    /* Nova Memory (§27) : ne rappelle QUE si une raison a été saisie au
       moment de l'achat (openBuyReview, "Pourquoi cet achat ?") — jamais
       un texte générique pour une position sans thèse enregistrée.
       Cherche le dernier ACHAT de ce titre précis avec thesisReason
       renseigné, le plus récent d'abord (state.transactions est ajouté
       chronologiquement). */
    if (!pos) return '';
    const derniereThese = [...state.transactions].reverse()
      .find(t => t.type === 'buy' && t.stockId === s.id && t.thesisReason);
    if (!derniereThese) return '';
    return `<div class="notice" style="margin-top:14px;background:var(--bg-2);color:var(--ink-2)">
      <b style="color:var(--ink)">Pourquoi vous aviez acheté.</b> ${esc(derniereThese.thesisReason)}
      <p class="tiny" style="margin-top:6px;color:var(--ink-4)">Est-ce toujours vrai ?</p>
    </div>`;
  })()}`;

  const tabApercu = `
  <!-- COURS — graphique professionnel, chargement à la demande par période.
       État explicite à 5 valeurs : idle / loading / ready / empty / error. -->
  ${(() => {
    const period = CHART_PERIODS.some(p => p.api === state.ui.chartPeriod) ? state.ui.chartPeriod : '3m';
    const entry = HISTP.get(cleHISTP(s.id, period));
    const status = entry ? entry.status : 'idle';
    return `
  <section class="section">
    <div class="section-h"><h2 class="h2">Cours</h2>
      ${status !== 'idle' ? `<div class="seg" data-seg="chartPeriod">${CHART_PERIODS.map(p=>`<button data-chart-period="${p.api}"
        aria-pressed="${period===p.api}">${p.label}</button>`).join('')}</div>` : ''}</div>
    <div class="card">
      ${status === 'idle' ? `
        <div style="text-align:center;padding:24px 0">
          <p class="small" style="margin-bottom:16px">L'historique n'est chargé que si vous le demandez.</p>
          <button class="btn btn-a" data-show-chart="${esc(s.id)}">Voir le graphique</button>
        </div>`
      : status === 'loading' ? chartSkeleton()
      : status === 'error' ? `
        <p class="small" style="padding:24px 0;text-align:center">Impossible de charger les données pour le moment.</p>
        <div style="text-align:center;padding-top:4px"><button class="btn btn-ghost btn-sm" data-retry-chart="${esc(s.id)}">Réessayer</button></div>`
      : status === 'empty' ? `
        <p class="small" style="padding:24px 0;text-align:center">Données historiques indisponibles pour cet instrument.</p>`
      : chartProShell(s, period, entry)}
    </div>
  </section>`;
  })()}

  ${(s.type === 'stock' && s.fundamentalsStatus === 'loaded' && s.companyIdentity?.description) ? `
  <!-- À PROPOS — chargée par le même appel que "Les chiffres" (chargerFondamentaux),
       jamais une requête séparée. N'apparaît que si le fournisseur a réellement
       renvoyé une description (aucun texte inventé si absente). -->
  <section class="section">
    <div class="section-h"><h2 class="h2">À propos</h2></div>
    <div class="card">
      <p class="small" style="line-height:1.6">${esc(s.companyIdentity.description)}</p>
      ${(s.companyIdentity.website || Number.isFinite(s.companyIdentity.employees) || s.companyIdentity.ipoDate) ? `
      <dl style="margin-top:16px">
        ${s.companyIdentity.website ? (() => {
          const href = safeHref(s.companyIdentity.website);
          const label = esc(s.companyIdentity.website.replace(/^https?:\/\//, ''));
          return `<div class="kv"><dt>Site web</dt><dd>${href
            ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label}</dd></div>`;
        })() : ''}
        ${Number.isFinite(s.companyIdentity.employees) ? `<div class="kv"><dt>Effectifs</dt><dd class="tabular-nums">${fmt.int(s.companyIdentity.employees)}</dd></div>` : ''}
        ${s.companyIdentity.ipoDate ? `<div class="kv"><dt>Introduction en bourse</dt><dd>${esc(s.companyIdentity.ipoDate)}</dd></div>` : ''}
      </dl>` : ''}
    </div>
  </section>` : ''}`;

  const tabDonnees = !isStock ? '' : `
  <!-- CHIFFRES — chargement à la demande -->
  <section class="section">
    <div class="section-h"><h2 class="h2">Les chiffres</h2>
      ${s.fundamentalsStatus !== 'idle' ? `<div class="seg" data-seg="mode"><button data-mode="debutant" aria-pressed="${!isExpert()}">Simple</button>
        <button data-mode="expert" aria-pressed="${isExpert()}">Détaillé</button></div>` : ''}</div>
    <div class="card">
      ${s.fundamentalsStatus === 'idle' ? `
        <div style="text-align:center;padding:24px 0">
          <p class="small" style="margin-bottom:16px">Les chiffres ne sont chargés que si vous le demandez.</p>
          <button class="btn btn-a" data-show-fundamentals="${esc(s.id)}">Voir les chiffres</button>
        </div>`
      : s.fundamentalsStatus === 'loading' ? `
        <p class="small" style="padding:24px 0;text-align:center">Chargement des chiffres…</p>`
      : s.hasFundamentals && f ? `
        <dl>
          <div class="kv"><dt>Capitalisation ${infoBtn('Capitalisation')}</dt><dd class="tabular-nums">${fmt.num(capEnMilliards(f.marketCap, s.fundamentalsSource), 1)} Md ${esc(s.curSymbol)}</dd></div>
          <div class="kv"><dt>Rentabilité (ROE) ${infoBtn('ROE')}</dt><dd>${fmt.pctRatio(f.roe)}</dd></div>
          <div class="kv"><dt>Marge ${infoBtn('Marge')}</dt><dd>${fmt.pctRatio(Number.isFinite(f.profitMargin) ? f.profitMargin : f.operatingMargin)}</dd></div>
          <div class="kv"><dt>Croissance du CA</dt><dd class="${(() => { const g = croissanceSerie(f.revenueSeries); return g === null ? '' : (g >= 0 ? 'up-t' : 'down-t'); })()}">${(() => { const g = croissanceSerie(f.revenueSeries); return g !== null ? trendTxt(g, 1) : '—'; })()}</dd></div>
          <!-- CORRECTIF (clarté, 2026-09-21) : ce champ affichait un simple
               "—" sans explication, alors que "Endettement" pèse 15 % du
               Nova Score (voir _novascore.js) — de quoi laisser croire à
               une donnée cassée. Vérifié : api/market/fundamentals.js
               n'expose aucun champ de dette au frontend (le calcul du
               score, lui, y a accès côté serveur) ; honnête de le dire
               plutôt que de laisser un tiret muet. -->
          <div class="kv"><dt>Dette / fonds propres ${infoBtn('Dette')}</dt>
            <dd class="tiny" style="color:var(--ink-4);text-align:right;max-width:180px">Utilisée dans le score, pas encore affichée ici</dd></div>
          <div class="kv"><dt>PER ${infoBtn('PER')}</dt><dd>${fmt.mult(f.pe)}</dd></div>
          ${isExpert()?`
            <div class="kv"><dt>Croissance du bénéfice ${infoBtn('BPA')}</dt><dd class="${(() => { const g = croissanceSerie(f.epsSeries); return g === null ? '' : (g >= 0 ? 'up-t' : 'down-t'); })()}">${(() => { const g = croissanceSerie(f.epsSeries); return g !== null ? trendTxt(g, 1) : '—'; })()}</dd></div>
            <div class="kv"><dt>Plus haut 52 sem. ${infoBtn('52 semaines')}</dt><dd>${Number.isFinite(f.week52High) ? fmt.num(f.week52High, 2) + ' ' + esc(s.curSymbol) : '—'}</dd></div>
            <div class="kv"><dt>Plus bas 52 sem. ${infoBtn('52 semaines')}</dt><dd>${Number.isFinite(f.week52Low) ? fmt.num(f.week52Low, 2) + ' ' + esc(s.curSymbol) : '—'}</dd></div>
            <div class="kv"><dt>Bêta ${infoBtn('Bêta')}</dt><dd>${Number.isFinite(f.beta) ? fmt.num(f.beta, 2) : '—'}</dd></div>
            <div class="kv"><dt>Volume moyen (3 mois) ${infoBtn('Volume')}</dt><dd>${Number.isFinite(f.avgVolume3M) ? fmt.num(f.avgVolume3M, 1) + ' M' : '—'}</dd></div>
            <div class="kv"><dt>Marge brute ${infoBtn('Marge')}</dt><dd>${Number.isFinite(f.grossMargin) ? fmt.pctRatio(f.grossMargin) : '—'}</dd></div>
            <div class="kv"><dt>Ratio de liquidité générale ${infoBtn('Liquidité')}</dt><dd>${Number.isFinite(f.currentRatio) ? fmt.num(f.currentRatio, 2) : '—'}</dd></div>
            <div class="kv"><dt>Prix / Chiffre d'affaires ${infoBtn('PSR')}</dt><dd>${Number.isFinite(f.priceToSales) ? fmt.mult(f.priceToSales) : '—'}</dd></div>
            <div class="kv"><dt>Volatilité ${infoBtn('Volatilité')}</dt><dd>${(() => {
              const h = HIST.get(s.id);
              if (!h || h.status !== 'ready') return '—';
              const v = volatiliteAnnualisee(h.data);
              return v !== null ? fmt.num(v, 1) + ' %' : '—';
            })()}</dd></div>
            <div class="kv"><dt>Mois en hausse ${infoBtn('Régularité')}</dt><dd>${(() => {
              const h = HIST.get(s.id);
              if (!h || h.status !== 'ready') return '—';
              const m = pourcentageMoisHausse(h.data);
              return m !== null ? fmt.num(m, 0) + ' %' : '—';
            })()}</dd></div>
            <div class="kv"><dt>Dividende ${infoBtn('Dividende')}</dt><dd>${fmt.num(f.dividendYield, 2)} %</dd></div>
            ${Number.isFinite(f.dividendPerShare) ? `<div class="kv"><dt>Dividende / action</dt><dd class="tabular-nums">${fmt.num(f.dividendPerShare, 2)} ${esc(s.curSymbol)}</dd></div>` : ''}
            <!-- payoutRatio volontairement PAS affiché : convention d'échelle
                 EODHD (déjà en % vs ratio décimal 0-1) non vérifiable sans clé
                 réelle. L'afficher avec la mauvaise conversion produirait un
                 nombre confiant mais faux — pire qu'une absence. Champ gardé
                 dans le modèle de données pour un futur affichage une fois
                 vérifié (voir f.payoutRatio), jamais formaté à l'aveugle ici. -->
            ${f.exDividendDate ? `<div class="kv"><dt>Date ex-dividende</dt><dd>${esc(f.exDividendDate)}</dd></div>` : ''}
            ${f.nextEarningsDate ? `<div class="kv"><dt>Prochains résultats</dt><dd>${esc(f.nextEarningsDate)}</dd></div>` : ''}`:''}
        </dl>
        ${plainFundamentals(s) ? `<div class="notice" style="margin-top:16px;background:var(--bg-2);color:var(--ink-2)">
          <b style="color:var(--ink)">En clair.</b> ${plainFundamentals(s)}</div>` : ''}`
      : `<div class="notice"><b>Données financières indisponibles.</b>
          Aucune valeur approchée n'est affichée, et les composantes concernées
          sont retirées du score tant qu'elles ne sont pas connues.</div>`}
    </div>
  </section>

  <!-- ANALYSTES — même appel réseau que "Les chiffres" (/api/market/fundamentals,
       déjà mis en cache par chargerFondamentaux) : cette section n'ajoute
       AUCUNE requête si les chiffres ont déjà été consultés, un clic sur
       "Voir les analystes" seul en déclenche une comme "Voir les chiffres" le
       ferait. -->
  <section class="section">
    <div class="section-h"><h2 class="h2">Analystes</h2></div>
    <div class="card">
      ${s.fundamentalsStatus === 'idle' ? `
        <div style="text-align:center;padding:24px 0">
          <p class="small" style="margin-bottom:16px">Le consensus des analystes n'est chargé que si vous le demandez.</p>
          <button class="btn btn-a" data-show-fundamentals="${esc(s.id)}">Voir les analystes</button>
        </div>`
      : s.fundamentalsStatus === 'loading' ? `
        <p class="small" style="padding:24px 0;text-align:center">Chargement…</p>`
      : (f && f.analystRatings) ? (() => {
          const ar = f.analystRatings;
          const total = [ar.strongBuy, ar.buy, ar.hold, ar.sell, ar.strongSell]
            .filter(Number.isFinite).reduce((a,b)=>a+b, 0);
          const repartition = [
            ['Achat fort', ar.strongBuy, 'var(--up)'], ['Achat', ar.buy, 'var(--up)'],
            ['Conserver', ar.hold, 'var(--warn)'], ['Vente', ar.sell, 'var(--down)'],
            ['Vente forte', ar.strongSell, 'var(--down)'],
          ].filter(([,v]) => Number.isFinite(v));
          return `
        <dl>
          <div class="kv"><dt>Note consensus (sur 5)</dt><dd class="tabular-nums">${Number.isFinite(ar.rating) ? fmt.num(ar.rating, 2) : '—'}</dd></div>
          <div class="kv"><dt>Objectif de cours (consensus)</dt><dd class="tabular-nums">${Number.isFinite(ar.targetPrice) ? fmt.num(ar.targetPrice, 2) + ' ' + esc(s.curSymbol) : '—'}</dd></div>
          ${Number.isFinite(f.wallStreetTargetPrice) ? `<div class="kv"><dt>Objectif de cours (Wall Street)</dt><dd class="tabular-nums">${fmt.num(f.wallStreetTargetPrice, 2)} ${esc(s.curSymbol)}</dd></div>` : ''}
          ${Number.isFinite(f.epsEstimateCurrentYear) ? `<div class="kv"><dt>BPA estimé (année en cours)</dt><dd class="tabular-nums">${fmt.num(f.epsEstimateCurrentYear, 2)}</dd></div>` : ''}
          ${Number.isFinite(f.epsEstimateNextYear) ? `<div class="kv"><dt>BPA estimé (année suivante)</dt><dd class="tabular-nums">${fmt.num(f.epsEstimateNextYear, 2)}</dd></div>` : ''}
        </dl>
        ${total > 0 ? `<div class="rows" style="margin-top:14px">
          ${repartition.map(([label, v, c]) => `<div class="row" style="padding:7px 0">
            <span style="display:flex;align-items:center;gap:9px;flex:1;min-width:0">
              <i style="width:11px;height:11px;border-radius:3px;background:${c};flex:0 0 auto"></i>
              <span class="row-t" style="font-size:14px">${esc(label)}</span></span>
            <span class="tabular-nums" style="font-size:13.5px">${v} (${Math.round(v/total*100)} %)</span></div>`).join('')}
        </div>
        <p class="tiny" style="margin-top:10px">${total} analyste(s) au total · source ${esc(s.fundamentalsSource || '—')}.</p>` : ''}`;
        })()
      : `<div class="notice"><b>Consensus analystes indisponible.</b>
          Aucune valeur approchée n'est affichée pour cette valeur.</div>`}
    </div>
  </section>`;

  const tabAnalyse = !isStock ? '' : `
  <!-- NOVA AI (2026-09-23, rebaptisée depuis "Analyse IA" — retour
       utilisateur : "Analyser une action c'est Nova AI". Fonctionnalité
       INCHANGÉE, réelle, déjà existante — seul le nom affiché change,
       pour ne plus coexister avec un Nova AI "bientôt disponible"
       fictif à côté d'une analyse qui, elle, fonctionne déjà vraiment. -->
  <section class="section">
    <div class="card">
      <p class="eyebrow">Nova AI</p>
      <h2 class="h2" style="margin-top:6px">Faire analyser ${esc(s.name)}</h2>
      <p class="small" style="margin-top:8px">Le modèle reçoit les chiffres de cette fiche.
        Il ne produit aucun nombre.${DATA.mode === 'live' ? ''
          : ' Les données de marché ne sont pas connectées : l\'analyse sert à valider la chaîne technique.'}</p>
      <button class="btn btn-a" style="margin-top:18px" data-nova="${esc(s.id)}">Lancer l'analyse</button>
    </div>
  </section>

  <!-- RISQUE ET HISTORIQUE -->
  <section class="section">
    <div class="grid g-2">
      <div class="card">
        <h3 class="h3">Risque de volatilité</h3>
        <p class="title" style="font-size:28px;margin-top:8px;color:${s.volRisk==='Faible'?'var(--up)':s.volRisk==='Modéré'?'var(--warn)':'var(--ink-4)'}">${s.volRisk ?? '—'}</p>
        <p class="small" style="margin-top:8px">Fondé sur la seule volatilité du cours
          (${s.volatility ?? '—'} % par an). Ce n'est pas un risque global : la gouvernance, les
          litiges ou la dépendance à un client n'y figurent pas.</p>
      </div>
      <div class="card">
        <h3 class="h3">Historique du score</h3>
        <p class="small" style="margin-top:10px">Historique du NovaScore en cours de
          constitution. Il sera alimenté par les relevés datés de vos analyses.</p>
      </div>
    </div>
  </section>`;

  const tabActualites = !isStock ? '' : `
  <!-- NOVA NEWS (2026-09-23, rebaptisée depuis "Actualités" — retour
       utilisateur : "actualité c'est Nova News". Fonctionnalité
       INCHANGÉE, réelle, déjà existante (chargement à la demande,
       fournisseur EODHD, stock/etf uniquement) — seul le nom affiché
       change, pour ne plus coexister avec un Nova News "bientôt
       disponible" fictif juste en dessous d'une actualité qui, elle,
       fonctionne déjà vraiment (même logique que Nova AI/"Analyse IA"
       juste avant). -->
  <section class="section">
    <div class="section-h"><h2 class="h2">Nova News</h2></div>
    <div class="card">
      ${(s.newsStatus || 'idle') === 'idle' ? `
        <div style="text-align:center;padding:24px 0">
          <p class="small" style="margin-bottom:16px">Les actualités ne sont chargées que si vous le demandez.</p>
          <button class="btn btn-a" data-show-news="${esc(s.id)}">Voir les actualités</button>
        </div>`
      : s.newsStatus === 'loading' ? `
        <p class="small" style="padding:24px 0;text-align:center">Chargement des actualités…</p>`
      : (Array.isArray(s.news) && s.news.length) ? `
        <div class="rows">
          ${s.news.filter(a => safeHref(a.link)).map(a => `<a class="row" href="${esc(safeHref(a.link))}" target="_blank" rel="noopener noreferrer">
            <span class="row-main">
              <span class="row-t">${esc(a.title)}</span>
              <span class="row-s">${esc(formatDateAffichage(a.date, 'intraday'))}${a.tags && a.tags.length ? ' · ' + esc(a.tags.slice(0,3).join(', ')) : ''}</span>
            </span>
            <span style="color:var(--ink-4)">${svg(ICON.arrow,2.4)}</span>
          </a>`).join('')}
        </div>
        <p class="tiny" style="margin-top:14px">Articles de presse externes, non rédigés par NovaTitre
          · source ${esc(s.newsSource || '—')}.</p>`
      : `<div class="notice"><b>Actualités indisponibles.</b>
          Aucun article n'a pu être obtenu pour cette valeur pour le moment.</div>`}
    </div>
  </section>`;

  const tabActions = `
  <!-- CORRECTIF DESIGN (2026-09-22, "vraiment mieux que Revolut") :
       captures d'écran réelles de l'app Revolut (App Store) analysées
       en détail — leur fiche "Invest" utilise une rangée d'actions
       rapides circulaires (icône + libellé court dessous), pas des
       pilules de texte variable comme ici avant ce correctif. Reproduit
       avec les icônes déjà existantes (spark/scale/list) — le libellé
       reste COURT ET FIXE ("Comparer", jamais "✓ Ajoutée à la
       comparaison" comme avant, qui aurait débordé d'un petit cercle) ;
       l'état "actif" (comparaison/liste) se lit maintenant sur le
       cercle lui-même (rempli de la couleur d'accent) plutôt que dans
       le texte — voir .qa[aria-pressed] et .qa-badge plus bas.
       Au passage : l'étoile "suivre" était dupliquée deux fois sur
       cette même fiche (déjà présente à côté du prix juste au-dessus) —
       gardée une seule fois, la plus visible des deux. -->
  <div class="stk-qa">
    <button class="qa" data-cmp="${esc(s.id)}" aria-pressed="${state.compare.includes(s.id)}">
      <i>${svg(ICON.scale,2)}</i><span>Comparer</span></button>
    <button class="qa" data-add-to-list="${esc(s.id)}" aria-pressed="${listesAvec(s.id).length > 0}">
      <i>${svg(ICON.list,2)}${listesAvec(s.id).length ? `<em class="qa-badge">${listesAvec(s.id).length}</em>` : ''}</i>
      <span>Liste</span></button>
    <button class="qa" data-open-alerte="${esc(s.id)}"
      aria-pressed="${state.alerts.some(a => a.stockId === s.id && !a.triggered)}">
      <i>${svg(ICON.radar,2)}${state.alerts.filter(a => a.stockId === s.id && !a.triggered).length
        ? `<em class="qa-badge">${state.alerts.filter(a => a.stockId === s.id && !a.triggered).length}</em>` : ''}</i>
      <span>Alerte</span></button>
  </div>

  <!-- Accès Nova (2026-09-23, "préparer visuellement les prochaines
       fonctionnalités" ; mis à jour suite au retour "Analyser une action
       c'est Nova AI") — voir novaSuiteRow() plus haut. Nova AI remplace
       ici l'ancien bouton "Analyse" du rang d'actions rapides ci-dessus
       (retiré, devenu redondant) : c'est la MÊME action réelle
       (data-nova, analyse multi-IA déjà existante), seulement rebaptisée
       et déplacée dans le nouveau rang Nova plutôt que dupliquée sous
       deux noms différents. Réservé aux actions (s.type==='stock'),
       comme l'était l'ancien bouton "Analyse" et comme l'est la section
       "Analyse IA" plus bas — une paire crypto/forex n'a rien à
       analyser de cette façon. Nova Review a sa page de présentation,
       réutilisée telle quelle. -->
  ${novaSuiteRow([
    ...(s.type === 'stock' ? [{ icon:'spark', accent:'#6d28d9', rgb:'109,40,217', title:'Nova AI',
      attr:`data-nova="${esc(s.id)}"` }] : []),
    { key:'novareview', page:'novareview' },
  ])}
  ${state.compare.length >= 2 ? `<button class="btn btn-ghost btn-sm" style="margin-top:10px" data-go="compare">
    Voir la comparaison (${state.compare.length})</button>` : ''}
  ${(() => {
    const mesAlertes = state.alerts.filter(a => a.stockId === s.id);
    if (!mesAlertes.length) return '';
    return `<div class="tiny" style="margin-top:10px">
      ${mesAlertes.map(a => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0">
        <span>${a.triggered ? '✓' : '○'} ${a.direction === 'above' ? '≥' : '≤'} ${esc(fmt.cur(a.target, s.cur))}${a.triggered ? ' · atteinte' : ''}</span>
        <button data-delete-alerte="${esc(a.id)}" aria-label="Retirer cette alerte" style="color:var(--ink-4)">${svg(ICON.x,2)}</button>
      </div>`).join('')}
    </div>`;
  })()}`;

  const TABS = [
    { id:'apercu', label:"Vue d'ensemble", content:tabApercu },
    ...(isStock ? [
      { id:'donnees', label:'Données', content:tabDonnees },
      { id:'analyse', label:'Analyse', content:tabAnalyse },
      { id:'actualites', label:'Actualités', content:tabActualites },
    ] : []),
    { id:'actions', label:'Actions', content:tabActions },
  ];
  const activeTab = TABS.some(t => t.id === state.ui.stockTab) ? state.ui.stockTab : 'apercu';

  return `<div class="page-in">
  ${header}

  <div class="seg" data-seg="stockTab" style="margin-top:22px;overflow-x:auto;flex-wrap:nowrap">
    ${TABS.map(t => `<button data-stock-tab="${t.id}" aria-pressed="${activeTab===t.id}">${esc(t.label)}</button>`).join('')}
  </div>

  ${TABS.find(t => t.id === activeTab)?.content || ''}
  </div>`;
};

/* Graphique de cours : trois états possibles, aucun quatrième. */
/* Volatilité annualisée et régularité (% de mois en hausse), calculées à
   partir de l'historique RÉEL déjà chargé (HIST) — jamais une nouvelle
   requête, jamais une estimation. Écart-type des rendements quotidiens
   annualisé (convention standard : ×√252), et pourcentage de mois dont
   la clôture est supérieure à celle du mois précédent. Retourne null (pas
   0) si l'historique est absent/insuffisant — l'appelant affiche alors
   "—", jamais une valeur fabriquée. */