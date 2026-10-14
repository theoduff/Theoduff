/**
 * Simulateur du module UXP `premierepro`, pour les tests automatisés et le banc
 * d'essai navigateur. Il reproduit les contraintes importantes de l'API réelle :
 *
 *  - les actions ne peuvent être créées que pendant `lockedAccess` / une transaction ;
 *  - une image clé ajoutée sur un paramètre NON animé remplace simplement sa valeur
 *    (d'où la nécessité d'activer l'animation dans une transaction préalable) ;
 *  - l'interpolation ne peut être réglée que sur une image clé existante ;
 *  - les positions du composant Mouvement sont normalisées (0–1), comme en ExtendScript.
 *
 * Il ne remplace PAS un test dans Premiere Pro : il valide notre logique, pas Premiere.
 */

const TPS = 254016000000;

export class TickTime {
  constructor(public readonly ticksNumber = 0) {}
  get ticks() {
    return String(Math.round(this.ticksNumber));
  }
  get seconds() {
    return this.ticksNumber / TPS;
  }
  add(o: TickTime) {
    return new TickTime(this.ticksNumber + o.ticksNumber);
  }
  subtract(o: TickTime) {
    return new TickTime(this.ticksNumber - o.ticksNumber);
  }
  equals(o: TickTime) {
    return Math.round(o.ticksNumber) === Math.round(this.ticksNumber);
  }
  static createWithSeconds(s: number) {
    return new TickTime(s * TPS);
  }
  static createWithTicks(t: string) {
    return new TickTime(Number(t));
  }
  static TIME_ZERO = new TickTime(0);
}

export class PointF {
  constructor(
    public x = 0,
    public y = 0,
  ) {}
}

type Value = number | boolean | string | PointF;

export class Keyframe {
  position = TickTime.TIME_ZERO;
  value: { value: Value };
  constructor(v: Value) {
    this.value = { value: v };
  }
}

let lockDepth = 0;
const requireLock = (what: string) => {
  if (lockDepth <= 0) throw new Error(`${what} appelé hors lockedAccess/executeTransaction`);
};

type MockAction = { run: () => void; label: string };

export interface StoredKey {
  ticks: number;
  value: Value;
  interpolation: number;
}

export class MockParam {
  timeVarying = false;
  keys: StoredKey[] = [];
  constructor(
    public displayName: string,
    public value: Value,
  ) {}
  async areKeyframesSupported() {
    return typeof this.value !== "string";
  }
  isTimeVarying() {
    return this.timeVarying;
  }
  createKeyframe(v: Value) {
    if (typeof v !== typeof this.value && !(this.value instanceof PointF && v instanceof PointF)) {
      throw new Error(`Type de valeur incompatible pour ${this.displayName}`);
    }
    return new Keyframe(v);
  }
  createSetTimeVaryingAction(on: boolean): MockAction {
    requireLock("createSetTimeVaryingAction");
    return {
      label: "timeVarying",
      run: () => {
        this.timeVarying = on;
        if (!on) this.keys = [];
      },
    };
  }
  createAddKeyframeAction(kf: Keyframe): MockAction {
    requireLock("createAddKeyframeAction");
    const ticks = kf.position.ticksNumber;
    const value = kf.value.value;
    return {
      label: "addKey",
      run: () => {
        if (!this.timeVarying) {
          this.value = value;
          return;
        }
        this.keys = this.keys.filter((k) => Math.round(k.ticks) !== Math.round(ticks));
        this.keys.push({ ticks, value, interpolation: 0 });
        this.keys.sort((a, b) => a.ticks - b.ticks);
      },
    };
  }
  createSetValueAction(kf: Keyframe): MockAction {
    requireLock("createSetValueAction");
    return {
      label: "setValue",
      run: () => {
        this.value = kf.value.value;
      },
    };
  }
  createRemoveKeyframeRangeAction(a: TickTime, b: TickTime): MockAction {
    requireLock("createRemoveKeyframeRangeAction");
    return {
      label: "removeRange",
      run: () => {
        this.keys = this.keys.filter((k) => k.ticks < a.ticksNumber || k.ticks > b.ticksNumber);
      },
    };
  }
  createSetInterpolationAtKeyframeAction(t: TickTime, mode: number): MockAction {
    requireLock("createSetInterpolationAtKeyframeAction");
    return {
      label: "interp",
      run: () => {
        const k = this.keys.find((x) => Math.round(x.ticks) === Math.round(t.ticksNumber));
        if (!k) throw new Error("Aucune image clé à cet instant");
        k.interpolation = mode;
      },
    };
  }
  async getStartValue() {
    return new Keyframe(this.keys.length ? this.keys[0].value : this.value);
  }
  async getValueAtTime(t: TickTime) {
    return this.valueAt(t.ticksNumber);
  }
  valueAt(ticks: number): Value {
    if (!this.timeVarying || !this.keys.length) return this.value;
    const ks = this.keys;
    if (ticks <= ks[0].ticks) return ks[0].value;
    for (let i = 1; i < ks.length; i++) {
      if (ticks <= ks[i].ticks) {
        const a = ks[i - 1];
        const b = ks[i];
        const u = (ticks - a.ticks) / (b.ticks - a.ticks);
        if (typeof a.value === "number" && typeof b.value === "number") return a.value + (b.value - a.value) * u;
        if (a.value instanceof PointF && b.value instanceof PointF)
          return new PointF(a.value.x + (b.value.x - a.value.x) * u, a.value.y + (b.value.y - a.value.y) * u);
        return a.value;
      }
    }
    return ks[ks.length - 1].value;
  }
  getKeyframeListAsTickTimes() {
    return this.keys.map((k) => new TickTime(k.ticks));
  }
}

