/**
 * Bruit lisse et déterministe (pour les secousses, la caméra à l'épaule…).
 * Même graine → même mouvement : l'aperçu et Premiere sont identiques.
 */

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bruit 1D lisse : somme d'octaves de sinusoïdes à phases aléatoires.
 * Renvoie une fonction t (s) → [-1, 1] environ, de fréquence dominante `hz`.
 */
export function smoothNoise(seed: number, hz: number): (t: number) => number {
  const rnd = seededRandom(seed);
  const octaves = [1, 1.93, 3.71].map((m, i) => ({
    f: hz * m * (0.85 + rnd() * 0.3),
    p: rnd() * Math.PI * 2,
    a: [0.62, 0.28, 0.14][i],
  }));
  const norm = octaves.reduce((s, o) => s + o.a, 0);
  return (t) => octaves.reduce((s, o) => s + o.a * Math.sin(2 * Math.PI * o.f * t + o.p), 0) / norm;
}

/** Bruit « par paliers » (saccadé), utile pour les effets glitch / impact. */
export function steppedNoise(seed: number, hz: number): (t: number) => number {
  const rnd = seededRandom(seed);
  const values = Array.from({ length: 512 }, () => rnd() * 2 - 1);
  return (t) => values[Math.abs(Math.floor(t * hz)) % values.length];
}
