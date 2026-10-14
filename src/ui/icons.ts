/**
 * Icônes (tracés inspirés de Lucide, licence ISC).
 *
 * Premiere (UXP) n'affiche ni le SVG en ligne, ni correctement les SVG « au
 * trait » (remplis en noir). Les icônes sont donc des PNG générés au build
 * (scripts/icons.mjs), un par couleur, en 2×, affichés avec <img>.
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
  return `icons/ui/${n}-${c}${f}.png`;
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
