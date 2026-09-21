# NovaBourse — Architecture réelle (état constaté, 2026-09-21)

Ce document décrit ce qui existe VRAIMENT dans ce repository, vérifié fichier par fichier — pas une architecture supposée.

## Stack réelle

- **Frontend** : un seul fichier `index.html` (~17 700 lignes). SPA en JavaScript vanilla (pas de framework, pas de build step, pas de bundler, pas de TypeScript, pas de JSX). Un routeur maison (`route = {page, arg}` + `render()`), un système de composants sous forme de fonctions qui retournent des template strings HTML (`PAGES.home()`, `PAGES.radar()`, etc.).
- **Styles** : CSS dans un unique `<style>` en tête de fichier, variables CSS (`--bg`, `--ink`, `--accent`...) pour les tokens de design, thème clair/sombre via `[data-theme="dark"]`.
- **Backend** : fonctions serverless Vercel sous `api/*.js` et `api/market/*.js`, `api/stripe/*.js`. Pas de framework serveur (pas d'Express, pas de Next.js API routes au sens propre — juste le format `module.exports = async (req,res) => {}` attendu par Vercel).
- **Auth** : Supabase Auth (Google OAuth), le client crée une session, le jeton est envoyé en `Authorization: Bearer` aux endpoints `api/*` qui le vérifient via `SUPABASE_URL/auth/v1/user`.
- **Base de données** : Supabase Postgres, mais avec un périmètre restreint et vérifié :
  - table `profiles` (plan, statut d'abonnement, onboarding) — lue/écrite uniquement côté serveur avec la clé `SUPABASE_SERVICE_ROLE_KEY`, jamais exposée au client.
  - table `stripe_events` (idempotence des webhooks).
  - une table de réservations/quota IA (référencée par `_limits.js`, `reserve_analysis()` côté Postgres).
  - **Pas de table portefeuille/watchlist/liste de suivi** : ces données sont gérées **entièrement côté client, dans `localStorage`** (`saveState()`/`flushSaveState()`, clé `novabourse_state_v1`). Implication : aucune synchronisation entre appareils, aucune sauvegarde serveur du portefeuille virtuel.
- **Paiement** : Stripe Checkout + Customer Portal + webhook (`api/stripe/webhook.js`). Le plan de l'utilisateur n'est JAMAIS décidé par le client — uniquement mis à jour par le webhook signé, en base.
- **Données marché** : plusieurs fournisseurs avec repli (EODHD, TwelveData, Finnhub, Coingecko, Frankfurter, Eulerpool), routés par `api/market/_router.js` et `api/market/_providers.js` (fichier de ~114 Ko à lui seul).
- **IA** : trois fournisseurs possibles (xAI/Grok, OpenAI, Anthropic) sélectionnés par disponibilité de clé (`api/analyze.js`), avec quota mensuel + limite horaire anti-abus (`api/_limits.js`), auth obligatoire (401 si non connecté), 429 si quota dépassé.
- **Déploiement** : Vercel, domaine `www.novabourse.site`.

## Ce qui N'EXISTE PAS (à ne pas auditer comme si ça existait)

- Next.js, React, aucun framework frontend.
- TypeScript, ESLint, Prettier, tsconfig.
- `app/`, `pages/`, `components/`, `hooks/` (au sens React).
- ORM (Prisma, Drizzle...) — les appels à Postgres passent par l'API REST de Supabase (`fetch` direct vers `SUPABASE_URL/rest/v1/...`).
- Service worker / PWA.
- Tests unitaires au sens classique — il existe des `scripts/test-*.js` (12 fichiers), des scripts Node autonomes qui **reproduisent fidèlement** la logique d'une fonction du SPA pour la vérifier isolément (voir `package.json`, section `scripts`).
- CI/GitHub Actions.

## Points de fragilité déjà identifiés

- **Un seul fichier de 2,7 Mo** pour tout le frontend : toute édition doit être précise (recherche par contexte unique), le risque de sélecteurs CSS dupliqués qui s'écrasent silencieusement est réel et documenté (plusieurs cas trouvés et corrigés cette session — voir AUDIT_REPORT.md).
- **Portefeuille en localStorage uniquement** : perte de données possible si l'utilisateur change de navigateur/appareil ou vide son cache. Aucune table serveur ne le sauvegarde.
- **`api/market/_providers.js`** (114 Ko) est le plus gros fichier du dossier `api/` — mérite un audit dédié si des bugs de données marché apparaissent (non fait dans cette passe, hors budget).
