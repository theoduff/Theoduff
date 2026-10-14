/**
 * Aperçus animés.
 *
 * Les aperçus utilisent EXACTEMENT le même moteur que l'application dans
 * Premiere (définition → courbes → placement dans un clip virtuel). Seul le
 * rendu diffère : du DOM simple (taille, position, opacité), compatible UXP.
 *
 * Sobriété (V2) : un seul minuteur partagé plafonné à 30 i/s, aucune animation
 * quand rien n'est survolé, nombre de boucles limité, copies « flou » créées
 * uniquement pour les animations qui utilisent le flou.
 */
import { placeMotion, type PlacementSpec, type Timeline } from "../engine/timeline";
import type { AnimationDefinition, AnimationMode, ParamValues, TrackKey } from "../engine/types";
import { h, now } from "./dom";

/** Pause pendant laquelle le sujet reste au repos avant de reboucler. */
const HOLD = 0.8;
const GAP = 0.35;
const GHOSTS = 3;
const FRAME_MS = 1000 / 30;
/** Durée du clip virtuel des effets « span » (push-in, Ken Burns…). */
const SPAN_CLIP = 3;

interface Unit {
  main: HTMLElement;
  ghosts: HTMLElement[];
  timeline: Timeline;
}

export interface PreviewOptions {
  /** Taille de police au repos (px) — sert aussi d'échelle pour les sujets vidéo. */
  fontSize: number;
  /** Taille de police que représente cette taille sur une image 1080p. */
  referenceFontPx?: number;
  text?: string;
  /** Nombre de boucles avant arrêt automatique (Infinity = sans fin). */
  maxLoops?: number;
}

const players = new Set<PreviewPlayer>();
let timer: ReturnType<typeof setTimeout> | null = null;
let suspended = false;

function tick() {
  timer = null;
  if (!players.size || suspended) return;
  const t = now();
  for (const p of [...players]) {
    try {
      p.render(t);
    } catch {
      players.delete(p);
    }
  }
  schedule();
}

function schedule() {
  if (timer === null && players.size && !suspended) timer = setTimeout(tick, FRAME_MS);
}

/** Coupe toutes les animations (panneau masqué). */
export function suspendPreviews(value: boolean) {
  suspended = value;
  if (!value) schedule();
}

export class PreviewPlayer {
  readonly el: HTMLElement;
  private units: Unit[] = [];
  private loopLength = 1;
  private startedAt = 0;
  private pausedAt: number | null = null;
  private def?: AnimationDefinition;
  private params: ParamValues = {};
  private mode: AnimationMode = "in";
  private onTime?: (t: number, total: number) => void;
  private onEnd?: () => void;
  private video = false;
  private stageW = 0;
  private stageH = 0;

  constructor(private opts: PreviewOptions) {
    this.el = h("div", { class: "pv-layer" });
  }

  /** Échelle px(1080p) → px d'aperçu. */
  private get pxScale() {
    if (this.video) return (this.stageH || 100) / 1080;
    return this.opts.fontSize / (this.opts.referenceFontPx ?? 110);
  }

  setAnimation(def: AnimationDefinition, params: ParamValues, mode: AnimationMode, text?: string) {
    this.def = def;
    this.params = params;
    this.mode = mode;
    if (text !== undefined) this.opts.text = text;
    this.build();
    this.renderAt(this.currentTime());
  }

  /** Change le sens (entrée / sortie) sans relancer la lecture. */
  setMode(mode: AnimationMode) {
    if (!this.def || mode === this.mode) return;
    this.mode = mode;
    this.build();
    this.renderAt(this.currentTime());
  }

  /** Recalcule la taille de la scène (après insertion dans la page ou redimensionnement). */
  refresh() {
    this.stageW = 0;
    this.stageH = 0;
    this.renderAt(this.currentTime());
  }

  setText(text: string) {
    this.opts.text = text;
    if (this.def && !this.video) {
      this.build();
      this.renderAt(this.currentTime());
    }
  }

  onTimeUpdate(cb: (t: number, total: number) => void) {
    this.onTime = cb;
  }

  onStop(cb: () => void) {
    this.onEnd = cb;
  }

  get playing() {
    return players.has(this);
  }

  play(restart = false) {
    if (restart || this.pausedAt === null) this.startedAt = now();
    else this.startedAt = now() - this.pausedAt * 1000;
    this.pausedAt = null;
    players.add(this);
    schedule();
  }

