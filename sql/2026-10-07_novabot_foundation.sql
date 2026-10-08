-- ============================================================================
-- NovaBot — fondation persistée (refonte fonctionnelle, 2026-10-07)
--
-- Contexte : jusqu'ici, NovaBot n'existait QUE côté client (state.novabot
-- dans js/core.js), persisté uniquement en localStorage. Un changement
-- d'appareil ou un cache vidé effaçait tout le "portefeuille" NovaBot —
-- contrairement au portefeuille personnel, qui a déjà ce socle depuis
-- sql/2026-09-24_portfolio_persistence.sql. Ces 4 tables comblent ce manque
-- pour NovaBot, en suivant EXACTEMENT les mêmes conventions (journal =
-- source de vérité, snapshots = historique déjà calculé, RLS sans policy,
-- clé d'upsert pour l'idempotence).
--
-- novabot_accounts : un compte NovaBot par utilisateur (capital initial,
--   état). "status" porte déjà les valeurs du §25 du brief (SETUP/ACTIVE/
--   PAUSED...) mais seuls SETUP/ACTIVE/PAUSED sont utilisés par cette
--   première tranche (fondation) — ANALYZING/WAITING/ERROR viendront avec
--   le pipeline de décision (tranche B/C), jamais une colonne ajoutée par
--   anticipation sans code qui l'utilise encore.
--
-- novabot_mandates : le Nova Mandate (§3 du brief NovaBot). Append-only —
--   chaque modification insère une NOUVELLE ligne plutôt que d'écraser la
--   précédente (is_current distingue la version active) : donne l'historique
--   complet des mandats "gratuitement", sans table _versions séparée (même
--   principe que portfolio_transactions, qui EST déjà son propre historique).
--   preferences/hard_rules séparés explicitement (§3 : "une décision ne doit
--   JAMAIS pouvoir violer une HARD RULE") — jamais un seul tableau de règles
--   non typées où cette distinction se perdrait.
--
-- novabot_transactions / novabot_portfolio_snapshots : copie conforme du
--   schéma portfolio_transactions/portfolio_snapshots (voir ce fichier),
--   dans leur propre table — JAMAIS mêlées aux tables du portefeuille
--   personnel (même raison que l'isolation déjà en place côté client :
--   mélanger fausserait Nova Review et la valorisation réelle).
--
-- Sécurité : RLS activée, AUCUNE policy — même convention que TOUTES les
-- autres tables de ce projet. Seule SUPABASE_SERVICE_ROLE_KEY (api/me.js,
-- après vérification du jeton utilisateur) peut lire/écrire.
--
-- À exécuter une fois, manuellement, dans l'éditeur SQL Supabase.
-- Idempotent (IF NOT EXISTS partout) : peut être rejoué sans risque.
-- ============================================================================

create table if not exists novabot_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,

  -- SETUP (mandat pas encore confirmé) -> ACTIVE -> PAUSED (voir §25/§22 :
  -- "SUSPENDRE NovaBot" ne liquide jamais les positions, voir le commentaire
  -- sur la table transactions plus bas). ANALYZING/WAITING/ERROR : valeurs
  -- réservées pour la tranche pipeline de décision, non utilisées ici.
  status text not null default 'setup'
    check (status in ('setup', 'active', 'paused', 'analyzing', 'waiting', 'error')),

  -- Mode d'autonomie (§22) : 'advice' (propose, l'utilisateur confirme),
  -- 'semi_auto', 'auto'. Par défaut le plus prudent — jamais 'auto' par
  -- défaut à la création d'un compte.
  autonomy_mode text not null default 'advice'
    check (autonomy_mode in ('advice', 'semi_auto', 'auto')),

  -- Capital confié à la création (§1 : "Je confie 10 000 € à NovaBot") —
  -- informatif seulement : la vérité du cash/des positions vient TOUJOURS
  -- du rejeu de novabot_transactions (même principe que portfolio_*), ce
  -- champ ne sert qu'à afficher "capital initial" sans avoir à chercher le
  -- premier dépôt dans le journal.
  initial_capital numeric not null check (initial_capital >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists novabot_mandates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references novabot_accounts(id) on delete cascade,

  is_current boolean not null default true,

  -- §3 du brief : champs explicitement demandés. Tous nullable sauf ceux
  -- qui ont un sens par défaut sûr (cash_min_pct/max_position_pct déjà
  -- utilisés aujourd'hui côté client, voir DEFAULT_STATE.novabot) — un
  -- mandat peut être créé progressivement (§4 : par conversation, un champ
  -- à la fois), jamais tout exigé d'un coup.
  objective text,                          -- 'growth' | 'income' | 'preserve' | null (pas encore choisi)
  horizon_years numeric,
  risk_level text,                         -- 'low' | 'moderate' | 'high'
  max_drawdown_pct numeric,
  cash_min_pct numeric not null default 20,
  max_position_pct numeric not null default 10,
  max_positions_count integer,

  -- Préférences (§3 : jamais bloquantes) vs hard rules (§3 : jamais
  -- violables) — deux colonnes jsonb séparées plutôt qu'un seul tableau de
  -- règles non typées, précisément pour que cette distinction ne puisse
  -- jamais se perdre en cours de route. Forme : tableau d'objets
  -- {type, value, note?} — ex. hard_rules: [{"type":"excluded_sector",
  -- "value":"tabac"}, {"type":"min_cash_pct","value":15}].
  preferences jsonb not null default '[]'::jsonb,
  hard_rules jsonb not null default '[]'::jsonb,

  allowed_regions jsonb,                   -- ["Europe","Amérique du Nord",...] ou null = aucune restriction
  currencies jsonb,

  benchmark text,                          -- ex. "^GSPC" — même convention que le benchmark du portefeuille personnel

  notes text,                              -- champ libre pour une règle personnalisée non structurée (§3)

  created_at timestamptz not null default now()
);

create index if not exists novabot_mandates_current_idx
  on novabot_mandates (account_id) where is_current;

-- Copie conforme de portfolio_transactions (voir sql/2026-09-24_portfolio_
-- persistence.sql pour la justification complète de chaque choix) — seule
-- différence : account_id en plus (une seule table pour l'instant, mais
-- une colonne qui anticipe un futur compte NovaBot "pro"/second compte
-- sans migration supplémentaire), et 'deposit'/'withdraw' réutilisés tels
-- quels pour le capital confié/retiré (§1, §26 : "les dépôts/retraits ne
-- doivent pas être comptés comme performance" — même rejeu que
-- rejouerTransactions() côté client, réutilisé à l'identique pour NovaBot).
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

  -- Lien vers la décision qui a produit cette transaction (§31 :
  -- traçabilité — "chaque transaction doit être reliée à une décision").
  -- text, pas uuid : même id généré côté client que novabot_decisions.id
  -- (sql/2026-10-08_novabot_decisions.sql). Pas de contrainte de clé
  -- étrangère ici volontairement — cette migration peut être exécutée
  -- avant celle qui crée novabot_decisions, jamais l'inverse requis.
  -- Nullable : une transaction de fondation (dépôt initial) n'a
  -- logiquement aucune décision associée.
  decision_id text,

  -- Motif texte lisible (ce que l'ancien state.novabot.transactions[].motif
  -- contenait déjà) — conservé même une fois decision_id en usage : un motif
  -- court et lisible reste utile même quand la décision complète existe.
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
-- refusé à tout le monde SAUF la clé service_role (api/me.js, après
-- vérification du jeton utilisateur). Jamais lues via la clé anon depuis
-- le frontend.
