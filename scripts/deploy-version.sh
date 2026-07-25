#!/usr/bin/env bash
set -Eeuo pipefail

# ── Deployment Lock ────────────────────────────────────────────────────────────
exec 9>/tmp/pet-helper-deploy.lock
flock -n 9 || {
  echo "[ERROR] Another deployment is already running on this server." >&2
  exit 1
}

DEPLOY_START_MS=$(date +%s%3N)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"

# Source libraries
source "${LIB_DIR}/log.sh"
source "${LIB_DIR}/git.sh"
source "${LIB_DIR}/health.sh"
source "${LIB_DIR}/version.sh"

# Default configuration from environment variables
REPO_DIR="${REPO_DIR:-/opt/pet-helper}"
BACKEND_DIR="${BACKEND_DIR:-/opt/pet-helper/backend}"
RUNTIME_DIR="${RUNTIME_DIR:-/opt/pet-helper/runtime}"
PM2_APP="${PM2_APP:-pet-helper}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/v1/health}"
HEALTH_RETRIES=10
HEALTH_DELAY=3
HEALTH_RESULT="unknown"

INPUT_GIT_REF="${INPUT_GIT_REF:-main}"
INPUT_ACTION="${INPUT_ACTION:-deploy}"
INPUT_TRIGGERED_BY="${INPUT_TRIGGERED_BY:-unknown}"
INPUT_REPOSITORY="${INPUT_REPOSITORY:-unknown}"
INPUT_RUN_NUMBER="${INPUT_RUN_NUMBER:-0}"
INPUT_RUN_ID="${INPUT_RUN_ID:-0}"

export REPO_DIR BACKEND_DIR RUNTIME_DIR PM2_APP HEALTH_URL HEALTH_RETRIES HEALTH_DELAY HEALTH_RESULT
export INPUT_GIT_REF INPUT_ACTION INPUT_TRIGGERED_BY INPUT_REPOSITORY INPUT_RUN_NUMBER INPUT_RUN_ID DEPLOY_START_MS

# Global cleanup and failure handler trap
on_exit() {
  local exit_code=$1
  if [ "$exit_code" -ne 0 ]; then
    log_error "Deployment failed with exit code ${exit_code}"
    log_deployment "FAILED" 2>/dev/null || true
    write_last_summary "FAILED" 2>/dev/null || true
  fi
}
trap 'on_exit $?' EXIT

perform_deploy() {
  resolve_ref "$INPUT_GIT_REF"
  checkout_ref
  install_deps
  restart_services
  reload_nginx
  health_check
  write_version_file "deploy"
  log_deployment "SUCCESS"
  write_last_summary "SUCCESS"
}

perform_rollback() {
  log_section "Manual Rollback"

  if [ ! -f "${RUNTIME_DIR}/previous_version.json" ]; then
    log_error "No previous_version.json found in ${RUNTIME_DIR}. Cannot rollback."
    exit 1
  fi

  log_info "Previous version to restore:"
  cat "${RUNTIME_DIR}/previous_version.json"
  echo ""

  local prev_sha prev_ref prev_ref_type prev_msg
  prev_sha=$(python3 -c "import json; d=json.load(open('${RUNTIME_DIR}/previous_version.json')); print(d['commit_sha'])")
  prev_ref=$(python3 -c "import json; d=json.load(open('${RUNTIME_DIR}/previous_version.json')); print(d['git_ref'])")
  prev_ref_type=$(python3 -c "import json; d=json.load(open('${RUNTIME_DIR}/previous_version.json')); print(d.get('ref_type','commit'))")
  prev_msg=$(python3 -c "import json; d=json.load(open('${RUNTIME_DIR}/previous_version.json')); print(d.get('commit_message','N/A'))")

  INPUT_GIT_REF="$prev_ref"
  RESOLVED_SHA="$prev_sha"
  SHORT_SHA="${prev_sha:0:7}"
  REF_TYPE="$prev_ref_type"
  COMMIT_MSG="$prev_msg"
  export INPUT_GIT_REF RESOLVED_SHA SHORT_SHA REF_TYPE COMMIT_MSG

  cd "$REPO_DIR"
  git fetch --all --tags --quiet

  case "$REF_TYPE" in
    branch)
      git switch -C "$prev_ref" "origin/$prev_ref" --discard-changes
      ;;
    tag|commit)
      git checkout --detach "$RESOLVED_SHA"
      ;;
  esac
  log_info "Working tree: $(git rev-parse --short HEAD)"

  install_deps
  restart_services
  reload_nginx
  health_check
  write_version_file "rollback"
  log_deployment "SUCCESS"
  write_last_summary "SUCCESS"
}

main() {
  log_section "Starting: action=${INPUT_ACTION}, ref=${INPUT_GIT_REF}"
  setup_runtime_dir

  if [ -f "${RUNTIME_DIR}/current_version.json" ]; then
    log_info "Currently deployed version:"
    cat "${RUNTIME_DIR}/current_version.json"
    echo ""
  fi

  case "${INPUT_ACTION}" in
    deploy)
      perform_deploy
      ;;
    rollback)
      perform_rollback
      ;;
    *)
      log_error "Unknown action '${INPUT_ACTION}'. Must be 'deploy' or 'rollback'."
      exit 1
      ;;
  esac
}

main "$@"
