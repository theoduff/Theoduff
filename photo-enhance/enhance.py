#!/usr/bin/env python3
"""Amélioration de photos de nuit / sous la pluie, sans IA générative.

Chaîne (100 % traitements classiques, aucun pixel « inventé ») :
  1. Correction de la balance des blancs (gray-world partiel, sur les tons moyens)
     et des niveaux (étirement doux de la luminance).
  2. Réduction du bruit Non-Local Means, plus forte sur la chrominance
     (le bruit coloré est le plus visible la nuit) que sur la luminance.
  3. Contraste local léger (CLAHE) et accentuation douce (unsharp mask).

Visages : ils sont détectés (YuNet, détection uniquement, aucune génération)
et protégés par un masque adouci. Dans ces zones on garde les pixels
d'origine : ni débruitage, ni accentuation, ni contraste local. Seule la
correction de couleur globale (étape 1, identique pour toute l'image) y est
appliquée pour que la peau ne jure pas avec le reste. Avec --faces-original,
même cette correction est retirée : les visages sont strictement intacts.

Usage :
  python3 enhance.py ENTREE [ENTREE ...] -o SORTIE [options]
  (ENTREE = fichiers ou dossiers ; JPG, PNG, TIFF, HEIC et RAW acceptés)
"""
import argparse
import json
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
FACE_MODEL = HERE / "face_detection_yunet_2023mar.onnx"
RAW_EXT = {".dng", ".cr2", ".cr3", ".nef", ".arw", ".raf", ".orf", ".rw2", ".pef", ".srw"}
IMG_EXT = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".heif", ".webp"} | RAW_EXT

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass


# ---------------------------------------------------------------- lecture / écriture

def load(path):
    """Renvoie (image BGR uint8, exif bytes ou None)."""
    if path.suffix.lower() in RAW_EXT:
        import rawpy
        with rawpy.imread(str(path)) as raw:
            rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=False, output_bps=8)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), None
    im = Image.open(path)
    exif = im.info.get("exif")
    im = ImageOps.exif_transpose(im).convert("RGB")
    return cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR), exif


def save(bgr, path, exif, quality):
    im = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    kw = {"quality": quality, "subsampling": 0} if path.suffix.lower() in {".jpg", ".jpeg"} else {}
    if exif:
        # L'image a déjà été redressée : on remet l'orientation EXIF à 1.
        ex = Image.Exif()
        ex.load(exif)
        ex[0x0112] = 1
        kw["exif"] = ex.tobytes()
    im.save(path, **kw)


# ---------------------------------------------------------------- visages

def detect_faces(bgr, score=0.6):
    """Boîtes (x, y, w, h) des visages, en coordonnées de l'image complète."""
    h, w = bgr.shape[:2]
    scale = min(1.0, 1600 / max(h, w))
    small = cv2.resize(bgr, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    sh, sw = small.shape[:2]
    det = cv2.FaceDetectorYN.create(str(FACE_MODEL), "", (sw, sh), score, 0.3, 5000)
    boxes = []
    # La nuit les visages sont sombres : on cherche aussi sur une version éclaircie.
    lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB)
    lab[..., 0] = cv2.createCLAHE(3.0, (8, 8)).apply(lab[..., 0])
    for img in (small, cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)):
        _, faces = det.detect(img)
        if faces is not None:
            boxes += [tuple(f[:4] / scale) for f in faces]
    return boxes


def face_mask(shape, boxes, margin=0.45):
    """Masque flottant 0..1, ellipses élargies (visage + cheveux + cou) aux bords adoucis."""
    h, w = shape[:2]
    m = np.zeros((h, w), np.float32)
    for x, y, bw, bh in boxes:
        cx, cy = x + bw / 2, y + bh / 2 - 0.08 * bh
        ax, ay = bw / 2 * (1 + 2 * margin), bh / 2 * (1 + 2 * margin)
        cv2.ellipse(m, (round(cx), round(cy)), (round(ax), round(ay)), 0, 0, 360, 1.0, -1)
    if boxes:
        k = int(max(15, 0.25 * np.median([b[2] for b in boxes]))) | 1
        m = cv2.dilate(m, None, iterations=1)
        m = cv2.GaussianBlur(m, (0, 0), k / 3)
        m = np.clip(m * 1.3, 0, 1)
    return m


