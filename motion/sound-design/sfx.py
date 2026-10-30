"""Soft, cinematic UI sound design for KIMI.mp4, synced to the motion-graphics overlays.

No tonal / bell sounds: everything is shaped noise (whooshes, swishes, air swells,
risers) plus soft low-end impacts, like a pro SFX library.

Each overlay's internal event times (from its HTML source) are mapped to the edit
with video_time = offset + speed * anim_time, measured on the edit frame by frame.
Output: one 48 kHz stereo WAV the length of the video, to drop at 00:00 on the timeline.
"""
import wave
import numpy as np

SR = 48000
LENGTH = 47.6
rng = np.random.default_rng(11)
mix = np.zeros((int(SR * LENGTH) + 4 * SR, 2))


# ---------- dsp helpers ----------
def svf(x, fc, q=0.7, mode='bp'):
    """Chamberlin state-variable filter with per-sample cutoff (array or scalar)."""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    f = 2 * np.sin(np.pi * np.clip(fc, 20, SR / 6) / SR)
    damp = 1 / q
    low = band = 0.0
    out = np.empty_like(x)
    for i in range(len(x)):
        low += f[i] * band
        high = x[i] - low - damp * band
        band += f[i] * high
        out[i] = band if mode == 'bp' else (low if mode == 'lp' else high)
    return out


def norm(s):
    return s / (np.abs(s).max() + 1e-9)


def stereo(s, pan_from=0.0, pan_to=None, width=0.0):
    """Equal-power pan sweep + a touch of decorrelated width."""
    pan_to = pan_from if pan_to is None else pan_to
    pan = np.linspace(pan_from, pan_to, len(s))
    th = (pan + 1) * np.pi / 4
    l, r = s * np.cos(th), s * np.sin(th)
    if width:
        d = int(0.011 * SR)
        r = (1 - width) * r + width * np.concatenate([np.zeros(d), r[:-d]])
    return np.stack([l, r], 1)


def place(sig_lr, t, gain=1.0):
    i = int(t * SR)
    if i < 0 or i >= len(mix):
        return
    sig_lr = sig_lr[: len(mix) - i] * gain
    mix[i:i + len(sig_lr)] += sig_lr


# ---------- sound palette ----------
def whoosh(dur, f_lo=250, f_hi=2500, pan_from=0.0, pan_to=0.0, peak_at=0.6):
    """Pass-by whoosh: band-passed noise whose centre rises to the peak then falls (doppler),
    plus a low air layer; asymmetric swell envelope."""
    n = int(dur * SR); t = np.linspace(0, 1, n)
    bell = np.where(t < peak_at, (t / peak_at) ** 2.2, ((1 - t) / (1 - peak_at)) ** 1.4)
    fc = f_lo + (f_hi - f_lo) * bell
    noise = rng.standard_normal(n)
    hi = norm(svf(noise, fc, q=1.4))
    air = norm(svf(rng.standard_normal(n), fc * 0.35, q=0.6, mode='lp'))
    s = svf((0.75 * hi + 0.45 * air) * bell, 160, q=0.7, mode='hp')   # keep the low end for impacts only
    return stereo(norm(s), pan_from, pan_to, width=0.35)


def swish(dur=0.28, f_from=6000, f_to=900, pan=0.0):
    """Short fast swish: high band sweeping down, quick in / smooth out."""
    n = int(dur * SR); t = np.linspace(0, 1, n)
    fc = f_from * (f_to / f_from) ** t
    e = np.minimum(t / 0.15, 1) * (1 - t) ** 1.6
    s = svf(rng.standard_normal(n), fc, q=1.8) * e
    return stereo(norm(s), pan, pan, width=0.3)


def air_swell(dur, f_lo=1500, f_hi=7000, pan=0.0):
    """Reverse-cymbal-like airy swell that stops dead (lead-in to an impact)."""
    n = int(dur * SR); t = np.linspace(0, 1, n)
    e = t ** 3 * np.minimum((1 - t) / 0.03, 1)
    fc = f_lo + (f_hi - f_lo) * t ** 2
    s = svf(rng.standard_normal(n), fc, q=0.9, mode='hp') * e
    return stereo(norm(s), pan, pan, width=0.5)


