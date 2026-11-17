/*
 * ============================================================================
 *  CALENDRIER DE L'AVENT 2026 — MAISON DE LA LITERIE
 *  Fichier de configuration (textes, couleurs, typos, mise en page)
 * ============================================================================
 *
 *  C'est LE fichier à modifier pour faire évoluer les créas sans toucher au code :
 *    - les textes de chaque semaine (cadeau, valeur, date…)
 *    - les couleurs de fond de chaque semaine
 *    - les typographies (noms PostScript Photoshop)
 *    - les positions des éléments (en pixels)
 *
 *  Ce fichier est lu à la fois par le script Photoshop ET par l'aperçu HTML
 *  (dossier /preview). Il doit donc rester en JavaScript "simple" :
 *  pas de virgule après le dernier élément d'une liste ou d'un objet.
 * ============================================================================
 */

var AVENT_CONFIG = {

    campagne: "Calendrier de l'Avent 2026",

    /* ------------------------------------------------------------------
     * TYPOGRAPHIES
     * Photoshop attend le nom PostScript de la police.
     * Pour le trouver : sélectionner un calque texte avec la police voulue,
     * puis Fichier > Scripts > Lanceur > "00_Nom_PostScript_Police".
     * Les polices par défaut (Playfair Display + Quicksand) sont gratuites
     * sur Adobe Fonts et Google Fonts. Si une police est absente, le script
     * prévient et utilise la police de secours.
     * ------------------------------------------------------------------ */
    polices: {
        titre:        "PlayfairDisplay-Regular",
        titreItalique: "PlayfairDisplay-Italic",
        texte:        "Quicksand-Regular",
        texteMedium:  "Quicksand-Medium",
        texteGras:    "Quicksand-Bold",
        secours:      "MyriadPro-Regular",
        secoursSerif: "MinionPro-Regular"
    },
    /* Équivalents CSS utilisés uniquement par l'aperçu HTML */
    policesCss: {
        titre: "'Playfair Display', serif",
        texte: "'Quicksand', sans-serif"
    },

    /* ------------------------------------------------------------------
     * COULEURS COMMUNES
     * ------------------------------------------------------------------ */
    couleurs: {
        creme: "#F6ECDD",
        or:    "#D8B878",
        orClair: "#F1DDAE",
        ombre: "#0B0606"
    },

    /* ------------------------------------------------------------------
     * TEXTES COMMUNS AUX 4 SEMAINES
     * ------------------------------------------------------------------ */
    textes: {
        surtitre:  "CALENDRIER DE L'AVENT",
        titre1:    "Nuits douces",
        titre2:    "de Noël",
        accroche:  "Tentez de gagner",
        logo:      "MAISON DE LA LITERIE",
        storyCta:  "Participez sur notre publication"
    },

    /* ------------------------------------------------------------------
     * LES 4 SEMAINES (montée en gamme)
     *  fond / fondClair : couleur de fond et couleur de l'arche
     *  image            : fichier dans photoshop/assets/produits/
     *  produitEchelle   : 1 = taille max de la zone produit
     *  produitDecalageY : décalage vertical du produit (px, + = vers le bas)
     *
     *  Astuce : pour une série 100 % rouge Maison de la Literie, mettre
     *  fond "#8E1B2A" et fondClair "#A52A3A" sur les 4 semaines.
     * ------------------------------------------------------------------ */
    semaines: [
        {
            numero: 1,
            fichier: "MDLL_Avent2026_S1_Oreillers",
            surtitre: "",
            jour: "04",
            mois: "DÉC.",
            tirage: "Tirage au sort le vendredi 4 décembre",
            cadeau: "2 oreillers moelleux",
            details: "Synthétiques médium · 65 x 65 cm",
            valeur: "Valeur 110 € TTC",
            image: "semaine-1_oreillers.png",
            fond: "#1F3D31",
            fondClair: "#2D5544",
            produitEchelle: 0.86,
            produitDecalageY: 0
        },
        {
            numero: 2,
            fichier: "MDLL_Avent2026_S2_Couette",
            surtitre: "",
            jour: "11",
            mois: "DÉC.",
            tirage: "Tirage au sort le vendredi 11 décembre",
            cadeau: "1 couette douillette",
            details: "Grand format · 260 x 240 cm",
            valeur: "Valeur 195 € TTC",
            image: "semaine-2_couette.png",
            fond: "#1B2A44",
            fondClair: "#283D61",
            produitEchelle: 0.92,
            produitDecalageY: 10
        },
        {
            numero: 3,
            fichier: "MDLL_Avent2026_S3_Parure",
            surtitre: "",
            jour: "18",
            mois: "DÉC.",
            tirage: "Tirage au sort le vendredi 18 décembre",
            cadeau: "1 parure de lit complète",
            details: "Housse de couette 260 x 240 cm + 2 taies 65 x 65 cm",
            valeur: "Valeur 189 € TTC",
            image: "semaine-3_parure.png",
            fond: "#4E1830",
            fondClair: "#6A2442",
            produitEchelle: 1,
            produitDecalageY: 0
        },
        {
            numero: 4,
            fichier: "MDLL_Avent2026_S4_Ensemble_Literie",
            surtitre: "LE GRAND FINAL",
            jour: "24",
            mois: "DÉC.",
            tirage: "Tirage au sort le jeudi 24 décembre",
            cadeau: "1 ensemble de literie",
            details: "Matelas Ciry + sommier Somflex + pieds chêne · 140 x 190",
            valeur: "Valeur 1 560 € TTC",
            image: "semaine-4_ensemble-literie.png",
            fond: "#8A1A29",
            fondClair: "#A62A3A",
            produitEchelle: 1,
            produitDecalageY: 0
        }
    ],

    /* ------------------------------------------------------------------
     * MISE EN PAGE (pixels). y = ligne de base des textes.
     * ------------------------------------------------------------------ */
    formats: {
        feed: {
            nom: "Feed",
            largeur: 1080,
            hauteur: 1350,
            cadre:    { marge: 34, rayon: 28, epaisseur: 2 },
            halo:     { cx: 540, cy: 640, rx: 620, ry: 520, opacite: 38 },
            surtitre: { y: 112, taille: 22, approche: 380 },
            titre1:   { y: 200, taille: 86 },
            titre2:   { y: 278, taille: 72 },
            arche:    { x: 250, y: 372, l: 580, h: 628, epaisseur: 3 },
            pastille: { cy: 372, r: 62, tailleJour: 40, tailleMois: 15 },
            produit:  { cx: 540, cy: 752, lMax: 760, hMax: 430 },
            ombreProduit: { cx: 540, cy: 925, rx: 300, ry: 26, opacite: 55 },
            accroche: { y: 1072, taille: 34, approche: 20 },
            cadeau:   { y: 1146, taille: 60 },
            details:  { y: 1192, taille: 20, approche: 40 },
            valeur:   { y: 1246, taille: 19, approche: 140, hauteur: 42, padding: 26 },
            logo:     { y: 1306, taille: 20, approche: 260 },
            cta:      null,
            etincelles: [
                [150, 120, 26], [930, 100, 18], [118, 520, 16], [972, 470, 30],
                [182, 860, 22], [905, 910, 16], [88, 1150, 14], [990, 1180, 20],
                [845, 330, 12], [235, 300, 12]
            ],
            neige: { nombre: 70, rMin: 1.5, rMax: 4.5, graine: 2026 }
        },
        story: {
            nom: "Story",
            largeur: 1080,
            hauteur: 1920,
            cadre:    { marge: 34, rayon: 28, epaisseur: 2 },
            halo:     { cx: 540, cy: 900, rx: 700, ry: 700, opacite: 38 },
            surtitre: { y: 298, taille: 24, approche: 380 },
            titre1:   { y: 404, taille: 96 },
            titre2:   { y: 496, taille: 82 },
            arche:    { x: 220, y: 590, l: 640, h: 720, epaisseur: 3 },
            pastille: { cy: 590, r: 68, tailleJour: 44, tailleMois: 16 },
            produit:  { cx: 540, cy: 1010, lMax: 820, hMax: 480 },
            ombreProduit: { cx: 540, cy: 1212, rx: 320, ry: 28, opacite: 55 },
            accroche: { y: 1410, taille: 38, approche: 20 },
            cadeau:   { y: 1492, taille: 66 },
            details:  { y: 1544, taille: 22, approche: 40 },
            valeur:   { y: 1608, taille: 21, approche: 140, hauteur: 46, padding: 28 },
            logo:     { y: 196, taille: 22, approche: 260 },
            cta:      { y: 1700, taille: 24, approche: 40 },
            etincelles: [
                [150, 330, 26], [930, 300, 20], [110, 760, 18], [975, 700, 32],
                [170, 1180, 22], [915, 1240, 18], [92, 1560, 16], [985, 1600, 22],
                [860, 540, 12], [225, 500, 12], [540, 1800, 14]
            ],
            neige: { nombre: 100, rMin: 1.5, rMax: 4.5, graine: 1224 }
        }
    }
};

/* Génère les flocons de façon reproductible (même résultat dans Photoshop et dans l'aperçu). */
function AVENT_flocons(fmt) {
    var n = fmt.neige, seed = n.graine, out = [], i;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (i = 0; i < n.nombre; i++) {
        var x = 60 + rnd() * (fmt.largeur - 120);
        var y = 60 + rnd() * (fmt.hauteur - 120);
        var r = n.rMin + rnd() * (n.rMax - n.rMin);
        /* on évite la zone centrale (arche + textes) pour garder le visuel épuré */
        var a = fmt.arche;
        var dansArche = x > a.x - 40 && x < a.x + a.l + 40 && y > a.y - 80 && y < a.y + a.h + 40;
        var dansTextes = x > 170 && x < fmt.largeur - 170 && (y < a.y || y > a.y + a.h);
        if (!dansArche && !dansTextes) { out.push([x, y, r]); }
    }
    return out;
}
