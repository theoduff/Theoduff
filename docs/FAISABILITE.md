# Étude de faisabilité technique

*Faite le 13 octobre 2026. Sources : définitions TypeScript officielles `@adobe/premierepro` 26.5.0 (et 27.0 bêta), l'ESLint officiel `@adobe/eslint-plugin-premierepro` 26.5.0, et le dépôt d'exemples Adobe `AdobeDocs/uxp-premiere-pro-samples` (panneau `premiere-api`). Le site developer.adobe.com n'était pas accessible depuis l'environnement de développement : les définitions publiées par Adobe sur npm ont servi de référence.*

## Choix : UXP plutôt que CEP

| | **UXP (retenu)** | CEP + ExtendScript |
|---|---|---|
| Statut chez Adobe | Plateforme d'avenir, stable dans Premiere depuis 25.6 | Ancienne génération, en fin de vie annoncée |
| Paquet | `.ccx`, installable par Creative Cloud | `.zxp`, signature obligatoire avec ZXPSignCmd |
| Moteur | JavaScript moderne, API asynchrones, transactions annulables | ExtendScript (ES3) + panneau Chromium |
| Images clés, effets | ✅ (voir ci-dessous) | ✅ (y compris les poignées Bézier via QE DOM non documenté) |
| Compatibilité | Premiere ≥ 25.6 | Versions anciennes |

**Conclusion :** UXP couvre toutes les fonctionnalités de la V1. Il n'a qu'une seule limite, celle des courbes Bézier, contournée de façon exacte (voir plus bas). CEP ne se justifierait que pour une version de Premiere antérieure à 25.6. Dans ce cas, le moteur (`src/engine`, `src/animations`) est réutilisable tel quel et seul `src/premiere/adapter.ts` serait à réécrire en ExtendScript.

## API utilisées et vérifiées dans les définitions officielles

| Besoin | API UXP |
|---|---|
| Projet, séquence active | `Project.getActiveProject()`, `project.getActiveSequence()` |
| Clips sélectionnés | `sequence.getSelection()` → `getTrackItems()`, filtre `VideoClipTrackItem` |
| Cadence, résolution | `sequence.getTimebase()` (ticks par image), `sequence.getFrameSize()` |
| Temps d'un clip | `getStartTime()`, `getEndTime()`, `getInPoint()`, `getTrackIndex()` |
| Effets d'un clip | `getComponentChain()` → `getComponentAtIndex()`, `getMatchName()` (`AE.ADBE Motion`, `AE.ADBE Opacity`) |
| Paramètres | `component.getParam(i)`, `displayName`, `getStartValue()`, `getValueAtTime()` |
| Activer l'animation | `param.createSetTimeVaryingAction(true)` |
| Images clés | `param.createKeyframe(valeur)`, `keyframe.position = TickTime`, `createAddKeyframeAction()` |
| Nettoyage | `createRemoveKeyframeRangeAction(début, fin)` |
| Interpolation | `createSetInterpolationAtKeyframeAction(t, InterpolationMode.LINEAR)` |
| Ajout du Flou gaussien | `VideoFilterFactory.createComponent("AE.ADBE Gaussian Blur 2")`, `chain.createAppendComponentAction()` |
| Annulation (⌘Z) | `project.lockedAccess()` + `project.executeTransaction(…, "libellé")` |
| Suivi de la sélection | `EventManager.addGlobalEventListener(SequenceEvent.SELECTION_CHANGED)` + vérification périodique |

## Limites de l'API et solutions retenues

1. **Pas d'accès aux poignées Bézier des images clés.** L'API ne fixe que le *mode* d'interpolation. **Solution :** chaque courbe (easing, dépassement, ressort élastique) est « cuite » : on l'échantillonne à chaque image de la séquence, puis l'algorithme de Ramer–Douglas–Peucker supprime les images clés redondantes. L'écart maximal est de 0,15 % d'échelle, 0,2 px ou 0,2 % d'opacité. L'interpolation est linéaire. Résultat : un mouvement **identique image par image** à la courbe voulue, y compris pour des rebonds qu'une simple Bézier ne sait pas représenter.

2. **Pas d'animateurs de texte par mot ou par lettre dans un calque unique.** L'API ne permet ni de lire en version stable ni de modifier le *texte source* d'un graphique. La 27.0 bêta ajoute une lecture seule (`MogrtText.getText()`). **Solution V1 :** Word by Word anime plusieurs calques texte en cascade (un mot par calque). **Piste pour la suite :** des modèles `.mogrt` conçus dans After Effects avec de vrais animateurs de texte, insérés via `SequenceEditor.insertMogrtFromPath()` (API présente). Voir ARCHITECTURE.md.

3. **Le composant Mouvement zoome autour de son point d'ancrage**, par défaut le centre de l'image. Un sous-titre en bas de l'image « glisserait » donc vers le centre pendant un zoom. **Solution :** le moteur compense par la position, de façon exacte image clé par image clé, autour d'un pivot. Ce pivot est détecté automatiquement sur le calque texte, ou choisi dans les réglages.

4. **Unités de la position (normalisée 0–1 ou pixels) et référence temporelle des images clés** : ces points ne sont pas documentés de façon univoque. **Solution :** détection automatique des unités ; la référence temporelle est un réglage avancé (point d'entrée par défaut, convention d'ExtendScript). Ce sont des points de validation prioritaires sur Mac (checklist C1 à C3).

## Ce qui reste à confirmer dans Premiere

Voir la section C de [CHECKLIST-PREMIERE.md](CHECKLIST-PREMIERE.md). Les hypothèses sont isolées dans `src/premiere/adapter.ts` et dans les réglages : les ajuster ne demande aucune refonte.
