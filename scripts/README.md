# 개발 스크립트 사용 가이드

개발하면서 자주 필요한 작업들을 자동화한 스크립트 모음입니다.
모든 명령어는 **프로젝트 루트**에서 실행합니다.

> **전제**: DB가 실행 중이어야 합니다. (`make dev` 또는 `make dev-local` 상태)

---

## 어떤 상황에 뭘 쓰면 되나요?

### "DB를 깨끗하게 초기화하고 싶어요"

```bash
pnpm dev:reset
```

테이블의 모든 데이터를 지우고, 개발용 테스트 계정을 새로 만들어줍니다.
실행하면 아래 세 가지를 한 번에 해줍니다:

1. `users`, `projects`, `phases`, `tasks` 테이블 전체 비우기
2. 개발용 유저 생성 (이메일: `dev@local.test`)
3. 그 유저로 로그인된 상태의 토큰 출력

**언제 쓰나요?**
- 테스트하다가 데이터가 꼬였을 때
- 처음부터 다시 깨끗하게 시작하고 싶을 때
- 다른 팀원과 동일한 초기 상태로 맞추고 싶을 때

---

### "API 호출할 때 쓸 로그인 토큰이 필요해요"

**Swagger 사용 (추천)**: `http://localhost:3000/api-docs` 접속 → 상단 **Dev Login** 버튼 클릭

**터미널 / Postman 사용**:

```bash
pnpm token:dev
```

개발용 유저(`dev@local.test`)로 로그인한 것과 동일한 효과의 토큰을 출력합니다.
`Authorization: Bearer <토큰>` 헤더에 넣으면 됩니다.

> **참고**: `pnpm dev:reset`을 실행하면 토큰도 같이 출력되므로,
> 초기화 직후라면 따로 실행할 필요 없습니다.

---

### "로그인이 잘 되는지 빠르게 확인하고 싶어요"

```bash
pnpm me:dev
```

토큰을 자동으로 발급받고, `/auth/me` API를 바로 호출해서 응답을 출력합니다.
서버가 정상적으로 뜨고 인증이 동작하는지 한 번에 확인하는 용도입니다.

**언제 쓰나요?**
- 서버를 새로 켰을 때 정상 동작 여부를 빠르게 확인하고 싶을 때
- 인증 관련 코드를 수정한 뒤 기본 동작을 검증할 때

---

### "API 명세와 테스트 데이터가 필요해요" (프론트엔드 개발자 필독)

별도 스크립트 없이 Swagger UI에서 직접 합니다:

1. 서버 실행: `make dev`
2. `pnpm dev:reset` — DB 초기화 + 개발 유저 생성
3. `http://localhost:3000/api-docs` 접속
4. 상단 **Dev Login** 버튼 클릭 → 자동 로그인
5. 원하는 엔드포인트에서 **Try it out** → **Execute**

OpenAPI JSON 스펙은 `http://localhost:3000/api-docs-json`에서 받을 수 있습니다 (Postman import 등에 활용).

---

### "Phase/Task 편집(S14) 엔드포인트가 잘 동작하는지 확인하고 싶어요"

```bash
pnpm crud:dev
```

dev 토큰을 발급하고, 베이스 프로젝트를 하나 생성한 뒤 다음 신규 엔드포인트들을
순서대로 호출해 happy-path를 재현합니다:

- PH1 `POST /projects/:id/phases` — Due 추가
- PH2 `PATCH /phases/:phaseId` — 듀 수정
- T1 `POST /phases/:phaseId/tasks` — 항목 추가
- T2 `PATCH /tasks/:taskId` — 항목 편집
- T4 `POST /tasks/bulk-delete` — 선택 항목 일괄 삭제
- PH3 `DELETE /phases/:phaseId` — 듀 삭제

**언제 쓰나요?**
- Phase/Task CRUD 코드를 수정한 뒤 전체 흐름이 깨지지 않았는지 한 번에 확인할 때
- S14 편집 화면이 의존하는 API가 모두 떠 있는지 점검할 때

> **전제**: 서버가 떠 있어야 합니다(`make dev` 또는 `make dev-local`). 토큰만 있으면 되고
> 별도 시드 데이터는 스크립트가 직접 프로젝트를 만들어 충당합니다.

