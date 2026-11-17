/*
 * Planning Instagram Maison de la Literie — du lundi 23 au lundi 30 novembre 2026
 * Définition de chaque visuel (posts, carrousel, stories).
 */
const C = {
  navy: "#1E2638", navy2: "#2C3650", terra: "#B8735F", terraClair: "#D89A84",
  cream: "#F5EFE6", sable: "#E9DDCC", white: "#FFFFFF", noir: "#141414",
  gris: "#8C8C8C", vert: "#34C759", rouge: "#E5484D", silhouette: "#3A4560"
};
const A = n => "../assets/" + n;
const SW = 1080, SH = 1920, FW = 1080, FH = 1350;

/* ---------- Briques communes ---------- */
function logo(V, y, hex) { V.text("Logo (texte provisoire)", "MAISON DE LA LITERIE", 540, y, "gras", 22, hex, { tracking: 260 }); }
function label(V, str, y, hex) { V.text("Surtitre", str, 540, y, "gras", 24, hex, { tracking: 300 }); }
function chip(V, str, y, bg, fg) {
  const w = textWidth(str, "gras", 24, 250) + 60;
  V.rect("Étiquette — fond", bg, 540 - w / 2, y - 38, w, 56, 28);
  V.text("Étiquette — texte", str, 540, y, "gras", 24, fg, { tracking: 250 });
}
function shadow(V, cx, cy, rx) { V.soft("Ombre portée", C.noir, cx, cy, rx, 24, 18, 0.28); }

/* Carte de notification façon écran verrouillé */
function notif(V, x, y, w, o) {
  const lines = wrap(o.body, "ui", 31, 0, w - 200).length;
  const h = 118 + lines * 42 + 26;
  V.g("Notification — " + o.title);
  V.rect("Carte", C.white, x, y, w, h, 40, { opacity: 0.94 });
  V.rect("Icône — fond", o.iconHex, x + 32, y + 32, 84, 84, 22);
  o.icon(x + 32, y + 32);
  V.text("Titre", o.title, x + 145, y + 66, "uiBold", 30, C.navy, { align: "left" });
  V.text("Heure", o.time || "maintenant", x + w - 34, y + 66, "ui", 25, C.gris, { align: "right" });
  V.text("Message", o.body, x + 145, y + 112, "ui", 31, C.navy, { align: "left", maxW: w - 200, lh: 42 });
  return y + h;
}
function batteryIcon(V, ix, iy, hex) {
  V.outline("Icône — batterie", hex, 3, [MDLL.pathRoundRect(ix + 16, iy + 28, 46, 28, 6)]);
  V.rect("Icône — charge", hex, ix + 21, iy + 33, 36, 18, 3);
  V.rect("Icône — borne", hex, ix + 64, iy + 37, 5, 10, 2);
}

const VISUALS = [];
const add = (file, fn) => VISUALS.push({ file, fn });

/* ===================== LUNDI 23 ===================== */
add("2026-11-23_POST_Notification-chargeur", async () => {
  const V = new Visual("2026-11-23_POST_Notification-chargeur", FW, FH);
  V.g("01 · FOND");
  V.fill("Fond nuit", C.navy);
  V.soft("Halo haut", C.navy2, 540, 300, 600, 400, 140, 0.9);
  V.soft("Halo terracotta", C.terra, 540, 1260, 700, 380, 160, 0.55);
  V.g("02 · ÉCRAN VERROUILLÉ");
  V.text("Heure", "07:00", 540, 360, "uiLight", 200, C.cream, { tracking: -20 });
  V.text("Date", "lundi 23 novembre", 540, 430, "medium", 34, C.cream, { opacity: 0.8 });
  const y2 = notif(V, 90, 520, 900, {
    iconHex: C.vert, icon: (ix, iy) => batteryIcon(V, ix, iy, C.white),
    title: "Téléphone", body: "Batterie chargée à 100 %."
  });
  notif(V, 90, y2 + 24, 900, {
    iconHex: C.terra, icon: (ix, iy) => V.text("Icône — texte", "onéa", ix + 42, iy + 51, "gras", 24, C.white),
    title: "Vous", body: "Énergie rechargée à 100 % cette nuit, grâce à votre matelas Onéa."
  });
  V.g("03 · TEXTES");
  V.text("Accroche", "Chacun sa recharge.", 540, 1140, "titreIt", 66, C.cream);
  V.text("Sous-titre", "Matelas Onéa · fabriqués en France", 540, 1195, "medium", 26, C.cream, { tracking: 40, opacity: 0.7 });
  logo(V, 1295, C.cream);
  return V.result();
});

