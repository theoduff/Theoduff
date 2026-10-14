/**
 * Planificateur : transforme une animation relative (échelle ×, décalages en px…)
 * en valeurs absolues pour les paramètres Premiere d'un clip précis.
 *
 * Module pur (aucune dépendance à Premiere) : il est entièrement testé sous Linux.
 */
import { evaluateKeys, placeMotion, sampleTrack, simplifyKeys, type FrameKey, type PlacementSpec } from "./timeline";
import type { AnimationMode, Motion, TrackKey } from "./types";

export interface Point {
  x: number;
  y: number;
}

/** État « au repos » d'un clip, lu dans Premiere avant l'application. */
export interface ClipState {
  /** Durée du clip en images. */
  durationFrames: number;
  fps: number;
  frameWidth: number;
  frameHeight: number;
  /** Paramètre Position du composant Mouvement (unités natives). */
  position: Point;
  /** Vrai si Premiere exprime la position en coordonnées normalisées (0–1). */
  positionNormalized: boolean;
  /** Paramètre Point d'ancrage du composant Mouvement (mêmes unités que position). */
  anchor: Point;
  /** Échelle en % (100 = taille d'origine). */
  scale: number;
  /** Opacité en % (0–100). */
  opacity: number;
  /** Rotation en degrés. */
  rotation: number;
  /**
   * Centre visuel du texte à l'écran, en pixels de séquence, si connu.
   * Sert de pivot pour les zooms (sinon le texte « glisserait » vers le centre).
   */
  pivot?: Point;
}

export type PlanTarget = "position" | "scale" | "opacity" | "rotation" | "blur";

export interface ParamKey<V> {
  frame: number;
  value: V;
}

export interface ClipPlan {
  /** Images clés par paramètre (valeurs absolues, unités Premiere). */
  scale?: ParamKey<number>[];
  opacity?: ParamKey<number>[];
  rotation?: ParamKey<number>[];
  blur?: ParamKey<number>[];
  position?: ParamKey<Point>[];
  /** Plages animées (en images). */
  ranges: [number, number][];
  /**
   * Plages à nettoyer avant écriture (en images) : la moitié du clip concernée
   * par l'entrée et/ou la sortie, pour effacer une animation précédente plus longue.
   */
  clearRanges: [number, number][];
  warnings: string[];
  /** Nombre total d'images clés créées. */
  keyCount: number;
}

export type Precision = "optimized" | "every-frame";

/** Tolérances de simplification, dans l'unité de chaque propriété relative. */
const TOLERANCE: Record<TrackKey, number> = {
  scale: 0.0015, // 0,15 % d'échelle
  opacity: 0.002, // 0,2 % d'opacité
  x: 0.2, // 0,2 px (référence 1080)
  y: 0.2,
  rotation: 0.05, // 0,05°
  blur: 0.15, // 0,15 px de flou
};

/** Échelle de référence : les distances sont pensées pour un petit côté de 1080 px. */
export const resolutionFactor = (s: Pick<ClipState, "frameWidth" | "frameHeight">) =>
  Math.min(s.frameWidth, s.frameHeight) / 1080;

