#!/usr/bin/env bash
# Ships backend/ (source only, no node_modules/.env) to the droplet via
# rsync, then installs deps and reloads PM2 there. Run this from wherever
# you have the repo + SSH access (the GitHub Actions runner, or your own
# machine for a manual deploy) — NOT on the server itself.
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

echo "[deploy-backend] Syncing backend/ to ${DO_SSH_USER}@${DO_HOST}:${DO_DEPLOY_PATH}/backend ..."
ssh "${SSH_OPTS[@]}" "${DO_SSH_USER}@${DO_HOST}" "mkdir -p '${DO_DEPLOY_PATH}/backend'"
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  -e "ssh ${SSH_OPTS[*]}" \
  "$REPO_DIR/backend/" "${DO_SSH_USER}@${DO_HOST}:${DO_DEPLOY_PATH}/backend/"

echo "[deploy-backend] Installing production dependencies + reloading PM2 on server..."
ssh "${SSH_OPTS[@]}" "${DO_SSH_USER}@${DO_HOST}" "
  set -euo pipefail
  cd '${DO_DEPLOY_PATH}/backend'
  npm ci --omit=dev
  pm2 reload s21-backend --update-env
  pm2 save
"

echo "[deploy-backend] Waiting for health check..."
healthy=false
for i in $(seq 1 10); do
  if ssh "${SSH_OPTS[@]}" "${DO_SSH_USER}@${DO_HOST}" "curl -fsS http://127.0.0.1:5000/api/health" >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 2
done

if [ "$healthy" != "true" ]; then
  echo "[deploy-backend] ERROR: health check failed after deploy. Check 'pm2 logs s21-backend' on the server." >&2
  exit 1
fi

echo "[deploy-backend] Done — backend healthy."
