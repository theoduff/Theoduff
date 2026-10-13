/** Contrôles de formulaire sur mesure (curseur, segments, interrupteur, liste). */
import type { ChoiceParam, NumberParam } from "../engine/types";
import { cx, formatNumber, h } from "./dom";
import { icon } from "./icons";

const UNIT_LABEL: Record<string, string> = { s: " s", "%": " %", px: " px", "°": "°", "": "" };

export interface SliderHandle {
  el: HTMLElement;
  set(value: number): void;
}

/**
 * Curseur : glisser, clic sur la piste, flèches du clavier (Maj = ×10),
 * double-clic pour revenir à la valeur par défaut, saisie directe de la valeur.
 */
export function slider(spec: NumberParam, value: number, onChange: (v: number, final: boolean) => void): SliderHandle {
  let current = value;
  const fill = h("div", { class: "sl-fill" });
  const thumb = h("div", { class: "sl-thumb" });
  const track = h("div", { class: "sl-track" }, fill, thumb);
  const valueBtn = h("button", { class: "sl-value", type: "button", title: "Cliquer pour saisir une valeur" });
  const label = h("div", { class: "sl-label" }, h("span", null, spec.label), valueBtn);
  const root = h("div", { class: "control slider", tabIndex: 0, title: spec.hint ?? "" }, label, track);
  if (spec.hint) root.appendChild(h("div", { class: "control-hint" }, spec.hint));

  const precision = spec.precision ?? (spec.step < 1 ? 2 : 0);
  const snap = (v: number) => {
    const stepped = Math.round((v - spec.min) / spec.step) * spec.step + spec.min;
    return Math.min(spec.max, Math.max(spec.min, Number(stepped.toFixed(6))));
  };
  const render = () => {
    const f = (current - spec.min) / (spec.max - spec.min || 1);
    const pct = `${(Math.max(0, Math.min(1, f)) * 100).toFixed(2)}%`;
    fill.style.width = pct;
    thumb.style.left = pct;
    valueBtn.textContent = `${formatNumber(current, precision)}${UNIT_LABEL[spec.unit ?? ""] ?? ""}`;
  };
  const commit = (v: number, final: boolean) => {
    const nv = snap(v);
    if (nv === current && !final) return;
    current = nv;
    render();
    onChange(current, final);
  };
  const fromEvent = (e: MouseEvent) => {
    const r = track.getBoundingClientRect();
    return spec.min + ((e.clientX - r.left) / (r.width || 1)) * (spec.max - spec.min);
  };
  track.addEventListener("mousedown", (e: MouseEvent) => {
    e.preventDefault();
    root.classList.add("dragging");
    commit(fromEvent(e), false);
    const move = (ev: MouseEvent) => commit(fromEvent(ev), false);
    const up = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      root.classList.remove("dragging");
      commit(fromEvent(ev), true);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
  track.addEventListener("dblclick", () => commit(spec.default, true));
  root.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.target as HTMLElement) !== root) return;
    const mult = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      commit(current + spec.step * mult, true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      commit(current - spec.step * mult, true);
    } else if (e.key === "Home") commit(spec.min, true);
    else if (e.key === "End") commit(spec.max, true);
  });
  valueBtn.addEventListener("click", () => {
    const input = h("input", {
      class: "sl-input",
      type: "number",
      value: String(current),
      min: String(spec.min),
      max: String(spec.max),
      step: String(spec.step),
    });
    const done = (apply: boolean) => {
      if (apply) {
        const v = parseFloat(String(input.value).replace(",", "."));
        if (Number.isFinite(v)) commit(v, true);
      }
      if (input.parentNode) input.parentNode.replaceChild(valueBtn, input);
      render();
    };
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") done(true);
      if (e.key === "Escape") done(false);
    });
    input.addEventListener("blur", () => done(true));
    valueBtn.parentNode?.replaceChild(input, valueBtn);
    input.focus();
    input.select?.();
  });
  render();
  return {
    el: root,
    set(v: number) {
      current = snap(v);
      render();
    },
  };
}

/** Contrôle segmenté (2 à 4 options). */
export function segmented<T extends string>(
  options: { value: T; label: string }[],
  value: T,
  onChange: (v: T) => void,
  label?: string,
): HTMLElement {
  const buttons = options.map((o) =>
    h(
      "button",
      {
        type: "button",
        class: cx("seg-btn", o.value === value && "active"),
        onclick: () => {
          buttons.forEach((b, i) => b.classList.toggle("active", options[i].value === o.value));
          onChange(o.value);
        },
      },
      o.label,
    ),
  );
  return h("div", { class: "control" }, label ? h("div", { class: "control-label" }, label) : null, h("div", { class: "segmented" }, buttons));
}

/** Liste déroulante native (rendu Spectrum dans Premiere), habillée. */
export function select(spec: Pick<ChoiceParam, "label" | "options" | "hint">, value: string, onChange: (v: string) => void): HTMLElement {
  const sel = h(
    "select",
    { class: "select", onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
    spec.options.map((o) => h("option", { value: o.value, selected: o.value === value }, o.label)),
  );
  sel.value = value;
  return h(
    "label",
    { class: "control", title: spec.hint ?? "" },
    h("div", { class: "control-label" }, spec.label),
    h("div", { class: "select-wrap" }, sel, icon("chevronDown", "#6E727C", 14)),
  );
}

/** Choix adaptatif : segments si les libellés sont courts, liste sinon. */
export function choice(spec: ChoiceParam, value: string, onChange: (v: string) => void): HTMLElement {
  const short = spec.options.length <= 3 && spec.options.every((o) => o.label.length <= 14);
  return short ? segmented(spec.options, value, onChange, spec.label) : select(spec, value, onChange);
}

/** Interrupteur on/off. */
export function toggle(label: string, value: boolean, onChange: (v: boolean) => void, hint?: string): HTMLElement {
  let on = value;
  const sw = h("button", { type: "button", class: cx("switch", on && "on"), role: "switch", "aria-checked": String(on) }, h("span", { class: "switch-knob" }));
  sw.addEventListener("click", () => {
    on = !on;
    sw.classList.toggle("on", on);
    sw.setAttribute("aria-checked", String(on));
    onChange(on);
  });
  return h(
    "div",
    { class: "control toggle-row" },
    h("div", { class: "toggle-text" }, h("div", { class: "control-label" }, label), hint ? h("div", { class: "control-hint" }, hint) : null),
    sw,
  );
}

export function textField(label: string, value: string, placeholder: string, onChange: (v: string) => void, maxLength = 40): HTMLElement {
  const input = h("input", {
    class: "text-input",
    type: "text",
    value,
    placeholder,
    maxLength,
    oninput: (e: Event) => onChange((e.target as HTMLInputElement).value),
  });
  return h("label", { class: "control" }, h("div", { class: "control-label" }, label), input);
}
