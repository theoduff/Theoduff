// Build du plugin UXP (dist/plugin) et du banc d'essai navigateur (dist/dev).
//   node scripts/build.mjs           → build de production
//   node scripts/build.mjs --watch   → reconstruction continue (à charger dans UXP Developer Tool)
//   node scripts/build.mjs --dev --serve → banc d'essai sur http://localhost:5173
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateIcons, generateManifestIcons } from "./icons.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const dev = args.has("--dev");
const serve = args.has("--serve");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const pluginOut = join(root, "dist/plugin");
const devOut = join(root, "dist/dev");

const banner = `/* MotionCraft Pro ${pkg.version} — plugin UXP pour Adobe Premiere Pro */`;

/** Copie les fichiers statiques (manifest, HTML, icônes, CSS). */
function copyStatic(outDir, { harness = false } = {}) {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(root, "plugin"), outDir, { recursive: true });
  cpSync(join(root, "src/styles/main.css"), join(outDir, "styles.css"));
  generateIcons(root, outDir);
  generateManifestIcons(root, outDir);
  if (harness) cpSync(join(root, "dev/index.html"), join(outDir, "index.html"));
}

const common = {
  bundle: true,
  format: "iife",
  target: ["es2020"],
  platform: "browser",
  charset: "utf8",
  legalComments: "none",
  logLevel: "info",
  banner: { js: banner },
  // Modules fournis par l'hôte UXP à l'exécution.
  external: ["premierepro", "uxp"],
};

const copyOnRebuild = (outDir, opts) => ({
  name: "copy-static",
  setup(build) {
    build.onEnd(() => copyStatic(outDir, opts));
  },
});

if (!dev) {
  rmSync(pluginOut, { recursive: true, force: true });
  const ctx = await esbuild.context({
    ...common,
    entryPoints: [join(root, "src/main.ts")],
    outfile: join(pluginOut, "main.js"),
    minify: !watch,
    sourcemap: watch ? "inline" : false,
    plugins: [copyOnRebuild(pluginOut)],
  });
  if (watch) {
    await ctx.watch();
    console.log(`\n▶ Surveillance active : chargez ${pluginOut}/manifest.json dans UXP Developer Tool (Load, puis Watch).`);
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    const manifest = JSON.parse(readFileSync(join(pluginOut, "manifest.json"), "utf8"));
    if (manifest.version !== pkg.version) {
      manifest.version = pkg.version;
      writeFileSync(join(pluginOut, "manifest.json"), JSON.stringify(manifest, null, 2));
    }
    console.log(`✔ Plugin construit dans ${pluginOut}`);
  }
}

if (dev) {
  rmSync(devOut, { recursive: true, force: true });
  const ctx = await esbuild.context({
    ...common,
    entryPoints: [join(root, "dev/main.ts")],
    outfile: join(devOut, "main.js"),
    sourcemap: "inline",
    plugins: [copyOnRebuild(devOut, { harness: true })],
  });
  if (serve) {
    await ctx.watch();
    const { port } = await ctx.serve({ servedir: devOut, port: 5173 });
    console.log(`\n▶ Banc d'essai : http://localhost:${port}`);
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log(`✔ Banc d'essai construit dans ${devOut}`);
  }
}
