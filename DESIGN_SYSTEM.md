# NovaBourse — Design System
Dernière mise à jour : 2026-09-22

**Note de cadrage** (comme pour l'audit d'étape 1) : ce document décrit un système de design réel, implémenté en CSS/variables custom properties dans `index.html` — pas des composants React (`NovaButton`, `design/tokens/colors.ts`...). Il n'y a ni framework ni bundler. "Composant" ci-dessous signifie : une classe CSS + éventuellement une fonction JS qui génère le HTML correspondant (ex. `esc()`, `svg()`, `avatar()`).

## Palette officielle

Noir et blanc structurent l'interface, orange/bleu/vert portent l'identité de marque.

**Mise à jour 2026-09-22** : valeurs hexadécimales exactes fournies dans le brief "Revolut-level" — remplacent les teintes approchées de la passe précédente (orange Hermès, bleu électrique, fond noir profond à dégradé navy). Voir aussi `--dock-h` et `.btn-a` plus bas, changés dans la même passe.

```
--orange-50  #fdf0e4   --orange-100 #fbdfc0   --orange-300 #f0ad66
--orange-500 #e67e22   --orange-700 #b8621a   --orange-900 #6e3b0f   (couleur de marque principale)
--orange-light #f39c12  (second point du dégradé animé .btn-a, distinct de orange-300)

--blue-50    #e0fbff   --blue-100   #b3f5ff   --blue-300   #4de3ff
--blue-500   #00d4ff   --blue-700   #00a3c7   --blue-900   #005566
(bleu électrique — réservé strictement aux boutons SECONDAIRES, voir .btn-blue.
 Jamais un accent général : "Primary = Orange toujours" est une contrainte
 explicite du brief, pas un oubli.)

--green-50   #e7fbf4   --green-100  #c3f5e3   --green-300  #6ee7b7
--green-500  #10b981   --green-700  #0d9268   --green-900  #065f46
```

Échelle à 6 crans plutôt que 10 (50/100/300/500/700/900) : à la lecture du fichier, aucun composant n'utilise plus de 3-4 variantes sémantiques d'une couleur (fond doux / base / survol / appui) — une échelle plus fine serait une abstraction sans utilisateur réel dans ce code.

