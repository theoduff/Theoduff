#!/usr/bin/env python3
"""Reel pixel art n°2 : la sortie vélo des deux coachs.

Même grille fixe que generate.py (135 x 240 cellules de 8 px -> 1080 x 1920).
Écran coupé en deux, retrouvailles, deux crevaisons, chambre à air qui explose,
coup de fil avec le téléphone de l'autre et attente de nuit dans un village.
Aucun texte, aucun logo, aucune parole. Bruitages synthétisés.

Usage : python3 velo.py [sortie.mp4]
"""
import math
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

from generate import (BLACK, BLUE, EYE, LBLUE, WHITE, COACH_A, COACH_C, Sprite, clamp01, ease, env,
                      filt, front, noise, osc, sfx_wahwah, sh, tt)

W, H, CELL, FPS, DUR = 135, 240, 8, 30, 35.0
NF = int(DUR * FPS)
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "coachs_velo_reel.mp4")
rng = np.random.default_rng(21)

# Tenues vélo : on garde les maillots, on ajoute short, casque et vélo de couleur différente
A = dict(COACH_A, shorts=True, pants=(28, 30, 38), shoes=(240, 240, 240), helmet=(56, 104, 214), helmet2=(240, 240, 240),
         bike=(52, 116, 230))
C = dict(COACH_C, shorts=True, pants=(24, 26, 34), shoes=(30, 30, 30), helmet=(236, 236, 236), helmet2=(210, 50, 50),
         bike=(240, 124, 40))

ROAD = 150      # hauteur de la route (plein écran)
ROAD_HALF = 80  # hauteur de la route dans chaque moitié d'écran
HALF_H = 119


def tramp(u, a=0.2):
    u = np.clip(u, 0, 1)
    n = 1 - a
    return np.where(u < a, u * u / (2 * a), np.where(u > 1 - a, n - (1 - u) ** 2 / (2 * a), u - a / 2)) / n


def hashf(xw, yw, seed=0):
    h = (np.asarray(xw, np.int64) * 374761393 + np.asarray(yw, np.int64) * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h & 0xFFFF) / 65536.0


def lerpc(a, b, u):
    return tuple(a[i] + (b[i] - a[i]) * u for i in range(len(a)))


def keyed(keys, t):
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return lerpc(v0, v1, clamp01((t - t0) / (t1 - t0)))
    return keys[-1][1]


SKY = [(0, ((84, 156, 232), (186, 222, 244))), (21, ((84, 156, 232), (186, 222, 244))),
       (25, ((98, 128, 208), (250, 202, 142))), (28.5, ((54, 48, 118), (236, 112, 80))),
       (31.5, ((10, 12, 36), (32, 32, 76))), (99, ((10, 12, 36), (32, 32, 76)))]
AMB = [(0, (1, 1, 1)), (21, (1, 1, 1)), (25, (1.0, 0.9, 0.78)), (28.5, (0.6, 0.48, 0.58)),
       (31.5, (0.25, 0.29, 0.48)), (99, (0.25, 0.29, 0.48))]


def sky_cols(t):
    for (t0, v0), (t1, v1) in zip(SKY, SKY[1:]):
        if t <= t1:
            u = clamp01((t - t0) / (t1 - t0))
            return lerpc(v0[0], v1[0], u), lerpc(v0[1], v1[1], u)
    return SKY[-1][1]


def night(t):
    return clamp01((t - 27.5) / 4.0)


# ---------------------------------------------------------------- sprites
def ik(hip, foot, l1=6.0, l2=6.0):
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]
    d = max(0.01, min(math.hypot(dx, dy), l1 + l2 - 0.01))
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    hg = math.sqrt(max(0.0, l1 * l1 - a * a))
    mx, my = hip[0] + a * dx / d, hip[1] + a * dy / d
    k1 = (mx - hg * dy / d, my + hg * dx / d)
    k2 = (mx + hg * dy / d, my - hg * dx / d)
    return k1 if k1[0] > k2[0] else k2


def wheel(s, cx, cy, rot, flat=False, tire=(28, 28, 30), rim=(186, 186, 192)):
    for k in range(36):
        a = 2 * math.pi * k / 36
        x, y = round(cx + 4.2 * math.cos(a)), round(cy + 4.2 * math.sin(a))
        if flat and y >= cy + 3:
            y = cy + 4
            x = round(cx + 4.8 * math.cos(a))
        s.px(x, y, tire)
    for j in range(2):
        a = rot + j * math.pi / 2
        s.line(cx - 3 * math.cos(a), cy - 3 * math.sin(a), cx + 3 * math.cos(a), cy + 3 * math.sin(a), rim)
    s.px(cx, cy, (96, 96, 102))


def bike(s, col, rot, flat=False, no_rear=False, theta=0.0):
    if not no_rear:
        wheel(s, -7, -4, rot, flat)
    wheel(s, 7, -4, rot)
    dk = sh(col, 0.75)
    s.line(-1, -4, -3, -11, col)
    s.line(-3, -10, 5, -10, col)
    s.line(-1, -4, 5, -9, col)
    s.line(-1, -4, -7, -4, dk)
    s.line(-3, -10, -7, -4, dk)
    s.line(5, -10, 7, -4, (150, 150, 158))
    s.line(5, -11, 7, -12, (40, 40, 44))
    s.px(7, -11, (40, 40, 44))
    s.rect(-5, -12, -2, -12, (30, 30, 32))
    px, py = -1 + 2.5 * math.cos(theta), -4 + 2.5 * math.sin(theta)
    s.line(-1, -4, px, py, (60, 60, 66))
    s.px(-1, -4, (120, 120, 126))


def bike_sprite(spec, rot=0.0, flat=False, upside=False, no_rear=False):
    s = Sprite()
    bike(s, spec["bike"], rot, flat, no_rear)
    if upside:
        f = Sprite()
        for (x, y), c in s.items():
            f[(x, -12 - y)] = c
        return f
    return s


def side_head(s, spec, hx, hy):
    skin, hair = spec["skin"], spec["hair_c"]
    for r in range(-3, 4):
        for c in range(-3, 4):
            if abs(c) == 3 and abs(r) == 3:
                continue
            s.px(hx + c, hy + r, skin)
    for r in range(-1, 3):
        s.px(hx - 3, hy + r, hair)
    s.px(hx - 2, hy - 1, hair)
    s.px(hx - 1, hy, sh(skin, 0.82))
    s.px(hx + 2, hy - 1, EYE)
    s.px(hx + 4, hy, skin)
    bc = spec["beard_c"]
    if spec["beard"] == "full":
        for r in range(1, 4):
            for c in range(-1, 4):
                if not (r == 3 and c == 3):
                    s.px(hx + c, hy + r, bc)
        s.px(hx + 3, hy + 2, sh(skin, 0.7))
    else:
        s.px(hx + 3, hy + 1, bc)
        s.px(hx + 3, hy + 2, sh(skin, 0.7))
        s.px(hx + 2, hy + 3, bc)
        s.px(hx + 3, hy + 3, bc)
    hc, h2 = spec["helmet"], spec["helmet2"]
    for c in range(-2, 3):
        s.px(hx + c, hy - 4, hc)
    for c in range(-3, 4):
        s.px(hx + c, hy - 3, hc)
        s.px(hx + c, hy - 2, hc)
    s.px(hx + 4, hy - 2, sh(hc, 0.8))
    s.px(hx, hy - 4, h2)
    s.px(hx, hy - 3, h2)
    s.px(hx - 1, hy - 3, h2)


def rider(spec, rot, theta, mode="ride", flat=False, wave=False, lamp=False):
    """Coach sur son vélo, vu de profil, roulant vers la droite. Sol en y = 0."""
    s = Sprite()
    if mode == "stand":
        sway = round(math.sin(theta) * 1.2)
        H_, S_, Hd = (0 + sway, -15), (5 + sway, -20), (8 + sway, -24)
    elif mode == "coast":
        H_, S_, Hd = (-3, -13), (4, -17), (7, -21)
        theta = 0.0
    else:
        H_, S_, Hd = (-3, -13), (3, -19), (5, -23)
    skin, pants, shoes, jersey = spec["skin"], spec["pants"], spec["shoes"], spec["shirt"]

    def leg(th, dim):
        p = (-1 + 2.5 * math.cos(th), -4 + 2.5 * math.sin(th))
        k = ik(H_, p)
        s.line(H_[0] - 1, H_[1], k[0] - 1, k[1], sh(pants, dim), th=2)
        s.line(k[0] - 1, k[1], p[0] - 1, p[1], sh(skin, dim), th=2)
        s.rect(round(p[0]) - 1, round(p[1]), round(p[0]) + 1, round(p[1]), sh(shoes, dim))

    def arm(dim):
        if wave and dim == 1.0:
            el, hd = (S_[0] + 1, S_[1] - 4), (S_[0] + 2, S_[1] - 8)
        else:
            hd = (6, -12)
            el = ((S_[0] + hd[0]) / 2, (S_[1] + hd[1]) / 2 + 1.5)
        s.line(S_[0], S_[1], el[0], el[1], sh(jersey, dim) if jersey != BLACK else (40, 40, 48))
        s.line(el[0], el[1], hd[0], hd[1], sh(skin, dim))

    leg(theta + math.pi, 0.7)
    arm(0.7)
    bike(s, spec["bike"], rot, flat, theta=theta)
    if lamp:
        s.px(8, -11, (255, 236, 150))
    n = 12
    for i in range(n + 1):
        u = i / n
        x = round(H_[0] + (S_[0] - H_[0]) * u)
        y = round(H_[1] + (S_[1] - H_[1]) * u)
        for dy in (-1, 0, 1):
            col = jersey
            if spec["pattern"] == "band" and 0.5 < u < 0.75:
                col = (26, 26, 32)
            if spec["pattern"] == "shoulder" and u > 0.55 and dy == -1:
                col = (BLUE, WHITE, LBLUE)[(x + y) % 3]
            s.px(x, y + dy, col)
    s.rect(H_[0] - 2, H_[1], H_[0] + 1, H_[1] + 1, pants)
    leg(theta, 1.0)
    side_head(s, spec, Hd[0], Hd[1])
    arm(1.0)
    return s


