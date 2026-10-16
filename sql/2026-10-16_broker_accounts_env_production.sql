-- NE PAS APPLIQUER AVANT le jour de l'ouverture réelle (contrat Alpaca
-- Europe signé, verrou TRADING_ALLOWED_IN_PRODUCTION levé par un commit
-- relu). Préparé le 2026-10-16.
--
-- broker_accounts.env n'accepte aujourd'hui que 'sandbox' (voir
-- 2026-10-15_broker_accounts.sql). Cette migration autorise 'production'
-- sans toucher aux lignes existantes : aucune donnée modifiée ni supprimée.
--
-- Le nom de la contrainte est celui généré par défaut par Postgres pour un
-- CHECK de colonne ; le vérifier avant d'exécuter :
--   select conname from pg_constraint
--   where conrelid = 'broker_accounts'::regclass and contype = 'c';

alter table broker_accounts drop constraint if exists broker_accounts_env_check;
alter table broker_accounts
  add constraint broker_accounts_env_check check (env in ('sandbox', 'production'));
