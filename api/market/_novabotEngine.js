/* Moteur NovaBot côté SERVEUR (V7 phase 2, 2026-10-12) — "le système doit
   fonctionner côté serveur, même lorsque l'utilisateur ferme son
   navigateur [...] il ne doit pas dépendre d'un onglet ouvert".

   Portage FIDÈLE de la logique pure de js/core.js (rejouerNovaBot,
   novabotRiskCheck, le dimensionnement d'achat corrigé le 2026-10-12)
   vers un contexte Node serveur, pour être appelée par le cycle
   automatique (voir le branchement `novabotCron` dans api/market/
   extra.js) SANS dépendre du navigateur.

   ATTENTION — DUPLICATION ASSUMÉE ET DOCUMENTÉE : ces fonctions dupliquent
   délibérément leurs équivalents dans js/core.js plutôt que de partager un
   module isomorphe (js/core.js mélange logique pure et code navigateur —
   DOM, state global, saveState() — une vraie extraction serait un chantier
   séparé). CONSÉQUENCE OPÉRATIONNELLE : toute correction future de la
   logique de risque/dimensionnement dans js/core.js (evaluerNovaBot,
   novabotRiskCheck, le calcul de montantInvestissable) DOIT être reportée
   ICI à la main, sous peine de voir le comportement du cycle automatique
   diverger silencieusement de celui déclenché manuellement depuis
   l'application. Signalé explicitement dans le rapport d'audit V7 remis à
   l'utilisateur — pas une négligence, un compromis de temps assumé pour
   livrer une première version fonctionnelle.

   LIMITATION V1 DISCLOSED : seules les SORTIES (stop-loss/take-profit sur
   les positions déjà détenues) sont automatisées ici. La découverte de
   nouvelles opportunités sur l'ensemble du catalogue (46 000+ instruments)
   dépend côté navigateur d'un score déjà mis en cache localement au fil de
   la navigation (st.score) — un serveur qui démarre à froid n'a aucun
   équivalent, et calculer un vrai NovaScore pour des milliers de candidats
   à chaque cycle dépasserait largement le budget de temps d'une fonction
   serverless. DISCOVERY_UNIVERSE ci-dessous est un univers volontairement
   restreint et explicite (jamais le catalogue entier) le temps qu'un vrai
   cache de scores serveur soit construit — chantier séparé, à prioriser
   si cette première version est validée. */

/* ---------- rejeu du journal (copie exacte de js/core.js) ---------- */
function rejouerNovaBot(transactions){
  const wallet = { cash: 0, invested: 0, positions: [], realizedPnL: 0 };
  const triees = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const tx of triees){
    if (tx.type === 'buy'){
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos){
        const totalQty = pos.qty + tx.qty;
        pos.avg = ((pos.avg * pos.qty) + (tx.priceLocal * tx.qty)) / totalQty;
        pos.qty = totalQty;
      } else {
        wallet.positions.push({ id: tx.stockId, qty: tx.qty, avg: tx.priceLocal, currency: tx.currency });
      }
      wallet.cash -= tx.amountEUR;
    } else if (tx.type === 'sell'){
      const pos = wallet.positions.find(p => p.id === tx.stockId);
      if (pos){
        pos.qty -= tx.qty;
        if (pos.qty <= 0.0001) wallet.positions = wallet.positions.filter(p => p.id !== tx.stockId);
      }
      wallet.cash += tx.amountEUR;
      if (Number.isFinite(tx.realizedGain)) wallet.realizedPnL += tx.realizedGain;
    } else if (tx.type === 'deposit'){
      wallet.cash += tx.amountEUR; wallet.invested += tx.amountEUR;
    } else if (tx.type === 'withdraw'){
      wallet.cash -= tx.amountEUR; wallet.invested -= tx.amountEUR;
    } else if (tx.type === 'fee'){
      wallet.cash -= tx.amountEUR;
    }
  }
  return wallet;
}

/* ---------- conversion devise ----------
   LIMITATION V1 DISCLOSED : taux figé à 1 pour tout ce qui n'est pas EUR
   plutôt qu'une conversion (potentiellement fausse) sans accès aux taux
   forex en direct dans cette première version — mieux vaut ignorer une
   position non-EUR dans CE cycle (voir appelant) que produire un montant
   inventé. js/core.js (navigateur) a accès à FX, déjà alimenté par le
   reste de l'application — jamais répliqué ici sans données réelles. */
function toEURSimple(amount, cur){
  if (!Number.isFinite(amount)) return null;
  if (!cur || cur === 'EUR') return amount;
  return null; // signale "non convertible dans ce contexte", jamais un taux inventé
}

/* ---------- Risk Engine (copie fidèle de novabotRiskCheck, js/core.js) ---------- */
function novabotRiskCheckServeur(intent, wallet, mandate, pfTotalEUR){
  const violations = [];
  if (intent.action === 'sell') return { allowed: true, violations };

  const secteurInterdit = (mandate.hardRules || []).find(r => r.type === 'excluded_sector' && r.value === intent.sector);
  if (secteurInterdit) violations.push({ type:'secteur_interdit', message:`Secteur "${intent.sector}" exclu par le mandat.` });

  const actifInterdit = (mandate.hardRules || []).find(r => r.type === 'excluded_asset'
    && (r.value === intent.stockId || r.value === intent.ticker));
  if (actifInterdit) violations.push({ type:'actif_interdit', message:`${intent.ticker} exclu explicitement par le mandat.` });

  if (intent.amountEUR > wallet.cash){
    violations.push({ type:'cash_insuffisant', message:'Liquidités simulées insuffisantes pour cet achat.' });
  } else {
    const cashApres = wallet.cash - intent.amountEUR;
    const cashMin = (mandate.cashMinPct / 100) * pfTotalEUR;
    if (cashApres < cashMin) violations.push({ type:'cash_min', message:`Ferait passer le cash sous le minimum du mandat (${mandate.cashMinPct} %).` });
  }

  return { allowed: violations.length === 0, violations };
}

/* ---------- Dimensionnement d'achat (copie fidèle du correctif
   2026-10-12, js/core.js evaluerNovaBot()) ---------- */
const MONTANT_MIN_INVESTISSABLE = 5;
function montantInvestissableServeur({ tradeAmountEUR, cashDispo, pfTotalEUR, maxPositionPct, valeurExistanteEUR }){
  const plafondPosition = (maxPositionPct / 100) * pfTotalEUR - valeurExistanteEUR;
  return Math.min(tradeAmountEUR, cashDispo, plafondPosition);
}

module.exports = { rejouerNovaBot, toEURSimple, novabotRiskCheckServeur, montantInvestissableServeur, MONTANT_MIN_INVESTISSABLE };
