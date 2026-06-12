# 듀(Due) 백엔드 구현 명세 — 기획 충족용 단일 소스

> **이 문서의 목적**: LLM/개발자가 **이 파일 하나만** 읽고 NestJS 백엔드 코드를 작성해
> 온보딩~협업 기획을 충족하도록 한다. 화면 기획서를 따로 보지 않아도 되게 자급자족적으로 작성했다.
> 기획 화면 코드(S1~S14)는 참조용 앵커이며, 구현에 필요한 모든 계약은 본문에 포함되어 있다.
>
> **스택**: NestJS + TypeORM + PostgreSQL. 인증 JWT(access/refresh). API 문서 Swagger.
> **현재 상태 한 줄**: "혼자서 프로젝트 생성/계획"은 동작. **§8 1·3·4단계(스키마 컬럼, 카탈로그, Phase/Task CRUD) 완료**. **협업·배정·대시보드·일부 입력**이 미구현 → 이 문서가 그 격차를 메운다.

---

## 0. 도메인 사전 (코드 명명 고정)

| 기획 용어 | 코드 명명 | 설명 |
|---|---|---|
| 프로젝트 | `Project` | 사용자가 준비하는 큰 목표 (결혼식 등) |
| 듀 / 페이즈 | **`Phase`** | 프로젝트의 단계. "듀 1: 큰 결정" 등. (앱 이름 Due와 동음이의 — 코드는 Phase로 통일) |
| 항목 / 할 일 | **`Task`** | Phase에 속한 개별 태스크 |
| 담당 | `Task.assignee` | 나(OWNER)/파트너(PARTNER)/함께(TOGETHER)/미배정(UNASSIGNED) |
| 파트너 초대·멤버 | `ProjectMember`, `ProjectInvite` | 협업 도메인 (신규) |

계층: **Project → Phase(듀) → Task(항목)**. 한 Project에 여러 멤버(나 + 파트너).

---

## 1. 현재 구현 상태 (변경 출발점)

### 1.1 현재 엔티티 (실제 코드 기준)
> **[done §8-1]** Project/Phase/Task 컬럼 추가 완료. `synchronize:true`라 마이그레이션 파일 없이 재시작 시 반영됨.
```
Project(projects):  id(int), type(enum ProjectType, nullable)*, projectName(varchar),
                    style(enum PreparationStyle, nullable)*, planLevel(enum PlanLevel, nullable),
                    scheduleMode(enum ScheduleMode, default FIXED), startDate(date, nullable),
                    dueDate(date), budget(int, nullable), color(varchar7, nullable),
                    personality(jsonb {preparationStyle?(deprecated), additionalConsiderations}),
                    owner(ManyToOne User, CASCADE), phases(OneToMany), createdAt, updatedAt
Phase(phases):      id(int), name, expectedStartDate(date), expectedEndDate(date), order(int),
                    memo(text, nullable), color(varchar7, nullable),
                    project(ManyToOne CASCADE), tasks(OneToMany), createdAt, updatedAt
Task(tasks):        id(int), name, status(enum TaskStatus{TODO,IN_PROGRESS,DONE}), order(int),
                    assignee(enum TaskAssignee, default UNASSIGNED), dueDate(date, nullable),
                    phase(ManyToOne CASCADE), createdAt, updatedAt
User(users):        id(uuid), authProvider('kakao'|'google'|'apple'), oauthSub, nickname?,
                    email?, profileImageUrl?, refreshToken?, createdAt, updatedAt
```
> `*` **type/style은 잠정 nullable** — §2.1 노트 참조. 클라가 값을 전송하는 §8-8(suggest/생성 확장)에서 NOT NULL로 조인다.

