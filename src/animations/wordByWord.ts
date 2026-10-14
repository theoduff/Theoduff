import { clamp01, easeOutBackWithOvershoot, easeOutCubic, getEasing, lerp } from "../engine/easing";
import type { AnimationDefinition, Motion } from "../engine/types";
import { durationParam, num, str } from "./common";

/**
 * Word by Word — les mots apparaissent successivement avec une légère
 * animation d'échelle et d'opacité.
 *
 * Premiere Pro n'offre pas (via son API) d'animateurs par mot à l'intérieur
 * d'un seul calque texte. MotionCraft anime donc chaque CALQUE texte
 * sélectionné comme un mot : un mot (ou un groupe de mots) par clip, et le
 * plugin les enchaîne automatiquement dans l'ordre de lecture.
 */
export const wordByWord: AnimationDefinition = {
  id: "word-by-word",
  name: "Word by Word",
  tagline: "Les mots apparaissent l'un après l'autre.",
  description:
    "Chaque texte sélectionné apparaît à son tour avec un léger pop d'échelle et d'opacité. Placez un mot (ou un groupe de mots) par calque texte, sélectionnez-les tous : MotionCraft les enchaîne dans l'ordre de la timeline.",
  category: "word",
  kind: "entrance",
  subject: "text",
  tags: ["mot", "word", "kinetic", "typographie", "sous-titres", "reels", "cascade", "stagger"],
  previewText: "Un mot à la fois",
  multiLayer: true,
  uses: ["scale", "opacity", "y"],
  params: [
    {
      ...durationParam(0.35, 1.5),
      label: "Durée par mot",
      hint: "Durée d'apparition de chaque mot.",
    },
    {
      id: "stagger",
      label: "Intervalle entre mots",
      type: "number",
      min: 0,
      max: 1.5,
      step: 0.01,
      default: 0.14,
      unit: "s",
      precision: 2,
      group: "timing",
      hint: "Temps entre le début de deux mots consécutifs.",
    },
    {
      id: "startScale",
      label: "Échelle de départ",
      type: "number",
      min: 0,
      max: 100,
      step: 1,
      default: 80,
      unit: "%",
      group: "motion",
    },
    {
      id: "overshoot",
      label: "Dépassement",
      type: "number",
      min: 0,
      max: 30,
      step: 1,
      default: 6,
      unit: "%",
      group: "motion",
    },
    {
      id: "rise",
      label: "Montée",
      type: "number",
      min: 0,
      max: 120,
      step: 1,
      default: 14,
      unit: "px",
      group: "motion",
      hint: "Petit mouvement vertical de chaque mot. 0 = désactivé.",
    },
    {
      id: "order",
      label: "Ordre",
      type: "choice",
      options: [
        { value: "forward", label: "Ordre de lecture" },
        { value: "reverse", label: "Ordre inversé" },
        { value: "center", label: "Depuis le centre" },
      ],
      default: "forward",
      group: "timing",
    },
  ],
  build(v, ctx) {
    const duration = num(v, "duration", 0.35);
    const stagger = Math.max(0, num(v, "stagger", 0.14));
    const s0 = num(v, "startScale", 80) / 100;
    const rise = num(v, "rise", 14);
    const scaleEase = easeOutBackWithOvershoot(num(v, "overshoot", 6) / 100);
    const moveEase = getEasing("quint");
    const rank = orderRank(str(v, "order", "forward"), ctx.index, ctx.count);
    const p = (t: number) => clamp01(t / duration);
    const tracks: Motion["tracks"] = {
      opacity: (t) => easeOutCubic(clamp01(t / (duration * 0.6))),
    };
    if (Math.abs(s0 - 1) > 1e-4 || num(v, "overshoot", 6) > 0) tracks.scale = (t) => lerp(s0, 1, scaleEase(p(t)));
    if (rise) tracks.y = (t) => lerp(rise, 0, moveEase(p(t)));
    return { delay: rank * stagger, duration, tracks };
  },
};

/** Rang d'apparition d'un mot selon l'ordre choisi. */
export function orderRank(order: string, index: number, count: number): number {
  if (order === "reverse") return count - 1 - index;
  if (order === "center") {
    // Le(s) mot(s) central(aux) d'abord, puis vers l'extérieur.
    return Math.floor(Math.abs(index - (count - 1) / 2));
  }
  return index;
}
