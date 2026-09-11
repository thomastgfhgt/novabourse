/**
 * GET /api/me — profil et plan de l'utilisateur connecté.
 * POST /api/me — enregistrement du parcours utilisateur.
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

module.exports.userFromToken =
  userFromToken;

module.exports.sb =
  sb;

module.exports.LIMITS =
  LIMITS;
