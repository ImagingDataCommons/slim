#!/usr/bin/env bash
#
# Stop the verification instance this skill started and remove its scratch
# state. Evidence under /tmp/slim-verify/evidence is never touched.
#
# Usage: cleanup.sh            (SLIM_VERIFY_PORT selects the instance, default 3100)
set -uo pipefail

PORT="${SLIM_VERIFY_PORT:-3100}"
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
RUN_DIR="/tmp/slim-verify/run-$PORT"

if [ -f "$RUN_DIR/pgid" ]; then
  PGID="$(cat "$RUN_DIR/pgid")"
  if kill -0 "-$PGID" 2>/dev/null; then
    kill -TERM "-$PGID" 2>/dev/null
    for _ in $(seq 1 20); do
      kill -0 "-$PGID" 2>/dev/null || break
      sleep 0.5
    done
    if kill -0 "-$PGID" 2>/dev/null; then
      kill -KILL "-$PGID" 2>/dev/null
    fi
    echo "Stopped process group $PGID."
  else
    echo "Process group $PGID was already gone."
  fi
else
  echo "No instance recorded for port $PORT."
fi

rm -rf "$RUN_DIR"

# Other verification instances share public/config/verify.js, so leave it while any remain.
if ! compgen -G "/tmp/slim-verify/run-*" >/dev/null; then
  rm -f "$ROOT/public/config/verify.js"
  echo "Removed public/config/verify.js."
fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Warning: port $PORT is still in use by:"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
fi

echo "Evidence kept in /tmp/slim-verify/evidence"
