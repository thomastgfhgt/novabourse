-- ============================================================================
-- NovaBot V5 Phase A — colonne d'archivage des conversations
-- ============================================================================
--
-- Demande explicite (§2) : "Permettre de [...] supprimer et archiver les
-- conversations." nova_conversations (sql/2026-10-05_nova_core_conversations
-- .sql) n'avait aucune colonne pour distinguer une conversation active d'une
-- conversation archivée — archiver nécessite donc ce petit ajout de schéma,
-- il n'existe aucun moyen de le faire sans toucher la base.
--
-- IF NOT EXISTS : sans risque, rejouable, ne touche aucune donnée existante
-- (toute ligne déjà présente devient simplement archived=false, jamais
-- archivée par surprise).
--
-- MARCHE À SUIVRE : Supabase -> SQL Editor -> New query -> coller -> Run.
-- ============================================================================

alter table nova_conversations
  add column if not exists archived boolean not null default false;

create index if not exists nova_conversations_user_archived_idx
  on nova_conversations (user_id, archived, updated_at desc);
