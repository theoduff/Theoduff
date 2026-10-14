"""Rendu image : rampes de vitesse, zooms, étalonnage, effet « potion magique », titrages.

Usage : python3 render_video.py SOURCE.mov MASKS.npy OUT.mp4
Les images sont envoyées brutes à ffmpeg (sans son ; le mix est ajouté ensuite).
"""
import sys
import subprocess
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from timeline import FPS, DUR, BEAT, T_DROP, T_LOGO, T_END, src_time

SRC, MASKS, OUT = sys.argv[1:4]
W, H = 720, 1280
FONT = "/usr/share/fonts/opentype/inter/"
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- sources
cap = cv2.VideoCapture(SRC)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
N = len(frames)
masks = np.load(MASKS)  # (N, 640, 360) uint8

# Position de la tête (pour cadrer le zoom), lissée dans le temps
head = np.zeros((N, 2), np.float32)
body = np.zeros((N, 2), np.float32)
for i in range(N):
    m = masks[i] > 128
    rows = np.where(m.any(1))[0]
    if len(rows) < 20:
        head[i] = head[i - 1] if i else (180, 150)
        body[i] = body[i - 1] if i else (180, 320)
        continue
    top = rows[0]
    hx = np.where(m[top:top + 45].any(0))[0]
    head[i] = (hx.mean(), top + 35)
    ys, xs = np.nonzero(m)
    body[i] = (xs.mean(), ys.mean())
head *= 2
body *= 2
for arr in (head, body):
    k = cv2.getGaussianKernel(25, 5).ravel()
    for c in range(2):
        arr[:, c] = np.convolve(np.pad(arr[:, c], 12, mode="edge"), k, "valid")

dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
_flow_cache = {}


