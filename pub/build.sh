#!/usr/bin/env bash
# Génère la pub complète à partir de la vidéo source.
# Usage : ./build.sh SOURCE.mov [SORTIE.mp4]
# Dépendances : ffmpeg, python3 + numpy scipy opencv-python-headless pillow mediapipe
set -euo pipefail
SRC="$1"
OUT="${2:-pub_potion.mp4}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"

MODEL="$WORK/selfie_multiclass.tflite"
curl -sSfL -o "$MODEL" \
  https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite

python3 "$HERE/segment.py" "$SRC" "$MODEL" "$WORK/masks.npy"
python3 "$HERE/render_video.py" "$SRC" "$WORK/masks.npy" "$WORK/video.mp4"
python3 "$HERE/render_audio.py" "$WORK/audio.wav"

ffmpeg -v error -y -i "$WORK/video.mp4" -i "$WORK/audio.wav" \
  -af "loudnorm=I=-14:TP=-1:LRA=9" -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest \
  -movflags +faststart "$OUT"
echo "-> $OUT"
