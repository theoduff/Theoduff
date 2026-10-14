/**
 * Registre des animations et des catégories.
 *
 * Ajouter une animation = créer un fichier qui exporte une `AnimationDefinition`
 * et l'ajouter à `ANIMATIONS`. L'interface (cartes, recherche, catégories,
 * panneau de réglages, aperçus) et le moteur d'application s'adaptent seuls.
 */
import type { AnimationDefinition, CategoryId, FamilyId, ParamValues } from "../engine/types";
import { TEXT_ACCENTS } from "./accents";
import { MONTAGE, NATIVE_TRANSITIONS } from "./montage";
import { TEXT_EXTRA, wipeReveal } from "./textExtra";
import { blurReveal } from "./blurReveal";
import { elasticBounce } from "./elasticBounce";
import { slideUp } from "./slideUp";
import { smoothPop } from "./smoothPop";
import { wordByWord } from "./wordByWord";
import { VIDEO_ANIMATIONS } from "./video";

export const ANIMATIONS: readonly AnimationDefinition[] = [
  smoothPop,
  blurReveal,
  slideUp,
  wordByWord,
  elasticBounce,
  ...TEXT_EXTRA,
  ...TEXT_ACCENTS,
  ...VIDEO_ANIMATIONS,
  {
    ...wipeReveal,
    id: "wipe-transition",
    name: "Wipe (plan)",
    tagline: "Le plan est dévoilé par un volet.",
    category: "transition",
    subject: "video",
  },
  ...MONTAGE,
  ...NATIVE_TRANSITIONS,
];

export interface Category {
  id: CategoryId;
  label: string;
  family: FamilyId;
}

/** Ordre d'affichage. Seules les catégories contenant au moins une animation sont montrées. */
export const CATEGORIES: readonly Category[] = [
  { id: "pop", label: "Pop & Zoom", family: "text" },
  { id: "blur", label: "Flou", family: "text" },
  { id: "slide", label: "Glissements", family: "text" },
  { id: "word", label: "Mot par mot", family: "text" },
  { id: "bounce", label: "Rebonds", family: "text" },
  { id: "accent", label: "Accentuations", family: "text" },
  { id: "zoom", label: "Zooms", family: "video" },
  { id: "shake", label: "Secousses", family: "video" },
  { id: "camera", label: "Caméra", family: "video" },
  { id: "transition", label: "Transitions", family: "video" },
  { id: "edit", label: "Zooms de montage", family: "edit" },
  { id: "native", label: "Transitions Premiere", family: "edit" },
  { id: "fx", label: "Effets", family: "edit" },
];

export const FAMILIES: readonly { id: FamilyId; label: string }[] = [
  { id: "text", label: "Texte" },
  { id: "video", label: "Vidéo" },
  { id: "edit", label: "Montage" },
];

export const familyOf = (def: AnimationDefinition): FamilyId =>
  CATEGORIES.find((c) => c.id === def.category)?.family ?? "text";

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
