// Tests (npm test) sans réseau réel : verrou Stripe, config, /api/me.
const dir = require('path').resolve(__dirname, '..', '..');
process.env.SUPABASE_URL = 'https://faux.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon-publique';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.STRIPE_PRICE_PREMIUM_MENSUEL = 'price_mensuel';
process.env.STRIPE_PRICE_PREMIUM_ANNUEL = 'price_annuel';

let ok = true; const t = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + ' - ' + n); if (!c) ok = false; };
let profil = { plan: 'premium', stripe_subscription_id: 'sub_faux', subscription_status: 'trialing', subscription_current_period_end: null, cancel_at_period_end: false };
let compte = 0;
global.fetch = async (url, init = {}) => {
  url = String(url);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (url.endsWith('/auth/v1/user')) return (init.headers || {}).Authorization === 'Bearer bon' ? json({ id: 'u-1', email: 'e@x.fr' }) : json({}, 401);
  if (url.includes('/rest/v1/profiles')) return json([profil]);
  if (url.includes('/rest/v1/nova_chat_usage')) return json(Array.from({ length: compte }, (_, i) => ({ id: 'r' + i })));
  return json({}, 500);
};
const fausseRep = () => ({ code: 0, out: null, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.code = c; return this; }, json(o) { this.out = o; return this; }, send(o) { this.out = o; return this; } });

(async () => {
  const st = require(dir + '/api/stripe/_stripe.js');
  t('cle de test acceptee', st.cleAutorisee('sk_test_abc') && st.cleAutorisee('rk_test_abc'));
  t('cle reelle refusee', !st.cleAutorisee('sk_live_abc') && !st.cleAutorisee('rk_live_abc'));
  t('cle absente ou bizarre refusee', !st.cleAutorisee('') && !st.cleAutorisee('pk_test_abc') && !st.cleAutorisee(undefined));
  t('verrou paiement reel = false', st.PAIEMENT_REEL_AUTORISE === false);
  t('prix mensuel et annuel -> premium', st.offreDuPrix('price_mensuel') === 'premium' && st.offreDuPrix('price_annuel') === 'premium');
  t('ancien prix inconnu -> rien', st.offreDuPrix('price_ancien_pro') === null && st.offreDuPrix(null) === null);

  const checkout = require(dir + '/api/stripe/create-checkout-session.js');
  process.env.STRIPE_SECRET_KEY = 'sk_live_faux';
  let r = fausseRep(); await checkout({ method: 'POST', headers: { authorization: 'Bearer bon' }, body: { plan: 'mensuel' } }, r);
  t('paiement avec cle reelle -> 503, rien ne part', r.code === 503 && r.out.error === 'stripe_non_configure');
  process.env.STRIPE_SECRET_KEY = 'sk_test_faux';
  r = fausseRep(); await checkout({ method: 'POST', headers: {}, body: { plan: 'mensuel' } }, r);
  t('paiement sans compte -> 401', r.code === 401);
  r = fausseRep(); await checkout({ method: 'POST', headers: { authorization: 'Bearer bon' }, body: { plan: 'elite' } }, r);
  t('ancienne offre elite -> 400', r.code === 400 && r.out.accepte.join() === 'mensuel,annuel');
  r = fausseRep(); await checkout({ method: 'POST', headers: { authorization: 'Bearer bon' }, body: { plan: 'mensuel' } }, r);
  t('abonnement deja actif (essai) -> 409', r.code === 409 && r.out.error === 'abonnement_deja_actif');

  const portail = require(dir + '/api/stripe/create-portal-session.js');
  process.env.STRIPE_SECRET_KEY = 'sk_live_faux';
  r = fausseRep(); await portail({ method: 'POST', headers: { authorization: 'Bearer bon' } }, r);
  t('portail avec cle reelle -> 503', r.code === 503);

  const webhook = require(dir + '/api/stripe/webhook.js');
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_faux';
  r = fausseRep(); await webhook({ method: 'POST', headers: {}, on() {} }, r);
  t('webhook avec cle reelle -> 503', r.code === 503);

  const config = require(dir + '/api/config.js');
  r = fausseRep(); config({ method: 'GET', query: {} }, r);
  t('config JSON : adresse + cle publique seulement', r.code === 200 && Object.keys(r.out).join() === 'supabaseUrl,supabaseAnonKey');
  r = fausseRep(); config({ method: 'GET', query: { format: 'js' } }, r);
  t('config script : window.NT_SB', r.code === 200 && /^window\.NT_SB = \{"url":"https:\/\/faux\.supabase\.co","key":"anon-publique"\};/.test(r.out) && /javascript/.test(r.headers['content-type']));
  process.env.SUPABASE_ANON_KEY = '</script><script>alert(1)';
  delete require.cache[require.resolve(dir + '/api/config.js')];
  r = fausseRep(); require(dir + '/api/config.js')({ method: 'GET', query: { format: 'js' } }, r);
  t('config script : « < » echappe', !r.out.includes('</script>'));
  process.env.SUPABASE_ANON_KEY = 'anon-publique';

  const me = require(dir + '/api/me.js');
  compte = 12;
  r = fausseRep(); await me({ method: 'GET', headers: { authorization: 'Bearer bon' } }, r);
  t('me : essai en cours -> premium', r.code === 200 && r.out.plan === 'premium' && r.out.planLabel === 'Premium' && r.out.status === 'trialing');
  t('me : compteur du coach 12/300', r.out.coach.used === 12 && r.out.coach.limit === 300 && r.out.coach.remaining === 288 && r.out.coach.perHour === 20);
  t('me : ni e-mail ni nom renvoyes', !('email' in r.out) && !('name' in r.out));
  profil = { plan: 'elite', subscription_status: 'active' };
  r = fausseRep(); await me({ method: 'GET', headers: { authorization: 'Bearer bon' } }, r);
  t('me : ancienne offre elite -> Decouverte (30)', r.out.plan === 'free' && r.out.coach.limit === 30);
  r = fausseRep(); await me({ method: 'GET', headers: {} }, r);
  t('me : sans compte -> 401', r.code === 401);

  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nECHECS'); process.exit(ok ? 0 : 1);
})().catch(e => { console.error('PLANTAGE', e); process.exit(1); });
