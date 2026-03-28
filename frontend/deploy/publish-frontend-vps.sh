#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REMOTE="${1:-root@143.198.205.88}"
REMOTE_WEB_ROOT="${REMOTE_WEB_ROOT:-/var/www/shadowbid}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)}"
REMOTE_RELEASE_DIR="${REMOTE_WEB_ROOT}/releases/${RELEASE_ID}"

echo "==> Building frontend"
npm --prefix "${FRONTEND_DIR}" run build

echo "==> Preparing release directory on ${REMOTE}"
ssh "${REMOTE}" "mkdir -p '${REMOTE_RELEASE_DIR}' '${REMOTE_WEB_ROOT}/releases'"

echo "==> Uploading built assets"
rsync -avz --delete "${FRONTEND_DIR}/dist/" "${REMOTE}:${REMOTE_RELEASE_DIR}/"

echo "==> Uploading Nginx config template"
scp "${FRONTEND_DIR}/deploy/nginx-shadowbid-web.conf" "${REMOTE}:/tmp/nginx-shadowbid-web.conf"

echo "==> Activating release and web config"
ssh "${REMOTE}" "\
  mkdir -p '${REMOTE_WEB_ROOT}' && \
  ln -sfn '${REMOTE_RELEASE_DIR}' '${REMOTE_WEB_ROOT}/current' && \
  if [ ! -f /etc/nginx/sites-available/shadowbid-web ]; then \
    cp /tmp/nginx-shadowbid-web.conf /etc/nginx/sites-available/shadowbid-web; \
  fi && \
  ln -sfn /etc/nginx/sites-available/shadowbid-web /etc/nginx/sites-enabled/shadowbid-web && \
  rm -f /etc/nginx/sites-enabled/default && \
  nginx -t && \
  systemctl reload nginx"

cat <<EOF

Frontend release uploaded.

Release:
  ${REMOTE_RELEASE_DIR}

Current symlink:
  ${REMOTE_WEB_ROOT}/current

Next required cutover steps in Cloudflare:
1. Change the @ record for shadowbid.xyz to point to 143.198.205.88
2. Change the www record for www.shadowbid.xyz to point to 143.198.205.88
3. Temporarily set both records to DNS only while issuing certificates

Then on the VPS run:
  certbot --nginx -d shadowbid.xyz -d www.shadowbid.xyz

After certbot succeeds:
  systemctl reload nginx

EOF
