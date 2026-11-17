# Planning Instagram — 23 au 30 novembre 2026 · PSD

22 fichiers PSD avec calques, nommés `date_TYPE_heure_sujet.psd`. Pour chaque fichier, un aperçu JPG est dans `apercus/`.

| Jour | Fichier | Contenu |
|---|---|---|
| Lun 23 | POST_Notification-chargeur | Écran verrouillé avec 2 notifications : « Téléphone : 100 % » et « Vous : rechargé grâce à Onéa » |
| Lun 23 | STORY_Proposition-sondage-batterie | **Proposition**, puisque les stories du jour sont à confirmer : sondage « 100 % ou 12 % le matin ? » |
| Mar 24 | STORY_08h_Citation | Citation + zone pour la boîte à questions « Qui est dans ce cas-là ? » |
| Mar 24 | STORY_12h_Sommier-Onea | Sommier Onéa + zone pour le lien vers /sommiers |
| Mar 24 | STORY_18h_La-solution | Les 3 conseils + la source |
| Mer 25 | STORY_08h_Boite-a-questions-literie-ideale | Boîte à questions |
| Mer 25 | STORY_12h_Video-tete-de-lit | Habillage à poser sur la vidéo (emplacement vidéo en fond) |
| Mer 25 | POST_Vous-nous-dites-Notre-solution-Onea | 2 colonnes, 5 besoins → 5 matelas |
| Jeu 26 | STORY_08h_Quiz-1-Indices / Quiz-2-Vote | Indices, puis slide de vote (zone pour le sticker quiz) |
| Jeu 26 | STORY_18h_Quiz-3-Reponse | « C'était le Marcilly ! » |
| Ven 27 | STORY_12h_Black-November | Modèle d'opération : remise et offre **à compléter** |
| Ven 27 | STORY_18h_Avis-client | Modèle : avis **à coller** (un vrai avis client) |
| Sam 28 | STORY_10h_Trafic-magasin | Habillage vidéo « Est-ce que ce serait pas le moment… » |
| Dim 29 | POST_Fausse-notification-dimanche | Rappel · Dimanche 20h + bouton « Bonne nuit » |
| Lun 30 | STORY_08h_Boite-a-questions-saison | Boîte à questions |
| Lun 30 | STORY_12h_Black-November | Modèle d'opération, variante |
| Lun 30 | POST_Carrousel-Hiver-01 à 05 | Carrousel « L'hiver comme on l'aime » (5 slides) |

Contenus sans visuel à créer : ven 27 à 8h (créneau à confirmer) et dim 29 à 10h (repartage d'un post).

## Dans chaque PSD
- **Groupes numérotés** (fond, contenu, textes…), avec des calques texte modifiables et des formes vectorielles. Un double-clic sur la vignette d'une forme change sa couleur.
- **Groupe `00 · REPÈRES` (masqué) :** il montre en rose où poser les stickers Instagram (sondage, quiz, boîte à questions, lien). Rendez-le visible pour placer les stickers, puis masquez-le avant l'export.
- **Polices :** Playfair Display, Quicksand et Inter (Adobe Fonts / Google Fonts). Installez-les avant d'ouvrir les fichiers, puis acceptez la **mise à jour des calques texte** si Photoshop la propose.

## À remplacer avant publication
- **Packshots :** les calques « PRODUIT (à remplacer) » sont provisoires et en basse définition. Le même visuel de matelas sert pour Marcilly, Beaulieu, Flavigny, Charmoy, Ciry et le sommier.
  Clic droit › *Convertir en objet dynamique*, puis *Remplacer le contenu*.
- **Photo d'ambiance :** carrousel hiver, slide 2.
- **Vidéos :** stories 25/11 12h et 28/11 10h. Le PSD sert d'habillage : placez la vidéo dessous, ou exportez l'habillage en PNG sans le calque vidéo.
- **Black November :** la remise « -XX % », l'offre et les dates.
- **Avis client :** le texte, le prénom et la plateforme d'un vrai avis.
- **Logo :** le texte « MAISON DE LA LITERIE » est provisoire. Remplacez-le par le logo officiel.

## Régénérer
`cd generator && npm install && node generate.js`. Les textes et la mise en page sont dans `generator/visuals.js`.
