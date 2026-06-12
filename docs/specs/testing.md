# 테스트 전략 — RTL 철학을 백엔드로

> 프론트엔드의 React Testing Library(RTL) 철학을 백엔드에 그대로 적용한다.
> **"테스트가 실제 사용 방식을 닮을수록 신뢰도가 높다."** (Kent C. Dodds)

## 핵심 관점

**백엔드 API의 사용자는 프론트엔드다.** RTL에서 "DOM이 사용자가 보는 경계"라면,
백엔드에서 그 경계는 **HTTP API**다. 그래서 메인 테스트는 앱을 진짜로 띄우고 실제
HTTP 요청을 쏴서 **status code + 응답 body**만으로 검증하는 통합/e2e 테스트다.

| RTL (프론트) | 이 레포의 e2e |
|---|---|
| 컴포넌트 트리를 실제로 render | 실제 Nest 앱 + **실제 Postgres**(Testcontainers) 부팅 |
| `getByRole`/`getByText`로 보이는 것만 쿼리 | 프론트가 소비하는 HTTP 계약(status·JSON)만 단언 |
| `click`/`type` user event로 상호작용 | public 엔드포인트로만 조작·검증 |
| `cleanup()`으로 DOM 초기화 | `resetDb()`로 테이블 TRUNCATE |
| 로그인된 Provider로 감싸 render | dev 토큰 발급해 `Authorization: Bearer` |
| 구현 디테일 안 봐서 리팩터링에 안 깨짐 | 레포지토리/서비스 내부 검증 안 함 |

## 두 층의 테스트

1. **e2e (`test/*.e2e-spec.ts`)** — 유저 저니·권한·계약. 무게 중심.
   - `pnpm test:e2e`
2. **unit (`src/**/*.spec.ts`)** — 분기 많은 **순수 로직**만 (대시보드 파생 계산,
   `planLevel` 분기, 커서 인코딩, order/날짜 검증 등). 순수 함수처럼 cheap하게.
   - `pnpm test`

> CRUD/오케스트레이션 성격의 서비스(레포지토리를 엮기만 하는)는 단위 테스트하지 않는다.
> mock 유지비만 크고 신뢰도가 낮으며, 리팩터링에 쉽게 깨진다.
>
> **실제 사례**: 멤버십 도입(§8-6) 후 `projects.service.spec.ts`가 깨졌다. owner 기반
> 권한을 검증하던 단위 테스트가 멤버십 기반으로 바뀐 구현과 어긋난 것이다. 행위 기반
> e2e였다면 green이었을 부분이다. 그래서 이 스펙을 **삭제**하고, 갖고 있던 로직을 성격에
> 맞게 재배치했다:
> - 권한·오케스트레이션 → e2e가 소유 (비멤버 403, 파트너 삭제 403 등)
> - 날짜 역전 검증·커서 페이지네이션 → e2e 행위 테스트로 이전
> - 순수 함수(커서 encode/decode) → `cursor.util.spec.ts` 단위 테스트로 이전

## 인프라 (Testcontainers)

`synchronize:true` + Postgres enum/jsonb를 쓰므로 sqlite로 바꾸면 "다른 걸" 테스트하게 된다.
그래서 **진짜 Postgres**를 일회용 컨테이너로 띄운다. (전제: Docker 실행 중)

```
test/
  jest-e2e.json            # e2e 전용 jest 설정 (maxWorkers:1로 DB 상태 결정적)
  setup/
    global-setup.ts        # 컨테이너 1회 기동 → DB_* env 주입
    global-teardown.ts     # 컨테이너 정지
    test-app.ts            # createTestApp / resetDb / loginDevUser / createUser
    jose-stub.ts           # jose(ESM) 런타임 스텁 — 아래 메모 참조
  onboarding.e2e-spec.ts   # 시나리오 1
  collab.e2e-spec.ts       # 시나리오 2
```

- **앱 부팅**(`createTestApp`)은 `main.ts`와 **동일한 전역 파이프/필터**를 적용한다.
  이게 빠지면 validation·에러 포맷이 실제와 달라져 "실제 사용을 닮은 테스트"가 깨진다.
- **격리**: 매 테스트 `beforeEach`에서 `resetDb`로 TRUNCATE. `maxWorkers:1`로 직렬 실행.
- **인증**: OAuth(jose JWKS 검증)는 외부 의존이라 우회한다. `AuthService.login()`으로
  실제 서명 경로를 그대로 타서 토큰을 발급한다(2번째 유저=파트너 포함).

### jose 스텁 메모
`jose` v6는 순수 ESM이라 Jest(CommonJS)가 파싱하지 못한다. jose는 social-login의
id-token(JWKS) 검증에만 쓰이는데 e2e는 dev 토큰으로 우회하므로 이 경로는 실행되지 않는다.
그래서 **런타임에서만** `moduleNameMapper`로 `test/setup/jose-stub.ts`에 매핑한다.
타입 체크는 영향받지 않아 실제 jose 타입을 그대로 쓴다. 외부 인증 제공자를 모킹하는 것과
동일한 정당한 경계이며, 누가 social-login을 e2e로 검증하려 하면 스텁이 즉시 던져 알려준다.

## 외부 의존(AI provider) 처리

실제 LLM 호출은 **돈이 나가고 비결정적**이라 테스트에 부적합하다. 그래서 suggest provider는
포트(`ProjectSuggestProvider` 인터페이스 + `PROJECT_SUGGEST_PROVIDER` 토큰)에만 의존하게 두고,
환경에 따라 어댑터를 갈아끼운다 (= 프론트의 MSW / fake API client).

- **구현체**: `OpenAiProvider`(실과금) ↔ `StaticProjectSuggestProvider`(가짜·무과금, §6 시드).
- **선택**(`AiModule` 팩토리): `NODE_ENV=test`면 **무조건 static**(테스트는 절대 실과금 X) →
  `AI_PROVIDER=static|openai` 명시값 → 미설정 시 `OPENAI_API_KEY` 유무로 자동.
- **테스트에서 두 가지 방식**:
  1. **기본 static**(`NODE_ENV=test`) — `ai-suggest.e2e-spec.ts`의 OUTLINE/DETAILED 구조 검증.
     "절대 과금 안 함"을 환경이 보장하는 안전망.
  2. **명시적 `.overrideProvider`** — 테스트가 직접 가짜를 주입해 "주입 출력 → 응답 매핑"을
     단언. env 매직에 의존하지 않아 자명하다(권장). `createTestApp(builder => builder.overrideProvider(...))`.
- **contract drift 방지**: 가짜만 쓰면 실제 OpenAI 어댑터(프롬프트·스키마·파싱)는 안 돌아간다.
  실제 API 검증이 필요하면 `OPENAI_API_KEY`를 넣고 `pnpm suggest:dev`로 opt-in 스모크만 돌린다(기본 CI 제외).

## 테스트 작성 원칙

- **단언은 응답으로**: 영속 여부는 레포지토리를 들여다보지 말고 다시 `GET` 해서 확인한다.
- **협력자 스파이 금지**: `expect(repo.save).toHaveBeenCalled()` 같은 건 구현 박제 → 금지.
- **셋업은 front door 우선**: 가능하면 API로 상태를 만든다. 깊은 셋업만 헬퍼/DI로 단축.
- **저니 단위 describe**: `describe`는 유저 스토리, `it`은 관찰 가능한 결과 하나.
- 시나리오 정의·화면 매핑은 [`user-stories.md`](./user-stories.md).