def rotate(spr, ang):
    if abs(ang) < 0.04:
        return spr
    ca, sa = math.cos(ang), math.sin(ang)
    xs = [k[0] for k in spr]
    ys = [k[1] for k in spr]
    corners = [(x, y) for x in (min(xs), max(xs)) for y in (min(ys), max(ys))]
    rx = [x * ca - y * sa for x, y in corners]
    ry = [x * sa + y * ca for x, y in corners]
    out = Sprite()
    for Y in range(math.floor(min(ry)) - 1, math.ceil(max(ry)) + 2):
        for X in range(math.floor(min(rx)) - 1, math.ceil(max(rx)) + 2):
            k = (round(X * ca + Y * sa), round(-X * sa + Y * ca))
            if k in spr:
                out[(X, Y)] = spr[k]
    return out


def helmet_on(s, spec, squat=0):
    top = -26 + squat
    hc, h2 = spec["helmet"], spec["helmet2"]
    for c in range(-2, 3):
        s.px(c, top - 1, hc)
    for c in range(-3, 4):
        s.px(c, top, hc)
        s.px(c, top + 1, hc)
    s.px(0, top - 1, h2)
    s.px(0, top, h2)
    s.px(-4, top + 1, sh(hc, 0.8))
    s.px(4, top + 1, sh(hc, 0.8))
    for k in [k for k in s if k[1] == top - 2]:
        del s[k]
    return s


def person(spec, **kw):
    """Coach debout (vu de face) avec son casque."""
    extra = kw.pop("extra", None)
    s = front(spec, **kw)
    sq = kw.get("squat", 0)
    if extra == "phone_ear":
        for k in [k for k in s if k[0] in (5, 6) and k[1] > -18 + sq]:
            del s[k]
        s.line(5, -18 + sq, 6, -22 + sq, spec["skin"])
        s.rect(4, -24 + sq, 5, -21 + sq, (30, 30, 36))
    elif extra == "phone_hold":
        s.rect(-1, -16 + sq, 1, -13 + sq, (30, 30, 36))
        s.px(0, -15 + sq, (70, 70, 80))
    elif extra == "phone_give":
        s.rect(-14, -18 + sq, -13, -16 + sq, (30, 30, 36))
        s.px(-14, -17 + sq, (140, 220, 255))
    elif extra == "facepalm":
        for k in [k for k in s if k[0] in (-6, -5, 5, 6) and k[1] > -18 + sq]:
            del s[k]
        for sx in (-1, 1):
            s.line(sx * 5, -18 + sq, sx * 4, -21 + sq, spec["skin"])
            s.rect(sx * 3 - (1 if sx > 0 else 0), -23 + sq, sx * 3 + (1 if sx < 0 else 0), -22 + sq, spec["skin"])
    return helmet_on(s, spec, sq)


def wheel_sprite(rot, tire_off=False, bulge=0.0, shred=False):
    s = Sprite()
    wheel(s, 0, -4, rot)
    if tire_off:
        for k in range(10):
            a = -math.pi / 2 + (k - 5) * 0.18
            s.px(round(1 + 5 * math.cos(a)), round(-5 + 5 * math.sin(a)), (28, 28, 30))
    if bulge > 0:
        r = 1 + bulge * 3.5
        for y in range(-12, 4):
            for x in range(0, 12):
                if math.hypot(x - 5, y + 4) <= r:
                    s.px(x, y, (60, 52, 56) if math.hypot(x - 5.6, y + 4.6) > r - 1 else (110, 96, 100))
    if shred:
        for x, y in ((5, -2), (6, -6), (-5, -1), (3, 0), (-2, -9)):
            s.px(x, y, (40, 34, 36))
    return s


def pump_sprite(ext):
    s = Sprite()
    s.rect(0, -8, 0, -1, (60, 62, 70))
    s.rect(-1, 0, 1, 0, (40, 40, 44))
    s.rect(0, -9 - ext, 0, -9, (170, 170, 176))
    s.rect(-2, -10 - ext, 2, -10 - ext, (30, 30, 34))
    return s


def bag_sprite(upside=False):
    s = Sprite()
    s.rect(-3, -3, 3, 0, (40, 40, 46))
    s.rect(-3, -3, 3, -3, (200, 60, 60))
    if upside:
        f = Sprite()
        for (x, y), c in s.items():
            f[(x, -3 - y)] = c
        f.rect(-2, 1, 2, 1, (14, 14, 16))
        return f
    return s


def battery_icon(on):
    s = Sprite()
    for x in range(0, 8):
        s.px(x, 0, (235, 235, 235))
        s.px(x, 4, (235, 235, 235))
    for y in range(0, 5):
        s.px(0, y, (235, 235, 235))
        s.px(7, y, (235, 235, 235))
    s.rect(8, 1, 8, 3, (235, 235, 235))
    if on:
        s.rect(1, 1, 1, 3, (240, 40, 40))
    return s


def bubble(icon):
    s = Sprite()
    s.rect(0, 0, 14, 9, (246, 246, 246))
    for k in [(0, 0), (14, 0), (0, 9), (14, 9)]:
        del s[k]
    s.px(3, 10, (246, 246, 246))
    s.px(2, 11, (246, 246, 246))
    if icon == "car":
        s.rect(3, 4, 11, 6, (210, 50, 50))
        s.rect(5, 2, 9, 3, (210, 50, 50))
        s.rect(6, 3, 8, 3, (140, 200, 240))
        s.px(4, 7, (30, 30, 30))
        s.px(10, 7, (30, 30, 30))
        s.px(11, 5, (255, 230, 120))
    return s


def ring_icon(k):
    s = Sprite()
    for i in range(3):
        if (k + i) % 3 != 2:
            for dy in (-1, 0, 1):
                s.px(2 * i + (0 if dy == 0 else -1) + 1, dy - i * 0, (255, 255, 255))
    return s


def house(w, hgt, wall, roof, windows, door_x):
    s = Sprite()
    for y in range(-hgt, 0):
        for x in range(w):
            s.px(x, y, sh(wall, 0.94 if (x * 7 + y * 3) % 11 == 0 else 1.0))
    rh = (w + 3) // 2
    for i in range(rh):
        x0, x1 = -1 + i, w - i
        if x1 < x0:
            break
        s.rect(x0, -hgt - 1 - i, x1, -hgt - 1 - i, sh(roof, 0.88 if i % 2 else 1.0))
    s.rect(door_x, -8, door_x + 3, -1, (110, 68, 40))
    s.px(door_x + 3, -4, (220, 200, 120))
    for wx, wy in windows:
        s.rect(wx - 1, wy - 1, wx + 4, wy + 4, (236, 236, 228))
        s.rect(wx, wy, wx + 3, wy + 3, (120, 160, 196))
    return s


def church():
    s = Sprite()
    stone = (196, 186, 166)
    s.rect(16, -26, 38, -1, stone)
    for i in range(12):
        s.rect(15 + i, -27 - i, 39 - i, -27 - i, (150, 70, 56) if i % 2 else (166, 80, 62))
    s.rect(2, -62, 15, -1, sh(stone, 0.95))
    for i in range(14):
        x0, x1 = 2 + i // 2, 15 - i // 2
        s.rect(x0, -63 - i, x1, -63 - i, (70, 76, 92))
    s.rect(8, -82, 9, -77, (220, 190, 80))
    s.rect(7, -80, 10, -80, (220, 190, 80))
    s.rect(6, -30, 11, -24, (60, 60, 70))
    s.rect(7, -12, 10, -1, (96, 60, 36))
    s.rect(21, -18, 23, -10, (120, 150, 200))
    s.rect(31, -18, 33, -10, (120, 150, 200))
    return s


CLOCK = (8, -48)  # centre du cadran dans le sprite église


def streetlamp():
    s = Sprite()
    s.rect(0, -46, 0, -1, (40, 42, 50))
    s.rect(-1, 0, 1, 0, (40, 42, 50))
    s.rect(0, -46, 3, -46, (40, 42, 50))
    s.rect(2, -45, 4, -45, (40, 42, 50))
    return s


