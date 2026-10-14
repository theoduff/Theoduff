import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { premierepro } from "@adobe/premierepro";
import { ANIMATIONS, defaultParams } from "../src/animations/registry";
import { applyAnimation, getSelectionInfo, inspectSelection, watchSelection } from "../src/premiere/adapter";
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

async function apply(
  id: string,
  settings: Partial<Settings> = {},
  params = {},
  mode: "in" | "out" | "inOut" = "in",
  anchor: "playhead" | "start" | "end" | "markers" = "playhead",
) {
  const a = anim(id);
  return applyAnimation({ animation: a, params: { ...defaultParams(a), ...params }, mode, anchor, settings: { ...DEFAULT_SETTINGS, ...settings } });
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

describe("effets vidéo", () => {
  it("Zoom Punch se place à la tête de lecture et revient au cadrage d'origine", async () => {
    const clip = makeTextClip("Plan", 1, 6);
    mock.state.selection = [clip];
    mock.state.playhead = 3; // 2 s après le début du clip
    await apply("zoom-punch", { pivot: "clip" });
    const scale = motionParam(clip, 1);
    expect(scale.keys[0].ticks / TPS).toBeCloseTo(2, 2);
    expect(scale.keys[0].value).toBeCloseTo(100, 6);
    expect(Math.max(...scale.keys.map((k) => k.value as number))).toBeCloseTo(118, 0);
    expect(scale.keys.at(-1)!.value).toBeCloseTo(100, 6);
    expect(scale.valueAt(1 * TPS)).toBe(100);
  });

  it("tête de lecture hors du clip : effet placé au début, avec avertissement", async () => {
    const clip = makeTextClip("Plan", 10, 14);
    mock.state.selection = [clip];
    mock.state.playhead = 2;
    const report = await apply("zoom-punch", { pivot: "clip" });
    expect(report.warnings.join(" ")).toContain("hors du clip");
    expect(motionParam(clip, 1).keys[0].ticks).toBe(0);
  });

  it("placement « fin du clip » : l'effet se termine sur la dernière image", async () => {
    const clip = makeTextClip("Plan", 0, 4);
    mock.state.selection = [clip];
    await apply("zoom-punch", { pivot: "clip" }, {}, "in", "end");
    const last = motionParam(clip, 1).keys.at(-1)!;
    expect(last.ticks / TPS).toBeCloseTo(4 - 1 / 25, 3);
  });

  it("« Rester zoomé » : le zoom est conservé jusqu'à la fin du clip", async () => {
    const clip = makeTextClip("Plan", 0, 4);
    mock.state.selection = [clip];
    await apply("zoom-punch", { pivot: "clip" }, { hold: true }, "in", "start");
    expect(motionParam(clip, 1).valueAt(3.5 * TPS)).toBeCloseTo(118, 0);
  });

  it("Push-in lent couvre tout le clip, quelle que soit sa durée", async () => {
    const short = makeTextClip("Court", 0, 2);
    const long = makeTextClip("Long", 3, 11);
    mock.state.selection = [short, long];
    await apply("slow-push-in", { pivot: "clip" });
    for (const [c, d] of [[short, 2], [long, 8]] as const) {
      const keys = motionParam(c, 1).keys;
      expect(keys[0].value).toBeCloseTo(100, 6);
      expect(keys.at(-1)!.value).toBeCloseTo(112, 6);
      expect(keys.at(-1)!.ticks / TPS).toBeCloseTo(d - 1 / 25, 3);
    }
  });

  it("Camera Shake anime position, rotation et agrandit l'image pour cacher les bords", async () => {
    const clip = makeTextClip("Plan", 0, 4);
    mock.state.selection = [clip];
    await apply("camera-shake", { pivot: "clip" }, {}, "in", "start");
    expect(motionParam(clip, 0).keys.length).toBeGreaterThan(5);
    expect(motionParam(clip, 4).keys.length).toBeGreaterThan(5);
    expect(Math.max(...motionParam(clip, 1).keys.map((k) => k.value as number))).toBeGreaterThan(102);
    expect(motionParam(clip, 1).keys.at(-1)!.value).toBeCloseTo(100, 6);
  });

  it("Spin Zoom en sortie : rotation et flou ajoutés en fin de clip", async () => {
    const clip = makeTextClip("Plan", 0, 4);
    mock.state.selection = [clip];
    await apply("spin-zoom", { pivot: "clip" }, {}, "out");
    const rot = motionParam(clip, 4);
    expect(rot.valueAt(1 * TPS)).toBe(0);
    expect(Math.abs(rot.keys.at(-1)!.value as number)).toBeCloseTo(180, 0);
    expect(clip.component("AE.ADBE Gaussian Blur 2")).toBeDefined();
  });

  it("Word by Word sur un seul calque : avertit l'utilisateur", async () => {
    mock.state.selection = [makeTextClip("Une phrase entière", 0, 3)];
    const report = await apply("word-by-word");
    expect(report.warnings.join(" ")).toContain("Un seul calque");
  });
});

describe("sobriété : le panneau inactif ne sollicite pas Premiere", () => {
  afterEach(() => vi.useRealTimers());

  it("avec l'événement SELECTION_CHANGED : aucun appel tant que rien ne change", () => {
    vi.useFakeTimers();
    let calls = 0;
    const stop = watchSelection(() => calls++);
    vi.advanceTimersByTime(120_000);
    expect(calls).toBe(0);
    mock.emitSelectionChanged();
    mock.emitSelectionChanged();
    mock.emitSelectionChanged();
    vi.advanceTimersByTime(300);
    expect(calls).toBe(1); // regroupés
    stop();
    mock.emitSelectionChanged();
    vi.advanceTimersByTime(300);
    expect(calls).toBe(1);
  });

  it("sans événement : vérification lente (toutes les 5 s) seulement", () => {
    vi.useFakeTimers();
    const m = createMockPremiere();
    delete (m.ppro as { EventManager?: unknown }).EventManager;
    setPproForTests(m.ppro as unknown as premierepro);
    let calls = 0;
    const stop = watchSelection(() => calls++);
    vi.advanceTimersByTime(60_000);
    expect(calls).toBeLessThanOrEqual(12);
    stop();
  });
});

describe("V3 : montage, effets natifs, transitions", () => {
  it("Wipe ajoute UN effet Recadrage et anime le côté droit", async () => {
    const clip = makeTextClip("Wipe", 0, 4);
    mock.state.selection = [clip];
    await apply("wipe-reveal");
    await apply("wipe-reveal");
    const crops = clip.chain.components.filter((c) => c.matchName === "AE.ADBE AECrop");
    expect(crops).toHaveLength(1);
    const right = crops[0].params[2];
    expect(right.keys[0].value).toBeCloseTo(100, 6);
    expect(right.keys.at(-1)!.value).toBeCloseTo(0, 6);
  });

  it("Typewriter : révélation par paliers (une marche par lettre)", async () => {
    const clip = makeTextClip("Tape", 0, 4);
    mock.state.selection = [clip];
    await apply("typewriter", {}, { letters: 4, left: 20, right: 80, duration: 1 });
    const right = clip.component("AE.ADBE AECrop")!.params[2];
    const values = [0.1, 0.35, 0.6, 0.85].map((s) => Math.round(right.valueAt(s * TPS) as number));
    expect(values).toEqual([80, 65, 50, 35]);
  });

  it("Flash ajoute Luminosité et contraste et revient à 0", async () => {
    const clip = makeTextClip("Plan", 0, 4);
    mock.state.selection = [clip];
    await apply("flash", { pivot: "clip" }, {}, "in", "start");
    const b = clip.component("AE.ADBE Brightness & Contrast 2")!.params[0];
    expect(Math.max(...b.keys.map((k) => k.value as number))).toBeGreaterThan(50);
    expect(b.keys.at(-1)!.value).toBeCloseTo(0, 6);
  });

  it("Bandes animées : restent fermées jusqu'à la fin du clip", async () => {
    const clip = makeTextClip("Plan", 0, 4);
    mock.state.selection = [clip];
    await apply("cinema-bars-in", {}, {}, "in", "start");
    const top = clip.component("AE.ADBE AECrop")!.params[1];
    expect(top.valueAt(3.5 * TPS)).toBeCloseTo(12, 4);
  });

  it("Beat Zoom sur les marqueurs : un zoom par marqueur dans le clip", async () => {
    const a = makeTextClip("A", 0, 4);
    const b = makeTextClip("B", 4, 8);
    mock.state.selection = [a, b];
    mock.state.markers = [1, 2, 5.5, 20];
    const report = await apply("beat-zoom", { pivot: "clip" }, {}, "in", "markers");
    expect(report.applied).toBe(2);
    const sa = motionParam(a, 1);
    expect(sa.valueAt(1.05 * TPS)).toBeGreaterThan(104);
    expect(sa.valueAt(1.6 * TPS)).toBeCloseTo(100, 6);
    expect(sa.valueAt(2.05 * TPS)).toBeGreaterThan(104);
    expect(motionParam(b, 1).valueAt(1.55 * TPS)).toBeGreaterThan(104);
  });

  it("marqueurs : erreur claire s'il n'y en a aucun", async () => {
    mock.state.selection = [makeTextClip("A", 0, 4)];
    mock.state.markers = [];
    await expect(apply("beat-zoom", {}, {}, "in", "markers")).rejects.toBeInstanceOf(UserFacingError);
  });

  it("Jump Cut Zoom : alterne plan large / serré sur des plans consécutifs", async () => {
    const shots = [0, 1, 2, 3].map((i) => makeTextClip(`P${i}`, i * 2, i * 2 + 2));
    mock.state.selection = shots;
    await apply("jump-cut-zoom", { pivot: "clip" });
    const scaleOf = (c: VideoClipTrackItem) => motionParam(c, 1).valueAt(1 * TPS) as number;
    expect(shots.map(scaleOf).map((v) => Math.round(v))).toEqual([100, 115, 100, 115]);
  });

  it("Transition native : posée sur chaque coupe entre clips sélectionnés", async () => {
    const shots = [0, 1, 2].map((i) => makeTextClip(`P${i}`, i * 3, i * 3 + 3));
    mock.state.selection = shots;
    const report = await apply("native-cross-dissolve", {}, { duration: 0.8 });
    expect(report.applied).toBe(2);
    expect(shots[0].transitions).toEqual([{ matchName: "AE.ADBE Cross Dissolve New", atStart: false, seconds: 0.8 }]);
    expect(shots[1].transitions).toHaveLength(1);
    expect(shots[2].transitions).toHaveLength(0);
  });

  it("Transition native : début et fin de chaque clip", async () => {
    const clip = makeTextClip("Seul", 0, 3);
    mock.state.selection = [clip];
    await apply("native-dip-black", {}, { placement: "both" });
    expect(clip.transitions.map((t) => t.atStart)).toEqual([true, false]);
  });

  it("Transition native : message clair sans coupe entre les clips", async () => {
    mock.state.selection = [makeTextClip("A", 0, 2), makeTextClip("B", 5, 7)];
    await expect(apply("native-push")).rejects.toBeInstanceOf(UserFacingError);
  });

  it("toutes les transitions natives proposées existent dans le Premiere simulé", async () => {
    const { NATIVE_TRANSITIONS } = await import("../src/animations/montage");
    const { MOCK_TRANSITIONS } = await import("../dev/mock-premierepro");
    for (const t of NATIVE_TRANSITIONS) {
      expect(MOCK_TRANSITIONS.some((n) => t.native!.patterns.some((re) => re.test(n))), t.id).toBe(true);
    }
  });
});
