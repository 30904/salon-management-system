#!/usr/bin/env bash
# Ships the already-built frontend/dist/ to the droplet via rsync, then
# reloads nginx there. Run this from wherever you have the repo + SSH access
# (the GitHub Actions runner, or your own machine for a manual deploy) —
# NOT on the server itself. Build first: npm run build --prefix frontend
#
# Required env vars: DO_HOST, DO_SSH_USER, DO_DEPLOY_PATH
# Optional: DO_SSH_PORT (default 22), DO_SSH_KEY_PATH (private key file;
# omit to use ssh-agent/default key discovery)
set -euo pipefail

: "${DO_HOST:?Set DO_HOST}"
: "${DO_SSH_USER:?Set DO_SSH_USER}"
: "${DO_DEPLOY_PATH:?Set DO_DEPLOY_PATH}"
DO_SSH_PORT="${DO_SSH_PORT:-22}"

SSH_OPTS=(-p "$DO_SSH_PORT" -o StrictHostKeyChecking=yes)
if [ -n "${DO_SSH_KEY_PATH:-}" ]; then
  SSH_OPTS=(-i "$DO_SSH_KEY_PATH" "${SSH_OPTS[@]}")
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_DIR/frontend/dist"

if [ ! -d "$DIST_DIR" ]; then
  echo "[deploy-frontend] ERROR: $DIST_DIR not found — run 'npm run build --prefix frontend' first." >&2
  exit 1
fi

echo "[deploy-frontend] Syncing frontend/dist/ to ${DO_SSH_USER}@${DO_HOST}:${DO_DEPLOY_PATH}/frontend/dist ..."
ssh "${SSH_OPTS[@]}" "${DO_SSH_USER}@${DO_HOST}" "mkdir -p '${DO_DEPLOY_PATH}/frontend/dist'"
rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  "$DIST_DIR/" "${DO_SSH_USER}@${DO_HOST}:${DO_DEPLOY_PATH}/frontend/dist/"

echo "[deploy-frontend] Reloading nginx..."
ssh "${SSH_OPTS[@]}" "${DO_SSH_USER}@${DO_HOST}" "sudo systemctl reload nginx"

echo "[deploy-frontend] Done."
