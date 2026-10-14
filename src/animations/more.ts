/** Animations V3.1 : texte (Glitch, Bounce In, Rotate Pop) et vidéo (Smooth Zoom, Rotation Punch, Pendulum, Drift, Tremblement). */
import { clamp01, easeInOutCubic, easeOutBackWithOvershoot, easeOutBounce, easeOutCubic, lerp } from "../engine/easing";
import { smoothNoise, steppedNoise } from "../engine/noise";
import type { AnimationDefinition, Motion } from "../engine/types";
import { bool, cascadeDelay, durationParam, fadeCurve, num, staggerParam } from "./common";

const coverScale = (offsetPx: number, rotDeg: number) => 1 + (2 * offsetPx) / 1080 + Math.abs(Math.sin((rotDeg * Math.PI) / 180)) * 1.9;

/* -------------------------------- Texte ------------------------------- */

export const glitchText: AnimationDefinition = {
  id: "glitch-text",
  name: "Glitch",
  tagline: "Arrive en sautillant, façon signal numérique.",
  description: "Le texte apparaît par sauts horizontaux et clignotements brusques avant de se stabiliser. Parfait pour la tech, le gaming et les intros dynamiques.",
  category: "accent",
  kind: "entrance",
  subject: "text",
  tags: ["glitch", "numérique", "gaming", "tech", "saccadé", "intro"],
  previewText: "Glitch",
  uses: ["x", "opacity"],
  params: [durationParam(0.6, 3), { id: "intensity", label: "Amplitude", type: "number", min: 4, max: 200, step: 1, default: 40, unit: "px", group: "motion" }, staggerParam(0)],
  build(v, ctx) {
    const d = num(v, "duration", 0.6);
    const I = num(v, "intensity", 40);
    const nx = steppedNoise(61, 18);
    const gate = steppedNoise(67, 14);
    const p = (t: number) => clamp01(t / d);
    return {
      delay: cascadeDelay(v, ctx),
      duration: d,
      tracks: {
        x: (t) => (p(t) >= 1 || p(t) <= 0 ? 0 : I * (1 - p(t)) * nx(t)),
        opacity: (t) => (p(t) >= 1 ? 1 : p(t) <= 0 ? 0 : gate(t) > 0.6 - p(t) ? 1 : 0.1),
      },
    };
  },
};

export const bounceIn: AnimationDefinition = {
  id: "bounce-in",
  name: "Bounce In",
  tagline: "Tombe et rebondit comme une balle.",
  description: "Le texte tombe depuis le haut et rebondit au sol avant de se poser, avec une vraie physique de balle.",
  category: "bounce",
  kind: "entrance",
  subject: "text",
  tags: ["bounce", "rebond", "chute", "balle", "gravité", "fun"],
  previewText: "Bounce",
  uses: ["y", "opacity"],
  params: [durationParam(0.9, 3), { id: "distance", label: "Hauteur", type: "number", min: 20, max: 800, step: 5, default: 300, unit: "px", group: "motion" }, staggerParam(0)],
  build(v, ctx) {
    const d = num(v, "duration", 0.9);
    const h = num(v, "distance", 300);
    return {
      delay: cascadeDelay(v, ctx),
      duration: d,
      tracks: { y: (t) => -h * (1 - easeOutBounce(clamp01(t / d))), opacity: fadeCurve(d, 15, easeOutCubic) },
    };
  },
};

export const rotatePop: AnimationDefinition = {
  id: "rotate-pop",
  name: "Rotate Pop",
  tagline: "Pop avec une petite rotation.",
  description: "Variante énergique du pop : le texte grandit en tournant légèrement puis se redresse avec un dépassement.",
  category: "pop",
  kind: "entrance",
  subject: "text",
  tags: ["pop", "rotation", "dynamique", "reels", "tiktok"],
  previewText: "Rotate Pop",
  uses: ["scale", "rotation", "opacity"],
  params: [
    durationParam(0.55, 2),
    { id: "angle", label: "Angle", type: "number", min: -45, max: 45, step: 1, default: -12, unit: "°", group: "motion" },
    { id: "overshoot", label: "Dépassement", type: "number", min: 0, max: 40, step: 1, default: 12, unit: "%", group: "motion" },
    staggerParam(0),
  ],
  build(v, ctx) {
    const d = num(v, "duration", 0.55);
    const back = easeOutBackWithOvershoot(num(v, "overshoot", 12) / 100);
    const angle = num(v, "angle", -12);
    const p = (t: number) => clamp01(t / d);
    return {
      delay: cascadeDelay(v, ctx),
      duration: d,
      tracks: { scale: (t) => lerp(0.2, 1, back(p(t))), rotation: (t) => lerp(angle, 0, back(p(t))), opacity: fadeCurve(d, 30, easeOutCubic) },
    };
  },
};

/* -------------------------------- Vidéo ------------------------------- */

export const smoothZoom: AnimationDefinition = {
  id: "smooth-zoom",
  name: "Smooth Zoom",
  tagline: "Zoom doux qui reste, pour recadrer en cours de plan.",
  description: "Zoom progressif et fluide à la tête de lecture, qui reste jusqu'à la fin du clip : recadre sur une émotion ou un détail sans couper.",
  category: "zoom",
  kind: "accent",
  subject: "video",
  tags: ["zoom", "doux", "recadrage", "émotion", "interview", "progressif"],
  uses: ["scale"],
  params: [durationParam(1.2, 6), { id: "amount", label: "Zoom", type: "number", min: 2, max: 100, step: 1, default: 20, unit: "%", group: "motion" }],
  build(v) {
    const d = num(v, "duration", 1.2);
    const amt = num(v, "amount", 20) / 100;
    return { delay: 0, duration: d, tracks: { scale: (t) => 1 + amt * easeInOutCubic(clamp01(t / d)) }, holdEnd: true };
  },
};