### 1.2 기존 엔드포인트 (이미 존재 — 재사용/수정)
```
POST   /auth/social {provider,idToken}    POST /auth/refresh   POST /auth/logout
POST   /auth/dev-login (dev)              GET  /auth/me
GET    /project-types                     # [done §8-3] S3 카탈로그
GET    /projects?cursor&limit             POST /projects/suggest   POST /projects   PATCH /projects/:id
POST   /projects/:id/phases               # [done §8-4] PH1
PATCH  /phases/:phaseId                   # [done §8-4] PH2    DELETE /phases/:phaseId   # [done §8-4] PH3
PATCH  /phases/:phaseId/order
POST   /phases/:phaseId/tasks             # [done §8-4] T1
PATCH  /tasks/:taskId                     # [done §8-4] T2    DELETE /tasks/:taskId     # [done §8-4] T3
POST   /tasks/bulk-delete                 # [done §8-4] T4
PATCH  /tasks/:taskId/status              PATCH /tasks/:taskId/order
```

---

## 2. 목표 데이터 모델 (구현 대상)

> 변경 표기: **[+]** 신규 컬럼/엔티티, **[~]** 기존 변경, **[=]** 유지.

### 2.1 Project (컬럼 추가)
```ts
// src/projects/entities/projects.entity.ts
export enum ProjectType { WEDDING='WEDDING', HOUSE='HOUSE', HONEYMOON='HONEYMOON',
                          CHILD='CHILD', EXERCISE='EXERCISE', CUSTOM='CUSTOM' }
export enum PreparationStyle { ALL_IN='ALL_IN', SAVE_MONEY='SAVE_MONEY', RECOMMEND='RECOMMEND' }
export enum PlanLevel { DETAILED='DETAILED', OUTLINE='OUTLINE', MANUAL='MANUAL' }
export enum ScheduleMode { FIXED='FIXED', FLEXIBLE='FLEXIBLE' }
```
| 컬럼 | 타입 | 변경 | 비고 (기획 근거) |
|---|---|---|---|
| `type` | enum ProjectType, nullable* | [+] | S3 프로젝트 종류. CUSTOM=나만의 프로젝트 |
| `projectName` | varchar | [=] | 표시 이름(자유). type=CUSTOM이면 사용자 입력 |
| `style` | enum PreparationStyle, nullable* | [+] | S5 준비 스타일(🥊/💵/🧐). personality.preparationStyle는 deprecated |
| `planLevel` | enum PlanLevel, nullable | [+] | S6 생성 깊이(📝/🗒️/✍🏻) |
| `scheduleMode` | enum ScheduleMode, default FIXED | [+] | S5 "유연한 일정" 지원 |
| `startDate` | date, **nullable** | [~] | FLEXIBLE일 때 null 허용 |
| `dueDate` | date | [=] | 목표일. D-day는 파생(미저장) |
| `budget` | int, **nullable** | [~] | **기획 S5에 예산 입력 UI 없음 → 필수 해제** |
| `color` | varchar(7), nullable | [+] | S13/S14 대표 색상 (예 `#FF8A65`) |
| `personality` | jsonb | [=] | additionalConsiderations(추가 고려사항 자유 텍스트) 보존 |
| `owner` | ManyToOne User | [=] | 생성자. 멤버십과 병행(§2.5) |

> `*` **type/style 잠정 nullable (구현 결정)**: 개념상 필수 필드지만, §8-1(스키마)만 먼저 들어간 시점에는 `POST /projects`가 아직 이 값을 보내지 않는다. NOT NULL로 두면 기존 생성 엔드포인트가 깨지므로 **잠정 nullable**로 구현했다. 클라가 값을 전송하기 시작하는 **§8-8(suggest/생성 확장)**에서 NOT NULL로 조이는 것이 목표다.

### 2.2 Phase (컬럼 추가)
| 컬럼 | 타입 | 변경 | 비고 |
|---|---|---|---|
| `memo` | text, nullable | [+] | S14 듀 수정 모달 "메모를 입력하세요" |
| `color` | varchar(7), nullable | [+] | S14 "Phase 추가 시 색상" |
| 나머지 | | [=] | name, expectedStartDate/EndDate, order 유지 |

