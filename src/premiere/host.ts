/**
 * Accès au module hôte `premierepro`.
 *
 * Dans Premiere Pro, UXP fournit `require("premierepro")`. Dans le banc d'essai
 * navigateur (npm run dev) et dans les tests, un module simulé est injecté via
 * `globalThis.require`. Le code applicatif ne fait jamais la différence.
 */
import type { premierepro } from "@adobe/premierepro";

declare const require: ((id: string) => unknown) | undefined;

let cached: premierepro | null | undefined;

export function getPpro(): premierepro | null {
  if (cached !== undefined) return cached;
  try {
    const req =
      typeof require === "function"
        ? require
        : ((globalThis as unknown as { require?: (id: string) => unknown }).require ?? null);
    cached = req ? ((req("premierepro") as premierepro) ?? null) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Réservé aux tests : force un module hôte (ou null). */
export function setPproForTests(mod: premierepro | null | undefined) {
  cached = mod;
}

export function getUxp(): unknown {
  try {
    const req =
      typeof require === "function"
        ? require
        : ((globalThis as unknown as { require?: (id: string) => unknown }).require ?? null);
    return req ? req("uxp") : null;
  } catch {
    return null;
  }
}

/** Erreur destinée à être affichée telle quelle à l'utilisateur. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}
