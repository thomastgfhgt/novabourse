# Connexion NovaTitre : Google ou code par e-mail

Statuts : **Spécifié** = écrit et testé dans le site · **À confirmer** = décision ou réglage à faire par Thomas · **Bloqué** = attend un accès.

## 1. Ce que fait le site (Spécifié)

- **Page « Connexion »** plein écran, sans barre du bas :
  - « Continuer avec Google » ;
  - ou l'adresse e-mail, puis un **code à 6 chiffres reçu par e-mail** (pas de mot de passe) ;
  - le code se valide tout seul quand les 6 chiffres sont tapés ;
  - « Renvoyer le code » est possible au bout de 30 secondes ;
  - les erreurs s'affichent en français simple (code faux ou expiré, trop d'essais, pas d'internet).
- **Le compte est obligatoire pour faire le parcours** :
  - concerné : missions, séances, examens, épreuves et révisions (attributs `data-play`, `data-sheetplay`, `data-eclair`, `data-replay`, `data-session`, `data-exam`, `data-epreuve`, `data-review`) ;
  - sans compte, ces boutons ouvrent la page Connexion ;
  - une fois connecté, l'action demandée **reprend toute seule**, même après le passage par Google (elle est gardée dans `sessionStorage`).
- **Restent ouverts sans compte** : l'accueil, les marchés, Nova Coach, les jeux, la journée de trader, le Parcours (on peut le regarder).
- **Profil** : une carte « Mon compte » affiche l'e-mail et le bouton « Se déconnecter », ou le bouton « Se connecter ».
- **L'e-mail ne part jamais vers l'IA.**
- Interrupteur : `localStorage.setItem('nt-fx', '{"auth":false}')` retire la connexion, et plus rien n'est bloqué.

## 2. Branchement (Spécifié côté site, À confirmer côté serveur)

Le site lit `window.NT_AUTH`, à déclarer dans `index.html`. Il y a deux façons de le brancher.

**A. Avec le client Supabase que le site existant crée déjà** (Thomas : « la connexion Supabase marche déjà ») :

```html
<script>window.NT_AUTH = { mode: 'supabase', client: /* le client Supabase déjà créé par le site */ };</script>
```

Le site appelle alors :
- `signInWithOAuth({ provider: 'google' })` ;
- `signInWithOtp({ email })` ;
- `verifyOtp({ email, token, type: 'email' })` ;
- `getSession()`, `signOut()` et `onAuthStateChange()`.

**B. Par des routes du serveur** (aucune clé dans le navigateur, session dans un cookie `httpOnly`) :

```html
<script>window.NT_AUTH = { mode: 'api', base: '/api/auth' };</script>
```

| Route | Envoi | Réponse attendue |
|---|---|---|
| `GET /api/auth/google?redirect=<url>` | — | redirection vers Google (via Supabase), puis retour sur `<url>` avec la session |
| `POST /api/auth/email/start` | `{ "email": "…" }` | `204` (le code part par e-mail) |
| `POST /api/auth/email/verify` | `{ "email": "…", "code": "123456" }` | `200 { "user": { "id": "…", "email": "…" } }` |
| `GET /api/auth/session` | — | `200 { "user": {…} }` ou `401` |
| `POST /api/auth/logout` | — | `204` |

Erreurs : `400` code faux ou expiré, `429` trop d'essais.

**Le choix entre A et B est À confirmer par Thomas, après l'audit de Claude Code.**
- Si le site actuel met déjà la clé publique « anon » de Supabase dans le navigateur, c'est prévu par Supabase : elle est protégée par les règles d'accès (RLS). Mais la règle de Thomas est « aucune clé dans le navigateur » : il décide.
- Les routes `api/` ne se codent qu'après son accord.

**Sans branchement :**
- sur `novatitre.com` et `*.vercel.app`, la page affiche « Connexion bientôt disponible » et rien n'est bloqué : le site reste utilisable ;
- ailleurs (aperçu), un **mode démonstration** est clairement indiqué : aucun e-mail n'est envoyé et le code `123456` permet de voir la suite.

## 3. Réglages à faire dans Supabase et Google (À confirmer, par Thomas)

Rien de tout cela ne se fait dans le code, et aucune table n'est touchée.

1. **Supabase → Authentication → Providers → Email** : activé.
2. **Supabase → Authentication → Email Templates → « Magic Link »** : mettre le code `{{ .Token }}` à la place du lien. Texte proposé :
   > Ton code NovaTitre : **{{ .Token }}**. Il est valable quelques minutes. Si tu n'as rien demandé, ignore cet e-mail.
3. **Durée de validité du code** : 10 minutes conseillées (*À confirmer*).
4. **Google Cloud Console** :
   - créer un identifiant OAuth de type « Application Web » ;
   - adresse de retour autorisée : `https://<ton-projet>.supabase.co/auth/v1/callback` ;
   - remplir l'écran de consentement (nom NovaTitre, logo, liens CGU et confidentialité).
5. **Supabase → Providers → Google** : coller l'ID client et le secret client. Le secret reste dans Supabase, jamais dans le code.
6. **Supabase → URL Configuration** :
   - Site URL : `https://novatitre.com` ;
   - Redirect URLs : `https://novatitre.com/**` et l'adresse des aperçus Vercel.
7. **Logo Google** : les règles de marque de Google demandent leur logo officiel sur le bouton.
   - Télécharger le fichier officiel sur le site Google Identity (« branding guidelines »).
   - Le mettre dans `img/`, puis déclarer `window.NT_GOOGLE_ICON = 'img/<nom-du-fichier>.svg'`.
   - Sans ce fichier, le bouton s'affiche en texte seul.

## 4. Sécurité et vie privée (À confirmer)

- Le blocage du parcours dans le navigateur est un **confort**, pas une protection. Les données (progression, Premium, paiements) doivent être protégées côté Supabase par les règles déjà en place. Aucune règle n'est modifiée sans plan validé.
- La progression est aujourd'hui gardée dans le navigateur. La synchroniser avec le compte est l'**étape suivante** : plan d'abord, tables existantes à vérifier par Claude Code, aucun SQL sans accord.
- L'e-mail est une donnée personnelle. La politique de confidentialité doit citer la connexion Google et Supabase.
- **Mineurs** : en France, un mineur de moins de 15 ans a besoin de l'accord d'un parent pour certains traitements de données. À vérifier avec un juriste, surtout pour Nova Campus.
