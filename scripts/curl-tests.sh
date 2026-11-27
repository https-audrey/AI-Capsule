#!/usr/bin/env bash
# Runs the public checks from the brief against a deployed URL.
# Usage: ./scripts/curl-tests.sh https://YOUR-APP.onrender.com
# (Windows: use Git Bash, or run the three curl commands from README.md by hand with curl.exe)
set -u
APP="${1:?Usage: $0 https://YOUR-APP}"
APP="${APP%/}"
echo "=== Health check ===";                 echo "curl -i $APP/api/health";                                         curl -i "$APP/api/health"; echo; echo
echo "=== Test 1 - no authentication ===";   echo "curl -i $APP/api/capsules";                                       curl -i "$APP/api/capsules"; echo; echo
echo "=== Test 2 - fake / invalid JWT ===";  echo "curl -i -H \"Cookie: token=fake-token-123\" $APP/api/capsules";   curl -i -H "Cookie: token=fake-token-123" "$APP/api/capsules"; echo
