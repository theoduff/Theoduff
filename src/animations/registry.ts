/**
 * Registre des animations et des catégories.
 *
 * Ajouter une animation = créer un fichier qui exporte une `AnimationDefinition`
 * et l'ajouter à `ANIMATIONS`. L'interface (cartes, recherche, catégories,
 * panneau de réglages, aperçus) et le moteur d'application s'adaptent seuls.
 */
import type { AnimationDefinition, CategoryId, ParamValues } from "../engine/types";
import { blurReveal } from "./blurReveal";
import { elasticBounce } from "./elasticBounce";
import { slideUp } from "./slideUp";
import { smoothPop } from "./smoothPop";
import { wordByWord } from "./wordByWord";

export const ANIMATIONS: readonly AnimationDefinition[] = [smoothPop, blurReveal, slideUp, wordByWord, elasticBounce];

export interface Category {
  id: CategoryId;
  label: string;
}

/** Ordre d'affichage. Seules les catégories contenant au moins une animation sont montrées. */
export const CATEGORIES: readonly Category[] = [
  { id: "pop", label: "Pop & Zoom" },
  { id: "blur", label: "Flou" },
  { id: "slide", label: "Glissements" },
  { id: "word", label: "Mot par mot" },
  { id: "letter", label: "Lettre par lettre" },
  { id: "bounce", label: "Rebonds" },
  { id: "rotate", label: "Rotations" },
  { id: "sport", label: "Sport" },
  { id: "subtitle", label: "Sous-titres" },
  { id: "reels", label: "Reels" },
];

export const getAnimation = (id: string | undefined) => ANIMATIONS.find((a) => a.id === id);

export function defaultParams(def: AnimationDefinition): ParamValues {
  const out: ParamValues = {};
  for (const p of def.params) out[p.id] = p.default;
  return out;
}

/** Fusionne des valeurs sauvegardées avec les valeurs par défaut, en les bornant. */
export function sanitizeParams(def: AnimationDefinition, values: ParamValues | undefined): ParamValues {
  const out = defaultParams(def);
  if (!values) return out;
  for (const p of def.params) {
    const v = values[p.id];
    if (p.type === "number" && typeof v === "number" && Number.isFinite(v)) {
      out[p.id] = Math.min(p.max, Math.max(p.min, v));
    } else if (p.type === "choice" && typeof v === "string" && p.options.some((o) => o.value === v)) {
      out[p.id] = v;
    } else if (p.type === "boolean" && typeof v === "boolean") {
      out[p.id] = v;
    }
  }
  return out;
}

/** Recherche tolérante : accents, casse et ordre des mots ignorés. */
export function matchesQuery(def: AnimationDefinition, query: string): boolean {
  const q = normalize(query).split(/\s+/).filter(Boolean);
  if (!q.length) return true;
  const category = CATEGORIES.find((c) => c.id === def.category)?.label ?? "";
  const hay = normalize([def.name, def.tagline, def.description, category, ...def.tags].join(" "));
  return q.every((term) => hay.includes(term));
}

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
