/** Outils de montage : zooms de montage, effets, transitions natives Premiere. */
import { clamp01, easeOutCubic } from "../engine/easing";
import { seededRandom } from "../engine/noise";
import type { AnimationDefinition, Motion, NumberParam } from "../engine/types";
import { durationParam, num, str } from "./common";

const pctParam = (id: string, label: string, def: number, min: number, max: number, hint?: string): NumberParam => ({
  id,
  label,
  type: "number",
  min,
  max,
  step: 1,
  default: def,
  unit: "%",
  group: "motion",
  hint,
});

/* ------------------------------------------------------------------ */
/* Zooms de montage                                                      */
/* ------------------------------------------------------------------ */

export const jumpCutZoom: AnimationDefinition = {
  id: "jump-cut-zoom",
  name: "Jump Cut Zoom",
  tagline: "Recadre chaque plan pour dynamiser les coupes.",
  description:
    "Le classique YouTube / interview : sélectionnez tous les plans d'une séquence coupée, MotionCraft alterne le cadrage (plan large / plan serré) pour masquer les jump cuts et relancer l'attention.",
  category: "edit",
  kind: "span",
  subject: "video",
  tags: ["jump cut", "zoom", "recadrage", "youtube", "interview", "podcast", "talking head", "montage"],
  uses: ["scale"],
  params: [
    pctParam("amount", "Zoom des plans serrés", 15, 2, 80),
    {
      id: "pattern",
      label: "Rythme",
      type: "choice",
      options: [
        { value: "alternate", label: "Large / serré" },
        { value: "three", label: "Large / moyen / serré" },
        { value: "random", label: "Aléatoire" },
      ],
      default: "alternate",
      group: "motion",
    },
    { id: "startTight", label: "Commencer serré", type: "boolean", default: false, group: "style" },
  ],
  build(v, ctx) {
    const amt = num(v, "amount", 15) / 100;
    const pattern = str(v, "pattern", "alternate");
    const i = ctx.index + (v.startTight === true ? 1 : 0);
    let level = i % 2;
    if (pattern === "three") level = [0, 0.5, 1][i % 3];
    if (pattern === "random") level = [0, 0.5, 1][Math.floor(seededRandom(97 + ctx.index)() * 3)];
    const s = 1 + amt * level;
    const d = Math.max(0.1, ctx.clipDuration);
    return { delay: 0, duration: d, tracks: { scale: () => s } };
  },
};

export const beatZoom: AnimationDefinition = {
  id: "beat-zoom",
  name: "Beat Zoom",
  tagline: "Un coup de zoom sur chaque marqueur (beat).",
  description:
    "Placez des marqueurs de séquence sur les temps forts de la musique (touche M), sélectionnez vos clips, puis « Sur les marqueurs » : un zoom court est posé sur chaque beat.",
  category: "edit",
  kind: "accent",
  subject: "video",
  tags: ["beat", "musique", "rythme", "marqueurs", "zoom", "clip", "drop", "montage"],
  uses: ["scale"],
  params: [durationParam(0.3, 1.5), pctParam("amount", "Intensité", 8, 1, 50)],
  build(v) {
    const d = num(v, "duration", 0.3);
    const amt = num(v, "amount", 8) / 100;
    return {
      delay: 0,
      duration: d,
      tracks: {
        scale: (t) => {
          const p = clamp01(t / d);
          if (p <= 0 || p >= 1) return 1;
          return 1 + amt * (p < 0.15 ? easeOutCubic(p / 0.15) : Math.pow(1 - (p - 0.15) / 0.85, 2));
        },
      },
    };
  },
};

/* ------------------------------------------------------------------ */
/* Effets (Luminosité & contraste, Recadrage)                            */
/* ------------------------------------------------------------------ */

export const flash: AnimationDefinition = {
  id: "flash",
  name: "Flash",
  tagline: "Éclair blanc sur le temps fort.",
  description: "Un flash lumineux bref (effet natif Luminosité et contraste), parfait sur un beat, une coupe ou un impact. Combine bien avec Zoom Punch.",
  category: "fx",
  kind: "accent",
  subject: "video",
  tags: ["flash", "lumière", "blanc", "impact", "beat", "éclair"],
  uses: ["bright"],
  params: [durationParam(0.25, 1.5), { id: "amount", label: "Intensité", type: "number", min: 10, max: 100, step: 1, default: 70, unit: "", group: "motion" }],
  build(v) {
    const d = num(v, "duration", 0.25);
    const amt = num(v, "amount", 70);
    return {
      delay: 0,
      duration: d,
      tracks: {
        bright: (t) => {
          const p = clamp01(t / d);
          if (p <= 0 || p >= 1) return 0;
          return amt * (p < 0.2 ? p / 0.2 : Math.pow(1 - (p - 0.2) / 0.8, 1.5));
        },
      },
    };
  },
};

