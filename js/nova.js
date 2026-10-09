const HORIZON_JOURS = { court:90, moyen:365, long:Infinity };
const HORIZON_LABEL = { court:'court terme', moyen:'moyen terme', long:'long terme' };
/* Dernière thèse d'ACHAT renseignée pour ce titre, AVANT cette vente —
   même logique que derniereThese() (scripts/test-nova-memory.js), bornée
   dans le temps pour ne jamais faire remonter la thèse d'un rachat
   POSTÉRIEUR à la vente en cours de revue. */
function theseAvantVente(stockId, dateVente){
  const avant = state.transactions
    .filter(t => t.type === 'buy' && t.stockId === stockId && t.thesisReason
      && new Date(t.date) < new Date(dateVente))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return avant[0] || null;
}
/* CORRECTIF (2026-09-26, moteur de verdict Nova Review) : même principe
   que theseAvantVente() mais SANS exiger de thèse renseignée — sert à
   retrouver l'achat réel qui a constitué la position (pour en évaluer la
   concentration au moment de la décision), qu'une thèse ait été
   renseignée ou non. theseAvantVente() reste utilisée séparément pour le
   récit ("qu'aviez-vous déclaré ?") ; ce n'est PAS la même question que
   "quel achat concret a créé cette position ?" — les confondre aurait
   rendu la concentration invisible pour toute vente sans thèse
   enregistrée, alors qu'elle reste mesurable indépendamment. */
function dernierAchatAvant(stockId, date){
  const avant = state.transactions
    .filter(t => t.type === 'buy' && t.stockId === stockId && new Date(t.date) < new Date(date))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return avant[0] || null;
}
/* Seuils "court/moyen/long terme" (en jours) : une convention NovaTitre
   propre, jamais un fait de marché établi — sert uniquement à comparer la
   durée de détention réelle à l'horizon que l'UTILISATEUR LUI-MÊME avait
   choisi à l'achat (chips court/moyen/long d'openBuyReview), jamais
   affichée comme une vérité universelle de gestion de portefeuille. */
function compareHorizon(joursDetention, horizonKey){
  const seuil = HORIZON_JOURS[horizonKey];
  const label = HORIZON_LABEL[horizonKey];
  if (!Number.isFinite(seuil) && horizonKey !== 'long') return null;
  const j = Math.max(0, Math.round(joursDetention));
  if (horizonKey === 'long'){
    return j >= 365 ? { aligne:true, texte:`Conservé ${j} j — cohérent avec l'horizon « ${label} » annoncé.` }
                     : { aligne:false, texte:`Vendu après ${j} j — plus tôt que l'horizon « ${label} » annoncé.` };
  }
  return j <= seuil ? { aligne:true, texte:`Conservé ${j} j — cohérent avec l'horizon « ${label} » annoncé.` }
                     : { aligne:false, texte:`Conservé ${j} j — au-delà de l'horizon « ${label} » annoncé.` };
}

/* ============================================================
   MOTEUR DE VERDICT — Nova Review (2026-09-26, retour utilisateur :
   esprit "chess.com", séparer la qualité de la décision du résultat)
   ------------------------------------------------------------
   Chaque verdict ci-dessous est une étiquette parmi 6 (demandées
   explicitement : Excellent coup/Bon coup/Intéressant/Risqué/Erreur à
   étudier/Occasion manquée), choisie par un ARBRE DE DÉCISION
   DÉTERMINISTE sur des grandeurs RÉELLEMENT CALCULÉES — jamais une
   opinion de modèle de langage, aucun appel réseau ici, mêmes
   garanties que _novascore.js (moteur NovaTitre propre, barèmes
   documentés, reproductible). Les 3 seuils ci-dessous sont une
   convention NovaTitre assumée, pas un fait de marché établi — jamais
   présentés comme plus rigoureux qu'ils ne le sont. */
const VERDICT_CONCENTRATION_RISQUEE = .35; // part du CAPITAL INVESTI (coût, jamais une valeur de marché historique qu'on ne connaît pas)
const VERDICT_GAIN_EXCELLENT = .10;
const VERDICT_REGRET_MANQUE = .15;

/* Part (en coût, jamais en valeur de marché — l'historique de prix
   n'est pas conservé à chaque instant passé) que cet achat représentait
   dans le capital total déjà engagé au moment où il a eu lieu.
   Reconstruit en rejouant le journal RÉEL jusqu'à (sans l'inclure)
   cette transaction — réutilise rejouerTransactions(), déjà écrit pour
   la fusion du portefeuille (LOT D) et vérifié par ses propres tests.
   Renvoie null si le coût total (avant + cet achat) est nul (jamais une
   division par zéro déguisée en 0 %). */
function concentrationAuMomentDe(txAchat){
  if (!txAchat) return null;
  const avant = state.transactions.filter(t => new Date(t.date) < new Date(txAchat.date));
  const rejoue = rejouerTransactions(avant);
  const coutAvant = rejoue.positions.reduce((s, p) => s + toEUR(p.avg * p.qty, byId[p.id]?.cur || 'EUR'), 0);
  const total = coutAvant + txAchat.amountEUR;
  return total > 0 ? txAchat.amountEUR / total : null;
}

/* Verdict d'une VENTE réelle — décision fermée, résultat définitivement
   connu. */
function evaluerVente(tx){
  const cout = Number.isFinite(tx.realizedGain) ? tx.amountEUR - tx.realizedGain : null;
  const gainPct = (cout !== null && cout > 0) ? tx.realizedGain / cout : null;
  const q = queSiRienFait(tx);
  const regretPct = q && q.differencePct !== null ? q.differencePct / 100 : null;
  const theseAchat = theseAvantVente(tx.stockId, tx.date);
  let processAligne = null;
  if (theseAchat && theseAchat.thesisHorizon){
    const jours = (new Date(tx.date) - new Date(theseAchat.date)) / 86400000;
    const cmp = compareHorizon(jours, theseAchat.thesisHorizon);
    processAligne = cmp ? cmp.aligne : null;
  }
  const concentration = concentrationAuMomentDe(dernierAchatAvant(tx.stockId, tx.date));

  const raisons = [];
  if (gainPct !== null) raisons.push(`${gainPct >= 0 ? 'Gain' : 'Perte'} réalisé${gainPct >= 0 ? '' : 'e'} de ${fmt.pctRatio(Math.abs(gainPct), 1)}.`);
  if (regretPct !== null && Math.abs(regretPct) >= .03){
    raisons.push(regretPct >= 0
      ? `Conserver aurait rapporté ${fmt.pct(regretPct * 100, 1)} de plus à ce jour.`
      : `Vendre a évité ${fmt.pctRatio(Math.abs(regretPct), 1)} de baisse supplémentaire (valeur actuelle plus basse que le montant récupéré).`);
  }
  /* HORIZON_LABEL non ré-échappé ici (même correctif que `lecon`
     ci-dessous) : raisons[] est échappé UNE SEULE FOIS, au rendu, dans
     carteDecisionNovaReview() ("<li>${esc(r)}</li>"). */
  if (processAligne === true) raisons.push(`Horizon « ${HORIZON_LABEL[theseAchat.thesisHorizon]} » annoncé à l'achat respecté.`);
  if (processAligne === false) raisons.push(`Vendu en dehors de l'horizon « ${HORIZON_LABEL[theseAchat.thesisHorizon]} » annoncé à l'achat.`);
  if (!theseAchat) raisons.push(`Aucune thèse enregistrée pour l'achat correspondant.`);
  if (concentration !== null && concentration >= VERDICT_CONCENTRATION_RISQUEE){
    raisons.push(`Cet achat représentait ${fmt.pctRatio(concentration, 0)} du capital investi à l'époque — position concentrée.`);
  }

  let verdict;
  if (regretPct !== null && regretPct >= VERDICT_REGRET_MANQUE) verdict = 'Occasion manquée';
  else if (gainPct === null) verdict = 'Intéressant';
  else if (gainPct >= VERDICT_GAIN_EXCELLENT && processAligne !== false) verdict = 'Excellent coup';
  else if (gainPct >= 0 && processAligne !== false) verdict = 'Bon coup';
  else if (gainPct >= 0 && processAligne === false) verdict = 'Intéressant';
  else if (gainPct < 0 && concentration !== null && concentration >= VERDICT_CONCENTRATION_RISQUEE) verdict = 'Risqué';
  else verdict = 'Erreur à étudier';

  return { verdict, raisons, gainPct, regretPct, processAligne, concentration };
}

/* Verdict d'une position OUVERTE (achat non encore soldé) — résultat
   PAS encore connu, seulement une lecture provisoire au cours actuel.
   Jamais "Occasion manquée" (n'a de sens que pour un titre qu'on ne
   détient plus, voir queSiRienFait) ni un jugement définitif — la
   position reste ouverte, le verdict peut changer demain. */
function evaluerPositionOuverte(pos){
  const st = byId[pos.id];
  const prix = st ? prixDe(st) : null;
  if (!st || prix === null) return null;
  const gainPct = (prix - pos.avg) / pos.avg;
  const theseAchat = theseAvantVente(pos.id, new Date().toISOString());
  const concentration = concentrationAuMomentDe(dernierAchatAvant(pos.id, new Date().toISOString()));

  const raisons = [`Position ouverte : ${gainPct >= 0 ? 'gain' : 'perte'} latent${gainPct >= 0 ? '' : 'e'} de ${fmt.pctRatio(Math.abs(gainPct), 1)}, pas encore un résultat définitif.`];
  if (theseAchat?.thesisReason) raisons.push(`Thèse déclarée à l'achat toujours en cours.`);
  else raisons.push(`Aucune thèse enregistrée pour cet achat.`);
  if (concentration !== null && concentration >= VERDICT_CONCENTRATION_RISQUEE){
    raisons.push(`Représente ${fmt.pctRatio(concentration, 0)} du capital investi à l'achat — position concentrée.`);
  }

  let verdict;
  if (concentration !== null && concentration >= VERDICT_CONCENTRATION_RISQUEE) verdict = 'Risqué';
  else if (gainPct >= VERDICT_GAIN_EXCELLENT) verdict = 'Excellent coup';
  else if (gainPct >= 0) verdict = 'Bon coup';
  else if (gainPct >= -.10) verdict = 'Intéressant';
  else verdict = 'Erreur à étudier';

  return { verdict, raisons, gainPct, regretPct:null, processAligne:null, concentration, ouverte:true };
}

