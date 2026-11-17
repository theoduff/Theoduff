/*
 * Moteur de rendu : chaque appel crée un calque (pixels + infos vectorielles/texte)
 * qui sera écrit dans le PSD par generate.js (ag-psd).
 */
const FONTS = {
  titre:   { css: "400 {s}px 'Playfair Display'", ps: "PlayfairDisplay-Regular" },
  titreIt: { css: "italic 400 {s}px 'Playfair Display'", ps: "PlayfairDisplay-Italic" },
  texte:   { css: "400 {s}px 'Quicksand'", ps: "Quicksand-Regular" },
  medium:  { css: "500 {s}px 'Quicksand'", ps: "Quicksand-Medium" },
  gras:    { css: "700 {s}px 'Quicksand'", ps: "Quicksand-Bold" },
  uiLight: { css: "300 {s}px 'Inter'", ps: "Inter-Light" },
  ui:      { css: "400 {s}px 'Inter'", ps: "Inter-Regular" },
  uiBold:  { css: "600 {s}px 'Inter'", ps: "Inter-SemiBold" }
};

const hexRgb = h => { h = h.replace("#", ""); return { r: parseInt(h.substr(0, 2), 16), g: parseInt(h.substr(2, 2), 16), b: parseInt(h.substr(4, 2), 16) }; };

function path2d(subpaths) {
  const p = new Path2D();
  subpaths.forEach(pts => {
    p.moveTo(pts[0].a[0], pts[0].a[1]);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      p.bezierCurveTo(a.r[0], a.r[1], b.l[0], b.l[1], b.a[0], b.a[1]);
    }
    p.closePath();
  });
  return p;
}
const knots = subpaths => subpaths.map(pts => ({
  open: false, operation: "combine", fillRule: "non-zero",
  knots: pts.map(q => ({ linked: false, points: [q.l[0], q.l[1], q.a[0], q.a[1], q.r[0], q.r[1]] }))
}));
const P = (x, y) => ({ a: [x, y], l: [x, y], r: [x, y] });
const poly = pts => pts.map(p => P(p[0], p[1]));
function star5(cx, cy, R) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.45 : R;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

const IMG = {};
function loadImg(src) {
  if (IMG[src]) return Promise.resolve(IMG[src]);
  return new Promise(res => { const i = new Image(); i.onload = () => { IMG[src] = i; res(i); }; i.onerror = () => res(null); i.src = src; });
}

function grab(cv) {
  const ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  const d = ctx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, crop = ctx.getImageData(x0, y0, w, h).data;
  let s = ""; const CH = 0x8000;
  for (let i = 0; i < crop.length; i += CH) s += String.fromCharCode.apply(null, crop.subarray(i, i + CH));
  return { left: x0, top: y0, width: w, height: h, b64: btoa(s) };
}

const measureCtx = document.createElement("canvas").getContext("2d");
function setFont(ctx, role, size, tracking) {
  ctx.font = FONTS[role].css.replace("{s}", size);
  ctx.letterSpacing = ((tracking || 0) / 1000 * size) + "px";
}
function nbsp(str) { return str.replace(/« /g, "«\u00A0").replace(/ »/g, "\u00A0»").replace(/ ([?!:;%])/g, "\u00A0$1"); }
function wrap(str, role, size, tracking, maxW) {
  str = nbsp(str);
  setFont(measureCtx, role, size, tracking);
  const out = [];
  str.split("\n").forEach(par => {
    let line = "";
    par.split(" ").forEach(word => {
      const t = line ? line + " " + word : word;
      if (maxW && measureCtx.measureText(t).width > maxW && line) { out.push(line); line = word; }
      else line = t;
    });
    out.push(line);
  });
  return out;
}
function textWidth(str, role, size, tracking) { setFont(measureCtx, role, size, tracking); return measureCtx.measureText(str).width; }

