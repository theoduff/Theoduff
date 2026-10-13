/**
 * Aperçus animés.
 *
 * Les aperçus utilisent EXACTEMENT le même moteur que l'application dans
 * Premiere (définition → courbes → placement dans un clip virtuel). Seul le
 * rendu diffère : ici, du DOM (taille de police, position relative, opacité,
 * copies décalées pour simuler le flou), des propriétés sûres dans UXP.
 */
import { placeMotion, type Timeline } from "../engine/timeline";
import type { AnimationDefinition, AnimationMode, ParamValues } from "../engine/types";
import { h, now, raf } from "./dom";

/** Pause pendant laquelle le texte reste au repos avant de reboucler. */
const HOLD = 0.9;
const GAP = 0.35;
const GHOSTS = 6;

interface Unit {
  wrap: HTMLElement;
  main: HTMLElement;
  ghosts: HTMLElement[];
  timeline: Timeline;
}

export interface PreviewOptions {
  /** Taille de police au repos (px). */
  fontSize: number;
  /** Taille de police que représente cette taille sur une image 1080p. */
  referenceFontPx?: number;
  text?: string;
}

const players = new Set<PreviewPlayer>();
let ticking = false;

function tick() {
  if (!players.size) {
    ticking = false;
    return;
  }
  const t = now();
  for (const p of players) p.render(t);
  raf(tick);
}

function startTicker() {
  if (ticking) return;
  ticking = true;
  raf(tick);
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

  constructor(private opts: PreviewOptions) {
    this.el = h("div", { class: "pv-layer" });
  }

  /** Échelle px(1080p) → px d'aperçu : un titre 1080p fait ~110 px de haut. */
  private get pxScale() {
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

  setText(text: string) {
    this.opts.text = text;
    if (this.def) this.build();
    this.renderAt(this.currentTime());
  }

  onTimeUpdate(cb: (t: number, total: number) => void) {
    this.onTime = cb;
  }

  get playing() {
    return players.has(this);
  }

  play(restart = false) {
    if (restart) this.startedAt = now();
    else if (this.pausedAt !== null) this.startedAt = now() - this.pausedAt * 1000;
    this.pausedAt = null;
    players.add(this);
    startTicker();
  }

  pause() {
    this.pausedAt = this.currentTime();
    players.delete(this);
  }

  /** Arrête et affiche l'état « au repos » (vignette statique). */
  stop() {
    players.delete(this);
    this.pausedAt = null;
    this.renderAt(this.restTime());
  }

  seek(fraction: number) {
    const t = Math.max(0, Math.min(1, fraction)) * this.loopLength;
    this.pausedAt = t;
    players.delete(this);
    this.renderAt(t);
  }

  destroy() {
    players.delete(this);
  }

  render(ts: number) {
    const t = (((ts - this.startedAt) / 1000) % this.loopLength + this.loopLength) % this.loopLength;
    this.renderAt(t);
  }

  private currentTime() {
    if (this.pausedAt !== null) return this.pausedAt;
    if (!players.has(this)) return this.restTime();
    return (((now() - this.startedAt) / 1000) % this.loopLength + this.loopLength) % this.loopLength;
  }

  /** Instant où le texte est entièrement visible (vignette). */
  private restTime() {
    const maxIn = this.maxEntry();
    return this.mode === "out" ? 0.2 : maxIn + Math.min(0.3, HOLD / 2);
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
    const text = (this.opts.text || def.previewText || def.name).trim() || def.name;
    const words = def.multiLayer ? text.split(/\s+/).filter(Boolean) : [text];
    const count = words.length;
    // Durée maximale d'entrée parmi les unités (mot par mot = cascade).
    const motions = words.map((_, i) => def.build(this.params, { index: i, count }));
    const entry = Math.max(...motions.map((m) => m.delay + m.duration));
    const clip = this.mode === "inOut" ? entry * 2 + HOLD : entry + HOLD;
    this.loopLength = clip + GAP;
    this.el.innerHTML = "";
    this.el.style.fontSize = `${this.opts.fontSize}px`;
    const row = h("div", { class: "pv-row" });
    this.units = words.map((word, i) => {
      // Chaque copie (fantômes du flou + texte principal) a son propre calque
      // centré : elles se superposent exactement, décalées via left/top.
      const ghosts: HTMLElement[] = [];
      const wrap = h("div", { class: "pv-unit" }, h("span", { class: "pv-text pv-sizer" }, word));
      for (let g = 0; g < GHOSTS; g++) {
        const ghost = h("span", { class: "pv-text pv-ghost" }, word);
        ghosts.push(ghost);
        wrap.appendChild(h("div", { class: "pv-anim" }, ghost));
      }
      const main = h("span", { class: "pv-text" }, word);
      wrap.appendChild(h("div", { class: "pv-anim" }, main));
      row.appendChild(wrap);
      return { wrap, main, ghosts, timeline: placeMotion(motions[i], this.mode, clip, 1 / 60) };
    });
    this.el.appendChild(row);
  }

  private renderAt(t: number) {
    const k = this.pxScale;
    const base = this.opts.fontSize;
    const inClip = t <= this.loopLength - GAP;
    for (const u of this.units) {
      const tl = u.timeline;
      const has = (key: Parameters<Timeline["valueAt"]>[0]) => tl.tracks.includes(key);
      let scale = has("scale") ? tl.valueAt("scale", t) : 1;
      let opacity = has("opacity") ? tl.valueAt("opacity", t) : 1;
      const x = (has("x") ? tl.valueAt("x", t) : 0) * k;
      const y = (has("y") ? tl.valueAt("y", t) : 0) * k;
      const blur = (has("blur") ? tl.valueAt("blur", t) : 0) * k;
      if (!inClip) {
        // Entre deux boucles : état de départ pour une entrée, invisible sinon.
        opacity = this.mode === "out" || this.mode === "inOut" ? 0 : has("opacity") ? tl.valueAt("opacity", 0) : 1;
        scale = has("scale") ? tl.valueAt("scale", 0) : 1;
      }
      opacity = Math.max(0, Math.min(1, opacity));
      const visible = scale > 0.015 && opacity > 0.002;
      const size = `${Math.max(0.5, base * Math.max(0, scale)).toFixed(2)}px`;
      const blurMix = blur > 0.05 ? Math.min(0.85, blur / (blur + 4)) : 0;
      style(u.main, size, x, y, visible ? opacity * (1 - blurMix) : 0);
      for (let g = 0; g < u.ghosts.length; g++) {
        if (!blurMix || !visible) {
          u.ghosts[g].style.opacity = "0";
          continue;
        }
        const angle = (g / u.ghosts.length) * Math.PI * 2;
        const r = blur * 0.7;
        style(u.ghosts[g], size, x + Math.cos(angle) * r, y + Math.sin(angle) * r, (opacity * blurMix * 1.6) / u.ghosts.length + 0.02 * opacity);
      }
    }
    this.onTime?.(Math.min(t, this.loopLength), this.loopLength);
  }
}

function style(el: HTMLElement, size: string, x: number, y: number, opacity: number) {
  const s = el.style;
  if (s.fontSize !== size) s.fontSize = size;
  s.left = `${x.toFixed(2)}px`;
  s.top = `${y.toFixed(2)}px`;
  s.opacity = opacity.toFixed(3);
}
