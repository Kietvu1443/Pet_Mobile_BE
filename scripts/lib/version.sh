#!/usr/bin/env bash
set -Eeuo pipefail

setup_runtime_dir() {
  mkdir -p "$RUNTIME_DIR"
}

write_version_file() {
  local action="$1"
  local deploy_time duration_ms
  deploy_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  duration_ms=$(( $(date +%s%3N) - DEPLOY_START_MS ))

  if [ -f "${RUNTIME_DIR}/current_version.json" ]; then
    cp "${RUNTIME_DIR}/current_version.json" "${RUNTIME_DIR}/previous_version.json"
  fi

  ACTION_ARG="$action" DEPLOY_TIME="$deploy_time" DURATION_MS="$duration_ms" \
  python3 -c "import json, os
data = {
    'commit_sha':     os.environ['RESOLVED_SHA'],
    'short_sha':      os.environ['SHORT_SHA'],
    'git_ref':        os.environ['INPUT_GIT_REF'],
    'ref_type':       os.environ['REF_TYPE'],
    'commit_message': os.environ['COMMIT_MSG'],
    'deployed_at':    os.environ['DEPLOY_TIME'],
    'deployed_by':    os.environ['INPUT_TRIGGERED_BY'],
    'action':         os.environ['ACTION_ARG'],
    'repository':     os.environ['INPUT_REPOSITORY'],
    'build_number':   os.environ['INPUT_RUN_NUMBER'],
    'workflow_run':   os.environ['INPUT_RUN_ID'],
    'duration_ms':    int(os.environ['DURATION_MS']),
}
with open(os.environ['RUNTIME_DIR'] + '/current_version.json', 'w') as f:
    json.dump(data, f, indent=2)
"
  log_info "Wrote ${RUNTIME_DIR}/current_version.json"
}

log_deployment() {
  local status="$1"
  local ts duration_ms
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  duration_ms=$(( $(date +%s%3N) - DEPLOY_START_MS ))

  STATUS_ARG="$status" TS="$ts" DURATION_MS="$duration_ms" \
  python3 -c "import json, os
record = {
    'timestamp':      os.environ['TS'],
    'action':         os.environ['INPUT_ACTION'],
    'git_ref':        os.environ['INPUT_GIT_REF'],
    'ref_type':       os.environ.get('REF_TYPE', 'unknown'),
    'commit_sha':     os.environ.get('RESOLVED_SHA', 'unknown'),
    'short_sha':      os.environ.get('SHORT_SHA', 'unknown'),
    'commit_message': os.environ.get('COMMIT_MSG', ''),
    'health_result':  os.environ.get('HEALTH_RESULT', 'unknown'),
    'status':         os.environ['STATUS_ARG'],
    'triggered_by':   os.environ['INPUT_TRIGGERED_BY'],
    'build_number':   os.environ['INPUT_RUN_NUMBER'],
    'workflow_run':   os.environ['INPUT_RUN_ID'],
    'duration_ms':    int(os.environ['DURATION_MS']),
}
with open(os.environ['RUNTIME_DIR'] + '/deployments.jsonl', 'a') as f:
    f.write(json.dumps(record) + '\n')
"
  log_info "Logged to ${RUNTIME_DIR}/deployments.jsonl"
}

write_last_summary() {
  local status="$1"
  local deploy_time duration_ms
  deploy_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  duration_ms=$(( $(date +%s%3N) - DEPLOY_START_MS ))

  STATUS_ARG="$status" DEPLOY_TIME="$deploy_time" DURATION_MS="$duration_ms" \
  python3 -c "import json, os
data = {
    'status':         os.environ['STATUS_ARG'],
    'action':         os.environ['INPUT_ACTION'],
    'git_ref':        os.environ['INPUT_GIT_REF'],
    'ref_type':       os.environ.get('REF_TYPE', 'unknown'),
    'commit_sha':     os.environ.get('RESOLVED_SHA', 'unknown'),
    'short_sha':      os.environ.get('SHORT_SHA', 'unknown'),
    'commit_message': os.environ.get('COMMIT_MSG', ''),
    'health_result':  os.environ.get('HEALTH_RESULT', 'unknown'),
    'deployed_at':    os.environ['DEPLOY_TIME'],
    'deployed_by':    os.environ['INPUT_TRIGGERED_BY'],
    'duration_ms':    int(os.environ['DURATION_MS']),
    'build_number':   os.environ['INPUT_RUN_NUMBER'],
    'workflow_run':   os.environ['INPUT_RUN_ID'],
}
with open(os.environ['RUNTIME_DIR'] + '/last_deploy_summary.json', 'w') as f:
    json.dump(data, f, indent=2)
"
  log_info "Wrote ${RUNTIME_DIR}/last_deploy_summary.json"
}