def impact(size=1.0, pan=0.0):
    """Soft cinematic hit: sub drop + lowpassed noise body + tiny transient, no pitch you can sing."""
    n = int(1.2 * SR); t = np.arange(n) / SR
    f = 52 * size ** -0.2 * (1 + 1.2 * np.exp(-t / 0.035))
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.22 * size))
    body = svf(rng.standard_normal(n), 380, q=0.7, mode='lp') * np.exp(-t / (0.09 * size))
    trans = svf(rng.standard_normal(n), 2500, q=0.8) * np.exp(-t / 0.006)
    s = 1.0 * sub + 0.9 * norm(body) * 0.6 + 0.15 * norm(trans)
    s *= np.minimum(t / 0.002, 1)
    return stereo(norm(s), pan, pan, width=0.15)


def click(pan=0.0, fc=3200):
    """Soft UI tick: 4 ms band-passed noise burst (no tone)."""
    n = int(0.03 * SR); t = np.arange(n) / SR
    s = svf(rng.standard_normal(n), fc, q=2.0) * np.exp(-t / 0.0035)
    return stereo(norm(s), pan, pan)


def riser(dur, f_lo=300, f_hi=4000, pan_from=0.0, pan_to=0.0):
    """Tension riser: noise band climbing, exponential swell, soft tail-off."""
    n = int(dur * SR); t = np.linspace(0, 1, n)
    fc = f_lo * (f_hi / f_lo) ** t
    e = t ** 2.5 * np.minimum((1 - t) / 0.06, 1)
    s = svf(rng.standard_normal(n), fc, q=2.2) * e
    return stereo(norm(s), pan_from, pan_to, width=0.4)


def sub_boom(pan=0.0):
    """Big but soft low-end bloom for the key moment."""
    n = int(2.5 * SR); t = np.arange(n) / SR
    f = 40 * (1 + 0.8 * np.exp(-t / 0.06))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7) * np.minimum(t / 0.004, 1)
    tail = svf(rng.standard_normal(n), 220, q=0.6, mode='lp') * np.exp(-t / 0.5)
    return stereo(norm(s + 0.35 * norm(tail)), pan, pan, width=0.2)


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

# levels (linear gains, relative)
L_WHOOSH, L_SOFT, L_IMPACT, L_CLICK = 0.55, 0.28, 0.55, 0.10


def ineinout(v):
    """Inverse of eInOutCubic."""
    return (v / 4) ** (1 / 3) if v < .5 else 1 - ((2 - 2 * v) ** (1 / 3)) / 2


# --- A: F4 -> F2 ---
place(whoosh(0.9, 200, 2200, -0.6, 0.5, 0.35), at(A_, -0.05), L_SOFT)          # line draws
place(whoosh(2.7, 150, 900, -0.6, -0.15, 0.85), at(A_, 0.3), L_SOFT * 0.8)      # gauge glide
place(impact(0.6, xpan(400)), at(A_, 3.0), L_IMPACT * 0.6)                     # reaches F4
place(whoosh(1.0, 300, 3800, -0.2, 0.35, 0.45), at(A_, 3.27), L_WHOOSH)        # the jump
place(swish(0.25, 5000, 1500, 0.0), at(A_, 3.62), L_SOFT * 0.6)                # F3 struck
place(impact(1.0, xpan(700)), at(A_, 4.22), L_IMPACT)                          # lands on F2

# --- B: transfer ---
place(whoosh(0.9, 200, 2200, 0.0, 0.0, 0.35), at(B_, -0.05), L_SOFT)
place(whoosh(1.0, 300, 3500, 0.0, 0.55, 0.45), at(B_, 1.3), L_WHOOSH * 0.85)   # Hamilton leaves
place(impact(0.6, xpan(880)), at(B_, 2.25), L_IMPACT * 0.55)
place(whoosh(1.0, 300, 3800, -0.55, 0.0, 0.45), at(B_, 2.25), L_WHOOSH)        # Antonelli takes the seat
place(impact(1.0, 0.0), at(B_, 3.2), L_IMPACT)
place(swish(0.3, 4500, 1200, 0.0), at(B_, 3.25), L_SOFT * 0.5)                 # 2025 -> flips in

# --- C: 3 podiums 2025 (sped up) ---
for (land, x, prev) in [(1.4, 300, 0.3), (2.9, 560, 1.9), (4.3, 820, 3.4)]:
    d = 0.672 * (land - prev)
    place(whoosh(d + 0.08, 200, 1800, xpan(x) - 0.35, xpan(x), 0.8), at(C_, prev), L_SOFT)
    place(impact(0.7, xpan(x)), at(C_, land), L_IMPACT * 0.6)
    place(swish(0.22, 6000, 2000, xpan(x)), at(C_, land + 0.1), L_SOFT * 0.45)  # podium glyph