### 2.3 Task (컬럼 추가)
```ts
export enum TaskAssignee { OWNER='OWNER', PARTNER='PARTNER', TOGETHER='TOGETHER', UNASSIGNED='UNASSIGNED' }
```
| 컬럼 | 타입 | 변경 | 비고 |
|---|---|---|---|
| `assignee` | enum TaskAssignee, default UNASSIGNED | [+] | S12 배정 칩(나/파트너/함께/미배정) |
| `dueDate` | date, nullable | [+] | S13 "5월 12일까지 …" 항목별 마감 |
| 나머지 | | [=] | name, status, order 유지 |

> **assignee 설계 노트**: MVP는 역할 enum으로 충분(칩이 정확히 4종). 추후 멤버 다수화 시 `assigneeUserId(uuid, nullable)` 추가로 확장. 지금은 role enum만 구현.

### 2.4 User (스키마 무변경, 동작 추가)
- `authProvider`에 **`'naver'` 추가** → `'kakao'|'google'|'apple'|'naver'` (S2).
- `nickname` 수정 동작 추가(§4.1). avatar 생성/업로드는 백엔드 범위 밖 → `profileImageUrl`만 저장.

### 2.5 신규 협업 엔티티 (S10/S12 핵심)
```ts
// src/members/entities/project-member.entity.ts
export enum ProjectRole { OWNER='OWNER', PARTNER='PARTNER' }
@Entity('project_members') @Unique(['project','user'])
ProjectMember: id(int), project(ManyToOne Project CASCADE), user(ManyToOne User CASCADE),
               role(enum ProjectRole), joinedAt(CreateDateColumn)

// src/invites/entities/project-invite.entity.ts
export enum InviteStatus { PENDING='PENDING', ACCEPTED='ACCEPTED', EXPIRED='EXPIRED' }
@Entity('project_invites')
ProjectInvite: id(int), project(ManyToOne CASCADE), inviter(ManyToOne User),
               code(varchar, unique, 8자리 영숫자), message(text), status(enum InviteStatus default PENDING),
               expiresAt(timestamptz), createdAt, updatedAt
```
**규칙**: Project 생성 시 owner를 `ProjectMember(role=OWNER)`로 자동 등록. 파트너는 초대 수락 시 `role=PARTNER`로 등록(프로젝트당 파트너 1명 제한).

---

## 3. 권한 모델 (전 라우트 공통)

- 현재 코드는 `project.owner.id === userId`로 검증 → **멤버십 기반으로 교체**한다.
- **조회/항목 조작**: 해당 Project의 `ProjectMember`이면 허용 (OWNER 또는 PARTNER).
- **파괴적 작업**(프로젝트 삭제·초기화·멤버 제거): **OWNER만**.
- 비멤버 접근 시 `ForbiddenException('Access denied')`, 없는 리소스는 `NotFoundException`.
- 헬퍼 `assertMember(projectId, userId, requireOwner=false)`를 공통 서비스(또는 ProjectsService)에 두고 재사용.

---

## 4. 구현해야 할 엔드포인트 (완전한 계약)

> 모든 보호 라우트: `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth('access-token')`.
> `@CurrentUser() user: User`로 인증 사용자 주입(기존 데코레이터 사용).
> **모든 DTO 필드에 `@ApiProperty()`/`@ApiPropertyOptional()` 필수** (Swagger 규칙).

### 4.1 User / Auth
| # | 메서드 · 경로 | Body / Query | 응답 | 화면 |
|---|---|---|---|---|
| U1 | `PATCH /users/me` | `{ nickname?: string, profileImageUrl?: string }` | 갱신된 `{id,nickname,email,profileImageUrl}` | S4, S11 |
| U2 | `POST /auth/social` | provider enum에 `'naver'` 추가 | (기존) | S2 |

- U1: nickname은 1~20자 trim. UsersService에 `updateProfile(userId, dto)` 추가.

