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
    /* Mode visiteur (2026-10-20) : l'absence de session est SON état
       normal — jamais renvoyé à l'écran de connexion pour ça. */
    if (state.auth.status === 'visitor') return;
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
  syncNovaBot();     // même principe, scopé au portefeuille NovaBot (voir js/core.js)

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
/* Design v2 (2026-10-20) : écran de connexion sur UN SEUL écran de
   téléphone, sans défilement — l'appli dans un iPhone, le titre, puis
   les boutons tout de suite. MÊMES attributs d'action qu'avant
   (data-signin, data-signin-apple, data-gate-email-open), plus
   data-gate-visitor ("Sans compte", voir enterVisitor() plus bas).
   Captures d'écran incluses en data: (aucun fichier image à ajouter). */
const NT_LOGIN_IMG = {
  centre: 'data:image/jpeg;base64,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',
  gauche: 'data:image/jpeg;base64,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',
  droite: 'data:image/jpeg;base64,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',
};
function gateScreen(){
  const notice = AUTH_ERROR ? { kind:'error', text: AUTH_ERROR } : gateEmailNotice;
  const noticeHTML = notice ? `<div class="nt-notice ${notice.kind==='success'?'nt-ok':''}" role="status">
      <b>${notice.kind==='success' ? "C'est fait." : "La connexion n'a pas abouti."}</b> ${esc(notice.text)}</div>` : '';
  return `<div class="nt-gate">
    <div class="nt-gate-in">
      <div class="nt-gate-top">
        <span class="nt-gate-logo">${svg(ICON.brand)}</span><span class="nt-gate-name">NovaTitre</span>
        <span class="nt-gate-live">● Marchés en direct</span>
      </div>
      ${gateEmailMode ? '' : `<div class="nt-phones" aria-hidden="true">
        <span class="nt-ph nt-ph-l"><img src="${NT_LOGIN_IMG.gauche}" alt=""></span>
        <span class="nt-ph nt-ph-r"><img src="${NT_LOGIN_IMG.droite}" alt=""></span>
        <span class="nt-ph nt-ph-c"><span class="nt-ph-screen"><img src="${NT_LOGIN_IMG.centre}" alt=""><i></i></span></span>
      </div>`}
      <h1 class="nt-gate-h1">Comprends les marchés.<br>Décide mieux.</h1>
      ${gateEmailMode ? '' : `<p class="nt-gate-lead">Cours, actualité et une IA qui t'explique chaque entreprise.</p>`}
      ${noticeHTML}
      ${gateEmailMode ? `<div class="nt-gate-form">${gateEmailFormHTML()}</div>` : `
      <div class="nt-gate-btns">
        <button class="nt-btn nt-btn-google" data-signin>${GOOGLE_G} Continuer avec Google</button>
        ${CONFIG.appleEnabled ? `<button class="nt-btn nt-btn-ghost" data-signin-apple>${APPLE_LOGO} Continuer avec Apple</button>` : ''}
        <div class="nt-gate-row">
          <button class="nt-btn nt-btn-ghost" data-gate-email-open="signin">${svg(ICON.mail,2)} E-mail</button>
          <button class="nt-btn nt-btn-visit" data-gate-visitor>Sans compte
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </div>
        <p class="nt-gate-hint">Sans compte, tu explores librement. Les analyses Nova demandent un compte gratuit.</p>
      </div>`}
      <p class="nt-gate-legal">Connexion sécurisée · En continuant, tu acceptes nos <button type="button" data-legal="cgu" style="color:inherit;text-decoration:underline;background:none;border:0;padding:0;font:inherit;cursor:pointer">conditions</button> et notre <button type="button" data-legal="confidentialite" style="color:inherit;text-decoration:underline;background:none;border:0;padding:0;font:inherit;cursor:pointer">politique de confidentialité</button>. NovaTitre ne donne aucun conseil en investissement personnalisé. <button type="button" data-legal="mentions" style="color:inherit;text-decoration:underline;background:none;border:0;padding:0;font:inherit;cursor:pointer">Mentions légales</button></p>
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
  /* CORRECTIF (2026-10-15) : "Tester mes idées sans risque" décrivait le
     portefeuille fictif, retiré de l'expérience publique
     (PORTEFEUILLE_FICTIF_PUBLIC, js/core.js) — reformulé pour ne plus
     promettre une fonctionnalité de simulation. L'option elle-même reste
     (toujours utile pour orienter le contenu montré ensuite), seule la
     description change. */
  { id:'portefeuille', t:'Préparer un investissement', d:'Me projeter avant d\'investir.' },
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

  /* CORRECTIF (2026-10-15, mission "passage au trading réel") : cette
     étape proposait un capital DE DÉPART FICTIF — un mécanisme de
     simulation présenté à l'inscription, contraire à la décision
     explicitement confirmée de ne plus en proposer dans l'expérience
     publique. setCapital() (js/auth.js) reste intact (jamais supprimé :
     data/fonctionnalités existantes préservées), simplement plus appelée
     avec un montant choisi par l'utilisateur — avance directement avec
     0, invisible de toute façon puisque PAGES.portfolio/la carte Accueil
     n'affichent plus state.wallet tant que PORTEFEUILLE_FICTIF_PUBLIC
     est faux (js/core.js). */
  if (st === 3 && !PORTEFEUILLE_FICTIF_PUBLIC){
    state.onboarding.step = 4;
    saveState();
    return onboardingScreen();
  }

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
         PORTEFEUILLE_FICTIF_PUBLIC
           ? [ICON.plus,'Appuyez sur Acheter','Investissez de l\'argent fictif et suivez vos positions.']
           : [ICON.plus,'Analysez avec Nova','Lancez une analyse IA pour comprendre une entreprise en détail.']]
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
  if (state.auth.status === 'visitor'){ renderApp(); return; }
  document.body.classList.remove('nt-visitor');
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
  const visiteur = state.auth.status === 'visitor';
  if (!visiteur && (state.auth.status !== 'authenticated' || !state.onboarding.done)){
    renderGate();
    return;
  }
  document.body.classList.remove('gated');
  document.body.classList.toggle('nt-visitor', visiteur);
  if (visiteur) ntBandeauVisiteur();
  route = { page:'home', arg:null };
  render();
}