### Tokens sémantiques (dérivés de la palette)

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--bg` / `-2` / `-3` / `-4` | `#fff` `#faf9f8` `#f5f4f0` `#ecece8` | `#0a0e27` `#111830` `#182140` `#1a3050` (dégradé navy, 2026-09-22) | fond de page → surface la plus élevée |
| `--accent` | `orange-500` | `orange-500` (identique — le orange Hermès reste lisible sur le navy, plus besoin d'un ton éclairci séparé) | boutons primaires, focus, liens |
| `--accent-ink` | blanc | blanc | texte sur bouton `--accent` |
| `--up` | `green-500` | `#34d399` | hausses de marché, succès |
| `--down` | `#ef4444` | `#dc2626`→`#ef4444` reste rouge, hors palette de marque (pas demandé dans le brief) |
| `--warn` | `#b45309` | `#e0a63a` | avertissements |
| `--blue-accent` | `blue-500` (#00d4ff) | `blue-500` | appliqué concrètement cette passe : bouton "Vendre" de la fiche action (`.btn-blue`, `btn btn-blue btn-lg`) — plus un token réservé sans usage |

### Bouton primaire — dégradé animé (2026-09-22)

`.btn-a` suit désormais littéralement la spec du brief : dégradé `135deg` orange-500→orange-light, `background-size:200% 200%`, animé en boucle 4s (`gradientShift`, `ease-in-out`). Coupé net (`animation:none`, pas juste raccourci) sous `prefers-reduced-motion:reduce` — voir MOTION_SYSTEM.md pour pourquoi cette règle est non négociable dans ce fichier.

`.btn-blue` / `.btn-blue-outline` : nouveau composant, boutons secondaires en bleu électrique. `color:#04202b` (texte sombre) sur fond `--blue-accent` clair — vérifié en direct (contraste correct, pas de texte blanc-sur-cyan illisible).

Vérifié en direct (clair, sombre, page Accueil, Portefeuille, Compte) — voir AUDIT_REPORT / captures de cette session.

## Fond ambiant par section

`.aurora-bg` (3 taches floutées, position fixe, z-index 0) lit ses couleurs via `--aurora-1/1b`, `--aurora-2/2b`, `--aurora-3/3b`. `render()` pose `body.dataset.bg` selon la page :

- **par défaut** (Accueil, Marchés, Radar, Explorer, Comparer, fiche action...) : orange + bleu + vert
- **`portfolio`** : vert + orange en tête, bleu en accent
- **`account` / `settings`** : gris neutre (une page de réglages n'a pas besoin d'ambiance)

Rotation de teinte resserrée à ±18° (pas un tour complet à 360°) : le fond "vit" sans jamais quitter sa famille de couleur — voir commit `a529447`.

## Typographie

Police : Inter (Google Fonts, chargée en `media="print"` + `onload` pour ne pas bloquer le rendu).

| Token | Valeur | Usage |
|---|---|---|
| `--t-display` | `clamp(38px,7vw,60px)` | Titres hero |
| `--t-title` | `clamp(26px,4vw,36px)` | H1 de page |
| `--t-h2` / `--t-h3` | 21px / 17px | Titres de section |
| `--t-body` | 15.5px | Corps de texte |
| `--t-small` / `--t-label` / `--t-micro` | 13.5 / 12.5 / 11.5px | Légendes, méta |

Montants financiers : classe `.tabular-nums` (`font-variant-numeric:tabular-nums`) — déjà appliquée systématiquement sur les prix/valeurs/pourcentages dans le fichier (vérifié par grep, usage large et cohérent).

## Espacement

Deux échelles coexistent (`--space-*` et `--sp-*`), toutes deux valant les mêmes paliers en pixels (vérifié cette session : `--space-5` = `--sp-3` = 24px) — un doublon historique inoffensif visuellement mais qui mérite d'être unifié en étape 3 plutôt que dans ce passage (risque de casser une valeur oubliée dans un fichier de 17 700 lignes sans pouvoir tout re-tester en direct).

```
8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 px
```

## Rayons

```
--r-xs 8px  --r-s 12px  --r-m 18px  --r-l 24px  --r-xl 32px  --r-pill 999px
```

## Surfaces

- `.card` : verre dépoli (`background-color` semi-transparent + `backdrop-filter:blur(24px) saturate(160%)`), déjà en place depuis une passe précédente de cette session (nécessaire pour rester lisible sur le fond animé).
- `.sheet` / `.sheet-bg` : feuille modale, fond `--bg` plein, `backdrop-filter` sur l'arrière-plan.
- `.top` (en-tête) : `backdrop-filter:saturate(180%) blur(20px)`, sticky.
- `.dock` (barre du bas) : `backdrop-filter:saturate(180%) blur(24px)`, `position:fixed`.

## Composants existants (classes CSS + générateurs JS)

| Composant | Classe(s) | Variantes |
|---|---|---|
| Bouton | `.btn` | `.btn-a` (primaire, orange, dégradé animé — voir plus haut), `.btn-blue` / `.btn-blue-outline` (secondaire, bleu électrique, nouveau 2026-09-22), `.btn-s` (secondaire neutre), `.btn-g` / `.btn-ghost` (fantôme), tailles `.btn-sm` / `.btn-lg` |
| Carte | `.card`, `.nb-pf`, `.nb-watch` | glass, voir Surfaces |
| Puce | `.chip` | `[aria-pressed]` pour l'état sélectionné |
| Badge | `.tag`, `.tag-up` / `.tag-down` / `.tag-violet` | |
| Interrupteur | `.sw` | `switchControl()` (JS) |
| Feuille modale | `.sheet` | `openSheet()` / `closeSheet()` (JS) |
| Segmented control | `.seg` | `segControl()` (JS), pas encore d'indicateur glissant (voir MOTION_SYSTEM.md, non fait cette passe) |
| Actions rapides circulaires | `.stk-qa` / `.qa` / `.qa-badge` | nouveau 2026-09-22, fiche action — remplace les anciennes pilules `.stk-more` (classe désormais morte, supprimée). État actif (comparaison/liste) sur le cercle rempli, pas dans le texte du libellé — voir le commentaire au point d'appel dans `index.html` (PAGES.stock) |
| Liste de résultats | `.rows`, `.rows-grid` (grille fluide desktop, voir commit `35980c5`) | |
| État vide | `emptyState()` (JS) | |
| Squelette de chargement | `.sk`, `chartSkeleton()` | |

## Bottom nav — refonte 2026-09-22

Agrandie pour se rapprocher du gabarit "Revolut-level" du brief (icônes 26px, libellés 13px/700, dock ~100px de haut, fond en dégradé noir→orange en thème sombre). `--dock-h` recalculé de 68px à 100px en conséquence — voir le commentaire détaillé dans `:root{}` (`index.html`) pour le calcul exact, et l'invariant rappelé partout dans ce fichier : ne jamais changer la hauteur réelle du dock sans recaler ce token, sous peine de contenu masqué en bas de page.

Écart assumé par rapport au brief : gap entre boutons resté à **4px** (le brief demandait 12-16px) car l'app a **6** destinations contre 4-5 chez Revolut — un gap plus large aurait fait déborder le dock ou rétréci les cibles tactiles sous un seuil raisonnable.

**Bug réel trouvé et corrigé le même jour** : même à 4px de gap, le libellé le plus long (`Portefeuille`, 12 caractères) débordait de sa colonne (~57px sur mobile réel) et chevauchait visuellement le bouton suivant (`Compte`) — un mot français long, unique, ne peut pas se couper sur un espace comme les autres libellés. Corrigé par `hyphens:auto` + `overflow-wrap:break-word` sur `.dock button span` (le document est déjà `lang="fr"`, le dictionnaire de coupure français s'applique automatiquement). Vérifié en direct : `Marchés`/`Explorer`/`Portefeuille` se coupent proprement sur 2 lignes sans jamais chevaucher leur voisin ; les libellés courts (`Accueil`, `Radar`, `Compte`) restent sur une ligne, aucune coupure inutile.

**Leçon méthodologique** (à réutiliser) : une simulation mobile par overrides CSS recopiés à la main est fragile — une première tentative de vérification cette même session a recopié un sous-ensemble incomplet des règles réelles (oubliant le dégradé de fond, `box-shadow`, et les règles `.dock button`), donnant un rendu qui ne ressemblait pas du tout au vrai dock et aurait pu faire manquer ce bug. La méthode fiable : extraire par le code les blocs `@media (max-width:900px){...}` du fichier réellement déployé (`fetch('/index.html',{cache:'no-store'})` + parsing par comptage d'accolades) et les injecter tels quels, plutôt que les retranscrire à la main.

## Z-index

Déjà cohérent avant cette session — vérifié cette passe (audit de cohérence, §62 du brief), pas besoin de nouveaux tokens :

```
0   fonds d'ambiance / curseurs de motion (aurora, .seg-pill, .dock-pill)
1   contenu au-dessus de ces fonds
50  en-tête (sticky)
60  dock (barre du bas)
90  fond des feuilles modales
95  toast (au-dessus des modales — une confirmation doit rester visible même feuille ouverte)
```

Aucun `z-index:9999` dispersé trouvé.

## Audit de cohérence visuelle (§66-67 du brief) — ce qui a été vérifié cette session

- **Doublons de sélecteurs CSS** : re-balayé après tous les ajouts de cette session (dock, seg, morph recherche...) — les seuls doublons restants sont des overrides `@media` légitimes (même motif que `.top-nav`/`.dock`/`.card`, déjà vérifiés), rien de nouveau cassé.
- **Variables CSS invalides** : balayage systématique (script Node comparant chaque `var(--x)` à chaque `--x:` défini) — 3 trouvées et corrigées cette session (`--accent-2`, `--violet`/`--violet-soft`, `--info`), 0 restante.
- **Couleurs codées en dur oubliées lors du passage à la palette officielle** : 6 trouvées et corrigées (`.nova-orb`, `.gate-orb` [supprimé, mort], `--shadow-accent` clair, halo de `.card`, listes `LIST_COLORS`/`CMP_PALETTE`, couleur de repli d'une liste).
- **Composants morts (CSS jamais atteint par aucun balisage)** : `.gate-orb`, `.tag-violet` supprimés ; `.nova-orb` récupéré et enfin branché (voir MOTION_SYSTEM.md) ; `.ai-card`/`.ai-dot`/`.ai-alias`/`.ai-points` restent orphelins (base cohérente, pas cassée, mais aucun balisage ne les utilise — pas touchés, aucune indication de ce qu'ils devaient devenir).

Pas encore fait (hors budget de cette session) : audit visuel PAGE PAR PAGE des boutons/cards/inputs "anciens" par rapport aux nouveaux composants (le brief demande de comparer chaque page à un inventaire Storybook-like, qui n'existe pas non plus — section suivante).

## Ce qui N'A PAS été construit cette passe

Honnêteté du rapport final (comme demandé) : le brief liste ~50 composants (`NovaModal`, `NovaDropdown`, `NovaSlider`, `NovaOrb`, `AnimatedFinancialNumber`, etc.). Cette session a livré la fondation (palette, tokens, fond ambiant, moteur de motion du dock) plutôt qu'une reconstruction totale, par choix délibéré : sans accès navigateur fiable pour tester en direct (voir AUDIT_REPORT.md, blocage réseau Fortinet, intermittent), livrer 50 composants non vérifiés visuellement aurait été irresponsable. Voir `MOTION_SYSTEM.md` et le rapport de fin d'étape pour le détail de ce qui reste.

## Mise à jour 2026-09-22 — passe "Revolut-level"

Brief le plus détaillé reçu à ce jour (palette hexadécimale exacte, refonte texte page par page, refonte bottom nav). Livré et **vérifié en direct** (contrairement à la note ci-dessus qui datait d'avant cette passe) sur `novabourse.vercel.app`, thème sombre et clair :
- Palette exacte (orange Hermès, bleu électrique réservé au secondaire, fond navy dégradé sombre) ;
- `.btn-a` dégradé animé + `.btn-blue`/`.btn-blue-outline` (appliqué à "Vendre" sur la fiche action) ;
- Réécriture des textes des 6 pages principales (Accueil, Marchés, Radar, Explorer, Portefeuille, Compte) ;
- Bottom nav agrandie + animation de sélection (icône scale+rotate) + bug de chevauchement de libellé trouvé et corrigé (voir section dédiée plus haut) ;
- Actions rapides circulaires de la fiche action (`.stk-qa`), inspirées d'une capture d'écran réelle de l'app Revolut (App Store).

Toujours pas fait, et volontairement hors budget de cette passe : les ~50 composants nommés du brief au-delà de ceux listés ci-dessus, l'unification `--space-*`/`--sp-*`, et la mise à jour de `.ai-card`/`.ai-dot` orphelins.
