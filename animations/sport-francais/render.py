"""Animation 6 s, fond transparent : les Français sans sport, 45 % (2022) -> 36 % (2026).

Format Instagram carrousel 1080x1350 (4:5), 30 i/s. Couleurs : #1375e6 et blanc. Typo : Blinker.
Rendu en 2x puis réduit pour l'anticrénelage. Sortie : PNG RGBA dans frames/.
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "frames")
W, H, FPS, DUR = 1080, 1350, 30, 6
SS = 2  # supersampling
BLUE = (0x13, 0x75, 0xE6)
WHITE = (255, 255, 255)

FONTS = {w: os.path.join(HERE, "fonts", f"Blinker-{w}.ttf") for w in ("SemiBold", "Bold", "Black")}
_font_cache = {}


def font(weight, size):
    key = (weight, round(size * SS))
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(FONTS[weight], key[1])
    return _font_cache[key]


# --- easing -----------------------------------------------------------------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(f, start, length):
    return clamp((f - start) / length)


def expo_out(t):
    return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)


def back_out(t, s=2.2):
    t -= 1
    return t * t * ((s + 1) * t + s) + 1


def ease_in_out(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return tuple(round(lerp(a, b, t)) for a, b in zip(c1, c2))


# --- drawing helpers (coords in 1x pixels) ----------------------------------
def text_layer(canvas, txt, weight, size, cx, cy, color=WHITE, alpha=1.0, scale=1.0, anchor="mm"):
    if alpha <= 0 or scale <= 0.01:
        return
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text((cx * SS, cy * SS), txt, font=font(weight, size * scale), fill=color + (round(255 * alpha),), anchor=anchor)
    canvas.alpha_composite(layer)


def text_width(txt, weight, size):
    l, _, r, _ = font(weight, size).getbbox(txt)
    return (r - l) / SS


def pill(canvas, cx, cy, w, h, color, alpha=1.0, scale=1.0, rot=0.0, label=None, lweight="Black", lsize=40, lcolor=WHITE):
    """Rounded rectangle, optionally labelled, scaled/rotated around its centre."""
    if alpha <= 0 or scale <= 0.01:
        return
    pad = 40
    bw, bh = int((w + 2 * pad) * SS), int((h + 2 * pad) * SS)
    tile = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle([pad * SS, pad * SS, (pad + w) * SS, (pad + h) * SS], radius=h / 2 * SS, fill=color + (255,))
    if label:
        d.text((bw / 2, bh / 2 + 2 * SS), label, font=font(lweight, lsize), fill=lcolor + (255,), anchor="mm")
    if scale != 1:
        tile = tile.resize((max(1, int(bw * scale)), max(1, int(bh * scale))), Image.LANCZOS)
    if rot:
        tile = tile.rotate(rot, resample=Image.BICUBIC, expand=True)
    if alpha < 1:
        a = tile.getchannel("A").point(lambda v: round(v * alpha))
        tile.putalpha(a)
    canvas.alpha_composite(tile, (int(cx * SS - tile.width / 2), int(cy * SS - tile.height / 2)))


def dot(draw, cx, cy, r, color):
    if r <= 0.2:
        return
    draw.ellipse([(cx - r) * SS, (cy - r) * SS, (cx + r) * SS, (cy + r) * SS], fill=color + (255,))


# --- layout -----------------------------------------------------------------
CX = W / 2
YEAR_Y = 100
NUM_Y = 268
CAP_Y1, CAP_Y2 = 418, 468
GRID_COLS, GRID_STEP, DOT_R = 10, 50, 19
GRID_TOP = 560
GRID_LEFT = CX - (GRID_COLS - 1) * GRID_STEP / 2
LEGEND_Y = GRID_TOP + 9 * GRID_STEP + 58
BADGE_Y = 1200

SPORT_2022, SPORT_2026 = 55, 64  # % de Français qui ont fait du sport

# --- timeline (frames) ------------------------------------------------------
F_YEAR, F_NUM, F_CAP, F_DOTS, F_LEGEND = 0, 4, 9, 10, 36
F_SWITCH = 54            # 1,8 s : passage 2022 -> 2026
F_CONVERT, CONVERT_STEP = 58, 3
F_PULSE = 90             # toute la masse bleue « grossit »
F_BADGE = 100            # 3,33 s : -9 POINTS EN 4 ANS !


def render(f):
    big = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))

    # Year pill: 2022 then 2026 (slide/flip)
    t_in = expo_out(prog(f, F_YEAR, 8))
    t_sw = prog(f, F_SWITCH, 8)
    pw, ph = 230, 84
    if t_sw <= 0:
        pill(big, CX, YEAR_Y, pw, ph, BLUE, alpha=min(1, t_in * 3), scale=lerp(0.6, 1, t_in),
             label="2022", lsize=58)
    else:
        e = expo_out(t_sw)
        # le pill reste, le texte bascule : on simule avec un squash vertical
        sq = abs(math.cos(math.pi * e)) if e < 1 else 1
        label = "2022" if e < 0.5 else "2026"
        pill(big, CX, YEAR_Y, pw, ph, BLUE, scale=1 + 0.12 * math.sin(math.pi * e), label=label, lsize=58 * max(sq, 0.05))

    # Big counter 45% -> 36%
    t_num = expo_out(prog(f, F_NUM, 7))
    # le compteur descend d'un point à chaque Français qui passe au bleu
    converted = sum(1 for k in range(SPORT_2026 - SPORT_2022) if f >= F_CONVERT + k * CONVERT_STEP + 3)
    value = 45 - converted
    land = prog(f, F_CONVERT + (SPORT_2026 - SPORT_2022 - 1) * CONVERT_STEP + 3, 8)  # impact à l'arrivée sur 36
    bump = 1 + 0.10 * (1 - expo_out(land)) if land > 0 else 1
    num_scale = lerp(1.10, 1.0, t_num) * bump if f >= F_NUM else 0
    text_layer(big, f"{value}%", "Black", 250, CX, NUM_Y, alpha=1 if f >= F_NUM else 0, scale=num_scale)

    # Caption (slide up 25px, 6 frames, expo out)
    for i, (line, y) in enumerate((("des Français n'ont pas fait", CAP_Y1), ("de sport de l'année", CAP_Y2))):
        t = expo_out(prog(f, F_CAP + 2 * i, 6))
        if f >= F_CAP + 2 * i:
            text_layer(big, line, "SemiBold", 46, CX, y + 25 * (1 - t), alpha=min(1, t * 2))

    # Dot grid: 100 Français, bleu = sportifs, blanc = pas de sport
    dots = Image.new("RGBA", big.size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(dots)
    pulse = math.sin(math.pi * prog(f, F_PULSE, 12)) * 0.16
    for i in range(100):
        r_, c_ = divmod(i, GRID_COLS)
        cx, cy = GRID_LEFT + c_ * GRID_STEP, GRID_TOP + r_ * GRID_STEP
        appear = prog(f, F_DOTS + i * 0.22, 8)
        if appear <= 0:
            continue
        s = back_out(appear)
        color = BLUE if i < SPORT_2022 else WHITE
        if SPORT_2022 <= i < SPORT_2026:
            k = i - SPORT_2022
            tc = prog(f, F_CONVERT + k * CONVERT_STEP, 7)
            if tc > 0:
                color = mix(WHITE, BLUE, ease_in_out(clamp(tc * 1.6)))
                s *= 1 + 0.55 * math.sin(math.pi * clamp(tc))  # le point « gonfle » en passant au bleu
        is_blue = i < SPORT_2022 or (SPORT_2022 <= i < SPORT_2026 and f >= F_CONVERT + (i - SPORT_2022) * CONVERT_STEP + 4)
        if is_blue:
            s *= 1 + pulse
        dot(dd, cx, cy, DOT_R * s, color)
    big.alpha_composite(dots)

    # Legend
    t_leg = expo_out(prog(f, F_LEGEND, 8))
    if f >= F_LEGEND:
        a = min(1, t_leg * 2)
        dy = 20 * (1 - t_leg)
        leg = Image.new("RGBA", big.size, (0, 0, 0, 0))
        ld = ImageDraw.Draw(leg)
        items = [(BLUE, "font du sport"), (WHITE, "pas de sport")]
        gap, lsz, r = 60, 36, 13
        widths = [2 * r + 14 + text_width(t, "SemiBold", lsz) for _, t in items]
        x = CX - (sum(widths) + gap) / 2
        for (col, txt), wdt in zip(items, widths):
            dot(ld, x + r, LEGEND_Y + dy, r, col)
            ld.text(((x + 2 * r + 14) * SS, (LEGEND_Y + dy) * SS), txt, font=font("SemiBold", lsz),
                    fill=WHITE + (255,), anchor="lm")
            x += wdt + gap
        if a < 1:
            leg.putalpha(leg.getchannel("A").point(lambda v: round(v * a)))
        big.alpha_composite(leg)

    # Badge: -9 POINTS EN 4 ANS !
    if f >= F_BADGE:
        tb = prog(f, F_BADGE, 10)
        e = expo_out(tb)
        breathe = 1 + 0.025 * math.sin(2 * math.pi * max(0, f - F_BADGE - 10) / 30)
        pill(big, CX, BADGE_Y, 820, 124, BLUE, alpha=min(1, tb * 4), scale=lerp(1.7, 1, e) * breathe,
             rot=lerp(-8, -2, e), label="-9 POINTS EN 4 ANS !", lsize=72)

    small = big.convert("RGBa").resize((W, H), Image.LANCZOS).convert("RGBA")
    return small


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    frames = range(FPS * DUR) if len(sys.argv) < 2 else [int(a) for a in sys.argv[1:]]
    for f in frames:
        render(f).save(os.path.join(OUT, f"frame_{f:04d}.png"), optimize=False)
    print("ok", len(frames))