const VERDICT_STYLE = {
  'Excellent coup':   { accent:'#16a34a', rgb:'22,163,74'  },
  'Bon coup':         { accent:'#45D69A', rgb:'69,214,154' },
  'Intéressant':      { accent:'#8d95a4', rgb:'141,149,164' },
  'Risqué':           { accent:'#f59e0b', rgb:'245,158,11' },
  'Erreur à étudier': { accent:'#FF647C', rgb:'255,100,124' },
  'Occasion manquée': { accent:'#8b5cf6', rgb:'139,92,246' },
};

/* Bilan hebdomadaire (retour utilisateur : "performance, meilleure
   décision, décision la plus risquée, diversification, leçon de la
   semaine") — uniquement des faits déjà calculés ailleurs dans ce
   fichier (walletHistory pour la performance réelle, portfolioValue()
   pour la diversification), jamais une statistique recalculée en
   double avec une formule différente qui pourrait diverger. null si
   aucune transaction dans les 7 derniers jours — jamais un bilan vide
   présenté comme une fonctionnalité active. */
function bilanHebdomadaireNovaReview(){
  const depuis = Date.now() - 7 * 86400000;
  const ventes = state.transactions.filter(t => t.type === 'sell' && new Date(t.date).getTime() >= depuis);
  const achats = state.transactions.filter(t => t.type === 'buy' && new Date(t.date).getTime() >= depuis);
  if (!ventes.length && !achats.length) return null;

  const evals = ventes.map(tx => ({ tx, ev: evaluerVente(tx) }));

  const meilleure = evals.filter(e => e.ev.gainPct !== null).sort((a, b) => b.ev.gainPct - a.ev.gainPct)[0] || null;
  const plusRisquee = evals.filter(e => e.ev.concentration !== null).sort((a, b) => b.ev.concentration - a.ev.concentration)[0] || null;
  const aEtudier = evals.filter(e => e.ev.verdict === 'Erreur à étudier' || e.ev.verdict === 'Occasion manquée')
    .sort((a, b) => new Date(b.tx.date) - new Date(a.tx.date))[0] || null;

  const pointsRecents = state.walletHistory.filter(p => p.t >= depuis);
  let performance = null;
  if (pointsRecents.length >= 2){
    const premier = pointsRecents[0], dernier = pointsRecents[pointsRecents.length - 1];
    if (premier.totalValue > 0){
      performance = { variation: dernier.totalValue - premier.totalValue,
        variationPct: (dernier.totalValue / premier.totalValue - 1) * 100 };
    }
  }

  const pf = portfolioValue();
  const bySector = {};
  for (const l of pf.lines){ if (l.priceAvailable && l.value > 0){ const sect = l.stock?.sector || 'Non classé'; bySector[sect] = (bySector[sect] || 0) + l.value; } }
  const secteursDistincts = Object.keys(bySector).length;
  const maxPositionPct = pf.value ? Math.round(Math.max(0, ...pf.lines.filter(l => l.priceAvailable).map(l => l.value)) / pf.value * 100) : 0;

  /* CORRECTIF (2026-09-28, retour utilisateur : "&" s'affiche "&amp;") :
     `lecon` reste du TEXTE BRUT ici, jamais pré-échappé — esc() n'est
     appliqué QU'UNE SEULE FOIS, au moment du rendu (voir
     `${esc(bilan.lecon)}` dans PAGES.novareview). Avant ce correctif,
     esc(aEtudier.tx.name) était déjà appliqué ICI, puis bilan.lecon
     (contenant donc déjà "&amp;" pour une société comme "AT&T") était
     échappé UNE SECONDE FOIS au rendu — "&" devenait "&amp;" puis
     "&amp;amp;", que le navigateur affiche littéralement "&amp;"
     (un seul niveau de déséchappement HTML). Même règle que partout
     ailleurs dans ce fichier : esc() uniquement à la frontière finale
     HTML, jamais sur une valeur intermédiaire réutilisée ensuite. */
  let lecon = null;
  if (aEtudier){
    lecon = aEtudier.ev.verdict === 'Occasion manquée'
      ? `Sur ${aEtudier.tx.name}, conserver aurait rapporté plus — vérifiez si l'horizon annoncé à l'achat était vraiment respecté avant de vendre.`
      : `Sur ${aEtudier.tx.name}, revoyez ${aEtudier.ev.processAligne === false ? "l'écart entre l'horizon annoncé et la durée réelle de détention" : "la thèse (ou son absence) au moment de l'achat"}.`;
  } else if (maxPositionPct >= Math.round(VERDICT_CONCENTRATION_RISQUEE * 100)){
    lecon = `Une position représente ${maxPositionPct} % de votre portefeuille actuel — envisagez de diversifier davantage.`;
  }

  return { ventes, achats, meilleure, plusRisquee, performance, secteursDistincts, maxPositionPct, lecon };
}

/* Résumé en 3 compteurs pour la grande carte Nova Review de l'accueil
   (§55-56 du prompt maître NovaTitre : "3 bonnes décisions / 1 erreur /
   2 points à surveiller"). Reclasse les MÊMES verdicts que
   PAGES.novareview/VERDICT_STYLE ci-dessus (jamais une 2e grille de
   verdicts qui pourrait diverger) en 3 catégories : bonnes décisions
   (Excellent coup/Bon coup), à surveiller (Risqué/Intéressant), erreurs
   (Erreur à étudier/Occasion manquée). null si bilanHebdomadaireNovaReview()
   l'est déjà (aucune transaction cette semaine) — jamais un résumé vide
   présenté comme actif. Même fenêtre de 7 jours que le bilan complet :
   une position achetée il y a 2 mois et toujours ouverte n'est pas une
   "décision récente" à faire remonter sur l'accueil. */
function resumeNovaReviewPourCarte(){
  const bilan = bilanHebdomadaireNovaReview();
  if (!bilan) return null;
  const compte = { bonnes: 0, surveiller: 0, erreurs: 0 };
  const comptabiliser = (verdict) => {
    if (verdict === 'Excellent coup' || verdict === 'Bon coup') compte.bonnes++;
    else if (verdict === 'Risqué' || verdict === 'Intéressant') compte.surveiller++;
    else if (verdict === 'Erreur à étudier' || verdict === 'Occasion manquée') compte.erreurs++;
  };
  bilan.ventes.forEach(tx => comptabiliser(evaluerVente(tx).verdict));
  bilan.achats.forEach(tx => {
    const pos = state.wallet.positions.find(p => p.id === tx.stockId);
    if (!pos) return; // déjà revendue : sa vente (si dans la fenêtre) est déjà comptée ci-dessus, jamais compter deux fois
    const ev = evaluerPositionOuverte(pos);
    if (ev) comptabiliser(ev.verdict);
  });
  return { ...compte, total: compte.bonnes + compte.surveiller + compte.erreurs };
}

/* Grande carte Nova Review de l'accueil (§54-56 du prompt maître
   NovaTitre : "les quatre modules Nova sont actuellement beaucoup trop
   petits [...] ils deviennent le cœur de l'accueil" — cette carte
   remplace l'ancienne petite tuile novaHubCard('novareview') dans
   PAGES.home, voir js/page-home.js). Données réelles uniquement (§59,
   §81) : resumeNovaReviewPourCarte() renvoie null tant qu'aucune
   transaction récente n'existe, jamais un faux "0 décision" présenté
   comme une analyse active — état vide honnête à la place, même texte
   que l'état vide de PAGES.novareview elle-même, jamais un second texte
   qui pourrait diverger. */
function novaReviewHomeCard(){
  const resume = resumeNovaReviewPourCarte();
  const f = NOVA_FEATURES.novareview;
  return `<button type="button" class="nova-big-card" data-go="novareview" style="--nf-accent:${f.accent};--nf-accent-rgb:${f.rgb}">
    ${chessNovaIcon('novareview')}
    <div class="nova-big-body">
    <p class="nova-big-eyebrow">Nova Review</p>
    ${resume ? `
      <p class="nova-big-lead">Votre analyse de la semaine est prête.</p>
      <ul class="nova-big-stats">
        ${resume.bonnes ? `<li><span class="nova-big-dot" style="background:${VERDICT_STYLE['Bon coup'].accent}"></span>${resume.bonnes} bonne${resume.bonnes > 1 ? 's' : ''} décision${resume.bonnes > 1 ? 's' : ''}</li>` : ''}
        ${resume.erreurs ? `<li><span class="nova-big-dot" style="background:${VERDICT_STYLE['Erreur à étudier'].accent}"></span>${resume.erreurs} erreur${resume.erreurs > 1 ? 's' : ''}</li>` : ''}
        ${resume.surveiller ? `<li><span class="nova-big-dot" style="background:${VERDICT_STYLE['Risqué'].accent}"></span>${resume.surveiller} point${resume.surveiller > 1 ? 's' : ''} à surveiller</li>` : ''}
        ${!resume.total ? `<li><span class="nova-big-dot" style="background:var(--ink-4)"></span>Rien à signaler cette semaine</li>` : ''}
      </ul>` : `
      <p class="nova-big-lead">Analyse vos décisions passées et vous montre ce que vous auriez pu améliorer.</p>`}
    <span class="nova-big-link">Voir mon analyse →</span>
    </div>
  </button>`;
}

/* Grande carte NovaBot de l'accueil (§54-56, même principe que
   novaReviewHomeCard() ci-dessus — 2e des 4 modules). 3 états honnêtes
   (§59/§81, jamais une donnée fictive) :
   1. jamais activé ET aucune transaction simulée -> teaser, aucun chiffre.
   2. activé mais jamais encore évalué -> dit explicitement "pas encore
      évalué", jamais un portefeuille à 10 000 € (capital de départ
      fictif, cfg.wallet.invested) présenté comme un vrai résultat.
   3. au moins une décision simulée -> vrais chiffres (novabotPortfolioValue(),
      déjà utilisée par PAGES.novabot — jamais un 2e calcul qui pourrait
      diverger) + dernière décision réelle du journal. */
