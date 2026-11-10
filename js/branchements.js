/* ============================================================
   NOVATITRE — BRANCHEMENTS DU VRAI SITE
   ------------------------------------------------------------
   Chargé après /api/config?format=js (window.NT_SB) et la
   bibliothèque Supabase, avant js/ai.js et js/app.js.

   1. Connexion : window.NT_AUTH = { mode: 'supabase', client }
      (docs/CONNEXION.md, branchement A). Le client utilise la clé
      publique « anon » de Supabase, protégée par les règles RLS.
   2. Coach : window.NT_AI_ENDPOINT = '/api/coach'. Le jeton de
      connexion est ajouté aux seuls appels vers /api/coach : le
      serveur s'en sert pour compter les messages. Ni nom ni e-mail
      ne partent vers l'IA.
   3. Paiement : window.NT_PAY (statut, payer, gérer), utilisé par
      js/app.js. Le paiement passe par Stripe (mode test tant que le
      serveur l'impose) ; l'offre est toujours lue sur le serveur.

   Sans configuration (fichier ouvert hors du site, aperçu local),
   rien n'est déclaré : le site garde son fonctionnement local.
   ============================================================ */
(function(){
  'use strict';

  const SB = window.NT_SB;
  if (!SB || !SB.url || !SB.key || !window.supabase || typeof window.supabase.createClient !== 'function') return;

  const client = window.supabase.createClient(SB.url, SB.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'novatitre-auth' },
  });

  window.NT_AUTH = { mode: 'supabase', client };
  window.NT_AI_ENDPOINT = '/api/coach';

  async function jeton(){
    try { const { data } = await client.auth.getSession(); return (data && data.session && data.session.access_token) || null; }
    catch (e){ return null; }
  }

  /* Ajoute le jeton aux seuls appels vers /api/coach DE CE SITE (faits
     par js/ai.js) : jamais vers une autre adresse. */
  const fetchOrigine = window.fetch.bind(window);
  window.fetch = async function(entree, init){
    const url = typeof entree === 'string' ? entree : (entree && entree.url) || '';
    let cible = null;
    try { cible = new URL(url, location.href); } catch (e){}
    if (!cible || cible.origin !== location.origin || cible.pathname !== window.NT_AI_ENDPOINT) return fetchOrigine(entree, init);
    const t = await jeton();
    const headers = new Headers((init && init.headers) || {});
    if (t) headers.set('Authorization', 'Bearer ' + t);
    return fetchOrigine(entree, Object.assign({}, init, { headers }));
  };

  async function api(chemin, corps){
    const t = await jeton();
    if (!t){ const e = new Error('non_connecte'); e.status = 401; throw e; }
    const r = await fetchOrigine(chemin, {
      method: corps ? 'POST' : 'GET',
      headers: Object.assign({ Authorization: 'Bearer ' + t }, corps ? { 'Content-Type': 'application/json' } : {}),
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok){ const e = new Error(d.error || 'http_' + r.status); e.status = r.status; throw e; }
    return d;
  }

  window.NT_PAY = {
    /* Offre réelle de l'élève connecté, ou null sans compte. */
    async statut(){ return (await jeton()) ? api('/api/me') : null; },
    /* Ouvre le paiement Stripe ('mensuel' ou 'annuel'). */
    async payer(plan){ const d = await api('/api/stripe/create-checkout-session', { plan }); if (d.url) location.href = d.url; },
    /* Ouvre l'espace client Stripe (« Gérer mon abonnement »). */
    async gerer(){ const d = await api('/api/stripe/create-portal-session', {}); if (d.url) location.href = d.url; },
  };
})();
