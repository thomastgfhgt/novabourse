/* ============================================================
   NOVABOT SUR LE COMPTE ALPACA (admin, 2026-10-21)
   ============================================================
   Bloc ajouté à la page "Statut Alpaca" (administrateurs, Sandbox tant que
   la production n'est pas ouverte) : NovaBot analyse le VRAI compte lié et
   propose des achats et des ventes motivés ; en cas de chute forte il pose
   la question "veux-tu tout vendre ?". Rien n'est envoyé sans deux clics
   de l'utilisateur (choisir, puis confirmer). Le calcul est fait côté
   serveur (api/_alpaca/novabot-moteur.js) et refait juste avant chaque
   ordre. */

const NB_ALPACA = { etat: 'idle', data: null, armee: null, message: null };

function nbAlpacaBloc(){
  return `<h2 class="h2" style="margin-top:28px">NovaBot sur ce compte</h2>
  <p class="lead" style="margin-top:6px">Propositions motivées selon ton profil NovaBot. Aucun ordre sans ta confirmation.</p>
  <div class="card" style="margin-top:14px" id="nbAlpacaCard">${nbAlpacaContenu()}</div>`;
}

function nbAlpacaContenu(){
  const d = NB_ALPACA.data;
  if (NB_ALPACA.etat === 'loading') return `<p class="small">NovaBot analyse ton compte et le marché…</p>`;
  const bouton = `<button class="btn btn-a btn-sm" data-nb-alpaca-analyser>${d ? 'Actualiser l’analyse' : 'Analyser mon compte'}</button>`;
  if (!d) return `${NB_ALPACA.message ? `<p class="small" style="margin-bottom:12px">${esc(NB_ALPACA.message)}</p>` : ''}${bouton}`;
  const confirmer = (cle, libelle) => NB_ALPACA.armee === cle
    ? `<button class="btn btn-a btn-sm" data-nb-alpaca-confirmer="${esc(cle)}">Confirmer : ${esc(libelle)}</button>
       <button class="btn btn-g btn-sm" data-nb-alpaca-annuler>Annuler</button>`
    : `<button class="btn btn-s btn-sm" data-nb-alpaca-armer="${esc(cle)}">${esc(libelle)}</button>`;
  const proposition = (p) => {
    const cle = p.type + ':' + p.symbol;
    const montant = p.type === 'achat' ? `${fmt.num(p.notional, 2)} ${esc(d.devise || '')}` : `${fmt.num(p.qty, 4)} titre(s) · ≈ ${fmt.num(p.montantEstime, 2)}`;
    return `<div style="padding:12px 0;border-top:1px solid var(--line)">
      <p class="small" style="font-weight:700;color:#fff">${p.type === 'achat' ? 'Acheter' : 'Vendre'} ${esc(p.name)} (${esc(p.symbol)}) · ${montant}</p>
      <ul class="small" style="margin:6px 0 10px 18px">${p.raisons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${confirmer(cle, p.type === 'achat' ? 'Acheter' : 'Vendre')}</div></div>`;
  };
  const krach = d.krach && d.krach.declenche ? `<div class="notice" style="margin-bottom:14px;border:1px solid rgba(255,107,107,.35)">
      <b>${esc(d.krach.question)}</b>
      <ul style="margin:8px 0 10px 18px">${d.krach.raisons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${NB_ALPACA.armee === 'tout'
        ? `<button class="btn btn-a btn-sm" data-nb-alpaca-tout-vendre>Confirmer : tout vendre</button><button class="btn btn-g btn-sm" data-nb-alpaca-annuler>Annuler</button>`
        : `<button class="btn btn-s btn-sm" data-nb-alpaca-armer="tout">Oui, tout vendre</button><button class="btn btn-g btn-sm" data-nb-alpaca-garder>Non, je garde</button>`}</div></div>` : '';
  const liste = [...(d.ventes || []), ...(d.achats || [])];
  return `${krach}
    <p class="tiny" style="margin-bottom:8px">Profil appliqué : risque ${esc({ low:'faible', moderate:'modéré', high:'élevé' }[d.regles.niveau] || d.regles.niveau)} · seuil Nova Score ${d.regles.scoreAchat} · protection à −${d.regles.stopLossPct} % · max ${d.regles.maxPositionPct} % par valeur · ${d.regles.cashMinPct} % de liquidités gardées.</p>
    ${liste.length ? liste.map(proposition).join('') : `<p class="small" style="padding:8px 0">Rien à faire pour l'instant : aucune position à vendre et aucune entreprise ne remplit tous tes critères aujourd'hui.</p>`}
    ${NB_ALPACA.message ? `<p class="small" style="margin-top:10px">${esc(NB_ALPACA.message)}</p>` : ''}
    <div style="margin-top:14px">${bouton}</div>
    <p class="tiny" style="margin-top:10px">Propositions calculées automatiquement à partir de données réelles, pas un conseil en investissement personnalisé. Investir comporte un risque de perte en capital.</p>`;
}

