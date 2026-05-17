# due — 백엔드 API 서버

NestJS + TypeORM + PostgreSQL

---

## 빠른 시작

### 사전 요구사항

| 역할 | 필요한 것 |
|------|-----------|
| 프론트엔드 개발자 | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| 백엔드 개발자 | Docker Desktop + Node.js 20+ + pnpm |

---

### 프론트엔드 개발자 — 로컬 백엔드 실행

```bash
git clone <repo-url>
cd due

make setup   # .env.example → .env 복사
# .env 파일을 열고 팀에서 받은 시크릿 값(Kakao OAuth 등)을 채운다
make dev     # Docker로 DB + 앱 전체 실행
```

- API: `http://localhost:3000`
- Node/pnpm 설치 불필요 — Docker만 있으면 됩니다.

**.env 시크릿 공유**: Kakao OAuth 키 등 `.env.example`에 플레이스홀더로 표시된 값은 팀 채널에서 받아 채워주세요.

---

### 백엔드 개발자 — hot reload 개발 환경

```bash
git clone <repo-url>
cd due

make setup      # .env 생성
pnpm install    # 의존성 설치
make dev-local  # DB만 Docker로, 앱은 로컬에서 hot reload
```

- DB만 컨테이너로 띄우고 앱은 로컬에서 직접 실행 → 코드 변경 시 자동 재시작
- API: `http://localhost:3000`

---

## 주요 명령어

```bash
make setup      # .env.example → .env 복사 (최초 1회)
make dev        # 전체 Docker 실행 (프론트 개발자용)
make dev-local  # DB Docker + 앱 로컬 hot reload (백엔드 개발자용)
make down       # 전체 종료
make reset      # DB 초기화 + 테스트 유저 시드

pnpm token:dev       # 개발용 JWT 액세스 토큰 발급
pnpm me:dev          # /auth/me 엔드포인트 테스트
pnpm project:create  # 테스트 프로젝트 생성
```

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
