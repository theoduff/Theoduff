import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer, Group

LOGO, OUT, PREVIEW = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 2400, 1000          # 20,3 x 8,5 cm @ 300 dpi
STUB_X = 1930              # perforation position
NOTCH_R = 46
PURPLE = (42, 0, 52)
DEEP = (24, 0, 30)

SERIF_B = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
def font(name, size):
    import subprocess
    path = subprocess.check_output(["fc-match", "-f", "%{file}", name]).decode()
    return ImageFont.truetype(path, size)

def blank():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))

def gold_gradient(w, h, angle=20, stops=None):
    stops = stops or [(0, (138, 98, 26)), (.18, (232, 196, 96)), (.33, (255, 241, 168)),
                      (.5, (196, 148, 52)), (.68, (250, 226, 130)), (.84, (255, 247, 196)),
                      (1, (150, 108, 34))]
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(angle)
    t = x * math.cos(a) + y * math.sin(a)
    t = (t - t.min()) / (t.max() - t.min())
    out = np.zeros((h, w, 3), np.float32)
    pos = [s[0] for s in stops]
    for c in range(3):
        out[..., c] = np.interp(t, pos, [s[1][c] for s in stops])
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGB")

def ticket_mask():
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, W - 1, H - 1], 40, fill=255)
    for cy in (0, H):
        d.ellipse([STUB_X - NOTCH_R, cy - NOTCH_R, STUB_X + NOTCH_R, cy + NOTCH_R], fill=0)
    return m

def text_layer(txt, fnt, cx, cy, fill, spacing=0, anchor_center=True):
    """Draw text centred on (cx, cy) with letter spacing; returns RGBA canvas."""
    im = blank(); d = ImageDraw.Draw(im)
    widths = [d.textlength(ch, font=fnt) for ch in txt]
    total = sum(widths) + spacing * (len(txt) - 1)
    x = cx - total / 2
    for ch, w in zip(txt, widths):
        d.text((x, cy), ch, font=fnt, fill=fill, anchor="lm")
        x += w + spacing
    return im

def fill_with(mask_im, fill_img):
    out = fill_img.convert("RGBA").copy()
    out.putalpha(mask_im.getchannel("A"))
    return out

mask = ticket_mask()
layers = []  # (group, name, image, opacity)

# --- FOND --------------------------------------------------------------
bg = gold_gradient(W, H, 25)
bg_l = bg.convert("RGBA"); bg_l.putalpha(mask)
layers.append(("Fond", "Fond doré", bg_l, 255))

rng = np.random.default_rng(7)
noise = rng.normal(128, 40, (H, W)).clip(0, 255).astype(np.uint8)
tex = Image.fromarray(noise, "L").filter(ImageFilter.GaussianBlur(0.8)).convert("RGBA")
tex.putalpha(mask)
layers.append(("Fond", "Texture papier (Incrustation)", tex, 40))

# Rayons lumineux derrière le titre
rays = blank(); d = ImageDraw.Draw(rays)
cx, cy = STUB_X / 2, 520
for i in range(36):
    a0 = math.radians(i * 10); a1 = math.radians(i * 10 + 4)
    R = 1400
    d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)),
               (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=(255, 250, 220, 45))
rays = rays.filter(ImageFilter.GaussianBlur(3))
rm = Image.new("L", (W, H), 0); ImageDraw.Draw(rm).rectangle([0, 0, STUB_X, H], fill=255)
rays.putalpha(ImageChops.multiply(rays.getchannel("A"), ImageChops.multiply(rm, mask)))
layers.append(("Fond", "Rayons lumineux", rays, 255))

# Triangles décoratifs (rappel du logo)
tri = blank(); d = ImageDraw.Draw(tri)
random.seed(3)
def triangle(x, y, s, left):
    if left:
        d.polygon([(x, y), (x + s, y - s * .6), (x + s, y + s * .6)], fill=PURPLE + (60,))
    else:
        d.polygon([(x + s, y), (x, y - s * .6), (x, y + s * .6)], fill=PURPLE + (60,))
