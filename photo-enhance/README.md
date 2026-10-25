# photo-enhance : photos de nuit / sous la pluie

Ce script réduit le bruit et corrige les couleurs **sans IA générative**. Les visages sont détectés et protégés : on n'y applique ni débruitage, ni accentuation, ni contraste local. Leurs pixels d'origine sont conservés.

```bash
pip install opencv-contrib-python-headless numpy pillow pillow-heif rawpy
python3 enhance.py /chemin/photos -o /chemin/sortie --preview
```

Options utiles :
- `--denoise 1.5` : débruitage plus fort (par défaut 1 = automatique, selon le bruit mesuré)
- `--wb 0.4` : correction des blancs plus légère (de 0 à 1)
- `--faces-original` : les visages ne reçoivent même pas la correction de couleur
- `--preview` : crée des aperçus avant/après dans `sortie/apercus/`, avec les visages protégés encadrés

Le modèle `face_detection_yunet_2023mar.onnx` (OpenCV Zoo, licence MIT) sert uniquement à **détecter** les visages.
