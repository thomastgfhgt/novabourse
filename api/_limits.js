/**
 * api/_limits.js — SOURCE UNIQUE DES QUOTAS
 *
 * Utilisé par /api/me (affichage) et /api/analyze (application). Un seul
 * fichier définit les limites : les deux ne peuvent pas diverger.
 *
 * PÉRIODE : mois calendaire UTC. Du 1er à 00:00 UTC au 1er du mois suivant.
 * Le compteur repart donc seul au changement de mois, sans tâche planifiée.
 *
 * STATUTS DE ai_usage :
 *   pending    réservé avant l'appel — COMPTE (sinon deux clics passeraient)
 *   ok         analyse rendue        — COMPTE
 *   cancelled  appel non abouti      — NE COMPTE PAS (place rendue)
 *   failed     conservé pour audit   — NE COMPTE PAS
 *
 * Autrement dit : une analyse réellement lancée occupe une place ; une requête
 * qui n'a jamais atteint le fournisseur la restitue.
 */

const PLAN_LIMITS = {
  free:  { analyses: 5,        label: 'Découverte', showLimit: true },
  pro:   { analyses: 200,      label: 'Pro',        showLimit: true },
  /* Elite est réellement illimité au mois : aucun plafond mensuel, aucun
     nombre affiché. La seule protection est un débit horaire, qui vise
     l'automatisation abusive et reste hors de portée d'un usage humain. */
  elite: { analyses: Infinity, label: 'Elite',      showLimit: false },
};

/** Garde-fou anti-abus, indépendant du quota mensuel. */
const DEBIT_HORAIRE = { free: 10, pro: 40, elite: 120 };

const ACTIFS = ['active', 'trialing', 'past_due'];
const COMPTES = ['pending', 'ok'];          // statuts qui occupent une place

/* Une fonction Vercel qui meurt entre la réservation et la clôture laisse une
   ligne « pending » éternelle, qui retiendrait une analyse jusqu'au mois
   suivant. Au-delà de ce délai — très supérieur au temps maximal d'un appel
   au modèle — la place est restituée. */
const PENDING_EXPIRE_MS = 15 * 60 * 1000;

/* ---------- période ---------- */
function periode(now = new Date()){
  const debut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const fin   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return { debut, fin };
}

/* ---------- plan ----------
   Lu dans profiles, jamais reçu du navigateur. Tout ce qui n'est pas
   exactement 'pro' ou 'elite' avec un abonnement actif retombe sur free. */
async function planReel(sb, userId){
  try {
    const rows = await sb(`profiles?id=eq.${encodeURIComponent(userId)}`
      + `&select=plan,subscription_status,subscription_current_period_end`);
    const p = rows[0];
    if (!p) return { plan: 'free', status: null, raison: 'profil_absent' };

    const actif = ACTIFS.includes(p.subscription_status)
      && (!p.subscription_current_period_end
          || new Date(p.subscription_current_period_end) > new Date());
    if (!actif) return { plan: 'free', status: p.subscription_status || null,
      raison: 'abonnement_inactif' };

    // Un plan inconnu ou absent vaut free : jamais pro, jamais elite.
    const plan = Object.prototype.hasOwnProperty.call(PLAN_LIMITS, p.plan) ? p.plan : 'free';
    return { plan, status: p.subscription_status, raison: null };
  } catch (e){
    // Base injoignable : repli restrictif. Une panne n'ouvre pas d'accès.
    return { plan: 'free', status: 'indisponible', raison: 'base_injoignable' };
  }
}

const limiteDe = plan => (PLAN_LIMITS[plan] || PLAN_LIMITS.free).analyses;

/* ---------- consommation ---------- */
async function consommation(sb, userId){
  // Fenêtre bornée des deux côtés, comme dans reserve_analysis.
  const { debut, fin } = periode();
  const rows = await sb(`ai_usage?user_id=eq.${encodeURIComponent(userId)}`
    + `&created_at=gte.${debut.toISOString()}`
    + `&created_at=lt.${fin.toISOString()}`
    + `&status=in.(${COMPTES.join(',')})&select=id,status,created_at`);
  // Les réservations abandonnées ne comptent plus.
  const limite = Date.now() - PENDING_EXPIRE_MS;
  return rows.filter(r => r.status !== 'pending'
    || new Date(r.created_at).getTime() > limite).length;
}

/** Analyses de la dernière heure, pour le garde-fou de débit. */
async function debitRecent(sb, userId){
  const depuis = new Date(Date.now() - 3600000).toISOString();
  const rows = await sb(`ai_usage?user_id=eq.${encodeURIComponent(userId)}`
    + `&created_at=gte.${depuis}&status=in.(${COMPTES.join(',')})&select=id`);
  return rows.length;
}

/* ---------- réservation ATOMIQUE ----------
   Lire puis écrire laisse une fenêtre : deux requêtes simultanées peuvent lire
   le même compteur. On délègue donc la décision à Postgres, qui compte et
   insère dans une seule transaction (voir SQL-RESERVATION.sql).

   Retour : { ok, used, reservationId } ou { ok:false, reason }. */
async function reserver(sb, userId, plan){
  const { debut, fin } = periode();
  const limite = limiteDe(plan);
  try {
    const r = await sb('rpc/reserve_analysis', {
      method: 'POST',
      body: JSON.stringify({
        p_user: userId,
        // null = aucune limite mensuelle (Elite). Aucun plafond artificiel.
        p_limit: Number.isFinite(limite) ? limite : null,
        p_period_start: debut.toISOString(),
        p_period_end: fin.toISOString(),
        p_hourly_limit: DEBIT_HORAIRE[plan] || DEBIT_HORAIRE.free,
        p_provider: 'pending',
        p_model: 'pending',
      }),
    });
    const out = Array.isArray(r) ? r[0] : r;
    if (!out) return { ok: false, reason: 'reservation_indisponible' };
    if (!out.granted){
      return { ok: false, reason: out.reason || 'quota_exceeded', used: out.used ?? null };
    }
    return { ok: true, used: out.used, reservationId: out.id };
  } catch (e){
    // La fonction SQL n'existe pas encore, ou la base ne répond pas.
    return { ok: false, reason: 'reservation_indisponible', detail: e.message };
  }
}

/** Marque une réservation. statut : 'ok' | 'cancelled' | 'failed'. */
async function cloturer(sb, id, statut, extra = {}){
  if (!id) return;
  await sb(`ai_usage?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: statut, ...extra }),
  }).catch(() => {});
}

/* ---------- bloc renvoyé au frontend ---------- */
function quotaBlock(plan, used){
  const conf = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const { debut, fin } = periode();
  const illimite = !conf.showLimit || !Number.isFinite(conf.analyses);
  return {
    plan,
    used,
    limit: illimite ? null : conf.analyses,
    remaining: illimite ? null : Math.max(0, conf.analyses - used),
    unlimited: illimite,
    periodStart: debut.toISOString(),
    periodEnd: fin.toISOString(),
  };
}

module.exports = { PLAN_LIMITS, DEBIT_HORAIRE, ACTIFS, COMPTES, PENDING_EXPIRE_MS, periode, planReel,
  limiteDe, consommation, debitRecent, reserver, cloturer, quotaBlock };
