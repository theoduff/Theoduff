/** Briques communes aux définitions d'animations. */
import { clamp01, easingOptions } from "../engine/easing";
import type { BuildContext, ChoiceParam, NumberParam, ParamValues } from "../engine/types";

export const num = (values: ParamValues, id: string, fallback: number): number => {
  const v = values[id];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};
export const str = (values: ParamValues, id: string, fallback: string): string => {
  const v = values[id];
  return typeof v === "string" ? v : fallback;
};
export const bool = (values: ParamValues, id: string, fallback: boolean): boolean => {
  const v = values[id];
  return typeof v === "boolean" ? v : fallback;
};

export const durationParam = (def: number, max = 3): NumberParam => ({
  id: "duration",
  label: "Durée",
  type: "number",
  min: 0.1,
  max,
  step: 0.05,
  default: def,
  unit: "s",
  precision: 2,
  group: "timing",
  hint: "Durée du mouvement, hors décalage.",
});

export const staggerParam = (def: number, label = "Cascade entre textes"): NumberParam => ({
  id: "stagger",
  label,
  type: "number",
  min: 0,
  max: 1,
  step: 0.01,
  default: def,
  unit: "s",
  precision: 2,
  group: "timing",
  hint: "Si plusieurs textes sont sélectionnés, chacun démarre avec ce décalage par rapport au précédent.",
});

export const easingParam = (def: string, label = "Courbe (easing)"): ChoiceParam => ({
  id: "easing",
  label,
  type: "choice",
  options: easingOptions(),
  default: def,
  group: "motion",
});

export const fadeParam = (def: number): NumberParam => ({
  id: "fade",
  label: "Fondu d'opacité",
  type: "number",
  min: 0,
  max: 100,
  step: 1,
  default: def,
  unit: "%",
  group: "style",
  hint: "Part de la durée pendant laquelle le texte passe de transparent à opaque. 0 % = pas de fondu.",
});

export const directionParam = (def: "up" | "down" | "left" | "right", label = "Direction"): ChoiceParam => ({
  id: "direction",
  label,
  type: "choice",
  options: [
    { value: "up", label: "Vers le haut" },
    { value: "down", label: "Vers le bas" },
    { value: "left", label: "Vers la gauche" },
    { value: "right", label: "Vers la droite" },
  ],
  default: def,
  group: "motion",
});

/** Vecteur de départ (en px) pour qu'un texte arrive en se déplaçant dans `direction`. */
export function startOffset(direction: string, distance: number): { x: number; y: number } {
  switch (direction) {
    case "down":
      return { x: 0, y: -distance };
    case "left":
      return { x: distance, y: 0 };
    case "right":
      return { x: -distance, y: 0 };
    default:
      return { x: 0, y: distance };
  }
}

/** Délai de cascade pour le i-ème texte. */
export const cascadeDelay = (values: ParamValues, ctx: BuildContext, fallback = 0) =>
  Math.max(0, num(values, "stagger", fallback)) * ctx.index;

/** Courbe d'opacité 0 → 1 sur les `fadePct` premiers % de la durée. */
export function fadeCurve(duration: number, fadePct: number, ease: (p: number) => number = (p) => p) {
  const fadeDur = (duration * Math.max(0, Math.min(100, fadePct))) / 100;
  if (fadeDur <= 0) return undefined;
  return (t: number) => ease(clamp01(t / fadeDur));
}
