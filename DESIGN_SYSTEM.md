# NovaBourse — Design System
Dernière mise à jour : 2026-09-21

**Note de cadrage** (comme pour l'audit d'étape 1) : ce document décrit un système de design réel, implémenté en CSS/variables custom properties dans `index.html` — pas des composants React (`NovaButton`, `design/tokens/colors.ts`...). Il n'y a ni framework ni bundler. "Composant" ci-dessous signifie : une classe CSS + éventuellement une fonction JS qui génère le HTML correspondant (ex. `esc()`, `svg()`, `avatar()`).

## Palette officielle

Noir et blanc structurent l'interface, orange/bleu/vert portent l'identité de marque.

```
--orange-50  #fff3ea   --orange-100 #ffe1cc   --orange-300 #ffb27a
--orange-500 #f37021   --orange-700 #c6560f   --orange-900 #7a3308   (couleur de marque principale)

--blue-50    #eef1ff   --blue-100   #dce3ff   --blue-300   #94a9ff
--blue-500   #4c6fff   --blue-700   #2f4ecc   --blue-900   #1a2b75

--green-50   #e7fbf2   --green-100  #c6f5e0   --green-300  #74e6b8
--green-500  #21c984   --green-700  #159a64   --green-900  #0b5c3c
```

Échelle à 6 crans plutôt que 10 (50/100/300/500/700/900) : à la lecture du fichier, aucun composant n'utilise plus de 3-4 variantes sémantiques d'une couleur (fond doux / base / survol / appui) — une échelle plus fine serait une abstraction sans utilisateur réel dans ce code.

### Tokens sémantiques (dérivés de la palette)

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `--bg` / `-2` / `-3` / `-4` | `#fff` `#faf9f8` `#f5f4f0` `#ecece8` | `#050505` `#0b0d11` `#111318` `#16191f` | fond de page → surface la plus élevée |
| `--accent` | `orange-500` | `#ff8a3d` (plus clair, lisible sur presque-noir) | boutons primaires, focus, liens |
| `--accent-ink` | blanc | `#08090b` (texte sombre sur orange clair, meilleur contraste en sombre) | texte sur bouton `--accent` |
| `--up` | `green-500` | `#2fe39b` | hausses de marché, succès |
| `--down` | `#dc2626` | `#f87171` | baisses de marché — reste rouge, hors palette de marque (pas demandé dans le brief) |
| `--warn` | `#b45309` | `#e0a63a` | avertissements |
| `--blue-accent` | `blue-500` | `blue-300` | disponible pour un usage secondaire/informationnel — pas encore appliqué à un composant précis, réservé pour l'étape 3 |

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
| Bouton | `.btn` | `.btn-a` (primaire, orange), `.btn-s` (secondaire), `.btn-g` / `.btn-ghost` (fantôme), tailles `.btn-sm` / `.btn-lg` |
| Carte | `.card`, `.nb-pf`, `.nb-watch` | glass, voir Surfaces |
| Puce | `.chip` | `[aria-pressed]` pour l'état sélectionné |
| Badge | `.tag`, `.tag-up` / `.tag-down` / `.tag-violet` | |
| Interrupteur | `.sw` | `switchControl()` (JS) |
| Feuille modale | `.sheet` | `openSheet()` / `closeSheet()` (JS) |
| Segmented control | `.seg` | `segControl()` (JS), pas encore d'indicateur glissant (voir MOTION_SYSTEM.md, non fait cette passe) |
| Liste de résultats | `.rows`, `.rows-grid` (grille fluide desktop, voir commit `35980c5`) | |
| État vide | `emptyState()` (JS) | |
| Squelette de chargement | `.sk`, `chartSkeleton()` | |

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
