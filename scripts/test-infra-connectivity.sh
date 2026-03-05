#!/usr/bin/env bash
set -euo pipefail

PASS=0
FAIL=0

check() {
  local name="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo "  [PASS] $name"
    ((PASS++))
  else
    echo "  [FAIL] $name"
    ((FAIL++))
  fi
}

echo "============================================"
echo "  Phase 1 Infrastructure Connectivity Test"
echo "============================================"

check "Redis ping" redis-cli -h localhost ping
check "MinIO health" curl -sf http://localhost:9000/minio/health/live
check "Postgres ready" pg_isready -h localhost -p 5432 -U postgres

echo ""
echo "============================================"
echo "  Result: $PASS passed / $FAIL failed"
echo "============================================"

[ "$FAIL" -eq 0 ] || exit 1
