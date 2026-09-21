# Incohérences de texte — audit du 2026-09-21

Relecture ciblée des titres/accroches de toutes les pages (Accueil, Marchés, Radar, Explorer, Portefeuille, Compte, Réglages, Comparer, Nova Score, Engagement) faite lors d'une passe précédente de cette même session : le ton est cohérent, honnête, sans promesse non tenue. Aucune incohérence majeure trouvée à ce moment-là.

Cette passe (audit stabilisation) n'a pas trouvé de nouvelle incohérence de texte au-delà de ce qui suit :

## Trouvé et corrigé pendant cette session (déjà en production)

- **Copie de l'écran de connexion** désalignée avec le titre `<title>` de la page — réécrite pour être cohérente (commit `4e2bd09`).
- **Filtre "Pays" (Radar/Explorer)** affichait littéralement une puce "null" et une puce "—" comme s'il s'agissait de vrais pays, et des doublons anglais/français ("USA" à côté d'"États-Unis") — corrigé (commit `25da8d6`), voir AUDIT_REPORT.md.

## Rien trouvé mais non vérifié exhaustivement

- Les libellés d'erreur réseau retournés par `api/*.js` (ex. `quota_exceeded`, `rate_limited`, `non_connecte`) sont des codes machine, pas du texte utilisateur — il faudrait vérifier que CHAQUE code a bien une traduction humaine côté frontend (`index.html`) et qu'aucun ne s'affiche brut à l'écran. Pas fait dans cette passe (nécessiterait de déclencher chaque erreur en conditions réelles), à traiter dans une prochaine itération si un utilisateur rapporte un message d'erreur en anglais/code brut.
- Les limites de plan affichées dans `PAGES.pricing` (`pricingBlock()`, index.html) vs les limites réelles server-side (`api/me.js`, objet `LIMITS`) semblent cohérentes à la lecture (watchlist 10/illimité/illimité, comparaison 2/3/5) mais n'ont pas été testées bout-en-bout avec un vrai compte Pro/Elite dans cette session.
