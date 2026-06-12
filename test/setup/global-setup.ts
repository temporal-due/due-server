import { PostgreSqlContainer } from '@testcontainers/postgresql';

// 모든 e2e 스펙이 시작되기 전에 한 번 실행된다.
// 일회용 Postgres 컨테이너를 띄우고, 접속 정보를 process.env에 심어
// AppModule의 TypeOrmModule이 이 컨테이너를 바라보게 한다.
// (globalSetup에서 세팅한 env는 이후 fork되는 jest 워커에 그대로 상속된다.)
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('due_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  process.env.DB_HOST = container.getHost();
  process.env.DB_PORT = String(container.getPort());
  process.env.DB_USERNAME = container.getUsername();
  process.env.DB_PASSWORD = container.getPassword();
  process.env.DB_DATABASE = container.getDatabase();

  // JWT 검증이 .env의 시크릿에 의존하므로, 없으면 테스트용 기본값을 보장한다.
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-test-secret';
  process.env.NODE_ENV = 'test';

  // teardown에서 정지할 수 있도록 핸들을 보관 (globalSetup↔teardown은 동일 프로세스).
  (globalThis as { __PG_CONTAINER__?: unknown }).__PG_CONTAINER__ = container;

  // eslint-disable-next-line no-console
  console.log(
    `\n[e2e] Postgres testcontainer ready on ${process.env.DB_HOST}:${process.env.DB_PORT}`,
  );
}
