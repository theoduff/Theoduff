# LUT Sony A7 III : LOG -> Rec.709 + look chaud et doux

| Fichier | Quand l'utiliser |
|---|---|
| `SLog3_SGamut3Cine_to_Rec709_LOOK.cube` | Rush en **S-Log3 / S-Gamut3.Cine** (PP8 ou PP9 sur A7 III) : conversion + look |
| `SLog3_SGamut3Cine_to_Rec709_NEUTRE.cube` | Même profil, conversion Rec.709 seule (base pour étalonner à la main) |
| `SLog2_SGamut3_to_Rec709_*.cube` | Si le rush est en **S-Log2 / S-Gamut3** (PP7) |

- Appliquer la LUT **en premier** sur le clip LOG. Dans Premiere Pro : Lumetri > Correction de base > LUT d'entrée. Dans DaVinci Resolve : sur le premier nœud.
- Laisser les niveaux du clip en **vidéo** (16-235), le réglage par défaut.
- Le look compense une balance des blancs un peu orangée et une légère sous-exposition de cette session. Pour une autre lumière, corriger l'exposition et la balance avant la LUT.
- `make_lut.py` regénère les LUT. Tous les réglages sont dans `LOOK`.
- `apercu_avant_neutre_look.jpg` montre, de gauche à droite : le LOG, la conversion neutre, le look.
