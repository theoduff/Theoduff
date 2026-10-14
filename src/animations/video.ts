/**
 * Effets vidéo : zooms, secousses, mouvements de caméra et transitions.
 * Ils s'appliquent à n'importe quel clip (vidéo, photo, texte, logo).
 */
import { clamp01, easeInOutCubic, easeOutCubic, easeOutExpo, getEasing, lerp } from "../engine/easing";
import { smoothNoise, steppedNoise } from "../engine/noise";
import type { AnimationDefinition, Motion, NumberParam } from "../engine/types";
import { bool, durationParam, easingParam, num, startOffset, str, directionParam } from "./common";

const pct = (id: string, label: string, def: number, min: number, max: number, hint?: string, group: NumberParam["group"] = "motion"): NumberParam => ({
  id,
  label,
  type: "number",
  min,
  max,
  step: 1,
  default: def,
  unit: "%",
  group,
  hint,
});

const px = (id: string, label: string, def: number, max: number, hint?: string): NumberParam => ({
  id,
  label,
  type: "number",
  min: 0,
  max,
  step: 1,
  default: def,
  unit: "px",
  group: "motion",
  hint,
});

const deg = (id: string, label: string, def: number, max: number, hint?: string): NumberParam => ({
  id,
  label,
  type: "number",
  min: 0,
  max,
  step: 0.1,
  default: def,
  unit: "°",
  precision: 1,
  group: "motion",
  hint,
});

const hz = (def: number, max = 30): NumberParam => ({
  id: "frequency",
  label: "Fréquence",
  type: "number",
  min: 0.2,
  max,
  step: 0.1,
  default: def,
  unit: "",
  precision: 1,
  group: "motion",
  hint: "Nombre d'oscillations par seconde.",
});

const hideEdges = {
  id: "hideEdges",
  label: "Masquer les bords noirs",
  type: "boolean" as const,
  default: true,
  group: "style" as const,
  hint: "Agrandit légèrement l'image pendant le mouvement pour ne jamais laisser apparaître de bord noir.",
};

/** Zoom nécessaire pour cacher un décalage de `offsetPx` et une rotation de `rotDeg` (repère 1080). */
const coverScale = (offsetPx: number, rotDeg: number) => 1 + (2 * offsetPx) / 1080 + Math.abs(Math.sin((rotDeg * Math.PI) / 180)) * 1.9;

/** Enveloppe d'accent : attaque rapide puis relâchement (0 → 1 → 0). */
function envelope(attack: number, decayPower = 1.6) {
  return (p: number) => {
    if (p <= 0 || p >= 1) return 0;
    if (p < attack) return easeOutCubic(p / attack);
    return Math.pow(1 - (p - attack) / (1 - attack), decayPower);
  };
}

/* ------------------------------------------------------------------ */
/* Zooms                                                                 */
/* ------------------------------------------------------------------ */

export const zoomPunch: AnimationDefinition = {
  id: "zoom-punch",
  name: "Zoom Punch",
  tagline: "Coup de zoom sec sur le temps fort.",
  description:
    "Un zoom rapide et percutant, placé à la tête de lecture : idéal pour souligner une phrase, un drop musical ou une réaction. Activez « Rester zoomé » pour un zoom « cut » qui ne revient pas.",
  category: "zoom",
  kind: "accent",
  subject: "video",
  tags: ["zoom", "punch", "impact", "cut", "beat", "temps fort", "reels", "youtube"],
  uses: ["scale"],
  params: [
    durationParam(0.45, 2),
    pct("amount", "Intensité du zoom", 18, 2, 80, "Agrandissement maximal par rapport au cadrage actuel."),
    pct("attack", "Attaque", 22, 5, 80, "Part de la durée consacrée à la montée du zoom."),
    { id: "hold", label: "Rester zoomé", type: "boolean", default: false, group: "style", hint: "Le zoom ne revient pas : effet « zoom cut »." },
  ],
  build(v) {
    const d = num(v, "duration", 0.45);
    const amt = num(v, "amount", 18) / 100;
    const a = num(v, "attack", 22) / 100;
    const hold = bool(v, "hold", false);
    const scale = (t: number) => {
      const p = clamp01(t / d);
      if (hold) return 1 + amt * easeOutExpo(p);
      if (p < a) return 1 + amt * easeOutCubic(p / a);
      return 1 + amt * (1 - easeInOutCubic((p - a) / (1 - a)));
    };
    return { delay: 0, duration: d, tracks: { scale }, holdEnd: hold };
  },
};

