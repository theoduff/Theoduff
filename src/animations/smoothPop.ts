import { clamp01, easeOutBackWithOvershoot, easeOutCubic, getEasing, lerp } from "../engine/easing";
import type { AnimationDefinition } from "../engine/types";
import { cascadeDelay, durationParam, fadeCurve, fadeParam, num, staggerParam, str } from "./common";

/**
 * Smooth Pop — zoom rapide, léger dépassement d'échelle, retour fluide à 100 %.
 */
export const smoothPop: AnimationDefinition = {
  id: "smooth-pop",
  name: "Smooth Pop",
  tagline: "Zoom rapide, léger dépassement, retour fluide.",
  description:
    "Le texte jaillit depuis une petite échelle, dépasse légèrement sa taille finale puis s'y pose en douceur. L'entrée de référence pour les titres, chiffres clés et sous-titres dynamiques.",
  category: "pop",
  kind: "entrance",
  subject: "text",
  tags: ["pop", "zoom", "scale", "échelle", "apparition", "titre", "reels"],
  previewText: "Smooth Pop",
  uses: ["scale", "opacity"],
  params: [
    durationParam(0.5, 2),
    {
      id: "startScale",
      label: "Échelle de départ",
      type: "number",
      min: 0,
      max: 95,
      step: 1,
      default: 30,
      unit: "%",
      group: "motion",
      hint: "Taille du texte au premier instant, en % de sa taille finale.",
    },
    {
      id: "overshoot",
      label: "Dépassement",
      type: "number",
      min: 0,
      max: 40,
      step: 1,
      default: 10,
      unit: "%",
      group: "motion",
      hint: "Amplitude du « pop » au-delà de 100 %. 0 % = arrivée sans rebond.",
    },
    {
      id: "curve",
      label: "Style de pop",
      type: "choice",
      options: [
        { value: "back", label: "Naturel (Back)" },
        { value: "snap", label: "Claquant (rapide puis doux)" },
        { value: "soft", label: "Doux (sans élan)" },
      ],
      default: "back",
      group: "motion",
    },
    fadeParam(35),
    staggerParam(0),
  ],
  build(v, ctx) {
    const duration = num(v, "duration", 0.5);
    const start = num(v, "startScale", 30) / 100;
    const overshoot = num(v, "overshoot", 10) / 100;
    const style = str(v, "curve", "back");
    let ease = easeOutBackWithOvershoot(overshoot);
    if (style === "snap") {
      // Montée expo très rapide jusqu'au pic, puis retour doux à 1.
      const peakAt = 0.45;
      const up = getEasing("expo");
      ease = (p) =>
        p < peakAt
          ? lerp(0, 1 + overshoot, up(p / peakAt))
          : lerp(1 + overshoot, 1, easeOutCubic(clamp01((p - peakAt) / (1 - peakAt))));
    } else if (style === "soft") {
      ease = getEasing("silk");
    }
    return {
      delay: cascadeDelay(v, ctx),
      duration,
      tracks: {
        scale: (t) => lerp(start, 1, ease(clamp01(t / duration))),
        opacity: fadeCurve(duration, num(v, "fade", 35), easeOutCubic),
      },
    };
  },
};
