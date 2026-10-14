/**
 * Interface MotionCraft Pro (V2.1).
 *
 * Inspirée des panneaux de référence du marché (PX-Kinetype, TypeMotion,
 * Typoking, Motion Bro) : rail d'icônes de catégories, grandes vignettes
 * animées, champ « Votre texte », barre d'action fixe Entrée / Sortie /
 * Entrée + sortie (ou tête de lecture), panneau de réglages en onglets.
 */
import { ANIMATIONS, CATEGORIES, defaultParams, FAMILIES, familyOf, getAnimation, matchesQuery, sanitizeParams } from "../animations/registry";
import { getEasing } from "../engine/easing";
import type { AccentAnchor, AnimationDefinition, AnimationMode, CategoryId, ChoiceParam, FamilyId, NumberParam, ParamSpec, ParamValues, TrackKey } from "../engine/types";
import { applyAnimation, getSelectionInfo, inspectSelection, watchSelection, type SelectionInfo } from "../premiere/adapter";
import { getUxp, UserFacingError } from "../premiere/host";
import { exportPresets, importPresets, makePresetId, type UserPreset } from "../state/presets";
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from "../state/settings";
import { load, save } from "../state/storage";
import { choice, segmented, select, slider, textField, toggle } from "./controls";
import { cx, formatNumber, h, replaceChildren } from "./dom";
import { icon } from "./icons";
import { PreviewPlayer, suspendPreviews } from "./preview";

export const VERSION = "3.0.0";

type Filter = "all" | "favorites" | `family:${FamilyId}` | CategoryId;
type View = "library" | "inspector" | "settings";
type InspectorTab = "settings" | "presets";

const MODE_OPTIONS: { value: AnimationMode; label: string; short: string }[] = [
  { value: "in", label: "Entrée", short: "In" },
  { value: "out", label: "Sortie", short: "Out" },
  { value: "inOut", label: "Entrée + sortie", short: "In / Out" },
];


const SPEEDS: { value: string; label: string; factor: number }[] = [
  { value: "0.5", label: "Lent", factor: 0.5 },
  { value: "0.75", label: "Posé", factor: 0.75 },
  { value: "1", label: "Normal", factor: 1 },
  { value: "1.5", label: "Rapide", factor: 1.5 },
  { value: "2", label: "Éclair", factor: 2 },
];

const PROPERTY_LABEL: Record<TrackKey, string> = {
  scale: "Échelle",
  opacity: "Opacité",
  x: "Position",
  y: "Position",
  rotation: "Rotation",
  blur: "Flou gaussien",
  cropL: "Recadrage",
  cropR: "Recadrage",
  cropT: "Recadrage",
  cropB: "Recadrage",
  bright: "Luminosité",
};

const GROUP_LABEL: Record<NonNullable<ParamSpec["group"]>, string> = {
  timing: "Timing",
  motion: "Mouvement",
  style: "Style",
};

/** Couleur d'identité de chaque catégorie (rail, vignettes, badges). */
export const CATEGORY_COLOR: Record<CategoryId, string> = {
  pop: "#8B7CFF",
  blur: "#5BC0EB",
  slide: "#4FD1A5",
  word: "#F2C94C",
  bounce: "#FF7AB6",
  accent: "#FF9F5A",
  zoom: "#B794F6",
  shake: "#F87171",
  camera: "#38BDF8",
  transition: "#F5A524",
  edit: "#34D399",
  native: "#60A5FA",
  fx: "#FBBF24",
};

const FAMILY_ICON: Record<FamilyId, string> = { text: "word", video: "film", edit: "scissors" };

/** Libellés courts affichés sous les icônes du rail. */
const RAIL_LABEL: Record<string, string> = {
  all: "Toutes",
  favorites: "Favoris",
  "family:text": "Texte",
  "family:video": "Vidéo",
  "family:edit": "Montage",
  edit: "Zooms",
  native: "Transit. Pr",
  fx: "Effets",
  pop: "Pop",
  blur: "Flou",
  slide: "Glisser",
  word: "Mots",
  bounce: "Rebond",
  accent: "Accent",
  zoom: "Zoom",
  shake: "Secousse",
  camera: "Caméra",
  transition: "Transition",
};

const C = {
  text: "#EDEEF0",
  text2: "#A7ABB4",
  text3: "#6E727C",
  accent: "#8B7CFF",
  star: "#F5C451",
  success: "#3ECF8E",
  warning: "#F5A524",
  danger: "#F2555A",
};

interface State {
  query: string;
  filter: Filter;
  selectedId: string;
  favorites: string[];
  paramsById: Record<string, ParamValues>;
  presets: UserPreset[];
  settings: Settings;
  selection: SelectionInfo;
  view: View;
  layout: "narrow" | "wide" | "full";
  listMode: boolean;
  tab: InspectorTab;
  applying: boolean;
  status: string;
}

