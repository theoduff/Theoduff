"""Barre de progression 10 niveaux, blanche, fond transparent (ProRes 4444 alpha)."""
import subprocess, sys, math
import numpy as np
from PIL import Image, ImageFilter

W, H, FPS = 1080, 1920, 30
DUR = 38.533333
HOOK_END = 1.70
# cuts détectés (s) -> chaque cut = +1 niveau
CUTS = [5.7333, 9.7333, 13.9, 17.8333, 21.4, 26.4667, 30.5667, 33.6]
LEVELS = 10
OUT = sys.argv[1]

# segments: (start, end, slot_from, slot_to)  -> remplissage des cases
bounds = [HOOK_END] + CUTS + [DUR]
segs = []
for i in range(len(bounds) - 1):
    a, b = bounds[i], bounds[i + 1]
    s0 = i
    s1 = i + 1 if i < len(bounds) - 2 else LEVELS  # dernier segment termine la barre
    segs.append((a, b, s0, s1))

# géométrie (coordonnées dans une zone locale, puis collée dans la frame)
SS = 3                      # supersampling
BAR_W, BAR_H, GAP = 600, 12, 8
SLOT_W = (BAR_W - GAP * (LEVELS - 1)) / LEVELS
PAD = 40
LW, LH = BAR_W + 2 * PAD, BAR_H + 2 * PAD
X0 = (W - LW) // 2
Y_CENTER = 250              # haut de l'écran, sous la zone UI des réseaux

def ease_io(t):
    t = min(max(t, 0), 1)
    return t * t * (3 - 2 * t)

def ease_out(t):
    t = min(max(t, 0), 1)
    return 1 - (1 - t) ** 3

# masque d'une case arrondie (supersamplé) via SDF
yy, xx = np.mgrid[0:LH * SS, 0:LW * SS].astype(np.float32) / SS + 0.5 / SS

def rrect(x, y, w, h, r):
    cx, cy = x + w / 2, y + h / 2
    qx = np.abs(xx - cx) - (w / 2 - r)
    qy = np.abs(yy - cy) - (h / 2 - r)
    d = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    return np.clip(0.5 - d * SS, 0, 1)

def down(a):
    return a.reshape(LH, SS, LW, SS).mean(axis=(1, 3))

slot_masks, slot_x = [], []
for k in range(LEVELS):
    x = PAD + k * (SLOT_W + GAP)
    slot_x.append(x)
    slot_masks.append(rrect(x, PAD, SLOT_W, BAR_H, BAR_H / 2))
full_track = down(np.maximum.reduce(slot_masks))
xs_ss = xx  # pour le remplissage partiel

def slot_fill_state(t):
    """renvoie liste de remplissage [0..1] par case + temps depuis dernier cut."""
    fill = [0.0] * LEVELS
    for (a, b, s0, s1) in segs:
        if t >= b:
            for k in range(s0, s1):
                fill[k] = 1.0
        elif t >= a:
            p = (t - a) / (b - a)
            n = s1 - s0
            span = p * n
            for j in range(n):
                fill[s0 + j] = ease_io(min(max(span - j, 0), 1)) if n > 1 else ease_io(p)
    return fill

def frame(t):
    if t < HOOK_END:
        return None
    appear = ease_out((t - HOOK_END) / 0.45)
    fill = slot_fill_state(t)

    # pulse à chaque cut (case qui vient d'être validée)
    pulse = np.zeros((LH * SS, LW * SS), np.float32)
    for i, c in enumerate(CUTS + [DUR - 0.6]):
        dt = t - c
        if 0 <= dt < 0.6:
            amp = math.exp(-dt * 7)
            if i < len(CUTS):
                pulse = np.maximum(pulse, slot_masks[i] * amp)
            else:  # fin : toute la barre
                for m in slot_masks:
                    pulse = np.maximum(pulse, m * amp)

    filled = np.zeros_like(pulse)
    for k in range(LEVELS):
        f = fill[k]
        if f <= 0:
            continue
        x = slot_x[k]
        edge = np.clip((x + f * SLOT_W - xs_ss) * SS + 0.5, 0, 1)
        filled = np.maximum(filled, slot_masks[k] * edge)
    filled = down(filled)
    pulse = down(pulse)

    track_a = 0.28 * full_track
    bar_a = np.maximum(track_a, filled)          # blanc, alpha
    # glow doux sur le pulse
    glow = Image.fromarray((pulse * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))
    glow = np.asarray(glow, np.float32) / 255 * 0.9
    # ombre portée légère pour la lisibilité sur fonds clairs
    sh = Image.fromarray((np.maximum(full_track, 0) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))
    sh = np.asarray(sh, np.float32) / 255 * 0.22
    sh = np.roll(sh, 2, axis=0)

    white_a = 1 - (1 - bar_a) * (1 - glow)
    a = white_a + sh * (1 - white_a)
    lum = np.where(a > 0, white_a / np.maximum(a, 1e-6), 0)  # 1 = blanc, 0 = noir (ombre)
    a = a * appear
    rgba = np.zeros((LH, LW, 4), np.uint8)
    v = (lum * 255).astype(np.uint8)
    rgba[..., 0] = v; rgba[..., 1] = v; rgba[..., 2] = v
    rgba[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    return rgba

dy = 0
cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba",
       "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
       "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
       "-alpha_bits", "16", "-vendor", "apl0", OUT]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
N = round(DUR * FPS)
blank = np.zeros((H, W, 4), np.uint8)
for i in range(N):
    t = i / FPS
    loc = frame(t)
    if loc is None:
        p.stdin.write(blank.tobytes()); continue
    img = blank.copy()
    off = int(round((1 - ease_out((t - HOOK_END) / 0.45)) * 10))  # léger slide-up à l'apparition
    y0 = Y_CENTER - LH // 2 + off
    img[y0:y0 + LH, X0:X0 + LW] = loc
    p.stdin.write(img.tobytes())
p.stdin.close(); p.wait()
print("ok", N, "frames")
