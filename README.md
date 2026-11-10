# NovaTitre — l'école de Bourse qui s'apprend en jouant

NovaTitre apprend la Bourse avec des missions, des vidéos de cours, des examens et un **Certificat NovaTitre (certificat interne)**. Tout se fait avec de **l'argent fictif** : aucun ordre réel, aucun conseil en investissement, aucun courtier partenaire. NovaTitre n'est pas un intermédiaire financier.

Hébergement Vercel · comptes Supabase · paiement Stripe · JavaScript sans framework (application installable sur téléphone) · domaine novatitre.com.

## Structure du site

| Dossier ou fichier | À quoi il sert |
|---|---|
| `index.html` | Page légère qui charge `css/`, `js/` et `content/`. **L'ordre des scripts compte.** |
| `css/` | Styles du site. |
| `js/engine/` | Moteur pur (calculs, habilitations), testé par `npm test`. |
| `js/vendor/three.min.js` | Three.js r149 (licence MIT, voir `three.LICENSE.txt`) pour les points lumineux 3D. Sans WebGL ou avec « réduire les animations », le site garde sa version 2D. |
| `js/gl.js`, `js/candles.js` | Effets 3D et graphiques en chandeliers. |
| `js/ai.js` | Nova Coach côté navigateur : parle à `/api/coach`, ou répond seul (réponses simples) si l'IA n'est pas joignable. |
| `js/branchements.js` | Branche le vrai site : connexion Supabase (`NT_AUTH`), coach (`NT_AI_ENDPOINT`), paiement (`NT_PAY`). Sans configuration, il ne fait rien. |
| `js/app.js` | L'application (pages, missions, vidéos, examens, portefeuille fictif…). |
| `content/` | Missions, cours, examens, séances, cours réels **datés et sourcés** (`market-real.js`), actualité datée (`realdata.js`). |
| `api/` | Routes du serveur (Vercel) : `me.js` (profil et offre), `config.js` (valeurs publiques), `coach.js` (Nova Coach), `stripe/` (paiement). |
| `manifest.webmanifest`, `sw.js`, `icons/` | Application installable et usage hors ligne. |
| `docs/` | `CONNEXION.md` (connexion Google et code par e-mail), `API-DONNEES.md` (futures routes de données de marché), le prompt de nettoyage. |
| `sql/` | Historique de la base Supabase et `PROPOSITION-nettoyage-ecole.md` (rien n'est exécuté sans accord). |
| `tests/` | Tests du moteur, du serveur et le test de fumée. |

## Tests

- `npm test` : moteur du site, routes du serveur (coach, relais des IA, Stripe, profil) et `js/branchements.js`. Aucun appel réel : Supabase, les IA et Stripe sont simulés.
- `npm run test:fumee` : test de fumée dans un vrai navigateur, sur **téléphone (393×852)** et **ordinateur (1440×900)**. Il passe l'ouverture, visite Accueil, Parcours, Marchés, Portefeuille, Profil et Coach, vérifie que « Commencer » sans compte ouvre la Connexion, se connecte en mode démonstration, lance puis passe une vidéo et répond à une mission. Il échoue en cas d'erreur JavaScript ou de bloc visible mais transparent. Il utilise le Chrome installé (`NT_NAVIGATEUR=msedge` pour Edge).

Avant le premier lancement : `npm install`.

## Aperçu local

`npx serve .` puis ouvrir l'adresse affichée.
En local, le site n'a pas de configuration : la connexion passe en **mode démonstration** (aucun e-mail envoyé, code `123456`), le coach répond seul et le paiement reste simulé.

## Branchements du vrai site

| Branchement | Comment | Réglages |
|---|---|---|
| Connexion | Supabase (Google ou code à 6 chiffres par e-mail), mode A de `docs/CONNEXION.md`. La clé « anon » est publique par conception, protégée par les règles RLS. | Supabase : Google activé, adresses de retour, modèle d'e-mail avec `{{ .Token }}`. |
| Nova Coach | `/api/coach` : Claude, puis Grok, puis OpenAI en relais. Élève connecté obligatoire ; 30 messages par mois (Découverte), 300 (Premium), 20 par heure. | Clés `ANTHROPIC_API_KEY`, `XAI_API_KEY`, `OPENAI_API_KEY` dans Vercel. |
| Paiement | Stripe Checkout et espace client. Premium 7,99 €/mois ou 59,99 €/an, essai gratuit de 7 jours au premier abonnement. | Clés Stripe et prix dans Vercel (`.env.example`). **Mode test uniquement** : verrou dans `api/stripe/_stripe.js`. |
| Données de marché | Pas encore : le site affiche ses cours datés et sourcés. Les routes de `docs/API-DONNEES.md` attendent l'autorisation écrite du fournisseur. On les allumera avec `window.NT_FEED_BASE = '/api'`. | — |

La liste des variables d'environnement est dans `.env.example` (noms seulement).

## Règles de sécurité

- **Aucun secret dans le code, le navigateur ou Git** : clés Anthropic, xAI, OpenAI, Stripe, Supabase (service_role) uniquement dans les variables Vercel.
- **L'IA ne reçoit jamais le nom ni l'e-mail de l'élève** ; les e-mails et téléphones tapés dans une question sont effacés avant l'envoi. Les règles du coach (aucun conseil d'achat ou de vente) sont écrites côté serveur.
- **L'offre (Premium) est décidée par le serveur** (webhook Stripe signé), jamais par le navigateur.
- **Stripe en mode test** tant que le verrou du code n'est pas levé par un commit relu.
- **Supabase** : aucune table ni règle modifiée sans plan validé ; aucun SQL exécuté automatiquement.
- **Production** : uniquement après « OK mise en ligne » de Thomas.

## Interrupteurs des effets

Interrupteurs des effets : `localStorage.setItem('nt-fx', '{"sound":false}')` (clés : pages, fly, touch, numbers, mission, level, sound, home, immersive, objects, v32, parcours, nodes, pcchart, pcobj, parcours2, cards, coachapp, coachgl, auth, bourse, world, vid5, vidalways, vidnav, vidfill, vidcam, vidrecap, vidpts, vidmusic, courbe, vidschema, vidspeed, vidcont, vidschema2, liquid, novadrop, mirror, quiz2, vidrappel, vidvoice, vidschema3, homenext, bilan, vidnospoil, nolesson, vidplus). Exemples : `{"pcchart":false}` retire le graphique derrière le Parcours ; `{"pcobj":false}` remet les anciens objets 3D du Parcours. Vidéos de cours : `{"vidalways":false}` ne montre la vidéo que la première fois ; `{"vid5":false}` remet l'ancienne vidéo. Vidéos plus vivantes : `{"vidpts":false}` retire la poussière lumineuse, `{"vidcam":false}` la caméra lente, `{"vidnav":false}` le toucher (avancer, revenir, pause), `{"vidmusic":false}` remet la musique courte. Fond de l'accueil et du Parcours (une vraie courbe, puis le globe des Bourses en traits fins) : `{"courbe":false}` remet les anciens fonds en points. Vidéos : `{"vidschema":false}` retire les nouveaux schémas (tendance, supports, stop, obligation, frais, émotions…), `{"vidspeed":false}` le bouton de vitesse, `{"vidcont":false}` l'enchaînement des scènes liées. Schémas des chapitres arnaques, enveloppes, bougies et plan de trading (enveloppes PEA/PER/livret, vérifier un acteur, faux site, bougie expliquée, volume, plan, journal, règle du 1 %, ratio gain/risque) : `{"vidschema2":false}` les retire. Barre de navigation en verre liquide sur téléphone et tablette (gouttes qui fusionnent, reflets, bouton Nova Coach qui tombe dans la barre quand on descend) : `{"liquid":false}` remet l'ancienne barre ; elle revient aussi seule sans WebGL, avec « réduire les animations », sur ordinateur ou si l'appareil est trop lent. Bouton Nova Coach partout (goutte de verre en bas à droite pendant les missions, les jeux, les vidéos de cours et sur ordinateur ; il ouvre Nova Coach sur la question ou la phrase en cours, sans donner la réponse avant que l'élève ait répondu, et finit par une petite question pour vérifier qu'il a compris ; caché pendant les examens) : `{"novadrop":false}` le retire. Effet miroir sur les boutons d'action (bouton principal blanc avec reflet irisé, autres boutons en verre, bord arc-en-ciel ; on peut les étirer comme une gelée en glissant le doigt, un glissé de plus de 40 px n'est pas un clic) : `{"mirror":false}` le retire. Questions d'apprentissage : dans les 80 QCM, de vraies fausses pistes (erreurs de débutant) remplacent les réponses absurdes, et chaque mauvaise réponse a son « Pourquoi pas ta réponse » sous la correction (pas pendant les examens) ; 14 vrai/faux passent en version fausse crédible (40 « Vrai » / 41 « Faux » au lieu de 54 / 27). Le texte d'origine des missions n'est pas modifié : `{"quiz2":false}` remet les questions d'avant. Vidéos : quand l'élève a déjà terminé une mission sur la même fiche, la fiche n'est plus relue en entier, une scène « Rappel » la remplace (`{"vidrappel":false}` pour tout relire) ; bouton haut-parleur en haut de la vidéo pour la faire lire par la voix de l'appareil (coupée par défaut, choix gardé ; `{"vidvoice":false}` retire le bouton) ; 5 nouveaux schémas (cartes à ranger dans le bon bac, intérêts composés calculés, pourcentages enchaînés, répartition d'un portefeuille, moyenne mobile / RSI / MACD) : `{"vidschema3":false}` les retire. Accueil : une carte « À faire maintenant » avec un seul bouton dès le premier écran (`{"homenext":false}` la retire). Fin de mission : « Ton bilan » liste chaque question (réussie, rattrapée, à revoir) à la place de la phrase générale (`{"bilan":false}`). Vidéos : elles enseignent la notion sans montrer la question, ses choix et la bonne réponse quand l'explication se comprend seule (`{"vidnospoil":false}` remet les scènes question + réponse). Les scènes « paires » ne passent plus sous le texte sur petit écran. Leçons : les 15 missions « Leçon » (introductions de chapitre) se font en vidéo ; la vidéo vue jusqu'au bout valide la leçon, et si on la passe, la leçon à lire reste affichée (`{"nolesson":false}` remet les leçons à lire). Vidéos plus complètes : pour les 36 fiches, 3 scènes en plus, « En clair », « Autre exemple » (chiffres tels qu'écrits) et « Le piège » (`{"vidplus":false}` les retire).
