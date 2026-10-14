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

const apiCalls = (page) => page.evaluate(() => window.__mock?.state.apiCalls ?? -1);

// 1. Grand panneau (barre latérale), un clip sélectionné
{
  const page = await open("sel=one&w=1100", { width: 1500, height: 860 });
  const total = await page.locator(".card").count();
  check(total >= 20, `${total} animations affichées`);
  check((await page.textContent(".pill")).includes("1 clip sélectionné"), "pastille de sélection à jour");
  check(await page.locator(".rail").isVisible(), "rail de catégories visible");
  await page.hover(".card >> nth=1");
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(out, "01-full-library.png") });
  await page.click(".card >> nth=0 >> .card-title");
  await page.click(".ab-btn:has-text('Entrée') >> nth=0");
  await page.waitForSelector(".toast.success", { timeout: 4000 });
  check(true, "Appliquer → notification de succès");
  await page.waitForTimeout(500);
  check((await page.textContent("#log")).includes("MotionCraft · Smooth Pop"), "transactions Premiere simulées écrites");
  await page.close();
}

// 2. Effets vidéo : navigation, application en un clic depuis la vignette, tête de lecture
{
  const page = await open("sel=one&w=1100", { width: 1500, height: 860 });
  await page.click(".rail-btn[data-filter='family:video']");
  await page.waitForTimeout(200);
  const n = await page.locator(".card").count();
  check(n >= 13, `${n} effets vidéo`);
  await page.click(".card:has-text('Zoom Punch') .card-title");
  check(await page.locator(".ab-btn:has-text('tête de lecture')").isVisible(), "bouton « Appliquer à la tête de lecture »");
  await page.hover(".card:has-text('Camera Shake')");
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(out, "02-video-effects.png") });
  await page.click(".card:has-text('Camera Shake') >> .card-apply");
  await page.waitForSelector(".toast.success", { timeout: 4000 });
  check(true, "application en un clic depuis la vignette");
  await page.click(".rail-btn[data-filter='camera']");
  await page.click(".card:has-text('Ken Burns') .card-title");
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, "03-video-inspector.png") });
  await page.close();
}

// 3. Sens global Entrée / Sortie
{
  const page = await open("sel=one&w=1100", { width: 1500, height: 860 });
  await page.click(".rail-btn[data-filter='family:text']");
  await page.click(".card:has-text('Slide Up') .card-title");
  await page.click(".ab-btn:has-text('Sortie')");
  await page.waitForSelector(".toast.success", { timeout: 4000 });
  await page.waitForTimeout(200);
  check((await page.locator(".kind-badge:has-text('Sortie')").count()) >= 5, "vignettes passées en « Sortie »");
  await page.screenshot({ path: join(out, "03b-text-out.png") });
  await page.close();
}

// 4. Recherche & favoris
{
  const page = await open("sel=one&w=820");
  await page.fill(".search-input", "secousse");
  await page.waitForTimeout(150);
  check((await page.locator(".card").count()) >= 1, "recherche « secousse »");
  await page.fill(".search-input", "zzz");
  check((await page.locator(".empty").count()) === 1, "état vide de recherche");
  await page.fill(".search-input", "");
  await page.hover(".card >> nth=4");
  await page.click(".card >> nth=4 >> .card-fav");
  await page.click(".rail-btn[data-filter='favorites']");
  await page.waitForTimeout(150);
  check((await page.locator(".card").count()) === 1, "favori ajouté et filtré");
  await page.screenshot({ path: join(out, "04-wide-favorites.png") });
  await page.close();
}

// 5. Mot par mot (5 calques) + panneau étroit
{
  const page = await open("sel=words&w=380");
  await page.screenshot({ path: join(out, "05-narrow-library.png") });
  await page.click(".card:has-text('Word by Word') .card-title");
  await page.waitForTimeout(500);
  check((await page.textContent(".notice")).includes("5 calques texte"), "notice multi-calques (5 mots)");
  check((await page.textContent(".ab-status")).includes("5 clips"), "barre d'action : 5 clips");
  await page.screenshot({ path: join(out, "06-narrow-inspector.png") });
  await page.click(".ab-btn:has-text('Entrée') >> nth=0");
  await page.waitForSelector(".toast.success", { timeout: 4000 });
  check(true, "Word by Word appliqué à 5 calques");
  await page.close();
}

// 6. Sobriété : panneau ouvert sans rien faire → aucun appel à Premiere, aucune animation en cours
{
  const page = await open("sel=one&w=1100", { width: 1500, height: 860 });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1500);
  const before = await apiCalls(page);
  await page.waitForTimeout(8000);
  const after = await apiCalls(page);
  check(after === before, `aucun appel API pendant 8 s d'inactivité (${before} → ${after})`);
  const moving = await page.evaluate(async () => {
    const snap = () => [...document.querySelectorAll(".pv-text, .pv-scene")].map((e) => e.getAttribute("style")).join("|");
    const a = snap();
    await new Promise((r) => setTimeout(r, 600));
    return a !== snap();
  });
  check(!moving, "aucun aperçu ne tourne en continu une fois inactif");
  await page.close();
}

// 7. Aucun clip sélectionné, réglages, diagnostic, 30 clips
{
  const page = await open("sel=none&w=820");
  check((await page.locator(".ab-btn.disabled").count()) >= 1, "boutons d'action grisés sans sélection");
  await page.close();
  const p2 = await open("sel=thirty&w=820");
  await p2.click(".rail-btn[data-filter='family:video']");
  await p2.click(".card:has-text('Push-in lent') .card-title");
  await p2.click(".ab-btn:has-text('tout le clip')");
  await p2.waitForSelector(".toast.success", { timeout: 8000 });
  check((await p2.textContent(".toast.success")).includes("30 clips"), "30 clips animés en une fois");
  await p2.click("button[title='Réglages']");
  await p2.click("text=Inspecter la sélection");
  await p2.waitForTimeout(300);
  check((await p2.inputValue(".diag-out")).includes("AE.ADBE Motion"), "diagnostic de la sélection");
  await p2.screenshot({ path: join(out, "07-settings.png") });
  await p2.close();
}

// 8. Très étroit (280 px)
{
  const page = await open("sel=one&w=280", { width: 700, height: 760 });
  await page.screenshot({ path: join(out, "08-min-width.png") });
  await page.close();
}

await browser.close();
check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ` : ${errors.join(" | ")}` : ""}`);
if (failures) {
  console.error(`\n${failures} vérification(s) en échec.`);
  process.exit(1);
}
console.log(`\nInterface OK — captures dans ${out}`);
