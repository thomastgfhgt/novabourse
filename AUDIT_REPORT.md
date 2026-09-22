# NovaBourse — Rapport d'audit et de stabilisation (Étape 1)
Date : 2026-09-21

**Note de cadrage** : le brief d'audit initial supposait une architecture Next.js/React/TypeScript avec RLS Supabase et ORM. Ce n'est pas l'architecture réelle du projet (voir `CURRENT_ARCHITECTURE.md`). Les sections ci-dessous sont adaptées à ce qui existe vraiment ; celles qui n'ont pas d'équivalent réel sont marquées **SANS OBJET**.

---

## AUDIT_SUMMARY

Projet plus sain que le brief ne le laissait supposer côté backend (auth, Stripe, quotas IA bien construits, secrets propres). Les vrais problèmes trouvés cette session sont côté **frontend visuel/interaction**, majoritairement liés à un seul fichier CSS/JS de 17 700 lignes où des règles dupliquées s'écrasent silencieusement. Un audit réseau complet (console/erreurs live sur chaque page) n'a pas pu être terminé : la connexion à www.novabourse.site depuis cette machine est actuellement interceptée par un pare-feu Fortinet (inspection SSL), ce qui bloque à la fois `curl`, PowerShell et l'extension navigateur — voir section dédiée en fin de rapport, ce n'est pas un bug de l'application.

## ARCHITECTURE_SUMMARY

Voir `CURRENT_ARCHITECTURE.md`. En bref : SPA vanilla JS (`index.html`) + fonctions serverless Vercel (`api/`) + Supabase (auth + 3 tables réelles : `profiles`, `stripe_events`, une table de quota IA) + Stripe + multi-fournisseurs de données marché + multi-fournisseurs IA. Portefeuille/watchlist en `localStorage` uniquement, jamais en base.

## TECH_STACK

JavaScript vanilla (frontend), Node.js (fonctions Vercel), Supabase (Postgres + Auth), Stripe, `stripe` npm package (seule dépendance listée dans `package.json`). Aucun framework, aucun bundler, aucun TypeScript.

## CRITICAL_BUGS_FOUND / CRITICAL_BUGS_FIXED

Tous trouvés **en direct** (navigateur, pas seulement à la lecture du code), et corrigés dans l'ordre où ils ont été découverts :

