#!/usr/bin/env bash
#
# Regenerate the Linux screenshot baselines that CI compares against, using the
# pinned Playwright container so the browser environment matches CI exactly.
#
# The app itself is served from the host (static output is OS-independent); only
# the browser runs inside the container. Start the server first, e.g.:
#
#   pnpm run build:e2e && pnpm run serve:e2e      # in another terminal
#   # or, for iterating on specs:
#   REACT_APP_CONFIG=e2e pnpm start
#
# then run:
#
#   pnpm run test:e2e:update:docker
#
set -euo pipefail

# Keep in sync with the @playwright/test version in package.json.
PLAYWRIGHT_VERSION="$(node -p "require('@playwright/test/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-jammy"

# The container reaches the host dev/preview server via host.docker.internal.
BASE_URL="${E2E_BASE_URL:-http://host.docker.internal:3977}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Using ${IMAGE}"
echo "Target app: ${BASE_URL} (must already be served from the host)"

docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e CI=1 \
  -e "E2E_BASE_URL=${BASE_URL}" \
  -v "${REPO_ROOT}:/work" \
  -w /work \
  "${IMAGE}" \
  npx playwright test --update-snapshots

echo "Baselines updated under e2e/__screenshots__/. Review and commit them."
