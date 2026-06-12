# shellcheck shell=bash
# 시나리오 스크립트 공용 헬퍼. 단독 실행하지 말고 `source` 해서 쓴다.
#
# 제공 기능:
#   - 환경 점검(.env, 서버 기동 여부)
#   - api()       : 인증 호출 후 LAST_BODY / LAST_STATUS 세팅
#   - json()      : 응답 JSON에서 점 표기 경로 값 추출
#   - assert_*()  : 통과/실패를 집계하는 단언들
#   - summary()   : 마지막에 통과/실패 요약 출력 (실패 시 exit 1)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f ".env" ]]; then
  echo "error: .env not found at $ROOT_DIR/.env" >&2
  exit 1
fi

BASE_URL="http://localhost:${PORT:-3000}"

# 색상 (TTY가 아니면 비활성)
if [[ -t 1 ]]; then
  C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_DIM=$'\033[2m'; C_RESET=$'\033[0m'
else
  C_GREEN=''; C_RED=''; C_DIM=''; C_RESET=''
fi

PASS_COUNT=0
FAIL_COUNT=0

# api()는 VAR="$(api ...)" 형태로 command substitution 안에서 자주 호출된다.
# command substitution은 서브셸이라 셸 변수(LAST_STATUS 등)가 부모로 전파되지 않으므로,
# 응답 상태/본문은 임시 파일에 적어 서브셸 경계를 넘긴다.
_STATUS_FILE="$(mktemp)"
_BODY_FILE="$(mktemp)"
trap 'rm -f "${_STATUS_FILE}" "${_BODY_FILE}"' EXIT

# 서버가 떠 있는지 미리 확인 (안 떠 있으면 친절히 안내하고 종료)
preflight() {
  if ! curl -sS --max-time 3 -o /dev/null "${BASE_URL}/api-docs-json"; then
    echo "error: 서버에 연결할 수 없습니다 (${BASE_URL})." >&2
    echo "  먼저 'make dev' 또는 'make dev-local'로 서버를 띄우세요." >&2
    exit 1
  fi
}

# 응답 JSON에서 점 표기 경로 값을 추출한다. 예: json id  /  json progress.percent
json() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);const v=process.argv[1].split(".").reduce((a,k)=>a&&a[k],o);process.stdout.write(String(v??""))})' "$1"
}

# 인증 API 호출. 사용법: api <TOKEN> <METHOD> <PATH> [JSON_BODY]
# 호출 후: 응답 본문이 stdout으로 나오고, HTTP 코드/본문은 임시 파일에 저장된다.
# 직후 assert_status / last_status / last_body 로 마지막 응답을 검사한다.
api() {
  local token="$1" method="$2" path="$3" data="${4:-}"
  local args=(-sS -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -X "${method}")
  if [[ -n "${data}" ]]; then
    args+=(-d "${data}")
  fi
  local out status body
  out="$(curl "${args[@]}" -w $'\n%{http_code}' "${BASE_URL}${path}")"
  status="${out##*$'\n'}"
  body="${out%$'\n'*}"
  printf '%s' "${status}" >"${_STATUS_FILE}"
  printf '%s' "${body}" >"${_BODY_FILE}"
  printf '%s' "${body}"
}

# 마지막 api 호출의 HTTP 코드 / 본문 (서브셸 경계를 넘어 읽힘)
last_status() { cat "${_STATUS_FILE}"; }
last_body() { cat "${_BODY_FILE}"; }

_pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf '  %s✓%s %s\n' "${C_GREEN}" "${C_RESET}" "$1"; }
_fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf '  %s✗ %s%s\n' "${C_RED}" "$1" "${C_RESET}"; }

# 마지막 응답의 HTTP 코드를 검사한다. 사용법: assert_status "설명" <기대코드>
assert_status() {
  local status; status="$(last_status)"
  if [[ "${status}" == "$2" ]]; then
    _pass "$1 (HTTP ${status})"
  else
    _fail "$1 — 기대 HTTP $2, 실제 ${status}"
    printf '      %sbody: %s%s\n' "${C_DIM}" "$(last_body)" "${C_RESET}"
  fi
}

# 두 값이 같은지 검사한다. 사용법: assert_eq "설명" <실제> <기대>
assert_eq() {
  if [[ "$2" == "$3" ]]; then
    _pass "$1 ($2)"
  else
    _fail "$1 — 기대 '$3', 실제 '$2'"
  fi
}

# 실제 값이 비어있지 않은지 검사한다. 사용법: assert_nonempty "설명" <값>
assert_nonempty() {
  if [[ -n "$2" ]]; then
    _pass "$1 ($2)"
  else
    _fail "$1 — 값이 비어있음"
  fi
}

# 단계 제목 출력
step() { printf '\n%s── %s%s\n' "${C_DIM}" "$1" "${C_RESET}"; }

# 통과/실패 요약. 실패가 하나라도 있으면 exit 1.
summary() {
  printf '\n'
  if [[ "${FAIL_COUNT}" -eq 0 ]]; then
    printf '%s결과: %d 통과 / 0 실패 — 시나리오 정상%s\n' "${C_GREEN}" "${PASS_COUNT}" "${C_RESET}"
  else
    printf '%s결과: %d 통과 / %d 실패%s\n' "${C_RED}" "${PASS_COUNT}" "${FAIL_COUNT}" "${C_RESET}"
    exit 1
  fi
}
