#!/usr/bin/env bash
# Installe MotionCraft Pro dans Premiere Pro sur macOS.
#
#   ./scripts/install-mac.sh            installe release/MotionCraftPro-<version>.ccx
#   ./scripts/install-mac.sh --build    reconstruit le plugin (Node 20+ requis) puis installe
#   ./scripts/install-mac.sh --remove   désinstalle
#
# Utilise l'installeur officiel d'Adobe (Unified Plugin Installer Agent, fourni
# avec l'application Creative Cloud). Premiere Pro doit être fermé puis relancé.
set -euo pipefail

cd "$(dirname "$0")/.."
UPIA="/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent"
PLUGIN_NAME="MotionCraft Pro"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Ce script est destiné à macOS." >&2
  exit 1
fi

if [[ "${1:-}" == "--remove" ]]; then
  "$UPIA" --remove "$PLUGIN_NAME"
  echo "✔ $PLUGIN_NAME désinstallé. Relancez Premiere Pro."
  exit 0
fi

if [[ "${1:-}" == "--build" ]]; then
  command -v npm >/dev/null || { echo "Node.js 20+ est requis pour --build (https://nodejs.org)." >&2; exit 1; }
  npm ci
  npm run package
fi

VERSION="$(sed -n 's/.*"version": *"\([0-9.]*\)".*/\1/p' package.json | head -1)"
CCX="release/MotionCraftPro-${VERSION}.ccx"
[[ -f "$CCX" ]] || { echo "Paquet introuvable : $CCX (lancez ./scripts/install-mac.sh --build)" >&2; exit 1; }

if [[ -f "release/MotionCraftPro-${VERSION}.ccx.sha256" ]]; then
  (cd release && shasum -a 256 -c "MotionCraftPro-${VERSION}.ccx.sha256") || { echo "Somme de contrôle invalide : paquet corrompu." >&2; exit 1; }
fi

if pgrep -xq "Adobe Premiere Pro" 2>/dev/null || pgrep -fq "Adobe Premiere Pro.app" 2>/dev/null; then
  echo "⚠ Premiere Pro est ouvert : quittez-le avant l'installation, puis relancez-le."
fi

if [[ -x "$UPIA" ]]; then
  echo "→ Installation via l'installeur Adobe (UPIA)…"
  "$UPIA" --install "$(pwd)/$CCX"
  echo "✔ Installé. Ouvrez Premiere Pro › Fenêtre › Extensions (ou Plugins) › MotionCraft Pro."
else
  echo "Installeur Adobe introuvable : ouverture du paquet avec Creative Cloud…"
  open "$CCX"
  echo "Confirmez l'installation dans Creative Cloud, puis relancez Premiere Pro."
fi
