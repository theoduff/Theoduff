/**
 * Persistance locale (localStorage, disponible dans UXP). Toutes les lectures /
 * écritures sont protégées : le plugin fonctionne même si le stockage échoue.
 */
const PREFIX = "motioncraft.v1.";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* stockage plein ou indisponible : on ignore */
  }
}
