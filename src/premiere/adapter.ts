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
} from "@adobe/premierepro";
import { buildClipPlan, clipPointToScreen, looksNormalized, type ClipPlan, type ClipState, type Point } from "../engine/plan";
import type { AnimationDefinition, AnimationMode, ParamValues } from "../engine/types";
import { normalize } from "../animations/registry";
import type { Settings } from "../state/settings";
import { getPpro, UserFacingError } from "./host";

export const TICKS_PER_SECOND = 254016000000;

export const MATCH = {
  motion: "AE.ADBE Motion",
  opacity: "AE.ADBE Opacity",
  blur: ["AE.ADBE Gaussian Blur 2", "AE.ADBE Gaussian Blur"],
} as const;

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
  mode: AnimationMode;
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

export async function getSelectionInfo(): Promise<SelectionInfo> {
  const ppro = getPpro();
  if (!ppro) return { status: "no-host", clips: [], ignored: 0 };
  const project = await ppro.Project.getActiveProject();
  if (!project) return { status: "no-project", clips: [], ignored: 0 };
  const sequence = await project.getActiveSequence();
  if (!sequence) return { status: "no-sequence", clips: [], ignored: 0 };
  const ctx = await readContext();
  const clips: ClipSummary[] = [];
  for (const c of ctx.clips) {
    clips.push({
      name: (await c.getName()) || "Clip",
      start: (await c.getStartTime()).seconds,
      end: (await c.getEndTime()).seconds,
      track: await c.getTrackIndex(),
    });
  }
  let sequenceName: string | undefined;
  try {
    sequenceName = (sequence as unknown as { name?: string }).name;
  } catch {
    sequenceName = undefined;
  }
  return {
    status: "ok",
    sequenceName,
    clips,
    ignored: ctx.ignored,
    fps: ctx.fps,
    frameWidth: ctx.frameWidth,
    frameHeight: ctx.frameHeight,
  };
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
  blur?: ComponentParam;
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

async function prepareClip(ctx: HostContext, item: VideoClipTrackItem, settings: Settings): Promise<PreparedClip> {
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
  };
  // Réutilise le dernier Flou gaussien du clip (évite d'empiler les effets à chaque application).
  const blurIdx = lastIndexOfAny(matchNames, MATCH.blur);
  if (blurIdx >= 0) params.blur = paramsOf(ctx.project, components[blurIdx])[0];

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
  const { pivot, source } = await resolvePivot(ctx, components, matchNames, [motionIdx, opacityIdx, blurIdx], state, mid, settings);
  state.pivot = pivot;
  return { item, name, start, inPoint, durationFrames, chain, components, matchNames, params, state, uniform, scaleWidth, pivotSource: source };
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
  if (plan.blur?.length && c.params.blur) out.push({ param: c.params.blur, keys: plan.blur });
  if (plan.position?.length) out.push({ param: c.params.position, keys: plan.position });
  return out;
}

/** Opération d'écriture décrite sous forme de données, convertie en Action dans la transaction. */
type Op =
  | { op: "append"; chain: Chain; component: Component | VideoFilterComponent }
  | { op: "timeVarying"; param: ComponentParam }
  | { op: "removeRange"; param: ComponentParam; from: TickTime; to: TickTime }
  | { op: "addKey"; param: ComponentParam; value: number | Point; time: TickTime }
  | { op: "linear"; param: ComponentParam; time: TickTime };

/**
 * Exécute une étape d'écriture pour tous les clips en UNE transaction (un seul
 * Cmd+Z). En cas d'échec global, rejoue clip par clip pour isoler le fautif.
 */
