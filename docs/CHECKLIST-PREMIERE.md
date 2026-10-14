# Checklist de validation dans Premiere Pro

À dérouler sur Mac après installation. Pour chaque ligne, notez ✅ ou ❌ et, en cas d'échec, joignez le rapport *Réglages › Diagnostic › Inspecter la sélection*.

Version de Premiere testée : `________`  ·  macOS : `________`

## 0. Stabilité (priorité V2)

| # | Test | Attendu | Résultat |
|---|---|---|---|
| S1 | Ouvrir le panneau et **ne rien faire pendant 15 minutes** | Premiere reste stable | |
| S2 | Monter normalement 15 min avec le panneau ancré (sélections, lecture) | Aucun ralentissement notable, aucun crash | |
| S3 | Survoler toutes les vignettes | Aperçus fluides, Premiere réactif | |
| S4 | Si un crash survient malgré tout : Réglages › désactiver « Aperçus animés », recommencer S1 | Me dire si le crash disparaît | |

## A. Chargement et sélection

| # | Test | Attendu | Résultat |
|---|---|---|---|
| A1 | Ouvrir le panneau | Interface sombre, 5 cartes, aucune zone blanche ou cassée | |
| A2 | Aucun clip sélectionné | Pastille orange « Aucun texte sélectionné », bouton Appliquer désactivé | |
| A3 | Sélectionner 1 texte | Pastille verte « 1 texte sélectionné » en moins de 2 s, sans clic | |
| A4 | Sélectionner 3 textes + 1 audio | « 3 textes sélectionnés » (l'audio est ignoré) | |
| A5 | Survoler les cartes | Les aperçus s'animent ; les icônes s'affichent (SVG en ligne) | |
| A6 | Redimensionner le panneau (étroit ↔ large) | Passage de 1 colonne à 2 colonnes (bibliothèque + réglages) | |

## B. Les 5 animations (texte centré, 1080p, clip de 4 s)

| # | Animation | Vérifier dans le moniteur de programme | Vérifier dans *Options d'effet* | Résultat |
|---|---|---|---|---|
| B1 | Smooth Pop | Pop avec léger dépassement, **centré sur le texte** | Échelle et Opacité animées | |
| B2 | Blur Reveal | Flou → net + léger glissement vers le haut | Effet **Flou gaussien** ajouté une seule fois ; Flou, Position, Opacité et Échelle animés | |
| B3 | Slide Up | Arrivée par le bas, décélération douce | Position et Opacité animées | |
| B4 | Word by Word (5 calques, un mot chacun) | Les mots apparaissent l'un après l'autre | Chaque clip a ses images clés, décalées | |
| B5 | Elastic Bounce | Rebonds visibles qui s'amortissent | Échelle animée avec oscillations | |
| B6 | Réappliquer Blur Reveal sur le même clip | Pas de second Flou gaussien | | |
| B7 | Mode « Sortie » puis « Entrée » sur un même clip | Les deux animations coexistent | | |
| B8 | Mode « Entrée + sortie » | Disparaît exactement sur la dernière image | | |

## C. Points techniques à confirmer (hypothèses du code)

| # | Hypothèse | Comment vérifier | Résultat |
|---|---|---|---|
| C1 | La première image clé tombe **au début du clip** | Clip placé à 10 s dans la séquence : l'animation démarre bien à 10 s | |
| C2 | Idem pour un clip **rogné au début** (point d'entrée ≠ 0) | Si décalage : essayer *Réglages › Référence temporelle* | |
| C3 | Valeurs de Position lues correctement (normalisées ou pixels) | Après Slide Up, le texte revient **exactement** à sa place | |
| C4 | Pivot automatique (texte placé en bas de l'image) | Smooth Pop sur un sous-titre : le zoom reste centré sur le sous-titre | |
| C5 | Interpolation linéaire appliquée | Clic droit sur une image clé › Interpolation temporelle : *Linéaire* | |
| C6 | Échelle de départ à 0 % (Elastic Bounce) | Pas d'erreur, pas de saut | |
| C7 | Annulation ⌘Z | 3 ou 4 étapes nommées « MotionCraft · … » ; tout est annulé | |
| C8 | 30 textes sélectionnés | Application en quelques secondes, pas de blocage | |
| C9 | Premiere en français / anglais | Les paramètres sont trouvés dans les deux langues | |
| C10 | Clip avec une échelle de 50 % et une opacité de 80 % | L'animation revient à 50 % / 80 %, pas à 100 % | |

## D. Interface

| # | Test | Attendu | Résultat |
|---|---|---|---|
| D1 | Curseurs : glisser, flèches du clavier, double-clic (valeur par défaut), clic sur la valeur (saisie) | Tout fonctionne | |
| D2 | Listes déroulantes (Easing, Direction…) | Lisibles en thème sombre | |
| D3 | Favoris (étoile) puis relancer Premiere | Favoris conservés | |
| D4 | Enregistrer un preset, relancer, le recharger | Réglages restaurés | |
| D5 | Exporter puis importer les presets | Fenêtres de fichier macOS, import réussi | |
| D6 | Diagnostic › Copier | Rapport dans le presse-papiers | |
| D7 | Raccourcis `/`, ⌘↵, Échap | Recherche, application, retour | |

Merci de me transmettre ce tableau rempli : les ❌ et les rapports de diagnostic permettront une correction ciblée.

## E. Effets vidéo (V2)

| # | Test | Attendu | Résultat |
|---|---|---|---|
| E1 | Zoom Punch, tête de lecture au milieu d'un clip vidéo | Coup de zoom à la tête de lecture, retour au cadrage | |
| E2 | Camera Shake | Secousse sans bord noir visible | |
| E3 | Push-in lent / Ken Burns sur un clip de 8 s | Mouvement sur toute la durée | |
| E4 | Caméra à l'épaule | Flottement léger, sans bord noir | |
| E5 | Zoom Blur en « Sortie » sur le clip A, en « Entrée » sur le clip B | Transition fluide entre les deux | |
| E6 | Spin Zoom | Rotation + zoom + flou, sans saut final | |
| E7 | Bouton « Appliquer » d'une vignette et double-clic | Application directe avec les réglages actuels | |

## F. Montage (V3)

| # | Test | Attendu | Résultat |
|---|---|---|---|
| F1 | Réglages › Diagnostic › Inspecter : lignes « Effets MotionCraft » et « Transitions vidéo disponibles » | Aucun effet « INTROUVABLE » ; liste des transitions (me l'envoyer) | |
| F2 | 3 plans qui se suivent, « Fondu enchaîné » › Poser la transition | 2 fondus sur les 2 coupes, durée réglée | |
| F3 | Chacune des 12 transitions natives | Posée, ou message « introuvable » (noter lesquelles) | |
| F4 | Marqueurs (M) sur 3 temps forts, Beat Zoom › Marqueurs | Un zoom sur chaque marqueur | |
| F5 | Jump Cut Zoom sur 4 plans consécutifs | Cadrage large / serré alterné | |
| F6 | Wipe et Typewriter sur un texte | Effet Recadrage ajouté une seule fois, volet net | |
| F7 | Flash / Flash Cut | Effet Luminosité et contraste ajouté, éclair visible | |
| F8 | Bandes cinéma / Bandes animées | Bandes noires en haut et en bas | |

## G. V3.1

| # | Test | Attendu | Résultat |
|---|---|---|---|
| G1 | 3 plans consécutifs, Whip Pan › « Sur les coupes » | Fin du plan 1 et début du plan 2 fouettés dans le même sens | |
| G2 | Recette Impact Flash à la tête de lecture | Zoom + secousse + flash simultanés | |
| G3 | « Retirer les animations » (2 clics) sur un clip animé | Plus d'images clés ; cadrage / opacité d'origine ; effets ajoutés retirés | |
| G4 | ⌘Z après G3 | Les animations reviennent | |
