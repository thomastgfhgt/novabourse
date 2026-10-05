-- ============================================================================
-- Nova Core — conversations et messages (§4, §8 du prompt maître NovaTitre)
--
-- "Une seule intelligence Nova. Plusieurs compétences. Une mémoire commune.
-- Un seul utilisateur." Ce n'est PAS une table par module (pas de
-- novabot_conversations / novareview_conversations séparées) : une seule
-- table de conversations, un champ `module` qui distingue leur origine
-- (novabot/novareview/novanews/novaevent/stock/portfolio/general), pour
-- que la mémoire reste partagée et interrogeable d'un seul coup (§9 —
-- "Nova doit pouvoir retrouver des informations pertinentes dans d'anciennes
-- conversations", quel que soit le module d'origine).
--
-- nova_conversations : une ligne par conversation. `context` (jsonb) capture
--   ce que l'utilisateur regardait à l'ouverture (§7 : "transmettre le
--   contexte sous forme de données structurées", jamais une capture d'écran)
--   — ex. {"type":"stock","stockId":"AAPL-NAS"} pour une conversation ouverte
--   depuis une fiche action.
--
-- nova_messages : le journal, source de vérité d'une conversation. user_id
--   dupliqué depuis la conversation parente (dénormalisé) pour que chaque
--   ligne soit filtrable par utilisateur sans jointure — même raisonnement
--   que portfolio_transactions (voir sql/2026-09-24_portfolio_persistence.sql).
--
-- Sécurité : RLS activée, AUCUNE policy — même convention que TOUTES les
-- autres tables de ce projet (profiles/stripe_events/portfolio_*/
-- market_catalog_*). Seule SUPABASE_SERVICE_ROLE_KEY (api/nova/conversations.js,
-- après vérification du jeton utilisateur) peut lire/écrire.
--
-- Portée volontairement minimale cette passe : CRUD conversations/messages
-- uniquement. Pas encore de recherche/mémoire structurée (§9-10 du prompt
-- maître) — viendra dans une migration séparée une fois ce socle en place,
-- jamais tout construit d'un coup (§87).
--
-- À exécuter une fois, manuellement, dans l'éditeur SQL Supabase.
-- Idempotent (IF NOT EXISTS partout) : peut être rejoué sans risque.
-- ============================================================================

create table if not exists nova_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- 'novabot' | 'novareview' | 'novanews' | 'novaevent' | 'stock' |
  -- 'portfolio' | 'general' — jamais une liste fermée en base (check
  -- volontairement absent) : un nouveau module Nova ne doit pas nécessiter
  -- de migration, seulement un nouvel appelant côté application.
  module text not null,

  -- Titre affiché dans l'historique (§8, "Nova Review — Analyse du jour").
  -- Null tant qu'aucun titre n'a été déduit/saisi — jamais une valeur
  -- inventée ("Nouvelle conversation") qui masquerait l'absence réelle.
  title text,

  -- Contexte structuré capturé à l'ouverture (§7). Jamais réécrit après
  -- coup par un message suivant — un changement de contexte en cours de
  -- conversation (l'utilisateur navigue ailleurs) ouvre une recherche dans
  -- une AUTRE conversation, ne mute jamais celle-ci rétroactivement.
  context jsonb,

  created_at timestamptz not null default now(),
  -- Mis à jour à chaque nouveau message (voir api/nova/conversations.js) :
  -- c'est la colonne de tri de l'historique ("Aujourd'hui / Hier...", §8),
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

  -- Fournisseur/modèle/tokens/coût pour un message 'assistant' (§76 : "coûts
  -- IA [...] par requête si possible : provider, model, input tokens, output
  -- tokens, estimated cost"). Null pour un message 'user'. Jamais affiché à
  -- l'utilisateur final (§76 : "ne pas afficher nécessairement ces données
  -- aux utilisateurs finaux, mais les rendre disponibles côté administration").
  metadata jsonb,

  created_at timestamptz not null default now()
);

create index if not exists nova_messages_conversation_idx
  on nova_messages (conversation_id, created_at);

alter table nova_conversations enable row level security;
alter table nova_messages enable row level security;
-- Volontairement aucune policy : par défaut, RLS activée + aucune policy =
-- accès refusé à tout le monde SAUF la clé service_role, qui contourne RLS.
-- Jamais lues via la clé anon depuis le frontend ; tout passe par
-- api/nova/conversations.js, qui vérifie le jeton utilisateur avant toute
-- lecture/écriture.
