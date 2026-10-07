/* ============================================================
   AUTHENTIFICATION — état à trois valeurs
   ------------------------------------------------------------
   auth.status vaut 'loading' | 'guest' | 'authenticated'.
   Supabase est la SEULE source de vérité de la session : aucune donnée
   restaurée depuis novabourse_state_v1 ne peut faire passer ce statut à
   'authenticated' (voir loadState, qui réinitialise systématiquement auth).
   Tant que status !== 'authenticated', renderGate/renderApp/render
   refusent explicitement d'afficher quoi que ce soit de privé.
   ============================================================ */
let sbClient = null;
let AUTH_ERROR = null;
let CONFIG = { supabaseUrl:null, supabaseAnonKey:null, marketConnected:false,
  aiConnected:false, annualBilling:false, appleEnabled:false };

async function loadConfig(){
  try {
    const r = await fetch('/api/config');
    if (r.ok) CONFIG = { ...CONFIG, ...(await r.json()) };
  } catch { /* configuration indisponible : on reste en mode invité strict */ }
  return CONFIG;
}

async function initAuth(){
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey){
    state.auth.status = 'guest'; state.auth.signedIn = false;
    renderGate();
    return null;
  }
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  /* detectSessionInUrl:true INCHANGÉ (voir correctif juste plus bas,
     `if (url.searchParams.get('code'))`) : nécessaire aussi au flux
     e-mail (confirmation d'inscription/réinitialisation de mot de passe,
     signUp()/resetPasswordForEmail() plus bas, tokens en #hash) — le
     désactiver casserait ces deux flux, pas seulement Google. */
  sbClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true,
            flowType:'pkce', storage:window.localStorage,
            storageKey:'novabourse-auth' },
  });

  /* CORRECTIF (2026-09-24, trouvé EN TESTANT le bouton Apple en direct
     sur la prod) : quand un provider OAuth n'est pas activé côté
     Supabase, signInWithOAuth() ne renvoie PAS une erreur exploitable
     côté client — il redirige (window.location) vers l'URL /authorize
     de Supabase, qui répond alors une page JSON brute
     ({"code":400,"error_code":"validation_failed","msg":"Unsupported
     provider..."}) en dehors de l'app, jamais renvoyée à applySession/
     AUTH_ERROR. Un vrai visiteur cliquant "Continuer avec Apple" avant
     la configuration Apple Developer/Supabase tomberait donc sur une
     page d'erreur brute illisible plutôt que de revenir dans l'app.
     /auth/v1/settings est un endpoint PUBLIC de Supabase (pas besoin de
     jeton) qui liste les providers OAuth réellement activés — vérifié
     une fois ici, le bouton Apple ne s'affiche que s'il est vraiment
     prêt (voir gateScreen()). Se met à jour tout seul le jour où Apple
     est configuré côté tableau de bord, sans changement de code. */
  try {
    const r = await fetch(CONFIG.supabaseUrl + '/auth/v1/settings');
    if (r.ok){ const s = await r.json(); CONFIG.appleEnabled = !!(s.external && s.external.apple); }
  } catch { /* réglages indisponibles : le bouton Apple reste caché par prudence */ }

  try {
    const url = new URL(window.location.href);
    const err = url.searchParams.get('error_description') || url.searchParams.get('error')
      || new URLSearchParams(window.location.hash.slice(1)).get('error_description');
    if (err){
      AUTH_ERROR = decodeURIComponent(err).replace(/\+/g, ' ');
      url.searchParams.delete('error'); url.searchParams.delete('error_description');
      window.history.replaceState({}, '', url.pathname);
    }
    if (url.searchParams.get('code')){
      /* CORRECTIF (2026-09-29, retour utilisateur : "on nous demande
         parfois de nous connecter 2 fois à Google") : cet appel manuel
         à exchangeCodeForSession() faisait DOUBLE EMPLOI avec la
         détection automatique de detectSessionInUrl:true (client créé
         juste au-dessus), qui traite déjà ce même `code` PKCE en
         interne dès sa création — un vrai bug de course documenté par
         Supabase (un code PKCE n'est échangeable qu'UNE SEULE FOIS,
         5 minutes de validité) : selon l'ordre d'arrivée entre les deux
         tentatives, l'une des deux échouait silencieusement ("code
         already used"/"invalid grant"), laissant parfois l'utilisateur
         en 'guest' après un premier clic sur "Continuer avec Google"
         pourtant réussi côté Google — d'où la nécessité de recliquer.
         Retiré au profit d'une simple attente (même principe que la
         branche #access_token juste en dessous, qui s'appuyait déjà
         SEULEMENT sur la détection automatique, jamais sur un appel
         manuel) avant de nettoyer l'URL. */
      await new Promise(r => setTimeout(r, 60));
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } else if (window.location.hash.includes('access_token')){
      await new Promise(r => setTimeout(r, 60));
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  } catch (e){
    console.warn('[auth]', e);
    AUTH_ERROR = "L'échange du code de connexion a échoué : " + (e.message || e);
  }

  /* applySession peut être invoquée par onAuthStateChange ET par le premier
     getSession() ci-dessous. Elle est rendue idempotente via un jeton de
     "génération" : seul le dernier appel en cours a le droit d'écrire l'état
     et de déclencher le rendu, ce qui évite les doubles /api/me et les
     rendus contradictoires en cas d'appels quasi simultanés. */
  sbClient.auth.onAuthStateChange((_e, session) => { applySession(session); });
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && sbClient && state.auth.status !== 'authenticated'){
      const { data } = await sbClient.auth.getSession();
      if (data.session) applySession(data.session);
    }
  });
  const { data } = await sbClient.auth.getSession();
  await applySession(data.session);
  return sbClient;
}

