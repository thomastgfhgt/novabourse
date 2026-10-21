/**
 * GET /api/me — profil et plan de l'utilisateur connecté.
 * POST /api/me — enregistrement du parcours utilisateur.
 *
 * GET/POST /api/me?resource=portfolio — synchronisation du portefeuille
 * réel (LOT D, Étape 3). Voir handlePortfolio() plus bas : le journal de
 * transactions (portfolio_transactions) est la seule source de vérité,
 * jamais une table "positions" séparée — voir sql/2026-09-24_portfolio_persistence.sql.
 *
 * Le plan est toujours lu en base.
 * Le navigateur ne décide jamais du plan.
 */

const SB = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function userFromToken(req) {
  const h = req.headers.authorization || '';

  const token =
    h.startsWith('Bearer ')
      ? h.slice(7)
      : null;

  if (!token || !SB || !ANON) {
    return null;
  }

  try {
    const r = await fetch(
      `${SB}/auth/v1/user`,
      {
        headers: {
          apikey: ANON,
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return r.ok
      ? await r.json()
      : null;

  } catch {
    return null;
  }
}

async function sb(path, init = {}) {
  if (!SB || !SERVICE) {
    throw new Error('supabase_non_configure');
  }

  const r = await fetch(
    `${SB}/rest/v1/${path}`,
    {
      ...init,

      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(init.headers || {}),
      },
    }
  );

  if (!r.ok) {
    throw new Error(
      `${r.status} ${(await r.text()).slice(0, 120)}`
    );
  }

  /*
   * Certaines requêtes PATCH avec return=minimal
   * peuvent ne pas avoir de corps JSON exploitable.
   */
  if (r.status === 204) {
    return [];
  }

  const text = await r.text();

  return text
    ? JSON.parse(text)
    : [];
}

const {
  PLAN_LIMITS,
  planReel,
  consommation,
  quotaBlock,
} = require('./_limits.js');

/*
 * Limites fonctionnelles frontend.
 *
 * null + unlimited=true est plus explicite que Infinity,
 * qui serait sérialisé en null implicitement par JSON.stringify.
 */
const LIMITS = {
  free: {
    watchlist: 10,
    watchlistUnlimited: false,

    alerts: 3,
    alertsUnlimited: false,

    compare: 2,
  },

  pro: {
    watchlist: null,
    watchlistUnlimited: true,

    alerts: null,
    alertsUnlimited: true,

    compare: 3,
  },

  elite: {
    watchlist: null,
    watchlistUnlimited: true,

    alerts: null,
    alertsUnlimited: true,

    compare: 5,
  },
};

const METHODES = [
  'GET',
  'POST',
];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  /* ---------- méthode ---------- */

  if (!METHODES.includes(req.method)) {
    res.setHeader(
      'Allow',
      METHODES.join(', ')
    );

    return res.status(405).json({
      error: 'methode_non_autorisee',
    });
  }

  /* ---------- authentification ---------- */

  const user =
    await userFromToken(req);

  if (!user) {
    return res.status(401).json({
      error: 'non_connecte',
    });
  }

  /* ---------- ressource portefeuille (LOT D) ---------- */

  if (req.query?.resource === 'portfolio') {
    return handlePortfolio(req, res, user);
  }

  /* ---------- ressource Nova Core : conversations (2026-10-05) ----------
     Repliée ici plutôt que dans son propre fichier api/nova/conversations.js
     (tenté une première fois, déploiement en échec) : le plan Vercel
     Hobby de ce projet plafonne à 12 Fonctions Serverless par déploiement
     — exactement le compte de fichiers routables sous api/ AVANT cet
     ajout (voir la liste dans l'historique git). Même principe déjà en
     place juste au-dessus pour le portefeuille (?resource=portfolio) :
     une ressource de plus sur une fonction existante, zéro fonction
     serverless supplémentaire. */
  if (req.query?.resource === 'conversations') {
    return handleNovaConversations(req, res, user);
  }

  /* ---------- ressource NovaBot (refonte fonctionnelle, 2026-10-07) ----------
     Même raison que les deux ressources ci-dessus : repliée ici plutôt que
     dans api/novabot.js, le plafond de 12 Fonctions Serverless (Hobby) est
     déjà atteint EXACTEMENT par les fichiers existants sous api/ (vérifié
     avant d'écrire cette ligne : find api -name "*.js" -not -name "_*"
     -> 12). Toute nouvelle ressource NovaBot (mandat, transactions,
     décisions, futur pipeline IA) passera par ?resource=novabot, jamais un
     nouveau fichier. */
  if (req.query?.resource === 'novabot') {
    return handleNovaBot(req, res, user);
  }

  /* ---------- Alpaca Broker API Sandbox, admin (2026-10-15) ----------
     Même raison que les ressources ci-dessus : repliée ici (3 fichiers
     api/admin/alpaca-*.js supprimés) plutôt que 3 nouvelles fonctions
     serverless — le plafond Hobby (12) était déjà atteint EXACTEMENT
     avant cet ajout (échec de déploiement réel, 2026-10-15 :
     "No more than 12 Serverless Functions"). Toute action Alpaca admin
     passe par ?resource=alpaca&action=status|account|link. */
  if (req.query?.resource === 'alpaca') {
    return handleAlpacaAdmin(req, res, user);
  }

  /* =========================================================
     POST — profil investisseur / onboarding
     ========================================================= */

  if (req.method === 'POST') {
    const body =
      req.body || {};

    const patch = {
      updated_at:
        new Date().toISOString(),
    };

    if (typeof body.level === 'string') {
      patch.investor_level =
        body.level
          .trim()
          .slice(0, 40);
    }

    if (typeof body.goal === 'string') {
      patch.investor_goal =
        body.goal
          .trim()
          .slice(0, 40);
    }

    if (Array.isArray(body.interests)) {
      patch.interests =
        body.interests
          .slice(0, 5)
          .map(
            x =>
              String(x)
                .trim()
                .slice(0, 40)
          );
    }

    if (
      typeof body.startCapital === 'number'
      && Number.isFinite(body.startCapital)
    ) {
      patch.start_capital =
        Math.max(
          0,
          Math.min(
            1e9,
            body.startCapital
          )
        );
    }

    if (body.completed === true) {
      patch.onboarded_at =
        new Date().toISOString();
    }

    try {
      await sb(
        `profiles?id=eq.${encodeURIComponent(user.id)}`,
        {
          method: 'PATCH',

          headers: {
            Prefer: 'return=minimal',
          },

          body:
            JSON.stringify(patch),
        }
      );

    } catch (e) {
      console.error(
        '[me] enregistrement du parcours :',
        e.message
      );

      return res.status(503).json({
        error:
          'enregistrement_impossible',
      });
    }

    return res.status(200).json({
      saved: true,
    });
  }

  /* =========================================================
     GET — profil
     ========================================================= */

  let profile = null;

  try {
    const rows =
      await sb(
        `profiles?id=eq.${encodeURIComponent(user.id)}&select=*`
      );

    profile =
      rows[0]
      || null;

    /*
     * Première connexion.
     */
    if (!profile) {
      const created =
        await sb(
          'profiles',
          {
            method: 'POST',

            headers: {
              Prefer:
                'resolution=merge-duplicates,return=representation',
            },

            body:
              JSON.stringify([
                {
                  id: user.id,

                  email:
                    user.email,

                  full_name:
                    user.user_metadata?.full_name
                    || null,

                  avatar_url:
                    user.user_metadata?.avatar_url
                    || null,

                  plan: 'free',
                },
              ]),
          }
        );

      profile =
        created[0]
        || null;
    }

  } catch (e) {
    console.error(
      '[me]',
      e.message
    );

    return res.status(200).json({
      authenticated: true,

      ...quotaBlock(
        'free',
        0
      ),

      planLabel:
        'Découverte',

      limits:
        LIMITS.free,

      email:
        user.email,

      degraded:
        'base_indisponible',
    });
  }

  /* ---------- plan réel ---------- */

  const planInfo =
    await planReel(
      sb,
      user.id
    );

  const plan =
    Object.prototype.hasOwnProperty.call(
      PLAN_LIMITS,
      planInfo.plan
    )
      ? planInfo.plan
      : 'free';

  /* ---------- quota ---------- */

  let utilise = 0;

  try {
    utilise =
      await consommation(
        sb,
        user.id
      );

  } catch (e) {
    console.error(
      '[me] consommation :',
      e.message
    );

    utilise = 0;
  }

  const quota =
    quotaBlock(
      plan,
      utilise
    );

  /* ---------- réponse ---------- */

  return res.status(200).json({
    ...quota,

    planLabel:
      PLAN_LIMITS[plan].label,

    onboarded:
      Boolean(
        profile?.onboarded_at
      ),

    onboardedAt:
      profile?.onboarded_at
      || null,

    profileSetup: {
      level:
        profile?.investor_level
        || null,

      goal:
        profile?.investor_goal
        || null,

      interests:
        profile?.interests
        || [],

      startCapital:
        profile?.start_capital
        ?? null,
    },

    authenticated: true,

    email:
      profile?.email
      || user.email,

    name:
      profile?.full_name
      || user.user_metadata?.full_name
      || null,

    avatar:
      profile?.avatar_url
      || null,

    status:
      profile?.subscription_status
      || null,

    /*
     * Différent de quota.periodEnd.
     */
    subscriptionPeriodEnd:
      profile?.subscription_current_period_end
      || null,

    limits:
      LIMITS[plan],
  });
};

/**
 * GET/POST /api/me?resource=portfolio
 *
 * Le client (index.html) garde toute la logique de calcul (PRU, gains
 * réalisés/latents — voir buyStock()/sellStock()/portfolioValue()), déjà
 * testée (scripts/test-portfolio-*.js, test-what-if.js). Ce endpoint ne
 * fait QUE stocker/relire le journal réel pour qu'il survive à un
 * changement d'appareil ou un cache vidé — aucun calcul financier ici.
 *
 * POST : le client renvoie systématiquement TOUT son historique local
 * (transactions + snapshots), jamais un diff — plus simple, et l'upsert
 * (clé = id pour les transactions, user_id+occurred_at pour les
 * snapshots) rend l'opération idempotente : rejouer le même envoi après
 * une coupure réseau ne crée jamais de doublon ni de perte.
 */
async function handlePortfolio(req, res, user) {
  if (req.method === 'GET') {
    try {
      const [txRows, snapRows] = await Promise.all([
        sb(`portfolio_transactions?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=occurred_at.asc`),
        sb(`portfolio_snapshots?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=occurred_at.asc`),
      ]);

      return res.status(200).json({
        transactions: txRows.map(r => ({
          id: r.id,
          stockId: r.stock_id,
          ticker: r.ticker,
          name: r.name,
          type: r.type,
          qty: r.qty,
          priceLocal: r.price_local,
          currency: r.currency,
          amountEUR: r.amount_eur,
          realizedGain: r.realized_gain,
          thesisReason: r.thesis_reason,
          thesisHorizon: r.thesis_horizon,
          date: r.occurred_at,
        })),
        snapshots: snapRows.map(r => ({
          t: new Date(r.occurred_at).getTime(),
          totalValue: r.total_value,
          cash: r.cash,
          investedValue: r.invested_value,
          netDeposits: r.net_deposits,
          unrealizedPnL: r.unrealized_pnl,
          realizedPnL: r.realized_pnl,
          reason: r.reason,
        })),
      });
    } catch (e) {
      console.error('[me] lecture portefeuille :', e.message);
      return res.status(503).json({ error: 'lecture_impossible' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const body = req.body || {};
  const txIn = Array.isArray(body.transactions) ? body.transactions.slice(0, 20000) : [];
  const snapIn = Array.isArray(body.snapshots) ? body.snapshots.slice(0, 20000) : [];

  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const isoDate = (v) => {
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  };

  const TYPES_TITRE = ['buy', 'sell'];
  const TYPES_FLUX = ['deposit', 'withdraw', 'fee'];
  const transactions = [];
  for (const tx of txIn) {
    const id = str(tx?.id, 64);
    const occurredAt = isoDate(tx?.date);
    const type = TYPES_TITRE.includes(tx?.type) || TYPES_FLUX.includes(tx?.type) ? tx.type : null;
    const amountEUR = num(tx?.amountEUR);
    if (!id || !occurredAt || !type || amountEUR === null) continue;

    if (TYPES_TITRE.includes(type)) {
      // Achat/vente : un titre, une quantité, un prix — comme avant.
      const qty = num(tx?.qty);
      const priceLocal = num(tx?.priceLocal);
      const currency = str(tx?.currency, 8);
      const stockId = str(tx?.stockId, 40);
      if (qty === null || qty <= 0 || priceLocal === null || !currency || !stockId) continue;
      transactions.push({
        id, user_id: user.id, stock_id: stockId,
        ticker: str(tx?.ticker, 20) || stockId,
        name: str(tx?.name, 200) || stockId,
        type, qty, price_local: priceLocal, currency, amount_eur: amountEUR,
        realized_gain: num(tx?.realizedGain),
        thesis_reason: str(tx?.thesisReason, 500) || null,
        thesis_horizon: str(tx?.thesisHorizon, 40) || null,
        occurred_at: occurredAt,
      });
    } else {
      // Dépôt/retrait/frais (§35 du prompt maître, 2026-10-05) : aucun titre
      // concerné — stock_id/ticker/qty/price_local/currency restent null
      // (colonnes rendues nullable par sql/2026-10-05_portfolio_cash_flows.sql).
      transactions.push({
        id, user_id: user.id, stock_id: null, ticker: null,
        name: str(tx?.name, 200) || null,
        type, qty: null, price_local: null, currency: null, amount_eur: amountEUR,
        realized_gain: null, thesis_reason: null, thesis_horizon: null,
        occurred_at: occurredAt,
      });
    }
  }

  const snapshots = [];
  for (const s of snapIn) {
    const occurredAt = isoDate(s?.t);
    const totalValue = num(s?.totalValue);
    const cash = num(s?.cash);
    const investedValue = num(s?.investedValue);
    if (!occurredAt || totalValue === null || cash === null || investedValue === null) continue;
    snapshots.push({
      user_id: user.id,
      occurred_at: occurredAt,
      total_value: totalValue,
      cash,
      invested_value: investedValue,
      net_deposits: num(s?.netDeposits),
      unrealized_pnl: num(s?.unrealizedPnL),
      realized_pnl: num(s?.realizedPnL),
      reason: str(s?.reason, 20) || null,
    });
  }

  try {
    if (transactions.length) {
      await sb('portfolio_transactions?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(transactions),
      });
    }
    if (snapshots.length) {
      await sb('portfolio_snapshots?on_conflict=user_id,occurred_at', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(snapshots),
      });
    }
  } catch (e) {
    console.error('[me] synchronisation portefeuille :', e.message);
    return res.status(503).json({ error: 'synchronisation_impossible' });
  }

  return res.status(200).json({
    saved: true,
    transactionsSynced: transactions.length,
    snapshotsSynced: snapshots.length,
  });
}

/**
 * GET/POST /api/me?resource=novabot — fondation persistée NovaBot (refonte
 * fonctionnelle, 2026-10-07, tranche A). Voir
 * sql/2026-10-07_novabot_foundation.sql pour le schéma complet et le
 * raisonnement derrière chaque table.
 *
 * Même philosophie que ?resource=portfolio : ce endpoint stocke/relit,
 * il ne calcule aucun chiffre financier (cash/positions/PRU restent
 * reconstruits côté client par rejeu du journal, voir rejouerNovaBot()
 * dans js/core.js — même fonction que rejouerTransactions(), réutilisée).
 * Ce qui EST nouveau par rapport au portefeuille personnel : un compte et
 * un mandat, qui doivent exister avant tout journal (contrainte de clé
 * étrangère account_id).
 *
 * GET  ?resource=novabot — { account, mandate, mandateHistory, transactions,
 *   snapshots }. account/mandate valent null tant que rien n'a été créé
 *   (le client affiche alors le parcours de création, jamais un portefeuille
 *   vide présenté comme actif).
 *
 * POST ?resource=novabot — body : { account?, status?, mandate?,
 *   transactions?, snapshots? }, chaque clé optionnelle et traitée
 *   indépendamment, dans cet ordre (un compte doit exister avant qu'un
 *   mandat ou un journal ne puisse être écrit) :
 *   - account: { initialCapital } — crée le compte s'il n'existe pas
 *     encore. Idempotent : un compte existant n'est jamais recréé ni
 *     modifié par ce champ (un second "capital confié" passe par une
 *     transaction 'deposit', jamais une réécriture d'initial_capital).
 *   - status: 'setup' | 'active' | 'paused' — le client ne peut jamais
 *     positionner 'analyzing'/'waiting'/'error' (réservés au pipeline
 *     serveur d'une tranche ultérieure).
 *   - mandate: { ... } — insère une NOUVELLE version si elle diffère de la
 *     version courante (jamais de doublon si le client renvoie le même
 *     mandat à chaque sync).
 *   - transactions / snapshots: upsert idempotent, même mécanique exacte
 *     que ?resource=portfolio.
 */
/* 'cancelled' ajouté le 2026-10-15 (pilotage du mandat depuis le chat) :
   annulation EXPLICITE du mandat, distincte de 'paused' — voir
   sql/2026-10-15_novabot_mandate_amendments.sql pour la contrainte DB
   correspondante. Le cron (api/market/extra.js) ne lit déjà que
   status=eq.active : un compte 'cancelled' est ignoré exactement comme un
   compte 'paused', aucun changement nécessaire côté cron. */
const NOVABOT_CLIENT_STATUSES = ['setup', 'active', 'paused', 'cancelled'];
const NOVABOT_AUTONOMY_MODES = ['advice', 'semi_auto', 'auto'];
const NOVABOT_TX_TYPES = ['buy', 'sell', 'deposit', 'withdraw', 'fee'];
const NOVABOT_MANDATE_KEYS = ['objective', 'horizon_years', 'risk_level', 'max_drawdown_pct', 'cash_min_pct',
  'max_position_pct', 'max_positions_count', 'preferences', 'hard_rules', 'allowed_regions', 'currencies',
  'benchmark', 'notes', 'trading_rules'];

/* Mappages partagés entre le GET (lecture) et les nouvelles actions de
   confirmation/restauration (2026-10-15) — évite de dupliquer la forme
   camelCase<->snake_case à chaque nouveau point d'entrée. */
function mandatVersEntree(m) {
  return {
    objective: m.objective, horizonYears: m.horizon_years, riskLevel: m.risk_level,
    maxDrawdownPct: m.max_drawdown_pct, cashMinPct: m.cash_min_pct, maxPositionPct: m.max_position_pct,
    maxPositionsCount: m.max_positions_count, preferences: m.preferences, hardRules: m.hard_rules,
    allowedRegions: m.allowed_regions, currencies: m.currencies, benchmark: m.benchmark, notes: m.notes,
    tradingRules: m.trading_rules,
  };
}
function mandatVersSortie(m) {
  return {
    id: m.id, objective: m.objective, horizonYears: m.horizon_years, riskLevel: m.risk_level,
    maxDrawdownPct: m.max_drawdown_pct, cashMinPct: m.cash_min_pct, maxPositionPct: m.max_position_pct,
    maxPositionsCount: m.max_positions_count, preferences: m.preferences, hardRules: m.hard_rules,
    allowedRegions: m.allowed_regions, currencies: m.currencies, benchmark: m.benchmark, notes: m.notes,
    tradingRules: m.trading_rules || null, createdAt: m.created_at,
  };
}
/* Diff calculé à la lecture entre deux lignes adjacentes de
   novabot_mandates (jamais stocké — l'historique complet existe déjà,
   append-only, voir sql/2026-10-07_novabot_foundation.sql) : plus récent
   (a) vs précédent (b). */
function diffMandats(a, b) {
  const out = {};
  for (const k of NOVABOT_MANDATE_KEYS) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = { from: b[k], to: a[k] };
  }
  return out;
}

async function getNovaBotAccount(user) {
  const rows = await sb(`novabot_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=*`);
  return rows[0] || null;
}

async function handleNovaBot(req, res, user) {
  if (req.method === 'GET') {
    try {
      const account = await getNovaBotAccount(user);
      if (!account) {
        return res.status(200).json({ account: null, mandate: null, mandateHistory: [], transactions: [], snapshots: [], decisions: [] });
      }
      const [mandateRows, txRows, snapRows, decRows] = await Promise.all([
        sb(`novabot_mandates?account_id=eq.${encodeURIComponent(account.id)}&select=*&order=created_at.desc`),
        sb(`novabot_transactions?account_id=eq.${encodeURIComponent(account.id)}&select=*&order=occurred_at.asc`),
        sb(`novabot_portfolio_snapshots?account_id=eq.${encodeURIComponent(account.id)}&select=*&order=occurred_at.asc`),
        sb(`novabot_decisions?account_id=eq.${encodeURIComponent(account.id)}&select=*&order=occurred_at.asc&limit=5000`),
      ]);
      const current = mandateRows.find(m => m.is_current) || null;
      return res.status(200).json({
        account: {
          id: account.id,
          status: account.status,
          autonomyMode: account.autonomy_mode,
          initialCapital: account.initial_capital,
          createdAt: account.created_at,
        },
        mandate: current && mandatVersSortie(current),
        /* mandateRows est trié created_at.desc (requête ci-dessus) : la
           ligne suivante dans le tableau est donc toujours la version
           PRÉCÉDENTE de la ligne courante — le diff se calcule sans
           requête supplémentaire. La toute première version (la plus
           ancienne, onboarding) n'a pas de précédente : changes=null. */
        mandateHistory: mandateRows.map((m, i) => ({
          id: m.id, isCurrent: m.is_current, createdAt: m.created_at,
          changes: mandateRows[i + 1] ? diffMandats(m, mandateRows[i + 1]) : null,
        })),
        transactions: txRows.map(r => ({
          id: r.id, stockId: r.stock_id, ticker: r.ticker, name: r.name, type: r.type,
          qty: r.qty, priceLocal: r.price_local, currency: r.currency, amountEUR: r.amount_eur,
          realizedGain: r.realized_gain, decisionId: r.decision_id, reason: r.reason, date: r.occurred_at,
        })),
        snapshots: snapRows.map(r => ({
          t: new Date(r.occurred_at).getTime(), totalValue: r.total_value, cash: r.cash,
          investedValue: r.invested_value, netDeposits: r.net_deposits,
          unrealizedPnL: r.unrealized_pnl, realizedPnL: r.realized_pnl, reason: r.reason,
        })),
        decisions: decRows.map(r => ({
          id: r.id, action: r.action, stockId: r.stock_id, ticker: r.ticker, name: r.name,
          priceObserved: r.price_observed, qty: r.qty, amountEUR: r.amount_eur,
          weightBeforePct: r.weight_before_pct, weightAfterPct: r.weight_after_pct,
          cashBefore: r.cash_before, cashAfter: r.cash_after, reason: r.reason,
          dataUsed: r.data_used, mandateSnapshot: r.mandate_snapshot, riskResult: r.risk_result,
          relevantNews: r.relevant_news, relevantEvent: r.relevant_event,
          aiProvider: r.ai_provider, aiModel: r.ai_model, confidence: r.confidence,
          executionStatus: r.execution_status, occurredAt: r.occurred_at,
        })),
      });
    } catch (e) {
      console.error('[me] lecture novabot :', e.message);
      return res.status(503).json({ error: 'lecture_impossible' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const body = req.body || {};
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const isoDate = (v) => { const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toISOString() : null; };
  /* Factorisé le 2026-10-15 (pilotage du mandat depuis le chat) : utilisé
     à la fois par le mandat complet (body.mandate ci-dessous) et par une
     modification partielle confirmée depuis la conversation
     (confirm_mandate_amendment) — mêmes bornes, une seule source de
     vérité, jamais deux validations qui pourraient diverger. */
  const construireMandatDepuisEntree = (m) => ({
    objective: str(m.objective, 40) || null,
    horizon_years: num(m.horizonYears),
    risk_level: str(m.riskLevel, 20) || null,
    max_drawdown_pct: num(m.maxDrawdownPct),
    cash_min_pct: num(m.cashMinPct) ?? 20,
    max_position_pct: num(m.maxPositionPct) ?? 10,
    max_positions_count: Number.isInteger(m.maxPositionsCount) ? m.maxPositionsCount : null,
    preferences: Array.isArray(m.preferences) ? m.preferences : [],
    hard_rules: Array.isArray(m.hardRules) ? m.hardRules : [],
    allowed_regions: Array.isArray(m.allowedRegions) ? m.allowedRegions : null,
    currencies: Array.isArray(m.currencies) ? m.currencies : null,
    benchmark: str(m.benchmark, 20) || null,
    notes: str(m.notes, 2000) || null,
    trading_rules: (m.tradingRules && typeof m.tradingRules === 'object') ? {
      scoreAchat: Number.isFinite(m.tradingRules.scoreAchat) ? Math.max(0, Math.min(100, m.tradingRules.scoreAchat)) : null,
      stopLossPct: Number.isFinite(m.tradingRules.stopLossPct) ? Math.max(1, Math.min(90, m.tradingRules.stopLossPct)) : null,
      takeProfitPct: Number.isFinite(m.tradingRules.takeProfitPct) ? Math.max(1, Math.min(500, m.tradingRules.takeProfitPct)) : null,
      tradeAmountEUR: Number.isFinite(m.tradingRules.tradeAmountEUR) ? Math.max(10, Math.min(1000000, m.tradingRules.tradeAmountEUR)) : null,
    } : null,
  });

  try {
    let account = await getNovaBotAccount(user);

    /* ---------- création du compte (une fois, jamais réécrit) ---------- */
    if (body.account && !account) {
      const initialCapital = num(body.account.initialCapital);
      if (initialCapital === null || initialCapital < 0) {
        return res.status(400).json({ error: 'capital_initial_invalide' });
      }
      const autonomyMode = NOVABOT_AUTONOMY_MODES.includes(body.account.autonomyMode) ? body.account.autonomyMode : 'advice';
      const [created] = await sb('novabot_accounts', {
        method: 'POST',
        body: JSON.stringify([{ user_id: user.id, status: 'setup', autonomy_mode: autonomyMode, initial_capital: initialCapital }]),
      });
      account = created;
    }

    /* ---------- mode d'autonomie (refonte expérience, §22) : modifiable
       après coup, contrairement au capital initial — l'utilisateur peut
       changer d'avis sur "demande toujours confirmation" vs "autonome"
       sans recréer son compte. Seulement si fourni ET différent, pour ne
       pas réécrire la ligne à chaque pushNovaBot() silencieux. */
    if (account && NOVABOT_AUTONOMY_MODES.includes(body.account?.autonomyMode)
      && body.account.autonomyMode !== account.autonomy_mode) {
      await sb(`novabot_accounts?id=eq.${encodeURIComponent(account.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ autonomy_mode: body.account.autonomyMode, updated_at: new Date().toISOString() }),
      });
      account.autonomy_mode = body.account.autonomyMode;
    }

    /* ---------- changement d'état (suspendre/reprendre) ---------- */
    if (typeof body.status === 'string') {
      if (!account) return res.status(409).json({ error: 'compte_inexistant' });
      if (!NOVABOT_CLIENT_STATUSES.includes(body.status)) {
        return res.status(400).json({ error: 'statut_invalide' });
      }
      await sb(`novabot_accounts?id=eq.${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: body.status, updated_at: new Date().toISOString() }),
      });
      account.status = body.status;
    }

    /* ---------- pilotage du mandat depuis le chat (2026-10-15) ----------
       Chemins DÉDIÉS et séparés du bloc générique body.mandate plus bas :
       celui-ci sert à TOUS les syncs silencieux (réglages, trading_rules,
       etc., déclenchés à chaque pushNovaBot()) ; ceux-ci sont les SEULS
       déclenchés par une confirmation EXPLICITE de l'utilisateur dans la
       conversation — ils vérifient la concurrence (baseMandateId, pour ne
       jamais écraser un changement fait entre-temps par un autre onglet/
       conversation) et journalisent la modification dans
       novabot_mandate_changes (voir sql/2026-10-15_novabot_mandate_
       amendments.sql). Aucun des deux ne touche jamais wallet/positions. */
    if (body.action === 'confirm_mandate_amendment') {
      if (!account) return res.status(409).json({ error: 'compte_inexistant' });
      const changes = body.changes && typeof body.changes === 'object' && !Array.isArray(body.changes)
        ? body.changes : null;
      if (!changes) return res.status(400).json({ error: 'changement_invalide' });

      const currentRows = await sb(`novabot_mandates?account_id=eq.${encodeURIComponent(account.id)}&is_current=eq.true&select=*`);
      const current = currentRows[0] || null;
      if (!current) return res.status(409).json({ error: 'mandat_inexistant' });

      const baseMandateId = str(body.baseMandateId, 64);
      if (baseMandateId && baseMandateId !== current.id) {
        /* Un autre onglet/conversation a déjà écrit une nouvelle version
           pendant que celle-ci était proposée — on ne devine jamais lequel
           des deux changements doit gagner, on refuse et on renvoie le
           mandat réel pour que la conversation le relaie honnêtement. */
        return res.status(409).json({ error: 'mandat_modifie_depuis', mandate: mandatVersSortie(current) });
      }

      if (typeof changes.autonomyMode === 'string' && NOVABOT_AUTONOMY_MODES.includes(changes.autonomyMode)
        && changes.autonomyMode !== account.autonomy_mode) {
        /* autonomyMode est une colonne de compte, pas du mandat versionné
           (§ plan) : appliqué directement, même mécanisme que le bloc
           "mode d'autonomie" plus haut, jamais une ligne novabot_mandates. */
        await sb(`novabot_accounts?id=eq.${encodeURIComponent(account.id)}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ autonomy_mode: changes.autonomyMode, updated_at: new Date().toISOString() }),
        });
        account.autonomy_mode = changes.autonomyMode;
      }

      const merged = { ...mandatVersEntree(current), ...changes };
      const next = construireMandatDepuisEntree(merged);
      const memeMandat = NOVABOT_MANDATE_KEYS.every(k => JSON.stringify(current[k]) === JSON.stringify(next[k]));
      if (memeMandat) return res.status(400).json({ error: 'amendement_vide' });

      await sb(`novabot_mandates?id=eq.${encodeURIComponent(current.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_current: false }),
      });
      const [created] = await sb('novabot_mandates', {
        method: 'POST',
        body: JSON.stringify([{ user_id: user.id, account_id: account.id, is_current: true, ...next }]),
      });
      await sb('novabot_mandate_changes', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([{
          user_id: user.id, account_id: account.id, previous_mandate_id: current.id, new_mandate_id: created.id,
          source: 'chat', conversation_id: str(body.conversationId, 64) || null, kind: 'amendment',
          summary: str(body.summary, 300) || 'Modification du mandat depuis la conversation.',
        }]),
      });
      const versionRows = await sb(`novabot_mandates?account_id=eq.${encodeURIComponent(account.id)}&select=id`);
      return res.status(200).json({ applied: true, mandateId: created.id, version: versionRows.length });
    }

    if (body.action === 'restore_mandate_version') {
      if (!account) return res.status(409).json({ error: 'compte_inexistant' });
      const targetId = str(body.targetMandateId, 64);
      if (!targetId) return res.status(400).json({ error: 'version_invalide' });

      const [targetRows, currentRows] = await Promise.all([
        sb(`novabot_mandates?id=eq.${encodeURIComponent(targetId)}&account_id=eq.${encodeURIComponent(account.id)}&select=*`),
        sb(`novabot_mandates?account_id=eq.${encodeURIComponent(account.id)}&is_current=eq.true&select=*`),
      ]);
      const target = targetRows[0] || null;
      const current = currentRows[0] || null;
      if (!target) return res.status(404).json({ error: 'version_introuvable' });
      if (!current) return res.status(409).json({ error: 'mandat_inexistant' });

      if (target.id === current.id) {
        return res.status(200).json({ applied: true, unchanged: true, mandateId: current.id });
      }

      await sb(`novabot_mandates?id=eq.${encodeURIComponent(current.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_current: false }),
      });
      /* Restaurer crée une NOUVELLE ligne copiant les valeurs de la cible
         -- on ne rebascule JAMAIS l'ancienne ligne "target" en courante :
         l'historique n'est jamais réécrit, seulement prolongé (§ plan). */
      const restored = {};
      for (const k of NOVABOT_MANDATE_KEYS) restored[k] = target[k];
      const [created] = await sb('novabot_mandates', {
        method: 'POST',
        body: JSON.stringify([{ user_id: user.id, account_id: account.id, is_current: true, ...restored }]),
      });
      await sb('novabot_mandate_changes', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify([{
          user_id: user.id, account_id: account.id, previous_mandate_id: current.id, new_mandate_id: created.id,
          source: 'chat', conversation_id: str(body.conversationId, 64) || null, kind: 'restore',
          summary: 'Restauration d\'une version précédente du mandat.',
        }]),
      });
      const versionRows = await sb(`novabot_mandates?account_id=eq.${encodeURIComponent(account.id)}&select=id`);
      return res.status(200).json({ applied: true, mandateId: created.id, version: versionRows.length });
    }

    /* ---------- mandat : nouvelle version si différente de l'actuelle ---------- */
    if (body.mandate && typeof body.mandate === 'object') {
      if (!account) return res.status(409).json({ error: 'compte_inexistant' });
      const next = construireMandatDepuisEntree(body.mandate);
      const [currentRows] = await Promise.all([
        sb(`novabot_mandates?account_id=eq.${encodeURIComponent(account.id)}&is_current=eq.true&select=*`),
      ]);
      const current = currentRows[0] || null;
      const memeMandat = current && NOVABOT_MANDATE_KEYS.every(k =>
        JSON.stringify(current[k]) === JSON.stringify(next[k]));
      if (!memeMandat) {
        if (current) {
          await sb(`novabot_mandates?id=eq.${encodeURIComponent(current.id)}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_current: false }),
          });
        }
        await sb('novabot_mandates', {
          method: 'POST', headers: { Prefer: 'return=minimal' },
          body: JSON.stringify([{ user_id: user.id, account_id: account.id, is_current: true, ...next }]),
        });
      }
    }

    /* ---------- journal (transactions + snapshots), même mécanique que portfolio ---------- */
    const txIn = Array.isArray(body.transactions) ? body.transactions.slice(0, 20000) : [];
    const snapIn = Array.isArray(body.snapshots) ? body.snapshots.slice(0, 20000) : [];
    const decIn = Array.isArray(body.decisions) ? body.decisions.slice(0, 20000) : [];
    let transactionsSynced = 0, snapshotsSynced = 0, decisionsSynced = 0;

    if (txIn.length || snapIn.length || decIn.length) {
      if (!account) return res.status(409).json({ error: 'compte_inexistant' });

      const transactions = [];
      for (const tx of txIn) {
        const id = str(tx?.id, 64);
        const occurredAt = isoDate(tx?.date);
        const type = NOVABOT_TX_TYPES.includes(tx?.type) ? tx.type : null;
        const amountEUR = num(tx?.amountEUR);
        if (!id || !occurredAt || !type || amountEUR === null) continue;
        const isTitre = type === 'buy' || type === 'sell';
        if (isTitre) {
          const qty = num(tx?.qty);
          const priceLocal = num(tx?.priceLocal);
          const currency = str(tx?.currency, 8);
          const stockId = str(tx?.stockId, 40);
          if (qty === null || qty <= 0 || priceLocal === null || !currency || !stockId) continue;
          transactions.push({
            id, user_id: user.id, account_id: account.id, stock_id: stockId,
            ticker: str(tx?.ticker, 20) || stockId, name: str(tx?.name, 200) || stockId,
            type, qty, price_local: priceLocal, currency, amount_eur: amountEUR,
            realized_gain: num(tx?.realizedGain), decision_id: str(tx?.decisionId, 64) || null,
            reason: str(tx?.reason, 500) || null, occurred_at: occurredAt,
          });
        } else {
          transactions.push({
            id, user_id: user.id, account_id: account.id, stock_id: null, ticker: null,
            name: str(tx?.name, 200) || null, type, qty: null, price_local: null, currency: null,
            amount_eur: amountEUR, realized_gain: null, decision_id: null,
            reason: str(tx?.reason, 500) || null, occurred_at: occurredAt,
          });
        }
      }

      const snapshots = [];
      for (const s of snapIn) {
        const occurredAt = isoDate(s?.t);
        const totalValue = num(s?.totalValue), cash = num(s?.cash), investedValue = num(s?.investedValue);
        if (!occurredAt || totalValue === null || cash === null || investedValue === null) continue;
        snapshots.push({
          user_id: user.id, account_id: account.id, occurred_at: occurredAt, total_value: totalValue, cash,
          invested_value: investedValue, net_deposits: num(s?.netDeposits),
          unrealized_pnl: num(s?.unrealizedPnL), realized_pnl: num(s?.realizedPnL), reason: str(s?.reason, 20) || null,
        });
      }

      if (transactions.length) {
        await sb('novabot_transactions?on_conflict=id', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(transactions),
        });
        transactionsSynced = transactions.length;
      }
      if (snapshots.length) {
        await sb('novabot_portfolio_snapshots?on_conflict=account_id,occurred_at', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(snapshots),
        });
        snapshotsSynced = snapshots.length;
      }

      /* Décisions (§14/§31) : upsert idempotent par id, même mécanique que
         transactions/snapshots. jsonb (dataUsed/mandateSnapshot/riskResult/
         relevantNews/relevantEvent) acceptés tels quels — validés comme
         "objet ou tableau, jamais une chaîne arbitraire" seulement, leur
         contenu précis évolue au fil des tranches suivantes. */
      const NOVABOT_DECISION_ACTIONS = ['buy', 'sell', 'hold', 'increase', 'reduce', 'watch', 'reject'];
      const jsonOrNull = (v) => (v && typeof v === 'object') ? v : null;
      const decisions = [];
      for (const d of decIn) {
        const id = str(d?.id, 64);
        const occurredAt = isoDate(d?.occurredAt || d?.date);
        const action = NOVABOT_DECISION_ACTIONS.includes(d?.action) ? d.action : null;
        const reason = str(d?.reason, 2000);
        if (!id || !occurredAt || !action || !reason) continue;
        decisions.push({
          id, user_id: user.id, account_id: account.id, action,
          stock_id: str(d?.stockId, 40) || null, ticker: str(d?.ticker, 20) || null, name: str(d?.name, 200) || null,
          price_observed: num(d?.priceObserved), qty: num(d?.qty), amount_eur: num(d?.amountEUR),
          weight_before_pct: num(d?.weightBeforePct), weight_after_pct: num(d?.weightAfterPct),
          cash_before: num(d?.cashBefore), cash_after: num(d?.cashAfter), reason,
          data_used: jsonOrNull(d?.dataUsed), mandate_snapshot: jsonOrNull(d?.mandateSnapshot),
          risk_result: jsonOrNull(d?.riskResult), relevant_news: jsonOrNull(d?.relevantNews), relevant_event: jsonOrNull(d?.relevantEvent),
          ai_provider: str(d?.aiProvider, 20) || null, ai_model: str(d?.aiModel, 40) || null, confidence: num(d?.confidence),
          execution_status: ['simulated', 'skipped', 'rejected', 'pending'].includes(d?.executionStatus) ? d.executionStatus : 'simulated',
          occurred_at: occurredAt,
        });
      }
      if (decisions.length) {
        await sb('novabot_decisions?on_conflict=id', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(decisions),
        });
        decisionsSynced = decisions.length;
      }
    }

    return res.status(200).json({ saved: true, accountId: account?.id || null, transactionsSynced, snapshotsSynced, decisionsSynced });
  } catch (e) {
    console.error('[me] synchronisation novabot :', e.message);
    return res.status(503).json({ error: 'synchronisation_impossible' });
  }
}