export const heartbeat: AnimationDefinition = {
  id: "heartbeat-zoom",
  name: "Heartbeat",
  tagline: "Double pulsation, comme un battement de cœur.",
  description: "Deux zooms rapprochés, le second plus léger : une pulsation organique pour rythmer un montage sur la musique ou appuyer un moment de tension.",
  category: "zoom",
  kind: "accent",
  subject: "video",
  tags: ["heartbeat", "battement", "pulse", "pulsation", "zoom", "beat", "musique"],
  uses: ["scale"],
  params: [durationParam(0.7, 2), pct("amount", "Intensité", 10, 2, 40), pct("second", "Second battement", 65, 0, 100, "Force du second battement par rapport au premier.")],
  build(v) {
    const d = num(v, "duration", 0.7);
    const amt = num(v, "amount", 10) / 100;
    const k2 = num(v, "second", 65) / 100;
    const beat = envelope(0.3, 2);
    const scale = (t: number) => {
      const p = clamp01(t / d);
      const b1 = p < 0.45 ? beat(p / 0.45) : 0;
      const b2 = p >= 0.4 ? beat((p - 0.4) / 0.6) * k2 : 0;
      return 1 + amt * Math.max(b1, b2);
    };
    return { delay: 0, duration: d, tracks: { scale } };
  },
};

export const elasticZoom: AnimationDefinition = {
  id: "elastic-zoom",
  name: "Elastic Zoom",
  tagline: "Zoom qui rebondit avant de se stabiliser.",
  description: "Un coup de zoom suivi d'oscillations amorties, façon ressort. Très efficace sur les réactions, les chutes et les moments comiques.",
  category: "zoom",
  kind: "accent",
  subject: "video",
  tags: ["elastic", "ressort", "rebond", "zoom", "bounce", "fun", "réaction"],
  uses: ["scale"],
  params: [
    durationParam(0.9, 3),
    pct("amount", "Intensité", 16, 2, 60),
    { id: "bounces", label: "Rebonds", type: "number", min: 1, max: 8, step: 0.5, default: 3, unit: "", precision: 1, group: "motion" },
    pct("damping", "Amortissement", 55, 0, 100, "Plus la valeur est haute, plus les rebonds s'éteignent vite."),
  ],
  build(v) {
    const d = num(v, "duration", 0.9);
    const amt = num(v, "amount", 16) / 100;
    const n = num(v, "bounces", 3);
    const decay = lerp(1.5, 7, num(v, "damping", 55) / 100);
    const scale = (t: number) => {
      const p = clamp01(t / d);
      return 1 + amt * Math.exp(-decay * p) * Math.sin(Math.PI * 2 * n * p) * (1 - Math.pow(p, 6));
    };
    return { delay: 0, duration: d, tracks: { scale } };
  },
};

/* ------------------------------------------------------------------ */
/* Caméra (sur toute la durée du clip)                                   */
/* ------------------------------------------------------------------ */

export const pushIn: AnimationDefinition = {
  id: "slow-push-in",
  name: "Push-in lent",
  tagline: "Avancée lente et cinématographique.",
  description: "Un zoom progressif sur toute la durée du clip, comme un travelling avant. Donne du souffle aux interviews, aux plans fixes et aux photos.",
  category: "camera",
  kind: "span",
  subject: "video",
  tags: ["push", "zoom", "lent", "travelling", "cinéma", "interview", "documentaire"],
  uses: ["scale"],
  params: [
    pct("amount", "Zoom total", 12, 1, 60, "Agrandissement atteint à la fin du clip."),
    {
      id: "curve",
      label: "Courbe",
      type: "choice",
      options: [
        { value: "linear", label: "Constante" },
        { value: "inout", label: "Douce" },
        { value: "out", label: "Décélérée" },
      ],
      default: "linear",
      group: "motion",
    },
  ],
  build(v, ctx) {
    const amt = num(v, "amount", 12) / 100;
    const ease = { linear: (p: number) => p, inout: easeInOutCubic, out: easeOutCubic }[str(v, "curve", "linear") as "linear"] ?? ((p: number) => p);
    const d = Math.max(0.1, ctx.clipDuration);
    return { delay: 0, duration: d, tracks: { scale: (t) => 1 + amt * ease(clamp01(t / d)) } };
  },
};

