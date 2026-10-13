// Vérifie le Position Sizing Engine NovaBot (audit 2026-10-13, "calcul
// intelligent des montants investis"). Reproduit fidèlement les
// fonctions pures de js/core.js (novabotBareme, novabotScoreRisque,
// novabotExpositionSecteur, novabotDimensionnerPosition) — même
// convention que les autres fichiers test-novabot-*.js.
//
// RAPPEL DU BUG SIGNALÉ : NovaBot avait investi exactement 75€ dans
// Apple, Microsoft, Nvidia, Alphabet ET ASML — 75 = 15% × 500€, le
// plafond par position du mandat, identique pour chaque candidat. Ce
// test vérifie que ce N'EST PLUS LE CAS : deux candidats de qualité/
// risque différents reçoivent des montants différents, toujours dans
// la limite du même plafond absolu.

const NOVABOT_ECHELLE_VOLATILITE = [[0.12,100],[0.20,78],[0.30,52],[0.42,25],[0.55,0]];
const NOVABOT_ECHELLE_DRAWDOWN   = [[0.08,100],[0.18,75],[0.30,48],[0.45,20],[0.60,0]];
function novabotBareme(points, v){
  if (!Number.isFinite(v)) return null;
  if (v <= points[0][0]) return points[0][1];
  if (v >= points[points.length-1][0]) return points[points.length-1][1];
  for (let i = 1; i < points.length; i++){
    if (v <= points[i][0]){
      const [x0,y0] = points[i-1], [x1,y1] = points[i];
      return Math.round(y0 + ((v-x0)/(x1-x0)) * (y1-y0));
    }
  }
  return null;
}
function novabotScoreRisque(donnees){
  const notes = [novabotBareme(NOVABOT_ECHELLE_VOLATILITE, donnees.volatility),
    novabotBareme(NOVABOT_ECHELLE_DRAWDOWN, donnees.maxDrawdown)].filter(n => n !== null);
  return notes.length ? Math.round(notes.reduce((a,b) => a+b, 0) / notes.length) : null;
}
function novabotExpositionSecteur(positions, byId, secteur){
  if (!secteur) return 0;
  return positions.reduce((somme, pos) => {
    const st = byId[pos.id];
    if (!st || st.sector !== secteur) return somme;
    return somme + pos.avg * pos.qty; // EUR direct dans ce test (devise unique)
  }, 0);
}
const NOVABOT_FACTEUR_SECTEUR = 2.5;
const NOVABOT_PLANCHER_ALLOCATION = 0.4;
const NOVABOT_POIDS_QUALITE = 0.6, NOVABOT_POIDS_RISQUE = 0.4;
function novabotDimensionnerPosition({ cfg, mandate, st, prix, donnees, pfTotal, valeurExistanteEUR, byId }){
  const cashDispo = cfg.wallet.cash - (mandate.cashMinPct / 100) * pfTotal;
  const plafondPosition = (mandate.maxPositionPct / 100) * pfTotal - valeurExistanteEUR;
  const plafondTheorique = Math.min(cfg.tradeAmountEUR, cashDispo, plafondPosition);

  const scoreRisque = novabotScoreRisque(donnees);
  const facteurQualite = Math.max(0, Math.min(1, (donnees.score - cfg.scoreAchat) / Math.max(1, 100 - cfg.scoreAchat)));
  const facteurRisque = scoreRisque === null ? 0.5 : scoreRisque / 100;
  const facteurAllocation = NOVABOT_POIDS_QUALITE * facteurQualite + NOVABOT_POIDS_RISQUE * facteurRisque;
  const montantPropose = plafondTheorique * (NOVABOT_PLANCHER_ALLOCATION + (1 - NOVABOT_PLANCHER_ALLOCATION) * facteurAllocation);

  const expositionSecteur = novabotExpositionSecteur(cfg.wallet.positions, byId, st.sector);
  const plafondSecteur = (mandate.maxPositionPct * NOVABOT_FACTEUR_SECTEUR / 100) * pfTotal - expositionSecteur;

  const bornes = [
    { type:'tradeAmountEUR', valeur:cfg.tradeAmountEUR },
    { type:'cash_disponible', valeur:cashDispo },
    { type:'plafond_position', valeur:plafondPosition },
    { type:'allocation_qualite_risque', valeur:montantPropose },
    { type:'plafond_secteur', valeur:Math.max(0, plafondSecteur) },
  ];
  const borneActive = bornes.reduce((min, b) => b.valeur < min.valeur ? b : min, bornes[0]);
  const montant = Math.max(0, borneActive.valeur);
  return { montant, detail: { facteurQualite, facteurRisque, facteurAllocation, plafondTheorique, bornePlusStricte:borneActive.type,
    montantFinal: Math.round(montant*100)/100, scoreRisque, plafondSecteur: Math.max(0, plafondSecteur) } };
}

