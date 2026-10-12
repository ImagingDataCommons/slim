#!/usr/bin/env bash
#
# Install the Playwright harness used by drive.mjs, outside the repo so Slim's
# lockfile and node_modules stay untouched. Idempotent; safe to rerun.
#
# Usage: setup-harness.sh
#   SLIM_VERIFY_HARNESS_DIR   install location (default ~/.cache/slim-verify/harness)
#   SLIM_VERIFY_BROWSERS_PATH Playwright browser cache (default: Playwright's per-user cache)
set -euo pipefail

HARNESS_DIR="${SLIM_VERIFY_HARNESS_DIR:-$HOME/.cache/slim-verify/harness}"
# 1.62.1 drives chromium-headless-shell build 1234; bump both together.
PLAYWRIGHT_VERSION="1.62.1"

# Agent sandboxes point PLAYWRIGHT_BROWSERS_PATH at throwaway temp dirs; pin the
# stable per-user cache so drive.mjs finds the same browser from any shell.
if [ "$(uname)" = "Darwin" ]; then
  DEFAULT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright"
else
  DEFAULT_BROWSERS_PATH="$HOME/.cache/ms-playwright"
fi
export PLAYWRIGHT_BROWSERS_PATH="${SLIM_VERIFY_BROWSERS_PATH:-$DEFAULT_BROWSERS_PATH}"

mkdir -p "$HARNESS_DIR"
cd "$HARNESS_DIR"

if [ ! -f package.json ]; then
  echo '{ "name": "slim-verify-harness", "private": true }' > package.json
fi

INSTALLED="$(node -e "try{console.log(require('./node_modules/playwright/package.json').version)}catch{}")"
if [ "$INSTALLED" != "$PLAYWRIGHT_VERSION" ]; then
  npm install --ignore-scripts --no-audit --no-fund --silent "playwright@$PLAYWRIGHT_VERSION"
fi

./node_modules/.bin/playwright install chromium-headless-shell
echo "Harness ready in $HARNESS_DIR (playwright $PLAYWRIGHT_VERSION, browsers in $PLAYWRIGHT_BROWSERS_PATH)"