add("2026-11-23_STORY_Proposition-sondage-batterie", async () => {
  const V = new Visual("2026-11-23_STORY_Proposition-sondage-batterie", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.cream); V.soft("Halo", C.sable, 540, 950, 650, 650, 160, 0.9);
  V.g("02 · CONTENU");
  logo(V, 300, C.navy);
  label(V, "SONDAGE DU JOUR", 430, C.terra);
  V.text("Titre", "Le matin, vous êtes plutôt…", 540, 540, "titre", 84, C.navy, { maxW: 860, lh: 100 });
  [[300, C.vert, 250, "100 %", "Rechargé à bloc"], [780, C.rouge, 40, "12 %", "Mode économie d'énergie"]].forEach(([cx, col, fw, pct, txt]) => {
    V.outline("Batterie " + pct + " — contour", C.navy, 6, [MDLL.pathRoundRect(cx - 150, 820, 280, 150, 30)]);
    V.rect("Batterie " + pct + " — charge", col, cx - 135, 835, fw, 120, 18);
    V.rect("Batterie " + pct + " — borne", C.navy, cx + 134, 870, 16, 50, 6);
    V.text("Batterie " + pct + " — %", pct, cx, 1050, "gras", 46, C.navy);
    V.text("Batterie " + pct + " — légende", txt, cx, 1095, "texte", 30, C.navy, { maxW: 400, lh: 38 });
  });
  V.text("Consigne", "Votez ci-dessous", 540, 1210, "medium", 30, C.navy, { opacity: 0.7 });
  V.zone("Sticker sondage : 100 % / 12 %", 190, 1250, 700, 200);
  await V.image("Oreillers", A("oreillers.png"), 540, 1555, 520, 230);
  return V.result();
});

/* ===================== MARDI 24 ===================== */
add("2026-11-24_STORY_08h_Citation", async () => {
  const V = new Visual("2026-11-24_STORY_08h_Citation", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.navy); V.soft("Halo", C.terra, 900, 300, 500, 400, 160, 0.25);
  V.g("02 · CITATION");
  logo(V, 300, C.cream);
  V.text("Guillemet", "“", 540, 760, "titre", 320, C.terra);
  const q = V.text("Citation", "Je rentre tard vers 20h. Et du coup mes seuls moments de repos sont le soir, et je retarde l'heure du coucher pour profiter de ma journée quand même.", 540, 820, "titreIt", 54, C.cream, { maxW: 860, lh: 74 });
  V.rect("Filet", C.terra, 490, q.bottom + 70, 100, 3);
  V.text("Question", "Qui est dans ce cas-là ?", 540, q.bottom + 150, "gras", 44, C.cream);
  V.zone("Sticker boîte à questions", 190, q.bottom + 200, 700, 230);
  return V.result();
});

add("2026-11-24_STORY_12h_Sommier-Onea", async () => {
  const V = new Visual("2026-11-24_STORY_12h_Sommier-Onea", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.sable); V.soft("Halo", C.cream, 540, 950, 600, 420, 120, 0.9);
  V.g("02 · CONTENU");
  logo(V, 300, C.navy);
  label(V, "SOMMIERS ONÉA", 440, C.terra);
  V.text("Titre ligne 1", "Le bon sommier,", 540, 560, "titre", 88, C.navy);
  V.text("Titre ligne 2", "ça change tout.", 540, 660, "titreIt", 88, C.navy);
  shadow(V, 540, 1190, 380);
  await V.image("PRODUIT — sommier Onéa (à remplacer)", A("matelas-sommier.png"), 540, 960, 920, 470);
  V.text("Texte", "Il porte votre matelas, prolonge sa durée de vie et ajuste le confort.", 540, 1300, "texte", 34, C.navy, { maxW: 820, lh: 46 });
  V.text("Appel à l'action", "Découvrir les sommiers", 540, 1450, "gras", 30, C.terra, { tracking: 40 });
  V.zone("Sticker lien : /collections/sommiers", 290, 1480, 500, 120);
  return V.result();
});

