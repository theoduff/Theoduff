# Installer et tester MotionCraft Pro sur Mac

## 0. Prérequis

- **Premiere Pro 25.6 ou ultérieur.** Pour vérifier : *Premiere Pro › À propos de Premiere Pro*. Si la version est plus ancienne, mettez à jour depuis l'application Creative Cloud.
- L'application **Creative Cloud** installée (elle fournit l'installeur de plugins d'Adobe).
- Le dépôt sur votre Mac : sur GitHub, branche `claude/gallant-thompson-ck6o6o`, bouton *Code › Download ZIP*, ou bien :
  ```bash
  git clone -b claude/gallant-thompson-ck6o6o https://github.com/theoduff/Theoduff.git MotionCraftPro
  cd MotionCraftPro
  ```

## 1. Installation par le paquet `.ccx` (méthode « utilisateur »)

Le paquet est déjà construit : `release/MotionCraftPro-2.1.0.ccx`.

**Option A : double-clic**

1. Quittez Premiere Pro.
2. Double-cliquez sur `release/MotionCraftPro-2.1.0.ccx`. Creative Cloud s'ouvre et propose l'installation. Le plugin ne vient pas de la Marketplace Adobe, donc un avertissement s'affiche : confirmez.
3. Relancez Premiere Pro.

**Option B : Terminal (installeur officiel Adobe, UPIA)**

```bash
./scripts/install-mac.sh
```

Le script vérifie la somme de contrôle du paquet, puis l'installe avec *UnifiedPluginInstallerAgent*. C'est l'outil en ligne de commande fourni par Creative Cloud. Pour désinstaller : `./scripts/install-mac.sh --remove`.

**Ouvrir le panneau :** *Fenêtre › Extensions › MotionCraft Pro*. Selon la version, le menu peut s'appeler *Fenêtre › Plugins* ou *UXP Plugins*. Le panneau s'ancre comme n'importe quel panneau de Premiere : glissez-le à côté du panneau *Options d'effet*.

> **Signature.** Un `.ccx` distribué hors Marketplace n'est pas signé par Adobe. Creative Cloud l'installe quand même, avec un avertissement. Pour une diffusion commerciale, il faut soumettre le plugin sur le [Adobe Developer Distribution portal](https://developer.adobe.com/distribute/) : Adobe attribue alors l'identifiant définitif et signe le paquet. Aucune étape de signature n'est nécessaire pour vos tests.

**Si l'installation par `.ccx` échoue** (version de Creative Cloud, sécurité de l'organisation…), passez à la méthode 2, qui fonctionne toujours.

## 2. Chargement en mode développeur (UXP Developer Tool)

C'est la méthode recommandée pour tester et faire évoluer le plugin.

1. Installez **UXP Developer Tool** depuis Creative Cloud : *Toutes les applications*, puis rechercher « UXP Developer Tool ».
2. Dans Premiere Pro, activez le mode développeur : *Réglages (Préférences) › Plugins › Activer le mode développeur*, puis redémarrez Premiere. L'intitulé exact peut varier selon la version.
3. Dans UXP Developer Tool : *Add Plugin*, puis sélectionnez `dist/plugin/manifest.json`.
   - Pas de dossier `dist/` ? Construisez-le : installez Node.js 20+ ([nodejs.org](https://nodejs.org)), puis lancez `npm ci && npm run build`.
   - Sans Node, vous pouvez aussi décompresser le `.ccx` (c'est un ZIP) et sélectionner le `manifest.json` obtenu.
4. Cliquez sur *Load* : le panneau apparaît dans Premiere.
5. *Debug* ouvre les outils de développement : console, inspection du DOM. C'est très utile pour me remonter une erreur.
6. Pour développer : `npm run watch` dans le dépôt, puis *Watch* dans UXP Developer Tool. Le plugin se recharge à chaque modification.

## 3. Premier test (5 minutes)

1. Créez une séquence 1920×1080, puis ajoutez un texte avec l'outil Texte (T) au centre, d'une durée d'environ 4 s.
2. Sélectionnez ce clip dans la timeline. La pastille de MotionCraft doit indiquer « 1 texte sélectionné ».
3. Choisissez **Smooth Pop** et cliquez sur **Appliquer**.
4. Lisez la timeline : le texte doit « poper ». Ouvrez *Options d'effet › Trajectoire (Mouvement)* : vous devez voir des images clés sur *Échelle*, et sur *Opacité* dans *Opacité*.
5. ⌘Z doit annuler l'opération (en 3 étapes).

Faites ensuite les autres animations avec la checklist complète : **[CHECKLIST-PREMIERE.md](CHECKLIST-PREMIERE.md)**.

## 4. En cas de problème

- **Le panneau n'apparaît pas** : vérifiez la version de Premiere (25.6 minimum), puis essayez la méthode 2 (UXP Developer Tool), qui affiche les erreurs de chargement.
- **La pastille indique « Premiere indisponible »** : le module `premierepro` n'est pas accessible. Version trop ancienne, ou panneau ouvert hors de Premiere.
- **L'animation apparaît décalée dans le temps** (sur un clip dont le début a été rogné) : *Réglages › Référence temporelle*, essayez « Début du clip ». Merci de me signaler quel réglage fonctionne.
- **Le zoom ne se fait pas autour du texte** : *Réglages › Pivot des zooms*. Essayez « Centre de l'image » pour un titre centré, ou « Tiers inférieur » pour un sous-titre.
- **Pour tout autre problème** : *Réglages › Diagnostic › Inspecter la sélection › Copier*, puis envoyez-moi le rapport. Il décrit exactement ce que Premiere expose sur vos clips. C'est l'information la plus utile pour corriger rapidement.