for (x, y, s, l) in [(120, 160, 70, False), (90, 330, 45, True), (170, 820, 80, True), (330, 900, 40, False),
                     (1700, 140, 60, True), (1780, 300, 40, False), (1640, 860, 75, False), (1800, 720, 45, True),
                     (260, 620, 35, False), (1560, 600, 30, True)]:
    triangle(x, y, s, l)
tri.putalpha(ImageChops.multiply(tri.getchannel("A"), mask))
layers.append(("Fond", "Triangles décoratifs", tri, 255))

# --- CADRE ------------------------------------------------------------
fr = blank(); d = ImageDraw.Draw(fr)
d.rounded_rectangle([34, 34, STUB_X - 70, H - 35], 26, outline=PURPLE + (255,), width=10)
d.rounded_rectangle([58, 58, STUB_X - 94, H - 59], 18, outline=PURPLE + (255,), width=3)
for (x, y) in [(58, 58), (STUB_X - 94, 58), (58, H - 59), (STUB_X - 94, H - 59)]:
    d.regular_polygon((x, y, 16), 4, rotation=45, fill=PURPLE + (255,))
d.rounded_rectangle([STUB_X + 70, 34, W - 35, H - 35], 26, outline=PURPLE + (255,), width=10)
layers.append(("Cadre", "Cadre violet", fr, 255))

perf = blank(); d = ImageDraw.Draw(perf)
for y in range(NOTCH_R + 20, H - NOTCH_R - 10, 34):
    d.ellipse([STUB_X - 6, y - 6, STUB_X + 6, y + 6], fill=DEEP + (200,))
layers.append(("Cadre", "Perforations talon", perf, 255))

# --- LOGO -------------------------------------------------------------
logo = Image.open(LOGO).convert("RGBA")
logo = logo.crop(logo.getchannel("A").getbbox())
lh = 270
logo = logo.resize((round(logo.width * lh / logo.height), lh), Image.LANCZOS)
lg = blank(); lx = round(STUB_X / 2 - logo.width / 2); lg.alpha_composite(logo, (lx, 85))
glow = blank(); g = Image.new("RGBA", logo.size, (255, 252, 230, 0)); g.putalpha(logo.getchannel("A"))
glow.alpha_composite(g, (lx, 85)); glow = glow.filter(ImageFilter.GaussianBlur(14))
layers.append(("Logo", "Halo logo", glow, 200))
layers.append(("Logo", "Logo Winamax French Darts Festival", lg, 255))

# --- TITRE ------------------------------------------------------------
title_f = ImageFont.truetype(SERIF_B, 168)
ty = 505
t_shape = text_layer("GOLDEN TICKET", title_f, STUB_X / 2, ty, (0, 0, 0, 255), spacing=6)
shadow = Image.new("RGBA", (W, H), DEEP + (0,)); shadow.putalpha(t_shape.getchannel("A"))
shadow = ImageChops.offset(shadow, 8, 10).filter(ImageFilter.GaussianBlur(7))
layers.append(("Titre", "Ombre titre", shadow, 170))
outline = Image.new("RGBA", (W, H), PURPLE + (0,))
outline.putalpha(t_shape.getchannel("A").filter(ImageFilter.MaxFilter(13)))
layers.append(("Titre", "Contour titre", outline, 255))
tg = gold_gradient(W, H, 90, [(0, (255, 248, 200)), (.42, (250, 220, 110)), (.5, (176, 126, 36)),
                              (.6, (232, 186, 80)), (1, (255, 240, 170))])
title = fill_with(t_shape, tg)
layers.append(("Titre", "GOLDEN TICKET", title, 255))