export const pullOut: AnimationDefinition = {
  ...pushIn,
  id: "slow-pull-out",
  name: "Pull-out lent",
  tagline: "Recul lent qui révèle le cadre.",
  description: "Le plan commence légèrement zoomé et recule doucement jusqu'au cadrage d'origine sur toute la durée du clip. Parfait pour conclure une séquence.",
  tags: ["pull", "recul", "dézoom", "zoom arrière", "lent", "cinéma"],
  build(v, ctx) {
    const m = pushIn.build(v, ctx);
    const amt = num(v, "amount", 12) / 100;
    const s = m.tracks.scale!;
    return { ...m, tracks: { scale: (t) => 1 + amt - (s(t) - 1) } };
  },
};

export const kenBurns: AnimationDefinition = {
  id: "ken-burns",
  name: "Ken Burns",
  tagline: "Zoom et panoramique doux sur toute la durée.",
  description: "Le classique du documentaire : un zoom lent combiné à un léger panoramique. Donne vie aux photos et aux plans statiques.",
  category: "camera",
  kind: "span",
  subject: "video",
  tags: ["ken burns", "photo", "panoramique", "pan", "zoom", "documentaire", "diaporama"],
  uses: ["scale", "x", "y"],
  params: [
    pct("startZoom", "Zoom de départ", 8, 0, 60),
    pct("endZoom", "Zoom d'arrivée", 20, 0, 80),
    directionParam("left", "Sens du panoramique"),
    px("distance", "Amplitude du panoramique", 60, 400),
    easingParam("inout", "Courbe"),
  ],
  build(v, ctx) {
    const s0 = 1 + num(v, "startZoom", 8) / 100;
    const s1 = 1 + num(v, "endZoom", 20) / 100;
    const dist = num(v, "distance", 60);
    // Le panoramique part d'un côté et finit de l'autre, centré sur la position d'origine.
    const dir = startOffset(str(v, "direction", "left"), dist / 2);
    const ease = getEasing(str(v, "easing", "inout"), "inout");
    const d = Math.max(0.1, ctx.clipDuration);
    const p = (t: number) => ease(clamp01(t / d));
    const tracks: Motion["tracks"] = { scale: (t) => lerp(s0, s1, p(t)) };
    if (dir.x) tracks.x = (t) => lerp(dir.x, -dir.x, p(t));
    if (dir.y) tracks.y = (t) => lerp(dir.y, -dir.y, p(t));
    return { delay: 0, duration: d, tracks };
  },
};

export const handheld: AnimationDefinition = {
  id: "handheld",
  name: "Caméra à l'épaule",
  tagline: "Léger flottement organique, comme filmé à la main.",
  description: "Ajoute un mouvement de caméra portée, subtil et naturel, sur toute la durée du clip. L'image est légèrement agrandie pour ne jamais montrer de bord.",
  category: "camera",
  kind: "span",
  subject: "video",
  tags: ["handheld", "épaule", "caméra", "flottement", "organique", "réaliste", "drift"],
  uses: ["x", "y", "rotation", "scale"],
  params: [px("intensity", "Intensité", 14, 80), hz(0.6, 4), deg("rotation", "Rotation", 0.6, 5), { ...hideEdges }],
  build(v, ctx) {
    const I = num(v, "intensity", 14);
    const R = num(v, "rotation", 0.6);
    const f = num(v, "frequency", 0.6);
    const nx = smoothNoise(11, f);
    const ny = smoothNoise(23, f * 0.9);
    const nr = smoothNoise(37, f * 0.7);
    const d = Math.max(0.1, ctx.clipDuration);
    const tracks: Motion["tracks"] = {
      x: (t) => I * nx(t),
      y: (t) => I * ny(t),
    };
    if (R > 0) tracks.rotation = (t) => R * nr(t);
    if (bool(v, "hideEdges", true)) {
      const cover = coverScale(I, R);
      tracks.scale = () => cover;
    }
    return { delay: 0, duration: d, tracks };
  },
};

/* ------------------------------------------------------------------ */
/* Secousses (accents)                                                   */
/* ------------------------------------------------------------------ */

