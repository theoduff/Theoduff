// Vérifie que dist/plugin est un plugin UXP Premiere Pro cohérent avant packaging.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "dist/plugin");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const errors = [];
const ok = (cond, msg) => {
  if (!cond) errors.push(msg);
};

ok(existsSync(join(dir, "manifest.json")), "manifest.json absent (lancez npm run build)");
const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
ok(m.manifestVersion === 5, "manifestVersion doit valoir 5");
ok(typeof m.id === "string" && /^[A-Za-z0-9._-]+$/.test(m.id), "id de plugin invalide");
ok(/^\d+\.\d+\.\d+$/.test(m.version), "version au format x.y.z requise");
ok(m.version === pkg.version, `version du manifest (${m.version}) ≠ package.json (${pkg.version})`);
const host = Array.isArray(m.host) ? m.host[0] : m.host;
ok(host?.app === "premierepro", "host.app doit être « premierepro »");
ok(/^\d+\.\d+(\.\d+)?$/.test(host?.minVersion ?? ""), "host.minVersion manquant");
ok(existsSync(join(dir, m.main)), `fichier principal ${m.main} absent`);
const panel = (m.entrypoints ?? []).find((e) => e.type === "panel");
ok(panel?.id === "motioncraft", "le panneau doit avoir l'id « motioncraft » (utilisé par src/main.ts)");
for (const icon of [...(m.icons ?? []), ...(m.entrypoints ?? []).flatMap((e) => e.icons ?? [])]) {
  ok(existsSync(join(dir, icon.path)), `icône manquante : ${icon.path}`);
}
const html = readFileSync(join(dir, m.main), "utf8");
for (const ref of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((x) => x[1])) {
  ok(existsSync(join(dir, ref)), `ressource référencée par index.html absente : ${ref}`);
}
const js = readFileSync(join(dir, "main.js"), "utf8");
ok(!/^\s*(import|export)\s/m.test(js), "main.js ne doit pas contenir de syntaxe de module ES (UXP charge un script classique)");
ok(!js.includes("mock-premierepro") && !js.includes("Simulateur Premiere"), "le simulateur ne doit pas être inclus dans le plugin");
ok(statSync(join(dir, "main.js")).size < 1_000_000, "main.js anormalement volumineux");

if (errors.length) {
  console.error("✕ Plugin invalide :\n  - " + errors.join("\n  - "));
  process.exit(1);
}
console.log(`✔ Plugin valide : ${m.name} ${m.version} (Premiere Pro ≥ ${host.minVersion}, id ${m.id})`);
