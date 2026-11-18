#!/usr/bin/env bash
# Run the local widget lab and open the generated HTML preview in a browser.
#
# Usage:
#   export FOOTBALL_DATA_TOKEN=...
#   ./tools/view-widget.sh              # live data + preview
#   ./tools/view-widget.sh --no-key     # fallback state
#   ./tools/view-widget.sh --api-error  # API failure state
#   ./tools/view-widget.sh --no-open    # generate the preview but don't open it

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREVIEW="$ROOT/.cache/widget-preview.html"

ARGS=()
NO_OPEN=0
for arg in "$@"; do
  if [ "$arg" = "--no-open" ]; then
    NO_OPEN=1
  else
    ARGS+=("$arg")
  fi
done

# The lab prints its checks; the preview always lands at $PREVIEW by default.
node "$ROOT/tools/widget-lab.js" "${ARGS[@]}"

if [ "$NO_OPEN" -eq 1 ]; then
  exit 0
fi

open_preview() {
  if command -v open >/dev/null 2>&1; then
    open "$PREVIEW" >/dev/null 2>&1
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$PREVIEW" >/dev/null 2>&1
  elif command -v gio >/dev/null 2>&1; then
    gio open "$PREVIEW" >/dev/null 2>&1
  elif command -v python3 >/dev/null 2>&1; then
    python3 -m webbrowser "file://$PREVIEW" >/dev/null 2>&1
  else
    return 1
  fi
}

if open_preview; then
  echo "Opened preview: $PREVIEW"
else
  echo "Could not launch a browser. Open this file manually: $PREVIEW"
fi
