PAGES.account = () => {
  const plan = { free:'Free', pro:'Pro', elite:'Elite' }[state.settings.plan] || 'Free';
  return `<div class="page-in">
    <h1 class="title">Profil</h1>

    <div class="card" style="margin-top:22px">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <span class="av" style="background:var(--ink)">${esc((state.auth.name||'NB').slice(0,2).toUpperCase())}</span>
        <div style="flex:1;min-width:150px">
          <p class="h3">${esc(state.auth.name || 'Non connecté')}</p>
          <p class="small">${esc(state.auth.email || '')} · offre ${plan}</p>
        </div>
        <div class="btns">
          <button class="btn btn-s btn-sm" data-signout>Se déconnecter</button>
          ${state.settings.plan !== 'free'
            ? `<button class="btn btn-s btn-sm" data-portal>Gérer mon abonnement</button>`
            : ''}
          <button class="btn btn-a btn-sm" data-go="pricing">Changer d'offre</button>
        </div>
      </div>
      ${quotaLigne()}
    </div>

    <section class="section">
      <h2 class="h2">Préférences</h2>
      <div class="card" style="margin-top:14px">
        <div class="kv"><dt>Affichage</dt><dd>
          <span class="seg" data-seg="mode"><button data-mode="debutant" aria-pressed="${!isExpert()}">Simple</button>
          <button data-mode="expert" aria-pressed="${isExpert()}">Détaillé</button></span></dd></div>
        <div class="kv"><dt>Thème</dt><dd>
          <span class="seg" data-seg="theme"><button data-set-theme="light" aria-pressed="${state.settings.theme!=='dark'}">Clair</button>
          <button data-set-theme="dark" aria-pressed="${state.settings.theme==='dark'}">Sombre</button></span></dd></div>
        <div class="kv"><dt>Devise d'affichage</dt><dd>EUR</dd></div>
        <div class="kv"><dt>Langue</dt><dd>Français</dd></div>
      </div>
    </section>

    <section class="section">
      <h2 class="h2">Ressources</h2>
      <div class="card" style="margin-top:14px"><div class="rows">
        ${[['settings','Réglages complets'],['method','Comment fonctionne le Nova Score'],['trust','Notre engagement de transparence'],
           ['pricing','Offres et tarifs'],['watchlist','Ma liste de suivi']].map(([g,l])=>`
          <button class="row" data-go="${g}"><span class="row-main"><span class="row-t">${esc(l)}</span></span>
            <span style="color:var(--ink-4)">${svg(ICON.arrow,2.4)}</span></button>`).join('')}
        <button class="row" data-guide><span class="row-main">
          <span class="row-t">Revoir les premiers pas</span>
          <span class="row-s">Les trois gestes essentiels</span></span></button>
        <button class="row" data-reset><span class="row-main">
          <span class="row-t">Effacer mes données locales</span>
          <span class="row-s">Liste de suivi et préférences</span></span></button>
      </div></div>
    </section>

    <p class="tiny" style="margin-top:24px">NovaTitre ne fournit aucun conseil en investissement
      personnalisé, ne collecte aucun ordre et ne détient aucun fonds. Investir comporte un risque
      de perte en capital.</p></div>`;
};

/* ---------- RÉGLAGES ---------- */
const LANGS = [
  { id:'fr', label:'Français', ready:true },
  { id:'en', label:'English',  ready:false },
  { id:'de', label:'Deutsch',  ready:false },
  { id:'es', label:'Español',  ready:false },
];
const CURRENCIES = [
  { id:'EUR', label:'Euro' },
  { id:'USD', label:'Dollar américain' },
  { id:'GBP', label:'Livre sterling' },
  { id:'CHF', label:'Franc suisse' },
];
const THEMES = [
  { id:'light', label:'Clair' },
  { id:'dark',  label:'Sombre' },
  { id:'auto',  label:'Système' },
];

function settingRow(label, help, control){
  return `<div class="set-row">
    <div class="set-txt"><b>${esc(label)}</b>${help?`<span>${esc(help)}</span>`:''}</div>
    <div class="set-ctl">${control}</div>
  </div>`;
}
function segControl(name, options, current){
  return `<div class="seg" data-seg="${esc(name)}">${options.map(o=>`
    <button data-set="${name}" data-val="${esc(String(o.id))}"
      aria-pressed="${String(current)===String(o.id)}"
      ${o.ready===false?'data-soon="1"':''}>${esc(o.label)}</button>`).join('')}</div>`;
}
function switchControl(name, on){
  return `<button class="sw" data-toggle-set="${name}" role="switch" aria-checked="${on}"
    aria-label="${esc(name)}"><i></i></button>`;
}