export const flashIn: AnimationDefinition = {
  id: "flash-in",
  name: "Flash Cut",
  tagline: "Le plan démarre dans un éclair blanc.",
  description: "Le clip commence surexposé et revient à la normale : la transition « flash » des clips musicaux et des montages sport. En « Sortie », le plan finit dans le flash.",
  category: "fx",
  kind: "entrance",
  subject: "video",
  tags: ["flash", "transition", "blanc", "surexposition", "clip", "sport"],
  uses: ["bright"],
  params: [durationParam(0.35, 2), { id: "amount", label: "Intensité", type: "number", min: 10, max: 100, step: 1, default: 80, unit: "", group: "motion" }],
  build(v) {
    const d = num(v, "duration", 0.35);
    const amt = num(v, "amount", 80);
    return { delay: 0, duration: d, tracks: { bright: (t) => amt * Math.pow(1 - clamp01(t / d), 2) } };
  },
};

export const cinemaBars: AnimationDefinition = {
  id: "cinema-bars",
  name: "Bandes cinéma",
  tagline: "Format cinémascope sur tout le clip.",
  description: "Ajoute des bandes noires en haut et en bas (effet Recadrage) pour un rendu cinéma 2.39:1, sur toute la durée du clip.",
  category: "fx",
  kind: "span",
  subject: "video",
  tags: ["cinéma", "bandes", "letterbox", "cinémascope", "film", "recadrage"],
  uses: ["cropT", "cropB"],
  params: [pctParam("size", "Hauteur des bandes", 12, 1, 40, "En % de la hauteur de l'image, pour chaque bande.")],
  build(v, ctx) {
    const size = num(v, "size", 12);
    const d = Math.max(0.1, ctx.clipDuration);
    return { delay: 0, duration: d, tracks: { cropT: () => size, cropB: () => size } };
  },
};

export const cinemaBarsIn: AnimationDefinition = {
  id: "cinema-bars-in",
  name: "Bandes animées",
  tagline: "Les bandes cinéma se referment sur l'image.",
  description:
    "Les bandes noires glissent depuis les bords à la tête de lecture (ou au début du clip) et restent jusqu'à la fin du clip, pour marquer un moment dramatique.",
  category: "fx",
  kind: "accent",
  subject: "video",
  tags: ["cinéma", "bandes", "letterbox", "dramatique", "recadrage"],
  uses: ["cropT", "cropB"],
  params: [durationParam(0.8, 3), pctParam("size", "Hauteur des bandes", 12, 1, 40)],
  build(v) {
    const d = num(v, "duration", 0.8);
    const size = num(v, "size", 12);
    const bar = (t: number) => size * easeOutCubic(clamp01(t / d));
    return { delay: 0, duration: d, tracks: { cropT: bar, cropB: bar }, holdEnd: true };
  },
};

/* ------------------------------------------------------------------ */
/* Transitions natives Premiere                                          */
/* ------------------------------------------------------------------ */

const nativeParams = [
  durationParam(0.5, 4),
  {
    id: "placement",
    label: "Emplacement",
    type: "choice" as const,
    options: [
      { value: "between", label: "Entre les clips sélectionnés" },
      { value: "start", label: "Au début de chaque clip" },
      { value: "end", label: "À la fin de chaque clip" },
      { value: "both", label: "Début et fin" },
    ],
    default: "between",
    group: "timing" as const,
  },
];

function nativeTransition(
  id: string,
  name: string,
  tagline: string,
  patterns: RegExp[],
  preview: (d: number) => Motion["tracks"],
  tags: string[],
): AnimationDefinition {
  return {
    id: `native-${id}`,
    name,
    tagline,
    description: `Transition native de Premiere « ${name} », posée directement sur vos coupes. Elle reste modifiable comme n'importe quelle transition (durée, alignement) dans la timeline.`,
    category: "native",
    kind: "native",
    subject: "video",
    tags: ["transition", "premiere", "native", ...tags],
    uses: [],
    native: { patterns },
    params: nativeParams,
    build(v) {
      const d = num(v, "duration", 0.5);
      return { delay: 0, duration: d, tracks: preview(d) };
    },
  };
}

