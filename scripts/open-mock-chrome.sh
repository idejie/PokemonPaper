#!/usr/bin/env bash
set -euo pipefail
URL="${1:-https://pokemonpaper.com:8787}"
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args \
    --host-resolver-rules="MAP pokemonpaper.com 127.0.0.1" \
    --ignore-certificate-errors \
    --proxy-server=direct:// \
    --proxy-bypass-list=* \
    --user-data-dir="${TMPDIR:-/tmp}/pokemonpaper-mock-chrome" \
    "$URL"
else
  echo "Google Chrome not found."
  echo "Launch any Chromium with: --host-resolver-rules=\"MAP pokemonpaper.com 127.0.0.1\""
  echo "URL: $URL"
fi
