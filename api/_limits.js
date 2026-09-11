/**
 * api/_limits.js — SOURCE UNIQUE DES QUOTAS
 *
 * Utilisé par /api/me (affichage) et /api/analyze (application).
 *
 * PÉRIODE : mois calendaire UTC.
 *
 * STATUTS :
 *   pending    réservation en cours
 *   ok         analyse terminée
 *   cancelled  appel annulé
 *   failed     appel échoué
 */

const PLAN_LIMITS = {
  free: {
    analyses: 5,
    label: 'Découverte',
    showLimit: true,
  },

  pro: {
    analyses: 200,
    label: 'Pro',
    showLimit: true,
  },

  elite: {
    analyses: Infinity,
    label: 'Elite',
    showLimit: false,
  },
};

/**
 * Protection anti-abus indépendante du quota mensuel.
 */
const DEBIT_HORAIRE = {
  free: 10,
  pro: 40,
  elite: 120,
};

const ACTIFS = [
  'active',
  'trialing',
  'past_due',
];

const COMPTES = [
  'pending',
  'ok',
];

/**
 * Une réservation Vercel abandonnée ne doit pas bloquer
 * définitivement une place.
 *
 * Cette durée DOIT rester synchronisée avec reserve_analysis()
 * dans PostgreSQL.
 */
const PENDING_EXPIRE_MS = 15 * 60 * 1000;

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
   PLAN RÉEL
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
        PLAN_LIMITS,
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

const limiteDe = plan =>
  (PLAN_LIMITS[plan] || PLAN_LIMITS.free).analyses;

/* =========================================================
   PENDING VALIDE
   ========================================================= */

function pendingEncoreValide(row, maintenant = Date.now()) {
  if (row.status !== 'pending') {
    return true;
  }

  const created = new Date(row.created_at).getTime();

  /*
   * Une date invalide ne doit pas pouvoir occuper
   * indéfiniment une place.
   */
  if (!Number.isFinite(created)) {
    return false;
  }

  return created > maintenant - PENDING_EXPIRE_MS;
}

/* =========================================================
   CONSOMMATION MENSUELLE
   ========================================================= */

async function consommation(sb, userId) {
  const { debut, fin } = periode();

  const rows = await sb(
    `ai_usage?user_id=eq.${encodeURIComponent(userId)}`
    + `&created_at=gte.${debut.toISOString()}`
    + `&created_at=lt.${fin.toISOString()}`
    + `&status=in.(${COMPTES.join(',')})`
    + `&select=id,status,created_at`
  );

  const maintenant = Date.now();

  return rows.filter(
    row => pendingEncoreValide(row, maintenant)
  ).length;
}

/* =========================================================
   DÉBIT RÉCENT
   ========================================================= */

async function debitRecent(sb, userId) {
  const depuis =
    new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const rows = await sb(
    `ai_usage?user_id=eq.${encodeURIComponent(userId)}`
    + `&created_at=gte.${depuis}`
    + `&status=in.(${COMPTES.join(',')})`
    + `&select=id,status,created_at`
  );

  const maintenant = Date.now();

  return rows.filter(
    row => pendingEncoreValide(row, maintenant)
  ).length;
}

/* =========================================================
   RÉSERVATION ATOMIQUE
   ========================================================= */

async function reserver(sb, userId, plan) {
  const { debut, fin } = periode();

  const limite = limiteDe(plan);

  try {
    const r = await sb(
      'rpc/reserve_analysis',
      {
        method: 'POST',

        body: JSON.stringify({
          p_user: userId,

          /*
           * NULL = pas de plafond mensuel.
           */
          p_limit:
            Number.isFinite(limite)
              ? limite
              : null,

          p_period_start:
            debut.toISOString(),

          p_period_end:
            fin.toISOString(),

          p_hourly_limit:
            DEBIT_HORAIRE[plan]
            || DEBIT_HORAIRE.free,

          p_provider: 'pending',
          p_model: 'pending',
        }),
      }
    );

    const out =
      Array.isArray(r)
        ? r[0]
        : r;

    if (!out) {
      return {
        ok: false,
        reason: 'reservation_indisponible',
      };
    }

    if (!out.granted) {
      return {
        ok: false,
        reason:
          out.reason
          || 'quota_exceeded',

        used:
          out.used
          ?? null,
      };
    }

    return {
      ok: true,
      used: out.used,
      reservationId: out.id,
    };

  } catch (e) {
    return {
      ok: false,
      reason: 'reservation_indisponible',
      detail: e.message,
    };
  }
}

/* =========================================================
   CLÔTURE
   ========================================================= */

async function cloturer(
  sb,
  id,
  statut,
  extra = {}
) {
  if (!id) {
    return;
  }

  await sb(
    `ai_usage?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',

      headers: {
        Prefer: 'return=minimal',
      },

      body: JSON.stringify({
        status: statut,
        ...extra,
      }),
    }
  ).catch(() => {});
}

/* =========================================================
   BLOC FRONTEND
   ========================================================= */

function quotaBlock(plan, used) {
  const conf =
    PLAN_LIMITS[plan]
    || PLAN_LIMITS.free;

  const { debut, fin } = periode();

  const unlimited =
    !conf.showLimit
    || !Number.isFinite(conf.analyses);

  return {
    plan,

    used,

    limit:
      unlimited
        ? null
        : conf.analyses,

    remaining:
      unlimited
        ? null
        : Math.max(
            0,
            conf.analyses - used
          ),

    unlimited,

    periodStart:
      debut.toISOString(),

    periodEnd:
      fin.toISOString(),
  };
}

module.exports = {
  PLAN_LIMITS,
  DEBIT_HORAIRE,
  ACTIFS,
  COMPTES,
  PENDING_EXPIRE_MS,

  periode,
  planReel,
  limiteDe,

  consommation,
  debitRecent,

  reserver,
  cloturer,

  quotaBlock,
};