export function buildClipPlan(
  motion: Motion,
  spec: PlacementSpec | AnimationMode,
  state: ClipState,
  precision: Precision = "optimized",
): ClipPlan {
  const { fps } = state;
  const clipDuration = state.durationFrames / fps;
  const placement: PlacementSpec = typeof spec === "string" ? { type: "entrance", mode: spec } : spec;
  const timeline = placeMotion(motion, placement, clipDuration, 1 / fps);
  const res = resolutionFactor(state);
  const lastFrame = Math.max(0, state.durationFrames - 1);

  const keysFor = (key: TrackKey): FrameKey[] => {
    const raw = sampleTrack(timeline, key, fps).filter((k) => k.frame <= lastFrame);
    return precision === "every-frame" ? raw : simplifyKeys(raw, TOLERANCE[key]);
  };
  const has = (k: TrackKey) => timeline.tracks.includes(k);
  const plan: ClipPlan = { ranges: [], clearRanges: [], warnings: [...timeline.placement.warnings], keyCount: 0 };

  for (const [a, b] of timeline.regions) {
    const first = Math.max(0, Math.floor(a * fps + 1e-6));
    const last = Math.min(lastFrame, Math.ceil(b * fps - 1e-6));
    plan.ranges.push([first, Math.max(first, last)]);
  }
  const midFrame = Math.floor(lastFrame / 2);
  const mode = placement.type === "entrance" ? placement.mode : null;
  if (placement.type === "span") plan.clearRanges.push([0, lastFrame]);
  if (placement.type === "accent") {
    const [a, b] = plan.ranges[0] ?? [0, 0];
    plan.clearRanges.push([a, motion.holdEnd ? lastFrame : b]);
  }
  if (mode === "inOut") plan.clearRanges.push([0, lastFrame]);
  if (mode === "in") plan.clearRanges.push([0, Math.max(midFrame, plan.ranges[0]?.[1] ?? 0)]);
  if (mode === "out") plan.clearRanges.push([Math.min(midFrame + 1, plan.ranges[0]?.[0] ?? lastFrame), lastFrame]);

  const scaleKeys = has("scale") ? keysFor("scale") : [];
  if (scaleKeys.length) {
    plan.scale = scaleKeys.map((k) => ({ frame: k.frame, value: state.scale * k.value }));
  }
  if (has("opacity")) {
    plan.opacity = keysFor("opacity").map((k) => ({
      frame: k.frame,
      value: clampNum(state.opacity * k.value, 0, 100),
    }));
  }
  if (has("rotation")) {
    plan.rotation = keysFor("rotation").map((k) => ({ frame: k.frame, value: state.rotation + k.value }));
  }
  if (has("blur")) {
    plan.blur = keysFor("blur").map((k) => ({ frame: k.frame, value: Math.max(0, k.value * res) }));
  }

  // Position : décalages x/y + compensation du pivot pendant les zooms.
  const posPx = toPixels(state.position, state);
  const pivot = state.pivot ?? posPx;
  const needsPivotComp = scaleKeys.length > 0 && distance(pivot, posPx) > 0.5;
  if (has("x") || has("y") || needsPivotComp) {
    const frames = new Set<number>();
    if (has("x")) keysFor("x").forEach((k) => frames.add(k.frame));
    if (has("y")) keysFor("y").forEach((k) => frames.add(k.frame));
    if (needsPivotComp) scaleKeys.forEach((k) => frames.add(k.frame));
    plan.position = [...frames]
      .sort((a, b) => a - b)
      .map((frame) => {
        const t = frame / fps;
        // Les mêmes images clés d'échelle que Premiere interpolera : pivot exact sur chaque clé.
        const m = needsPivotComp ? evaluateKeys(scaleKeys, frame) : 1;
        const dx = (has("x") ? timeline.valueAt("x", t) : 0) * res;
        const dy = (has("y") ? timeline.valueAt("y", t) : 0) * res;
        const px = {
          x: pivot.x + m * (posPx.x - pivot.x) + dx,
          y: pivot.y + m * (posPx.y - pivot.y) + dy,
        };
        return { frame, value: fromPixels(px, state) };
      });
  }

  plan.keyCount =
    (plan.scale?.length ?? 0) +
    (plan.opacity?.length ?? 0) +
    (plan.rotation?.length ?? 0) +
    (plan.blur?.length ?? 0) +
    (plan.position?.length ?? 0);
  return plan;
}

/* ------------------------------------------------------------------ */
/* Conversions de coordonnées                                           */
/* ------------------------------------------------------------------ */

export function toPixels(p: Point, s: Pick<ClipState, "positionNormalized" | "frameWidth" | "frameHeight">): Point {
  return s.positionNormalized ? { x: p.x * s.frameWidth, y: p.y * s.frameHeight } : { ...p };
}

export function fromPixels(p: Point, s: Pick<ClipState, "positionNormalized" | "frameWidth" | "frameHeight">): Point {
  return s.positionNormalized ? { x: p.x / s.frameWidth, y: p.y / s.frameHeight } : { ...p };
}

/**
 * Premiere expose la position soit en pixels, soit normalisée (0–1) selon
 * l'API. Une valeur dont les deux coordonnées sont dans [-2, 3] est presque
 * certainement normalisée (un texte réellement placé à moins de 3 px du coin
 * supérieur gauche est irréaliste).
 */
export function looksNormalized(p: Point): boolean {
  return Math.abs(p.x) <= 3 && Math.abs(p.y) <= 3 && p.x >= -2 && p.y >= -2;
}

/**
 * Position visible à l'écran d'un point exprimé dans le repère du clip
 * (avant transformation du composant Mouvement).
 */
export function clipPointToScreen(point: Point, s: ClipState): Point {
  const pos = toPixels(s.position, s);
  const anchor = toPixels(s.anchor, s);
  const k = s.scale / 100;
  return { x: pos.x + k * (point.x - anchor.x), y: pos.y + k * (point.y - anchor.y) };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