class Visual {
  constructor(name, W, H) {
    this.name = name; this.W = W; this.H = H; this.tree = []; this.group = null;
    this.comp = document.createElement("canvas"); this.comp.width = W; this.comp.height = H;
  }
  g(name, hidden) { this.group = { name, children: [], hidden: !!hidden }; this.tree.push(this.group); return this; }
  _layer(name, draw, o = {}) {
    const cv = document.createElement("canvas"); cv.width = this.W; cv.height = this.H;
    const ctx = cv.getContext("2d");
    draw(ctx);
    const L = Object.assign({ name, opacity: o.opacity == null ? 1 : o.opacity, hidden: !!o.hidden }, o.psd || {});
    L.pixels = grab(cv);
    this.group.children.push(L);
    if (!L.hidden && !this.group.hidden) {
      const c = this.comp.getContext("2d"); c.globalAlpha = L.opacity; c.drawImage(cv, 0, 0); c.globalAlpha = 1;
    }
    return L;
  }
  fill(name, hex) {
    return this._layer(name, ctx => { ctx.fillStyle = hex; ctx.fillRect(0, 0, this.W, this.H); },
      { psd: { vectorFill: { type: "color", color: hexRgb(hex) } } });
  }
  shape(name, hex, sub, o = {}) {
    return this._layer(name, ctx => { ctx.fillStyle = hex; ctx.fill(path2d(sub)); },
      Object.assign({}, o, { psd: { vectorFill: { type: "color", color: hexRgb(hex) }, vectorMask: { paths: knots(sub) } } }));
  }
  outline(name, hex, width, sub, o = {}) {
    return this._layer(name, ctx => { ctx.strokeStyle = hex; ctx.lineWidth = width; ctx.stroke(path2d(sub)); },
      Object.assign({}, o, { psd: {
        vectorFill: { type: "color", color: hexRgb(hex) }, vectorMask: { paths: knots(sub) },
        vectorStroke: { strokeEnabled: true, fillEnabled: false, lineWidth: { units: "Pixels", value: width },
          lineAlignment: "center", lineCapType: "butt", lineJoinType: "miter", opacity: 1, content: { type: "color", color: hexRgb(hex) } } } }));
  }
  rect(name, hex, x, y, w, h, r = 0, o) { return this.shape(name, hex, [MDLL.pathRoundRect(x, y, w, h, r || 0.01)], o); }
  circle(name, hex, cx, cy, r, o) { return this.shape(name, hex, [MDLL.pathCircle(cx, cy, r)], o); }
  soft(name, hex, cx, cy, rx, ry, blur, opacity) {
    return this._layer(name, ctx => {
      ctx.filter = `blur(${blur}px)`; ctx.fillStyle = hex;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.filter = "none";
    }, { opacity });
  }
  gradient(name, x0, y0, x1, y1, stops, o = {}) {
    return this._layer(name, ctx => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      stops.forEach(s => g.addColorStop(s[0], s[1]));
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    }, o);
  }
  /* Texte : y = ligne de base de la 1re ligne. o = {align, tracking, opacity, lh, maxW} */
  text(name, str, x, y, role, size, hex, o = {}) {
    const align = o.align || "center", tracking = o.tracking || 0, lh = o.lh || Math.round(size * 1.25);
    const lines = wrap(str, role, size, tracking, o.maxW);
    const spacing = tracking / 1000 * size;
    const L = this._layer(name, ctx => {
      setFont(ctx, role, size, tracking);
      ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillStyle = hex;
      lines.forEach((ln, i) => ctx.fillText(ln, x + (align === "center" ? spacing / 2 : 0), y + i * lh));
    }, { opacity: o.opacity, hidden: o.hidden, psd: { text: {
      text: lines.join("\n"), transform: [1, 0, 0, 1, x, y], antiAlias: "smooth",
      style: { font: { name: FONTS[role].ps }, fontSize: size, fillColor: hexRgb(hex), tracking,
               autoKerning: true, autoLeading: lines.length < 2, leading: lh },
      paragraphStyle: { justification: align } } } });
    L.lines = lines.length; L.bottom = y + (lines.length - 1) * lh;
    return L;
  }
  async image(name, src, cx, cy, maxW, maxH, o = {}) {
    const img = await loadImg(src);
    return this._layer(name, ctx => {
      if (!img) return;
      const k = Math.min(maxW / img.width, maxH / img.height), w = img.width * k, h = img.height * k;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      if (o.tint) { ctx.globalCompositeOperation = "source-in"; ctx.fillStyle = o.tint; ctx.fillRect(0, 0, this.W, this.H); ctx.globalCompositeOperation = "source-over"; }
    }, o);
  }
  /* Emplacement photo/vidéo à remplacer */
  placeholder(name, x, y, w, h, r, hex, label, labelHex) {
    this.rect(name, hex, x, y, w, h, r);
    this.text(name + " — légende (à supprimer)", label, x + w / 2, y + h / 2, "gras", 26, labelHex || "#FFFFFF", { tracking: 150, opacity: 0.7, maxW: w - 80, lh: 36 });
  }
  /* Repère masqué : zone réservée à un sticker Instagram */
  zone(label, x, y, w, h) {
    const keep = this.group;
    if (!this.tree.find(t => t.name.startsWith("00 · REPÈRES"))) this.tree.push({ name: "00 · REPÈRES (masqués) — zones stickers Instagram", children: [], hidden: true });
    this.group = this.tree.find(t => t.name.startsWith("00 · REPÈRES"));
    this._layer("Zone — " + label, ctx => {
      ctx.setLineDash([16, 12]); ctx.lineWidth = 4; ctx.strokeStyle = "#FF2D7A";
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 28); ctx.stroke();
      ctx.font = "700 28px Quicksand"; ctx.fillStyle = "#FF2D7A"; ctx.textAlign = "center";
      ctx.fillText(label.toUpperCase(), x + w / 2, y + h / 2 + 10);
    });
    this.group = keep;
  }
  result() {
    // Repères tout en haut de la pile
    const rep = this.tree.filter(t => t.name.startsWith("00 · REPÈRES")), rest = this.tree.filter(t => !t.name.startsWith("00 · REPÈRES"));
    return { name: this.name, width: this.W, height: this.H, tree: rest.concat(rep),
             composite: grab(this.comp), jpg: this.comp.toDataURL("image/jpeg", 0.9) };
  }
}