export const rotationPunch: AnimationDefinition = {
  id: "rotation-punch",
  name: "Rotation Punch",
  tagline: "Coup de zoom avec une rotation sèche.",
  description: "Un zoom percutant accompagné d'une légère rotation qui revient : effet très utilisé en sport et en clip musical.",
  category: "zoom",
  kind: "accent",
  subject: "video",
  tags: ["rotation", "punch", "zoom", "sport", "clip", "impact"],
  uses: ["scale", "rotation"],
  params: [
    durationParam(0.5, 2),
    { id: "amount", label: "Zoom", type: "number", min: 2, max: 60, step: 1, default: 16, unit: "%", group: "motion" },
    { id: "angle", label: "Rotation", type: "number", min: -30, max: 30, step: 0.5, default: 5, unit: "°", precision: 1, group: "motion" },
  ],
  build(v) {
    const d = num(v, "duration", 0.5);
    const amt = num(v, "amount", 16) / 100;
    const angle = num(v, "angle", 5);
    const env = (t: number) => {
      const p = clamp01(t / d);
      if (p <= 0 || p >= 1) return 0;
      return p < 0.2 ? easeOutCubic(p / 0.2) : 1 - easeInOutCubic((p - 0.2) / 0.8);
    };
    const cover = Math.abs(Math.sin((angle * Math.PI) / 180)) * 1.9;
    return { delay: 0, duration: d, tracks: { scale: (t) => 1 + (amt + cover) * env(t), rotation: (t) => angle * env(t) } };
  },
};

export const pendulum: AnimationDefinition = {
  id: "pendulum",
  name: "Pendulum",
  tagline: "Léger balancement continu de l'image.",
  description: "L'image se balance doucement de gauche à droite sur toute la durée du clip, sans bord visible. Ambiance rêveuse ou tension sourde.",
  category: "camera",
  kind: "span",
  subject: "video",
  tags: ["pendule", "balancement", "rotation", "rêve", "ambiance"],
  uses: ["rotation", "scale"],
  params: [
    { id: "angle", label: "Amplitude", type: "number", min: 0.2, max: 10, step: 0.1, default: 1.5, unit: "°", precision: 1, group: "motion" },
    { id: "period", label: "Période", type: "number", min: 0.5, max: 10, step: 0.1, default: 3, unit: "s", precision: 1, group: "motion" },
  ],
  build(v, ctx) {
    const a = num(v, "angle", 1.5);
    const T = num(v, "period", 3);
    const cover = coverScale(0, a);
    return { delay: 0, duration: Math.max(0.1, ctx.clipDuration), tracks: { rotation: (t) => a * Math.sin((2 * Math.PI * t) / T), scale: () => cover } };
  },
};

export const driftPan: AnimationDefinition = {
  id: "drift-pan",
  name: "Drift",
  tagline: "Glissement latéral lent sur tout le clip.",
  description: "Un travelling latéral lent et constant (avec un léger zoom pour couvrir l'image), qui donne de la vie aux plans fixes et aux photos.",
  category: "camera",
  kind: "span",
  subject: "video",
  tags: ["drift", "travelling", "latéral", "pan", "lent", "photo"],
  uses: ["x", "scale"],
  params: [
    { id: "distance", label: "Distance", type: "number", min: 10, max: 400, step: 5, default: 80, unit: "px", group: "motion" },
    {
      id: "direction",
      label: "Sens",
      type: "choice",
      options: [
        { value: "left", label: "Vers la gauche" },
        { value: "right", label: "Vers la droite" },
      ],
      default: "left",
      group: "motion",
    },
  ],
  build(v, ctx) {
    const dist = num(v, "distance", 80);
    const dir = v.direction === "right" ? 1 : -1;
    const d = Math.max(0.1, ctx.clipDuration);
    const cover = coverScale(dist / 2, 0);
    return { delay: 0, duration: d, tracks: { x: (t) => dir * lerp(-dist / 2, dist / 2, clamp01(t / d)), scale: () => cover } };
  },
};

export const tremor: AnimationDefinition = {
  id: "tremor",
  name: "Tremblement",
  tagline: "Secousse continue, discrète ou intense.",
  description: "Un tremblement permanent sur toute la durée du clip : tension, séisme, véhicule, concert. L'image est agrandie pour cacher les bords.",
  category: "shake",
  kind: "span",
  subject: "video",
  tags: ["tremblement", "secousse", "continu", "séisme", "tension", "concert"],
  uses: ["x", "y", "scale"],
  params: [
    { id: "intensity", label: "Intensité", type: "number", min: 1, max: 80, step: 1, default: 8, unit: "px", group: "motion" },
    { id: "frequency", label: "Fréquence", type: "number", min: 1, max: 30, step: 0.5, default: 9, unit: "", precision: 1, group: "motion" },
    { id: "hideEdges", label: "Masquer les bords noirs", type: "boolean", default: true, group: "style" },
  ],
  build(v, ctx) {
    const I = num(v, "intensity", 8);
    const f = num(v, "frequency", 9);
    const nx = smoothNoise(71, f);
    const ny = smoothNoise(73, f * 1.13);
    const tracks: Motion["tracks"] = { x: (t) => I * nx(t), y: (t) => I * ny(t) };
    if (bool(v, "hideEdges", true)) {
      const cover = coverScale(I, 0);
      tracks.scale = () => cover;
    }
    return { delay: 0, duration: Math.max(0.1, ctx.clipDuration), tracks };
  },
};

export const MORE_TEXT: AnimationDefinition[] = [glitchText, bounceIn, rotatePop];
export const MORE_VIDEO: AnimationDefinition[] = [smoothZoom, rotationPunch, pendulum, driftPan, tremor];