async function authFetch(url, options = {}){
  const { data } = sbClient ? await sbClient.auth.getSession() : { data:{} };
  const token = data?.session?.access_token;
  return fetch(url, { ...options, headers: {
    'Content-Type':'application/json',
    ...(token ? { Authorization:'Bearer ' + token } : {}),
    ...(options.headers || {}),
  }});
}

let _sessionGen = 0;
async function applySession(session){
  const gen = ++_sessionGen;

  if (!session){
    if (gen !== _sessionGen) return;
    state.auth = { status:'guest', signedIn:false, name:null, email:null, since:null };
    state.settings.plan = 'free';
    state.account = null;
    saveState(); renderGate(); return;
  }

  state.auth = {
    status:'authenticated',
    signedIn: true,
    name: session.user.user_metadata?.full_name || session.user.email,
    email: session.user.email,
    avatar: session.user.user_metadata?.avatar_url || null,
    since: session.user.created_at || null,
  };
  saveState();
  await refreshAccount();
  if (gen !== _sessionGen) return;   // une session plus récente a déjà pris le relais
  syncPortfolio();   // asynchrone, non bloquant : ne re-render() que si la fusion change quelque chose

  if (state.account && state.account.onboarded === false && !state.onboarding.done){
    state.onboarding.step = state.onboarding.step || 1;
    saveState(); renderGate(); return;
  }
  if (state.account && state.account.onboarded){
    state.onboarding.done = true;
    saveState();
  }
  renderGate();
}

function quotaLigne(){
  const a = state.account;
  if (!a || typeof a.used !== 'number') return '';
  const nom = esc(a.planLabel || a.plan || '');
  if (a.unlimited) return `<div class="quota"><b>${nom}</b><span>Analyses incluses</span></div>`;
  const pct = a.limit ? Math.min(100, Math.round(a.used / a.limit * 100)) : 0;
  return `<div class="quota">
    <b>${nom}</b>
    <span class="tabular-nums">${a.used} / ${a.limit} analyses utilisées ce mois-ci</span>
    <i class="quota-bar"><em style="width:${pct}%"></em></i>
  </div>`;
}

async function refreshAccount(){
  try {
    const r = await authFetch('/api/me');
    if (!r.ok) return;
    const me = await r.json();
    state.settings.plan = me.plan || 'free';
    state.account = me;
    if (me.profileSetup){
      const p = me.profileSetup;
      if (p.level) state.onboarding.level = p.level;
      if (p.goal) state.onboarding.goal = p.goal;
      if (p.interests) state.onboarding.interests = p.interests;
    }
    saveState();
  } catch {}
}

function setCapital(amount){
  const v = Math.max(100, Math.min(10000000, Math.round(amount)));
  state.wallet = { cash:v, invested:v, positions:[], realizedPnL:0 };
  /* Un nouveau portefeuille repart d'un historique VIDE, jamais celui d'un
     portefeuille précédent : la période "MAX" de la courbe recommence
     honnêtement à cet instant précis (voir snapshotPortfolio). */
  state.walletHistory = [];
  state.onboarding.capital = v;
  state.onboarding.step = 4;
  snapshotPortfolio('open');
  flushSaveState();
  renderGate();
  toast(`Portefeuille ouvert avec ${fmt.eur(v)}`);
}

