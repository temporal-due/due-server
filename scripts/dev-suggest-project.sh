#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN="$(bash "$SCRIPT_DIR/mint-dev-access-token.sh")"

curl -sS \
  -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "dueDate": "2026-06-30",
    "preparationStyle": "할 수 있는 것 다 하기",
    "additionalConsiderations": "예물, 예단은 안할거에요. DVD랑 아이폰 스냅은 꼭 하고싶어요."
  }' \
  http://localhost:3000/projects/suggest | jq .
