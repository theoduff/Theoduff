/*
 * @description Génère les 8 visuels du Calendrier de l'Avent 2026 (4 feed + 4 stories) en PSD calques.
 *
 * MAISON DE LA LITERIE — Calendrier de l'Avent 2026
 * --------------------------------------------------
 * Crée des PSD 100 % modifiables :
 *   - textes = calques texte (changer la typo / le texte librement)
 *   - formes = calques de forme vectoriels (double-clic = changer la couleur)
 *   - produit = objet dynamique (clic droit > Remplacer le contenu)
 *   - effets = styles de calque (contour, lueur)
 *
 * Les textes, couleurs, typos et positions se règlent dans :
 *   photoshop/config/avent2026.config.jsx
 */

#target photoshop

(function () {

    /* ------------------------------------------------------------ */
    /*  Localisation des fichiers                                    */
    /* ------------------------------------------------------------ */
    var ROOT = (typeof MDLL_ROOT !== "undefined" && MDLL_ROOT) ? new Folder(MDLL_ROOT) : File($.fileName).parent.parent;
    var LIB = new File(ROOT.fsName + "/lib/mdll_helpers.jsx");
    var CFG = new File(ROOT.fsName + "/config/avent2026.config.jsx");
    if (!LIB.exists || !CFG.exists) {
        alert("Fichiers introuvables.\nLe script doit rester dans le dossier « photoshop/scripts ».\n\nCherché dans : " + ROOT.fsName);
        return;
    }
    $.evalFile(LIB);
    $.evalFile(CFG);

    var C = AVENT_CONFIG, M = MDLL;
    var ASSETS = ROOT.fsName + "/assets";
    var OUT = ROOT.parent.fsName + "/sorties/psd";

    /* ------------------------------------------------------------ */
    /*  Boîte de dialogue                                            */
    /* ------------------------------------------------------------ */
    var w = new Window("dialog", "Calendrier de l'Avent 2026 — Maison de la Literie");
    w.orientation = "column"; w.alignChildren = "fill";

    var pS = w.add("panel", undefined, "Semaines");
    pS.orientation = "row";
    var cbS = [];
    for (var i = 0; i < C.semaines.length; i++) {
        cbS.push(pS.add("checkbox", undefined, "S" + C.semaines[i].numero + " · " + C.semaines[i].jour + " déc."));
        cbS[i].value = true;
    }

    var pF = w.add("panel", undefined, "Formats");
    pF.orientation = "row";
    var cbFeed = pF.add("checkbox", undefined, "Feed 1080 x 1350"); cbFeed.value = true;
    var cbStory = pF.add("checkbox", undefined, "Story 1080 x 1920"); cbStory.value = true;

    var pO = w.add("panel", undefined, "Options");
    pO.alignChildren = "left";
    var cbSave = pO.add("checkbox", undefined, "Enregistrer les PSD dans « sorties/psd »"); cbSave.value = true;
    var cbClose = pO.add("checkbox", undefined, "Fermer les documents après enregistrement"); cbClose.value = false;
    var cbGuides = pO.add("checkbox", undefined, "Ajouter les repères de zones de sécurité (stories)"); cbGuides.value = true;

    var bt = w.add("group"); bt.alignment = "right";
    bt.add("button", undefined, "Annuler", { name: "cancel" });
    bt.add("button", undefined, "Générer", { name: "ok" });
    if (w.show() !== 1) { return; }

    var formats = [];
    if (cbFeed.value) { formats.push("feed"); }
    if (cbStory.value) { formats.push("story"); }

    /* ------------------------------------------------------------ */
    /*  Construction d'un visuel                                     */
    /* ------------------------------------------------------------ */
    function build(fmtKey, S) {
        var F = C.formats[fmtKey], col = C.couleurs, T = C.textes, P = C.polices;
        var W = F.largeur, H = F.hauteur, cx = W / 2;

        var fTitre = M.font(P.titre, P.secoursSerif);
        var fTitreIt = M.font(P.titreItalique, P.secoursSerif);
        var fTexte = M.font(P.texte, P.secours);
        var fMedium = M.font(P.texteMedium, P.secours);
        var fGras = M.font(P.texteGras, P.secours);

        var doc = M.newDoc(S.fichier + "_" + F.nom, W, H);
        var first = doc.layers[0];

        // Groupes (créés du bas vers le haut)
        var gFond = M.group(doc, "01 · FOND");
        var gDecor = M.group(doc, "02 · DÉCOR (neige, étincelles, cadre)");
        var gPorte = M.group(doc, "03 · PORTE DU CALENDRIER");
        var gProduit = M.group(doc, "04 · PRODUIT");
        var gDate = M.group(doc, "05 · PASTILLE DATE");
        var gTextes = M.group(doc, "06 · TEXTES");
        try { first.remove(); } catch (e) {}

        /* ---- FOND ---- */
        M.solidLayer(doc, "Fond — couleur semaine " + S.numero, S.fond, gFond);
        var hl = F.halo;
        M.softEllipse(doc, "Halo lumineux", S.fondClair, hl.cx, hl.cy, hl.rx, hl.ry, 140, Math.min(100, hl.opacite * 2), gFond);

        /* ---- DÉCOR ---- */
        var fl = AVENT_flocons(F), sub = [], k;
        for (k = 0; k < fl.length; k++) { sub.push(M.pathCircle(fl[k][0], fl[k][1], fl[k][2])); }
        var neige = M.shape(doc, "Neige", col.creme, sub, gDecor);
        neige.opacity = 55;

        sub = [];
        for (k = 0; k < F.etincelles.length; k++) { sub.push(M.pathStar4(F.etincelles[k][0], F.etincelles[k][1], F.etincelles[k][2])); }
        var et = M.shape(doc, "Étincelles dorées", col.orClair, sub, gDecor);
        M.fx(doc, et, { glow: { hex: col.or, size: 16, opacity: 70 } });

        var m = F.cadre.marge;
        M.outline(doc, "Cadre doré", col.or, F.cadre.epaisseur,
            [M.pathRoundRect(m, m, W - 2 * m, H - 2 * m, F.cadre.rayon)], 75, gDecor);

        /* ---- PORTE (arche) ---- */
        var A = F.arche;
        var arche = M.shape(doc, "Arche — fond", S.fondClair, [M.pathArch(A.x, A.y, A.l, A.h)], gPorte);
        var lueur = M.softEllipse(doc, "Arche — lueur intérieure", col.creme,
            A.x + A.l / 2, A.y + A.h * 0.45, A.l * 0.55, A.h * 0.4, 90, 22, gPorte);
        try { lueur.grouped = true; } catch (e1) {} // masque d'écrêtage sur l'arche
        M.outline(doc, "Arche — contour doré", col.or, A.epaisseur, [M.pathArch(A.x, A.y, A.l, A.h)], 100, gPorte);
        M.outline(doc, "Arche — filet intérieur", col.or, 1, [M.pathArch(A.x + 14, A.y + 14, A.l - 28, A.h - 28)], 50, gPorte);

        /* ---- PRODUIT ---- */
        var O = F.ombreProduit, dy = S.produitDecalageY || 0;
        M.softEllipse(doc, "Ombre portée produit", col.ombre, O.cx, O.cy + dy, O.rx, O.ry, 18, O.opacite, gProduit);
        var Pr = F.produit, img = new File(ASSETS + "/produits/" + S.image);
        if (img.exists) {
            M.placeSmart(doc, img, "PRODUIT — clic droit > Remplacer le contenu", Pr.cx, Pr.cy + dy,
                Pr.lMax * S.produitEchelle, Pr.hMax * S.produitEchelle, gProduit);
        } else {
            var ph = M.shape(doc, "PRODUIT — à remplacer (" + S.image + ")", col.creme,
                [M.pathRoundRect(Pr.cx - 220, Pr.cy - 150, 440, 300, 24)], gProduit);
            ph.opacity = 35;
            M.log("Image produit absente : assets/produits/" + S.image);
        }

        /* ---- PASTILLE DATE ---- */
        var B = F.pastille, bx = A.x + A.l / 2;
        M.shape(doc, "Pastille — découpe", S.fond, [M.pathCircle(bx, B.cy, B.r + 8)], gDate);
        M.shape(doc, "Pastille — or", col.or, [M.pathCircle(bx, B.cy, B.r)], gDate);
        M.outline(doc, "Pastille — anneau", S.fond, 1, [M.pathCircle(bx, B.cy, B.r - 6)], 45, gDate);
        var yJour = B.cy + B.tailleJour * 0.22;
        M.text(doc, "Date — jour", S.jour, bx, yJour, fGras, B.tailleJour, S.fond, { tracking: 20 }, gDate);
        M.text(doc, "Date — mois", S.mois, bx, yJour + B.tailleMois * 1.5, fGras, B.tailleMois, S.fond, { tracking: 200 }, gDate);

        /* ---- TEXTES ---- */
        var logoFile = new File(ASSETS + "/logo/logo.png");
        var L = F.logo;
        if (logoFile.exists) {
            M.placeSmart(doc, logoFile, "Logo Maison de la Literie", cx, L.y - L.taille * 0.35, 420, L.taille * 2.2, gTextes);
        } else {
            M.text(doc, "Logo (texte provisoire)", T.logo, cx, L.y, fGras, L.taille, col.creme, { tracking: L.approche }, gTextes);
        }
        M.text(doc, "Surtitre", S.surtitre || T.surtitre, cx, F.surtitre.y, fMedium, F.surtitre.taille, col.or, { tracking: F.surtitre.approche }, gTextes);
        M.text(doc, "Titre ligne 1", T.titre1, cx, F.titre1.y, fTitre, F.titre1.taille, col.creme, {}, gTextes);
        M.text(doc, "Titre ligne 2", T.titre2, cx, F.titre2.y, fTitreIt, F.titre2.taille, col.creme, {}, gTextes);
        M.text(doc, "Accroche", T.accroche, cx, F.accroche.y, fTexte, F.accroche.taille, col.creme, { tracking: F.accroche.approche }, gTextes);
        M.text(doc, "Cadeau", S.cadeau, cx, F.cadeau.y, fTitreIt, F.cadeau.taille, col.creme, {}, gTextes);
        M.text(doc, "Détails produit", S.details, cx, F.details.y, fMedium, F.details.taille, col.creme, { tracking: F.details.approche, opacity: 80 }, gTextes);

        // Pastille valeur : on crée le texte, on mesure, puis la forme dessous
        var V = F.valeur;
        var vt = M.text(doc, "Valeur — texte", S.valeur.toUpperCase(), cx, V.y, fGras, V.taille, S.fond, { tracking: V.approche }, gTextes);
        var vb = M.bounds(vt), vw = vb.w + 2 * V.padding, vcy = V.y - V.taille * 0.36;
        var pill = M.shape(doc, "Valeur — fond", col.or, [M.pathRoundRect(cx - vw / 2, vcy - V.hauteur / 2, vw, V.hauteur, V.hauteur / 2)], gTextes);
        try { pill.move(vt, ElementPlacement.PLACEAFTER); } catch (e2) {}

        if (F.cta) {
            M.text(doc, "Story — date du tirage", S.tirage, cx, F.cta.y, fMedium, F.cta.taille, col.creme, { tracking: F.cta.approche, opacity: 85 }, gTextes);
        }

        /* ---- Repères stories (zones masquées par l'interface Instagram) ---- */
        if (fmtKey === "story" && cbGuides.value) { M.guides(doc, [250, H - 250], []); }

        doc.activeLayer = gTextes;
        return doc;
    }

    /* ------------------------------------------------------------ */
    /*  Exécution                                                    */
    /* ------------------------------------------------------------ */
    M.pushPrefs();
    var made = 0;
    try {
        if (cbSave.value) { M.ensureFolder(ROOT.parent.fsName + "/sorties"); M.ensureFolder(OUT); }
        for (var s = 0; s < C.semaines.length; s++) {
            if (!cbS[s].value) { continue; }
            for (var f = 0; f < formats.length; f++) {
                var doc = build(formats[f], C.semaines[s]);
                made++;
                if (cbSave.value) {
                    M.savePSD(doc, new File(OUT + "/" + doc.name + ".psd"));
                    if (cbClose.value) { doc.close(SaveOptions.DONOTSAVECHANGES); }
                }
            }
        }
    } catch (err) {
        alert("Erreur pendant la génération :\n" + err + (err.line ? "\n(ligne " + err.line + ")" : ""));
    } finally {
        M.popPrefs();
    }

    /* ------------------------------------------------------------ */
    /*  Bilan                                                        */
    /* ------------------------------------------------------------ */
    var msg = made + " visuel(s) généré(s).";
    if (cbSave.value) { msg += "\nPSD enregistrés dans :\n" + OUT; }
    var miss = [];
    for (var fn in M.missingFonts) { if (M.missingFonts.hasOwnProperty(fn)) { miss.push(fn); } }
    if (miss.length) {
        msg += "\n\nPolices non installées (police de secours utilisée) :\n- " + miss.join("\n- ") +
               "\n→ Activez-les sur Adobe Fonts ou changez-les dans config/avent2026.config.jsx," +
               "\n   ou utilisez le script « 03_Changer_Typos ».";
    }
    if (M._log.length) { msg += "\n\nÀ vérifier :\n- " + M._log.join("\n- "); }
    alert(msg);

})();