add("2026-11-24_STORY_18h_La-solution", async () => {
  const V = new Visual("2026-11-24_STORY_18h_La-solution", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.cream);
  V.g("02 · EN-TÊTE");
  logo(V, 300, C.navy);
  label(V, "LA SOLUTION", 400, C.terra);
  const t = V.text("Titre", "3 conseils pour mieux dormir", 540, 500, "titre", 76, C.navy, { maxW: 900, lh: 88 });
  const tips = [
    ["Une heure de lever fixe", "Gardez une heure de coucher régulière, et surtout une heure de lever fixe, même en cas de fatigue."],
    ["Pas de grasse matinée pour compenser", "Se lever très tard plusieurs jours de suite décale encore l'horloge : le sommeil arrive plus tard le soir suivant."],
    ["Un rituel apaisant avant le lit", "Lumière douce, lecture, respiration… On ralentit avant de se glisser sous la couette."]
  ];
  let y = t.bottom + 70;
  tips.forEach(([ti, bo], i) => {
    const tl = wrap(ti, "gras", 36, 0, 680).length, bl = wrap(bo, "texte", 28, 0, 680).length;
    const h = 56 + tl * 44 + 14 + bl * 38 + 30;
    V.g("0" + (3 + i) + " · CONSEIL " + (i + 1));
    V.rect("Carte", C.white, 80, y, 920, h, 32);
    V.circle("Numéro — pastille", C.terra, 160, y + 72, 38);
    V.text("Numéro", String(i + 1), 160, y + 88, "titre", 44, C.cream);
    const tt = V.text("Conseil — titre", ti, 230, y + 70, "gras", 36, C.navy, { align: "left", maxW: 680, lh: 44 });
    V.text("Conseil — texte", bo, 230, tt.bottom + 52, "texte", 28, C.navy, { align: "left", maxW: 680, lh: 38, opacity: 0.85 });
    y += h + 28;
  });
  V.g("06 · SOURCE");
  V.text("Source", "Conseils 1 et 2 : PourquoiDocteur (Assurance Maladie, Inserm)", 540, y + 30, "texte", 22, C.gris, { maxW: 880, lh: 30 });
  return V.result();
});

/* ===================== MERCREDI 25 ===================== */
add("2026-11-25_STORY_08h_Boite-a-questions-literie-ideale", async () => {
  const V = new Visual("2026-11-25_STORY_08h_Boite-a-questions-literie-ideale", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.terra); V.soft("Halo", C.terraClair, 540, 700, 600, 500, 160, 0.6);
  V.g("02 · CONTENU");
  logo(V, 300, C.cream);
  label(V, "BOÎTE À QUESTIONS", 440, C.cream);
  V.text("Question", "C'est quoi la literie idéale pour vous ?", 540, 560, "titre", 80, C.cream, { maxW: 880, lh: 96 });
  V.zone("Sticker boîte à questions", 190, 830, 700, 260);
  shadow(V, 540, 1560, 320);
  await V.image("Couette", A("couette.png"), 540, 1390, 720, 360);
  return V.result();
});

