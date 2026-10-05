-- ============================================================================
-- Dépôts / retraits / frais dans le journal du portefeuille
-- (§35 du prompt maître NovaTitre : "L'utilisateur doit pouvoir enregistrer :
-- achat ; vente ; dépôt ; retrait ; frais..." — seuls achat/vente existaient
-- jusqu'ici, voir sql/2026-09-24_portfolio_persistence.sql)
--
-- portfolio_transactions ne connaissait que 'buy'/'sell', avec stock_id/
-- ticker/name/qty/price_local/currency tous NOT NULL (un achat/une vente
-- concerne toujours un titre précis). Un dépôt/retrait/frais ne concerne
-- AUCUN titre : ces colonnes doivent devenir nullable pour ces 3 nouveaux
-- types, sans rien changer pour 'buy'/'sell' (une contrainte CHECK applique
-- la règle : titre obligatoire pour achat/vente, absent pour le reste).
--
-- Comptabilisation (voir rejouerTransactions()/depositCash()/withdrawCash()/
-- payFee() dans js/core.js) : un dépôt/retrait modifie cash ET le capital
-- net apporté (wallet.invested) à parts égales — un frais ne sort QUE du
-- cash, jamais du capital net apporté (un frais est un coût, pas un flux
-- voulu par l'utilisateur ; le sortir de netDeposits ferait disparaître son
-- impact de la mesure de performance au lieu de l'y faire apparaître comme
-- une perte, voir §36 du prompt maître).
--
-- Idempotent : peut être rejoué sans risque (DROP CONSTRAINT IF EXISTS,
-- ALTER COLUMN DROP NOT NULL est déjà sans effet si déjà nullable).
-- À exécuter une fois, manuellement, dans l'éditeur SQL Supabase — même
-- convention que la migration du 2026-09-24.
-- ============================================================================

alter table portfolio_transactions
  alter column stock_id drop not null,
  alter column ticker drop not null,
  alter column name drop not null,
  alter column qty drop not null,
  alter column price_local drop not null,
  alter column currency drop not null;

-- qty/price_local gardent leur contrainte de positivité quand ils sont
-- renseignés (achat/vente) ; simplement plus "not null" dans l'absolu.
alter table portfolio_transactions
  drop constraint if exists portfolio_transactions_qty_check;
alter table portfolio_transactions
  add constraint portfolio_transactions_qty_check check (qty is null or qty > 0);

alter table portfolio_transactions
  drop constraint if exists portfolio_transactions_price_local_check;
alter table portfolio_transactions
  add constraint portfolio_transactions_price_local_check check (price_local is null or price_local >= 0);

alter table portfolio_transactions
  drop constraint if exists portfolio_transactions_type_check;
alter table portfolio_transactions
  add constraint portfolio_transactions_type_check
  check (type in ('buy', 'sell', 'deposit', 'withdraw', 'fee'));

-- Intégrité : un titre pour achat/vente, aucun titre pour dépôt/retrait/frais
-- — empêche en base une ligne "achat sans stock_id" ou "dépôt avec un titre",
-- quelle que soit la rigueur du code applicatif côté api/me.js.
alter table portfolio_transactions
  drop constraint if exists portfolio_transactions_stock_coherence_check;
alter table portfolio_transactions
  add constraint portfolio_transactions_stock_coherence_check
  check (
    (type in ('buy', 'sell') and stock_id is not null and ticker is not null and name is not null
      and qty is not null and price_local is not null and currency is not null)
    or
    (type in ('deposit', 'withdraw', 'fee') and stock_id is null and qty is null and price_local is null and currency is null)
  );