---

### "협업(초대/멤버) 엔드포인트가 잘 동작하는지 확인하고 싶어요"

```bash
pnpm dev:reset   # 먼저 실행해서 user1(dev@local.test) 생성
pnpm invite:dev
```

dev 토큰 2개를 발급하고, user1이 프로젝트를 만든 뒤 다음 신규 엔드포인트들을
순서대로 호출해 happy-path를 재현합니다:

- I1 `POST /projects/:id/invites` — 초대 코드 발급
- I2 `POST /invites/accept` — user2가 코드 수락 (PARTNER 등록)
- I3 `GET /projects/:id/members` — 멤버 목록 조회 (OWNER+PARTNER = 2)
- I4 `DELETE /projects/:id/members/:userId` — user2 제거
- I3 재조회 — OWNER만 남았는지 확인

**언제 쓰나요?**
- S10 파트너 초대/코드 연결 화면이 의존하는 API를 한 번에 점검할 때
- 협업 코드를 수정한 뒤 전체 흐름이 깨지지 않았는지 확인할 때

> **전제**: `pnpm dev:reset` 완료 후 서버가 떠 있어야 합니다. user2는 스크립트가 직접 DB에 삽입합니다.

---

### "AI suggest 엔드포인트(P1)와 프로젝트 생성 확장(P2)을 확인하고 싶어요"

```bash
pnpm dev:reset   # 먼저 실행
pnpm suggest:dev
```

dev 토큰을 발급하고, 다음 엔드포인트들을 순서대로 호출해 happy-path를 재현합니다:

- P1 `POST /projects/suggest` `planLevel=MANUAL` — AI 미호출, 빈 계획 즉시 반환
- P1 `POST /projects/suggest` `planLevel=OUTLINE` — Phase만 생성, tasks=[]
- P1 `POST /projects/suggest` `planLevel=DETAILED` — Phase + Task 상세 생성
- P2 `POST /projects` — type/style/planLevel/color/memo/assignee 포함 전체 생성
- P5 `PATCH /projects/:id` — color/style 수정

**언제 쓰나요?**
- S5~S7 AI 생성 흐름(type·style·planLevel 입력 → suggest → 계획 확인)을 한 번에 점검할 때
- OpenAI 프롬프트나 planLevel 분기 로직을 수정한 뒤 검증할 때

> **전제**: OUTLINE·DETAILED 테스트는 `.env`에 `OPENAI_API_KEY`가 설정되어 있어야 합니다. MANUAL은 API 키 없이도 동작합니다.

---

### "프로젝트 상세·대시보드·삭제·초기화 엔드포인트를 확인하고 싶어요"

```bash
pnpm dev:reset     # 먼저 실행
pnpm dashboard:dev
```

dev 토큰을 발급하고, 여러 Phase/Task가 있는 프로젝트를 만든 뒤 다음 엔드포인트들을 호출합니다:

- P4 `GET /projects/:id` — 상세(phases·tasks·progress·members)
- P6 `GET /projects/:id/dashboard?groupBy=role&filter=task` — 역할별 그룹 대시보드
- P6 `GET /projects/:id/dashboard?groupBy=due&filter=schedule` — Phase별·일정 필터 대시보드
- P7 `DELETE /projects/:id` — 프로젝트 삭제 (204)
- P8 `POST /projects/:id/reset` — Phase/Task 초기화(프로젝트·멤버 유지)

**언제 쓰나요?**
- S9(계획 검토), S13(홈 대시보드) 화면이 의존하는 API를 한 번에 점검할 때
- 대시보드 파생 계산(진행률·upcoming·그룹) 코드를 수정한 뒤 검증할 때

---

## 전형적인 개발 시작 순서

```bash
# 1. 서버 실행 (둘 중 하나)
make dev        # Docker 전체 (프론트 개발자용)
make dev-local  # DB만 Docker + 로컬 hot reload (백엔드 개발자용)

# 2. DB 초기화 + 테스트 유저 생성
pnpm dev:reset

# 3. Swagger에서 API 테스트
# http://localhost:3000/api-docs → Dev Login 버튼 클릭
```