add("2026-11-25_STORY_12h_Video-tete-de-lit", async () => {
  const V = new Visual("2026-11-25_STORY_12h_Video-tete-de-lit", SW, SH);
  V.g("01 · VIDÉO (à remplacer)");
  V.placeholder("Emplacement vidéo", 0, 0, SW, SH, 0, "#6B5A4E", "VIDÉO TÊTE DE LIT — à placer ici");
  V.g("02 · HABILLAGE");
  V.gradient("Dégradé haut", 0, 0, 0, 760, [[0, "rgba(20,20,20,0.6)"], [1, "rgba(20,20,20,0)"]]);
  V.gradient("Dégradé bas", 0, 1250, 0, 1920, [[0, "rgba(20,20,20,0)"], [1, "rgba(20,20,20,0.65)"]]);
  logo(V, 300, C.cream);
  V.text("Titre", "Et si on changeait de tête de lit ?", 540, 470, "titre", 80, C.cream, { maxW: 860, lh: 94 });
  V.text("Appel à l'action", "Découvrez nos têtes de lit", 540, 1500, "gras", 32, C.cream, { tracking: 40 });
  V.zone("Sticker lien : /collections/tetes-de-lit", 290, 1530, 500, 120);
  return V.result();
});

add("2026-11-25_POST_Vous-nous-dites-Notre-solution-Onea", async () => {
  const V = new Visual("2026-11-25_POST_Vous-nous-dites-Notre-solution-Onea", FW, FH);
  V.g("01 · FOND"); V.fill("Fond", C.cream);
  V.g("02 · EN-TÊTE");
  V.text("Colonne gauche", "Vous nous dites", 300, 135, "titreIt", 46, C.navy);
  V.text("Colonne droite", "Notre solution Onéa", 800, 135, "titreIt", 46, C.navy);
  V.rect("Filet", C.navy, 60, 170, 960, 2, 0, { opacity: 0.2 });
  const rows = [
    ["Je dors sur le côté et mes hanches appuient dans le matelas.", "Marcilly", "Accueil moelleux, soutien médium"],
    ["Je me réveille à chaque fois que l'autre bouge.", "Beaulieu", "910 ressorts ensachés + mémoire de forme"],
    ["Je veux un soutien bien ferme, pas un matelas qui s'enfonce.", "Flavigny", "Accueil tonique, soutien extra-ferme"],
    ["Les ressorts, très peu pour moi.", "Charmoy", "Mémoire de forme, accueil équilibré, soutien ferme"],
    ["Ni trop ferme, ni trop mou : je n'ai jamais su choisir.", "Ciry", "Accueil équilibré, soutien ferme"]
  ];
  for (let i = 0; i < rows.length; i++) {
    const [q, name, desc] = rows[i], y = 196 + i * 212, cy = y + 98;
    V.g("0" + (3 + i) + " · " + name.toUpperCase());
    V.rect("Bulle", C.white, 50, y, 500, 196, 34);
    V.shape("Bulle — pointe", C.white, [poly([[548, cy - 18], [582, cy], [548, cy + 18]])]);
    const n = wrap("« " + q + " »", "texte", 27, 0, 420).length;
    V.text("Besoin", "« " + q + " »", 300, cy + 10 - ((n - 1) * 36) / 2, "texte", 27, C.navy, { maxW: 420, lh: 36 });
    await V.image("PRODUIT — " + name + " (à remplacer)", A("matelas-sommier.png"), 705, cy, 200, 140);
    const dn = wrap(desc, "texte", 22, 0, 210).length;
    const top = cy - (40 + dn * 28) / 2 + 30;
    V.text("Modèle", name, 820, top, "titre", 40, C.navy, { align: "left" });
    V.text("Description", desc, 820, top + 38, "texte", 22, C.navy, { align: "left", maxW: 210, lh: 28, opacity: 0.8 });
  }
  V.g("08 · LOGO"); logo(V, 1310, C.navy);
  return V.result();
});

