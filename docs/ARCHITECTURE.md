# Architecture

```
 Définition d'animation        Moteur pur (testé sous Linux)               Premiere (UXP)
 ─────────────────────        ──────────────────────────────              ──────────────
 src/animations/*.ts   ──►    build(params, {index,count}) → Motion
                               (courbes relatives : scale ×, x/y px,
                                opacity ×, blur px, rotation °)
                                         │
                               placeMotion(mode, durée du clip)            prepareClip() : lit l'état
                               → Timeline (entrée / sortie / les deux)  ◄── « au repos » du clip
                                         │                                 (échelle, position, pivot…)
                               buildClipPlan() : cuisson image par image,
                               simplification RDP, pivot, résolution
                                         │
                                         ▼
                                    ClipPlan  ───────────────────────►     runStep() : transactions
                                                                           1. Flou gaussien
                                                                           2. activation de l'animation
                                                                           3. nettoyage + images clés
                                                                           4. interpolation linéaire
 src/ui/preview.ts  ◄── même Motion + même placeMotion ──► aperçu DOM (ce que l'on voit = ce qui est appliqué)
```

## Trois natures d'animation

| `kind` | Placement | Exemples | Contrainte sur les courbes |
|---|---|---|---|
| `entrance` | entrée, sortie (miroir) ou les deux | Smooth Pop, Zoom Blur | finissent au repos |
| `accent` | tête de lecture, début ou fin du clip | Zoom Punch, Camera Shake, Pulse | partent et finissent au repos (sauf `holdEnd`) |
| `span` | toute la durée du clip | Push-in lent, Ken Burns | libres ; `ctx.clipDuration` fournit la durée |

## Principes

- **Une seule source de vérité.** L'aperçu et Premiere utilisent les mêmes courbes, le même placement et le même découpage entrée/sortie.
- **Moteur pur.** `src/engine` et `src/animations` n'importent rien de Premiere : tout y est testé unitairement.
- **Valeurs relatives.** Une animation dit « l'échelle passe de 30 % à 100 % *de la taille actuelle* ». Le planificateur multiplie par l'état réel du clip, si bien qu'un texte réglé à 60 % revient à 60 %.
- **Indépendance de la résolution.** Les distances sont exprimées pour un petit côté de 1080 px et adaptées automatiquement (4K, 9:16).
- **Transactions groupées.** Une application sur 30 clips donne au maximum 4 entrées d'annulation. Si Premiere refuse le lot, le plugin rejoue clip par clip pour isoler le fautif sans bloquer les autres.
- **Règles Adobe vérifiées.** `npm run lint` applique `@adobe/eslint-plugin-premierepro` : actions créées uniquement sous verrou, aucun `await` dans une transaction.

## Ajouter une animation

1. Créez `src/animations/monAnimation.ts` :

```ts
import { clamp01, getEasing, lerp } from "../engine/easing";
import type { AnimationDefinition } from "../engine/types";
import { cascadeDelay, durationParam, easingParam, fadeCurve, fadeParam, num, staggerParam, str } from "./common";

export const zoomOut: AnimationDefinition = {
  id: "zoom-out",
  name: "Zoom Out",
  tagline: "Arrive de très près et recule.",
  description: "…",
  category: "pop",
  tags: ["zoom", "recul"],
  uses: ["scale", "opacity"],
  params: [durationParam(0.6), easingParam("expo"), fadeParam(40), staggerParam(0)],
  build(v, ctx) {
    const d = num(v, "duration", 0.6);
    const ease = getEasing(str(v, "easing", "expo"));
    return {
      delay: cascadeDelay(v, ctx),
      duration: d,
      tracks: {
        scale: (t) => lerp(2.5, 1, ease(clamp01(t / d))), // doit finir à 1 (repos)
        opacity: fadeCurve(d, num(v, "fade", 40)),
      },
    };
  },
};
```

2. Ajoutez-la au tableau `ANIMATIONS` de `src/animations/registry.ts`.

C'est tout. La carte, l'aperçu, la recherche, la catégorie, le panneau de réglages, les presets et l'application dans Premiere sont générés automatiquement. Le test « chaque courbe finit exactement au repos » couvre la nouvelle animation sans rien ajouter.

## Feuille de route vers 100 animations

| Famille | Faisable avec le moteur actuel | Remarques |
|---|---|---|
| Zooms, pops, rebonds, glissements, rotations, flous, fondus | ✅ immédiatement | Il suffit de combiner `scale`, `x`, `y`, `rotation`, `opacity`, `blur` |
| Effets « sport » (impact, secousse, flash) | ✅ | Secousse = bruit cuit sur x/y ; flash = effet natif supplémentaire (même mécanisme que le Flou gaussien) |
| Sous-titres, Reels (cascade de calques) | ✅ | Cascade intégrée (`stagger`), ordre de lecture, application sur 30 calques et plus |
| Masques et révélations (wipe) | ✅ avec l'effet natif *Recadrage* | Ajouter le type de propriété `crop` dans le moteur, sur le modèle de `blur` |
| **Par lettre / par mot dans un seul calque** | ⚠️ via `.mogrt` | Modèles After Effects avec animateurs de texte, insérés par `SequenceEditor.insertMogrtFromPath()`, paramètres exposés via le composant `AE.ADBE Capsule`. Il faudra des fichiers `.mogrt` conçus dans After Effects |

Fonctions déjà prévues dans l'architecture : application à N textes avec cascade, presets utilisateur (enregistrement, import et export JSON), favoris, recherche plein texte tolérante aux accents, catégories dont l'affichage dépend du contenu.
