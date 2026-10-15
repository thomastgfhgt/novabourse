-- ============================================================================
-- Alpaca Broker API (Sandbox) — Phase 2, fondations (mission "Alpaca
-- Sandbox Trading"). Comptes/positions/ordres RÉELS Sandbox, distincts du
-- portefeuille fictif existant (portfolio_transactions/portfolio_snapshots,
-- voir sql/2026-09-24_portfolio_persistence.sql) — ce dernier reste en
-- place pendant la bascule, voir décision utilisateur du 2026-10-15.
--
-- Source de vérité : Alpaca, toujours. Ces tables ne sont qu'un cache/
-- journal local, jamais une base de calcul du solde — en cas d'écart,
-- Alpaca gagne (§5.1 de la mission).
--
-- Sécurité : RLS activée, AUCUNE policy définie — même convention que
-- portfolio_transactions/portfolio_snapshots/market_catalog_*. Seule
-- SUPABASE_SERVICE_ROLE_KEY (utilisée exclusivement côté serveur, après
-- vérification du jeton utilisateur via /auth/v1/user) peut lire/écrire.
-- La clé anon publique n'a aucun accès direct à ces tables.
--
-- Aucun secret, token ou identifiant Alpaca de l'entreprise n'est stocké
-- ici — uniquement des identifiants de compte CLIENT Sandbox et des
-- statuts, jamais une donnée d'identité sensible au-delà du nécessaire.
--
-- À exécuter une fois, manuellement, dans l'éditeur SQL Supabase.
-- Idempotent (IF NOT EXISTS partout) : peut être rejoué sans risque.
-- ============================================================================

-- Un utilisateur NovaTitre (Supabase Auth) ↔ au plus un compte Alpaca
-- Sandbox (§4 : "uniquement au sien").
create table if not exists broker_accounts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null unique references auth.users(id) on delete cascade,

  -- Identifiant de compte Alpaca (UUID renvoyé par /v1/accounts) et numéro
  -- de compte lisible (ex. "10A2...") — jamais un secret, jamais une clé.
  alpaca_account_id text not null unique,
  account_number text,

  region text not null check (region in ('us', 'eu')),
  env text not null default 'sandbox' check (env = 'sandbox'),

  -- Statut RÉEL renvoyé par Alpaca (submitted/approved/rejected/action_required...)
  -- — jamais affiché comme "approuvé" si Alpaca ne l'a pas dit.
  status text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broker_accounts_user_idx on broker_accounts (user_id);

-- Journal des ordres — le CLIENT_ORDER_ID (généré côté serveur avant
-- l'envoi à Alpaca, voir §5.2) sert de clé d'idempotence : un double envoi
-- ne crée jamais deux lignes.
create table if not exists broker_orders (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  broker_account_id uuid not null references broker_accounts(id) on delete cascade,

  client_order_id text not null unique,
  alpaca_order_id text,

  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  qty numeric,
  notional numeric,
  order_type text not null default 'market',

  -- Statut RÉEL Alpaca (new/accepted/pending_new/partially_filled/filled/
  -- canceled/expired/rejected...) — jamais déduit, toujours synchronisé.
  status text not null default 'new',

  filled_qty numeric,
  filled_avg_price numeric,

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broker_orders_user_idx on broker_orders (user_id, submitted_at);
create index if not exists broker_orders_account_idx on broker_orders (broker_account_id);

-- Journal de synchronisation (resynchronisation après reconnexion, flux
-- d'événements) — purement diagnostique, jamais une source de vérité.
create table if not exists broker_sync_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  broker_account_id uuid references broker_accounts(id) on delete cascade,
  kind text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists broker_sync_events_account_idx on broker_sync_events (broker_account_id, created_at);

-- Erreurs non sensibles (jamais de secret/token/en-tête Authorization,
-- jamais de donnée personnelle complète — voir §2 de la mission).
create table if not exists broker_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  context text not null,
  message text not null,
  status_code int,
  created_at timestamptz not null default now()
);

create index if not exists broker_errors_user_idx on broker_errors (user_id, created_at);

alter table broker_accounts enable row level security;
alter table broker_orders enable row level security;
alter table broker_sync_events enable row level security;
alter table broker_errors enable row level security;
-- Volontairement aucune policy : RLS activée + aucune policy = accès refusé
-- à tout le monde SAUF la clé service_role, qui contourne RLS. Tout passe
-- par des routes serveur (api/_alpaca/*, api/admin/*), jamais par la clé
-- anon depuis le frontend.
