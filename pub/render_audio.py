"""Musique + sound design entièrement synthétisés, calés sur la timeline.

Usage : python3 render_audio.py OUT.wav
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

from timeline import SR, DUR, BEAT, T_DROP, T_LOGO, T_END, T_GRAB, T_SIP_START, T_SIP_END, T_EXIT

OUT = sys.argv[1]
rng = np.random.default_rng(3)
N = int(DUR * SR)
music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
verb_send = np.zeros((N, 2))


# ------------------------------------------------------------------ outils
def tt(d):
    return np.arange(int(d * SR)) / SR


def place(bus, x, t0, gain=1.0, pan=0.0, send=0.0):
    """Ajoute un son mono/stéréo au bus à t0 (pan -1..1)."""
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], 1) * np.sqrt(2)
    i0 = int(round(t0 * SR))
    if i0 < 0:
        x = x[-i0:]
        i0 = 0
    n = min(len(x), N - i0)
    if n <= 0:
        return
    bus[i0:i0 + n] += x[:n] * gain
    if send:
        verb_send[i0:i0 + n] += x[:n] * gain * send


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "low", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "band", fs=SR, output="sos"), x, axis=0)


def sweep_filter(x, f_start, f_end, kind="low", q_order=2, block=256):
    """Filtre dont la fréquence de coupure glisse (exponentiellement) sur la durée."""
    y = np.zeros_like(x)
    zi = None
    nb = int(np.ceil(len(x) / block))
    for b in range(nb):
        u = b / max(1, nb - 1)
        if callable(f_start):
            f = f_start(u)
        else:
            f = f_start * (f_end / f_start) ** u
        f = float(np.clip(f, 20, SR / 2 - 200))
        sos = signal.butter(q_order, f, kind, fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        seg = x[b * block:(b + 1) * block]
        y[b * block:(b + 1) * block], zi = signal.sosfilt(sos, seg, axis=0, zi=zi)
    return y


def adsr(n, a=0.005, d=0.1, s=0.6, r=0.1, hold=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    hold = n - a_n - d_n - r_n if hold is None else int(hold * SR)
    hold = max(hold, 0)
    e = np.concatenate([np.linspace(0, 1, a_n, endpoint=False), np.linspace(1, s, d_n, endpoint=False),
                        np.full(hold, s), np.linspace(s, 0, r_n)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def saw(freq, t, phase=0.0):
    return 2 * ((freq * t + phase) % 1.0) - 1


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def noise(n):
    return rng.standard_normal(n)


# ------------------------------------------------------------------ instruments
def kick(punch=1.0, d=0.45):
    t = tt(d)
    f = 48 + 170 * np.exp(-t / 0.035) * punch
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22)
    click = hp(noise(len(t)), 2500) * np.exp(-t / 0.004) * 0.35
    return np.tanh((body + click) * 1.6) * 0.9


def clap():
    t = tt(0.35)
    n = bp(noise(len(t)), 900, 5000)
    env = np.zeros_like(t)
    for k, o in enumerate([0, 0.011, 0.022, 0.031]):
        env += np.where(t >= o, np.exp(-(t - o) / (0.008 if k < 3 else 0.12)), 0)
    return n * env * 0.5


def hat(open_=False):
    t = tt(0.35 if open_ else 0.06)
    x = hp(noise(len(t)), 7000)
    return x * np.exp(-t / (0.11 if open_ else 0.018)) * 0.35


def snare():
    t = tt(0.25)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.06)
    n = bp(noise(len(t)), 1200, 8000) * np.exp(-t / 0.09)
    return (tone * 0.5 + n * 0.7) * 0.6


def supersaw(freqs, d, voices=7, detune=0.18, cutoff=3200):
    t = tt(d)
    out = np.zeros((len(t), 2))
    for f in freqs:
        for v in range(voices):
            det = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            ff = f * 2 ** (det / 12)
            pan = (v - (voices - 1) / 2) / ((voices - 1) / 2) * 0.8
            s = saw(ff, t, rng.random())
            out[:, 0] += s * np.cos((pan + 1) * np.pi / 4)
            out[:, 1] += s * np.sin((pan + 1) * np.pi / 4)
    out /= voices * len(freqs) ** 0.7
    return lp(out, cutoff)


def pad(freqs, d):
    t = tt(d)
    out = np.zeros((len(t), 2))
    for f in freqs:
        for v, det in enumerate([-0.08, 0.0, 0.07]):
            s = saw(f * 2 ** (det / 12), t, rng.random())
            out[:, v % 2] += s
            out[:, (v + 1) % 2] += s * 0.5
    return out / (len(freqs) * 3)


def pluck(f, d=0.35):
    t = tt(d)
    x = (saw(f, t) * 0.6 + np.sign(np.sin(2 * np.pi * f * t)) * 0.4)
    x = sweep_filter(x, 6000, 400)
    return x * np.exp(-t / 0.12)


def bell(f, d=1.6):
    t = tt(d)
    parts = [(1, 1, 1.0), (2.76, 0.5, 0.6), (5.4, 0.25, 0.35), (8.93, 0.12, 0.2)]
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (d * dk)) for r, a, dk in parts)
    return x * (1 - np.exp(-t / 0.002)) * 0.3


def bass(f, d):
    t = tt(d)
    x = saw(f, t) * 0.6 + np.sin(2 * np.pi * f * t) * 0.7 + np.sin(2 * np.pi * f / 2 * t) * 0.4
    return lp(x, 900) * adsr(len(t), 0.004, 0.08, 0.8, 0.04)


# ------------------------------------------------------------------ musique
def beat_t(b):
    return T_DROP + b * BEAT   # b négatif = avant le drop


A_MIN = [57, 60, 64]          # La m
F_MAJ = [53, 57, 60]          # Fa
C_MAJ = [55, 60, 64]          # Do (renversé)
G_MAJ = [55, 59, 62]          # Sol
PROG = [A_MIN, F_MAJ, C_MAJ, G_MAJ]

# --- avant le drop : 3 mesures qui montent (filtre qui s'ouvre)
pre = np.zeros((int(T_DROP * SR) + SR, 2))
for bar in range(3):
    t0 = beat_t(-12 + 4 * bar)
    ch = PROG[bar]
    p = pad([midi(m) for m in ch], 4 * BEAT + 0.3) * adsr(int((4 * BEAT + 0.3) * SR), 0.15, 0.2, 0.9, 0.3)[:, None]
    i0 = max(0, int(t0 * SR))
    seg = p[max(0, -int(t0 * SR)):]
    pre[i0:i0 + len(seg)] += seg[:len(pre) - i0]
    # arpège en doubles-croches à partir de la 2e mesure
    if bar >= 1:
        notes = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 24]
        for k in range(16):
            place(music, pluck(midi(notes[k % 4])), t0 + k * BEAT / 4, gain=0.10 + 0.05 * bar,
                  pan=0.35 * np.sin(k), send=0.35)
cut = lambda u: 550 * (5200 / 550) ** (u ** 1.6)
pre = sweep_filter(pre, cut, None)
pre *= np.clip(np.linspace(0, 6, len(pre)), 0, 1)[:, None]
place(music, pre[:int((T_DROP - 0.16) * SR)], 0.0, gain=0.8, send=0.4)

# battement de cœur / grosse caisse qui accélère pendant la gorgée
b = -8
while beat_t(b) < T_DROP - 0.2:
    tb = beat_t(b)
    if tb > T_SIP_START - 0.2:
        place(music, lp(kick(0.6), 1800), tb, gain=0.3 + 0.025 * (b + 8))
    b += 1 if b < -4 else 0.5
# roulement de caisse claire sur la dernière mesure
steps = [(-4 + k * 0.5) for k in range(4)] + [(-2 + k * 0.25) for k in range(6)] + [(-0.5 + k / 8) for k in range(3)]
for k, s_ in enumerate(steps):
    place(music, snare(), beat_t(s_), gain=0.18 + 0.03 * k, pan=0.1, send=0.25)
# charleston léger dès 2e mesure
for k in range(16):
    tb = beat_t(-8 + k * 0.5)
    place(music, hat(), tb, gain=0.25 if k % 2 else 0.12, pan=0.25)

# --- après le drop : groove complet jusqu'au stinger final
duck = np.ones(N)
post_bars = 3
for bar in range(post_bars):
    ch = PROG[bar % 4]
    t0 = beat_t(4 * bar)
    root = ch[0] - 24
    for k in range(4):
        tb = t0 + k * BEAT
        place(music, kick(), tb, gain=0.85)
        i = int(tb * SR)
        dn = min(int(0.3 * SR), N - i)
        duck[i:i + dn] = np.minimum(duck[i:i + dn], 1 - 0.65 * np.exp(-np.arange(dn) / SR / 0.11))
        if k in (1, 3):
            place(music, clap(), tb, gain=0.6, send=0.3)
        place(music, hat(True), tb + BEAT / 2, gain=0.35, pan=0.2)
        for h in range(4):
            place(music, hat(), tb + h * BEAT / 4, gain=0.12 if h % 2 else 0.18, pan=-0.25)
        # basse en croches décalées
        place(music, bass(midi(root), BEAT / 2 * 0.9), tb + BEAT / 2, gain=0.5)
        place(music, bass(midi(root + 12 if k == 3 else root), BEAT / 4), tb + 3 * BEAT / 4, gain=0.35)
    # accords supersaw (stabs sur le contretemps)
    stabs = [0, 0.75, 1.5, 2.5, 3.0, 3.5]
    for s_ in stabs:
        st = supersaw([midi(m + 12) for m in ch], BEAT * 0.45) * adsr(int(BEAT * 0.45 * SR), 0.003, 0.15, 0.4, 0.06)[:, None]
        place(music, st, t0 + s_ * BEAT, gain=0.42, send=0.3)
    # petite mélodie lead
    lead = [ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12, ch[0] + 12, ch[1] + 12]
    for k, m in enumerate(lead):
        place(music, pluck(midi(m + 12), 0.3), t0 + k * BEAT / 2, gain=0.13, pan=0.3 * (-1) ** k, send=0.45)
# nappe de fond post-drop
padpost = pad([midi(m) for m in A_MIN], T_END - T_DROP) * adsr(int((T_END - T_DROP) * SR), 0.05, 0.3, 0.7, 0.4)[:, None]
place(music, lp(padpost, 2500), T_DROP, gain=0.22, send=0.4)
music[:, 0] *= duck
music[:, 1] *= duck

# stinger final : accord + grosse caisse + crash, qui résonne
fin_ch = [57, 64, 69, 72, 76]
st = supersaw([midi(m) for m in fin_ch], 1.6, cutoff=4200) * np.exp(-tt(1.6) / 0.5)[:, None]
place(music, st, T_END, gain=0.6, send=0.7)
place(music, kick(1.2, 0.8), T_END, gain=0.9)
crash = hp(noise(int(1.5 * SR)), 4000) * np.exp(-tt(1.5) / 0.45) * 0.3
place(music, crash, T_END, gain=0.8, pan=0.1, send=0.3)
place(music, bass(midi(33), 1.2) * np.exp(-tt(1.2) / 0.4), T_END, gain=0.55)

# ------------------------------------------------------------------ sound design
def whoosh(d=0.6, f0=400, f1=3000, peak=0.6):
    t = tt(d)
    x = noise(len(t))
    x = sweep_filter(x, lambda u: f0 * (f1 / f0) ** u, None, kind="low")
    x = hp(x, 150)
    env = np.where(t < d * peak, (t / (d * peak)) ** 2, np.exp(-(t - d * peak) / (d * 0.15)))
    return x * env * 0.6


def boom(d=1.6):
    t = tt(d)
    f = 34 + 110 * np.exp(-t / 0.09)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(ph) * np.exp(-t / 0.5)
    crack = lp(noise(len(t)), 3000) * np.exp(-t / 0.05) * 0.5
    return np.tanh((sub + crack) * 1.8) * 0.8


def riser(d):
    t = tt(d)
    u = t / d
    n = noise(len(t))
    n = sweep_filter(n, lambda v: 250 * (7000 / 250) ** (v ** 1.4), None, kind="low")
    n = hp(n, 200)
    f = 180 * (1400 / 180) ** (u ** 1.5)
    tone = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))) / SR)
    tone2 = np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.5
    env = u ** 2.2
    return (n * 0.6 + (tone + tone2) * 0.18) * env


def reverse_cymbal(d=0.9):
    t = tt(d)
    x = hp(noise(len(t)), 3500)
    return x * (t / d) ** 3 * 0.45


def glass_clink():
    t = tt(0.9)
    parts = [(2480, 1.0, 0.28), (4170, 0.6, 0.18), (6310, 0.4, 0.1), (9020, 0.2, 0.06)]
    x = sum(a * np.sin(2 * np.pi * f * t + rng.random() * 6) * np.exp(-t / d) for f, a, d in parts)
    tick = hp(noise(len(t)), 3000) * np.exp(-t / 0.002)
    return (x * 0.3 + tick * 0.2)


def gulp(pitch=1.0):
    t = tt(0.22)
    f = (160 - 70 * t / 0.22) * pitch
    throat = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-((t - 0.035) / 0.03) ** 2)
    click = lp(noise(len(t)), 1800) * np.exp(-((t - 0.02) / 0.006) ** 2) * 0.4
    fb = (350 + 900 * t / 0.06) * pitch
    bub = np.sin(2 * np.pi * np.cumsum(fb) / SR) * np.exp(-((t - 0.07) / 0.018) ** 2) * 0.35
    return lp(throat * 0.9 + click + bub, 2500) * 0.9


def slosh(d=0.5):
    out = np.zeros(int(d * SR))
    for _ in range(14):
        t0 = rng.uniform(0, d - 0.06)
        t = tt(0.05)
        f = rng.uniform(400, 1100) * (1 + 3 * t)
        b_ = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.012)
        i = int(t0 * SR)
        out[i:i + len(b_)] += b_ * rng.uniform(0.2, 0.6)
    return lp(out, 3000) * 0.4


def shimmer(d=1.8, density=60, lo=2600, hi=7000):
    out = np.zeros((int(d * SR), 2))
    for _ in range(int(density * d)):
        t0 = rng.uniform(0, d * 0.8) ** 1.3 / (d * 0.8) ** 0.3
        f = rng.uniform(lo, hi)
        dd = rng.uniform(0.15, 0.5)
        t = tt(dd)
        x = np.sin(2 * np.pi * f * t) * np.exp(-t / (dd / 4)) * (1 - np.exp(-t / 0.002))
        pan = rng.uniform(-0.9, 0.9)
        i = int(t0 * SR)
        n = min(len(x), len(out) - i)
        out[i:i + n, 0] += x[:n] * np.cos((pan + 1) * np.pi / 4)
        out[i:i + n, 1] += x[:n] * np.sin((pan + 1) * np.pi / 4)
    env = np.exp(-tt(d) / (d * 0.45))
    return out * env[:, None] * 0.12


def chime_arp(notes, step=0.045):
    d = step * len(notes) + 1.6
    out = np.zeros(int(d * SR))
    for k, m in enumerate(notes):
        b_ = bell(midi(m), 1.4)
        i = int(k * step * SR)
        out[i:i + len(b_)] += b_ * (0.7 + 0.3 * k / len(notes))
    return out


def power_up(d=0.5):
    """Petit « tchiiing » ascendant, clin d'œil cartoon (potion magique)."""
    t = tt(d)
    f = 500 * 2 ** (3.2 * t / d)
    sq = np.sign(np.sin(2 * np.pi * np.cumsum(f * (1 + 0.04 * np.sin(2 * np.pi * 28 * t))) / SR))
    return lp(sq, 5000) * np.exp(-t / (d * 0.5)) * (1 - np.exp(-t / 0.01)) * 0.12


