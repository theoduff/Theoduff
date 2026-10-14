# Pub « POTION » — boisson énergisante

`pub_potion.mp4` : spot vertical 720×1280, 13 s, son stéréo 48 kHz (-14 LUFS).

Tout est généré par code à partir de la vidéo source :
- `segment.py` : détourage de la personne (MediaPipe) pour l'aura et les étincelles
- `render_video.py` : rampes de vitesse, ralentis interpolés, zooms, étalonnage, effet « potion magique », flashs, titrages
- `render_audio.py` : musique (125 BPM) et sound design synthétisés
- `timeline.py` : repères communs image/son

Régénérer : `./build.sh IMG_1974.mov pub_potion.mp4`
