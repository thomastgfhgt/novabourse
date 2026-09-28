# src/ — ébauche React (non intégrée)

Ces fichiers ont été créés tels quels à la demande, comme point de départ
pour une éventuelle future version React de l'app. Ils ne sont **pas**
exécutés par le site actuel.

## État réel du projet

- Le site en production (`index.html`) est une SPA vanilla JS/CSS en un
  seul fichier, sans bundler ni étape de build.
- Le backend est composé de fonctions serverless Vercel (`api/`).
- `package.json` ne contient ni `react`, ni `react-dom`, ni
  `react-router-dom`, ni `recharts` : rien n'est installé, rien ne peut
  encore s'exécuter.
- Rien dans `index.html` ne charge ce dossier.

## Pour rendre ce dossier réellement fonctionnel un jour

1. `npm install react react-dom react-router-dom recharts` (+ un
   bundler : Vite est le plus simple à brancher sur un projet neuf).
2. Un point d'entrée (`src/main.jsx`) qui monte `<App />` sur un
   `<div id="root">` — inexistant aujourd'hui dans `index.html`.
3. Configurer le bundler pour produire un build statique déployé par
   Vercel à côté de (ou à la place de) `index.html`.
4. **Ne jamais appeler Finnhub directement depuis le navigateur** avec
   une clé `REACT_APP_*` : ces variables sont injectées en clair dans
   le bundle public par Create React App/Vite, visibles par n'importe
   quel visiteur. Passer par une route serveur (`api/`), comme le fait
   déjà `api/market/_providers.js` pour EODHD/Twelve Data/Finnhub.
5. Décider explicitement si cette version React remplace la SPA
   actuelle ou coexiste avec elle (deux apps sur un même déploiement
   Vercel demande un routage réfléchi, pas une simple coexistence de
   dossiers).

## Fichiers présents

- `lib/finnhub.js` — client Finnhub, appel direct navigateur (à
  reproxifier côté serveur avant tout usage réel, voir point 4).
- `components/PriceChart.jsx`, `components/ActionRow.jsx`
- `pages/Markets.jsx`, `pages/ActionDetail.jsx` (+ ses 2 onglets)
- `App.jsx` — routage react-router-dom minimal.