async function signIn(){
  if (!sbClient){
    toast("Connexion indisponible : configuration du serveur incomplète.");
    return;
  }
  const { error } = await sbClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/',
               queryParams: { prompt:'select_account' } },
  });
  if (error) toast('Connexion impossible : ' + error.message);
}
/* Apple (2026-09-24, "modernise la page de connexion") — même client
   sbClient, même méthode signInWithOAuth que Google juste au-dessus,
   seul le provider change : c'est tout ce que Supabase Auth demande
   côté code pour un provider OAuth supplémentaire. Ce qui reste HORS de
   ce fichier (et hors de ce que le code peut garantir) : le provider
   Apple doit être activé côté tableau de bord Supabase (Authentication
   → Providers → Apple) avec un Services ID, Team ID, Key ID et une clé
   privée générés depuis un compte Apple Developer payant, plus l'URL de
   callback Supabase déclarée dans ce Services ID côté Apple. Tant que
   ce n'est pas fait, Supabase répond une erreur explicite ("Unsupported
   provider..."), traduite comme les autres erreurs d'auth ci-dessous —
   jamais un faux succès. */
async function signInApple(){
  if (!sbClient){
    toast("Connexion indisponible : configuration du serveur incomplète.");
    return;
  }
  const { error } = await sbClient.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: window.location.origin + '/' },
  });
  if (error) toast('Connexion impossible : ' + traduireErreurAuth(error.message));
}
/* Connexion par e-mail/mot de passe (2026-09-24) — Supabase Auth
   directement (signInWithPassword/signUp/resetPasswordForEmail), aucune
   route API maison : c'est exactement pour ça que Supabase Auth a été
   choisi à l'origine. État du formulaire (mode ouvert, erreur, en
   cours) gardé en variables de module plutôt que dans `state` : c'est
   de l'UI éphémère, jamais une donnée applicative à sauvegarder — même
   principe que templeIntroPlayed/searchIntent ailleurs dans ce fichier. */
let gateEmailMode = null;      // null (fermé) | 'signin' | 'signup' | 'reset'
let gateEmailBusy = false;
let gateEmailNotice = null;    // { kind:'error'|'success', text }

