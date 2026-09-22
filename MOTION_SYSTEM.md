# NovaBourse — Motion System
Dernière mise à jour : 2026-09-23

## Principe directeur

Une seule courbe spring, appliquée partout : `--spring: cubic-bezier(.32,.72,0,1)`. Le brief demandait des dizaines de presets nommés (`springButton`, `springSheet`, `springCard`...) avec des valeurs stiffness/damping à ajuster "visuellement" — impossible à faire sérieusement sans pouvoir tester chaque courbe en direct sur de vraies interactions (le blocage réseau de cette session, voir `AUDIT_REPORT.md`, a rendu ça intermittent). Une courbe unique, déjà réglée et éprouvée dans ce fichier depuis le début du projet, cohérente partout, vaut mieux que dix courbes non vérifiées qui risquent de se contredire visuellement.

```css
--ease:cubic-bezier(.32,.72,0,1);
--spring:cubic-bezier(.32,.72,0,1);  /* actuellement identique à --ease */
--fast:.14s;  --slow:.28s;
```

Ces variables couvrent déjà, en pratique, les usages demandés par le brief :
- **springButton** → `button{transition:all .2s var(--spring)}` + `:active{transform:scale(.97)}` (déjà en place)
- **springSheet** → `.sheet-bg`/`.sheet` (transitions d'ouverture/fermeture, déjà en place)
- **springNavigation** → voir "Dock" ci-dessous, nouveau cette session

## Dock (barre de navigation du bas) — refonte de cette session

**Avant** : chaque bouton avait son propre `::before` qui apparaissait en `scale(.7)→scale(1)` + fondu quand il devenait actif ; l'ancien bouton actif perdait juste son fond, sans transition de sortie. Exactement le défaut que le brief interdit explicitement : "la capsule ne doit PAS disparaître puis réapparaître."

**Maintenant** : un seul élément `.dock-pill`, persistant (jamais recréé — voir commit `c665943` pour pourquoi c'était le vrai bug), repositionné à chaque navigation via `positionDockPill()` :

```js
pill.style.transform = `translateX(${active.offsetLeft}px)`;
pill.style.width = active.offsetWidth + 'px';
```

```css
.dock-pill{transition:transform .45s var(--spring), width .45s var(--spring)}
```

Repositionné aussi au redimensionnement (`resize`), sans transition ce coup-là (`.no-anim`) pour ne pas animer un simple changement de largeur d'écran comme s'il s'agissait d'une navigation.

Vérifié en direct cette session : le même nœud DOM survit à une navigation (`pill === pill2` après changement de route), condition nécessaire pour qu'une transition CSS s'exécute réellement.

## Fond ambiant (aurora)

- Dérive lentement en position : `auroraDrift`, 26-32s selon la tache, `ease-in-out infinite`.
- Change de teinte : `auroraHue`, ±18° en 60s (voir `DESIGN_SYSTEM.md` pour le pourquoi du resserrement par rapport à un tour complet).
- `will-change:transform` sur les taches, JAMAIS sur `.aurora-bg` lui-même (voir commit `d250f9c` — animer `filter` sur le calque `position:fixed;inset:0` entier cassait le rendu d'autres éléments fixes comme le dock, bug réel trouvé et corrigé cette session).
- `prefers-reduced-motion:reduce` coupe l'animation des taches, jamais l'effet (le dégradé reste visible, figé).

## `prefers-reduced-motion` — bug réel trouvé et corrigé cette session

La règle générique `*{animation-duration:.001ms!important}` ne touchait ni `animation-delay` ni `fill-mode:backwards` de `.page-in>*` (l'animation d'entrée de CHAQUE page). Combinaison qui laissait des pages entières invisibles (`opacity:0`) pour tout visiteur avec cette préférence système activée — bug potentiellement sérieux, voir commit `1b0b9bb`. Corrigé en désactivant franchement l'animation sous cette préférence plutôt qu'en réduisant sa durée à presque zéro (le même correctif a ensuite servi de modèle pour l'aurora).

**Règle apprise, à appliquer à toute future animation "backwards"/"both" avec délai** : sous `prefers-reduced-motion`, toujours `animation:none`, jamais une durée quasi nulle — cette dernière approche a un historique de bugs dans ce fichier (deux occurrences distinctes trouvées cette session).

## `AnimatedFinancialNumber` — fait (mise à jour du 2026-09-21, suite)

Implémenté comme une **animation** (keyframes), pas une transition — c'est le point technique qui la rend possible dans ce codebase : `PAGES.stock()`/`stockRow()` sont entièrement recréées à chaque `render()`, un élément neuf n'a donc pas d'état "avant" pour une transition, mais une animation CSS joue correctement dès son insertion, sans avoir besoin de connaître son état précédent.

- `PRICE_FLASH` (Map stockId → 'up'/'down') posée par `liveTick()` uniquement quand le prix AFFICHÉ change réellement (réutilise le garde-fou anti-boucle-de-rechargement déjà en place).
- Consommée (supprimée) à la première lecture — `.price` sur la fiche action (commit `1ef0c46`), `.row-px` dans `stockRow()` donc sur Accueil/Radar/Explorer/Marchés/Suivi (commit `7cccd59`).
- `prefers-reduced-motion` coupe l'animation (vérifié en direct dans l'environnement de test de cette session, qui a justement cette préférence activée — confirmation en conditions réelles, pas seulement en lisant le CSS).
- Limite connue et acceptée : un même titre affiché dans deux listes sur la même page (rare — ex. "Ma liste" et "Marché" sur l'accueil) ne flashe que dans la première lue ; le prix reste correct partout, seule l'animation ne se répète pas.

## Segmented controls — fait (2026-09-21, suite)

Les 8 `.seg` du fichier (période de graphique, période portefeuille, période comparateur, simple/détaillé — 2 endroits, thème — 2 endroits dont un à 3 options via `segControl()`, cycle de facturation) ont maintenant un curseur qui glisse réellement, via la technique FLIP plutôt qu'une transition passive (voir plus haut pourquoi le dock et les `.seg` ne pouvaient pas utiliser la même solution). Une seule capture générique ajoutée en tête du handler de clic partagé — aucune des poignées `data-chart-period`/`data-mode`/etc. individuelles n'a eu besoin d'être modifiée. Vérifié en direct sur la page Réglages ("Niveau de détail" Simple → Détaillé) : position finale du curseur exactement alignée sur `offsetLeft` du bouton actif.

## Recherche globale — fait (2026-09-21, suite)

`openSearch(origin)` capture l'élément réellement cliqué (icône loupe de l'en-tête, ou tout autre bouton portant `data-search` — état vide, page Explorer...) et fait démarrer la feuille de recherche visuellement depuis sa position/taille à l'écran, plutôt que le scale-up-from-center générique des autres feuilles. Même technique FLIP que les `.seg`. Uniquement au-dessus de 640px (voir le commentaire dans le code pour pourquoi : en dessous, `.sheet` devient une feuille pleine largeur ancrée en bas, partir d'une icône de 38px donnerait un étirement au lieu d'un morph — le slide-up mobile existant reste inchangé et adapté). Vérifié en direct : `--morph-from` calculé correctement (`translate(336px,-336px) scale(.10,.23)` pour l'icône testée), état final correctement centré et dimensionné.

## Dégradé animé du bouton primaire — fait (2026-09-22)

`.btn-a` : `background-size:200% 200%` + `animation:gradientShift 4s ease-in-out infinite` (glissement diagonal 135deg orange-500→orange-light). `prefers-reduced-motion:reduce` → `animation:none` (jamais une durée quasi nulle, même règle que partout ailleurs dans ce fichier). Vérifié en direct dans l'environnement de test (qui a cette préférence activée) : l'animation est bien coupée net, pas juste ralentie.

## Sélection du dock — icône scale+rotate (2026-09-22)

Ajouté sur `.dock button[aria-current] svg` : `transform:scale(1.05) rotate(5deg)`, transition `.3s ease-out` déjà en place sur `svg{transition:transform...}` (pas une nouvelle propriété à animer, réutilise l'existant). Pas de FLIP nécessaire ici contrairement à `.dock-pill` : c'est une transform appliquée directement à l'élément actif au moment où `aria-current` change, pas une position recalculée entre deux éléments.

## Bug réel trouvé et corrigé (2026-09-22) : libellés du dock qui se chevauchent

Le dock agrandi (100px, refonte "Revolut-level") a un libellé de 12 caractères (`Portefeuille`) qui débordait de sa colonne (~57px de large sur mobile réel à 6 destinations) et recouvrait visuellement le bouton suivant. `white-space:normal` seul ne suffit pas : un mot français unique et long n'a pas d'espace où se couper. Fixé avec `hyphens:auto;overflow-wrap:break-word` sur `.dock button span` — le document est `lang="fr"`, le dictionnaire de coupure français s'applique sans configuration supplémentaire. Vérifié en direct : coupure propre (`Porte-feuille`) uniquement pour les mots qui en ont besoin, les libellés courts restent sur une ligne.

**Leçon méthodologique sur la vérification mobile elle-même** : `resize_window` reste non fiable dans cet environnement (rapporte un succès sans changer réellement `window.innerWidth`, ou change la fenêtre à une hauteur inutilisable ~96px). La technique de repli — injecter un `<style>` reproduisant `@media(max-width:900px)` — doit être fidèle au **code réellement déployé**, pas retapée de mémoire : une première tentative avait omis les règles `.dock button`/`.dock button svg` et le dégradé de fond, ce qui aurait pu masquer ce bug plutôt que le révéler. Méthode fiable retenue : `fetch('/index.html',{cache:'no-store'})` puis extraction programmatique (comptage d'accolades) de tous les blocs `@media (max-width:900px){...}` du fichier, injectés tels quels dans un nouvel onglet propre.

## Dock — timing dédié 2026-09-23

Le mécanisme de pilule glissante (`positionDockPill()`, inchangé — voir plus haut) satisfaisait déjà l'exigence "la même capsule doit glisser, jamais disparaître/réapparaître" depuis le 21/09. Seul le timing a changé pour ce brief précis, qui donnait une valeur exacte : `.45s var(--spring)` (`cubic-bezier(.32,.72,0,1)`, générique à tout le site) → `.3s cubic-bezier(.22,1,.36,1)` (propre au dock uniquement, le reste du site garde `--spring`). Même chose sur la transition `transform`/`opacity` des icônes (`.25s`). `prefers-reduced-motion:reduce` coupe maintenant explicitement la transition de la pilule ET des icônes du dock (trou trouvé pendant cette passe : la pilule utilise `transition`, pas `animation`, donc la règle générique `*{animation-duration:.001ms}` ne la touchait pas — il fallait une règle dédiée, maintenant ajoutée).

## Méthode de test responsive fiabilisée (2026-09-23)

Pour vérifier les 8 largeurs demandées (320 à 768px) sans `resize_window` fiable (toujours cassé dans cet environnement, voir plus haut) : mesure de la largeur réelle de chaque libellé au **canvas** (`ctx.measureText`, indépendant de la taille de fenêtre — donne des nombres exacts à n'importe quelle taille de police hypothétique sans avoir besoin de redimensionner quoi que ce soit), puis vérification du rendu réel en simulant la largeur du conteneur (technique déjà en place, voir plus haut) ET en forçant explicitement `.dock{width:...px}` à la valeur que produirait chaque largeur cible (le dock étant `position:fixed`, sa largeur se calcule contre le vrai viewport, pas contre le conteneur simulé — il faut donc la forcer séparément à chaque test). Pour les paliers `@media(max-width:390px)`/`@media(max-width:360px)`, extraction de leur contenu et injection inconditionnelle séparée (ces media queries imbriquées ne se déclenchent pas non plus avec un conteneur simulé, seul un vrai changement de largeur de viewport les activerait). Combinaison qui a permis de calculer et vérifier les 3 paliers de tailles avant déploiement, plutôt que de deviner.

## Ce qui N'A PAS été fait cette passe

- Motion des graphiques (reveal progressif de ligne, arc du donut) — `chartSkeleton()` existe pour le chargement, pas d'animation d'apparition des données elles-mêmes.
- `NovaOrb`, abstraction haptics, command-palette desktop pour la recherche.

Chacun de ces points suit exactement le même schéma que le dock (élément persistant + `transform`/`opacity` uniquement + spring existant) — la fondation posée cette session (un seul spring cohérent, la leçon sur les éléments persistants vs recréés, la leçon sur `prefers-reduced-motion`) rend chacun d'eux un ajout isolé et à faible risque pour une prochaine passe, plutôt qu'un nouveau système à inventer.
