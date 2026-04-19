#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="${BASE_URL:-http://localhost:${PORT:-3000}}"

USER_ID="${DEV_USER_ID:-11111111-1111-4111-8111-111111111111}"

TOKEN="$(USER_ID="${USER_ID}" bash scripts/mint-dev-access-token.sh)"

curl -sS -X POST "${BASE_URL}/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d @- <<'JSON'
{
  "projectName": "샘플 프로젝트",
  "startDate": "2026-04-01",
  "dueDate": "2026-06-30",
  "budget": 500000,
  "personality": {
    "preparationStyle": "체계형",
    "additionalConsiderations": "스크립트 자동 생성 샘플"
  },
  "phases": [
    {
      "name": "Phase 1 · 준비",
      "expectedStartDate": "2026-04-01",
      "expectedEndDate": "2026-04-14",
      "order": 0,
      "tasks": [
        { "name": "요구사항 정리", "status": "TODO", "order": 0 },
        { "name": "일정·예산 확정", "status": "IN_PROGRESS", "order": 1 }
      ]
    },
    {
      "name": "Phase 2 · 실행",
      "expectedStartDate": "2026-04-15",
      "expectedEndDate": "2026-05-15",
      "order": 1,
      "tasks": [
        { "name": "MVP 구현", "status": "TODO", "order": 0 },
        { "name": "검증·피드백", "status": "TODO", "order": 1 }
      ]
    }
  ]
}
JSON

echo ""
