/**
 * Combinaison de plusieurs animations en une seule (« recettes »).
 * Échelle et opacité se multiplient ; décalages, rotation, flou et luminosité
 * s'additionnent ; le recadrage garde la valeur la plus forte.
 */
import type { Motion, TrackKey } from "./types";
import { REST_VALUES } from "./types";

const MULTIPLY: TrackKey[] = ["scale", "opacity"];
const MAX: TrackKey[] = ["cropL", "cropR", "cropT", "cropB"];

export function combineMotions(motions: Motion[]): Motion {
  const delay = Math.min(...motions.map((m) => m.delay));
  const end = Math.max(...motions.map((m) => m.delay + m.duration));
  const keys = new Set<TrackKey>();
  for (const m of motions) for (const k of Object.keys(m.tracks) as TrackKey[]) if (m.tracks[k]) keys.add(k);
  const tracks: Motion["tracks"] = {};
  for (const key of keys) {
    const parts = motions
      .filter((m) => m.tracks[key])
      .map((m) => ({ offset: m.delay - delay, duration: m.duration, curve: m.tracks[key]! }));
    tracks[key] = (t) => {
      const values = parts.map((p) => p.curve(Math.min(p.duration, Math.max(0, t - p.offset))));
      if (MULTIPLY.includes(key)) return values.reduce((a, v) => a * v, 1);
      if (MAX.includes(key)) return Math.max(...values);
      return values.reduce((a, v) => a + (v - REST_VALUES[key]), REST_VALUES[key]);
    };
  }
  return { delay, duration: end - delay, tracks, holdEnd: motions.some((m) => m.holdEnd) };
}
