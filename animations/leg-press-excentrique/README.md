# Leg press : poussée à 2 pieds, descente excentrique sur 1 genou

Overlay 2D animé, fond transparent (couche alpha), 1080×1080, 30 i/s, 10 s.

| Temps | Phase | Muscles en lueur bleue |
|---|---|---|
| 0,6 → 2,2 s | ① Poussée à deux pieds | Quadriceps (fort), fessiers, ischios (léger) |
| 2,2 → 2,9 s | Retrait du 2ᵉ pied | maintien |
| 2,9 → 6,6 s | ② Descente excentrique sur un genou, flexion max | Quadriceps de la jambe qui travaille (max, vibration de tension), fessiers qui montent avec la profondeur |
| 6,6 → 7,2 s | Le 2ᵉ pied revient | |
| 7,2 → 8,8 s | ③ Repoussée à deux pieds | Quadriceps, fessiers |

## Fichiers
- `export/leg-press-excentrique_alpha_QTAnimation.mov` : QuickTime Animation RGBA, sans perte. À glisser directement dans Premiere Pro.
- `export/apercu_sur_fond_gris.mp4` : aperçu seulement (pas d'alpha).

## Re-générer
```bash
node render.js            # images PNG transparentes dans ./frames
ffmpeg -framerate 30 -i frames/f_%04d.png -c:v qtrle -pix_fmt argb out.mov
# ou ProRes 4444 (plus lourd, ~240 Mo) :
ffmpeg -framerate 30 -i frames/f_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0 out_prores.mov
```
Les temps des phases sont dans l'objet `T` de `anim.html`.
