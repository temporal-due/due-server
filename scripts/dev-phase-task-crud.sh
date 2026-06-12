#!/usr/bin/env bash
set -euo pipefail

# Phase/Task CRUD(PH1~3, T1~4) happy-path 재현 스크립트.
# dev 토큰 발급 → 베이스 프로젝트 생성 → Phase 추가/수정/삭제, Task 추가/수정/일괄삭제까지
# S14 편집 화면이 의존하는 신규 엔드포인트를 한 번에 호출해 동작을 확인한다.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BASE_URL="http://localhost:${PORT:-3000}"
TOKEN="$(bash scripts/mint-dev-access-token.sh)"
AUTH=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

# 응답 JSON에서 점 표기 경로 값을 추출한다. (jq 의존 없이 node 사용)
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const v=process.argv[1].split(".").reduce((a,k)=>a&&a[k],o);process.stdout.write(String(v))})' "$1"; }

echo "=== 0) 베이스 프로젝트 생성 (POST /projects) ==="
PROJECT_JSON="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/projects" -d '{
  "projectName": "CRUD 테스트 프로젝트",
  "startDate": "2026-01-11",
  "dueDate": "2026-12-31",
  "budget": 50000000,
  "personality": { "preparationStyle": "systematic", "additionalConsiderations": "테스트" },
  "phases": [
    { "name": "큰 결정", "expectedStartDate": "2026-01-11", "expectedEndDate": "2026-03-01", "order": 0,
      "tasks": [ { "name": "날짜 확정", "status": "TODO", "order": 0 } ] }
  ]
}')"
PROJECT_ID="$(echo "$PROJECT_JSON" | json id)"
SEED_PHASE_ID="$(echo "$PROJECT_JSON" | json phases.0.id)"
echo "projectId=${PROJECT_ID}, seedPhaseId=${SEED_PHASE_ID}"

echo ""
echo "=== 1) PH1: POST /projects/${PROJECT_ID}/phases (Due 추가) ==="
PHASE_JSON="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/projects/${PROJECT_ID}/phases" -d '{
  "name": "세부 기획", "expectedStartDate": "2026-03-02", "expectedEndDate": "2026-06-01",
  "order": 1, "memo": "스드메 예약", "color": "#FFB74D"
}')"
echo "$PHASE_JSON"
PHASE_ID="$(echo "$PHASE_JSON" | json id)"

echo ""
echo "=== 2) PH2: PATCH /phases/${PHASE_ID} (듀 수정) ==="
curl -sS "${AUTH[@]}" -X PATCH "${BASE_URL}/phases/${PHASE_ID}" -d '{ "name": "세부 기획&예약", "color": "#4FC3F7" }'

echo ""
echo "=== 3) T1: POST /phases/${PHASE_ID}/tasks (항목 추가) ==="
TASK_JSON="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/phases/${PHASE_ID}/tasks" -d '{
  "name": "드레스샵 예약", "order": 0, "assignee": "OWNER", "dueDate": "2026-05-12"
}')"
echo "$TASK_JSON"
TASK_ID="$(echo "$TASK_JSON" | json id)"

echo ""
echo "=== 4) T2: PATCH /tasks/${TASK_ID} (항목 편집) ==="
curl -sS "${AUTH[@]}" -X PATCH "${BASE_URL}/tasks/${TASK_ID}" -d '{ "name": "드레스샵 투어&예약" }'

echo ""
echo "=== 5) T4: POST /tasks/bulk-delete (선택 항목 일괄 삭제) ==="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" "${AUTH[@]}" -X POST "${BASE_URL}/tasks/bulk-delete" -d "{ \"ids\": [${TASK_ID}] }"

echo ""
echo "=== 6) PH3: DELETE /phases/${PHASE_ID} (듀 삭제) ==="
curl -sS -o /dev/null -w "HTTP %{http_code}\n" "${AUTH[@]}" -X DELETE "${BASE_URL}/phases/${PHASE_ID}"

echo ""
echo "done. (베이스 프로젝트 ${PROJECT_ID} 와 seedPhase ${SEED_PHASE_ID} 는 유지됨)"
