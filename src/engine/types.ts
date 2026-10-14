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
  | "blur"
  /** Recadrage (effet natif « Recadrage »), en % de l'image : gauche, droite, haut, bas. */
  | "cropL"
  | "cropR"
  | "cropT"
  | "cropB"
  /** Luminosité additionnelle (effet natif « Luminosité et contraste »), 0 = neutre. */
  | "bright";

export const TRACK_KEYS: readonly TrackKey[] = ["scale", "opacity", "x", "y", "rotation", "blur", "cropL", "cropR", "cropT", "cropB", "bright"];

/** Valeur de chaque propriété au repos (fin d'une entrée / début d'une sortie). */
export const REST_VALUES: Readonly<Record<TrackKey, number>> = {
  scale: 1,
  opacity: 1,
  x: 0,
  y: 0,
  rotation: 0,
  blur: 0,
  cropL: 0,
  cropR: 0,
  cropT: 0,
  cropB: 0,
  bright: 0,
};

/** Une courbe : t en secondes, depuis le début du segment (0 → duration). */
export type Curve = (t: number) => number;

/** Le résultat d'une animation d'entrée, pour un texte donné. */
export interface Motion {
  /** Temps d'attente avant le début du mouvement (cascade, décalage). */
  delay: number;
  /** Durée du mouvement lui-même (après `delay`). */
  duration: number;
  /**
   * Courbes par propriété, définies sur [0, duration].
   * - « entrance » : doivent finir au repos ;
   * - « accent »   : doivent partir ET finir au repos (sauf `holdEnd`) ;
   * - « span »     : libres (elles couvrent tout le clip).
   */
  tracks: Partial<Record<TrackKey, Curve>>;
  /** Accent uniquement : la valeur finale est conservée jusqu'à la fin du clip. */
  holdEnd?: boolean;
}

export type AnimationMode = "in" | "out" | "inOut";

/**
 * Nature d'une animation, qui décide de son placement dans le clip :
 * - entrance : apparition / disparition (entrée, sortie, ou les deux) ;
 * - accent   : effet ponctuel à la tête de lecture, au début ou à la fin du clip ;
 * - span     : effet qui couvre toute la durée du clip (push-in, Ken Burns…).
 */
export type AnimationKind = "entrance" | "accent" | "span" | "native";

/** Où placer un accent dans le clip (« markers » : sur chaque marqueur de la séquence). */
export type AccentAnchor = "playhead" | "start" | "end" | "markers";

/** Transition native de Premiere (appliquée telle quelle, sans images clés). */
export interface NativeTransition {
  /** Motifs reconnaissant le matchName (ou le nom affiché) de la transition dans Premiere. */
  patterns: RegExp[];
}

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
  /** Durée du clip en secondes (utilisée par les effets « span »). */
  clipDuration: number;
}

export type CategoryId =
  // Texte
  | "pop"
  | "blur"
  | "slide"
  | "word"
  | "bounce"
  | "accent"
  // Vidéo
  | "zoom"
  | "shake"
  | "camera"
  | "transition"
  // Montage
  | "edit"
  | "native"
  | "fx";

/** Grandes familles affichées dans la barre latérale. */
export type FamilyId = "text" | "video" | "edit";

export interface AnimationDefinition {
  id: string;
  name: string;
  /** Une phrase courte, affichée sous la carte. */
  tagline: string;
  /** Description complète, affichée dans le panneau de personnalisation. */
  description: string;
  category: CategoryId;
  kind: AnimationKind;
  /** Sujet de l'aperçu : un texte, ou une image vidéo simulée. */
  subject: "text" | "video";
  tags: string[];
  /** Texte utilisé pour l'aperçu si l'utilisateur n'en a pas saisi. */
  previewText?: string;
  /** L'animation est pensée pour plusieurs calques (un mot par calque). */
  multiLayer?: boolean;
  /** Transition native Premiere (kind « native ») : remplace l'écriture d'images clés. */
  native?: NativeTransition;
  /** Propriétés Premiere touchées (affiché dans l'interface, et utile au moteur). */
  uses: TrackKey[];
  params: ParamSpec[];
  build(params: ParamValues, ctx: BuildContext): Motion;
}
