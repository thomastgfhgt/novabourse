# Proposition — en-têtes de cache Vercel

**Rien n'est appliqué.** `vercel.json` est un fichier sensible : il ne change qu'avec l'accord de Thomas.

## Le point important avant de choisir

Les fichiers du site gardent toujours le même nom (`js/app.js`, `content/missions-1.js`…), même quand on les modifie.

Si le navigateur les garde **longtemps** sans redemander, un élève peut voir **l'ancienne version** d'une mission pendant des jours après une mise à jour. Il y a deux façons propres d'avoir un cache long :

- **A. Cache long seulement pour ce qui ne change jamais** : `js/vendor/` (Three.js r149) et `icons/`. Pour le reste (`css/`, `js/`, `content/`), un cache court qui se met à jour seul. C'est simple, rien d'autre à changer. **Conseillé pour commencer.**
- **B. Cache long partout**, en ajoutant un numéro de version dans `index.html` (par exemple `content/missions-1.js?v=2026-11-10`), à changer à chaque mise à jour. C'est plus rapide pour l'élève, mais il faut penser au numéro à chaque fois.

Dans les deux cas, `index.html` et `sw.js` ne doivent **jamais** être gardés : c'est ce qui permet aux mises à jour d'arriver.

## Proposition A (à ajouter dans `vercel.json`, section `headers`)

```json
{ "source": "/", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
{ "source": "/index.html", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
{ "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
{ "source": "/js/vendor/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
{ "source": "/icons/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=604800" }] },
{ "source": "/manifest.webmanifest", "headers": [{ "key": "Cache-Control", "value": "public, max-age=86400" }] },
{ "source": "/(css|js|content)/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600, stale-while-revalidate=86400" }] }
```

| Fichiers | Durée | Pourquoi |
|---|---|---|
| `index.html`, `/`, `sw.js` | toujours redemandés (`no-cache`) | les mises à jour arrivent tout de suite |
| `js/vendor/` | 1 an, « immuable » | Three.js r149 ne change pas ; pour une nouvelle version, on change le nom du fichier |
| `icons/` | 7 jours | changent rarement |
| `manifest.webmanifest` | 1 jour | nom, couleurs, icônes de l'application |
| `css/`, `js/`, `content/` | 1 heure, puis mise à jour en arrière-plan | assez rapide, et une correction arrive dans l'heure |

`no-cache` ne veut pas dire « jamais en mémoire » : le navigateur garde la page mais demande à chaque fois si elle a changé. Si rien n'a changé, la réponse est très courte.

## Ce que fait déjà le service worker (`sw.js`)

Il garde une copie du site pour l'usage hors ligne, mais demande toujours le réseau d'abord. Son cache porte un numéro (`novatitre-ecole-v3`) : à chaque changement de ce numéro, l'ancien cache est effacé chez tous les élèves. Les réponses de `/api/` ne sont jamais gardées.

## En plus (facultatif) : protection du contenu de la page

Les en-têtes de sécurité actuels (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, `Permissions-Policy`) sont gardés. On pourra ajouter plus tard une politique de contenu (`Content-Security-Policy`) limitant les sites d'où viennent les scripts : notre site, `cdn.jsdelivr.net` (Supabase), les polices Google, et Supabase pour la connexion. À tester sur une prévisualisation avant toute mise en ligne.

Attention aussi : `Permissions-Policy` coupe le micro (`microphone=()`). Le site n'en a pas besoin aujourd'hui : la lecture à voix haute des vidéos utilise la voix de l'appareil, pas le micro.