1. **PROBLÈME** : le badge du logo dans l'en-tête (carré sombre arrondi) s'affichait comme une icône nue sans fond, sur toutes les pages.
   **CAUSE** : une seconde règle `.logo-m{...}` orpheline (jamais utilisée par aucun balisage, résidu d'une itération de design abandonnée) écrasait silencieusement la vraie règle, plus haut dans le fichier, à cause de l'ordre de cascade CSS.
   **FICHIER** : `index.html` (CSS).
   **STATUT** : FIXED (commit `591de70`).

2. **PROBLÈME** : un nom de société long ("Vanguard Total Stock Market Index Fund ETF Shares") débordait de la feuille de recherche au lieu d'être tronqué, provoquant un défilement horizontal.
   **CAUSE** : double cause — (a) `.row-t` était défini deux fois dans le CSS, la seconde définition (incomplète) écrasant la troncature de la première ; (b) même corrigé, `text-overflow:ellipsis` n'a aucun effet sur un élément `display:inline` (un `<span>` par défaut).
   **FICHIER** : `index.html` (CSS).
   **STATUT** : FIXED (commit `3c7926e`).

3. **PROBLÈME** : sous "réduction de mouvement" (préférence d'accessibilité système), des pages entières s'affichaient totalement vides (opacity:0), y compris le titre.
   **CAUSE** : la règle globale `*{animation-duration:.001ms!important}` (censée respecter la préférence) ne touchait ni `animation-delay` ni le `fill-mode:backwards` de l'animation d'entrée `.page-in>*`, utilisée par **tout élément de premier niveau de toute page**. La combinaison laissait le contenu bloqué à l'état "avant animation" (invisible) bien après la fin théorique de l'animation.
   **FICHIER** : `index.html` (CSS).
   **STATUT** : FIXED (commit `1b0b9bb`). Impact potentiel avant correctif : tout visiteur avec "réduire les animations" activé (préférence système fréquente) voyait un site cassé.

4. **PROBLÈME** : "Vendre" sur une fiche action liquidait la position ENTIÈRE instantanément, sans confirmation, montant à choisir, ni annulation possible — alors qu'"Acheter" passe par deux écrans réfléchis.
   **CAUSE** : absence pure et simple d'un écran de vérification côté vente (présent côté achat).
   **FICHIER** : `index.html` (JS, `openSellReview()` ajoutée, handler `[data-sell]` modifié).
   **STATUT** : FIXED (commits `8d5bcd0`, `2378b76`). Vérifié en conditions réelles (achat/vente simulés en direct).

5. **PROBLÈME** : les 3 suggestions rapides du Radar ("Une grande entreprise américaine solide"...) s'affichaient comme d'énormes cercles avec une icône géante au lieu de petites puces.
   **CAUSE** : un `<svg>` nu n'a aucune taille par défaut dans un navigateur (300×150px) ; `.chip` n'avait jamais eu besoin de règle de taille d'icône avant cet ajout, car c'était le premier endroit du site à mettre une icône dans une puce.
   **FICHIER** : `index.html` (CSS).
   **STATUT** : FIXED (commit `ec0e8a7`).

6. **PROBLÈME** : le filtre "Pays" (Radar, Explorer) affichait une puce "—", une puce littérale "null" (1047 sociétés du catalogue sur ~11 200), et des doublons anglais/français ("USA" à côté d'"États-Unis", "New Zealand", "Peru", "Cyprus"...). Au-delà du visuel : choisir "États-Unis" **ratait silencieusement** la société tagguée "USA" — vrai bug de résultats, pas seulement d'affichage.
   **CAUSE** : la liste de puces était construite directement depuis `stock.country` brut, sans normalisation.
   **FICHIER** : `index.html` (JS, nouvelle fonction `paysAffiche()` + `COUNTRY_ALIASES`, appliquée à Radar, Explorer et la répartition "Par pays" du portefeuille).
   **STATUT** : FIXED (commit `25da8d6`). Vérifié : le compteur de résultats passe de 4115 à 4116 sociétés une fois le doublon fusionné.

7. **PROBLÈME** (régression introduite puis corrigée dans la même session) : la barre de navigation du bas (mobile) perdait sa position fixe pendant le défilement.
   **CAUSE** : le fond animé "aurora" (ajouté cette session pour la demande "fond qui change de couleur") animait `filter` sur un calque `position:fixed;inset:0` couvrant tout le viewport — déclencheur connu de bugs de rendu pour d'autres éléments `position:fixed` (notamment avec `backdrop-filter`, comme la barre du bas) sur mobile.
   **FICHIER** : `index.html` (CSS).
   **STATUT** : FIXED (commit `d250f9c`), confirmé résolu par l'utilisateur sur son vrai téléphone.

8. **PROBLÈME** : le bouton "Voir les offres" dans l'en-tête disparaissait totalement sur téléphone (poussé hors écran).
   **CAUSE** : rien dans l'en-tête (logo, badge, icônes, bouton) ne rétrécit, et `body` a `overflow-x:hidden` — la largeur totale nécessaire (~424px) dépasse la largeur de la quasi-totalité des téléphones réels. Le dernier élément de la ligne (le bouton, le plus important pour la conversion) sortait simplement du cadre visible.
   **FICHIER** : `index.html` (markup + CSS, libellé court "Offres" en dessous de 600px).
   **STATUT** : FIXED (commit `e9f9a2b`, seuil élargi dans `a04c091`).

9. **PROBLÈME** : les 6 cases de la barre de navigation du bas avaient des hauteurs visiblement différentes ("Portefeuille" passait sur 2 lignes, les 5 autres sur 1).
   **CAUSE** : `min-width:60px` × 6 boutons + marges dépassait la largeur disponible sur la quasi-totalité des téléphones réels (calcul : ~384px nécessaires vs ~366-406px disponibles selon l'appareil).
   **FICHIER** : `index.html` (CSS, `flex:1` pour un partage garanti de la largeur).
   **STATUT** : FIXED puis AJUSTÉ (commit `e9f9a2b` puis `a04c091` après retour utilisateur : l'ellipse tronquait les libellés, remplacée par un retour à la ligne avec hauteur réservée uniforme sur les 6 cases).

10. **PROBLÈME** : la page "Offres" (tarification) pouvait s'afficher complètement vide.
    **CAUSE** : les cartes de plan utilisaient `.rise`, un effet de révélation au défilement qui démarre à `opacity:0` et ne redevient visible qu'après qu'un `IntersectionObserver` ajoute une classe `.seen` — un point de défaillance de plus (timing, appareil, cycle de rendu) sur la page la plus critique du site pour le revenu.
    **FICHIER** : `index.html` (JS/CSS, classe `rise` retirée des `.plan`).
    **STATUT** : FIXED (commit `a04c091`). Retour utilisateur en attente de confirmation finale.

## SECURITY_ISSUES_FOUND / SECURITY_ISSUES_FIXED

Aucune faille critique trouvée dans le backend (`api/`). Vérifié concrètement :
- **Secrets** : aucune clé API/secret en dur dans le code tracké par git (`index.html`, `api/`). `.env.local`/`.env.production.local` correctement exclus par `.gitignore`, confirmé absents de `git ls-files`.
- **Webhook Stripe** (`api/stripe/webhook.js`) : signature vérifiée (`stripe.webhooks.constructEvent`), corps brut correctement non-parsé, idempotence via table `stripe_events`, plan utilisateur **jamais** décidé par le client — uniquement écrit par le webhook côté serveur. Bien construit.
- **Auth** (`api/me.js`) : jeton Supabase vérifié côté serveur à chaque requête (`GET /auth/v1/user`), `SUPABASE_SERVICE_ROLE_KEY` utilisée uniquement côté serveur, jamais exposée, chaque lecture/écriture de `profiles` est filtrée par l'ID utilisateur issu du jeton vérifié (pas d'IDOR trouvé).
- **IA** (`api/analyze.js`) : authentification obligatoire (401 si non connecté), quota mensuel + limite horaire anti-abus, pas d'appel possible sans être identifié.
- **RLS** : SANS OBJET au sens strict (les endpoints utilisent la clé de service, qui contourne RLS par nature) — mais l'autorisation est appliquée correctement **au niveau applicatif** (filtrage systématique par `user.id` vérifié). Recommandation pour une étape ultérieure : activer RLS sur `profiles`/`stripe_events` comme deuxième couche de défense, même si la clé de service la contourne — utile si une route venait un jour à utiliser la clé anonyme par erreur.

**XSS — un vrai point trouvé et corrigé** : `esc()` échappe les caractères HTML mais ne valide jamais le SCHÉMA d'une URL. Deux endroits inséraient un `href` venu de données externes (lien d'un article d'actualité, site web d'une société — tous deux fournis par les fournisseurs de données marché tiers) sans vérifier qu'il s'agit bien de `http(s)` : un lien `javascript:`/`data:` serait passé tel quel. Ajout de `safeHref()` (n'autorise que http/https), appliqué aux deux points. Improbable avec un fournisseur de confiance, mais c'était un vrai trou, maintenant fermé (commit `d2490c4`). Le reste des 29 points d'insertion `innerHTML` du fichier a été échantillonné (données de recherche distante, contenu généré par l'IA, noms de liste utilisateur) plutôt qu'audité un par un — tous les échantillons vérifiés étaient soit correctement échappés, soit rendus via `textContent` (donc sûrs par construction, comme `toast()`).

## AUTH_STATUS
Fonctionnel, vérifié par lecture de code (voir ci-dessus). Test bout-en-bout (login réel) non refait cette session (déjà en usage par le vrai compte de l'utilisateur pendant les tests précédents).

## DATABASE_STATUS
3 tables réelles confirmées (`profiles`, `stripe_events`, table de quota IA). Portefeuille/watchlist/listes = localStorage uniquement, pas de table.

## RLS_STATUS
SANS OBJET tel que demandé (pas de RLS actif constaté) — autorisation applicative en place, voir SECURITY. **Point additionnel trouvé cette session** : le schéma des tables `profiles`/`stripe_events` (celles qui porteraient RLS) n'existe nulle part dans ce repository — `sql/` ne contient que le script du catalogue marché. Ces tables ont donc été créées directement dans le tableau de bord Supabase, hors contrôle de version. Conséquence pratique : je ne peux pas écrire de politique RLS en toute sécurité sans voir les colonnes réelles (risque de casser l'appli avec une policy mal calée) — à faire directement dans Supabase, ou en exportant d'abord le schéma réel vers `sql/` pour que ce soit vérifiable ici.

## STRIPE_STATUS
Sain, voir SECURITY_ISSUES_FOUND. Non testé en conditions réelles (mode test) cette session.

## MARKET_DATA_STATUS
6 fournisseurs avec repli (`_providers.js`, ~114 Ko / 3671 lignes). Échantillonné cette session (le fetch générique `getJSON()`, l'orchestrateur de repli `cascade()`, la liste des fonctions exportées) plutôt que lu intégralement (hors budget) : timeout explicite (9s, `AbortController`), erreurs capturées avec statut/corps, **clés API systématiquement retirées des URLs avant tout log d'erreur** (`urlSansCle()`) — bon réflexe de sécurité. `cascade()` essaie chaque fournisseur configuré dans l'ordre, journalise, s'arrête au premier succès. Rien d'alarmant trouvé sur l'échantillon lu ; pas une garantie sur les ~3600 lignes non lues. Fraîcheur des cotations affichée honnêtement à l'utilisateur (labels "Différé"/"Cours réels" vus en direct).

## AI_STATUS
Sain — auth + quota + rate limit vérifiés dans le code, voir SECURITY.

## SETTINGS_STATUS
Non re-testé en profondeur cette session (thème clair/sombre vérifié visuellement à plusieurs reprises, fonctionne).

## NAVIGATION_STATUS
Barre du bas et en-tête corrigés cette session (voir bugs 7-9). Navigation desktop (`.top-nav`) et routage interne (`route`/`render()`) fonctionnels dans tous les tests effectués.

## MOBILE_STATUS
Sujet principal de cette session — 4 bugs mobiles réels trouvés et corrigés (7, 8, 9, 10). Testé par calcul de largeur + simulation CSS précise (l'outil de redimensionnement de fenêtre du navigateur ne fonctionne pas dans cet environnement — confirmé à plusieurs reprises), plus confirmation directe de l'utilisateur sur son téléphone pour le bug 7.

## PERFORMANCE_STATUS
Non audité en profondeur cette session (hors budget). Point notable identifié sans être traité : les listes de catalogue (Explorer, Marchés) affichent des sous-ensembles paginés (`exploreVisibles`, `marketsVisibles` dans `state.filters`), pas les ~11 200 sociétés d'un coup — bon signe, pas de rendu de liste géante constaté.

## DEAD_BUTTONS_FOUND
Aucun bouton totalement mort trouvé. Le plus proche : le bouton "Vendre" qui agissait sans confirmation (bug 4, corrigé).

## FAKE_DATA_FOUND
Aucune donnée fictive présentée comme réelle. Le produit est au contraire construit autour de l'honnêteté des données manquantes ("—" plutôt qu'une estimation inventée, labels de fraîcheur explicites, "Portefeuille virtuel" toujours indiqué).

## TEXT_INCONSISTENCIES
Voir `CONTENT_ISSUES.md`.

## RELOAD_LOOP_CAUSE / RELOAD_LOOP_FIX
SANS OBJET pour la cause React/useEffect décrite dans le brief (pas de React). Aucune boucle de rechargement constatée dans les tests effectués cette session.

## BUILD_STATUS
SANS OBJET (pas de build step — `index.html` est servi tel quel). Validation faite à chaque modification via `node -e` (parsing du `<script>` avec `new Function()`) pour garantir l'absence d'erreur de syntaxe.

## TEST_STATUS
12 scripts dans `scripts/test-*.js`, tous exécutés et au vert après chaque modification de cette session (`node scripts/test-*.js`).

## PENDING_P2_P3_ISSUES
- `api/market/_providers.js` : ~3600 des 3671 lignes non lues individuellement (échantillon lu rassurant, voir MARKET_DATA_STATUS).
- ~~Messages d'erreur bruts potentiellement affichés~~ — vérifié cette session, non fondé (voir `CONTENT_ISSUES.md`) : chaque famille d'appel a soit une table de traduction avec repli honnête, soit ne transmet jamais le code brut à l'UI.
- RLS non activée, et surtout : le schéma des tables `profiles`/`stripe_events` n'est pas versionné dans ce repo (créé directement dans Supabase) — à corriger en exportant le schéma réel avant d'y toucher.
- Audit console/réseau live toujours bloqué par l'interception SSL Fortinet locale (revérifié cette session, toujours actif) — voir section suivante.

## WHAT_MUST_BE_DONE_IN_STEP_2
(Tel que cadré par l'utilisateur : refonte visuelle, motion system, fiches actions.) Rien d'autre à ajouter ici — l'étape 1 ne doit pas empiéter dessus.

## WHAT_MUST_BE_DONE_IN_STEP_3
NovaBot, Nova Review — non commencés, non nécessaires à cette étape.

## EXTERNAL_KEYS_OR_ACCOUNTS_NEEDED
Aucun besoin identifié cette session.

---

## Point bloquant à signaler : interception SSL locale

En tentant de compléter l'audit console/réseau en conditions réelles (navigation live sur chaque page), la connexion à `www.novabourse.site` depuis cette machine échoue systématiquement — `curl`, PowerShell **et** l'extension navigateur. Diagnostic fait avec `openssl s_client` : le certificat présenté pour `www.novabourse.site` n'est **pas** celui de Vercel/Let's Encrypt, mais un certificat réémis par un pare-feu **Fortinet** (`CN=FG2H1GT925902363, O=Fortinet`), signe d'une inspection SSL active sur le réseau local. Une requête vers `google.com` réussit normalement depuis la même machine — donc le problème est spécifique à ce domaine sur ce réseau, pas une panne de NovaBourse. **Ce n'est pas un bug du site** : c'est un point à vérifier de votre côté (réseau d'entreprise/logiciel de sécurité local) si vous voulez que je poursuive les tests en direct dans cette session.

**Mise à jour (2026-09-21, étape 2)** : intermittent plutôt que permanent — plusieurs vérifications en direct ont réussi pendant cette session (palette, dock, prix animés, segmented controls, morph de la recherche, tous confirmés visuellement). Le commit `f321459` (NovaOrb recoloré et enfin branché à l'attente de l'analyse IA) n'a en revanche pas pu être vérifié en direct : le blocage était actif au moment de tester. Changement de faible risque (couleur + un seul point de branchement déjà validé par la suite de tests et la lecture du code), mais à garder en tête si quelque chose semble visuellement décalé sur l'écran "Analyse en cours…" d'une fiche action.

**Mise à jour (2026-09-22) — contournement trouvé** : le blocage vise spécifiquement le domaine `www.novabourse.site` (probablement une catégorisation/liste du pare-feu, pas une IP). Le domaine Vercel par défaut du même déploiement, **`https://novabourse.vercel.app`**, sert exactement le même contenu et n'est PAS bloqué — confirmé en direct plusieurs fois. Attention cependant : `localStorage` et les cookies de session sont propres à chaque origine, donc une session ouverte sur `www.novabourse.site` n'est pas valide sur `novabourse.vercel.app` (une tentative d'analyse IA y a échoué avec "session expirée", comportement attendu, pas un bug). Utile pour des vérifications visuelles/de mise en page sans compte réel ; à garder comme solution de repli pour la suite tant que `www.novabourse.site` reste bloqué depuis cette machine.
