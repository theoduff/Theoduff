/*
 * MDLL — LANCEUR DE SCRIPTS PHOTOSHOP
 * ------------------------------------
 * Affiche tous les scripts (.jsx) du dossier « scripts » et les lance en un clic.
 *
 * Pour AJOUTER un script : déposez simplement un fichier .jsx dans « photoshop/scripts ».
 * Il apparaît automatiquement dans le lanceur. (Ligne « @description ... » en
 * commentaire en haut du fichier = texte d'aide affiché dans la liste.)
 *
 * Les scripts lancés reçoivent la variable globale MDLL_ROOT (= dossier « photoshop »)
 * pour retrouver la config, la bibliothèque et les images.
 */

#target photoshop

(function () {
    var PREF = new File(Folder.userData.fsName + "/MDLL_Lanceur_dossier.txt");

    function isRoot(folder) { return folder && folder.exists && new Folder(folder.fsName + "/scripts").exists; }

    function readPref() {
        if (!PREF.exists) { return null; }
        PREF.encoding = "UTF-8"; PREF.open("r"); var p = PREF.read(); PREF.close();
        var f = new Folder(p.replace(/[\r\n]+$/, ""));
        return isRoot(f) ? f : null;
    }
    function writePref(folder) {
        PREF.encoding = "UTF-8"; PREF.open("w"); PREF.write(folder.fsName); PREF.close();
    }
    function askRoot() {
        var f = Folder.selectDialog("Sélectionnez le dossier « photoshop » du projet (celui qui contient « scripts »)");
        if (!f) { return null; }
        if (!isRoot(f)) { alert("Ce dossier ne contient pas de sous-dossier « scripts »."); return null; }
        writePref(f);
        return f;
    }

    // 1. dossier du lanceur lui-même, 2. dossier mémorisé, 3. on demande
    var here = File($.fileName).parent;
    var ROOT = isRoot(here) ? here : (readPref() || askRoot());
    if (!ROOT) { return; }
    if (isRoot(here)) { writePref(here); }

    function description(file) {
        file.encoding = "UTF-8";
        if (!file.open("r")) { return ""; }
        var txt = file.read(2000); file.close();
        var m = txt.match(/@description\s+([^\r\n]+)/);
        return m ? m[1] : "";
    }

    function listScripts() {
        var files = new Folder(ROOT.fsName + "/scripts").getFiles(function (f) { return f instanceof File && /\.(jsx|js)$/i.test(f.name); });
        files.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
        return files;
    }

    var w = new Window("dialog", "Maison de la Literie — Lanceur de scripts");
    w.alignChildren = "fill";
    w.add("statictext", undefined, "Dossier : " + ROOT.fsName);
    var lb = w.add("listbox", [0, 0, 560, 220], [], { numberOfColumns: 1 });
    var info = w.add("statictext", [0, 0, 560, 44], "", { multiline: true });
    var scripts = [];

    function refresh() {
        lb.removeAll();
        scripts = listScripts();
        for (var i = 0; i < scripts.length; i++) {
            lb.add("item", decodeURI(scripts[i].name).replace(/\.(jsx|js)$/i, "").replace(/_/g, " "));
        }
        if (scripts.length) { lb.selection = 0; }
    }
    lb.onChange = function () { info.text = lb.selection ? description(scripts[lb.selection.index]) : ""; };
    lb.onDoubleClick = function () { w.close(1); };

    var row = w.add("group");
    var bFolder = row.add("button", undefined, "Ouvrir le dossier des scripts");
    var bRefresh = row.add("button", undefined, "Actualiser");
    var bChange = row.add("button", undefined, "Changer de dossier…");
    bFolder.onClick = function () { new Folder(ROOT.fsName + "/scripts").execute(); };
    bRefresh.onClick = function () { refresh(); lb.onChange(); };
    bChange.onClick = function () { var f = askRoot(); if (f) { ROOT = f; refresh(); lb.onChange(); } };

    var bt = w.add("group"); bt.alignment = "right";
    bt.add("button", undefined, "Fermer", { name: "cancel" });
    bt.add("button", undefined, "Lancer", { name: "ok" });

    refresh(); lb.onChange();
    if (w.show() !== 1 || !lb.selection) { return; }

    var target = scripts[lb.selection.index];
    $.global.MDLL_ROOT = ROOT.fsName;
    try {
        $.evalFile(target);
    } catch (e) {
        alert("Erreur dans « " + decodeURI(target.name) + " » :\n" + e + (e.line ? "\n(ligne " + e.line + ")" : ""));
    }
})();
