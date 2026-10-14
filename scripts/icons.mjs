// Génère les icônes SVG (une par couleur) utilisées par l'interface.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function generateIcons(root, outDir) {
  const data = JSON.parse(readFileSync(join(root, "src/ui/icon-data.json"), "utf8"));
  const dir = join(outDir, "icons/ui");
  mkdirSync(dir, { recursive: true });
  const write = (name, color, filled) => {
    const body = data.paths[name];
    const fill = filled ? color : "none";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
    writeFileSync(join(dir, `${name}-${color.slice(1).toUpperCase()}${filled ? "-f" : ""}.svg`), svg);
  };
  let n = 0;
  for (const name of Object.keys(data.paths)) {
    for (const c of data.baseColors) {
      write(name, c, false);
      n++;
      if (data.filled.includes(name)) {
        write(name, c, true);
        n++;
      }
    }
  }
  for (const [cat, color] of Object.entries(data.categoryColors)) {
    if (data.paths[cat]) {
      write(cat, color, false);
      n++;
    }
  }
  return n;
}