export class MockComponent {
  constructor(
    public matchName: string,
    public displayName: string,
    public params: MockParam[],
  ) {}
  async getMatchName() {
    return this.matchName;
  }
  async getDisplayName() {
    return this.displayName;
  }
  getParamCount() {
    return this.params.length;
  }
  getParam(i = 0) {
    return this.params[i];
  }
}

export class MockChain {
  constructor(public components: MockComponent[]) {}
  getComponentCount() {
    requireLock("getComponentCount");
    return this.components.length;
  }
  getComponentAtIndex(i: number) {
    return this.components[i];
  }
  createRemoveComponentAction(c: MockComponent): MockAction {
    requireLock("createRemoveComponentAction");
    return { label: "remove", run: () => (this.components = this.components.filter((x) => x !== c)) };
  }
  createAppendComponentAction(c: MockComponent): MockAction {
    requireLock("createAppendComponentAction");
    return { label: "append", run: () => this.components.push(c) };
  }
}

export class VideoClipTrackItem {
  constructor(
    public name: string,
    public start: number,
    public end: number,
    public track: number,
    public chain: MockChain,
    public inPoint = 0,
  ) {}
  async getName() {
    return this.name;
  }
  async getStartTime() {
    return TickTime.createWithSeconds(this.start);
  }
  async getEndTime() {
    return TickTime.createWithSeconds(this.end);
  }
  async getInPoint() {
    return TickTime.createWithSeconds(this.inPoint);
  }
  async getTrackIndex() {
    return this.track;
  }
  async getComponentChain() {
    return this.chain;
  }
  /** Transitions posées (simulées). */
  transitions: { matchName: string; atStart: boolean; seconds: number }[] = [];
  createAddVideoTransitionAction(t: { matchName: string }, o?: { applyToStart: boolean; duration: TickTime }): MockAction {
    requireLock("createAddVideoTransitionAction");
    return {
      label: "transition",
      run: () => {
        this.transitions.push({ matchName: t.matchName, atStart: !!o?.applyToStart, seconds: o?.duration?.seconds ?? 1 });
      },
    };
  }
  /** Raccourcis de test. */
  component(matchName: string) {
    return this.chain.components.filter((c) => c.matchName === matchName).pop();
  }
}

export class AudioClipTrackItem {
  async getName() {
    return "Audio";
  }
}

export interface MockOptions {
  width?: number;
  height?: number;
  fps?: number;
  /** Position du composant Mouvement en pixels plutôt que normalisée. */
  pixelPositions?: boolean;
}

