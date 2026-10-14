import { clamp01, easeOutCubic, getEasing, lerp } from "../engine/easing";
import type { AnimationDefinition, Motion } from "../engine/types";
import {
  cascadeDelay,
  directionParam,
  durationParam,
  easingParam,
  fadeCurve,
  fadeParam,
  num,
  staggerParam,
  startOffset,
  str,
} from "./common";

/**
 * Blur Reveal — passage d'un flou prononcé à une netteté parfaite, avec une
 * légère animation de position. Utilise l'effet natif « Flou gaussien ».
 */
export const blurReveal: AnimationDefinition = {
  id: "blur-reveal",
  name: "Blur Reveal",
  tagline: "Du flou à la netteté, avec un léger glissement.",
  description:
    "Le texte émerge d'un flou prononcé jusqu'à une netteté parfaite tout en glissant légèrement. Ajoute (ou réutilise) l'effet Flou gaussien natif de Premiere Pro sur le clip.",
  category: "blur",
  kind: "entrance",
  subject: "text",
  tags: ["blur", "flou", "reveal", "netteté", "cinéma", "élégant", "focus"],
  previewText: "Blur Reveal",
  uses: ["blur", "opacity", "x", "y", "scale"],
  params: [
    durationParam(0.8, 3),
    {
      id: "blur",
      label: "Flou initial",
      type: "number",
      min: 0,
      max: 120,
      step: 1,
      default: 40,
      unit: "px",
      group: "motion",
      hint: "Intensité du flou gaussien au départ (référence 1080p).",
    },
    {
      id: "distance",
      label: "Déplacement",
      type: "number",
      min: 0,
      max: 300,
      step: 1,
      default: 40,
      unit: "px",
      group: "motion",
    },
    directionParam("up", "Direction du glissement"),
    {
      id: "startScale",
      label: "Échelle de départ",
      type: "number",
      min: 80,
      max: 130,
      step: 1,
      default: 104,
      unit: "%",
      group: "motion",
      hint: "Un léger zoom arrière renforce l'effet de mise au point. 100 % = désactivé.",
    },
    easingParam("quart"),
    fadeParam(70),
    staggerParam(0),
  ],
  build(v, ctx) {
    const duration = num(v, "duration", 0.8);
    const ease = getEasing(str(v, "easing", "quart"));
    const blur0 = num(v, "blur", 40);
    const off = startOffset(str(v, "direction", "up"), num(v, "distance", 40));
    const s0 = num(v, "startScale", 104) / 100;
    const p = (t: number) => ease(clamp01(t / duration));
    const tracks: Motion["tracks"] = {};
    if (blur0 > 0) tracks.blur = (t) => lerp(blur0, 0, p(t));
    if (off.x) tracks.x = (t) => lerp(off.x, 0, p(t));
    if (off.y) tracks.y = (t) => lerp(off.y, 0, p(t));
    if (Math.abs(s0 - 1) > 1e-4) tracks.scale = (t) => lerp(s0, 1, p(t));
    const fade = fadeCurve(duration, num(v, "fade", 70), easeOutCubic);
    if (fade) tracks.opacity = fade;
    return { delay: cascadeDelay(v, ctx), duration, tracks };
  },
};