# Ornement sous le titre
orn = blank(); d = ImageDraw.Draw(orn)
oy = 650; c = STUB_X / 2
d.line([(c - 470, oy), (c - 40, oy)], fill=PURPLE + (255,), width=4)
d.line([(c + 40, oy), (c + 470, oy)], fill=PURPLE + (255,), width=4)
d.regular_polygon((c, oy, 20), 4, rotation=45, fill=PURPLE + (255,))
d.regular_polygon((c - 470, oy, 8), 4, rotation=45, fill=PURPLE + (255,))
d.regular_polygon((c + 470, oy, 8), 4, rotation=45, fill=PURPLE + (255,))
layers.append(("Infos", "Ornement", orn, 255))

# --- INFOS ------------------------------------------------------------
date_f = font("Inter:style=Black", 74)
lieu_f = font("Inter:style=SemiBold", 54)
layers.append(("Infos", "Date - 5 décembre 2025",
               text_layer("5 DÉCEMBRE 2025", date_f, c, 748, PURPLE + (255,), spacing=8), 255))
layers.append(("Infos", "Lieu - Parc des Expositions Caen",
               text_layer("PARC DES EXPOSITIONS · CAEN", lieu_f, c, 845, DEEP + (255,), spacing=6), 255))

# --- TALON ------------------------------------------------------------
sc = (STUB_X + W - 35) / 2
st = blank(); d = ImageDraw.Draw(st)
vert = Image.new("RGBA", (H, W - STUB_X), (0, 0, 0, 0))
vf = ImageFont.truetype(SERIF_B, 92)
vert_txt = text_layer("GOLDEN TICKET", vf, H / 2, 0, PURPLE + (255,), spacing=6)
# render vertical text on its own canvas
vcan = Image.new("RGBA", (H, 200), (0, 0, 0, 0)); vd = ImageDraw.Draw(vcan)
vd.text((H / 2, 100), "GOLDEN TICKET", font=vf, fill=PURPLE + (255,), anchor="mm")
vcan = vcan.rotate(90, expand=True)
st.alpha_composite(vcan, (round(sc - 100 - 70), 0))
layers.append(("Talon", "Talon - GOLDEN TICKET", st, 255))
small = font("Inter:style=Bold", 40)
sd = blank(); d = ImageDraw.Draw(sd)
vcan = Image.new("RGBA", (H, 140), (0, 0, 0, 0)); vd = ImageDraw.Draw(vcan)
vd.text((H / 2, 40), "5.12.2025  ·  CAEN", font=small, fill=DEEP + (255,), anchor="mm")
vd.text((H / 2, 100), "N° 0001", font=font("Inter:style=Black", 44), fill=DEEP + (255,), anchor="mm")
vcan = vcan.rotate(90, expand=True)
sd.alpha_composite(vcan, (round(sc + 30), 0))
layers.append(("Talon", "Talon - date + numéro", sd, 255))

# --- PSD --------------------------------------------------------------
psd = PSDImage.new("RGB", (W, H), color=(255, 255, 255))
groups = {}
for gname, name, im, op in layers:
    if gname not in groups:
        groups[gname] = Group.new(psd, name=gname)
    bbox = im.getchannel("A").getbbox()
    lay = PixelLayer.frompil(im.crop(bbox), groups[gname], name=name, top=bbox[1], left=bbox[0])
    lay.opacity = op
    if name.startswith("Texture"):
        from psd_tools.constants import BlendMode
        lay.blend_mode = BlendMode.OVERLAY
psd.save(OUT)

# preview (flatten ourselves; texture approximated)
prev = Image.new("RGBA", (W, H), (255, 255, 255, 255))
for gname, name, im, op in layers:
    if name.startswith("Texture"):
        continue
    if op < 255:
        a = im.getchannel("A").point(lambda v: v * op // 255); im = im.copy(); im.putalpha(a)
    prev.alpha_composite(im)
prev.convert("RGB").save(PREVIEW)
print("ok")
