Tu vas installer le nouveau site NovaTitre dans ce dépôt, supprimer ce qui ne sert plus, et créer ce qui manque. Lis tout ce message avant de commencer.

## Qui je suis et comment me parler
- Je m'appelle Thomas. Je suis français et je ne parle pas bien anglais : réponds-moi TOUJOURS en français simple, phrases courtes, sans jargon (ou explique-le).
- Je préfère du travail complet, mais je veux valider avant chaque grosse action.

## Le projet
NovaTitre est une école de Bourse en ligne qui s'apprend en jouant : missions, vidéos de cours, simulateur avec de l'ARGENT FICTIF uniquement. Ce n'est pas un intermédiaire financier.
- Hébergement Vercel, base Supabase, paiement Stripe, site en JavaScript « vanilla » (PWA), domaine novatitre.com.
- L'ancienne version (outil d'analyse avec NovaBot et connexion au courtier Alpaca) est ABANDONNÉE.

## Le nouveau site (fourni par Thomas)
Thomas a placé à la racine du dépôt le dossier `_nouveau-site/` (contenu du fichier `novatitre-site.zip`) :
- `index.html` (page légère), `css/`, `js/` (dont `js/engine/`, `js/gl.js`, `js/vendor/three.min.js` + sa licence MIT), `content/` (missions, cours, examens, séances, données datées et sourcées) ;
- `tests/` + `package.json` (tests du moteur : `npm test`) ;
- `docs/API-DONNEES.md` (contrat des futures routes de données), `docs/CONNEXION.md` (connexion Google et code par e-mail) et ce prompt.
Il existe aussi un `index.html` « tout-en-un » (1,4 Mo) : c'est le MÊME site en un seul fichier, à utiliser seulement si la version découpée pose problème.
Le site doit rester IDENTIQUE pour l'utilisateur : tu ne changes ni le design, ni les textes, ni les animations. Tu ne renommes et ne supprimes AUCUN id, class ou attribut data-* utilisé par le JavaScript.