### 4.2 Project 카탈로그 (S3) — **[done §8-3]**
| # | 메서드 · 경로 | 응답 |
|---|---|---|
| C1 | `GET /project-types` ✅ | `[{ type, label, available, defaultColor }]` |

- 정적 카탈로그(상수 배열). MVP: `WEDDING`·`CUSTOM` `available:true`, 나머지 4종 `false`(🔒).
- 예: `{ type:'WEDDING', label:'결혼식', available:true, defaultColor:'#FF8A65' }`.
- 별도 엔티티 불필요. 구현 위치:
  - 카탈로그 상수 `src/projects/project-type.catalog.ts`
  - 응답 DTO `src/projects/dto/project-type-response.dto.ts` (`@ApiProperty`)
  - 컨트롤러 `src/projects/project-types.controller.ts` (`@Controller('project-types')`, JwtAuthGuard 보호) — `ProjectsModule`에 등록.
- dev 스크립트 불필요: 인증 토큰만 있으면 되고 시드 데이터가 없어 `mint-dev-access-token.sh`+Swagger로 충분.

### 4.3 Project 생성/조회/수정 (S5~S9, S13, S14)
| # | 메서드 · 경로 | Body / Query | 응답 | 화면 |
|---|---|---|---|---|
| P1 | `POST /projects/suggest` *(확장)* | `{ type, projectName?, startDate?, dueDate, scheduleMode?, style, planLevel?, additionalConsiderations? }` | 전체 초안(phases+tasks 포함, 미저장) | S5→S7 |
| P2 | `POST /projects` *(확장)* | 아래 §4.3.1 | 저장된 Project(phases·tasks·members 포함) | S6/S9 |
| P3 | `GET /projects` *(유지)* | cursor·limit | `{data,nextCursor,hasMore}` | S13 목록 |
| P4 | `GET /projects/:id` *(신규)* | — | Project 상세 + progress + members | S9/S13 |
| P5 | `PATCH /projects/:id` *(확장)* | `{ projectName?, startDate?, dueDate?, budget?, color?, style?, scheduleMode?, personality? }` | 갱신본 | S14 |
| P6 | `GET /projects/:id/dashboard` *(신규)* | `?groupBy=role\|due&filter=task\|schedule` | §4.3.2 | S13 |
| P7 | `DELETE /projects/:id` *(신규)* | — | 204 | S14 삭제 |
| P8 | `POST /projects/:id/reset` *(신규)* | — | 비워진 Project | S14 "다시 시작하기" |

**P1 변경 핵심**: 현재 suggest는 `dueDate`만 받아 **AI가 종류를 모른다**. `type`(+CUSTOM이면 projectName)·`style`·`planLevel`을 입력에 추가하고, AI provider 인터페이스 `SuggestProjectInput`도 동일 필드로 확장한다(§6).

**P8 reset**: 해당 프로젝트의 모든 Phase/Task 삭제(CASCADE 활용), 멤버/초대는 정책 결정 필요 — MVP는 **Phase/Task만 초기화**하고 프로젝트·멤버는 유지.

#### 4.3.1 P2 `POST /projects` 요청 스키마
```jsonc
{
  "type": "WEDDING",                 // ProjectType
  "projectName": "결혼식",
  "startDate": "2026-01-11",         // scheduleMode=FLEXIBLE이면 생략 가능
  "dueDate": "2026-12-31",
  "scheduleMode": "FIXED",           // 기본 FIXED
  "budget": 50000000,                // 선택
  "color": "#FF8A65",                // 선택
  "style": "ALL_IN",                 // PreparationStyle
  "planLevel": "DETAILED",           // 선택
  "personality": { "additionalConsiderations": "예물·예단 생략, DVD 희망" },
  "phases": [                        // 듀 배열(클라가 suggest 결과를 편집해 전송)
    { "name":"큰 결정", "expectedStartDate":"2026-01-11", "expectedEndDate":"2026-03-01",
      "order":0, "memo":null, "color":"#FFB74D",
      "tasks":[ {"name":"날짜 확정","status":"TODO","order":0,"assignee":"OWNER","dueDate":null} ] }
  ]
}
```
- 검증: `phases` 최소 1개, phase/task `order` 중복 금지(기존 `validateDuplicateOrders` 패턴 재사용), 날짜 `start ≤ end`(기존 `validatePhaseDates`), `scheduleMode=FIXED`면 `startDate` 필수.
- 트랜잭션 일괄 저장(기존 `dataSource.transaction` + `PhasesService.createManyInTransaction` 흐름 유지). 저장 후 owner를 `ProjectMember(OWNER)`로 생성.

