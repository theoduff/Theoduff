"""Génère « Ciel d'Orage » : LUT .cube 33 pts pour images Rec.709 (non-log) sous ciel couvert,
nuages ternes et eau très sombre. Look : nuages blancs et volumineux, eau bleu-pétrole lisible,
verts denses, couleurs vives (bateau, peau).
Usage : python3 make_lut_orage.py [sortie.cube] [image_test]"""
import sys
import numpy as np
from make_lut import smoothstep, write_cube

LUMA = np.array([0.2126, 0.7152, 0.0722])

def grade(rgb):
    x = rgb.copy()
    # 1. Point blanc : les nuages plafonnent vers 0.77, on les étire jusqu'au blanc (sans clipper)
    x = x / 0.86
    x = np.where(x > 0.85, 0.85 + 0.15 * np.tanh((x - 0.85) / 0.15), x)
    # 2. Débouche les ombres (détail de l'eau) en gardant un vrai noir
    x = np.clip(x, 0, 1)
    x = x + 0.10 * x * (1 - x) ** 3 * 4
    # 3. Contraste local dans les tons moyens-hauts : nuages plus sculptés
    x = np.clip(x + 0.08 * np.sin(2 * np.pi * (x - 0.5)) / np.pi * smoothstep(0.3, 0.6, x), 0, 1)
    luma = x @ LUMA
    # 4. Split-toning : ombres bleu-pétrole (eau), hautes lumières très légèrement chaudes
    sh = (1 - smoothstep(0.0, 0.5, luma))[..., None]
    hi = smoothstep(0.55, 1.0, luma)[..., None]
    x = x + sh * np.array([-0.025, 0.006, 0.02]) + hi * np.array([0.015, 0.008, -0.012])
    # 5. Vibrance avec protection de la peau
    luma = x @ LUMA
    chroma = x.max(-1) - x.min(-1)
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    skin = np.clip(1 - np.abs((r - g) / (chroma + 1e-6) - 0.55) * 2.5, 0, 1) * (r > g) * (g > b)
    amt = 0.6 * (1 - np.clip(chroma / 0.5, 0, 1)) * (1 - 0.6 * skin)
    amt *= 1 - np.abs(2 * luma - 1) ** 3
    x = luma[..., None] + (x - luma[..., None]) * (1 + amt[..., None])
    return np.clip(x, 0, 1)

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "Ciel_d_Orage.cube"
    write_cube(out, grade, "Ciel d'Orage")
    if len(sys.argv) > 2:
        from PIL import Image
        img = np.asarray(Image.open(sys.argv[2]).convert("RGB")) / 255.0
        g = (grade(img) * 255 + 0.5).astype(np.uint8)
        side = np.concatenate([(img * 255).astype(np.uint8), g], 1)
        Image.fromarray(side).save(out.rsplit(".", 1)[0] + "_avant_apres.jpg", quality=88)
