#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "================================================"
echo " FESTOS - Crear instaladores macOS"
echo "================================================"
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js no esta instalado. Instala Node.js LTS y vuelve a intentar."
  exit 1
fi
echo "[1/2] Instalando dependencias..."
npm install
echo "[2/2] Generando DMG para Apple Silicon e Intel..."
npm run desktop:build:mac
echo "Listo. Revisa la carpeta release."
open release