/**
 * GET/POST /api/me?resource=conversations — Nova Core : conversations et
 * messages (§4, §8 du prompt maître NovaTitre). Voir
 * sql/2026-10-05_nova_core_conversations.sql pour le schéma (une seule
 * table de conversations partagée entre tous les modules Nova, pas une
 * par module — "une mémoire commune").
 *
 * GET  ?resource=conversations            — liste les conversations de
 *   l'utilisateur (triées par updated_at desc), sans leurs messages.
 * GET  ?resource=conversations&id=X        — une conversation + tous ses
 *   messages, dans l'ordre chronologique.
 * POST ?resource=conversations             — crée une conversation
 *   { module, title?, context? } -> { id }.
 * POST ?resource=conversations&id=X&action=message — ajoute un message à
 *   une conversation existante { role, content, metadata? }.
 *
 * Repliée dans ce fichier plutôt que api/nova/conversations.js (voir la
 * note au-dessus de l'appel ?resource=conversations plus haut) : limite
 * de 12 Fonctions Serverless du plan Vercel Hobby de ce projet.
 */
const CONV_ROLES = ['user', 'assistant', 'system'];
async function handleNovaConversations(req, res, user) {
  const id = typeof req.query?.id === 'string' ? req.query.id : null;

  if (req.method === 'GET') {
    try {
      if (id) {
        const convRows = await sb(
          `nova_conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=*`
        );
        if (!convRows.length) return res.status(404).json({ error: 'conversation_introuvable' });
        const msgRows = await sb(
          `nova_messages?conversation_id=eq.${encodeURIComponent(id)}&select=id,role,content,metadata,created_at&order=created_at.asc`
        );
        const c = convRows[0];
        return res.status(200).json({
          id: c.id, module: c.module, title: c.title, context: c.context, archived: Boolean(c.archived),
          createdAt: c.created_at, updatedAt: c.updated_at,
          messages: msgRows.map(m => ({ id: m.id, role: m.role, content: m.content, metadata: m.metadata, date: m.created_at })),
        });
      }
      /* ?archived=1 : liste les conversations ARCHIVÉES au lieu des actives
         (§2 : "archiver" doit rester consultable séparément, jamais une
         suppression déguisée) — deux listes distinctes plutôt qu'un seul
         appel mélangé, pour que le sidebar n'ait jamais à retrier côté
         client une liste de 200 lignes à chaque frappe de recherche. */
      const archivedFilter = req.query?.archived === '1' ? 'eq.true' : 'eq.false';
      const rows = await sb(
        `nova_conversations?user_id=eq.${encodeURIComponent(user.id)}&archived=${archivedFilter}`
        + `&select=id,module,title,context,archived,created_at,updated_at&order=updated_at.desc&limit=200`
      );
      return res.status(200).json({
        conversations: rows.map(c => ({
          id: c.id, module: c.module, title: c.title, context: c.context, archived: Boolean(c.archived),
          createdAt: c.created_at, updatedAt: c.updated_at,
        })),
      });
    } catch (e) {
      console.error('[me] lecture conversations :', e.message);
      /* detail (2026-10-09, retour utilisateur : "je veux que tu identifies
         la véritable cause, pas que tu masques l'erreur") : le message
         PostgREST (déjà tronqué à 120 caractères par sb()) ne contient
         aucun secret — ni clé, ni jeton, ni mot de passe, juste un code
         d'erreur SQL/schéma ("relation does not exist", etc.) — exposé ici
         pour un diagnostic immédiat sans avoir besoin des logs Vercel. */
      return res.status(503).json({ error: 'lecture_impossible', detail: String(e.message || '').slice(0, 160) });
    }
  }

  /* ---------- suppression (refonte expérience, 2026-10-08, §2 : "Supprimer
     une conversation après confirmation") : la confirmation elle-même est
     un geste CLIENT (boîte de dialogue avant l'appel) — ce endpoint
     exécute, il ne redemande jamais. Cascade sur nova_messages via la
     contrainte "on delete cascade" déjà posée dans le schéma (sql/2026-
     10-05_nova_core_conversations.sql), aucune suppression manuelle des
     messages nécessaire ici. */
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id_requis' });
    try {
      await sb(`nova_conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'DELETE', headers: { Prefer: 'return=minimal' },
      });
      return res.status(200).json({ deleted: true });
    } catch (e) {
      console.error('[me] suppression conversation :', e.message);
      return res.status(503).json({ error: 'suppression_impossible' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const body = req.body || {};
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  /* ---------- renommer (§2 : "Renommer une conversation") ---------- */
  if (id && body.action === 'rename') {
    const titre = str(body.title, 200);
    if (!titre) return res.status(400).json({ error: 'titre_requis' });
    try {
      const updated = await sb(`nova_conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ title: titre }),
      });
      if (!updated.length) return res.status(404).json({ error: 'conversation_introuvable' });
      return res.status(200).json({ id, title: titre });
    } catch (e) {
      console.error('[me] renommage conversation :', e.message);
      return res.status(503).json({ error: 'ecriture_impossible' });
    }
  }

  /* ---------- archiver / désarchiver (§2 : "archiver les conversations")
     ---------- toggle réversible, jamais une confirmation requise (contraste
     volontaire avec la suppression, destructive et irréversible, qui en a
     une côté client) — archiver retire simplement la conversation de la
     liste active sans jamais effacer ses messages. */
  if (id && (body.action === 'archive' || body.action === 'unarchive')) {
    const archived = body.action === 'archive';
    try {
      const updated = await sb(`nova_conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ archived }),
      });
      if (!updated.length) return res.status(404).json({ error: 'conversation_introuvable' });
      return res.status(200).json({ id, archived });
    } catch (e) {
      console.error('[me] archivage conversation :', e.message);
      return res.status(503).json({ error: 'ecriture_impossible' });
    }
  }

  /* ---------- tronquer à partir d'un message (V6 §5 : "modifier un
     message", "reprendre la conversation à partir de ce message")
     ---------- supprime le message fromMessageId ET tous les messages
     plus récents dans la MÊME conversation, inclusivement. Primitive
     UNIQUE réutilisée pour les deux usages côté client :
       - "reprendre depuis ce message" : fromMessageId = message SUIVANT
         celui qu'on garde (tout après reste, celui-ci et la suite partent) ;
       - "modifier ce message" : fromMessageId = le message édité lui-même
         (il part avec tout ce qui suit, remplacé par la version éditée).
     Sans ceci, une modification locale seule aurait réapparu au prochain
     chargement de la conversation (novabotConversationOuvrir() relit
     toujours l'historique complet depuis le serveur). */
  if (id && body.action === 'truncate_from') {
    const fromMessageId = typeof body.fromMessageId === 'string' ? body.fromMessageId : null;
    if (!fromMessageId) return res.status(400).json({ error: 'fromMessageId_requis' });
    try {
      const convRows = await sb(
        `nova_conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id`
      );
      if (!convRows.length) return res.status(404).json({ error: 'conversation_introuvable' });
      const refRows = await sb(
        `nova_messages?id=eq.${encodeURIComponent(fromMessageId)}&conversation_id=eq.${encodeURIComponent(id)}&select=created_at`
      );
      if (!refRows.length) return res.status(404).json({ error: 'message_introuvable' });
      await sb(
        `nova_messages?conversation_id=eq.${encodeURIComponent(id)}&created_at=gte.${encodeURIComponent(refRows[0].created_at)}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
      );
      return res.status(200).json({ truncated: true });
    } catch (e) {
      console.error('[me] troncature conversation :', e.message);
      return res.status(503).json({ error: 'ecriture_impossible' });
    }
  }

  /* ---------- avis (pouce haut/bas) sur un message ----------
     CORRECTIF (audit 2026-10-13, "fonctionnalités pas abouties") :
     novabotMessageFeedback() (js/novabot-chat.js) ne modifiait QUE
     NOVABOT_CHAT.messages en mémoire — le bouton semblait fonctionner
     (bascule visuelle immédiate) mais l'avis n'était jamais persisté :
     un rechargement de page ou une réouverture de la conversation le
     faisait disparaître sans aucune trace. Même mécanisme que
     truncate_from ci-dessus (id = conversation, messageId dans le
     corps) — PATCH metadata.feedback ('up'|'down'|null), jamais une
     nouvelle table pour un seul champ. */
  if (id && body.action === 'feedback') {
    const messageId = typeof body.messageId === 'string' ? body.messageId : null;
    const valeur = ['up', 'down', null].includes(body.feedback) ? body.feedback : undefined;
    if (!messageId || valeur === undefined) return res.status(400).json({ error: 'feedback_invalide' });
    try {
      const msgRows = await sb(
        `nova_messages?id=eq.${encodeURIComponent(messageId)}&conversation_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,metadata`
      );
      if (!msgRows.length) return res.status(404).json({ error: 'message_introuvable' });
      const metadata = { ...(msgRows[0].metadata || {}), feedback: valeur };
      await sb(`nova_messages?id=eq.${encodeURIComponent(messageId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ metadata }),
      });
      return res.status(200).json({ id: messageId, feedback: valeur });
    } catch (e) {
      console.error('[me] avis sur message :', e.message);
      return res.status(503).json({ error: 'ecriture_impossible' });
    }
  }

  /* ---------- ajout d'un message à une conversation existante ---------- */
  if (id && body.action === 'message') {
    const role = CONV_ROLES.includes(body.role) ? body.role : null;
    const content = str(body.content, 20000);
    if (!role || !content) return res.status(400).json({ error: 'message_invalide' });
    try {
      const convRows = await sb(
        `nova_conversations?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id`
      );
      if (!convRows.length) return res.status(404).json({ error: 'conversation_introuvable' });

      const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? body.metadata : null;
      const [msg] = await sb('nova_messages', {
        method: 'POST',
        body: JSON.stringify([{ conversation_id: id, user_id: user.id, role, content, metadata }]),
      });
      await sb(`nova_conversations?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ id: msg.id, date: msg.created_at });
    } catch (e) {
      console.error('[me] ajout message :', e.message);
      return res.status(503).json({ error: 'ecriture_impossible', detail: String(e.message || '').slice(0, 160) });
    }
  }

  /* ---------- création d'une conversation ---------- */
  const moduleId = str(body.module, 40);
  if (!moduleId) return res.status(400).json({ error: 'module_requis' });
  const title = str(body.title, 200) || null;
  const context = body.context && typeof body.context === 'object' && !Array.isArray(body.context)
    ? body.context : null;

  try {
    const [conv] = await sb('nova_conversations', {
      method: 'POST',
      body: JSON.stringify([{ user_id: user.id, module: moduleId, title, context }]),
    });
    return res.status(200).json({ id: conv.id, createdAt: conv.created_at, updatedAt: conv.updated_at });
  } catch (e) {
    console.error('[me] création conversation :', e.message);
    return res.status(503).json({ error: 'ecriture_impossible', detail: String(e.message || '').slice(0, 160) });
  }
}

