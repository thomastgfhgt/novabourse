// Test (npm test) de js/branchements.js avec un faux navigateur et un faux Supabase.
const fs = require('fs'), vm = require('vm');
const code = fs.readFileSync(require('path').resolve(__dirname, '..', '..', 'js', 'branchements.js'), 'utf8');
let ok = true; const t = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + ' - ' + n); if (!c) ok = false; };

function navigateur({ sb, session }) {
  const appels = [];
  const w = {
    location: { href: 'https://novatitre.com/', origin: 'https://novatitre.com' },
    fetch: async (entree, init = {}) => { appels.push({ url: typeof entree === 'string' ? entree : entree.url, init }); return new Response(JSON.stringify(w.__rep || { url: 'https://checkout.stripe.com/x' }), { status: w.__code || 200, headers: { 'content-type': 'application/json' } }); },
    NT_SB: sb,
    supabase: { createClient: (url, key, opts) => ({ url, key, opts, auth: { getSession: async () => ({ data: { session } }) } }) },
  };
  w.window = w;
  vm.runInNewContext(code, Object.assign(w, { URL, Headers, Response, JSON, Object, Error, location: w.location }));
  return { w, appels };
}

(async () => {
  let { w } = navigateur({ sb: null, session: null });
  t('sans configuration : rien n est declare', w.NT_AUTH === undefined && w.NT_AI_ENDPOINT === undefined && w.NT_PAY === undefined);

  let n = navigateur({ sb: { url: 'https://p.supabase.co', key: 'anon' }, session: { access_token: 'JETON' } });
  w = n.w;
  t('NT_AUTH en mode supabase avec le client', w.NT_AUTH.mode === 'supabase' && w.NT_AUTH.client.url === 'https://p.supabase.co' && w.NT_AUTH.client.key === 'anon');
  t('session gardee, PKCE, cle de stockage novatitre', w.NT_AUTH.client.opts.auth.flowType === 'pkce' && w.NT_AUTH.client.opts.auth.storageKey === 'novatitre-auth');
  t('NT_AI_ENDPOINT = /api/coach', w.NT_AI_ENDPOINT === '/api/coach');

  await w.fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const h1 = n.appels[0].init.headers;
  t('jeton ajoute aux appels vers /api/coach', h1.get('Authorization') === 'Bearer JETON' && h1.get('Content-Type') === 'application/json');
  await w.fetch('https://autre-site.com/api/coach', {});
  await w.fetch('/api/me', {});
  await w.fetch('https://fonts.googleapis.com/css', {});
  t('jeton jamais ajoute ailleurs', n.appels.slice(1).every(a => !(a.init.headers && a.init.headers.get && a.init.headers.get('Authorization'))));

  await w.NT_PAY.payer('annuel');
  const p = n.appels[n.appels.length - 1];
  t('payer : POST checkout avec le jeton et le plan', p.url === '/api/stripe/create-checkout-session' && p.init.method === 'POST' && p.init.body === '{"plan":"annuel"}' && p.init.headers.Authorization === 'Bearer JETON');
  t('payer : redirection vers Stripe', w.location.href === 'https://checkout.stripe.com/x');

  w.__rep = { plan: 'premium' };
  const st = await w.NT_PAY.statut();
  t('statut : lit /api/me', st.plan === 'premium' && n.appels[n.appels.length - 1].url === '/api/me');

  w.__code = 409; w.__rep = { error: 'abonnement_deja_actif' };
  let err = null; try { await w.NT_PAY.payer('mensuel'); } catch (e) { err = e; }
  t('erreur serveur remontee avec son code (409)', err && err.status === 409 && err.message === 'abonnement_deja_actif');

  n = navigateur({ sb: { url: 'https://p.supabase.co', key: 'anon' }, session: null });
  t('sans compte : statut = null, aucun appel', (await n.w.NT_PAY.statut()) === null && n.appels.length === 0);
  err = null; try { await n.w.NT_PAY.gerer(); } catch (e) { err = e; }
  t('sans compte : gerer refuse (401) sans appel', err && err.status === 401 && n.appels.length === 0);

  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nECHECS'); process.exit(ok ? 0 : 1);
})().catch(e => { console.error('PLANTAGE', e); process.exit(1); });