/** Crée un clip texte réaliste : Opacité, Mouvement, puis le composant graphique du texte. */
export function makeTextClip(
  name: string,
  start: number,
  end: number,
  opts: MockOptions & { track?: number; textPosition?: [number, number]; inPoint?: number } = {},
) {
  const W = opts.width ?? 1920;
  const H = opts.height ?? 1080;
  const center = opts.pixelPositions ? new PointF(W / 2, H / 2) : new PointF(0.5, 0.5);
  const opacity = new MockComponent("AE.ADBE Opacity", "Opacité", [new MockParam("Opacité", 100), new MockParam("Mode de fusion", 0)]);
  const motion = new MockComponent("AE.ADBE Motion", "Trajectoire", [
    new MockParam("Position", center),
    new MockParam("Échelle", 100),
    new MockParam("Largeur d'échelle", 100),
    new MockParam("Échelle uniforme", true),
    new MockParam("Rotation", 0),
    new MockParam("Point d'ancrage", new PointF(center.x, center.y)),
    new MockParam("Anti-scintillement", 0),
  ]);
  const [tx, ty] = opts.textPosition ?? [W / 2, H / 2];
  const text = new MockComponent("AE.ADBE Text", `Texte (${name})`, [
    new MockParam("Texte source", name),
    new MockParam("Position", new PointF(tx, ty)),
    new MockParam("Échelle", 100),
    new MockParam("Rotation", 0),
    new MockParam("Opacité", 100),
  ]);
  return new VideoClipTrackItem(name, start, end, opts.track ?? 1, new MockChain([opacity, motion, text]), opts.inPoint ?? 0);
}

export function makeBlurComponent() {
  return new MockComponent("AE.ADBE Gaussian Blur 2", "Flou gaussien", [
    new MockParam("Flou", 0),
    new MockParam("Dimensions du flou", 1),
    new MockParam("Répéter les pixels du contour", false),
  ]);
}

export function makeCropComponent() {
  return new MockComponent("AE.ADBE AECrop", "Recadrage", [
    new MockParam("Gauche", 0),
    new MockParam("Haut", 0),
    new MockParam("Droite", 0),
    new MockParam("Bas", 0),
    new MockParam("Zoom", false),
    new MockParam("Contour progressif", 0),
  ]);
}

export function makeBrightnessComponent() {
  return new MockComponent("AE.ADBE Brightness & Contrast 2", "Luminosité et contraste", [new MockParam("Luminosité", 0), new MockParam("Contraste", 0)]);
}

const FILTERS: [string, string, () => MockComponent][] = [
  ["AE.ADBE Gaussian Blur 2", "Flou gaussien", makeBlurComponent],
  ["AE.ADBE AECrop", "Recadrage", makeCropComponent],
  ["AE.ADBE Brightness & Contrast 2", "Luminosité et contraste", makeBrightnessComponent],
  ["PR.ADBE Gamma Correction", "Correction gamma", () => new MockComponent("PR.ADBE Gamma Correction", "Correction gamma", [new MockParam("Gamma", 10)])],
];

export const MOCK_TRANSITIONS = [
  "AE.ADBE Cross Dissolve New",
  "AE.ADBE Dip To Black",
  "AE.ADBE Dip To White",
  "AE.ADBE Film Dissolve",
  "AE.ADBE Additive Dissolve",
  "AE.ADBE Push",
  "AE.ADBE Slide",
  "AE.ADBE Cross Zoom",
  "AE.ADBE Wipe",
  "AE.ADBE Iris Round",
  "AE.ADBE Barn Doors",
  "AE.ADBE Split",
];

