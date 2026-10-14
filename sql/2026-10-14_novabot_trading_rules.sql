-- ============================================================================
-- NovaBot — synchronisation des réglages de trading vers le serveur
-- ============================================================================
--
-- CONTEXTE (audit 2026-10-14) : NovaScore minimum pour acheter, stop-loss,
-- take-profit et montant par trade (state.novabot.scoreAchat/stopLossPct/
-- takeProfitPct/tradeAmountEUR côté navigateur) n'avaient JAMAIS de colonne
-- correspondante sur novabot_mandates — le cycle automatique serveur
-- (api/market/extra.js, kind=novabot-cron) utilisait donc systématiquement
-- les valeurs par défaut de l'application (70 / 10% / 20% / 500€), qui
-- peuvent diverger d'un réglage personnalisé par l'utilisateur via "Mon
-- mandat -> Réglages avancés".
--
-- Un seul champ jsonb (plutôt que 4 colonnes séparées) : mêmes rôle et
-- convention que hard_rules/preferences déjà sur cette table.
--
-- IF NOT EXISTS : sans risque, rejouable, ne touche aucune donnée
-- existante (une ligne déjà présente devient simplement trading_rules=null,
-- et le cycle automatique continue d'utiliser les valeurs par défaut tant
-- que le navigateur n'a pas repoussé un mandat avec ce nouveau champ).
--
-- MARCHE À SUIVRE : Supabase -> SQL Editor -> New query -> coller -> Run.
-- ============================================================================

alter table novabot_mandates
  add column if not exists trading_rules jsonb;

-- ============================================================================
-- Fin du script.
-- ============================================================================
