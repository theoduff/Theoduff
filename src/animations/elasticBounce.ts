import { clamp01, dampedSpring, easeOutCubic, lerp } from "../engine/easing";
import type { AnimationDefinition, Motion } from "../engine/types";
import { cascadeDelay, durationParam, fadeCurve, fadeParam, num, staggerParam, str } from "./common";

/**
 * Elastic Bounce — apparition avec un rebond élastique naturel.
 */
export const elasticBounce: AnimationDefinition = {
  id: "elastic-bounce",
  name: "Elastic Bounce",
  tagline: "Rebond élastique naturel et réglable.",
  description:
    "Le texte apparaît propulsé par un ressort amorti. Réglez le nombre de rebonds, leur amplitude et l'axe (zoom ou chute verticale) pour passer d'un rebond subtil à un effet cartoon assumé.",
  category: "bounce",
  tags: ["elastic", "bounce", "rebond", "ressort", "spring", "fun", "reels", "sport"],
  previewText: "Bounce!",
  uses: ["scale", "y", "opacity"],
  params: [
    durationParam(1.1, 3),
    {
      id: "mode",
      label: "Type de rebond",
      type: "choice",
      options: [
        { value: "scale", label: "Zoom élastique" },
        { value: "drop", label: "Chute depuis le haut" },
        { value: "rise", label: "Saut depuis le bas" },
      ],
      default: "scale",
      group: "motion",
    },
    {
      id: "bounces",
      label: "Rebonds",
      type: "number",
      min: 1,
      max: 8,
      step: 0.5,
      default: 3,
      unit: "",
      precision: 1,
      group: "motion",
      hint: "Nombre d'oscillations visibles avant l'arrêt (vitesse du ressort).",
    },
    {
      id: "amplitude",
      label: "Amplitude",
      type: "number",
      min: 0,
      max: 100,
      step: 1,
      default: 55,
      unit: "%",
      group: "motion",
      hint: "Force des rebonds : faible = amorti rapide, fort = rebonds marqués.",
    },
    {
      id: "startScale",
      label: "Échelle de départ",
      type: "number",
      min: 0,
      max: 95,
      step: 1,
      default: 0,
      unit: "%",
      group: "motion",
      hint: "Utilisé par le zoom élastique.",
    },
    {
      id: "distance",
      label: "Hauteur de chute",
      type: "number",
      min: 0,
      max: 800,
      step: 1,
      default: 260,
      unit: "px",
      group: "motion",
      hint: "Utilisé par la chute et le saut.",
    },
    fadeParam(20),
    staggerParam(0),
  ],
  build(v, ctx) {
    const duration = num(v, "duration", 1.1);
    const amplitude = clamp01(num(v, "amplitude", 55) / 100);
    // Amplitude → amortissement : 0 % ≈ arrêt quasi immédiat, 100 % ≈ ressort très vivant.
    const decay = lerp(9, 1.6, amplitude);
    const spring = dampedSpring(num(v, "bounces", 3), decay);
    const p = (t: number) => spring(clamp01(t / duration));
    const mode = str(v, "mode", "scale");
    const tracks: Motion["tracks"] = {};
    if (mode === "scale") {
      const s0 = num(v, "startScale", 0) / 100;
      tracks.scale = (t) => Math.max(0, lerp(s0, 1, p(t)));
    } else {
      const d = num(v, "distance", 260) * (mode === "drop" ? -1 : 1);
      tracks.y = (t) => lerp(d, 0, p(t));
    }
    const fade = fadeCurve(duration, num(v, "fade", 20), easeOutCubic);
    if (fade) tracks.opacity = fade;
    return { delay: cascadeDelay(v, ctx), duration, tracks };
  },
};