const p01 = (t: number, d: number) => clamp01(t / d);

export const NATIVE_TRANSITIONS: AnimationDefinition[] = [
  nativeTransition("cross-dissolve", "Fondu enchaîné", "Le fondu standard entre deux plans.", [/cross ?dissolve/i, /fondu encha[iî]n[ée]$/i], (d) => ({ opacity: (t) => p01(t, d) }), ["fondu", "dissolve"]),
  nativeTransition("dip-black", "Fondu au noir", "Passe par le noir entre deux plans.", [/dip ?to ?black/i, /fondu au noir/i], (d) => ({ opacity: (t) => Math.max(0, p01(t, d) * 2 - 1) }), ["noir", "black", "dip"]),
  nativeTransition("dip-white", "Fondu au blanc", "Passe par le blanc entre deux plans.", [/dip ?to ?white/i, /fondu au blanc/i], (d) => ({ bright: (t) => 100 * (1 - p01(t, d)) }), ["blanc", "white", "dip"]),
  nativeTransition("film-dissolve", "Fondu film", "Fondu plus doux, façon pellicule.", [/film ?dissolve/i, /fondu.*film/i], (d) => ({ opacity: (t) => easeOutCubic(p01(t, d)) }), ["film", "fondu"]),
  nativeTransition("additive-dissolve", "Fondu additif", "Fondu lumineux, les hautes lumières s'additionnent.", [/additive ?dissolve/i, /fondu additif/i], (d) => ({ opacity: (t) => p01(t, d), bright: (t) => 40 * Math.sin(Math.PI * p01(t, d)) }), ["additif", "lumière"]),
  nativeTransition("push", "Pousser", "Le nouveau plan pousse l'ancien hors du cadre.", [/push/i, /pousser/i], (d) => ({ x: (t) => 1920 * (1 - easeOutCubic(p01(t, d))) }), ["push", "pousser", "glissement"]),
  nativeTransition("slide", "Glissement", "Le nouveau plan glisse par-dessus l'ancien.", [/^(?!.*(band|split)).*slide/i, /glisser|glissement/i], (d) => ({ x: (t) => -1920 * (1 - easeOutCubic(p01(t, d))) }), ["slide", "glisser"]),
  nativeTransition("cross-zoom", "Zoom croisé", "Zoom avant rapide entre les deux plans.", [/cross ?zoom/i, /zoom crois/i], (d) => ({ scale: (t) => 1 + 2 * (1 - p01(t, d)), blur: (t) => 40 * (1 - p01(t, d)) }), ["zoom", "croisé"]),
  nativeTransition("wipe", "Volet", "Volet net qui révèle le plan suivant.", [/^(?:ae\.adbe )?wipe$/i, /\bwipe\b/i, /^volet$/i], (d) => ({ cropR: (t) => 100 * (1 - p01(t, d)) }), ["volet", "wipe"]),
  nativeTransition("iris-round", "Iris rond", "Ouverture en cercle, effet rétro.", [/iris ?round/i, /iris (rond|circulaire)/i], (d) => ({ cropL: (t) => 50 * (1 - p01(t, d)), cropR: (t) => 50 * (1 - p01(t, d)), cropT: (t) => 50 * (1 - p01(t, d)), cropB: (t) => 50 * (1 - p01(t, d)) }), ["iris", "rond", "rétro"]),
  nativeTransition("barn-doors", "Portes", "Deux volets s'ouvrent depuis le centre.", [/barn ?doors/i, /portes/i], (d) => ({ cropL: (t) => 50 * (1 - p01(t, d)), cropR: (t) => 50 * (1 - p01(t, d)) }), ["portes", "barn doors"]),
  nativeTransition("split", "Division", "L'image se sépare en deux.", [/split/i, /division|scinder/i], (d) => ({ cropT: (t) => 50 * (1 - p01(t, d)), cropB: (t) => 50 * (1 - p01(t, d)) }), ["split", "division"]),
];

export const MONTAGE: AnimationDefinition[] = [jumpCutZoom, beatZoom, flash, flashIn, cinemaBars, cinemaBarsIn];
