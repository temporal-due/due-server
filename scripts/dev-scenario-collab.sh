#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# 시나리오 2: 파트너 협업 → 담당 배정 → 홈 대시보드 → 할 일 완료 → 정리
# 화면 흐름: S10(초대/코드 연결) → S12(담당 배정) → S13(홈 대시보드)
#            → 상태 변경(진행률 갱신) → S14(다시 시작/삭제)
#
# user1(OWNER)이 프로젝트를 만들고 user2(PARTNER)를 초대 코드로 연결한 뒤,
# Task에 담당(나/파트너/함께)을 배정하고 역할별 대시보드를 확인한다.
# 이어서 할 일을 완료 처리해 진행률이 갱신되는지, reset/delete가 동작하는지 검증한다.
#
# 전제: 서버가 떠 있어야 한다. `pnpm dev:reset`으로 user1을 먼저 시드하라.
#       user2는 이 스크립트가 직접 DB에 삽입한다.
# ──────────────────────────────────────────────────────────────────────────

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/dev-lib.sh"
preflight

DB_USER="${DB_USERNAME:-postgres}"
DB_NAME="${DB_DATABASE:-postgres}"
USER1_ID="11111111-1111-4111-8111-111111111111"
USER2_ID="22222222-2222-4222-8222-222222222222"

echo "=== 시나리오 2: 협업 → 배정 → 대시보드 (S10~S14) ==="

step "0) user2(파트너) 시드"
docker compose exec -T due-local-postgres psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 >/dev/null <<SQL
INSERT INTO users (id, "authProvider", "oauthSub", nickname, email)
VALUES ('${USER2_ID}'::uuid, 'google', 'dev-user2-local', '파트너', 'dev2@local.test')
ON CONFLICT DO NOTHING;
SQL
echo "  user2 준비됨"

TOKEN1="$(USER_ID="${USER1_ID}" bash scripts/mint-dev-access-token.sh)"
TOKEN2="$(USER_ID="${USER2_ID}" bash scripts/mint-dev-access-token.sh)"

step "user1: 프로젝트 생성 (Phase 1개, Task 3개)"
PROJECT="$(api "${TOKEN1}" POST /projects '{
  "type": "WEDDING",
  "projectName": "협업 결혼식",
  "style": "ALL_IN",
  "scheduleMode": "FIXED",
  "color": "#FF8A65",
  "startDate": "2026-01-01",
  "dueDate": "2026-12-31",
  "personality": { "additionalConsiderations": "" },
  "phases": [
    {
      "name": "큰 결정", "order": 0,
      "expectedStartDate": "2026-01-01", "expectedEndDate": "2026-06-30",
      "tasks": [
        { "name": "날짜 확정", "status": "TODO", "order": 0, "dueDate": "2026-02-15" },
        { "name": "예산 확정", "status": "TODO", "order": 1, "dueDate": "2026-03-01" },
        { "name": "웨딩홀 투어", "status": "TODO", "order": 2, "dueDate": "2026-04-10" }
      ]
    }
  ]
}')"
assert_status "프로젝트 생성" 201
PROJECT_ID="$(echo "${PROJECT}" | json id)"
T1_ID="$(echo "${PROJECT}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).phases[0].tasks[0].id)))')"
T2_ID="$(echo "${PROJECT}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).phases[0].tasks[1].id)))')"
T3_ID="$(echo "${PROJECT}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).phases[0].tasks[2].id)))')"

step "S10) I1: user1 초대 코드 발급 → I2: user2 코드로 연결"
INVITE="$(api "${TOKEN1}" POST "/projects/${PROJECT_ID}/invites" '{}')"
assert_status "초대 코드 발급" 201
CODE="$(echo "${INVITE}" | json code)"
assert_nonempty "초대 코드 생성됨" "${CODE}"

ACCEPT="$(api "${TOKEN2}" POST /invites/accept "{\"code\":\"${CODE}\"}")"
assert_status "코드 수락" 201
assert_eq "PARTNER로 가입" "$(echo "${ACCEPT}" | json role)" "PARTNER"