export class App {
  private s: State;
  private root: HTMLElement;
  private els!: {
    pill: HTMLElement;
    rail: HTMLElement;
    libHead: HTMLElement;
    grid: HTMLElement;
    gridScroll: HTMLElement;
    search: HTMLInputElement;
    yourText: HTMLInputElement;
    inspector: HTMLElement;
    actionbar: HTMLElement;
    sheet: HTMLElement;
    toasts: HTMLElement;
    notice?: HTMLElement;
  };
  private cardPlayers: PreviewPlayer[] = [];
  private mainPlayer?: PreviewPlayer;
  private stopWatching?: () => void;
  private selectionKey = "";
  private refreshing = false;
  private lastRefresh = 0;
  private lastWidth = 0;
  private textTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    const favorites = load<string[]>("favorites", []);
    this.s = {
      query: "",
      filter: "all",
      selectedId: load<string>("selected", ANIMATIONS[0].id),
      favorites: Array.isArray(favorites) ? favorites.filter((id) => getAnimation(id)) : [],
      paramsById: load<Record<string, ParamValues>>("params", {}),
      presets: load<UserPreset[]>("presets", []),
      settings: sanitizeSettings(load("settings", DEFAULT_SETTINGS)),
      selection: { status: "no-host", clips: [], ignored: 0 },
      view: "library",
      layout: "wide",
      listMode: load<boolean>("listMode", false) === true,
      tab: "settings",
      applying: false,
      status: "Prêt.",
    };
    if (!getAnimation(this.s.selectedId)) this.s.selectedId = ANIMATIONS[0].id;
  }

  /* ---------------------------------------------------------------- */
  /* Cycle de vie                                                       */
  /* ---------------------------------------------------------------- */

  mount() {
    this.root.classList.add("mc-app");
    if (getUxp()) this.root.classList.add("uxp");
    replaceChildren(this.root, this.buildShell());
    this.root.classList.toggle("list-mode", this.s.listMode);
    this.updateLayout();
    this.renderNav();
    this.renderGrid();
    this.renderInspector();
    this.renderActionBar();
    this.renderStatus();
    // Pas de minuteur permanent : on réagit au redimensionnement et au retour de la souris.
    window.addEventListener("resize", () => this.updateLayout());
    this.root.addEventListener("mouseenter", () => {
      this.updateLayout();
      if (Date.now() - this.lastRefresh > 800) void this.refreshSelection();
    });
    document.addEventListener("keydown", (e) => this.onKey(e));
    this.start();
  }

  /** Panneau visible : suivi de la sélection, aperçus autorisés. */
  start() {
    suspendPreviews(false);
    if (this.stopWatching) return;
    void this.refreshSelection();
    this.stopWatching = watchSelection(() => void this.refreshSelection());
  }

  /** Panneau masqué : on coupe les aperçus et le suivi. */
  stop() {
    this.stopWatching?.();
    this.stopWatching = undefined;
    suspendPreviews(true);
    this.mainPlayer?.pause();
    this.cardPlayers.forEach((p) => p.stop());
  }

  /* ---------------------------------------------------------------- */
  /* Structure                                                          */
  /* ---------------------------------------------------------------- */

  private buildShell(): HTMLElement {
    const pill = h("button", { class: "pill", type: "button", title: "Actualiser la sélection", onclick: () => void this.refreshSelection(true) });
    const onQuery = () => {
      this.renderGrid();
      this.renderNav();
    };
    const search = h("input", {
      class: "search-input",
      type: "text",
      placeholder: "Rechercher : zoom, shake, flou, mot…",
      oninput: (e: Event) => {
        this.s.query = (e.target as HTMLInputElement).value;
        onQuery();
      },
    });
    const clearSearch = h(
      "button",
      {
        class: "search-clear",
        type: "button",
        title: "Effacer",
        onclick: () => {
          search.value = "";
          this.s.query = "";
          onQuery();
          search.focus();
        },
      },
      icon("x", C.text3, 13),
    );
    const yourText = h("input", {
      class: "yourtext-input",
      type: "text",
      maxLength: 40,
      value: this.s.settings.previewText,
      placeholder: "Votre texte d'aperçu…",
      oninput: (e: Event) => this.onPreviewText((e.target as HTMLInputElement).value),
    });
    const rail = h("nav", { class: "rail" });
    const libHead = h("div", { class: "lib-head" });
    const grid = h("div", { class: "grid" });
    const gridScroll = h("div", { class: "scroll grid-scroll" }, grid);
    const inspector = h("div", { class: "inspector" });
    const actionbar = h("footer", { class: "actionbar" });
    const sheet = h("div", { class: "sheet hidden" });
    const toasts = h("div", { class: "toasts" });

    const library = h(
      "section",
      { class: "library" },
      libHead,
      h(
        "div",
        { class: "lib-tools" },
        h("div", { class: "search" }, icon("search", C.text3, 15), search, h("span", { class: "kbd" }, "/"), clearSearch),
        h("label", { class: "yourtext", title: "Texte utilisé dans les aperçus" }, icon("word", C.text3, 14), yourText),
      ),
      gridScroll,
    );
    const body = h("div", { class: "body" }, rail, library, inspector);
    this.els = { pill, rail, libHead, grid, gridScroll, search, yourText, inspector, actionbar, sheet, toasts };

    return h(
      "div",
      { class: "shell" },
      h(
        "header",
        { class: "topbar" },
        h(
          "div",
          { class: "brand" },
          h("span", { class: "logo" }, h("img", { src: "icons/plugin@2x.png", width: 22, height: 22, alt: "" })),
          h("span", { class: "brand-name" }, "MotionCraft"),
          h("span", { class: "badge-pro" }, "PRO"),
        ),
        h("div", { class: "spacer" }),
        pill,
        h("button", { class: "icon-btn", type: "button", title: "Réglages", onclick: () => this.openSettings() }, icon("settings", C.text2, 16)),
      ),
      body,
      actionbar,
      sheet,
      toasts,
    );
  }

  private onPreviewText(v: string) {
    if (this.textTimer) clearTimeout(this.textTimer);
    this.textTimer = setTimeout(() => {
      this.updateSettings({ previewText: v });
      for (const p of this.cardPlayers) p.setText(v);
      this.mainPlayer?.setText(v || this.current().previewText || "");
    }, 150);
  }

  private updateLayout() {
    const width = this.root.getBoundingClientRect().width || window.innerWidth;
    if (Math.abs(width - this.lastWidth) < 1) return;
    this.lastWidth = width;
    const layout = width >= 900 ? "full" : width >= 640 ? "wide" : "narrow";
    const size = width < 340 ? "xs" : width < 640 ? "sm" : width < 900 ? "md" : "lg";
    this.root.setAttribute("data-size", size);
    if (layout !== "narrow" && this.s.view === "inspector") this.s.view = "library";
    this.s.layout = layout;
    this.root.setAttribute("data-layout", layout);
    this.applyView();
    this.layoutGrid();
    this.cardPlayers.forEach((p) => p.refresh());
    this.mainPlayer?.refresh();
  }

  private applyView() {
    this.root.setAttribute("data-view", this.s.view);
  }

  private layoutGrid() {
    const w = this.els.gridScroll.getBoundingClientRect().width || 300;
    const size = this.root.getAttribute("data-size");
    const min = this.s.listMode ? 9999 : size === "xs" || size === "sm" ? 118 : 150;
    const cols = Math.max(1, Math.min(5, Math.floor((w - 4) / (min + 12))));
    this.els.grid.setAttribute("data-cols", String(cols));
    const pct = `${(100 / cols).toFixed(4)}%`;
    for (const card of Array.from(this.els.grid.children) as HTMLElement[]) {
      if (card.classList.contains("card-cell")) card.style.width = pct;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Sélection Premiere                                                 */
  /* ---------------------------------------------------------------- */

  private async refreshSelection(manual = false) {
    if (this.refreshing) return;
    this.refreshing = true;
    this.lastRefresh = Date.now();
    try {
      const info = await getSelectionInfo();
      const key = JSON.stringify([info.status, info.clips.map((c) => c.name), info.ignored]);
      if (key !== this.selectionKey || manual) {
        this.selectionKey = key;
        this.s.selection = info;
        this.renderStatus();
      }
    } catch (e) {
      if (manual) this.toast("error", "Impossible de lire la sélection", messageOf(e));
    } finally {
      this.refreshing = false;
    }
  }

  private selectionLabel(): { tone: string; text: string } {
    const sel = this.s.selection;
    const n = sel.clips.length;
    if (sel.status === "no-project") return { tone: "idle", text: "Aucun projet" };
    if (sel.status === "no-sequence") return { tone: "idle", text: "Aucune séquence" };
    if (sel.status !== "ok") return { tone: "idle", text: "Premiere indisponible" };
    return n ? { tone: "ok", text: `${n} clip${n > 1 ? "s" : ""} sélectionné${n > 1 ? "s" : ""}` } : { tone: "warn", text: "Aucun clip sélectionné" };
  }

  private renderStatus() {
    const { tone, text } = this.selectionLabel();
    replaceChildren(this.els.pill, h("span", { class: cx("dot", tone) }), h("span", { class: "pill-text" }, text));
    const sel = this.s.selection;
    const names = sel.clips.map((c) => c.name).filter(Boolean);
    this.els.pill.title =
      sel.status === "ok" && sel.clips.length
        ? `${names.join(", ")}${sel.clips.length > names.length ? "…" : ""}\nCliquer pour actualiser`
        : "Sélectionnez un ou plusieurs clips dans la timeline · Cliquer pour actualiser";
    this.renderActionBar();
    this.updateNotice();
  }

  /* ---------------------------------------------------------------- */
  /* Rail de catégories (façon PX-Kinetype)                             */
  /* ---------------------------------------------------------------- */

  private matchesFilter(a: AnimationDefinition, f: Filter): boolean {
    if (f === "all") return true;
    if (f === "favorites") return this.s.favorites.includes(a.id);
    if (f.startsWith("family:")) return familyOf(a) === f.slice(7);
    return a.category === f;
  }

  private filtered(): AnimationDefinition[] {
    return ANIMATIONS.filter((a) => this.matchesFilter(a, this.s.filter) && matchesQuery(a, this.s.query));
  }

  private setFilter(f: Filter) {
    this.s.filter = f;
    this.renderNav();
    this.renderGrid();
    this.els.gridScroll.scrollTop = 0;
  }

  private filterLabel(f: Filter): { title: string; color: string; iconName: string } {
    if (f === "all") return { title: "Toutes les animations", color: "#EDEEF0", iconName: "all" };
    if (f === "favorites") return { title: "Favoris", color: C.star, iconName: "star" };
    if (f.startsWith("family:")) {
      const fam = FAMILIES.find((x) => x.id === f.slice(7));
      return { title: `Tout ${fam?.label.toLowerCase() ?? ""}`, color: "#EDEEF0", iconName: FAMILY_ICON[(fam?.id ?? "text") as FamilyId] };
    }
    const cat = CATEGORIES.find((c) => c.id === f);
    return { title: cat?.label ?? "", color: CATEGORY_COLOR[f as CategoryId] ?? C.accent, iconName: f };
  }

  private renderNav() {
    const searchOnly = ANIMATIONS.filter((a) => matchesQuery(a, this.s.query));
    const count = (f: Filter) => searchOnly.filter((a) => this.matchesFilter(a, f)).length;
    const present = CATEGORIES.filter((c) => ANIMATIONS.some((a) => a.category === c.id));
    const btn = (f: Filter) => {
      const { title, color, iconName } = this.filterLabel(f);
      const on = this.s.filter === f;
      const n = count(f);
      return h(
        "button",
        {
          type: "button",
          class: cx("rail-btn", on && "active", !n && "is-empty"),
          title: `${title} (${n})`,
          "data-filter": f,
          onclick: () => this.setFilter(f),
        },
        h("div", { class: "rail-dot", style: { backgroundColor: hexAlpha(color, on ? 0.3 : 0.14), borderColor: on ? color : "transparent" } }, icon(iconName, color, 17, f === "favorites" && on)),
        h("div", { class: "rail-label" }, RAIL_LABEL[f] ?? title),
      );
    };
    replaceChildren(
      this.els.rail,
      btn("all"),
      btn("favorites"),
      FAMILIES.map((fam) => [
        h("div", { class: "rail-sep", title: fam.label }),
        btn(`family:${fam.id}`),
        present.filter((c) => c.family === fam.id).map((c) => btn(c.id)),
      ]),
    );

    // En-tête de la bibliothèque : catégorie courante + vue grille / liste
    const { title, color } = this.filterLabel(this.s.filter);
    const total = this.filtered().length;
    const viewBtn = (list: boolean, iconName: string, label: string) =>
      h(
        "button",
        {
          type: "button",
          class: cx("icon-btn small view-btn", this.s.listMode === list && "active"),
          title: label,
          onclick: () => {
            this.s.listMode = list;
            save("listMode", list);
            this.root.classList.toggle("list-mode", list);
            this.renderNav();
            this.layoutGrid();
            this.cardPlayers.forEach((p) => p.refresh());
          },
        },
        icon(iconName, this.s.listMode === list ? C.text : C.text3, 15),
      );
    replaceChildren(
      this.els.libHead,
      h("span", { class: "lib-dot", style: { backgroundColor: color } }),
      h("div", { class: "lib-title-wrap" }, h("div", { class: "lib-title" }, title), h("div", { class: "lib-sub" }, `${total} animation${total > 1 ? "s" : ""}`)),
      h("div", { class: "spacer" }),
      viewBtn(false, "all", "Vue grille"),
      viewBtn(true, "list", "Vue liste"),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Grille                                                             */
  /* ---------------------------------------------------------------- */

  private renderGrid() {
    this.cardPlayers.forEach((p) => p.destroy());
    this.cardPlayers = [];
    const list = this.filtered();
    if (!list.length) {
      const fav = this.s.filter === "favorites" && !this.s.query;
      replaceChildren(
        this.els.grid,
        h(
          "div",
          { class: "empty" },
          h("div", { class: "empty-icon" }, icon(fav ? "star" : "search", C.text3, 22)),
          h("div", { class: "empty-title" }, fav ? "Aucun favori pour l'instant" : `Aucun résultat pour « ${this.s.query} »`),
          h("div", { class: "empty-text" }, fav ? "Cliquez sur l'étoile d'une animation pour la retrouver ici." : "Essayez « zoom », « shake », « flou » ou « mot »."),
          h(
            "button",
            {
              class: "btn ghost",
              type: "button",
              onclick: () => {
                this.s.query = "";
                this.els.search.value = "";
                this.setFilter("all");
              },
            },
            "Voir toutes les animations",
          ),
        ),
      );
      return;
    }
    replaceChildren(this.els.grid, list.map((a) => this.buildCard(a)));
    this.layoutGrid();
    // Les vignettes vidéo ont besoin de leur taille réelle une fois insérées.
    this.cardPlayers.forEach((p) => p.refresh());
  }

  private kindBadge(a: AnimationDefinition): string {
    if (a.kind === "native") return "Transition Pr";
    if (a.kind === "accent") return "Ponctuel";
    if (a.kind === "span") return "Tout le clip";
    return MODE_OPTIONS.find((m) => m.value === this.s.settings.mode)?.label ?? "Entrée";
  }

  private refreshCardBadges() {
    for (const card of Array.from(this.els.grid.querySelectorAll(".card")) as HTMLElement[]) {
      const a = getAnimation(card.getAttribute("data-id") ?? "");
      const badge = card.querySelector(".kind-badge");
      if (a && badge) badge.textContent = this.kindBadge(a);
    }
  }

  private buildCard(a: AnimationDefinition): HTMLElement {
    const player = new PreviewPlayer({ fontSize: 17 });
    player.setAnimation(a, this.paramsFor(a), this.s.settings.mode, this.s.settings.previewText || a.previewText);
    this.cardPlayers.push(player);
    const fav = this.s.favorites.includes(a.id);
    const color = CATEGORY_COLOR[a.category];
    const favBtn = h(
      "button",
      {
        type: "button",
        class: cx("card-fav", fav && "on"),
        title: fav ? "Retirer des favoris" : "Ajouter aux favoris",
        onclick: (e: Event) => {
          e.stopPropagation();
          this.toggleFavorite(a.id);
        },
      },
      icon("star", fav ? C.star : C.text2, 14, fav),
    );
    const quickApply = h(
      "button",
      {
        type: "button",
        class: "card-apply",
        title: "Appliquer avec les réglages actuels",
        onclick: (e: Event) => {
          e.stopPropagation();
          this.select(a.id, false);
          void this.apply(a);
        },
      },
      icon("wand", "#FFFFFF", 12),
      h("span", { class: "card-apply-label" }, "Appliquer"),
    );
    const stage = h(
      "div",
      { class: cx("stage card-stage", `cat-${a.category}`, a.subject === "video" && "video") },
      player.el,
      favBtn,
      h("span", { class: cx("kind-badge", a.kind) }, this.kindBadge(a)),
      a.multiLayer ? h("span", { class: "card-badge", title: "Conçue pour plusieurs calques texte" }, icon("layers", C.text2, 11), "Multi") : null,
      quickApply,
    );
    const animated = () => this.s.settings.animatedPreviews;
    const card = h(
      "div",
      {
        class: cx("card", a.id === this.s.selectedId && "selected"),
        tabIndex: 0,
        role: "button",
        "data-id": a.id,
        title: "Clic : sélectionner et régler · Double-clic : appliquer",
        onclick: () => this.select(a.id, true),
        ondblclick: () => void this.apply(a),
        onkeydown: (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.select(a.id, true);
          }
        },
        onmouseenter: () => animated() && player.play(true),
        onmouseleave: () => player.stop(),
        onfocus: () => animated() && player.play(true),
        onblur: () => player.stop(),
      },
      stage,
      h(
        "div",
        { class: "card-meta" },
        h("div", { class: "card-title-row" }, h("span", { class: "card-cat-dot", style: { backgroundColor: color } }), h("span", { class: "card-title" }, a.name)),
        h("div", { class: "card-sub" }, a.tagline),
      ),
    );
    return h("div", { class: "card-cell" }, card);
  }

  private toggleFavorite(id: string) {
    const favs = this.s.favorites;
    this.s.favorites = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    save("favorites", this.s.favorites);
    this.renderNav();
    if (this.s.filter === "favorites") this.renderGrid();
    else this.refreshCardFavorites();
    this.renderInspectorHeaderFav();
  }

  private refreshCardFavorites() {
    for (const card of Array.from(this.els.grid.querySelectorAll(".card")) as HTMLElement[]) {
      const id = card.getAttribute("data-id") ?? "";
      const btn = card.querySelector(".card-fav") as HTMLElement | null;
      if (!btn) continue;
      const on = this.s.favorites.includes(id);
      btn.classList.toggle("on", on);
      btn.title = on ? "Retirer des favoris" : "Ajouter aux favoris";
      replaceChildren(btn, icon("star", on ? C.star : C.text2, 14, on));
    }
  }

  private select(id: string, openInspector: boolean) {
    const changed = id !== this.s.selectedId;
    this.s.selectedId = id;
    save("selected", id);
    for (const card of Array.from(this.els.grid.querySelectorAll(".card")) as HTMLElement[]) {
      card.classList.toggle("selected", card.getAttribute("data-id") === id);
    }
    if (changed) {
      this.renderInspector();
      this.renderActionBar();
      if (this.s.settings.animatedPreviews && this.s.layout !== "narrow") this.mainPlayer?.play(true);
    }
    if (openInspector && this.s.layout === "narrow") {
      this.s.view = "inspector";
      this.applyView();
      this.mainPlayer?.refresh();
      if (this.s.settings.animatedPreviews) this.mainPlayer?.play(true);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Panneau de personnalisation (onglets façon TypeMotion)             */
  /* ---------------------------------------------------------------- */

  private current(): AnimationDefinition {
    return getAnimation(this.s.selectedId) ?? ANIMATIONS[0];
  }

  private paramsFor(a: AnimationDefinition): ParamValues {
    return sanitizeParams(a, this.s.paramsById[a.id]);
  }

  private setParams(a: AnimationDefinition, params: ParamValues, persist: boolean) {
    this.s.paramsById[a.id] = params;
    if (persist) save("params", this.s.paramsById);
    this.mainPlayer?.setAnimation(a, params, this.s.settings.mode);
    if (persist && this.s.settings.animatedPreviews) this.mainPlayer?.play(true);
    this.renderActionBar();
  }

  private renderInspector() {
    const a = this.current();
    this.mainPlayer?.destroy();
    // Lecture limitée à 2 boucles : l'aperçu ne tourne jamais en continu.
    const player = new PreviewPlayer({ fontSize: 30, maxLoops: 2 });
    this.mainPlayer = player;
    const params = this.paramsFor(a);
    player.setAnimation(a, params, this.s.settings.mode, this.s.settings.previewText || a.previewText);
    const color = CATEGORY_COLOR[a.category];

    // En-tête
    const category = CATEGORIES.find((c) => c.id === a.category);
    const favWrap = h("span", { class: "insp-fav-wrap" });
    const header = h(
      "div",
      { class: "insp-head" },
      h(
        "button",
        {
          class: "icon-btn back-btn",
          type: "button",
          title: "Retour à la bibliothèque",
          onclick: () => {
            this.s.view = "library";
            this.applyView();
            player.pause();
          },
        },
        icon("back", C.text2, 16),
      ),
      h(
        "div",
        { class: "insp-title-wrap" },
        h("div", { class: "insp-title" }, a.name),
        h("div", { class: "insp-cat" }, h("span", { class: "card-cat-dot", style: { backgroundColor: color } }), `${category?.label ?? ""} · ${this.kindBadge(a)}`),
      ),
      favWrap,
    );

    // Aperçu + transport
    const progress = h("div", { class: "tp-fill" });
    const timeLabel = h("span", { class: "tp-time" }, "0,00 s");
    const playBtn = h("button", { class: "icon-btn small", type: "button", title: "Lecture / pause" });
    const setPlayIcon = () => replaceChildren(playBtn, icon(player.playing ? "pause" : "play", C.text, 14, !player.playing));
    player.onStop(setPlayIcon);
    playBtn.addEventListener("click", () => {
      if (player.playing) player.pause();
      else player.play();
      setPlayIcon();
    });
    const bar = h("div", { class: "tp-bar", title: "Cliquer / glisser pour parcourir l'animation" }, progress);
    const scrub = (e: MouseEvent) => {
      const r = bar.getBoundingClientRect();
      player.seek((e.clientX - r.left) / (r.width || 1));
      setPlayIcon();
    };
    bar.addEventListener("mousedown", (e: MouseEvent) => {
      scrub(e);
      const up = () => {
        document.removeEventListener("mousemove", scrub);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", scrub);
      document.addEventListener("mouseup", up);
    });
    player.onTimeUpdate((t, total) => {
      progress.style.width = `${((t / total) * 100).toFixed(2)}%`;
      timeLabel.textContent = `${formatNumber(t, 2)} s`;
    });
    const replay = () => {
      player.play(true);
      setPlayIcon();
    };
    const transport = h(
      "div",
      { class: "transport" },
      playBtn,
      h("button", { class: "icon-btn small", type: "button", title: "Rejouer", onclick: replay }, icon("replay", C.text2, 14)),
      bar,
      timeLabel,
    );
    const preview = h(
      "div",
      {
        class: cx("stage main-stage", `cat-${a.category}`, a.subject === "video" && "video"),
        title: "Survoler pour rejouer",
        onmouseenter: () => this.s.settings.animatedPreviews && !player.playing && replay(),
      },
      player.el,
      a.subject === "text" ? h("div", { class: "stage-safe" }) : null,
    );

    // Onglets
    const tabBtn = (id: InspectorTab, label: string, count?: number) =>
      h(
        "button",
        {
          type: "button",
          class: cx("tab", this.s.tab === id && "active"),
          onclick: () => {
            this.s.tab = id;
            this.renderInspector();
          },
        },
        label,
        count ? h("span", { class: "tab-count" }, String(count)) : null,
      );
    const presetCount = this.s.presets.filter((p) => p.animationId === a.id).length;
    const tabs = h("div", { class: "tabs" }, tabBtn("settings", "Réglages"), tabBtn("presets", "Presets", presetCount));

    let tabContent: HTMLElement[];
    if (this.s.tab === "presets") {
      const presetsSlot = h("div", { class: "section first" });
      this.renderPresetsSection(presetsSlot, a);
      tabContent = [presetsSlot];
    } else {
      const notice = h("div", { class: "notice-slot" });
      this.els.notice = notice;
      // Vitesse (barre de durée façon Motion Bro)
      const durationSpec = a.params.find((p) => p.id === "duration") as NumberParam | undefined;
      let speed: HTMLElement | null = null;
      if (durationSpec) {
        const cur = Number(params.duration);
        const activeSpeed = SPEEDS.find((sp) => Math.abs(durationSpec.default / sp.factor - cur) < 0.011)?.value ?? "";
        speed = segmented(
          SPEEDS.map(({ value, label }) => ({ value, label })),
          activeSpeed,
          (v) => {
            const f = SPEEDS.find((sp) => sp.value === v)?.factor ?? 1;
            const d = Math.min(durationSpec.max, Math.max(durationSpec.min, Math.round((durationSpec.default / f) * 100) / 100));
            this.setParams(a, { ...this.paramsFor(a), duration: d }, true);
            this.renderInspector();
          },
          "Vitesse",
        );
      }
      // Paramètres groupés
      const groups: Record<string, HTMLElement[]> = { timing: [], motion: [], style: [] };
      for (const spec of a.params) {
        const value = params[spec.id];
        const onValue = (v: number | string | boolean, final = true) => this.setParams(a, { ...this.paramsFor(a), [spec.id]: v }, final);
        let el: HTMLElement;
        if (spec.type === "number") el = slider(spec as NumberParam, Number(value), (v, final) => onValue(v, final)).el;
        else if (spec.type === "choice" && spec.id === "easing") el = easingControl(spec, String(value), (v) => onValue(v));
        else if (spec.type === "choice") el = choice(spec, String(value), (v) => onValue(v));
        else el = toggle(spec.label, Boolean(value), (v) => onValue(v), spec.hint);
        groups[spec.group ?? "motion"].push(el);
      }
      const sections = (Object.keys(groups) as (keyof typeof GROUP_LABEL)[])
        .filter((g) => groups[g].length)
        .map((g) => h("div", { class: "section" }, h("div", { class: "section-title" }, GROUP_LABEL[g]), groups[g]));
      const props = [...new Set(a.uses.map((u) => PROPERTY_LABEL[u]))];
      const resetBtn = h(
        "button",
        {
          class: "btn ghost small",
          type: "button",
          title: "Revenir aux réglages par défaut",
          onclick: () => {
            this.setParams(a, defaultParams(a), true);
            this.renderInspector();
            this.toast("info", "Réglages réinitialisés");
          },
        },
        icon("reset", C.text2, 13),
        "Réinitialiser",
      );
      tabContent = [
        notice,
        speed ? h("div", { class: "section first" }, speed) : null,
        ...sections,
        h(
          "div",
          { class: "insp-actions" },
          h("div", { class: "uses" }, h("span", { class: "uses-label" }, "Images clés :"), props.map((p) => h("span", { class: "tag" }, p))),
          resetBtn,
        ),
      ].filter(Boolean) as HTMLElement[];
    }

    const scroll = h(
      "div",
      { class: "scroll insp-scroll" },
      h("div", { class: "insp-preview" }, preview, transport),
      h("p", { class: "insp-desc" }, a.description),
      tabs,
      tabContent,
    );
    replaceChildren(this.els.inspector, header, scroll);
    this.renderInspectorHeaderFav(favWrap);
    this.updateNotice();
    player.refresh();
    setPlayIcon();
  }

  private renderInspectorHeaderFav(slot?: HTMLElement) {
    const wrap = slot ?? (this.els.inspector.querySelector(".insp-fav-wrap") as HTMLElement | null);
    if (!wrap) return;
    const a = this.current();
    const on = this.s.favorites.includes(a.id);
    replaceChildren(
      wrap,
      h(
        "button",
        { class: cx("icon-btn", on && "fav-on"), type: "button", title: on ? "Retirer des favoris" : "Ajouter aux favoris", onclick: () => this.toggleFavorite(a.id) },
        icon("star", on ? C.star : C.text2, 16, on),
      ),
    );
  }

  private renderPresetsSection(slot: HTMLElement, a: AnimationDefinition) {
    const mine = this.s.presets.filter((p) => p.animationId === a.id);
    const nameInput = h("input", { class: "text-input", type: "text", placeholder: "Nom du preset (ex. « Titre YouTube »)", maxLength: 60 });
    const form = h("div", { class: "preset-form hidden" });
    const doSave = () => {
      const name = String(nameInput.value).trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      const preset: UserPreset = { id: makePresetId(), name, animationId: a.id, params: this.paramsFor(a), mode: this.s.settings.mode, createdAt: Date.now() };
      this.s.presets = [...this.s.presets, preset];
      save("presets", this.s.presets);
      this.renderPresetsSection(slot, a);
      this.toast("success", `Preset « ${name} » enregistré`);
    };
    nameInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") doSave();
      if (e.key === "Escape") form.classList.add("hidden");
    });
    replaceChildren(
      form,
      nameInput,
      h("button", { class: "btn primary small", type: "button", onclick: doSave }, "Enregistrer"),
      h("button", { class: "icon-btn small", type: "button", title: "Annuler", onclick: () => form.classList.add("hidden") }, icon("x", C.text3, 13)),
    );
    const chips = mine.map((p) =>
      h(
        "div",
        { class: "preset-chip" },
        h(
          "button",
          {
            class: "preset-load",
            type: "button",
            title: "Charger ce preset",
            onclick: () => {
              this.updateSettings({ mode: p.mode });
              this.refreshCardBadges();
              this.setParams(a, sanitizeParams(a, p.params), true);
              this.renderInspector();
              this.toast("info", `Preset « ${p.name} » chargé`);
            },
          },
          p.name,
        ),
        h(
          "button",
          {
            class: "preset-del",
            type: "button",
            title: "Supprimer ce preset",
            onclick: () => {
              this.s.presets = this.s.presets.filter((x) => x.id !== p.id);
              save("presets", this.s.presets);
              this.renderPresetsSection(slot, a);
            },
          },
          icon("x", C.text3, 11),
        ),
      ),
    );
    replaceChildren(
      slot,
      h(
        "div",
        { class: "section-title row" },
        h("span", null, "Mes presets"),
        h(
          "button",
          {
            class: "link-btn",
            type: "button",
            onclick: () => {
              form.classList.remove("hidden");
              nameInput.focus();
            },
          },
          icon("save", C.accent, 12),
          "Enregistrer les réglages",
        ),
      ),
      form,
      mine.length ? h("div", { class: "preset-list" }, chips) : h("div", { class: "muted small" }, "Aucun preset pour cette animation. Réglez-la à votre goût puis enregistrez-la."),
    );
  }


  private updateNotice() {
    const slot = this.els.notice;
    if (!slot) return;
    const a = this.current();
    const n = this.s.selection.clips.length;
    const info = (strong: string, text: string, ok = false) =>
      h("div", { class: cx("notice", ok && "ok") }, icon(ok ? "check" : "info", ok ? C.success : C.accent, 14), h("div", null, h("b", null, strong), text));
    let content: HTMLElement | null = null;
    if (a.multiLayer) {
      content =
        n >= 2
          ? info(`${n} calques texte`, " seront enchaînés dans l'ordre de la timeline (début, puis piste).", true)
          : info(
              "Un mot par calque texte. ",
              "Premiere ne permet pas d'animer les mots à l'intérieur d'un seul texte : créez un calque par mot, sélectionnez-les tous, MotionCraft les enchaîne.",
            );
    } else if (a.kind === "native") {
      content = info("Transition native Premiere. ", "Sélectionnez les clips qui se suivent sur la timeline : la transition est posée sur chaque coupe (modifiable ensuite dans Premiere).");
    } else if (a.kind === "accent") {
      content = info("Effet ponctuel. ", "À la tête de lecture, au début, à la fin, ou sur chaque marqueur de séquence (touche M) — idéal pour caler les effets sur la musique.");
    } else if (a.kind === "span") {
      content = info("Tout le clip. ", "L'effet couvre toute la durée de chaque clip sélectionné, quelle que soit sa longueur.");
    } else if (a.category === "transition") {
      content = info("Transition entre deux plans : ", "« Sortie » sur le premier clip, puis « Entrée » sur le suivant.");
    }
    replaceChildren(slot, content);
  }

  /* ---------------------------------------------------------------- */
  /* Barre d'action fixe (façon PX-Kinetype / TypeMotion)               */
  /* ---------------------------------------------------------------- */

  private renderActionBar() {
    const bar = this.els.actionbar;
    if (!bar) return;
    const a = this.current();
    const sel = this.s.selection;
    const n = sel.clips.length;
    const ready = sel.status === "ok" && n > 0 && !this.s.applying;
    this.root.classList.toggle("has-selection", ready);
    const { tone, text } = this.selectionLabel();
    const params = this.paramsFor(a);

    // Ligne d'état
    let duration = "";
    if (a.kind !== "span") {
      const motions = Array.from({ length: Math.min(Math.max(1, n), 60) }, (_, i) => a.build(params, { index: i, count: Math.max(1, n), clipDuration: 5 }));
      duration = `${formatNumber(Math.max(...motions.map((m) => m.delay + m.duration)), 2)} s`;
    }
    const status = h(
      "div",
      { class: "ab-status" },
      h("span", { class: cx("dot", tone) }),
      h("span", { class: "ab-anim" }, a.name),
      h("span", { class: "ab-sep" }, "·"),
      h("span", { class: "ab-text" }, this.s.applying ? this.s.status : `${text}${duration ? ` · ${duration}` : ""} · ${this.s.status}`),
    );

    const go = (opts: { mode?: AnimationMode; anchor?: AccentAnchor }) => () => void this.apply(a, opts);
    const mk = (label: string, onclick: () => void, primary: boolean, extra?: { title?: string; active?: boolean; iconName?: string }) =>
      h(
        "button",
        {
          type: "button",
          class: cx("ab-btn", primary && "primary", extra?.active && "active", !ready && "disabled"),
          disabled: this.s.applying,
          title: ready ? (extra?.title ?? "") : "Sélectionnez un ou plusieurs clips dans la timeline",
          onclick,
        },
        extra?.iconName ? icon(extra.iconName, primary ? "#FFFFFF" : C.text, 14) : null,
        h("span", null, label),
      );

    let buttons: HTMLElement[];
    if (a.kind === "entrance") {
      buttons = MODE_OPTIONS.map((m) =>
        mk(m.label, go({ mode: m.value }), m.value === this.s.settings.mode, {
          title: `Appliquer en ${m.label.toLowerCase()}`,
          active: m.value === this.s.settings.mode,
        }),
      );
    } else if (a.kind === "accent") {
      buttons = [
        mk("Appliquer à la tête de lecture", go({ anchor: "playhead" }), true, { iconName: "play", title: "Place l'effet à la position de la tête de lecture" }),
        mk("Début", go({ anchor: "start" }), false, { title: "Au début du clip" }),
        mk("Fin", go({ anchor: "end" }), false, { title: "À la fin du clip" }),
        mk("Marqueurs", go({ anchor: "markers" }), false, { iconName: "marker", title: "Un effet sur chaque marqueur de séquence situé dans les clips sélectionnés" }),
      ];
    } else if (a.kind === "native") {
      buttons = [mk("Poser la transition", go({}), true, { iconName: "native", title: "Ajoute la transition native de Premiere selon l'emplacement choisi" })];
    } else {
      buttons = [mk("Appliquer sur tout le clip", go({}), true, { iconName: "wand", title: "Couvre toute la durée de chaque clip sélectionné" })];
    }
    if (this.s.applying) buttons = [h("div", { class: "ab-busy" }, h("span", { class: "spinner" }), h("span", null, this.s.status))];
    replaceChildren(bar, status, h("div", { class: cx("ab-actions", `n${buttons.length}`) }, buttons));
  }

  /* ---------------------------------------------------------------- */
  /* Application dans Premiere                                          */
  /* ---------------------------------------------------------------- */

  private async apply(target?: AnimationDefinition, opts: { mode?: AnimationMode; anchor?: AccentAnchor } = {}) {
    if (this.s.applying) return;
    const a = target ?? this.current();
    if (opts.mode && opts.mode !== this.s.settings.mode) {
      this.updateSettings({ mode: opts.mode });
      this.refreshCardBadges();
      this.cardPlayers.forEach((p) => p.setMode(opts.mode!));
      this.mainPlayer?.setMode(opts.mode);
    }
    if (opts.anchor) this.updateSettings({ anchor: opts.anchor });
    await this.refreshSelection();
    if (!this.s.selection.clips.length) {
      this.toast("warning", "Aucun clip sélectionné", "Sélectionnez un ou plusieurs clips dans la timeline, puis réessayez.");
      this.renderActionBar();
      return;
    }
    this.s.applying = true;
    this.s.status = "Application…";
    this.root.classList.add("is-applying");
    this.renderActionBar();
    const setBusy = (label: string) => {
      this.s.status = label;
      this.renderActionBar();
    };
    try {
      const report = await applyAnimation({
        animation: a,
        params: this.paramsFor(a),
        mode: this.s.settings.mode,
        anchor: this.s.settings.anchor,
        settings: this.s.settings,
        onProgress: (done, total, label) => setBusy(total > 1 && done < total ? `${label} ${done + 1}/${total}` : `${label}…`),
      });
      const details = [`${report.keyCount} images clés · ${report.durationMs} ms`, ...report.failed.map((f) => `✕ ${f.name} : ${f.error}`), ...report.warnings];
      if (report.applied && !report.failed.length) {
        this.s.status = `${a.name} appliqué.`;
        const unit = a.kind === "native" ? (report.applied > 1 ? "transitions posées" : "transition posée") : null;
        this.toast(
          "success",
          unit ? `${a.name} : ${report.applied} ${unit}` : `${a.name} appliqué${report.applied > 1 ? ` à ${report.applied} clips` : ""}`,
          `Annuler : ${isMac() ? "⌘Z" : "Ctrl+Z"}`,
          details,
        );
      } else if (report.applied) {
        this.s.status = `Appliqué à ${report.applied} clip(s), ${report.failed.length} en erreur.`;
        this.toast("warning", `${a.name} appliqué à ${report.applied} / ${report.applied + report.failed.length} clips`, "Certains clips n'ont pas pu être animés.", details);
      } else {
        this.s.status = "Échec de l'application.";
        this.toast("error", "Aucun clip n'a pu être animé", report.failed[0]?.error, details);
      }
    } catch (e) {
      this.s.status = "Échec de l'application.";
      const hint = e instanceof UserFacingError ? e.hint : "Ouvrez Réglages › Diagnostic et copiez le rapport pour analyse.";
      this.toast("error", messageOf(e), hint);
    } finally {
      this.s.applying = false;
      this.root.classList.remove("is-applying");
      this.renderActionBar();
      void this.refreshSelection(true);
    }
  }


  private openSettings() {
    this.s.view = "settings";
    this.applyView();
    this.renderSettings();
    this.els.sheet.classList.remove("hidden");
  }

  private closeSettings() {
    this.els.sheet.classList.add("hidden");
    this.s.view = "library";
    this.applyView();
  }

  private updateSettings(patch: Partial<Settings>, rerender: "none" | "previews" = "none") {
    this.s.settings = { ...this.s.settings, ...patch };
    save("settings", this.s.settings);
    if (rerender === "previews") {
      this.renderGrid();
      this.renderInspector();
    }
  }

  private renderSettings() {
    const st = this.s.settings;
    const customPivot = h("div", { class: cx("pivot-custom", st.pivot !== "custom" && "hidden") });
    const pivotX = slider({ id: "px", label: "Pivot horizontal", type: "number", min: 0, max: 100, step: 1, default: 50, unit: "%" }, st.pivotX, (v) =>
      this.updateSettings({ pivotX: v }),
    );
    const pivotY = slider({ id: "py", label: "Pivot vertical", type: "number", min: 0, max: 100, step: 1, default: 50, unit: "%" }, st.pivotY, (v) =>
      this.updateSettings({ pivotY: v }),
    );
    replaceChildren(customPivot, pivotX.el, pivotY.el);

    const diagOut = h("textarea", { class: "diag-out hidden", readOnly: true, rows: 10 }) as HTMLTextAreaElement;
    const diagCopy = h(
      "button",
      {
        class: "btn ghost small hidden",
        type: "button",
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(diagOut.value);
            this.toast("success", "Rapport copié dans le presse-papiers");
          } catch {
            diagOut.select?.();
            this.toast("info", "Sélectionnez le texte puis copiez-le (⌘C)");
          }
        },
      },
      icon("copy", C.text2, 13),
      "Copier",
    );

    const content = h(
      "div",
      { class: "scroll sheet-scroll" },
      h(
        "div",
        { class: "section" },
        h("div", { class: "section-title" }, "Application"),
        select(
          {
            label: "Pivot des zooms",
            hint: "Point autour duquel l'échelle est animée. « Automatique » lit la position du calque texte.",
            options: [
              { value: "auto", label: "Automatique (calque texte)" },
              { value: "clip", label: "Point d'ancrage du clip" },
              { value: "frame", label: "Centre de l'image" },
              { value: "lowerThird", label: "Tiers inférieur (sous-titres)" },
              { value: "custom", label: "Personnalisé" },
            ],
          },
          st.pivot,
          (v) => {
            this.updateSettings({ pivot: v as Settings["pivot"] });
            customPivot.classList.toggle("hidden", v !== "custom");
          },
        ),
        customPivot,
        toggle(
          "Remplacer les animations existantes",
          st.replaceExisting,
          (v) => this.updateSettings({ replaceExisting: v }),
          "Efface les images clés présentes dans la moitié du clip animée avant d'écrire les nouvelles.",
        ),
        select(
          {
            label: "Précision des images clés",
            hint: "Optimisée : images clés superflues supprimées (rendu identique à 0,2 % près). Maximale : une image clé par image.",
            options: [
              { value: "optimized", label: "Optimisée (recommandé)" },
              { value: "every-frame", label: "Maximale (chaque image)" },
            ],
          },
          st.precision,
          (v) => this.updateSettings({ precision: v as Settings["precision"] }),
        ),
        select(
          {
            label: "Référence temporelle (avancé)",
            hint: "À modifier uniquement si les animations apparaissent décalées dans le temps sur des clips rognés au début.",
            options: [
              { value: "media", label: "Point d'entrée du média (défaut)" },
              { value: "clip", label: "Début du clip" },
              { value: "sequence", label: "Temps de la séquence" },
            ],
          },
          st.timeBase,
          (v) => this.updateSettings({ timeBase: v as Settings["timeBase"] }),
        ),
      ),
      h(
        "div",
        { class: "section" },
        h("div", { class: "section-title" }, "Aperçus"),
        textField("Texte des aperçus", st.previewText, "Nom de l'animation", (v) => {
          this.updateSettings({ previewText: v });
          this.cardPlayers.forEach((p) => p.setText(v));
          this.mainPlayer?.setText(v || this.current().previewText || "");
        }),
        toggle(
          "Aperçus animés",
          st.animatedPreviews,
          (v) => this.updateSettings({ animatedPreviews: v }, "previews"),
          "Les vignettes s'animent au survol. Désactivez pour un panneau totalement statique (machine chargée).",
        ),
      ),
      h(
        "div",
        { class: "section" },
        h("div", { class: "section-title" }, "Presets"),
        h("div", { class: "muted small" }, `${this.s.presets.length} preset(s) enregistré(s). Exportez-les pour les sauvegarder ou les partager.`),
        h(
          "div",
          { class: "btn-row" },
          h("button", { class: "btn ghost small", type: "button", onclick: () => void this.exportPresetsFile() }, icon("download", C.text2, 13), "Exporter"),
          h("button", { class: "btn ghost small", type: "button", onclick: () => void this.importPresetsFile() }, icon("upload", C.text2, 13), "Importer"),
        ),
      ),
      h(
        "div",
        { class: "section" },
        h("div", { class: "section-title" }, "Diagnostic"),
        h("div", { class: "muted small" }, "Décrit les clips sélectionnés tels que Premiere les expose (composants, paramètres, valeurs). Utile en cas de comportement inattendu."),
        h(
          "div",
          { class: "btn-row" },
          h(
            "button",
            {
              class: "btn ghost small",
              type: "button",
              onclick: async () => {
                try {
                  diagOut.value = await inspectSelection(this.s.settings);
                } catch (e) {
                  diagOut.value = `Erreur : ${messageOf(e)}`;
                }
                diagOut.classList.remove("hidden");
                diagCopy.classList.remove("hidden");
              },
            },
            icon("info", C.text2, 13),
            "Inspecter la sélection",
          ),
          diagCopy,
        ),
        diagOut,
      ),
      h(
        "div",
        { class: "section about" },
        h("div", { class: "section-title" }, "À propos"),
        h("div", { class: "muted small" }, `MotionCraft Pro ${VERSION} · Plugin UXP pour Premiere Pro 25.6 et ultérieur · ${ANIMATIONS.length} animations`),
      ),
    );
    replaceChildren(
      this.els.sheet,
      h(
        "div",
        { class: "sheet-head" },
        h("button", { class: "icon-btn", type: "button", title: "Fermer (Échap)", onclick: () => this.closeSettings() }, icon("back", C.text2, 16)),
        h("div", { class: "sheet-title" }, "Réglages"),
      ),
      content,
    );
  }

  private async exportPresetsFile() {
    const json = exportPresets(this.s.presets);
    const uxp = getUxp() as UxpStorage | null;
    try {
      if (uxp?.storage?.localFileSystem) {
        const file = await uxp.storage.localFileSystem.getFileForSaving("motioncraft-presets.json", { types: ["json"] });
        if (!file) return;
        await file.write(json);
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        a.download = "motioncraft-presets.json";
        a.click();
      }
      this.toast("success", `${this.s.presets.length} preset(s) exporté(s)`);
    } catch (e) {
      this.toast("error", "Export impossible", messageOf(e));
    }
  }

  private async importPresetsFile() {
    const uxp = getUxp() as UxpStorage | null;
    try {
      let text: string | null = null;
      if (uxp?.storage?.localFileSystem) {
        const file = await uxp.storage.localFileSystem.getFileForOpening({ types: ["json"] });
        if (!file) return;
        text = String(await file.read());
      } else {
        text = await pickFileInBrowser();
      }
      if (text === null) return;
      const imported = importPresets(text, ANIMATIONS.map((a) => a.id));
      this.s.presets = [...this.s.presets, ...imported];
      save("presets", this.s.presets);
      this.renderInspector();
      this.renderSettings();
      this.toast("success", `${imported.length} preset(s) importé(s)`);
    } catch (e) {
      this.toast("error", "Import impossible", messageOf(e));
    }
  }

  /* ---------------------------------------------------------------- */
  /* Clavier & notifications                                            */
  /* ---------------------------------------------------------------- */

  private onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void this.apply();
      return;
    }
    if (e.key === "Escape") {
      if (this.s.view === "settings") this.closeSettings();
      else if (this.s.view === "inspector") {
        this.s.view = "library";
        this.applyView();
      } else if (typing && target === this.els.search && this.els.search.value) {
        this.els.search.value = "";
        this.s.query = "";
        this.renderGrid();
        this.renderNav();
      }
      return;
    }
    if (typing) return;
    if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      if (this.s.view !== "library") {
        this.s.view = "library";
        this.applyView();
      }
      this.els.search.focus();
    }
  }

  toast(kind: "success" | "error" | "warning" | "info", title: string, text?: string, details: string[] = []) {
    const color = kind === "success" ? C.success : kind === "error" ? C.danger : kind === "warning" ? C.warning : C.accent;
    const iconName = kind === "success" ? "check" : kind === "info" ? "info" : "alert";
    const detailsEl = details.length ? h("div", { class: "toast-details hidden" }, details.map((d) => h("div", null, d))) : null;
    const el = h(
      "div",
      { class: cx("toast", kind) },
      h("span", { class: "toast-icon" }, icon(iconName, color, 15)),
      h(
        "div",
        { class: "toast-body" },
        h("div", { class: "toast-title" }, title),
        text ? h("div", { class: "toast-text" }, text) : null,
        detailsEl
          ? h(
              "button",
              {
                class: "link-btn",
                type: "button",
                onclick: () => {
                  detailsEl.classList.toggle("hidden");
                  clearTimeout(timer);
                },
              },
              "Détails",
            )
          : null,
        detailsEl,
      ),
      h("button", { class: "icon-btn small", type: "button", title: "Fermer", onclick: () => dismiss() }, icon("x", C.text3, 12)),
    );
    const dismiss = () => {
      el.classList.add("leaving");
      setTimeout(() => el.parentNode?.removeChild(el), 180);
    };
    this.els.toasts.appendChild(el);
    while (this.els.toasts.children.length > 3) this.els.toasts.removeChild(this.els.toasts.firstChild!);
    const timer = setTimeout(dismiss, kind === "error" ? 9000 : kind === "warning" ? 7000 : 4200);
  }
}