function novabotHomeCard(){
  const cfg = state.novabot;
  const aDejaDecide = cfg.transactions.length > 0;
  const derniere = aDejaDecide ? cfg.transactions[cfg.transactions.length - 1] : null;
  const f = NOVA_FEATURES.novabot;
  return `<button type="button" class="nova-big-card" data-go="novabot" style="--nf-accent:${f.accent};--nf-accent-rgb:${f.rgb}">
    ${chessNovaIcon('novabot')}
    <div class="nova-big-body">
    <p class="nova-big-eyebrow">NovaBot</p>
    ${aDejaDecide ? (() => {
      const pf = novabotPortfolioValue();
      return `
      <p class="nova-big-lead tabular-nums">${fmt.eur(pf.total)} <span class="${pf.gainPct>=0?'up-t':'down-t'}" style="font-size:15px;font-weight:700">${pf.gainPct>=0?'+':''}${fmt.num(pf.gainPct,2)} %</span></p>
      <p class="nova-big-sub">Dernière décision : ${derniere.type === 'buy' ? 'Achat' : 'Vente'} simulé${derniere.type==='buy'?'':'e'} · ${esc(derniere.name)}</p>`;
    })() : cfg.enabled ? `
      <p class="nova-big-lead">NovaBot est activé mais n'a pas encore été évalué.</p>
      <p class="nova-big-sub">Ouvrez NovaBot et cliquez sur « Évaluer maintenant » pour une première simulation.</p>` : `
      <p class="nova-big-lead">Gère un portefeuille simulé selon votre stratégie et vos règles.</p>`}
    <span class="nova-big-link">Ouvrir NovaBot →</span>
    </div>
  </button>`;
}

/* Commentaire IA du bilan (2026-09-26, retour utilisateur : "je veux
   vraiment que ce soit complet et que ce soit réalisé avec l'IA") —
   réutilise EXACTEMENT le même mécanisme que Nova AI sur une fiche
   action (authFetch('/api/analyze'), même quota, même identité "Nova
   AI" unique côté utilisateur) : un NOUVEAU mode ('novareview') plutôt
   qu'un appel par décision (20 décisions = 20 appels aurait épuisé le
   quota d'analyses pour rien) — UN seul appel commente TOUT le bilan de
   la semaine. Le verdict de chaque décision reste calculé par le moteur
   déterministe ci-dessus (evaluerVente/evaluerPositionOuverte) : le
   modèle ne fait QUE commenter ces verdicts déjà tranchés, jamais en
   produire lui-même (verrou identique côté serveur). État module-level,
   jamais persisté : un commentaire se régénère à chaque bilan différent. */
let NOVA_REVIEW_IA = { status:'idle', commentaire:null };
function construireBilanPourIA(bilan){
  const decisions = [];
  for (const tx of bilan.ventes){
    const ev = evaluerVente(tx);
    decisions.push({ nom: tx.name, type:'vente', verdict: ev.verdict,
      gainPct: ev.gainPct !== null ? Math.round(ev.gainPct * 1000) / 10 : null,
      regretPct: ev.regretPct !== null ? Math.round(ev.regretPct * 1000) / 10 : null,
      concentrationPct: ev.concentration !== null ? Math.round(ev.concentration * 1000) / 10 : null,
      raisons: ev.raisons });
  }
  for (const tx of bilan.achats){
    const pos = state.wallet.positions.find(p => p.id === tx.stockId);
    if (!pos) continue;   // déjà revendue : sa vente (si dans la fenêtre) est déjà comptée ci-dessus, jamais compter deux fois la même position
    const ev = evaluerPositionOuverte(pos);
    if (!ev) continue;
    decisions.push({ nom: tx.name, type:'position_ouverte', verdict: ev.verdict,
      gainPct: ev.gainPct !== null ? Math.round(ev.gainPct * 1000) / 10 : null,
      regretPct: null, concentrationPct: ev.concentration !== null ? Math.round(ev.concentration * 1000) / 10 : null,
      raisons: ev.raisons });
  }
  return { decisions,
    performanceVariationPct: bilan.performance ? Math.round(bilan.performance.variationPct * 10) / 10 : null,
    secteursDistincts: bilan.secteursDistincts,
    maxPositionPct: bilan.maxPositionPct };
}
async function genererCommentaireNovaReview(){
  if (NOVA_REVIEW_IA.status === 'loaded' || NOVA_REVIEW_IA.status === 'loading') return;
  if (state.auth.status !== 'authenticated'){ toast('Connectez-vous pour utiliser l’IA.'); return; }
  const bilan = bilanHebdomadaireNovaReview();
  if (!bilan){ toast('Aucune décision cette semaine à commenter.'); return; }

  NOVA_REVIEW_IA = { status:'loading', commentaire:null };
  render();
  let d;
  try {
    const r = await authFetch('/api/analyze', { method:'POST',
      body: JSON.stringify({ mode:'novareview', bilan: construireBilanPourIA(bilan) }) });
    d = await r.json();
    if (!r.ok) throw Object.assign(new Error(d.error || 'erreur'), { data:d });
  } catch (e){
    const err = e.data || {};
    const key = err.code || err.error;
    const msg = { non_connecte:'Votre session a expiré. Reconnectez-vous.',
      quota_exceeded: err.message || 'Quota mensuel atteint.',
      aucun_modele_configure:"Aucun modèle n'est configuré sur le serveur.",
      bilan_vide:"Aucune décision exploitable cette semaine.",
      delai_depasse:"Le modèle n'a pas répondu à temps.",
      fournisseur_en_erreur:`Le fournisseur a répondu ${err.status || ''}.`,
    }[key] || "Le commentaire IA n'a pas abouti.";
    NOVA_REVIEW_IA = { status:'error', commentaire:null, erreur: msg };
    render();
    return;
  }
  if (d.quota && state.account) Object.assign(state.account, d.quota);
  NOVA_REVIEW_IA = { status:'loaded', commentaire: d.commentaire || null };
  render();

  /* Nova Core (§4, §13, 2026-10-06) : "Cette Review constitue également le
     premier message d'une conversation." Le commentaire venait d'être
     généré avec succès (ligne précédente) mais restait entièrement
     éphémère — NOVA_REVIEW_IA n'est qu'une variable en mémoire, perdue au
     prochain rechargement, jamais consultable dans un historique. Persisté
     ici en arrière-plan, APRÈS avoir montré le commentaire (render() déjà
     fait juste au-dessus) : un échec de sauvegarde ne doit jamais empêcher
     l'utilisateur de voir le commentaire qu'il vient d'obtenir — même
     discipline d'échec silencieux que pushPortfolio()/novaConversationCreer
     eux-mêmes. Pas encore de suite conversationnelle (poser une question
     après coup) dans cette passe — seulement rendre ce premier échange
     durable, prochaine étape logique une fois ce socle vérifié en usage. */
  if (d.commentaire){
    const c = d.commentaire;
    let contenu = c.resume || '';
    if (Array.isArray(c.points) && c.points.length) contenu += '\n\n' + c.points.map(p => '• ' + p).join('\n');
    if (c.lecon) contenu += '\n\nLeçon : ' + c.lecon;
    if (contenu){
      novaConversationCreer('novareview', {
        title: `Nova Review — Analyse du ${new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })}`,
        context: { bilan: construireBilanPourIA(bilan) },
      }).then(conv => {
        if (!conv?.id) return;
        novaMessageEnvoyer(conv.id, 'assistant', contenu, { provider: d.provider || null, model: d.model || null });
      });
    }
  }
}
/* Carte d'une décision (vente fermée OU position encore ouverte),
   réutilisée par les 2 sections de PAGES.novareview ci-dessous — même
   structure (badge de verdict + faits + raisons), seule la ligne de
   sous-titre diffère. */
