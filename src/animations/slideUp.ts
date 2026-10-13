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
 * Slide Up — le texte arrive du bas avec un mouvement fluide et un easing pro.
 */
export const slideUp: AnimationDefinition = {
  id: "slide-up",
  name: "Slide Up",
  tagline: "Arrivée par le bas, fluide et précise.",
  description:
    "Le texte monte depuis le bas et se pose avec une décélération soignée. La direction est réglable pour décliner l'effet en Slide Down / Left / Right.",
  category: "slide",
  tags: ["slide", "glissement", "up", "montée", "position", "lower third", "sous-titre"],
  previewText: "Slide Up",
  uses: ["x", "y", "opacity"],
  params: [
    durationParam(0.6, 3),
    {
      id: "distance",
      label: "Distance",
      type: "number",
      min: 0,
      max: 600,
      step: 1,
      default: 120,
      unit: "px",
      group: "motion",
      hint: "Distance parcourue, en pixels d'une séquence 1080p (adaptée automatiquement à votre résolution).",
    },
    directionParam("up"),
    easingParam("quint"),
    fadeParam(50),
    staggerParam(0),
  ],
  build(v, ctx) {
    const duration = num(v, "duration", 0.6);
    const ease = getEasing(str(v, "easing", "quint"));
    const off = startOffset(str(v, "direction", "up"), num(v, "distance", 120));
    const p = (t: number) => ease(clamp01(t / duration));
    const tracks: Motion["tracks"] = {};
    if (off.x) tracks.x = (t) => lerp(off.x, 0, p(t));
    if (off.y) tracks.y = (t) => lerp(off.y, 0, p(t));
    const fade = fadeCurve(duration, num(v, "fade", 50), easeOutCubic);
    if (fade) tracks.opacity = fade;
    return { delay: cascadeDelay(v, ctx), duration, tracks };
  },
};
