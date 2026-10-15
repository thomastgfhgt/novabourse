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
</div>`;

async function chargerStatutAlpaca(){
  const carte = document.getElementById('alpacaStatusCard');
  if (!carte) return;
  try {
    const r = await authFetch('/api/admin/alpaca-status');
    const data = await r.json();

    if (r.status === 403){
      carte.innerHTML = `<p class="small">Accès refusé — ce compte n'est pas administrateur.</p>`;
      return;
    }
    if (data.status === 'disabled'){
      carte.innerHTML = `<p class="small">Fonctionnalité désactivée (TRADING_ENABLED=false).</p>`;
      return;
    }
    if (data.status === 'connected'){
      carte.innerHTML = `
        <div class="kv"><dt>État</dt><dd style="color:var(--up)">Connecté</dd></div>
        <div class="kv"><dt>Région</dt><dd>${esc(String(data.region || '—'))}</dd></div>
        <div class="kv"><dt>Environnement</dt><dd>${esc(String(data.env || '—'))}</dd></div>
        <div class="kv"><dt>Latence</dt><dd>${esc(String(data.latencyMs ?? '—'))} ms</dd></div>
        <div class="kv"><dt>Permissions vérifiées</dt><dd>${esc((data.permissionsVerified || []).join(', ') || 'aucune')}</dd></div>`;
      return;
    }
    carte.innerHTML = `<p class="small">Connexion indisponible${data.message ? ` (${esc(String(data.message))})` : ''}.</p>`;
  } catch {
    carte.innerHTML = `<p class="small">Connexion indisponible.</p>`;
  }
}