function carteDecisionNovaReview(tx, ev){
  const style = VERDICT_STYLE[ev.verdict];
  const dateTx = new Date(tx.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
  const sousTitre = ev.ouverte
    ? `Acheté le ${dateTx} · ${fmt.eur(tx.amountEUR)} investis`
    : `Vendu le ${dateTx} · ${fmt.eur(tx.amountEUR)} récupérés`;
  return `<div class="row" style="padding:14px 0;align-items:flex-start;flex-direction:column;gap:8px">
    <div style="display:flex;justify-content:space-between;width:100%;align-items:flex-start;gap:10px">
      <span class="row-main">
        <span class="row-t">${esc(tx.name)}</span>
        <span class="row-s">${sousTitre}</span>
      </span>
      <span class="tag" style="flex:0 0 auto;background:rgba(${style.rgb},.14);color:${style.accent}">${esc(ev.verdict)}</span>
    </div>
    <ul style="margin:0;padding-left:18px;color:var(--ink-4);font-size:12.5px;line-height:1.6">
      ${ev.raisons.map(r => `<li>${esc(r)}</li>`).join('')}
    </ul>
  </div>`;
}
PAGES.novareview = () => {
  const f = NOVA_FEATURES.novareview;
  const ventes = state.transactions.filter(t => t.type === 'sell').slice().reverse();
  const positionsOuvertes = state.wallet.positions
    .map(pos => ({ tx: { name: byId[pos.id]?.name || pos.id, date: (theseAvantVente(pos.id, new Date().toISOString())?.date) || new Date().toISOString(),
        amountEUR: toEUR(pos.avg * pos.qty, byId[pos.id]?.cur || 'EUR') }, ev: evaluerPositionOuverte(pos) }))
    .filter(x => x.ev);

  if (!ventes.length && !positionsOuvertes.length){
    return `<div class="page-in">
      <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>
      <div class="empty" style="padding-top:8px">
        <div class="empty-i" style="background:rgba(${f.rgb},.14);color:${f.accent}">${svg(ICON[f.icon],1.7)}</div>
        <h3 style="font-size:22px;margin-top:18px">${esc(f.title)}</h3>
        <p style="max-width:46ch">Nova Review comparera vos décisions passées — ce que vous aviez prévu à l'achat — à ce qui s'est réellement passé, dès votre premier achat ou votre première vente.</p>
      </div>
    </div>`;
  }

  const bilan = bilanHebdomadaireNovaReview();

  return `<div class="page-in">
    <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>
    <h1 class="title">${esc(f.title)}</h1>
    <p class="lead measure-l" style="margin-top:10px">Ce que vous aviez prévu à l'achat, comparé à ce qui s'est réellement passé — jamais un jugement inventé, seulement des faits comparés à votre propre intention déclarée.</p>

    ${bilan ? `<section class="section">
      <div class="section-h"><h2 class="h2">Bilan des 7 derniers jours</h2></div>
      <div class="card">
        <dl>
          <div class="kv"><dt>Décisions</dt><dd class="tabular-nums">${bilan.achats.length} achat${bilan.achats.length>1?'s':''} · ${bilan.ventes.length} vente${bilan.ventes.length>1?'s':''}</dd></div>
          ${bilan.performance ? `<div class="kv"><dt>Performance du portefeuille</dt><dd class="tabular-nums ${bilan.performance.variation>=0?'up-t':'down-t'}">${bilan.performance.variation>=0?'+':''}${fmt.eur(bilan.performance.variation)} (${fmt.pct(bilan.performance.variationPct,1)})</dd></div>` : ''}
          ${bilan.meilleure ? `<div class="kv"><dt>Meilleure décision</dt><dd style="text-align:right">${esc(bilan.meilleure.tx.name)}<br><span class="tiny">${esc(bilan.meilleure.ev.verdict)}</span></dd></div>` : ''}
          ${bilan.plusRisquee && bilan.plusRisquee.ev.concentration !== null ? `<div class="kv"><dt>Décision la plus risquée</dt><dd style="text-align:right">${esc(bilan.plusRisquee.tx.name)}<br><span class="tiny">${fmt.pctRatio(bilan.plusRisquee.ev.concentration,0)} du capital investi</span></dd></div>` : ''}
          <div class="kv"><dt>Diversification</dt><dd class="tabular-nums">${bilan.secteursDistincts} secteur${bilan.secteursDistincts>1?'s':''} · position la + importante : ${bilan.maxPositionPct} %</dd></div>
        </dl>
        ${bilan.lecon ? `<p class="tiny" style="margin-top:14px;color:var(--ink-3)"><b>Leçon de la semaine :</b> ${esc(bilan.lecon)}</p>` : ''}
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--line-2)">
          ${NOVA_REVIEW_IA.status === 'idle' ? `
            <button class="btn btn-a btn-sm" data-nova-review-ia>Commenter avec Nova AI</button>`
          : NOVA_REVIEW_IA.status === 'loading' ? `
            <div class="spin-wrap" style="padding:12px 0">
              <span class="nova-orb"><i></i><i></i><i></i></span>
              <span class="spin-txt">Nova AI commente votre semaine…</span>
            </div>`
          : NOVA_REVIEW_IA.status === 'error' ? `
            <div class="notice"><b>${esc(NOVA_REVIEW_IA.erreur || "Le commentaire IA n'a pas abouti.")}</b></div>`
          : (() => { const c = NOVA_REVIEW_IA.commentaire; if (!c) return ''; return `
            <p class="eyebrow">Nova AI</p>
            <p class="small" style="margin-top:6px">${esc(c.resume || '')}</p>
            ${(c.points || []).length ? `<ul class="pts good" style="margin-top:10px">
              ${c.points.map(p => `<li><i>•</i><span>${esc(p)}</span></li>`).join('')}</ul>` : ''}
            ${c.lecon ? `<p class="tiny" style="margin-top:10px;color:var(--ink-3)"><b>Leçon (Nova AI) :</b> ${esc(c.lecon)}</p>` : ''}
            <p class="tiny" style="margin-top:10px">Commentaire généré à partir des verdicts calculés ci-dessus par NovaTitre — jamais l'inverse.</p>`; })()}
        </div>
      </div>
    </section>` : ''}

    ${positionsOuvertes.length ? `<section class="section">
      <div class="section-h"><h2 class="h2">Positions en cours</h2></div>
      <div class="card"><div class="rows">
        ${positionsOuvertes.map(({ tx, ev }) => carteDecisionNovaReview(tx, ev)).join('')}
      </div></div>
    </section>` : ''}

    ${ventes.length ? `<section class="section">
      <div class="section-h"><h2 class="h2">Décisions passées</h2></div>
      <div class="card"><div class="rows">
        ${ventes.map(tx => carteDecisionNovaReview(tx, evaluerVente(tx))).join('')}
      </div></div>
    </section>` : ''}
  </div>`;
};
/* NovaBot (LOT I, Étape 3, 2026-09-24) : simulation de trading réelle
   (voir evaluerNovaBot() et le bloc NOVABOT plus haut), plus une page de
   présentation. Réutilise les mêmes composants que Réglages (settingRow)
   et Portefeuille (.card/.rows/.row/dl/kv) plutôt que d'en inventer de
   nouveaux. */
/* Refonte UX COMPLÈTE de NovaBot (2026-10-08, 2e passe — "ce n'est PAS ce
   que je demande [...] je veux une véritable expérience comparable à
   ChatGPT [...] combinée à une interface de portefeuille [...] inspirée
   de Revolut [...] tu as maintenant l'autorisation de RECONSTRUIRE
   ENTIÈREMENT L'INTERFACE DE NOVABOT"). Identité graphique NovaTitre
   intégralement conservée : chaque couleur ici vient de var(--bg-2/-3/-4,
   --ink*, --accent*, --line) déjà existants, chaque composant de base
   (.card/.row/.field/.btn-a/.sw/.tag/.seg) est réutilisé tel quel — ce qui
   change RÉELLEMENT, c'est la STRUCTURE : deux espaces (Conversations /
   Portefeuille), conversations multiples avec historique, panneau latéral
   responsive, portefeuille façon Revolut avec courbe interactive et fonds
   simulés. Seules nb-chat-shell/nb-sidebar/nb-conv-item/nb-hero/nb-tabs (voir
   styles.css) sont de nouvelles RÈGLES DE MISE EN PAGE, jamais de
   nouvelles couleurs. */

function novabotOuvrirDecision(id){
  const d = state.novabot.decisions.find(x => x.id === id);
  if (!d) return;
  const dateD = new Date(d.date).toLocaleString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const ACTION_LABEL = { buy:'Achat simulé', sell:'Vente simulée', reject:'Refusé', watch:'Mise en surveillance', hold:'Conservé', increase:'Renforcement', reduce:'Allègement' };
  const enAttente = d.executionStatus === 'pending';
  const question = `Pourquoi as-tu ${d.action === 'buy' ? 'acheté' : d.action === 'sell' ? 'vendu' : 'pris cette décision sur'} ${d.name || d.ticker} le ${new Date(d.date).toLocaleDateString('fr-FR')} ?`;
  openSheet(`<h3 id="sheetTitle">${enAttente ? 'Proposition d\'achat' : (ACTION_LABEL[d.action] || d.action)} · ${esc(d.name || d.ticker || '')}</h3>
    <p class="tiny" style="margin-top:6px;color:var(--ink-4)">${dateD}</p>
    ${enAttente ? `<p class="tiny" style="margin-top:8px;color:var(--warn);font-weight:650">En attente de ton accord (mode ${state.novabot.autonomyMode === 'advice' ? 'conseil' : 'semi-autonome'})</p>` : ''}
    <p style="margin-top:14px;line-height:1.5">${esc(d.reason || '')}</p>
    ${Number.isFinite(d.priceObserved) ? `<div class="kv" style="margin-top:14px"><dt>Cours observé</dt><dd class="tabular-nums">${fmt.cur(d.priceObserved, 'EUR')}</dd></div>` : ''}
    ${Number.isFinite(d.amountEUR) ? `<div class="kv"><dt>Montant</dt><dd class="tabular-nums">${fmt.eur(d.amountEUR)}</dd></div>` : ''}
    ${Number.isFinite(d.weightBeforePct) && Number.isFinite(d.weightAfterPct) && !enAttente ? `<div class="kv"><dt>Poids avant / après</dt><dd class="tabular-nums">${fmt.num(d.weightBeforePct,1)} % → ${fmt.num(d.weightAfterPct,1)} %</dd></div>` : ''}
    ${Number.isFinite(d.confidence) ? `<div class="kv"><dt>Confiance Nova AI</dt><dd class="tabular-nums">${d.confidence} %</dd></div>` : ''}
    ${d.aiProvider ? `<div class="kv"><dt>Second avis</dt><dd>${esc(d.aiProvider)} · ${esc(d.aiModel || '')}</dd></div>` : ''}
    ${d.riskResult && !d.riskResult.allowed ? `<p class="tiny" style="margin-top:10px;color:var(--warn)">Refusé par le Risk Engine : ${esc((d.riskResult.violations||[]).map(v=>v.message).join(' '))}</p>` : ''}
    ${enAttente ? `
      <div class="btns" style="margin-top:18px">
        <button class="btn btn-s" style="flex:1" data-novabot-decision-refuse="${esc(d.id)}">Refuser</button>
        <button class="btn btn-a" style="flex:1" data-novabot-decision-accept="${esc(d.id)}">Accepter</button>
      </div>`
      : `<button class="btn btn-a" style="width:100%;margin-top:18px" data-novabot-ask="${esc(question)}">Demander à Nova pourquoi →</button>`}
  `);
}