/* ===================== JEUDI 26 — QUIZ ===================== */
add("2026-11-26_STORY_08h_Quiz-1-Indices", async () => {
  const V = new Visual("2026-11-26_STORY_08h_Quiz-1-Indices", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.navy); V.soft("Halo", C.navy2, 540, 1300, 600, 500, 160, 0.9);
  V.g("02 · EN-TÊTE");
  logo(V, 300, C.cream); chip(V, "QUIZ", 418, C.terra, C.cream);
  V.text("Titre", "Devinez le matelas", 540, 560, "titre", 92, C.cream, { maxW: 900 });
  V.text("Sous-titre", "Quel matelas Onéa se cache derrière ces indices ?", 540, 650, "medium", 36, C.cream, { maxW: 760, lh: 48, opacity: 0.85 });
  ["910 ressorts ensachés", "32 cm d'épaisseur", "Accueil moelleux, soutien médium"].forEach((t, i) => {
    const y = 790 + i * 150;
    V.g("0" + (3 + i) + " · INDICE " + (i + 1));
    V.rect("Carte", C.navy2, 140, y, 800, 120, 30);
    V.text("Numéro", String(i + 1), 205, y + 78, "titre", 50, C.terra);
    V.text("Indice", t, 260, y + 73, "gras", 34, C.cream, { align: "left" });
  });
  V.g("06 · MYSTÈRE");
  await V.image("Silhouette matelas", A("matelas-sommier.png"), 540, 1380, 600, 240, { tint: C.silhouette });
  V.text("Point d'interrogation", "?", 540, 1440, "titre", 170, C.terra);
  V.text("Bas de slide", "Votez à la slide suivante →", 540, 1620, "medium", 34, C.cream);
  return V.result();
});

add("2026-11-26_STORY_08h_Quiz-2-Vote", async () => {
  const V = new Visual("2026-11-26_STORY_08h_Quiz-2-Vote", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.navy); V.soft("Halo", C.navy2, 540, 1300, 600, 500, 160, 0.9);
  V.g("02 · CONTENU");
  logo(V, 300, C.cream); chip(V, "QUIZ", 418, C.terra, C.cream);
  V.text("Question", "C'est lequel ?", 540, 600, "titre", 110, C.cream);
  V.text("Consigne", "Votez avec le quiz ci-dessous", 540, 680, "medium", 36, C.cream, { opacity: 0.85 });
  V.zone("Sticker quiz : A Ciry · B Flavigny · C Marcilly (bonne réponse) · D Beaubery", 140, 760, 800, 480);
  await V.image("Silhouette matelas", A("matelas-sommier.png"), 540, 1390, 520, 200, { tint: C.silhouette });
  V.text("Bas de slide", "Réponse ce soir à 18h !", 540, 1600, "gras", 40, C.terra);
  return V.result();
});

add("2026-11-26_STORY_18h_Quiz-3-Reponse", async () => {
  const V = new Visual("2026-11-26_STORY_18h_Quiz-3-Reponse", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.cream); V.soft("Halo", C.sable, 540, 860, 600, 400, 140, 0.9);
  V.g("02 · CONTENU");
  logo(V, 300, C.navy); chip(V, "LA RÉPONSE", 418, C.terra, C.cream);
  V.text("Titre", "C'était le Marcilly !", 540, 570, "titre", 92, C.navy, { maxW: 900 });
  shadow(V, 540, 1050, 360);
  await V.image("PRODUIT — Marcilly (à remplacer)", A("matelas-sommier.png"), 540, 850, 860, 400);
  const b = V.text("Texte", "910 ressorts ensachés, 32 cm d'épaisseur, un accueil moelleux et un soutien médium. Pour celles et ceux qui n'ont jamais su choisir entre ferme et moelleux.", 540, 1150, "texte", 32, C.navy, { maxW: 860, lh: 44 });
  V.text("Bas de slide", "Venez l'essayer allongé en boutique.", 540, b.bottom + 100, "titreIt", 46, C.terra);
  V.zone("Sticker lien : fiche Marcilly", 290, b.bottom + 140, 500, 120);
  return V.result();
});

/* ===================== VENDREDI 27 ===================== */
add("2026-11-27_STORY_12h_Black-November", async () => {
  const V = new Visual("2026-11-27_STORY_12h_Black-November", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.noir); V.soft("Halo", C.terra, 540, 1300, 600, 400, 180, 0.35);
  V.g("02 · TITRE");
  logo(V, 300, C.cream);
  V.text("Black", "BLACK", 540, 620, "gras", 190, C.cream, { tracking: 120 });
  V.text("November", "November", 540, 770, "titreIt", 150, C.terra);
  V.g("03 · OFFRE (à compléter)");
  V.text("Remise", "-XX %", 540, 1040, "gras", 220, C.cream);
  V.text("Offre", "[Offre à préciser : produits concernés]", 540, 1115, "medium", 34, C.cream, { maxW: 820, opacity: 0.85 });
  V.text("Dates", "Jusqu'au [date]", 540, 1170, "texte", 32, C.cream, { opacity: 0.7 });
  await V.image("PRODUIT (à remplacer)", A("matelas-sommier.png"), 540, 1340, 640, 220);
  V.text("Appel à l'action", "En magasin et sur maisondelaliterie.fr", 540, 1505, "medium", 30, C.cream);
  V.zone("Sticker lien : /collections/black-week", 290, 1530, 500, 110);
  return V.result();
});

