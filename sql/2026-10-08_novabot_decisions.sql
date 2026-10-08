-- ============================================================================
-- NovaBot — journal des décisions (refonte fonctionnelle, tranche B)
--
-- Contexte : la tranche A (sql/2026-10-07_novabot_foundation.sql) a donné à
-- NovaBot un compte/mandat/journal de transactions persistés, mais chaque
-- transaction ne portait encore qu'un texte libre ("motif"/"reason") — pas
-- de trace structurée du POURQUOI (§14/§31 du brief NovaBot : "chaque
-- transaction doit être reliée à une décision [...] chaque décision doit
-- être reliée aux données disponibles à ce moment, au mandat en vigueur,
-- aux contrôles de risque"). Cette table comble ce manque.
--
-- Une décision n'implique PAS toujours une transaction : HOLD et WATCH
-- (§13) sont des décisions à part entière, enregistrées ici même quand
-- rien n'est exécuté — novabot_transactions.decision_id référence cette
-- table pour les décisions qui ONT abouti à un ordre simulé (BUY/SELL),
-- jamais l'inverse (cette table ne dépend d'aucune transaction).
--
-- À exécuter une fois, manuellement, dans l'éditeur SQL Supabase, après
-- sql/2026-10-07_novabot_foundation.sql (clé étrangère account_id).
-- Idempotent (IF NOT EXISTS partout) : peut être rejoué sans risque.
-- ============================================================================

create table if not exists novabot_decisions (
  -- text, pas uuid : id STABLE généré côté client (même convention que
  -- novabot_transactions.id/portfolio_transactions.id) — sert de clé
  -- d'upsert idempotente, un rejeu après coupure réseau ne crée jamais de
  -- doublon. Jamais régénéré côté serveur.
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references novabot_accounts(id) on delete cascade,

  -- §13 : les 7 actions possibles. REJECT = une transaction a été envisagée
  -- puis refusée par le Mandate/Risk Engine (§11 : "même si Nova demande
  -- une transaction interdite, le Risk Engine doit la refuser") — gardée
  -- ici, jamais silencieusement avalée, pour que l'utilisateur puisse un
  -- jour demander "qu'as-tu refusé et pourquoi ?".
  action text not null check (action in ('buy', 'sell', 'hold', 'increase', 'reduce', 'watch', 'reject')),

  stock_id text,
  ticker text,
  name text,

  -- Chiffres observés AU MOMENT de la décision (§15 : "les chiffres de
  -- cette réponse doivent venir de données enregistrées, jamais être
  -- inventés") — jamais recalculés après coup à partir du cours actuel.
  price_observed numeric,
  qty numeric,
  amount_eur numeric,
  weight_before_pct numeric,
  weight_after_pct numeric,
  cash_before numeric,
  cash_after numeric,

  reason text not null,

  -- Traçabilité (§31) : snapshot JSON de ce qui a produit la décision —
  -- jamais recalculé rétroactivement avec des données d'aujourd'hui.
  -- data_used : { novaScore, price, ... } lues au moment T.
  -- mandate_snapshot : copie des champs du mandat EN VIGUEUR à ce moment
  --   (pas juste mandate_id — un mandat peut changer après coup, la
  --   décision doit rester explicable avec les règles d'alors).
  -- risk_result : { allowed, violations:[...] } renvoyé par le Risk Engine.
  -- relevant_news / relevant_event : identifiants Nova News/Nova Event
  --   pertinents au moment de la décision, si applicable (tranche D/E).
  data_used jsonb,
  mandate_snapshot jsonb,
  risk_result jsonb,
  relevant_news jsonb,
  relevant_event jsonb,

  -- IA (tranche C) : null pour une décision purement déterministe (tranche
  -- B, NovaScore vs seuil) — rempli une fois le raisonnement LLM introduit.
  ai_provider text,
  ai_model text,
  confidence numeric,

  execution_status text not null default 'simulated'
    check (execution_status in ('simulated', 'skipped', 'rejected')),

  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index if not exists novabot_decisions_account_idx
  on novabot_decisions (account_id, occurred_at desc);
create index if not exists novabot_decisions_stock_idx
  on novabot_decisions (account_id, stock_id, occurred_at desc);

alter table novabot_decisions enable row level security;
-- Volontairement aucune policy — même convention que toutes les autres
-- tables du projet (service_role uniquement, via api/me.js).
