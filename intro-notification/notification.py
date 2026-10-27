"""Animation « notification » sur fond vert pour l'intro de la vidéo.

Usage : python notification.py police.otf sortie_basename [--alpha]
Produit sortie_basename.mp4 (fond vert #00FF00) et, avec --alpha, sortie_basename.mov
(ProRes 4444 avec transparence, pour une incrustation sans détourage).

Clé verte propre : couleurs pleines, aucune ombre, aucun flou, aucune transparence partielle
hors de l'anticrénelage des bords.
"""
import math, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT, OUT = sys.argv[1], sys.argv[2]
ALPHA = "--alpha" in sys.argv
W, H, FPS, DUR = 1080, 1920, 30, 4.0
GREEN = (0, 255, 0)
TEXT = ["Exercice à intégrer", "dans une routine de", "mobilité"]

SS = 2                                 # suréchantillonnage pour des bords nets
CARD_W, PAD_X, PAD_Y, RADIUS = 940, 64, 54, 56
FONT_SIZE, LINE_H = 78, 92
CARD_Y = 230                           # position haute, comme une notif iOS
BG, FG = (255, 255, 255), (12, 12, 12)

font = ImageFont.truetype(FONT, FONT_SIZE * SS)
lines_w = [font.getlength(l) / SS for l in TEXT]
CARD_H = PAD_Y * 2 + LINE_H * len(TEXT) - (LINE_H - FONT_SIZE)

# mots dans l'ordre d'apparition, avec leur position dans la carte
words, y = [], PAD_Y
for line in TEXT:
    x = PAD_X
    for w in line.split(" "):
        words.append((w, x, y)); x += (font.getlength(w + " ")) / SS
    y += LINE_H

def ease_out_back(t, s=1.4):
    t -= 1; return 1 + t * t * ((s + 1) * t + s)
def ease_in_cubic(t): return t ** 3
def clamp(x): return max(0.0, min(1.0, x))

def card(n_words, word_t):
    """Carte RGBA avec les n premiers mots ; le dernier monte de quelques px."""
    img = Image.new("RGBA", (CARD_W * SS, CARD_H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, CARD_W * SS - 1, CARD_H * SS - 1], RADIUS * SS, fill=BG + (255,))
    for i, (w, x, y) in enumerate(words[:n_words]):
        dy = 0
        if i == n_words - 1:
            dy = (1 - (1 - (1 - word_t) ** 3)) * 14   # glissé vers le haut, sec
        d.text((x * SS, (y + dy) * SS), w, font=font, fill=FG + (255,))
    return img.resize((CARD_W, CARD_H), Image.LANCZOS)

IN_END, WORD_START, WORD_STEP, OUT_START = 0.45, 0.30, 0.09, 3.45
frames = int(DUR * FPS)
cmd = ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
green_p = subprocess.Popen([*cmd, "-c:v", "libx264", "-crf", "12", "-preset", "slow", "-tune", "animation",
                            "-pix_fmt", "yuv420p", f"{OUT}.mp4"], stdin=subprocess.PIPE)
alpha_p = subprocess.Popen([*cmd, "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
                            f"{OUT}.mov"], stdin=subprocess.PIPE) if ALPHA else None

for f in range(frames):
    t = f / FPS
    # entrée : tombe du haut avec un léger rebond + scale 0,92 → 1
    p_in = clamp(t / IN_END)
    e = ease_out_back(p_in) if p_in < 1 else 1
    # sortie : remonte et sort par le haut
    p_out = clamp((t - OUT_START) / 0.4)
    o = ease_in_cubic(p_out)
    n = sum(1 for i in range(len(words)) if t >= WORD_START + i * WORD_STEP)
    wt = clamp((t - (WORD_START + (n - 1) * WORD_STEP)) / 0.12) if n else 1
    c = card(n, wt)
    scale = 0.92 + 0.08 * e - 0.04 * o
    cw, ch = round(CARD_W * scale), round(CARD_H * scale)
    c = c.resize((cw, ch), Image.LANCZOS)
    y = round(-CARD_H - 40 + (CARD_Y + CARD_H + 40) * e - (CARD_Y + CARD_H + 80) * o)
    x = (W - cw) // 2
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if y > -ch:  # partie de la carte encore visible (elle entre/sort par le haut)
        layer.alpha_composite(c.crop((0, max(0, -y), cw, ch)), (x, max(0, y)))
    if alpha_p:
        alpha_p.stdin.write(layer.tobytes())
    g = Image.new("RGBA", (W, H), GREEN + (255,)); g.alpha_composite(layer)
    green_p.stdin.write(g.tobytes())

for p in (green_p, alpha_p):
    if p: p.stdin.close(); p.wait()
print("ok", frames, "images")
