## 로컬에서 바로 서버 띄우기 (Docker)

Node/pnpm 설치 없이 Docker만 있으면 됩니다.

```bash
docker compose up --build
```

- API 서버: http://localhost:3000
- Postgres: localhost:5432 (user/password/db: postgres/postgres/postgres)
