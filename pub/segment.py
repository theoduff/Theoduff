"""Masques de silhouette (MediaPipe selfie multiclass) pour chaque image de la vidéo source."""
import sys, numpy as np, cv2, mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
src, model, out = sys.argv[1:4]
opts = vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=model),
        running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True)
seg = vision.ImageSegmenter.create_from_options(opts)
cap = cv2.VideoCapture(src); masks=[]; i=0
while True:
    ok, f = cap.read()
    if not ok: break
    rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
    r = seg.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(i*1000/30))
    bg = r.confidence_masks[0].numpy_view()   # class 0 = background
    m = 1.0 - bg
    masks.append((cv2.resize(m,(360,640))*255).astype(np.uint8)); i+=1
np.save(out, np.stack(masks)); print(len(masks), "masques")
import os; os._exit(0)  # évite un plantage de mediapipe à la fermeture
