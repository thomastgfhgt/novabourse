/**
 * api/_limits.js — offres de l'école et limite de messages de Nova Coach.
 *
 * Utilisé par /api/me (affichage) et /api/coach (application).
 *
 * OFFRES : 'free' (Découverte), 'premium', 'ecole' (Écoles / Entreprises,
 * prix à venir). L'offre est lue en base, jamais décidée par le navigateur.
 *
 * MESSAGES DU COACH : table nova_chat_usage et fonction Postgres
 * reserve_chat_message() (déjà en base, voir
 * sql/2026-10-12_nova_chat_quota.sql). Aucun changement de base.
 *
 * PÉRIODE : mois calendaire UTC.
 *
 * STATUTS d'un message :
 *   pending    réservation en cours
 *   ok         réponse reçue
 *   failed     appel échoué (non compté)
 */

const OFFRES = {
  free: {
    label: 'Découverte',
    coachParMois: 30,
  },

  premium: {
    label: 'Premium',
    coachParMois: 300,
  },

  ecole: {
    label: 'Écoles / Entreprises',
    coachParMois: 300,
  },
};

/* Protection anti-abus, quelle que soit l'offre. */
const COACH_PAR_HEURE = 20;

/* Statuts Stripe qui donnent accès à l'offre payante
   ('trialing' = essai gratuit de 7 jours). */
const ACTIFS = [
  'active',
  'trialing',
  'past_due',
];

/* =========================================================
   PÉRIODE
   ========================================================= */

function periode(now = new Date()) {
  const debut = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      1,
      0,
      0,
      0
    )
  );

  const fin = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      1,
      0,
      0,
      0
    )
  );

  return {
    debut,
    fin,
  };
}

/* =========================================================
   OFFRE RÉELLE
   ========================================================= */

async function planReel(sb, userId) {
  try {
    const rows = await sb(
      `profiles?id=eq.${encodeURIComponent(userId)}`
      + `&select=plan,subscription_status,subscription_current_period_end`
    );

    const profile = rows[0];

    if (!profile) {
      return {
        plan: 'free',
        status: null,
        raison: 'profil_absent',
      };
    }

    const dateFin = profile.subscription_current_period_end
      ? new Date(profile.subscription_current_period_end)
      : null;

    const dateFinValide =
      !dateFin ||
      (
        Number.isFinite(dateFin.getTime())
        && dateFin > new Date()
      );

    const actif =
      ACTIFS.includes(profile.subscription_status)
      && dateFinValide;

    if (!actif) {
      return {
        plan: 'free',
        status: profile.subscription_status || null,
        raison: 'abonnement_inactif',
      };
    }

    const plan =
      Object.prototype.hasOwnProperty.call(
        OFFRES,
        profile.plan
      )
        ? profile.plan
        : 'free';

    return {
      plan,
      status: profile.subscription_status,
      raison: null,
    };

  } catch {
    /*
     * Fail closed :
     * une panne de base ne donne jamais un accès payant.
     */
    return {
      plan: 'free',
      status: 'indisponible',
      raison: 'base_injoignable',
    };
  }
}

const limiteCoach = plan =>
  (OFFRES[plan] || OFFRES.free).coachParMois;

/* =========================================================
   MESSAGES DU COACH
   ========================================================= */

/* Messages comptés ce mois-ci (réservés ou réussis). */
async function consommationCoach(sb, userId) {
  const { debut, fin } = periode();

  const rows = await sb(
    `nova_chat_usage?user_id=eq.${encodeURIComponent(userId)}`
    + `&status=in.(pending,ok)`
    + `&created_at=gte.${encodeURIComponent(debut.toISOString())}`
    + `&created_at=lt.${encodeURIComponent(fin.toISOString())}`
    + `&select=id`
  );

  return rows.length;
}

/* Réserve une place AVANT d'appeler l'IA (verrou Postgres par élève :
   deux messages envoyés en même temps ne dépassent jamais la limite). */
async function reserverCoach(sb, userId, plan, model) {
  const { debut, fin } = periode();

  try {
    const r = await sb(
      'rpc/reserve_chat_message',
      {
        method: 'POST',
        body: JSON.stringify({
          p_user: userId,
          p_limit: limiteCoach(plan),
          p_period_start: debut.toISOString(),
          p_period_end: fin.toISOString(),
          p_hourly_limit: COACH_PAR_HEURE,
          p_provider: 'anthropic',
          p_model: model,
        }),
      }
    );

    const out = Array.isArray(r) ? r[0] : r;
    if (!out) return { ok: false, reason: 'reservation_indisponible' };

    if (!out.granted) {
      return { ok: false, reason: out.reason || 'quota_exceeded', used: out.used ?? null };
    }
    return { ok: true, used: out.used, reservationId: out.id };
  } catch (e) {
    return { ok: false, reason: 'reservation_indisponible' };
  }
}

async function cloturerCoach(sb, id, statut) {
  if (!id) return;
  await sb(
    `nova_chat_usage?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: statut, updated_at: new Date().toISOString() }),
    }
  ).catch(() => {});
}

/* Bloc renvoyé par /api/me. */
function coachBlock(plan, used) {
  const limite = limiteCoach(plan);
  const { debut, fin } = periode();
  return {
    used,
    limit: limite,
    remaining: Math.max(0, limite - used),
    perHour: COACH_PAR_HEURE,
    periodStart: debut.toISOString(),
    periodEnd: fin.toISOString(),
  };
}

module.exports = {
  OFFRES,
  ACTIFS,
  COACH_PAR_HEURE,

  periode,
  planReel,
  limiteCoach,

  consommationCoach,
  reserverCoach,
  cloturerCoach,
  coachBlock,
};
