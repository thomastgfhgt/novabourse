# Proposition — nettoyage de la base Supabase pour l'école

**Rien n'a été exécuté.** Ce fichier est une proposition. C'est Thomas qui décide, et c'est lui qui lance le SQL dans Supabase s'il est d'accord.

Préparé le 2026-11-10 (branche `refonte-ecole`), après la suppression de l'ancien produit.

## Ce que le code utilise encore

| Élément | Utilisé par | Décision proposée |
|---|---|---|
| table `profiles` | `api/me.js`, `api/_limits.js`, `api/stripe/*` | **garder** (élève, offre, abonnement) |
| table `stripe_events` | `api/stripe/webhook.js` | **garder** (évite de traiter deux fois un paiement) |
| table `ai_usage` + fonction `reserve_analysis` | `api/_limits.js` | **à décider en phase 4** : servira peut-être à la limite de messages du coach |
| table `nova_chat_usage` + fonction `reserve_chat_message` | `api/_limits.js` | **à décider en phase 4** : même question |

## Ce que plus aucun code n'utilise

Preuve : aucun fichier du dépôt ne lit ni n'écrit ces tables depuis la suppression de l'ancien produit (recherche de chaque nom dans `api/`).

| Tables | Ancien usage |
|---|---|
| `broker_accounts`, `broker_orders`, `broker_sync_events`, `broker_errors` | courtier Alpaca (comptes et ordres réels) |
| `novabot_accounts`, `novabot_mandates`, `novabot_mandate_changes`, `novabot_transactions`, `novabot_portfolio_snapshots`, `novabot_decisions` | NovaBot et Mandat Nova |
| `nova_conversations`, `nova_messages` | conversations de Nova AI |
| `portfolio_transactions`, `portfolio_snapshots` | portefeuille de l'ancien site |
| `market_catalog_imports`, `market_catalog_listings` | ancien catalogue de valeurs |

Le nouveau site garde la progression de l'élève dans son navigateur (`localStorage`, clé `nt-missions`). Il n'utilise aucune de ces tables.

## Étapes proposées (dans l'ordre, si Thomas est d'accord)

1. **Sauvegarder d'abord** : Supabase → Database → Backups. Ou bien exporter chaque table en CSV (Table Editor → table → Export).
2. **Regarder s'il y a des données** dans chaque table. Les tables `broker_*` et `portfolio_*` peuvent contenir des données personnelles d'anciens utilisateurs : les supprimer va dans le sens du RGPD (ne pas garder ce qui ne sert plus).
3. Seulement ensuite, le SQL à lancer dans l'éditeur SQL de Supabase :

```sql
-- NE PAS EXÉCUTER sans sauvegarde ni accord de Thomas.
drop table if exists broker_errors, broker_sync_events, broker_orders, broker_accounts;
drop table if exists novabot_decisions, novabot_portfolio_snapshots, novabot_transactions,
                     novabot_mandate_changes, novabot_mandates, novabot_accounts;
drop table if exists nova_messages, nova_conversations;
drop table if exists portfolio_snapshots, portfolio_transactions;
drop table if exists market_catalog_listings, market_catalog_imports;
```

Les fichiers de migration de `sql/` (2026-09-15 → 2026-10-16) sont laissés tels quels : ils racontent comment la base a été construite. Une fois les tables supprimées dans Supabase, on pourra les retirer du dépôt.