/* Position détenue (§7) — même esprit que novabotOuvrirDecision(). */
function novabotOuvrirPosition(stockId){
  const pf = novabotPortfolioValue();
  const l = pf.lines.find(x => x.id === stockId);
  if (!l) return;
  const st = l.stock;
  const hist = state.novabot.transactions.filter(t => t.stockId === stockId).slice().reverse();
  const question = `Pourquoi détiens-tu ${st ? st.name : stockId} dans mon portefeuille NovaBot ?`;
  openSheet(`<h3 id="sheetTitle">${esc(st ? st.name : stockId)}</h3>
    ${st ? `<p class="tiny" style="margin-top:4px;color:var(--ink-4)">${esc(st.ticker)}</p>` : ''}
    <div class="kv" style="margin-top:14px"><dt>Quantité</dt><dd class="tabular-nums">${fmt.num(l.qty,4)}</dd></div>
    <div class="kv"><dt>PRU</dt><dd class="tabular-nums">${st ? fmt.cur(l.avg, st.cur) : '—'}</dd></div>
    ${l.priceAvailable ? `<div class="kv"><dt>Cours actuel</dt><dd class="tabular-nums">${fmt.cur(l.localValue/l.qty, st.cur)}</dd></div>` : ''}
    <div class="kv"><dt>Valeur</dt><dd class="tabular-nums">${l.priceAvailable ? fmt.eur(l.marketValue) : '—'}</dd></div>
    <div class="kv"><dt>Performance</dt><dd class="tabular-nums ${l.gain>=0?'up-t':'down-t'}">${l.priceAvailable?`${l.gain>=0?'+':''}${fmt.eur(l.gain)} · ${trendTxt(l.gainPct)}`:'—'}</dd></div>
    <div class="kv"><dt>Poids du portefeuille</dt><dd class="tabular-nums">${pf.total>0?fmt.num((l.marketValue/pf.total)*100,1)+' %':'—'}</dd></div>
    ${hist.length ? `<p class="tiny" style="margin-top:16px;font-weight:650;color:var(--ink-3)">Historique</p>
      <div class="rows" style="margin-top:6px">${hist.slice(0,8).map(t => `<div class="row" style="padding:7px 0">
        <span class="row-main"><span class="row-t" style="font-size:13.5px">${t.type==='buy'?'Achat':'Vente'} · ${fmt.num(t.qty,4)}</span>
          <span class="row-s">${new Date(t.date).toLocaleDateString('fr-FR')}</span></span>
        <span class="tabular-nums" style="font-size:13px">${fmt.eur(t.amountEUR)}</span></div>`).join('')}</div>` : ''}
    <button class="btn btn-a" style="width:100%;margin-top:18px" data-novabot-ask="${esc(question)}">Demander à Nova pourquoi →</button>
  `);
}

/* Fonds simulés (§6) — dépôt/retrait, backend validé (novabotAjouterFonds/
   novabotRetirerFonds, js/core.js), jamais une mutation directe depuis ce
   sheet : il ne fait qu'appeler ces fonctions après confirmation. */
function novabotOuvrirFonds(sens){
  const estDepot = sens === 'deposit';
  openSheet(`<h3 id="sheetTitle">${estDepot ? '+ Ajouter des fonds' : 'Retirer des fonds'}</h3>
    <p class="tiny" style="margin-top:6px;color:var(--ink-4)">Simulation uniquement — aucun paiement réel, aucune banque connectée.</p>
    <div style="margin-top:18px">
      <input type="number" class="field" id="novabotFundsAmount" placeholder="Montant en euros" min="1" step="10"
        style="width:100%;font-size:20px;text-align:center" autofocus>
    </div>
    ${!estDepot ? `<p class="tiny" style="margin-top:8px;text-align:center">Liquidités disponibles : ${fmt.eur(state.novabot.wallet.cash)}</p>` : ''}
    <button class="btn btn-a" style="width:100%;margin-top:18px" data-novabot-funds-ok="${sens}">${estDepot ? 'Ajouter' : 'Retirer'}</button>
  `);
  setTimeout(() => document.getElementById('novabotFundsAmount')?.focus(), 50);
}

