import { beforeEach, describe, expect, it } from "vitest";
import type { premierepro } from "@adobe/premierepro";
import { ANIMATIONS, defaultParams } from "../src/animations/registry";
import { applyAnimation, getSelectionInfo, inspectSelection } from "../src/premiere/adapter";
import { setPproForTests, UserFacingError } from "../src/premiere/host";
import { DEFAULT_SETTINGS, type Settings } from "../src/state/settings";
import { AudioClipTrackItem, createMockPremiere, makeTextClip, type MockParam, type VideoClipTrackItem } from "../dev/mock-premierepro";

const anim = (id: string) => ANIMATIONS.find((a) => a.id === id)!;
const TPS = 254016000000;

let mock: ReturnType<typeof createMockPremiere>;
const use = (m: ReturnType<typeof createMockPremiere>) => {
  mock = m;
  setPproForTests(m.ppro as unknown as premierepro);
};

const motionParam = (clip: VideoClipTrackItem, i: number) => clip.component("AE.ADBE Motion")!.params[i] as MockParam;
const opacityParam = (clip: VideoClipTrackItem) => clip.component("AE.ADBE Opacity")!.params[0] as MockParam;

async function apply(id: string, settings: Partial<Settings> = {}, params = {}, mode: "in" | "out" | "inOut" = "in") {
  const a = anim(id);
  return applyAnimation({ animation: a, params: { ...defaultParams(a), ...params }, mode, settings: { ...DEFAULT_SETTINGS, ...settings } });
}

beforeEach(() => use(createMockPremiere()));

describe("sélection", () => {
  it("signale l'absence d'hôte, de projet, de séquence", async () => {
    setPproForTests(null);
    expect((await getSelectionInfo()).status).toBe("no-host");
    use(createMockPremiere());
    mock.state.hasProject = false;
    expect((await getSelectionInfo()).status).toBe("no-project");
    mock.state.hasProject = true;
    mock.state.hasSequence = false;
    expect((await getSelectionInfo()).status).toBe("no-sequence");
  });

  it("ne compte que les clips vidéo et décrit la séquence", async () => {
    mock.state.selection = [makeTextClip("Bonjour", 1, 4), new AudioClipTrackItem()];
    const info = await getSelectionInfo();
    expect(info.status).toBe("ok");
    expect(info.clips).toHaveLength(1);
    expect(info.ignored).toBe(1);
    expect(info.fps).toBeCloseTo(25, 6);
  });

  it("refuse d'appliquer sans sélection, avec un message clair", async () => {
    await expect(apply("smooth-pop")).rejects.toBeInstanceOf(UserFacingError);
  });
});

