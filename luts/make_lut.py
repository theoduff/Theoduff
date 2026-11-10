"""Génère B92_Gym_Clean.cube : retire la dominante jaune/sodium, recolore les jaunes, look ciné propre.
Usage: python3 make_lut.py [image_test]"""
import sys, numpy as np
from PIL import Image

def rgb2hsv(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx, mn = c.max(-1), c.min(-1); d = mx - mn
    h = np.zeros_like(mx); m = d > 1e-6
    rc = np.where(m, (mx - r) / np.where(m, d, 1), 0)
    gc = np.where(m, (mx - g) / np.where(m, d, 1), 0)
    bc = np.where(m, (mx - b) / np.where(m, d, 1), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2 + rc - bc, 4 + gc - rc))
    h = np.where(m, (h / 6) % 1, 0)
    s = np.where(mx > 1e-6, d / np.where(mx > 1e-6, mx, 1), 0)
    return h, s, mx

def hsv2rgb(h, s, v):
    i = np.floor(h * 6) % 6; f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,))
    for k, (a, b_, c) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        sel = i == k; out[sel] = np.stack([a[sel], b_[sel], c[sel]], -1)
    return out

def bump(h, center, width):
    d = np.abs(((h - center + 0.5) % 1) - 0.5)
    return np.clip(1 - d / width, 0, 1) ** 2 * (3 - 2 * np.clip(1 - d / width, 0, 1))

def grade(c):
    c = c.astype(np.float64)
    # 1) Balance des blancs : enlève la dominante jaune-orange du sodium
    c = c * np.array([0.93, 0.97, 1.10])
    c = np.clip(c, 0, 1)
    # 2) Travail sélectif des teintes
    h, s, v = rgb2hsv(c)
    yel = bump(h, 52 / 360, 30 / 360)          # jaunes (sol, lignes, lumière)
    skin = bump(h, 22 / 360, 14 / 360)         # peau protégée
    yel = yel * (1 - skin)
    h = h - yel * (9 / 360)                    # jaune -> ambre/orange chaud
    s = s * (1 - 0.30 * yel)                    # jaunes moins criards
    v = v * (1 - 0.05 * yel)
    blue = bump(h, 225 / 360, 45 / 360)
    s = s * (1 + 0.20 * blue)                   # bleus (jogging, gradins) plus riches
    s = s * (1 + 0.08 * skin)                   # peau un peu plus vivante
    c = np.clip(hsv2rgb(h % 1, np.clip(s, 0, 1), v), 0, 1)
    # 3) Contraste (courbe en S douce) + noirs légèrement relevés
    x = c
    c = x + 0.55 * x * (1 - x) * (x - 0.5) * 2  # S-curve
    c = 0.01 + c * 0.985
    # 4) Split toning : ombres teal, hautes lumières crème
    luma = c @ np.array([0.2126, 0.7152, 0.0722])
    sh = np.clip(1 - luma / 0.45, 0, 1)[..., None]
    hi = np.clip((luma - 0.6) / 0.4, 0, 1)[..., None]
    c = c + sh * np.array([-0.02, 0.004, 0.015]) + hi * np.array([0.015, 0.008, -0.01])
    # 5) Légère saturation globale (vibrance)
    luma = (c @ np.array([0.2126, 0.7152, 0.0722]))[..., None]
    sat = c.max(-1, keepdims=True) - c.min(-1, keepdims=True)
    c = luma + (c - luma) * (1 + 0.15 * (1 - np.clip(sat * 2, 0, 1)))
    return np.clip(c, 0, 1)

N = 33
g = np.linspace(0, 1, N)
b, gg, r = np.meshgrid(g, g, g, indexing="ij")  # R varie le plus vite
lut = grade(np.stack([r, gg, b], -1).reshape(-1, 3))
with open("B92_Gym_Clean.cube", "w") as f:
    f.write('TITLE "B92 Gym Clean"\nLUT_3D_SIZE 33\nDOMAIN_MIN 0.0 0.0 0.0\nDOMAIN_MAX 1.0 1.0 1.0\n')
    for row in lut: f.write(f"{row[0]:.6f} {row[1]:.6f} {row[2]:.6f}\n")
print("LUT écrite : B92_Gym_Clean.cube")

if len(sys.argv) > 1:
    im = np.asarray(Image.open(sys.argv[1]).convert("RGB")) / 255.0
    out = grade(im.reshape(-1, 3)).reshape(im.shape)
    a = (im * 255).astype(np.uint8); o = (out * 255 + 0.5).astype(np.uint8)
    Image.fromarray(np.concatenate([a, o], 1)).save("preview_avant_apres.jpg", quality=88)
    print("Aperçu : preview_avant_apres.jpg")
