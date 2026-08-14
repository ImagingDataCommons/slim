#!/bin/bash
# Script to set git SHA environment variables for build

# Resolve paths relative to this script so it works from any CWD
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SLIM_ROOT="$(dirname "$SCRIPT_DIR")"
DMV_DIR="$(dirname "$SLIM_ROOT")/dicom-microscopy-viewer"

# Get current repository git SHA (do not clobber a value already set in CI).
if [ -z "${REACT_APP_GIT_SHA:-}" ]; then
  if [ -d .git ] || git rev-parse --git-dir > /dev/null 2>&1; then
    export REACT_APP_GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo '')
  else
    export REACT_APP_GIT_SHA=''
  fi
fi

# Get dicom-microscopy-viewer git SHA (sibling checkout, or leave CI-provided value).
if [ -z "${REACT_APP_DMV_GIT_SHA:-}" ]; then
  if [ -d "$DMV_DIR/.git" ] || (cd "$DMV_DIR" 2>/dev/null && git rev-parse --git-dir > /dev/null 2>&1); then
    export REACT_APP_DMV_GIT_SHA=$(cd "$DMV_DIR" && git rev-parse HEAD 2>/dev/null || echo '')
  else
    export REACT_APP_DMV_GIT_SHA=''
  fi
fi

# Default config name when .env is absent (fresh clone).
export REACT_APP_CONFIG="${REACT_APP_CONFIG:-local}"

# Expose SLIM_* env vars to public/config/*.js via window.slim.env
node "$SCRIPT_DIR/inject-slim-env.mjs" || exit $?

# Execute the command passed as arguments
exec "$@"

