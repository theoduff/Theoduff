/**
 * Point d'entrée du plugin. Dans Premiere Pro, UXP appelle les callbacks du
 * panneau déclaré dans manifest.json ; dans le banc d'essai navigateur, le
 * panneau est monté directement.
 */
import { App } from "./ui/app";
import { getUxp } from "./premiere/host";

let app: App | null = null;

function mount(root: HTMLElement) {
  if (!app) {
    app = new App(root);
    app.mount();
  } else app.start();
}

interface Entrypoints {
  setup(config: unknown): void;
}

const uxp = getUxp() as { entrypoints?: Entrypoints } | null;
const rootEl = () => document.getElementById("app") ?? document.body;

if (uxp?.entrypoints) {
  uxp.entrypoints.setup({
    panels: {
      motioncraft: {
        show() {
          mount(rootEl());
        },
        hide() {
          app?.stop();
        },
        destroy() {
          app?.stop();
        },
      },
    },
  });
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => mount(rootEl()));
} else {
  mount(rootEl());
}
