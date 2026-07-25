#!/usr/bin/env bash
set -Eeuo pipefail

resolve_ref() {
  local ref="$1"
  log_section "Validating git ref: '${ref}'"
  cd "$REPO_DIR"
  git fetch --all --tags --prune --quiet

  if git show-ref --verify --quiet "refs/remotes/origin/${ref}" 2>/dev/null; then
    REF_TYPE="branch"
    RESOLVED_SHA=$(git rev-parse "origin/${ref}")
  elif git show-ref --verify --quiet "refs/heads/${ref}" 2>/dev/null; then
    REF_TYPE="branch"
    RESOLVED_SHA=$(git rev-parse "refs/heads/${ref}")
  elif git show-ref --verify --quiet "refs/tags/${ref}" 2>/dev/null; then
    REF_TYPE="tag"
    RESOLVED_SHA=$(git rev-parse --verify "refs/tags/${ref}^{}")
  elif git rev-parse --verify "${ref}^{commit}" >/dev/null 2>&1; then
    REF_TYPE="commit"
    RESOLVED_SHA=$(git rev-parse "${ref}^{commit}")
  else
    log_error "git ref '${ref}' does not exist (not a branch, tag, or commit SHA)."
    exit 1
  fi

  SHORT_SHA="${RESOLVED_SHA:0:7}"
  COMMIT_MSG=$(git log -1 --pretty=format:"%s" "$RESOLVED_SHA")

  export RESOLVED_SHA SHORT_SHA REF_TYPE COMMIT_MSG

  log_info "Type    : ${REF_TYPE}"
  log_info "SHA     : ${SHORT_SHA} (${RESOLVED_SHA})"
  log_info "Message : ${COMMIT_MSG}"
}

checkout_ref() {
  log_section "Checkout ${REF_TYPE}: '${INPUT_GIT_REF}'"
  cd "$REPO_DIR"

  case "$REF_TYPE" in
    branch)
      git switch -C "$INPUT_GIT_REF" "origin/$INPUT_GIT_REF" --discard-changes
      ;;
    tag|commit)
      git checkout --detach "$RESOLVED_SHA"
      ;;
    *)
      log_error "Unknown REF_TYPE: ${REF_TYPE}"
      exit 1
      ;;
  esac

  log_info "Working tree: $(git rev-parse --short HEAD)"
}