/* ------------------------------------------------------------------ */

interface UxpFile {
  write(data: string): Promise<unknown>;
  read(): Promise<string | ArrayBuffer>;
}
interface UxpStorage {
  storage?: {
    localFileSystem?: {
      getFileForSaving(name: string, opts?: { types?: string[] }): Promise<UxpFile | null>;
      getFileForOpening(opts?: { types?: string[] }): Promise<UxpFile | null>;
    };
  };
}

function pickFileInBrowser(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

/**
 * Liste d'easing accompagnée de la courbe dessinée (façon TypeMotion).
 * Dessinée avec de petits points (div) : le SVG en ligne n'est pas affiché par UXP.
 */
function easingControl(spec: ChoiceParam, value: string, onChange: (v: string) => void): HTMLElement {
  const graph = h("div", { class: "ease-graph" });
  drawEasing(graph, value);
  const ctl = select(spec, value, (v) => {
    drawEasing(graph, v);
    onChange(v);
  });
  ctl.classList.add("ease-control");
  ctl.appendChild(graph);
  return ctl;
}

function drawEasing(graph: HTMLElement, id: string) {
  const fn = getEasing(id);
  const lo = -0.15;
  const hi = 1.2;
  const yPct = (v: number) => (1 - (v - lo) / (hi - lo)) * 100;
  const dots: HTMLElement[] = [
    h("div", { class: "ease-line", style: { top: `${yPct(0).toFixed(1)}%` } }),
    h("div", { class: "ease-line", style: { top: `${yPct(1).toFixed(1)}%` } }),
  ];
  for (let i = 0; i <= 48; i++) {
    const p = i / 48;
    dots.push(h("div", { class: "ease-dot", style: { left: `${(p * 100).toFixed(2)}%`, top: `${yPct(fn(p)).toFixed(2)}%` } }));
  }
  replaceChildren(graph, h("div", { class: "ease-plot" }, dots));
}

/** #RRGGBB + alpha → rgba(). */
function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isMac = () => {
  try {
    return /Mac/i.test(navigator.platform || navigator.userAgent);
  } catch {
    return true;
  }
};