# ---------------------------------------------------------------- traitements

def estimate_noise(gray):
    """Écart-type du bruit (méthode d'Immerkær)."""
    k = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], np.float32)
    sig = np.abs(cv2.filter2D(gray.astype(np.float32), -1, k))
    h, w = gray.shape
    return float(sig.sum() * np.sqrt(np.pi / 2) / (6 * (w - 2) * (h - 2)))


def correct_color(bgr, wb_strength, levels):
    """Balance des blancs + niveaux. Transformation globale, pixel par pixel."""
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, a, b = lab[..., 0], lab[..., 1] - 128, lab[..., 2] - 128

    # Gray-world sur les tons moyens peu saturés (on ignore lampadaires, ciel noir, néons).
    chroma = np.hypot(a, b)
    sel = (L > 40) & (L < 220) & (chroma < 40)
    if sel.sum() > 1000:
        # Cible légèrement chaude : une scène de nuit 100 % neutre paraît froide et fausse.
        # Correction atténuée dans les noirs pour qu'un ciel noir ne vire pas au bleu.
        w = wb_strength * np.clip((L - 8) / 60, 0, 1)
        a -= w * (float(np.median(a[sel])) - 1.0)
        b -= w * (float(np.median(b[sel])) - 6.0)

    if levels:
        lo, hi = np.percentile(L, (0.5, 99.7))
        lo, hi = min(lo, 25), max(hi, 230)  # étirement doux : jamais d'écrêtage agressif
        L = np.clip((L - lo) * 255.0 / max(hi - lo, 1), 0, 255)
        # Légère remontée des ombres (courbe gamma sur les bas niveaux seulement).
        L = 255 * np.power(L / 255, 0.96)

    out = np.dstack([L, a + 128, b + 128]).clip(0, 255).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_LAB2BGR)


def denoise(bgr, strength):
    """NL-means plus fort dans les ombres (là où le bruit se voit) que dans les zones claires,
    pour garder la texture réelle (gouttes, gazon mouillé) dans les hautes lumières."""
    sigma = estimate_noise(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY))
    h_lum = float(np.clip(sigma * 3.0 * strength, 5, 16))
    h_col = float(np.clip(sigma * 4.0 * strength, 8, 24))
    strong = cv2.fastNlMeansDenoisingColored(bgr, None, h_lum, h_col, 7, 21)
    light = cv2.fastNlMeansDenoisingColored(bgr, None, h_lum * 0.45, h_col, 7, 21)
    L = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[..., 0].astype(np.float32)
    dark = np.clip((140 - cv2.GaussianBlur(L, (0, 0), 3)) / 100, 0, 1)
    return blend(strong, light, dark), sigma, h_lum, h_col


def local_contrast(bgr, clip):
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    tiles = max(4, round(max(bgr.shape[:2]) / 512))
    L0 = lab[..., 0]
    L = cv2.createCLAHE(clip, (tiles, tiles)).apply(L0)
    # Pas de contraste local dans les ombres : il y ferait ressortir le grain.
    w = 0.5 * np.clip((cv2.GaussianBlur(L0, (0, 0), 3).astype(np.float32) - 50) / 80, 0, 1)
    lab[..., 0] = (L0 * (1 - w) + L * w).round().astype(np.uint8)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def sharpen(bgr, amount):
    radius = max(1.0, max(bgr.shape[:2]) / 3000)
    blur = cv2.GaussianBlur(bgr, (0, 0), radius)
    sharp = cv2.addWeighted(bgr, 1 + amount, blur, -amount, 0)
    # Accentuation limitée aux vrais contours, pas aux zones planes (où il n'y a que du bruit).
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
    edges = cv2.GaussianBlur(np.hypot(cv2.Sobel(g, -1, 1, 0), cv2.Sobel(g, -1, 0, 1)), (0, 0), 2)
    return blend(sharp, bgr, np.clip((edges - 20) / 40, 0, 1))


