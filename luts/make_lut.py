"""Génère des LUT .cube : Sony S-Log3/S-Log2 (A7 III) -> Rec.709 + look.

Usage : python3 make_lut.py [image_log_a_previsualiser]
Toutes les valeurs du look sont dans LOOK, en haut du fichier.
"""
import sys
import numpy as np
import colour

SIZE = 33

# Réglages du look (tout se règle ici)
LOOK = dict(
    exposure=0.0,        # stops ajoutés avant le tone mapping (rushs légèrement sous-ex)
    temp=-0.03,          # <0 refroidit (compense le blanc trop orange), >0 réchauffe
    tint=-0.015,           # >0 magenta, <0 vert
    contrast=0.92,       # pente de la courbe filmique (en stops)
    black=0.03,          # noir relevé (valeur Rec.709)
    white=0.965,         # blanc maxi (roll-off doux)
    grey=0.41,           # où tombe le gris 18 %
    hue_preserve=0.35,    # 0 = courbe par canal (film), 1 = conserve la teinte
    saturation=0.90,
    red_to_orange=0.015,  # tourne les rouges/bordeaux vers l'orange (anti-magenta)
    skin_protect=0.10,   # rend de la saturation aux teintes peau/orangées
    shadow_tint=(-0.006, 0.0, 0.004),   # ombres très légèrement froides
    high_tint=(0.012, 0.004, -0.014),   # hautes lumières crème
)

S3C_TO_709 = colour.matrix_RGB_to_RGB(
    colour.RGB_COLOURSPACES["S-Gamut3.Cine"], colour.RGB_COLOURSPACES["ITU-R BT.709"])
S3_TO_709 = colour.matrix_RGB_to_RGB(
    colour.RGB_COLOURSPACES["S-Gamut3"], colour.RGB_COLOURSPACES["ITU-R BT.709"])


def legal_to_cv(v):
    # Valeur dans le logiciel (0-1, niveaux vidéo) -> code value / 1023
    return (v * 876 + 64) / 1023


def decode(v, curve):
    cv = legal_to_cv(v)
    if curve == "slog3":
        return colour.models.log_decoding_SLog3(cv)
    return colour.models.log_decoding_SLog2(cv)


def filmic(lin, L):
    # Sigmoïde en stops autour du gris 18 %, sortie directement en valeur Rec.709
    lo, hi, k = L["black"], L["white"], L["contrast"]
    p = (L["grey"] - lo) / (hi - lo)
    s0 = np.log(1 / p - 1) / k
    s = np.log2(np.maximum(lin, 1e-6) / 0.18)
    return lo + (hi - lo) / (1 + np.exp(-k * (s - s0)))


def luma(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722])


def transform(v, curve="slog3", look=True):
    L = LOOK
    lin = decode(v, curve)
    m = S3C_TO_709 if curve == "slog3" else S3_TO_709
    lin = lin @ m.T
    if not look:
        # Conversion neutre : exposition 0, courbe filmique standard
        return np.clip(filmic(lin, dict(L, black=0.0, white=1.0, contrast=0.9, grey=0.43)), 0, 1)
    lin = lin * 2 ** L["exposure"]
    lin = lin * np.array([1 + L["temp"], 1 - L["tint"] * 0.5, 1 - L["temp"]])
    lin = np.maximum(lin, 0)
    # Courbe : mélange par canal / conservation de teinte
    per_ch = filmic(lin, L)
    n = np.maximum(lin.max(-1, keepdims=True), 1e-6)
    ratio = filmic(n, L) * (lin / n)
    out = per_ch * (1 - L["hue_preserve"]) + np.maximum(ratio, L["black"]) * L["hue_preserve"]
    # Saturation avec protection de la peau
    y = luma(out)[..., None]
    hsv = colour.RGB_to_HSV(np.clip(out, 0, 1))
    hsv_h = hsv[..., 0]
    reds = np.exp(-(((hsv_h + 0.5) % 1 - 0.5 - 0.01) / 0.04) ** 2)
    hsv[..., 0] = (hsv_h + L["red_to_orange"] * reds) % 1
    out = colour.HSV_to_RGB(hsv)
    hsv_h = hsv[..., 0]
    skin = np.exp(-((hsv_h - 0.06) / 0.05) ** 2)[..., None]  # ~20° (orange)
    sat = L["saturation"] + L["skin_protect"] * skin
    out = y + (out - y) * sat
    # Split toning ombres / hautes lumières
    w = np.clip(y, 0, 1)
    out = out + np.array(L["shadow_tint"]) * (1 - w) ** 2 + np.array(L["high_tint"]) * w ** 2
    return np.clip(out, 0, 1)


def write_cube(path, curve, look, title):
    g = np.linspace(0, 1, SIZE)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")  # R varie le plus vite
    grid = np.stack([r, gg, b], -1).reshape(-1, 3)
    out = transform(grid, curve, look)
    with open(path, "w") as f:
        f.write(f'TITLE "{title}"\nLUT_3D_SIZE {SIZE}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        np.savetxt(f, out, fmt="%.6f")


def preview(img_path, out_path, curve="slog3"):
    from PIL import Image
    im = np.asarray(Image.open(img_path).convert("RGB")).astype(float) / 255
    res = transform(im, curve, True)
    neutral = transform(im, curve, False)
    tiles = [im, neutral, res]
    Image.fromarray((np.concatenate(tiles, 1) * 255 + 0.5).astype(np.uint8)).save(out_path, quality=90)


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for curve, gamut in [("slog3", "SGamut3Cine"), ("slog2", "SGamut3")]:
        tag = "SLog3" if curve == "slog3" else "SLog2"
        write_cube(f"{here}/{tag}_{gamut}_to_Rec709_LOOK.cube", curve, True, f"{tag} {gamut} -> Rec709 Look")
        write_cube(f"{here}/{tag}_{gamut}_to_Rec709_NEUTRE.cube", curve, False, f"{tag} {gamut} -> Rec709 neutre")
    if len(sys.argv) > 1:
        preview(sys.argv[1], f"{here}/apercu_avant_neutre_look.jpg")