  pause() {
    this.pausedAt = this.currentTime();
    players.delete(this);
    this.onEnd?.();
  }

  /** Arrête et affiche l'état « au repos » (vignette statique). */
  stop() {
    players.delete(this);
    this.pausedAt = null;
    this.renderAt(this.restTime());
    this.onEnd?.();
  }

  seek(fraction: number) {
    const t = Math.max(0, Math.min(1, fraction)) * this.loopLength;
    this.pausedAt = t;
    players.delete(this);
    this.renderAt(t);
    this.onEnd?.();
  }

  destroy() {
    players.delete(this);
  }

  render(ts: number) {
    const elapsed = (ts - this.startedAt) / 1000;
    const maxLoops = this.opts.maxLoops ?? Infinity;
    if (elapsed >= this.loopLength * maxLoops) {
      this.stop();
      return;
    }
    this.renderAt(((elapsed % this.loopLength) + this.loopLength) % this.loopLength);
  }

  private currentTime() {
    if (this.pausedAt !== null) return this.pausedAt;
    if (!players.has(this)) return this.restTime();
    return ((((now() - this.startedAt) / 1000) % this.loopLength) + this.loopLength) % this.loopLength;
  }

  /** Instant affiché en vignette : sujet visible et représentatif. */
  private restTime() {
    const def = this.def;
    if (!def) return 0;
    const pl = this.units[0]?.timeline.placement;
    if (def.kind === "span") return SPAN_CLIP * 0.6;
    if (def.kind === "accent") return (pl?.start ?? 0) + ((pl?.end ?? 0) - (pl?.start ?? 0)) * 0.25;
    return this.mode === "out" ? 0.2 : this.maxEntry() + Math.min(0.3, HOLD / 2);
  }

  private maxEntry() {
    return this.units.reduce((m, u) => {
      const p = u.timeline.placement;
      return Math.max(m, p.inEnd ?? (p.outEnd ?? 0) - (p.outStart ?? 0));
    }, 0);
  }

  private build() {
    const def = this.def;
    if (!def) return;
    this.video = def.subject === "video";
    this.stageW = 0;
    this.el.innerHTML = "";
    const needsGhosts = def.uses.includes("blur");

    // Clip virtuel : même placement que dans Premiere.
    let clip: number;
    let words: string[];
    if (this.video) words = ["scene"];
    else {
      const text = (this.opts.text || def.previewText || def.name).trim() || def.name;
      words = def.multiLayer ? text.split(/\s+/).filter(Boolean).slice(0, 8) : [text];
    }
    const count = words.length;
    const probe = def.build(this.params, { index: 0, count, clipDuration: SPAN_CLIP });
    const motions = words.map((_, i) => (i === 0 ? probe : def.build(this.params, { index: i, count, clipDuration: SPAN_CLIP })));
    const entry = Math.max(...motions.map((m) => m.delay + m.duration));
    let spec: PlacementSpec;
    if (def.kind === "span") {
      clip = SPAN_CLIP;
      spec = { type: "span" };
    } else if (def.kind === "accent") {
      clip = entry + HOLD * 1.4;
      spec = { type: "accent", at: HOLD * 0.7 };
    } else {
      clip = this.mode === "inOut" ? entry * 2 + HOLD : entry + HOLD;
      spec = { type: "entrance", mode: this.mode };
    }
    this.loopLength = clip + GAP;

    if (this.video) {
      // Image vidéo simulée : ciel, soleil, collines, sujet.
      // Décor varié selon l'animation pour distinguer les vignettes.
      const variant = `v${[...def.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 3}`;
      const scene = () =>
        h(
          "div",
          { class: `pv-scene ${variant}` },
          h("div", { class: "pv-sun" }),
          h("div", { class: "pv-hill back" }),
          h("div", { class: "pv-hill front" }),
          h("div", { class: "pv-subject" }),
        );
      const ghosts: HTMLElement[] = [];
      if (needsGhosts) for (let g = 0; g < 2; g++) ghosts.push(scene());
      const main = scene();
      for (const g of ghosts) this.el.appendChild(g);
      this.el.appendChild(main);
      this.el.classList.add("is-video");
      this.units = [{ main, ghosts, timeline: placeMotion(motions[0], spec, clip, 1 / 60) }];
      return;
    }

    this.el.classList.remove("is-video");
    this.el.style.fontSize = `${this.opts.fontSize}px`;
    const row = h("div", { class: "pv-row" });
    this.units = words.map((word, i) => {
      const ghosts: HTMLElement[] = [];
      const wrap = h("div", { class: "pv-unit" }, h("span", { class: "pv-text pv-sizer" }, word));
      if (needsGhosts) {
        for (let g = 0; g < GHOSTS; g++) {
          const ghost = h("span", { class: "pv-text pv-ghost" }, word);
          ghosts.push(ghost);
          wrap.appendChild(h("div", { class: "pv-anim" }, ghost));
        }
      }
      const main = h("span", { class: "pv-text" }, word);
      wrap.appendChild(h("div", { class: "pv-anim" }, main));
      row.appendChild(wrap);
      return { main, ghosts, timeline: placeMotion(motions[i], spec, clip, 1 / 60) };
    });
    this.el.appendChild(row);
  }