function traduireErreurAuth(msg){
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Adresse e-mail ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already exists'))
    return 'Un compte existe déjà avec cette adresse — connectez-vous plutôt.';
  if (m.includes('password should be at least') || m.includes('password is too short'))
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (m.includes('rate limit')) return 'Trop de tentatives : réessayez dans quelques minutes.';
  if (m.includes('email not confirmed'))
    return "Confirmez d'abord votre adresse e-mail (lien envoyé à l'inscription) avant de vous connecter.";
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Adresse e-mail invalide.';
  if (m.includes('unsupported provider') || m.includes('provider is not enabled'))
    return "Cette méthode de connexion n'est pas encore activée côté serveur.";
  return msg || 'Une erreur est survenue.';
}
function openGateEmail(mode){
  gateEmailMode = mode || 'signin'; gateEmailNotice = null; renderGate();
  requestAnimationFrame(() => document.getElementById('gateEmail')?.focus());
}
function closeGateEmail(){ gateEmailMode = null; gateEmailNotice = null; renderGate(); }
function toggleGateEmailMode(){
  gateEmailMode = gateEmailMode === 'signup' ? 'signin' : 'signup';
  gateEmailNotice = null; renderGate();
  requestAnimationFrame(() => document.getElementById('gateEmail')?.focus());
}
function openGateEmailReset(){
  gateEmailMode = 'reset'; gateEmailNotice = null; renderGate();
  requestAnimationFrame(() => document.getElementById('gateEmail')?.focus());
}
function readGateEmailFields(){
  return {
    email: (document.getElementById('gateEmail')?.value || '').trim(),
    password: document.getElementById('gatePassword')?.value || '',
  };
}
function submitGateEmail(){
  if (gateEmailBusy) return;
  if (gateEmailMode === 'reset') return emailReset();
  if (gateEmailMode === 'signup') return emailSignUp();
  return emailSignIn();
}
async function emailSignIn(){
  if (!sbClient){ gateEmailNotice = { kind:'error', text:'Connexion indisponible : configuration du serveur incomplète.' }; renderGate(); return; }
  const { email, password } = readGateEmailFields();
  if (!email || !password){ gateEmailNotice = { kind:'error', text:'Adresse e-mail et mot de passe requis.' }; renderGate(); return; }
  gateEmailBusy = true; gateEmailNotice = null; renderGate();
  const { error } = await sbClient.auth.signInWithPassword({ email, password });
  gateEmailBusy = false;
  if (error){ gateEmailNotice = { kind:'error', text: traduireErreurAuth(error.message) }; renderGate(); return; }
  /* Pas de renderGate() ici en cas de succès : onAuthStateChange (câblé
     dans initAuth()) reçoit la nouvelle session et appelle déjà
     applySession() -> renderGate() — un second appel ici peindrait un
     état transitoire incohérent entre les deux. */
}
async function emailSignUp(){
  if (!sbClient){ gateEmailNotice = { kind:'error', text:'Connexion indisponible : configuration du serveur incomplète.' }; renderGate(); return; }
  const { email, password } = readGateEmailFields();
  if (!email || !password){ gateEmailNotice = { kind:'error', text:'Adresse e-mail et mot de passe requis.' }; renderGate(); return; }
  if (password.length < 6){ gateEmailNotice = { kind:'error', text:'Le mot de passe doit contenir au moins 6 caractères.' }; renderGate(); return; }
  gateEmailBusy = true; gateEmailNotice = null; renderGate();
  const { data, error } = await sbClient.auth.signUp({
    email, password, options: { emailRedirectTo: window.location.origin + '/' },
  });
  gateEmailBusy = false;
  if (error){ gateEmailNotice = { kind:'error', text: traduireErreurAuth(error.message) }; renderGate(); return; }
  if (data?.session) return;   // auto-confirmé : onAuthStateChange prend le relais, comme emailSignIn()
  /* Confirmation par e-mail requise (comportement par défaut de
     Supabase Auth, aucune session tant que le lien n'est pas cliqué) :
     le dire honnêtement plutôt que de laisser croire à une connexion
     immédiate qui n'a pas eu lieu. */
  gateEmailMode = 'signin';
  gateEmailNotice = { kind:'success',
    text:`Compte créé. Vérifiez votre boîte mail (${email}) et cliquez sur le lien de confirmation avant de vous connecter.` };
  renderGate();
}
async function emailReset(){
  if (!sbClient){ gateEmailNotice = { kind:'error', text:'Connexion indisponible : configuration du serveur incomplète.' }; renderGate(); return; }
  const { email } = readGateEmailFields();
  if (!email){ gateEmailNotice = { kind:'error', text:'Indiquez votre adresse e-mail.' }; renderGate(); return; }
  gateEmailBusy = true; gateEmailNotice = null; renderGate();
  const { error } = await sbClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/' });
  gateEmailBusy = false;
  if (error){ gateEmailNotice = { kind:'error', text: traduireErreurAuth(error.message) }; renderGate(); return; }
  gateEmailMode = 'signin';
  /* Supabase ne révèle jamais si l'adresse existe réellement (sécurité,
     évite l'énumération de comptes) — "si un compte existe" reflète
     honnêtement ce que la réponse garantit, jamais plus. */
  gateEmailNotice = { kind:'success', text:`E-mail de récupération envoyé à ${email}, si un compte existe avec cette adresse.` };
  renderGate();
}

async function startCheckout(plan){
  if (plan === 'free'){ toast("L'offre Découverte est déjà active."); return; }
  if (state.auth.status !== 'authenticated'){ toast('Connectez-vous pour souscrire.'); return; }
  toast('Ouverture du paiement sécurisé…');
  try {
    const r = await authFetch('/api/stripe/create-checkout-session', {
      method:'POST', body: JSON.stringify({ plan }),
    });
    const d = await r.json();
    if (d.url){ window.location.href = d.url; return; }
    toast(d.error === 'prix_absent' ? "Cette offre n'est pas encore configurée."
      : d.error === 'stripe_non_configure' ? 'Paiement indisponible pour le moment.'
      : 'Paiement impossible.');
  } catch { toast('Paiement indisponible pour le moment.'); }
}

async function openPortal(){
  try {
    const r = await authFetch('/api/stripe/create-portal-session', { method:'POST' });
    const d = await r.json();
    if (d.url){ window.location.href = d.url; return; }
    toast(d.error === 'aucun_abonnement' ? "Aucun abonnement rattaché à ce compte."
      : 'Espace de gestion indisponible.');
  } catch { toast('Espace de gestion indisponible.'); }
}

async function signOut(){
  _sessionGen++;   // invalide toute résolution de session encore en vol
  if (sbClient) await sbClient.auth.signOut();
  state.auth = { status:'guest', signedIn:false, name:null, email:null, since:null };
  state.settings.plan = 'free';
  state.account = null;
  saveState(); renderGate();
}

const GOOGLE_G = `<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
  <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"/>
  <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21.4 7.6 24 12 24z"/>
  <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z"/>
  <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.1l3.8 3C6.5 6.7 9 4.8 12 4.8z"/></svg>`;
