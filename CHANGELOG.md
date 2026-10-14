# Journal des versions

## 2.3.0 — icônes et rail corrigés dans Premiere (2e capture réelle)

- Icônes remplies en noir : le moteur UXP rend mal les SVG « au trait ». Toutes les icônes (interface, menu Fenêtre, liste des plugins) sont maintenant des PNG 2× générés au build avec resvg.
- Rail : pastilles écrasées et libellés tronqués. Mise en page en blocs, sans flex en colonne, plus robuste dans UXP.

## 2.2.0 — correctifs d'affichage dans Premiere (constatés sur capture réelle)

- Icônes invisibles : Premiere n'affiche pas le SVG en ligne. Les icônes sont désormais des fichiers SVG générés au build et affichés en `<img>`.
- Boutons gris : Premiere impose son style aux `<button>` natifs. Tous les boutons sont des `<div role="button">` (clavier : Entrée / Espace) avec nos couleurs.
- Vignettes vidéo noires : la scène est positionnée en pourcentages, sans mesurer la taille (nulle avant le premier affichage dans UXP).
- Texte d'aperçu « doublé » : l'élément de mesure est rendu totalement invisible.
- Courbe d'easing dessinée en points (plus de SVG).
- Rail : libellé court sous chaque icône.
- Champs de saisie : plus de double cadre dans Premiere.
- Test d'interface : vérifie l'absence de `<button>` natif et de SVG en ligne, et le chargement de toutes les icônes.

## 2.1.0 — interface affinée (inspirée de PX-Kinetype, TypeMotion, Typoking)

- Rail d'icônes de catégories en couleur, toujours visible (même panneau étroit).
- En-tête de catégorie avec compteur, bascule vue grille / vue liste.
- Champ « Votre texte » : tous les aperçus affichent votre propre texte.
- Vignettes teintées par catégorie, pastille de couleur, deux colonnes même en panneau étroit.
- Barre d'action fixe en bas : Entrée / Sortie / Entrée + sortie (application directe), « Appliquer à la tête de lecture » / Début / Fin pour les effets ponctuels, « Appliquer sur tout le clip », avec ligne d'état (« Prêt. », progression).
- Panneau de réglages en onglets Réglages / Presets, courbe d'easing dessinée.

## 2.0.0 — stabilité, effets vidéo, interface façon Motion Bro

**Stabilité (crash de Premiere panneau ouvert, signalé en V1)**
- Plus aucune interrogation périodique de Premiere : la sélection n'est relue que sur l'événement officiel SELECTION_CHANGED (regroupé), au retour de la souris sur le panneau et avant d'appliquer. Une vérification lente (5 s) n'est utilisée que si l'événement n'existe pas.
- Lecture de la sélection allégée (nombre de clips + 6 premiers noms, au lieu de 4 appels par clip).
- Aperçus : minuteur unique plafonné à 30 i/s, aucune animation sans survol, aperçu principal limité à 2 boucles, copies « flou » créées seulement si nécessaire, tout est suspendu quand le panneau est masqué. Option « Aperçus animés » pour un panneau 100 % statique.
- Suppression du minuteur de mise en page (500 ms) de la V1.

**Bibliothèque : 20 animations**
- 13 effets vidéo (n'importe quel clip) : Zoom Punch, Heartbeat, Elastic Zoom, Push-in lent, Pull-out lent, Ken Burns, Caméra à l'épaule, Camera Shake, Impact, Glitch Jitter, Zoom Blur, Whip Pan, Spin Zoom.
- 2 accentuations texte : Pulse, Shake.
- Trois natures d'effets : apparition (entrée / sortie / les deux), ponctuel (à la tête de lecture, au début ou à la fin du clip), tout le clip.

**Interface**
- Barre latérale Texte / Vidéo et catégories (onglets et puces sur panneau étroit).
- Sens Entrée / Sortie / Entrée + sortie et placement global, directement au-dessus de la grille.
- Bouton « Appliquer » sur chaque vignette, double-clic pour appliquer.
- Vitesses prédéfinies (Lent → Éclair), badges de nature, aperçus vidéo dédiés.
- Word by Word sur un seul calque : avertissement explicite.


## 1.0.0 — première version

- Plugin UXP pour Premiere Pro 25.6+ (panneau « MotionCraft Pro »).
- 5 animations : Smooth Pop, Blur Reveal, Slide Up, Word by Word, Elastic Bounce, chacune en entrée, sortie, ou entrée + sortie.
- Moteur d'images clés « cuites » image par image (easing exact, dépassement, ressort), simplifiées sans perte visible.
- Compensation du pivot pour des zooms centrés sur le texte, adaptation automatique à la résolution.
- Application groupée sur N textes avec cascade, annulation groupée, isolation des clips en erreur.
- Interface : bibliothèque avec aperçus animés, recherche, catégories, favoris, panneau de réglages, presets utilisateur (import/export), réglages avancés, diagnostic.
- Outillage : build esbuild, ESLint avec les règles officielles Adobe, 44 tests Vitest, test d'interface Playwright, paquet `.ccx`, script d'installation macOS.
