/**
 * Intégration Premiere Pro (API UXP officielle, module `premierepro`).
 *
 * Fonctionnement d'une application :
 *   1. Lecture  : sélection, cadence, taille d'image, état « au repos » de chaque clip.
 *   2. Plan     : calcul des images clés (moteur pur, testé sous Linux).
 *   3. Écriture : transactions annulables (Cmd+Z), dans l'ordre recommandé par Adobe :
 *        a. ajout de l'effet Flou gaussien si nécessaire ;
 *        b. activation de l'animation (« time varying ») des paramètres ;
 *        c. nettoyage de la zone animée + ajout des images clés ;
 *        d. interpolation linéaire entre images clés cuites.
 *
 * Règles Adobe respectées (vérifiées par @adobe/eslint-plugin-premierepro) :
 * toutes les actions sont créées dans `lockedAccess` / `executeTransaction`,
 * et aucune opération asynchrone n'a lieu pendant une transaction.
 */
import type {
  AudioClipTrackItem,
  Component,
  ComponentParam,
  premierepro,
  Project,
  Sequence,
  TickTime,
  VideoClipTrackItem,
  VideoFilterComponent,
  VideoTransition,
  AddTransitionOptions,
} from "@adobe/premierepro";
import { buildClipPlan, clipPointToScreen, looksNormalized, type ClipPlan, type ClipState, type Point } from "../engine/plan";
import type { AccentAnchor, AnimationDefinition, AnimationMode, ParamValues, TrackKey } from "../engine/types";
import type { PlacementSpec } from "../engine/timeline";
import { normalize } from "../animations/registry";
import type { Settings } from "../state/settings";
import { getPpro, UserFacingError } from "./host";

export const TICKS_PER_SECOND = 254016000000;

export const MATCH = {
  motion: "AE.ADBE Motion",
  opacity: "AE.ADBE Opacity",
  blur: ["AE.ADBE Gaussian Blur 2", "AE.ADBE Gaussian Blur"],
} as const;

/** Effets natifs que MotionCraft sait ajouter et animer. */
export type EffectId = "blur" | "crop" | "bright";

interface EffectSpec {
  id: EffectId;
  label: string;
  /** Motifs du matchName, du plus précis au plus large. */
  matchNames: RegExp[];
  /** Motifs du nom affiché (toutes langues courantes), en repli. */
  displayNames: RegExp[];
  /** Propriété animée → index du paramètre dans l'effet. */
  params: Partial<Record<TrackKey, number>>;
}

export const EFFECTS: readonly EffectSpec[] = [
  {
    id: "blur",
    label: "Flou gaussien",
    matchNames: [/^AE\.ADBE Gaussian Blur 2$/i, /^AE\.ADBE Gaussian Blur$/i, /gaussian ?blur/i],
    displayNames: [/gaussian blur|flou gaussien|gau(ß|ss)scher weichzeichner|desenfoque gaussiano|sfocatura gaussiana/i],
    params: { blur: 0 },
  },
  {
    id: "crop",
    label: "Recadrage",
    matchNames: [/^AE\.ADBE AECrop$/i, /^AE\.ADBE Crop$/i, /\bcrop\b/i],
    displayNames: [/^(crop|recadrage|rogner|zuschneiden|recortar|ritaglia)$/i],
    params: { cropL: 0, cropT: 1, cropR: 2, cropB: 3 },
  },
  {
    id: "bright",
    label: "Luminosité et contraste",
    matchNames: [/brightness ?(&|and)? ?contrast/i],
    displayNames: [/brightness (&|and) contrast|luminosit[ée] (et|&) contraste|helligkeit (und|&) kontrast|brillo y contraste|luminosit[àa] e contrasto/i],
    params: { bright: 0 },
  },
];

/** Effet → matchName disponible dans ce Premiere (ou null). */
export type EffectNames = Partial<Record<EffectId, string | null>>;

export async function resolveEffects(ppro: premierepro): Promise<EffectNames> {
  const out: EffectNames = {};
  let names: string[] = [];
  let displays: string[] = [];
  try {
    names = await ppro.VideoFilterFactory.getMatchNames();
  } catch {
    names = [];
  }
  try {
    displays = await ppro.VideoFilterFactory.getDisplayNames();
  } catch {
    displays = [];
  }
  for (const fx of EFFECTS) {
    let found: string | null = null;
    for (const re of fx.matchNames) {
      found = names.find((n) => re.test(n)) ?? null;
      if (found) break;
    }
    if (!found && displays.length === names.length) {
      const i = displays.findIndex((d) => fx.displayNames.some((re) => re.test(d)));
      if (i >= 0) found = names[i];
    }
    out[fx.id] = found ?? (fx.id === "blur" ? MATCH.blur[0] : null);
  }
  return out;
}

const effectOfTrack = (key: TrackKey) => EFFECTS.find((fx) => key in fx.params);

/** Noms d'affichage connus (normalisés) dans les langues courantes de Premiere. */
const ALIASES = {
  position: ["position", "posicion", "posizione", "位置", "위치"],
  scale: ["scale", "echelle", "skalierung", "escala", "scala", "スケール", "비율 조정", "缩放"],
  scaleWidth: ["scale width", "largeur d'echelle", "largeur de l'echelle", "skalierungsbreite", "ancho de escala", "larghezza scala"],
  uniformScale: ["uniform scale", "echelle uniforme", "einheitliche skalierung", "escala uniforme", "scala uniforme"],
  rotation: ["rotation", "drehung", "rotacion", "rotazione", "回転", "회전", "旋转"],
  anchor: ["anchor point", "point d'ancrage", "ankerpunkt", "punto de anclaje", "punto di ancoraggio", "アンカーポイント"],
  opacity: ["opacity", "opacite", "deckkraft", "opacidad", "opacita", "不透明度", "불투명도"],
} as const;

/** Index habituels des paramètres (repli si le nom n'est pas reconnu). */
const MOTION_INDEX = { position: 0, scale: 1, scaleWidth: 2, uniformScale: 3, rotation: 4, anchor: 5 } as const;

/* ------------------------------------------------------------------ */
/* Types publics                                                         */
/* ------------------------------------------------------------------ */

export type HostStatus = "no-host" | "no-project" | "no-sequence" | "ok";

export interface ClipSummary {
  name: string;
  start: number;
  end: number;
  track: number;
}