describe("application", () => {
  it("Smooth Pop : active l'animation puis écrit des images clés linéaires sur Échelle et Opacité", async () => {
    const clip = makeTextClip("Titre", 0, 4);
    mock.state.selection = [clip];
    const report = await apply("smooth-pop", { pivot: "clip" });
    expect(report.applied).toBe(1);
    expect(report.failed).toEqual([]);
    const scale = motionParam(clip, 1);
    const opacity = opacityParam(clip);
    expect(scale.isTimeVarying()).toBe(true);
    expect(scale.keys.length).toBeGreaterThan(3);
    expect(scale.keys[0].value).toBeCloseTo(30, 6);
    expect(scale.keys.at(-1)!.value).toBeCloseTo(100, 6);
    expect(Math.max(...scale.keys.map((k) => k.value as number))).toBeGreaterThan(105);
    expect(opacity.keys[0].value).toBe(0);
    expect(scale.keys.every((k) => k.interpolation === 2)).toBe(true);
    // Position non touchée quand le pivot est la position du clip.
    expect(motionParam(clip, 0).isTimeVarying()).toBe(false);
    // Transactions nommées pour l'historique d'annulation.
    expect(mock.state.transactions.map((t) => t.label)).toEqual([
      "MotionCraft · Smooth Pop — activation",
      "MotionCraft · Smooth Pop",
      "MotionCraft · Smooth Pop — interpolation",
    ]);
  });

  it("les images clés sont alignées sur les images et décalées de l'in-point (base « media »)", async () => {
    const clip = makeTextClip("Titre", 10, 14, { inPoint: 2 });
    mock.state.selection = [clip];
    await apply("slide-up");
    const ticksPerFrame = TPS / 25;
    for (const k of motionParam(clip, 0).keys) {
      expect(Number.isInteger(Math.round(k.ticks) / ticksPerFrame)).toBe(true);
      expect(k.ticks).toBeGreaterThanOrEqual(2 * TPS);
    }
  });

  it("base de temps « sequence » : images clés à partir du début du clip dans la séquence", async () => {
    const clip = makeTextClip("Titre", 10, 14, { inPoint: 2 });
    mock.state.selection = [clip];
    await apply("slide-up", { timeBase: "sequence" });
    expect(motionParam(clip, 0).keys[0].ticks).toBeCloseTo(10 * TPS, -2);
  });

  it("pivot automatique : le zoom d'un sous-titre reste centré sur le texte", async () => {
    const clip = makeTextClip("Sous-titre", 0, 3, { textPosition: [960, 950] });
    mock.state.selection = [clip];
    const report = await apply("smooth-pop");
    expect(report.warnings.join(" ")).toContain("calque texte (960, 950)");
    const pos = motionParam(clip, 0);
    const scale = motionParam(clip, 1);
    expect(pos.isTimeVarying()).toBe(true);
    // À chaque image clé de position, le point (960, 950) du clip reste à l'écran en (960, 950).
    for (const k of pos.keys) {
      const s = (scale.valueAt(k.ticks) as number) / 100;
      const p = k.value as { x: number; y: number };
      expect(p.y * 1080 + s * (950 - 540)).toBeCloseTo(950, 4);
    }
  });

  it("Blur Reveal : ajoute UN Flou gaussien et le réutilise lors d'une nouvelle application", async () => {
    const clip = makeTextClip("Flou", 0, 4);
    mock.state.selection = [clip];
    await apply("blur-reveal");
    const blurs = () => clip.chain.components.filter((c) => c.matchName === "AE.ADBE Gaussian Blur 2");
    expect(blurs()).toHaveLength(1);
    const blur = blurs()[0].params[0];
    expect(blur.keys[0].value).toBeCloseTo(40, 6);
    expect(blur.keys.at(-1)!.value).toBe(0);
    await apply("blur-reveal", {}, { blur: 80 });
    expect(blurs()).toHaveLength(1);
    expect(blurs()[0].params[0].keys[0].value).toBeCloseTo(80, 6);
  });

  it("remplacement : une nouvelle application nettoie les anciennes images clés de la zone", async () => {
    const clip = makeTextClip("Re", 0, 4);
    mock.state.selection = [clip];
    await apply("smooth-pop", { pivot: "clip" }, { duration: 1.5 });
    await apply("smooth-pop", { pivot: "clip" }, { duration: 0.4 });
    const last = motionParam(clip, 1).keys.at(-1)!;
    expect(last.ticks / TPS).toBeLessThanOrEqual(0.4 + 1e-6);
  });

  it("entrée + sortie : visible au milieu, invisible à la première et à la dernière image", async () => {
    const clip = makeTextClip("IO", 0, 4);
    mock.state.selection = [clip];
    await apply("slide-up", {}, {}, "inOut");
    const op = opacityParam(clip);
    expect(op.valueAt(0)).toBe(0);
    expect(op.valueAt(2 * TPS)).toBeCloseTo(100, 6);
    expect(op.valueAt(4 * TPS - TPS / 25)).toBeCloseTo(0, 6);
  });

  it("Word by Word : 4 calques, chacun apparaît après le précédent (ordre timeline puis piste)", async () => {
    const words = ["Un", "mot", "à la", "fois"].map((w, i) => makeTextClip(w, 0, 3, { track: i + 1 }));
    mock.state.selection = [...words].reverse();
    const report = await apply("word-by-word");
    expect(report.applied).toBe(4);
    const firstVisible = words.map((w) => opacityParam(w).keys.find((k) => (k.value as number) > 0)!.ticks);
    for (let i = 1; i < firstVisible.length; i++) expect(firstVisible[i]).toBeGreaterThan(firstVisible[i - 1]);
  });

  it("30 textes en une fois : 3 transactions au total (annulation groupée)", async () => {
    mock.state.selection = Array.from({ length: 30 }, (_, i) => makeTextClip(`T${i}`, i * 0.5, i * 0.5 + 3));
    const report = await apply("elastic-bounce", { pivot: "clip" });
    expect(report.applied).toBe(30);
    expect(mock.state.transactions).toHaveLength(3);
  });

  it("isole un clip fautif sans bloquer les autres", async () => {
    const good = makeTextClip("OK", 0, 3);
    const bad = makeTextClip("KO", 0, 3);
    bad.chain.components = bad.chain.components.slice(0, 1); // plus de composant Mouvement
    mock.state.selection = [good, bad];
    const report = await apply("smooth-pop", { pivot: "clip" });
    expect(report.applied).toBe(1);
    expect(report.failed.map((f) => f.name)).toEqual(["KO"]);
  });

  it("si Premiere refuse la transaction groupée, rejoue clip par clip", async () => {
    mock.state.selection = [makeTextClip("A", 0, 3), makeTextClip("B", 0, 3)];
    mock.state.failNext = "activation";
    const report = await apply("smooth-pop", { pivot: "clip" });
    expect(report.applied).toBe(2);
  });

  it("respecte l'échelle et l'opacité existantes du clip", async () => {
    const clip = makeTextClip("Petit", 0, 3);
    motionParam(clip, 1).value = 50;
    opacityParam(clip).value = 80;
    mock.state.selection = [clip];
    await apply("smooth-pop", { pivot: "clip" });
    expect(motionParam(clip, 1).keys.at(-1)!.value).toBeCloseTo(50, 6);
    expect(opacityParam(clip).keys.at(-1)!.value).toBeCloseTo(80, 6);
  });

  it("échelle non uniforme : anime aussi la largeur", async () => {
    const clip = makeTextClip("Large", 0, 3);
    motionParam(clip, 3).value = false;
    motionParam(clip, 2).value = 150;
    mock.state.selection = [clip];
    await apply("smooth-pop", { pivot: "clip" });
    expect(motionParam(clip, 2).keys.at(-1)!.value).toBeCloseTo(150, 6);
    expect(motionParam(clip, 2).keys[0].value).toBeCloseTo(45, 6);
  });

  it("positions en pixels : gérées sans conversion", async () => {
    use(createMockPremiere({ pixelPositions: true }));
    const clip = makeTextClip("Px", 0, 3, { pixelPositions: true });
    mock.state.selection = [clip];
    await apply("slide-up");
    const pos = motionParam(clip, 0).keys;
    expect((pos[0].value as { y: number }).y).toBeCloseTo(540 + 120, 6);
    expect((pos.at(-1)!.value as { y: number }).y).toBeCloseTo(540, 6);
  });

  it("le diagnostic décrit composants et paramètres", async () => {
    mock.state.selection = [makeTextClip("Diag", 0, 3)];
    const text = await inspectSelection(DEFAULT_SETTINGS);
    expect(text).toContain("AE.ADBE Motion");
    expect(text).toContain("Échelle");
    expect(text).toContain("25.000 i/s");
  });
});

describe("entrée puis sortie appliquées séparément", () => {
  it("la sortie ne détruit pas l'entrée", async () => {
    const clip = makeTextClip("Seq", 0, 4);
    mock.state.selection = [clip];
    await apply("slide-up", {}, {}, "in");
    await apply("slide-up", {}, {}, "out");
    const op = opacityParam(clip);
    expect(op.valueAt(0)).toBe(0);
    expect(op.valueAt(2 * TPS)).toBeCloseTo(100, 6);
    expect(op.valueAt(4 * TPS - TPS / 25)).toBeCloseTo(0, 6);
  });
});
