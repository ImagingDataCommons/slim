#!/bin/bash
# Script to set git SHA environment variables for build

# Resolve paths relative to this script so it works from any CWD
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SLIM_ROOT="$(dirname "$SCRIPT_DIR")"
DMV_DIR="$(dirname "$SLIM_ROOT")/dicom-microscopy-viewer"

# Get current repository git SHA
if [ -d .git ] || git rev-parse --git-dir > /dev/null 2>&1; then
  export REACT_APP_GIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo '')
else
  export REACT_APP_GIT_SHA=''
fi

# Get dicom-microscopy-viewer git SHA (when present as sibling of slim)
if [ -d "$DMV_DIR/.git" ] || (cd "$DMV_DIR" 2>/dev/null && git rev-parse --git-dir > /dev/null 2>&1); then
  export REACT_APP_DMV_GIT_SHA=$(cd "$DMV_DIR" && git rev-parse HEAD 2>/dev/null || echo '')
else
  export REACT_APP_DMV_GIT_SHA=''
fi

# Execute the command passed as arguments
exec "$@"

