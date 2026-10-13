# Journal des versions

## 1.0.0 — première version

- Plugin UXP pour Premiere Pro 25.6+ (panneau « MotionCraft Pro »).
- 5 animations : Smooth Pop, Blur Reveal, Slide Up, Word by Word, Elastic Bounce, chacune en entrée, sortie, ou entrée + sortie.
- Moteur d'images clés « cuites » image par image (easing exact, dépassement, ressort), simplifiées sans perte visible.
- Compensation du pivot pour des zooms centrés sur le texte, adaptation automatique à la résolution.
- Application groupée sur N textes avec cascade, annulation groupée, isolation des clips en erreur.
- Interface : bibliothèque avec aperçus animés, recherche, catégories, favoris, panneau de réglages, presets utilisateur (import/export), réglages avancés, diagnostic.
- Outillage : build esbuild, ESLint avec les règles officielles Adobe, 44 tests Vitest, test d'interface Playwright, paquet `.ccx`, script d'installation macOS.
