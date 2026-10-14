"""Rendu image : rampes de vitesse, zooms, étalonnage, effet « boost » discret.

Usage : python3 render_video.py SOURCE.mov MASKS.npy OUT.mp4
Les images sont envoyées brutes à ffmpeg (sans son ; le mix est ajouté ensuite).
"""
import sys
import subprocess
import numpy as np
import cv2

from timeline import FPS, DUR, BEAT, T_DROP, src_time

SRC, MASKS, OUT = sys.argv[1:4]
W, H = 720, 1280
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
        s = lerp(1.54, 1.22, ease(d / 0.5))
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
    sat = lerp(0.88, 1.18, energy)
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


# ---------------------------------------------------------------- rendu
ff = subprocess.Popen([
    "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
    "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
    "-pix_fmt", "yuv420p", OUT], stdin=subprocess.PIPE)

n_out = int(round(DUR * FPS))
dt = 1.0 / FPS

for fi in range(n_out):
    t = fi / FPS
    ts = src_time(t)
    img, m = interp_frame(ts)

    energy = ease((t - T_DROP + 0.05) / 0.35)
    d = t - T_DROP

    # ---- effet boost : onde de déformation (sans couleur) qui part du torse
    if 0 <= d < 0.5:
        cxy = lerp(track(body, ts), track(head, ts), 0.45)
        rad = 30 + 950 * ease(d / 0.5) ** 0.6
        dx_, dy_ = xx - cxy[0], yy - cxy[1]
        dist = np.sqrt(dx_ ** 2 + dy_ ** 2) + 1e-3
        amp = 7.0 * (1 - d / 0.5) ** 1.5
        disp = amp * np.exp(-((dist - rad) / 45) ** 2)
        img = cv2.remap(img, (xx - dx_ / dist * disp).astype(np.float32), (yy - dy_ / dist * disp).astype(np.float32),
                        cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

    # ---- caméra
    s, c = camera(t, ts)
    s *= 1 + 0.012 * sum(env_hit(t, T_DROP + k * BEAT, 0.02, 0.1) for k in (1, 2))
    shk = 0.0
    if d > 0:
        shk = 4.5 * np.exp(-d / 0.15)
    shake = (rng.normal(0, shk), rng.normal(0, shk)) if shk > 0.3 else (0, 0)
    # micro-flottement « caméra à l'épaule » sur le push-in
    shake = (shake[0] + 1.5 * np.sin(t * 1.7), shake[1] + 1.2 * np.sin(t * 1.3 + 1))
    img = crop(np.clip(img, 0, 400), s, c, shake)

    img = grade(np.clip(img, 0, 255), energy)

    # aberration chromatique sur l'impact et la sortie du cadre
    ca = 3 * env_hit(t, T_DROP, 0.03, 0.12)
    if ca > 0.4:
        Mr = np.float32([[1, 0, ca], [0, 1, 0]])
        Mb = np.float32([[1, 0, -ca], [0, 1, 0]])
        img[..., 0] = cv2.warpAffine(img[..., 0], Mr, (W, H), borderMode=cv2.BORDER_REFLECT)
        img[..., 2] = cv2.warpAffine(img[..., 2], Mb, (W, H), borderMode=cv2.BORDER_REFLECT)

    # ---- flashs
    fl = 0.0
    fl += 0.22 * env_hit(t, T_DROP, 0.03, 0.08)
    if fl > 0.01:
        img = img * (1 + fl) + 25 * fl

    # fuite de lumière chaude qui traverse le cadre (look pellicule)
    lk = env_hit(t, T_DROP + 0.05, 0.08, 0.45)
    if lk > 0.01:
        lx = lerp(-250, W + 250, ease((t - T_DROP + 0.05) / 1.0))
        g = np.exp(-(((xx - lx) / 260) ** 2 + ((yy - 300) / 700) ** 2))[..., None]
        leak = g * np.float32([255, 150, 60]) * 0.55 * lk
        img = 255 - (255 - img) * (1 - leak / 255)   # mode « écran »

    # fondu au noir final
    if t > DUR - 1.0:
        img = img * (1 - ease((t - (DUR - 1.0)) / 1.0))
    # ouverture au noir
    if t < 0.2:
        img = img * ease(t / 0.2)

    ff.stdin.write(np.clip(img, 0, 255).astype(np.uint8).tobytes())
    if fi % 30 == 0:
        print(f"{t:5.2f}s", flush=True)

ff.stdin.close()
ff.wait()
print("ok", OUT)
