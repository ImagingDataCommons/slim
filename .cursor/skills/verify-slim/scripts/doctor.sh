#!/usr/bin/env bash
#
# Read-only health check for a verification instance.
#
# Usage: doctor.sh            (SLIM_VERIFY_PORT selects the instance, default 3100)
# Exit 0 when the instance is worth driving, 1 otherwise.
set -uo pipefail

PORT="${SLIM_VERIFY_PORT:-3100}"
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
RUN_DIR="/tmp/slim-verify/run-$PORT"
LOG="$RUN_DIR/dev-server.log"
failed=0

ok() { echo "ok    $*"; }
bad() { echo "FAIL  $*"; failed=1; }

if [ ! -f "$RUN_DIR/pgid" ]; then
  bad "no instance recorded in $RUN_DIR (run launch.sh)"
  exit 1
fi
PGID="$(cat "$RUN_DIR/pgid")"
DICOMWEB_URL="$(cat "$RUN_DIR/dicomweb-url")"

if kill -0 "-$PGID" 2>/dev/null; then
  ok "process group $PGID is alive"
else
  bad "process group $PGID is gone (see $LOG)"
fi

LISTENER_PID="$(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1)"
if [ -z "$LISTENER_PID" ]; then
  bad "nothing listens on port $PORT"
elif [ "$(ps -o pgid= -p "$LISTENER_PID" | tr -d ' ')" = "$PGID" ]; then
  ok "port $PORT is owned by our process group (pid $LISTENER_PID)"
else
  bad "port $PORT is owned by pid $LISTENER_PID, which this skill did not start"
fi

if grep -qiE "error when starting|failed to bind|EADDRINUSE" "$LOG"; then
  bad "Vite log shows a startup failure (see $LOG)"
elif grep -qE "Local: +http://|ready in [0-9]" "$LOG"; then
  ok "Vite reported ready"
else
  bad "Vite has not reported ready yet (see $LOG)"
fi

if curl -fsS "http://localhost:$PORT/" 2>/dev/null | grep -qE "config/verify\.js|/src/main"; then
  ok "index.html loads (Vite app shell)"
else
  bad "index.html did not load as expected (wrong REACT_APP_CONFIG?)"
fi

if curl -fsS "http://localhost:$PORT/config/verify.js" 2>/dev/null | grep -q "$DICOMWEB_URL"; then
  ok "config/verify.js points at $DICOMWEB_URL"
else
  bad "config/verify.js missing or points elsewhere"
fi

ACAO="$(curl -sS -o /dev/null -D - -H "Origin: http://localhost:$PORT" \
  -H 'Accept: application/dicom+json' "$DICOMWEB_URL/studies?limit=1" 2>/dev/null \
  | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')"
if [ "$ACAO" = "http://localhost:$PORT" ] || [ "$ACAO" = "*" ]; then
  ok "DICOMweb server answers QIDO with CORS for http://localhost:$PORT"
else
  bad "DICOMweb server did not allow origin http://localhost:$PORT (got '${ACAO:-nothing}')"
fi

echo "info  slim HEAD $(git -C "$ROOT" rev-parse --short HEAD) on $(git -C "$ROOT" branch --show-current)"
DMV_REAL="$(cd "$ROOT" && node -e "console.log(require('fs').realpathSync('node_modules/dicom-microscopy-viewer'))")"
DMV_VERSION="$(node -e "console.log(require('$DMV_REAL/package.json').version)")"
if [[ "$DMV_REAL" == *"/.pnpm/"* ]]; then
  echo "info  dicom-microscopy-viewer $DMV_VERSION from npm"
else
  echo "info  dicom-microscopy-viewer $DMV_VERSION linked from $DMV_REAL"
fi

exit $failed
