/*
 * @description Affiche le nom PostScript de la police du calque texte sélectionné (à copier dans le fichier config).
 */

#target photoshop

(function () {
    if (!app.documents.length) { alert("Aucun document ouvert."); return; }
    var l = app.activeDocument.activeLayer;
    if (l.typename !== "ArtLayer" || l.kind !== LayerKind.TEXT) {
        alert("Sélectionnez un calque texte dans le panneau Calques.");
        return;
    }
    var ps = l.textItem.font, label = ps;
    try { var f = app.fonts.getByName(ps); label = f.family + " — " + f.style; } catch (e) {}
    prompt("Police : " + label + "\nNom PostScript (à copier dans config/avent2026.config.jsx) :", ps);
})();