function nbAlpacaPeindre(){
  const el = document.getElementById('nbAlpacaCard');
  if (el) el.innerHTML = nbAlpacaContenu();
}

async function nbAlpacaAppel(action, corps){
  const r = await authFetch(`/api/me?resource=alpaca&action=${action}`, {
    method: 'POST',
    body: JSON.stringify({ ...corps, profil: typeof novabotProfilLire === 'function' ? novabotProfilLire() : {} }),
  });
  return r.json();
}

async function nbAlpacaAnalyser(){
  NB_ALPACA.etat = 'loading'; NB_ALPACA.armee = null; NB_ALPACA.message = null; nbAlpacaPeindre();
  try {
    const d = await nbAlpacaAppel('novabot-propositions', {});
    NB_ALPACA.etat = 'idle';
    if (d.status === 'ok'){ NB_ALPACA.data = d; }
    else { NB_ALPACA.data = null; NB_ALPACA.message = d.status === 'not_linked' ? 'Aucun compte Alpaca lié.' : 'Analyse impossible : ' + (d.message || d.error || d.status); }
  } catch {
    NB_ALPACA.etat = 'idle'; NB_ALPACA.message = 'Analyse impossible pour le moment.';
  }
  nbAlpacaPeindre();
}

document.addEventListener('click', async (e) => {
  const q = s => e.target.closest(s);
  if (q('[data-nb-alpaca-analyser]')){ nbAlpacaAnalyser(); return; }
  const armer = q('[data-nb-alpaca-armer]');
  if (armer){ NB_ALPACA.armee = armer.dataset.nbAlpacaArmer; nbAlpacaPeindre(); return; }
  if (q('[data-nb-alpaca-annuler]')){ NB_ALPACA.armee = null; nbAlpacaPeindre(); return; }
  if (q('[data-nb-alpaca-garder]')){ NB_ALPACA.data.krach = null; NB_ALPACA.message = 'Compris : NovaBot garde tes positions.'; nbAlpacaPeindre(); return; }
  const conf = q('[data-nb-alpaca-confirmer]');
  if (conf){
    const [type, symbol] = conf.dataset.nbAlpacaConfirmer.split(':');
    conf.disabled = true;
    const d = await nbAlpacaAppel('novabot-executer', { type, symbol, confirme: true }).catch(() => ({ status: 'error' }));
    NB_ALPACA.armee = null;
    NB_ALPACA.message = d.status === 'submitted' ? `Ordre envoyé : ${type === 'achat' ? 'achat' : 'vente'} ${symbol} (statut ${d.order?.status || 'transmis'}).`
      : d.status === 'plus_valable' ? d.message : 'Ordre refusé : ' + (d.alpacaBody?.message || d.message || d.status);
    nbAlpacaPeindre();
    if (d.status === 'submitted') setTimeout(nbAlpacaAnalyser, 1500);
    return;
  }
  if (q('[data-nb-alpaca-tout-vendre]')){
    const d = await nbAlpacaAppel('novabot-tout-vendre', { confirmation: 'TOUT_VENDRE' }).catch(() => ({ status: 'error' }));
    NB_ALPACA.armee = null;
    NB_ALPACA.message = d.status === 'submitted' ? `Vente de toutes les positions envoyée (${d.positions} position(s)).` : 'Vente impossible : ' + (d.alpacaBody?.message || d.message || d.status);
    nbAlpacaPeindre();
    if (d.status === 'submitted') setTimeout(nbAlpacaAnalyser, 2000);
  }
});
