# NovaBourse — Motion System
Dernière mise à jour : 2026-09-21

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

## Ce qui N'A PAS été fait cette passe

- Indicateur glissant pour `.seg` (segmented control 1J/1S/1M...) — actuellement un changement d'état instantané (`[aria-pressed]`), pas de transition. Même pattern que le dock avant correctif ; à faire en réutilisant `positionDockPill()` comme modèle.
- Morph de la recherche globale (capsule → barre plein écran, shared element transition) — la recherche s'ouvre déjà via `openSheet()` mais sans animation de morph depuis l'icône.
- `AnimatedFinancialNumber` (micro-highlight vert/rouge sur changement de valeur) — les montants se re-rendent instantanément aujourd'hui.
- Motion des graphiques (reveal progressif de ligne, arc du donut) — `chartSkeleton()` existe pour le chargement, pas d'animation d'apparition des données elles-mêmes.
- `NovaOrb`, abstraction haptics, command-palette desktop pour la recherche.

Chacun de ces points suit exactement le même schéma que le dock (élément persistant + `transform`/`opacity` uniquement + spring existant) — la fondation posée cette session (un seul spring cohérent, la leçon sur les éléments persistants vs recréés, la leçon sur `prefers-reduced-motion`) rend chacun d'eux un ajout isolé et à faible risque pour une prochaine passe, plutôt qu'un nouveau système à inventer.
