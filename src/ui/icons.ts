/**
 * Icônes (tracés inspirés de Lucide, licence ISC).
 *
 * Premiere (UXP) n'affiche pas les SVG insérés directement dans le HTML : les
 * icônes sont donc des fichiers .svg générés au build (scripts/build.mjs), un
 * par couleur, et affichés avec <img>.
 */
import data from "./icon-data.json";

export type IconName = keyof typeof data.paths | string;

const BASE = new Set(data.baseColors.map((c) => c.toUpperCase()));
const CATEGORY = data.categoryColors as Record<string, string>;
const FILLED = new Set(data.filled);

/** Nom du fichier généré pour une icône (doit correspondre à scripts/build.mjs). */
export function iconFile(name: string, color: string, filled = false): string {
  const hex = color.toUpperCase();
  const known = BASE.has(hex) || CATEGORY[name]?.toUpperCase() === hex;
  const c = (known ? hex : "#A7ABB4").slice(1);
  const f = filled && FILLED.has(name) ? "-f" : "";
  const n = name in data.paths ? name : "info";
  return `icons/ui/${n}-${c}${f}.svg`;
}

export function icon(name: IconName, color = "#A7ABB4", size = 16, filled = false): HTMLElement {
  const span = document.createElement("span");
  span.className = "icon";
  const img = document.createElement("img");
  img.src = iconFile(String(name), color, filled);
  img.width = size;
  img.height = size;
  img.alt = "";
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  span.appendChild(img);
  return span;
}
