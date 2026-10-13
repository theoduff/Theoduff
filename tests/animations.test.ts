import { describe, expect, it } from "vitest";
import { ANIMATIONS, CATEGORIES, defaultParams, matchesQuery, sanitizeParams } from "../src/animations/registry";
import { orderRank } from "../src/animations/wordByWord";
import { REST_VALUES, type TrackKey } from "../src/engine/types";

const ctx = { index: 0, count: 1 };

describe("bibliothèque d'animations", () => {
  it("contient les 5 animations de la V1 avec des identifiants uniques", () => {
    expect(ANIMATIONS.map((a) => a.id)).toEqual(["smooth-pop", "blur-reveal", "slide-up", "word-by-word", "elastic-bounce"]);
    expect(new Set(ANIMATIONS.map((a) => a.id)).size).toBe(ANIMATIONS.length);
  });

  it("chaque animation a une catégorie connue et des paramètres valides", () => {
    for (const a of ANIMATIONS) {
      expect(CATEGORIES.some((c) => c.id === a.category), a.id).toBe(true);
      const ids = a.params.map((p) => p.id);
      expect(new Set(ids).size, a.id).toBe(ids.length);
      for (const p of a.params) {
        if (p.type === "number") {
          expect(p.default, `${a.id}.${p.id}`).toBeGreaterThanOrEqual(p.min);
          expect(p.default, `${a.id}.${p.id}`).toBeLessThanOrEqual(p.max);
        }
        if (p.type === "choice") expect(p.options.some((o) => o.value === p.default), `${a.id}.${p.id}`).toBe(true);
      }
    }
  });

  it("chaque courbe finit exactement au repos (aucun saut en fin d'animation)", () => {
    for (const a of ANIMATIONS) {
      // Valeurs par défaut + quelques variantes de choix.
      const variants = [defaultParams(a)];
      for (const p of a.params) {
        if (p.type === "choice") for (const o of p.options) variants.push({ ...defaultParams(a), [p.id]: o.value });
      }
      for (const v of variants) {
        const m = a.build(v, ctx);
        expect(m.duration).toBeGreaterThan(0);
        for (const [key, curve] of Object.entries(m.tracks)) {
          if (!curve) continue;
          expect(curve(m.duration), `${a.id} ${key} ${JSON.stringify(v)}`).toBeCloseTo(REST_VALUES[key as TrackKey], 5);
          for (let i = 0; i <= 50; i++) expect(Number.isFinite(curve((m.duration * i) / 50))).toBe(true);
        }
      }
    }
  });

  it("Smooth Pop : départ à l'échelle demandée et dépassement fidèle", () => {
    const a = ANIMATIONS.find((x) => x.id === "smooth-pop")!;
    const m = a.build({ ...defaultParams(a), startScale: 20, overshoot: 15 }, ctx);
    expect(m.tracks.scale!(0)).toBeCloseTo(0.2, 6);
    let max = 0;
    for (let i = 0; i <= 1000; i++) max = Math.max(max, m.tracks.scale!((m.duration * i) / 1000));
    // Dépassement relatif à l'amplitude parcourue (0,2 → 1).
    expect(max).toBeCloseTo(0.2 + 0.8 * 1.15, 2);
  });

  it("Blur Reveal : flou initial puis netteté, avec glissement", () => {
    const a = ANIMATIONS.find((x) => x.id === "blur-reveal")!;
    const m = a.build(defaultParams(a), ctx);
    expect(m.tracks.blur!(0)).toBe(40);
    expect(m.tracks.y!(0)).toBe(40);
    expect(m.tracks.blur!(m.duration)).toBe(0);
  });

  it("Slide Up : arrive du bas (décalage positif) et la direction est respectée", () => {
    const a = ANIMATIONS.find((x) => x.id === "slide-up")!;
    expect(a.build(defaultParams(a), ctx).tracks.y!(0)).toBe(120);
    const left = a.build({ ...defaultParams(a), direction: "left" }, ctx);
    expect(left.tracks.x!(0)).toBe(120);
    expect(left.tracks.y).toBeUndefined();
  });

  it("Word by Word : cascade selon l'ordre choisi", () => {
    const a = ANIMATIONS.find((x) => x.id === "word-by-word")!;
    const delays = [0, 1, 2, 3].map((i) => a.build(defaultParams(a), { index: i, count: 4 }).delay);
    expect(delays).toEqual([0, 0.14, 0.28, 0.42].map((d) => expect.closeTo(d, 6)));
    expect([0, 1, 2, 3].map((i) => orderRank("reverse", i, 4))).toEqual([3, 2, 1, 0]);
    expect([0, 1, 2, 3, 4].map((i) => orderRank("center", i, 5))).toEqual([2, 1, 0, 1, 2]);
    expect([0, 1, 2, 3].map((i) => orderRank("center", i, 4))).toEqual([1, 0, 0, 1]);
  });

  it("Elastic Bounce : oscille au-delà de 100 % et l'amplitude agit", () => {
    const a = ANIMATIONS.find((x) => x.id === "elastic-bounce")!;
    const maxOf = (amp: number) => {
      const m = a.build({ ...defaultParams(a), amplitude: amp }, ctx);
      let max = 0;
      for (let i = 0; i <= 1000; i++) max = Math.max(max, m.tracks.scale!((m.duration * i) / 1000));
      return max;
    };
    expect(maxOf(55)).toBeGreaterThan(1.1);
    expect(maxOf(100)).toBeGreaterThan(maxOf(10));
  });

  it("recherche tolérante (accents, casse, plusieurs mots)", () => {
    const pop = ANIMATIONS.find((x) => x.id === "smooth-pop")!;
    expect(matchesQuery(pop, "ECHELLE")).toBe(true);
    expect(matchesQuery(pop, "pop zoom")).toBe(true);
    expect(matchesQuery(pop, "flou")).toBe(false);
  });

  it("sanitizeParams borne les valeurs et ignore les clés inconnues", () => {
    const a = ANIMATIONS[0];
    const v = sanitizeParams(a, { duration: 999, curve: "inconnu", bidon: 3 });
    expect(v.duration).toBe(2);
    expect(v.curve).toBe("back");
    expect("bidon" in v).toBe(false);
  });
});
