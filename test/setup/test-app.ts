import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { AuthService } from '../../src/auth/auth.service';
import { UsersService } from '../../src/users/users.service';

// e2e 테스트용 Nest 앱을 부팅한다.
// 프로덕션과 동일하게 동작해야 하므로 main.ts와 같은 전역 파이프/필터를 적용한다.
// (이게 빠지면 validation·에러 포맷이 실제와 달라져 "실제 사용을 닮은 테스트"가 깨진다.)
//
// configure 콜백으로 모듈 빌더를 가공할 수 있다(예: .overrideProvider(...)).
// 외부 의존(AI provider 등)을 테스트별로 명시적으로 가짜로 바꿀 때 쓴다 = RTL의 MSW handler.
export async function createTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder | void,
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (configure) {
    builder = configure(builder) ?? builder;
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

// 테스트 간 격리: 모든 테이블을 비운다 (RTL의 cleanup()에 해당).
export async function resetDb(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  await dataSource.query(
    'TRUNCATE TABLE tasks, phases, projects, project_members, project_invites, users RESTART IDENTITY CASCADE',
  );
}

export interface AuthedUser {
  userId: string;
  token: string;
}

// dev 유저로 로그인한 토큰 (OAuth 우회 — 프론트가 받는 access token과 동일 경로).
export async function loginDevUser(app: INestApplication): Promise<AuthedUser> {
  const authService = app.get(AuthService);
  const usersService = app.get(UsersService);
  const user = await usersService.findOrCreateByOAuth({
    provider: 'google',
    providerId: 'dev-user-local',
    email: 'dev@local.test',
    nickname: 'Dev User',
    profileImageUrl: null,
  });
  const tokens = await authService.login(user);
  return { userId: user.id, token: tokens.accessToken };
}

// 협업 시나리오용 추가 유저(파트너 등)를 만들고 토큰을 발급한다.
export async function createUser(
  app: INestApplication,
  opts: { providerId: string; nickname: string; email: string },
): Promise<AuthedUser> {
  const authService = app.get(AuthService);
  const usersService = app.get(UsersService);
  const user = await usersService.findOrCreateByOAuth({
    provider: 'google',
    providerId: opts.providerId,
    email: opts.email,
    nickname: opts.nickname,
    profileImageUrl: null,
  });
  const tokens = await authService.login(user);
  return { userId: user.id, token: tokens.accessToken };
}

// Authorization 헤더 헬퍼.
export function bearer(token: string): string {
  return `Bearer ${token}`;
}
