/**
 * Recettes : plusieurs effets combinés en un seul clic (images clés fusionnées).
 */
import { combineMotions } from "../engine/combine";
import type { AnimationDefinition, CategoryId, ParamValues } from "../engine/types";
import { cameraShake, glitchJitter, heartbeat, zoomBlurTransition, zoomPunch } from "./video";
import { flash, flashIn } from "./montage";
import { defaultValues, num } from "./common";

interface Part {
  def: AnimationDefinition;
  params?: ParamValues;
}

/** Paramètres dont l'intensité est mise à l'échelle par le curseur « Intensité ». */
const SCALED = ["amount", "intensity", "blur", "rotation", "angle"];

function recipe(id: string, name: string, tagline: string, description: string, category: CategoryId, kind: "accent" | "entrance", parts: Part[], tags: string[]): AnimationDefinition {
  const uses = [...new Set(parts.flatMap((p) => p.def.uses))];
  return {
    id,
    name,
    tagline,
    description: `${description} Recette : ${parts.map((p) => p.def.name).join(" + ")}.`,
    category,
    kind,
    subject: "video",
    tags: ["recette", "combo", ...tags],
    uses,
    params: [
      { id: "intensity", label: "Intensité", type: "number", min: 10, max: 200, step: 5, default: 100, unit: "%", group: "motion", hint: "Agit sur l'intensité de tous les effets de la recette." },
      { id: "speed", label: "Vitesse", type: "number", min: 50, max: 200, step: 5, default: 100, unit: "%", group: "timing", hint: "Accélère ou ralentit l'ensemble." },
    ],
    build(v, ctx) {
      const k = num(v, "intensity", 100) / 100;
      const speed = num(v, "speed", 100) / 100;
      const motions = parts.map((p) => {
        const values: ParamValues = { ...defaultValues(p.def), ...(p.params ?? {}) };
        for (const key of SCALED) if (typeof values[key] === "number") values[key] = (values[key] as number) * k;
        if (typeof values.duration === "number") values.duration = (values.duration as number) / speed;
        return p.def.build(values, ctx);
      });
      return combineMotions(motions);
    },
  };
}

export const RECIPES: AnimationDefinition[] = [
  recipe("recipe-impact-flash", "Impact Flash", "Zoom + secousse + flash, en un clic.", "L'effet choc complet pour un drop, un but ou une révélation.", "combo", "accent", [{ def: zoomPunch }, { def: cameraShake, params: { duration: 0.5 } }, { def: flash }], ["impact", "drop", "but", "sport"]),
  recipe("recipe-drop", "Drop", "Double pulsation et flash sur le temps fort.", "Pensé pour les drops musicaux : deux battements de zoom et un éclair.", "combo", "accent", [{ def: heartbeat, params: { amount: 14 } }, { def: flash, params: { amount: 50 } }], ["drop", "musique", "beat", "clip"]),
  recipe("recipe-glitch-hit", "Glitch Hit", "Sauts glitch + flash bref.", "Une coupure numérique agressive, idéale en transition ou sur un son de glitch.", "combo", "accent", [{ def: glitchJitter, params: { duration: 0.35 } }, { def: flash, params: { duration: 0.15, amount: 45 } }], ["glitch", "tech", "gaming"]),
  recipe("recipe-earthquake", "Séisme", "Grosse secousse avec zoom.", "Une secousse longue et violente avec un zoom qui accompagne : explosion, chute, séisme.", "combo", "accent", [{ def: cameraShake, params: { duration: 1.4, intensity: 55, rotation: 2.5 } }, { def: zoomPunch, params: { duration: 1.4, amount: 8, attack: 10 } }], ["séisme", "explosion", "chute"]),
  recipe("recipe-flash-intro", "Intro Flash", "Le plan arrive en zoom flouté dans un éclair.", "Une entrée de plan spectaculaire pour ouvrir une vidéo ou une séquence.", "combo", "entrance", [{ def: zoomBlurTransition }, { def: flashIn }], ["intro", "ouverture", "flash", "zoom"]),
];