## Règles absolues (ne jamais les enfreindre)
1. **Une phase à la fois.** À la fin de chaque phase, tu t'arrêtes, tu fais le compte rendu (format plus bas) et tu attends que j'écrive « OK phase suivante ».
2. **Lecture seule d'abord.** La phase 0 ne modifie RIEN.
3. **Plan avant action.** Avant de modifier du code, tu me montres ton plan en quelques lignes.
4. **Rien n'est supprimé sans ma validation.** Tu proposes d'abord un tableau « garder / adapter / supprimer » avec, pour chaque ligne, la raison et la preuve (qui l'utilise ou non : recherche dans tout le dépôt). J'approuve ligne par ligne.
5. **Fichiers sensibles.** Tu ne modifies RIEN dans `api/`, `sql/`, la configuration Vercel (`vercel.json`), Stripe ou Supabase sans m'avoir montré exactement ce que tu vas faire et sans mon « OK » explicite pour ce fichier précis.
6. **Supabase** : tu ne touches à aucune table, aucune politique, aucune donnée. Aucun SQL exécuté. Pas de REVOKE global.
7. **Stripe** : rien en mode réel. Tu ne modifies ni les prix, ni les webhooks, ni les clés.
8. **Les secrets restent sur le serveur.** Clés Anthropic, Stripe, Supabase (service role) et fournisseur de données : uniquement dans les variables d'environnement Vercel. Jamais dans le code, jamais dans le navigateur, jamais dans Git. Si tu trouves un secret dans le code ou l'historique Git : tu t'arrêtes et tu me préviens, sans le recopier.
9. **Rien en production sans mon accord.** Tu travailles sur une branche. Tu peux créer un déploiement de PRÉVISUALISATION Vercel. La mise en production n'a lieu que si j'écris exactement « OK mise en ligne ».
10. **Sauvegarde.** Avant toute modification : un tag Git de sauvegarde de la branche principale. Jamais de `push --force` sur la branche principale.
11. **Honnêteté.** Ne prétends jamais avoir testé, vérifié ou modifié quelque chose si ce n'est pas vrai. Si tu n'es pas sûr, dis « à vérifier ».
12. **Produit.** Argent fictif uniquement. Aucun conseil en investissement, aucun signal d'achat ou de vente, aucune affiliation à un courtier. Pas de « diplôme » : « Certificat NovaTitre (certificat interne) ». L'IA ne reçoit jamais le nom ni l'e-mail de l'élève. Pas d'emoji dans l'interface. Respect de « réduire les animations ».

## Phase 0 — Audit en lecture seule (aucune modification)
1. Donne l'arborescence du dépôt (2 niveaux) et la taille des gros fichiers.
2. Pour chaque dossier et fichier de premier niveau : à quoi il sert, qui l'utilise (preuve : recherche dans le dépôt et dans `vercel.json`), s'il est encore utile pour l'école.
3. Repère en particulier :
   - les routes `api/` encore utiles (connexion Supabase, Stripe : paiement et webhooks, coach IA, légal) et celles liées à l'ancienne version (Alpaca, NovaBot, analyse, signaux) ;
   - le manifest de la PWA, le service worker, les icônes, `robots.txt`, le plan du site, les pages légales (mentions, CGU, confidentialité) : ils doivent être GARDÉS et reliés au nouvel `index.html` ;
   - les fichiers de l'ancien front (anciens `js/`, `css/`, harness, prototypes, maquettes, vidéos) ;
   - `sql/` (à garder comme historique, sauf décision contraire de ma part) ;
   - tout secret présent dans le code (sans le recopier).
4. Livre le tableau « garder / adapter / supprimer » (colonnes : chemin · rôle · utilisé par · décision proposée · raison). Classe à part ce qui est sensible (règle 5).
5. Arrête-toi.

## Phase 1 — Branche et sauvegarde
- Tag de sauvegarde de la branche principale (ex. `sauvegarde-avant-ecole-2026-11-03`), puis branche `refonte-ecole`.
- Compte rendu, arrêt.

## Phase 2 — Installer le nouveau site (front seulement)
1. Copie le contenu de `_nouveau-site/` à la racine : `index.html`, `css/`, `js/`, `content/`, `tests/`, `package.json`, `docs/`. Si un fichier du même nom existe déjà et sert encore (phase 0), tu me demandes avant de l'écraser.
2. Dans le nouvel `index.html`, ajoute UNIQUEMENT les liens indispensables trouvés en phase 0 : manifest, icônes, enregistrement du service worker, et, si la route existe et que je l'ai validée, `window.NT_AI_ENDPOINT = '/api/coach'`. Rien d'autre.
3. Le service worker : vérifie qu'il ne garde pas en cache l'ancien site (change son numéro de version si besoin, et montre-moi le changement).
4. Connexion (Google + code par e-mail) : lis `docs/CONNEXION.md`. La connexion Supabase du site actuel fonctionne déjà :
   - trouve comment elle est faite (client Supabase dans le navigateur ou routes `api/`) ;
   - propose-moi le branchement le plus simple de `window.NT_AUTH` (mode `supabase` ou mode `api`), avec la liste exacte des fichiers touchés ;
   - n'ajoute AUCUNE nouvelle clé dans le navigateur et ne change rien dans Supabase (tables, règles, réglages) ;
   - attends mon « OK » avant d'écrire.
   Les réglages Google et Supabase (section 3 du document) sont faits par moi.
5. Vérifications (voir phase 5), puis compte rendu, arrêt.

## Phase 3 — Supprimer l'inutile (après mon accord ligne par ligne)
- Supprime seulement les lignes « supprimer » que j'ai validées. Un commit par groupe (ex. « suppression de l'ancien front », « suppression de l'intégration Alpaca »), avec la liste des fichiers dans le message.
- Avant chaque suppression : prouve qu'aucun fichier restant ne l'utilise (recherche dans tout le dépôt).
- Les routes `api/` liées à Alpaca ou NovaBot : plan d'abord (règle 5). Si une variable d'environnement Vercel devient inutile, dis-le-moi : c'est moi qui la retire.
- Compte rendu, arrêt.

## Phase 4 — Créer ce qui est indispensable
1. `.env.example` : la liste des variables d'environnement nécessaires, SANS aucune valeur.
2. `README.md` en français simple : structure du site, lancer les tests (`npm test`), aperçu local, règles de sécurité.
3. Un test automatique de fumée (Playwright) qui ouvre le site sur téléphone (393×852) et ordinateur (1440×900), passe l'ouverture, visite Accueil, Parcours, Marchés, Portefeuille, Profil, Coach, lance une vidéo, la passe, répond à une mission, et échoue s'il y a une erreur JavaScript ou un bloc visible mais transparent. Il vérifie aussi que, sans compte, « Commencer » ouvre la page Connexion.
4. En-têtes Vercel recommandés (cache long pour `js/vendor/`, `css/`, `content/` ; pas de cache pour `index.html`) : PROPOSITION seulement (règle 5).
5. Routes de données (`api/marche`, `api/historique`, `api/news`) décrites dans `docs/API-DONNEES.md` : PLAN seulement (fournisseur, licence commerciale, quotas, cache, coût). Tu ne les codes qu'après mon accord ET la vérification de la licence du fournisseur. Le navigateur sait déjà les lire (lecture éteinte par défaut : on l'allume avec `window.NT_FEED_BASE = '/api'` dans `index.html`, une fois les routes en ligne et testées) et garde les données datées si elles n'existent pas.
6. Compte rendu, arrêt.

## Phase 5 — Vérifications (à chaque phase qui modifie quelque chose)
- `npm test` (les tests du moteur doivent tous passer).
- Le test de fumée de la phase 4 (dès qu'il existe).
- Aperçu local, puis déploiement de PRÉVISUALISATION Vercel : vérifie l'ouverture, l'installation sur téléphone (PWA), la connexion, le paiement en mode TEST seulement.
- Donne-moi le lien de prévisualisation. Ne mets RIEN en production sans « OK mise en ligne ».

## Format du compte rendu (à chaque fin de phase)
1. Ce que j'ai fait (liste courte).
2. Ce que j'ai vérifié, avec le résultat réel (et ce que je n'ai PAS pu vérifier).
3. Fichiers modifiés, créés, supprimés.
4. Questions ou décisions pour Thomas.
5. Prochaine phase proposée.
