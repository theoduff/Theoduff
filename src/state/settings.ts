import type { Precision } from "../engine/plan";

/** Référence de temps utilisée pour positionner les images clés dans le clip. */
export type TimeBase = "media" | "sequence" | "clip";
/** Point autour duquel les zooms sont calculés. */
export type PivotMode = "auto" | "frame" | "lowerThird" | "clip" | "custom";

export interface Settings {
  timeBase: TimeBase;
  precision: Precision;
  /** Supprime les images clés existantes dans la zone animée avant d'écrire les nouvelles. */
  replaceExisting: boolean;
  pivot: PivotMode;
  /** Pivot personnalisé, en % de la largeur / hauteur de l'image. */
  pivotX: number;
  pivotY: number;
  /** Texte utilisé dans les aperçus. Vide = nom de l'animation. */
  previewText: string;
  /** Lecture automatique des aperçus de toutes les cartes (sinon : au survol). */
  autoplayCards: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  timeBase: "media",
  precision: "optimized",
  replaceExisting: true,
  pivot: "auto",
  pivotX: 50,
  pivotY: 50,
  previewText: "",
  autoplayCards: false,
};

export function sanitizeSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return s;
  const r = raw as Record<string, unknown>;
  if (r.timeBase === "media" || r.timeBase === "sequence" || r.timeBase === "clip") s.timeBase = r.timeBase;
  if (r.precision === "optimized" || r.precision === "every-frame") s.precision = r.precision;
  if (typeof r.replaceExisting === "boolean") s.replaceExisting = r.replaceExisting;
  if (["auto", "frame", "lowerThird", "clip", "custom"].includes(r.pivot as string)) s.pivot = r.pivot as PivotMode;
  if (typeof r.pivotX === "number" && Number.isFinite(r.pivotX)) s.pivotX = Math.min(100, Math.max(0, r.pivotX));
  if (typeof r.pivotY === "number" && Number.isFinite(r.pivotY)) s.pivotY = Math.min(100, Math.max(0, r.pivotY));
  if (typeof r.previewText === "string") s.previewText = r.previewText.slice(0, 40);
  if (typeof r.autoplayCards === "boolean") s.autoplayCards = r.autoplayCards;
  return s;
}