export const cameraShake: AnimationDefinition = {
  id: "camera-shake",
  name: "Camera Shake",
  tagline: "Secousse de caméra réaliste et réglable.",
  description: "Une secousse naturelle (position et rotation) qui s'éteint progressivement, placée à la tête de lecture. Pour les explosions, les impacts, les chutes ou les basses.",
  category: "shake",
  kind: "accent",
  subject: "video",
  tags: ["shake", "secousse", "tremblement", "explosion", "impact", "séisme", "sport"],
  uses: ["x", "y", "rotation", "scale"],
  params: [durationParam(0.8, 4), px("intensity", "Intensité", 28, 200), deg("rotation", "Rotation", 1.2, 10), hz(14, 40), pct("decay", "Amortissement", 60, 0, 100, "Vitesse à laquelle la secousse s'éteint."), { ...hideEdges }],
  build(v) {
    const d = num(v, "duration", 0.8);
    const I = num(v, "intensity", 28);
    const R = num(v, "rotation", 1.2);
    const f = num(v, "frequency", 14);
    const env = envelope(0.08, lerp(0.6, 3, num(v, "decay", 60) / 100));
    const nx = smoothNoise(3, f);
    const ny = smoothNoise(5, f * 1.1);
    const nr = smoothNoise(7, f * 0.8);
    const e = (t: number) => env(clamp01(t / d));
    const tracks: Motion["tracks"] = {
      x: (t) => I * e(t) * nx(t),
      y: (t) => I * e(t) * ny(t),
    };
    if (R > 0) tracks.rotation = (t) => R * e(t) * nr(t);
    if (bool(v, "hideEdges", true)) {
      const cover = coverScale(I, R) - 1;
      tracks.scale = (t) => 1 + cover * Math.min(1, e(t) * 1.6);
    }
    return { delay: 0, duration: d, tracks };
  },
};

export const impact: AnimationDefinition = {
  id: "impact",
  name: "Impact",
  tagline: "Zoom + secousse violente : effet choc.",
  description: "Combinaison d'un coup de zoom et d'une secousse saccadée très courte. Parfait pour les effets sportifs, les coups, les transitions énergiques.",
  category: "shake",
  kind: "accent",
  subject: "video",
  tags: ["impact", "choc", "sport", "coup", "punch", "shake", "énergie"],
  uses: ["scale", "x", "y"],
  params: [durationParam(0.4, 1.5), pct("amount", "Zoom", 15, 0, 60), px("intensity", "Secousse", 40, 200), hz(18, 40)],
  build(v) {
    const d = num(v, "duration", 0.4);
    const amt = num(v, "amount", 15) / 100;
    const I = num(v, "intensity", 40);
    const f = num(v, "frequency", 18);
    const env = envelope(0.06, 2.2);
    const nx = steppedNoise(13, f);
    const ny = steppedNoise(17, f);
    const e = (t: number) => env(clamp01(t / d));
    return {
      delay: 0,
      duration: d,
      tracks: {
        scale: (t) => 1 + (amt + (2 * I) / 1080) * e(t),
        x: (t) => I * e(t) * nx(t),
        y: (t) => I * e(t) * ny(t),
      },
    };
  },
};

export const glitchJitter: AnimationDefinition = {
  id: "glitch-jitter",
  name: "Glitch Jitter",
  tagline: "Sauts d'image saccadés, style glitch.",
  description: "Des décalages horizontaux brusques et irréguliers, comme un signal vidéo instable. À combiner avec un son de glitch.",
  category: "shake",
  kind: "accent",
  subject: "video",
  tags: ["glitch", "jitter", "saccadé", "numérique", "tech", "erreur", "reels"],
  uses: ["x", "scale"],
  params: [durationParam(0.5, 3), px("intensity", "Amplitude", 60, 300), hz(16, 30), { ...hideEdges }],
  build(v) {
    const d = num(v, "duration", 0.5);
    const I = num(v, "intensity", 60);
    const noise = steppedNoise(29, num(v, "frequency", 16));
    const gate = steppedNoise(31, num(v, "frequency", 16) * 0.5);
    const tracks: Motion["tracks"] = {
      x: (t) => {
        const p = t / d;
        if (p <= 0 || p >= 1) return 0;
        return gate(t) > -0.2 ? I * noise(t) : 0;
      },
    };
    if (bool(v, "hideEdges", true)) {
      const cover = (2 * I) / 1080;
      tracks.scale = (t) => {
        const p = t / d;
        return p <= 0 || p >= 1 ? 1 : 1 + cover * Math.min(1, Math.min(p, 1 - p) * 20);
      };
    }
    return { delay: 0, duration: d, tracks };
  },
};

/* ------------------------------------------------------------------ */
/* Transitions (entrée / sortie de clip)                                 */
/* ------------------------------------------------------------------ */

