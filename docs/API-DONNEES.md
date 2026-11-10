# NovaTitre — contrat des données réelles (cours, historiques, actualités)

Statut : **Spécifié** (03/11/2026). Le navigateur sait déjà lire ces adresses (`js/app.js`, bloc V27 « NT_FEED »).
La lecture est **éteinte par défaut**. Pour l'allumer, une fois les routes en ligne, ajouter dans `index.html`, avant les scripts : `<script>window.NT_FEED_BASE = '/api';</script>`.
Les routes serveur ne sont **pas encore codées** : elles le seront seulement après validation de Thomas,
et après vérification de la licence du fournisseur (usage commercial autorisé).

## Règles
- Les clés du fournisseur restent dans les variables d'environnement Vercel. Jamais dans le code ni le navigateur.
- Le serveur met en cache (cours : 60 s ; historique : 1 h ; actualités : 5 min) pour ne pas dépasser les quotas.
- Réponse en `application/json`. En cas de problème : code HTTP d'erreur, et le site garde ses données datées.
- Usage pédagogique uniquement (argent fictif). Aucun conseil, aucun signal d'achat ou de vente.
- Toujours renvoyer la source (nom + lien) et le délai (`live`, `15min`, `close`).

## GET /api/marche
```json
{ "asOf": "2026-11-03T12:00:00Z", "delay": "15min",
  "source": { "name": "Nom du fournisseur", "url": "https://…" },
  "quotes": [ { "id": "AAPL", "price": 344.63, "chg": -1.23, "cur": "USD", "date": "2026-11-03" } ] }
```
`id` = identifiant déjà connu du site (voir `content/market-real.js`). Le navigateur ignore toute valeur inconnue,
tout prix ≤ 0, toute variation au-delà de ±60 %, et toute devise différente de celle de la valeur.

## GET /api/historique?id=AAPL
```json
{ "id": "AAPL", "interval": "1d", "source": { "name": "…" },
  "bars": [ ["2026-10-30", 343.90, 351.43, 341.03, 344.63, 153863825] ] }
```
Barre = [date ISO, ouverture, haut, bas, clôture, volume]. Au moins 2 barres valides, sinon ignoré.

## GET /api/news
```json
{ "asOf": "2026-11-03", "source": { "name": "…" },
  "items": [ { "title": "…", "date": "2026-11-03", "source": "…", "url": "https://…", "ids": ["AAPL"] } ] }
```
Lien obligatoirement en `https://`. 30 actualités au plus. Le titre est affiché tel quel (échappé), sans résumé inventé.
