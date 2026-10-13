/** Mini-helpers DOM (pas de framework : léger, rapide et 100 % compatible UXP). */

export type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & {
  class?: string;
  style?: Partial<Record<string, string | number>>;
  html?: string;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") el.className = String(v);
      else if (k === "style") Object.assign(el.style, v as object);
      else if (k === "html") el.innerHTML = String(v);
      else if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k in el && !k.startsWith("data-") && !k.startsWith("aria-") && k !== "role") {
        (el as unknown as Record<string, unknown>)[k] = v;
      } else el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  append(el, children);
  return el;
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: Node) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function replaceChildren(el: Node, ...children: Child[]) {
  clear(el);
  append(el, children);
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** Formate un nombre selon la précision d'un paramètre. */
export function formatNumber(v: number, precision = 0) {
  const s = v.toFixed(precision);
  return precision > 0 ? s.replace(".", ",") : s;
}

export const raf: (cb: (t: number) => void) => unknown =
  typeof requestAnimationFrame === "function"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(Date.now()), 16);

export const now = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
