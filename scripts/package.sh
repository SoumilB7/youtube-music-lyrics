#!/bin/sh
# Builds the Chrome Web Store upload: dist/lyricly-<version>.zip with only
# the files the extension needs at runtime.
set -eu
cd "$(dirname "$0")/.."
version=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
node --test tests/ >/dev/null
mkdir -p dist
out="dist/lyricly-$version.zip"
rm -f "$out"
zip -qr "$out" manifest.json icons src -x '*.DS_Store'
echo "$out"
unzip -l "$out" | tail -n +4 | sed '$d' | sed '$d' | awk '{print "  " $4}'