  private renderAt(t: number) {
    if (this.video && !this.stageW) {
      const r = this.el.getBoundingClientRect();
      this.stageW = r.width;
      this.stageH = r.height;
    }
    const k = this.pxScale;
    const inClip = t <= this.loopLength - GAP;
    for (const u of this.units) {
      const tl = u.timeline;
      const val = (key: TrackKey, fallback: number) => (tl.tracks.includes(key) ? tl.valueAt(key, inClip ? t : 0) : fallback);
      let scale = val("scale", 1);
      let opacity = val("opacity", 1);
      const x = val("x", 0) * k;
      const y = val("y", 0) * k;
      const rot = val("rotation", 0);
      const blur = val("blur", 0) * k;
      if (!inClip && this.def?.kind === "entrance" && this.mode !== "in") opacity = 0;
      if (!inClip && this.def?.kind === "entrance" && this.mode === "in") scale = val("scale", 1);
      opacity = Math.max(0, Math.min(1, opacity));
      const blurMix = blur > 0.05 ? Math.min(0.85, blur / (blur + 4)) : 0;
      if (this.video) {
        renderScene(u.main, this.stageW, this.stageH, scale, x, y, rot, opacity * (1 - blurMix * 0.5));
        u.ghosts.forEach((g, i) => {
          const r = blur * (i ? -0.8 : 0.8);
          renderScene(g, this.stageW, this.stageH, scale * (1 + blur / 600), x + r, y, rot, blurMix ? opacity * blurMix * 0.45 : 0);
        });
        continue;
      }
      const visible = scale > 0.015 && opacity > 0.002;
      const size = `${Math.max(0.5, this.opts.fontSize * Math.max(0, scale)).toFixed(1)}px`;
      styleText(u.main, size, x, y, visible ? opacity * (1 - blurMix) : 0);
      for (let g = 0; g < u.ghosts.length; g++) {
        if (!blurMix || !visible) {
          if (u.ghosts[g].style.opacity !== "0") u.ghosts[g].style.opacity = "0";
          continue;
        }
        const angle = (g / u.ghosts.length) * Math.PI * 2;
        const r = blur * 0.7;
        styleText(u.ghosts[g], size, x + Math.cos(angle) * r, y + Math.sin(angle) * r, (opacity * blurMix * 1.4) / u.ghosts.length + 0.02 * opacity);
      }
    }
    this.onTime?.(Math.min(t, this.loopLength), this.loopLength);
  }
}

function styleText(el: HTMLElement, size: string, x: number, y: number, opacity: number) {
  const s = el.style;
  if (s.fontSize !== size) s.fontSize = size;
  s.left = `${x.toFixed(1)}px`;
  s.top = `${y.toFixed(1)}px`;
  s.opacity = opacity.toFixed(3);
}

/** Positionne l'image simulée (zoom autour du centre, décalage, rotation). */
function renderScene(el: HTMLElement, W: number, H: number, scale: number, x: number, y: number, rot: number, opacity: number) {
  const w = W * scale;
  const hgt = H * scale;
  const s = el.style;
  s.width = `${w.toFixed(1)}px`;
  s.height = `${hgt.toFixed(1)}px`;
  s.left = `${((W - w) / 2 + x).toFixed(1)}px`;
  s.top = `${((H - hgt) / 2 + y).toFixed(1)}px`;
  s.opacity = opacity.toFixed(3);
  const tr = Math.abs(rot) > 0.01 ? `rotate(${rot.toFixed(2)}deg)` : "";
  if (s.transform !== tr) s.transform = tr;
}
