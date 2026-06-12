#!/usr/bin/env bash
set -euo pipefail

# P1(suggest) 엔드포인트 확장 확인 스크립트.
# MANUAL planLevel(AI 미호출)과 OUTLINE/DETAILED(AI 호출)을 순서대로 테스트한다.
# OUTLINE/DETAILED 테스트는 OPENAI_API_KEY가 .env에 설정되어 있어야 한다.
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

echo "=== P1-a) suggest planLevel=MANUAL (AI 미호출, 빈 계획 즉시 반환) ==="
MANUAL_JSON="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/projects/suggest" -d '{
  "type": "WEDDING",
  "projectName": "우리 결혼식",
  "startDate": "2026-01-01",
  "dueDate": "2026-12-31",
  "style": "ALL_IN",
  "planLevel": "MANUAL"
}')"
echo "${MANUAL_JSON}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(`  projectName: ${r.projectName}`);console.log(`  phases.length: ${r.phases.length} (0 기대 — AI 미호출)`)})'

echo ""
echo "=== P1-b) suggest planLevel=OUTLINE (Phase만, tasks 빈 배열) ==="
OUTLINE_JSON="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/projects/suggest" -d '{
  "type": "WEDDING",
  "dueDate": "2026-12-31",
  "style": "SAVE_MONEY",
  "planLevel": "OUTLINE"
}')"
echo "${OUTLINE_JSON}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(`  projectName: ${r.projectName}`);console.log(`  phases.length: ${r.phases.length}`);r.phases.forEach((p,i)=>console.log(`  phase[${i}] "${p.name}" tasks.length=${p.tasks.length} (0 기대)`))})'

echo ""
echo "=== P1-c) suggest planLevel=DETAILED (Phase + Task 상세) ==="
DETAILED_JSON="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/projects/suggest" -d '{
  "type": "WEDDING",
  "dueDate": "2026-12-31",
  "style": "ALL_IN",
  "planLevel": "DETAILED",
  "additionalConsiderations": "예물·예단 생략, DVD 희망"
}')"
echo "${DETAILED_JSON}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);console.log(`  projectName: ${r.projectName}`);console.log(`  budget: ${r.budget}원`);console.log(`  phases.length: ${r.phases.length}`);r.phases.forEach((p,i)=>console.log(`  phase[${i}] "${p.name}" tasks.length=${p.tasks.length}`))})'

echo ""
echo "=== P2) POST /projects (새 필드 type/style/planLevel/color 포함) ==="
PROJECT_JSON="$(curl -sS "${AUTH[@]}" -X POST "${BASE_URL}/projects" -d '{
  "type": "WEDDING",
  "projectName": "우리 결혼식",
  "style": "ALL_IN",
  "planLevel": "DETAILED",
  "scheduleMode": "FIXED",
  "color": "#FF8A65",
  "startDate": "2026-01-01",
  "dueDate": "2026-12-31",
  "personality": { "additionalConsiderations": "예물·예단 생략" },
  "phases": [
    {
      "name": "큰 결정", "order": 0,
      "expectedStartDate": "2026-01-01", "expectedEndDate": "2026-03-31",
      "memo": "가장 중요한 결정들", "color": "#FFB74D",
      "tasks": [
        { "name": "날짜 확정", "order": 0, "assignee": "OWNER", "dueDate": "2026-02-01" },
        { "name": "예산 범위 확정", "order": 1 }
      ]
    }
  ]
}')"
PROJECT_ID="$(echo "$PROJECT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).id)))')"
echo "${PROJECT_JSON}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);console.log(`  id: ${p.id}, type: ${p.type}, style: ${p.style}, color: ${p.color}`);const ph=p.phases[0];console.log(`  phase[0]: "${ph.name}" memo="${ph.memo}" color="${ph.color}"`);console.log(`  task[0]: assignee=${ph.tasks[0].assignee} dueDate=${ph.tasks[0].dueDate}`);})'

echo ""
echo "=== P5) PATCH /projects/:id (color/style/scheduleMode 수정) ==="
UPDATED="$(curl -sS "${AUTH[@]}" -X PATCH "${BASE_URL}/projects/${PROJECT_ID}" -d '{
  "color": "#4FC3F7",
  "style": "RECOMMEND"
}')"
echo "${UPDATED}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s);console.log(`  color: ${p.color} (기대: #4FC3F7)`);console.log(`  style: ${p.style} (기대: RECOMMEND)`)})'

echo ""
echo "=== 완료 ==="