add("2026-11-27_STORY_18h_Avis-client", async () => {
  const V = new Visual("2026-11-27_STORY_18h_Avis-client", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.sable); V.soft("Halo", C.cream, 540, 900, 600, 500, 140, 0.9);
  V.g("02 · AVIS (à compléter)");
  logo(V, 300, C.navy);
  label(V, "VOUS EN PARLEZ MIEUX QUE NOUS", 440, C.terra);
  V.shape("Étoiles", C.terra, [0, 1, 2, 3, 4].map(i => star5(380 + i * 80, 560, 30)));
  const q = V.text("Avis", "« [Collez ici l'avis client, idéalement 2 à 4 lignes.] »", 540, 720, "titreIt", 56, C.navy, { maxW: 860, lh: 74 });
  V.text("Auteur", "[Prénom], [ville] · [plateforme d'avis]", 540, q.bottom + 90, "medium", 30, C.navy, { opacity: 0.75 });
  shadow(V, 540, 1500, 340);
  await V.image("PRODUIT (à remplacer)", A("matelas-sommier.png"), 540, 1340, 700, 300);
  return V.result();
});

/* ===================== SAMEDI 28 ===================== */
add("2026-11-28_STORY_10h_Trafic-magasin", async () => {
  const V = new Visual("2026-11-28_STORY_10h_Trafic-magasin", SW, SH);
  V.g("01 · VIDÉO (à remplacer)");
  V.placeholder("Emplacement vidéo", 0, 0, SW, SH, 0, "#5E6672", "VIDÉO MATELAS — à placer ici");
  V.g("02 · HABILLAGE");
  V.gradient("Dégradé haut", 0, 0, 0, 600, [[0, "rgba(20,20,20,0.55)"], [1, "rgba(20,20,20,0)"]]);
  V.gradient("Dégradé bas", 0, 1000, 0, 1920, [[0, "rgba(20,20,20,0)"], [1, "rgba(20,20,20,0.6)"]]);
  logo(V, 300, C.cream);
  const n = wrap("Est-ce que ce serait pas le moment d'essayer en magasin ?", "titre", 60, 0, 780).length;
  const h = 70 + n * 74 + 30;
  V.rect("Carte", C.cream, 90, 1080, 900, h, 40);
  V.text("Texte", "Est-ce que ce serait pas le moment d'essayer en magasin ?", 540, 1160, "titre", 60, C.navy, { maxW: 780, lh: 74 });
  V.text("Appel à l'action", "Trouvez votre magasin", 540, 1080 + h + 80, "gras", 32, C.cream, { tracking: 40 });
  V.zone("Sticker lien : liste des magasins", 290, 1080 + h + 110, 500, 110);
  return V.result();
});

