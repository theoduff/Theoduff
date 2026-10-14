/**
 * Banc d'essai navigateur : simule Premiere Pro pour développer et tester
 * l'interface hors de Premiere. Rien de ceci n'est inclus dans le plugin.
 */
import { createMockPremiere, makeTextClip, AudioClipTrackItem } from "./mock-premierepro";

type Mock = ReturnType<typeof createMockPremiere>;
let mock: Mock = createMockPremiere();

(globalThis as unknown as { require: (id: string) => unknown }).require = (id: string) => {
  if (id === "premierepro") return mock.ppro;
  throw new Error(`Module ${id} indisponible dans le banc d'essai`);
};

const WORDS = ["Un", "mot", "à", "la", "fois"];

function setSelection(kind: string) {
  setSelectionRaw(kind);
  mock.emitSelectionChanged();
}

function setSelectionRaw(kind: string) {
  const opts = { width: mock.width, height: mock.height };
  switch (kind) {
    case "none":
      mock.state.selection = [];
      break;
    case "one":
      mock.state.selection = [makeTextClip("Titre principal", 2, 6, { ...opts, textPosition: [mock.width / 2, mock.height * 0.5] })];
      break;
    case "subtitle":
      mock.state.selection = [makeTextClip("Sous-titre en bas", 2, 6, { ...opts, textPosition: [mock.width / 2, mock.height * 0.85] })];
      break;
    case "words":
      mock.state.selection = WORDS.map((w, i) => makeTextClip(w, 2, 6, { ...opts, track: i + 1 }));
      break;
    case "shots":
      mock.state.selection = Array.from({ length: 4 }, (_, i) => makeTextClip(`Plan ${i + 1}`, i * 3, i * 3 + 3, opts));
      mock.state.markers = [1, 2, 4, 5, 7.5, 10];
      break;
    case "thirty":
      mock.state.selection = Array.from({ length: 30 }, (_, i) => makeTextClip(`Texte ${i + 1}`, i * 0.5, i * 0.5 + 3, opts));
      break;
    case "mixed":
      mock.state.selection = [makeTextClip("Titre", 0, 4, opts), new AudioClipTrackItem()];
      break;
    case "no-sequence":
      mock.state.selection = [];
      mock.state.hasSequence = false;
      return;
  }
  mock.state.hasSequence = true;
}

function setFormat(fmt: string) {
  const sizes: Record<string, [number, number, number]> = {
    hd: [1920, 1080, 25],
    uhd: [3840, 2160, 25],
    reels: [1080, 1920, 30],
  };
  const [width, height, fps] = sizes[fmt] ?? sizes.hd;
  const previous = mock.state.selection.length;
  const listeners = mock.state.listeners;
  mock = createMockPremiere({ width, height, fps });
  mock.state.listeners = listeners;
  if (previous) setSelection((document.getElementById("sel") as HTMLSelectElement).value);
}

function renderLog() {
  const log = document.getElementById("log");
  if (!log) return;
  const tx = mock.state.transactions.slice(-12).reverse();
  log.textContent =
    `Appels API : ${mock.state.apiCalls}\n` +
    (tx.length ? tx.map((t) => `${t.ok ? "✔" : "✕"} ${t.label} — ${t.actions} action(s)`).join("\n") : "Aucune transaction pour l'instant.");
  (window as unknown as { __mock: Mock }).__mock = mock;
}

function wire() {
  const sel = document.getElementById("sel") as HTMLSelectElement | null;
  const fmt = document.getElementById("fmt") as HTMLSelectElement | null;
  const width = document.getElementById("width") as HTMLInputElement | null;
  const frame = document.getElementById("frame") as HTMLElement | null;
  sel?.addEventListener("change", () => setSelection(sel.value));
  const ph = document.getElementById("playhead") as HTMLInputElement | null;
  ph?.addEventListener("input", () => {
    mock.state.playhead = Number(ph.value);
    const label = document.getElementById("playhead-label");
    if (label) label.textContent = `${Number(ph.value).toFixed(1)} s`;
  });
  fmt?.addEventListener("change", () => setFormat(fmt.value));
  width?.addEventListener("input", () => {
    if (frame) frame.style.width = `${width.value}px`;
    const label = document.getElementById("width-label");
    if (label) label.textContent = `${width.value} px`;
  });
  const params = new URLSearchParams(location.search);
  if (params.get("sel") && sel) sel.value = params.get("sel")!;
  if (params.get("w") && width && frame) {
    width.value = params.get("w")!;
    frame.style.width = `${width.value}px`;
  }
  setSelection(sel?.value ?? "one");
  setInterval(renderLog, 400);
}

wire();
void import("../src/main");