function runStep(
  ppro: premierepro,
  project: Project,
  label: string,
  clips: PreparedClip[],
  describeOps: (clip: PreparedClip) => Op[],
): Map<PreparedClip, string> {
  const failures = new Map<PreparedClip, string>();
  const opsByClip = new Map(clips.map((c) => [c, describeOps(c)] as const));
  const attempt = (subset: PreparedClip[]): boolean => {
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
      "Sélectionnez un ou plusieurs textes dans la timeline, puis réessayez.",
    );
  }
  const { animation, params, mode, settings, onProgress } = req;
  const report: ApplyReport = { applied: 0, failed: [], warnings: [], keyCount: 0, durationMs: 0 };
  const ordered = await sortForReading(ctx.clips);
  const total = ordered.length;
  const label = `MotionCraft · ${animation.name}`;

  // 1. Lecture de l'état de chaque clip + calcul des images clés.
  let clips: PreparedClip[] = [];
  for (let i = 0; i < ordered.length; i++) {
    onProgress?.(i, total, "Analyse des clips");
    try {
      const clip = await prepareClip(ctx, ordered[i], settings);
      const motion = animation.build(params, { index: i, count: total });
      clip.plan = buildClipPlan(motion, mode, clip.state, settings.precision);
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

  // 2. Effet Flou gaussien manquant : instances créées AVANT la transaction (API asynchrone).
  const needBlur = clips.filter((c) => c.plan?.blur?.length && !c.params.blur);
  if (needBlur.length) {
    onProgress?.(total, total, "Ajout du Flou gaussien");
    const blurName = await availableBlurMatchName(ctx.ppro);
    const instances = new Map<PreparedClip, Awaited<ReturnType<premierepro["VideoFilterFactory"]["createComponent"]>>>();
    for (const c of needBlur) {
      try {
        instances.set(c, await ctx.ppro.VideoFilterFactory.createComponent(blurName));
      } catch (e) {
        report.warnings.push(`${c.name} : Flou gaussien indisponible (${errorMessage(e)}), animé sans flou.`);
      }
    }
    const withBlur = needBlur.filter((c) => instances.has(c));
    const failures = runStep(ctx.ppro, ctx.project, `${label} — Flou gaussien`, withBlur, (c) => [
      { op: "append", chain: c.chain, component: instances.get(c)! },
    ]);
    drop(failures);
    // Relecture de la chaîne pour récupérer le paramètre « Flou » du nouvel effet.
    for (const c of withBlur.filter((x) => !failures.has(x))) {
      c.chain = await c.item.getComponentChain();
      const comps = listComponents(ctx.project, c.chain);
      const names: string[] = [];
      for (const comp of comps) names.push(await comp.getMatchName());
      const idx = lastIndexOfAny(names, MATCH.blur);
      if (idx >= 0) c.params.blur = paramsOf(ctx.project, comps[idx])[0];
      else report.warnings.push(`${c.name} : Flou gaussien ajouté mais introuvable, animé sans flou.`);
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

async function availableBlurMatchName(ppro: premierepro): Promise<string> {
  try {
    const names = await ppro.VideoFilterFactory.getMatchNames();
    for (const m of MATCH.blur) if (names.includes(m)) return m;
  } catch {
    /* ignore */
  }
  return MATCH.blur[0];
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
 * Prévient `onChange` quand la sélection de la timeline change : événement
 * officiel SELECTION_CHANGED si disponible, plus une vérification périodique
 * légère (filet de sécurité). Renvoie une fonction d'arrêt.
 */
export function watchSelection(onChange: () => void, intervalMs = 1500): () => void {
  const ppro = getPpro();
  let stopped = false;
  const handler = () => {
    if (!stopped) onChange();
  };
  let unlisten = () => {};
  try {
    const em = ppro?.EventManager;
    const evt = ppro?.Constants?.SequenceEvent?.SELECTION_CHANGED;
    if (em && evt !== undefined) {
      em.addGlobalEventListener(evt, handler);
      unlisten = () => em.removeGlobalEventListener(evt, handler);
    }
  } catch {
    /* événements indisponibles : la vérification périodique suffit */
  }
  const timer = setInterval(handler, intervalMs);
  return () => {
    stopped = true;
    clearInterval(timer);
    try {
      unlisten();
    } catch {
      /* ignore */
    }
  };
}