PAGES.settings = () => {
  const st = state.settings;
  return `<div class="page-in">
    <p class="eyebrow">Réglages</p>
    <h1 class="title">Tout personnaliser</h1>
    <p class="lead measure-l" style="margin-top:10px">Chaque réglage s'applique immédiatement
      et reste dans votre navigateur.</p>

    <section class="section">
      <h2 class="h2">Apparence</h2>
      <div class="card" style="margin-top:14px">
        ${settingRow('Thème', 'Suivre le système ajuste selon l\'heure de votre appareil.',
          segControl('theme', THEMES, st.theme))}
        ${settingRow('Niveau de détail', 'Simple masque les ratios avancés.',
          segControl('mode', [{id:'debutant',label:'Simple'},{id:'expert',label:'Détaillé'}], st.mode))}
        ${settingRow('Animations', 'Réduit les mouvements si vous préférez.',
          switchControl('animations', st.animations !== false))}
        ${settingRow('Taille du texte', null,
          segControl('fontSize', [{id:'normal',label:'Normal'},{id:'large',label:'Grand'}], st.fontSize||'normal'))}
      </div>
    </section>

    <section class="section">
      <h2 class="h2">Langue et région</h2>
      <div class="card" style="margin-top:14px">
        ${settingRow('Langue', 'Les autres langues arrivent : le socle est en place.',
          segControl('lang', LANGS, st.lang))}
        ${settingRow('Devise d\'affichage',
          'Les positions restent dans leur devise d\'origine, converties pour le total.',
          segControl('currency', CURRENCIES.map(c=>({id:c.id,label:c.id})), st.currency))}
        ${settingRow('Format des nombres', null,
          segControl('numFormat', [{id:'fr',label:'1 234,56'},{id:'en',label:'1,234.56'}], st.numFormat||'fr'))}
      </div>
    </section>

    <section class="section">
      <h2 class="h2">Affichage des données</h2>
      <div class="card" style="margin-top:14px">
        ${settingRow('Graphiques miniatures', 'Dans les listes d\'entreprises.',
          switchControl('sparklines', st.sparklines !== false))}
        ${settingRow('Afficher la couverture', 'Le pourcentage de données disponibles.',
          switchControl('showCoverage', st.showCoverage !== false))}
      </div>
    </section>

    <section class="section">
      <h2 class="h2">Notifications</h2>
      <div class="card" style="margin-top:14px">
        ${settingRow('Variation du Nova Score', 'Quand une note bouge de plus de 5 points.',
          switchControl('notifScore', st.notifScore === true))}
        ${settingRow('Seuils de prix', 'Sur les entreprises que vous suivez.',
          switchControl('notifPrice', st.notifPrice === true))}
        ${settingRow('Résumé hebdomadaire', null, switchControl('notifWeekly', st.notifWeekly === true))}
        <p class="tiny" style="margin-top:12px">Les notifications arrivent bientôt. Vos préférences
          sont enregistrées dès maintenant.</p>
      </div>
    </section>

    <section class="section">
      <h2 class="h2">Compte et données</h2>
      <div class="card" style="margin-top:14px">
        <div class="rows">
          <div class="row"><span class="row-main"><span class="row-t">Session</span>
            <span class="row-s">${esc(state.auth.email || 'non connecté')}</span></span>
            <button class="btn btn-s btn-sm" data-signout>Déconnexion</button></div>
          <div class="row"><span class="row-main"><span class="row-t">Offre</span>
            <span class="row-s">${esc(st.plan)}</span></span>
            <button class="btn btn-s btn-sm" data-go="pricing">Changer</button></div>
          <button class="row" data-guide><span class="row-main">
            <span class="row-t">Revoir les premiers pas</span>
            <span class="row-s">Les gestes essentiels</span></span>
            <span style="color:var(--ink-4)">${svg(ICON.arrow,2.4)}</span></button>
          <button class="row" data-export><span class="row-main">
            <span class="row-t">Exporter mes données</span>
            <span class="row-s">Liste de suivi, portefeuille, réglages</span></span>
            <span style="color:var(--ink-4)">${svg(ICON.arrow,2.4)}</span></button>
          <button class="row" data-reset><span class="row-main">
            <span class="row-t" style="color:var(--down)">Effacer mes données locales</span>
            <span class="row-s">Efface tout de ce navigateur</span></span></button>
        </div>
      </div>
    </section>

    <p class="tiny" style="margin-top:22px">NovaTitre ne fournit aucun conseil en investissement
      personnalisé, ne collecte aucun ordre et ne détient aucun fonds.</p>
    <p class="tiny" style="margin-top:8px">Version du fichier : <b>${esc(BUILD)}</b></p>
  </div>`;
};

