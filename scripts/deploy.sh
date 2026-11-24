#!/bin/bash
# Deploy current main branch to the production server:
# push local commits, then SSH in, git pull and restart via PM2.
#
# Usage: ./scripts/deploy.sh
# Requires .deploy.env (gitignored) at the project root with:
#   DEPLOY_HOST, DEPLOY_USER, DEPLOY_PASSWORD, DEPLOY_PATH, DEPLOY_PM2_NAME

set -e

cd "$(dirname "$0")/.."

if [ ! -f .deploy.env ]; then
  echo "Missing .deploy.env — see scripts/deploy.sh for required variables."
  exit 1
fi

source .deploy.env

if ! command -v sshpass >/dev/null 2>&1; then
  echo "sshpass is required (brew install hudochenkov/sshpass/sshpass)."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has uncommitted changes — commit before deploying."
  git status --short
  exit 1
fi

echo "==> Pushing main to origin..."
git push origin main

echo "==> Deploying to ${DEPLOY_HOST}..."
sshpass -p "$DEPLOY_PASSWORD" ssh -o StrictHostKeyChecking=no "${DEPLOY_USER}@${DEPLOY_HOST}" "
  set -e
  cd '${DEPLOY_PATH}'
  git pull origin main
  pm2 restart '${DEPLOY_PM2_NAME}'
  pm2 list
"

echo "==> Done."