export interface SelectionInfo {
  status: HostStatus;
  sequenceName?: string;
  clips: ClipSummary[];
  /** Éléments sélectionnés ignorés (audio…). */
  ignored: number;
  fps?: number;
  frameWidth?: number;
  frameHeight?: number;
}

export interface ApplyRequest {
  animation: AnimationDefinition;
  params: ParamValues;
  /** Entrée / sortie (animations « entrance »). */
  mode: AnimationMode;
  /** Placement des accents (tête de lecture, début, fin du clip). */
  anchor?: AccentAnchor;
  /**
   * Transition « sur les coupes » : sortie sur le plan avant chaque coupe, entrée
   * sur le plan après, mouvement continu (décalages et rotation inversés en sortie).
   */
  cuts?: boolean;
  settings: Settings;
  onProgress?: (done: number, total: number, label: string) => void;
}

export interface ApplyReport {
  applied: number;
  failed: { name: string; error: string }[];
  warnings: string[];
  keyCount: number;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/* Lecture du contexte                                                   */
/* ------------------------------------------------------------------ */

interface HostContext {
  ppro: premierepro;
  project: Project;
  sequence: Sequence;
  clips: VideoClipTrackItem[];
  ignored: number;
  fps: number;
  ticksPerFrame: number;
  frameWidth: number;
  frameHeight: number;
}

function requirePpro(): premierepro {
  const ppro = getPpro();
  if (!ppro) {
    throw new UserFacingError(
      "Premiere Pro n'est pas disponible.",
      "Ouvrez MotionCraft depuis Premiere Pro (Fenêtre > Extensions / Plugins).",
    );
  }
  return ppro;
}

export function isVideoClip(
  ppro: premierepro,
  item: VideoClipTrackItem | AudioClipTrackItem,
): item is VideoClipTrackItem {
  try {
    // @ts-expect-error les définitions n'exposent pas « hasInstance » (cf. exemples Adobe)
    if (item instanceof ppro.VideoClipTrackItem) return true;
  } catch {
    /* repli ci-dessous */
  }
  const any = item as unknown as Record<string, unknown>;
  return typeof any.createAddVideoTransitionAction === "function" && typeof any.getComponentChain === "function";
}

async function readContext(): Promise<HostContext> {
  const ppro = requirePpro();
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new UserFacingError("Aucun projet ouvert.", "Ouvrez un projet Premiere Pro.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new UserFacingError("Aucune séquence active.", "Ouvrez une séquence dans la timeline.");
  const selection = await sequence.getSelection();
  const items = await selection.getTrackItems();
  const clips = items.filter((i) => isVideoClip(ppro, i));
  const timebase = Number(await sequence.getTimebase());
  const ticksPerFrame = Number.isFinite(timebase) && timebase > 0 ? timebase : TICKS_PER_SECOND / 25;
  const size = await sequence.getFrameSize();
  return {
    ppro,
    project,
    sequence,
    clips,
    ignored: items.length - clips.length,
    fps: TICKS_PER_SECOND / ticksPerFrame,
    ticksPerFrame,
    frameWidth: size?.width || 1920,
    frameHeight: size?.height || 1080,
  };
}

/**
 * Lecture LÉGÈRE de la sélection (appelée à chaque changement de sélection) :
 * nombre de clips et noms des premiers seulement, pour ne jamais solliciter
 * Premiere inutilement.
 */
export async function getSelectionInfo(): Promise<SelectionInfo> {
  const ppro = getPpro();
  if (!ppro) return { status: "no-host", clips: [], ignored: 0 };
  const project = await ppro.Project.getActiveProject();
  if (!project) return { status: "no-project", clips: [], ignored: 0 };
  const sequence = await project.getActiveSequence();
  if (!sequence) return { status: "no-sequence", clips: [], ignored: 0 };
  const selection = await sequence.getSelection();
  const items = await selection.getTrackItems();
  const videos = items.filter((i) => isVideoClip(ppro, i));
  const clips: ClipSummary[] = [];
  for (let i = 0; i < videos.length; i++) {
    // Seuls les 6 premiers noms sont lus (infobulle) ; les autres restent anonymes.
    clips.push({ name: i < 6 ? (await videos[i].getName()) || "Clip" : "", start: 0, end: 0, track: 0 });
  }
  return { status: "ok", clips, ignored: items.length - videos.length };
}

/* ------------------------------------------------------------------ */
/* Lecture d'un clip                                                     */
/* ------------------------------------------------------------------ */

interface ParamRefs {
  position: ComponentParam;
  scale: ComponentParam;
  scaleWidth?: ComponentParam;
  uniformScale?: ComponentParam;
  rotation: ComponentParam;
  anchor: ComponentParam;
  opacity: ComponentParam;
  /** Paramètres des effets natifs présents sur le clip (dernière occurrence). */
  effects: Partial<Record<EffectId, ComponentParam[]>>;
}

interface PreparedClip {
  item: VideoClipTrackItem;
  name: string;
  start: TickTime;
  inPoint: TickTime;
  durationFrames: number;
  chain: Chain;
  components: Component[];
  matchNames: string[];
  params: ParamRefs;
  state: ClipState;
  uniform: boolean;
  scaleWidth: number;
  pivotSource: string;
  plan?: ClipPlan;
}

function listComponents(project: Project, chain: Chain) {
  const comps: Component[] = [];
  project.lockedAccess(() => {
    const n = chain.getComponentCount();
    for (let i = 0; i < n; i++) comps.push(chain.getComponentAtIndex(i));
  });
  return comps;
}

function paramsOf(project: Project, comp: Component): ComponentParam[] {
  const out: ComponentParam[] = [];
  project.lockedAccess(() => {
    const n = comp.getParamCount();
    for (let i = 0; i < n; i++) out.push(comp.getParam(i));
  });
  return out;
}

function findParam(params: ComponentParam[], aliases: readonly string[], fallbackIndex: number): ComponentParam | undefined {
  const byName = params.find((p) => aliases.includes(normalize(safeName(p))));
  return byName ?? params[fallbackIndex];
}

const safeName = (p: ComponentParam) => {
  try {
    return p.displayName ?? "";
  } catch {
    return "";
  }
};

/** Déballe les valeurs renvoyées par l'API (Keyframe → { value } → valeur). */
export function unwrapValue(v: unknown): unknown {
  let cur = v;
  for (let i = 0; i < 3; i++) {
    if (cur && typeof cur === "object" && "value" in (cur as Record<string, unknown>) && !isPointLike(cur)) {
      cur = (cur as { value: unknown }).value;
    } else break;
  }
  return cur;
}

const isPointLike = (v: unknown): v is Point =>
  !!v && typeof v === "object" && typeof (v as Point).x === "number" && typeof (v as Point).y === "number";

async function readValue(param: ComponentParam, at: TickTime): Promise<unknown> {
  try {
    if (param.isTimeVarying()) return unwrapValue(await param.getValueAtTime(at));
  } catch {
    /* ignore : on tente la valeur de départ */
  }
  return unwrapValue(await param.getStartValue());
}

async function readNumber(param: ComponentParam | undefined, at: TickTime, fallback: number): Promise<number> {
  if (!param) return fallback;
  const v = await readValue(param, at);
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

async function readPoint(param: ComponentParam | undefined, at: TickTime, fallback: Point): Promise<Point> {
  if (!param) return fallback;
  const v = await readValue(param, at);
  return isPointLike(v) ? { x: v.x, y: v.y } : fallback;
}

function keyframeTime(ctx: HostContext, clip: Pick<PreparedClip, "start" | "inPoint">, frame: number, base: Settings["timeBase"]): TickTime {
  const origin = base === "media" ? Number(clip.inPoint.ticks) : base === "sequence" ? Number(clip.start.ticks) : 0;
  return ctx.ppro.TickTime.createWithTicks(String(Math.round(origin + frame * ctx.ticksPerFrame)));
}

async function prepareClip(ctx: HostContext, item: VideoClipTrackItem, settings: Settings, fx: EffectNames = {}): Promise<PreparedClip> {
  const name = (await item.getName()) || "Clip";
  const start = await item.getStartTime();
  const end = await item.getEndTime();
  const inPoint = await item.getInPoint();
  const durationFrames = Math.max(1, Math.round((end.seconds - start.seconds) * ctx.fps));
  const chain = await item.getComponentChain();
  const components = listComponents(ctx.project, chain);
  const matchNames: string[] = [];
  for (const c of components) matchNames.push(await c.getMatchName());

  const motionIdx = indexOrFallback(matchNames, [MATCH.motion], 1);
  const opacityIdx = indexOrFallback(matchNames, [MATCH.opacity], 0);
  if (motionIdx < 0 || opacityIdx < 0 || !components[motionIdx] || !components[opacityIdx]) {
    throw new Error("Composants Mouvement / Opacité introuvables sur ce clip.");
  }
  const motionParams = paramsOf(ctx.project, components[motionIdx]);
  const opacityParams = paramsOf(ctx.project, components[opacityIdx]);
  const params: ParamRefs = {
    position: req(findParam(motionParams, ALIASES.position, MOTION_INDEX.position), "Position"),
    scale: req(findParam(motionParams, ALIASES.scale, MOTION_INDEX.scale), "Échelle"),
    scaleWidth: findParam(motionParams, ALIASES.scaleWidth, MOTION_INDEX.scaleWidth),
    uniformScale: findParam(motionParams, ALIASES.uniformScale, MOTION_INDEX.uniformScale),
    rotation: req(findParam(motionParams, ALIASES.rotation, MOTION_INDEX.rotation), "Rotation"),
    anchor: req(findParam(motionParams, ALIASES.anchor, MOTION_INDEX.anchor), "Point d'ancrage"),
    opacity: req(findParam(opacityParams, ALIASES.opacity, 0), "Opacité"),
    effects: {},
  };
  // Réutilise la dernière occurrence de chaque effet (évite d'empiler les effets à chaque application).
  const fxIdx = locateEffects(ctx.project, components, matchNames, fx, params.effects);
  const blurIdx = fxIdx.blur ?? -1;

  // Valeurs « au repos » : au milieu du clip si déjà animé (entre une entrée et une sortie).
  const mid = ctx.ppro.TickTime.createWithTicks(
    String(Math.round(Number(keyframeTime(ctx, { start, inPoint }, 0, settings.timeBase).ticks) + (durationFrames / 2) * ctx.ticksPerFrame)),
  );
  const position = await readPoint(params.position, mid, { x: 0.5, y: 0.5 });
  const normalized = looksNormalized(position);
  const defaultAnchor = normalized ? { x: 0.5, y: 0.5 } : { x: ctx.frameWidth / 2, y: ctx.frameHeight / 2 };
  const anchor = await readPoint(params.anchor, mid, defaultAnchor);
  const scale = await readNumber(params.scale, mid, 100);
  const opacity = await readNumber(params.opacity, mid, 100);
  const rotation = await readNumber(params.rotation, mid, 0);
  let uniform = true;
  if (params.uniformScale) {
    const u = await readValue(params.uniformScale, mid);
    if (typeof u === "boolean") uniform = u;
  }
  const scaleWidth = uniform ? scale : await readNumber(params.scaleWidth, mid, scale);

  const state: ClipState = {
    durationFrames,
    fps: ctx.fps,
    frameWidth: ctx.frameWidth,
    frameHeight: ctx.frameHeight,
    position,
    positionNormalized: normalized,
    anchor,
    scale,
    opacity,
    rotation,
  };
  const { pivot, source } = await resolvePivot(ctx, components, matchNames, [motionIdx, opacityIdx, blurIdx, ...Object.values(fxIdx)], state, mid, settings);
  state.pivot = pivot;
  return { item, name, start, inPoint, durationFrames, chain, components, matchNames, params, state, uniform, scaleWidth, pivotSource: source };
}

/** Repère les effets natifs déjà présents et range leurs paramètres. Renvoie leurs index. */
function locateEffects(
  project: Project,
  components: Component[],
  matchNames: string[],
  fx: EffectNames,
  into: Partial<Record<EffectId, ComponentParam[]>>,
): Partial<Record<EffectId, number>> {
  const idx: Partial<Record<EffectId, number>> = {};
  for (const spec of EFFECTS) {
    const wanted = fx[spec.id];
    let i = -1;
    for (let k = matchNames.length - 1; k >= 0 && i < 0; k--) {
      const n = matchNames[k];
      if ((wanted && n === wanted) || (!wanted && spec.matchNames.some((re) => re.test(n)))) i = k;
    }
    if (spec.id === "blur" && i < 0) i = lastIndexOfAny(matchNames, MATCH.blur);
    if (i >= 0) {
      idx[spec.id] = i;
      into[spec.id] = paramsOf(project, components[i]);
    }
  }
  return idx;
}

function indexOrFallback(names: string[], wanted: readonly string[], fallback: number) {
  const i = names.findIndex((n) => wanted.includes(n));
  return i >= 0 ? i : names.length > fallback ? fallback : -1;
}

function lastIndexOfAny(names: string[], wanted: readonly string[]) {
  for (let i = names.length - 1; i >= 0; i--) if (wanted.includes(names[i])) return i;
  return -1;
}

function req<T>(v: T | undefined, label: string): T {
  if (!v) throw new Error(`Paramètre « ${label} » introuvable.`);
  return v;
}

/**
 * Détermine le point autour duquel zoomer.
 * « auto » : position du calque texte (composant graphique) si elle est lisible,
 * sinon la position du clip.
 */
async function resolvePivot(
  ctx: HostContext,
  components: Component[],
  matchNames: string[],
  skip: number[],
  state: ClipState,
  at: TickTime,
  settings: Settings,
): Promise<{ pivot?: Point; source: string }> {
  const W = ctx.frameWidth;
  const H = ctx.frameHeight;
  switch (settings.pivot) {
    case "frame":
      return { pivot: { x: W / 2, y: H / 2 }, source: "centre de l'image" };
    case "lowerThird":
      return { pivot: { x: W / 2, y: H * 0.82 }, source: "tiers inférieur" };
    case "custom":
      return { pivot: { x: (W * settings.pivotX) / 100, y: (H * settings.pivotY) / 100 }, source: "personnalisé" };
    case "clip":
      return { pivot: undefined, source: "position du clip" };
    default:
      break;
  }
  for (let i = 0; i < components.length; i++) {
    if (skip.includes(i) || MATCH.blur.includes(matchNames[i] as (typeof MATCH.blur)[number])) continue;
    const params = paramsOf(ctx.project, components[i]);
    const p = params.find((x) => (ALIASES.position as readonly string[]).includes(normalize(safeName(x))));
    if (!p) continue;
    const v = await readValue(p, at).catch(() => undefined);
    if (!isPointLike(v)) continue;
    const local = looksNormalized(v) ? { x: v.x * W, y: v.y * H } : { x: v.x, y: v.y };
    const pxState = {
      ...state,
      position: state.positionNormalized ? { x: state.position.x * W, y: state.position.y * H } : state.position,
      anchor: state.positionNormalized ? { x: state.anchor.x * W, y: state.anchor.y * H } : state.anchor,
      positionNormalized: false,
    };
    const screen = clipPointToScreen(local, pxState);
    if (Number.isFinite(screen.x) && Number.isFinite(screen.y)) {
      return { pivot: screen, source: `calque texte (${Math.round(screen.x)}, ${Math.round(screen.y)})` };
    }
  }
  return { pivot: undefined, source: "position du clip" };
}

/* ------------------------------------------------------------------ */
/* Application                                                           */
/* ------------------------------------------------------------------ */

/** Ordre de lecture : début dans la timeline, puis piste (la plus basse d'abord). */
async function sortForReading(clips: VideoClipTrackItem[]) {
  const keyed: { c: VideoClipTrackItem; s: number; t: number }[] = [];
  for (const c of clips) keyed.push({ c, s: (await c.getStartTime()).seconds, t: await c.getTrackIndex() });
  keyed.sort((a, b) => a.s - b.s || a.t - b.t);
  return keyed.map((k) => k.c);
}

type Chain = Awaited<ReturnType<VideoClipTrackItem["getComponentChain"]>>;

interface WriteTarget {
  param: ComponentParam;
  keys: { frame: number; value: number | Point }[];
}

/** Liste des paramètres à animer pour un clip, avec leurs images clés. */
function writeTargets(c: PreparedClip): WriteTarget[] {
  const plan = c.plan;
  if (!plan) return [];
  const out: WriteTarget[] = [];
  if (plan.scale?.length) {
    out.push({ param: c.params.scale, keys: plan.scale });
    if (!c.uniform && c.params.scaleWidth && c.state.scale > 0) {
      const k = c.scaleWidth / c.state.scale;
      out.push({ param: c.params.scaleWidth, keys: plan.scale.map((x) => ({ frame: x.frame, value: x.value * k })) });
    }
  }
  if (plan.opacity?.length) out.push({ param: c.params.opacity, keys: plan.opacity });
  if (plan.rotation?.length) out.push({ param: c.params.rotation, keys: plan.rotation });
  const blurParam = c.params.effects.blur?.[0];
  if (plan.blur?.length && blurParam) out.push({ param: blurParam, keys: plan.blur });
  for (const [key, keys] of Object.entries(plan.effects ?? {}) as [TrackKey, { frame: number; value: number }[]][]) {
    const spec = effectOfTrack(key);
    const param = spec ? c.params.effects[spec.id]?.[spec.params[key] ?? 0] : undefined;
    if (param && keys?.length) out.push({ param, keys });
  }
  if (plan.position?.length) out.push({ param: c.params.position, keys: plan.position });
  return out;
}

/** Opération d'écriture décrite sous forme de données, convertie en Action dans la transaction. */
type Op =
  | { op: "append"; chain: Chain; component: Component | VideoFilterComponent }
  | { op: "timeVarying"; param: ComponentParam }
  | { op: "removeRange"; param: ComponentParam; from: TickTime; to: TickTime }
  | { op: "addKey"; param: ComponentParam; value: number | Point; time: TickTime }
  | { op: "linear"; param: ComponentParam; time: TickTime }
  | { op: "transition"; item: VideoClipTrackItem; transition: VideoTransition; options: AddTransitionOptions }
  | { op: "staticOff"; param: ComponentParam }
  | { op: "setValue"; param: ComponentParam; value: number | Point }
  | { op: "removeComponent"; chain: Chain; component: Component };

/**
 * Exécute une étape d'écriture pour tous les clips en UNE transaction (un seul
 * Cmd+Z). En cas d'échec global, rejoue clip par clip pour isoler le fautif.
 */
function runStep<T>(
  ppro: premierepro,
  project: Project,
  label: string,
  clips: T[],
  describeOps: (clip: T) => Op[],
): Map<T, string> {
  const failures = new Map<T, string>();
  const opsByClip = new Map(clips.map((c) => [c, describeOps(c)] as const));
  const attempt = (subset: T[]): boolean => {
    const ops = subset.flatMap((c) => opsByClip.get(c) ?? []);
    if (!ops.length) return true;
    let ok = false;
    project.lockedAccess(() => {
      ok = project.executeTransaction((compound) => {
        for (const o of ops) {
          switch (o.op) {
            case "append":
              compound.addAction(o.chain.createAppendComponentAction(o.component));
              break;
            case "timeVarying":
              compound.addAction(o.param.createSetTimeVaryingAction(true));
              break;
            case "removeRange":
              compound.addAction(o.param.createRemoveKeyframeRangeAction(o.from, o.to, true));
              break;
            case "addKey": {
              const v = o.value;
              const kf = o.param.createKeyframe(typeof v === "number" ? v : new ppro.PointF(v.x, v.y));
              kf.position = o.time;
              compound.addAction(o.param.createAddKeyframeAction(kf));
              break;
            }
            case "staticOff":
              compound.addAction(o.param.createSetTimeVaryingAction(false));
              break;
            case "setValue": {
              const v = o.value;
              const kf = o.param.createKeyframe(typeof v === "number" ? v : new ppro.PointF(v.x, v.y));
              compound.addAction(o.param.createSetValueAction(kf, true));
              break;
            }
            case "removeComponent":
              compound.addAction(o.chain.createRemoveComponentAction(o.component));
              break;
            case "transition":
              compound.addAction(o.item.createAddVideoTransitionAction(o.transition, o.options));
              break;
            case "linear":
              compound.addAction(
                o.param.createSetInterpolationAtKeyframeAction(o.time, ppro.Constants.InterpolationMode.LINEAR, false),
              );
              break;
          }
        }
      }, label);
    });
    return ok;
  };
  if (!clips.length) return failures;
  try {
    if (attempt(clips)) return failures;
  } catch {
    /* on isole ci-dessous */
  }
  for (const clip of clips) {
    try {
      if (!attempt([clip])) failures.set(clip, `Premiere a refusé l'étape « ${label} ».`);
    } catch (e) {
      failures.set(clip, errorMessage(e));
    }
  }
  return failures;
}

export async function applyAnimation(req: ApplyRequest): Promise<ApplyReport> {
  const t0 = Date.now();
  const ctx = await readContext();
  if (!ctx.clips.length) {
    throw new UserFacingError(
      "Aucun clip vidéo ou texte sélectionné.",
      "Sélectionnez un ou plusieurs clips dans la timeline, puis réessayez.",
    );
  }
  const { animation, params, mode, settings, onProgress } = req;
  if (animation.kind === "native") return applyNativeTransition(ctx, req, t0);
  const anchor = req.anchor ?? "playhead";
  const report: ApplyReport = { applied: 0, failed: [], warnings: [], keyCount: 0, durationMs: 0 };
  const ordered = await sortForReading(ctx.clips);
  const total = ordered.length;
  const label = `MotionCraft · ${animation.name}`;
  if (animation.multiLayer && total === 1) {
    report.warnings.push(
      "Un seul calque sélectionné : tout le texte apparaît d'un bloc. Pour un vrai mot à mot, placez un mot par calque et sélectionnez-les tous.",
    );
  }
  let playhead = 0;
  if (animation.kind === "accent" && anchor === "playhead") {
    try {
      playhead = (await ctx.sequence.getPlayerPosition()).seconds;
    } catch {
      report.warnings.push("Position de la tête de lecture illisible : effet placé au début du clip.");
    }
  }
  let markerTimes: number[] = [];
  if (animation.kind === "accent" && anchor === "markers") {
    markerTimes = await readSequenceMarkers(ctx);
    if (!markerTimes.length) {
      throw new UserFacingError(
        "Aucun marqueur dans la séquence.",
        "Placez des marqueurs de séquence sur les temps forts (touche M, tête de lecture dans la timeline), puis réessayez.",
      );
    }
  }
  const fxNames = await resolveEffects(ctx.ppro);

  // Mode « sur les coupes » : voisins immédiats sur la même piste.
  const neighbours = new Map<VideoClipTrackItem, { prev: boolean; next: boolean }>();
  if (req.cuts && animation.kind === "entrance") {
    const info: { item: VideoClipTrackItem; track: number; start: number; end: number }[] = [];
    for (const item of ordered) {
      info.push({ item, track: await item.getTrackIndex(), start: (await item.getStartTime()).seconds, end: (await item.getEndTime()).seconds });
    }
    const tol = 1.5 / ctx.fps;
    for (const a of info) {
      neighbours.set(a.item, {
        prev: info.some((b) => b !== a && b.track === a.track && Math.abs(b.end - a.start) <= tol),
        next: info.some((b) => b !== a && b.track === a.track && Math.abs(a.end - b.start) <= tol),
      });
    }
    if (![...neighbours.values()].some((n) => n.prev || n.next)) {
      throw new UserFacingError(
        "Aucune coupe entre les clips sélectionnés.",
        "Sélectionnez au moins deux plans qui se suivent sur la même piste.",
      );
    }
  }

  // 1. Lecture de l'état de chaque clip + calcul des images clés.
  let clips: PreparedClip[] = [];
  for (let i = 0; i < ordered.length; i++) {
    onProgress?.(i, total, "Analyse des clips");
    try {
      const clip = await prepareClip(ctx, ordered[i], settings, fxNames);
      const clipDuration = clip.durationFrames / ctx.fps;
      const motion = animation.build(params, { index: i, count: total, clipDuration });
      let spec: PlacementSpec = { type: "entrance", mode };
      if (req.cuts && animation.kind === "entrance") {
        const n = neighbours.get(ordered[i]);
        if (!n || (!n.prev && !n.next)) {
          report.warnings.push(`${clip.name} : pas de coupe avec un autre clip sélectionné, ignoré.`);
          continue;
        }
        spec = { type: "entrance", mode: n.prev && n.next ? "inOut" : n.prev ? "in" : "out", flipOut: true };
      }
      if (animation.kind === "span") spec = { type: "span" };
      if (animation.kind === "accent") {
        let at: number | number[] = 0;
        if (anchor === "end") at = clipDuration;
        if (anchor === "playhead") {
          at = playhead - clip.start.seconds;
          if (at < 0 || at > clipDuration) {
            report.warnings.push(`${clip.name} : la tête de lecture est hors du clip, effet placé au début.`);
            at = 0;
          }
        }
        if (anchor === "markers") {
          const inside = markerTimes.map((m) => m - clip.start.seconds).filter((m) => m >= 0 && m < clipDuration);
          if (!inside.length) {
            report.failed.push({ name: clip.name, error: "aucun marqueur de séquence dans ce clip" });
            continue;
          }
          at = inside;
        }
        spec = { type: "accent", at };
      }
      clip.plan = buildClipPlan(motion, spec, clip.state, settings.precision);
      for (const w of clip.plan.warnings) report.warnings.push(`${clip.name} : ${w}`);
      clips.push(clip);
    } catch (e) {
      report.failed.push({ name: await safeClipName(ordered[i]), error: errorMessage(e) });
    }
  }
  const drop = (failures: Map<PreparedClip, string>) => {
    for (const [c, error] of failures) report.failed.push({ name: c.name, error });
    clips = clips.filter((c) => !failures.has(c));
  };

  // 2. Effets natifs manquants (Flou, Recadrage, Luminosité) : instances créées AVANT la transaction.
  const needed = (c: PreparedClip): EffectId[] => {
    const ids = new Set<EffectId>();
    if (c.plan?.blur?.length) ids.add("blur");
    for (const key of Object.keys(c.plan?.effects ?? {}) as TrackKey[]) {
      const spec = effectOfTrack(key);
      if (spec) ids.add(spec.id);
    }
    return [...ids].filter((id) => !c.params.effects[id]);
  };
  const toAdd = clips.map((c) => ({ c, ids: needed(c) })).filter((x) => x.ids.length);
  if (toAdd.length) {
    onProgress?.(total, total, "Ajout des effets");
    const instances = new Map<PreparedClip, { id: EffectId; component: VideoFilterComponent }[]>();
    for (const { c, ids } of toAdd) {
      const list: { id: EffectId; component: VideoFilterComponent }[] = [];
      for (const id of ids) {
        const spec = EFFECTS.find((x) => x.id === id)!;
        const matchName = fxNames[id];
        if (!matchName) {
          report.warnings.push(`${c.name} : effet « ${spec.label} » introuvable dans votre Premiere, partie de l'animation ignorée.`);
          continue;
        }
        try {
          list.push({ id, component: await ctx.ppro.VideoFilterFactory.createComponent(matchName) });
        } catch (e) {
          report.warnings.push(`${c.name} : effet « ${spec.label} » indisponible (${errorMessage(e)}).`);
        }
      }
      if (list.length) instances.set(c, list);
    }
    const withFx = [...instances.keys()];
    const failures = runStep(ctx.ppro, ctx.project, `${label} — effets`, withFx, (c) =>
      instances.get(c)!.map((x): Op => ({ op: "append", chain: c.chain, component: x.component })),
    );
    drop(failures);
    // Relecture de la chaîne pour récupérer les paramètres des nouveaux effets.
    for (const c of withFx.filter((x) => !failures.has(x))) {
      c.chain = await c.item.getComponentChain();
      const comps = listComponents(ctx.project, c.chain);
      const names: string[] = [];
      for (const comp of comps) names.push(await comp.getMatchName());
      locateEffects(ctx.project, comps, names, fxNames, c.params.effects);
    }
  }

  // 3. Activer l'animation (chronomètre) des paramètres concernés.
  onProgress?.(total, total, "Préparation des paramètres");
  drop(
    runStep(ctx.ppro, ctx.project, `${label} — activation`, clips, (c) =>
      writeTargets(c)
        .filter((t) => !t.param.isTimeVarying())
        .map((t): Op => ({ op: "timeVarying", param: t.param })),
    ),
  );

  // 4. Nettoyage de la zone animée + écriture des images clés.
  onProgress?.(total, total, "Écriture des images clés");
  drop(
    runStep(ctx.ppro, ctx.project, label, clips, (c) => {
      const ops: Op[] = [];
      for (const t of writeTargets(c)) {
        if (settings.replaceExisting) {
          for (const [a, b] of c.plan!.clearRanges) {
            ops.push({
              op: "removeRange",
              param: t.param,
              from: keyframeTime(ctx, c, a, settings.timeBase),
              to: keyframeTime(ctx, c, b, settings.timeBase),
            });
          }
        }
        for (const k of t.keys) {
          ops.push({ op: "addKey", param: t.param, value: k.value, time: keyframeTime(ctx, c, k.frame, settings.timeBase) });
        }
      }
      return ops;
    }),
  );

  // 5. Interpolation linéaire : les courbes sont déjà « cuites » image par image.
  const interp = runStep(ctx.ppro, ctx.project, `${label} — interpolation`, clips, (c) =>
    writeTargets(c).flatMap((t) =>
      t.keys.map((k): Op => ({ op: "linear", param: t.param, time: keyframeTime(ctx, c, k.frame, settings.timeBase) })),
    ),
  );
  if (interp.size) {
    report.warnings.push(
      `Interpolation linéaire non appliquée sur ${interp.size} clip(s) : l'animation reste correcte mais légèrement plus « lissée ».`,
    );
  }

  for (const c of clips) {
    report.applied++;
    report.keyCount += c.plan?.keyCount ?? 0;
    if (settings.pivot === "auto" && c.plan?.scale?.length) {
      report.warnings.push(`${c.name} : pivot du zoom = ${c.pivotSource}.`);
    }
  }
  onProgress?.(total, total, "Terminé");
  report.durationMs = Date.now() - t0;
  return report;
}

/* ------------------------------------------------------------------ */
/* Retirer les animations                                                */
/* ------------------------------------------------------------------ */

export interface ClearReport {
  cleared: number;
  failed: { name: string; error: string }[];
  removedEffects: number;
}

/** Valeur à restaurer : valeur au milieu du clip, sauf zoom/rotation constants (effets « tout le clip »). */
async function restoreValue(param: ComponentParam, mid: TickTime, kind: "scale" | "rotation" | "other"): Promise<number | Point | undefined> {
  try {
    const times = param.getKeyframeListAsTickTimes();
    const values: unknown[] = [];
    for (const t of times.slice(0, 40)) values.push(unwrapValue(await param.getValueAtTime(t)));
    const allNumbers = values.length > 1 && values.every((v) => typeof v === "number");
    const constant = allNumbers && values.every((v) => Math.abs((v as number) - (values[0] as number)) < 1e-6);
    if (constant && kind === "scale") return 100;
    if (constant && kind === "rotation") return 0;
    const v = unwrapValue(await param.getValueAtTime(mid));
    if (typeof v === "number") return v;
    if (isPointLike(v)) return { x: v.x, y: v.y };
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Supprime les animations des clips sélectionnés : images clés de Mouvement et
 * Opacité (valeur de repos conservée) et, si demandé, effets Flou gaussien,
 * Recadrage, Luminosité et contraste.
 */
export async function clearAnimations(settings: Settings, removeEffects: boolean): Promise<ClearReport> {
  const ctx = await readContext();
  if (!ctx.clips.length) throw new UserFacingError("Aucun clip sélectionné.", "Sélectionnez les clips à remettre à zéro.");
  const fx = await resolveEffects(ctx.ppro);
  const report: ClearReport = { cleared: 0, failed: [], removedEffects: 0 };
  interface Job {
    name: string;
    clip: PreparedClip;
    params: { param: ComponentParam; value: number | Point | undefined }[];
    effects: Component[];
  }
  const jobs: Job[] = [];
  for (const item of ctx.clips) {
    try {
      const c = await prepareClip(ctx, item, settings, fx);
      const mid = keyframeTime(ctx, c, Math.floor(c.durationFrames / 2), settings.timeBase);
      const list: Job["params"] = [];
      const add = async (param: ComponentParam | undefined, kind: "scale" | "rotation" | "other") => {
        if (param && param.isTimeVarying()) list.push({ param, value: await restoreValue(param, mid, kind) });
      };
      await add(c.params.position, "other");
      await add(c.params.scale, "scale");
      await add(c.params.scaleWidth, "scale");
      await add(c.params.rotation, "rotation");
      await add(c.params.opacity, "other");
      const effects: Component[] = [];
      if (removeEffects) {
        for (let i = 0; i < c.components.length; i++) {
          const n = c.matchNames[i];
          if (EFFECTS.some((e) => fx[e.id] === n || (e.id === "blur" && (MATCH.blur as readonly string[]).includes(n)))) effects.push(c.components[i]);
        }
      }
      jobs.push({ name: c.name, clip: c, params: list, effects });
    } catch (e) {
      report.failed.push({ name: await safeClipName(item), error: errorMessage(e) });
    }
  }
  const label = "MotionCraft · Retirer les animations";
  const f1 = runStep(ctx.ppro, ctx.project, `${label} — images clés`, jobs, (j) => j.params.map((p): Op => ({ op: "staticOff", param: p.param })));
  const f2 = runStep(ctx.ppro, ctx.project, `${label} — valeurs`, jobs.filter((j) => !f1.has(j)), (j) =>
    j.params.filter((p) => p.value !== undefined).map((p): Op => ({ op: "setValue", param: p.param, value: p.value! })),
  );
  const f3 = removeEffects
    ? runStep(ctx.ppro, ctx.project, `${label} — effets`, jobs.filter((j) => !f1.has(j)), (j) =>
        j.effects.map((component): Op => ({ op: "removeComponent", chain: j.clip.chain, component })),
      )
    : new Map<Job, string>();
  for (const [j, error] of [...f1, ...f2, ...f3]) report.failed.push({ name: j.name, error });
  for (const j of jobs) {
    if (f1.has(j)) continue;
    report.cleared++;
    if (removeEffects && !f3.has(j)) report.removedEffects += j.effects.length;
  }
  return report;
}

/** Instants (s, temps de séquence) des marqueurs de la séquence active. */
async function readSequenceMarkers(ctx: HostContext): Promise<number[]> {
  try {
    const markers = await ctx.ppro.Markers.getMarkers(ctx.sequence);
    const list = markers.getMarkers();
    return list.map((m) => m.getStart().seconds).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Transitions natives                                                   */
/* ------------------------------------------------------------------ */

interface TransitionTarget {
  name: string;
  item: VideoClipTrackItem;
  atStart: boolean;
}

async function applyNativeTransition(ctx: HostContext, req: ApplyRequest, t0: number): Promise<ApplyReport> {
  const { animation, params } = req;
  const report: ApplyReport = { applied: 0, failed: [], warnings: [], keyCount: 0, durationMs: 0 };
  const names = await ctx.ppro.TransitionFactory.getVideoTransitionMatchNames();
  const patterns = animation.native?.patterns ?? [];
  let matchName: string | undefined;
  for (const re of patterns) {
    matchName = names.find((n) => re.test(n));
    if (matchName) break;
  }
  if (!matchName) {
    throw new UserFacingError(
      `Transition « ${animation.name} » introuvable dans votre version de Premiere.`,
      `Transitions disponibles : ${names.slice(0, 12).join(", ")}${names.length > 12 ? "…" : ""}`,
    );
  }
  const seconds = Math.max(0.04, Number(params.duration) || 0.5);
  const placement = String(params.placement ?? "between");

  // Clips triés par piste puis par début, pour repérer les coupes entre clips sélectionnés.
  const info: { item: VideoClipTrackItem; name: string; track: number; start: number; end: number }[] = [];
  for (const item of ctx.clips) {
    info.push({
      item,
      name: (await item.getName()) || "Clip",
      track: await item.getTrackIndex(),
      start: (await item.getStartTime()).seconds,
      end: (await item.getEndTime()).seconds,
    });
  }
  info.sort((a, b) => a.track - b.track || a.start - b.start);
  const frame = 1 / ctx.fps;
  const targets: TransitionTarget[] = [];
  if (placement === "between") {
    for (let i = 0; i < info.length - 1; i++) {
      const a = info[i];
      const b = info[i + 1];
      if (a.track === b.track && Math.abs(b.start - a.end) <= frame * 1.5) targets.push({ name: `${a.name} → ${b.name}`, item: a.item, atStart: false });
    }
    if (!targets.length) {
      throw new UserFacingError(
        "Aucune coupe entre les clips sélectionnés.",
        "Sélectionnez au moins deux clips qui se suivent sur la même piste, ou choisissez « Au début / À la fin de chaque clip ».",
      );
    }
  } else {
    for (const c of info) {
      if (placement === "start" || placement === "both") targets.push({ name: c.name, item: c.item, atStart: true });
      if (placement === "end" || placement === "both") targets.push({ name: c.name, item: c.item, atStart: false });
    }
  }

  // Transitions et options créées AVANT la transaction (une instance par coupe).
  const prepared: (TransitionTarget & { transition: VideoTransition; options: AddTransitionOptions })[] = [];
  for (const t of targets) {
    try {
      const transition = await Promise.resolve(ctx.ppro.TransitionFactory.createVideoTransition(matchName));
      const options = ctx.ppro.AddTransitionOptions();
      options.setApplyToStart(t.atStart);
      options.setDuration(ctx.ppro.TickTime.createWithSeconds(seconds));
      prepared.push({ ...t, transition, options });
    } catch (e) {
      report.failed.push({ name: t.name, error: errorMessage(e) });
    }
  }
  const failures = runStep(ctx.ppro, ctx.project, `MotionCraft · ${animation.name}`, prepared, (t) => [
    { op: "transition", item: t.item, transition: t.transition, options: t.options },
  ]);
  for (const [t, error] of failures) report.failed.push({ name: t.name, error });
  report.applied = prepared.length - failures.size;
  report.warnings.push(`Transition Premiere utilisée : ${matchName} (${seconds.toFixed(2)} s).`);
  report.durationMs = Date.now() - t0;
  return report;
}

async function safeClipName(c: VideoClipTrackItem) {
  try {
    return (await c.getName()) || "Clip";
  } catch {
    return "Clip";
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/* ------------------------------------------------------------------ */
/* Diagnostic                                                            */
/* ------------------------------------------------------------------ */

/**
 * Rapport texte décrivant la séquence et les clips sélectionnés : composants,
 * paramètres, valeurs, images clés. À copier pour le support / le débogage.
 */
export async function inspectSelection(settings: Settings): Promise<string> {
  const lines: string[] = [];
  const ctx = await readContext();
  lines.push(`MotionCraft Pro — diagnostic`);
  lines.push(`Séquence : ${ctx.frameWidth}×${ctx.frameHeight} @ ${ctx.fps.toFixed(3)} i/s (ticks/image ${ctx.ticksPerFrame})`);
  lines.push(`Sélection : ${ctx.clips.length} clip(s) vidéo, ${ctx.ignored} élément(s) ignoré(s)`);
  for (const item of (await sortForReading(ctx.clips)).slice(0, 5)) {
    lines.push("");
    try {
      const c = await prepareClip(ctx, item, settings);
      lines.push(`■ ${c.name}`);
      lines.push(`  début ${c.start.seconds.toFixed(3)} s · in-point ${c.inPoint.seconds.toFixed(3)} s · ${c.durationFrames} images`);
      lines.push(
        `  repos : position (${fmt(c.state.position.x)}, ${fmt(c.state.position.y)})${c.state.positionNormalized ? " normalisée" : " px"}, échelle ${fmt(c.state.scale)} %, opacité ${fmt(c.state.opacity)} %, rotation ${fmt(c.state.rotation)}°`,
      );
      lines.push(`  pivot du zoom : ${c.pivotSource}${c.uniform ? "" : " · échelle NON uniforme"}`);
      for (let i = 0; i < c.components.length; i++) {
        let display = "";
        try {
          display = await c.components[i].getDisplayName();
        } catch {
          display = "?";
        }
        lines.push(`  [${i}] ${display} — ${c.matchNames[i]}`);
        const params = paramsOf(ctx.project, c.components[i]);
        for (let j = 0; j < params.length; j++) {
          const p = params[j];
          let value = "";
          let keys = 0;
          try {
            value = describe(unwrapValue(await p.getStartValue()));
          } catch {
            value = "—";
          }
          try {
            keys = p.isTimeVarying() ? p.getKeyframeListAsTickTimes().length : 0;
          } catch {
            keys = 0;
          }
          lines.push(`      ${j}. ${safeName(p) || "(sans nom)"} = ${value}${keys ? ` · ${keys} image(s) clé(s)` : ""}`);
        }
      }
    } catch (e) {
      lines.push(`■ ${await safeClipName(item)} : ${errorMessage(e)}`);
    }
  }
  if (ctx.clips.length > 5) lines.push(`… ${ctx.clips.length - 5} autre(s) clip(s) non détaillé(s).`);
  // Ce que ce Premiere expose réellement (pour vérifier les correspondances de noms).
  lines.push("");
  const fx = await resolveEffects(ctx.ppro);
  lines.push(`Effets MotionCraft → ${EFFECTS.map((e) => `${e.label} : ${fx[e.id] ?? "INTROUVABLE"}`).join(" · ")}`);
  try {
    const tr = await ctx.ppro.TransitionFactory.getVideoTransitionMatchNames();
    lines.push(`Transitions vidéo disponibles (${tr.length}) : ${tr.join(", ")}`);
  } catch (e) {
    lines.push(`Transitions : illisibles (${errorMessage(e)})`);
  }
  try {
    lines.push(`Marqueurs de séquence : ${(await readSequenceMarkers(ctx)).length}`);
  } catch {
    /* ignore */
  }
  return lines.join("\n");
}

const fmt = (n: number) => (Number.isFinite(n) ? (Math.round(n * 1000) / 1000).toString() : "?");

function describe(v: unknown): string {
  if (typeof v === "number") return fmt(v);
  if (typeof v === "string") return JSON.stringify(v.length > 60 ? `${v.slice(0, 60)}…` : v);
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (isPointLike(v)) return `(${fmt(v.x)}, ${fmt(v.y)})`;
  if (v && typeof v === "object") return Object.prototype.toString.call(v);
  return String(v);
}

/* ------------------------------------------------------------------ */
/* Suivi de la sélection                                                 */
/* ------------------------------------------------------------------ */

/**
 * Prévient `onChange` quand la sélection de la timeline change.
 *
 * V1 interrogeait Premiere toutes les 1,5 s, ce qui a pu le déstabiliser.
 * Désormais : uniquement l'événement officiel SELECTION_CHANGED (regroupé sur
 * 250 ms). Si l'événement est indisponible, une vérification lente (5 s) prend
 * le relais. L'interface rafraîchit aussi quand la souris revient sur le panneau.
 */
export function watchSelection(onChange: () => void, fallbackIntervalMs = 5000): () => void {
  const ppro = getPpro();
  let stopped = false;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const handler = () => {
    if (stopped) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      if (!stopped) onChange();
    }, 250);
  };
  let unlisten: (() => void) | null = null;
  try {
    const em = ppro?.EventManager;
    const evt = ppro?.Constants?.SequenceEvent?.SELECTION_CHANGED;
    if (em && evt !== undefined) {
      em.addGlobalEventListener(evt, handler);
      unlisten = () => em.removeGlobalEventListener(evt, handler);
    }
  } catch {
    unlisten = null;
  }
  const timer = unlisten || !ppro ? null : setInterval(handler, fallbackIntervalMs);
  return () => {
    stopped = true;
    if (debounce) clearTimeout(debounce);
    if (timer) clearInterval(timer);
    try {
      unlisten?.();
    } catch {
      /* ignore */
    }
  };
}
