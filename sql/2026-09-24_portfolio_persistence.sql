-- ============================================================================
-- Persistance réelle du portefeuille (ÉTAPE 3, LOT D)
--
-- Contexte : le portefeuille (positions, liquidités, transactions,
-- historique) ne vivait jusqu'ici que dans le localStorage du navigateur
-- (state.wallet / state.transactions / state.walletHistory dans index.html).
-- Un changement d'appareil ou un cache vidé perdait tout. Ces deux tables
-- comblent ce manque, en respectant la logique déjà en place côté client :
--
--   portfolio_transactions : le JOURNAL, source de vérité. Une ligne par
--     achat/vente réel (voir buyStock()/sellStock()/enregistrerTransaction()
--     dans index.html). state.wallet.cash, state.wallet.positions et
--     state.wallet.realizedPnL sont TOUS intégralement reconstructibles en
--     rejouant ce journal depuis le capital de départ (15480 cash /
--     110000 investi, DEFAULT_STATE.wallet) — aucune deuxième source de
--     vérité pour les positions n'est donc créée ici, pour ne jamais risquer
--     de désynchronisation entre une table "positions" et le journal réel.
--
--   portfolio_snapshots : l'équivalent serveur de state.walletHistory (un
--     point par jour/événement, pour le graphique de valeur du portefeuille
--     dans le temps). Ce n'est PAS une source de vérité, seulement un
--     historique déjà calculé à un instant T — jamais de valeur antidatée
--     ou reconstituée (même règle que côté client, voir snapshotPortfolio()
--     dans index.html).
--
-- Chaque ligne appartient à un utilisateur réel (auth.users.id). Enveloppe
-- fictive de départ, jamais un compte bancaire réel : voir CONFIG/§17 du
-- cahier des charges Étape 3.
--
-- Sécurité : RLS activée, AUCUNE policy définie — même convention que
-- profiles/ai_usage/market_catalog_*. Seule SUPABASE_SERVICE_ROLE_KEY
-- (utilisée exclusivement côté serveur, dans api/me.js, après vérification
-- du jeton de l'utilisateur via /auth/v1/user) peut lire/écrire. La clé
-- anon publique n'a aucun accès direct à ces tables.
--
-- À exécuter une fois, manuellement, dans l'éditeur SQL Supabase.
-- Idempotent (IF NOT EXISTS partout) : peut être rejoué sans risque.
-- ============================================================================

create table if not exists portfolio_transactions (
  -- Identifiant STABLE généré côté client (voir enregistrerTransaction() dans
  -- index.html, ex. "tx1a2b3c..."), jamais régénéré côté serveur : sert de
  -- clé d'idempotence pour la synchronisation (un même achat rejoué par le
  -- client après une coupure réseau ne crée jamais de doublon).
  id text primary key,

  user_id uuid not null references auth.users(id) on delete cascade,

  -- Identifiant du titre côté catalogue NovaBourse (ex. "AAPL-NAS"), jamais
  -- réinterprété côté serveur.
  stock_id text not null,
  ticker text not null,
  name text not null,

  type text not null check (type in ('buy', 'sell')),

  qty numeric not null check (qty > 0),
  price_local numeric not null check (price_local >= 0),
  currency text not null,
  amount_eur numeric not null,

  -- Rempli uniquement pour une vente (voir sellStock()) : gain/perte réalisé
  -- en euros, méthode du coût moyen pondéré. Null pour un achat.
  realized_gain numeric,

  -- Nova Memory (§27, optionnel) : ce que l'utilisateur avait indiqué au
  -- moment de l'achat. Jamais requis, jamais réécrit après coup.
  thesis_reason text,
  thesis_horizon text,

  -- Horodatage RÉEL de la transaction tel qu'enregistré côté client au
  -- moment de l'achat/vente — jamais recalculé côté serveur (received_at
  -- ci-dessous sert à ça si un jour nécessaire pour du diagnostic).
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists portfolio_transactions_user_idx
  on portfolio_transactions (user_id, occurred_at);

create table if not exists portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  occurred_at timestamptz not null,

  total_value numeric not null,
  cash numeric not null,
  invested_value numeric not null,
  net_deposits numeric,
  unrealized_pnl numeric,
  realized_pnl numeric,

  -- 'first' | 'daily' | 'buy' | 'sell' — même vocabulaire que
  -- snapshotPortfolio() dans index.html.
  reason text,

  -- Un seul relevé par utilisateur/instant : la synchronisation (api/me.js,
  -- resource=portfolio) réenvoie systématiquement tout l'historique local à
  -- chaque appel (plus simple et plus sûr qu'un diff), cette contrainte sert
  -- de clé d'upsert (on_conflict=user_id,occurred_at) pour rester idempotente.
  unique (user_id, occurred_at)
);

create index if not exists portfolio_snapshots_user_idx
  on portfolio_snapshots (user_id, occurred_at);

alter table portfolio_transactions enable row level security;
alter table portfolio_snapshots enable row level security;
-- Volontairement aucune policy : par défaut, RLS activée + aucune policy =
-- accès refusé à tout le monde SAUF la clé service_role, qui contourne RLS.
-- Ces tables ne sont jamais lues via la clé anon depuis le frontend ; tout
-- passe par api/me.js (resource=portfolio), qui vérifie le jeton utilisateur
-- avant toute lecture/écriture.