/* ===================== DIMANCHE 29 ===================== */
add("2026-11-29_POST_Fausse-notification-dimanche", async () => {
  const V = new Visual("2026-11-29_POST_Fausse-notification-dimanche", FW, FH);
  V.g("01 · FOND");
  V.fill("Fond nuit", C.navy);
  V.soft("Halo haut", C.navy2, 540, 280, 600, 380, 140, 0.9);
  V.soft("Halo terracotta", C.terra, 540, 1300, 700, 300, 160, 0.45);
  V.g("02 · ÉCRAN VERROUILLÉ");
  V.text("Heure", "20:00", 540, 320, "uiLight", 200, C.cream, { tracking: -20 });
  V.text("Date", "dimanche 29 novembre", 540, 390, "medium", 34, C.cream, { opacity: 0.8 });
  V.g("03 · NOTIFICATION");
  const x = 90, y = 470, w = 900;
  const n = wrap("Demain, c'est lundi. Ce soir, vous avez encore le droit de rester sous la couette.", "ui", 32, 0, 700).length;
  const div = y + 130 + n * 42;
  V.rect("Carte", C.white, x, y, w, div - y + 110, 40, { opacity: 0.95 });
  V.rect("Icône — fond", C.terra, x + 32, y + 32, 84, 84, 22);
  V.circle("Icône — lune", C.cream, x + 72, y + 76, 26);
  V.circle("Icône — lune (découpe)", C.terra, x + 86, y + 64, 23);
  V.text("Ligne 1", "Rappel · Dimanche 20h", x + 145, y + 66, "uiBold", 30, C.navy, { align: "left" });
  V.text("Heure", "maintenant", x + w - 34, y + 66, "ui", 25, C.gris, { align: "right" });
  V.text("Ligne 2", "Demain, c'est lundi. Ce soir, vous avez encore le droit de rester sous la couette.", x + 145, y + 114, "ui", 32, C.navy, { align: "left", maxW: 700, lh: 42 });
  V.rect("Séparateur", C.gris, x, div, w, 2, 0, { opacity: 0.3 });
  V.text("Bouton", "Bonne nuit", 540, div + 68, "uiBold", 34, C.terra);
  V.g("04 · PRODUIT");
  shadow(V, 540, 1205, 330);
  await V.image("Couette", A("couette.png"), 540, 1060, 720, 300);
  V.g("05 · LOGO"); logo(V, 1300, C.cream);
  return V.result();
});

/* ===================== LUNDI 30 ===================== */
add("2026-11-30_STORY_08h_Boite-a-questions-saison", async () => {
  const V = new Visual("2026-11-30_STORY_08h_Boite-a-questions-saison", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.navy); V.soft("Halo", C.navy2, 540, 900, 650, 650, 160, 0.9);
  let seed = 30; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const flakes = []; for (let i = 0; i < 70; i++) { const x = 40 + rnd() * 1000, y = 40 + rnd() * 1840, r = 2 + rnd() * 3; if (x < 120 || x > 960 || y < 380 || y > 1700) flakes.push(MDLL.pathCircle(x, y, r)); }
  V.shape("Neige", C.cream, flakes, { opacity: 0.5 });
  V.g("02 · CONTENU");
  logo(V, 300, C.cream);
  label(V, "BOÎTE À QUESTIONS", 440, C.terra);
  const q = V.text("Question", "Quelle est votre saison préférée pour dormir ?", 540, 560, "titre", 76, C.cream, { maxW: 880, lh: 92 });
  V.text("Question — suite", "(et pourquoi l'hiver ?)", 540, q.bottom + 100, "titreIt", 60, C.terra);
  V.zone("Sticker boîte à questions", 190, q.bottom + 160, 700, 250);
  await V.image("Oreillers", A("oreillers.png"), 540, 1460, 480, 300);
  return V.result();
});

add("2026-11-30_STORY_12h_Black-November", async () => {
  const V = new Visual("2026-11-30_STORY_12h_Black-November", SW, SH);
  V.g("01 · FOND"); V.fill("Fond", C.noir); V.soft("Halo", C.terra, 540, 1250, 600, 420, 180, 0.35);
  V.g("02 · TITRE");
  logo(V, 300, C.cream);
  label(V, "BLACK NOVEMBER", 460, C.terra);
  V.text("Accroche", "Le bon moment pour bien dormir", 540, 600, "titre", 96, C.cream, { maxW: 860, lh: 108 });
  V.g("03 · OFFRE (à compléter)");
  V.text("Remise", "-XX %", 540, 1000, "gras", 200, C.cream);
  V.text("Offre", "[Offre à préciser : produits concernés]", 540, 1075, "medium", 34, C.cream, { maxW: 820, opacity: 0.85 });
  V.text("Dates", "Jusqu'au [date]", 540, 1130, "texte", 32, C.cream, { opacity: 0.7 });
  await V.image("PRODUIT (à remplacer)", A("couette.png"), 540, 1320, 600, 250);
  V.text("Appel à l'action", "En magasin et sur maisondelaliterie.fr", 540, 1505, "medium", 30, C.cream);
  V.zone("Sticker lien : /collections/black-week", 290, 1530, 500, 110);
  return V.result();
});