step "S10) I3: 멤버 목록 — OWNER + PARTNER 2명"
MEMBERS="$(api "${TOKEN1}" GET "/projects/${PROJECT_ID}/members")"
assert_status "멤버 조회" 200
assert_eq "멤버 2명" "$(echo "${MEMBERS}" | json length)" "2"

step "파트너 시점: GET /projects 에 공유받은 프로젝트가 보이는지"
P2_LIST="$(api "${TOKEN2}" GET "/projects?limit=20")"
P2_HAS="$(echo "${P2_LIST}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);process.stdout.write(String((o.data||[]).some(p=>String(p.id)===process.argv[1])))})' "${PROJECT_ID}")"
assert_eq "파트너 목록에 공유 프로젝트 포함" "${P2_HAS}" "true"

step "S12) T5: 담당 배정 (나 / 파트너 / 함께)"
api "${TOKEN1}" PATCH "/tasks/${T1_ID}/assign" '{"assignee":"OWNER"}' >/dev/null
assert_status "T1 → 나(OWNER)" 200
api "${TOKEN2}" PATCH "/tasks/${T2_ID}/assign" '{"assignee":"PARTNER"}' >/dev/null
assert_status "T2 → 파트너(PARTNER, 파트너가 직접 배정)" 200
api "${TOKEN1}" PATCH "/tasks/${T3_ID}/assign" '{"assignee":"TOGETHER"}' >/dev/null
assert_status "T3 → 함께(TOGETHER)" 200

step "S13) P6: 역할별 대시보드 (groupBy=role)"
DASH="$(api "${TOKEN1}" GET "/projects/${PROJECT_ID}/dashboard?groupBy=role&filter=task")"
assert_status "역할별 대시보드" 200
GROUP_KEYS="$(echo "${DASH}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const d=JSON.parse(s);process.stdout.write(d.groups.map(g=>g.key).sort().join(","))})')"
assert_nonempty "그룹 키 목록" "${GROUP_KEYS}"
assert_eq "upcoming(임박 미완료) 존재" "$(echo "${DASH}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).upcoming.length>0)))')" "true"

step "S13) 할 일 완료 처리 → 진행률 갱신 확인"
BEFORE="$(echo "${DASH}" | json progress.percent)"
api "${TOKEN2}" PATCH "/tasks/${T1_ID}/status" '{"status":"DONE"}' >/dev/null
assert_status "파트너가 T1 완료 처리" 200
DASH2="$(api "${TOKEN1}" GET "/projects/${PROJECT_ID}/dashboard?groupBy=role&filter=task")"
AFTER="$(echo "${DASH2}" | json progress.percent)"
assert_eq "완료 1건 → 진행률 33%" "${AFTER}" "33"
echo "  (완료 전 ${BEFORE}% → 완료 후 ${AFTER}%)"

step "S13) P6: 일정 보기 (groupBy=due&filter=schedule)"
DASH_DUE="$(api "${TOKEN1}" GET "/projects/${PROJECT_ID}/dashboard?groupBy=due&filter=schedule")"
assert_status "일정 대시보드" 200
assert_nonempty "dday 파생값" "$(echo "${DASH_DUE}" | json project.dday)"

step "S14) P8: 다시 시작하기 (reset — Phase/Task 비우고 멤버 유지)"
RESET="$(api "${TOKEN1}" POST "/projects/${PROJECT_ID}/reset")"
assert_status "reset 호출" 201
assert_eq "reset 후 phase 0개" "$(echo "${RESET}" | json phases.length)" "0"
MEMBERS_AFTER="$(api "${TOKEN1}" GET "/projects/${PROJECT_ID}/members")"
assert_eq "reset 후에도 멤버 2명 유지" "$(echo "${MEMBERS_AFTER}" | json length)" "2"

step "S14) P7: 프로젝트 삭제 (OWNER만, 204)"
api "${TOKEN1}" DELETE "/projects/${PROJECT_ID}" >/dev/null
assert_status "프로젝트 삭제" 204

summary
