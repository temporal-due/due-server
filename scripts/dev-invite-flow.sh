#!/usr/bin/env bash
set -euo pipefail

# 초대(I1/I2) + 멤버(I3/I4) 엔드포인트 happy-path 재현 스크립트.
# user1(OWNER)이 프로젝트를 만들고, user2(PARTNER)를 초대 코드로 연결한 뒤
# 멤버 목록 조회(I3)와 멤버 제거(I4)까지 확인한다.
# 전제: 서버가 떠 있어야 한다. pnpm dev:reset을 먼저 실행해 user1을 시드하라.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "error: .env not found" >&2
  exit 1
fi

DB_USER="${DB_USERNAME:-postgres}"
DB_NAME="${DB_DATABASE:-postgres}"
BASE_URL="http://localhost:${PORT:-3000}"

USER1_ID="11111111-1111-4111-8111-111111111111"
USER2_ID="22222222-2222-4222-8222-222222222222"

# 응답 JSON에서 점 표기 경로 값을 추출한다.
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const v=process.argv[1].split(".").reduce((a,k)=>a&&a[k],o);process.stdout.write(String(v??""  ))})' "$1"; }

echo "=== 0) user2 시드 (없으면 삽입, 있으면 스킵) ==="
docker compose exec -T due-local-postgres psql -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO users (id, "authProvider", "oauthSub", nickname, email)
VALUES (
  '${USER2_ID}'::uuid,
  'google',
  'dev-user2-local',
  'dev_user2',
  'dev2@local.test'
) ON CONFLICT DO NOTHING;
SQL
echo "user2 준비됨"

echo ""
echo "=== 1) 토큰 발급 ==="
TOKEN1="$(USER_ID="${USER1_ID}" bash scripts/mint-dev-access-token.sh)"
TOKEN2="$(USER_ID="${USER2_ID}" bash scripts/mint-dev-access-token.sh)"
AUTH1=(-H "Authorization: Bearer ${TOKEN1}" -H "Content-Type: application/json")
AUTH2=(-H "Authorization: Bearer ${TOKEN2}" -H "Content-Type: application/json")
echo "token1 발급 완료 / token2 발급 완료"

echo ""
echo "=== 2) user1: 프로젝트 생성 ==="
PROJECT_JSON="$(curl -sS "${AUTH1[@]}" -X POST "${BASE_URL}/projects" -d '{
  "projectName": "초대 테스트 프로젝트",
  "startDate": "2026-01-11",
  "dueDate": "2026-12-31",
  "budget": 50000000,
  "personality": { "preparationStyle": "systematic", "additionalConsiderations": "" },
  "phases": [
    { "name": "큰 결정", "expectedStartDate": "2026-01-11", "expectedEndDate": "2026-06-01",
      "order": 0, "tasks": [{"name": "날짜 확정", "status": "TODO", "order": 0}] }
  ]
}')"
PROJECT_ID="$(echo "$PROJECT_JSON" | json id)"
echo "프로젝트 ID: ${PROJECT_ID}"

echo ""
echo "=== I1) user1: 초대 코드 발급 (POST /projects/:id/invites) ==="
INVITE_JSON="$(curl -sS "${AUTH1[@]}" -X POST "${BASE_URL}/projects/${PROJECT_ID}/invites" -d '{}')"
echo "${INVITE_JSON}"
INVITE_CODE="$(echo "$INVITE_JSON" | json code)"
echo "초대 코드: ${INVITE_CODE}"

echo ""
echo "=== I2) user2: 초대 코드 수락 (POST /invites/accept) ==="
ACCEPT_JSON="$(curl -sS "${AUTH2[@]}" -X POST "${BASE_URL}/invites/accept" -d "{\"code\":\"${INVITE_CODE}\"}")"
echo "${ACCEPT_JSON}"

echo ""
echo "=== I3) user1: 멤버 목록 조회 (GET /projects/:id/members) ==="
MEMBERS_JSON="$(curl -sS "${AUTH1[@]}" -X GET "${BASE_URL}/projects/${PROJECT_ID}/members")"
echo "${MEMBERS_JSON}"
MEMBER_COUNT="$(echo "${MEMBERS_JSON}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).length)))')"
echo "멤버 수: ${MEMBER_COUNT} (OWNER+PARTNER = 2 기대)"

echo ""
echo "=== I4) user1: user2 제거 (DELETE /projects/:id/members/:userId) ==="
STATUS="$(curl -sS -o /dev/null -w "%{http_code}" "${AUTH1[@]}" -X DELETE "${BASE_URL}/projects/${PROJECT_ID}/members/${USER2_ID}")"
echo "HTTP ${STATUS} (204 기대)"

echo ""
echo "=== I3) user1: 멤버 목록 재조회 (PARTNER 제거 확인) ==="
MEMBERS_AFTER="$(curl -sS "${AUTH1[@]}" -X GET "${BASE_URL}/projects/${PROJECT_ID}/members")"
echo "${MEMBERS_AFTER}"
MEMBER_COUNT_AFTER="$(echo "${MEMBERS_AFTER}" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).length)))')"
echo "멤버 수: ${MEMBER_COUNT_AFTER} (OWNER만 = 1 기대)"

echo ""
echo "=== 완료 ==="
