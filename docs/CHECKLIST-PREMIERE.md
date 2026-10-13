# Checklist de validation dans Premiere Pro

À dérouler sur Mac après installation. Pour chaque ligne, notez ✅ ou ❌ et, en cas d'échec, joignez le rapport *Réglages › Diagnostic › Inspecter la sélection*.

Version de Premiere testée : `________`  ·  macOS : `________`

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
