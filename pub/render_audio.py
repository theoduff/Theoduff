"""Ambiance d'été (maison ouverte) + bruitages réalistes, synthétisés et calés sur la timeline.

Pas de musique : brise, feuillages, oiseaux au loin, cigales lointaines, ton de pièce.
Pendant la gorgée, l'ambiance se referme (filtrée, plus basse) ; au moment du boost
elle se rouvre d'un coup avec une bouffée d'air : c'est le « coup de frais ».

Usage : python3 render_audio.py OUT.wav
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

from timeline import SR, DUR, T_DROP, T_GRAB, T_SIP_START, T_SIP_END

OUT = sys.argv[1]
rng = np.random.default_rng(11)
N = int(DUR * SR)
amb = np.zeros((N, 2))      # ambiance (subit l'effet « bulle » pendant la gorgée)
birds = np.zeros((N, 2))    # oiseaux (envoyés dans une réverb extérieure)
foley = np.zeros((N, 2))    # bruitages proches
room_send = np.zeros((N, 2))


# ------------------------------------------------------------------ outils
def tt(d):
    return np.arange(int(d * SR)) / SR


def pan2(x, pan):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l, x * r], 1) * np.sqrt(2)


def place(bus, x, t0, gain=1.0, pan=0.0, send=0.0):
    if x.ndim == 1:
        x = pan2(x, pan)
    i0 = int(round(t0 * SR))
    if i0 < 0:
        x, i0 = x[-i0:], 0
    n = min(len(x), N - i0)
    if n <= 0:
        return
    bus[i0:i0 + n] += x[:n] * gain
    if send:
        room_send[i0:i0 + n] += x[:n] * gain * send


def filt(x, f, kind, order=2):
    return signal.sosfilt(signal.butter(order, f, kind, fs=SR, output="sos"), x, axis=0)


def noise(n):
    return rng.standard_normal(n)


def smooth_noise(n, rate_hz):
    """Bruit lent (LFO aléatoire) normalisé ~[-1, 1]."""
    k = max(2, int(n * rate_hz / SR) + 2)
    pts = rng.standard_normal(k)
    x = np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)
    return x / (np.abs(x).max() + 1e-9)


def sweep_lowpass(x, cutoff, block=256):
    """Passe-bas dont la coupure suit la courbe `cutoff` (un échantillon par bloc)."""
    y = np.zeros_like(x)
    zi = None
    for b in range(0, len(x), block):
        f = float(np.clip(cutoff[min(b, len(cutoff) - 1)], 30, SR / 2 - 500))
        sos = signal.butter(2, f, "low", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2) + x.shape[1:])
        y[b:b + block], zi = signal.sosfilt(sos, x[b:b + block], axis=0, zi=zi)
    return y


# ------------------------------------------------------------------ ambiance
t_all = np.arange(N) / SR

# ton de pièce (grave, très bas)
room = np.stack([filt(noise(N), 250, "low"), filt(noise(N), 250, "low")], 1)
amb += room * 0.08

# brise par les fenêtres ouvertes : rafales lentes, stéréo décorrélée
gust = 0.55 + 0.45 * smooth_noise(N, 0.35)
gust = np.clip(gust, 0.15, 1.0)
for c, p in ((0, -0.5), (1, 0.5)):
    w = filt(noise(N), [180, 1400], "band")
    amb[:, c] += w * gust * 0.07
# feuillages : bruit aigu granuleux, suit les rafales
leaves = filt(noise(N), 2500, "high") * (np.abs(filt(noise(N), 40, "low")) * 6)
for c in range(2):
    amb[:, c] += np.roll(leaves, c * 997) * gust ** 2 * 0.008

# cigales très lointaines (pulsation rapide, bande étroite)
cic = filt(noise(N), [4200, 5600], "band")
cic *= (0.5 + 0.5 * np.sin(2 * np.pi * 62 * t_all)) ** 3
cic *= 0.6 + 0.4 * smooth_noise(N, 0.2)
amb += pan2(cic, 0.6) * 0.005
amb += pan2(np.roll(cic, 12345), -0.7) * 0.003


# ------------------------------------------------------------------ oiseaux (au loin)
def chirp_note(f0, f1, d, vib=0.0, harm=0.15):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    f = f * (1 + vib * np.sin(2 * np.pi * 28 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + harm * np.sin(2 * ph)
    env = np.sin(np.pi * t / d) ** 1.5
    return x * env


def sparrow_phrase():
    """Pépiements secs (moineau)."""
    out = []
    for _ in range(rng.integers(3, 7)):
        f = rng.uniform(3200, 4600)
        out.append(chirp_note(f * 1.15, f * 0.85, rng.uniform(0.05, 0.09), harm=0.25))
        out.append(np.zeros(int(rng.uniform(0.06, 0.16) * SR)))
    return np.concatenate(out)


def blackbird_phrase():
    """Phrase flûtée et mélodique (merle)."""
    out = []
    base = rng.uniform(1700, 2300)
    for _ in range(rng.integers(4, 8)):
        f0 = base * 2 ** (rng.integers(-3, 6) / 12)
        f1 = f0 * 2 ** (rng.uniform(-3, 3) / 12)
        out.append(chirp_note(f0, f1, rng.uniform(0.08, 0.22), vib=0.01, harm=0.08))
        out.append(np.zeros(int(rng.uniform(0.02, 0.08) * SR)))
    # petite fin gazouillée
    for _ in range(rng.integers(2, 5)):
        f = rng.uniform(4500, 6500)
        out.append(chirp_note(f, f * 0.8, 0.03))
        out.append(np.zeros(int(0.015 * SR)))
    return np.concatenate(out)


def tit_phrase():
    """« ti-tu ti-tu ti-tu » (mésange)."""
    out = []
    hi, lo = rng.uniform(5200, 6200), rng.uniform(3600, 4200)
    for _ in range(rng.integers(3, 5)):
        out += [chirp_note(hi, hi * 0.97, 0.06), np.zeros(int(0.03 * SR)),
                chirp_note(lo, lo * 0.95, 0.08), np.zeros(int(0.08 * SR))]
    return np.concatenate(out)


def dove_call():
    """Roucoulement de tourterelle, grave et doux."""
    out = []
    for d, f in ((0.35, 520), (0.55, 560), (0.3, 500)):
        t = tt(d)
        x = np.sin(2 * np.pi * f * t * (1 - 0.06 * t / d)) * np.sin(np.pi * t / d) ** 2
        out += [x, np.zeros(int(0.12 * SR))]
    return np.concatenate(out)


def bird(x, dist):
    """Éloigne un chant : filtre les aigus et atténue selon la distance."""
    x = filt(x, 9000 - 5000 * dist, "low")
    return filt(x, 3500, "low") * (0.012 * (1 - 0.6 * dist))  # à travers la fenêtre


events = [(blackbird_phrase, 0.6, 0.9, -0.6), (sparrow_phrase, 3.4, 0.9, 0.6),
          (blackbird_phrase, 7.2, 0.9, -0.5)]
for fn, t0, dist, pan in events:
    place(birds, bird(fn(), dist), t0 + rng.uniform(-0.15, 0.15), pan=pan)


# ------------------------------------------------------------------ bruitages
def slosh(d=0.6):
    out = np.zeros(int(d * SR))
    for _ in range(18):
        t0 = rng.uniform(0, d - 0.06)
        t = tt(0.05)
        f = rng.uniform(350, 900) * (1 + 2.5 * t)
        b_ = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.01)
        i = int(t0 * SR)
        out[i:i + len(b_)] += b_ * rng.uniform(0.15, 0.5)
    wash = filt(noise(len(out)), [300, 2000], "band") * np.sin(np.pi * np.arange(len(out)) / len(out)) * 0.3
    return filt(out + wash, 2500, "low") * 0.35


def drink_stream(d):
    """Liquide qui coule du verre aux lèvres : petites bulles (hauteur montante) + souffle humide."""
    n = int(d * SR)
    out = np.zeros(n)
    dens = 0.5 + 0.5 * smooth_noise(n, 3)
    for _ in range(int(55 * d)):
        t0 = rng.uniform(0, d - 0.04)
        if rng.random() > dens[int(t0 * SR)]:
            continue
        bt = tt(rng.uniform(0.015, 0.035))
        f = rng.uniform(450, 1300) * (1 + 3 * bt)
        b_ = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-bt / 0.008)
        i = int(t0 * SR)
        out[i:i + len(b_)] += b_ * rng.uniform(0.1, 0.4)
    wash = filt(noise(n), [250, 1500], "band") * (0.4 + 0.6 * dens) * 0.25
    env = np.minimum(1, np.minimum(np.arange(n), n - np.arange(n)) / (0.08 * SR))
    return filt(out + wash, 1800, "low", 4) * env * 0.4


def swallow():
    """Déglutition : courte masse grave étouffée, comme captée près de la gorge."""
    t = tt(0.3)
    body = filt(noise(len(t)), [70, 260], "band", 2) * np.exp(-((t - 0.09) / 0.045) ** 2) * 3.0
    wet = filt(noise(len(t)), [300, 1200], "band") * np.exp(-((t - 0.04) / 0.015) ** 2) * 0.25
    return filt(body + wet, 1200, "low", 4) * 0.5



def cloth(d=0.5):
    t = tt(d)
    x = filt(noise(len(t)), [400, 4000], "band")
    return x * np.sin(np.pi * t / d) ** 2 * (0.6 + 0.4 * smooth_noise(len(t), 30)) * 0.12


def air_gust(d=1.6):
    """Bouffée d'air frais qui s'ouvre au moment du boost."""
    t = tt(d)
    x = np.stack([filt(noise(len(t)), [250, 3500], "band"), filt(noise(len(t)), [250, 3500], "band")], 1)
    env = (1 - np.exp(-t / 0.05)) * np.exp(-t / 0.55)
    return x * env[:, None] * 0.22


# le verre
place(foley, slosh(0.6), T_GRAB + 0.3, gain=0.55, pan=-0.1, send=0.1)
place(foley, cloth(0.4), T_GRAB + 0.2, gain=0.6)
# gorgées
place(foley, drink_stream(T_SIP_END - T_SIP_START), T_SIP_START, gain=0.9)
t_g = T_SIP_START + 0.45
while t_g < T_SIP_END:
    place(foley, swallow(), t_g, gain=0.9 + rng.uniform(-0.1, 0.1))
    t_g += rng.uniform(0.5, 0.65)
# il repose le bras et se tourne
place(foley, cloth(0.6), T_DROP + 0.65, gain=0.8, pan=0.1)
# le boost : bouffée d'air + inspiration de soulagement (souffle filtré), très doux
place(amb, air_gust(), T_DROP - 0.02, gain=1.0)
t = tt(0.6)
breath = filt(noise(len(t)), [600, 3000], "band") * np.sin(np.pi * t / 0.6) ** 2 * 0.06
place(foley, breath, T_DROP + 0.05, gain=1.0)
place(foley, filt(noise(int(0.4 * SR)), 90, "low") * np.exp(-tt(0.4) / 0.08) * 1.2, T_DROP, gain=0.5)

# ------------------------------------------------------------------ réverbs
def ir(d, decay, lp_f):
    t = tt(d)
    x = np.stack([noise(len(t)), noise(len(t))], 1) * np.exp(-t / decay)[:, None]
    x = filt(x, lp_f, "low")
    x[: int(0.008 * SR)] = 0
    return x / np.sqrt((x ** 2).sum())


def conv(x, h):
    return np.stack([signal.fftconvolve(x[:, c], h[:, c])[:N] for c in range(2)], 1)


birds = birds + conv(birds, ir(0.5, 0.1, 3000)) * 0.4    # dehors, filtré par la fenêtre
room_wet = conv(room_send, ir(0.6, 0.12, 6000))          # cuisine

# ------------------------------------------------------------------ « bulle » pendant la gorgée
env_bus = birds + amb
cut = np.full(N, 16000.0)
gain = np.ones(N)
a, b = int((T_SIP_START - 0.2) * SR), int((T_DROP - 0.05) * SR)
u = np.linspace(0, 1, b - a)
cut[a:b] = 16000 * (700 / 16000) ** (u ** 0.8)
gain[a:b] = 1 - 0.45 * u
# réouverture franche au boost, avec un léger surplus pendant une seconde
c_ = min(N, b + int(1.2 * SR))
cut[b:] = 16000
gain[b:c_] = 1 + 0.25 * np.exp(-np.linspace(0, 1.2, c_ - b) / 0.5)
env_bus = sweep_lowpass(env_bus, cut) * gain[:, None]

mix = env_bus + foley + room_wet * 0.3
mix = filt(mix, 30, "high")
# fondus
fi = int(0.4 * SR)
mix[:fi] *= np.linspace(0, 1, fi)[:, None]
fo = int(1.0 * SR)
mix[-fo:] *= (np.linspace(1, 0, fo) ** 2)[:, None]
mix = mix / (np.abs(mix).max() + 1e-9) * 0.9
wavfile.write(OUT, SR, (mix * 32767).astype(np.int16))
print("ok", OUT, mix.shape)