def blend(a, b, mask):
    m = mask[..., None]
    return (a.astype(np.float32) * m + b.astype(np.float32) * (1 - m)).round().astype(np.uint8)


# ---------------------------------------------------------------- pipeline

def process(path, out_dir, args):
    orig, exif = load(path)
    colored = correct_color(orig, args.wb, not args.no_levels)

    enhanced, sigma, hl, hc = denoise(colored, args.denoise) if args.denoise > 0 else (colored, 0, 0, 0)
    if args.contrast > 0:
        enhanced = local_contrast(enhanced, args.contrast)
    if args.sharpen > 0:
        enhanced = sharpen(enhanced, args.sharpen)

    boxes = [] if args.no_faces else detect_faces(orig, args.face_score)
    boxes += [tuple(b) for b in args.manual_faces.get(path.name, [])]
    mask = face_mask(orig.shape, boxes)
    protected = orig if args.faces_original else colored
    result = blend(protected, enhanced, mask) if boxes else enhanced

    out = out_dir / (path.stem + "_ameliore" + (".jpg" if path.suffix.lower() in RAW_EXT | {".heic", ".heif"} else path.suffix))
    save(result, out, exif, args.quality)

    if args.preview:
        prev_dir = out_dir / "apercus"
        prev_dir.mkdir(exist_ok=True)
        dbg = result.copy()
        for x, y, w, h in boxes:
            cv2.rectangle(dbg, (int(x), int(y)), (int(x + w), int(y + h)), (0, 255, 0), max(2, orig.shape[1] // 600))
        side = np.hstack([orig, dbg])
        s = 2400 / side.shape[1]
        side = cv2.resize(side, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(prev_dir / f"{path.stem}_avant_apres.jpg"), side, [cv2.IMWRITE_JPEG_QUALITY, 88])

    print(f"{path.name}: bruit≈{sigma:.1f} (h lum {hl:.1f} / coul {hc:.1f}), "
          f"{len(boxes)} visage(s) protégé(s) -> {out.name}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("inputs", nargs="+", type=Path)
    p.add_argument("-o", "--out", type=Path, default=Path("ameliorees"))
    p.add_argument("--denoise", type=float, default=1.0, help="force du débruitage (0 = off, 1 = auto, >1 plus fort)")
    p.add_argument("--wb", type=float, default=0.6, help="force de la correction des blancs, 0..1")
    p.add_argument("--contrast", type=float, default=1.5, help="contraste local CLAHE (0 = off)")
    p.add_argument("--sharpen", type=float, default=0.35, help="accentuation (0 = off)")
    p.add_argument("--no-levels", action="store_true", help="ne pas toucher aux niveaux/exposition")
    p.add_argument("--faces-original", action="store_true",
                   help="visages strictement d'origine (même pas de correction couleur)")
    p.add_argument("--no-faces", action="store_true", help="désactiver la protection des visages")
    p.add_argument("--face-score", type=float, default=0.6, help="seuil de détection des visages")
    p.add_argument("--faces-file", type=Path,
                   help='JSON {"photo.jpg": [[x, y, l, h], ...]} : visages à protéger en plus '
                        "(utile pour les visages de profil que la détection rate)")
    p.add_argument("--quality", type=int, default=95)
    p.add_argument("--preview", action="store_true", help="générer des aperçus avant/après")
    args = p.parse_args()
    args.manual_faces = json.loads(args.faces_file.read_text()) if args.faces_file else {}

    files = []
    for i in args.inputs:
        files += sorted(f for f in i.rglob("*") if f.suffix.lower() in IMG_EXT) if i.is_dir() else [i]
    if not files:
        sys.exit("Aucune image trouvée.")
    args.out.mkdir(parents=True, exist_ok=True)
    cv2.setNumThreads(os.cpu_count() or 1)
    for f in files:
        try:
            process(f, args.out, args)
        except Exception as e:  # une photo illisible ne bloque pas le lot
            print(f"{f.name}: ERREUR {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
