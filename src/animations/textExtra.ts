/** Animations de texte supplémentaires (V3). Elles s'appliquent aussi à tout clip. */
import { clamp01, easeOutBackWithOvershoot, easeOutCubic, getEasing, lerp } from "../engine/easing";
import { steppedNoise } from "../engine/noise";
import type { AnimationDefinition, Motion } from "../engine/types";
import { cascadeDelay, durationParam, easingParam, fadeCurve, fadeParam, num, staggerParam, str, bool } from "./common";

const base = { kind: "entrance" as const, subject: "text" as const };

export const fadeIn: AnimationDefinition = {
  ...base,
  id: "fade",
  name: "Fade",
  tagline: "Fondu simple et propre.",
  description: "Le grand classique : le texte apparaît (ou disparaît) en fondu, avec la courbe de votre choix.",
  category: "pop",
  tags: ["fade", "fondu", "opacité", "simple", "sobre", "sous-titre"],
  previewText: "Fade",
  uses: ["opacity"],
  params: [durationParam(0.4, 3), easingParam("smooth"), staggerParam(0)],
  build(v, ctx) {
    const d = num(v, "duration", 0.4);
    const ease = getEasing(str(v, "easing", "smooth"), "smooth");
    return { delay: cascadeDelay(v, ctx), duration: d, tracks: { opacity: (t) => ease(clamp01(t / d)) } };
  },
};

export const zoomIn: AnimationDefinition = {
  ...base,
  id: "zoom-in-text",
  name: "Zoom In",
  tagline: "Arrive de très près et se pose.",
  description: "Le texte part d'une grande échelle et recule jusqu'à sa taille, avec un fondu : effet d'impact cinématographique.",
  category: "pop",
  tags: ["zoom", "in", "recul", "impact", "titre", "cinéma"],
  previewText: "Zoom In",
  uses: ["scale", "opacity"],
  params: [
    durationParam(0.6, 3),
    { id: "startScale", label: "Échelle de départ", type: "number", min: 105, max: 400, step: 5, default: 180, unit: "%", group: "motion" },
    easingParam("expo"),
    fadeParam(50),
    staggerParam(0),
  ],
  build(v, ctx) {
    const d = num(v, "duration", 0.6);
    const s0 = num(v, "startScale", 180) / 100;
    const ease = getEasing(str(v, "easing", "expo"));
    return {
      delay: cascadeDelay(v, ctx),
      duration: d,
      tracks: { scale: (t) => lerp(s0, 1, ease(clamp01(t / d))), opacity: fadeCurve(d, num(v, "fade", 50), easeOutCubic) },
    };
  },
};

export const swingIn: AnimationDefinition = {
  ...base,
  id: "swing-in",
  name: "Swing",
  tagline: "Bascule et se redresse avec élan.",
  description: "Le texte arrive en pivotant légèrement puis se redresse avec un petit dépassement. Dynamique et ludique. La rotation se fait autour du point d'ancrage du clip.",
  category: "bounce",
  tags: ["swing", "rotation", "bascule", "fun", "dynamique", "reels"],
  previewText: "Swing",
  uses: ["rotation", "y", "opacity"],
  params: [
    durationParam(0.7, 3),
    { id: "angle", label: "Angle de départ", type: "number", min: -90, max: 90, step: 1, default: -18, unit: "°", group: "motion" },
    { id: "distance", label: "Montée", type: "number", min: 0, max: 300, step: 1, default: 40, unit: "px", group: "motion" },
    { id: "overshoot", label: "Dépassement", type: "number", min: 0, max: 40, step: 1, default: 15, unit: "%", group: "motion" },
    fadeParam(40),
    staggerParam(0),
  ],
  build(v, ctx) {
    const d = num(v, "duration", 0.7);
    const angle = num(v, "angle", -18);
    const dist = num(v, "distance", 40);
    const back = easeOutBackWithOvershoot(num(v, "overshoot", 15) / 100);
    const p = (t: number) => clamp01(t / d);
    const tracks: Motion["tracks"] = { rotation: (t) => lerp(angle, 0, back(p(t))) };
    if (dist) tracks.y = (t) => lerp(dist, 0, easeOutCubic(p(t)));
    const fade = fadeCurve(d, num(v, "fade", 40), easeOutCubic);
    if (fade) tracks.opacity = fade;
    return { delay: cascadeDelay(v, ctx), duration: d, tracks };
  },
};

export const spinIn: AnimationDefinition = {
  ...base,
  id: "spin-in",
  name: "Spin In",
  tagline: "Tourne sur lui-même en grandissant.",
  description: "Le texte arrive en tournant depuis une petite échelle. Idéal pour un logo, un chiffre ou un mot fort.",
  category: "pop",
  tags: ["spin", "rotation", "tourne", "logo", "fun"],
  previewText: "Spin",
  uses: ["rotation", "scale", "opacity"],
  params: [
    durationParam(0.7, 3),
    { id: "angle", label: "Rotation", type: "number", min: -1080, max: 1080, step: 15, default: -360, unit: "°", group: "motion" },
    { id: "startScale", label: "Échelle de départ", type: "number", min: 0, max: 100, step: 1, default: 0, unit: "%", group: "motion" },
    easingParam("quint"),
    staggerParam(0),
  ],
  build(v, ctx) {
    const d = num(v, "duration", 0.7);
    const angle = num(v, "angle", -360);
    const s0 = num(v, "startScale", 0) / 100;
    const ease = getEasing(str(v, "easing", "quint"));
    const p = (t: number) => ease(clamp01(t / d));
    return {
      delay: cascadeDelay(v, ctx),
      duration: d,
      tracks: { rotation: (t) => angle * (1 - p(t)), scale: (t) => lerp(s0, 1, p(t)), opacity: fadeCurve(d, 30, easeOutCubic) },
    };
  },
};

