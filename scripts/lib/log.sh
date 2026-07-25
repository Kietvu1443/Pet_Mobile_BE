#!/usr/bin/env bash
set -Eeuo pipefail

log_section() {
  echo ""
  echo "=============================================="
  echo "  $1"
  echo "=============================================="
}

log_info() {
  echo "  [INFO] $1"
}

log_success() {
  echo "  [SUCCESS] $1"
}

log_error() {
  echo "  [ERROR] $1" >&2
}
