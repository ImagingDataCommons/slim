#!/usr/bin/env bash
#
# Start an isolated Slim dev server for verification.
#
# Usage: launch.sh [--fresh-cache]
#   SLIM_VERIFY_PORT   port to serve on (default 3100)
#   SLIM_VERIFY_DICOMWEB_URL  DICOMweb server (default: IDC public read-only proxy)
#   SLIM_VERIFY_WRITE  "true" to mark the server writable (only for a local archive)
#
# Writes public/config/verify.js (gitignored) and keeps pid/log under
# /tmp/slim-verify/run-<port>/. Blocks until webpack has compiled and the app
# serves the verify config, or fails with the tail of the dev server log.
set -euo pipefail

PORT="${SLIM_VERIFY_PORT:-3100}"
DICOMWEB_URL="${SLIM_VERIFY_DICOMWEB_URL:-https://proxy.imaging.datacommons.cancer.gov/current/viewer-only-no-downloads-see-tinyurl-dot-com-slash-3j3d9jyp/dicomWeb}"
WRITE="${SLIM_VERIFY_WRITE:-false}"
READY_TIMEOUT_S="${SLIM_VERIFY_READY_TIMEOUT_S:-300}"

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
RUN_DIR="/tmp/slim-verify/run-$PORT"
LOG="$RUN_DIR/dev-server.log"

if [ -f "$RUN_DIR/pgid" ] && kill -0 "-$(cat "$RUN_DIR/pgid")" 2>/dev/null; then
  echo "A verification instance already runs on port $PORT (pgid $(cat "$RUN_DIR/pgid"))."
  echo "Run doctor.sh to inspect it or cleanup.sh to stop it."
  exit 1
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is held by a process this skill did not start:"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
  echo "Pick another port with SLIM_VERIFY_PORT=<port>."
  exit 1
fi

rm -rf "$RUN_DIR"
mkdir -p "$RUN_DIR"

cat > "$ROOT/public/config/verify.js" <<EOF
/* Verification scaffolding written by .cursor/skills/verify-slim/scripts/launch.sh. Removed by cleanup.sh. */
window.config = {
  path: '/',
  servers: [
    {
      id: 'verify',
      url: '$DICOMWEB_URL',
      write: $WRITE,
      retry: {
        retries: 8,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 30000,
        randomize: true,
        retryableStatusCodes: [429, 500, 502, 503, 504]
      }
    }
  ],
  disableWorklist: false,
  disableAnnotationTools: false,
  enableServerSelection: true,
  mode: 'light',
  preload: true,
  annotations: [
    {
      finding: { value: '85756007', schemeDesignator: 'SCT', meaning: 'Tissue' },
      findingCategory: { value: '91723000', schemeDesignator: 'SCT', meaning: 'Anatomical structure' },
      geometryTypes: ['polygon', 'freehandpolygon'],
      style: { stroke: { color: [255, 255, 0, 1], width: 2 }, fill: { color: [255, 255, 255, 0.2] } }
    },
    {
      finding: { value: '108369006', schemeDesignator: 'SCT', meaning: 'Tumor' },
      findingCategory: { value: '49755003', schemeDesignator: 'SCT', meaning: 'Morphologically abnormal structure' },
      geometryTypes: ['polygon', 'freehandpolygon'],
      style: { stroke: { color: [255, 0, 255, 1], width: 2 }, fill: { color: [255, 255, 255, 0.2] } }
    }
  ],
  logger: { level: 'WARN', enableInProduction: false, enableInDevelopment: true }
}
EOF
echo "$PORT" > "$RUN_DIR/port"
echo "$DICOMWEB_URL" > "$RUN_DIR/dicomweb-url"

FRESH_CACHE=false
if [ "${1:-}" = "--fresh-cache" ]; then
  FRESH_CACHE=true
fi

cd "$ROOT"
if [ "$FRESH_CACHE" = true ]; then
  rm -rf ./node_modules/.cache/default-development
fi

# Job control gives the background job its own process group, so cleanup can
# stop pnpm, craco and webpack together without matching on process names.
set -m
BROWSER=none PORT="$PORT" REACT_APP_CONFIG=verify \
  nohup pnpm exec ./scripts/set-git-env.sh craco start >"$LOG" 2>&1 &
PGID=$!
set +m
echo "$PGID" > "$RUN_DIR/pgid"
echo "Started dev server (pgid $PGID) on port $PORT. Log: $LOG"

deadline=$((SECONDS + READY_TIMEOUT_S))
while [ $SECONDS -lt $deadline ]; do
  if ! kill -0 "-$PGID" 2>/dev/null; then
    echo "Dev server exited before becoming ready. Last log lines:"
    tail -n 40 "$LOG"
    exit 1
  fi
  if grep -qE "Failed to compile|webpack [0-9.]+ compiled with [0-9]+ errors?" "$LOG"; then
    echo "Dev server failed to compile. Last log lines:"
    tail -n 60 "$LOG"
    exit 1
  fi
  if grep -qE "webpack [0-9.]+ compiled" "$LOG" \
    && curl -fsS "http://localhost:$PORT/config/verify.js" 2>/dev/null | grep -q "$DICOMWEB_URL"; then
    echo "Ready: http://localhost:$PORT/"
    exit 0
  fi
  sleep 2
done

echo "Timed out after ${READY_TIMEOUT_S}s waiting for the dev server. Last log lines:"
tail -n 40 "$LOG"
exit 1
