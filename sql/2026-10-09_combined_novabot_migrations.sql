-- ============================================================================
-- NovaBot — script combiné à exécuter en une fois dans Supabase SQL Editor
-- ============================================================================
--
-- Ce fichier est la concaténation, DANS L'ORDRE, des trois migrations
-- existantes de ce dossier :
--   1) sql/2026-10-05_nova_core_conversations.sql
--   2) sql/2026-10-07_novabot_foundation.sql
--   3) sql/2026-10-08_novabot_decisions.sql
--
-- Créé le 2026-10-09 uniquement pour simplifier l'exécution manuelle (un
-- seul copier-coller au lieu de trois) — ne remplace pas les fichiers
-- d'origine, qui restent la référence documentée (commentaires complets
-- sur le "pourquoi" de chaque choix de schéma).
--
-- Sans risque pour les données existantes : chaque create table/index est
-- IF NOT EXISTS. Sur une base où ces tables n'existent pas encore, ce
-- script les crée simplement. Le rejouer plus tard ne supprime ni
-- n'écrase rien, dans ces tables ou ailleurs dans la base.
--
-- Sécurité : RLS activée sur les 7 tables, AUCUNE policy — accès refusé à
-- tout le monde sauf la clé service_role (utilisée uniquement côté
-- serveur, dans api/me.js, après vérification du jeton de l'utilisateur).
-- Jamais accessible depuis le frontend via la clé anon.
--
-- Ordre obligatoire : novabot_decisions (3) référence novabot_accounts
-- (2) par clé étrangère ; nova_conversations/nova_messages (1) sont
-- indépendantes et peuvent passer en premier ou en dernier, sans
-- incidence.
-- ============================================================================


-- ============================================================================
-- 1/3 — Nova Core : conversations et messages
-- (sql/2026-10-05_nova_core_conversations.sql)
-- ============================================================================

create table if not exists nova_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- 'novabot' | 'novareview' | 'novanews' | 'novaevent' | 'stock' |
  -- 'portfolio' | 'general' — jamais une liste fermée en base (check
  -- volontairement absent) : un nouveau module Nova ne doit pas nécessiter
  -- de migration, seulement un nouvel appelant côté application.
  module text not null,

  -- Titre affiché dans l'historique. Null tant qu'aucun titre n'a été
  -- déduit/saisi — jamais une valeur inventée ("Nouvelle conversation")
  -- qui masquerait l'absence réelle.
  title text,

  -- Contexte structuré capturé à l'ouverture (ex. {"type":"stock",
  -- "stockId":"AAPL-NAS"}). Jamais réécrit après coup par un message
  -- suivant.
  context jsonb,

  created_at timestamptz not null default now(),
  -- Mis à jour à chaque nouveau message : colonne de tri de l'historique,
  -- pas created_at, pour que les conversations reprises remontent en haut.
  updated_at timestamptz not null default now()
);

create index if not exists nova_conversations_user_idx
  on nova_conversations (user_id, updated_at desc);

create table if not exists nova_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references nova_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,

  -- Fournisseur/modèle/tokens/coût pour un message 'assistant'. Null pour
  -- un message 'user'. Jamais affiché à l'utilisateur final.
  metadata jsonb,

  created_at timestamptz not null default now()
);

create index if not exists nova_messages_conversation_idx
  on nova_messages (conversation_id, created_at);

alter table nova_conversations enable row level security;
alter table nova_messages enable row level security;
-- Volontairement aucune policy : RLS activée + aucune policy = accès
-- refusé à tout le monde SAUF la clé service_role.


-- ============================================================================
-- 2/3 — NovaBot : fondation (compte, mandat, transactions, snapshots)
-- (sql/2026-10-07_novabot_foundation.sql)
-- ============================================================================

create table if not exists novabot_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,

  -- SETUP (mandat pas encore confirmé) -> ACTIVE -> PAUSED. ANALYZING/
  -- WAITING/ERROR : valeurs réservées pour le pipeline de décision.
  status text not null default 'setup'
    check (status in ('setup', 'active', 'paused', 'analyzing', 'waiting', 'error')),

  -- Mode d'autonomie : 'advice' (propose, l'utilisateur confirme),
  -- 'semi_auto', 'auto'. Par défaut le plus prudent.
  autonomy_mode text not null default 'advice'
    check (autonomy_mode in ('advice', 'semi_auto', 'auto')),

  -- Capital confié à la création — informatif seulement : la vérité du
  -- cash/des positions vient TOUJOURS du rejeu de novabot_transactions.
  initial_capital numeric not null check (initial_capital >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists novabot_mandates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references novabot_accounts(id) on delete cascade,

  -- Append-only : chaque modification insère une NOUVELLE ligne plutôt
  -- que d'écraser la précédente (is_current distingue la version active)
  -- — donne l'historique complet des mandats "gratuitement".
  is_current boolean not null default true,

  objective text,                          -- 'growth' | 'income' | 'preserve' | null
  horizon_years numeric,
  risk_level text,                         -- 'low' | 'moderate' | 'high'
  max_drawdown_pct numeric,
  cash_min_pct numeric not null default 20,
  max_position_pct numeric not null default 10,
  max_positions_count integer,

  -- Préférences (jamais bloquantes) vs hard rules (jamais violables) —
  -- deux colonnes jsonb séparées pour que cette distinction ne se perde
  -- jamais. Forme : tableau d'objets {type, value, note?}.
  preferences jsonb not null default '[]'::jsonb,
  hard_rules jsonb not null default '[]'::jsonb,

  allowed_regions jsonb,                   -- ["Europe","Amérique du Nord",...] ou null = aucune restriction
  currencies jsonb,

  benchmark text,                          -- ex. "^GSPC"

  notes text,                              -- champ libre pour une règle personnalisée non structurée

  created_at timestamptz not null default now()
);

