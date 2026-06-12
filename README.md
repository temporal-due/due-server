# due — 백엔드 API 서버

NestJS + TypeORM + PostgreSQL

---

## 프론트엔드 개발자 — 로컬 백엔드 실행

**필요한 것: [Docker Desktop](https://www.docker.com/products/docker-desktop/) 하나면 됩니다.** Node.js나 pnpm 설치 불필요.

### 1단계 — 최초 설정 (처음 한 번만)

```bash
git clone <repo-url>
cd due
make setup
```

`.env` 파일이 생성됩니다. Kakao OAuth 키 등 팀에서 공유받은 값이 있다면 `.env`를 열어 채워주세요.

### 2단계 — 서버 실행

```bash
make dev
```

DB와 앱이 Docker로 함께 뜹니다. 터미널에 `Application is running on: http://localhost:3000`이 나오면 준비된 것입니다.

### 3단계 — DB 초기화 (서버 켤 때마다 필요하면 실행)

```bash
pnpm dev:reset
```

테이블을 비우고 개발용 계정(`dev@local.test`)을 새로 만들어줍니다. 데이터가 꼬였을 때도 이걸 실행하면 초기화됩니다.

### 4단계 — API 테스트

`http://localhost:3000/api-docs` 에 접속하면 Swagger UI가 열립니다.

1. 상단의 초록색 **Dev Login** 버튼 클릭 → **✓ 로그인됨** 으로 바뀌면 인증 완료
2. 원하는 API를 펼쳐 **Try it out → Execute**

> OpenAPI JSON 스펙은 `http://localhost:3000/api-docs-json` 에서 받을 수 있습니다 (Postman import 등에 활용).

---

## 백엔드 개발자 — hot reload 개발 환경

**필요한 것: Docker Desktop + Node.js 20+ + pnpm**

```bash
git clone <repo-url>
cd due

make setup      # .env 생성
pnpm install    # 의존성 설치
make dev-local  # DB만 Docker로, 앱은 로컬 hot reload
pnpm dev:reset  # DB 초기화 + 개발 유저 시드
```

코드를 수정하면 앱이 자동으로 재시작됩니다.

터미널이나 Postman에서 직접 API를 호출할 때는 아래 명령어로 토큰을 발급하세요:

```bash
pnpm token:dev  # 개발용 JWT 액세스 토큰 출력
pnpm me:dev     # /auth/me 빠른 smoke test
pnpm crud:dev    # Phase/Task CRUD 엔드포인트 happy-path 호출 확인
pnpm invite:dev  # 초대 코드 발급→수락→멤버 목록→제거 happy-path 확인
```

서버 종료: `make down`

---

## 환경 변수

`.env.example` 파일에 모든 환경변수와 설명이 있습니다.

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | 서버 포트 | `3000` |
| `DB_*` | PostgreSQL 연결 정보 | docker-compose 기본값 |
| `JWT_SECRET` | JWT 서명 키 (32자 이상) | — 직접 설정 필요 |
| `KAKAO_*` | Kakao OAuth 앱 자격증명 | — 팀에서 공유 |
| `FRONTEND_URL` | CORS 허용 프론트 URL | `http://localhost:8081` |
| `OPENAI_API_KEY` | AI 프로젝트 제안 기능 (OpenAI) | — 직접 설정 필요 |
