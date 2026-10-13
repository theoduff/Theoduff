/**
 * Types centraux du moteur d'animation MotionCraft.
 *
 * Le moteur est volontairement indépendant de Premiere Pro : il produit des
 * courbes (fonctions du temps) puis des images clés « cuites » (baked). Les
 * aperçus de l'interface et les images clés envoyées à Premiere sont calculés
 * à partir des MÊMES courbes : ce que l'on voit est ce que l'on obtient.
 */

/** Propriétés animables. Toutes sont exprimées de façon relative à l'état « au repos » du texte. */
export type TrackKey =
  /** Multiplicateur d'échelle (1 = taille actuelle du texte). */
  | "scale"
  /** Multiplicateur d'opacité (1 = opacité actuelle du texte). */
  | "opacity"
  /** Décalage horizontal en pixels de séquence 1080p (converti selon la taille réelle). */
  | "x"
  /** Décalage vertical en pixels de séquence 1080p (positif = vers le bas). */
  | "y"
  /** Rotation additionnelle en degrés. */
  | "rotation"
  /** Flou gaussien absolu (en pixels, pour une séquence 1080p). */
  | "blur";

export const TRACK_KEYS: readonly TrackKey[] = ["scale", "opacity", "x", "y", "rotation", "blur"];

/** Valeur de chaque propriété au repos (fin d'une entrée / début d'une sortie). */
export const REST_VALUES: Readonly<Record<TrackKey, number>> = {
  scale: 1,
  opacity: 1,
  x: 0,
  y: 0,
  rotation: 0,
  blur: 0,
};

/** Une courbe : t en secondes, depuis le début du segment (0 → duration). */
export type Curve = (t: number) => number;

/** Le résultat d'une animation d'entrée, pour un texte donné. */
export interface Motion {
  /** Temps d'attente avant le début du mouvement (cascade, décalage). */
  delay: number;
  /** Durée du mouvement lui-même (après `delay`). */
  duration: number;
  /** Courbes par propriété, définies sur [0, duration]. Doivent finir au repos. */
  tracks: Partial<Record<TrackKey, Curve>>;
}

export type AnimationMode = "in" | "out" | "inOut";

/* ------------------------------------------------------------------ */
/* Paramètres exposés dans l'interface                                  */
/* ------------------------------------------------------------------ */

interface ParamBase {
  id: string;
  label: string;
  /** Aide contextuelle affichée au survol / sous le contrôle. */
  hint?: string;
  /** Groupe d'affichage dans le panneau de personnalisation. */
  group?: "timing" | "motion" | "style";
}

export interface NumberParam extends ParamBase {
  type: "number";
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: "s" | "%" | "px" | "°" | "";
  /** Nombre de décimales affichées. */
  precision?: number;
}

export interface ChoiceParam extends ParamBase {
  type: "choice";
  options: { value: string; label: string }[];
  default: string;
}

export interface BooleanParam extends ParamBase {
  type: "boolean";
  default: boolean;
}

export type ParamSpec = NumberParam | ChoiceParam | BooleanParam;
export type ParamValues = Record<string, number | string | boolean>;

/** Contexte d'un texte à l'intérieur d'un lot (pour les cascades / mot par mot). */
export interface BuildContext {
  /** Position du texte dans l'ordre d'application (0 = premier). */
  index: number;
  /** Nombre total de textes animés ensemble. */
  count: number;
}

export type CategoryId =
  | "pop"
  | "blur"
  | "slide"
  | "word"
  | "bounce"
  | "letter"
  | "rotate"
  | "sport"
  | "subtitle"
  | "reels";

export interface AnimationDefinition {
  id: string;
  name: string;
  /** Une phrase courte, affichée sous la carte. */
  tagline: string;
  /** Description complète, affichée dans le panneau de personnalisation. */
  description: string;
  category: CategoryId;
  tags: string[];
  /** Texte utilisé pour l'aperçu si l'utilisateur n'en a pas saisi. */
  previewText?: string;
  /** L'animation est pensée pour plusieurs calques (un mot par calque). */
  multiLayer?: boolean;
  /** Propriétés Premiere touchées (affiché dans l'interface, et utile au moteur). */
  uses: TrackKey[];
  params: ParamSpec[];
  build(params: ParamValues, ctx: BuildContext): Motion;
}
