/** Accentuations pour textes déjà à l'écran (pulse, secousse). */
import { clamp01, easeInOutCubic } from "../engine/easing";
import { smoothNoise } from "../engine/noise";
import type { AnimationDefinition } from "../engine/types";
import { durationParam, num } from "./common";

export const pulse: AnimationDefinition = {
  id: "text-pulse",
  name: "Pulse",
  tagline: "Le texte pulse pour attirer l'œil.",
  description: "Une ou plusieurs pulsations d'échelle sur un texte déjà affiché, à la tête de lecture. Idéal pour mettre en valeur un chiffre, un prix ou un mot-clé.",
  category: "accent",
  kind: "accent",
  subject: "text",
  tags: ["pulse", "pulsation", "accent", "mise en valeur", "battement", "chiffre", "prix"],
  previewText: "Pulse",
  uses: ["scale"],
  params: [
    durationParam(0.8, 4),
    { id: "amount", label: "Intensité", type: "number", min: 2, max: 60, step: 1, default: 14, unit: "%", group: "motion" },
    { id: "count", label: "Pulsations", type: "number", min: 1, max: 6, step: 1, default: 2, unit: "", group: "motion" },
  ],
  build(v) {
    const d = num(v, "duration", 0.8);
    const amt = num(v, "amount", 14) / 100;
    const n = Math.max(1, Math.round(num(v, "count", 2)));
    return {
      delay: 0,
      duration: d,
      tracks: {
        scale: (t) => {
          const p = clamp01(t / d) * n;
          const local = p - Math.floor(p);
          const done = p >= n;
          return done ? 1 : 1 + amt * Math.sin(Math.PI * easeInOutCubic(local));
        },
      },
    };
  },
};

export const textShake: AnimationDefinition = {
  id: "text-shake",
  name: "Shake",
  tagline: "Le texte tremble, puis se calme.",
  description: "Un tremblement horizontal rapide qui s'amortit : colère, alerte, erreur, ou simplement pour réveiller le spectateur.",
  category: "accent",
  kind: "accent",
  subject: "text",
  tags: ["shake", "tremblement", "accent", "alerte", "erreur", "colère", "vibration"],
  previewText: "Shake!",
  uses: ["x"],
  params: [
    durationParam(0.6, 3),
    { id: "intensity", label: "Amplitude", type: "number", min: 2, max: 200, step: 1, default: 24, unit: "px", group: "motion" },
    { id: "frequency", label: "Fréquence", type: "number", min: 2, max: 40, step: 0.5, default: 16, unit: "", precision: 1, group: "motion" },
  ],
  build(v) {
    const d = num(v, "duration", 0.6);
    const I = num(v, "intensity", 24);
    const noise = smoothNoise(41, num(v, "frequency", 16));
    return {
      delay: 0,
      duration: d,
      tracks: {
        x: (t) => {
          const p = clamp01(t / d);
          if (p <= 0 || p >= 1) return 0;
          return I * Math.pow(1 - p, 1.5) * Math.min(1, p * 12) * noise(t);
        },
      },
    };
  },
};

export const TEXT_ACCENTS: AnimationDefinition[] = [pulse, textShake];