def bench():
    back, seat = Sprite(), Sprite()
    back.rect(0, -9, 16, -8, (136, 90, 52))
    back.rect(0, -7, 16, -7, (110, 72, 42))
    seat.rect(-1, -4, 17, -4, (150, 100, 60))
    seat.rect(0, -3, 0, 0, (40, 40, 46))
    seat.rect(16, -3, 16, 0, (40, 40, 46))
    return back, seat


def car_sprite(n):
    s = Sprite()
    body = (92, 112, 150)
    s.rect(-13, -8, 13, -3, body)
    s.rect(-13, -8, 13, -8, sh(body, 1.15))
    s.rect(-7, -13, 6, -9, body)
    win = (40, 50, 70) if n > 0.5 else (150, 196, 230)
    s.rect(-6, -12, -1, -9, win)
    s.rect(1, -12, 5, -9, win)
    for cx in (-8, 8):
        for y in range(-5, 1):
            for x in range(cx - 3, cx + 4):
                if math.hypot(x - cx, y + 2.5) <= 3:
                    s.px(x, y, (26, 26, 28) if math.hypot(x - cx, y + 2.5) > 1.3 else (150, 150, 156))
    s.rect(-13, -6, -13, -5, (255, 240, 170))
    s.rect(13, -6, 13, -5, (220, 40, 40))
    return s


def cow():
    s = Sprite()
    s.rect(0, -8, 11, -4, (245, 245, 240))
    for x, y in ((2, -7), (3, -6), (7, -5), (8, -7), (9, -6)):
        s.px(x, y, (30, 30, 30))
    s.rect(12, -10, 14, -7, (245, 245, 240))
    s.px(14, -8, (30, 30, 30))
    s.px(13, -6, (236, 170, 170))
    s.px(12, -11, (220, 210, 180))
    for x in (1, 3, 8, 10):
        s.rect(x, -3, x, 0, (60, 50, 46))
    s.px(-1, -7, (40, 40, 40))
    return s


def warn_sign():
    s = Sprite()
    s.rect(0, -10, 0, -1, (150, 150, 156))
    for i in range(6):
        s.rect(-i, -16 + i, i, -16 + i, (220, 40, 40))
    for i in range(1, 5):
        s.rect(-i + 1, -15 + i, i - 1, -15 + i, (245, 245, 245))
    for i in range(3):
        s.px(-2 + i * 2, -13 + i, (30, 30, 30))
        s.px(-1 + i * 2, -13 + i, (30, 30, 30))
    return s


def turbine(blade_a):
    s = Sprite()
    s.rect(0, -28, 0, -1, (232, 234, 240))
    s.px(0, -29, (200, 202, 210))
    for k in range(3):
        a = blade_a + k * 2 * math.pi / 3
        s.line(0, -29, 8 * math.cos(a), -29 + 8 * math.sin(a), (244, 246, 250))
    return s


def tree_tile():
    w, h = 640, 34
    tile = np.zeros((h, w, 4), np.float32)
    x = 0
    r = np.random.default_rng(5)
    while x < w - 16:
        rad = r.integers(4, 8)
        cx = x + rad
        base = h - 1
        trunk_h = r.integers(3, 6)
        tile[base - trunk_h:base + 1, cx:cx + 2] = (96, 64, 40, 1)
        g = np.array([(52, 120, 60), (64, 140, 64), (44, 104, 56)][r.integers(0, 3)], np.float32)
        cy = base - trunk_h - rad + 1
        for yy in range(cy - rad, cy + rad + 1):
            for xx in range(cx - rad, cx + rad + 2):
                if 0 <= yy < h and 0 <= xx < w and math.hypot(xx - cx - 0.5, yy - cy) <= rad:
                    k = 1.18 if (xx - cx) + (yy - cy) < -rad * 0.6 else (0.85 if r.random() < 0.15 else 1.0)
                    tile[yy, xx] = (*np.minimum(255, g * k), 1)
        x += rad * 2 + r.integers(-2, 10)
    return tile


def cloud_tile():
    w, h = 800, 22
    tile = np.zeros((h, w, 4), np.float32)
    r = np.random.default_rng(9)
    for _ in range(14):
        cx, cy = r.integers(0, w), r.integers(6, 15)
        for _ in range(5):
            ex, ey = cx + r.integers(-12, 12), cy + r.integers(-3, 3)
            rx, ry = r.integers(6, 13), r.integers(3, 6)
            for yy in range(max(0, ey - ry), min(h, ey + ry + 1)):
                for xx in range(ex - rx, ex + rx + 1):
                    if ((xx - ex) / rx) ** 2 + ((yy - ey) / ry) ** 2 <= 1:
                        shade = 0.9 if yy > ey + ry * 0.4 else 1.0
                        tile[yy, xx % w] = (248 * shade, 248 * shade, 252 * shade, 1)
    return tile


TREES = tree_tile()


def bush_tile():
    w, h = 720, 40
    tile = np.zeros((h, w, 4), np.float32)
    r = np.random.default_rng(12)
    x = 0
    while x < w - 30:
        rad = int(r.integers(6, 13))
        cx = x + rad
        cy = h - 1 - rad // 2
        g = np.array([(46, 112, 52), (60, 134, 60), (38, 96, 48)][r.integers(0, 3)], np.float32)
        for yy in range(cy - rad, h):
            for xx in range(cx - rad - 3, cx + rad + 4):
                if 0 <= yy < h and 0 <= xx < w and ((xx - cx) / (rad + 3)) ** 2 + ((yy - cy) / rad) ** 2 <= 1:
                    k = 1.2 if (xx - cx) + (yy - cy) < -rad * 0.7 else (0.82 if r.random() < 0.18 else 1.0)
                    c = g * k
                    if r.random() < 0.025:
                        c = np.array([(240, 90, 120), (250, 230, 110), (250, 250, 250)][r.integers(0, 3)], np.float32)
                    tile[yy, xx] = (*np.minimum(255, c), 1)
        x += rad * 2 + int(r.integers(4, 40))
    return tile


BUSHES = bush_tile()
CLOUDS = cloud_tile()


def blit_tile(img, mask, tile, cols, ybottom):
    th, tw = tile.shape[:2]
    h = img.shape[0]
    ys = np.arange(th) + ybottom - th + 1
    ok = (ys >= 0) & (ys < h)
    for x in range(W):
        col = tile[:, cols[x] % tw]
        sel = ok & (col[:, 3] > 0)
        img[ys[sel], x] = col[sel, :3]
        mask[ys[sel], x] = False


def blit(img, spr, ox, oy, mask=None):
    h = img.shape[0]
    ox, oy = int(round(ox)), int(round(oy))
    for (dx, dy), c in spr.items():
        X, Y = ox + dx, oy + dy
        if 0 <= X < W and 0 <= Y < h:
            img[Y, X] = c
            if mask is not None:
                mask[Y, X] = False


