/*
 * MDLL — Bibliothèque de fonctions Photoshop (ExtendScript)
 * Utilisée par les scripts du dossier /scripts. Ne pas lancer directement.
 *
 * Toutes les coordonnées sont en pixels (documents créés à 72 ppp).
 */

var MDLL = MDLL || {};

(function (M) {

    function cID(s) { return charIDToTypeID(s); }
    function sID(s) { return stringIDToTypeID(s); }
    M.cID = cID; M.sID = sID;

    /* ---------------------------------------------------------------- */
    /*  Couleurs                                                          */
    /* ---------------------------------------------------------------- */
    M.rgb = function (hex) {
        hex = String(hex).replace("#", "");
        return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
    };
    M.solid = function (hex) {
        var c = M.rgb(hex), s = new SolidColor();
        s.rgb.red = c[0]; s.rgb.green = c[1]; s.rgb.blue = c[2];
        return s;
    };
    M.rgbDesc = function (hex) {
        var c = M.rgb(hex), d = new ActionDescriptor();
        d.putDouble(cID("Rd  "), c[0]);
        d.putDouble(cID("Grn "), c[1]);
        d.putDouble(cID("Bl  "), c[2]);
        return d;
    };

    /* ---------------------------------------------------------------- */
    /*  Préférences (unités en pixels, restauration à la fin)            */
    /* ---------------------------------------------------------------- */
    M.pushPrefs = function () {
        M._prefs = {
            ruler: app.preferences.rulerUnits,
            type: app.preferences.typeUnits,
            dialogs: app.displayDialogs
        };
        app.preferences.rulerUnits = Units.PIXELS;
        app.preferences.typeUnits = TypeUnits.PIXELS;
        app.displayDialogs = DialogModes.NO;
    };
    M.popPrefs = function () {
        if (!M._prefs) { return; }
        app.preferences.rulerUnits = M._prefs.ruler;
        app.preferences.typeUnits = M._prefs.type;
        app.displayDialogs = M._prefs.dialogs;
    };

    /* ---------------------------------------------------------------- */
    /*  Polices                                                           */
    /* ---------------------------------------------------------------- */
    M._fonts = null;
    M.fontExists = function (ps) {
        if (!M._fonts) {
            M._fonts = {};
            for (var i = 0; i < app.fonts.length; i++) { M._fonts[app.fonts[i].postScriptName] = true; }
        }
        return M._fonts[ps] === true;
    };
    /* Renvoie la police demandée, sinon la police de secours. Mémorise les absentes. */
    M.missingFonts = {};
    M.font = function (ps, fallback) {
        if (M.fontExists(ps)) { return ps; }
        M.missingFonts[ps] = true;
        return M.fontExists(fallback) ? fallback : "ArialMT";
    };

    /* ---------------------------------------------------------------- */
    /*  Documents, groupes, rangement des calques                        */
    /* ---------------------------------------------------------------- */
    M.newDoc = function (name, w, h) {
        var doc = app.documents.add(
            new UnitValue(w, "px"), new UnitValue(h, "px"), 72, name,
            NewDocumentMode.RGB, DocumentFill.TRANSPARENT, 1,
            BitsPerChannelType.EIGHT, "sRGB IEC61966-2.1"
        );
        return doc;
    };

    M.group = function (doc, name) {
        var g = doc.layerSets.add();
        g.name = name;
        return g;
    };

    /* Place le calque tout en haut du groupe (on construit de bas en haut). */
    M.into = function (layer, group) {
        if (!group) { return layer; }
        try {
            if (group.layers.length === 0) {
                layer.move(group, ElementPlacement.INSIDE);
            } else {
                layer.move(group.layers[0], ElementPlacement.PLACEBEFORE);
            }
        } catch (e) { /* on laisse le calque où il est plutôt que d'interrompre */ }
        return layer;
    };

    /* ---------------------------------------------------------------- */
    /*  Tracés : chaque sous-tracé est une liste de points               */
    /*  { a:[x,y], l:[x,y], r:[x,y] }  (l/r = poignées de Bézier)        */
    /* ---------------------------------------------------------------- */
    var K = 0.5522847498; // constante de Bézier pour un quart de cercle

    function pt(x, y, lx, ly, rx, ry) {
        return { a: [x, y], l: [lx === undefined ? x : lx, ly === undefined ? y : ly], r: [rx === undefined ? x : rx, ry === undefined ? y : ry] };
    }

    M.pathEllipse = function (cx, cy, rx, ry) {
        var kx = rx * K, ky = ry * K;
        return [
            pt(cx, cy - ry, cx - kx, cy - ry, cx + kx, cy - ry),
            pt(cx + rx, cy, cx + rx, cy - ky, cx + rx, cy + ky),
            pt(cx, cy + ry, cx + kx, cy + ry, cx - kx, cy + ry),
            pt(cx - rx, cy, cx - rx, cy + ky, cx - rx, cy - ky)
        ];
    };
    M.pathCircle = function (cx, cy, r) { return M.pathEllipse(cx, cy, r, r); };

    M.pathRoundRect = function (x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        var k = r * K, x2 = x + w, y2 = y + h;
        return [
            pt(x + r, y, x + r - k, y, x + r, y),
            pt(x2 - r, y, x2 - r, y, x2 - r + k, y),
            pt(x2, y + r, x2, y + r - k, x2, y + r),
            pt(x2, y2 - r, x2, y2 - r, x2, y2 - r + k),
            pt(x2 - r, y2, x2 - r + k, y2, x2 - r, y2),
            pt(x + r, y2, x + r, y2, x + r - k, y2),
            pt(x, y2 - r, x, y2 - r + k, x, y2 - r),
            pt(x, y + r, x, y + r, x, y + r - k)
        ];
    };

    /* Arche "porte de calendrier" : rectangle surmonté d'un demi-cercle. */
    M.pathArch = function (x, y, w, h) {
        var R = w / 2, cx = x + R, k = R * K;
        return [
            pt(x, y + R, x, y + R, x, y + R - k),
            pt(cx, y, cx - k, y, cx + k, y),
            pt(x + w, y + R, x + w, y + R - k, x + w, y + R),
            pt(x + w, y + h),
            pt(x, y + h)
        ];
    };

    /* Étincelle à 4 branches. */
    M.pathStar4 = function (cx, cy, R) {
        var r = R * 0.22, pts = [], i;
        for (i = 0; i < 8; i++) {
            var a = -Math.PI / 2 + i * Math.PI / 4, rr = (i % 2) ? r : R;
            pts.push(pt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
        }
        return pts;
    };

    M.makePath = function (doc, name, subpaths) {
        var spis = [], s, p;
        for (s = 0; s < subpaths.length; s++) {
            var pts = [];
            for (p = 0; p < subpaths[s].length; p++) {
                var q = subpaths[s][p], ppi = new PathPointInfo();
                ppi.kind = PointKind.CORNERPOINT;
                ppi.anchor = q.a;
                ppi.leftDirection = q.r;  // Photoshop : leftDirection = poignée "sortante"
                ppi.rightDirection = q.l; // rightDirection = poignée "entrante"
                pts.push(ppi);
            }
            var spi = new SubPathInfo();
            spi.closed = true;
            spi.operation = ShapeOperation.SHAPEADD;
            spi.entireSubPath = pts;
            spis.push(spi);
        }
        return doc.pathItems.add(name, spis);
    };

    /* Calque de forme vectoriel (modifiable : double-clic sur la vignette = couleur). */
    M.shape = function (doc, name, hex, subpaths, group) {
        doc.selection.deselect();
        var pi = M.makePath(doc, "__tmp_mdll", subpaths), layer;
        try {
            pi.select();
            var desc = new ActionDescriptor(), ref = new ActionReference();
            ref.putClass(sID("contentLayer"));
            desc.putReference(cID("null"), ref);
            var d2 = new ActionDescriptor(), d3 = new ActionDescriptor();
            d3.putObject(cID("Clr "), cID("RGBC"), M.rgbDesc(hex));
            d2.putObject(cID("Type"), sID("solidColorLayer"), d3);
            desc.putObject(cID("Usng"), sID("contentLayer"), d2);
            executeAction(cID("Mk  "), desc, DialogModes.NO);
            layer = doc.activeLayer;
        } catch (e) {
            // Secours : calque pixel rempli avec le tracé
            layer = doc.artLayers.add();
            pi.fillPath(M.solid(hex), ColorBlendMode.NORMAL, 100, true, 0, true, true);
        }
        try { pi.remove(); } catch (e2) {}
        layer.name = name;
        return M.into(layer, group);
    };

    /* Calque de remplissage couleur unie plein cadre. */
    M.solidLayer = function (doc, name, hex, group) {
        doc.selection.deselect();
        var layer;
        try {
            var desc = new ActionDescriptor(), ref = new ActionReference();
            ref.putClass(sID("contentLayer"));
            desc.putReference(cID("null"), ref);
            var d2 = new ActionDescriptor(), d3 = new ActionDescriptor();
            d3.putObject(cID("Clr "), cID("RGBC"), M.rgbDesc(hex));
            d2.putObject(cID("Type"), sID("solidColorLayer"), d3);
            desc.putObject(cID("Usng"), sID("contentLayer"), d2);
            executeAction(cID("Mk  "), desc, DialogModes.NO);
            layer = doc.activeLayer;
        } catch (e) {
            layer = doc.artLayers.add();
            doc.selection.selectAll();
            doc.selection.fill(M.solid(hex));
            doc.selection.deselect();
        }
        layer.name = name;
        return M.into(layer, group);
    };

    /* Ellipse floue (halo, ombre portée, lueur) sur calque pixel. */
    M.softEllipse = function (doc, name, hex, cx, cy, rx, ry, blur, opacity, group) {
        doc.selection.deselect();
        var layer = doc.artLayers.add();
        layer.name = name;
        var pi = M.makePath(doc, "__tmp_mdll", [M.pathEllipse(cx, cy, rx, ry)]);
        pi.makeSelection(0, true, SelectionType.REPLACE);
        doc.selection.fill(M.solid(hex));
        doc.selection.deselect();
        try { pi.remove(); } catch (e) {}
        if (blur > 0) { layer.applyGaussianBlur(blur); }
        layer.opacity = opacity;
        return M.into(layer, group);
    };

    /* ---------------------------------------------------------------- */
    /*  Styles de calque : contour + lueur externe                       */
    /*  fx = { stroke:{hex,size,opacity,position:"in"|"out"|"center"},   */
    /*         glow:{hex,size,opacity} }                                  */
    /* ---------------------------------------------------------------- */
    M.fx = function (doc, layer, fx) {
        doc.activeLayer = layer;
        try {
            var d = new ActionDescriptor(), r = new ActionReference();
            r.putProperty(cID("Prpr"), cID("Lefx"));
            r.putEnumerated(cID("Lyr "), cID("Ordn"), cID("Trgt"));
            d.putReference(cID("null"), r);
            var e = new ActionDescriptor();
            e.putUnitDouble(cID("Scl "), cID("#Prc"), 100);
            if (fx.stroke) {
                var s = new ActionDescriptor(), pos = { "in": "InsF", "out": "OutF", "center": "CtrF" }[fx.stroke.position || "center"];
                s.putBoolean(cID("enab"), true);
                s.putEnumerated(cID("Styl"), cID("FStl"), cID(pos));
                s.putEnumerated(cID("PntT"), cID("FrFl"), cID("SClr"));
                s.putEnumerated(cID("Md  "), cID("BlnM"), cID("Nrml"));
                s.putUnitDouble(cID("Opct"), cID("#Prc"), fx.stroke.opacity === undefined ? 100 : fx.stroke.opacity);
                s.putUnitDouble(cID("Sz  "), cID("#Pxl"), fx.stroke.size);
                s.putObject(cID("Clr "), cID("RGBC"), M.rgbDesc(fx.stroke.hex));
                e.putObject(cID("FrFX"), cID("FrFX"), s);
            }
            if (fx.glow) {
                var g = new ActionDescriptor();
                g.putBoolean(cID("enab"), true);
                g.putEnumerated(cID("Md  "), cID("BlnM"), cID("Scrn"));
                g.putObject(cID("Clr "), cID("RGBC"), M.rgbDesc(fx.glow.hex));
                g.putUnitDouble(cID("Opct"), cID("#Prc"), fx.glow.opacity);
                g.putEnumerated(cID("GlwT"), cID("BETE"), cID("SfBL"));
                g.putUnitDouble(cID("Ckmt"), cID("#Pxl"), 0);
                g.putUnitDouble(cID("blur"), cID("#Pxl"), fx.glow.size);
                g.putUnitDouble(cID("Nose"), cID("#Prc"), 0);
                g.putUnitDouble(cID("ShdN"), cID("#Prc"), 0);
                g.putBoolean(cID("AntA"), true);
                g.putUnitDouble(cID("Inpr"), cID("#Prc"), 50);
                e.putObject(cID("OrGl"), cID("OrGl"), g);
            }
            d.putObject(cID("T   "), cID("Lefx"), e);
            executeAction(cID("setd"), d, DialogModes.NO);
        } catch (err) {
            M.log("Style non appliqué sur « " + layer.name + " » : " + err);
        }
        return layer;
    };

    /* Calque contour seul (fond à 0 %, contour en style de calque). */
    M.outline = function (doc, name, hex, size, subpaths, opacity, group, position) {
        var l = M.shape(doc, name, hex, subpaths, group);
        l.fillOpacity = 0;
        M.fx(doc, l, { stroke: { hex: hex, size: size, opacity: 100, position: position || "center" } });
        if (opacity !== undefined) { l.opacity = opacity; }
        return l;
    };

    /* ---------------------------------------------------------------- */
    /*  Texte (point text centré, y = ligne de base)                     */
    /*  o = { tracking, opacity, leading }                                */
    /* ---------------------------------------------------------------- */
    M.text = function (doc, name, str, x, y, font, size, hex, o, group) {
        o = o || {};
        var l = doc.artLayers.add();
        l.kind = LayerKind.TEXT;
        var t = l.textItem;
        t.kind = TextType.POINTTEXT;
        t.contents = str;
        t.font = font;
        t.size = new UnitValue(size, "px");
        t.color = M.solid(hex);
        t.justification = Justification.CENTER;
        t.antiAliasMethod = AntiAlias.SMOOTH;
        if (o.tracking) { t.tracking = o.tracking; }
        t.position = [new UnitValue(x, "px"), new UnitValue(y, "px")];
        l.name = name;
        if (o.opacity !== undefined) { l.opacity = o.opacity; }
        return M.into(l, group);
    };

    M.bounds = function (layer) {
        var b = layer.bounds;
        return { l: b[0].as("px"), t: b[1].as("px"), r: b[2].as("px"), b: b[3].as("px"),
                 w: b[2].as("px") - b[0].as("px"), h: b[3].as("px") - b[1].as("px") };
    };

    /* ---------------------------------------------------------------- */
    /*  Image en objet dynamique, ajustée dans une boîte                 */
    /* ---------------------------------------------------------------- */
    M.placeSmart = function (doc, file, name, cx, cy, maxW, maxH, group) {
        doc.selection.deselect();
        var d = new ActionDescriptor();
        d.putPath(cID("null"), file);
        d.putEnumerated(cID("FTcs"), cID("QCSt"), cID("Qcsa"));
        executeAction(cID("Plc "), d, DialogModes.NO);
        var l = doc.activeLayer;
        l.name = name;
        var b = M.bounds(l);
        var k = Math.min(maxW / b.w, maxH / b.h) * 100;
        l.resize(k, k, AnchorPosition.MIDDLECENTER);
        b = M.bounds(l);
        l.translate(new UnitValue(cx - (b.l + b.w / 2), "px"), new UnitValue(cy - (b.t + b.h / 2), "px"));
        return M.into(l, group);
    };

    /* ---------------------------------------------------------------- */
    /*  Divers                                                            */
    /* ---------------------------------------------------------------- */
    M.guides = function (doc, horizontals, verticals) {
        var i;
        try {
            for (i = 0; i < (horizontals || []).length; i++) { doc.guides.add(Direction.HORIZONTAL, new UnitValue(horizontals[i], "px")); }
            for (i = 0; i < (verticals || []).length; i++) { doc.guides.add(Direction.VERTICAL, new UnitValue(verticals[i], "px")); }
        } catch (e) { /* versions anciennes sans API repères */ }
    };

    M.ensureFolder = function (path) {
        var f = new Folder(path);
        if (!f.exists) { f.create(); }
        return f;
    };

    M._log = [];
    M.log = function (msg) { M._log.push(msg); };

    M.savePSD = function (doc, file) {
        var o = new PhotoshopSaveOptions();
        o.layers = true;
        o.embedColorProfile = true;
        o.maximizeCompatibility = true;
        doc.saveAs(file, o, false, Extension.LOWERCASE);
    };

})(MDLL);