export const wipeReveal: AnimationDefinition = {
  ...base,
  id: "wipe-reveal",
  name: "Wipe",
  tagline: "Révélé par un volet net.",
  description: "Le texte (ou le clip) est dévoilé par un volet, grâce à l'effet natif Recadrage de Premiere. Choisissez la direction du volet.",
  category: "slide",
  tags: ["wipe", "volet", "révélation", "recadrage", "crop", "mask", "masque"],
  previewText: "Wipe Reveal",
  uses: ["cropL", "cropR", "cropT", "cropB"],
  params: [
    durationParam(0.6, 3),
    {
      id: "direction",
      label: "Direction",
      type: "choice",
      options: [
        { value: "ltr", label: "Gauche → droite" },
        { value: "rtl", label: "Droite → gauche" },
        { value: "ttb", label: "Haut → bas" },
        { value: "btt", label: "Bas → haut" },
        { value: "center", label: "Depuis le centre" },
      ],
      default: "ltr",
      group: "motion",
    },
    easingParam("quart"),
    staggerParam(0),
  ],
  build(v, ctx) {
    const d = num(v, "duration", 0.6);
    const ease = getEasing(str(v, "easing", "quart"));
    const hidden = (t: number) => 100 * (1 - ease(clamp01(t / d)));
    const tracks: Motion["tracks"] = {};
    switch (str(v, "direction", "ltr")) {
      case "rtl":
        tracks.cropL = hidden;
        break;
      case "ttb":
        tracks.cropB = hidden;
        break;
      case "btt":
        tracks.cropT = hidden;
        break;
      case "center":
        tracks.cropL = (t) => hidden(t) / 2;
        tracks.cropR = (t) => hidden(t) / 2;
        break;
      default:
        tracks.cropR = hidden;
    }
    return { delay: cascadeDelay(v, ctx), duration: d, tracks };
  },
};

export const typewriter: AnimationDefinition = {
  ...base,
  id: "typewriter",
  name: "Typewriter",
  tagline: "Apparaît lettre après lettre, façon machine à écrire.",
  description:
    "Le texte se dévoile par à-coups de gauche à droite, comme tapé à la machine (effet Recadrage). Réglez la zone horizontale occupée par votre texte et le nombre de lettres pour un rythme parfait.",
  category: "word",
  tags: ["typewriter", "machine à écrire", "lettre", "lettre par lettre", "frappe", "code", "terminal"],
  previewText: "Typewriter",
  uses: ["cropR"],
  params: [
    durationParam(1.2, 6),
    { id: "letters", label: "Nombre de lettres", type: "number", min: 2, max: 80, step: 1, default: 12, unit: "", group: "motion", hint: "Un à-coup par lettre. Mettez le nombre de caractères de votre texte." },
    { id: "left", label: "Début du texte", type: "number", min: 0, max: 100, step: 1, default: 15, unit: "%", group: "motion", hint: "Position horizontale du début du texte, en % de la largeur de l'image." },
    { id: "right", label: "Fin du texte", type: "number", min: 0, max: 100, step: 1, default: 85, unit: "%", group: "motion" },
    { id: "smooth", label: "Défilement continu", type: "boolean", default: false, group: "style", hint: "Révélation fluide plutôt que lettre par lettre." },
    staggerParam(0),
  ],
  build(v, ctx) {
    const d = num(v, "duration", 1.2);
    const n = Math.max(2, Math.round(num(v, "letters", 12)));
    const left = num(v, "left", 15);
    const right = Math.max(left + 1, num(v, "right", 85));
    const smooth = bool(v, "smooth", false);
    return {
      delay: cascadeDelay(v, ctx),
      duration: d,
      tracks: {
        cropR: (t) => {
          const p = clamp01(t / d);
          if (p >= 1) return 0;
          const q = smooth ? p : Math.floor(p * n) / n;
          return 100 - (left + (right - left) * q);
        },
      },
    };
  },
};

export const flicker: AnimationDefinition = {
  ...base,
  id: "flicker",
  name: "Flicker",
  tagline: "Clignote comme un néon qui s'allume.",
  description: "Le texte s'allume en clignotant de façon irrégulière, comme un néon ou un signal instable, puis se stabilise.",
  category: "accent",
  tags: ["flicker", "néon", "clignote", "glitch", "lumière", "instable"],
  previewText: "Flicker",
  uses: ["opacity"],
  params: [durationParam(0.8, 3), { id: "frequency", label: "Vitesse de clignotement", type: "number", min: 4, max: 30, step: 1, default: 14, unit: "", group: "motion" }, staggerParam(0)],
  build(v, ctx) {
    const d = num(v, "duration", 0.8);
    const noise = steppedNoise(53, num(v, "frequency", 14));
    return {
      delay: cascadeDelay(v, ctx),
      duration: d,
      tracks: {
        opacity: (t) => {
          const p = clamp01(t / d);
          if (p >= 1) return 1;
          if (p <= 0) return 0;
          // Probabilité d'être allumé croissante dans le temps.
          return noise(t) > 1 - 2 * Math.pow(p, 0.8) ? 1 : 0.08;
        },
      },
    };
  },
};

export const TEXT_EXTRA: AnimationDefinition[] = [fadeIn, zoomIn, spinIn, swingIn, wipeReveal, typewriter, flicker];