#### 4.3.2 P6 dashboard 응답 스키마 (S13 진행 상황 + 빠르게 해야 할 일 + 보기 옵션)
```jsonc
{
  "project": { "id":1, "projectName":"결혼식", "dueDate":"2026-12-31",
               "dday":324, "color":"#FF8A65" },
  "progress": { "done":16, "inProgress":4, "notStarted":4, "total":24, "percent":24 },
  "upcoming": [   // "빠르게 해야 할 일": dueDate 임박 + 미완료 Task 상위 N개
    { "taskId":10, "name":"드레스샵 예약", "assignee":"OWNER", "dueDate":"2026-05-12" }
  ],
  "groups": [     // groupBy=role → 멤버/함께/미배정별, groupBy=due → Phase별
    { "key":"OWNER", "label":"나 할 일", "count":6, "done":4,
      "tasks":[ /* filter=task면 Task[], filter=schedule면 일정 포함 정렬 */ ] }
  ]
}
```
- `dday` = `ceil((dueDate - today)/일)`, 파생 계산. `percent` = `round(done/total*100)`(total 0이면 0).
- `groupBy=role`: assignee(OWNER→닉네임 라벨, PARTNER, TOGETHER, UNASSIGNED)로 그룹. `groupBy=due`: Phase로 그룹.
- `filter=task`: 모든 Task. `filter=schedule`: dueDate 있는 Task만 날짜순.

### 4.4 Phase(듀) CRUD (S14) — **[done §8-4]**
| # | 메서드 · 경로 | Body | 화면 |
|---|---|---|---|
| PH1 ✅ | `POST /projects/:id/phases` | `{ name, expectedStartDate, expectedEndDate, order, memo?, color? }` | "Due 추가하기" |
| PH2 ✅ | `PATCH /phases/:phaseId` | `{ name?, expectedStartDate?, expectedEndDate?, order?, memo?, color? }` | 듀 수정 모달 |
| PH3 ✅ | `DELETE /phases/:phaseId` (204) | — | 듀 삭제 |
| PH4 | `PATCH /phases/:phaseId/order` *(기존 유지)* | `{ order }` | 정렬 |

- PH2는 기존 PH4를 흡수 가능하나, 하위호환 위해 둘 다 유지.
- **구현 결정**: 권한은 §3 멤버십 모델이 아직 미구현(§8-6)이라 **현 시점은 owner 기반**(`phase→project→owner.id===userId`)으로 검증. §8-6에서 `assertMember`로 교체 예정.
- PH3은 `@HttpCode(204)`, Task는 FK `ON DELETE CASCADE`로 함께 삭제.
- order 중복은 같은 프로젝트 내에서 거부(`BadRequestException`). 날짜 역전은 기존 `validatePhaseDates` 재사용.
- 응답은 관계 없이 재조회해 `project.owner`(refreshToken 포함) 노출을 막음. 구현: `src/phases/{phases.service,phases.controller}.ts`, `dto/create-phase-request.dto.ts`, `dto/update-phase.dto.ts`. PH1 라우트는 `projects/:id` 프리픽스라 `ProjectsController`에 둠.

