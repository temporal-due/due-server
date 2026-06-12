#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# 시나리오 1: 신규 유저 온보딩 → 첫 프로젝트 생성 → 검토 → 편집
# 화면 흐름: S2(로그인) → S4(닉네임) → S3(종류) → S5~S7(정보 입력·AI 생성)
#            → S9(계획 검토) → S13(목록) → S14(편집)
#
# 프론트엔드 개발자가 "온보딩~첫 프로젝트" 화면을 구현할 때 호출해야 하는 API를
# 실제 순서대로 찔러 보고, 각 단계 응답이 화면이 기대하는 형태인지 단언으로 검증한다.
#
# 전제: 서버가 떠 있어야 한다. `pnpm dev:reset`으로 dev 유저를 먼저 시드하라.
# 비고: AI 호출(OPENAI_API_KEY) 없이도 돌도록 suggest는 MANUAL로 호출하고,
#       실제 계획은 클라가 편집해 보낸다고 가정해 직접 구성한 phases로 POST /projects 한다.
# ──────────────────────────────────────────────────────────────────────────

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/dev-lib.sh"
preflight

TOKEN="$(bash scripts/mint-dev-access-token.sh)"

echo "=== 시나리오 1: 온보딩 → 첫 프로젝트 (S2~S14) ==="

step "S2) GET /auth/me — 로그인 직후 내 정보 확인"
api "${TOKEN}" GET /auth/me >/dev/null
assert_status "내 정보 조회" 200

step "S4) PATCH /users/me — 닉네임 설정"
ME="$(api "${TOKEN}" PATCH /users/me '{"nickname":"  박완섭  "}')"
assert_status "닉네임 수정" 200
assert_eq "닉네임 trim 적용" "$(echo "${ME}" | json nickname)" "박완섭"

step "S3) GET /project-types — 종류 카탈로그 (🔒 잠금 표시 포함)"
TYPES="$(api "${TOKEN}" GET /project-types)"
assert_status "카탈로그 조회" 200
WEDDING_AVAIL="$(echo "${TYPES}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const w=a.find(t=>t.type==="WEDDING");process.stdout.write(String(w&&w.available))})')"
assert_eq "WEDDING available=true" "${WEDDING_AVAIL}" "true"

step "S5~S7) POST /projects/suggest — 종류·스타일 입력해 초안 요청 (MANUAL=AI 미호출)"
SUGGEST="$(api "${TOKEN}" POST /projects/suggest '{
  "type": "WEDDING",
  "projectName": "우리 결혼식",
  "startDate": "2026-01-01",
  "dueDate": "2026-12-31",
  "scheduleMode": "FIXED",
  "style": "ALL_IN",
  "planLevel": "MANUAL",
  "additionalConsiderations": "예물·예단 생략, 본식 DVD 희망"
}')"
assert_status "suggest 호출" 201
assert_eq "MANUAL은 빈 계획 반환" "$(echo "${SUGGEST}" | json phases.length)" "0"

step "S6/S9) POST /projects — 클라가 편집한 계획을 저장"
PROJECT="$(api "${TOKEN}" POST /projects '{
  "type": "WEDDING",
  "projectName": "우리 결혼식",
  "style": "ALL_IN",
  "planLevel": "DETAILED",
  "scheduleMode": "FIXED",
  "color": "#FF8A65",
  "startDate": "2026-01-01",
  "dueDate": "2026-12-31",
  "personality": { "additionalConsiderations": "예물·예단 생략, 본식 DVD 희망" },
  "phases": [
    {
      "name": "큰 결정", "order": 0,
      "expectedStartDate": "2026-01-01", "expectedEndDate": "2026-03-31",
      "memo": "가장 중요한 결정들", "color": "#FFB74D",
      "tasks": [
        { "name": "날짜 확정", "status": "TODO", "order": 0, "assignee": "OWNER", "dueDate": "2026-02-01" },
        { "name": "예산 범위 확정", "status": "TODO", "order": 1, "assignee": "TOGETHER" }
      ]
    },
    {
      "name": "세부 기획 & 예약", "order": 1,
      "expectedStartDate": "2026-04-01", "expectedEndDate": "2026-08-31",
      "tasks": [
        { "name": "스튜디오/드레스/메이크업 예약", "status": "TODO", "order": 0 }
      ]
    }
  ]
}')"
assert_status "프로젝트 생성" 201
PROJECT_ID="$(echo "${PROJECT}" | json id)"
assert_nonempty "프로젝트 ID 발급" "${PROJECT_ID}"
assert_eq "저장된 type" "$(echo "${PROJECT}" | json type)" "WEDDING"
assert_eq "저장된 color" "$(echo "${PROJECT}" | json color)" "#FF8A65"

step "S9) GET /projects/:id — 생성된 계획 검토 (진행률·멤버 파생)"
DETAIL="$(api "${TOKEN}" GET "/projects/${PROJECT_ID}")"
assert_status "상세 조회" 200
assert_eq "phase 2개 생성됨" "$(echo "${DETAIL}" | json phases.length)" "2"
assert_eq "progress.total=3" "$(echo "${DETAIL}" | json progress.total)" "3"
assert_eq "생성자 OWNER 멤버 자동 등록" "$(echo "${DETAIL}" | json members.0.role)" "OWNER"

step "S13) GET /projects — 홈 목록에 방금 만든 프로젝트가 보이는지"
LIST="$(api "${TOKEN}" GET "/projects?limit=20")"
assert_status "목록 조회" 200
LIST_HAS="$(echo "${LIST}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);process.stdout.write(String((o.data||[]).some(p=>String(p.id)===process.argv[1])))})' "${PROJECT_ID}")"
assert_eq "목록에 새 프로젝트 포함" "${LIST_HAS}" "true"

step "S14) 편집 — 듀 추가 → 항목 추가 → 항목 편집 → 듀 삭제"
NEW_PHASE="$(api "${TOKEN}" POST "/projects/${PROJECT_ID}/phases" '{
  "name": "최종 점검 & 본식", "order": 2,
  "expectedStartDate": "2026-09-01", "expectedEndDate": "2026-12-15",
  "memo": "막판 체크", "color": "#4FC3F7"
}')"
assert_status "듀(Phase) 추가" 201
NEW_PHASE_ID="$(echo "${NEW_PHASE}" | json id)"

NEW_TASK="$(api "${TOKEN}" POST "/phases/${NEW_PHASE_ID}/tasks" '{
  "name": "좌석 배치", "order": 0, "assignee": "PARTNER"
}')"
assert_status "항목(Task) 추가" 201
NEW_TASK_ID="$(echo "${NEW_TASK}" | json id)"

api "${TOKEN}" PATCH "/tasks/${NEW_TASK_ID}" '{"name":"좌석 배치 확정","dueDate":"2026-11-30"}' >/dev/null
assert_status "항목 편집" 200

api "${TOKEN}" DELETE "/phases/${NEW_PHASE_ID}" >/dev/null
assert_status "듀 삭제 (204)" 204

DETAIL2="$(api "${TOKEN}" GET "/projects/${PROJECT_ID}")"
assert_eq "삭제 후 phase 다시 2개" "$(echo "${DETAIL2}" | json phases.length)" "2"

summary
