/*
 * À LANCER UNE SEULE FOIS : Fichier > Scripts > Parcourir… > Installer_Lanceur.jsx
 *
 * Ajoute « MDLL Lanceur » dans le menu Fichier > Scripts de Photoshop.
 * (Un petit fichier relais est copié dans le dossier Presets/Scripts de Photoshop ;
 *  il pointe vers ce dossier, vous pouvez donc continuer à modifier vos scripts ici.)
 * Redémarrez Photoshop après l'installation.
 */

#target photoshop

(function () {
    var here = File($.fileName).parent;
    var launcher = new File(here.fsName + "/Lanceur_Scripts.jsx");
    if (!launcher.exists) { alert("Lanceur_Scripts.jsx introuvable à côté de ce fichier."); return; }

    // Mémorise le dossier pour le lanceur
    var pref = new File(Folder.userData.fsName + "/MDLL_Lanceur_dossier.txt");
    pref.encoding = "UTF-8"; pref.open("w"); pref.write(here.fsName); pref.close();

    var relay = "#target photoshop\n" +
        "// Relais vers le lanceur MDLL (généré par Installer_Lanceur.jsx)\n" +
        "$.evalFile(new File(" + launcher.fsName.toSource() + "));\n";

    var destDir = new Folder(app.path.fsName + "/" + localize("$$$/ScriptingSupport/InstalledScripts=Presets/Scripts"));
    if (!destDir.exists) { destDir = new Folder(app.path.fsName + "/Presets/Scripts"); }
    var dest = new File(destDir.fsName + "/MDLL Lanceur.jsx");

    dest.encoding = "UTF-8";
    if (dest.open("w")) {
        dest.write(relay); dest.close();
        alert("Installé !\nRedémarrez Photoshop : le lanceur apparaîtra dans\nFichier > Scripts > MDLL Lanceur.\n\nAstuce : Édition > Raccourcis clavier pour lui attribuer un raccourci.");
    } else {
        alert("Photoshop n'a pas les droits d'écriture dans :\n" + destDir.fsName +
              "\n\nSolution : copiez à la main le fichier « Lanceur_Scripts.jsx » dans ce dossier\n" +
              "(ou lancez-le via Fichier > Scripts > Parcourir…).");
    }
})();