### 4.5 Task(항목) CRUD + 배정 (S12, S14) — **CRUD [done §8-4], 배정(T5) §8-5**
| # | 메서드 · 경로 | Body | 화면 |
|---|---|---|---|
| T1 ✅ | `POST /phases/:phaseId/tasks` | `{ name, status?, order, assignee?, dueDate? }` | "새로운 항목 추가하기" |
| T2 ✅ | `PATCH /tasks/:taskId` | `{ name?, dueDate?, order? }` | 항목 편집 |
| T3 ✅ | `DELETE /tasks/:taskId` (204) | — | 항목 삭제 |
| T4 ✅ | `POST /tasks/bulk-delete` (204) | `{ ids: number[] }` | "선택 항목 모두 삭제하기" |
| T5 | `PATCH /tasks/:taskId/assign` | `{ assignee: TaskAssignee }` | S12 배정 (§8-5) |
| T6 | `PATCH /tasks/:taskId/status` *(기존 유지)* | `{ status }` | 상태 |
| T7 | `PATCH /tasks/:taskId/order` *(기존 유지)* | `{ order }` | 정렬 |

- T4: `ids` dedupe 후 전부 조회해 (a) 모두 존재 (b) 모두 같은 프로젝트 (c) 모두 owner 소유인지 검증 후 일괄 삭제. 위반 시 각각 404/`BadRequest`/`Forbidden`.
- 권한은 PH와 동일하게 **현 시점 owner 기반**(`task→phase→project→owner`), §8-6에서 멤버십으로 교체.
- order 중복은 같은 Phase 내에서 거부. T1의 `status`·`assignee` 생략 시 각각 `TODO`/`UNASSIGNED` 기본값.
- 응답은 관계 없이 재조회(refreshToken 노출 방지). 구현: `src/tasks/{tasks.service,tasks.controller}.ts`, `dto/create-task-request.dto.ts`, `dto/update-task.dto.ts`, `dto/bulk-delete-tasks.dto.ts`. T1 라우트는 `phases/:phaseId` 프리픽스라 `PhasesController`에 둠.
- dev 스크립트: `scripts/dev-phase-task-crud.sh`(`pnpm crud:dev`) — 프로젝트 생성→PH1·PH2·T1·T2·T4·PH3 happy-path 재현.

### 4.6 협업: 초대 & 멤버 (S10)
| # | 메서드 · 경로 | Body | 응답 | 화면 |
|---|---|---|---|---|
| I1 | `POST /projects/:id/invites` | `{ message? }` | `{ code, message, expiresAt }` | "초대하기" |
| I2 | `POST /invites/accept` | `{ code }` | 가입된 `{ projectId, role:'PARTNER' }` | "상대방 코드로 연결하기" |
| I3 | `GET /projects/:id/members` | — | `[{ userId, nickname, role }]` | 역할 표시 |
| I4 | `DELETE /projects/:id/members/:userId` | — | 204 | 멤버 제거(OWNER만) |

- I1: 8자리 영숫자 `code` 생성(충돌 시 재시도), `expiresAt = now + 7d`, status=PENDING. 기본 message `"우리 {projectName} 계획 세워봤어. 같이 해보자! 🎉"`.
- I2: 유효(PENDING·미만료) code → ProjectMember(PARTNER) 생성, invite status=ACCEPTED. 본인 프로젝트/이미 멤버/파트너 정원 초과 시 적절한 4xx.

---

## 5. 비즈니스 규칙 요약
1. **건너뛰기 허용**: 초대(S10)·프로필(S11)·배정(S12)은 선택 — 스킵해도 프로젝트는 정상 동작. 배정 안 한 Task는 `UNASSIGNED`.
2. **MVP 활성 종류**: `WEDDING`만. 그 외 종류로 생성 시도는 허용하되(데이터 모델 준비됨), 카탈로그 `available:false`로 클라가 잠금 표시.
3. **D-day/진행률은 저장하지 않고 응답 시 파생 계산**.
4. **유연한 일정**: `scheduleMode=FLEXIBLE`이면 `startDate` null 허용, dueDate만으로 운영.
5. **정렬(order)**: 동일 부모 내 중복 금지. 클라가 명시 전송(서버 자동 재배열 안 함, 기존 패턴 유지).