def interp_frame(ts):
    """Image source au temps ts (interpolation par flot optique pour les ralentis)."""
    x = ts * FPS
    i0 = int(np.floor(x))
    a = x - i0
    i1 = min(i0 + 1, N - 1)
    f0 = frames[i0].astype(np.float32)
    m0 = masks[i0].astype(np.float32)
    if a < 0.04 or i0 == i1:
        return f0, m0
    if a > 0.96:
        return frames[i1].astype(np.float32), masks[i1].astype(np.float32)
    if i0 not in _flow_cache:
        g0 = cv2.cvtColor(frames[i0], cv2.COLOR_RGB2GRAY)
        g1 = cv2.cvtColor(frames[i1], cv2.COLOR_RGB2GRAY)
        _flow_cache.clear()
        _flow_cache[i0] = (dis.calc(g0, g1, None), dis.calc(g1, g0, None))
    fw, bw = _flow_cache[i0]
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    w0 = cv2.remap(frames[i0], gx + a * bw[..., 0], gy + a * bw[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    w1 = cv2.remap(frames[i1], gx + (1 - a) * fw[..., 0], gy + (1 - a) * fw[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    img = (1 - a) * w0.astype(np.float32) + a * w1.astype(np.float32)
    m = (1 - a) * m0 + a * masks[i1].astype(np.float32)
    return img, m


def track(arr, ts):
    x = min(ts * FPS, N - 1.001)
    i = int(x)
    a = x - i
    return arr[i] * (1 - a) + arr[i + 1] * a


# ---------------------------------------------------------------- helpers
def ease(u):
    u = np.clip(u, 0, 1)
    return u * u * (3 - 2 * u)


def lerp(a, b, u):
    return a + (b - a) * u


def env_hit(t, t0, attack=0.02, decay=0.25):
    d = t - t0
    if d < -attack:
        return 0.0
    if d < 0:
        return 1 + d / attack
    return float(np.exp(-d / decay))


def camera(t, ts):
    """Échelle et centre (coord. source) du recadrage."""
    hd = track(head, ts)
    bd = track(body, ts)
    mid = np.array([360.0, 640.0])
    if t < 2.6:
        s = lerp(1.0, 1.08, ease(t / 2.6))
        c = mid
    elif t < T_DROP:
        u = ease((t - 2.6) / (T_DROP - 2.6))
        s = lerp(1.08, 1.45, u)
        c = lerp(mid, hd + np.array([0, 230]), u)
    elif t < 9.0:
        d = t - T_DROP
        s = lerp(1.62, 1.22, ease(d / 0.45))
        s = lerp(s, 1.06, ease((t - (T_DROP + 0.45)) / (9.0 - T_DROP - 0.45)))
        tgt = lerp(hd + np.array([0, 300]), lerp(bd, mid, 0.55), ease(d / 1.2))
        c = tgt
    else:
        s = lerp(1.06, 1.0, ease((t - 9.0) / 0.6))
        c = mid
    return s, c


def crop(img, s, c, shake=(0, 0)):
    cw, ch = W / s, H / s
    x0 = np.clip(c[0] - cw / 2, 0, W - cw)
    y0 = np.clip(c[1] - ch / 2, 0, H - ch)
    M = np.float32([[s, 0, -s * x0 + shake[0]], [0, s, -s * y0 + shake[1]]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIGN = 1 - 0.38 * np.clip(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.68)) ** 2, 0, 1)
VIGN = VIGN[..., None]


def grade(img, energy):
    """energy 0 = avant (un peu terne/froid), 1 = après (vif, chaud)."""
    x = img / 255.0
    lum = (x @ np.float32([0.299, 0.587, 0.114]))[..., None]
    sat = lerp(0.82, 1.28, energy)
    x = lum + (x - lum) * sat
    # courbe en S douce
    con = lerp(1.06, 1.14, energy)
    x = np.clip((x - 0.5) * con + 0.5, 0, 1)
    x = x * x * (3 - 2 * x) * 0.35 + x * 0.65
    # teinte : ombres froides, hautes lumières chaudes (+ chaud après)
    warm = lerp(0.0, 0.035, energy)
    x[..., 0] += 0.02 * x[..., 0] + warm
    x[..., 2] += 0.03 * (1 - lum[..., 0]) - warm * 0.8
    x = x * VIGN
    return np.clip(x * 255, 0, 255)


def make_sparkle(r):
    g = np.zeros((2 * r + 1, 2 * r + 1), np.float32)
    yy_, xx_ = np.mgrid[-r:r + 1, -r:r + 1].astype(np.float32)
    d = np.sqrt(xx_ ** 2 + yy_ ** 2) + 1e-3
    core = np.exp(-(d / (r * 0.12)) ** 2)
    halo = np.exp(-(d / (r * 0.45)) ** 2) * 0.35
    rays = (np.exp(-(np.abs(xx_) / 0.9) ** 2) + np.exp(-(np.abs(yy_) / 0.9) ** 2)) * np.exp(-d / (r * 0.55))
    g = core + halo + rays * 0.8
    return np.clip(g, 0, 1.5)


SPRITES = {r: make_sparkle(r) for r in (6, 9, 13, 18)}
GOLD = np.float32([255, 205, 95])
WHITE_GOLD = np.float32([255, 240, 200])


class Particle:
    __slots__ = ("x", "y", "vx", "vy", "born", "life", "r", "ph")


particles = []      # autour du personnage (espace source)
logo_particles = []  # autour du logo (espace écran)


def spawn(n, m_full, t, burst=False, plist=particles):
    """Fait naître des étincelles sur le contour de la silhouette."""
    edge = cv2.morphologyEx((m_full > 0.5).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((9, 9), np.uint8))
    ys, xs = np.nonzero(edge)
    if len(xs) == 0:
        return
    idx = rng.integers(0, len(xs), n)
    for k in idx:
        p = Particle()
        p.x, p.y = float(xs[k]), float(ys[k])
        if burst:
            ang = rng.uniform(0, 2 * np.pi)
            sp = rng.uniform(120, 420)
            p.vx, p.vy = np.cos(ang) * sp, np.sin(ang) * sp - 150
            p.life = rng.uniform(0.5, 1.1)
        else:
            p.vx, p.vy = rng.uniform(-25, 25), rng.uniform(-170, -60)
            p.life = rng.uniform(0.6, 1.4)
        p.born = t
        p.r = int(rng.choice([6, 9, 9, 13, 18], p=[0.35, 0.3, 0.15, 0.13, 0.07]))
        p.ph = rng.uniform(0, 2 * np.pi)
        plist.append(p)


def draw_particles(layer, t, dt, plist=particles):
    alive = []
    for p in plist:
        age = t - p.born
        if age > p.life:
            continue
        alive.append(p)
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 0.94
        p.vy = p.vy * 0.95 - 25 * dt
        a = np.sin(np.pi * age / p.life) * (0.65 + 0.35 * np.sin(p.ph + age * 28))
        spr = SPRITES[p.r]
        r = p.r
        x, y = int(p.x), int(p.y)
        x0, y0, x1, y1 = x - r, y - r, x + r + 1, y + r + 1
        if x1 <= 0 or y1 <= 0 or x0 >= W or y0 >= H:
            continue
        sx0, sy0 = max(0, -x0), max(0, -y0)
        sx1, sy1 = spr.shape[1] - max(0, x1 - W), spr.shape[0] - max(0, y1 - H)
        layer[max(0, y0):min(H, y1), max(0, x0):min(W, x1)] += spr[sy0:sy1, sx0:sx1] * a
    plist[:] = alive


# ---------------------------------------------------------------- titrages
def font(name, size):
    return ImageFont.truetype(FONT + name, size)


def text_layer(lines, glow_col=None, glow_r=0):
    """lines: [(texte, police, taille, couleur RGBA, y, tracking)] -> RGBA float (H,W,4)."""
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for txt, fname, size, col, y, track_px in lines:
        f = font(fname, size)
        widths = [d.textlength(ch, font=f) for ch in txt]
        total = sum(widths) + track_px * (len(txt) - 1)
        x = (W - total) / 2
        for ch, w_ in zip(txt, widths):
            d.text((x, y), ch, font=f, fill=col)
            x += w_ + track_px
    arr = np.asarray(im).astype(np.float32) / 255.0
    if glow_col is not None:
        a = np.asarray(im.split()[3].filter(ImageFilter.GaussianBlur(glow_r))).astype(np.float32) / 255.0
        return arr, a
    return arr, None


def gold_fill(alpha_im):
    """Dégradé or vertical appliqué à un masque de texte."""
    a = np.asarray(alpha_im).astype(np.float32) / 255.0
    ys = np.nonzero(a.any(1))[0]
    y0, y1 = (ys[0], ys[-1]) if len(ys) else (0, H)
    g = np.clip((yy - y0) / max(1, y1 - y0), 0, 1)[..., None]
    top = np.float32([255, 236, 170]) / 255
    mid = np.float32([248, 190, 70]) / 255
    bot = np.float32([200, 120, 30]) / 255
    col = np.where(g < 0.5, lerp(top, mid, g * 2), lerp(mid, bot, (g - 0.5) * 2))
    # reflet brillant
    return col, a


# Titre d'ouverture
intro_rgba, intro_glow = text_layer(
    [("COUP DE MOU ?", "InterDisplay-Black.otf", 64, (255, 255, 255, 255), 170, 4)],
    glow_col=True, glow_r=14)

# Carton final
logo_im = Image.new("L", (W, H), 0)
ld = ImageDraw.Draw(logo_im)
f_logo = font("InterDisplay-Black.otf", 150)
txt = "POTION"
widths = [ld.textlength(ch, font=f_logo) for ch in txt]
trk = 6
x = (W - sum(widths) - trk * (len(txt) - 1)) / 2
for ch, w_ in zip(txt, widths):
    ld.text((x, 560), ch, font=f_logo, fill=255)
    x += w_ + trk
# icône fiole + éclair
cx_, cy_ = W // 2, 470
ld.ellipse((cx_ - 46, cy_ - 30, cx_ + 46, cy_ + 62), outline=255, width=9)
ld.rectangle((cx_ - 17, cy_ - 74, cx_ + 17, cy_ - 26), outline=255, width=9)
ld.rectangle((cx_ - 26, cy_ - 86, cx_ + 26, cy_ - 72), fill=255)
ld.polygon([(cx_ + 6, cy_ - 14), (cx_ - 20, cy_ + 22), (cx_ - 2, cy_ + 22),
            (cx_ - 10, cy_ + 50), (cx_ + 20, cy_ + 10), (cx_ + 2, cy_ + 10)], fill=255)
LOGO_COL, LOGO_A = gold_fill(logo_im)
LOGO_GLOW = np.asarray(logo_im.filter(ImageFilter.GaussianBlur(22))).astype(np.float32) / 255.0

tag_rgba, _ = text_layer([("L'ÉNERGIE MAGIQUE.", "Inter-SemiBold.otf", 38, (255, 255, 255, 255), 755, 7)])
legal_rgba, _ = text_layer([
    ("Teneur élevée en caféine. Déconseillé aux enfants", "Inter-Regular.otf", 17, (255, 255, 255, 200), 1180, 0),
    ("et aux femmes enceintes ou allaitantes.", "Inter-Regular.otf", 17, (255, 255, 255, 200), 1203, 0),
])


def over(dst, rgba, alpha_mul=1.0, offset_y=0, scale=1.0):
    if alpha_mul <= 0.001:
        return dst
    if scale != 1.0 or offset_y:
        M = np.float32([[scale, 0, (1 - scale) * W / 2], [0, scale, (1 - scale) * H / 2 + offset_y]])
        rgba = cv2.warpAffine(rgba, M, (W, H), flags=cv2.INTER_LINEAR)
    a = rgba[..., 3:4] * alpha_mul
    return dst * (1 - a) + rgba[..., :3] * 255 * a


# ---------------------------------------------------------------- rendu
ff = subprocess.Popen([
    "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
    "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
    "-pix_fmt", "yuv420p", OUT], stdin=subprocess.PIPE)

n_out = int(round(DUR * FPS))
dt = 1.0 / FPS
aura_t_off = 8.75   # l'aura s'éteint quand il quitte le cadre

for fi in range(n_out):
    t = fi / FPS
    ts = src_time(t)
    img, m = interp_frame(ts)
    m_full = cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR) / 255.0

    energy = ease((t - T_DROP + 0.05) / 0.35)
    d = t - T_DROP

    # ---- effet potion magique (espace source)
    if d > -0.05 and t < aura_t_off + 0.6:
        peak = env_hit(t, T_DROP, attack=0.05, decay=0.35)
        sustain = 0.42 * ease(d / 0.2) * (1 - ease((t - aura_t_off) / 0.6))
        pulse = 0.85 + 0.15 * np.sin(2 * np.pi * (t - T_DROP) / BEAT)
        k = (0.6 * peak + sustain) * pulse
        mb = (m_full > 0.5).astype(np.float32)
        dil = cv2.dilate(mb, np.ones((15, 15), np.uint8))
        outer = cv2.GaussianBlur(dil, (0, 0), 26) * (1 - m_full * 0.9)
        rim = np.clip(mb - cv2.erode(mb, np.ones((7, 7), np.uint8)), 0, 1)
        rim = cv2.GaussianBlur(rim, (0, 0), 3.5)
        # le sujet s'illumine brièvement de l'intérieur
        inner = m_full[..., None] * (0.12 * peak)
        img = img * (1 + inner) + inner * 40
        img = img + outer[..., None] * GOLD * (0.85 * k) + rim[..., None] * WHITE_GOLD * (1.1 * k)

        # étincelles
        if 0 <= d < dt:
            spawn(90, m_full, t, burst=True)
        if 0 < d and t < aura_t_off:
            rate = 10 + 40 * peak
            spawn(int(rng.poisson(rate * dt)), m_full, t)
    if particles:
        layer = np.zeros((H, W), np.float32)
        draw_particles(layer, t, dt)
        img = img + np.clip(layer, 0, 2)[..., None] * WHITE_GOLD * 0.95

    # onde de choc discrète
    if 0 <= d < 0.4:
        bc = track(body, ts)
        hc = track(head, ts)
        cxy = lerp(bc, hc, 0.5)
        rad = 40 + 900 * ease(d / 0.4) ** 0.7
        dist = np.sqrt((xx - cxy[0]) ** 2 + (yy - cxy[1]) ** 2)
        ring = np.exp(-((dist - rad) / (14 + 30 * d)) ** 2) * (1 - d / 0.4) * 0.55
        img = img + ring[..., None] * WHITE_GOLD

    # ---- caméra
    s, c = camera(t, ts)
    shk = 0.0
    if d > 0:
        shk = 9 * np.exp(-d / 0.18)
    shake = (rng.normal(0, shk), rng.normal(0, shk)) if shk > 0.3 else (0, 0)
    # micro-flottement « caméra à l'épaule » sur le push-in
    shake = (shake[0] + 1.5 * np.sin(t * 1.7), shake[1] + 1.2 * np.sin(t * 1.3 + 1))
    img = crop(np.clip(img, 0, 400), s, c, shake)

    img = grade(np.clip(img, 0, 255), energy)

    # aberration chromatique sur l'impact et la sortie du cadre
    ca = 7 * env_hit(t, T_DROP, 0.03, 0.18) + 4 * env_hit(t, 8.55, 0.15, 0.2)
    if ca > 0.4:
        Mr = np.float32([[1, 0, ca], [0, 1, 0]])
        Mb = np.float32([[1, 0, -ca], [0, 1, 0]])
        img[..., 0] = cv2.warpAffine(img[..., 0], Mr, (W, H), borderMode=cv2.BORDER_REFLECT)
        img[..., 2] = cv2.warpAffine(img[..., 2], Mb, (W, H), borderMode=cv2.BORDER_REFLECT)

    # ---- carton final : flou + assombrissement
    if t >= T_LOGO - 0.35:
        u = ease((t - (T_LOGO - 0.35)) / 0.5)
        blur = cv2.GaussianBlur(img, (0, 0), 1 + 18 * u)
        img = lerp(img, blur * 0.26, u)
        # halo chaud derrière le logo
        g = np.exp(-(((xx - W / 2) / 330) ** 2 + ((yy - 560) / 300) ** 2))
        img = img + g[..., None] * np.float32([90, 50, 10]) * u * (0.85 + 0.15 * np.sin(t * 3))

    # ---- titrages
    if 0.25 < t < 2.4:
        a_in = ease((t - 0.25) / 0.25)
        a_out = 1 - ease((t - 2.1) / 0.3)
        sc = 1.0 + 0.04 * (t - 0.25) + 0.12 * (1 - a_in)
        M = np.float32([[sc, 0, (1 - sc) * W / 2], [0, sc, (1 - sc) * 200]])
        gl = cv2.warpAffine(intro_glow, M, (W, H))
        img = img * (1 - 0.35 * gl[..., None] * a_in * a_out)
        img = over(img, cv2.warpAffine(intro_rgba, M, (W, H)), a_in * a_out)

    if t >= T_LOGO:
        u = t - T_LOGO
        a_in = ease(u / 0.18)
        sc = 1.0 + 0.25 * np.exp(-u / 0.09) + 0.015 * u
        M = np.float32([[sc, 0, (1 - sc) * W / 2], [0, sc, (1 - sc) * 560]])
        la = cv2.warpAffine(LOGO_A, M, (W, H))[..., None] * a_in
        lg = cv2.warpAffine(LOGO_GLOW, M, (W, H))[..., None] * a_in
        # reflet qui balaie le logo
        sweep = np.exp(-(((xx + yy * 0.35) - (-300 + 1400 * ease((u - 0.25) / 0.7))) / 40) ** 2)[..., None]
        col = LOGO_COL * 255 * (1 + 0.9 * sweep)
        img = img * (1 - 0.45 * lg) + lg * np.float32([255, 170, 50]) * 0.25
        img = img * (1 - la) + col * la
        img = over(img, tag_rgba, ease((u - 0.55) / 0.3), offset_y=18 * (1 - ease((u - 0.55) / 0.3)))
        img = over(img, legal_rgba, ease((u - 0.9) / 0.4))
        if 0 <= u < dt * 1.01:
            # gerbe d'étincelles autour du logo
            lm = cv2.dilate((LOGO_A > 0.5).astype(np.float32), np.ones((5, 5), np.uint8))
            spawn(70, lm, t, burst=True, plist=logo_particles)
        if logo_particles:
            layer = np.zeros((H, W), np.float32)
            draw_particles(layer, t, dt, logo_particles)
            img = img + np.clip(layer, 0, 2)[..., None] * WHITE_GOLD * 0.9

    # ---- flashs
    fl = 0.0
    fl += 0.9 * env_hit(t, T_DROP, 0.04, 0.12)
    fl += 0.55 * env_hit(t, T_LOGO, 0.02, 0.12)
    fl += 0.35 * env_hit(t, T_END, 0.02, 0.12)
    if fl > 0.01:
        img = lerp(img, np.full_like(img, 255) * np.float32([1, 0.97, 0.9]), min(fl, 1))

    # fondu au noir final
    if t > DUR - 0.5:
        img = img * (1 - ease((t - (DUR - 0.5)) / 0.5))
    # ouverture au noir
    if t < 0.2:
        img = img * ease(t / 0.2)

    ff.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
    if fi % 30 == 0:
        print(f"{t:5.2f}s", flush=True)

ff.stdin.close()
ff.wait()
print("ok", OUT)
