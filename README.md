# MotionCraft Pro

Plugin d'animations de textes pour **Adobe Premiere Pro**, en UXP, l'architecture moderne d'Adobe.

Le principe : sélectionner un ou plusieurs textes dans la timeline, choisir une animation (avec aperçu animé), la régler, cliquer sur **Appliquer**. Le plugin écrit alors de **vraies images clés Premiere** sur les clips : Échelle, Position, Opacité, et l'effet natif Flou gaussien. Il n'y a ni rendu externe ni effet simulé. Tout reste modifiable dans le panneau *Options d'effet* et s'annule avec ⌘Z.

> **Version 3.1.0 — 59 outils.**
> - **Texte (17)** : Smooth Pop, Blur Reveal, Slide Up, Word by Word, Elastic Bounce, Fade, Zoom In, Spin In, Swing, Wipe, Typewriter, Flicker, Glitch, Bounce In, Rotate Pop, Pulse, Shake.
> - **Vidéo (19)** : Zoom Punch, Heartbeat, Elastic Zoom, Smooth Zoom, Rotation Punch, Push-in lent, Pull-out lent, Ken Burns, Caméra à l'épaule, Pendulum, Drift, Camera Shake, Impact, Glitch Jitter, Tremblement, Zoom Blur, Whip Pan, Spin Zoom, Wipe (plan).
> - **Montage (23)** : 12 transitions natives Premiere, Jump Cut Zoom, Beat Zoom, Flash, Flash Cut, Bandes cinéma, Bandes animées, 5 recettes (Impact Flash, Drop, Glitch Hit, Séisme, Intro Flash).
> - **Outils** : transitions MotionCraft « sur les coupes », effets sur les marqueurs, « Retirer les animations ».
>
> Nouveautés et correctifs : voir [CHANGELOG.md](CHANGELOG.md).

---

## Où en est le projet

| Élément | Implémenté | Testé automatiquement (Linux) | À valider sur votre Mac dans Premiere |
|---|:-:|:-:|:-:|
| Moteur d'animation (courbes, easing, cuisson en images clés) | ✅ | ✅ 29 tests | — |
| Les 5 animations et leurs réglages | ✅ | ✅ | ✅ rendu visuel réel |
| Intégration Premiere (lecture de la sélection, transactions, images clés) | ✅ | ✅ 29 tests sur un **Premiere simulé** | ✅ **indispensable** |
| Ajout automatique du Flou gaussien (Blur Reveal) | ✅ | ✅ (simulé) | ✅ |
| Interface (bibliothèque, recherche, catégories, favoris, aperçus, réglages, presets) | ✅ | ✅ parcours complet dans Chromium | ✅ rendu dans le moteur UXP |
| Application à plusieurs textes (30 et plus), avec cascade | ✅ | ✅ (simulé) | ✅ |
| Presets utilisateur (enregistrer, charger, exporter, importer) | ✅ | ✅ partiel | ✅ export/import de fichiers |
| Paquet `.ccx` + script d'installation macOS | ✅ | ✅ structure vérifiée | ✅ installation |

**Important :** **aucun test n'a été fait dans Premiere Pro.** Le développement a eu lieu sous Linux, où Premiere ne tourne pas. Le code s'appuie sur les définitions TypeScript officielles d'Adobe (`@adobe/premierepro` 26.5) et sur leurs exemples, et l'ESLint officiel d'Adobe le valide. Les tests d'intégration utilisent un **simulateur** de l'API qui reproduit ses contraintes connues. Ils vérifient notre logique, pas le comportement réel de Premiere. Les points à surveiller sont listés dans [docs/CHECKLIST-PREMIERE.md](docs/CHECKLIST-PREMIERE.md).

---

## Compatibilité