---

## 6. AI Provider 확장 (S5~S7)
- 인터페이스: `src/ai/interfaces/project-suggest-provider.interface.ts`
  - `SuggestProjectInput`에 `type`, `projectName?`, `startDate?`, `scheduleMode?`, `style`, `planLevel?` 추가.
  - `planLevel`에 따라 생성 깊이 조절: `DETAILED`=Phase+Task 상세, `OUTLINE`=Phase만(빈 tasks 허용 — 단 `POST /projects` 검증의 ArrayMinSize는 완화 필요), `MANUAL`=빈 계획.
- 구현체: `src/ai/providers/openai.provider.ts` (DI 토큰 `PROJECT_SUGGEST_PROVIDER`). 프롬프트에 종류·스타일·고려사항·일정을 주입.
- 결혼식 기본 시드(참고용, AI 실패 시 fallback 가능):
  - 듀1 큰 결정 → 날짜 확정·예산 범위 확정·결혼식 스타일 결정·웨딩홀 투어&계약·스드메 방향 잡기·다이어트&컨디션 관리
  - 듀2 세부 기획&예약 → 스튜디오/드레스샵/메이크업샵/본식 스냅 예약, 본식 DVD 예약, 촬영 드레스 선택, 촬영 진행
  - 듀3 실행&본식 준비 → 1·2부 드레스 선택, 청첩장 제작, 하객 리스트 확정, 식순 구성, 예물·예단, 한복·예복, 축사/축가 확인, 축의대 부탁, 포토테이블/부스
  - 듀4 최종 점검&본식 → 최종 인원 확정, 좌석 배치, 리허설/동선, 식순 최종 점검, 준비물, 당일 진행

---

## 7. 반드시 지킬 레포 관례 (CLAUDE.md + 기존 코드 패턴)

### 7.1 코드 패턴
- **에러 응답 포맷 고정** (전역 `HttpExceptionFilter`): `{ statusCode, message, error, timestamp, path }`. 컨트롤러/서비스에서는 Nest 표준 예외(`NotFoundException`, `ForbiddenException`, `BadRequestException`)만 throw.
- **커서 페이지네이션**: 목록 응답은 `{ data, nextCursor, hasMore }` (`CursorPaginatedDto`), 쿼리는 `CursorPaginationQueryDto`(cursor, limit≤100), `encodeCursor/decodeCursor` 유틸 사용.
- **모듈 구조**: 기능별 `entities/`, `dto/`, `*.controller.ts`, `*.service.ts`, `*.module.ts`. 신규 도메인은 `src/members`, `src/invites` 모듈 추가 후 `AppModule`에 등록.
- **트랜잭션**: 다중 엔티티 저장은 `dataSource.transaction`, 하위 서비스는 `...InTransaction(manager, ...)` 시그니처(기존 PhasesService/TasksService 패턴) 유지.
- **검증**: class-validator 데코레이터 + `ValidateNested`/`Type`. order 중복·날짜 역전 검증 재사용.
- **enum**: TypeORM `@Column({ type:'enum', enum: X, default: ... })`, Postgres enum 타입 사용.

### 7.2 Swagger (필수)
- 추가하는 **모든 DTO 필드에 `@ApiProperty()`/`@ApiPropertyOptional()`**. 없으면 스키마 누락.
- 컨트롤러에 `@ApiTags`, 보호 라우트에 `@ApiBearerAuth('access-token')`. 문서: `http://localhost:3000/api-docs`.

### 7.3 패키지 매니저
- **`pnpm`만 사용**. `npm`/`yarn` 금지.

