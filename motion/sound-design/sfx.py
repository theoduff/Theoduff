"""Soft UI sound design for KIMI.mp4, synced to the motion-graphics overlays.

Each overlay's internal event times (from its HTML source) are mapped to the edit
with video_time = offset + speed * anim_time, measured on the edit frame by frame.
Output: one 48 kHz stereo WAV the length of the video, to drop at 00:00 on the timeline.
"""
import wave
import numpy as np

SR = 48000
LENGTH = 47.6
rng = np.random.default_rng(7)
mix = np.zeros((int(SR * LENGTH) + SR, 2))


def env(n, attack, decay):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t / decay)


def place(sig, t, pan=0.0, gain=1.0):
    """Add a mono signal at time t (s), equal-power pan -1..1."""
    i = int(t * SR)
    if i < 0 or i >= len(mix):
        return
    sig = sig[: len(mix) - i] * gain
    th = (pan + 1) * np.pi / 4
    mix[i:i + len(sig), 0] += sig * np.cos(th)
    mix[i:i + len(sig), 1] += sig * np.sin(th)


def place_st(sig_lr, t, gain=1.0):
    i = int(t * SR)
    sig_lr = sig_lr[: len(mix) - i] * gain
    mix[i:i + len(sig_lr)] += sig_lr


# ---------- instruments ----------
def pop(f0=620):
    """Soft bubble: sine with a quick downward pitch glide."""
    n = int(0.16 * SR); t = np.arange(n) / SR
    f = f0 * (1 + 0.6 * np.exp(-t / 0.018))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.003, 0.045) * 0.5


def tick(f=2400):
    """Tiny glassy tick."""
    n = int(0.05 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 1.5 * t)
    return s * env(n, 0.0008, 0.008) * 0.35


def chime(f, decay=0.7):
    """Soft bell: few inharmonic partials, gentle attack."""
    n = int(decay * 4 * SR); t = np.arange(n) / SR
    parts = [(1, 1.0), (2.0, 0.35), (2.76, 0.18), (4.07, 0.07)]
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (decay / r ** 0.6)) for r, a in parts)
    return s * np.clip(t / 0.006, 0, 1) * 0.32


