/**
 * Placement d'une animation sur la durée d'un clip (entrée, sortie, ou les deux)
 * puis « cuisson » en images clés image par image, simplifiées sans perte visible.
 */
import { clamp } from "./easing";
import { REST_VALUES, type AnimationMode, type Motion, type TrackKey } from "./types";

export interface Placement {
  /** Facteur appliqué aux durées si le clip est trop court (1 = pas de compression). */
  timeScale: number;
  inStart?: number;
  inEnd?: number;
  outStart?: number;
  outEnd?: number;
  warnings: string[];
}

export interface Timeline {
  tracks: TrackKey[];
  placement: Placement;
  /** Valeur relative d'une propriété à l'instant t (secondes depuis le début du clip). */
  valueAt(key: TrackKey, t: number): number;
  /** Intervalles où les valeurs changent, en secondes. */
  regions: [number, number][];
}

/**
 * @param clipDuration durée du clip en secondes
 * @param frameDuration durée d'une image (la sortie se termine sur la dernière image visible)
 */
export function placeMotion(
  motion: Motion,
  mode: AnimationMode,
  clipDuration: number,
  frameDuration: number,
): Timeline {
  const warnings: string[] = [];
  const total = motion.delay + motion.duration;
  // Dernière image visible du clip : c'est elle qui doit être « cachée » en fin de sortie.
  const lastVisible = Math.max(0, clipDuration - frameDuration);
  const available = mode === "inOut" ? lastVisible / 2 : lastVisible;
  let timeScale = 1;
  if (total > available && total > 0) {
    timeScale = Math.max(0.01, available / total);
    warnings.push(
      `Clip trop court : l'animation a été accélérée (×${(1 / timeScale).toFixed(2)}) pour tenir dans le clip.`,
    );
  }
  const delay = motion.delay * timeScale;
  const duration = motion.duration * timeScale;
  const tracks = (Object.keys(motion.tracks) as TrackKey[]).filter((k) => motion.tracks[k]);

  /** Valeur de l'animation d'entrée à τ secondes après son début (délai inclus). */
  const entryValue = (key: TrackKey, tau: number): number => {
    const curve = motion.tracks[key];
    if (!curve) return REST_VALUES[key];
    if (tau <= delay) return curve(0);
    if (tau >= delay + duration) return curve(motion.duration);
    return curve(clamp((tau - delay) / timeScale, 0, motion.duration));
  };

  const placement: Placement = { timeScale, warnings };
  const regions: [number, number][] = [];
  const hasIn = mode === "in" || mode === "inOut";
  const hasOut = mode === "out" || mode === "inOut";
  if (hasIn) {
    placement.inStart = 0;
    placement.inEnd = delay + duration;
    regions.push([0, delay + duration]);
  }
  if (hasOut) {
    placement.outStart = lastVisible - (delay + duration);
    placement.outEnd = lastVisible;
    regions.push([placement.outStart, lastVisible]);
  }

  const valueAt = (key: TrackKey, t: number): number => {
    if (hasOut && placement.outStart !== undefined && t >= placement.outStart) {
      // Sortie = entrée jouée à l'envers, ancrée sur la dernière image visible.
      return entryValue(key, Math.max(0, lastVisible - t));
    }
    if (hasIn) return entryValue(key, Math.max(0, t));
    return REST_VALUES[key];
  };

  return { tracks, placement, valueAt, regions };
}

/* ------------------------------------------------------------------ */
/* Cuisson en images clés                                                */
/* ------------------------------------------------------------------ */

export interface FrameKey {
  /** Index d'image depuis le début du clip. */
  frame: number;
  value: number;
}

/** Échantillonne une propriété sur chaque image des régions animées. */
export function sampleTrack(timeline: Timeline, key: TrackKey, fps: number): FrameKey[] {
  const frames = framesForRegions(timeline.regions, fps);
  return frames.map((frame) => ({ frame, value: timeline.valueAt(key, frame / fps) }));
}

/** Liste triée et dédoublonnée des images couvrant les régions animées (bornes incluses). */
export function framesForRegions(regions: [number, number][], fps: number): number[] {
  const set = new Set<number>();
  for (const [a, b] of regions) {
    const first = Math.max(0, Math.floor(a * fps + 1e-6));
    const last = Math.max(first, Math.ceil(b * fps - 1e-6));
    for (let f = first; f <= last; f++) set.add(f);
  }
  return [...set].sort((x, y) => x - y);
}

/**
 * Simplification Ramer–Douglas–Peucker : supprime les images clés qu'une
 * interpolation linéaire reproduit à `tolerance` près. Les ruptures entre
 * régions (trous de plus d'une image) sont toujours conservées.
 */
export function simplifyKeys(keys: FrameKey[], tolerance: number): FrameKey[] {
  if (keys.length <= 2 || tolerance <= 0) return keys.slice();
  // Découpage en séquences contiguës (une par région).
  const runs: FrameKey[][] = [];
  let current: FrameKey[] = [];
  for (const k of keys) {
    const prev = current[current.length - 1];
    if (prev && k.frame - prev.frame > 1) {
      runs.push(current);
      current = [];
    }
    current.push(k);
  }
  if (current.length) runs.push(current);
  return runs.flatMap((run) => rdp(run, tolerance));
}

function rdp(points: FrameKey[], tolerance: number): FrameKey[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const pa = points[a];
    const pb = points[b];
    let maxErr = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const p = points[i];
      const u = (p.frame - pa.frame) / (pb.frame - pa.frame);
      const err = Math.abs(p.value - (pa.value + (pb.value - pa.value) * u));
      if (err > maxErr) {
        maxErr = err;
        idx = i;
      }
    }
    if (maxErr > tolerance && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Interpolation linéaire d'une liste d'images clés (pour vérifier la fidélité). */
export function evaluateKeys(keys: FrameKey[], frame: number): number {
  if (!keys.length) return NaN;
  if (frame <= keys[0].frame) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (frame <= b.frame) {
      const a = keys[i - 1];
      return a.value + ((b.value - a.value) * (frame - a.frame)) / (b.frame - a.frame);
    }
  }
  return keys[keys.length - 1].value;
}
