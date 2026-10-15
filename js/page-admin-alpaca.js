/* ---------- STATUT ALPACA (admin, Phase 2) ----------
   Page de test de connexion (§2 de la mission "Alpaca Sandbox Trading") —
   visible dans l'UI pour quiconque (comme tout autre écran du Compte),
   mais la vraie protection est CÔTÉ SERVEUR (api/admin/alpaca-status.js :
   TRADING_ENABLED + TRADING_ADMIN_EMAILS) — un non-admin voit simplement
   "Accès refusé", jamais une donnée réelle. Rien n'est jamais inventé ici :
   l'état affiché est TOUJOURS la réponse serveur telle quelle. */
PAGES.alpacaStatus = () => `<div class="page-in">
  <p class="eyebrow">Admin</p>
  <h1 class="title">Statut Alpaca</h1>
  <p class="lead" style="margin-top:10px">Test de connexion au Broker API Sandbox — jamais d'argent réel.</p>
  <div class="card" style="margin-top:22px" id="alpacaStatusCard">
    <p class="small" style="color:var(--ink-4)">Vérification en cours…</p>
  </div>

  <h2 class="h2" style="margin-top:28px">Mon compte Sandbox</h2>
  <p class="lead" style="margin-top:6px">Badge obligatoire — <strong>simulation, argent fictif</strong>, jamais un vrai courtage.</p>
  <div class="card" style="margin-top:14px" id="alpacaAccountCard">
    <p class="small" style="color:var(--ink-4)">Chargement…</p>
  </div>
</div>`;

async function chargerStatutAlpaca(){
  const carte = document.getElementById('alpacaStatusCard');
  if (carte){
    try {
      const r = await authFetch('/api/admin/alpaca-status');
      const data = await r.json();

      if (r.status === 403){
        carte.innerHTML = `<p class="small">Accès refusé — ce compte n'est pas administrateur.</p>`;
      } else if (data.status === 'disabled'){
        carte.innerHTML = `<p class="small">Fonctionnalité désactivée (TRADING_ENABLED=false).</p>`;
      } else if (data.status === 'connected'){
        carte.innerHTML = `
          <div class="kv"><dt>État</dt><dd style="color:var(--up)">Connecté</dd></div>
          <div class="kv"><dt>Région</dt><dd>${esc(String(data.region || '—'))}</dd></div>
          <div class="kv"><dt>Environnement</dt><dd>${esc(String(data.env || '—'))}</dd></div>
          <div class="kv"><dt>Latence</dt><dd>${esc(String(data.latencyMs ?? '—'))} ms</dd></div>
          <div class="kv"><dt>Permissions vérifiées</dt><dd>${esc((data.permissionsVerified || []).join(', ') || 'aucune')}</dd></div>`;
      } else {
        carte.innerHTML = `<p class="small">Connexion indisponible${data.message ? ` (${esc(String(data.message))})` : ''}.</p>`;
      }
    } catch {
      carte.innerHTML = `<p class="small">Connexion indisponible.</p>`;
    }
  }
  await chargerCompteAlpaca();
}

async function chargerCompteAlpaca(){
  const carte = document.getElementById('alpacaAccountCard');
  if (!carte) return;
  try {
    const r = await authFetch('/api/admin/alpaca-account');
    const data = await r.json();

    if (r.status === 403){
      carte.innerHTML = `<p class="small">Accès refusé.</p>`;
      return;
    }
    if (data.status === 'not_linked'){
      carte.innerHTML = `
        <p class="small" style="margin-bottom:12px">Aucun compte lié. Le compte de test créé le 2026-10-15 (John Doe, Sandbox) peut être lié à ton compte NovaTitre pour continuer les vérifications.</p>
        <button class="btn btn-a btn-sm" data-alpaca-lier>Lier le compte de test</button>`;
      return;
    }
    if (data.status === 'linked'){
      carte.innerHTML = `
        <div class="kv"><dt>Numéro de compte</dt><dd>${esc(String(data.accountNumber || '—'))}</dd></div>
        <div class="kv"><dt>Statut</dt><dd>${esc(String(data.accountStatus || '—'))}</dd></div>
        <div class="kv"><dt>Pouvoir d'achat</dt><dd>${esc(String(data.buyingPower ?? '—'))} ${esc(String(data.currency || ''))}</dd></div>
        <div class="kv"><dt>Liquidités</dt><dd>${esc(String(data.cash ?? '—'))} ${esc(String(data.currency || ''))}</dd></div>
        <div class="kv"><dt>Valeur du portefeuille</dt><dd>${esc(String(data.portfolioValue ?? '—'))} ${esc(String(data.currency || ''))}</dd></div>`;
      return;
    }
    carte.innerHTML = `<p class="small">Indisponible${data.message ? ` (${esc(String(data.message))})` : ''}.</p>`;
  } catch {
    carte.innerHTML = `<p class="small">Indisponible.</p>`;
  }
}

async function alpacaLierCompteTest(){
  const bouton = document.querySelector('[data-alpaca-lier]');
  if (bouton) bouton.disabled = true;
  try {
    const r = await authFetch('/api/admin/alpaca-link-account', {
      method: 'POST',
      body: JSON.stringify({ alpacaAccountId: 'b272cbc1-71b4-41c8-9aa5-26d8a12efcad' }),
    });
    const data = await r.json();
    if (data.status !== 'linked'){
      toast('Liaison impossible : ' + (data.message || data.status || 'erreur inconnue'));
      if (bouton) bouton.disabled = false;
      return;
    }
    toast('Compte lié.');
    await chargerCompteAlpaca();
  } catch {
    toast('Liaison impossible.');
    if (bouton) bouton.disabled = false;
  }
}
