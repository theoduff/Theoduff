#!/usr/bin/env python3
"""Reel pixel art : trois coachs dans une salle de sport.

Grille fixe de 135 x 240 pixels (cellules de 8 px -> 1080 x 1920, 9:16).
Seules les couleurs des cellules changent ; la grille ne bouge jamais.
Aucun texte, aucun logo. Bruitages 8-bit synthétisés.

Usage : python3 generate.py [sortie.mp4]
"""
import math
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

W, H, CELL, FPS, DUR = 135, 240, 8, 30, 18.0
NF = int(DUR * FPS)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "coachs_pixel_reel.mp4")

rng = np.random.default_rng(7)


def sh(c, k):
    return (min(255, int(c[0] * k)), min(255, int(c[1] * k)), min(255, int(c[2] * k)))


def clamp01(u):
    return max(0.0, min(1.0, u))


def ease(u):
    u = clamp01(u)
    return u * u * (3 - 2 * u)


# ---------------------------------------------------------------- sprites
class Sprite(dict):
    def px(self, x, y, c):
        if c is not None:
            self[(int(round(x)), int(round(y)))] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(min(y0, y1), max(y0, y1) + 1):
            for x in range(min(x0, x1), max(x0, x1) + 1):
                self[(x, y)] = c

    def line(self, x0, y0, x1, y1, c, th=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            u = i / n
            x = round(x0 + (x1 - x0) * u)
            y = round(y0 + (y1 - y0) * u)
            for k in range(th):
                self[(x + k, y)] = c


ADULT = dict(hw=7, hh=7, neck=1, tw=9, th=9, aw=2, lh=9, lw=3, sleeve=3, eye=3, mouth=5, shorts=4)
KID = dict(hw=7, hh=6, neck=0, tw=7, th=5, aw=1, lh=5, lw=2, sleeve=2, eye=2, mouth=4, shorts=2)

BLACK = (22, 22, 28)
LBLUE = (140, 175, 235)
BLUE = (80, 105, 210)
WHITE = (235, 235, 240)
GREY = (165, 165, 160)
EYE = (32, 26, 26)

# Coach 1 : barbe brune, cheveux courts, t-shirt noir à rayures bleues sur l'épaule
COACH_A = dict(dims=ADULT, skin=(226, 170, 138), hair="short", hair_c=(62, 42, 30), beard="full",
               beard_c=(92, 62, 44), brows=(62, 42, 30), shirt=BLACK, pattern="shoulder",
               pants=(34, 36, 46), shoes=(30, 30, 34))
# Coach 2 : crâne rasé, barbe rousse, grand sourire, t-shirt noir à grande diagonale
COACH_B = dict(dims=ADULT, skin=(238, 184, 160), hair="bald", beard="short", beard_c=(188, 112, 62),
               brows=(190, 120, 70), shirt=BLACK, pattern="diag", pants=(26, 26, 32), shorts=True,
               shoes=(236, 236, 236), earring=True, grin=True)
# Coach 3 : cheveux bruns, bouc, polo gris à bande noire, pantalon noir
COACH_C = dict(dims=ADULT, skin=(228, 176, 146), hair="curly", hair_c=(70, 46, 30), beard="goatee",
               beard_c=(84, 56, 40), brows=(70, 46, 30), shirt=(162, 165, 170), pattern="band",
               pants=(24, 26, 36), shoes=(22, 22, 24))
WOMAN = dict(dims=ADULT, skin=(242, 202, 172), hair="ponytail", hair_c=(222, 182, 104), beard=None,
             shirt=(222, 62, 132), pants=(36, 34, 48), shoes=(240, 240, 244))
MAN = dict(dims=ADULT, skin=(150, 100, 68), hair="short", hair_c=(28, 22, 22), beard=None,
           shirt=(206, 52, 46), pants=(40, 52, 96), shorts=True, shoes=(64, 76, 210))
KIDS = [
    dict(dims=KID, skin=(236, 192, 160), hair="long", hair_c=(104, 62, 32), shirt=(244, 204, 44),
         pattern="stripe", stripe=(250, 250, 250), pants=(40, 50, 100), shorts=True, shoes=(240, 110, 170)),
    dict(dims=KID, skin=(120, 82, 56), hair="spiky", hair_c=(26, 22, 22), shirt=(62, 176, 92),
         pants=(110, 112, 120), shorts=True, shoes=(240, 240, 240)),
    dict(dims=KID, skin=(246, 210, 182), hair="pigtails", hair_c=(232, 194, 96), shirt=(64, 192, 224),
         pants=(124, 70, 160), shoes=(250, 250, 250)),
    dict(dims=KID, skin=(232, 184, 150), hair="short", hair_c=(200, 100, 42), shirt=(244, 124, 44),
         pattern="stripe", stripe=(30, 30, 30), pants=(30, 30, 36), shorts=True, shoes=(60, 60, 220)),
]


def shirt_px(spec, c, r):
    base = spec["shirt"]
    p = spec.get("pattern")
    if p == "diag":
        k = c + r - 3
        if -2 <= k <= 2:
            return (LBLUE, WHITE, GREY, LBLUE, WHITE)[k + 2]
    elif p == "shoulder":
        if c >= 2 and r < 6:
            return (BLUE, WHITE, base, LBLUE)[(c + r) % 4]
    elif p == "band":
        if r in (2, 3):
            return (26, 26, 32)
        if r <= 1 and c == 0:
            return (60, 62, 68)
        if r == 0 and abs(c) == 1:
            return sh(base, 0.82)
    elif p == "stripe":
        if r == 2:
            return spec["stripe"]
    return base


def draw_head(s, spec, top, face, cx=0):
    D = spec["dims"]
    hh, skin = D["hh"], spec["skin"]
    for r in range(hh):
        for c in range(-3, 4):
            if abs(c) == 3 and (r == 0 or r == hh - 1):
                continue
            s.px(cx + c, top + r, skin)
    y = lambda r: top + r
    hair, hc = spec.get("hair"), spec.get("hair_c")
    if D is ADULT:
        s.px(cx - 4, y(3), sh(skin, 0.86))
        s.px(cx + 4, y(3), sh(skin, 0.86))
    if hair == "bald":
        s.px(cx - 1, y(1), sh(skin, 1.12))
        s.px(cx, y(1), sh(skin, 1.06))
    elif hair in ("short", "ponytail", "pigtails", "long", "curly", "spiky"):
        for c in range(-2, 3):
            s.px(cx + c, y(0), hc)
        for c in range(-3, 4):
            s.px(cx + c, y(1), hc)
        s.px(cx - 3, y(2), hc)
        s.px(cx + 3, y(2), hc)
        if hair == "curly":
            for c in (-2, 0, 2):
                s.px(cx + c, y(-1), hc)
            s.px(cx - 1, y(0), sh(hc, 1.4))
            s.px(cx + 1, y(-1), sh(hc, 1.3))
        if hair == "spiky":
            for c in (-3, -1, 1, 3):
                s.px(cx + c, y(-1), hc)
        if hair == "ponytail":
            s.px(cx - 3, y(3), hc)
            s.px(cx + 3, y(3), hc)
            for r in range(1, 6):
                s.px(cx + 4 + (1 if r > 1 else 0), y(r), hc)
            s.px(cx + 4, y(1), (240, 80, 150))
        if hair == "pigtails":
            for sx in (-1, 1):
                s.px(cx + 4 * sx, y(1), hc)
                s.px(cx + 5 * sx, y(2), hc)
                s.px(cx + 5 * sx, y(3), hc)
        if hair == "long":
            for r in range(2, hh + 3):
                s.px(cx - 4, y(r), hc)
                s.px(cx + 4, y(r), hc)
            s.px(cx - 3, y(3), hc)
            s.px(cx + 3, y(3), hc)
    er, mr = D["eye"], D["mouth"]
    beard, bc = spec.get("beard"), spec.get("beard_c")
    if beard in ("full", "short"):
        for c in (-3, -1, 0, 1, 3):
            s.px(cx + c, y(4), bc)
        for c in (-3, -2, 2, 3):
            s.px(cx + c, y(5), bc)
        for c in range(-2, 3):
            s.px(cx + c, y(6), bc)
        if beard == "short":
            s.px(cx - 3, y(4), sh(bc, 0.9))
            s.px(cx + 3, y(4), sh(bc, 0.9))
    elif beard == "goatee":
        for c in (-1, 0, 1):
            s.px(cx + c, y(4), bc)
            s.px(cx + c, y(6), bc)
    if spec.get("brows"):
        s.px(cx - 2, y(2), spec["brows"])
        s.px(cx + 2, y(2), spec["brows"])
        if beard == "full":
            s.px(cx - 1, y(2), spec["brows"])
            s.px(cx + 1, y(2), spec["brows"])
    # yeux et bouche
    if face == "pain":
        s.px(cx - 2, y(er), EYE)
        s.px(cx - 1, y(er), sh(skin, 0.7))
        s.px(cx + 2, y(er), EYE)
        s.px(cx + 1, y(er), sh(skin, 0.7))
    elif face == "dizzy":
        s.px(cx - 2, y(er), (90, 70, 70))
        s.px(cx + 2, y(er), (90, 70, 70))
    else:
        s.px(cx - 2, y(er), EYE)
        s.px(cx + 2, y(er), EYE)
    lip = sh(skin, 0.68)
    if face in ("shock", "pain"):
        s.px(cx, y(mr), (70, 22, 26))
    elif spec.get("grin") and face != "dizzy":
        for c in (-1, 0, 1):
            s.px(cx + c, y(mr), (246, 244, 236))
        s.px(cx - 2, y(mr), sh(skin, 0.6))
        s.px(cx + 2, y(mr), sh(skin, 0.6))
    else:
        for c in (-1, 0, 1):
            s.px(cx + c, y(mr), lip)
    if spec.get("earring"):
        s.px(cx - 4, y(4), (214, 214, 224))


def front(spec, arms="down", walk=None, squat=0, face="smile", bar=False, wave=0):
    """Personnage vu de face. Pieds (semelles) en y = 0, centré en x = 0."""
    D = spec["dims"]
    s = Sprite()
    hh, neck, tw, th, aw, lh, lw = D["hh"], D["neck"], D["tw"], D["th"], D["aw"], D["lh"], D["lw"]
    skin, pants, shoes = spec["skin"], spec["pants"], spec["shoes"]
    d = squat
    llift = rlift = 0
    swing = 0
    if walk is not None:
        st = int(math.floor(walk)) % 2
        llift, rlift = (1, 0) if st == 0 else (0, 1)
        swing = 1 if st == 0 else -1
    legh = lh - d
    spread = 1 if d >= 2 else 0
    ytb = -legh - 1
    ytt = ytb - th + 1
    yht = ytt - neck - hh
    half = tw // 2

    if bar:
        for x in range(-14, 15):
            s.px(x, ytt - 1, (196, 198, 208))
        for sx in (-1, 1):
            s.rect(sx * 11, ytt - 4, sx * 12, ytt + 2, (190, 44, 44))
            s.rect(sx * 13, ytt - 3, sx * 13, ytt + 1, (40, 40, 46))

    # jambes
    for side, lift in ((-1, llift), (1, rlift)):
        xs = [side * k for k in range(1, lw + 1)]
        xs = [x + side * spread for x in xs]
        for yy in range(-legh, -lift):
            row_from_top = yy + legh
            col = pants
            if spec.get("shorts") and row_from_top >= D["shorts"]:
                col = skin
            for x in xs:
                s.px(x, yy, col)
            if d >= 2 and row_from_top == legh // 2:
                s.px(xs[-1] + side, yy, col)
        for x in xs:
            s.px(x, -lift, shoes)

    # torse
    for r in range(th):
        for c in range(-half, half + 1):
            s.px(c, ytt + r, shirt_px(spec, c, r))
    for yy in range(ytt - neck, ytt):
        for c in (-1, 0, 1):
            s.px(c, yy, sh(skin, 0.9))

    # bras
    axL = list(range(-half - aw, -half))
    axR = list(range(half + 1, half + 1 + aw))

    def arm_down(xs, shorten):
        end = ytt + th - 2 - shorten
        for i, yy in enumerate(range(ytt, end + 1)):
            col = shirt_px(spec, xs[0], i) if i < D["sleeve"] else skin
            for x in xs:
                s.px(x, yy, col)

    def arm_up(xs, wig):
        for i, yy in enumerate(range(ytt + 1, yht - 1, -1)):
            col = shirt_px(spec, xs[0], 0) if i < 2 else skin
            for x in xs:
                s.px(x + (wig if yy < yht + 2 else 0), yy, col)

    if arms == "down":
        arm_down(axL, 1 if swing == 1 else 0)
        arm_down(axR, 1 if swing == -1 else 0)
    elif arms == "up":
        arm_up(axL, -1 if wave else 0)
        arm_up(axR, 1 if wave else 0)
    elif arms == "waveR":
        arm_down(axL, 0)
        arm_up(axR, 1 if wave else 0)
    elif arms == "shock":
        for xs, sx in ((axL, -1), (axR, 1)):
            for i, yy in enumerate(range(ytt + 2, yht + 2, -1)):
                col = shirt_px(spec, xs[0], 0) if i < 2 else skin
                for x in xs:
                    s.px(x, yy, col)
    elif arms == "bar":
        for xs in (axL, axR):
            for i, yy in enumerate(range(ytt + 3, ytt - 2, -1)):
                col = shirt_px(spec, xs[0], 0) if i < 3 else skin
                for x in xs:
                    s.px(x, yy, col)
    elif arms in ("forward", "clap"):
        closed = arms == "clap" and wave
        for xs in (axL, axR):
            for i, yy in enumerate(range(ytt, ytt + 3)):
                for x in xs:
                    s.px(x, yy, shirt_px(spec, xs[0], i))
        hx = 1 if closed else 3
        hy = ytt + (2 if closed else 3)
        for sx in (-1, 1):
            s.line(sx * (half + 1), ytt + 3, sx * hx, hy, skin)
            s.px(sx * hx, hy, skin)
            s.px(sx * hx, hy - 1, skin)
        if closed:
            s.px(0, hy, skin)
            s.px(0, hy - 1, skin)
    elif arms in ("pointL", "pointR"):
        sx = -1 if arms == "pointL" else 1
        other = axR if sx < 0 else axL
        arm_down(other, 0)
        for i in range(aw + 5):
            x = sx * (half + 1 + i)
            col = shirt_px(spec, x, 0) if i < 2 else skin
            s.px(x, ytt + 1, col)
            s.px(x, ytt + 2, col)
        s.px(sx * (half + aw + 6), ytt + 1, skin)

    draw_head(s, spec, yht, face)
    return s


def side_runner(spec, phi, mode="run", flash=False):
    """Coach B de profil, regard vers la gauche (course sur le tapis)."""
    s = Sprite()
    skin, pants, shoes = spec["skin"], spec["pants"], spec["shoes"]
    hip = (0.0, -10.0)
    legs = []
    for k, ph in ((1, phi + math.pi), (0, phi)):
        if mode == "run":
            a = 0.75 * math.sin(ph)
            bend = 0.25 + 1.2 * max(0.0, -math.cos(ph))
        elif mode == "grab":
            a, bend = (-0.25, 2.3) if k == 0 else (0.05, 0.1)
        else:  # flail
            a, bend = (0.7, 0.4) if k == 0 else (-0.4, 0.3)
        knee = (hip[0] - 5 * math.sin(a), hip[1] + 5 * math.cos(a))
        b = a - bend
        foot = (knee[0] - 5 * math.sin(b), knee[1] + 5 * math.cos(b))
        legs.append((k, knee, foot))
    oy = -max(f[2][1] for f in legs) if mode != "flail" else 0.0
    lean = -1 if mode == "run" else 0

    def P(p):
        return p[0], p[1] + oy

    near_thigh = None
    for k, knee, foot in legs:
        dim = 0.72 if k == 1 else 1.0
        h, kn, ft = P(hip), P(knee), P(foot)
        s.line(h[0] - 1, h[1], kn[0] - 1, kn[1], sh(pants, dim), th=2)
        s.line(kn[0] - 1, kn[1], ft[0] - 1, ft[1], sh(skin, dim), th=2)
        s.rect(round(ft[0]) - 2, round(ft[1]), round(ft[0]), round(ft[1]), sh(shoes, dim))
        if k == 0:
            near_thigh = (h, kn)

    ytop = round(-19 + oy)
    ybot = round(-11 + oy)
    sx, sy = 0 + lean, ytop + 1

    def arm(far):
        dim = 0.72 if far else 1.0
        col_s, col_k = sh(BLACK, 1.0), sh(skin, dim)
        if mode == "run":
            c = (0.9 if far else -0.9) * math.sin(phi)
            el = (sx - 4 * math.sin(c), sy + 4 * math.cos(c))
            hd = (el[0] - 3 * math.sin(c + 1.5), el[1] + 3 * math.cos(c + 1.5))
        elif mode == "grab":
            if far:
                el, hd = (sx - 2, sy + 4), (sx - 3, sy + 7)
            else:
                th_, kn_ = near_thigh
                el = (sx + 3, sy + 4)
                hd = (kn_[0] + 1.5, (th_[1] + kn_[1]) / 2)
        else:
            el = (sx + (2 if far else -2), sy - 4)
            hd = (sx + (3 if far else -3), sy - 7)
        s.line(sx, sy, el[0], el[1], col_s if not far else sh(BLACK, 0.8), th=2)
        s.line(el[0], el[1], hd[0], hd[1], col_k, th=2)

    arm(True)
    for yy in range(ytop, ybot + 1):
        r = yy - ytop
        dx = lean if r < 4 else 0
        for c in range(-2, 3):
            k = c + r - 2
            col = (LBLUE, WHITE, GREY)[k + 1] if -1 <= k <= 1 else BLACK
            s.px(c + dx, yy, col)
    s.rect(-2, ybot + 1, 2, ybot + 1, pants)
    if flash and near_thigh:
        h, kn = near_thigh
        for u in (0.3, 0.5, 0.7):
            s.px(h[0] + (kn[0] - h[0]) * u, h[1] + (kn[1] - h[1]) * u, (250, 40, 40))
            s.px(h[0] + (kn[0] - h[0]) * u + 1, h[1] + (kn[1] - h[1]) * u, (255, 120, 90))
    s.px(-1 + lean, ytop - 1, sh(skin, 0.9))
    s.px(0 + lean, ytop - 1, sh(skin, 0.9))
    top = ytop - 8
    cx = lean
    for r in range(7):
        for c in range(-3, 3):
            if (c in (-3, 2)) and r in (0, 6):
                continue
            s.px(cx + c, top + r, skin)
    s.px(cx - 1, top + 1, sh(skin, 1.12))
    bc = spec["beard_c"]
    s.px(cx - 3, top + 4, bc)
    s.px(cx + 0, top + 4, bc)
    for c in (-2, -1, 0, 1):
        s.px(cx + c, top + 5, bc)
    for c in (-2, -1, 0):
        s.px(cx + c, top + 6, bc)
    s.px(cx - 4, top + 3, skin)
    s.px(cx + 1, top + 3, sh(skin, 0.82))
    s.px(cx + 1, top + 4, (214, 214, 224))
    s.px(cx - 2, top + 2, spec["brows"])
    if mode == "run":
        s.px(cx - 2, top + 3, EYE)
        s.px(cx - 3, top + 5, (246, 244, 236))
    else:
        s.px(cx - 2, top + 3, EYE)
        s.px(cx - 3, top + 3, sh(skin, 0.7))
        s.px(cx - 3, top + 5, (70, 22, 26))
        s.px(cx - 3, top + 6, (70, 22, 26))
    return s


def lying(spec, face="dizzy", thumb=False):
    """Coach allongé au sol : sprite de face pivoté, tête vers la droite."""
    base = front(spec, arms="down", face=face)
    s = Sprite()
    for (x, y), c in base.items():
        s[(-y, x)] = c
    if thumb:
        skin = spec["skin"]
        for yy in range(-7, -12, -1):
            s.px(13, yy, BLACK if yy > -9 else skin)
            s.px(14, yy, BLACK if yy > -9 else skin)
        s.rect(12, -14, 15, -12, skin)
        s.px(14, -15, skin)
        s.px(14, -16, skin)
    return s


# ---------------------------------------------------------------- décor
def build_background():
    bg = np.zeros((H, W, 3), np.float32)
    bg[0:8] = (40, 42, 50)
    bg[7] = (30, 32, 38)
    wall = np.array((62, 138, 194), np.float32)
    for y in range(8, 62):
        for x in range(W):
            col = wall * (0.9 + 0.1 * (y - 8) / 54)
            by, row = (y - 8) % 6, (y - 8) // 6
            bx = (x + (row % 2) * 7) % 14
            if by == 5 or bx == 13:
                col = col * 0.8
            n = rng.random()
            if n < 0.13:
                col = col * 0.76
            elif n < 0.2:
                col = col * 1.1
            bg[y, x] = col
    bg[60:62] = (32, 44, 62)
    # fenêtres
    for x0, x1 in ((8, 30), (102, 126)):
        bg[13:29, x0:x1 + 1] = (52, 56, 66)
        for y in range(14, 28):
            for x in range(x0 + 1, x1):
                k = 0.85 + 0.15 * (y - 14) / 14
                bg[y, x] = np.array((176, 214, 240)) * k
        bg[20, x0:x1 + 1] = (52, 56, 66)
        bg[13:29, (x0 + x1) // 2] = (52, 56, 66)
        bg[29, x0 - 1:x1 + 2] = (210, 214, 220)
    # horloge (sans chiffres)
    cx, cy = 45, 19
    for y in range(cy - 4, cy + 5):
        for x in range(cx - 4, cx + 5):
            d = math.hypot(x - cx, y - cy)
            if d <= 4.2:
                bg[y, x] = (240, 240, 236) if d < 3.4 else (40, 40, 46)
    bg[cy - 2:cy + 1, cx] = (30, 30, 30)
    bg[cy, cx:cx + 3] = (200, 40, 40)
    # anneaux de gym
    for rx in (86, 94):
        bg[8:35, rx] = (190, 170, 120)
        for (dx, dy) in ((-1, 35), (1, 35), (-2, 36), (2, 36), (-2, 37), (2, 37), (-1, 38), (1, 38), (0, 38), (0, 35)):
            bg[dy, rx + dx] = (230, 190, 80)
    # râtelier d'haltères
    bg[52:61, 34:53] = (40, 42, 48)
    for i, c in enumerate(((220, 60, 60), (60, 120, 220), (240, 200, 40), (60, 180, 90), (230, 120, 40), (150, 80, 200))):
        x = 35 + i * 3
        bg[53:55, x:x + 2] = c
        bg[57:59, x:x + 2] = sh(c, 0.85)
    # sol
    floor = np.array((54, 56, 63), np.float32)
    for y in range(62, H):
        for x in range(W):
            col = floor * (0.86 + 0.18 * (y - 62) / (H - 62))
            if (x % 18 == 0) or ((y - 62) % 18 == 0):
                col = col * 0.88
            n = rng.random()
            if n < 0.08:
                col = col * 1.18
            elif n < 0.14:
                col = col * 0.85
            bg[y, x] = col
    # bande de gazon
    for y in range(122, 140):
        for x in range(W):
            g = np.array((58, 126, 72), np.float32) * (0.92 + 0.12 * rng.random())
            if y in (123, 138) and (x // 4) % 2 == 0:
                g = np.array((225, 230, 225), np.float32)
            bg[y, x] = g
    # plateforme d'haltéro
    for y in range(96, 111):
        for x in range(6, 45):
            if x < 13 or x > 38:
                bg[y, x] = (40, 40, 46)
            else:
                bg[y, x] = np.array((158, 112, 64)) * (0.92 + 0.08 * ((x // 3) % 2))
    # tapis des enfants
    for y in range(182, 202):
        for x in range(30, 106):
            c = (64, 96, 184) if ((x - 30) // 19 + (y - 182) // 10) % 2 == 0 else (236, 120, 52)
            bg[y, x] = np.array(c) * (0.95 + 0.05 * rng.random())
    # kettlebells contre le mur
    for i, x in enumerate(range(104, 128, 5)):
        c = (34, 34, 38)
        bg[63:66, x:x + 3] = c
        bg[62, x + 1] = c
        bg[61, x:x + 3:2] = c
    # banc + médecine-balls au premier plan
    bg[216:219, 10:36] = (40, 40, 46)
    bg[214:216, 10:36] = (150, 40, 44)
    bg[219:223, 13] = (30, 30, 34)
    bg[219:223, 32] = (30, 30, 34)
    for i, (x, c) in enumerate(((112, (200, 50, 50)), (120, (60, 70, 200)), (128, (240, 190, 40)))):
        for y in range(218, 225):
            for xx in range(x - 3, x + 4):
                if math.hypot(xx - x, y - 221) <= 3.4:
                    bg[y, xx] = c if math.hypot(xx - x + 1, y - 220) > 1.2 else sh(c, 1.3)
    return bg


def rack_sprite(bar_on_hooks):
    s = Sprite()
    post = (36, 36, 42)
    for x0 in (12, 36):
        s.rect(x0, 70, x0 + 1, 96, post)
        for y in range(72, 96, 3):
            s.px(x0, y, (70, 70, 80))
        s.px(x0 + (2 if x0 == 12 else -1), 86, (200, 200, 210))
    s.rect(12, 70, 37, 70, post)
    if bar_on_hooks:
        for x in range(11, 40):
            s.px(x, 85, (196, 198, 208))
        for sx in (-1, 1):
            cx = 25 + sx * 11
            s.rect(cx, 82, cx + sx, 88, (190, 44, 44))
            s.rect(cx + 2 * sx, 83, cx + 2 * sx, 87, (40, 40, 46))
    return s


def box_sprite():
    s = Sprite()
    s.rect(100, 100, 112, 102, (200, 154, 98))
    s.rect(100, 103, 112, 111, (164, 118, 70))
    s.rect(100, 103, 112, 103, (130, 92, 52))
    s.rect(100, 100, 100, 111, (140, 100, 58))
    s.rect(112, 100, 112, 111, (140, 100, 58))
    s.rect(104, 105, 108, 105, (60, 40, 24))
    return s


def treadmill_sprite(offset, speed, f):
    s = Sprite()
    for y in range(165, 170):
        for x in range(50, 87):
            c = (34, 34, 38)
            if speed > 0.02 and (x - int(offset)) % 6 == 0:
                c = (64, 64, 72)
            elif speed <= 0.02 and x % 6 == 0:
                c = (50, 50, 56)
            s.px(x, y, c)
    s.rect(48, 170, 87, 170, (176, 182, 192))
    s.rect(48, 171, 87, 172, (120, 126, 136))
    s.rect(44, 162, 50, 172, (70, 72, 82))
    s.rect(44, 162, 50, 162, (110, 112, 124))
    s.rect(45, 146, 46, 161, (140, 144, 154))
    s.rect(45, 152, 58, 152, (170, 174, 184))
    s.rect(41, 140, 51, 146, (40, 42, 50))
    s.rect(43, 141, 49, 144, (20, 56, 66))
    if speed > 0.02:
        for i in range(5):
            if (f // 4 + i * 7) % 3:
                s.px(43 + (i * 3 + f // 6) % 7, 141 + i % 4, (60, 230, 120) if i % 2 else (240, 80, 60))
    else:
        s.px(46, 142, (60, 120, 90))
    return s


def star(s, x, y, k):
    s.px(x, y, (255, 246, 150))
    if k:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s.px(x + dx, y + dy, (255, 210, 60))


# ---------------------------------------------------------------- éclairage
def build_lights():
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    lamps_x = [17, 51, 85, 119]
    g = [np.exp(-((xs - lx) ** 2) / (2 * 30 ** 2)) * (0.75 + 0.25 * np.exp(-((ys - 8) / 60) ** 2)) for lx in lamps_x]
    tot = sum(g)
    maps = [0.9 * gi / tot * (1 + 0.12 * np.exp(-((xs - lx) ** 2 + (ys - 10) ** 2) / 300)) for gi, lx in zip(g, lamps_x)]
    door = np.zeros((H, W), np.float32)
    for y in range(62, H):
        hw = 7 + (y - 62) * 0.32
        for x in range(W):
            e = clamp01(1 - (abs(x - 67) - hw) / 4)
            door[y, x] = 0.6 * e * math.exp(-(y - 62) / 80)
    door += 0.12 * np.exp(-((xs - 67) ** 2 + (ys - 48) ** 2) / 400)
    return lamps_x, maps, door


# ---------------------------------------------------------------- mouvement
def path_pos(t, t0, pts, speed):
    if t < t0:
        return pts[0], False, 0.0
    d = (t - t0) * speed
    acc = 0.0
    for a, b in zip(pts, pts[1:]):
        seg = math.dist(a, b)
        if d <= acc + seg:
            u = (d - acc) / seg
            return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u), True, d
        acc += seg
    return pts[-1], False, acc


def path_end(t0, pts, speed):
    return t0 + sum(math.dist(a, b) for a, b in zip(pts, pts[1:])) / speed


DOOR = (67, 62)
EVENTS = []
_last_step = {}


def step_event(name, t, x, phase, kid=False):
    k = int(math.floor(phase))
    if _last_step.get(name) != k:
        if name in _last_step:
            EVENTS.append(("step_kid" if kid else "step", t, x))
        _last_step[name] = k


def walker(name, spec, t, t0, pts, speed, kid=False):
    (x, y), moving, d = path_pos(t, t0, pts, speed)
    stride = max(3.0 if kid else 4.0, speed / 6.0)
    phase = d / stride
    if moving:
        step_event(name, t, x, phase, kid)
    return x, y, moving, phase


# ---------------------------------------------------------------- rendu
def render():
    bg = build_background()
    lamps_x, lamp_maps, door_map = build_lights()
    big_mask = np.ones((H * CELL, W * CELL, 1), np.float32)
    big_mask[CELL - 1::CELL, :, :] = 0.58
    big_mask[:, CELL - 1::CELL, :] = 0.58

    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W * CELL}x{H * CELL}", "-r", str(FPS), "-i", "-",
         "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
         "-tune", "animation", VIDEO_TMP],
        stdin=subprocess.PIPE)

    belt_off = 0.0
    run_phi = 0.0
    speeds = []
    flags = set()
    lamp_on_time = [1.3 + 0.24 * i for i in range(4)]

    def once(key, t, x=67):
        if key not in flags:
            flags.add(key)
            EVENTS.append((key.split("#")[0], t, x))

    kid_starts = [1.55, 1.75, 1.95, 2.15]
    kid_watch = [(48, 194), (60, 196), (72, 195), (84, 193)]
    kid_final = [(84, 206), (96, 208), (108, 207), (120, 205)]
    kid_run0 = [11.9, 12.05, 11.95, 12.15]

    A_pts = [DOOR, (66, 74), (50, 108)]
    B_pts = [DOOR, (70, 80), (98, 150), (98, 184)]
    C_pts = [DOOR, (72, 72), (124, 116)]
    W_pts = [DOOR, (64, 74), (25, 104)]
    M_pts = [DOOR, (72, 72), (92, 113)]

    for f in range(NF):
        t = f / FPS
        dt = 1 / FPS
        scene = bg.copy()
        items = []   # (clé de profondeur, sprite, x, y)
        shadows = []  # (x, y, rayon)
        overlay = Sprite()

        # --- porte
        door_open = 0.4 <= t < 3.9
        if t >= 0.4:
            once("door_open", 0.4)
        if t >= 3.9:
            once("door_close", 3.9)
        scene[33, 58:77] = (44, 50, 62)
        scene[33:62, 58] = (44, 50, 62)
        scene[33:62, 76] = (44, 50, 62)
        if door_open:
            for y in range(34, 62):
                for x in range(59, 76):
                    scene[y, x] = np.array((236, 230, 206)) * (0.9 + 0.1 * (y - 34) / 28)
            scene[34:62, 59:61] = (110, 116, 128)
        else:
            scene[34:62, 59:76] = (104, 110, 124)
            scene[34:62, 59] = (84, 90, 104)
            scene[47:49, 73] = (210, 210, 220)

        # --- tapis de course : vitesse
        if t < 6.3:
            spd = 0.0
        elif t < 11.35:
            spd = 1.0 * ease((t - 6.3) / 0.4) + 0.9 * ease((t - 9.0) / 0.8)
        else:
            spd = 1.9 * (1 - ease((t - 11.35) / 0.9))
        speeds.append(spd)
        belt_off += spd * 26 * dt

        # --- Coach A
        a_end = path_end(0.6, A_pts, 20)
        if t >= 0.6:
            if t < 12.0:
                x, y, mv, ph = walker("A", COACH_A, t, 0.6, A_pts, 20)
                if mv:
                    spr = front(COACH_A, walk=ph)
                elif t < 5.8:
                    spr = front(COACH_A, arms="pointL" if t > 4.6 else "down")
                elif t < 11.55:
                    u = ((t - 5.8) % 1.8) / 1.8
                    sq = squat_curve(u)
                    if t < 8.0:
                        spr = front(COACH_A, arms="forward", squat=sq)
                    elif u > 0.8:
                        spr = front(COACH_A, arms="clap", wave=int(t * 10) % 2)
                        if int(t * 10) % 2:
                            once(f"clap#A{int(t * 10)}", t, 50)
                    else:
                        spr = front(COACH_A, arms="pointL")
                else:
                    spr = front(COACH_A, arms="shock", face="shock")
                items.append((y, spr, x, y))
                shadows.append((x, y, 5))
            else:
                pts = [(50, 108), (96, 166)]
                x, y, mv, ph = walker("A2", COACH_A, t, 12.0, pts, 48)
                arr = path_end(12.0, pts, 48)
                if mv:
                    spr = front(COACH_A, walk=ph, arms="down", face="shock")
                elif t < 16.5:
                    spr = front(COACH_A, arms="forward", squat=4 if t > arr + 0.2 else 2, face="shock")
                else:
                    spr = front(COACH_A, arms="clap", squat=4, wave=int(t * 8) % 2)
                    if int(t * 8) % 2:
                        once(f"clap#A2{int(t * 8)}", t, 96)
                items.append((y, spr, x, y))
                shadows.append((x, y, 5))

        # --- Femme (squat)
        if t >= 2.6:
            if t < 12.15:
                x, y, mv, ph = walker("W", WOMAN, t, 2.6, W_pts, 22)
                bar = 5.6 <= t < 11.6
                if mv:
                    spr = front(WOMAN, walk=ph)
                elif t < 5.6:
                    spr = front(WOMAN, arms="bar")
                elif t < 5.8:
                    spr = front(WOMAN, arms="bar", bar=True)
                elif t < 11.55:
                    u = ((t - 5.8) % 1.8) / 1.8
                    spr = front(WOMAN, arms="bar", bar=True, squat=squat_curve(u), face="smile")
                    rep = int((t - 5.8) / 1.8)
                    if u > 0.85:
                        once(f"clank#{rep}", t, 25)
                elif t < 11.6:
                    spr = front(WOMAN, arms="bar", bar=True, face="shock")
                else:
                    spr = front(WOMAN, arms="shock", face="shock")
                if 5.6 <= t < 5.8:
                    once("unrack", t, 25)
                items.append((y, spr, x, y))
                shadows.append((x, y, 5))
            else:
                pts = [(25, 104), (60, 135), (82, 162)]
                x, y, mv, ph = walker("W2", WOMAN, t, 12.15, pts, 46)
                if mv:
                    spr = front(WOMAN, walk=ph, face="shock")
                elif t < 16.5:
                    spr = front(WOMAN, arms="shock", face="shock")
                else:
                    spr = front(WOMAN, arms="clap", wave=int(t * 9) % 2)
                items.append((y, spr, x, y))
                shadows.append((x, y, 5))
        bar_racked = not (5.6 <= t < 11.6)
        items.append((95, rack_sprite(bar_racked), 0, 0))

        # --- Coach C
        if t >= 1.2:
            if t < 11.95:
                x, y, mv, ph = walker("C", COACH_C, t, 1.2, C_pts, 28)
                if mv:
                    spr = front(COACH_C, walk=ph)
                elif t < 5.4:
                    spr = front(COACH_C, arms="pointL" if 4.4 < t < 5.0 else "down")
                elif t < 11.55:
                    u = ((t - 5.4) % 1.5) / 1.5
                    if 0.4 < u < 0.8:
                        w = int(t * 10) % 2
                        spr = front(COACH_C, arms="clap", wave=w)
                        if w:
                            once(f"clap#C{int(t * 10)}", t, 124)
                    else:
                        spr = front(COACH_C, arms="pointL")
                else:
                    spr = front(COACH_C, arms="shock", face="shock")
                items.append((y, spr, x, y))
                shadows.append((x, y, 5))
            else:
                pts = [(124, 116), (126, 180)]
                x, y, mv, ph = walker("C2", COACH_C, t, 11.95, pts, 44)
                arr = path_end(11.95, pts, 44)
                if mv:
                    spr = front(COACH_C, walk=ph, face="shock")
                elif t < 16.5:
                    spr = front(COACH_C, arms="forward", squat=4 if t > arr + 0.3 else 0, face="smile" if t > 15.0 else "shock")
                else:
                    spr = front(COACH_C, arms="up", squat=4, wave=int(t * 6) % 2)
                items.append((y, spr, x, y))
                shadows.append((x, y, 5))

        # --- Homme (box jumps)
        items.append((102, box_sprite(), 0, 0))
        if t >= 2.9:
            if t < 12.1:
                x, y, mv, ph = walker("M", MAN, t, 2.9, M_pts, 26)
                key = y
                jump = 0
                if mv:
                    spr = front(MAN, walk=ph)
                elif t < 5.4 or t >= 11.55:
                    spr = front(MAN, arms="shock" if t >= 11.55 else "down", face="shock" if t >= 11.55 else "smile")
                else:
                    u = ((t - 5.4) % 1.5) / 1.5
                    rep = int((t - 5.4) / 1.5)
                    if u < 0.2:
                        spr = front(MAN, arms="down", squat=2)
                    elif u < 0.5:
                        v = (u - 0.2) / 0.3
                        x = 92 + 14 * v
                        y = 113 - 11 * v
                        jump = round(7 * math.sin(math.pi * v))
                        spr = front(MAN, arms="up")
                        key = 113
                        once(f"jump#{rep}", t, x)
                    elif u < 0.62:
                        x, y, key = 106, 102, 113
                        spr = front(MAN, arms="forward", squat=2)
                        once(f"land#{rep}", t, x)
                    elif u < 0.8:
                        x, y, key = 106, 102, 113
                        spr = front(MAN, arms="up", wave=int(t * 8) % 2)
                    elif u < 1.0:
                        v = (u - 0.8) / 0.2
                        x = 106 - 14 * v
                        y = 102 + 11 * v
                        jump = round(3 * math.sin(math.pi * v))
                        key = 113
                        spr = front(MAN, arms="down")
                        if v > 0.9:
                            once(f"stepdown#{rep}", t, x)
                items.append((key, spr, x, y - jump))
                shadows.append((x, 113 if key == 113 else y, 5))
            else:
                pts = [(92, 113), (118, 164)]
                x, y, mv, ph = walker("M2", MAN, t, 12.1, pts, 46)
                if mv:
                    spr = front(MAN, walk=ph, face="shock")
                elif t < 16.5:
                    spr = front(MAN, arms="shock", face="shock")
                else:
                    spr = front(MAN, arms="up", wave=int(t * 7) % 2)
                items.append((y, spr, x, y))
                shadows.append((x, y, 5))

        # --- Coach B (le chauve)
        items.append((164, treadmill_sprite(belt_off, spd, f), 0, 0))
        if t >= 0.9:
            if t < 5.6:
                x, y, mv, ph = walker("B", COACH_B, t, 0.9, B_pts, 40)
                if mv:
                    spr = front(COACH_B, walk=ph)
                elif t < 4.9:
                    spr = front(COACH_B, arms="up", wave=int(t * 6) % 2)
                else:
                    spr = front(COACH_B, arms="pointL")
                items.append((y, spr, x, y))
                shadows.append((x, y, 5))
            elif t < 6.3:
                pts = [(98, 184), (92, 167), (66, 167)]
                x, y, mv, ph = walker("B2", COACH_B, t, 5.6, pts, 60)
                spr = front(COACH_B, walk=ph if mv else None)
                items.append((y, spr, x, y))
            elif t < 10.8:
                rate = 1.5 + 1.3 * ease((t - 9.0) / 0.8)
                prev = run_phi
                run_phi += 2 * math.pi * rate * dt
                if int(run_phi / math.pi) != int(prev / math.pi):
                    EVENTS.append(("tread_step", t, 66))
                x = 66 + round(math.sin(t * 1.3) * 1.5)
                spr = side_runner(COACH_B, run_phi)
                items.append((167, spr, x, 167))
            elif t < 11.3:
                once("snap", 10.8, 66)
                v = ease((t - 10.8) / 0.5)
                x = 66 + 18 * v
                hop = abs(math.sin((t - 10.8) * 18)) * 2
                spr = side_runner(COACH_B, 0, mode="grab", flash=int(t * 15) % 2 == 0)
                items.append((167, spr, round(x), round(167 - hop)))
            elif t < 11.55:
                once("whistle", 11.25, 84)
                v = (t - 11.3) / 0.25
                lx = 80 + 8 * v
                ly = 163 + 15 * v - 12 * math.sin(math.pi * v)
                items.append((round(ly) + 6, lying(COACH_B, face="pain"), round(lx), round(ly)))
            else:
                once("thud", 11.55, 100)
                lx, ly = 88, 178
                thumb = t >= 16.4
                face = "smile" if t >= 16.0 else ("pain" if t < 12.6 else "dizzy")
                items.append((ly + 6, lying(COACH_B, face=face, thumb=thumb), lx, ly))
                shadows.append((lx + 13, ly + 6, 11))
                if 12.2 <= t < 16.2:
                    for i in range(3):
                        a = t * 2 * math.pi * 0.9 + i * 2 * math.pi / 3
                        star(overlay, 111 + round(7 * math.cos(a)), 170 + round(2.4 * math.sin(a)), (f // 3 + i) % 2)
                if t >= 16.4:
                    once("jingle", 16.4, 100)

        # --- Enfants
        for i, spec in enumerate(KIDS):
            t0 = kid_starts[i]
            if t < t0:
                continue
            route = [DOOR, (58, 82), (30, 150), kid_watch[i]]
            name = f"K{i}"
            if t < kid_run0[i]:
                x, y, mv, ph = walker(name, spec, t, t0, route, 46, kid=True)
                jump = 0
                if mv:
                    spr = front(spec, walk=ph)
                elif t < 6.3:
                    spr = front(spec, arms="down")
                    if (int(t * 3) + i) % 5 == 0:
                        jump = 1
                elif t < 10.8:
                    cheering = (6.4 <= t < 7.2) or (9.0 <= t < 10.7)
                    if cheering:
                        jump = round(abs(math.sin(t * 9 + i * 1.3)) * 3)
                        spr = front(spec, arms="up", wave=int(t * 8 + i) % 2)
                    else:
                        spr = front(spec, arms="down")
                elif t < 11.55:
                    spr = front(spec, arms="down", face="shock")
                else:
                    spr = front(spec, arms="shock", face="shock")
                items.append((y, spr, x, y - jump))
                shadows.append((x, y, 3))
            else:
                pts = [kid_watch[i], kid_final[i]]
                x, y, mv, ph = walker(name + "b", spec, t, kid_run0[i], pts, 50, kid=True)
                jump = 0
                if mv:
                    spr = front(spec, walk=ph, face="shock")
                elif t < 16.5:
                    spr = front(spec, arms="down", face="shock")
                else:
                    jump = round(abs(math.sin(t * 9 + i * 1.7)) * 3)
                    spr = front(spec, arms="up", wave=int(t * 8 + i) % 2)
                items.append((y, spr, x, y - jump))
                shadows.append((x, y, 3))

        # --- ombres
        for sx, sy, r in shadows:
            sx, sy = int(round(sx)), int(round(sy))
            for dy, rr in ((0, r), (1, r - 1)):
                yy = sy + dy
                if 0 <= yy < H:
                    x0, x1 = max(0, sx - rr), min(W, sx + rr + 1)
                    scene[yy, x0:x1] *= 0.62

        # --- sprites (tri par profondeur)
        items.sort(key=lambda it: it[0])
        for _, spr, ox, oy in items:
            ox, oy = int(round(ox)), int(round(oy))
            for (dx, dy), c in spr.items():
                X, Y = ox + dx, oy + dy
                if 0 <= X < W and 0 <= Y < H:
                    scene[Y, X] = c
        for (X, Y), c in overlay.items():
            if 0 <= X < W and 0 <= Y < H:
                scene[Y, X] = c

        # --- lumière
        light = np.full((H, W), 0.1, np.float32)
        if door_open:
            light += door_map * min(1.0, (t - 0.4) / 0.25)
        lamps_state = []
        for i, ton in enumerate(lamp_on_time):
            if t < ton:
                on = 0.0
            elif t < ton + 0.36:
                on = 1.0 if ((f * 7 + i * 13) % 5) < 3 else 0.15
            else:
                on = 1.0
            if t >= ton:
                once(f"light_on#{i}", ton, lamps_x[i])
            lamps_state.append(on)
            light += lamp_maps[i] * on
        lit = scene * np.minimum(light, 1.08)[:, :, None]
        if door_open:
            sl = (slice(34, 62), slice(61, 76))
            lit[sl] = np.maximum(lit[sl], scene[sl] * 0.95)
        for i, lx in enumerate(lamps_x):
            c = np.array((255, 248, 222)) if lamps_state[i] > 0.5 else np.array((64, 66, 74))
            lit[5:7, lx - 7:lx + 8] = c
            lit[4, lx - 1:lx + 2] = (30, 30, 34)
            lit[0:4, lx] = (30, 30, 34)

        frame = np.clip(lit, 0, 255)
        big = np.repeat(np.repeat(frame, CELL, axis=0), CELL, axis=1) * big_mask
        ff.stdin.write(big.astype(np.uint8).tobytes())

    ff.stdin.close()
    ff.wait()
    return speeds


def squat_curve(u):
    if u < 0.4:
        return round(3 * ease(u / 0.4))
    if u < 0.5:
        return 3
    if u < 0.85:
        return round(3 * (1 - ease((u - 0.5) / 0.35)))
    return 0


# ---------------------------------------------------------------- audio
SR = 44100
NS = int(DUR * SR)
arng = np.random.default_rng(11)


def tt(d):
    return np.arange(int(d * SR)) / SR


def osc(freq, d, kind="sine", duty=0.5):
    n = int(d * SR)
    f = np.broadcast_to(np.asarray(freq, np.float64), (n,))
    ph = np.cumsum(f) / SR
    if kind == "sine":
        return np.sin(2 * np.pi * ph)
    if kind == "square":
        return np.where((ph % 1) < duty, 1.0, -1.0)
    if kind == "tri":
        return 2 * np.abs(2 * (ph % 1) - 1) - 1
    return 2 * (ph % 1) - 1


def env(d, a=0.003, tau=0.1):
    t = tt(d)
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / tau)


def noise(d):
    return arng.standard_normal(int(d * SR))


def filt(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR) + 1e-6
    if hi:
        X *= 1 / np.sqrt(1 + (fr / hi) ** 4)
    if lo:
        X *= (fr / lo) ** 2 / np.sqrt(1 + (fr / lo) ** 4)
    return np.fft.irfft(X, len(x))


class Mix:
    def __init__(self):
        self.L = np.zeros(NS)
        self.R = np.zeros(NS)

    def add(self, sig, t, x=67, gain=1.0):
        i = int(t * SR)
        n = min(len(sig), NS - i)
        if n <= 0 or i < 0:
            return
        pan = (x / W * 2 - 1) * 0.7
        l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        self.L[i:i + n] += sig[:n] * gain * l * 1.414
        self.R[i:i + n] += sig[:n] * gain * r * 1.414


def sfx_step(kid=False):
    d = 0.06
    s = filt(noise(d), lo=150, hi=1800 if not kid else 3000) * env(d, 0.001, 0.015)
    s += osc(np.linspace(220 if kid else 140, 90, int(d * SR)), d, "tri") * env(d, 0.001, 0.02) * 0.6
    return s


def sfx_door_open():
    d = 0.55
    f = np.linspace(170, 330, int(d * SR)) * (1 + 0.08 * np.sin(2 * np.pi * 31 * tt(d)))
    creak = filt(osc(f, d, "saw"), lo=300, hi=2500) * (np.sin(np.pi * tt(d) / d) ** 0.7)
    click = filt(noise(0.03), lo=1500) * env(0.03, 0.0005, 0.006)
    out = np.zeros(int(0.65 * SR))
    out[:len(click)] += click * 0.8
    out[int(0.08 * SR):int(0.08 * SR) + len(creak)] += creak * 0.35
    return out


def sfx_door_close():
    d = 0.3
    s = osc(np.linspace(120, 50, int(d * SR)), d) * env(d, 0.001, 0.06)
    s += filt(noise(d), hi=900) * env(d, 0.001, 0.03) * 0.6
    return s


def sfx_light():
    d = 0.35
    clunk = filt(noise(d), hi=600) * env(d, 0.0005, 0.03) * 1.2
    clunk += osc(110, d, "square", 0.3) * env(d, 0.001, 0.04) * 0.25
    blip = np.concatenate([osc(f, 0.035, "square", 0.25) * env(0.035, 0.001, 0.03) for f in (660, 990, 1320)])
    out = np.zeros(int(0.4 * SR))
    out[:len(clunk)] += clunk
    out[int(0.05 * SR):int(0.05 * SR) + len(blip)] += blip * 0.18
    return out


def sfx_clank():
    d = 0.5
    s = sum(osc(f, d) * env(d, 0.0005, tau) * a for f, tau, a in
            ((620, 0.18, 0.5), (1430, 0.12, 0.35), (2370, 0.08, 0.25), (3810, 0.05, 0.15)))
    s += filt(noise(d), lo=2000) * env(d, 0.0005, 0.01) * 0.4
    return s


def sfx_jump():
    d = 0.14
    return osc(np.geomspace(260, 620, int(d * SR)), d, "square", 0.25) * env(d, 0.002, 0.08) * 0.5


def sfx_land():
    d = 0.3
    s = osc(np.geomspace(130, 45, int(d * SR)), d) * env(d, 0.001, 0.07)
    s += filt(noise(d), hi=700) * env(d, 0.0005, 0.03) * 0.8
    return s


def sfx_clap():
    d = 0.06
    return filt(noise(d), lo=900, hi=4000) * env(d, 0.0005, 0.012)


def sfx_cheer(nv=4):
    d = 0.9
    out = np.zeros(int(d * SR))
    for v in range(nv):
        dv = 0.42 + 0.12 * arng.random()
        n = int(dv * SR)
        f0 = 560 + 340 * arng.random()
        tv = tt(dv)
        f = f0 * (1 + 0.45 * np.minimum(1, tv / 0.12)) * (1 + 0.04 * np.sin(2 * np.pi * 9 * tv))
        s = osc(f, dv, "square", 0.3) * np.minimum(1, tv / 0.02) * np.exp(-np.maximum(0, tv - 0.2) / 0.12)
        st = int(arng.random() * 0.3 * SR)
        m = min(n, len(out) - st)
        out[st:st + m] += filt(s, hi=3500)[:m] * 0.35
    return out


def sfx_snap():
    d = 0.7
    crack = filt(noise(0.03), lo=1800) * env(0.03, 0.0002, 0.006) * 1.4
    tv = tt(d)
    boing_f = 240 + 180 * np.sin(2 * np.pi * 22 * tv) * np.exp(-tv / 0.25)
    boing = osc(boing_f, d, "tri") * env(d, 0.002, 0.22) * 0.6
    out = np.zeros(int(d * SR))
    out[:len(crack)] += crack
    out += boing
    return out


def sfx_whistle():
    d = 0.42
    tv = tt(d)
    f = np.geomspace(1500, 260, int(d * SR)) * (1 + 0.02 * np.sin(2 * np.pi * 12 * tv))
    return osc(f, d) * np.minimum(1, tv / 0.02) * np.minimum(1, (d - tv) / 0.05) * 0.5


def sfx_thud():
    d = 0.7
    s = osc(np.geomspace(95, 38, int(d * SR)), d) * env(d, 0.001, 0.16) * 1.2
    s += filt(noise(d), hi=500) * env(d, 0.0005, 0.06) * 1.0
    s += filt(noise(d), lo=800, hi=3000) * env(d, 0.0005, 0.02) * 0.3
    return s


def sfx_wahwah():
    notes = [(392, 0.26), (370, 0.26), (349, 0.26), (330, 0.8)]
    parts = []
    for i, (f, d) in enumerate(notes):
        tv = tt(d)
        vib = 1 + (0.03 * np.sin(2 * np.pi * 6 * tv) if i == 3 else 0)
        s = osc(f * vib, d, "saw") * np.minimum(1, tv / 0.03) * np.minimum(1, (d - tv) / 0.05)
        if i == 3:
            s *= np.exp(-tv / 0.6)
        parts.append(filt(s, hi=1400))
    return np.concatenate(parts) * 0.5


def sfx_twinkle(d):
    out = np.zeros(int(d * SR))
    k = 0
    for st in np.arange(0, d - 0.12, 0.16):
        f = (2093, 2637, 3136, 2637)[k % 4]
        k += 1
        s = osc(np.linspace(f, f * 1.08, int(0.1 * SR)), 0.1, "sine") * env(0.1, 0.002, 0.04)
        i = int(st * SR)
        out[i:i + len(s)] += s
    return out * 0.5


def sfx_jingle():
    seq = [(523, 0.09), (659, 0.09), (784, 0.09), (1047, 0.3)]
    return np.concatenate([osc(f, d, "square", 0.25) * env(d, 0.002, d * 0.8) for f, d in seq]) * 0.5


def sfx_unrack():
    d = 0.4
    return sfx_clank()[:int(d * SR)] * 0.7


def build_audio(speeds, path):
    m = Mix()
    for name, t, x in EVENTS:
        if name == "step":
            m.add(sfx_step(), t, x, 0.16)
        elif name == "step_kid":
            m.add(sfx_step(True), t, x, 0.11)
        elif name == "tread_step":
            m.add(sfx_step(), t, x, 0.22)
        elif name == "door_open":
            m.add(sfx_door_open(), t, x, 0.5)
        elif name == "door_close":
            m.add(sfx_door_close(), t, x, 0.45)
        elif name == "light_on":
            m.add(sfx_light(), t, x, 0.45)
        elif name == "clank":
            m.add(sfx_clank(), t, x, 0.32)
        elif name == "unrack":
            m.add(sfx_unrack(), t, x, 0.3)
        elif name == "jump":
            m.add(sfx_jump(), t, x, 0.25)
        elif name in ("land", "stepdown"):
            m.add(sfx_land(), t, x, 0.55 if name == "land" else 0.25)
        elif name == "clap":
            m.add(sfx_clap(), t, x, 0.35)
        elif name == "snap":
            m.add(sfx_snap(), t, x, 0.9)
        elif name == "whistle":
            m.add(sfx_whistle(), t, x, 0.45)
        elif name == "thud":
            m.add(sfx_thud(), t, x, 1.0)
            m.add(sfx_wahwah(), t + 0.25, 67, 0.32)
        elif name == "jingle":
            m.add(sfx_jingle(), t, x, 0.4)
    for t in (6.45, 9.1, 9.85, 16.55, 17.1):
        m.add(sfx_cheer(5), t, 66, 0.28 if t < 16 else 0.34)
    m.add(sfx_cheer(3), 11.62, 66, 0.0)
    gasp_d = 0.5
    gasp = filt(noise(gasp_d), lo=500, hi=2500) * np.sin(np.pi * tt(gasp_d) / gasp_d) ** 2
    m.add(gasp, 11.6, 66, 0.12)
    m.add(sfx_twinkle(4.0), 12.2, 111, 0.12)
    # moteur du tapis
    sp = np.interp(np.arange(NS) / SR, np.arange(len(speeds)) / FPS, speeds)
    fm = 55 + 40 * sp
    hum = osc(fm, DUR, "square", 0.4) * 0.25 + osc(320 + 260 * sp, DUR) * 0.2
    hum = filt(hum, hi=900) * np.minimum(1, sp * 3)
    m.L += hum * 0.06 * 0.9
    m.R += hum * 0.06 * 0.7
    # ambiance de salle, une fois les lumières allumées
    room = filt(noise(DUR), lo=60, hi=400)
    room *= np.clip((np.arange(NS) / SR - 1.3) / 1.0, 0, 1) * 0.012 + 0.004
    m.L += room
    m.R += filt(noise(DUR), lo=60, hi=400) * (np.clip((np.arange(NS) / SR - 1.3) / 1.0, 0, 1) * 0.012 + 0.004)
    # réverbération courte de salle
    ir_d = 0.7
    for ch in ("L", "R"):
        ir = filt(noise(ir_d), hi=3500) * np.exp(-tt(ir_d) / 0.18)
        ir /= np.sqrt(np.sum(ir ** 2))
        x = getattr(m, ch)
        n = len(x) + len(ir)
        wet = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[:len(x)]
        setattr(m, ch, x + wet * 0.22)
    st = np.stack([m.L, m.R], axis=1)
    fade = np.ones(NS)
    fl = int(0.4 * SR)
    fade[-fl:] = np.linspace(1, 0, fl)
    st *= fade[:, None]
    st *= 0.89 / np.max(np.abs(st))
    pcm = (st * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    tmp = tempfile.mkdtemp()
    VIDEO_TMP = os.path.join(tmp, "video.mp4")
    AUDIO_TMP = os.path.join(tmp, "audio.wav")
    speeds = render()
    build_audio(speeds, AUDIO_TMP)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", VIDEO_TMP, "-i", AUDIO_TMP,
                    "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-3:LRA=11,alimiter=limit=0.7:level=false", "-ar", "44100",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                    "-shortest", OUT], check=True)
    print(OUT)
