# Incohérences de texte — audit du 2026-09-21

Relecture ciblée des titres/accroches de toutes les pages (Accueil, Marchés, Radar, Explorer, Portefeuille, Compte, Réglages, Comparer, Nova Score, Engagement) faite lors d'une passe précédente de cette même session : le ton est cohérent, honnête, sans promesse non tenue. Aucune incohérence majeure trouvée à ce moment-là.

Cette passe (audit stabilisation) n'a pas trouvé de nouvelle incohérence de texte au-delà de ce qui suit :

## Trouvé et corrigé pendant cette session (déjà en production)

- **Copie de l'écran de connexion** désalignée avec le titre `<title>` de la page — réécrite pour être cohérente (commit `4e2bd09`).
- **Filtre "Pays" (Radar/Explorer)** affichait littéralement une puce "null" et une puce "—" comme s'il s'agissait de vrais pays, et des doublons anglais/français ("USA" à côté d'"États-Unis") — corrigé (commit `25da8d6`), voir AUDIT_REPORT.md.

## Vérifié cette session (suite) : codes d'erreur bruts

Point resté ouvert dans la passe précédente : vérifié par lecture du code. Deux familles de traitement, toutes deux sûres :
- **IA (Radar "Interpréter avec l'IA", Analyse)** : chaque appel a une table `{code: message français}` avec un `|| "message générique honnête"` en repli — aucun code brut ne peut s'afficher, même pour un code non prévu dans la table (vérifié aux deux points d'appel, `index.html:17330` et `17740`).
- **Marché (graphique, fondamentaux, actualités, cotations)** : le code d'erreur du serveur n'est même pas transmis à l'UI — la réponse échoue vers un statut générique (`status:'error'`/`'empty'`) déjà traduit ailleurs ("Impossible de charger les données pour le moment.", etc.). Vérifié sur `chargerGraphique()`.

Aucun cas trouvé où un code technique brut (`ticker_invalide`, `rate_limited`...) pourrait s'afficher à l'utilisateur. Point clos.

## Rien trouvé mais non vérifié exhaustivement

- Les limites de plan affichées dans `PAGES.pricing` (`pricingBlock()`, index.html) vs les limites réelles server-side (`api/me.js`, objet `LIMITS`) semblent cohérentes à la lecture (watchlist 10/illimité/illimité, comparaison 2/3/5) mais n'ont pas été testées bout-en-bout avec un vrai compte Pro/Elite dans cette session.
