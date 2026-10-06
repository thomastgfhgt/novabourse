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
  return `<button type="button" class="nova-big-card" data-go="novareview">
    <p class="nova-big-eyebrow">Nova Review</p>
    ${resume ? `
      <p class="nova-big-lead">Votre analyse de la semaine est prête.</p>
      <ul class="nova-big-stats">
        ${resume.bonnes ? `<li><span class="nova-big-dot" style="background:${VERDICT_STYLE['Bon coup'].accent}"></span>${resume.bonnes} bonne${resume.bonnes > 1 ? 's' : ''} décision${resume.bonnes > 1 ? 's' : ''}</li>` : ''}
        ${resume.erreurs ? `<li><span class="nova-big-dot" style="background:${VERDICT_STYLE['Erreur à étudier'].accent}"></span>${resume.erreurs} erreur${resume.erreurs > 1 ? 's' : ''}</li>` : ''}
        ${resume.surveiller ? `<li><span class="nova-big-dot" style="background:${VERDICT_STYLE['Risqué'].accent}"></span>${resume.surveiller} point${resume.surveiller > 1 ? 's' : ''} à surveiller</li>` : ''}
        ${!resume.total ? `<li><span class="nova-big-dot" style="background:var(--ink-4)"></span>Rien à signaler cette semaine</li>` : ''}
      </ul>` : `
      <p class="nova-big-lead">Nova Review comparera vos décisions passées à ce qui s'est réellement passé, dès votre premier achat ou votre première vente.</p>`}
    <span class="nova-big-link">Voir mon analyse →</span>
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
  return `<button type="button" class="nova-big-card" data-go="novabot">
    <p class="nova-big-eyebrow">NovaBot</p>
    ${aDejaDecide ? (() => {
      const pf = novabotPortfolioValue();
      return `
      <p class="nova-big-lead tabular-nums">${fmt.eur(pf.total)} <span class="${pf.gainPct>=0?'up-t':'down-t'}" style="font-size:15px;font-weight:700">${pf.gainPct>=0?'+':''}${fmt.num(pf.gainPct,2)} %</span></p>
      <p class="nova-big-sub">Dernière décision : ${derniere.type === 'buy' ? 'Achat' : 'Vente'} simulé${derniere.type==='buy'?'':'e'} · ${esc(derniere.name)}</p>`;
    })() : cfg.enabled ? `
      <p class="nova-big-lead">NovaBot est activé mais n'a pas encore été évalué.</p>
      <p class="nova-big-sub">Ouvrez NovaBot et cliquez sur « Évaluer maintenant » pour une première simulation.</p>` : `
      <p class="nova-big-lead">NovaBot peut gérer un portefeuille entièrement simulé selon des règles que vous définissez — jamais un ordre réel.</p>`}
    <span class="nova-big-link">Ouvrir NovaBot →</span>
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
PAGES.novabot = () => {
  const f = NOVA_FEATURES.novabot;
  const cfg = state.novabot;
  const pf = novabotPortfolioValue();
  const dernierPassage = cfg.lastRunAt
    ? new Date(cfg.lastRunAt).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
    : 'jamais';
  return `<div class="page-in">
    <button class="btn btn-g btn-sm" data-back style="margin-bottom:20px">← Retour</button>
    <p class="eyebrow">Simulation</p>
    <h1 class="title">${esc(f.title)}</h1>
    <p class="lead measure-l" style="margin-top:10px">Portefeuille entièrement simulé, isolé de votre
      portefeuille réel — NovaBot ne place et ne placera jamais d'ordre réel sur les marchés.</p>

    <section class="section">
      <h2 class="h2">Activation</h2>
      <div class="card" style="margin-top:14px">
        ${settingRow('NovaBot actif', "Évalue vos règles quand vous cliquez sur « Évaluer maintenant », uniquement sur votre watchlist.",
          `<button class="sw" data-novabot-toggle role="switch" aria-checked="${cfg.enabled}"><i></i></button>`)}
        <p class="tiny" style="margin-top:10px;color:var(--ink-4)">Dernière évaluation : ${esc(dernierPassage)}</p>
      </div>
    </section>

    <section class="section">
      <h2 class="h2">Vos règles</h2>
      <div class="card" style="margin-top:14px">
        ${settingRow('NovaScore minimum pour acheter', 'Sur les valeurs de votre watchlist non encore détenues (simulation).',
          `<input type="number" class="field" style="width:76px;text-align:right" min="0" max="100" step="1"
            value="${cfg.scoreAchat}" onchange="novabotSetRegle('scoreAchat', this.value)">`)}
        ${settingRow('Stop-loss', 'Vend automatiquement une position simulée sous cette perte.',
          `<input type="number" class="field" style="width:76px;text-align:right" min="1" max="90" step="1"
            value="${cfg.stopLossPct}" onchange="novabotSetRegle('stopLossPct', this.value)"> %`)}
        ${settingRow('Take-profit', 'Vend automatiquement une position simulée au-delà de ce gain.',
          `<input type="number" class="field" style="width:76px;text-align:right" min="1" max="500" step="1"
            value="${cfg.takeProfitPct}" onchange="novabotSetRegle('takeProfitPct', this.value)"> %`)}
        ${settingRow('Montant simulé par achat', null,
          `<input type="number" class="field" style="width:96px;text-align:right" min="10" step="10"
            value="${cfg.tradeAmountEUR}" onchange="novabotSetRegle('tradeAmountEUR', this.value)"> €`)}
      </div>
      <button class="btn btn-a btn-lg" style="width:100%;margin-top:14px" data-novabot-run
        ${state.watchlist.length ? '' : 'disabled'}>Évaluer maintenant</button>
      ${state.watchlist.length ? '' : `<p class="tiny" style="margin-top:8px;color:var(--ink-4)">
        Ajoutez des valeurs à votre watchlist pour que NovaBot ait quelque chose à évaluer.</p>`}
    </section>

    <section class="section">
      <h2 class="h2">Portefeuille simulé</h2>
      <div class="card" style="margin-top:14px">
        <dl>
          <div class="kv"><dt>Valeur totale</dt><dd class="tabular-nums">${fmt.eur(pf.total)}</dd></div>
          <div class="kv"><dt>Liquidités</dt><dd class="tabular-nums">${fmt.eur(pf.cash)}</dd></div>
          <div class="kv"><dt>Gain/perte latent</dt><dd class="tabular-nums ${pf.gain>=0?'up-t':'down-t'}">${pf.gain>=0?'+':''}${fmt.eur(pf.gain)}</dd></div>
          <div class="kv"><dt>Gain/perte réalisé</dt><dd class="tabular-nums ${pf.realizedPnL>=0?'up-t':'down-t'}">${pf.realizedPnL>=0?'+':''}${fmt.eur(pf.realizedPnL)}</dd></div>
        </dl>
      </div>
    </section>

    ${pf.lines.length ? `<section class="section">
      <h2 class="h2">Positions simulées</h2>
      <div class="card" style="margin-top:14px"><div class="rows">
        ${pf.lines.map(l => `<div class="row">
          <span class="row-main"><span class="row-t">${esc(l.stock?.name || l.id)}</span>
            <span class="row-s">${fmt.num(l.qty,4)} titre(s) · PRU ${l.stock ? fmt.cur(l.avg, l.stock.cur) : '—'}</span></span>
          <span style="text-align:right;flex:0 0 auto">
            <span class="tabular-nums ${l.gain>=0?'up-t':'down-t'}">${l.priceAvailable?`${l.gain>=0?'+':''}${fmt.eur(l.gain)}`:'—'}</span>
          </span>
        </div>`).join('')}
      </div></div>
    </section>` : ''}

    ${cfg.transactions.length ? `<section class="section">
      <h2 class="h2">Journal des décisions</h2>
      <div class="card" style="margin-top:14px"><div class="rows">
        ${cfg.transactions.slice().reverse().slice(0, 20).map(tx => {
          const dateTx = new Date(tx.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
          return `<div class="row" style="align-items:flex-start;flex-direction:column;gap:2px;padding:12px 0">
            <div style="display:flex;justify-content:space-between;width:100%;gap:10px">
              <span class="row-main"><span class="row-t">${tx.type==='buy'?'Achat simulé':'Vente simulée'} · ${esc(tx.name)}</span>
                <span class="row-s">${dateTx} · ${fmt.eur(tx.amountEUR)}</span></span>
              ${Number.isFinite(tx.realizedGain) ? `<span class="tabular-nums ${tx.realizedGain>=0?'up-t':'down-t'}" style="font-size:13.5px;font-weight:600;flex:0 0 auto">${tx.realizedGain>=0?'+':''}${fmt.eur(tx.realizedGain)}</span>` : ''}
            </div>
            <span class="tiny" style="color:var(--ink-4)">${esc(tx.motif || '')}</span>
          </div>`;
        }).join('')}
      </div></div>
    </section>` : `<div class="empty" style="padding-top:8px">
      <div class="empty-i" style="background:rgba(${f.rgb},.14);color:${f.accent}">${svg(ICON[f.icon],1.7)}</div>
      <h3 style="font-size:20px;margin-top:16px">Aucune décision simulée pour l'instant</h3>
      <p style="max-width:46ch">Activez NovaBot, ajoutez des valeurs à votre watchlist, puis cliquez sur « Évaluer maintenant ».</p>
    </div>`}

    <p class="tiny" style="margin-top:18px;color:var(--ink-4)">NovaBot ne place jamais d'ordre réel. Ce portefeuille est entièrement simulé et distinct du vôtre.</p>
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
PAGES.novanews = () => {
  const f = NOVA_FEATURES.novanews;
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
        <div class="news-list">
          ${WORLD_NEWS.items.filter(a => safeHref(a.url)).map(a => `<a class="news-item" href="${esc(safeHref(a.url))}" target="_blank" rel="noopener noreferrer">
            ${safeHref(a.image) ? `<img class="news-item-img" src="${esc(safeHref(a.image))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
            <span class="news-item-body">
              <span class="news-item-title">${esc(a.title)}</span>
              <span class="news-item-meta">
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
/* Nova Event (agenda NovaTitre) reste une page de présentation, hors
   périmètre de cette passe (LOT C ne couvrait que Nova News). */
PAGES.novaevent = () => novaFeaturePage('novaevent');