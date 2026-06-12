# 듀(Due) 유저 스토리 & API 시나리오 — GUI 없이 API로 검증하기

> **목적**: 프론트엔드 개발자가 화면을 만들기 전에, 각 유저 스토리에서 **어떤 API를
> 어떤 순서로** 호출해야 하는지 한눈에 보고, 그 순서대로 실제로 찔러 보며
> 구현이 동작하는지 GUI 없이 검증한다.
>
> 화면 기획(S2~S14)·API 계약의 단일 소스는 [`backend-implementation.md`](./backend-implementation.md).
> 이 문서는 그 계약을 **유저 여정 순서**로 재배열한 실행 가능한 시나리오 모음이다.
>
> **검증 스크립트**: 각 시나리오는 단언(assert)으로 동작을 확인하는 bash 스크립트로 구현돼 있다.
> ```bash
> pnpm scenarios:dev        # DB 초기화 후 전체 시나리오 순서대로 실행 (권장)
> pnpm scenario:onboarding  # 시나리오 1만
> pnpm scenario:collab      # 시나리오 2만
> ```
> 스크립트는 `scripts/dev-scenario-*.sh`, 공용 헬퍼는 `scripts/lib/dev-lib.sh`.

---

## 사전 준비

```bash
make dev          # 또는 make dev-local — 서버 + DB 기동
pnpm scenarios:dev
```

`scenarios:dev`가 내부에서 `dev:reset`(DB 초기화 + dev 유저 시드)을 먼저 돌린다.
개별 시나리오를 직접 돌릴 때는 `pnpm dev:reset`을 한 번 실행해 둔다.

인증은 OAuth(S2) 대신 **dev 토큰**으로 대체한다(`scripts/mint-dev-access-token.sh`).
프론트가 실제로 받는 access token과 동일하게 동작하므로 이후 흐름은 그대로 재현된다.

---

## 시나리오 1 — 신규 유저 온보딩 → 첫 프로젝트 생성 → 검토 → 편집

**유저 스토리**: "처음 가입한 사용자가 닉네임을 정하고, 결혼식 프로젝트 종류를 골라
정보를 입력하면 AI가 계획 초안을 만들어 주고, 검토 후 저장하면 홈에서 보인다. 이후 듀/항목을 직접 편집할 수 있다."

| 화면 | 단계 | 메서드 · 경로 | 확인 포인트 |
|---|---|---|---|
| S2 | 로그인 직후 내 정보 | `GET /auth/me` | 200, 내 user 반환 |
| S4 | 닉네임 설정 | `PATCH /users/me` `{nickname}` | 1~20자 trim 적용 |
| S3 | 종류 카탈로그 | `GET /project-types` | `WEDDING.available=true`, 나머지 🔒 |
| S5~S7 | 정보 입력 → AI 초안 | `POST /projects/suggest` `{type,style,planLevel,...}` | planLevel별 생성 깊이 (MANUAL=빈 계획) |
| S6/S9 | 편집한 계획 저장 | `POST /projects` (phases·tasks 포함) | 201, OWNER 멤버 자동 등록 |
| S9 | 계획 검토 | `GET /projects/:id` | progress 파생, members 포함 |
| S13 | 홈 목록 | `GET /projects?limit` | 새 프로젝트가 목록에 포함 |
| S14 | 듀 추가 | `POST /projects/:id/phases` | 201 |
| S14 | 항목 추가 | `POST /phases/:phaseId/tasks` | 201 |
| S14 | 항목 편집 | `PATCH /tasks/:taskId` | 200 |
| S14 | 듀 삭제 | `DELETE /phases/:phaseId` | 204, Task CASCADE |

> **AI 변형**: 위 스크립트는 키 없이 돌도록 `suggest`를 `planLevel=MANUAL`로 호출하고
> 계획은 직접 구성해 보낸다. 실제 AI 생성(OUTLINE/DETAILED)은 `.env`에 `OPENAI_API_KEY`가
> 필요하며 `pnpm suggest:dev`로 별도 검증한다.