### 7.4 개발 스크립트 (신규 엔드포인트 생길 때마다 판단)
새 엔드포인트가 **인증 토큰 + 특정 데이터가 있어야 수동 테스트 가능**하면 스크립트를 만든다:
1. `scripts/dev-<기능명>.sh` 생성, 상단에 `set -euo pipefail`.
2. `scripts/README.md`에 "어떤 상황에 쓰는지" 설명 추가.
3. `package.json` `scripts`에 `pnpm` 단축 명령 추가.
- 본 구현에서 권장 스크립트 예시:
  - `dev-invite-flow.sh` — 프로젝트 생성→초대 코드 발급→두 번째 유저로 수락(I1/I2 검증)
  - `dev-assign-tasks.sh` — 시드 프로젝트의 Task에 assignee 배정 후 dashboard 호출(T5/P6 검증)
  - `dev-seed-wedding.sh` — 결혼식 기본 듀/항목 시드 생성

### 7.5 README 싱크
- `package.json` 사용자용 pnpm 명령 추가 → `README.md` "주요 명령어"에 반영.
- `.env.example`에 사용자 설정 환경변수 추가 → `README.md` "환경 변수" 테이블에 반영.
- 검증: `pnpm readme:check` (실패하면 누락 있음).
- 예외: build/test/lint 등 Nest 기본, 기본값 있는 변수, `DB_*`/`KAKAO_*` 그룹 와일드카드.

---

## 8. 권장 구현 순서 (독립적·점진적)

> 각 단계는 마이그레이션 → 엔티티 → DTO → 서비스 → 컨트롤러 → Swagger → (필요 시)dev 스크립트 → README 싱크 순.

1. ~~**스키마/마이그레이션**: Project/Phase/Task 컬럼 추가, enum 정의, budget/startDate nullable화.~~ ✅ **완료** (`synchronize:true`로 마이그레이션 파일 없음. type/style은 잠정 nullable — §2.1 노트).
2. **User/Auth 보강**: U1 `PATCH /users/me`, naver provider 추가.
3. ~~**카탈로그**: C1 `GET /project-types`.~~ ✅ **완료** (§4.2 참조).
4. ~~**Phase/Task CRUD**: PH1~PH3, T1~T4 (편집 화면 S14).~~ ✅ **완료** (§4.4·§4.5 참조. 권한은 잠정 owner 기반, §8-6에서 멤버십 교체. `pnpm crud:dev`로 happy-path 재현).
5. **배정**: T5 `assign` + Task.assignee. (S12)
6. **협업**: ProjectMember/ProjectInvite 엔티티, I1~I4, **권한 모델을 멤버십 기반으로 교체**(§3). owner→OWNER 멤버 마이그레이션.
7. **조회/대시보드**: P4 `GET /projects/:id`, P6 dashboard(progress·upcoming·groups), P7 delete, P8 reset.
8. **AI 확장**: P1 suggest 입력 확장 + provider 인터페이스/프롬프트(§6).

각 단계 완료 기준 = 해당 화면(S#)의 동작에 필요한 API가 Swagger에 노출되고, dev 스크립트로 happy-path가 재현되며, `pnpm readme:check` 통과.

---

## 9. 완료 체크리스트 (화면 ↔ 구현 매핑)
- [ ] S2 로그인 4종(kakao/google/apple/**naver**)
- [x] S3 종류 선택 + 🔒(`GET /project-types`) — 백엔드 완료
- [ ] S4 닉네임 설정(`PATCH /users/me`)
- [ ] S5 정보 입력(종류/일정/유연일정/스타일/고려사항) → suggest 입력 반영
- [ ] S6 planLevel 3종 → 생성 깊이
- [ ] S7 AI 생성(provider 확장)
- [~] S9 계획 검토 — Phase/Task 편집 API 완료(§8-4). `GET /projects/:id`(P4)는 §8-7
- [ ] S10 파트너 초대/코드 연결(invites)
- [ ] S11 프로필(profileImageUrl 저장)
- [ ] S12 담당 배정(`assign`)
- [ ] S13 홈 대시보드(progress·upcoming·역할별/듀별 보기)
- [~] S14 편집 — Phase/Task CRUD·색상·메모·삭제 완료(§8-4). "다시 시작하기"(reset P8)는 §8-7