def soft_thump():
    t = tt(0.5)
    f = 45 + 60 * np.exp(-t / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18) * 0.6


# ouverture : souffle + impact feutré sous le titre
place(sfx, whoosh(0.5, 300, 4000, 0.85), -0.2, gain=0.5, send=0.3)
place(sfx, soft_thump(), 0.27, gain=0.8)
place(sfx, bell(midi(81), 1.2), 0.27, gain=0.15, send=0.6)
# le verre
place(sfx, glass_clink(), T_GRAB, gain=0.55, pan=-0.15, send=0.3)
place(sfx, slosh(0.6), T_GRAB + 0.3, gain=0.6, pan=-0.1)
place(sfx, whoosh(0.35, 500, 2500, 0.7), 2.25, gain=0.25, pan=-0.2)  # le verre monte vers la bouche
# gorgées (de plus en plus rapprochées)
t_g = T_SIP_START + 0.1
k = 0
while t_g < T_SIP_END:
    place(sfx, gulp(1 + 0.03 * k + rng.uniform(-0.04, 0.04)), t_g, gain=0.75 + 0.02 * k, send=0.08)
    t_g += max(0.24, 0.42 - 0.02 * k) + rng.uniform(-0.03, 0.03)
    k += 1
# montée
rd = T_DROP - 2.8
place(sfx, riser(rd), T_DROP - rd - 0.12, gain=0.55, send=0.3)
place(sfx, reverse_cymbal(0.9), T_DROP - 0.9, gain=0.7, send=0.2)
# DROP : l'effet potion
place(sfx, boom(), T_DROP, gain=1.0)
place(sfx, hp(noise(int(0.25 * SR)), 1500) * np.exp(-tt(0.25) / 0.04) * 0.5, T_DROP, gain=0.8)  # flash « clac »
place(sfx, chime_arp([72, 76, 79, 84, 88, 91, 96]), T_DROP + 0.02, gain=0.45, send=0.6)
place(sfx, shimmer(2.2, 55), T_DROP, gain=1.0, send=0.5)
place(sfx, power_up(0.55), T_DROP + 0.05, gain=0.8, send=0.4)
# scintillement qui persiste pendant l'aura
place(sfx, shimmer(3.0, 18, 3500, 8000), T_DROP + 0.8, gain=0.6, send=0.5)
# il sort du cadre (panoramique gauche -> droite)
w = whoosh(0.7, 250, 3500, 0.55)
pan_curve = np.linspace(-0.7, 0.9, len(w))
ws = np.stack([w * np.cos((pan_curve + 1) * np.pi / 4), w * np.sin((pan_curve + 1) * np.pi / 4)], 1) * np.sqrt(2)
place(sfx, ws, T_EXIT - 0.38, gain=0.7, send=0.2)
# logo
place(sfx, reverse_cymbal(0.6), T_LOGO - 0.6, gain=0.5, send=0.3)
place(sfx, whoosh(0.4, 600, 6000, 0.8), T_LOGO - 0.32, gain=0.45)
place(sfx, boom(1.2), T_LOGO, gain=0.6)
place(sfx, chime_arp([84, 88, 91, 96], 0.06), T_LOGO, gain=0.35, send=0.7)
place(sfx, shimmer(1.6, 40), T_LOGO, gain=0.8, send=0.5)
place(sfx, bell(midi(88), 2.0), T_END, gain=0.25, send=0.8)