export const zoomBlurTransition: AnimationDefinition = {
  id: "zoom-blur-transition",
  name: "Zoom Blur",
  tagline: "Transition zoom avec flou de mouvement.",
  description:
    "Le plan arrive (ou repart) avec un zoom rapide et un flou intense. Pour une transition entre deux plans : « Sortie » sur le premier clip, « Entrée » sur le second.",
  category: "transition",
  kind: "entrance",
  subject: "video",
  tags: ["transition", "zoom", "flou", "blur", "rapide", "dynamique", "reels"],
  uses: ["scale", "blur"],
  params: [durationParam(0.4, 2), pct("amount", "Zoom", 60, 5, 300), px("blur", "Flou", 60, 200), easingParam("expo")],
  build(v) {
    const d = num(v, "duration", 0.4);
    const amt = num(v, "amount", 60) / 100;
    const b = num(v, "blur", 60);
    const ease = getEasing(str(v, "easing", "expo"));
    const p = (t: number) => ease(clamp01(t / d));
    return { delay: 0, duration: d, tracks: { scale: (t) => 1 + amt * (1 - p(t)), blur: (t) => b * (1 - p(t)) } };
  },
};

export const whipPan: AnimationDefinition = {
  id: "whip-pan",
  name: "Whip Pan",
  tagline: "Panoramique fouetté avec flou.",
  description:
    "Le plan glisse très vite depuis le côté avec un fort flou, comme un mouvement de caméra fouetté. Pour enchaîner deux plans : « Sortie » sur le premier, « Entrée » sur le second.",
  category: "transition",
  kind: "entrance",
  subject: "video",
  tags: ["whip", "pan", "fouetté", "transition", "glissement", "flou", "rapide"],
  uses: ["x", "y", "blur", "scale"],
  params: [durationParam(0.35, 2), directionParam("left", "Direction"), px("distance", "Distance", 1400, 3000), px("blur", "Flou", 70, 200), easingParam("expo")],
  build(v) {
    const d = num(v, "duration", 0.35);
    const off = startOffset(str(v, "direction", "left"), num(v, "distance", 1400));
    const b = num(v, "blur", 70);
    const ease = getEasing(str(v, "easing", "expo"));
    const p = (t: number) => ease(clamp01(t / d));
    const tracks: Motion["tracks"] = { blur: (t) => b * (1 - p(t)), scale: (t) => 1 + 0.08 * (1 - p(t)) };
    if (off.x) tracks.x = (t) => off.x * (1 - p(t));
    if (off.y) tracks.y = (t) => off.y * (1 - p(t));
    return { delay: 0, duration: d, tracks };
  },
};

export const spinZoom: AnimationDefinition = {
  id: "spin-zoom",
  name: "Spin Zoom",
  tagline: "Rotation + zoom pour une transition spectaculaire.",
  description: "Le plan arrive en tournant depuis un fort zoom, avec un flou qui s'estompe. Très utilisé dans les montages sport, voyage et Reels.",
  category: "transition",
  kind: "entrance",
  subject: "video",
  tags: ["spin", "rotation", "zoom", "transition", "sport", "voyage", "reels"],
  uses: ["rotation", "scale", "blur"],
  params: [
    durationParam(0.5, 2),
    { id: "angle", label: "Rotation", type: "number", min: -720, max: 720, step: 5, default: 180, unit: "°", group: "motion" },
    pct("amount", "Zoom", 80, 0, 300),
    px("blur", "Flou", 40, 200),
    easingParam("expo"),
  ],
  build(v) {
    const d = num(v, "duration", 0.5);
    const angle = num(v, "angle", 180);
    const amt = num(v, "amount", 80) / 100;
    const b = num(v, "blur", 40);
    const ease = getEasing(str(v, "easing", "expo"));
    const p = (t: number) => ease(clamp01(t / d));
    return {
      delay: 0,
      duration: d,
      tracks: { rotation: (t) => angle * (1 - p(t)), scale: (t) => 1 + amt * (1 - p(t)), blur: (t) => b * (1 - p(t)) },
    };
  },
};

export const VIDEO_ANIMATIONS: AnimationDefinition[] = [
  zoomPunch,
  heartbeat,
  elasticZoom,
  pushIn,
  pullOut,
  kenBurns,
  handheld,
  cameraShake,
  impact,
  glitchJitter,
  zoomBlurTransition,
  whipPan,
  spinZoom,
];

