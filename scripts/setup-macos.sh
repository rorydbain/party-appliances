#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL="all"
PRINTER="false"

for argument in "$@"; do
  case "$argument" in
    --loop-only) INSTALL="loop" ;;
    --booth-only) INSTALL="booth" ;;
    --with-printer) PRINTER="true" ;;
    *) echo "Unknown option: $argument" >&2; exit 2 ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Party Appliances currently supports macOS only." >&2
  exit 1
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Install Node.js 20 or later, then run this setup again." >&2
  exit 1
fi

if [[ "$INSTALL" != "loop" ]] && ! command -v gphoto2 >/dev/null; then
  if command -v brew >/dev/null; then
    echo "Installing the Canon camera helper with Homebrew…"
    brew install gphoto2
  else
    echo "Photobooth needs gphoto2. Install Homebrew and run: brew install gphoto2" >&2
    exit 1
  fi
fi

cd "$ROOT"
echo "Installing exact JavaScript dependencies…"
npm ci

if [[ "$PRINTER" == "true" ]]; then
  PRINTER_ENV="$HOME/Library/Application Support/Frame/printer-venv"
  echo "Preparing the optional Epson printer helper…"
  python3 -m venv "$PRINTER_ENV"
  "$PRINTER_ENV/bin/pip" install --requirement "$ROOT/requirements-printer.txt"
fi

case "$INSTALL" in
  loop) npm run package:loop ;;
  booth) npm run package:booth ;;
  all) npm run package ;;
esac

echo "Finished. Open Loop or Photobooth from Applications."
