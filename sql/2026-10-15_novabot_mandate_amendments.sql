-- ============================================================================
-- NovaBot — commandes de mandat depuis le chat : audit log + statut "annulé"
-- ============================================================================
--
-- CONTEXTE (audit 2026-10-15) : NovaBot refuse aujourd'hui toute modification
-- du mandat depuis la conversation et redirige vers un réglage externe. Cette
-- migration ajoute UNIQUEMENT ce qui manque pour que la conversation puisse
-- proposer -> faire confirmer -> appliquer -> consigner un changement, en
-- réutilisant intégralement le versioning déjà existant de novabot_mandates
-- (append-only, is_current) — voir sql/2026-10-07_novabot_foundation.sql.
--
-- novabot_mandate_changes : UNE ligne par changement de mandat réellement
--   appliqué via la conversation (confirmation OU restauration d'une version
--   précédente) — audit léger. previous_mandate_id/new_mandate_id pointent
--   simplement les deux lignes déjà versionnées de novabot_mandates, le diff
--   se calcule en comparant leurs colonnes (api/me.js), jamais stocké en
--   double ici.
--
-- novabot_accounts.status : ajoute 'cancelled' (annulation EXPLICITE du
--   mandat, distincte de 'paused' — analyzing/waiting/error restent
--   réservées, inutilisées). Annuler ne touche JAMAIS wallet/positions,
--   uniquement ce statut (même mécanisme que 'paused' : le cron, qui ne lit
--   déjà que status=eq.active, ignore aussi 'cancelled' sans aucun
--   changement de son côté).
--
-- IF NOT EXISTS / DROP+ADD CONSTRAINT : rejouable sans risque, ne touche
-- aucune ligne existante (un compte 'active'/'paused'/'setup' n'est jamais
-- affecté par l'élargissement de la contrainte).
--
-- MARCHE À SUIVRE : Supabase -> SQL Editor -> New query -> coller -> Run.
-- ============================================================================

alter table novabot_accounts drop constraint if exists novabot_accounts_status_check;
alter table novabot_accounts add constraint novabot_accounts_status_check
  check (status in ('setup', 'active', 'paused', 'cancelled', 'analyzing', 'waiting', 'error'));

create table if not exists novabot_mandate_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references novabot_accounts(id) on delete cascade,

  -- Les deux versions déjà réelles dans novabot_mandates (append-only) —
  -- jamais une copie de leur contenu ici, uniquement le lien.
  previous_mandate_id uuid references novabot_mandates(id) on delete set null,
  new_mandate_id uuid not null references novabot_mandates(id) on delete cascade,

  -- 'chat' seule valeur pour l'instant — colonne texte plutôt qu'un simple
  -- boolean pour accueillir une future source sans nouvelle migration.
  source text not null default 'chat' check (source in ('chat')),

  -- Lien vers la conversation qui a produit ce changement — nullable.
  conversation_id uuid references nova_conversations(id) on delete set null,

  -- 'amendment' = changement proposé/confirmé par la conversation ;
  -- 'restore' = reprise d'une version antérieure (toujours une NOUVELLE
  -- ligne dans novabot_mandates, jamais une réécriture).
  kind text not null default 'amendment' check (kind in ('amendment', 'restore')),

  summary text not null,

  created_at timestamptz not null default now()
);

create index if not exists novabot_mandate_changes_account_idx
  on novabot_mandate_changes (account_id, created_at desc);

alter table novabot_mandate_changes enable row level security;
-- Volontairement aucune policy — même convention que les autres tables de
-- ce projet (service_role uniquement, via api/me.js).

-- ============================================================================
-- Fin du script.
-- ============================================================================
