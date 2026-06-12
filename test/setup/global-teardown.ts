import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

// 모든 e2e 스펙이 끝난 뒤 한 번 실행된다. 컨테이너를 정리한다.
export default async function globalTeardown(): Promise<void> {
  const container = (
    globalThis as { __PG_CONTAINER__?: StartedPostgreSqlContainer }
  ).__PG_CONTAINER__;
  if (container) {
    await container.stop();
  }
}
