#!/usr/bin/env bash
set -euo pipefail

# P4(상세)·P6(대시보드)·P7(삭제)·P8(초기화) 엔드포인트 happy-path 재현 스크립트.
# 프로젝트를 만들고 Tasks에 상태/담당을 설정한 뒤 각 엔드포인트를 순서대로 호출한다.
# 전제: 서버가 떠 있어야 한다. pnpm dev:reset을 먼저 실행해 dev 유저를 시드하라.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "error: .env not found" >&2
  exit 1
fi

BASE_URL="http://localhost:${PORT:-3000}"
TOKEN="$(bash scripts/mint-dev-access-token.sh)"
AUTH=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const v=process.argv[1].split(".").reduce((a,k)=>a&&a[k],o);process.stdout.write(String(v??""))})' "$1"; }

echo "=== 0) 프로젝트 생성 (3개 Phase, 여러 Task) ==="
PROJECT_JSON="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/projects" -d '{
  "projectName": "대시보드 테스트 프로젝트",
  "startDate": "2026-01-01",
  "dueDate": "2026-12-31",
  "budget": 50000000,
  "personality": { "preparationStyle": "systematic", "additionalConsiderations": "" },
  "phases": [
    {
      "name": "큰 결정", "order": 0,
      "expectedStartDate": "2026-01-01", "expectedEndDate": "2026-03-31",
      "tasks": [
        { "name": "날짜 확정", "status": "DONE", "order": 0 },
        { "name": "예산 범위 확정", "status": "IN_PROGRESS", "order": 1 },
        { "name": "결혼식 스타일 결정", "status": "TODO", "order": 2 }
      ]
    },
    {
      "name": "예약", "order": 1,
      "expectedStartDate": "2026-04-01", "expectedEndDate": "2026-08-31",
      "tasks": [
        { "name": "드레스샵 예약", "status": "TODO", "order": 0 },
        { "name": "스튜디오 예약", "status": "TODO", "order": 1 }
      ]
    },
    {
      "name": "최종 점검", "order": 2,
      "expectedStartDate": "2026-09-01", "expectedEndDate": "2026-12-15",
      "tasks": [
        { "name": "청첩장 제작", "status": "TODO", "order": 0 },
        { "name": "좌석 배치", "status": "TODO", "order": 1 }
      ]
    }
  ]
}')"
PROJECT_ID="$(echo "$PROJECT_JSON" | json id)"
echo "프로젝트 ID: ${PROJECT_ID}"

echo ""
echo "=== Task ID 추출 ==="
TASK1_ID="$(echo "$PROJECT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);process.stdout.write(String(p.phases[1].tasks[0].id))})')"
TASK2_ID="$(echo "$PROJECT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);process.stdout.write(String(p.phases[1].tasks[1].id))})')"
echo "드레스샵 예약 ID: ${TASK1_ID} / 스튜디오 예약 ID: ${TASK2_ID}"

echo ""
echo "=== 담당 배정 (T5) ==="
curl -sS "${AUTH[@]}" -X PATCH "${BASE_URL}/tasks/${TASK1_ID}/assign" -d '{"assignee":"OWNER"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const t=JSON.parse(s);console.log(`  task ${t.id}: assignee=${t.assignee}`)})'
curl -sS "${AUTH[@]}" -X PATCH "${BASE_URL}/tasks/${TASK2_ID}/assign" -d '{"assignee":"TOGETHER"}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const t=JSON.parse(s);console.log(`  task ${t.id}: assignee=${t.assignee}`)})'

echo ""
echo "=== dueDate 설정 (T2) ==="
curl -sS "${AUTH[@]}" -X PATCH "${BASE_URL}/tasks/${TASK1_ID}" -d '{"dueDate":"2026-05-12"}' -o /dev/null
curl -sS "${AUTH[@]}" -X PATCH "${BASE_URL}/tasks/${TASK2_ID}" -d '{"dueDate":"2026-06-01"}' -o /dev/null
echo "  dueDate 설정 완료"

echo ""
echo "=== P4) GET /projects/:id (상세 + 진행률 + 멤버) ==="
P4_JSON="$(curl -sS "${AUTH[@]}" -X GET "${BASE_URL}/projects/${PROJECT_ID}")"
echo "${P4_JSON}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);console.log(`  projectName: ${p.projectName}`);console.log(`  progress: done=${p.progress.done} inProgress=${p.progress.inProgress} notStarted=${p.progress.notStarted} total=${p.progress.total} percent=${p.progress.percent}%`);console.log(`  members: ${p.members.map(m=>m.role).join(", ")}`)})'

echo ""
echo "=== P6-a) GET /projects/:id/dashboard?groupBy=role&filter=task ==="
DASH_ROLE="$(curl -sS "${AUTH[@]}" -X GET "${BASE_URL}/projects/${PROJECT_ID}/dashboard?groupBy=role&filter=task")"
echo "${DASH_ROLE}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);console.log(`  dday: ${d.project.dday}`);console.log(`  progress: ${JSON.stringify(d.progress)}`);console.log(`  upcoming: ${d.upcoming.length}개`);d.groups.forEach(g=>console.log(`  그룹[${g.key}] "${g.label}" count=${g.count} done=${g.done}`))})'

echo ""
echo "=== P6-b) GET /projects/:id/dashboard?groupBy=due&filter=schedule ==="
DASH_DUE="$(curl -sS "${AUTH[@]}" -X GET "${BASE_URL}/projects/${PROJECT_ID}/dashboard?groupBy=due&filter=schedule")"
echo "${DASH_DUE}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);d.groups.forEach(g=>console.log(`  그룹[${g.key}] "${g.label}" count=${g.count} tasks(schedule)=${g.tasks.length}`))})'

echo ""
echo "=== P7) DELETE /projects/:id (별도 프로젝트 생성 후 삭제) ==="
DEL_PROJECT_ID="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/projects" -d '{
  "projectName": "삭제용 프로젝트", "startDate": "2026-01-01", "dueDate": "2026-12-31",
  "budget": 0, "personality": { "preparationStyle": "x", "additionalConsiderations": "" },
  "phases":[{"name":"p","order":0,"expectedStartDate":"2026-01-01","expectedEndDate":"2026-06-01","tasks":[{"name":"t","status":"TODO","order":0}]}]
}' | json id)"
STATUS="$(curl -sS -o /dev/null -w "%{http_code}" "${AUTH[@]}" -X DELETE "${BASE_URL}/projects/${DEL_PROJECT_ID}")"
echo "  DELETE /projects/${DEL_PROJECT_ID} → HTTP ${STATUS} (204 기대)"

echo ""
echo "=== P8) POST /projects/:id/reset (Phase/Task 초기화) ==="
RESET_JSON="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/projects/${PROJECT_ID}/reset")"
PHASE_COUNT="$(echo "${RESET_JSON}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).phases.length)))')"
echo "  초기화 후 phases 수: ${PHASE_COUNT} (0 기대)"

echo ""
echo "=== 완료 ==="