export function createMockPremiere(opts: MockOptions = {}) {
  const W = opts.width ?? 1920;
  const H = opts.height ?? 1080;
  const fps = opts.fps ?? 25;
  const state = {
    hasProject: true,
    hasSequence: true,
    selection: [] as (VideoClipTrackItem | AudioClipTrackItem)[],
    transactions: [] as { label: string; actions: number; ok: boolean }[],
    /** Fait échouer la prochaine transaction dont le libellé contient ce texte. */
    failNext: "" as string,
    /** Position de la tête de lecture (s). */
    playhead: 0,
    /** Nombre d'appels à l'API (pour vérifier que le panneau inactif ne sollicite pas Premiere). */
    apiCalls: 0,
    /** Abonnés à SELECTION_CHANGED. */
    listeners: [] as (() => void)[],
    /** Marqueurs de séquence (s). */
    markers: [] as number[],
  };
  const sequence = {
    name: "Séquence 01",
    async getSelection() {
      state.apiCalls++;
      return { getTrackItems: async () => state.selection.slice() };
    },
    async getPlayerPosition() {
      return TickTime.createWithSeconds(state.playhead);
    },
    async getTimebase() {
      return String(TPS / fps);
    },
    async getFrameSize() {
      return { width: W, height: H };
    },
  };
  const project = {
    name: "Projet démo",
    async getActiveSequence() {
      state.apiCalls++;
      return state.hasSequence ? sequence : null;
    },
    lockedAccess(cb: () => void) {
      lockDepth++;
      try {
        cb();
      } finally {
        lockDepth--;
      }
    },
    executeTransaction(cb: (compound: { addAction(a: MockAction): boolean; empty: boolean }) => void, label = "") {
      const actions: MockAction[] = [];
      lockDepth++;
      try {
        cb({
          addAction: (a) => {
            actions.push(a);
            return true;
          },
          get empty() {
            return actions.length === 0;
          },
        });
      } finally {
        lockDepth--;
      }
      if (state.failNext && label.includes(state.failNext)) {
        state.failNext = "";
        state.transactions.push({ label, actions: actions.length, ok: false });
        return false;
      }
      for (const a of actions) a.run();
      state.transactions.push({ label, actions: actions.length, ok: true });
      return true;
    },
  };
  const ppro = {
    TickTime,
    PointF,
    Keyframe,
    VideoClipTrackItem,
    AudioClipTrackItem,
    Constants: {
      InterpolationMode: { BEZIER: 0, HOLD: 1, LINEAR: 2, TIME: 3, TIME_TRANSITION_END: 4, TIME_TRANSITION_START: 5 },
      SequenceEvent: { ACTIVATED: 0, CLOSED: 1, SELECTION_CHANGED: 2 },
    },
    EventManager: {
      addGlobalEventListener(evt: number, cb: () => void) {
        if (evt === 2) state.listeners.push(cb);
      },
      removeGlobalEventListener(_evt: number, cb: () => void) {
        state.listeners = state.listeners.filter((l) => l !== cb);
      },
    },
    Project: {
      async getActiveProject() {
        return state.hasProject ? project : null;
      },
    },
    VideoFilterFactory: {
      async getMatchNames() {
        return FILTERS.map((f) => f[0]);
      },
      async getDisplayNames() {
        return FILTERS.map((f) => f[1]);
      },
      async createComponent(name: string) {
        const f = FILTERS.find((x) => x[0] === name);
        if (!f) throw new Error(`Effet inconnu : ${name}`);
        return f[2]();
      },
    },
    TransitionFactory: {
      async getVideoTransitionMatchNames() {
        return MOCK_TRANSITIONS.slice();
      },
      createVideoTransition(matchName: string) {
        if (!MOCK_TRANSITIONS.includes(matchName)) throw new Error(`Transition inconnue : ${matchName}`);
        return { matchName };
      },
    },
    AddTransitionOptions() {
      const o = {
        applyToStart: false,
        duration: TickTime.createWithSeconds(1),
        setApplyToStart(v: boolean) {
          o.applyToStart = v;
          return o;
        },
        setDuration(t: TickTime) {
          o.duration = t;
          return o;
        },
      };
      return o;
    },
    Markers: {
      async getMarkers() {
        return { getMarkers: () => state.markers.map((m) => ({ getStart: () => TickTime.createWithSeconds(m) })) };
      },
    },
  };
  /** Simule un changement de sélection dans la timeline (déclenche l'événement). */
  const emitSelectionChanged = () => state.listeners.forEach((l) => l());
  return { ppro, state, project, sequence, fps, width: W, height: H, emitSelectionChanged };
}
