import { describe, expect, it } from "vitest";
import {
  backOvershoot,
  cubicBezier,
  dampedSpring,
  EASINGS,
  easeOutBackWithOvershoot,
} from "../src/engine/easing";
import { evaluateKeys, placeMotion, sampleTrack, simplifyKeys } from "../src/engine/timeline";
import { buildClipPlan, type ClipState } from "../src/engine/plan";
import { REST_VALUES, type Motion } from "../src/engine/types";

const peak = (f: (p: number) => number) => {
  let m = -Infinity;
  for (let i = 0; i <= 2000; i++) m = Math.max(m, f(i / 2000));
  return m;
};

describe("easing", () => {
  it("toutes les courbes partent de 0 et arrivent à 1", () => {
    for (const e of EASINGS) {
      expect(e.fn(0), e.id).toBeCloseTo(0, 6);
      expect(e.fn(1), e.id).toBeCloseTo(1, 6);
    }
  });

  it("easeOutBackWithOvershoot produit exactement le dépassement demandé", () => {
    for (const o of [0.02, 0.1, 0.25, 0.4]) {
      expect(peak(easeOutBackWithOvershoot(o)) - 1).toBeCloseTo(o, 3);
    }
    expect(backOvershoot(1.70158)).toBeCloseTo(0.1, 2);
  });

  it("le ressort amorti part de 0, finit exactement à 1 et dépasse", () => {
    const s = dampedSpring(3, 4);
    expect(s(0)).toBe(0);
    expect(s(1)).toBe(1);
    expect(s(0.999)).toBeCloseTo(1, 2);
    expect(peak(s)).toBeGreaterThan(1.05);
  });

  it("cubic-bezier : bornes et monotonie pour une courbe sans dépassement", () => {
    const b = cubicBezier(0.16, 1, 0.3, 1);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const v = b(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
    expect(b(0.5)).toBeGreaterThan(0.8);
  });
});

const simpleMotion: Motion = {
  delay: 0.2,
  duration: 0.5,
  tracks: { opacity: (t) => Math.min(1, t / 0.5), scale: (t) => 0.5 + t },
};

describe("placement dans le clip", () => {
  it("entrée : valeur de départ pendant le délai, repos ensuite", () => {
    const tl = placeMotion(simpleMotion, "in", 4, 1 / 25);
    expect(tl.valueAt("opacity", 0)).toBe(0);
    expect(tl.valueAt("opacity", 0.19)).toBe(0);
    expect(tl.valueAt("opacity", 0.45)).toBeCloseTo(0.5, 6);
    expect(tl.valueAt("opacity", 2)).toBe(1);
    expect(tl.placement.warnings).toHaveLength(0);
  });

  it("sortie : miroir de l'entrée, caché sur la dernière image visible", () => {
    const tl = placeMotion(simpleMotion, "out", 4, 1 / 25);
    expect(tl.valueAt("opacity", 1)).toBe(1);
    expect(tl.valueAt("opacity", 4 - 1 / 25)).toBe(0);
  });

  it("entrée + sortie dans un clip trop court : compression et avertissement", () => {
    const tl = placeMotion(simpleMotion, "inOut", 1, 1 / 25);
    expect(tl.placement.timeScale).toBeLessThan(1);
    expect(tl.placement.warnings.length).toBe(1);
    expect(tl.placement.inEnd!).toBeLessThanOrEqual(tl.placement.outStart! + 1e-9);
  });
});

describe("cuisson et simplification", () => {
  it("la simplification reste sous la tolérance sur chaque image", () => {
    const tl = placeMotion({ delay: 0, duration: 1, tracks: { scale: (t) => easeOutBackWithOvershoot(0.12)(t) } }, "in", 3, 1 / 30);
    const raw = sampleTrack(tl, "scale", 30);
    const simple = simplifyKeys(raw, 0.0015);
    expect(simple.length).toBeLessThan(raw.length);
    for (const k of raw) expect(Math.abs(evaluateKeys(simple, k.frame) - k.value)).toBeLessThanOrEqual(0.0015 + 1e-9);
  });
});

const baseState: ClipState = {
  durationFrames: 100,
  fps: 25,
  frameWidth: 1920,
  frameHeight: 1080,
  position: { x: 0.5, y: 0.5 },
  positionNormalized: true,
  anchor: { x: 0.5, y: 0.5 },
  scale: 100,
  opacity: 100,
  rotation: 0,
};

describe("planificateur", () => {
  it("multiplie les valeurs de repos du clip (échelle 80 %, opacité 60 %)", () => {
    const plan = buildClipPlan(simpleMotion, "in", { ...baseState, scale: 80, opacity: 60 });
    expect(plan.scale![0].value).toBeCloseTo(40, 6);
    expect(plan.opacity![0].value).toBe(0);
    expect(plan.opacity!.at(-1)!.value).toBeCloseTo(60, 6);
    expect(plan.position).toBeUndefined();
  });

  it("compense le pivot : le centre du texte reste fixe pendant le zoom", () => {
    const pivot = { x: 960, y: 900 };
    const plan = buildClipPlan(simpleMotion, "in", { ...baseState, pivot }, "every-frame");
    expect(plan.position).toBeDefined();
    for (const pk of plan.position!) {
      const m = evaluateKeys(plan.scale!.map((k) => ({ frame: k.frame, value: k.value / 100 })), pk.frame);
      // Point du texte (repère clip = écran au repos) après transformation Mouvement.
      const px = pk.value.x * 1920 + m * (pivot.x - 960);
      const py = pk.value.y * 1080 + m * (pivot.y - 540);
      expect(px).toBeCloseTo(pivot.x, 6);
      expect(py).toBeCloseTo(pivot.y, 6);
    }
  });

  it("adapte les distances à la résolution (4K = ×2)", () => {
    const motion: Motion = { delay: 0, duration: 0.4, tracks: { y: (t) => 100 * (1 - t / 0.4) } };
    const hd = buildClipPlan(motion, "in", baseState);
    const uhd = buildClipPlan(motion, "in", { ...baseState, frameWidth: 3840, frameHeight: 2160 });
    expect(hd.position![0].value.y * 1080 - 540).toBeCloseTo(100, 6);
    expect(uhd.position![0].value.y * 2160 - 1080).toBeCloseTo(200, 6);
  });

  it("gère les positions exprimées en pixels", () => {
    const motion: Motion = { delay: 0, duration: 0.4, tracks: { x: (t) => -50 * (1 - t / 0.4) } };
    const plan = buildClipPlan(motion, "in", {
      ...baseState,
      positionNormalized: false,
      position: { x: 960, y: 540 },
      anchor: { x: 960, y: 540 },
    });
    expect(plan.position![0].value.x).toBeCloseTo(910, 6);
    expect(plan.position!.at(-1)!.value.x).toBeCloseTo(960, 6);
  });

  it("toutes les images clés sont dans le clip", () => {
    const plan = buildClipPlan(simpleMotion, "inOut", { ...baseState, durationFrames: 30 });
    for (const k of [...plan.scale!, ...plan.opacity!]) {
      expect(k.frame).toBeGreaterThanOrEqual(0);
      expect(k.frame).toBeLessThanOrEqual(29);
    }
  });

  it("valeurs de repos cohérentes avec REST_VALUES", () => {
    expect(REST_VALUES.scale).toBe(1);
    expect(REST_VALUES.opacity).toBe(1);
  });
});

describe("zones de nettoyage", () => {
  it("entrée : première moitié ; sortie : seconde moitié ; les deux : tout le clip", () => {
    const s = { ...baseState, durationFrames: 101 };
    expect(buildClipPlan(simpleMotion, "in", s).clearRanges).toEqual([[0, 50]]);
    expect(buildClipPlan(simpleMotion, "out", s).clearRanges).toEqual([[51, 100]]);
    expect(buildClipPlan(simpleMotion, "inOut", s).clearRanges).toEqual([[0, 100]]);
  });
});

describe("accents multiples (marqueurs)", () => {
  const punch: Motion = { delay: 0, duration: 0.4, tracks: { scale: (t) => 1 + 0.2 * Math.sin((Math.PI * t) / 0.4) } };
  it("un effet par marqueur, au repos entre deux", () => {
    const tl = placeMotion(punch, { type: "accent", at: [1, 2.5] }, 5, 1 / 25);
    expect(tl.regions).toHaveLength(2);
    expect(tl.valueAt("scale", 1.2)).toBeGreaterThan(1.1);
    expect(tl.valueAt("scale", 1.8)).toBe(1);
    expect(tl.valueAt("scale", 2.7)).toBeGreaterThan(1.1);
  });
  it("ignore un marqueur trop proche du précédent, avec avertissement", () => {
    const tl = placeMotion(punch, { type: "accent", at: [1, 1.1, 3] }, 5, 1 / 25);
    expect(tl.regions).toHaveLength(2);
    expect(tl.placement.warnings.join(" ")).toContain("ignoré");
  });
});

describe("combinaison (recettes) et sortie inversée", () => {
  it("échelles multipliées, décalages additionnés", async () => {
    const { combineMotions } = await import("../src/engine/combine");
    const m = combineMotions([
      { delay: 0, duration: 1, tracks: { scale: () => 1.2, x: () => 10 } },
      { delay: 0, duration: 0.5, tracks: { scale: () => 1.5, x: () => 5 } },
    ]);
    expect(m.duration).toBe(1);
    expect(m.tracks.scale!(0.2)).toBeCloseTo(1.8, 6);
    expect(m.tracks.x!(0.2)).toBeCloseTo(15, 6);
  });

  it("flipOut inverse x et rotation en sortie, pas l'échelle", () => {
    const m: Motion = { delay: 0, duration: 0.5, tracks: { x: (t) => 100 * (1 - t / 0.5), scale: (t) => 2 - t / 0.5 } };
    const tl = placeMotion(m, { type: "entrance", mode: "out", flipOut: true }, 3, 1 / 25);
    expect(tl.valueAt("x", 3 - 1 / 25)).toBeCloseTo(-100, 6);
    expect(tl.valueAt("scale", 3 - 1 / 25)).toBeCloseTo(2, 6);
  });
});