/* Glyphe Apple (2026-09-24) : silhouette standard, largement réutilisée
   telle quelle pour les boutons "Sign in with Apple" à travers le web
   (viewBox propre 0 0 384 512, comme GOOGLE_G ci-dessus a le sien) —
   jamais redessinée à la main, aucune raison de réinventer un glyphe
   aussi standardisé. */
const APPLE_LOGO = `<svg viewBox="0 0 384 512" width="17" height="17" fill="currentColor" aria-hidden="true">
  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 0 185.2 0 275.3c0 26.7 4.9 54.3 14.7 82.8 13.1 37.3 60.4 128.7 109.8 127.2 25.8-.6 44-18.3 77.6-18.3 32.6 0 49.5 18.3 78.3 18.3 49.8-.7 92.6-83.7 105.1-121.1-66.8-31.5-65.8-92.4-66.8-95.5zM256.4 88.9c27.6-32.6 25.1-62.4 24.3-73.1-24.5 1.4-52.9 16.8-69.1 35.8-17.8 20.2-28.4 45.2-26.1 73.9 26.8 2 51.5-11.3 70.9-36.6z"/></svg>`;

/* Écran neutre pendant la vérification de session : aucune information
   personnelle ne doit jamais apparaître ici.
   CORRECTIF (2026-09-25, retour utilisateur : le temple/l'app "apparaît
   seulement au bout de quelques secondes" pendant qu'initAuth() fait ses
   allers-retours réseau réels — Supabase, /api/me — "fais une animation
   stylée") : reprend exactement le même anneau animé (.brand-ring, déjà
   dessiné/animé plus haut) que gateScreen() ci-dessous, jusqu'ici
   manquant sur CET écran précis — c'était la seule des 2 pages du
   "portail" à afficher le triangle SEUL, sans anneau. Aucun nouveau
   style inventé : cohérence avec ce qui existe déjà plutôt qu'une
   nouvelle animation isolée. */
function loadingScreen(){
  return `<div class="gate"><div class="gate-card">
    <span class="brand-orbit" aria-hidden="true">
      <svg class="brand-ring" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-dasharray="42 297"/>
        <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-dasharray="14 325" stroke-dashoffset="-170"/>
      </svg>
      <span class="brand-mark">${svg(ICON.brand)}</span>
    </span>
  </div></div>`;
}

/* Refonte 2026-09-24 ("elle n'est plus à jour avec le produit actuel")
   — trois changements demandés explicitement :
   1) Message principal et sous-texte réécrits.
   2) Les 3 lignes .gate-pt (liste verticale) deviennent .gate-cards
      (grille compacte 3 colonnes, voir CSS) — même esprit que les
      cartes Nova de l'accueil/portefeuille/fiche action de cette même
      session, cohérence plutôt qu'un style isolé propre à cette page.
   3) Google + Apple + e-mail (voir gateEmailFormHTML ci-dessous) —
      Apple utilise le même sbClient/la même méthode que Google, prêt
      côté code ; ce qui reste à faire vit côté tableau de bord
      Supabase, voir la note sur signInApple() plus haut.
   Page nettement plus courte qu'avant (§4 du brief : "le bouton de
   connexion doit apparaître rapidement") : brand-orbit réduit (voir
   CSS), h1/marges resserrés, plus de "Connexion sécurisée par Google"
   spécifique à un seul provider. Les 3 cartes ET le texte légal restent
   présents mais après les boutons, jamais avant — priorité au geste
   utile. */
