"""Génère « Soleil d'Hiver » : LUT .cube 33 pts pour images Rec.709 (non-log) ensoleillées
mais ternes (bruns boueux, eau sans couleur). Look : eau bleu nuit, lumière dorée, peau préservée.
Usage : python3 make_lut_soleil.py [sortie.cube] [image_test]"""
import sys
import numpy as np
from make_lut import smoothstep, write_cube

LUMA = np.array([0.2126, 0.7152, 0.0722])

def grade(rgb):
    x = rgb.copy()
    # 1. Contraste : courbe en S douce, noirs légèrement plus denses
    x = np.clip((x - 0.02) / 0.98, 0, 1)
    x = np.clip(x + 0.12 * np.sin(2 * np.pi * (x - 0.5)) / np.pi, 0, 1)
    luma = x @ LUMA
    # 2. Retire la dominante olive/jaune des tons moyens
    mid = (1 - np.abs(2 * luma - 1))[..., None]
    x = x + mid * np.array([-0.01, -0.012, 0.025])
    # 3. Split-toning : ombres bleu nuit (eau), hautes lumières dorées (soleil)
    luma = x @ LUMA
    sh = (1 - smoothstep(0.0, 0.45, luma))[..., None]
    hi = smoothstep(0.5, 1.0, luma)[..., None]
    x = x + sh * np.array([-0.035, 0.0, 0.04]) + hi * np.array([0.03, 0.012, -0.025])
    # 4. Vibrance : sature davantage les couleurs ternes, ménage la peau (tons orangés déjà saturés)
    luma = x @ LUMA
    chroma = x.max(-1) - x.min(-1)
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    skin = np.clip(1 - np.abs((r - g) / (chroma + 1e-6) - 0.55) * 2.5, 0, 1) * (r > g) * (g > b)
    amt = 0.5 * (1 - np.clip(chroma / 0.5, 0, 1)) * (1 - 0.6 * skin)
    amt *= 1 - np.abs(2 * luma - 1) ** 3
    x = luma[..., None] + (x - luma[..., None]) * (1 + amt[..., None])
    return np.clip(x, 0, 1)

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "Soleil_d_Hiver.cube"
    write_cube(out, grade, "Soleil d'Hiver")
    if len(sys.argv) > 2:
        from PIL import Image
        img = np.asarray(Image.open(sys.argv[2]).convert("RGB")) / 255.0
        g = (grade(img) * 255 + 0.5).astype(np.uint8)
        side = np.concatenate([(img * 255).astype(np.uint8), g], 1)
        Image.fromarray(side).save(out.rsplit(".", 1)[0] + "_avant_apres.jpg", quality=88)