# ------------------------------------------------------------------ réverb + mix
def make_ir(d=2.2):
    t = tt(d)
    ir = np.stack([noise(len(t)), noise(len(t))], 1) * np.exp(-t / 0.55)[:, None]
    ir = lp(ir, 6000)
    ir[: int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum())


ir = make_ir()
wet = np.stack([signal.fftconvolve(verb_send[:, c], ir[:, c])[:N] for c in range(2)], 1)
wet = hp(wet, 250)

# coupure franche juste avant le drop (« aspiration ») sur la musique
gap = np.ones(N)
i0, i1 = int((T_DROP - 0.16) * SR), int(T_DROP * SR)
gap[i0:i1] = 0.05
music *= gap[:, None]

mix = music * 0.9 + sfx * 1.0 + wet * 0.35
mix = hp(mix, 25)
# bus master : compresseur doux + limiteur
mix = mix / (np.abs(mix).max() + 1e-9) * 1.6
mix = np.tanh(mix) * 0.95
fade = np.ones(N)
fade[-int(0.5 * SR):] = np.linspace(1, 0, int(0.5 * SR)) ** 2
mix *= fade[:, None]
wavfile.write(OUT, SR, (mix * 32767 * 0.9).astype(np.int16))
print("ok", OUT, mix.shape)
