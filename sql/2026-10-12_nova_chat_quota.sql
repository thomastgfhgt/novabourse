-- ============================================================================
-- NovaBot V6 §8 — quota SÉPARÉ pour les messages de conversation simple
-- ============================================================================
--
-- Bug diagnostiqué : novabotChatAnalyse() (api/analyze.js) appelait
-- reserver(sb, user.id, plan) — EXACTEMENT le même compteur et la même
-- limite mensuelle ("analyses", 5 sur le plan free) que les analyses
-- NovaScore complètes d'une action. Résultat vérifié : envoyer "Coucou"
-- dans NovaBot consomme une des 5 analyses mensuelles du plan Découverte,
-- au même coût qu'une analyse financière complète — alors qu'un simple
-- échange conversationnel n'a rien d'une "analyse".
--
-- Ce fichier crée une table ET une fonction de réservation COMPLÈTEMENT
-- SÉPARÉES de ai_usage/reserve_analysis (jamais modifiées ici — leur
-- définition exacte n'est pas dans ce dépôt, les toucher à l'aveugle
-- risquerait de casser l'analyse NovaScore, le screener et NovaReview qui
-- en dépendent déjà et fonctionnent). Même mécanique (réservation
-- atomique en 'pending', clôturée en 'ok'/'cancelled'/'failed', expiration
-- des 'pending' abandonnés), appliquée à un compteur et une limite propres
-- aux messages de conversation.
--
-- Limites choisies (généreuses — un message de chat coûte beaucoup moins
-- qu'une analyse complète, maxTokens:500 contre des analyses bien plus
-- volumineuses) : à ajuster dans api/_limits.js (CHAT_LIMITS) sans
-- nouvelle migration si besoin.
--
-- IF NOT EXISTS / CREATE OR REPLACE partout : rejouable sans risque.
-- MARCHE À SUIVRE : Supabase -> SQL Editor -> New query -> coller -> Run.
-- ============================================================================

create table if not exists nova_chat_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  status text not null default 'pending'
    check (status in ('pending', 'ok', 'cancelled', 'failed')),

  provider text,
  model text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists nova_chat_usage_user_period_idx
  on nova_chat_usage (user_id, created_at);

alter table nova_chat_usage enable row level security;
-- Volontairement aucune policy : RLS activée + aucune policy = accès
-- refusé à tout le monde SAUF la clé service_role (api/_limits.js côté
-- serveur uniquement), exactement comme ai_usage.

-- ============================================================================
-- Réservation atomique — même contrat que reserve_analysis() :
--   p_user, p_limit (mensuel, null = illimité), p_period_start, p_period_end,
--   p_hourly_limit -> renvoie (granted boolean, used integer, id uuid, reason text)
-- Verrou transactionnel par utilisateur (pg_advisory_xact_lock sur le hash
-- de l'uuid) : deux messages envoyés quasi simultanément ne peuvent jamais
-- compter en double ni dépasser la limite.
-- ============================================================================
create or replace function reserve_chat_message(
  p_user uuid,
  p_limit integer,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_hourly_limit integer,
  p_provider text,
  p_model text
)
returns table (granted boolean, used integer, id uuid, reason text)
language plpgsql
as $$
declare
  v_used_period integer;
  v_used_hour integer;
  v_new_id uuid;
begin
  -- Sérialise les réservations concurrentes du MÊME utilisateur, sans
  -- bloquer les autres utilisateurs entre eux.
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  -- Nettoie les 'pending' abandonnés (fonction Vercel coupée avant
  -- clôture) de plus de 15 minutes : jamais une place bloquée pour
  -- toujours. Même seuil que PENDING_EXPIRE_MS (api/_limits.js).
  delete from nova_chat_usage
  where user_id = p_user
    and status = 'pending'
    and created_at < now() - interval '15 minutes';

  select count(*) into v_used_period
  from nova_chat_usage
  where user_id = p_user
    and status in ('pending', 'ok')
    and created_at >= p_period_start
    and created_at < p_period_end;

  if p_limit is not null and v_used_period >= p_limit then
    return query select false, v_used_period, null::uuid, 'quota_exceeded';
    return;
  end if;

  select count(*) into v_used_hour
  from nova_chat_usage
  where user_id = p_user
    and status in ('pending', 'ok')
    and created_at >= now() - interval '1 hour';

  if p_hourly_limit is not null and v_used_hour >= p_hourly_limit then
    return query select false, v_used_period, null::uuid, 'rate_limited';
    return;
  end if;

  insert into nova_chat_usage (user_id, status, provider, model)
  values (p_user, 'pending', p_provider, p_model)
  returning nova_chat_usage.id into v_new_id;

  return query select true, v_used_period + 1, v_new_id, null::text;
end;
$$;

-- ============================================================================
-- Fin du script. "Success. No rows returned" attendu dans Supabase.
-- ============================================================================
