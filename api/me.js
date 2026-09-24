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

  const transactions = [];
  for (const tx of txIn) {
    const id = str(tx?.id, 64);
    const occurredAt = isoDate(tx?.date);
    const type = tx?.type === 'buy' || tx?.type === 'sell' ? tx.type : null;
    const qty = num(tx?.qty);
    const priceLocal = num(tx?.priceLocal);
    const amountEUR = num(tx?.amountEUR);
    const currency = str(tx?.currency, 8);
    const stockId = str(tx?.stockId, 40);
    if (!id || !occurredAt || !type || qty === null || qty <= 0 || priceLocal === null || amountEUR === null || !currency || !stockId) {
      continue;
    }
    transactions.push({
      id,
      user_id: user.id,
      stock_id: stockId,
      ticker: str(tx?.ticker, 20) || stockId,
      name: str(tx?.name, 200) || stockId,
      type,
      qty,
      price_local: priceLocal,
      currency,
      amount_eur: amountEUR,
      realized_gain: num(tx?.realizedGain),
      thesis_reason: str(tx?.thesisReason, 500) || null,
      thesis_horizon: str(tx?.thesisHorizon, 40) || null,
      occurred_at: occurredAt,
    });
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

module.exports.userFromToken =
  userFromToken;

module.exports.sb =
  sb;

module.exports.LIMITS =
  LIMITS;
