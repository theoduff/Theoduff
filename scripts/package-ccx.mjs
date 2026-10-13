// Crée release/MotionCraftPro-<version>.ccx : une archive ZIP du dossier du plugin
// (manifest.json à la racine), le format installable par Creative Cloud / UPIA.
import { zipSync } from "fflate";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "dist/plugin");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

const files = {};
const walk = (d) => {
  for (const name of readdirSync(d).sort()) {
    if (name.startsWith(".")) continue;
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else files[relative(dir, p).split("\\").join("/")] = [readFileSync(p), { level: 9, mtime: new Date("2026-01-01T00:00:00Z") }];
  }
};
walk(dir);

const zip = zipSync(files);
const outDir = join(root, "release");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `MotionCraftPro-${manifest.version}.ccx`);
writeFileSync(out, zip);
const sha = createHash("sha256").update(zip).digest("hex");
writeFileSync(`${out}.sha256`, `${sha}  MotionCraftPro-${manifest.version}.ccx\n`);
console.log(`✔ ${relative(root, out)} (${(zip.length / 1024).toFixed(1)} Ko, ${Object.keys(files).length} fichiers)\n  sha256 ${sha}`);
