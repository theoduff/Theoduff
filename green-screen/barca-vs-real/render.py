"""Animation green screen : contact entre le logo du Barça et celui du Real Madrid.

Les deux logos s'avancent, se percutent une fois, reculent légèrement et restent face à face.
Sorties : MP4 fond vert #00FF00 (9:16, 1080x1920, 30 i/s, 3 s) + WebM avec transparence.
Usage : python3 render.py [dossier_sortie]
"""
import math
import random
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

W, H, FPS, N = 1080, 1920, 30, 90
GREEN = (0, 255, 0)
HERE = Path(__file__).parent
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else HERE)

LOGO_H = 540
LX, RX, Y0 = 280, 800, 960
CONTACT = 42          # image du choc
GAP = 440             # écart entre les centres au contact


def clamp(t):
    return max(0.0, min(1.0, t))


def seg(t, a, b):
    return clamp((t - a) / (b - a))


def ease_out(t):
    return 1 - (1 - t) ** 3


def ease_in(t):
    return t ** 3


def ease_io(t):
    return 3 * t * t - 2 * t ** 3


def lerp(a, b, t):
    return a + (b - a) * t


def state(t):
    """t en images (flottant pour le flou de bouger). Renvoie (bx, rx, y_offset, angle)."""
    # entrée rapide depuis les bords
    e = ease_out(seg(t, 0, 12))
    bx, rx = lerp(-350, LX, e), lerp(W + 350, RX, e)
    ang = lerp(8, 0, e)
    # léger recul pour prendre l'élan
    k = ease_io(seg(t, 14, 32))
    bx, rx = bx - 40 * k, rx + 40 * k
    # charge
    c = ease_in(seg(t, 32, CONTACT))
    bx = lerp(bx, 540 - GAP / 2, c)
    rx = lerp(rx, 540 + GAP / 2, c)
    # recul après le contact
    if t >= CONTACT:
        r = ease_out(seg(t, CONTACT, CONTACT + 16))
        bx = lerp(540 - GAP / 2, 540 - GAP / 2 - 70, r)
        rx = lerp(540 + GAP / 2, 540 + GAP / 2 + 70, r)
    tilt = 0.0
    if CONTACT <= t < CONTACT + 20:
        tilt = 4 * math.exp(-(t - CONTACT) / 5) * math.cos((t - CONTACT) * 0.9)
    return bx, rx, ang, tilt


def shake(f):
    if CONTACT <= f < CONTACT + 8:
        a = 16 * math.exp(-(f - CONTACT) / 2.5)
        rnd = random.Random(f)
        return rnd.uniform(-a, a), rnd.uniform(-a, a)
    return 0.0, 0.0


def place(canvas, sprite, x, y, rot):
    im = sprite.rotate(-rot, resample=Image.BICUBIC, expand=True) if abs(rot) > 0.01 else sprite
    canvas.alpha_composite(im, (int(round(x - im.width / 2)), int(round(y - im.height / 2))))


def render_frame(f, barca, real):
    # flou de bouger : moyenne de sous-images (en alpha prémultiplié)
    subs = 6
    acc = np.zeros((H, W, 4), np.float32)
    sx, sy = shake(f)
    for i in range(subs):
        t = f - 0.5 + (i + 0.5) / subs
        bx, rx, ang, tilt = state(t)
        c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        place(c, barca, bx + sx, Y0 + sy, -ang - tilt)
        place(c, real, rx + sx, Y0 + sy, ang + tilt)
        a = np.asarray(c, np.float32)
        a[..., :3] *= a[..., 3:4] / 255
        acc += a
    acc /= subs

    # onde de choc fine au point de contact
    if CONTACT <= f < CONTACT + 9:
        p = (f - CONTACT) / 9
        ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ring)
        r = 40 + 420 * ease_out(p)
        alpha = int(230 * (1 - p) ** 1.5)
        cx, cy = 540 + sx, Y0 + sy
        d.ellipse([cx - r * 0.55, cy - r, cx + r * 0.55, cy + r], outline=(255, 255, 255, alpha),
                  width=max(2, int(10 * (1 - p))))
        g = np.asarray(ring, np.float32)
        g[..., :3] *= g[..., 3:4] / 255
        acc = g + acc * (1 - g[..., 3:4] / 255)

    out = acc.copy()
    nz = out[..., 3] > 0
    out[nz, :3] = out[nz, :3] * 255 / out[nz, 3:4]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def make_audio(path):
    sr = 48000
    total = np.zeros(int(N / FPS * sr))
    rng = np.random.default_rng(1)

    def add(sig, at):
        i = int(at * sr)
        total[i:i + len(sig)] += sig[: len(total) - i]

    def whoosh(dur, power):
        n = int(dur * sr)
        noise = np.convolve(rng.standard_normal(n), np.ones(60) / 60, mode="same") * 6
        return power * noise * np.sin(np.pi * np.linspace(0, 1, n)) ** 2

    t = np.arange(int(1.2 * sr)) / sr
    freq = 38 + 90 * np.exp(-t * 14)
    hit = np.sin(2 * np.pi * np.cumsum(freq) / sr) * np.exp(-t * 3.5)
    hit += 0.4 * rng.standard_normal(len(t)) * np.exp(-t * 35)

    add(whoosh(0.35, 0.35), 0)
    add(whoosh(0.3, 0.6), 32 / FPS)
    add(hit, CONTACT / FPS)
    total = total / np.max(np.abs(total)) * 0.95
    pcm = (np.tanh(total * 1.2) / np.tanh(1.2) * 32000).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def load(name):
    im = Image.open(HERE / name).convert("RGBA")
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * LOGO_H / im.height), LOGO_H), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    barca, real = load("logo_barca.png"), load("logo_real.png")
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
        fr = render_frame(f, barca, real)
        alpha.stdin.write(fr.tobytes())
        flat = Image.alpha_composite(bg, fr).convert("RGB")
        green.stdin.write(flat.tobytes())
        if f in (6, 20, 39, 42, 45, 80):
            flat.save(OUT / f"preview_{f:03d}.png")
    for p in (green, alpha):
        p.stdin.close(); p.wait()


if __name__ == "__main__":
    main()
