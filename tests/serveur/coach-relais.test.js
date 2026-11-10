// (npm test) Relais Claude -> Grok -> OpenAI, avec faux services (aucun appel réel).
process.env.SUPABASE_URL = 'https://faux.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
const dir = require('path').resolve(__dirname, '..', '..');

let ok = true; const t = (n, c) => { console.log((c ? 'PASS' : 'FAIL') + ' - ' + n); if (!c) ok = false; };
let appels = [], etat = {};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
const msgClaude = (stop = 'end_turn') => ({ id: 'm', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', stop_reason: stop, content: stop === 'refusal' ? [] : [{ type: 'text', text: 'Réponse de Claude.' }], usage: { input_tokens: 1, output_tokens: 1 } });
const msgChat = txt => ({ choices: [{ message: { role: 'assistant', content: txt } }] });

global.fetch = async (url, init = {}) => {
  url = String(url && url.url ? url.url : url); const body = init.body ? String(init.body) : '';
  const headers = new Headers(init.headers || {});
  appels.push({ url, body, auth: headers.get('authorization') });
  if (url.endsWith('/auth/v1/user')) return json({ id: 'u-1', email: 'eleve@exemple.fr', user_metadata: { full_name: 'Jean Eleve' } });
  if (url.includes('/rest/v1/profiles')) return json([{ plan: 'premium', subscription_status: 'active' }]);
  if (url.includes('/rest/v1/rpc/reserve_chat_message')) return json([{ granted: true, used: 1, id: 'res-1' }]);
  if (url.includes('/rest/v1/nova_chat_usage')) return new Response(null, { status: 204 });
  if (url.startsWith('https://api.anthropic.com/')) return etat.claude();
  if (url.startsWith('https://api.x.ai/')) return etat.grok();
  if (url.startsWith('https://api.openai.com/')) return etat.openai();
  return json({}, 500);
};

const handler = require(dir + '/api/coach.js');
const appel = async body => {
  appels = []; const res = { code: 0, out: null, setHeader() {}, status(c) { this.code = c; return this; }, json(o) { this.out = o; return this; } };
  await handler({ method: 'POST', headers: { authorization: 'Bearer bon' }, body }, res); return res;
};
const vers = h => appels.filter(a => a.url.startsWith(h));
const panne = s => () => json({ error: { message: 'panne' } }, s);
const cles = (a, x, o) => { for (const [k, v] of [['ANTHROPIC_API_KEY', a], ['XAI_API_KEY', x], ['OPENAI_API_KEY', o]]) { if (v) process.env[k] = v; else delete process.env[k]; } };

(async () => {
  cles('sk-ant-faux', 'xai-faux', 'sk-openai-faux');

  etat = { claude: () => json(msgClaude()), grok: () => json(msgChat('Grok')), openai: () => json(msgChat('OpenAI')) };
  let r = await appel({ prompt: 'Salut' });
  t('Claude repond : ni Grok ni OpenAI appeles', r.code === 200 && r.out.text === 'Réponse de Claude.' && vers('https://api.x.ai/').length === 0 && vers('https://api.openai.com/').length === 0);

  etat.claude = panne(529);
  r = await appel({ prompt: 'Mon mail est jean@gmail.com. C est quoi un ETF ?' });
  const g = vers('https://api.x.ai/')[0]; const gb = g ? JSON.parse(g.body) : {};
  t('Claude surcharge -> Grok repond', r.code === 200 && r.out.text === 'Grok');
  t('Grok : cle xAI en en-tete, modele grok-4.6 par defaut', g && g.auth === 'Bearer xai-faux' && gb.model === 'grok-4.6');
  t('Grok : memes regles du coach en message systeme', gb.messages && gb.messages[0].role === 'system' && gb.messages[0].content.includes('JAMAIS de conseil en investissement'));
  t('Grok : e-mail efface, ni nom ni e-mail du compte', g && !/gmail|eleve@exemple|Jean/.test(g.body) && g.body.includes('[e-mail retir'));
  t('OpenAI pas appele si Grok repond', vers('https://api.openai.com/').length === 0);

  etat.grok = panne(500);
  r = await appel({ prompt: 'Salut' });
  const o = vers('https://api.openai.com/')[0];
  t('Claude et Grok en panne -> OpenAI repond', r.code === 200 && r.out.text === 'OpenAI' && o && o.auth === 'Bearer sk-openai-faux' && JSON.parse(o.body).model === 'gpt-4.1-mini');

  etat.grok = () => json(msgChat('   '));
  r = await appel({ prompt: 'Salut' });
  t('reponse vide de Grok -> OpenAI', r.code === 200 && r.out.text === 'OpenAI');

  process.env.XAI_MODEL = 'grok-test';
  etat.grok = () => json(msgChat('Grok'));
  r = await appel({ prompt: 'Salut' });
  t('modele Grok reglable par XAI_MODEL', JSON.parse(vers('https://api.x.ai/')[0].body).model === 'grok-test');
  delete process.env.XAI_MODEL;

  etat.claude = () => json(msgClaude('refusal'));
  r = await appel({ prompt: 'Salut' });
  t('refus de Claude : texte poli, JAMAIS renvoye a Grok ni OpenAI', r.code === 200 && /Reformule/.test(r.out.text) && vers('https://api.x.ai/').length === 0 && vers('https://api.openai.com/').length === 0);

  cles(null, 'xai-faux', null);
  etat.grok = () => json(msgChat('Grok seul'));
  r = await appel({ prompt: 'Salut' });
  t('seul Grok configure : Claude saute, Grok repond', r.code === 200 && r.out.text === 'Grok seul' && vers('https://api.anthropic.com/').length === 0);

  cles('sk-ant-faux', 'xai-faux', 'sk-openai-faux');
  etat = { claude: panne(529), grok: panne(500), openai: panne(503) };
  r = await appel({ prompt: 'Salut' });
  t('les trois en panne -> 503, message non decompte', r.code === 503 && r.out.error === 'ia_indisponible' && appels.some(a => a.url.includes('nova_chat_usage?id=eq.res-1') && a.body.includes('"failed"')));

  etat.openai = panne(429);
  r = await appel({ prompt: 'Salut' });
  t('derniere IA saturee (429) -> 429', r.code === 429 && r.out.error === 'ia_surchargee');

  cles(null, null, null);
  r = await appel({ prompt: 'Salut' });
  t('aucune cle -> 503 coach non configure', r.code === 503 && r.out.error === 'coach_non_configure');

  console.log(ok ? '\nTOUS LES TESTS PASSENT' : '\nECHECS'); process.exit(ok ? 0 : 1);
})().catch(e => { console.error('PLANTAGE', e); process.exit(1); });