function gateScreen(){
  const notice = AUTH_ERROR ? { kind:'error', text: AUTH_ERROR } : gateEmailNotice;
  return `<div class="gate">
    <div class="gate-card">
      <span class="brand-orbit" aria-hidden="true">
        <svg class="brand-ring" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-dasharray="42 297"/>
          <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-dasharray="14 325" stroke-dashoffset="-170"/>
        </svg>
        <span class="brand-mark">${svg(ICON.brand)}</span>
      </span>
      <h1 class="display" style="font-size:clamp(26px,4.6vw,36px);margin-top:14px">
        Comprenez les marchés.<br>Décidez mieux.</h1>
      <p class="lead" style="margin-top:10px">
        Analysez les marchés, suivez vos investissements et comprenez ce qui compte vraiment
        grâce aux données et à Nova.</p>

      ${notice ? `<div class="notice ${notice.kind==='success'?'notice-ok':''}" style="margin-top:18px;text-align:left">
        <b>${notice.kind==='success' ? "C'est fait." : "La connexion n'a pas abouti."}</b><br>${esc(notice.text)}</div>` : ''}

      ${gateEmailMode ? gateEmailFormHTML() : `
      <div style="margin-top:${notice?'14px':'20px'}">
        <button class="btn btn-oauth btn-google" data-signin>${GOOGLE_G} Continuer avec Google</button>
        ${CONFIG.appleEnabled ? `<button class="btn btn-oauth btn-apple" data-signin-apple>${APPLE_LOGO} Continuer avec Apple</button>` : ''}
        <button class="btn btn-oauth btn-email" data-gate-email-open="signin">${svg(ICON.mail,2)} Continuer avec une adresse e-mail</button>
      </div>
      <p class="tiny" style="margin-top:12px">Connexion sécurisée.</p>

      <div class="gate-cards">
        ${[[ICON.spark,'ANALYSER','Analysez autrement','Données, Nova Score et analyses croisées pour mieux comprendre chaque entreprise.'],
           [ICON.radar,'SUIVRE','Tout ce qui compte, au même endroit','Marchés, portefeuille, Radar et Nova News réunis dans une seule expérience.'],
           /* CORRECTIF (2026-10-07, refonte visuelle, cohérence du
              mapping pièce/module) : lu dynamiquement depuis
              NOVA_FEATURES.novareview.icon (cavalier, mapping DÉFINITIF
              de la 2ᵉ passe) plutôt qu'une clé ICON codée en dur ici —
              cet écran suit automatiquement tout futur changement de
              mapping, jamais une 2e source de vérité qui pourrait
              diverger ("partout où Nova Review apparaît"). */
           [ICON[NOVA_FEATURES.novareview.icon],'PROGRESSER','Apprenez de vos décisions','Nova Review vous aide à comprendre vos décisions et à suivre votre progression.']]
          .map(([ic,eyebrow,t2,d])=>`<div class="gate-card-i">
            <span class="gate-card-ic">${svg(ic,1.9)}</span>
            <span class="gate-card-eyebrow">${eyebrow}</span>
            <b>${t2}</b><span>${d}</span></div>`).join('')}
      </div>`}

      <p class="tiny" style="margin-top:24px">En continuant, vous acceptez nos conditions. NovaTitre ne donne aucun conseil personnalisé.</p>
    </div>
  </div>`;
}
/* Formulaire e-mail (2026-09-24) — un seul balisage pour les 3 modes
   (connexion/création/récupération), voir gateEmailMode et les
   fonctions emailSignIn/emailSignUp/emailReset plus haut. `.field` :
   même classe que tous les autres champs texte de l'app (recherche,
   alertes...), jamais un style de champ propre à cette page. */
function gateEmailFormHTML(){
  const title = gateEmailMode === 'signup' ? 'Créer un compte'
    : gateEmailMode === 'reset' ? 'Récupérer mon compte' : 'Se connecter';
  const cta = gateEmailBusy ? 'Un instant…'
    : gateEmailMode === 'signup' ? 'Créer mon compte'
    : gateEmailMode === 'reset' ? 'Envoyer le lien' : 'Se connecter';
  return `<div style="margin-top:20px;text-align:left">
    <p class="h3">${title}</p>
    <input class="field" id="gateEmail" type="email" autocomplete="email" placeholder="Adresse e-mail" style="margin-top:12px">
    ${gateEmailMode !== 'reset' ? `<input class="field" id="gatePassword" type="password"
      autocomplete="${gateEmailMode === 'signup' ? 'new-password' : 'current-password'}"
      placeholder="Mot de passe" style="margin-top:10px">` : ''}
    <button class="btn btn-a" style="width:100%;margin-top:14px;min-height:52px" data-gate-email-submit
      ${gateEmailBusy ? 'disabled aria-disabled="true"' : ''}>${cta}</button>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:14px">
      <button class="linklike" data-gate-email-close>← Retour</button>
      ${gateEmailMode !== 'reset' ? `<button class="linklike" data-gate-email-toggle>
        ${gateEmailMode === 'signup' ? 'Déjà un compte ?' : 'Créer un compte'}</button>` : ''}
    </div>
    ${gateEmailMode === 'signin' ? `<button class="linklike" data-gate-email-reset
      style="display:block;margin:10px auto 0">Mot de passe oublié ?</button>` : ''}
  </div>`;
}

