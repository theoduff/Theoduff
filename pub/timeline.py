"""Timeline partagée entre le rendu vidéo et le sound design (temps en secondes, sortie)."""
import numpy as np
from scipy.interpolate import PchipInterpolator

FPS = 30
SR = 48000
DUR = 11.0

BPM = 125.2
BEAT = 60.0 / BPM
T_DROP = 12 * BEAT          # ~5.75 s : fin de la gorgée -> effet "potion magique"
T_END = T_DROP + 8 * BEAT   # stinger final, calé sur une mesure

# Remappage temps sortie -> temps source (rampes de vitesse lissées)
_KEYS = np.array([
    (0.00, 0.00),
    (2.60, 2.60),     # 1x : il attrape le verre
    (5.20, 6.75),     # ~1.6x : la gorgée, resserrée
    (T_DROP, 7.05),   # ralenti juste avant l'effet
    (6.55, 7.50),     # ralenti pendant l'effet
    (9.00, 10.60),    # ~1.3x : il repart plein d'énergie
    (9.60, 11.20),    # cuisine vide
])
_map = PchipInterpolator(_KEYS[:, 0], _KEYS[:, 1])
SRC_END = 11.20


def src_time(t):
    return float(np.clip(_map(min(t, _KEYS[-1, 0])), 0.0, SRC_END - 1.0 / FPS))


# Repères son
T_GRAB = 2.05             # il saisit le verre
T_SIP_START = 2.85
T_SIP_END = T_DROP - 0.30
T_EXIT = 8.70             # il sort du cadre
