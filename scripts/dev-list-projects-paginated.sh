#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN=$(bash "$SCRIPT_DIR/mint-dev-access-token.sh")

echo "=== 1페이지 (limit=2) ==="
PAGE1=$(curl -sS \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/projects?limit=2")
echo "$PAGE1" | jq .

NEXT_CURSOR=$(echo "$PAGE1" | jq -r '.nextCursor // empty')

if [ -z "$NEXT_CURSOR" ]; then
  echo ""
  echo "✓ 프로젝트가 2개 이하 — 다음 페이지 없음"
  exit 0
fi

echo ""
echo "=== 2페이지 (cursor=$NEXT_CURSOR) ==="
curl -sS \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/projects?limit=2&cursor=$NEXT_CURSOR" | jq .