const ONB_LEVELS = [
  { id:'debutant', t:'Je débute', d:'Vocabulaire expliqué, chiffres essentiels seulement.' },
  { id:'intermediaire', t:'Je connais un peu', d:'Un bon équilibre entre clarté et détail.' },
  { id:'expert', t:'Je suis à l\'aise', d:'Tous les ratios, tout le détail des calculs.' },
];
const ONB_AMOUNTS = [
  { id:1000,  label:'1 000 €',  d:'Pour découvrir sans pression.' },
  { id:5000,  label:'5 000 €',  d:'Un portefeuille réaliste de départ.' },
  { id:25000, label:'25 000 €', d:'Pour diversifier largement.' },
  { id:100000,label:'100 000 €',d:'Pour tester à grande échelle.' },
];
const ONB_INTERESTS = SECTORS.map(s => ({ id:s, label:s }));
const ONB_GOALS = [
  { id:'comprendre', t:'Comprendre la Bourse', d:'Apprendre à lire une entreprise.' },
  { id:'trouver', t:'Trouver des entreprises', d:'Filtrer selon mes critères.' },
  { id:'suivre', t:'Suivre des valeurs', d:'Garder un œil sur mes favorites.' },
  { id:'portefeuille', t:'Gérer un portefeuille', d:'Tester mes idées sans risque.' },
];
/* Nova Explain — découverte (2026-09-28, onboarding adaptatif) : 5
   slides montrées UNIQUEMENT si level==='debutant' (step 1.5, entre le
   choix de niveau et le choix d'objectif), jamais aux niveaux
   intermédiaire/expert qui connaissent déjà ce vocabulaire — copie
   volontairement courte (2-3 phrases), même registre que le reste de
   l'onboarding. */
const ONB_SLIDES = [
  { t:"Qu'est-ce qu'une action ?", d:"Une action est un petit morceau de propriété d'une entreprise. Quand vous achetez une action Apple, vous devenez propriétaire d'une minuscule part d'Apple." },
  { t:"Qu'est-ce qu'un ETF ?", d:"Un ETF est un panier d'actions. Au lieu d'acheter une seule entreprise, vous achetez un panier de dizaines ou de centaines d'entreprises à la fois. C'est plus diversifié." },
  { t:"Qu'est-ce qu'un dividende ?", d:"Si vous possédez une action, l'entreprise peut vous reverser une partie de ses bénéfices chaque trimestre ou chaque année. C'est le dividende." },
  { t:"Risques et portefeuille", d:"Investir comporte un risque. C'est pour cela qu'on diversifie : au lieu de tout miser sur une seule action, on construit un « portefeuille » avec plusieurs actions, secteurs, et types d'investissements." },
  { t:"Comment chercher une entreprise", d:"Utilisez la recherche pour taper le nom ou le code (ticker) d'une entreprise, par exemple « Apple » ou « AAPL »." },
];

