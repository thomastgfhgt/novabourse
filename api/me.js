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
const NOVABOT_CLIENT_STATUSES = ['setup', 'active', 'paused'];
const NOVABOT_AUTONOMY_MODES = ['advice', 'semi_auto', 'auto'];
const NOVABOT_TX_TYPES = ['buy', 'sell', 'deposit', 'withdraw', 'fee'];
const NOVABOT_MANDATE_KEYS = ['objective', 'horizon_years', 'risk_level', 'max_drawdown_pct', 'cash_min_pct',
  'max_position_pct', 'max_positions_count', 'preferences', 'hard_rules', 'allowed_regions', 'currencies',
  'benchmark', 'notes'];

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
        mandate: current && {
          id: current.id,
          objective: current.objective,
          horizonYears: current.horizon_years,
          riskLevel: current.risk_level,
          maxDrawdownPct: current.max_drawdown_pct,
          cashMinPct: current.cash_min_pct,
          maxPositionPct: current.max_position_pct,
          maxPositionsCount: current.max_positions_count,
          preferences: current.preferences,
          hardRules: current.hard_rules,
          allowedRegions: current.allowed_regions,
          currencies: current.currencies,
          benchmark: current.benchmark,
          notes: current.notes,
          createdAt: current.created_at,
        },
        mandateHistory: mandateRows.map(m => ({ id: m.id, isCurrent: m.is_current, createdAt: m.created_at })),
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

    /* ---------- mandat : nouvelle version si différente de l'actuelle ---------- */
    if (body.mandate && typeof body.mandate === 'object') {
      if (!account) return res.status(409).json({ error: 'compte_inexistant' });
      const m = body.mandate;
      const next = {
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
      };
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
          id: c.id, module: c.module, title: c.title, context: c.context,
          createdAt: c.created_at, updatedAt: c.updated_at,
          messages: msgRows.map(m => ({ id: m.id, role: m.role, content: m.content, metadata: m.metadata, date: m.created_at })),
        });
      }
      const rows = await sb(
        `nova_conversations?user_id=eq.${encodeURIComponent(user.id)}&select=id,module,title,context,created_at,updated_at&order=updated_at.desc&limit=200`
      );
      return res.status(200).json({
        conversations: rows.map(c => ({
          id: c.id, module: c.module, title: c.title, context: c.context,
          createdAt: c.created_at, updatedAt: c.updated_at,
        })),
      });
    } catch (e) {
      console.error('[me] lecture conversations :', e.message);
      return res.status(503).json({ error: 'lecture_impossible' });
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
      return res.status(503).json({ error: 'ecriture_impossible' });
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
    return res.status(503).json({ error: 'ecriture_impossible' });
  }
}

module.exports.userFromToken =
  userFromToken;

module.exports.sb =
  sb;

module.exports.LIMITS =
  LIMITS;
