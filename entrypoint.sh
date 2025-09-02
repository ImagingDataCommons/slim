#!/bin/sh
set -e

: "${SERVER_URL:?Missing SERVER_URL}"
: "${OIDC_AUTHORITY:?Missing OIDC_AUTHORITY}"
: "${OIDC_CLIENT_ID:?Missing OIDC_CLIENT_ID}"
: "${OIDC_LOGOUT:?Missing OIDC_LOGOUT}"

CONFIG_NAME="${REACT_APP_CONFIG:-midas-dev}"
mkdir -p /srv/slim/build/config

# Render runtime config from template
envsubst '${SERVER_URL} ${OIDC_AUTHORITY} ${OIDC_CLIENT_ID} ${OIDC_LOGOUT} ${UI_PATH}' \
  < /srv/slim/window.config.tmpl.js > /srv/slim/build/config/${CONFIG_NAME}.js

# Start static server
exec serve -s build -l 8080