/* ---------- MÉTHODE ---------- */
PAGES.method = () => `<div class="page-in">
  <p class="eyebrow">Transparence</p>
  <h1 class="title">Comment fonctionne le Nova Score</h1>
  <p class="lead measure-l" style="margin-top:12px">Tout est publié. Vous devez pouvoir recalculer
    une note vous-même, sans nous croire sur parole.</p>

  <section class="section">
    <h2 class="h2">Le chemin d'une donnée</h2>
    <div class="flow">
      ${[['Données','cours et comptes publiés'],
         ['Barèmes','chaque mesure ramenée sur 100'],
         ['8 composantes','pondérées, calculées si la donnée existe'],
         ['Nova Score','moyenne des composantes disponibles'],
         ['IA','avis qualitatif, aucun chiffre produit']]
        .map(([t2,d],i)=>`<div class="flow-s"><span class="flow-n">${i+1}</span>
          <span class="flow-txt"><b>${t2}</b><span>${d}</span></span></div>`).join('')}
    </div>
  </section>

  <section class="section">
    <h2 class="h2">Les huit composantes</h2>
    <div class="card" style="margin-top:14px;overflow-x:auto">
      <table class="t"><thead><tr><th>Composante</th><th>Poids</th><th>Mesure</th></tr></thead>
      <tbody>${COMPONENTS.map(c=>`<tr><td><b>${esc(c.label)}</b></td>
        <td class="tabular-nums">${c.weight} %</td><td class="small">${esc(c.from)}</td></tr>`).join('')}
        <tr><td><b>Total</b></td><td class="tabular-nums"><b>${WEIGHT_TOTAL} %</b></td><td></td></tr>
      </tbody></table>
    </div>
  </section>

  <section class="section">
    <div class="grid g-2">
      <div class="card"><h3 class="h3">Quand une donnée manque</h3>
        <p class="small" style="margin-top:10px">La composante est <b>ignorée</b>, jamais mise à zéro ni
          remplacée par une moyenne de secteur. Elle sort du calcul et le score se recalcule sur les poids restants.</p>
        <dl style="margin-top:12px">
          <div class="kv"><dt>Sous 40 % de couverture</dt><dd>aucun score</dd></div>
          <div class="kv"><dt>Entre 40 et 70 %</dt><dd>score partiel</dd></div>
          <div class="kv"><dt>Au-dessus de 70 %</dt><dd>comparable</dd></div>
        </dl></div>
      <div class="card"><h3 class="h3">Score n'est pas prévision</h3>
        <p class="small" style="margin-top:10px">Le Nova Score décrit ce qui est observable
          aujourd'hui : rentabilité, endettement, régularité, volatilité.</p>
        <p class="small" style="margin-top:10px">Une note élevée signifie « solide sur les critères
          mesurés », pas « action qui va monter ». Une note faible ne dit pas de vendre.</p></div>
    </div>
  </section>

  <section class="section">
    <h2 class="h2">Nos limites</h2>
    <div class="card" style="margin-top:14px"><ul class="pts bad">
      ${['Le score dépend de la qualité des données de la source : une erreur de source devient une erreur de score.',
         'Les barèmes sont identiques pour tous les secteurs, alors qu\'une banque et un éditeur de logiciels n\'ont pas la même structure de bilan.',
         'Les composantes de marché regardent le passé. Elles décrivent, elles ne prévoient pas.',
         'Rien de qualitatif n\'entre dans le score : gouvernance, litiges, dépendance à un client.']
        .map(x=>`<li><i>−</i><span>${esc(x)}</span></li>`).join('')}
    </ul></div>
  </section></div>`;

/* ---------- ENGAGEMENT ---------- */
PAGES.trust = () => `<div class="page-in">
  <p class="eyebrow">Engagement</p>
  <h1 class="title">Ce que nous ne ferons pas</h1>
  <p class="lead measure-l" style="margin-top:12px">La plupart des plateformes affichent leurs
    réussites. Nous préférons publier ce que nous ignorons.</p>

  <div class="grid g-2" style="margin-top:26px">
    ${[['Aucune performance inventée','Tant que nous n\'aurons pas assez d\'observations réelles, aucun taux de réussite ne sera publié.'],
       ['Aucune promesse de gain','Nous n\'écrirons jamais qu\'une action va monter.'],
       ['Aucun chiffre produit par une IA','Les modèles commentent nos chiffres, ils n\'en créent aucun.'],
       ['Aucune donnée comblée','Quand une donnée manque, l\'application le dit. Elle ne met jamais une moyenne à la place.']]
      .map(([t2,d])=>`<div class="card"><h3 class="h3">${esc(t2)}</h3>
        <p class="small" style="margin-top:10px">${esc(d)}</p></div>`).join('')}
  </div></div>`;

/* ---------- COMPARATEUR ---------- */
/* CORRECTIF (audit "comparateur", 2026-09-17) : la quasi-totalité de ces
   lignes lisait des noms de champs qui n'existent PAS dans l'objet réel
   renvoyé par /api/market/fundamentals (voir _providers.js) — .per au lieu
   de .pe, .margin au lieu de .profitMargin/.operatingMargin, .debtEquity/
   .revenueGrowth/.volatility qui n'existent nulle part. Résultat en
   pratique : toutes ces colonnes affichaient systématiquement
   "indisponible", pour CHAQUE société, même totalement analysée. ROE
   utilisait en plus fmt.num au lieu de fmt.pctRatio — un ratio décimal
   (0.20 = 20 %) affiché tel quel serait resté "0.2 %" au lieu de "20,0 %".
   Corrigés en réutilisant les vrais champs et les mêmes fonctions déjà
   éprouvées ailleurs dans ce fichier (croissanceSerie pour la fiche
   action, volatiliteAnnualisee pour "Les chiffres" détaillés) — jamais un
   second calcul divergent. */