"""Surligne la zone étirée (ischio-jambiers) sur la vidéo du coach.

Usage : python zone_etiree.py video.mp4 pose.json sortie.mp4
pose.json : landmarks MediaPipe Pose (33 points, x/y normalisés) par image.
"""
import json, math, subprocess, sys
import cv2
import numpy as np

SRC, POSE, OUT = sys.argv[1:4]
HIP, KNEE, ANKLE, SHOULDER = (23, 24), (25, 26), (27, 28), (11, 12)
SCALE = 4  # le halo est calculé en 1/4 de résolution puis agrandi

cap = cv2.VideoCapture(SRC)
W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
FPS = cap.get(cv2.CAP_PROP_FPS)
raw = json.load(open(POSE))["frames"]
N = len(raw)

# --- Landmarks : interpolation des trous + lissage temporel ---------------
pts = np.full((N, 33, 2), np.nan)
for i, f in enumerate(raw):
    if f:
        pts[i] = np.array(f)[:, :2] * (W, H)
for j in range(33):
    for c in range(2):
        s = pts[:, j, c]; ok = ~np.isnan(s)
        pts[:, j, c] = np.interp(np.arange(N), np.flatnonzero(ok), s[ok])

def smooth(a, sigma):
    k = np.exp(-0.5 * (np.arange(-3 * sigma, 3 * sigma + 1) / sigma) ** 2); k /= k.sum()
    pad = np.pad(a, [(len(k) // 2,) * 2] + [(0, 0)] * (a.ndim - 1), mode="edge")
    return np.apply_along_axis(lambda v: np.convolve(v, k, "valid"), 0, pad)

pts = smooth(pts, 2)

# --- Intensité de l'étirement : jambes tendues ET hanches fléchies --------
def angle(a, b, c):
    v1, v2 = a - b, c - b
    cos = (v1 * v2).sum(-1) / (np.linalg.norm(v1, axis=-1) * np.linalg.norm(v2, axis=-1) + 1e-9)
    return np.degrees(np.arccos(np.clip(cos, -1, 1)))

# hauteur hanche→cheville rapportée à la longueur de jambe (≈1 jambes tendues, ≈0,3 en squat)
leg_len = sum(np.linalg.norm(pts[:, k] - pts[:, h], axis=-1) + np.linalg.norm(pts[:, a] - pts[:, k], axis=-1)
              for h, k, a in zip(HIP, KNEE, ANKLE)) / 2
# le genou est mal estimé en squat de profil : référence = longueur max sur ±1,5 s
leg_len = np.array([leg_len[max(0, i - 45):i + 46].max() for i in range(N)])
hipm, ankm, shm = (pts[:, j].mean(1) for j in (HIP, ANKLE, SHOULDER))
straight = (ankm[:, 1] - hipm[:, 1]) / leg_len
# buste penché : épaules plus basses que les hanches
folded = (shm[:, 1] - hipm[:, 1]) / np.linalg.norm(shm - hipm, axis=-1)
ramp = lambda x, a, b: np.clip((x - a) / (b - a), 0, 1)
stretch = smooth(ramp(straight, 0.55, 0.85) * ramp(folded, -0.1, 0.35), 3)
stretch = np.clip((stretch - 0.15) / 0.6, 0, 1)
stretch = stretch * stretch * (3 - 2 * stretch)  # smoothstep

# --- Couleurs du halo (BGR, 0-1) : rouge en bord, orange/jaune au coeur ----
RED, ORANGE, CORE = np.array([0.15, 0.2, 1.0]), np.array([0.1, 0.55, 1.0]), np.array([0.6, 0.9, 1.0])

def muscle(layer, a, b, width, t, strength):
    """Capsule floue le long de a→b + fibres qui « tirent » vers le genou."""
    h, w = layer.shape[:2]
    a, b = a / SCALE, b / SCALE
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    d = b - a; L = np.linalg.norm(d) + 1e-6; u = d / L
    proj = ((xs - a[0]) * u[0] + (ys - a[1]) * u[1]) / L          # 0 à la hanche, 1 au genou
    perp = (xs - a[0]) * -u[1] + (ys - a[1]) * u[0]
    r = width / SCALE * (0.75 + 0.35 * np.sin(np.pi * np.clip(proj, 0, 1)))  # ventre du muscle
    along = np.clip(np.abs(proj - 0.5) - 0.5, 0, None) * L
    dist = np.sqrt((perp / r) ** 2 + (along / r) ** 2)
    body = np.exp(-dist ** 2 * 2.2)
    fibers = 0.65 + 0.35 * np.sin(proj * 26 - t * 9) ** 2
    layer += (body * fibers * strength)[..., None] * 1.0
    return layer

def heat_to_rgb(m):
    m = np.clip(m, 0, 1.4)
    col = RED * np.clip(m / 0.5, 0, 1)[..., None]
    col += (ORANGE - RED) * np.clip((m - 0.35) / 0.4, 0, 1)[..., None]
    col += (CORE - ORANGE) * np.clip((m - 0.8) / 0.5, 0, 1)[..., None]
    return col

ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                       "-r", str(FPS), "-i", "-", "-i", SRC, "-map", "0:v", "-map", "1:a", "-c:v", "libx264",
                       "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", OUT],
                      stdin=subprocess.PIPE)
i = 0
while True:
    ok, frame = cap.read()
    if not ok: break
    s = stretch[min(i, N - 1)]; t = i / FPS
    if s > 0.01:
        p = pts[min(i, N - 1)]
        layer = np.zeros((H // SCALE, W // SCALE, 1), np.float32)
        pulse = 0.85 + 0.15 * math.sin(2 * math.pi * 1.1 * t)
        torso = (p[SHOULDER[0]] + p[SHOULDER[1]]) / 2
        for h, k, a in zip(HIP, KNEE, ANKLE):
            ph, pk, pa = p[h], p[k], p[a]
            thigh = np.linalg.norm(pk - ph)
            # décalage vers l'arrière de la cuisse : côté opposé au buste (visible de profil)
            u = (pk - ph) / (thigh + 1e-6); n = np.array([-u[1], u[0]])
            side = np.dot(torso - ph, n)
            off = -np.sign(side) * min(abs(side) * 0.12, thigh * 0.12) * n
            muscle(layer, ph + off + (pk - ph) * 0.08, pk + off - (pk - ph) * 0.1, thigh * 0.17, t, 1.0)
            muscle(layer, pk + (pa - pk) * 0.15, pk + (pa - pk) * 0.6, thigh * 0.11, t, 0.45)  # mollets, plus léger
        layer = cv2.GaussianBlur(layer, (0, 0), 3)[..., None]
        m = cv2.resize(layer, (W, H), interpolation=cv2.INTER_LINEAR)[..., None] * s * pulse
        glow = cv2.GaussianBlur(m, (0, 0), 25)[..., None] * 0.6
        img = frame.astype(np.float32) / 255
        col = heat_to_rgb(m[..., 0]) * np.clip(m * 1.2, 0, 1)
        img = 1 - (1 - img) * (1 - np.clip(col, 0, 1))                    # screen
        img = 1 - (1 - img) * (1 - np.clip(RED * glow, 0, 1))                    # halo large
        img = img * (1 - 0.25 * np.clip(m, 0, 1)) + col * 0.25 * np.clip(m, 0, 1)  # teinte
        frame = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    ff.stdin.write(frame.tobytes()); i += 1
ff.stdin.close(); ff.wait()
print("ok", i, "images")
