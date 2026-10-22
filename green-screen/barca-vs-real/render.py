"""Animation green screen : combat entre l'écusson du Barça et celui du Real Madrid.

Écussons redessinés de façon stylisée (pas les fichiers officiels).
Sorties : MP4 fond vert #00FF00 (9:16, 1080x1920, 30 i/s) + WebM avec transparence.
Usage : python3 render.py [dossier_sortie]
"""
import math
import random
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS, N = 1080, 1920, 30, 270
GREEN = (0, 255, 0)
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent)
FONT = "/usr/share/fonts/opentype/inter/InterDisplay-BlackItalic.otf"
FONT_UP = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"

BLUE, GARNET, GOLD, YELLOW, RED = (0, 77, 152), (165, 0, 68), (237, 187, 0), (255, 213, 0), (218, 41, 28)
RM_GOLD, RM_PURPLE, RM_NAVY, RM_RED = (254, 190, 16), (61, 25, 91), (0, 30, 80), (200, 16, 46)
INK = (15, 15, 20)


# ---------------------------------------------------------------- écussons
def quad(p0, p1, p2, n=40):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
            for t in (i / n for i in range(n + 1))]


def barca_crest():
    S = 2
    cw, ch = 1000 * S, 1150 * S
    s = lambda pts: [(x * S, y * S) for x, y in pts]
    shield = ([(40, 30), (250, 95), (500, 55), (750, 95), (960, 30), (945, 300), (925, 520)]
              + quad((925, 520), (905, 930), (500, 1120))[1:]
              + quad((500, 1120), (95, 930), (75, 520))[1:]
              + [(55, 300)])
    mask = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(mask).polygon(s(shield), fill=255)

    fill = Image.new("RGBA", (cw, ch), (255, 255, 255, 255))
    d = ImageDraw.Draw(fill)
    # quartier droit : sang et or
    d.rectangle(s([(500, 0), (1000, 470)]), fill=YELLOW)
    sw = 500 / 9
    for i in range(1, 9, 2):
        d.rectangle(s([(500 + i * sw, 0), (500 + (i + 1) * sw, 470)]), fill=RED)
    # quartier gauche : croix de Sant Jordi
    d.rectangle(s([(225, 0), (300, 470)]), fill=RED)
    d.rectangle(s([(0, 225), (500, 300)]), fill=RED)
    # bas : blaugrana
    stripes = [BLUE, GARNET, BLUE, GARNET, BLUE]
    x0 = 75
    stw = (925 - 75) / 5
    for i, c in enumerate(stripes):
        d.rectangle(s([(x0 + i * stw, 580), (x0 + (i + 1) * stw, 1150)]), fill=c)
    # ballon
    bx, by, br = 500, 820, 115
    d.ellipse(s([(bx - br, by - br), (bx + br, by + br)]), fill=(240, 160, 30), outline=INK, width=10 * S)
    d.arc(s([(bx - br, by - 40), (bx + br, by + 40)]), 0, 180, fill=INK, width=8 * S)
    d.arc(s([(bx - 40, by - br), (bx + 40, by + br)]), 270, 450, fill=INK, width=8 * S)
    # bande FCB
    d.rectangle(s([(0, 470), (1000, 580)]), fill=GOLD)
    d.line(s([(0, 470), (1000, 470)]), fill=INK, width=8 * S)
    d.line(s([(0, 580), (1000, 580)]), fill=INK, width=8 * S)
    d.line(s([(500, 0), (500, 470)]), fill=GOLD, width=22 * S)
    f = ImageFont.truetype(FONT_UP, 95 * S)
    d.text((500 * S, 527 * S), "F C B", font=f, fill=INK, anchor="mm")

    crest = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    crest.paste(fill, (0, 0), mask)
    o = ImageDraw.Draw(crest)
    o.line(s(shield + [shield[0]]), fill=INK, width=60 * S, joint="curve")
    o.line(s(shield + [shield[0]]), fill=GOLD, width=34 * S, joint="curve")
    return pad(crest.resize((1000 // 2, 1150 // 2), Image.LANCZOS))


def real_crest():
    S = 2
    cw, ch = 1000 * S, 1150 * S
    s = lambda pts: [(x * S, y * S) for x, y in pts]
    img = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = 500, 715
    # cercle : contour, anneau or, fond blanc
    for r, c in ((430, INK), (412, RM_GOLD), (372, INK), (360, (255, 255, 255))):
        d.ellipse(s([(cx - r, cy - r), (cx + r, cy + r)]), fill=c)
    # bande violette en diagonale, découpée dans le cercle
    band = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rectangle(s([(cx - 600, cy - 70), (cx + 600, cy + 70)]), fill=RM_PURPLE)
    band = band.rotate(-32, center=(cx * S, cy * S), resample=Image.BICUBIC)
    m = Image.new("L", (cw, ch), 0)
    ImageDraw.Draw(m).ellipse(s([(cx - 360, cy - 360), (cx + 360, cy + 360)]), fill=255)
    img.paste(band, (0, 0), Image.fromarray(np.minimum(np.array(band)[..., 3], np.array(m))))
    # monogramme MCF entrelacé
    f = ImageFont.truetype(FONT_UP, 250 * S)
    for ch_, dx, dy in (("M", -165, -15), ("C", 15, 20), ("F", 175, -10)):
        d.text(((cx + dx) * S, (cy + dy) * S), ch_, font=f, fill=RM_GOLD, anchor="mm",
               stroke_width=10 * S, stroke_fill=INK)
    # couronne
    d.pieslice(s([(250, 70), (750, 520)]), 180, 360, fill=RM_RED, outline=INK, width=14 * S)
    for x_top in (300, 400, 500, 600, 700):
        d.line(s(quad((x_top, 300), ((x_top + 500) / 2, 60), (500, 85), 20)), fill=INK, width=30 * S, joint="curve")
        d.line(s(quad((x_top, 300), ((x_top + 500) / 2, 60), (500, 85), 20)), fill=RM_GOLD, width=16 * S, joint="curve")
    d.rounded_rectangle(s([(225, 270), (775, 350)]), radius=20 * S, fill=RM_GOLD, outline=INK, width=12 * S)
    for jx, jc in ((300, RM_RED), (400, (30, 90, 200)), (500, RM_RED), (600, (30, 90, 200)), (700, RM_RED)):
        d.ellipse(s([(jx - 20, 290), (jx + 20, 330)]), fill=jc, outline=INK, width=5 * S)
    d.ellipse(s([(465, 45), (535, 115)]), fill=RM_GOLD, outline=INK, width=10 * S)
    d.rectangle(s([(488, -5), (512, 60)]), fill=RM_GOLD, outline=INK, width=6 * S)
    d.rectangle(s([(470, 12), (530, 34)]), fill=RM_GOLD, outline=INK, width=6 * S)
    img = img.crop((0, 0, cw, ch))
    return pad(img.resize((1000 // 2, 1150 // 2), Image.LANCZOS))


def pad(im, p=40):
    out = Image.new("RGBA", (im.width + 2 * p, im.height + 2 * p), (0, 0, 0, 0))
    out.paste(im, (p, p))
    return out


# ---------------------------------------------------------------- outils d'anim
def clamp(t):
    return max(0.0, min(1.0, t))


def seg(f, a, b):
    return clamp((f - a) / (b - a))


def ease_out(t):
    return 1 - (1 - t) ** 3


def ease_in(t):
    return t ** 3


def ease_io(t):
    return 3 * t * t - 2 * t ** 3


def back(t, k=1.8):
    t -= 1
    return 1 + (k + 1) * t ** 3 + k * t ** 2


def lerp(a, b, t):
    return a + (b - a) * t


def wobble(f, start, dur=14, amp=0.25):
    """Squash & stretch amorti après un impact : renvoie (sx, sy)."""
    if f < start or f > start + dur:
        return 1.0, 1.0
    t = (f - start) / dur
    k = amp * math.exp(-4 * t) * math.cos(t * 3 * math.pi)
    return 1 + k, 1 - k


# ---------------------------------------------------------------- chorégraphie
LX, RX, Y0 = 290, 790, 1080
DIST = 400            # écart entre les centres au moment du contact
IMPACTS = [(60, 540, 1060, "BOOM!", 1.0), (98, 500, 1040, "POW!", 1.0),
           (150, 790, 800, "BAM!", 1.0), (200, 540, 1060, None, 1.7)]


def state(f):
    """Renvoie [(x, y, rot, sx, sy), ...] pour le Barça puis le Real."""
    bx, by, br, bsx, bsy = LX, Y0, 0.0, 1.0, 1.0
    rx, ry, rr, rsx, rsy = RX, Y0, 0.0, 1.0, 1.0

    # A. entrée (0-14)
    t = seg(f, 0, 14)
    bx = lerp(-420, LX, back(t)); br = lerp(-40, 0, ease_out(t))
    rx = lerp(W + 420, RX, back(t)); rr = lerp(40, 0, ease_out(t))

    # B. face à face (14-44)
    if 14 <= f < 44:
        by = Y0 + 14 * math.sin(f * 0.45)
        ry = Y0 + 14 * math.sin(f * 0.45 + 1.6)
        br = 5 * math.sin(f * 0.9)
        rr = -5 * math.sin(f * 0.9 + 0.7)

    # C. élan (44-54) puis D. charge (54-60) et rebond (60-76)
    if 44 <= f < 54:
        t = ease_out(seg(f, 44, 54))
        bx, rx = LX - 70 * t, RX + 70 * t
        br, rr = -12 * t, 12 * t
        bsx = rsx = 1 + 0.12 * t; bsy = rsy = 1 - 0.12 * t
    elif 54 <= f < 60:
        t = ease_in(seg(f, 54, 60))
        bx, rx = lerp(LX - 70, 540 - DIST / 2, t), lerp(RX + 70, 540 + DIST / 2, t)
        br, rr = lerp(-12, 10, t), lerp(12, -10, t)
        bsx = rsx = 1.15; bsy = rsy = 0.9
    elif 60 <= f < 76:
        t = ease_out(seg(f, 60, 76))
        bx, rx = lerp(540 - DIST / 2, LX, t), lerp(540 + DIST / 2, RX, t)
        br, rr = lerp(-25, 0, t), lerp(25, 0, t)
        by = ry = Y0 - 60 * math.sin(math.pi * t)
        bsx, bsy = wobble(f, 60, 16, -0.25)
        rsx, rsy = bsx, bsy

    # F. toupie du Real (76-98), Barça encaisse (98-126)
    if 76 <= f < 90:
        t = ease_out(seg(f, 76, 90))
        rx = lerp(RX, 900, t)
        rr = 360 * ease_in(seg(f, 76, 90))
    elif 90 <= f < 98:
        t = ease_in(seg(f, 90, 98))
        rx = lerp(900, LX + DIST, t)
        rr = 360 + 360 * seg(f, 90, 98)
    elif 98 <= f < 114:
        t = ease_out(seg(f, 98, 114))
        rx = lerp(LX + DIST, RX, t)
        rr = lerp(-20, 0, t)
        ry = Y0 - 40 * math.sin(math.pi * t)
    if 76 <= f < 98:
        by = Y0 + 6 * math.sin(f * 1.3)
    elif 98 <= f < 112:
        t = ease_out(seg(f, 98, 112))
        bx = lerp(LX, 130, t); br = lerp(0, 45, t)
        bsx, bsy = wobble(f, 98, 14, 0.3)
    elif 112 <= f < 126:
        t = ease_io(seg(f, 112, 126))
        bx = lerp(130, LX, t); br = lerp(45, 0, t)

    # G. saut du Barça et écrasement (126-168)
    LAND = Y0 - 390
    if 126 <= f < 132:
        t = ease_out(seg(f, 126, 132))
        bsx, bsy = 1 + 0.2 * t, 1 - 0.25 * t
        by = Y0 + 40 * t
    elif 132 <= f < 150:
        t = seg(f, 132, 150)
        bx = lerp(LX, RX, ease_io(t))
        by = lerp(Y0 + 40, LAND, t) - 620 * math.sin(math.pi * t) * (1 - 0.3 * t)
        br = -360 * ease_io(t)
        bsx, bsy = 0.9, 1.15
    elif 150 <= f < 168:
        t = seg(f, 150, 168)
        bx = lerp(RX, LX, ease_out(t))
        by = lerp(LAND, Y0, t) - 280 * math.sin(math.pi * t)
        br = lerp(0, 0, t)
        bsx, bsy = wobble(f, 150, 10, -0.2)
    if 150 <= f < 168:
        rsx, rsy = wobble(f, 150, 18, 0.45)
        ry = Y0 + (1 - rsy) * 220

    # H. montée en puissance (168-192)
    if 168 <= f < 192:
        k = seg(f, 168, 192)
        j = 4 + 10 * k
        rnd = random.Random(f)
        bx, by = LX + rnd.uniform(-j, j), Y0 + rnd.uniform(-j, j)
        rx, ry = RX + rnd.uniform(-j, j), Y0 + rnd.uniform(-j, j)
        br, rr = -8 * k, 8 * k
        bsx = rsx = 1 + 0.08 * k; bsy = rsy = 1 - 0.08 * k

    # I. dernier choc (192-200) et double K.O. (200-230)
    if 192 <= f < 200:
        t = ease_in(seg(f, 192, 200))
        bx, rx = lerp(LX, 540 - DIST / 2, t), lerp(RX, 540 + DIST / 2, t)
        br, rr = -8, 8
        bsx = rsx = 1.2; bsy = rsy = 0.85
    elif f >= 200:
        t = seg(f, 200, 232)
        bx = lerp(540 - DIST / 2, -500, ease_out(t))
        rx = lerp(540 + DIST / 2, W + 500, ease_out(t))
        by = ry = Y0 - 1500 * t + 900 * t * t
        br, rr = -900 * t, 900 * t
    return [(bx, by, br, bsx, bsy), (rx, ry, rr, rsx, rsy)]


def shake(f):
    dx = dy = 0.0
    for fi, *_, power in IMPACTS:
        if fi <= f < fi + 12:
            a = 28 * power * math.exp(-(f - fi) / 3.5)
            rnd = random.Random(f * 7 + fi)
            dx += rnd.uniform(-a, a); dy += rnd.uniform(-a, a)
    return dx, dy


# ---------------------------------------------------------------- effets
def draw_sprite(canvas, sprite, x, y, rot, sx, sy, height=520):
    k = height / sprite.height
    im = sprite.resize((max(1, int(sprite.width * k * sx)), max(1, int(sprite.height * k * sy))), Image.BICUBIC)
    if abs(rot) > 0.01:
        im = im.rotate(-rot, resample=Image.BICUBIC, expand=True)
    canvas.alpha_composite(im, (int(x - im.width / 2), int(y - im.height / 2)))


def starburst(d, cx, cy, r, seed, spikes=14):
    rnd = random.Random(seed)
    radii = [rnd.uniform(0.85, 1.15) for _ in range(spikes * 2)]
    a0 = rnd.uniform(0, math.pi)

    def poly(scale):
        pts = []
        for i in range(spikes * 2):
            rr = r * scale * (1 if i % 2 == 0 else 0.55) * radii[i]
            a = a0 + i * math.pi / spikes
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        return pts

    d.polygon(poly(1.12), fill=INK)
    d.polygon(poly(1.0), fill=(255, 220, 0))
    d.polygon(poly(0.72), fill=(255, 110, 0))
    d.polygon(poly(0.42), fill=(255, 255, 255))


def comic_text(canvas, text, cx, cy, size, rot=-8, fill=(255, 220, 0)):
    f = ImageFont.truetype(FONT, int(size))
    pad_ = int(size * 0.6)
    bbox = ImageDraw.Draw(canvas).textbbox((0, 0), text, font=f, stroke_width=int(size * 0.09))
    tw, th = bbox[2] - bbox[0] + 2 * pad_, bbox[3] - bbox[1] + 2 * pad_
    layer = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sw = max(2, int(size * 0.09))
    off = int(size * 0.07)
    d.text((tw / 2 + off, th / 2 + off), text, font=f, fill=INK, anchor="mm", stroke_width=sw, stroke_fill=INK)
    d.text((tw / 2, th / 2), text, font=f, fill=fill, anchor="mm", stroke_width=sw, stroke_fill=INK)
    layer = layer.rotate(rot, resample=Image.BICUBIC, expand=True)
    canvas.alpha_composite(layer, (int(cx - layer.width / 2), int(cy - layer.height / 2)))


def speed_lines(d, x, y, direction, seed, n=7, length=260):
    rnd = random.Random(seed)
    for _ in range(n):
        yy = y + rnd.uniform(-200, 200)
        x0 = x - direction * rnd.uniform(180, 240)
        x1 = x0 - direction * rnd.uniform(0.5, 1.0) * length
        d.line([(x0, yy), (x1, yy)], fill=INK, width=14)
        d.line([(x0, yy), (x1, yy)], fill=(255, 255, 255), width=8)


def aura(d, x, y, f, colors, seed):
    rnd = random.Random(seed * 1000 + f)
    for i in range(18):
        a = rnd.uniform(0, 2 * math.pi)
        r0 = rnd.uniform(270, 310)
        r1 = r0 + rnd.uniform(50, 140)
        p0 = (x + r0 * math.cos(a), y + r0 * math.sin(a) * 1.1)
        p1 = (x + r1 * math.cos(a), y + r1 * math.sin(a) * 1.1)
        d.line([p0, p1], fill=INK, width=16)
        d.line([p0, p1], fill=colors[i % len(colors)], width=9)


def render_frame(f, sprites):
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    sx, sy = shake(f)
    st = state(f)
    (bx, by, *_), (rx, ry, *_) = st

    # traits de vitesse pendant les charges
    if 54 <= f < 60 or 192 <= f < 200:
        speed_lines(d, bx + sx, by + sy, 1, f)
        speed_lines(d, rx + sx, ry + sy, -1, f + 99)
    if 90 <= f < 98:
        speed_lines(d, rx + sx, ry + sy, -1, f)
    if 168 <= f < 192:
        aura(d, bx + sx, by + sy, f, [BLUE, GARNET, YELLOW], 1)
        aura(d, rx + sx, ry + sy, f, [(255, 255, 255), RM_GOLD, RM_PURPLE], 2)

    # ordre : celui qui attaque passe devant
    order = [0, 1] if 76 <= f < 126 else [1, 0]
    for i in order:
        x, y, rot, ssx, ssy = st[i]
        draw_sprite(canvas, sprites[i], x + sx, y + sy, rot, ssx, ssy)

    # VS
    if 16 <= f < 46:
        t = seg(f, 16, 24)
        out = seg(f, 40, 46)
        size = 260 * back(t, 2.5) * (1 - ease_in(out))
        if size > 8:
            comic_text(canvas, "VS", 540 + sx, 640 + sy, size, rot=-10 + 4 * math.sin(f), fill=(255, 255, 255))

    # impacts
    for fi, ix, iy, word, power in IMPACTS:
        if fi <= f < fi + 16:
            t = (f - fi) / 16
            r = 230 * power * (0.5 + 0.7 * ease_out(min(1, t * 3))) * (1 - ease_in(seg(f, fi + 9, fi + 16)))
            if r > 5:
                starburst(d, ix + sx, iy + sy, r, fi + (f - fi) // 2)
            if word and f < fi + 15:
                size = 190 * back(min(1, (f - fi) / 5), 2.2) * (1 - ease_in(seg(f, fi + 11, fi + 15)))
                if size > 8:
                    comic_text(canvas, word, ix + sx, iy - 280 + sy, size, rot=random.Random(fi).uniform(-14, 14))

    # double K.O.
    if 206 <= f < 262:
        t = seg(f, 206, 214)
        out = ease_in(seg(f, 254, 262))
        s1 = 300 * back(t, 2.5) * (1 - out)
        s2 = 120 * back(seg(f, 210, 218), 2.5) * (1 - out)
        if s2 > 8:
            comic_text(canvas, "DOUBLE", 540, 760, s2, rot=-6, fill=(255, 255, 255))
        if s1 > 8:
            comic_text(canvas, "K.O.!", 540, 960, s1, rot=-6 + 2 * math.sin(f * 0.5))
    return canvas


# ---------------------------------------------------------------- son
def make_audio(path):
    sr = 48000
    total = np.zeros(int(N / FPS * sr) + sr)
    rng = np.random.default_rng(3)

    def add(sig, at):
        i = int(at * sr)
        total[i:i + len(sig)] += sig[: len(total) - i]

    def hit(power=1.0):
        t = np.arange(int(0.6 * sr)) / sr
        freq = 45 + 110 * np.exp(-t * 18)
        sub = np.sin(2 * np.pi * np.cumsum(freq) / sr) * np.exp(-t * 6)
        crack = rng.standard_normal(len(t)) * np.exp(-t * 40)
        return power * (0.9 * sub + 0.35 * crack)

    def whoosh(dur=0.3, power=0.5):
        n = int(dur * sr)
        noise = rng.standard_normal(n)
        k = int(sr * 0.0015)
        noise = np.convolve(noise, np.ones(k) / k, mode="same") * 6
        env = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
        return power * noise * env

    def rumble(dur):
        n = int(dur * sr)
        t = np.arange(n) / sr
        return 0.35 * np.sin(2 * np.pi * (40 + 30 * t / dur) * t) * np.linspace(0, 1, n) * (1 + 0.3 * np.sin(2 * np.pi * 9 * t))

    add(whoosh(0.45, 0.6), 0.0)
    add(hit(0.6), 16 / FPS)
    add(whoosh(0.22, 0.6), 54 / FPS)
    add(hit(1.0), 60 / FPS)
    for k in range(4):
        add(whoosh(0.18, 0.35 + 0.1 * k), (76 + 5 * k) / FPS)
    add(hit(1.0), 98 / FPS)
    add(whoosh(0.5, 0.5), 132 / FPS)
    add(hit(1.0), 150 / FPS)
    add(rumble(24 / FPS), 168 / FPS)
    add(whoosh(0.28, 0.8), 192 / FPS)
    add(hit(1.5), 200 / FPS)
    add(whoosh(0.8, 0.6), 202 / FPS)
    add(hit(0.8), 206 / FPS)
    total = total[: int(N / FPS * sr)]
    total = total / np.max(np.abs(total)) * 0.95
    pcm = (np.tanh(total * 1.3) / np.tanh(1.3) * 32000).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())


# ---------------------------------------------------------------- rendu
def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sprites = [barca_crest(), real_crest()]
    sprites[0].save(OUT / "ecusson_barca.png")
    sprites[1].save(OUT / "ecusson_real.png")
    wav = OUT / "sfx.wav"
    make_audio(wav)

    common = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-s", f"{W}x{H}", "-r", str(FPS)]
    green = subprocess.Popen(common + ["-pix_fmt", "rgb24", "-i", "-", "-i", str(wav),
                                       "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p",
                                       "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
                                       str(OUT / "barca_vs_real_greenscreen.mp4")], stdin=subprocess.PIPE)
    alpha = subprocess.Popen(common + ["-pix_fmt", "rgba", "-i", "-", "-i", str(wav),
                                       "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "24",
                                       "-c:a", "libopus", "-shortest",
                                       str(OUT / "barca_vs_real_transparent.webm")], stdin=subprocess.PIPE)
    bg = Image.new("RGBA", (W, H), GREEN + (255,))
    for f in range(N):
        fr = render_frame(f, sprites)
        alpha.stdin.write(fr.tobytes())
        green.stdin.write(Image.alpha_composite(bg, fr).convert("RGB").tobytes())
        if f in (20, 60, 98, 140, 150, 180, 201, 220):
            Image.alpha_composite(bg, fr).convert("RGB").save(OUT / f"preview_{f:03d}.png")
    for p in (green, alpha):
        p.stdin.close(); p.wait()


if __name__ == "__main__":
    main()