/* ============================================================
   MODE VISITEUR (2026-10-20) — "Sans compte"
   ------------------------------------------------------------
   Le visiteur parcourt tout le site (marchés, fiches, Nova News,
   Nova Event, pages NovaBot/Nova Review/Offres) mais ne peut RIEN
   faire qui consomme un jeton ni qui s'enregistre sur un compte :
   analyses Nova AI, messages NovaBot, commentaire Nova Review,
   recherche IA du Radar, liste de suivi, alertes. Chaque tentative
   ouvre "Crée ton compte gratuit" à la place.
   - Jamais 'authenticated' : toutes les gardes existantes
     (state.auth.status !== 'authenticated') continuent de refuser
     l'IA, et le serveur refuse de toute façon sans jeton.
   - Jamais persisté : loadState() réinitialise auth à chaque visite,
     le visiteur revoit donc l'écran de connexion à son retour.
   ============================================================ */
function enterVisitor(){
  _sessionGen++;   // ignore toute résolution de session "absente" encore en vol
  AUTH_ERROR = null; gateEmailMode = null; gateEmailNotice = null;
  state.auth = { status:'visitor', signedIn:false, name:null, email:null, since:null };
  state.settings.plan = 'free';
  state.account = null;
  renderApp();
}
function quitterVisiteur(){
  if (typeof closeSheet === 'function') closeSheet();
  state.auth = { status:'guest', signedIn:false, name:null, email:null, since:null };
  document.body.classList.remove('nt-visitor');
  document.getElementById('ntVisitorBar')?.remove();
  renderGate();
}
function ntBandeauVisiteur(){
  if (document.getElementById('ntVisitorBar')) return;
  const bar = document.createElement('div');
  bar.id = 'ntVisitorBar';
  bar.className = 'nt-visitor-bar';
  bar.innerHTML = `<span>Mode visiteur</span><button type="button" data-visitor-signup>Créer mon compte gratuit</button>`;
  const view = document.getElementById('view');
  view.parentNode.insertBefore(bar, view);
}
function ntDemanderCompte(raison){
  if (typeof openSheet !== 'function'){ toast('Crée ton compte gratuit pour utiliser Nova.'); return; }
  openSheet(`<h3 id="sheetTitle">Crée ton compte gratuit</h3>
    <p>${esc(raison || 'Cette fonction utilise Nova.')} Avec l'offre gratuite : 5 analyses Nova AI par mois, NovaBot, Nova Review et ta liste de suivi.</p>
    <div class="nt-sheet-btns">
      <button class="nt-btn nt-btn-google" data-visitor-google>${GOOGLE_G} Continuer avec Google</button>
      <button class="nt-btn nt-btn-ghost" data-visitor-email>${svg(ICON.mail,2)} Continuer avec une adresse e-mail</button>
      <button class="nt-btn nt-btn-text" data-close>Plus tard</button>
    </div>`);
}
/* Actions qui consomment un jeton ou s'enregistrent sur le compte. */
const NT_VISITEUR_BLOQUE = [
  ['[data-nova]', "Les analyses Nova AI sont réservées aux comptes."],
  ['[data-novabot-chat-send]', 'Pour discuter avec NovaBot, il te faut un compte.'],
  ['[data-novabot-suggestion]', 'Pour discuter avec NovaBot, il te faut un compte.'],
  ['[data-novabot-ask]', 'Pour discuter avec NovaBot, il te faut un compte.'],
  ['[data-v2ask]', 'Pour discuter avec NovaBot, il te faut un compte.'],
  ['[data-nova-review-ia]', 'Le commentaire Nova AI de ta semaine demande un compte.'],
  ['[data-apply-nl-ai]', "La recherche par l'IA demande un compte."],
  ['[data-star]', 'Ta liste de suivi est enregistrée sur ton compte.'],
  ['[data-open-alerte]', 'Les alertes de prix sont enregistrées sur ton compte.'],
  ['[data-create-alerte]', 'Les alertes de prix sont enregistrées sur ton compte.'],
  ['[data-toggle-in-list]', 'Tes listes sont enregistrées sur ton compte.'],
  ['[data-plan]', 'Crée d’abord ton compte pour choisir une offre.'],
  ['[data-novabot-mandat-open]', 'Le mandat NovaBot est lié à ton compte.'],
  ['[data-novabot-run]', 'NovaBot travaille pour les comptes uniquement.'],
];
const estVisiteur = () => state.auth && state.auth.status === 'visitor';
document.addEventListener('click', e => {
  if (e.target.closest('[data-gate-visitor]')){ e.preventDefault(); enterVisitor(); return; }
  if (!estVisiteur()) return;
  if (e.target.closest('[data-visitor-signup]')){ e.preventDefault(); e.stopImmediatePropagation(); ntDemanderCompte('NovaTitre est plus utile avec ton compte.'); return; }
  if (e.target.closest('[data-visitor-google]')){ e.preventDefault(); e.stopImmediatePropagation(); signIn(); return; }
  if (e.target.closest('[data-visitor-email]')){
    e.preventDefault(); e.stopImmediatePropagation();
    quitterVisiteur(); openGateEmail('signup'); return;
  }
  if (e.target.closest('[data-signout]')){ e.preventDefault(); e.stopImmediatePropagation(); quitterVisiteur(); return; }
  for (const [sel, raison] of NT_VISITEUR_BLOQUE){
    if (e.target.closest(sel)){ e.preventDefault(); e.stopImmediatePropagation(); ntDemanderCompte(raison); return; }
  }
}, true);
/* Saisie : Entrée dans le champ NovaBot, formulaire "Écris à Nova…". */
document.addEventListener('keydown', e => {
  if (!estVisiteur() || e.key !== 'Enter') return;
  if (document.activeElement?.id === 'novabotChatInput'){
    e.preventDefault(); e.stopImmediatePropagation();
    ntDemanderCompte('Pour discuter avec NovaBot, il te faut un compte.');
  }
}, true);
document.addEventListener('submit', e => {
  if (!estVisiteur()) return;
  if (e.target.closest('[data-v2ask-form]')){
    e.preventDefault(); e.stopImmediatePropagation();
    ntDemanderCompte('Pour discuter avec NovaBot, il te faut un compte.');
  }
}, true);
/* Second filet : les fonctions elles-mêmes refusent en mode visiteur
   (installé au chargement complet, une fois tous les scripts définis). */
window.addEventListener('load', () => {
  const garder = (nom, raison) => {
    const f = window[nom];
    if (typeof f !== 'function' || f.__ntGarde) return;
    const g = function(...a){ if (estVisiteur()){ ntDemanderCompte(raison); return Promise.resolve(); } return f.apply(this, a); };
    g.__ntGarde = true;
    window[nom] = g;
  };
  garder('runAnalysis', "Les analyses Nova AI sont réservées aux comptes.");
  garder('novabotChatEnvoyer', 'Pour discuter avec NovaBot, il te faut un compte.');
  garder('novabotPoserQuestion', 'Pour discuter avec NovaBot, il te faut un compte.');
  garder('genererCommentaireNovaReview', 'Le commentaire Nova AI de ta semaine demande un compte.');
  garder('toggleWatch', 'Ta liste de suivi est enregistrée sur ton compte.');
  garder('startCheckout', 'Crée d’abord ton compte pour choisir une offre.');
});
