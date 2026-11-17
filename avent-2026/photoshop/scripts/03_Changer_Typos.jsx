/*
 * @description Remplace une police par une autre dans TOUS les documents ouverts (en une fois).
 */

#target photoshop

(function () {
    if (!app.documents.length) { alert("Ouvrez d'abord les PSD à modifier."); return; }

    /* 1. Inventaire des polices utilisées dans les documents ouverts */
    var used = {}, list = [];
    function scan(layers, cb) {
        for (var i = 0; i < layers.length; i++) {
            var l = layers[i];
            if (l.typename === "LayerSet") { scan(l.layers, cb); }
            else if (l.kind === LayerKind.TEXT) { cb(l); }
        }
    }
    var d, i;
    for (d = 0; d < app.documents.length; d++) {
        scan(app.documents[d].layers, function (l) {
            var f = l.textItem.font;
            if (!used[f]) { used[f] = 0; list.push(f); }
            used[f]++;
        });
    }
    if (!list.length) { alert("Aucun calque texte trouvé."); return; }

    /* 2. Liste des polices installées */
    var installed = [];
    for (i = 0; i < app.fonts.length; i++) {
        installed.push({ ps: app.fonts[i].postScriptName, label: app.fonts[i].family + " — " + app.fonts[i].style });
    }

    var w = new Window("dialog", "Changer de typographie");
    w.alignChildren = "fill";
    w.add("statictext", undefined, "1. Police à remplacer (dans " + app.documents.length + " document(s)) :");
    var ddFrom = w.add("dropdownlist", undefined, []);
    for (i = 0; i < list.length; i++) { ddFrom.add("item", list[i] + "   (" + used[list[i]] + " calque(s))"); }
    ddFrom.selection = 0;

    w.add("statictext", undefined, "2. Nouvelle police — tapez quelques lettres pour filtrer :");
    var search = w.add("edittext", undefined, "");
    var lb = w.add("listbox", [0, 0, 460, 260], []);
    function fill(q) {
        lb.removeAll();
        q = q.toLowerCase();
        var c = 0;
        for (var k = 0; k < installed.length && c < 400; k++) {
            if (!q || installed[k].label.toLowerCase().indexOf(q) >= 0 || installed[k].ps.toLowerCase().indexOf(q) >= 0) {
                var it = lb.add("item", installed[k].label);
                it.ps = installed[k].ps;
                c++;
            }
        }
    }
    fill("");
    search.onChanging = function () { fill(search.text); };

    var bt = w.add("group"); bt.alignment = "right";
    bt.add("button", undefined, "Annuler", { name: "cancel" });
    bt.add("button", undefined, "Remplacer", { name: "ok" });
    if (w.show() !== 1) { return; }
    if (!lb.selection) { alert("Aucune nouvelle police sélectionnée."); return; }

    var from = list[ddFrom.selection.index], to = lb.selection.ps, n = 0;
    for (d = 0; d < app.documents.length; d++) {
        app.activeDocument = app.documents[d];
        scan(app.documents[d].layers, function (l) {
            if (l.textItem.font === from) { l.textItem.font = to; n++; }
        });
    }
    alert(n + " calque(s) texte passé(s) de\n" + from + "\nà\n" + to);
})();
