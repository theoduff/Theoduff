/**
 * Bibliothèque de courbes d'accélération (easing).
 *
 * Toutes les fonctions prennent p ∈ [0, 1] et renvoient une progression
 * (0 au départ, 1 à l'arrivée). Certaines dépassent 1 (overshoot) : c'est voulu.
 */

export type Easing = (p: number) => number;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export const linear: Easing = (p) => p;
export const easeOutSine: Easing = (p) => Math.sin((p * Math.PI) / 2);
export const easeOutQuad: Easing = (p) => 1 - (1 - p) * (1 - p);
export const easeOutCubic: Easing = (p) => 1 - Math.pow(1 - p, 3);
export const easeOutQuart: Easing = (p) => 1 - Math.pow(1 - p, 4);
export const easeOutQuint: Easing = (p) => 1 - Math.pow(1 - p, 5);
export const easeOutExpo: Easing = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
export const easeOutCirc: Easing = (p) => Math.sqrt(1 - Math.pow(p - 1, 2));
export const easeInOutCubic: Easing = (p) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
export const easeInOutQuint: Easing = (p) =>
  p < 0.5 ? 16 * Math.pow(p, 5) : 1 - Math.pow(-2 * p + 2, 5) / 2;

/** Back « out » avec constante s (1.70158 = dépassement d'environ 10 %). */
export const easeOutBackS =
  (s: number): Easing =>
  (p) => {
    const q = p - 1;
    return 1 + (s + 1) * q * q * q + s * q * q;
  };

/** Dépassement maximal (au-delà de 1) produit par easeOutBack de constante s. */
export function backOvershoot(s: number): number {
  if (s <= 0) return 0;
  // Dérivée nulle en q = -2s / (3(s+1)) (q = p - 1).
  const q = (-2 * s) / (3 * (s + 1));
  return (s + 1) * q * q * q + s * q * q;
}

/**
 * Renvoie un easeOutBack dont le dépassement vaut exactement `overshoot`
 * (0.1 = 10 %). Résolution par dichotomie, car la relation n'est pas linéaire.
 */
export function easeOutBackWithOvershoot(overshoot: number): Easing {
  if (overshoot <= 0) return easeOutCubic;
  let lo = 0;
  let hi = 20;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (backOvershoot(mid) < overshoot) lo = mid;
    else hi = mid;
  }
  return easeOutBackS((lo + hi) / 2);
}

/**
 * Ressort amorti qui part de 0 et finit EXACTEMENT à 1 en p = 1.
 *
 * @param bounces  nombre d'oscillations visibles (≈ rebonds)
 * @param decay    vitesse d'amortissement (plus grand = s'arrête plus vite)
 */
export function dampedSpring(bounces: number, decay: number): Easing {
  const omega = Math.PI * (2 * Math.max(0.25, bounces) + 0.5);
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    // Enveloppe exponentielle, forcée à 0 en fin de course pour une arrivée nette.
    const env = Math.exp(-decay * p) * (1 - Math.pow(p, 6));
    return 1 - env * Math.cos(omega * p);
  };
}

/**
 * Cubic-bezier façon CSS (x1, y1, x2, y2), résolu par Newton-Raphson puis
 * dichotomie si nécessaire.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 8; i++) {
      const x = sx(t) - p;
      const d = dsx(t);
      if (Math.abs(x) < 1e-7) return sy(t);
      if (Math.abs(d) < 1e-6) break;
      t -= x / d;
    }
    let lo = 0;
    let hi = 1;
    t = p;
    for (let i = 0; i < 40; i++) {
      const x = sx(t);
      if (Math.abs(x - p) < 1e-7) break;
      if (x < p) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/* ------------------------------------------------------------------ */
/* Easings proposés dans l'interface                                    */
/* ------------------------------------------------------------------ */

export interface EasingPreset {
  id: string;
  label: string;
  fn: Easing;
}

/** Courbes « sans dépassement », utilisables pour toutes les propriétés. */
export const EASINGS: readonly EasingPreset[] = [
  { id: "smooth", label: "Douce (Cubic)", fn: easeOutCubic },
  { id: "quart", label: "Fluide (Quart)", fn: easeOutQuart },
  { id: "quint", label: "Pro (Quint)", fn: easeOutQuint },
  { id: "expo", label: "Rapide (Expo)", fn: easeOutExpo },
  { id: "silk", label: "Soyeuse (Bézier)", fn: cubicBezier(0.16, 1, 0.3, 1) },
  { id: "snappy", label: "Nerveuse (Bézier)", fn: cubicBezier(0.2, 0.9, 0.1, 1) },
  { id: "inout", label: "Entrée-sortie", fn: easeInOutCubic },
  { id: "sine", label: "Sinusoïdale", fn: easeOutSine },
  { id: "linear", label: "Linéaire", fn: linear },
];

export function getEasing(id: unknown, fallback = "quart"): Easing {
  const found = EASINGS.find((e) => e.id === id) ?? EASINGS.find((e) => e.id === fallback);
  return (found ?? EASINGS[0]).fn;
}

export const easingOptions = () => EASINGS.map((e) => ({ value: e.id, label: e.label }));
