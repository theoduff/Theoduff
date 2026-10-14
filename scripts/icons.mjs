// Génère les icônes de l'interface (une par couleur), en PNG.
//
// Pourquoi du PNG : le moteur de rendu de Premiere (UXP) affiche mal les SVG
// « au trait » (fill="none" + stroke) : il les remplit en noir. Les icônes sont
// donc rastérisées ici avec resvg, en 2× pour rester nettes sur écran Retina.
import { Resvg } from "@resvg/resvg-js";
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
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 48 }, background: "rgba(0,0,0,0)" }).render().asPng();
    writeFileSync(join(dir, `${name}-${color.slice(1).toUpperCase()}${filled ? "-f" : ""}.png`), png);
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

/** Icônes du manifeste (menu Fenêtre, liste des plugins) : PNG 1× et 2×. */
export function generateManifestIcons(root, outDir) {
  const out = [];
  for (const [src, base, size] of [
    ["plugin/icons/panel-dark.svg", "icons/panel-dark", 23],
    ["plugin/icons/panel-light.svg", "icons/panel-light", 23],
    ["plugin/icons/plugin.svg", "icons/plugin", 48],
  ]) {
    const svg = readFileSync(join(root, src), "utf8");
    for (const [suffix, scale] of [["", 1], ["@2x", 2]]) {
      const png = new Resvg(svg, { fitTo: { mode: "width", value: size * scale }, background: "rgba(0,0,0,0)" }).render().asPng();
      const file = join(outDir, `${base}${suffix}.png`);
      writeFileSync(file, png);
      out.push(file);
    }
  }
  return out;
}
