#!/usr/bin/env bash
set -Eeuo pipefail

install_deps() {
  log_section "Installing dependencies (npm ci)"
  cd "$BACKEND_DIR"

  test -f package.json || {
    log_error "package.json not found in ${BACKEND_DIR}"
    exit 1
  }
  test -f package-lock.json || {
    log_error "package-lock.json not found in ${BACKEND_DIR}"
    exit 1
  }

  npm ci
}

restart_services() {
  log_section "Restarting PM2 — ${PM2_APP}"
  pm2 restart "$PM2_APP" --update-env
  pm2 describe "$PM2_APP" >/dev/null || {
    log_error "PM2 application '${PM2_APP}' does not exist or failed to describe."
    exit 1
  }
  pm2 save
  pm2 status
}

reload_nginx() {
  log_section "Reloading Nginx"
  sudo systemctl reload nginx
  log_info "Nginx reloaded successfully"
}

health_check() {
  log_section "Health check: ${HEALTH_URL}"
  local attempt=1
  local http_status app_status

  while [ "$attempt" -le "$HEALTH_RETRIES" ]; do
    log_info "Attempt ${attempt}/${HEALTH_RETRIES}..."
    http_status=$(curl -s -o /tmp/health_body.json -w "%{http_code}" "$HEALTH_URL" || true)
    app_status=$(python3 -c "import json; d=json.load(open('/tmp/health_body.json')); print(d.get('status',''))" 2>/dev/null || true)

    if [ "$http_status" = "200" ] && [ "$app_status" = "ok" ]; then
      log_success "Health check passed (HTTP ${http_status}, status=ok)"
      HEALTH_RESULT="passed (HTTP 200, status=ok)"
      export HEALTH_RESULT
      cat /tmp/health_body.json
      echo ""
      return 0
    fi

    log_info "Not ready (HTTP ${http_status}, status='${app_status}'). Waiting ${HEALTH_DELAY}s..."
    sleep "$HEALTH_DELAY"
    attempt=$((attempt + 1))
  done

  HEALTH_RESULT="failed after ${HEALTH_RETRIES} attempts"
  export HEALTH_RESULT
  log_error "Health check failed after ${HEALTH_RETRIES} attempts."
  pm2 status || true
  pm2 logs "$PM2_APP" --lines 30 --nostream || true
  exit 1
}
