"""Génère « Matin d'Hiver » : LUT .cube 33 pts pour images Rec.709 (non-log) ternes/brumeuses.
Usage : python3 make_lut.py [sortie.cube] [image_test]"""
import sys
import numpy as np

N = 33

def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

def grade(rgb):
    x = rgb.copy()
    # 1. Dé-brumage : abaisse le voile gris (noirs plus profonds), garde les hautes lumières
    x = np.clip((x - 0.07) / (0.98 - 0.07), 0, 1)
    # 2. Courbe en S douce (contraste) autour de 0.5
    x = x + 0.14 * np.sin(2 * np.pi * (x - 0.5)) / (2 * np.pi) * 2
    x = np.clip(x, 0, 1)
    luma = x @ np.array([0.2126, 0.7152, 0.0722])
    # 3. Split-toning : ombres bleu-acier froid, hautes lumières pêche/lever du soleil
    sh = (1 - smoothstep(0.0, 0.55, luma))[..., None]
    hi = smoothstep(0.45, 1.0, luma)[..., None]
    x = x + sh * np.array([-0.06, 0.0, 0.055]) + hi * np.array([0.035, 0.012, -0.03])
    # 4. Saturation (+45 %), atténuée aux extrêmes pour éviter les couleurs criardes
    luma = x @ np.array([0.2126, 0.7152, 0.0722])
    w = (1 - np.abs(2 * luma - 1) ** 2)[..., None]
    x = luma[..., None] + (x - luma[..., None]) * (1 + 0.45 * w)
    # 5. Neutralise la dominante brun/magenta des tons moyens (eau plus bleu-acier)
    mid = (1 - np.abs(2 * luma - 1))[..., None]
    x = x + mid * np.array([-0.03, 0.0, 0.035])
    return np.clip(x, 0, 1)

def write_cube(path):
    r = np.linspace(0, 1, N)
    # Ordre .cube : R varie le plus vite
    b, g, rr = np.meshgrid(r, r, r, indexing="ij")
    grid = np.stack([rr, g, b], -1).reshape(-1, 3)
    out = grade(grid)
    with open(path, "w") as f:
        f.write('TITLE "Matin d\'Hiver"\n')
        f.write("# Rec.709 in -> Rec.709 out. Images non-log, brumeuses/grises.\n")
        f.write(f"LUT_3D_SIZE {N}\nDOMAIN_MIN 0.0 0.0 0.0\nDOMAIN_MAX 1.0 1.0 1.0\n\n")
        for v in out:
            f.write(f"{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "Matin_d_Hiver.cube"
    write_cube(out)
    if len(sys.argv) > 2:
        from PIL import Image
        img = np.asarray(Image.open(sys.argv[2]).convert("RGB")) / 255.0
        g = (grade(img) * 255 + 0.5).astype(np.uint8)
        side = np.concatenate([(img * 255).astype(np.uint8), g], 1)
        Image.fromarray(side).save(out.rsplit(".", 1)[0] + "_avant_apres.jpg", quality=88)
