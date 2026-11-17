# Calendrier de l'Avent 2026 — Maison de la Literie

Proposition créative et système de production Photoshop pour les 4 jeux-concours Instagram de décembre 2026.

![Aperçu](preview/planche.jpg)

## Le concept : « Nuits douces de Noël »

Chaque visuel est une **case du calendrier de l'Avent** : une porte en arche, avec une pastille dorée à la date du tirage (04 · 11 · 18 · 24 déc.), qui s'ouvre sur le cadeau de la semaine.

- **Une couleur par semaine pour marquer la montée en gamme :** vert sapin, bleu nuit, prune, puis le rouge Maison de la Literie pour le grand final. Dans le feed, la série forme un dégradé, et la 4e case reprend la couleur de la marque.
- **Rendu plus premium que l'an dernier :** halo lumineux, filets dorés, étincelles, ombre portée sous le produit. Le cadeau reste au centre et bien lisible.
- **Infos utiles sur le visuel :** nom du cadeau, dimensions, valeur TTC en pastille dorée et date du tirage. Les modalités de participation restent dans la légende.

## Arborescence

```
avent-2026/
├── photoshop/
│   ├── Installer_Lanceur.jsx        ← à lancer une fois (ajoute le menu)
│   ├── Lanceur_Scripts.jsx          ← le lanceur : liste et exécute les scripts
│   ├── scripts/                     ← déposez ici tout nouveau script .jsx
│   │   ├── 00_Nom_PostScript_Police.jsx
│   │   ├── 01_Generer_Calendrier_Avent_2026.jsx
│   │   ├── 02_Exporter_PNG_JPG.jsx
│   │   └── 03_Changer_Typos.jsx
│   ├── config/avent2026.config.jsx  ← TEXTES, COULEURS, TYPOS, POSITIONS
│   ├── lib/mdll_helpers.jsx         ← fonctions partagées (formes, textes…)
│   └── assets/
│       ├── produits/                ← packshots détourés (PNG transparent)
│       └── logo/                    ← déposez logo.png ici (optionnel)
├── preview/                         ← aperçu HTML et PNG des 8 visuels
├── sorties/                         ← créé par les scripts (PSD + exports)
├── LEGENDES_INSTAGRAM.md            ← les 4 légendes + textes de stories
└── CONSEILS_CLIENT.md               ← recommandations pour Elizabeth
```

## Installation (une seule fois)

1. Copiez tout le dossier `avent-2026` sur votre ordinateur.
2. Installez les polices **Playfair Display** et **Quicksand** (gratuites sur Adobe Fonts ou Google Fonts).
3. Dans Photoshop, ouvrez **Fichier › Scripts › Parcourir…** et choisissez `photoshop/Installer_Lanceur.jsx`.
4. Redémarrez Photoshop. **Fichier › Scripts › MDLL Lanceur** est maintenant disponible.
   - Pour lui donner un raccourci : **Édition › Raccourcis clavier › Menus de l'application › Fichier › Scripts**.
   - Si l'installation est refusée faute de droits, lancez simplement `Lanceur_Scripts.jsx` avec **Parcourir…**.

## Le lanceur de scripts

Le lanceur liste automatiquement tous les `.jsx` du dossier `photoshop/scripts/`.
**Pour ajouter un script, il suffit de déposer le fichier dans ce dossier**, puis de cliquer sur *Actualiser*. Aucune installation n'est nécessaire.

- Le texte d'aide affiché sous la liste provient de la ligne `@description …` en haut du script.
- Les scripts lancés reçoivent la variable `MDLL_ROOT`, qui pointe vers le dossier `photoshop`. Ils peuvent ainsi charger `lib/` et `config/` avec `$.evalFile(MDLL_ROOT + "/lib/mdll_helpers.jsx")`.
- Le préfixe numérique (`00_`, `01_`…) fixe l'ordre d'affichage.

## Générer les 8 visuels

**MDLL Lanceur › 01 Generer Calendrier Avent 2026**, puis choisissez les semaines et les formats.
Les PSD sont créés et enregistrés dans `sorties/psd/` :

| Groupe de calques | Contenu | Comment modifier |
|---|---|---|
| 06 · TEXTES | logo, surtitre, titre, accroche, cadeau, détails, valeur | calques texte, à modifier avec l'outil Texte |
| 05 · PASTILLE DATE | date du tirage | texte et formes vectorielles |
| 04 · PRODUIT | packshot + ombre | **clic droit › Remplacer le contenu** sur l'objet dynamique |
| 03 · PORTE DU CALENDRIER | arche, lueur, contours dorés | double-clic sur la vignette pour changer la couleur |
| 02 · DÉCOR | neige, étincelles, cadre | formes vectorielles et styles de calque |
| 01 · FOND | couleur de la semaine + halo | double-clic sur la vignette |

Les stories ont des repères à 250 px du haut et du bas : rien d'important ne doit se trouver hors de cette zone (l'interface Instagram la recouvre).

### Changer les typos
- **Dans les PSD déjà générés :** ouvrez-les tous, puis lancez **03 Changer Typos**. Choisissez la police à remplacer et la nouvelle, et tous les documents ouverts sont modifiés en une seule fois.
- **Pour les prochaines générations :** modifiez `polices` dans `config/avent2026.config.jsx`. Le nom PostScript d'une police s'obtient avec **00 Nom PostScript Police**.

### Changer un texte, une couleur ou un lot
Tout se règle dans `photoshop/config/avent2026.config.jsx` (textes, couleurs de chaque semaine, dimensions, positions), puis relancez la génération.
Pour revenir à une série 100 % rouge comme l'an dernier, mettez `fond: "#8A1A29"` et `fondClair: "#A62A3A"` sur les 4 semaines.

### Packshots
Les images de `assets/produits/` sont **provisoires**. Elles ont été détourées à partir des visuels 2025, donc en basse définition.
**À remplacer par les packshots HD détourés** fournis par la marque, en gardant les mêmes noms de fichiers, ou directement dans les PSD avec *Remplacer le contenu*.
⚠️ Semaine 4 : l'image provisoire montre l'ancien sommier gris. Il faut le packshot **matelas Ciry + sommier Somflex beige + pieds Carré Chêne**.

### Logo
Déposez le logo officiel en PNG transparent sous le nom `assets/logo/logo.png`. Il sera placé à la place du texte provisoire « MAISON DE LA LITERIE ».

## Exporter pour Instagram

**MDLL Lanceur › 02 Exporter PNG JPG** exporte les documents ouverts, ou tous les PSD de `sorties/psd`, en JPG qualité maximale sRGB dans `sorties/export/`.

## Aperçu sans Photoshop

`preview/preview.html` affiche les 8 visuels à partir de la même configuration.
Pour régénérer les PNG d'aperçu : `node preview/render.js` (nécessite Playwright).
Le rendu Photoshop final peut différer légèrement de l'aperçu (lissage des flous et des polices).