- **Premiere Pro 25.6 ou ultérieur** (macOS et Windows). Les API UXP de Premiere sont disponibles en version stable à partir de 25.6. Le code n'utilise que des API présentes dans les définitions officielles 26.5.
- Pour connaître votre version : *Premiere Pro › À propos de Premiere Pro*. Sur une version plus ancienne, mettez Premiere à jour via Creative Cloud (voir [docs/FAISABILITE.md](docs/FAISABILITE.md) pour l'alternative CEP/ExtendScript).

## Installation sur Mac (résumé)

1. Récupérez la branche `claude/gallant-thompson-ck6o6o` (bouton *Code › Download ZIP* sur GitHub, ou `git clone`).
2. Quittez Premiere Pro.
3. Double-cliquez sur `release/MotionCraftPro-3.1.0.ccx`, **ou** dans le Terminal : `./scripts/install-mac.sh`
4. Relancez Premiere Pro, puis ouvrez *Fenêtre › Extensions (ou Plugins) › MotionCraft Pro*.

Procédure détaillée, mode développeur et dépannage : **[docs/INSTALLATION-MAC.md](docs/INSTALLATION-MAC.md)**.

## Utilisation

1. Dans la timeline, sélectionnez un ou plusieurs clips (textes, vidéos, photos, logos…).
2. Pour un effet **ponctuel** (Zoom Punch, Camera Shake, Flash, Pulse…), placez la tête de lecture à l'endroit voulu, ou posez des **marqueurs de séquence** (touche M) sur les temps forts et utilisez « Marqueurs ».
   Pour une **transition Premiere**, sélectionnez les clips qui se suivent sur la timeline : elle est posée sur chaque coupe.
3. Dans MotionCraft, choisissez une famille (**Texte** / **Vidéo**) et survolez les vignettes pour voir les aperçus.
4. Cliquez sur une vignette, puis sur un bouton de la barre du bas : **Entrée**, **Sortie**, **Entrée + sortie**, ou **Appliquer à la tête de lecture** pour les effets ponctuels. Le bouton **Appliquer** de la vignette (ou un double-clic) applique directement avec les réglages actuels. Les réglages fins sont dans le panneau de droite (onglets Réglages / Presets).
5. Pour annuler : ⌘Z. L'opération occupe 3 à 4 étapes dans l'historique : *activation*, *images clés*, *interpolation*, et *Flou gaussien* pour Blur Reveal.

Raccourcis : `/` ou ⌘K pour la recherche, ⌘↵ pour appliquer, Échap pour revenir.

**Word by Word** : l'API de Premiere ne permet pas d'animer les mots *à l'intérieur* d'un seul calque texte. Il faut placer un mot (ou un groupe de mots) par calque texte et tous les sélectionner. MotionCraft les enchaîne alors dans l'ordre de la timeline (début, puis piste). L'interface l'indique clairement.

## Développement

```bash
npm install          # dépendances (Node 20+)
npm run dev          # banc d'essai navigateur avec Premiere simulé → http://localhost:5173
npm run build        # construit le plugin dans dist/plugin
npm run watch        # reconstruction continue (à charger dans UXP Developer Tool)
npm run package      # build + validation + release/MotionCraftPro-<version>.ccx
npm run check        # typecheck + lint (règles Adobe) + tests + paquet + test d'interface
```

| Dossier | Contenu |
|---|---|
| `src/engine/` | Moteur pur : easing, placement entrée/sortie, cuisson et simplification des images clés, planification par clip |
| `src/animations/` | Une définition par animation, plus le registre (catégories, recherche) |
| `src/premiere/` | Intégration UXP Premiere (seul code dépendant de Premiere) |
| `src/ui/`, `src/styles/` | Interface : bibliothèque, aperçus, contrôles, réglages |
| `src/state/` | Réglages, presets, persistance locale |
| `plugin/` | Manifeste UXP, HTML, icônes |
| `dev/` | Banc d'essai navigateur et simulateur Premiere (non inclus dans le plugin) |
| `tests/` | Tests Vitest |
| `scripts/` | Build, validation, paquet `.ccx`, test d'interface, installation macOS |
| `release/` | Paquet installable prêt à l'emploi |

Architecture, ajout d'animations et feuille de route vers 100 animations : **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.