/* Carrousel « L'hiver comme on l'aime » (5 slides) */
function counter(V, i) { V.text("Compteur", "0" + i + " / 05", 1010, 90, "medium", 22, C.navy, { align: "right", tracking: 80, opacity: 0.6 }); }

add("2026-11-30_POST_Carrousel-Hiver-01-Couverture", async () => {
  const V = new Visual("2026-11-30_POST_Carrousel-Hiver-01-Couverture", FW, FH);
  V.g("01 · FOND"); V.fill("Fond", C.sable); V.soft("Halo", C.cream, 540, 850, 600, 400, 140, 0.9);
  V.g("02 · CONTENU");
  counter(V, 1);
  V.text("Titre ligne 1", "L'hiver", 540, 400, "titre", 170, C.navy);
  V.text("Titre ligne 2", "comme on l'aime", 540, 520, "titreIt", 96, C.terra);
  shadow(V, 540, 1080, 360);
  await V.image("Couette", A("couette.png"), 540, 860, 820, 420);
  V.text("Faites défiler", "Faites défiler →", 540, 1210, "medium", 26, C.navy, { opacity: 0.7, tracking: 40 });
  logo(V, 1295, C.navy);
  return V.result();
});

add("2026-11-30_POST_Carrousel-Hiver-02-Nuit-17h", async () => {
  const V = new Visual("2026-11-30_POST_Carrousel-Hiver-02-Nuit-17h", FW, FH);
  V.g("01 · FOND"); V.fill("Fond", C.cream);
  V.g("02 · PHOTO (à remplacer)");
  V.placeholder("Photo d'ambiance", 80, 130, 920, 760, 24, "#CDBFAE", "PHOTO D'AMBIANCE — chambre cosy, lumière du soir");
  V.g("03 · TEXTES");
  counter(V, 2);
  V.text("Texte ligne 1", "Quand la nuit tombe à 17h,", 540, 1000, "titre", 58, C.navy, { maxW: 920 });
  V.text("Texte ligne 2", "le lit devient la meilleure pièce de la maison.", 540, 1080, "titreIt", 58, C.terra, { maxW: 900, lh: 70 });
  logo(V, 1295, C.navy);
  return V.result();
});

const winter = [
  [3, "Couette", "Une couette qui tient chaud", "couette.png", "Couette Onaturel 300 g/m², pour s'emmitoufler sans chaussettes.", C.sable],
  [4, "Oreillers", "Des oreillers bien moelleux", "oreillers.png", "Pour se caler avec un bon livre (et ne plus bouger).", C.cream],
  [5, "Matelas", "Et un bon matelas, évidemment.", "matelas-sommier.png", "Toute la gamme Onéa est à essayer allongé en magasin.", C.sable]
];
winter.forEach(([i, slug, title, img, cap, bg]) => {
  const name = "2026-11-30_POST_Carrousel-Hiver-0" + i + "-" + slug;
  add(name, async () => {
    const V = new Visual(name, FW, FH);
    V.g("01 · FOND"); V.fill("Fond", bg); V.soft("Halo", bg === C.sable ? C.cream : C.sable, 540, 720, 600, 400, 140, 0.9);
    V.g("02 · CONTENU");
    counter(V, i);
    const t = V.text("Titre", title, 540, 250, "titre", 72, C.navy, { maxW: 860, lh: 84 });
    shadow(V, 540, 960, 360);
    await V.image("PRODUIT (à remplacer)", A(img), 540, 720 + (t.lines - 1) * 30, 820, 420);
    V.text("Légende", cap, 540, 1100, "texte", 32, C.navy, { maxW: 820, lh: 44 });
    logo(V, 1295, C.navy);
    return V.result();
  });
});