실행: `pnpm scenario:onboarding`

---

## 시나리오 2 — 파트너 협업 → 담당 배정 → 홈 대시보드 → 할 일 완료 → 정리

**유저 스토리**: "프로젝트 주인이 파트너를 초대 코드로 연결하고, 할 일을 나/파트너/함께로
나눠 배정한다. 홈 대시보드에서 역할별 진행 상황과 임박한 일을 보고, 할 일을 완료하면 진행률이
오른다. 마지막에 계획을 다시 시작하거나 프로젝트를 삭제할 수 있다."

| 화면 | 단계 | 메서드 · 경로 | 확인 포인트 |
|---|---|---|---|
| — | (준비) user2 시드 + 프로젝트 생성 | `POST /projects` | Task 3개 시드 |
| S10 | 초대 코드 발급 | `POST /projects/:id/invites` | 8자리 code 반환 |
| S10 | 코드로 연결 (파트너) | `POST /invites/accept` `{code}` | `role=PARTNER` |
| S10 | 멤버 목록 | `GET /projects/:id/members` | OWNER+PARTNER = 2 |
| S13 | 파트너 시점 목록 | `GET /projects` (user2) | 공유 프로젝트가 보임 |
| S12 | 담당 배정 | `PATCH /tasks/:id/assign` `{assignee}` | OWNER/PARTNER/TOGETHER |
| S13 | 역할별 대시보드 | `GET /projects/:id/dashboard?groupBy=role&filter=task` | groups·upcoming 파생 |
| S13 | 할 일 완료 | `PATCH /tasks/:id/status` `{status:DONE}` | 진행률 0% → 33% 갱신 |
| S13 | 일정 보기 | `GET /projects/:id/dashboard?groupBy=due&filter=schedule` | dday·일정 정렬 |
| S14 | 다시 시작하기 | `POST /projects/:id/reset` | phases 0개, 멤버 유지 |
| S14 | 프로젝트 삭제 | `DELETE /projects/:id` | 204 (OWNER만) |

> 권한 모델은 멤버십 기반이다. 파트너(user2)도 배정·상태 변경 같은 항목 조작은 가능하지만,
> 삭제·초기화 같은 파괴적 작업은 OWNER만 가능하다(§3 권한 모델).

실행: `pnpm scenario:collab`

---

## 커버리지 — 화면 ↔ 시나리오 ↔ 기능 스크립트

| 화면 | 시나리오(여정 단위) | 기능 happy-path 스크립트 |
|---|---|---|
| S2 로그인 | 1 (`/auth/me`) | — (OAuth는 범위 밖) |
| S3 종류 선택 | 1 (`/project-types`) | — |
| S4 닉네임 | 1 (`PATCH /users/me`) | — |
| S5~S7 AI 생성 | 1 (suggest MANUAL) | `pnpm suggest:dev` (OUTLINE/DETAILED) |
| S9 계획 검토 | 1 (`GET /projects/:id`) | `pnpm dashboard:dev` |
| S10 협업 | 2 (invite/accept/members) | `pnpm invite:dev` |
| S12 배정 | 2 (`assign`) | `pnpm dashboard:dev` |
| S13 홈 대시보드 | 2 (dashboard·status) | `pnpm dashboard:dev` |
| S14 편집 | 1·2 (phase/task CRUD·reset·delete) | `pnpm crud:dev` |

- **시나리오 스크립트**: 여러 화면을 가로지르는 **유저 여정**을 순서대로 검증(이 문서).
- **기능 스크립트**: 한 기능 그룹의 happy-path를 좁고 깊게 검증(`scripts/README.md`).

두 층이 보완 관계다. 새 화면 흐름을 구현하기 전엔 시나리오로 전체를 한 번 돌려 보고,
특정 엔드포인트만 디버깅할 땐 해당 기능 스크립트를 쓴다.