# ---------------------------------------------------------------- monde
def landscape(h, cam_x, cam_y, t, theme, road_fn, base, lower_branch=None, village_x=None):
    """Décor défilant (parallaxe) d'une vue de hauteur h. Retourne image et masque du ciel."""
    top, hor = sky_cols(t)
    rows = np.arange(h)[:, None].astype(np.float32)
    k = np.clip(rows / (base - 10), 0, 1)
    img = np.repeat((np.array(top) * (1 - k) + np.array(hor) * k)[:, None, :] * np.ones((1, W, 1)), 1, axis=1)
    img = img.reshape(h, W, 3).astype(np.float32)
    mask = np.ones((h, W), bool)
    xs = np.arange(W)
    cx = int(round(cam_x))
    # nuages
    blit_tile(img, mask, CLOUDS, (np.floor((cx * 0.15 + t * 3)) + xs).astype(int), int(base * 0.22))
    # montagnes lointaines
    if theme != "wheat":
        xf = cam_x * 0.25 + xs
        ym = base - 44 - 22 * (0.5 + 0.5 * np.sin(xf * 0.035)) - 12 * np.sin(xf * 0.011 + 1) - cam_y * 0.25
        m = rows >= ym[None, :]
        tex = 0.94 + 0.08 * hashf(np.floor(xf).astype(int)[None, :], rows.astype(int), 3)
        col = np.array((126, 150, 192), np.float32)
        snow = rows < (ym[None, :] + 3)
        c = np.where(snow[..., None] & (ym[None, :, None] < base - 66), np.array((236, 240, 248), np.float32),
                     col * tex[..., None])
        img[m] = c[m]
        mask &= ~m
    # collines
    xh = cam_x * 0.45 + xs
    yh = base - 14 - 8 * np.sin(xh * 0.045) - 4 * np.sin(xh * 0.13 + 2) - cam_y * 0.45
    m = rows >= yh[None, :]
    hill = np.array((132, 180, 96) if theme == "wheat" else (92, 156, 92), np.float32)
    tex = 0.93 + 0.1 * hashf(np.floor(xh).astype(int)[None, :], rows.astype(int), 4)
    img[m] = (hill * tex[..., None])[m]
    mask &= ~m
    if theme == "wheat":
        for k in range(-1, 4):
            tx = (math.floor(cam_x * 0.5 / 46) + k) * 46 + 20
            sx = round(tx - cam_x * 0.5)
            blit(img, turbine(t * 2.4 + k), sx, round(base - 10 - cam_y * 0.5), mask)
    else:
        blit_tile(img, mask, TREES, (np.floor(cam_x * 0.7) + xs).astype(int) + (300 if theme == "river" else 0),
                  int(round(base - 3 - cam_y * 0.7)))
    # sol, route et bas-côtés
    xw = (cx + xs).astype(np.int64)
    rs = np.round(road_fn(xw.astype(float)) - cam_y)[None, :]
    yw = (rows + cam_y).astype(np.int64)
    r = rows - rs
    hsh = hashf(xw[None, :], yw, 1)
    g = np.zeros((h, W, 3), np.float32)
    grass = np.array((88, 160, 72), np.float32) * (0.86 + 0.22 * hsh)[..., None]
    g[:] = grass
    if theme == "river":
        bank = (r >= 10) & (r < 12)
        water = r >= 12
        g[bank] = (150, 126, 84)
        wave_ = hashf((xw[None, :] + int(t * 9)) // 3, yw, 2) > 0.93
        wc = np.where(wave_[..., None], np.array((170, 212, 240), np.float32), np.array((52, 112, 176), np.float32))
        g[water] = wc[water]
        reed = (r >= 8) & (r < 12) & (hashf(xw[None, :], 0 * yw, 7) > 0.9)
        g[reed] = (60, 110, 50)
    elif theme == "wheat":
        f = r >= 8
        wheat = np.array((224, 186, 86), np.float32) * np.where(((xw[None, :] + yw) % 3) == 0, 0.86, 1.0)[..., None]
        g[f] = wheat[f]
        pop = f & (hsh > 0.975)
        g[pop] = (220, 40, 40)
    else:
        fl = hsh > 0.985
        g[fl & (r > 8)] = (250, 240, 120)
        if village_x is not None:
            vill = (xw[None, :] >= village_x - 10) & (r >= 6) & (r < 24)
            cob = np.array((156, 146, 134), np.float32) * np.where(((xw[None, :] // 3 + yw // 2) % 2) == 0, 0.92, 1.0)[..., None]
            cob = np.where((((yw % 3) == 0) | (((xw[None, :] + (yw // 3) * 2) % 5) == 0))[..., None],
                           np.array((120, 112, 104), np.float32), cob)
            g[vill] = cob[vill]
    band = np.zeros((h, W, 3), np.float32)
    asph = np.array((70, 72, 78), np.float32) * (0.9 + 0.14 * hsh)[..., None]
    band[:] = asph
    band[r == 0] = (172, 172, 176)
    dash = (r == 2) & (((xw[None, :] // 6) % 2) == 0)
    band[dash] = (226, 226, 214)
    band[r == 5] = (104, 104, 110)
    ground = r >= 0
    roadm = (r >= 0) & (r < 6)
    out = np.where(roadm[..., None], band, g)
    if lower_branch is not None:
        rl = rows - (np.round(lower_branch(xw.astype(float)) - cam_y))[None, :]
        lb = (rl >= 0) & (rl < 6) & (xw[None, :] < 66)
        lband = np.zeros((h, W, 3), np.float32)
        lband[:] = asph
        lband[rl == 0] = (172, 172, 176)
        lband[(rl == 2) & (((xw[None, :] // 6) % 2) == 0)] = (226, 226, 214)
        lband[rl == 5] = (104, 104, 110)
        out = np.where(lb[..., None], lband, out)
        edge = (rl == -1) & (xw[None, :] < 66) & (r > 0)
        out[edge] = out[edge] * 0.8
    img[ground] = out[ground]
    mask &= ~ground
    if theme == "merged" and h == H:
        # premier plan : buissons qui défilent plus vite que la route
        fb = BUSHES[:, :, 3] > 0
        th_ = BUSHES.shape[0]
        ybot = H - 1
        for x in range(W):
            tc = int(cam_x * 1.4 + x) % BUSHES.shape[1]
            ys_ = np.arange(th_) + ybot - th_ + 1
            sel = (ys_ >= 0) & (ys_ < h) & fb[:, tc]
            sel &= ys_ > rs[0, x] + 26
            img[ys_[sel], x] = BUSHES[sel, tc, :3]
    if theme == "merged":
        fence_ok = (xw[None, :] >= 70) & ((village_x is None) | (xw[None, :] < (village_x or 0) - 14))
        post = (r >= -4) & (r <= -1) & ((xw[None, :] % 14) == 0) & fence_ok
        rail = (r == -3) & fence_ok
        img[post | rail] = (124, 90, 56)
        mask &= ~(post | rail)
    return img, mask


# ---------------------------------------------------------------- trajectoires
def integrate(keys, t0, x0):
    xs = np.zeros(NF)
    x = x0
    for f in range(NF):
        t = f / FPS
        if t >= t0:
            v = keyed([(a, (b,)) for a, b in keys], t)[0]
            x += v / FPS
        xs[f] = x
    return xs


SPLIT_END, MERGE_T = 5.4, 6.0
XA_S = integrate([(0, 0), (0.5, 0), (1.6, 34), (99, 34)], 0, 46)
XC_S = integrate([(0, 0), (0.9, 0), (2.0, 34), (99, 34)], 0, 46)
V_MAIN = [(6.0, 32), (8.4, 32), (8.6, 34), (11.8, 34), (12.4, 0), (15.4, 0), (16.2, 34), (17.0, 36),
          (18.0, 60), (19.0, 62), (19.4, 26), (21.4, 18), (21.8, 22), (22.0, 16), (22.4, 0), (99, 0)]
XM = integrate(V_MAIN, MERGE_T, -20)


def XAt(t):
    return XM[min(NF - 1, int(t * FPS))]


XD0, XD1 = XAt(17.0) + 10, XAt(19.0)
XC0, XC1 = XAt(19.3), XAt(21.6)
XV = XAt(22.4)
CAMV = XV - 22  # cadrage final du village (la caméra glisse un peu à droite)


def main_road(x):
    x = np.asarray(x, float)
    return ROAD + 40 * tramp((x - XD0) / (XD1 - XD0)) - 66 * tramp((x - XC0) / (XC1 - XC0))


def s_branch(x):
    return 1 - ease_v((np.asarray(x, float) + 20) / 82)


def ease_v(u):
    u = np.clip(u, 0, 1)
    return u * u * (3 - 2 * u)


def upper_road(x):
    x = np.asarray(x, float)
    return np.where(x < 62, ROAD - 60 * s_branch(x), main_road(x))


def lower_road(x):
    return ROAD + 62 * s_branch(x)


def slope(fn, x):
    return math.atan2(float(fn(x + 1.5)) - float(fn(x - 1.5)), 3.0)


VILLAGE_Y = float(main_road(XV))
HOUSES = [(CAMV + 46, house(24, 22, (232, 214, 180), (176, 76, 56), [(4, -17), (16, -17), (16, -9)], 5),
           [(4, -17), (16, -17), (16, -9)]),
          (CAMV + 72, house(26, 28, (214, 200, 220), (90, 92, 110), [(4, -23), (17, -23), (4, -13), (17, -13)], 11),
           [(4, -23), (17, -23), (4, -13), (17, -13)])]
WIN_OFF = [33.4, 34.6, 32.2, 99, 33.0, 99, 31.9]
LAMP_X, BENCH_X = CAMV + 58, CAMV + 64
BENCH_Y = VILLAGE_Y + 19
COW_X = XAt(10.0) + 60
SIGN_X = XD0 - 24
BENCH_BACK, BENCH_SEAT = bench()

PARTS = [(math.cos(a) * sp, math.sin(a) * sp - 18, c) for a, sp, c in
         [(rng.uniform(0, 2 * math.pi), rng.uniform(20, 55), [(255, 250, 220), (255, 210, 80), (60, 52, 56)][i % 3])
          for i in range(26)]]
STARS = [(int(rng.integers(0, W)), int(rng.integers(0, 110)), rng.random()) for _ in range(70)]


# ---------------------------------------------------------------- scènes
def render_split(t, f):
    out = np.zeros((H, W, 3), np.float32)
    for half, (X, spec, theme) in enumerate(((XA_S[f], A, "river"), (XC_S[f], C, "wheat"))):
        cam_x = max(0.0, X - 60)
        img, mask = landscape(HALF_H, cam_x, 0, t, theme, lambda x: np.full_like(x, ROAD_HALF), ROAD_HALF)
        if theme == "river":
            hs = house(30, 26, (238, 226, 200), (170, 70, 52), [(4, -20), (21, -20), (21, -11)], 6)
            blit(img, hs, 6 - cam_x, ROAD_HALF - 1)
            blit(img, BENCH_SEAT, 40 - cam_x, ROAD_HALF - 2)
        else:
            b = Sprite()
            b.rect(0, -60, 32, -1, (196, 170, 150))
            for wy in range(-56, -8, 9):
                for wx in (3, 12, 21):
                    b.rect(wx, wy, wx + 5, wy + 4, (120, 160, 196))
                    b.rect(wx, wy + 4, wx + 5, wy + 4, (160, 60, 60))
            b.rect(13, -8, 19, -1, (80, 60, 44))
            blit(img, b, 4 - cam_x, ROAD_HALF - 1)
        speed = XA_S[f] - XA_S[max(0, f - 1)] if half == 0 else XC_S[f] - XC_S[max(0, f - 1)]
        spr = rider(spec, X / 4.2, X / 2.6)
        blit(img, spr, X - cam_x, ROAD_HALF + 3)
        y0 = 0 if half == 0 else HALF_H + 2
        out[y0:y0 + HALF_H] = img
    out[HALF_H:HALF_H + 2] = (16, 16, 20)
    return out


def render_merged(t, f):
    X = XM[f]
    xc = X
    xa = X + 14 * ease((t - 8.4) / 0.9)
    cam_x = max(0.0, xc - 52) + 30 * ease((t - 22.4) / 0.7)
    cam_y = float(main_road(cam_x + 59)) - ROAD
    vx = CAMV if t > 19 else None
    img, sky = landscape(H, cam_x, cam_y, t, "merged", upper_road, ROAD, lower_branch=lower_road if cam_x < 80 else None,
                         village_x=vx)
    items = []   # (profondeur, sprite, x monde, y monde)
    emit = []    # (sprite, x monde, y monde) dessinés après l'éclairage
    lights = []  # (x monde, y monde, rayon, intensité, couleur)
    n = night(t)
    rd = lambda x: float(upper_road(x))
    th_ = lambda x: x / 2.6

    # décor
    items.append((ROAD + 30, cow(), COW_X, ROAD + 22))
    items.append((rd(SIGN_X) - 1, warn_sign(), SIGN_X, rd(SIGN_X) - 1))
    if vx is not None:
        ch = church()
        items.append((VILLAGE_Y - 2, ch, CAMV + 98, VILLAGE_Y - 2))
        for hx, hs, wins in HOUSES:
            items.append((VILLAGE_Y - 2, hs, hx, VILLAGE_Y - 2))
            if n > 0.15:
                for i, (wx, wy) in enumerate(wins):
                    k = HOUSES.index((hx, hs, wins)) * 3 + i
                    if t < WIN_OFF[k % len(WIN_OFF)] and t > 27.6 + 0.3 * (k % 4):
                        sp = Sprite()
                        sp.rect(0, 0, 3, 3, (255, 214, 120))
                        sp.px(0, 0, (255, 236, 170))
                        emit.append((sp, hx + wx, VILLAGE_Y - 2 + wy))
        # horloge du clocher : les aiguilles tournent pendant l'attente
        spin = 1.5 * tramp((t - 31.0) / 3.0) if t > 31 else 0.0
        mins = 2 * math.pi * (0.75 + spin)
        hrs = 2 * math.pi * (19 / 12 + spin / 12)
        clk = Sprite()
        for y in range(-4, 5):
            for x in range(-4, 5):
                d = math.hypot(x, y)
                if d <= 4.2:
                    clk.px(x, y, (246, 240, 220) if d < 3.4 else (60, 60, 70))
        clk.line(0, 0, 3 * math.sin(mins), -3 * math.cos(mins), (30, 30, 30))
        clk.line(0, 0, 2 * math.sin(hrs), -2 * math.cos(hrs), (180, 40, 40))
        ccx, ccy = CAMV + 98 + CLOCK[0], VILLAGE_Y - 2 + CLOCK[1]
        if n > 0.3:
            emit.append((clk, ccx, ccy))
        else:
            items.append((VILLAGE_Y - 1, clk, ccx, ccy))
        lamp_on = t > 29.6 and not (29.6 < t < 29.95 and int(t * 20) % 3 == 0)
        items.append((BENCH_Y + 1, streetlamp(), LAMP_X, BENCH_Y))
        if lamp_on:
            hd = Sprite()
            hd.rect(0, 0, 2, 0, (255, 236, 170))
            emit.append((hd, LAMP_X + 2, BENCH_Y - 44))
            lights.append((LAMP_X + 3, BENCH_Y - 30, 26, 0.9, (1.0, 0.86, 0.6)))
        items.append((BENCH_Y - 3, BENCH_BACK, BENCH_X, BENCH_Y))
        items.append((BENCH_Y - 1, BENCH_SEAT, BENCH_X, BENCH_Y))

    yA = lambda x: rd(x) + 1
    yC = lambda x: (float(lower_road(x)) if x < 62 else rd(x)) + 4
    fA = lambda x: slope(upper_road, x)
    fC = lambda x: slope(lower_road if x < 62 else upper_road, x)

    # ---------- coachs
    def ride(spec, x, y, ang, **kw):
        spr = rider(spec, x / 4.2, th_(x), **kw)
        items.append((y, rotate(spr, ang), x, y))

    stop1 = 12.4
    xs1 = XAt(stop1)
    if t < 11.8:
        ride(A, xa, yA(xa), fA(xa), wave=8.3 < t < 8.8)
        ride(C, xc, yC(xc), fC(xc), wave=8.45 < t < 8.95)
    elif t < 12.6:
        wob = round(math.sin(t * 40)) if t < 12.3 else 0
        ride(A, xa, yA(xa), 0)
        ride(C, xc, yC(xc) + (1 if wob > 0 else 0), 0, flat=True)
    elif t < 15.3:
        # première crevaison : on retourne le vélo, on démonte, on galère
        ya, yc = yA(xa), yC(xc)
        items.append((ya - 1, bike_sprite(A), xa + 21, ya - 1))
        if t < 12.85:
            items.append((yc - 1, bike_sprite(C, flat=True), xc, yc - 1))
            items.append((ya, person(A, arms="shock", face="shock"), xa, ya))
            items.append((yc + 1, person(C, arms="down", face="shock"), xc + 10, yc + 1))
        else:
            fixing = t < 14.9
            items.append((yc - 1, bike_sprite(C, upside=True, no_rear=fixing), xc - 12, yc - 1))
            lever_t = 13.6
            w = int(t * 7) % 2
            if t < 14.0:
                cpose = person(C, arms="clap", squat=4, wave=w, face="pain" if t > 13.2 else "smile")
            elif t < 14.9:
                cpose = person(C, arms="forward", squat=4, face="pain")
            else:
                cpose = person(C, arms="down", face="smile")
            items.append((yc + 1, cpose, xc + 2, yc + 1))
            if fixing:
                items.append((yc + 2, wheel_sprite(t * 0.3, tire_off=t < 14.0), xc + 2, yc + 2))
            if 13.0 < t < 14.9:
                k = (t * 3) % 1
                d = Sprite()
                d.px(0, 0, (120, 190, 255))
                items.append((999, d, xc + 8, yc - 24 + round(k * 6)))
            # le démonte-pneu s'envole et finit sur le casque de l'autre
            if lever_t < t < 14.0:
                u = (t - lever_t) / 0.4
                lv = Sprite()
                lv.rect(0, 0, 1, 0, (190, 190, 200))
                items.append((999, lv, xc + 4 + (xa + 7 - xc) * u, yc - 12 - 26 * math.sin(math.pi * u) + (ya - 27 - yc + 12) * u))
            pumping = 14.0 < t < 14.9
            if t < 14.0:
                apose = person(A, arms="down", face="smile")
            elif t < 14.5:
                apose = person(A, arms="forward", face="pain", squat=1 if pumping and int(t * 10) % 2 else 0)
            elif pumping:
                apose = person(A, arms="forward", squat=1 if int(t * 10) % 2 else 0)
            else:
                apose = person(A, arms="down")
            items.append((ya, apose, xa + 7, ya))
            if pumping:
                ext = 3 if int(t * 10) % 2 == 0 else 0
                items.append((ya + 0.5, pump_sprite(ext), xa - 1, ya + 2))
                hose = Sprite()
                hose.line(xa - 1, ya + 2, xc + 8, yc - 2, (40, 40, 44))
                items.append((ya + 0.6, hose, 0, 0))
            if 14.0 < t < 14.6:
                for i in range(3):
                    a = t * 9 + i * 2.1
                    st = Sprite()
                    st.px(0, 0, (255, 236, 120))
                    items.append((999, st, xa + 7 + 5 * math.cos(a), ya - 27 + 1.6 * math.sin(a)))
    elif t < 22.0:
        mode = "ride"
        if XD0 - 4 < xc < XD1 and t < 19.2:
            mode = "coast"
        if t > 19.4:
            mode = "stand"
        ride(A, xa, yA(xa), fA(xa), mode=mode)
        ride(C, xc, yC(xc), fC(xc), mode=mode)
        if t > 19.8:
            for (sx, sp) in ((xa, A), (xc, C)):
                if (t * 2.5) % 1 < 0.5:
                    d = Sprite()
                    d.px(0, 0, (120, 190, 255))
                    items.append((999, d, sx + 1, (yA(sx) if sp is A else yC(sx)) - 30 + round(((t * 2.5) % 1) * 8)))
    else:
        village_scene(t, xa, xc, yA(xa), yC(xc), items, emit, lights, n)

    # ---------- dessin
    items.sort(key=lambda it: it[0])
    for _, spr, wx, wy in items:
        blit(img, spr, wx - cam_x, wy - cam_y, sky)

    # ---------- lumière
    amb = np.array(keyed(AMB, t), np.float32)
    L = np.ones((H, W, 3), np.float32) * amb
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    for lx, ly, rad, inten, col in lights:
        g = np.exp(-((xs - (lx - cam_x)) ** 2 + (ys - (ly - cam_y)) ** 2) / (2 * rad ** 2)) * inten
        L += g[..., None] * np.array(col, np.float32)
    beam = render_beams(t, cam_x, cam_y, xs, ys)
    L += beam
    lit = np.where(sky[..., None], img, img * L)
    # étoiles, lune, soleil
    if n > 0.4:
        for (sx, sy, ph) in STARS:
            if sky[sy, sx]:
                b = (n - 0.4) / 0.6 * (0.6 + 0.4 * math.sin(t * 3 + ph * 20))
                lit[sy, sx] = lit[sy, sx] * (1 - b) + np.array((255, 255, 230)) * b
    if t < 24:
        for i in range(4):
            bx = (t * 9 + i * 37) % 170 - 20
            by = 58 + i * 7 + 3 * math.sin(t * 2 + i)
            wing = int(t * 6 + i) % 2
            for dx, dy in ((-2, -wing), (-1, 0), (0, 1), (1, 0), (2, -wing)):
                X_, Y_ = int(bx + dx), int(by + dy)
                if 0 <= X_ < W and 0 <= Y_ < H and sky[Y_, X_]:
                    lit[Y_, X_] = (40, 44, 60)
    sun_y = 26 + 100 * clamp01((t - 21) / 9)
    if t < 30.5:
        sc = np.array(lerpc((255, 244, 170), (255, 150, 80), clamp01((t - 22) / 6)), np.float32)
        for y in range(int(sun_y) - 5, int(sun_y) + 6):
            for x in range(108 - 5, 108 + 6):
                if 0 <= y < H and math.hypot(x - 108, y - sun_y) <= 5 and sky[y, x]:
                    lit[y, x] = sc
    if n > 0.3:
        my = 34 - 10 * clamp01((t - 29) / 5)
        for y in range(int(my) - 5, int(my) + 6):
            for x in range(26 - 5, 26 + 6):
                d = math.hypot(x - 26, y - my)
                if d <= 4.6 and math.hypot(x - 28.5, y - my + 1.5) > 3.8 and 0 <= y < H and sky[y, x]:
                    lit[y, x] = lerpc(tuple(lit[y, x]), (246, 240, 210), min(1, (n - 0.3) * 2))
    for spr, wx, wy in emit:
        blit(lit, spr, wx - cam_x, wy - cam_y)
    return lit


BEAM_STATE = {}


def render_beams(t, cam_x, cam_y, xs, ys):
    out = np.zeros((H, W, 3), np.float32)
    for (bx, by, direction, length, inten) in BEAM_STATE.get(round(t * FPS), []):
        sx, sy = bx - cam_x, by - cam_y
        dx = (xs - sx) * direction
        spread = 2 + dx * 0.22
        g = np.where(dx > 0, np.exp(-((ys - sy - dx * 0.06) / np.maximum(spread, 1)) ** 2) * np.exp(-dx / length), 0)
        out += g[..., None] * np.array((1.0, 0.94, 0.75), np.float32) * inten
    return out


def village_scene(t, xa, xc, ya, yc, items, emit, lights, n):
    f = round(t * FPS)
    # deuxième crevaison en haut de la côte, au village
    if t < 22.6:
        items.append((ya, rider(A, xa / 4.2, xa / 2.6), xa, ya))
        items.append((yc, rider(C, xc / 4.2, xc / 2.6, flat=True), xc, yc))
        return
    BIKE_C = (xc - 12, yc - 1)
    exploded = t >= 24.6
    leaving = t >= 29.4
    if not leaving:
        items.append((ya - 1, bike_sprite(A), xa + 21, ya - 1))
    items.append((yc - 1, bike_sprite(C, upside=True, no_rear=True), *BIKE_C))
    # roue posée devant lui
    if t < 30.4:
        wx, wy = xc + 2, yc + 2
    else:
        wx, wy = xc + 2, yc + 3
    bul = clamp01((t - 23.6) / 1.0) if 23.6 < t < 24.6 else 0
    items.append((yc + 2, wheel_sprite(0.3, tire_off=t < 23.6, bulge=bul, shred=exploded), wx, wy))

    jump = 3 if 24.6 <= t < 24.9 else 0
    # --- C (celui qui a crevé)
    if t < 22.9:
        cp = person(C, arms="shock", face="shock")
        cx_, cy_ = xc + 10, yc + 1
    elif t < 23.6:
        cp = person(C, arms="clap", squat=4, wave=int(t * 7) % 2, face="pain")
        cx_, cy_ = xc + 2, yc + 1
    elif t < 24.6:
        cp = person(C, arms="forward", squat=4, face="smile")
        cx_, cy_ = xc + 2, yc + 1
    elif t < 25.2:
        cp = person(C, arms="shock", face="shock")
        cx_, cy_ = xc + 2, yc + 1
    elif t < 26.2:
        cp = person(C, extra="facepalm", face="pain")
        cx_, cy_ = xc + 2, yc + 1
    elif t < 27.0:
        cp = person(C, arms="forward", extra="phone_hold", face="shock")
        cx_, cy_ = xc + 2, yc + 1
    elif t < 27.4:
        cp = person(C, arms="down", face="smile")
        cx_, cy_ = xc + 2, yc + 1
    elif t < 29.3:
        cp = person(C, arms="down", extra="phone_ear")
        cx_, cy_ = xc + 2, yc + 1
    elif t < 30.4:
        cp = person(C, arms="waveR" if t < 30.0 else "down", wave=int(t * 6) % 2, face="smile" if t < 29.9 else "pain")
        cx_, cy_ = xc + 2, yc + 1
    else:
        # il marche jusqu'au banc et attend, la nuit tombe
        sx, sy = xc + 2, yc + 1
        tx, ty = BENCH_X + 8, BENCH_Y + 1
        u = clamp01((t - 30.4) / 0.8)
        cx_, cy_ = sx + (tx - sx) * u, sy + (ty - sy) * u
        if u < 1:
            cp = person(C, walk=(t - 30.4) * 8, face="pain")
        elif t < 32.0:
            cp = person(C, squat=4, arms="down", face="pain")
        elif t < 32.9:
            cp = None
            body = person(C, arms="down", face="dizzy")
            ly = Sprite()
            for (x, y), c in body.items():
                ly[(-y, x)] = c
            items.append((BENCH_Y + 0.5, ly, BENCH_X - 6, BENCH_Y - 10))
        elif t < 33.7:
            cp = person(C, squat=4, arms="forward", face="dizzy")
        elif t < 34.2:
            cp = person(C, arms="shock", face="shock")
        else:
            cp = person(C, arms="up", wave=int(t * 6) % 2, face="smile")
            jump = round(abs(math.sin(t * 9)) * 2)
    if cp is not None:
        items.append((cy_, cp, cx_, cy_ - (jump if t < 25 or t >= 34.2 else 0)))

    # --- A (celui qui prête son téléphone)
    if t < 23.6:
        ap = person(A, arms="shock" if t < 23.0 else "down", face="shock" if t < 23.0 else "smile")
    elif t < 24.6:
        ap = person(A, arms="forward", squat=1 if int(t * (10 + 8 * (t - 23.6))) % 2 else 0, face="pain")
    elif t < 25.2:
        ap = person(A, arms="shock", face="shock")
    elif t < 26.2:
        ap = person(A, arms="up", face="shock")
        bag = bag_sprite(upside=True)
        items.append((ya + 0.1, bag, xa + 7 + round(math.sin(t * 30)), ya - 32))
        if t > 25.5:
            u = (t - 25.5) / 0.7
            moth = Sprite()
            moth.px(0, 0, (236, 232, 220))
            if int(t * 16) % 2:
                moth.px(-1, -1, (236, 232, 220))
                moth.px(1, -1, (236, 232, 220))
            items.append((999, moth, xa + 7 + 6 * math.sin(u * 9), ya - 34 - 30 * u))
    elif t < 27.0:
        ap = person(A, arms="down", face="smile")
    elif t < 27.4:
        ap = person(A, arms="pointL", extra="phone_give", face="smile")
    elif t < 29.3:
        ap = person(A, arms="down", face="smile")
    elif t < 29.4:
        ap = person(A, arms="waveR", wave=1)
    else:
        ap = None
    if ap is not None:
        items.append((ya, ap, xa + 7, ya - jump))
    if 23.6 < t < 24.6:
        ext = 3 if int(t * (10 + 8 * (t - 23.6))) % 2 == 0 else 0
        items.append((ya + 0.5, pump_sprite(ext), xa - 1, ya + 2))
        hose = Sprite()
        hose.line(xa - 1, ya + 2, xc + 8, yc - 2, (40, 40, 44))
        items.append((ya + 0.6, hose, 0, 0))
    if leaving:
        # il remonte sur son vélo et part avant la nuit, lampe allumée
        u = t - 29.4
        bx = xa + 21 + 18 * u * u + 6 * u
        items.append((ya - 1, rider(A, bx / 4.2, bx / 2.6, lamp=True, wave=u < 0.5), bx, ya - 1))
        BEAM_STATE.setdefault(f, []).append((bx + 8, ya - 12, 1, 18, 0.45))

    # --- explosion de la chambre à air
    if 24.6 <= t < 25.3:
        u = t - 24.6
        for vx, vy, col in PARTS:
            p = Sprite()
            p.px(0, 0, col)
            items.append((999, p, wx + 4 + vx * u, wy - 5 + vy * u + 60 * u * u))
        if u < 0.5:
            r = 2 + u * 14
            sm = Sprite()
            for y in range(-int(r), int(r) + 1):
                for x in range(-int(r), int(r) + 1):
                    if abs(math.hypot(x, y) - r) < 1.0 and (x * 3 + y) % 4:
                        sm.px(x, y, (230, 230, 230) if u < 0.15 else (150, 150, 156))
            items.append((998, sm, wx + 4, wy - 5))
    # --- icônes : batterie vide, sonnerie, bulle "voiture"
    if 26.2 <= t < 27.0:
        emit.append((battery_icon(int(t * 5) % 2 == 0), cx_ - 4, cy_ - 34))
    if 27.95 <= t < 28.6:
        emit.append((ring_icon(int(t * 8)), cx_ + 7, cy_ - 24))
    if 28.6 <= t < 29.3:
        emit.append((bubble("car"), cx_ + 5, cy_ - 42))
    # --- la voiture du père
    if t > 33.4:
        u = clamp01((t - 33.4) / 0.9)
        carx = CAMV + 150 - 54 * (1 - (1 - u) ** 2)
        cy = VILLAGE_Y + 4
        items.append((cy, car_sprite(n), carx, cy))
        BEAM_STATE.setdefault(f, []).append((carx - 14, cy - 5, -1, 60, 1.2))


# ---------------------------------------------------------------- audio
SR = 44100
NS = int(DUR * SR)
arng = np.random.default_rng(31)


class Mix:
    def __init__(self):
        self.L = np.zeros(NS)
        self.R = np.zeros(NS)

    def add(self, sig, t, pan=0.0, gain=1.0):
        i = int(t * SR)
        n = min(len(sig), NS - i)
        if n <= 0 or i < 0:
            return
        l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        self.L[i:i + n] += sig[:n] * gain * l * 1.414
        self.R[i:i + n] += sig[:n] * gain * r * 1.414


def bell():
    d = 0.7
    return sum(osc(f, d) * env(d, 0.001, tau) * a for f, tau, a in ((2400, 0.25, 0.5), (3610, 0.16, 0.3), (5150, 0.1, 0.2)))


def hiss(d):
    tv = tt(d)
    return filt(noise(d), lo=2500, hi=9000) * np.minimum(1, tv / 0.02) * np.exp(-tv / (d * 0.45))


def squeak():
    d = 0.09
    tv = tt(d)
    return osc(1300 + 500 * np.sin(2 * np.pi * 30 * tv), d) * np.sin(np.pi * tv / d) * 0.5


def pump_stroke(pitch=1.0):
    d = 0.14
    tv = tt(d)
    return filt(noise(d), lo=700 * pitch, hi=2600 * pitch) * np.sin(np.pi * tv / d) ** 2


def bonk():
    d = 0.18
    return osc(np.geomspace(900, 420, int(d * SR)), d) * env(d, 0.0005, 0.04) + filt(noise(d), lo=2000) * env(d, 0.0005, 0.004)


def boing():
    d = 0.5
    tv = tt(d)
    return osc(300 + 220 * np.sin(2 * np.pi * 18 * tv) * np.exp(-tv / 0.2), d, "tri") * env(d, 0.002, 0.18) * 0.7


def clunk():
    d = 0.25
    return filt(noise(d), hi=700) * env(d, 0.0005, 0.03) + osc(np.geomspace(140, 60, int(d * SR)), d) * env(d, 0.001, 0.05)


def bang():
    d = 1.2
    s = filt(noise(d), hi=7000) * env(d, 0.0003, 0.07) * 1.4
    s += osc(np.geomspace(90, 32, int(d * SR)), d) * env(d, 0.001, 0.25) * 1.3
    s += filt(noise(d), lo=3000) * env(d, 0.0003, 0.02) * 0.6
    return s


def tinnitus():
    d = 1.6
    tv = tt(d)
    return osc(3900, d) * np.minimum(1, tv / 0.05) * np.exp(-tv / 0.6) * 0.18


def rustle(d):
    tv = tt(d)
    return filt(noise(d), lo=1800, hi=6000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 7 * tv))) * np.sin(np.pi * tv / d)


def flutter(d):
    tv = tt(d)
    return filt(noise(d), lo=400, hi=2500) * ((tv * 28) % 1 < 0.3) * np.sin(np.pi * tv / d)


def beeps(freqs, d=0.1, gap=0.06, kind="square"):
    out = []
    for fq in freqs:
        out.append(osc(fq, d, kind, 0.3) * env(d, 0.002, d * 0.9))
        out.append(np.zeros(int(gap * SR)))
    return np.concatenate(out)


def dtmf():
    pairs = [(770, 1336), (697, 1209), (852, 1477), (941, 1336), (770, 1209), (697, 1477)]
    out = []
    for a, b in pairs:
        d = 0.06
        out.append((osc(a, d) + osc(b, d)) * 0.5 * np.minimum(1, tt(d) / 0.004))
        out.append(np.zeros(int(0.03 * SR)))
    return np.concatenate(out)


def ringback():
    d = 0.42
    return (osc(440, d) + osc(480, d)) * 0.5 * np.minimum(1, tt(d) / 0.01) * np.minimum(1, (d - tt(d)) / 0.01)


def crickets(d, amount):
    tv = tt(d)
    burst = ((tv * 26) % 1 < 0.5) & (((tv + 0.13) % 0.62) < 0.2)
    return osc(4300, d) * burst * amount


def owl():
    parts = []
    for fq, d in ((390, 0.28), (0, 0.16), (370, 0.5)):
        if fq:
            tv = tt(d)
            parts.append(osc(fq * (1 - 0.04 * tv / d), d) * np.sin(np.pi * tv / d) ** 1.5)
        else:
            parts.append(np.zeros(int(d * SR)))
    return np.concatenate(parts)


def church_bell():
    d = 3.0
    base = 210
    return sum(osc(base * k, d) * env(d, 0.002, tau) * a for k, tau, a in
               ((0.5, 1.6, 0.5), (1.0, 1.2, 0.7), (1.19, 0.9, 0.4), (1.5, 0.7, 0.3), (2.0, 0.5, 0.25), (2.74, 0.3, 0.15)))


def engine(d):
    tv = tt(d)
    f = 38 + 10 * np.sin(2 * np.pi * 0.7 * tv)
    s = osc(f, d, "saw") * (0.6 + 0.4 * ((tv * f.mean() / 2) % 1 < 0.5))
    return filt(s, hi=500)


def build_audio(path):
    m = Mix()
    # roulement des pneus, roue libre et vent selon la vitesse
    tg = np.arange(NS) / SR
    fr = np.arange(NF) / FPS
    vA = np.gradient(XA_S) * FPS
    vC = np.gradient(XC_S) * FPS
    vM = np.gradient(XM) * FPS
    v_split = np.interp(tg, fr, (vA + vC) / 2)
    v_main = np.interp(tg, fr, vM)
    v = np.where(tg < MERGE_T, v_split, v_main)
    roll = filt(noise(DUR), lo=150, hi=1100) * (v / 60) * 0.07
    m.L += roll
    m.R += roll * 0.95
    wind = filt(noise(DUR), lo=200, hi=300 + 30 * 60) * np.clip((v - 30) / 30, 0, 1) ** 2 * 0.22
    m.L += wind
    m.R += np.roll(wind, 900)
    # roue libre en descente
    t = 17.3
    while t < 19.2:
        m.add(filt(noise(0.012), lo=3000) * env(0.012, 0.0002, 0.003), t, 0.1, 0.25)
        t += 1 / 55
    # oiseaux de jour
    for k in range(26):
        tb = arng.uniform(0.3, 25)
        fb = arng.uniform(2600, 4200)
        d = 0.08
        ch = osc(np.linspace(fb, fb * 1.3, int(d * SR)), d) * np.sin(np.pi * tt(d) / d)
        for j in range(arng.integers(2, 5)):
            m.add(ch, tb + j * 0.1, arng.uniform(-0.8, 0.8), 0.05 * (1 - clamp01((tb - 22) / 4)))
    # rivière dans la moitié haute
    river = filt(noise(SPLIT_END + 0.6), lo=300, hi=1600) * (0.5 + 0.5 * np.sin(2 * np.pi * 3 * tt(SPLIT_END + 0.6)) ** 2)
    m.add(river * np.linspace(1, 0.3, len(river)), 0, -0.5, 0.05)
    # départ des maisons
    m.add(clunk(), 0.35, -0.3, 0.4)
    m.add(clunk(), 0.75, 0.3, 0.4)
    # transition en pixels
    for k in range(18):
        m.add(osc(1200 + 90 * k, 0.03, "square", 0.25) * env(0.03, 0.001, 0.02), SPLIT_END + k * 0.033, (k % 3 - 1) * 0.5, 0.08)
    # sonnettes des retrouvailles
    m.add(bell(), 8.3, -0.2, 0.35)
    m.add(bell(), 8.42, -0.2, 0.3)
    m.add(bell(), 8.6, 0.2, 0.35)
    # crevaison n°1
    m.add(hiss(1.3), 11.8, 0.0, 0.5)
    for k in range(5):
        m.add(osc(70, 0.06) * env(0.06, 0.001, 0.02), 11.9 + k * 0.11, 0, 0.5)
    m.add(beeps([392, 294], 0.16, 0.04), 12.2, 0, 0.12)
    m.add(clunk(), 12.85, 0, 0.5)
    for k in range(6):
        m.add(squeak(), 12.95 + k * 0.12, 0, 0.25)
    m.add(boing(), 13.6, 0.1, 0.5)
    m.add(bonk(), 14.0, 0.25, 0.6)
    for k in range(4):
        m.add(osc(np.linspace(2600, 3200, int(0.07 * SR)), 0.07) * env(0.07, 0.002, 0.03), 14.05 + k * 0.1, 0.25, 0.08)
    for k in range(9):
        m.add(pump_stroke(), 14.02 + k * 0.1, 0.15, 0.35)
    m.add(clunk(), 14.92, 0, 0.35)
    m.add(clunk(), 15.25, 0, 0.3)
    m.add(bell(), 15.45, 0, 0.25)
    # montée : souffle et coeur qui bat
    t = 19.6
    while t < 22.2:
        m.add(filt(noise(0.22), lo=500, hi=1800) * np.sin(np.pi * tt(0.22) / 0.22) ** 2, t, -0.15, 0.12)
        m.add(filt(noise(0.22), lo=500, hi=1800) * np.sin(np.pi * tt(0.22) / 0.22) ** 2, t + 0.22, 0.15, 0.1)
        m.add(osc(55, 0.08) * env(0.08, 0.002, 0.03), t, 0, 0.4)
        m.add(osc(55, 0.08) * env(0.08, 0.002, 0.03), t + 0.16, 0, 0.3)
        t += 0.55
    # crevaison n°2
    m.add(hiss(1.2), 22.0, 0, 0.5)
    m.add(beeps([392, 294], 0.18, 0.05), 22.45, 0, 0.14)
    m.add(clunk(), 22.6, 0, 0.45)
    for k in range(6):
        m.add(squeak(), 22.9 + k * 0.12, 0, 0.25)
    t, k = 23.6, 0
    while t < 24.6:
        m.add(pump_stroke(1 + (t - 23.6) * 0.6), t, 0.15, 0.35)
        t += 0.1 / (1 + (t - 23.6) * 0.8)
    tens = osc(np.linspace(500, 1700, int(1.0 * SR)), 1.0, "tri") * np.linspace(0, 1, int(SR)) ** 2 * 0.15
    m.add(tens, 23.6, 0, 1.0)
    m.add(bang(), 24.6, 0, 1.0)
    m.add(tinnitus(), 24.75, 0, 1.0)
    for k in range(8):
        m.add(osc(arng.uniform(3000, 5000), 0.05) * env(0.05, 0.001, 0.015), 24.9 + k * 0.06, arng.uniform(-0.5, 0.5), 0.1)
    # plus de chambre à air
    m.add(rustle(0.8), 25.25, 0.2, 0.35)
    m.add(flutter(0.6), 25.5, 0.2, 0.25)
    m.add(sfx_wahwah(), 25.75, 0, 0.3)
    # téléphone vide, puis celui de l'autre
    m.add(beeps([660, 520, 330], 0.12, 0.08, "sine"), 26.3, -0.1, 0.25)
    m.add(osc(1500, 0.05, "square", 0.3) * env(0.05, 0.001, 0.03), 27.15, 0, 0.12)
    m.add(dtmf(), 27.45, -0.1, 0.18)
    m.add(ringback(), 27.98, -0.1, 0.16)
    m.add(osc(900, 0.03, "square") * env(0.03, 0.001, 0.01), 28.6, -0.1, 0.18)
    m.add(osc(1500, 0.05, "square", 0.3) * env(0.05, 0.001, 0.03), 29.32, 0, 0.12)
    # il part : sonnette qui s'éloigne
    m.add(bell(), 29.5, 0.3, 0.3)
    dep = filt(noise(1.2), lo=150, hi=1100) * np.linspace(1, 0, int(1.2 * SR)) * 0.08
    m.add(dep, 29.4, 0.6, 1.0)
    # lampadaire
    m.add(clunk(), 29.6, -0.6, 0.35)
    buzz = osc(100, 0.5, "square", 0.3) * ((tt(0.5) * 20) % 1 < 0.6) * np.linspace(1, 0.2, int(0.5 * SR))
    m.add(filt(buzz, hi=1500), 29.62, -0.6, 0.05)
    # nuit : grillons, chouette, cloches, horloge qui s'emballe
    cr = crickets(DUR - 27.5, 1.0)
    cr *= np.clip((tt(DUR - 27.5)) / 4, 0, 1) * 0.05
    m.add(cr, 27.5, 0.5, 1.0)
    m.add(crickets(DUR - 28.0, 1.0) * np.clip(tt(DUR - 28.0) / 4, 0, 1) * 0.04, 28.0, -0.5, 1.0)
    m.add(owl(), 31.4, -0.7, 0.25)
    m.add(owl(), 33.0, -0.7, 0.2)
    m.add(church_bell(), 32.0, -0.6, 0.35)
    m.add(church_bell(), 32.9, -0.6, 0.3)
    t, k = 31.0, 0
    while t < 34.0:
        m.add(osc(2600 if k % 2 else 2000, 0.02, "square", 0.3) * env(0.02, 0.0005, 0.006), t, -0.6, 0.12)
        u = clamp01((t - 31.0) / 3.0)
        t += 0.25 - 0.17 * math.sin(math.pi * u)
        k += 1
    # la voiture du père
    eng = engine(2.0)
    m.add(eng * np.minimum(1, tt(2.0) / 0.9) * np.where(tt(2.0) > 0.9, 0.6, 1.0), 33.2, 0.6, 0.35)
    sq = osc(2800 * (1 + 0.02 * np.sin(2 * np.pi * 30 * tt(0.35))), 0.35) * np.sin(np.pi * tt(0.35) / 0.35)
    m.add(sq, 34.05, 0.2, 0.06)
    m.add(beeps([420, 420], 0.12, 0.07), 34.35, 0.2, 0.18)
    m.add(beeps([523, 659, 784, 1047], 0.09, 0.0), 34.55, 0, 0.18)

    ir_d = 0.6
    for ch in ("L", "R"):
        ir = filt(noise(ir_d), hi=4000) * np.exp(-tt(ir_d) / 0.12)
        ir /= np.sqrt(np.sum(ir ** 2))
        x = getattr(m, ch)
        n = len(x) + len(ir)
        wet = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[:len(x)]
        setattr(m, ch, x + wet * 0.15)
    st = np.stack([m.L, m.R], axis=1)
    fl = int(0.5 * SR)
    st[-fl:] *= np.linspace(1, 0, fl)[:, None]
    st *= 0.89 / np.max(np.abs(st))
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())


# ---------------------------------------------------------------- rendu vidéo
def render(video_path, only=None):
    mask = np.ones((H * CELL, W * CELL, 1), np.float32)
    mask[CELL - 1::CELL] = 0.58
    mask[:, CELL - 1::CELL] = 0.58
    thr = np.random.default_rng(3).random((H, W))
    ff = None
    if only is None:
        ff = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
             "-s", f"{W * CELL}x{H * CELL}", "-r", str(FPS), "-i", "-",
             "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
             "-tune", "animation", video_path], stdin=subprocess.PIPE)
    frames = range(NF) if only is None else [int(t * FPS) for t in only]
    out = []
    for f in frames:
        t = f / FPS
        if t < SPLIT_END:
            fr = render_split(t, f)
        elif t < MERGE_T:
            u = (t - SPLIT_END) / (MERGE_T - SPLIT_END)
            a, b = render_split(t, f), render_merged(t, f)
            fr = np.where((thr < u)[..., None], b, a)
        else:
            fr = render_merged(t, f)
        if t > DUR - 0.5:
            fr = fr * ((DUR - t) / 0.5)
        fr = np.clip(fr, 0, 255)
        big = np.repeat(np.repeat(fr, CELL, axis=0), CELL, axis=1) * mask
        if ff:
            ff.stdin.write(big.astype(np.uint8).tobytes())
        else:
            out.append(big.astype(np.uint8))
    if ff:
        ff.stdin.close()
        ff.wait()
    return out


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--preview":
        from PIL import Image
        times = [float(x) for x in sys.argv[2].split(",")]
        ims = render(None, only=times)
        small = [Image.fromarray(im).resize((270, 480), Image.NEAREST) for im in ims]
        cols = 6
        sheet = Image.new("RGB", (270 * cols, 480 * ((len(small) + cols - 1) // cols)))
        for i, im in enumerate(small):
            sheet.paste(im, ((i % cols) * 270, (i // cols) * 480))
        sheet.save(sys.argv[3])
        sys.exit()
    tmp = tempfile.mkdtemp()
    vid, aud = os.path.join(tmp, "v.mp4"), os.path.join(tmp, "a.wav")
    render(vid)
    build_audio(aud)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", vid, "-i", aud, "-c:v", "copy",
                    "-af", "loudnorm=I=-16:TP=-3:LRA=11,alimiter=limit=0.7:level=false", "-ar", "44100",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", OUT], check=True)
    print(OUT)
