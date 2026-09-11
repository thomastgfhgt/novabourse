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

const { PLAN_LIMITS, planReel, consommation, quotaBlock } = require('./_limits.js');

/* Limites d'interface. Les quotas d'analyse viennent de _limits.js : une seule
   source, donc /api/me et /api/analyze ne peuvent pas diverger. */
const LIMITS = {
  free:  { watchlist: 10,       alerts: 3,        compare: 2 },
  pro:   { watchlist: Infinity, alerts: Infinity, compare: 3 },
  elite: { watchlist: Infinity, alerts: Infinity, compare: 5 },
};

const METHODES = ['GET', 'POST'];

module.exports = async (req, res) => {
  // Seules GET et POST sont prévues : PUT, PATCH et DELETE tombaient
  // silencieusement dans le comportement GET.
  if (!METHODES.includes(req.method)){
    res.setHeader('Allow', METHODES.join(', '));
    return res.status(405).json({ error: 'methode_non_autorisee' });
  }

  const user = await userFromToken(req);
  if (!user) return res.status(401).json({ error: 'non_connecte' });

  /* POST /api/me — enregistre le parcours d'accueil ou une modification
     ultérieure depuis les réglages. Ne touche ni au plan ni à l'abonnement. */
  if (req.method === 'POST'){
    const b = req.body || {};
    const patch = { updated_at: new Date().toISOString() };
    if (typeof b.level === 'string')  patch.investor_level = b.level.slice(0, 40);
    if (typeof b.goal === 'string')   patch.investor_goal  = b.goal.slice(0, 40);
    if (Array.isArray(b.interests))   patch.interests      = b.interests.slice(0, 5).map(x => String(x).slice(0, 40));
    if (Number.isFinite(b.startCapital)) patch.start_capital = Math.max(0, Math.min(1e9, b.startCapital));
    if (b.completed === true)         patch.onboarded_at   = new Date().toISOString();
    try {
      await sb(`profiles?id=eq.${user.id}`, { method:'PATCH',
        headers:{ Prefer:'return=minimal' }, body: JSON.stringify(patch) });
    } catch (e){
      console.error('[me] enregistrement du parcours :', e.message);
      return res.status(503).json({ error: 'enregistrement_impossible' });
    }
    return res.status(200).json({ saved: true });
  }

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
      authenticated: true, ...quotaBlock('free', 0), planLabel:'Découverte',
      limits: LIMITS.free, email: user.email, degraded: 'base_indisponible',
    });
  }

  const { plan } = await planReel(sb, user.id);
  const utilise = await consommation(sb, user.id);
  const quota = quotaBlock(plan, utilise);

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ...quota,                       // plan, used, limit, remaining, periodStart, periodEnd
    planLabel: PLAN_LIMITS[plan].label,
    /* Le parcours d'accueil appartient au compte, pas au navigateur : il ne
       se déclenche qu'à la première connexion, jamais aux suivantes. */
    onboarded: Boolean(profile.onboarded_at),
    onboardedAt: profile.onboarded_at || null,
    profileSetup: {
      level: profile.investor_level || null,
      goal: profile.investor_goal || null,
      interests: profile.interests || null,
      startCapital: profile.start_capital ?? null,
    },
    authenticated: true,
    email: profile.email || user.email,
    name: profile.full_name || user.user_metadata?.full_name || null,
    avatar: profile.avatar_url || null,
    status: profile.subscription_status || null,
    /* La fin de période du QUOTA (mois calendaire UTC) vient de quotaBlock
       et ne doit pas être écrasée : la fin de période STRIPE est une autre
       notion, et porte donc un autre nom. */
    subscriptionPeriodEnd: profile.subscription_current_period_end || null,
    limits: LIMITS[plan],
  });
};
module.exports.userFromToken = userFromToken;
module.exports.sb = sb;
module.exports.LIMITS = LIMITS;