/* ---------- sidebar conversations ---------- */
function novabotRenommerOuvrir(id){
  const c = NOVABOT_CONVERSATIONS.list.find(x => x.id === id);
  if (!c) return;
  openSheet(`<h3 id="sheetTitle">Renommer la conversation</h3>
    <div style="margin-top:14px">
      <input type="text" class="field" id="novabotRenameInput" style="width:100%" maxlength="200"
        value="${esc(c.title || '')}" placeholder="Titre de la conversation">
    </div>
    <button class="btn btn-a" style="width:100%;margin-top:16px" data-novabot-rename-ok="${esc(id)}">Renommer</button>`);
  setTimeout(() => document.getElementById('novabotRenameInput')?.focus(), 50);
}
function novabotConvItem(c){
  const actif = c.id === NOVABOT_CHAT.conversationId;
  const date = new Date(c.updatedAt || c.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
  return `<div class="nb-conv-item${actif ? ' active' : ''}">
    <button type="button" class="nb-conv-item-main" data-novabot-open-conv="${esc(c.id)}">
      <span class="nb-conv-item-title">${esc(c.title || 'Nouvelle conversation')}</span>
      <span class="nb-conv-item-date">${date}</span>
    </button>
    <span class="nb-conv-item-actions">
      <button type="button" data-novabot-rename-conv="${esc(c.id)}" aria-label="Renommer">${svg(ICON.book,2)}</button>
      <button type="button" data-novabot-delete-conv="${esc(c.id)}" aria-label="Supprimer">${svg(ICON.trash,2)}</button>
    </span>
  </div>`;
}
function novabotSidebarMarkup(){
  const q = (NOVABOT_CONVERSATIONS.search || '').toLowerCase();
  const list = q
    ? NOVABOT_CONVERSATIONS.list.filter(c => (c.title || '').toLowerCase().includes(q))
    : NOVABOT_CONVERSATIONS.list;
  return `<aside class="nb-sidebar">
    <button type="button" class="btn btn-a btn-sm" style="width:100%" data-novabot-new-conv">+ Nouvelle conversation</button>
    <div class="nb-sidebar-search">
      <input type="text" class="field" placeholder="Rechercher…" value="${esc(NOVABOT_CONVERSATIONS.search || '')}"
        oninput="NOVABOT_CONVERSATIONS.search=this.value;render()">
    </div>
    <div class="nb-conv-list">
      ${list.length ? list.map(novabotConvItem).join('') : `<p class="tiny" style="padding:12px;color:var(--ink-4)">${q ? 'Aucun résultat.' : 'Aucune conversation.'}</p>`}
    </div>
  </aside>
  <div class="nb-sidebar-backdrop" data-novabot-sidebar-close></div>`;
}

/* ---------- vue Conversations (style ChatGPT) ---------- */
function novabotChatView(){
  const c = NOVABOT_CHAT;
  const premierTour = c.messages.length <= 1 && state.novabot.mandateConfirmed;
  return `<div class="nb-chat-shell${NOVABOT_UI.sidebarOpen ? ' nb-sidebar-open' : ''}">
    ${novabotSidebarMarkup()}
    <div class="nb-thread-col">
      <div class="nb-thread-head">
        <button type="button" class="nb-history-btn" data-novabot-sidebar-open>${svg(ICON.list,2)} Historique</button>
      </div>
      <div class="nb-chat">
        <div class="nb-chat-log" id="novabotChatLog">
          ${c.loadingThread ? `<div class="nb-msg nb-msg-bot nb-msg-typing">Chargement…</div>` : c.messages.map(m =>
            `<div class="nb-msg nb-msg-${m.role === 'user' ? 'user' : 'bot'}${m.error ? ' nb-msg-error' : ''}">${esc(m.content)}</div>`).join('')}
          ${c.streamingText !== null ? `<div class="nb-msg nb-msg-bot">${esc(c.streamingText)}</div>` : ''}
          ${c.sending ? `<div class="nb-msg nb-msg-bot nb-msg-typing">Nova réfléchit…</div>` : ''}
          ${premierTour && !c.sending ? `<div class="nb-suggestions">
            ${NOVABOT_SUGGESTIONS.map(s => `<button type="button" class="nb-suggestion-chip" data-novabot-suggestion="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>` : ''}
        </div>
        ${c.readyToConfirm ? `<button class="btn btn-a" style="width:100%;margin-top:12px" data-novabot-confirm-mandat>Confirmer le mandat</button>` : ''}
        <div class="nb-chat-input">
          <input type="text" class="field" id="novabotChatInput" placeholder="Écris à Nova…" maxlength="2000" ${c.sending ? 'disabled' : ''}>
          <button type="button" class="btn btn-a btn-sm" data-novabot-chat-send ${c.sending ? 'disabled' : ''}>Envoyer</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- vue Portefeuille (inspiration Revolut, §5) ---------- */
function novabotPortfolioView(){
  const cfg = state.novabot;
  const pf = novabotPortfolioValue();
  const period = NOVABOT_UI.portfolioPeriod;
  const histPts = novabotWalletHistoryPourPeriode(period);
  const first = histPts[0], last = histPts[histPts.length - 1];
  const fluxPeriode = (first && last) ? novabotFluxNetPeriode(first.t, last.t) : 0;
  const periodeGain = (first && last) ? (last.totalValue - first.totalValue) - fluxPeriode : null;
  const periodePct = (first && last && first.totalValue) ? (periodeGain / first.totalValue) * 100 : null;
  const dernierPassage = cfg.lastRunAt
    ? new Date(cfg.lastRunAt).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
    : 'jamais';

  if (!cfg.mandateConfirmed){
    return `<div class="card" style="margin-top:16px">
      ${emptyState('Pas encore de portefeuille NovaBot', 'Termine la conversation d\'onboarding pour confier un capital et activer ton mandat.',
        { go:'novabot', label:'Retour à la conversation' })}
    </div>`;
  }

  return `
    <div class="card nb-hero" style="margin-top:16px">
      <p class="small">Valeur totale</p>
      <p class="price" style="font-size:clamp(32px,7vw,46px);margin-top:4px">${fmt.eur(pf.total)}</p>
      <span class="tag ${pf.gain>=0?'tag-up':'tag-down'}" style="margin-top:10px">${trendTxt(pf.gainPct)} · ${fmt.eur(pf.gain)}</span>
      <div class="btns" style="margin-top:16px">
        <button type="button" class="btn btn-a btn-sm" data-novabot-funds-open="deposit">+ Ajouter des fonds</button>
        <button type="button" class="btn btn-s btn-sm" data-novabot-funds-open="withdraw">Retirer</button>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="seg" data-seg="novabotPeriod" style="width:100%">
        ${NOVABOT_PF_PERIODS.map(p => `<button type="button" data-novabot-period="${p}" aria-pressed="${period===p}">${p}</button>`).join('')}
      </div>
      ${histPts.length >= 2 ? `
        <div style="margin-top:14px">${areaChart(histPts.map(p=>p.totalValue), { color: (periodeGain??0)>=0 ? 'var(--up)' : 'var(--down)', id:'nb' })}</div>
        <div class="chart-stats" style="margin-top:14px">
          <div><span class="tiny">Gain/perte (période)</span><b class="tabular-nums ${(periodeGain??0)>=0?'up-t':'down-t'}">${periodeGain===null?'—':(periodeGain>=0?'+':'')+fmt.eur(periodeGain)}</b></div>
          <div><span class="tiny">Performance (période)</span><b class="tabular-nums ${(periodePct??0)>=0?'up-t':'down-t'}">${periodePct===null?'—':(periodePct>=0?'+':'')+fmt.num(periodePct,2)+' %'}</b></div>
        </div>` : `<p class="small" style="padding:20px 0;text-align:center">${histPts.length ? 'Pas encore assez d\'historique sur cette période.' : 'La courbe se construit à partir de maintenant.'}</p>`}
    </div>

    <div class="card" style="margin-top:14px">
      <dl>
        <div class="kv"><dt>Capital investi</dt><dd class="tabular-nums">${fmt.eur(pf.netDeposits ?? state.novabot.wallet.invested)}</dd></div>
        <div class="kv"><dt>Liquidités disponibles</dt><dd class="tabular-nums">${fmt.eur(pf.cash)}</dd></div>
        <div class="kv"><dt>Gain/perte latent</dt><dd class="tabular-nums ${pf.unrealizedPnL>=0?'up-t':'down-t'}">${pf.unrealizedPnL>=0?'+':''}${fmt.eur(pf.unrealizedPnL)}</dd></div>
        <div class="kv"><dt>Gain/perte réalisé</dt><dd class="tabular-nums ${pf.realizedPnL>=0?'up-t':'down-t'}">${pf.realizedPnL>=0?'+':''}${fmt.eur(pf.realizedPnL)}</dd></div>
      </dl>
    </div>

    ${pf.lines.length ? `<section class="section">
      <h2 class="h2">Positions</h2>
      <div class="card" style="margin-top:14px"><div class="rows">
        ${pf.lines.map(l => `<button type="button" class="row" style="width:100%;text-align:left" data-novabot-position="${esc(l.id)}">
          <span class="row-main"><span class="row-t">${esc(l.stock?.name || l.id)}</span>
            <span class="row-s">${fmt.num(l.qty,4)} titre(s) · PRU ${l.stock ? fmt.cur(l.avg, l.stock.cur) : '—'}</span></span>
          <span style="text-align:right;flex:0 0 auto">
            <span class="tabular-nums ${l.gain>=0?'up-t':'down-t'}">${l.priceAvailable?`${l.gain>=0?'+':''}${fmt.eur(l.gain)}`:'—'}</span>
          </span>
        </button>`).join('')}
      </div></div>
    </section>` : ''}

    <section class="section">
      <div class="section-h"><h2 class="h2">Décisions NovaBot</h2>
        <button class="btn btn-ghost btn-sm" data-novabot-run>Évaluer maintenant</button>
      </div>
      <div class="card" style="margin-top:14px">${cfg.decisions.length ? `<div class="rows">
        ${(() => {
          /* Les décisions EN ATTENTE (mode conseil/semi-autonome, §22)
             remontent toujours en tête — jamais noyées dans l'ordre
             chronologique, elles attendent une action de l'utilisateur. */
          const enAttente = cfg.decisions.filter(d => d.executionStatus === 'pending');
          const reste = cfg.decisions.filter(d => d.executionStatus !== 'pending').slice().reverse();
          const ACTION_LABEL = { buy:'Achat', sell:'Vente', reject:'Refusé pour risque', watch:'Surveillance', hold:'Conservé', increase:'Renforcement', reduce:'Allègement' };
          return [...enAttente, ...reste].slice(0, 20).map(d => {
            const dateD = new Date(d.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
            const estEnAttente = d.executionStatus === 'pending';
            return `<button type="button" class="row" style="width:100%;text-align:left" data-novabot-decision="${esc(d.id)}">
              <span class="row-main"><span class="row-t">${estEnAttente ? `<span style="color:var(--warn)">En attente</span> · ` : ''}${ACTION_LABEL[d.action] || d.action} · ${esc(d.name || d.ticker || '')}</span>
                <span class="row-s">${dateD} · ${esc((d.reason || '').slice(0, 70))}${(d.reason||'').length > 70 ? '…' : ''}</span></span>
              ${Number.isFinite(d.amountEUR) ? `<span class="tabular-nums" style="flex:0 0 auto">${fmt.eur(d.amountEUR)}</span>` : ''}
            </button>`;
          }).join('');
        })()}
      </div>` : emptyState('Aucune décision pour l\'instant', 'Dis à Nova de chercher des opportunités, ou clique sur « Évaluer maintenant ».')}</div>
      <p class="tiny" style="margin-top:8px;color:var(--ink-4)">Dernière évaluation : ${esc(dernierPassage)}</p>
    </section>

    <button type="button" class="btn btn-ghost btn-sm" style="width:100%;margin-top:8px" data-novabot-mandat-open">Mon mandat</button>
    <p class="tiny" style="margin-top:18px;color:var(--ink-4)">NovaBot ne place jamais d'ordre réel. Ce portefeuille est entièrement simulé et distinct du vôtre.</p>
  `;
}

/* Mandat (§9) : accès discret (un seul bouton texte depuis le portefeuille)
   plutôt qu'une section pleine page — toujours modifiable, jamais le
   contenu principal. Modifications "importantes" (capital/risque) passent
   par la conversation (§9 : "les modifications peuvent être demandées par
   conversation") ; les 2 curseurs numériques restent ici pour un ajustement
   direct sans repasser par le chat, comme avant cette refonte. */
function novabotOuvrirMandat(){
  const cfg = state.novabot;
  const OBJ_LABEL = { growth:'Croissance', income:'Revenus', preserve:'Préservation' };
  const RISK_LABEL = { low:'Faible', moderate:'Modéré', high:'Élevé' };
  openSheet(`<h3 id="sheetTitle">Mon mandat</h3>
    <div class="kv" style="margin-top:14px"><dt>Objectif</dt><dd>${cfg.objective ? esc(OBJ_LABEL[cfg.objective]) : '—'}</dd></div>
    <div class="kv"><dt>Risque</dt><dd>${cfg.riskLevel ? esc(RISK_LABEL[cfg.riskLevel]) : '—'}</dd></div>
    <div class="kv"><dt>Horizon</dt><dd>${Number.isFinite(cfg.horizonYears) ? cfg.horizonYears + ' an' + (cfg.horizonYears>1?'s':'') : '—'}</dd></div>
    <div class="kv"><dt>Autonomie</dt><dd>${{advice:'Conseil (confirmation à chaque fois)',semi_auto:'Semi-autonome',auto:'Autonome'}[cfg.autonomyMode] || '—'}</dd></div>
    ${cfg.hardRules.length ? `<div class="kv"><dt>Exclusions</dt><dd>${cfg.hardRules.map(r=>esc(r.value)).join(', ')}</dd></div>` : ''}
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--line-2)">
      ${settingRow('Liquidités minimales', 'NovaBot n\'achète jamais si cela ferait passer le cash sous ce seuil.',
        `<input type="number" class="field" style="width:76px;text-align:right" min="0" max="100" step="5"
          value="${cfg.cashMinPct}" onchange="novabotSetRegle('cashMinPct', this.value)"> %`)}
      ${settingRow('Maximum par position', 'NovaBot n\'achète jamais si cela dépasserait ce poids du portefeuille simulé.',
        `<input type="number" class="field" style="width:76px;text-align:right" min="1" max="100" step="5"
          value="${cfg.maxPositionPct}" onchange="novabotSetRegle('maxPositionPct', this.value)"> %`)}
    </div>
    <p class="tiny" style="margin-top:14px;color:var(--ink-4)">Pour changer d'objectif, de risque ou d'exclusions, dis-le simplement à Nova en conversation.</p>
    <details class="nb-advanced" style="margin-top:14px">
      <summary class="h3" style="font-size:14px">Réglages avancés</summary>
      <div style="margin-top:12px">
        ${settingRow('NovaBot actif', 'Autorise NovaBot à agir quand vous cliquez sur « Évaluer maintenant », sur votre watchlist et au-delà.',
          `<button class="sw" data-novabot-toggle role="switch" aria-checked="${cfg.enabled}"><i></i></button>`)}
        ${settingRow('Second avis Nova AI', "Avant un achat (NovaScore franchi), demande à Nova AI de confirmer, surveiller ou refuser.",
          `<button class="sw" data-novabot-ai-toggle role="switch" aria-checked="${cfg.aiReasoning}"><i></i></button>`)}
        ${settingRow('NovaScore minimum pour acheter', null,
          `<input type="number" class="field" style="width:76px;text-align:right" min="0" max="100" step="1"
            value="${cfg.scoreAchat}" onchange="novabotSetRegle('scoreAchat', this.value)">`)}
        ${settingRow('Stop-loss', null,
          `<input type="number" class="field" style="width:76px;text-align:right" min="1" max="90" step="1"
            value="${cfg.stopLossPct}" onchange="novabotSetRegle('stopLossPct', this.value)"> %`)}
        ${settingRow('Take-profit', null,
          `<input type="number" class="field" style="width:76px;text-align:right" min="1" max="500" step="1"
            value="${cfg.takeProfitPct}" onchange="novabotSetRegle('takeProfitPct', this.value)"> %`)}
        ${settingRow('Montant simulé par achat', null,
          `<input type="number" class="field" style="width:96px;text-align:right" min="10" step="10"
            value="${cfg.tradeAmountEUR}" onchange="novabotSetRegle('tradeAmountEUR', this.value)"> €`)}
      </div>
    </details>
  `);
}

PAGES.novabot = () => {
  const f = NOVA_FEATURES.novabot;
  if (!NOVABOT_CONVERSATIONS.loaded && !NOVABOT_CONVERSATIONS.loading) novabotConversationsCharger();

  return `<div class="page-in nb-page">
    <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>
    <p class="eyebrow">Simulation</p>
    <h1 class="title">${esc(f.title)}</h1>

    <div class="seg nb-tabs" data-seg="novabotView">
      <button type="button" data-novabot-view="chat" aria-pressed="${NOVABOT_UI.view==='chat'}">Conversations</button>
      <button type="button" data-novabot-view="portfolio" aria-pressed="${NOVABOT_UI.view==='portfolio'}">Portefeuille</button>
    </div>

    ${NOVABOT_UI.view === 'chat' ? novabotChatView() : novabotPortfolioView()}
  </div>`;
};
/* Nova News — accueil (LOT C, 2026-09-25) : actualité économique/
   financière MONDIALE, distincte de l'actualité par entreprise (déjà
   réelle sur la fiche action, voir chargerActualites() plus haut).
   Sources : flux RSS publics (Yahoo Finance + CNBC), sans clé API — voir
   api/market/extra.js (kind=worldnews). Même état à 4 valeurs et même
   principe "chargé à la demande" que chargerActualites()/
   chargerGraphique() (jamais un auto-fetch DANS une fonction PAGES.xxx,
   qui provoquerait un render() imbriqué dans le render() en cours —
   déclenché par un clic, voir data-show-worldnews dans le gestionnaire
   central). État module-level (pas dans `state`) : jamais persisté, en
   accord avec "temps réel" — rechargé à chaque visite de la page. */
let WORLD_NEWS = { status: 'idle', items: [], sourcesUtilisees: [], asOf: null };
/* `silencieux` (2026-09-25, retour utilisateur : "possibilité d'avoir les
   news en temps réel") : un rafraîchissement en arrière-plan (voir
   NOVA_NEWS_REFRESH_MS plus bas) ne doit JAMAIS faire clignoter l'écran
   sur "Chargement…" ni remplacer une liste déjà affichée par un état
   d'erreur — l'utilisateur garde les articles déjà visibles jusqu'à ce
   qu'une vraie réponse plus récente arrive ; un échec silencieux
   réessaiera simplement au prochain cycle. Seul le premier chargement
   (silencieux:false, déclenché par go(), voir plus bas) affiche l'état
   "Chargement…"/l'erreur explicite. */
async function chargerNovaNewsMonde({ silencieux = false } = {}){
  if (!silencieux && (WORLD_NEWS.status === 'loaded' || WORLD_NEWS.status === 'loading')) return;
  if (!silencieux){ WORLD_NEWS = { ...WORLD_NEWS, status: 'loading' }; render(); }
  try {
    const r = await fetch('/api/market/extra?kind=worldnews');
    if (!r.ok){ if (!silencieux) WORLD_NEWS = { ...WORLD_NEWS, status: 'error' }; return; }
    const d = await r.json();
    if (Array.isArray(d.items) && d.items.length){
      WORLD_NEWS = {
        status: 'loaded',
        items: d.items,
        sourcesUtilisees: Array.isArray(d.sourcesUtilisees) ? d.sourcesUtilisees : [],
        asOf: d.asOf || null,
      };
    } else if (!silencieux){
      WORLD_NEWS = { ...WORLD_NEWS, status: 'error' };
    }
  } catch (e){
    if (!silencieux) WORLD_NEWS = { ...WORLD_NEWS, status: 'error' };
  }
  render();
}

/* Rafraîchissement "temps réel" en arrière-plan pendant que Nova News est
   affichée — même principe de garde-fou "coupé si l'onglet est masqué"
   que demarrerRafraichissementVivant()/liveTick() plus haut (jamais de
   requête pour un onglet que personne ne regarde). 5 min : la moitié du
   cache serveur (10 min, voir api/market/_cache.js) — la moitié des
   cycles obtiennent donc une réponse réellement neuve, sans jamais
   solliciter les flux RSS sources plus souvent que le cache serveur ne
   le permet déjà. */
const NOVA_NEWS_REFRESH_MS = 5 * 60 * 1000;
let novaNewsTimer = null;
function demarrerRafraichissementNovaNews(){
  if (novaNewsTimer) return;
  novaNewsTimer = setInterval(() => chargerNovaNewsMonde({ silencieux: true }), NOVA_NEWS_REFRESH_MS);
}
function arreterRafraichissementNovaNews(){
  if (novaNewsTimer){ clearInterval(novaNewsTimer); novaNewsTimer = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) arreterRafraichissementNovaNews();
  else if (route.page === 'novanews') demarrerRafraichissementNovaNews();
});

/* Pertinence Nova News (§29/§33 du prompt maître NovaTitre, 2026-10-06) :
   "IMPORTANT POUR VOUS" — correspondance TEXTUELLE simple (nom
   d'entreprise/ticker dans le titre de l'article), jamais une analyse
   IA : les flux RSS source ne fournissent qu'un titre, pas de résumé
   (voir parserRss(), api/market/extra.js) — rien sur quoi faire tourner
   un modèle même si on le voulait. "Meilleur effort" assumé, pas une
   reconnaissance d'entité parfaite : un nom composé de plusieurs mots
   ("LVMH Moët Hennessy...") est réduit à son premier mot significatif
   ("LVMH"), seule forme qui apparaît réellement dans un titre de presse.
   Un ticker n'est comparé qu'en MOT ENTIER (\b...\b, jamais en sous-
   chaîne) et ignoré sous 3 caractères : trop de collisions avec des mots
   usuels ("ON", "ALL"...) pour rester honnête sur un ticker aussi court. */
function nomsEntreprisesPertinentes(){
  const ids = new Set([...state.watchlist, ...state.wallet.positions.map(p => p.id)]);
  const noms = [];
  for (const id of ids){
    const st = byId[id];
    if (!st) continue;
    const premierMot = String(st.name || '').trim().split(/\s+/)[0];
    if (premierMot && premierMot.length >= 3) noms.push({ id, label: st.name, mot: premierMot, ticker: st.ticker });
  }
  return noms;
}
const RE_ECHAP = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function articlePertinentPour(article, noms){
  const titre = article?.title || '';
  for (const n of noms){
    if (new RegExp(`\\b${RE_ECHAP(n.mot)}\\b`, 'i').test(titre)) return n;
    if (n.ticker && n.ticker.length >= 3 && new RegExp(`\\b${RE_ECHAP(n.ticker)}\\b`).test(titre)) return n;
  }
  return null;
}

PAGES.novanews = () => {
  const f = NOVA_FEATURES.novanews;
  /* §33 : articles concernant une valeur suivie/détenue remontés en haut,
     jamais réordonnés par un score IA opaque — tri stable (l'ordre
     chronologique d'origine du flux RSS est préservé À L'INTÉRIEUR de
     chaque groupe pertinent/non pertinent), juste 2 groupes. */
  const noms = nomsEntreprisesPertinentes();
  const articles = WORLD_NEWS.items
    .map(a => ({ ...a, pertinence: noms.length ? articlePertinentPour(a, noms) : null }))
    .sort((a, b) => (b.pertinence ? 1 : 0) - (a.pertinence ? 1 : 0));
  const nbPertinents = articles.filter(a => a.pertinence).length;
  return `<div class="page-in">
    <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>
    <p class="eyebrow">${esc(f.tag)}</p>
    <h1 class="title">${esc(f.title)}</h1>
    <p class="lead measure-l" style="margin-top:10px">Actualité économique, financière et géopolitique
      mondiale — articles de presse externes, jamais rédigés par NovaTitre.</p>

    <div class="card" style="margin-top:18px">
      ${WORLD_NEWS.status === 'idle' ? `
        <div style="text-align:center;padding:24px 0">
          <p class="small" style="margin-bottom:16px">Les actualités ne sont chargées que si vous le demandez.</p>
          <button class="btn btn-a" data-show-worldnews>Voir les actualités</button>
        </div>`
      : WORLD_NEWS.status === 'loading' ? `
        <p class="small" style="padding:24px 0;text-align:center">Chargement des actualités…</p>`
      : WORLD_NEWS.items.length ? `
        ${nbPertinents ? `<p class="small" style="margin-bottom:14px;color:var(--accent);font-weight:600">
          ${nbPertinents} actualité${nbPertinents>1?'s':''} concernant votre portefeuille ou votre liste de suivi.</p>` : ''}
        <div class="news-list">
          ${articles.filter(a => safeHref(a.url)).map(a => `<a class="news-item" href="${esc(safeHref(a.url))}" target="_blank" rel="noopener noreferrer">
            ${safeHref(a.image) ? `<img class="news-item-img" src="${esc(safeHref(a.image))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
            <span class="news-item-body">
              <span class="news-item-title">${esc(a.title)}</span>
              <span class="news-item-meta">
                ${a.pertinence ? `<span class="tag" style="background:var(--accent-soft);color:var(--accent)">Concerne ${esc(a.pertinence.label)}</span>` : ''}
                ${a.source ? `<span class="tag tag-neutral">${esc(a.source)}</span>` : ''}
                ${a.publishedAt ? `<span class="tiny">${esc(formatDateAffichage(a.publishedAt, 'intraday'))}</span>` : ''}
              </span>
            </span>
          </a>`).join('')}
        </div>
        <p class="tiny" style="margin-top:14px">Articles de presse externes, non rédigés par NovaTitre
          · sources ${esc(WORLD_NEWS.sourcesUtilisees.join(', ') || '—')}.</p>`
      : `<div class="notice"><b>Actualités indisponibles.</b>
          Aucun article n'a pu être obtenu pour le moment — réessayez dans quelques minutes.</div>`}
    </div>
  </div>`;
};

/* Grande carte Nova News de l'accueil (§54-57, 3e des 4 modules). Honnête
   sur une contrainte réelle : WORLD_NEWS n'est chargé QUE si l'utilisateur
   a déjà ouvert Nova News dans cette session (status 'idle' par défaut,
   voir chargerNovaNewsMonde() plus haut — un choix délibéré pour ne
   jamais forcer un appel réseau non demandé). Tant que c'est le cas,
   cette carte reste un teaser générique, JAMAIS un chiffre inventé
   ("6 actualités importantes") pour imiter l'exemple du §57 sans vraie
   donnée derrière. Dès que Nova News a été ouverte une fois, la carte
   affiche le vrai compte (et la pertinence déjà calculée pour la page
   elle-même, voir nomsEntreprisesPertinentes()/articlePertinentPour()
   ci-dessus — jamais un 2e calcul qui pourrait diverger). */
function novaNewsHomeCard(){
  const chargee = WORLD_NEWS.status === 'loaded' && WORLD_NEWS.items.length > 0;
  let pertinents = 0;
  if (chargee){
    const noms = nomsEntreprisesPertinentes();
    if (noms.length) pertinents = WORLD_NEWS.items.filter(a => articlePertinentPour(a, noms)).length;
  }
  const f = NOVA_FEATURES.novanews;
  return `<button type="button" class="nova-big-card" data-go="novanews" style="--nf-accent:${f.accent};--nf-accent-rgb:${f.rgb}">
    ${chessNovaIcon('novanews')}
    <div class="nova-big-body">
    <p class="nova-big-eyebrow">Nova News</p>
    ${chargee ? `
      <p class="nova-big-lead">${WORLD_NEWS.items.length} actualité${WORLD_NEWS.items.length > 1 ? 's' : ''} disponible${WORLD_NEWS.items.length > 1 ? 's' : ''}.</p>
      ${pertinents ? `<p class="nova-big-sub">${pertinents} concernent votre portefeuille ou votre liste de suivi.</p>` : ''}` : `
      <p class="nova-big-lead">Regroupe et analyse l'actualité qui peut influencer vos investissements.</p>`}
    <span class="nova-big-link">Voir les actualités →</span>
    </div>
  </button>`;
}

/* Nova Event (§34) — calendrier RÉEL résultats/dividendes des valeurs
   suivies/détenues, construit sur _nasdaqCalendar.js (voir
   api/market/fundamentals.js) : source gratuite, sans clé, remplaçant le
   bloc "SplitsDividends"/"Earnings" d'EODHD jamais vérifié en direct et
   jamais effectivement utilisé en production (voir _router.js, 2026-10-06).
   Couverture RÉELLE : actions cotées Nasdaq/NYSE/AMEX uniquement (marché
   américain) — une valeur hors de ce périmètre (ex. MC-PAR, Euronext)
   n'aura simplement aucun événement, jamais une date devinée pour
   compenser. Même filtre watchlist+positions que nomsEntreprisesPertinentes()
   (js/nova.js), restreint au type 'stock' : fundamentals.js ne calcule ce
   calendrier que pour ce type (ni ETF, ni indice, ni crypto n'a de date
   de résultats/dividende propre). */
function stocksSuivisPourEvenements(){
  const ids = new Set([...state.watchlist, ...state.wallet.positions.map(p => p.id)]);
  const out = [];
  for (const id of ids){
    const st = byId[id];
    if (st && st.type === 'stock') out.push(st);
  }
  return out;
}

/* Déclenche chargerFondamentaux() (data-services.js) pour chaque valeur
   suivie/détenue pas encore chargée — seule façon d'obtenir le calendrier
   (fusionné côté serveur dans la même réponse que "Les chiffres", voir
   api/market/fundamentals.js). chargerFondamentaux() gère déjà son propre
   dédoublonnage (FUND_ENCOURS) et son propre render() une fois la réponse
   arrivée — jamais appelée depuis PAGES.novaevent() elle-même (doit rester
   synchrone), toujours depuis le render-dispatch de index.html, même
   principe que assurerBenchmarkPortefeuille()/assurerCatalogueGlobal(). */
function assurerEvenementsSuivis(){
  for (const st of stocksSuivisPourEvenements()) chargerFondamentaux(st);
}

/* Événements RÉELS (résultats + détachement de dividende) des valeurs
   suivies/détenues, triés du plus proche au plus lointain, jamais une
   date déjà passée (agenda des PROCHAINS événements, pas un historique).
   Chaque champ vient directement de _nasdaqCalendar.js — rien n'est
   interpolé/deviné ici. nextEarningsDate reste TOUJOURS marqué "estimé"
   (estimated:true) : cette date est elle-même, par construction de la
   source Nasdaq, une estimation algorithmique tant que l'entreprise n'a
   pas annoncé sa date officielle (voir le texte source, _nasdaqCalendar.js). */
function evenementsSuivis(){
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const evts = [];
  for (const st of stocksSuivisPourEvenements()){
    const f = st.fundamentals;
    if (!f) continue;
    if (f.nextEarningsDate && f.nextEarningsDate >= aujourdhui){
      evts.push({ stockId:st.id, label:st.name, ticker:st.ticker, type:'earnings',
        date:f.nextEarningsDate, estimated:Boolean(f.nextEarningsEstimated) });
    }
    if (f.exDividendDate && f.exDividendDate >= aujourdhui){
      evts.push({ stockId:st.id, label:st.name, ticker:st.ticker, type:'dividend',
        date:f.exDividendDate, paymentDate:f.nextDividendDate || null, amount:f.dividendPerShare ?? null });
    }
  }
  evts.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return evts;
}

function dateEvenementAffichee(iso){
  return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}

PAGES.novaevent = () => {
  const suivis = stocksSuivisPourEvenements();
  if (!state.watchlist.length && !state.wallet.positions.length){
    return `<div class="page-in">
      <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>
      ${emptyState('Aucune valeur suivie', "Ajoutez une action à votre watchlist ou à votre portefeuille pour voir apparaître ici ses prochains résultats et dividendes.", { go:'markets', label:'Explorer les marchés' })}
    </div>`;
  }
  if (!suivis.length){
    return `<div class="page-in">
      <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>
      ${emptyState('Calendrier réservé aux actions', "Nova Event couvre les résultats et dividendes des actions — vos valeurs suivies/détenues actuelles n'en contiennent aucune (ETF, indice...).")}
    </div>`;
  }
  const enCours = suivis.filter(st => st.fundamentalsStatus === 'idle' || st.fundamentalsStatus === 'loading');
  const evts = evenementsSuivis();
  return `<div class="page-in">
    <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>
    <h2 style="margin-bottom:4px">Nova Event</h2>
    <p class="tiny" style="color:var(--ink-3);margin-bottom:18px">Résultats et dividendes à venir, pour vos valeurs suivies et détenues. Couverture : actions cotées aux États-Unis (Nasdaq/NYSE/AMEX) uniquement.</p>
    ${evts.length ? `<div class="card"><div class="rows">
      ${evts.map(e => `<div class="row">
        <span class="row-main"><span class="row-t">${esc(e.ticker)} <span class="tiny" style="color:var(--ink-3)">${esc(e.label)}</span></span>
          <span class="row-s">${e.type === 'earnings'
            ? `Résultats ${e.estimated ? 'estimés' : 'prévus'} le ${dateEvenementAffichee(e.date)}`
            : `Détachement de dividende le ${dateEvenementAffichee(e.date)}${Number.isFinite(e.amount) ? ` (${fmt.num(e.amount,2)} $/action)` : ''}${e.paymentDate ? ` · versement le ${dateEvenementAffichee(e.paymentDate)}` : ''}`}</span></span>
      </div>`).join('')}
    </div></div>` : (enCours.length
      ? `<p class="tiny" style="color:var(--ink-3)">Chargement des dates connues…</p>`
      : emptyState('Aucun événement connu', "Aucune date de résultats ou de dividende n'est actuellement connue pour vos valeurs suivies — soit la donnée n'est pas disponible pour ces titres, soit aucune échéance n'est prévue dans un futur proche."))}
  </div>`;
};

/* Grande carte Nova Event de l'accueil (§34/§54-57, 4e des 4 modules —
   seul à dépendre de chargerFondamentaux(), déjà potentiellement lancé
   par d'autres pages ; jamais déclenché depuis cette carte elle-même,
   qui doit rester synchrone comme les 3 autres). États honnêtes : aucune
   valeur suivie -> teaser générique ; valeurs suivies mais calendrier pas
   encore chargé/vide -> pas de chiffre inventé ; au moins un événement
   réel -> le plus proche, jamais un compte qui pourrait diverger de la
   page elle-même (même evenementsSuivis(), un seul calcul). */
function novaEventHomeCard(){
  const evts = stocksSuivisPourEvenements().length ? evenementsSuivis() : [];
  const prochain = evts[0] || null;
  const f = NOVA_FEATURES.novaevent;
  return `<button type="button" class="nova-big-card" data-go="novaevent" style="--nf-accent:${f.accent};--nf-accent-rgb:${f.rgb}">
    ${chessNovaIcon('novaevent')}
    <div class="nova-big-body">
    <p class="nova-big-eyebrow">Nova Event</p>
    ${prochain ? `
      <p class="nova-big-lead">${evts.length} événement${evts.length > 1 ? 's' : ''} à venir.</p>
      <p class="nova-big-sub">${prochain.type === 'earnings' ? 'Résultats' : 'Dividende'} ${esc(prochain.ticker)} le ${dateEvenementAffichee(prochain.date)}</p>` : `
      <p class="nova-big-lead">Centralise les résultats, dividendes et événements de vos entreprises.</p>`}
    <span class="nova-big-link">Voir le calendrier →</span>
    </div>
  </button>`;
}