function onboardingScreen(){
  const st = state.onboarding.step;
  const dots = `<div class="onb-dots">${[1,2,3,4,5].map(i=>
    `<span class="${i<=st?'on':''}"></span>`).join('')}</div>`;

  if (st <= 1) return `<div class="gate"><div class="gate-card onb">
    ${dots}
    <h1 class="title">Où en êtes-vous ?</h1>
    <p class="lead" style="margin-top:10px">Nous adaptons le niveau de détail. Vous pourrez en changer à tout moment.</p>
    <div class="onb-list">
      ${ONB_LEVELS.map(l=>`<button class="onb-c" data-level="${l.id}">
        <span style="flex:1;min-width:0"><b>${l.t}</b><span>${l.d}</span></span>
        <span class="onb-a">${svg(ICON.arrow,2.4)}</span></button>`).join('')}
    </div>
  </div></div>`;

  if (st === 1.5){
    const i = state.onboarding.introSlide || 0;
    const slide = ONB_SLIDES[i];
    return `<div class="gate"><div class="gate-card onb">
    ${dots}
    <h1 class="title">Découvrez NovaTitre en quelques instants</h1>
    <p class="lead" style="margin-top:14px"><b>${esc(slide.t)}</b></p>
    <p class="lead" style="margin-top:8px;color:var(--ink-2)">${esc(slide.d)}</p>
    <div class="onb-dots" style="margin-top:22px">${ONB_SLIDES.map((_,j)=>
      `<span class="${j<=i?'on':''}"></span>`).join('')}</div>
    <div class="buttons" style="display:flex;gap:10px;margin-top:22px">
      ${i>0?`<button class="btn btn-g" style="flex:1" data-onb-intro-prev>Précédent</button>`:''}
      <button class="btn btn-a" style="flex:1" data-onb-intro-next>
        ${i < ONB_SLIDES.length-1 ? 'Suivant' : 'Continuer'}</button>
    </div>
    </div>
  </div></div>`;
  }

  if (st === 2) return `<div class="gate"><div class="gate-card onb">
    ${dots}
    <h1 class="title">Que voulez-vous faire ?</h1>
    <div class="onb-list">
      ${ONB_GOALS.map(g=>`<button class="onb-c" data-goal="${g.id}">
        <span style="flex:1;min-width:0"><b>${g.t}</b><span>${g.d}</span></span>
        <span class="onb-a">${svg(ICON.arrow,2.4)}</span></button>`).join('')}
    </div>
    <button class="btn btn-g" style="margin-top:18px;width:100%" data-onb-step="1">Retour</button>
  </div></div>`;

  if (st === 3) return `<div class="gate"><div class="gate-card onb">
    ${dots}
    <h1 class="title">Combien voulez-vous investir ?</h1>
    <p class="lead" style="margin-top:10px">De l'argent <b>fictif</b>, pour tester vos idées sans
      aucun risque.</p>
    <div class="onb-list">
      ${ONB_AMOUNTS.map(a=>`<button class="onb-c" data-capital="${a.id}">
        <span style="flex:1;min-width:0"><b>${a.label}</b><span>${a.d}</span></span>
        <span class="onb-a">${svg(ICON.arrow,2.4)}</span></button>`).join('')}
    </div>
    <button class="btn btn-g" style="margin-top:12px;width:100%" data-onb-step="2">Retour</button>
  </div></div>`;

  if (st === 4){
    const sel = state.onboarding.interests || [];
    return `<div class="gate"><div class="gate-card onb">
      ${dots}
      <h1 class="title">Qu'est-ce qui vous intéresse ?</h1>
      <p class="lead" style="margin-top:10px">Choisissez un à trois secteurs.</p>
      <div class="chips" style="margin-top:22px">
        ${ONB_INTERESTS.map(i=>`<button class="chip" data-interest="${esc(i.id)}"
          aria-pressed="${sel.includes(i.id)}">${esc(i.label)}</button>`).join('')}
      </div>
      <button class="btn btn-a btn-lg" style="margin-top:24px;width:100%"
        data-onb-step="6" ${sel.length?'':'disabled'}>
        ${sel.length?`Continuer avec ${sel.length} secteur${sel.length>1?'s':''}`:'Choisissez au moins un secteur'}</button>
      <button class="btn btn-g" style="margin-top:10px;width:100%" data-onb-step="3">Retour</button>
    </div></div>`;
  }

  return `<div class="gate"><div class="gate-card onb">
    ${dots}
    <h1 class="title">Trois gestes pour commencer</h1>
    <div class="onb-steps">
      ${[[ICON.search,'Cherchez une entreprise','La barre de recherche s\'ouvre partout avec la touche « / ».'],
         [ICON.star,'Touchez l\'étoile','L\'entreprise rejoint votre liste de suivi, en un geste.'],
         [ICON.plus,'Appuyez sur Acheter','Investissez de l\'argent fictif et suivez vos positions.']]
        .map(([ic,t2,d],i)=>`<div class="onb-step">
          <span class="onb-n">${i+1}</span>
          <span class="onb-i">${svg(ic)}</span>
          <span><b>${t2}</b><span>${d}</span></span>
        </div>`).join('')}
    </div>
    ${state.onboarding.capital?`<div class="onb-step" style="margin-top:12px">
      <span class="onb-i">${svg(ICON.wallet)}</span>
      <span><b>Votre portefeuille est prêt</b>
        <span>${fmt.eur(state.onboarding.capital)} fictifs vous attendent.</span></span>
    </div>`:''}
    <div class="notice" style="margin-top:20px">
      <b>Une règle que nous ne franchirons pas.</b> Quand une donnée manque, nous l'écrivons.
      Nous ne remplaçons jamais un chiffre absent par une estimation.
    </div>
    <button class="btn btn-a btn-lg" style="margin-top:22px;width:100%" data-onb-done>
      Entrer dans NovaTitre</button>
  </div></div>`;
}

function renderGate(){
  document.body.classList.add('gated');
  const el = document.getElementById('view');
  if (state.auth.status === 'loading'){
    el.innerHTML = loadingScreen();
  } else if (state.auth.status === 'guest'){
    el.innerHTML = gateScreen();
  } else if (!state.onboarding.done){
    el.innerHTML = onboardingScreen();
  } else {
    renderApp();
    return;
  }
  animate();
}
function renderApp(){
  /* Garde-fou : l'application privée ne s'ouvre jamais tant que la session
     n'est pas confirmée par Supabase, quel que soit l'appelant. */
  if (state.auth.status !== 'authenticated' || !state.onboarding.done){
    renderGate();
    return;
  }
  document.body.classList.remove('gated');
  route = { page:'home', arg:null };
  render();
}
