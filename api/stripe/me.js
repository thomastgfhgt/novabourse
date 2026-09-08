/**
 * GET /api/me — profil et plan de l'utilisateur connecté.
 * Le plan est lu EN BASE, jamais transmis par le navigateur.
 */
const SB = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function userFromToken(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token || !SB) return null;
  const r = await fetch(`${SB}/auth/v1/user`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  return r.ok ? r.json() : null;
}

async function sb(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json', Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 120)}`);
  return r.json();
}

const LIMITS = {
  free:  { watchlist: 10,       alerts: 3,        analyses: 5,   compare: 2 },
  pro:   { watchlist: Infinity, alerts: Infinity, analyses: 200, compare: 3 },
  elite: { watchlist: Infinity, alerts: Infinity, analyses: 800, compare: 5 },
};

module.exports = async (req, res) => {
  const user = await userFromToken(req);
  if (!user) return res.status(401).json({ error: 'non_connecte' });

  let profile = null;
  try {
    const rows = await sb(`profiles?id=eq.${user.id}&select=*`);
    profile = rows[0] || null;
    if (!profile) {
      // Première connexion : on crée le profil avec le plan gratuit.
      const created = await sb('profiles', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify([{
          id: user.id, email: user.email,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          plan: 'free',
        }]),
      });
      profile = created[0];
    }
  } catch (e) {
    console.error('[me]', e.message);
    return res.status(200).json({
      authenticated: true, plan: 'free', limits: LIMITS.free,
      email: user.email, degraded: 'base_indisponible',
    });
  }

  // Un abonnement expiré retombe sur le plan gratuit.
  const actif = ['active', 'trialing', 'past_due'].includes(profile.subscription_status)
    && (!profile.subscription_current_period_end
        || new Date(profile.subscription_current_period_end) > new Date());
  const plan = actif ? (profile.plan || 'free') : 'free';

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    authenticated: true,
    email: profile.email || user.email,
    name: profile.full_name || user.user_metadata?.full_name || null,
    avatar: profile.avatar_url || null,
    plan,
    status: profile.subscription_status || null,
    periodEnd: profile.subscription_current_period_end || null,
    limits: LIMITS[plan],
  });
};
module.exports.userFromToken = userFromToken;
module.exports.sb = sb;
module.exports.LIMITS = LIMITS;