/* ---------- Alpaca Broker API Sandbox, admin ----------
   §2 de la mission "Alpaca Sandbox Trading" : page de test de connexion
   + liaison du compte Sandbox à l'utilisateur réellement connecté.
   Double porte : TRADING_ENABLED puis TRADING_ADMIN_EMAILS — même
   logique que les anciens fichiers séparés, fusionnée ici pour rester
   sous la limite de 12 fonctions serverless (plan Hobby). */
async function handleAlpacaAdmin(req, res, user) {
  const {
    tradingActif,
    estAdmin,
    regionConfiguree,
    appelBroker,
  } = require('./_alpaca/client.js');
  const { recupererCompte, lireCompteTrading } = require('./_alpaca/accounts.js');
  const { resumePortefeuille } = require('./_alpaca/portfolio.js');

  if (!tradingActif()) {
    return res.status(200).json({ status: 'disabled' });
  }
  if (!estAdmin(user.email)) {
    return res.status(403).json({ error: 'acces_refuse' });
  }

  /* Résout le compte Alpaca de l'utilisateur authentifié — jamais un id
     fourni par le client, toujours retrouvé via SON PROPRE user_id
     (§1/§6 : "association persistante et sécurisée", "étanchéité entre
     les comptes utilisateurs"). null si aucun compte lié. */
  async function compteAlpacaDeUtilisateur() {
    const lignes = await sb(`broker_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=alpaca_account_id&limit=1`);
    return lignes.length ? lignes[0].alpaca_account_id : null;
  }

  const action = req.query?.action;

  if (action === 'status') {
    const debut = Date.now();
    try {
      const r = await appelBroker('/v1/clock');
      const latencyMs = Date.now() - debut;
      if (!r.ok) {
        return res.status(200).json({ status: 'error', region: regionConfiguree(), env: 'sandbox', latencyMs, httpStatus: r.status });
      }
      await r.json();
      return res.status(200).json({ status: 'connected', region: regionConfiguree(), env: 'sandbox', latencyMs, permissionsVerified: ['read:clock'] });
    } catch (e) {
      return res.status(200).json({ status: 'error', region: regionConfiguree(), env: 'sandbox', message: e.code || 'erreur_inconnue' });
    }
  }

  if (action === 'account') {
    try {
      const lignes = await sb(`broker_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=alpaca_account_id,account_number,status&limit=1`);
      if (!lignes.length) return res.status(200).json({ status: 'not_linked' });

      const { alpaca_account_id } = lignes[0];
      const [compte, trading] = await Promise.all([
        recupererCompte(alpaca_account_id),
        lireCompteTrading(alpaca_account_id).catch(() => null),
      ]);
      return res.status(200).json({
        status: 'linked',
        accountNumber: compte.account_number,
        accountStatus: compte.status,
        buyingPower: trading ? trading.buying_power : null,
        cash: trading ? trading.cash : null,
        portfolioValue: trading ? trading.portfolio_value : null,
        currency: compte.currency,
      });
    } catch (e) {
      return res.status(200).json({ status: 'error', message: e.message });
    }
  }

  /* §7 : "résumé en lecture seule du portefeuille Sandbox préparé par
     le serveur" — lecture par l'utilisateur de SES PROPRES données,
     toujours autorisée (distinct de l'interrupteur "partager avec Nova
     AI" côté paramètres, qui ne concerne que l'injection dans un prompt
     IA — pas encore câblée, voir le commentaire de resumePortefeuille()). */
  if (action === 'portfolio-summary') {
    try {
      const lignes = await sb(`broker_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=alpaca_account_id&limit=1`);
      if (!lignes.length) return res.status(200).json({ status: 'not_linked' });
      const resume = await resumePortefeuille(lignes[0].alpaca_account_id);
      return res.status(200).json({ status: 'ok', ...resume });
    } catch (e) {
      return res.status(200).json({ status: 'error', message: e.message });
    }
  }

  /* §4 : "parcours d'ouverture avec suivi d'étapes et statut réel" —
     ouverture RÉELLE avec les données saisies par l'utilisateur
     (jamais plus l'identité de test fixe). Un seul compte par
     utilisateur : refuse si broker_accounts a déjà une ligne pour lui. */
  if (action === 'open-account' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    try {
      const existant = await sb(`broker_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
      if (existant.length) {
        return res.status(200).json({ status: 'error', message: 'compte_deja_existant' });
      }

      /* IP RÉELLE de la requête (x-forwarded-for, posée par Vercel) —
         jamais une valeur inventée, voir accordsSandbox() dans
         accounts.js qui l'exige pour les agreements. */
      const ipReelle = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        || req.socket?.remoteAddress || '0.0.0.0';

      /* Région EU (2026-10-16) : formulaire résident français (FRA_SPI,
         EUR, W-8BEN) — voir api/_alpaca/eu.js. Région US : inchangé. */
      const compte = regionConfiguree() === 'eu'
        ? await require('./_alpaca/eu.js').creerCompteEU(body, ipReelle)
        : await require('./_alpaca/accounts.js').creerCompteDepuisFormulaire(body, ipReelle);

      await sb('broker_accounts?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify([{
          user_id: user.id,
          alpaca_account_id: compte.id,
          account_number: compte.account_number,
          region: regionConfiguree(),
          env: 'sandbox',
          status: compte.status,
          updated_at: new Date().toISOString(),
        }]),
      });

      return res.status(200).json({ status: 'opened', accountNumber: compte.account_number, accountStatus: compte.status });
    } catch (e) {
      if (e.erreurs) return res.status(200).json({ status: 'validation_error', erreurs: e.erreurs });
      return res.status(200).json({ status: 'error', message: e.message, alpacaStatus: e.status, alpacaBody: e.body });
    }
  }

  if (action === 'link' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { alpacaAccountId } = body;
    if (!alpacaAccountId) return res.status(400).json({ error: 'alpaca_account_id_requis' });

    try {
      const compte = await recupererCompte(alpacaAccountId);
      await sb('broker_accounts?on_conflict=user_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify([{
          user_id: user.id,
          alpaca_account_id: compte.id,
          account_number: compte.account_number,
          region: regionConfiguree(),
          env: 'sandbox',
          status: compte.status,
          updated_at: new Date().toISOString(),
        }]),
      });
      return res.status(200).json({ status: 'linked', alpacaAccountId: compte.id, accountNumber: compte.account_number, accountStatus: compte.status });
    } catch (e) {
      return res.status(200).json({ status: 'error', message: e.message });
    }
  }

  /* "Ajouter des fonds fictifs" — mission de finalisation 2026-10-15.
     Ne bloque jamais la requête en attendant le règlement réel (observé
     jusqu'à ~7 minutes) : renvoie un statut d'attente explicite, le
     client réinterroge le portefeuille plus tard (déjà en place,
     assurerPortefeuilleAlpacaReel()). */
  if (action === 'deposit' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const montant = Number(body.amount);
    if (!(montant > 0)) return res.status(400).json({ error: 'montant_invalide' });

    try {
      const accountId = await compteAlpacaDeUtilisateur();
      if (!accountId) return res.status(200).json({ status: 'not_linked' });

      let resultat;
      if (regionConfiguree() === 'eu') {
        /* EU : pas d'ACH — virement EUR entrant simulé (Sandbox
           uniquement), référencé "<correspondant>-<numéro de compte>". */
        const lignes = await sb(`broker_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=account_number&limit=1`);
        const { simulerVirementEntrantEU } = require('./_alpaca/eu.js');
        const virement = await simulerVirementEntrantEU(process.env.ALPACA_CORRESPONDENT_ID, lignes[0]?.account_number, montant);
        resultat = { statut: 'depot_soumis', transferStatus: virement.status, transferId: virement.id };
      } else {
        const { assurerDepotSimule } = require('./_alpaca/funding.js');
        resultat = await assurerDepotSimule(accountId, user.email, montant);
      }

      await sb('broker_sync_events', {
        method: 'POST',
        body: JSON.stringify([{ user_id: user.id, kind: 'deposit_' + resultat.statut, detail: resultat }]),
      }).catch(() => {});

      return res.status(200).json(resultat);
    } catch (e) {
      return res.status(200).json({ status: 'error', message: e.message, alpacaBody: e.body });
    }
  }

  /* Instructions de virement EU (2026-10-16) — lecture seule : IBAN
     Omnibus d'Alpaca + référence propre au compte de l'utilisateur. IBAN
     null tant que le partenariat n'est pas signé (jamais inventé). */
  if (action === 'funding-instructions') {
    if (regionConfiguree() !== 'eu') return res.status(200).json({ status: 'non_applicable' });
    try {
      const lignes = await sb(`broker_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=account_number&limit=1`);
      if (!lignes.length) return res.status(200).json({ status: 'not_linked' });
      const { instructionsDepot } = require('./_alpaca/eu.js');
      return res.status(200).json({ status: 'ok', ...instructionsDepot(process.env.ALPACA_CORRESPONDENT_ID, lignes[0].account_number) });
    } catch (e) {
      return res.status(200).json({ status: 'error', message: e.message });
    }
  }

  /* Historique des ordres — toujours relu directement chez Alpaca
     (source de vérité, §5.1), jamais depuis broker_orders seul. */
  if (action === 'orders') {
    try {
      const accountId = await compteAlpacaDeUtilisateur();
      if (!accountId) return res.status(200).json({ status: 'not_linked' });

      const r = await appelBroker(`/v1/trading/accounts/${encodeURIComponent(accountId)}/orders?status=all&limit=25&direction=desc`);
      const ordres = await r.json().catch(() => null);
      if (!r.ok) return res.status(200).json({ status: 'error', message: 'alpaca_lecture_historique_echouee' });

      return res.status(200).json({
        status: 'ok',
        orders: (ordres || []).map(o => ({
          id: o.id, symbol: o.symbol, side: o.side, status: o.status,
          qty: o.qty, filledQty: o.filled_qty, filledAvgPrice: o.filled_avg_price,
          submittedAt: o.submitted_at, canceledAt: o.canceled_at,
        })),
      });
    } catch (e) {
      return res.status(200).json({ status: 'error', message: e.message });
    }
  }

  /* Achat/vente réel — §5.2 : contrôles serveur avant envoi, idempotence
     via client_order_id, jamais un résultat inventé. */
  if (action === 'order-create' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    try {
      const accountId = await compteAlpacaDeUtilisateur();
      if (!accountId) return res.status(200).json({ status: 'not_linked' });

      const { creerOrdre } = require('./_alpaca/orders.js');
      const params = {
        symbol: String(body.symbol || '').toUpperCase().trim(),
        side: body.side,
        ...(body.notional !== undefined ? { notional: body.notional } : { qty: body.qty }),
      };
      const ordre = await creerOrdre(accountId, params);

      await sb('broker_orders', {
        method: 'POST',
        body: JSON.stringify([{
          user_id: user.id,
          broker_account_id: (await sb(`broker_accounts?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`))[0]?.id,
          client_order_id: ordre.client_order_id,
          alpaca_order_id: ordre.id,
          symbol: ordre.symbol, side: ordre.side,
          qty: ordre.qty || null, notional: ordre.notional || null,
          order_type: ordre.type, status: ordre.status,
          filled_qty: ordre.filled_qty || null, filled_avg_price: ordre.filled_avg_price || null,
        }]),
      }).catch(() => {});

      return res.status(200).json({ status: 'submitted', order: { id: ordre.id, symbol: ordre.symbol, side: ordre.side, status: ordre.status } });
    } catch (e) {
      if (e.erreurs) return res.status(200).json({ status: 'validation_error', erreurs: e.erreurs });
      return res.status(200).json({ status: 'error', message: e.message, alpacaStatus: e.status, alpacaBody: e.body });
    }
  }

  /* ---------- NovaBot sur le compte réel (2026-10-21) ----------
     Propositions motivées (achats, ventes, "veux-tu tout vendre ?")
     calculées par api/_alpaca/novabot-moteur.js à partir des données
     RÉELLES du compte et du marché. Aucun ordre sans confirmation : chaque
     exécution recalcule les propositions à l'instant et refuse un ordre qui
     n'est plus proposé. Mêmes portes que le reste de cette section
     (TRADING_ENABLED + administrateurs) et verrou production des ordres. */
  async function donneesNovaBot(accountId, profil) {
    const moteur = require('./_alpaca/novabot-moteur.js');
    const { lirePositions } = require('./_alpaca/portfolio.js');
    const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const [compteBrut, positionsBrutes] = await Promise.all([lireCompteTrading(accountId), lirePositions(accountId)]);
    const infoUnivers = new Map(moteur.UNIVERS_ACHAT.map(u => [u.symbol, u]));
    const positions = (positionsBrutes || []).map(p => ({
      symbol: p.symbol, qty: Number(p.qty), marketValue: Number(p.market_value),
      unrealizedPlPc: Number(p.unrealized_plpc), currentPrice: Number(p.current_price),
      name: infoUnivers.get(p.symbol)?.name || p.symbol, sector: infoUnivers.get(p.symbol)?.sector || null,
    }));
    const dossier = async (symbol, exchange, type = 'stock') => {
      try {
        const r = await fetch(`${base}/api/market/company?ticker=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange || '')}&type=${type}`);
        const d = r.ok ? await r.json() : null;
        return d ? { prix: Number(d.market?.price), variationPct: Number(d.market?.changePercent),
          score: Number.isFinite(d.novaScore?.score) ? d.novaScore.score : null,
          volatility: Number.isFinite(d.novaScore?.volatility) ? d.novaScore.volatility : null } : null;
      } catch { return null; }
    };
    const symbolesDetenus = positions.map(p => p.symbol).filter(s => !infoUnivers.has(s));
    const [univers, detenus, spy] = await Promise.all([
      Promise.all(moteur.UNIVERS_ACHAT.map(async u => ({ ...u, ...(await dossier(u.symbol, u.exchange)) }))),
      Promise.all(symbolesDetenus.map(async s => ({ symbol: s, ...(await dossier(s, '')) }))),
      dossier('SPY', '', 'etf'),
    ]);
    const scores = Object.fromEntries([...univers, ...detenus].filter(d => Number.isFinite(d.score)).map(d => [d.symbol, d.score]));
    return moteur.propositionsNovaBot({
      compte: { cash: Number(compteBrut.cash), equity: Number(compteBrut.equity), lastEquity: Number(compteBrut.last_equity), positions },
      marche: { indiceVariationPct: spy && Number.isFinite(spy.variationPct) ? spy.variationPct : null },
      profil, candidats: univers.filter(u => Number.isFinite(u.prix) && u.prix > 0), scores,
    });
  }
  /* Profil envoyé par le navigateur (mémoire NovaBot) : seuls les champs
     connus et bien formés sont gardés. */
  function profilNettoye(p) {
    const out = {};
    if (['low', 'moderate', 'high'].includes(p?.riskLevel)) out.riskLevel = p.riskLevel;
    if (Number.isFinite(p?.budgetEUR) && p.budgetEUR > 0) out.budgetEUR = p.budgetEUR;
    if (Array.isArray(p?.hardRules)) out.hardRules = p.hardRules
      .filter(r => r && ['excluded_sector', 'excluded_asset'].includes(r.type) && typeof r.value === 'string')
      .slice(0, 20).map(r => ({ type: r.type, value: r.value.slice(0, 60) }));
    return out;
  }

  if (action === 'novabot-propositions' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    try {
      const accountId = await compteAlpacaDeUtilisateur();
      if (!accountId) return res.status(200).json({ status: 'not_linked' });
      return res.status(200).json({ status: 'ok', ...(await donneesNovaBot(accountId, profilNettoye(body.profil))) });
    } catch (e) {
      return res.status(200).json({ status: 'error', message: e.message });
    }
  }

  if (action === 'novabot-executer' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.confirme !== true) return res.status(400).json({ error: 'confirmation_requise' });
    try {
      const accountId = await compteAlpacaDeUtilisateur();
      if (!accountId) return res.status(200).json({ status: 'not_linked' });
      const moteur = require('./_alpaca/novabot-moteur.js');
      const courantes = await donneesNovaBot(accountId, profilNettoye(body.profil));
      const p = moteur.propositionToujoursValable(courantes, { type: body.type, symbol: String(body.symbol || '') });
      if (!p) return res.status(200).json({ status: 'plus_valable', message: "Cette proposition n'est plus d'actualité avec les cours du moment." });
      const { creerOrdre } = require('./_alpaca/orders.js');
      const ordre = await creerOrdre(accountId, p.type === 'achat'
        ? { symbol: p.symbol, side: 'buy', notional: p.notional }
        : { symbol: p.symbol, side: 'sell', qty: p.qty });
      await sb('broker_sync_events', { method: 'POST',
        body: JSON.stringify([{ user_id: user.id, kind: 'novabot_' + p.type, detail: { symbol: p.symbol, raisons: p.raisons, orderId: ordre.id } }]),
      }).catch(() => {});
      return res.status(200).json({ status: 'submitted', order: { id: ordre.id, symbol: ordre.symbol, side: ordre.side, status: ordre.status } });
    } catch (e) {
      if (e.erreurs) return res.status(200).json({ status: 'validation_error', erreurs: e.erreurs });
      return res.status(200).json({ status: 'error', message: e.message, alpacaBody: e.body });
    }
  }

  if (action === 'novabot-tout-vendre' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (body.confirmation !== 'TOUT_VENDRE') return res.status(400).json({ error: 'confirmation_requise' });
    try {
      const accountId = await compteAlpacaDeUtilisateur();
      if (!accountId) return res.status(200).json({ status: 'not_linked' });
      const { fermerToutesPositions } = require('./_alpaca/orders.js');
      const resultats = await fermerToutesPositions(accountId);
      await sb('broker_sync_events', { method: 'POST',
        body: JSON.stringify([{ user_id: user.id, kind: 'novabot_tout_vendre', detail: { positions: resultats.length } }]),
      }).catch(() => {});
      return res.status(200).json({ status: 'submitted', positions: resultats.length });
    } catch (e) {
      return res.status(200).json({ status: 'error', message: e.message, alpacaBody: e.body });
    }
  }

  if (action === 'order-cancel' && req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!body.orderId) return res.status(400).json({ error: 'order_id_requis' });

    try {
      const accountId = await compteAlpacaDeUtilisateur();
      if (!accountId) return res.status(200).json({ status: 'not_linked' });

      const { annulerOrdre } = require('./_alpaca/orders.js');
      await annulerOrdre(accountId, body.orderId);

      await sb(`broker_orders?alpaca_order_id=eq.${encodeURIComponent(body.orderId)}&user_id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending_cancel', updated_at: new Date().toISOString() }),
      }).catch(() => {});

      return res.status(200).json({ status: 'cancel_requested' });
    } catch (e) {
      if (e.message === 'alpaca_ordre_non_annulable') {
        return res.status(200).json({ status: 'not_cancelable', alpacaBody: e.body });
      }
      return res.status(200).json({ status: 'error', message: e.message });
    }
  }

  return res.status(400).json({ error: 'action_inconnue' });
}

module.exports.userFromToken =
  userFromToken;

module.exports.sb =
  sb;

module.exports.LIMITS =
  LIMITS;
