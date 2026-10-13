/** Presets utilisateur : un nom + une animation + ses réglages + le mode. */
import type { AnimationMode, ParamValues } from "../engine/types";

export interface UserPreset {
  id: string;
  name: string;
  animationId: string;
  params: ParamValues;
  mode: AnimationMode;
  createdAt: number;
}

export interface PresetFile {
  format: "motioncraft-presets";
  version: 1;
  presets: UserPreset[];
}

export const makePresetId = () => `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function exportPresets(presets: UserPreset[]): string {
  const file: PresetFile = { format: "motioncraft-presets", version: 1, presets };
  return JSON.stringify(file, null, 2);
}

/** Valide un fichier importé ; renvoie les presets valides (avec de nouveaux identifiants). */
export function importPresets(json: string, knownAnimationIds: string[]): UserPreset[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Fichier illisible : ce n'est pas un JSON valide.");
  }
  const file = data as Partial<PresetFile>;
  if (!file || file.format !== "motioncraft-presets" || !Array.isArray(file.presets)) {
    throw new Error("Ce fichier n'est pas un export de presets MotionCraft.");
  }
  const out: UserPreset[] = [];
  for (const p of file.presets) {
    if (!p || typeof p.name !== "string" || !knownAnimationIds.includes(p.animationId)) continue;
    const mode: AnimationMode = p.mode === "out" || p.mode === "inOut" ? p.mode : "in";
    out.push({
      id: makePresetId(),
      name: p.name.slice(0, 60),
      animationId: p.animationId,
      params: typeof p.params === "object" && p.params ? p.params : {},
      mode,
      createdAt: Date.now(),
    });
  }
  return out;
}
