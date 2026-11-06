"""Sous-titres animés façon Reel -> vidéo avec couche alpha (ProRes 4444)."""
import json, math, subprocess, sys, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

TIMED, FONT, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
T0 = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
T1 = float(sys.argv[5]) if len(sys.argv) > 5 else 149.856
W, H, FPS = 1080, 1920, 30
CY = 1260                      # centre vertical du texte (zone safe Reels)
BASE, EMPH = 132, 190          # tailles de police
MAXW = 920
STRONG = {"top", "stop", "feu", "partez", "finito", "attention", "3", "2", "1"}

lines = json.load(open(TIMED))

def tokens(text):
    text = text.replace("'", "’")
    text = re.sub(r"\s+([?!])", " \\1", text)          # ? ! collés (espace fine)
    ws = [w.strip(".,") for w in text.split(" ")]
    ws = [w for w in ws if w]
    chunks, i = [], 0
    while i < len(ws):
        c = ws[i]
        letters = re.sub(r"[^\w]", "", c)
        if len(letters) <= 3 and i + 1 < len(ws) and len(c) + 1 + len(ws[i+1]) <= 12 \
           and not re.search(r"[?!]$", c):
            c = c + " " + ws[i+1]; i += 1
        chunks.append(c); i += 1
    return chunks

# --- construction de la timeline des "chunks" ---
items = []
for li, (a, b, text) in enumerate(lines):
    ch = tokens(text)
    wts = [len(c) + 3 for c in ch]
    tot = sum(wts); t = a
    nxt = lines[li+1][0] if li + 1 < len(lines) else 1e9
    for j, (c, wt) in enumerate(zip(ch, wts)):
        d = (b - a) * wt / tot
        key = re.sub(r"[^\w]", "", c.lower())
        items.append(dict(text=c, s=t, e=t + d, strong=key in STRONG or (c.endswith("!") and len(c) <= 9),
                          last=(j == len(ch) - 1) and (nxt - b > 0.25)))
        t += d

# --- sprites (texte + ombres) pré-rendus ---
def sprite(text, size):
    font = ImageFont.truetype(FONT, size)
    l, t, r, btm = font.getbbox(text)
    while r - l > MAXW:
        size = int(size * 0.92); font = ImageFont.truetype(FONT, size); l, t, r, btm = font.getbbox(text)
    pad = 70
    w, h = r - l + 2*pad, btm - t + 2*pad
    txt = Image.new("L", (w, h), 0)
    ImageDraw.Draw(txt).text((pad - l, pad - t), text, font=font, fill=255)
    a = np.asarray(txt, np.float32) / 255
    sh1 = np.asarray(txt.filter(ImageFilter.GaussianBlur(10)), np.float32) / 255
    sh1 = np.roll(sh1, 6, axis=0)
    sh2 = np.asarray(txt.filter(ImageFilter.GaussianBlur(30)), np.float32) / 255
    shadow = np.clip(sh1 * 0.55 + sh2 * 0.30, 0, 1)
    alpha = a + shadow * (1 - a)
    rgb = np.where(alpha[..., None] > 0, (a / np.maximum(alpha, 1e-6))[..., None] * 255, 0)
    img = np.dstack([rgb.repeat(3, 2), alpha[..., None] * 255]).astype(np.uint8)
    return Image.fromarray(img, "RGBA")

for it in items:
    it["spr"] = sprite(it["text"], EMPH if it["strong"] else BASE)

def ease_out_back(x, k=2.2):
    x = min(max(x, 0), 1); x -= 1
    return 1 + (k + 1) * x**3 + k * x**2
def ease_out(x):
    x = min(max(x, 0), 1); return 1 - (1 - x)**3

def frame(t):
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for it in items:
        if not (it["s"] <= t < it["e"]): continue
        u = t - it["s"]
        if it["strong"]:   # "slam" : arrive grand, claque, petit shake
            p = ease_out(u / 0.14)
            sc = 1.55 - 0.55 * p
            ang = math.sin(u * 60) * 4 * math.exp(-u * 14)
            dy = 0; op = min(1, u / 0.05); blur = 8 * (1 - p)
        else:              # "pop" : monte et rebondit
            sc = 0.72 + 0.28 * ease_out_back(u / 0.16)
            ang = 0
            dy = 34 * (1 - ease_out(u / 0.16)); op = min(1, u / 0.06); blur = 6 * (1 - ease_out(u / 0.09))
        if it["last"]:     # sortie douce en fin de phrase
            v = (it["e"] - t) / 0.10
            if v < 1: op *= max(v, 0); sc *= 0.94 + 0.06 * max(v, 0)
        im = it["spr"]
        if blur > 0.4: im = im.filter(ImageFilter.GaussianBlur(blur))
        nw, nh = max(1, int(im.width * sc)), max(1, int(im.height * sc))
        im = im.resize((nw, nh), Image.BICUBIC)
        if abs(ang) > 0.05: im = im.rotate(ang, Image.BICUBIC, expand=True)
        if op < 1:
            a = im.getchannel("A").point(lambda x: int(x * op)); im.putalpha(a)
        canvas.alpha_composite(im, (W//2 - im.width//2, int(CY + dy - im.height//2)))
    return canvas

cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}",
       "-r", str(FPS), "-i", "-", "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
       "-alpha_bits", "8", "-vendor", "apl0", OUT]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
empty = bytes(W * H * 4)
for f in range(int(round(T0 * FPS)), int(round(T1 * FPS))):
    t = f / FPS
    if any(it["s"] <= t < it["e"] for it in items): p.stdin.write(frame(t).tobytes())
    else: p.stdin.write(empty)
p.stdin.close(); p.wait()

# SRT en bonus
def ts(x): h=int(x//3600); m=int(x%3600//60); s=x%60; return f"{h:02}:{m:02}:{int(s):02},{int(round((s%1)*1000)):03}"
with open(OUT.rsplit(".",1)[0] + ".srt", "w") as fh:
    for i, (a, b, text) in enumerate(lines, 1): fh.write(f"{i}\n{ts(a)} --> {ts(b)}\n{text}\n\n")
