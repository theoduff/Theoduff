# EDITING DNA — STYLE DE RÉFÉRENCE

**Vidéo source :** « Comment faire des textes animés pour tes reels avec une IA (sans Premiere Pro ni After Effects) »
**Format :** 720×1280 (9:16), 30 fps, 87,84 s, H.264 + AAC stéréo 44,1 kHz

---

## 0. Méthode et limites

### Comment la vidéo a été analysée

| Outil | Ce qu'il a mesuré |
|---|---|
| Planches d'images à 2 i/s (176 images horodatées) | Lecture complète, plan par plan, de tous les textes à l'écran |
| Planches à 30 i/s (image par image) sur 20 moments clés | Apparition des mots, tracés, scales, clignotements |
| Différence image par image (moyenne + histogramme) | Liste exacte des coupes (à l'image près) |
| Suivi optique (OpenCV, points du décor uniquement) | Zooms, push-ins, panoramiques : facteur d'échelle par image |
| Boîtes englobantes des pixels blancs/noirs du texte | Glissements et variations d'échelle des mots-clés, en pixels |
| Séparation **Mid / Side** (L+R / L−R) | La voix est **mono**. Tout ce qui apparaît dans le canal Side vient donc des effets sonores ou de la musique, ce qui permet d'isoler les SFX sans les confondre avec la voix |
| Spectrogrammes + analyse de bandes (sub < 120 Hz, aigus > 6 kHz) | Nature, durée et placement des SFX |
| Analyse des pics tonaux + autocorrélation | Tonalité et tempo estimés de la musique |
| EBU R128 | Loudness final |

### Légende utilisée dans tout le document
- **[OBS]** : observé ou mesuré directement (timecode, valeur en pixels, durée en images).
- **[EST]** : estimé ou déduit (paramètres logiciels, polices, intentions). C'est mon interprétation, pas une mesure.

### Limites (à connaître avant de s'appuyer sur ce document)
1. **Pas de transcription audio automatique.** Les modèles de reconnaissance vocale (Whisper, Vosk) sont bloqués par le réseau de cet environnement. Le texte parlé a été reconstitué à partir des sous-titres incrustés, qui reprennent la voix mot pour mot. Le calage voix↔texte est donc déduit de l'apparition des mots, pas de l'onde vocale.
2. **SFX mono non séparables.** Un effet sonore mixé en mono au centre est confondu avec la voix. Seuls les SFX stéréo sont identifiés avec certitude. En pratique, tous les SFX importants trouvés sont stéréo.
3. **La musique n'est pas identifiable** (titre, artiste). Seules sa tonalité, son tempo approximatif et son niveau sont mesurés.
4. **Les polices sont estimées visuellement.** L'interface factice de la vidéo affiche « Inter Tight / Helvetica Neue / Geneva / XW Zar Bold », ce qui donne un indice fort, mais rien n'est certain.
5. Vidéo recompressée (720p, ~1,2 Mb/s) : les détails fins (grain, flou de mouvement) sont mesurés avec une marge d'erreur.

---

## 1. Vue d'ensemble : la signature en une phrase

> **Un face-cam statique, sobre et bien éclairé, découpé par des cartons typographiques noirs/blancs plein écran. Les sous-titres apparaissent mot par mot en mélangeant un sans-serif gras et un serif italique. Un seul mot-clé est mis en valeur par phrase. Les rares moments forts sont « frappés » par un impact sub-bass, parfois doublé d'un zoom punch-in de +19 % : peu d'effets, chacun à un endroit précis.**

### Les règles affichées dans la vidéo elle-même [OBS]
Entre 55,8 s et 62,7 s, la vidéo affiche à l'écran la « fiche Mon style » du créateur. C'est sa charte, écrite noir sur blanc :

1. **Texte toujours horizontal**
2. **Jamais sur mon visage**
3. **Noir et blanc**
4. **Un mot-clé par phrase**
5. **Pas de texte doré**

Toute l'analyse ci-dessous confirme que ces 5 règles sont respectées sur toute la durée de la vidéo.

### Chiffres clés [OBS]
| Mesure | Valeur |
|---|---|
| Nombre de plans | **29** |
| Durée moyenne d'un plan | **3,03 s** (min 0,60 s, max 8,27 s) |
| Part du face-cam | **54 %** (47,6 s) |
| Part des cartons typographiques | **31 %** (27,5 s) |
| Part des captures d'écran et B-roll | **14 %** (12,7 s) |
| Transitions | **100 % de coupes franches** (aucun fondu, aucune transition animée) |
| Zooms punch-in | **3** (18,40 s, 32,97 s, 73,27 s) |
| Push-ins lents | **3** (37,1 s, 62,7 s, 83,2 s) |
| Impacts sub-bass | **10** |
| Loudness final | **−14,1 LUFS** intégré, LRA 3,0 LU, true peak −0,0 dBFS |

---

## 2. Analyse plan par plan

Timecodes en secondes, frame = n° d'image à 30 i/s. « Coupe » = coupe franche.

### Acte 1 : le hook (0,00 – 13,20 s)

| # | Timecode | Durée | Type | Contenu à l'écran | Montage / effets |
|---|---|---|---|---|---|
| 1 | 0,00 – 4,90 | 4,90 s | Face-cam | « Les **textes** » → « **animés** » → « que tu **vois** » → « dans cette **vidéo** » → « je ne les ai **pas faits** » → « sur **Premiere Pro** » → « ni **After Effects** » | [OBS] Caméra fixe (échelle stable à ±1 %). Sous-titres mot par mot, apparition sèche. Pas de musique audible clairement dans les 5 premières secondes [EST]. |
| 2 | 4,90 – 6,73 | 1,83 s | Face-cam + UI factice | « C'est **l'intelligence** » → « **artificielle** » → « qui les **fait** » | [OBS] Jump cut (frame 147). Au même instant apparaît une **fausse interface d'éditeur graphique** : barre de menus (Fichier, Édition, Calque, Texte, Affichage), panneau « Caractère » en haut à gauche (police XW Zar Bold, taille, couleur #FFFFFF), barre d'outils verticale à droite. Le mot est entouré d'un **cadre de sélection pointillé avec poignées**, et un **curseur avec un badge « IA »** agrandit le texte (voir recette R6). |
| 3 | 6,73 – 10,20 | 3,47 s | **Carton noir** | « **Avant,** / *il aurait fallu* » → nouvelle page « *plus d'une* / **demi-journée** » + trait de pinceau → « *pour pouvoir* / **éditer** » → « *un* **reel** / *comme ça.* » | [OBS] Coupe franche du face-cam vers le noir. Le texte se construit mot par mot et se **recentre** à chaque mot. **Impact sub-bass** à 7,85 s, pile sur « demi-journée », qui arrive avec un scale 109 % → 100 % ; le trait de pinceau se dessine de gauche à droite. |
| 4 | 10,20 – 13,20 | 3,00 s | **Carton blanc** | « **Aujourd'hui,** » → « *avec le* / **tournage** / *compris,* » → « *je l'ai fait en* / **une heure.** » | [OBS] Coupe noir → blanc (inversion totale de luminance) **avec un swish** (bruit large bande d'environ 170 ms à 10,23 s). **Impact sub** à 12,65 s sur « une » (scale ~110 % → 100 %). |

**Logique du hook [EST] :**
- 0 – 4,9 s : la promesse (« je ne les ai pas faits sur Premiere ni After »). Le visage crée la confiance ; aucun effet ne vient distraire.
- 4,9 s : la révélation (« c'est l'IA »). L'interface factice **montre** l'IA en train de travailler au lieu de seulement le dire.
- 6,7 – 13,2 s : le contraste **Avant (noir) / Aujourd'hui (blanc)**. L'inversion de couleur matérialise le changement d'époque. Les deux impacts sub tombent sur les **deux mesures de temps opposées** : « demi-journée » contre « une heure ». C'est le cœur de la promesse, donc ce sont les seuls mots qui reçoivent un impact.

### Acte 2 : la crédibilité (13,20 – 30,80 s)

| # | Timecode | Durée | Type | Contenu | Montage / effets |
|---|---|---|---|---|---|
| 5 | 13,20 – 15,77 | 2,57 s | Face-cam | « *Je te montre* **comment** » → « **j'ai fait** *et* » → « *comment tu peux* / **faire pareil.** » | [OBS] Retour au face-cam. Caméra fixe. |
| 6 | 15,77 – 19,37 | 3,60 s | Face-cam (jump cut) | « *Avec* **Clément,** » → « *mon* **associé,** » → « *on s'est donné* / **100 jours** » → « *pour signer* / **100 000 €** » | [OBS] Jump cut avec léger recadrage (décalage horizontal d'environ 30 px). **PUNCH-IN +19 %** à la frame 552 (18,40 s), une image après l'apparition de « 100 » (frame 551). **Impact sub** à 18,36 s. Le « € » arrive à la frame 561, en dernier. |
| 7 | 19,37 – 22,53 | 3,17 s | **Carton noir « data »** | « **Aujourd'hui,** » → « **on** *est au* / *jour* **2 → 22 → 29** » + barre de progression (29 %, échelle 100), puis « *et on a* **signé** » + compteur **10 400 € → 16 600 €** + 2ᵉ barre (16,6 %, échelle 100 000 €) | [OBS] Compteurs animés (comptage rapide), barres de progression fines sous les chiffres, petites légendes en serif italique minuscule (« 29 % », « 100 », « 100 000 € »). Pas d'impact sonore : c'est de l'information, pas un climax. |
| 8 | 22,53 – 30,80 | 8,27 s | Face-cam (plan le plus long) | « *J'avais pas* **le temps** » → « *et je* **voulais pas** » → « *refaire mes* **textes** / **animés** » (UI factice) → « *à chaque* **vidéo** » → « *Du* **coup** » → « *une petite* **astuce** » → « *J'utilise* **Claude Code** » → « *c'est une* **IA** » → « **directement** » → « *sur mon* **ordinateur** » | [OBS] L'interface factice revient de 23,5 à 25,8 s (curseur « déplacer » + cadre de sélection), puis disparaît. Aucun zoom. |

**Logique [EST] :** la séquence « 100 jours / 100 000 € » est un enjeu personnel. Le punch-in sur « 100 000 € » est le **premier zoom de la vidéo** : il marque l'enjeu. Le carton « data » qui suit apporte la preuve chiffrée (jour 29, 16 600 €), traitée sobrement comme un tableau de bord. Le plan 8 est long (8,3 s) parce qu'il s'agit d'une explication continue : le monteur laisse respirer et ne coupe pas pour couper.

### Acte 3 : la démonstration (30,80 – 55,83 s)

| # | Timecode | Durée | Type | Contenu | Montage / effets |
|---|---|---|---|---|---|
| 9 | 30,80 – 32,73 | 1,93 s | **Capture d'écran** (Finder → Terminal) | « *Je lui ai donné* / **trois reels** » → « *dont les* / **animations** *de texte* » | [OBS] Coupe avec **swish** (bruit large bande à 30,77 s). Plan fixe pendant 0,45 s, puis **panoramique virtuel** de 615 px vers la droite avec un zoom de +6,6 % en ease-in-out (frames 937 → 981, environ 1,45 s), jusqu'à cadrer le terminal. Un curseur glisse 3 fichiers. **Impact sub** à 31,34 s sur « trois reels ». Sous-titres en bas, sur un dégradé sombre. |
| 10 | 32,73 – 35,03 | 2,30 s | Face-cam | « **étaient** » → « *étaient* / **incroyables.** » → « *J'ai dit à* / **Claude Code** » | [OBS] **PUNCH-IN +22 %** à la frame 989 (32,97 s), une image après « incroyables. » (frame 988). **Impact sub** à 32,94 s (le plus fort de la vidéo : −6,3 dB dans le canal Side). |
| 11 | 35,03 – 37,13 | 2,10 s | **Carton blanc** | « **d'analyser** » → « **complètement** / *ces animations,* » | [OBS] **Impact sub** à 35,58 s sur « complètement ». |
| 12 | 37,13 – 41,13 | 4,00 s | Face-cam | « *et ensuite* / *de me* **proposer,** » → « *du coup,* / *des* **animations** / *de texte* » | [OBS] **Push-in lent** : échelle 1,000 → 1,094 en 4,0 s (environ +2,3 %/s, quasi linéaire). |
| 13 | 41,13 – 43,20 | 2,07 s | **Carton noir** | « *et des* / **compositions** / *de texte* » | [OBS] Pas d'impact. |
| 14 | 43,20 – 43,80 | **0,60 s** | **Carton blanc** | « *qui me* / **plaisent.** » | [OBS] Plan le plus court de la vidéo. **Impact sub + swish** sur la coupe (43,22 s). |
| 15 | 43,80 – 47,10 | 3,30 s | Face-cam + UI (panneau Calques) | « *elle* **m'a fait** » → « *des* **compositions** » → « *de* **texte** » → « *en* **images** » → « **75** *en tout* » | [OBS] Fausse liste de calques (T01…T75) à gauche, cadre de sélection sur chaque mot. |
| 16 | 47,10 – 48,83 | 1,73 s | Face-cam (jump cut) | « *sans* **compter** » → « *tous les* **retours** » → « *que je lui* **ai faits** » | [OBS] Des **étiquettes** apparaissent en haut à gauche, empilées : « mon style » (fond noir, texte jaune-or barré d'une croix), « style » (vertical), « style » (cyan). Apparition en fondu rapide de 2 images (frames 1416-1417, 1431-1432). |
| 17 | 48,83 – 50,90 | 2,07 s | **Capture d'écran** (page web « 75 compositions de texte », compteur « Gardées : 23 → 24 ») | « *Et je lui* / **disais** » → « **bah** » → « *ou* / **j'aime pas** » | [OBS] Dérive lente : défilement vers le haut de 111 px et zoom de +4,4 % en ease-out sur environ 1,3 s. Clics sur des cœurs (j'aime / croix). |
| 18 | 50,90 – 54,30 | 3,40 s | Face-cam + UI (sélecteurs) | « **Change la typographie** » (sélecteur Inter Tight / Helvetica Neue / Geneva / XW Zar Bold) → « *change les* **couleurs** » (palette de gris) → « *change* **l'emplacement** » (curseur déplacer) | [OBS] Le texte change réellement de police et de couleur pendant que l'interface factice « clique ». |
| 19 | 54,30 – 55,83 | 1,53 s | Face-cam (jump cut) | « *Et j'en ai* **gardé** » → « *finalement* **24** » | [OBS] Le compteur de calques passe de 75/75 à 63/75 puis 24/75. |

**Logique [EST] :** c'est la séquence la plus dense en effets, parce que c'est **la preuve du processus**. Chaque affirmation (« je lui ai donné », « il m'a fait 75 compositions », « je lui disais j'aime / j'aime pas », « change la typo ») est **illustrée littéralement** à l'écran. Les impacts sub ne frappent que les **superlatifs et les quantités** : « trois reels », « incroyables », « complètement », « plaisent ».

### Acte 4 : le système (55,83 – 74,87 s)

| # | Timecode | Durée | Type | Contenu | Montage / effets |
|---|---|---|---|---|---|
| 20 | 55,83 – 62,67 | **6,83 s** | **Carton blanc « fiche »** | Titre serif italique « *Mon style* » + checklist tapée en direct : « Texte toujours horizontal », « Jamais sur mon visage », « Noir et blanc », « Un mot-clé par phrase », « Pas de texte doré ». Les cases se cochent au fur et à mesure. Sous-titre en bas : « *Et à la* **fin** » → « *de tout* **récapituler** » → « *dans une* **fiche** » → « *de* **manière** *à ce* » → « *se* **souvenir** » → « *et qu'il* **puisse** » → « **noter** *toutes* » → « *mes* **préférences** » | [OBS] Effet machine à écrire à environ 1 caractère par image (≈ 30 car./s) avec curseur « \| ». Plan statique. |
| 21 | 62,67 – 65,83 | 3,17 s | Face-cam | « **Ensuite,** » → « *il ne me* **reste** » → « **plus** *qu'à* » → « *les* **rushes** » → « *dans* **Claude Code.** » | [OBS] **Push-in lent** : 1,000 → 1,097 en 3,1 s. |
| 22 | 65,83 – 69,43 | 3,60 s | **Capture d'écran** (Terminal) | Terminal : « Fiche "Mon style" chargée… », « lance le rendu », barre de progression « Rendu 39/202 → 202/202 », « Clip prêt : J029_16.mp4 ». Sous-titres : « *Et c'est lui qui me fait* » → « **toutes** » → « *de texte* » → « *et les* **animations** » → « *dans cette* **vidéo.** » | [OBS] Caméra virtuelle en 2 temps : montée de 41 px (ease-in-out, environ 1 s), pause, puis montée de 80 px avec léger dézoom (0,934), et **sortie en glissé latéral accéléré** (−240 px sur les 10 dernières images) qui enchaîne sur la coupe. **Impact sub** à 66,68 s sur « toutes ». |
| 23 | 69,43 – 72,47 | 3,03 s | **B-roll** (homme de nuit sur un portable, lampe chaude, ambiance sombre bleutée) | « *Pour* / **configurer** » → « *tout ça,* » → « *environ* / **8 heures,** » → « *en une* / **seule fois.** » | [OBS] Mouvement de caméra propre au plan (dézoom puis rezoom, échelle 1 → 0,86 → 0,98) [EST : probablement natif au plan stock ou généré]. Textes en haut à gauche, hors du personnage. **Impact sub** à 70,91 s sur « 8 heures ». |
| 24 | 72,47 – 74,87 | 2,40 s | Face-cam | « *Et* **aujourd'hui,** » → « *tout est* / **automatisé** » → « *à chaque* **reel.** » | [OBS] **PUNCH-IN +20 %** à la frame 2198 (73,27 s). **Impact sub** à 73,17 s. |

**Logique [EST] :** la fiche reste longtemps (6,8 s) parce que c'est **la valeur que le spectateur veut obtenir** (et qui servira à l'appel à l'action « commente STYLE »). Le contraste « 8 heures… en une seule fois » / « tout est automatisé » rejoue le schéma Avant / Aujourd'hui du hook, avec les mêmes armes : impact sur la durée, puis punch-in sur la résolution.

### Acte 5 : le twist et l'appel à l'action (74,87 – 87,84 s)

| # | Timecode | Durée | Type | Contenu | Montage / effets |
|---|---|---|---|---|---|
| 25 | 74,87 – 77,07 | 2,20 s | **Carton noir** | « **Hello,** » → « *c'est Victor* » → « **du montage** » | [OBS] « Hello, » **clignote** sur 5 images (frames 2246 à 2250 : visible / invisible / visible / invisible / visible), puis reste fixe. **Changement de voix** : à partir de 74,9 s la voix contient du signal dans le canal Side (stéréo), contrairement à la voix principale, qui est mono. [EST] C'est un 2ᵉ intervenant (le monteur), enregistré dans d'autres conditions. **Impact sub et aigus** sur la coupe (74,87 s). |
| 26 | 77,07 – 79,13 | 2,06 s | **Capture d'écran** (Finder, plus de 100 fichiers d'export J029_…v01…v05) | « **Bon, je vous** » → « **avoue que** » → « **le montage** » → « **de cette vidéo** » | [OBS] Défilement natif de la liste ; sous-titres sur un dégradé sombre en bas. Le défilement des versions sert de preuve visuelle du travail. |
| 27 | 79,13 – 81,30 | 2,17 s | **Carton blanc** | « *m'a pris* » → « **beaucoup** » → « **plus** » (taille ×1,4) + trait de pinceau noir sous « plus » → « *de temps que prévu* » | [OBS] Trait de pinceau dessiné de gauche à droite sur environ 15 images (frames 2385 à 2400), plus lent que celui de « demi-journée ». |
| 28 | 81,30 – 83,23 | 1,93 s | **Carton noir** | « *Et ça,* » → « *je vous explique* » → « *pourquoi* » → « *demain* » | [OBS] Tout en serif italique (aucun mot gras), plus doux. « demain » (plus grand) apparaît **lettre par lettre en fondu** (d-e-m-a-i-n, de la frame 2464 à 2475 : environ 0,37 s, chaque lettre part du gris et monte au blanc en environ 4 images). |
| 29 | 83,23 – 87,84 | 4,61 s | Face-cam (appel à l'action) | « *Si tu veux* **créer** » → « *ton* **style** *à toi* » → « **commente** » → « **STYLE** » (capitales, très grand) + barre de publication factice « STYLE \| Publier » → « *en bas de cette vidéo* » → « *Et je t'envoie* / **la fiche** » | [OBS] **Push-in lent** 1,000 → 1,124 en 4,5 s. « STYLE » grandit de 30 % à 100 % en 8 images via le cadre de sélection et le curseur (même geste que « l'intelligence »). Le mot est tapé dans une fausse barre de commentaire (S, ST, STYL…). |

**Logique [EST] :** la fausse fin (« Hello, c'est Victor ») est un **twist d'humour et de rétention** : au moment où l'on croit la vidéo terminée, une nouvelle voix et un clignotement « glitch » relancent l'attention. Elle avoue que le montage a pris plus de temps que prévu, ce qui crée de l'authenticité et une **boucle ouverte** (« je vous explique pourquoi demain »). Elle annonce la vidéo suivante. Le « demain » est animé avec douceur (fondu lettre par lettre, et non un mot qui claque) : c'est une promesse, pas un impact. L'appel à l'action revient au visage avec un push-in continu, pour gagner en intimité jusqu'à la dernière image.

---

## 3. Décorticage des animations

### A1 — Sous-titre mot par mot (animation n° 1, présente sur environ 90 % de la vidéo)
- **[OBS] Apparition** : sèche, opacité 0 → 100 % en **1 image**. Aucun fondu, aucun rebond, aucun flou de mouvement.
- **[OBS] Construction** : les mots s'ajoutent un par un **au rythme de la parole**. Quand une phrase est terminée, le bloc **disparaît d'un coup** et le suivant commence (pagination sèche).
- **[OBS] Recentrage** : le bloc est **centré horizontalement et verticalement** sur son point d'ancrage. À chaque mot ajouté, l'ensemble se recentre instantanément (pas d'interpolation), par exemple « un » → « un reel » → « un reel / comme ça. ».
- **[OBS] Hiérarchie** : petits mots en **serif italique** (environ 45–55 % de la hauteur du mot-clé) et mot-clé en **sans-serif gras**. Le mot-clé peut monter à la ligne avec une taille supérieure.
- **[EST] Rythme** : un nouveau mot environ toutes les 0,2 à 0,45 s (débit parlé rapide d'un reel). Le mot apparaît sur sa première syllabe, sans anticipation visible.

### A2 — Mot-clé « slide-up » (sous-titres sur le face-cam)
Mesuré sur « 100 » (frames 551 à 558) et « incroyables. » (frames 988 à 995) :

| Image | 0 | +1 | +2 | +3 | +4 | +5 | +6 | +7 |
|---|---|---|---|---|---|---|---|---|
| Décalage vertical restant (px @1280) | 17 | 11 | 6 | 4 | 2 | 1 | 0 | 0 |

- **[OBS]** Opacité à 100 % dès la 1ʳᵉ image. Montée de **≈ 17 px** (≈ 1,3 % de la hauteur, soit ≈ 25 px en 1080×1920). Durée **6 images (0,2 s)**. Courbe **ease-out exponentielle** (chaque image parcourt environ 40 % du chemin restant). Pas de variation d'échelle, pas de rebond.
- **[EST]** Réglage : position Y de +25 px → 0 (en 1080p), 200 ms, courbe « Expo Out » ou bezier (0.16, 1, 0.3, 1).

### A3 — Mot-clé « scale-down landing » (cartons plein écran, mots qui portent un impact)
Mesuré sur « demi-journée » (frames 235 à 242) et « une » (frames 379 à 385) :

| Image | 0 | +1 | +2 | +3 | +4 | +5 | +6 |
|---|---|---|---|---|---|---|---|
| Largeur (px) | 503 | 487 | 477 | 470 | 466 | 463 | 461 → 460 |
| Échelle relative | 109,3 % | 105,9 % | 103,7 % | 102,2 % | 101,3 % | 100,7 % | 100 % |

- **[OBS]** Le mot arrive **déjà grossi (≈ 109–110 %)** et se pose à 100 % en **≈ 7 images (0,23 s)**, ease-out, centre fixe. Opacité 100 % immédiate, aucun dépassement (pas de rebond sous 100 %).
- **[OBS]** Seuls les mots qui reçoivent un impact sub ont ce mouvement. « reel » (sans impact) apparaît totalement statique.
- **[EST]** Réglage : scale 110 % → 100 %, 230 ms, Expo Out, ancre au centre du mot.

### A4 — Trait de pinceau souligné (brush stroke)
- **[OBS]** Forme : trait de pinceau sec, épais au centre et effilé aux extrémités, légèrement incliné. Blanc sur le carton noir, noir sur le carton blanc. Il est placé sous le mot-clé, légèrement plus large que lui.
- **[OBS]** Révélation **de gauche à droite** (masque de type write-on) :
  - « demi-journée » : environ 7 images (0,23 s), synchronisé avec le scale-down A3 et l'impact sub.
  - « plus » : environ 15 images (0,5 s), plus lent, sur un mot qui conclut.
- **[EST]** Courbe ease-out (le début du trait est rapide, la fin ralentit).

### A5 — Compteurs et barres de progression (carton « data »)
- **[OBS]** « jour 2 → 22 → 29 » et « 10 400 € → 16 600 € » : le nombre défile rapidement jusqu'à sa valeur finale. Une barre fine (1–2 px) se remplit sous le chiffre. Les légendes (« 29 % », « 100 », « 100 000 € ») sont en serif italique minuscule.
- **[EST]** Comptage d'environ 0,5 à 0,8 s en ease-out (rapide puis ralenti). La barre se remplit en même temps que le chiffre.

### A6 — « Resize par l'IA » (cadre de sélection + curseur IA)
Mesuré sur « l'intelligence » (frames 147 à 159) :

| Image | 147–150 | 151 | 152 | 153 | 154 | 155 | 156 | 157 | 158 | 159 |
|---|---|---|---|---|---|---|---|---|---|---|
| Largeur (px) | ≈ 141–163 | 201 | 233 | 269 | 289 | 308 | 325 | 335 | 343 | 346 |

- **[OBS]** Le mot démarre à **≈ 40 % de sa taille**, reste petit 3–4 images (le temps de la « prise » par le curseur), puis **grandit jusqu'à 100 % en 8–9 images (≈ 0,3 s)**, ease-out. Le cadre de sélection (pointillés + 4–8 poignées carrées) et le curseur-flèche avec la pastille « IA » suivent le coin inférieur droit. La valeur « taille » du panneau Caractère change en même temps (de 25 px à environ 100 px).
- **[OBS]** Même geste sur « STYLE » à 84,9 s (frames 2546 à 2553).
- **[EST]** Le cadre et le curseur sont des calques graphiques animés à la main, liés (parentés) au coin du texte.

### A7 — Interface factice « éditeur graphique » (overlay)
- **[OBS]** Éléments : barre de menus fine en haut, panneau « Caractère » ou « Calques » en haut à gauche, barre d'outils verticale à droite (≈ 8 icônes), tous en gris foncé semi-opaque, à bords arrondis et petits. Ils apparaissent ou disparaissent **avec la coupe** (aucune animation d'entrée), ou en fondu de 2 images pour les étiquettes.
- **[EST]** Rôle : faire croire que l'IA « manipule » les sous-titres en direct. C'est la **mise en scène littérale du sujet** de la vidéo.

### A8 — Machine à écrire (checklist)
- **[OBS]** Environ 1 caractère par image, curseur « \| » visible, case ronde qui se coche (✓ gris) quand la ligne suivante commence.

### A9 — Clignotement « glitch » d'entrée
- **[OBS]** « Hello, » : on/off/on/off/on sur 5 images consécutives (alternance image par image), puis fixe.
- **[EST]** Rôle : marquer une rupture (nouvelle voix, nouveau narrateur).

### A10 — Révélation lettre par lettre en fondu
- **[OBS]** « demain » : chaque lettre apparaît en gris foncé et monte au blanc en environ 4 images. Une nouvelle lettre démarre environ toutes les 2 images. Total ≈ 11–12 images (0,37 s).
- **[EST]** Équivalent : animateur d'opacité par caractère, décalage de 2 images, rampe de 4 images, ease-out.

### A11 — Caméra : punch-in (face-cam)
Mesuré à l'identique sur les 3 occurrences (frames 552, 989, 2198) :

| Image | 0 | +1 | +2 | +3 | +4 | +5 | +6 | +7 → |
|---|---|---|---|---|---|---|---|---|
| Échelle cumulée | 1,000 | 1,079 | 1,125 | 1,150 | 1,163 | 1,171 | 1,176 | ≈ 1,19 (maintenu) |

- **[OBS]** Amplitude **+19 à +22 %**. Durée ≈ **6–8 images (0,2–0,27 s)**. Courbe **ease-out exponentielle forte** : environ 42 % du chemin dès la 1ʳᵉ image, puis la moitié du reste à chaque image. Le zoom est **maintenu jusqu'à la coupe suivante** (pas de retour au plan large).
- **[OBS]** Point d'ancrage calculé : x ≈ 350–360 px (centre), y ≈ 475–580 px sur 1280 (**zone visage / bouche**).
- **[OBS]** Le zoom démarre **1 image après l'apparition du mot-clé** et en même temps que l'impact sub.

### A12 — Caméra : push-in lent
- **[OBS]** +9,4 % en 4,0 s (plan 12), +9,7 % en 3,1 s (plan 21), +12,4 % en 4,5 s (plan 29). Quasi linéaire, environ 2,3–3,1 %/s.
- **[OBS]** Utilisé sur les plans face-cam **d'explication** (plans 12 et 21) et sur **l'appel à l'action** (plan 29).

### A13 — Caméra virtuelle sur les captures d'écran
- **[OBS]** Plan 9 : maintien 0,45 s, puis panoramique de 615 px et zoom de +6,6 % en ease-in-out sur ≈ 1,45 s (vitesse maximale au milieu, environ 30 px/image).
- **[OBS]** Plan 17 : défilement de 111 px et zoom de +4,4 % en ease-out sur ≈ 1,3 s.
- **[OBS]** Plan 22 : déplacement vertical en 2 temps, puis sortie en glissé latéral accéléré juste avant la coupe.
- **[EST]** Règle : sur une capture d'écran, la caméra **va chercher l'information** au moment où la voix en parle. Elle ne bouge jamais au hasard.

---

## 4. Sound design

### Vue d'ensemble [OBS]
- **Loudness** : −14,1 LUFS intégré (standard réseaux sociaux), **LRA 3,0 LU** (très compressé, voix « collée » à l'oreille), true peak −0,0 dBFS (limiteur au plafond).
- **Voix** principale **mono**, compressée, sans réverbération audible [EST].
- **Musique** très discrète, uniquement dans le **champ stéréo** (absente du centre ou très faible), ce qui laisse le centre libre pour la voix.
- **SFX** très peu nombreux, mais puissants et systématiques : **un seul type d'impact**, réutilisé 10 fois.

### 4.1 L'impact sub-bass (le SFX signature)
**[OBS]** 10 occurrences, profil identique :
- Contenu : **98 % de l'énergie sous 150 Hz**, centroïde ≈ **40 Hz** (sub boom de type 808 / cinematic hit), large en stéréo.
- Durée : **≈ 560–590 ms**. Attaque large bande nette, puis le sub monte jusqu'à son pic environ **180–290 ms après le départ** et décroît.
- Niveau : environ +27 à +34 dB au-dessus du bruit de fond du canal Side.

| # | Début | Mot / moment | Associé à |
|---|---|---|---|
| 1 | 7,85 s | « **demi-journée** » | scale-down A3 + trait de pinceau |
| 2 | 12,65 s | « **une** (heure) » | scale-down A3 |
| 3 | 18,36 s | « **100 000 €** » | **punch-in** |
| 4 | 31,34 s | « **trois reels** » | capture d'écran |
| 5 | 32,94 s | « **incroyables.** » | **punch-in** (impact le plus fort) |
| 6 | 35,58 s | « **complètement** » | carton blanc |
| 7 | 43,22 s | « **plaisent.** » | coupe vers un carton de 0,6 s + swish |
| 8 | 66,68 s | « **toutes** » | capture terminal |
| 9 | 70,91 s | « **8 heures,** » | B-roll |
| 10 | 73,17 s | « **automatisé** » | **punch-in** |

**Règle déduite [EST] :** l'impact frappe **les quantités, les durées et les superlatifs**, c'est-à-dire les mots qui portent la promesse ou le contraste. Il n'est **jamais** utilisé sur une simple coupe sans mot fort. Espacement minimal observé : 1,6 s (31,3 → 32,9). Ensuite, il n'y a souvent aucun impact pendant plus de 20 s (de 43 à 66 s) : la rareté conserve l'effet.

### 4.2 Le swish de coupe (bruit large bande court)
**[OBS]** ≈ 150–200 ms, bruit large bande (jusqu'à 14 kHz, centroïde ≈ 5–6 kHz), stéréo, placé **sur la coupe**, uniquement pour les changements d'univers visuel :
- 10,23 s : carton noir → **carton blanc** (Avant → Aujourd'hui)
- 30,77 s : face-cam → **capture d'écran**
- 43,2 s : → carton blanc « plaisent. » (avec l'impact)
- 74,87 s et 77,07 s : entrée de la séquence « Victor »

**[OBS]** Toutes les autres coupes (environ 22 sur 28) sont **sèches, sans SFX**.
**[OBS / EST]** Juste après les swishes de 10,23 s et 30,77 s, le canal Side montre un **creux d'environ 150–200 ms** (musique quasi absente) avant la reprise. [EST] Il s'agit probablement d'une micro-coupure volontaire de la musique (« stop ») pour accentuer le changement d'écran. Ce point est à confirmer à l'écoute.

### 4.3 Musique
- **[OBS]** Tonalité : **Mi** (notes dominantes Mi, Si, Fa#, La ; trace de Sol# au début), donc harmonie de Mi majeur ou Esus2/add9, stable sur toute la vidéo.
- **[EST]** Tempo ≈ **81 BPM** (ou 162 en double temps) : période rythmique de 0,37 s détectée de façon régulière.
- **[OBS]** Niveau : environ −36 à −45 dB RMS dans le canal Side, soit **20–25 dB sous la voix**. Elle est quasiment imperceptible consciemment et sert de tapis.
- **[OBS]** Ducking faible : environ −1,3 dB quand la voix est forte (corrélation −0,16). [EST] Le niveau de la musique est donc déjà réglé très bas, sans sidechain marqué.
- **[EST]** Présence nette à partir d'environ 5–7 s (révélation « IA » / carton « Avant »). Avant, elle est soit absente, soit plus faible.
- **[EST]** Caractère : ambiance douce, tonale, sans grosse caisse marquée (aucune pulsation sub régulière détectée), style lo-fi / ambient tech.

### 4.4 Autres éléments
- **[OBS]** Aucun bruit de clavier, de clic ou de pop clairement identifiable dans le canal stéréo pendant les captures d'écran et la machine à écrire. Il y a seulement de petits transitoires de −28 à −30 dB, trop faibles et irréguliers pour être des SFX volontaires (probablement la musique).
- **[OBS]** Séquence « Victor » (74,9 – 83,2 s) : la voix est dans le champ stéréo, avec un timbre différent. La voix se coupe avant le retour au face-cam.
- **[EST]** Aucun riser n'a été détecté.

---

## 5. Direction artistique

### 5.1 Palette [OBS]
| Élément | Valeur mesurée |
|---|---|
| Fond des cartons noirs | **#0B0B0B** + grain (écart-type ≈ 5 niveaux) |
| Fond des cartons blancs | **#EFEFEF** (blanc cassé « papier ») + grain fin (écart-type ≈ 3,5) |
| Texte sur le face-cam | **Blanc pur** + ombre portée douce sombre |
| Texte sur carton noir / blanc | Blanc pur / noir pur |
| Seule couleur d'accent | Étiquettes « style » jaune-or et cyan (plan 16), pastilles rouges des fenêtres macOS. Aucune couleur sur la typographie principale. |

Le face-cam est étalonné de façon **naturelle et chaude** : peau neutre, chemise verte saturée mais réaliste, mur beige. Il n'y a ni look ni LUT créative marquée [EST]. La vidéo repose sur le contraste « vrai monde en couleur » / « cartons noir et blanc ».

### 5.2 Typographie
| Rôle | Police estimée [EST] | Caractéristiques [OBS] |
|---|---|---|
| Mot-clé (gras) | **Inter Tight Bold / ExtraBold** (alternative : Helvetica Neue Bold ; « XW Zar Bold » est affichée dans le panneau factice) | Sans-serif grotesque, gras, **interlettrage serré** (≈ −2 à −4 %), bas de casse |
| Mots secondaires | **Serif italique contrasté** : proche de Playfair Display Italic, Instrument Serif Italic ou PP Editorial Italic | Petite taille, italique, empattements fins |
| Titres de fiche | Même serif italique, en grande taille (« Mon style ») | |
| Checklist et interface | Inter Regular / SF Pro | |
| Terminal | Monospace (SF Mono / Menlo) | |

**Tailles approximatives (à transposer en 1080×1920, soit ×1,5 par rapport aux mesures en 720p) [EST]** :
- Mot-clé face-cam : ≈ 85–95 px.
- Mot secondaire : ≈ 45–55 px (environ 50–60 % du mot-clé).
- Mot-clé carton : ≈ 110–150 px ; mot d'emphase final (« plus ») : ≈ 200 px.
- Capitales d'appel à l'action « STYLE » : ≈ 130 px.

### 5.3 Placement [OBS]
- **Face-cam** : bloc de sous-titres centré horizontalement, avec un **centre vertical à environ 63–68 % de la hauteur**, c'est-à-dire **sous le menton, au niveau des mains et du micro**. Le visage n'est jamais recouvert (règle n° 2).
- **Cartons** : bloc centré ; position verticale variable selon la page (environ 15 %, 45 % ou 50 % de la hauteur). Quand le carton porte un schéma (compteur), le texte est en haut.
- **Captures d'écran** : sous-titres en bas (≈ 65–70 %), sur un **dégradé sombre** qui assure la lisibilité.
- **B-roll** : texte en haut à gauche, dans l'espace vide du cadre, loin du personnage.

### 5.4 Ce qui donne l'aspect « pro » [EST]
1. **Contrainte radicale** : noir et blanc, deux polices, un seul mot-clé. Rien de superflu.
2. **Le contraste typographique** (grotesque gras / serif italique) donne immédiatement un ton éditorial, « magazine ».
3. **Le grain** sur les cartons évite l'effet « aplat numérique » : ils ressemblent à du papier ou de la pellicule.
4. **La précision du calage** : mots à l'image près, zoom à +1 image, impact au même moment.
5. **La retenue** : 22 coupes sur 28 sans aucun son ; 3 punch-ins seulement en 88 s.

---

## 6. Logique du monteur : pourquoi chaque choix

### Pourquoi couper ici ?
- **Changement d'idée = changement d'univers visuel.** Le monteur ne coupe pas au hasard : chaque nouvelle idée change le **type** de plan (face-cam → carton → capture). Les cartons servent quand l'idée est **abstraite ou chiffrée** (avant/aujourd'hui, durées, compteurs) ; les captures quand elle est **concrète** (« je lui ai donné trois reels ») ; le face-cam quand elle est **personnelle ou relationnelle** (« mon associé », « j'avais pas le temps », l'appel à l'action).
- **Jump cuts** (4,9 s, 15,77 s, 47,1 s, 54,3 s) : ils retirent les hésitations et servent de **point de bascule pour ajouter ou retirer une couche d'interface factice**.
- **Plans longs = respiration.** Le plan 8 (8,3 s) et la fiche (6,8 s) restent à l'écran parce que le spectateur doit lire ou suivre un raisonnement.

### Pourquoi un zoom plutôt qu'un cut ?
- Le **punch-in** n'est utilisé que sur le face-cam et sur les **3 enjeux émotionnels** : l'argent (100 000 €), la qualité (incroyables) et la libération (automatisé). Il crée une emphase **sans quitter le regard** de la personne : on reste dans la relation humaine, mais « plus près ».
- Le **push-in lent** sert les plans **d'explication** (pour éviter qu'un plan fixe de 3–4 s paraisse statique) et l'**appel à l'action** (intimité croissante).

### Pourquoi ce mot est-il le mot-clé ?
- C'est le mot qui, **lu seul, résume la phrase** : « l'intelligence », « 100 jours », « 100 000 € », « astuce », « Claude Code », « ordinateur », « typographie », « couleurs », « l'emplacement ». Ce sont presque toujours des **noms, chiffres ou verbes de résultat**, jamais des mots-outils.
- Sur certains mots, le mot-clé est découpé (« l'intelligence » / « artificielle ») pour **ralentir la lecture** et créer une petite attente.

### Pourquoi un SFX à ce moment-là ?
- L'**impact** = « retiens ce chiffre ». Il est réservé aux mots qui portent la **valeur** (temps gagné, argent, qualité, totalité).
- Le **swish** = « on change de monde » (noir → blanc, humain → écran).
- **Silence sur les autres coupes** : si chaque coupe faisait du bruit, plus aucune ne compterait.

### Pourquoi certaines séquences sont-elles plus calmes ?
- **45 – 62 s** (démonstration de l'interface, puis fiche) : aucun impact pendant environ 23 s. Le spectateur est en train de **comprendre le processus** ; l'interface factice suffit à capter son attention. Le monteur garde ses impacts pour la résolution (« toutes », « 8 heures », « automatisé »).
- **Fin « demain »** : animation douce, tout en italique. C'est une **promesse** et non une affirmation : le ton baisse volontairement pour créer de la curiosité plutôt que de l'impact.

### Structure narrative (arc)
`Hook (promesse + contraste) → Enjeu personnel (100 jours / 100 000 €) → Preuve chiffrée → Problème → Solution (Claude Code) → Démonstration du processus → Livrable (la fiche) → Automatisation → Twist humoristique + boucle ouverte → Appel à l'action`

---

## 7. Règles de montage (la grammaire à appliquer)

### Règles observées [OBS]
1. **Coupes franches uniquement.** Aucun fondu, aucune transition animée.
2. **Sous-titres mot par mot**, apparition sèche, recentrage à chaque mot, pagination à chaque fin de phrase.
3. **Un seul mot-clé par phrase** en sans-serif gras ; tout le reste en serif italique, plus petit.
4. **Noir et blanc uniquement** pour la typographie. Aucune couleur, aucun doré.
5. **Jamais de texte sur le visage** : le bloc se place sous le menton (≈ 63–68 % de la hauteur).
6. **Texte toujours horizontal** : aucune rotation, aucune perspective.
7. **Alternance de 3 univers** : face-cam (≈ 55 %), cartons N&B (≈ 30 %), captures et B-roll (≈ 15 %).
8. **Plans de 2 à 4 s** en moyenne (médiane ≈ 2,4 s). Un plan peut durer jusqu'à 8 s s'il s'agit d'une explication continue.
9. **Punch-in de +19–22 %** en 0,2 s (ease-out expo) sur 3 mots-clés maximum par minute, synchronisé avec un impact.
10. **Impact sub-bass** uniquement sur les quantités, durées et superlatifs (environ 1 toutes les 9 s en moyenne, groupés aux moments clés).
11. **Swish** uniquement sur les changements d'univers forts (noir ↔ blanc, humain → écran).
12. **Musique en tapis** à −20/−25 dB sous la voix, placée dans le champ stéréo.
13. **Mix final** à −14 LUFS, voix très compressée (LRA ≈ 3 LU).
14. **Illustration littérale** : quand la voix décrit une action (« change la typo », « je lui ai donné »), l'image la **montre** au même moment.

### Habitudes de rythme [EST]
- Le hook dure environ 13 s et comporte 4 plans.
- Les impacts arrivent **par paires** (demi-journée / une heure, trois reels / incroyables, 8 heures / automatisé) pour souligner un contraste ou une progression.
- Le plan le plus court (0,6 s, « plaisent. ») sert à **ponctuer** la fin d'une énumération.

---

## 8. Bibliothèque de recettes techniques

> Les paramètres sont donnés pour un projet en **1080×1920, 30 fps**. Les valeurs mesurées en 720p ont été multipliées par 1,5. Outils : **After Effects** (référence), **Premiere Pro**, **CapCut / CapCut Pro**, **DaVinci Resolve (Fusion)**. Sauf mention contraire, tous les paramètres sont **[EST]** à partir des mesures **[OBS]** de la section 3.

### R1 — Sous-titre mot par mot « éditorial »
**Outils :** After Effects (Text Animator) ; Premiere (Essential Graphics + un calque par mot) ; CapCut (« Texte automatique », puis une piste par mot).
**Paramètres :**
- Mot-clé : Inter Tight Bold, ≈ 90 px, tracking −30, blanc #FFFFFF.
- Mot secondaire : Playfair Display Italic (ou Instrument Serif Italic), ≈ 50 px, tracking 0, blanc.
- Ombre portée : noir, opacité 35–45 %, distance 0–2 px, flou 12–20 px (ombre « halo » douce, sans contour).
- Ancre du bloc : centre (x = 540, y ≈ 1220–1300).

**Étapes :**
1. Transcrire avec des timecodes au mot.
2. Pour chaque phrase, créer un bloc. Faire apparaître chaque mot à son timecode, avec une opacité de 0 → 100 % en 1 image (keyframe hold).
3. Laisser le bloc se recentrer (alignement centré, point d'ancrage au centre ; dans After Effects, utiliser un Text Animator Opacity + Range Selector en mode « mots » avec des keyframes hold).
4. Fin de phrase : coupe sèche du bloc entier, puis bloc suivant.
5. Choisir **un seul** mot-clé (le mot qui résume la phrase). Il peut passer à la ligne suivante, en plus grand.

### R2 — Mot-clé « slide-up »
- Position Y : +25 px → 0, sur **6 images (200 ms)**.
- Opacité : 100 % dès la 1ʳᵉ image.
- Courbe : Expo Out. Dans After Effects, influence entrante ≈ 90 % sur la keyframe de fin et vitesse sortante élevée sur la 1ʳᵉ ; ou bezier `cubic-bezier(0.16, 1, 0.3, 1)`.
- Pas de rebond, pas de flou de mouvement.
- CapCut : animation « Glisser vers le haut » raccourcie à 0,2 s, puis courbe « ease out ».

### R3 — Mot-clé « scale-down landing » (cartons)
- Échelle : **110 % → 100 %** sur **7 images (≈ 230 ms)**, ancre au centre du mot, Expo Out.
- Opacité : 100 % immédiate.
- **Uniquement** si le mot reçoit un impact sub (R9).
- Premiere : Effets → Mouvement → Échelle 110 → 100, keyframe « Bezier » avec la poignée d'entrée étirée.

### R4 — Trait de pinceau write-on
**Outils :** pack d'assets « brush strokes » (PNG/MOV alpha) ou forme tracée à la main.
1. Placer le trait sous le mot-clé, de largeur ≈ 105 % du mot, avec un angle de −2° à −4°.
2. After Effects : effet **Linear Wipe** (angle 270° = de gauche à droite, contour progressif 20–40 px) de 100 % → 0 % ; ou Stroke / Trim Paths sur un tracé avec un effet Roughen Edges.
3. Durée : **7 images** pour un mot d'impact, **15 images** pour un mot de conclusion. Ease-out.
4. Démarrer sur la même image que le mot.
5. Couleur : blanc sur noir, noir sur blanc.

### R5 — Carton typographique noir / blanc avec grain
- Solide #0B0B0B (noir) ou #EFEFEF (blanc).
- Grain : After Effects **Add Grain** (intensité ≈ 0,15–0,25, taille ≈ 0,8, monochrome) ; Premiere **Bruit** 4–6 % sans couleur ; CapCut, filtre « Grain » à environ 15–20.
- Texte construit avec R1 + R3 + R4. Changement de « page » par coupe sèche (pas d'effacement animé).
- Passage noir → blanc : coupe franche + swish (R10).

### R6 — Interface factice « IA qui édite le texte »
**Assets à créer une fois (Figma, Illustrator ou After Effects) :**
- Barre de menus (Fichier / Édition / Calque / Texte / Affichage), hauteur ≈ 22 px, gris #2A2A2A à 85 % d'opacité, coins arrondis.
- Panneau « Caractère » (police, taille, couleur), ≈ 160×110 px, en haut à gauche.
- Barre d'outils verticale (8 icônes), à droite, au niveau des yeux.
- Cadre de sélection : rectangle en pointillés blancs 1,5 px + 8 poignées carrées de 6 px.
- Curseur : flèche blanche contourée de noir + **pastille ronde « IA »**.

**Animation (« resize par l'IA ») :**
1. Mot à 40 % de sa taille finale pendant 3–4 images (« prise »).
2. Échelle 40 % → 100 % sur **9 images (0,3 s)**, Expo Out, ancre au coin supérieur gauche (le texte grandit vers le bas à droite).
3. Le cadre de sélection et le curseur sont parentés au coin inférieur droit du mot.
4. La valeur « Taille » du panneau suit l'animation (expression `Math.round(scale*1)` ou valeurs en keyframes hold).
5. Les éléments d'interface apparaissent ou disparaissent **sur une coupe** (de préférence un jump cut), sans fondu. Les étiquettes peuvent apparaître en fondu de 2 images.

### R7 — Punch-in (zoom d'emphase)
- Échelle : **100 % → 119 %** (jusqu'à 122 %), sur **7 images**, ancre sur le **visage** (x = centre, y ≈ 37–45 % de la hauteur).
- Courbe : ease-out très agressif (≈ 42 % du chemin dès la 1ʳᵉ image). After Effects : keyframe d'entrée avec 100 % d'influence, keyframe de sortie avec vitesse forte ; ou expression exponentielle `s = 100 + 19*(1 - Math.pow(0.5, f))` où f est le nombre d'images écoulées.
- **Démarre 1 image après l'apparition du mot-clé**, en même temps que l'impact sub.
- **Pas de retour** : le plan reste zoomé jusqu'à la coupe suivante.
- Prérequis : tourner en 4K ou au moins en 1440p pour zoomer à 120 % sans perte visible.
- Maximum : environ 3 par vidéo de 90 s.

### R8 — Push-in lent
- Échelle : 100 % → 110–112 % sur toute la durée du plan (3–4,5 s), **linéaire**.
- Ancre sur le visage.
- Usage : plans face-cam d'explication de plus de 3 s et plan d'appel à l'action.

### R9 — Impact sub-bass
**Son à choisir :** « sub drop », « 808 boom » ou « cinematic sub hit », d'environ **0,55–0,6 s**, avec une fondamentale de **35–50 Hz**, une attaque courte avec un léger clic large bande, en stéréo.
**Placement :** le départ du son sur **l'image où le mot apparaît** (le pic de sub arrivera naturellement environ 0,2–0,3 s plus tard).
**Mixage :** pic environ −8 à −12 dBFS avant le limiteur final ; pas de réverb ; éventuellement un passe-haut à 25 Hz pour éviter de saturer le limiteur.
**Règle :** uniquement sur les chiffres, durées et superlatifs, au maximum environ 10 par 90 s, et de préférence par paires contrastées.

### R10 — Swish de coupe
**Son à choisir :** « swish », « air whoosh short » ou « paper swipe », d'environ **150–200 ms**, bruit large bande clair (énergie entre 3 et 14 kHz), stéréo.
**Placement :** centré sur la coupe (départ environ 1 image avant).
**Option [EST, à confirmer] :** couper la musique pendant 150–200 ms juste après le swish (bypass du volume ou coupe de la piste).
**Règle :** uniquement noir ↔ blanc, humain → capture d'écran, ou entrée d'une nouvelle séquence. Jamais sur un jump cut.

### R11 — Caméra virtuelle sur capture d'écran
- Enregistrer l'écran en haute définition (≥ 1440p), puis l'imbriquer dans un format 9:16.
- Garder le plan fixe 0,4–0,5 s, puis faire un **panoramique ease-in-out** (bezier 0.65, 0, 0.35, 1) vers l'élément dont la voix parle, sur 1,2–1,5 s, avec un léger zoom de +5–7 %.
- Option de sortie : glissé latéral accéléré (ease-in) sur les 8–10 dernières images avant la coupe.
- Sous-titres en bas, sur un **dégradé noir** (0 % → 70 % d'opacité, hauteur ≈ 35 % de l'écran).

### R12 — Compteur + barre de progression
- After Effects : Slider Control + expression `Math.round(effect("Slider Control")("Slider"))`, avec un séparateur des milliers en espace (« 10 400 € »).
- Durée du comptage : 0,5–0,8 s, Expo Out.
- Barre : rectangle de 2 px, échelle X de 0 → valeur %, même durée et même courbe ; ligne de fond grise à 20 % d'opacité.
- Légendes en serif italique ≈ 22 px.

### R13 — Machine à écrire (checklist)
- After Effects : animateur preset « Typewriter » ; 1 caractère par image (30 car./s) ; curseur « | » clignotant.
- Case : cercle de 1,5 px qui se transforme en ✓ gris quand la ligne suivante commence.
- Fond : carton blanc R5 ; titre en serif italique ≈ 75 px.

### R14 — Clignotement « glitch » d'entrée
- Opacité 100 / 0 / 100 / 0 / 100 sur 5 images consécutives (keyframes hold), puis fixe.
- Usage : entrée d'une nouvelle voix ou d'un nouveau chapitre.

### R15 — Révélation lettre par lettre en fondu
- After Effects : Text Animator (Opacity 0 %), Range Selector en mode caractères, Offset animé ; ou Text Animator « Fade Up Characters » réglé avec un étalement d'environ 2 images par lettre et une rampe de 4 images.
- Durée totale ≈ 0,35–0,4 s pour 6 lettres.
- Serif italique, plus grand que les lignes précédentes.

### R16 — Mix final
1. Voix : passe-haut 80 Hz, compresseur environ 4:1 (gain reduction 6–10 dB), de-esser, puis légère présence vers 3–5 kHz [EST].
2. Musique : −20 à −25 dB sous la voix ; si possible, l'élargir dans le champ stéréo (ou la placer en Side via un M/S EQ qui creuse le centre).
3. SFX : impacts et swishes en stéréo.
4. Bus master : limiteur avec un plafond à −1,0 dBTP (la vidéo source est à 0,0 ; −1 est plus sûr après l'encodage des plateformes), cible **−14 LUFS intégré**.

---

## 9. Checklist de conformité (à passer sur chaque V1)

- [ ] Uniquement des coupes franches.
- [ ] Sous-titres mot par mot, un seul mot-clé gras par phrase, le reste en serif italique.
- [ ] Aucun texte sur le visage, aucun texte incliné, aucune couleur sur la typographie.
- [ ] Hook de 10–13 s avec un contraste « avant / aujourd'hui » (noir → blanc) si le sujet s'y prête.
- [ ] Alternance face-cam / cartons / captures (≈ 55 / 30 / 15 %).
- [ ] Durée moyenne des plans ≈ 3 s.
- [ ] Au maximum 3 punch-ins de +19–22 %, chacun synchronisé avec un impact et décalé d'1 image après le mot.
- [ ] Environ 10 impacts sub au maximum, uniquement sur des chiffres, durées ou superlatifs.
- [ ] Swish uniquement sur les changements d'univers.
- [ ] Push-in lent sur les explications longues et sur l'appel à l'action.
- [ ] Musique à −20/−25 dB sous la voix ; mix final à −14 LUFS.
- [ ] Chaque action décrite par la voix est montrée à l'écran au même moment.

---

## 10. Pour la suite (non commencé, conformément à la consigne)

Pour reproduire ce style sur vos rushs, il faudra fournir :
1. **Rushs face-cam en 4K** (ou au moins en 1440p), caméra fixe, pour permettre les punch-ins à 120 %.
2. **Un enregistrement audio séparé** (micro-cravate ou micro main comme dans la vidéo), si possible.
3. **Les captures d'écran à illustrer**, en haute définition.
4. **Vos choix de polices** (Inter Tight + un serif italique) et un pack de SFX contenant au minimum 1 sub hit, 1 swish et 1 tapis musical d'ambiance.
5. **Un accès à un outil de transcription** au mot (Whisper ou équivalent), qui n'est pas disponible dans cet environnement, pour caler les sous-titres automatiquement.
