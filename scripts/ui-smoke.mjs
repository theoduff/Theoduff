// Test de bout en bout de l'interface dans Chromium (banc d'essai + Premiere simulé).
// Produit des captures dans test-output/ et échoue au moindre problème.
import { chromium } from "playwright-core";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
execSync("node scripts/build.mjs --dev", { cwd: root, stdio: "ignore" });
const out = join(root, "test-output");
mkdirSync(out, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = "/opt/pw-browsers";
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((x) => x.startsWith("chromium-"))) {
      for (const p of ["chrome-linux/chrome", "chrome-linux64/chrome"]) if (existsSync(join(base, d, p))) return join(base, d, p);
    }
  }
  return undefined; // laisse playwright-core chercher un Chrome installé
}

const browser = await chromium.launch({ executablePath: findChromium(), channel: findChromium() ? undefined : "chrome" });
const errors = [];
const url = (q) => `${pathToFileURL(join(root, "dist/dev/index.html")).href}?${q}`;
let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? "✔" : "✕"} ${label}`);
  if (!cond) failures++;
};

async function open(query, viewport = { width: 1400, height: 820 }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url(query));
  await page.waitForSelector(".card");
  await page.waitForTimeout(400);
  return page;
}

// 1. Disposition large, un texte sélectionné, Smooth Pop
{
  const page = await open("sel=one&w=820");
  check((await page.locator(".card").count()) === 5, "5 cartes d'animation affichées");
  check((await page.textContent(".pill")).includes("1 texte sélectionné"), "pastille de sélection à jour");
  await page.hover(".card >> nth=1");
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(out, "01-wide-library.png") });
  await page.click(".card >> nth=0");
  await page.waitForTimeout(250);
  await page.click(".btn.apply");
  await page.waitForSelector(".toast.success", { timeout: 4000 });
  check(true, "Appliquer → notification de succès");
  await page.waitForTimeout(500);
  const log = await page.textContent("#log");
  check(log.includes("MotionCraft · Smooth Pop"), "transactions Premiere simulées écrites");
  await page.screenshot({ path: join(out, "02-wide-applied.png") });
  await page.close();
}

// 2. Recherche, catégories, favoris
{
  const page = await open("sel=one&w=820");
  await page.fill(".search-input", "flou");
  await page.waitForTimeout(150);
  check((await page.locator(".card").count()) === 1, "recherche « flou » → 1 résultat");
  await page.fill(".search-input", "zzz");
  check((await page.locator(".empty").count()) === 1, "état vide de recherche");
  await page.fill(".search-input", "");
  await page.hover(".card >> nth=4");
  await page.click(".card >> nth=4 >> .card-fav");
  await page.click(".chip:has-text('Favoris')");
  await page.waitForTimeout(150);
  check((await page.locator(".card").count()) === 1, "favori ajouté et filtré");
  await page.close();
}

// 3. Mot par mot avec 5 calques + panneau étroit
{
  const page = await open("sel=words&w=380");
  await page.screenshot({ path: join(out, "03-narrow-library.png") });
  await page.click(".card:has-text('Word by Word')");
  await page.waitForTimeout(500);
  check((await page.textContent(".notice")).includes("5 calques texte"), "notice multi-calques (5 mots)");
  check((await page.textContent(".btn.apply")).includes("Appliquer à 5 textes"), "bouton « Appliquer à 5 textes »");
  await page.screenshot({ path: join(out, "04-narrow-inspector.png") });
  await page.click(".btn.apply");
  await page.waitForSelector(".toast.success", { timeout: 4000 });
  check(true, "Word by Word appliqué à 5 calques");
  await page.close();
}

// 4. Aucun texte sélectionné : bouton désactivé
{
  const page = await open("sel=none&w=820");
  check(await page.locator(".btn.apply").isDisabled(), "bouton désactivé sans sélection");
  await page.click(".card:has-text('Blur Reveal')");
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, "05-wide-blur-noselection.png") });
  await page.close();
}

// 5. Réglages + diagnostic + 30 textes
{
  const page = await open("sel=thirty&w=820");
  await page.click(".card:has-text('Elastic Bounce')");
  await page.click(".btn.apply");
  await page.waitForSelector(".toast.success", { timeout: 6000 });
  check((await page.textContent(".toast.success")).includes("30 textes"), "30 textes animés en une fois");
  await page.click("button[title='Réglages']");
  await page.click("text=Inspecter la sélection");
  await page.waitForTimeout(300);
  check((await page.inputValue(".diag-out")).includes("AE.ADBE Motion"), "diagnostic de la sélection");
  await page.screenshot({ path: join(out, "06-settings.png") });
  await page.close();
}

// 6. Très étroit (280 px)
{
  const page = await open("sel=one&w=280", { width: 700, height: 760 });
  await page.screenshot({ path: join(out, "07-min-width.png") });
  await page.close();
}

await browser.close();
check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(" | ")}` : ""}`);
if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log(`\nInterface OK — captures dans ${out}`);