create index if not exists novabot_mandates_current_idx
  on novabot_mandates (account_id) where is_current;

-- Copie conforme de portfolio_transactions — seule différence : account_id
-- en plus. 'deposit'/'withdraw' réutilisés tels quels pour le capital
-- confié/retiré (jamais comptés comme performance).
create table if not exists novabot_transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references novabot_accounts(id) on delete cascade,

  stock_id text,
  ticker text,
  name text,

  type text not null check (type in ('buy', 'sell', 'deposit', 'withdraw', 'fee')),

  qty numeric check (qty > 0),
  price_local numeric check (price_local >= 0),
  currency text,
  amount_eur numeric not null,
  realized_gain numeric,

  -- Lien vers la décision qui a produit cette transaction. text, pas
  -- uuid : même id généré côté client que novabot_decisions.id. Pas de
  -- contrainte de clé étrangère ici volontairement — cette migration
  -- peut être exécutée avant celle qui crée novabot_decisions. Nullable :
  -- une transaction de fondation (dépôt initial) n'a logiquement aucune
  -- décision associée.
  decision_id text,

  -- Motif texte lisible, conservé même une fois decision_id en usage.
  reason text,

  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists novabot_transactions_user_idx
  on novabot_transactions (user_id, occurred_at);
create index if not exists novabot_transactions_account_idx
  on novabot_transactions (account_id, occurred_at);

-- Copie conforme de portfolio_snapshots.
create table if not exists novabot_portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references novabot_accounts(id) on delete cascade,

  occurred_at timestamptz not null,
  total_value numeric not null,
  cash numeric not null,
  invested_value numeric not null,
  net_deposits numeric,
  unrealized_pnl numeric,
  realized_pnl numeric,
  reason text,

  received_at timestamptz not null default now(),
  unique (account_id, occurred_at)
);

create index if not exists novabot_snapshots_user_idx
  on novabot_portfolio_snapshots (user_id, occurred_at);

alter table novabot_accounts enable row level security;
alter table novabot_mandates enable row level security;
alter table novabot_transactions enable row level security;
alter table novabot_portfolio_snapshots enable row level security;
-- Volontairement aucune policy : RLS activée + aucune policy = accès
-- refusé à tout le monde SAUF la clé service_role.


-- ============================================================================
-- 3/3 — NovaBot : journal des décisions
-- (sql/2026-10-08_novabot_decisions.sql)
-- ============================================================================

create table if not exists novabot_decisions (
  -- text, pas uuid : id STABLE généré côté client — sert de clé d'upsert
  -- idempotente, un rejeu après coupure réseau ne crée jamais de doublon.
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references novabot_accounts(id) on delete cascade,

  -- Les 7 actions possibles. REJECT = une transaction envisagée puis
  -- refusée par le Mandate/Risk Engine — gardée ici, jamais silencieusement
  -- avalée.
  action text not null check (action in ('buy', 'sell', 'hold', 'increase', 'reduce', 'watch', 'reject')),

  stock_id text,
  ticker text,
  name text,

  -- Chiffres observés AU MOMENT de la décision — jamais recalculés après
  -- coup à partir du cours actuel.
  price_observed numeric,
  qty numeric,
  amount_eur numeric,
  weight_before_pct numeric,
  weight_after_pct numeric,
  cash_before numeric,
  cash_after numeric,

  reason text not null,

  -- Traçabilité : snapshot JSON de ce qui a produit la décision — jamais
  -- recalculé rétroactivement avec des données d'aujourd'hui.
  data_used jsonb,
  mandate_snapshot jsonb,
  risk_result jsonb,
  relevant_news jsonb,
  relevant_event jsonb,

  -- IA : null pour une décision purement déterministe, rempli une fois le
  -- raisonnement LLM introduit.
  ai_provider text,
  ai_model text,
  confidence numeric,

  -- 'pending' : en mode "conseil"/"semi-autonome", un achat approuvé par
  -- le Risk Engine attend l'accord explicite de l'utilisateur avant de
  -- devenir 'simulated'.
  execution_status text not null default 'simulated'
    check (execution_status in ('simulated', 'skipped', 'rejected', 'pending')),

  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists novabot_decisions_account_idx
  on novabot_decisions (account_id, occurred_at desc);
create index if not exists novabot_decisions_stock_idx
  on novabot_decisions (account_id, stock_id, occurred_at desc);

alter table novabot_decisions enable row level security;
-- Volontairement aucune policy — service_role uniquement, via api/me.js.

-- ============================================================================
-- Fin du script. "Success. No rows returned" attendu dans Supabase.
-- ============================================================================