def thump(f=95):
    """Felt landing: low sine with pitch drop."""
    n = int(0.3 * SR); t = np.arange(n) / SR
    fr = f * (1 + 0.8 * np.exp(-t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(n, 0.002, 0.08) * 0.55


def whoosh(dur, f_lo=300, f_hi=2200, pan_from=0.0, pan_to=0.0, peak=0.5):
    """Air swoosh: noise through a sweeping 2-pole lowpass minus a highpass, bell envelope, pan sweep."""
    n = int(dur * SR); t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    sweep = f_lo + (f_hi - f_lo) * np.sin(np.pi * t * 0.5 + 0.0) ** 1.5
    a = 1 - np.exp(-2 * np.pi * sweep / SR)
    y1 = y2 = 0.0
    out = np.empty(n)
    for i in range(n):
        y1 += a[i] * (noise[i] - y1)
        y2 += a[i] * (y1 - y2)
        out[i] = y2
    hp = out - np.convolve(out, np.ones(64) / 64, mode='same')   # remove rumble
    e = np.sin(np.pi * t) ** 2 * peak
    s = hp * e / (np.abs(hp).max() + 1e-9)
    pan = pan_from + (pan_to - pan_from) * t
    th = (pan + 1) * np.pi / 4
    return np.stack([s * np.cos(th), s * np.sin(th)], 1)


def shimmer(dur=1.0, f=1568):
    """Airy sparkle: a few high detuned chimes spread in time."""
    out = np.zeros(int((dur + 2.5) * SR))
    for k, (r, dt) in enumerate([(1, 0), (1.25, 0.07), (1.5, 0.14), (2, 0.22)]):
        c = chime(f * r, 0.5) * (0.5 - 0.08 * k)
        i = int(dt * SR); out[i:i + len(c)] += c[: len(out) - i]
    return out


# notes (A major pentatonic, airy register)
A5, B5, CS6, E6, FS6, A6 = 880.0, 987.8, 1108.7, 1318.5, 1480.0, 1760.0
E5, CS5, A4 = 659.3, 554.4, 440.0


def xpan(x, w=1080):
    return (x / w - 0.5) * 1.2   # overlay x position -> pan


# ---------- clip mappings (offset, speed) measured on the edit ----------
def at(clip, a):
    off, k = clip
    return off + k * a


A_ = (6.75, 1.0)     # F4 -> F2 timeline
B_ = (14.12, 1.0)    # Hamilton -> Antonelli transfer
C_ = (19.71, 0.672)  # 2025 podiums (sped up ~1.5x in the edit)
D_ = (23.15, 1.0)    # 2026 wins
E_ = (27.43, 0.65)   # standings (sped up ~1.5x)
F_ = (30.67, 0.667)  # Mexico P9 (sped up ~1.5x)
G_ = (34.24, 1.0)    # age at first title

# --- A: F4 -> F2 (avatar already on screen at clip start) ---
place_st(whoosh(0.9, 200, 1400, -0.6, 0.6, 0.35), at(A_, 0.0))
place(pop(560), at(A_, 0.08), xpan(200))
place_st(whoosh(2.6, 150, 700, -0.6, -0.1, 0.18), at(A_, 0.3))          # gauge glide
place(chime(A5), at(A_, 3.0), xpan(400), 0.8)                          # reaches F4
place(thump(110), at(A_, 3.0), xpan(400), 0.6)
place_st(whoosh(0.95, 400, 3000, -0.2, 0.35, 0.5), at(A_, 3.3))         # the jump
place(tick(1800), at(A_, 3.65), xpan(540), 0.7)                        # F3 struck
place(thump(90), at(A_, 4.22), xpan(700))
place(chime(E6), at(A_, 4.22), xpan(700), 0.9)
place(chime(A6, 0.9), at(A_, 4.30), xpan(700), 0.35)

# --- B: transfer ---
place_st(whoosh(0.9, 200, 1400, 0, 0, 0.3), at(B_, 0.0))
place(pop(520), at(B_, 0.2), xpan(200))
place(pop(470), at(B_, 0.28), xpan(540))
place_st(whoosh(0.95, 300, 2400, 0.0, 0.55, 0.45), at(B_, 1.33))       # Hamilton leaves
place(thump(80), at(B_, 2.25), xpan(880), 0.8)
place(chime(CS5, 0.5), at(B_, 2.25), xpan(880), 0.6)
place_st(whoosh(0.95, 400, 3000, -0.55, 0.0, 0.5), at(B_, 2.28))       # Antonelli takes the seat
place(thump(95), at(B_, 3.2), 0.0)
place(chime(A5), at(B_, 3.2), 0.0, 0.9)
place(chime(E6, 0.9), at(B_, 3.28), 0.0, 0.35)
place(tick(2600), at(B_, 3.3), 0.0, 0.6)                               # 2013-2024 -> 2025

# --- C: 3 podiums 2025 (sped up) ---
for (land, x, n, prev) in [(1.4, 300, A5, 0.3), (2.9, 560, CS6, 1.9), (4.3, 820, E6, 3.4)]:
    place_st(whoosh(0.672 * (land - prev) + 0.1, 150, 900, xpan(x) - 0.3, xpan(x), 0.22), at(C_, prev))
    place(thump(105), at(C_, land), xpan(x), 0.5)
    place(chime(n), at(C_, land), xpan(x), 0.8)
    for j in range(3):                                                  # podium steps grow
        place(tick(2200 + 300 * j), at(C_, land + 0.08 + j * 0.12), xpan(x), 0.35)

# --- D: 2 wins 2026 ---
place(pop(560), at(D_, 0.1), xpan(90))
place_st(whoosh(0.9, 200, 1400, -0.6, 0.6, 0.3), at(D_, 0.0))
for (land, x, n, prev) in [(1.5, 360, CS6, 0.3), (3.0, 720, E6, 2.0)]:
    place_st(whoosh(land - prev, 150, 900, xpan(x) - 0.35, xpan(x), 0.22), at(D_, prev))
    place(thump(105), at(D_, land), xpan(x), 0.5)
    place(chime(n), at(D_, land), xpan(x), 0.85)
    place(chime(n * 2, 0.9), at(D_, land + 0.08), xpan(x), 0.3)

# --- E: standings (sped up) ---
place_st(whoosh(0.7, 200, 1600, -0.3, 0.3, 0.3), at(E_, 0.0))
for i in range(5):                                                      # rows land
    place(tick(1900 - i * 120), at(E_, 0.3 + i * 0.08 + 0.25), 0.0, 0.4)
place_st(whoosh(1.2, 150, 1000, -0.5, 0.4, 0.25), at(E_, 0.8))          # bars fill
# wins counter 0 -> 9 (eInOutCubic over 0.6..2.4)
for w in range(1, 10):
    v = (w - 0.5) / 9
    p = (v / 4) ** (1 / 3) if v < .5 else 1 - ((2 - 2 * v) ** (1 / 3)) / 2
    place(tick(2000 + 90 * w), at(E_, 0.6 + 1.8 * p), -0.35, 0.45)
place(chime(A5), at(E_, 2.6), -0.4, 0.6)                                # Antonelli row lights
place_st(whoosh(0.9, 300, 2600, -0.1, 0.35, 0.3), at(E_, 2.8))          # gap draws
for j in range(6):                                                      # +123 rolling
    place(tick(2600 + 80 * j), at(E_, 2.8 + j * 0.12), 0.35, 0.3)
place(chime(E6), at(E_, 3.6), 0.35, 0.75)
place(chime(A6, 0.9), at(E_, 3.68), 0.35, 0.3)

# --- F: Mexico, P9 is enough (sped up) ---
place(pop(560), at(F_, 0.1), xpan(130))
place_st(whoosh(0.9, 200, 1400, -0.6, 0.6, 0.3), at(F_, 0.0))
for p in range(2, 10):                                                  # P1 -> P9 counter
    v = (p - 1.5) / 8
    u = (v / 4) ** (1 / 3) if v < .5 else 1 - ((2 - 2 * v) ** (1 / 3)) / 2
    place(tick(1800 + 70 * p), at(F_, 0.6 + 2.3 * u), xpan(130 + (p - 1) * 91), 0.4)
place(thump(100), at(F_, 2.9), xpan(860), 0.6)
place(chime(CS6), at(F_, 2.9), xpan(860), 0.8)
place(shimmer(1.0, E6), at(F_, 3.25), 0.0, 0.45)                        # CHAMPION DU MONDE
place(chime(A4, 1.2), at(F_, 3.4), 0.0, 0.5)

# --- G: age at first title ---
place_st(whoosh(0.9, 200, 1400, -0.6, 0.6, 0.3), at(G_, 0.0))
place_st(whoosh(1.9, 150, 700, -0.6, 0.3, 0.16), at(G_, 0.6))           # sweep
for (hit, x, n) in [(1.96, 504, A5), (2.26, 627, CS6), (2.53, 731, E6)]:
    place(pop(600), at(G_, hit), xpan(x), 0.6)
    place(chime(n, 0.6), at(G_, hit + 0.12), xpan(x), 0.6)

# ---------- light room reverb ----------
ir_n = int(0.9 * SR)
ir = rng.standard_normal((ir_n, 2)) * np.exp(-np.arange(ir_n) / SR / 0.22)[:, None]
ir[:int(0.012 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(0))
N = 1 << int(np.ceil(np.log2(len(mix) + ir_n)))
wet = np.stack([np.fft.irfft(np.fft.rfft(mix[:, c], N) * np.fft.rfft(ir[:, c], N), N)[:len(mix)] for c in range(2)], 1)
out = mix + 0.22 * wet
out = out[: int(SR * LENGTH)]

# gentle high-shelf softening (one-pole lowpass blended in)
lp = np.empty_like(out); a = 1 - np.exp(-2 * np.pi * 7000 / SR); y = np.zeros(2)
for i in range(len(out)):
    y += a * (out[i] - y); lp[i] = y
out = 0.6 * out + 0.4 * lp

# peak at -12 dBFS: quiet, sits under the voice
out *= 10 ** (-12 / 20) / np.abs(out).max()
pcm = (out * 32767).astype('<i2')
with wave.open('sound_design_KIMI.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('ok', out.shape[0] / SR, 's')