# --- D: 2 wins 2026 ---
place(whoosh(0.9, 200, 2200, -0.6, 0.5, 0.35), at(D_, -0.05), L_SOFT)
for (land, x, prev) in [(1.5, 360, 0.3), (3.0, 720, 2.0)]:
    place(whoosh(land - prev + 0.05, 200, 1800, xpan(x) - 0.4, xpan(x), 0.8), at(D_, prev), L_SOFT)
    place(impact(0.85, xpan(x)), at(D_, land), L_IMPACT * 0.75)
    place(swish(0.22, 6000, 2000, xpan(x)), at(D_, land + 0.1), L_SOFT * 0.45)

# --- E: standings (sped up) ---
place(whoosh(0.8, 300, 4000, -0.3, 0.3, 0.4), at(E_, -0.1), L_WHOOSH * 0.7)    # overlay comes in
for i in range(5):                                                              # rows land
    place(click(0.0, 2600), at(E_, 0.55 + i * 0.08), L_CLICK)
place(whoosh(1.1, 200, 2000, -0.5, 0.4, 0.6), at(E_, 0.8), L_SOFT)             # bars fill
for w in range(1, 10):                                                          # wins 0 -> 9
    place(click(-0.35), at(E_, 0.6 + 1.8 * ineinout((w - 0.5) / 9)), L_CLICK * 0.8)
place(air_swell(0.5, pan=-0.3), at(E_, 2.6) - 0.5, L_SOFT * 0.6)
place(impact(0.6, -0.3), at(E_, 2.6), L_IMPACT * 0.45)                         # Antonelli row lights
place(riser(0.75, 400, 3500, 0.0, 0.35), at(E_, 2.8), L_SOFT * 0.7)            # gap +123 builds
place(impact(0.8, 0.35), at(E_, 2.8) + 0.75, L_IMPACT * 0.6)

# --- F: Mexico, P9 is enough (sped up) ---
place(whoosh(0.9, 200, 2200, -0.6, 0.5, 0.35), at(F_, -0.05), L_SOFT)
place(riser(0.667 * 2.3, 200, 2500, -0.6, 0.45), at(F_, 0.6), L_SOFT * 0.8)    # P1 -> P9 run
for p in range(2, 10):
    place(click(xpan(130 + (p - 1) * 91)), at(F_, 0.6 + 2.3 * ineinout((p - 1.5) / 8)), L_CLICK * 0.7)
place(impact(1.0, xpan(860)), at(F_, 2.9), L_IMPACT * 0.8)
place(air_swell(0.6, pan=0.0), at(F_, 3.6) - 0.6, L_SOFT * 0.8)                # CHAMPION DU MONDE
place(sub_boom(0.0), at(F_, 3.6), L_IMPACT * 0.9)

# --- G: age at first title ---
place(whoosh(0.9, 200, 2200, -0.6, 0.5, 0.35), at(G_, -0.05), L_SOFT)
place(whoosh(1.9, 150, 900, -0.6, 0.3, 0.85), at(G_, 0.6), L_SOFT * 0.7)        # sweep
for (hit, x) in [(1.96, 504), (2.26, 627), (2.53, 731)]:
    place(swish(0.3, 5000, 800, xpan(x)), at(G_, hit), L_SOFT * 0.8)
    place(impact(0.5, xpan(x)), at(G_, hit + 0.12), L_IMPACT * 0.45)

# ---------- room: short, dark reverb ----------
ir_n = int(1.1 * SR)
ir = rng.standard_normal((ir_n, 2)) * np.exp(-np.arange(ir_n) / SR / 0.28)[:, None]
ir[:int(0.015 * SR)] = 0
ir = np.stack([svf(ir[:, c], 3500, 0.7, 'lp') for c in range(2)], 1)
ir /= np.sqrt((ir ** 2).sum(0))
N = 1 << int(np.ceil(np.log2(len(mix) + ir_n)))
wet = np.stack([np.fft.irfft(np.fft.rfft(mix[:, c], N) * np.fft.rfft(ir[:, c], N), N)[:len(mix)] for c in range(2)], 1)
out = (mix + 0.18 * wet)[: int(SR * LENGTH)]

# tame harsh top: gentle lowpass at 9 kHz blended
lp = np.stack([svf(out[:, c], 9000, 0.7, 'lp') for c in range(2)], 1)
out = 0.35 * out + 0.65 * lp

# soft-clip safety, then peak at -15 dBFS so it sits under the voice
out = np.tanh(out / (np.abs(out).max() + 1e-9) * 1.2)
out *= 10 ** (-15 / 20) / np.abs(out).max()
pcm = (out * 32767).astype('<i2')
with wave.open('sound_design_KIMI.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('ok', out.shape[0] / SR, 's')
