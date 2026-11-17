/*
 * @description Exporte les visuels (documents ouverts ou PSD de « sorties/psd ») en JPG/PNG sRGB prêts pour Instagram.
 */

#target photoshop

(function () {
    var ROOT = (typeof MDLL_ROOT !== "undefined" && MDLL_ROOT) ? new Folder(MDLL_ROOT) : File($.fileName).parent.parent;
    var PSD_DIR = new Folder(ROOT.parent.fsName + "/sorties/psd");
    var OUT_DIR = new Folder(ROOT.parent.fsName + "/sorties/export");

    var w = new Window("dialog", "Exporter pour Instagram");
    w.alignChildren = "fill";
    var pSrc = w.add("panel", undefined, "Source");
    pSrc.alignChildren = "left";
    var rOpen = pSrc.add("radiobutton", undefined, "Documents ouverts (" + app.documents.length + ")");
    var rDir = pSrc.add("radiobutton", undefined, "Tous les PSD du dossier « sorties/psd »");
    if (app.documents.length) { rOpen.value = true; } else { rDir.value = true; }

    var pFmt = w.add("panel", undefined, "Format");
    pFmt.orientation = "row";
    var cJpg = pFmt.add("checkbox", undefined, "JPG (qualité max)"); cJpg.value = true;
    var cPng = pFmt.add("checkbox", undefined, "PNG"); cPng.value = false;

    var bt = w.add("group"); bt.alignment = "right";
    bt.add("button", undefined, "Annuler", { name: "cancel" });
    bt.add("button", undefined, "Exporter", { name: "ok" });
    if (w.show() !== 1) { return; }

    if (!OUT_DIR.exists) { new Folder(ROOT.parent.fsName + "/sorties").create(); OUT_DIR.create(); }

    function baseName(doc) { return doc.name.replace(/\.[^\.]+$/, ""); }

    function exportDoc(doc) {
        var dup = doc.duplicate(baseName(doc) + "_export", true); // aplati
        try { dup.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, false); } catch (e) {}
        if (cJpg.value) {
            var j = new JPEGSaveOptions();
            j.quality = 12; j.embedColorProfile = true; j.formatOptions = FormatOptions.STANDARDBASELINE;
            dup.saveAs(new File(OUT_DIR.fsName + "/" + baseName(doc) + ".jpg"), j, true, Extension.LOWERCASE);
        }
        if (cPng.value) {
            var p = new PNGSaveOptions();
            p.compression = 6; p.interlaced = false;
            dup.saveAs(new File(OUT_DIR.fsName + "/" + baseName(doc) + ".png"), p, true, Extension.LOWERCASE);
        }
        dup.close(SaveOptions.DONOTSAVECHANGES);
    }

    var n = 0, i;
    if (rOpen.value) {
        var docs = [];
        for (i = 0; i < app.documents.length; i++) { docs.push(app.documents[i]); }
        for (i = 0; i < docs.length; i++) { app.activeDocument = docs[i]; exportDoc(docs[i]); n++; }
    } else {
        var files = PSD_DIR.exists ? PSD_DIR.getFiles("*.psd") : [];
        for (i = 0; i < files.length; i++) {
            var d = app.open(files[i]);
            exportDoc(d);
            d.close(SaveOptions.DONOTSAVECHANGES);
            n++;
        }
    }
    alert(n + " visuel(s) exporté(s) dans :\n" + OUT_DIR.fsName);
})();