const results = [];
function check(name, cond){ results.push([name, Boolean(cond)]); }

const cfgBase = { tradeAmountEUR:500, scoreAchat:70, wallet:{ cash:450, positions:[] } };
const mandateBase = { cashMinPct:10, maxPositionPct:15 };
const pfTotal = 500;

/* ---------- 1) RÉGRESSION CENTRALE : deux candidats de risque différent -> montants différents ---------- */
{
  const candidatStable = { score:85, volatility:0.15, maxDrawdown:0.10, coverage:90, confidence:90 }; // faible risque
  const candidatVolatil = { score:85, volatility:0.50, maxDrawdown:0.55, coverage:90, confidence:90 }; // même score, risque élevé
  const r1 = novabotDimensionnerPosition({ cfg:cfgBase, mandate:mandateBase, st:{ ticker:'STABLE', sector:'Tech' }, prix:100, donnees:candidatStable, pfTotal, valeurExistanteEUR:0, byId:{} });
  const r2 = novabotDimensionnerPosition({ cfg:cfgBase, mandate:mandateBase, st:{ ticker:'VOLATIL', sector:'Tech' }, prix:100, donnees:candidatVolatil, pfTotal, valeurExistanteEUR:0, byId:{} });
  check('RÉGRESSION CENTRALE : à NovaScore identique, un risque plus faible reçoit un montant plus élevé (plus jamais le même montant uniforme)',
    r1.montant > r2.montant);
  check('les deux montants restent dans la limite du plafond par position (75€ = 15% × 500€, jamais dépassé)',
    r1.montant <= 75 + 1e-9 && r2.montant <= 75 + 1e-9);
}

/* ---------- 2) qualité (NovaScore) influence aussi le montant, à risque égal ---------- */
{
  const bonScore = { score:98, volatility:0.20, maxDrawdown:0.15, coverage:90, confidence:90 };
  const scoreJusteAuSeuil = { score:70, volatility:0.20, maxDrawdown:0.15, coverage:90, confidence:90 };
  const r1 = novabotDimensionnerPosition({ cfg:cfgBase, mandate:mandateBase, st:{ ticker:'A', sector:'Tech' }, prix:100, donnees:bonScore, pfTotal, valeurExistanteEUR:0, byId:{} });
  const r2 = novabotDimensionnerPosition({ cfg:cfgBase, mandate:mandateBase, st:{ ticker:'B', sector:'Tech' }, prix:100, donnees:scoreJusteAuSeuil, pfTotal, valeurExistanteEUR:0, byId:{} });
  check('un NovaScore nettement supérieur au seuil reçoit un montant plus élevé qu\'un score tout juste au seuil, à risque identique',
    r1.montant > r2.montant);
  check('un candidat tout juste au seuil reçoit quand même au moins le plancher (40% du plafond théorique), jamais un montant dérisoire',
    r2.montant >= 0.4 * Math.min(cfgBase.tradeAmountEUR, 450, 75) - 1e-6);
}

/* ---------- 3) risque non mesurable -> traité en neutre (0.5), jamais optimiste ni pessimiste par défaut ---------- */
{
  const risqueInconnu = { score:85, volatility:null, maxDrawdown:null, coverage:40, confidence:40 };
  const r = novabotDimensionnerPosition({ cfg:cfgBase, mandate:mandateBase, st:{ ticker:'X', sector:'Tech' }, prix:100, donnees:risqueInconnu, pfTotal, valeurExistanteEUR:0, byId:{} });
  check('RÉGRESSION : historique insuffisant -> scoreRisque=null (jamais une estimation inventée)', r.detail.scoreRisque === null);
  check('facteurRisque neutre (0.5) quand le risque est inconnu — ni favorisé ni pénalisé par une donnée absente', r.detail.facteurRisque === 0.5);
}

/* ---------- 4) jamais dépassé : le plafond par position reste une limite ABSOLUE ---------- */
{
  const scoreParfait = { score:100, volatility:0.05, maxDrawdown:0.02, coverage:100, confidence:100 }; // risque minimal, score maximal
  const r = novabotDimensionnerPosition({ cfg:cfgBase, mandate:mandateBase, st:{ ticker:'PARFAIT', sector:'Tech' }, prix:100, donnees:scoreParfait, pfTotal, valeurExistanteEUR:0, byId:{} });
  check('même un candidat "parfait" (score 100, risque minimal) ne dépasse jamais le plafond par position (75€)', r.montant <= 75 + 1e-9);
}

/* ---------- 5) concentration sectorielle : une exposition déjà élevée réduit la place restante ---------- */
{
  const byId = { AAA:{ sector:'Tech' }, BBB:{ sector:'Tech' } };
  const cfgConcentre = { ...cfgBase, wallet:{ cash:450, positions:[{ id:'AAA', qty:3, avg:100 }] } }; // 300€ déjà en Tech
  const donnees = { score:90, volatility:0.20, maxDrawdown:0.15, coverage:90, confidence:90 };
  const r = novabotDimensionnerPosition({ cfg:cfgConcentre, mandate:mandateBase, st:{ ticker:'BBB', sector:'Tech' }, prix:100, donnees, pfTotal:800, valeurExistanteEUR:0, byId });
  // plafond secteur = 15%*2.5/100 * 800 - 300(déjà Tech) = 300 - 300 = 0
  check('RÉGRESSION : secteur déjà concentré au plafond -> plus rien d\'investissable pour un nouveau candidat du même secteur (jamais un achat forcé)',
    r.montant === 0 && r.detail.bornePlusStricte === 'plafond_secteur');
}

/* ---------- 6) reproductibilité : mêmes données, mêmes règles -> même résultat (déterministe) ---------- */
{
  const donnees = { score:88, volatility:0.22, maxDrawdown:0.18, coverage:85, confidence:85 };
  const args = { cfg:cfgBase, mandate:mandateBase, st:{ ticker:'REPRO', sector:'Santé' }, prix:150, donnees, pfTotal, valeurExistanteEUR:0, byId:{} };
  const r1 = novabotDimensionnerPosition(args);
  const r2 = novabotDimensionnerPosition(args);
  check('RÉGRESSION : mêmes données et mêmes règles -> résultat strictement identique (moteur déterministe, jamais aléatoire)',
    r1.montant === r2.montant && JSON.stringify(r1.detail) === JSON.stringify(r2.detail));
}

/* ---------- 7) deux candidats réellement identiques -> même montant, explicable (§3 : "explique pourquoi") ---------- */
{
  const donnees = { score:80, volatility:0.25, maxDrawdown:0.20, coverage:80, confidence:80 };
  const r1 = novabotDimensionnerPosition({ cfg:cfgBase, mandate:mandateBase, st:{ ticker:'JUMEAU1', sector:'Santé' }, prix:50, donnees, pfTotal, valeurExistanteEUR:0, byId:{} });
  const r2 = novabotDimensionnerPosition({ cfg:cfgBase, mandate:mandateBase, st:{ ticker:'JUMEAU2', sector:'Santé' }, prix:200, donnees, pfTotal, valeurExistanteEUR:0, byId:{} });
  check('deux candidats au même NovaScore et même risque reçoivent le même montant (prix différent, sans incidence sur le montant en euros)',
    r1.montant === r2.montant);
}

/* ---------- 8) novabotBareme() : interpolation linéaire correcte (mêmes seuils que _novascore.js) ---------- */
check('novabotBareme : valeur au premier seuil -> score maximal', novabotBareme(NOVABOT_ECHELLE_VOLATILITE, 0.10) === 100);
check('novabotBareme : valeur au-delà du dernier seuil -> score minimal (plafonné, jamais négatif)', novabotBareme(NOVABOT_ECHELLE_VOLATILITE, 0.80) === 0);
check('novabotBareme : valeur non finie -> null, jamais une estimation', novabotBareme(NOVABOT_ECHELLE_VOLATILITE, NaN) === null);
check('novabotBareme : interpolation entre deux seuils (0.16 entre 0.12->100 et 0.20->78)', novabotBareme(NOVABOT_ECHELLE_VOLATILITE, 0.16) === 89);

/* ---------- rapport ---------- */
const fails = results.filter(([, ok]) => !ok);
for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
console.log('');
if (fails.length){
  console.log(`${fails.length}/${results.length} ÉCHEC(S)`);
  process.exit(1);
} else {
  console.log(`TOUS LES TESTS PASSENT (${results.length})`);
}
