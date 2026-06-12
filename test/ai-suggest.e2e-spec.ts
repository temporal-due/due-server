import request = require('supertest');
import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  resetDb,
  loginDevUser,
  bearer,
  AuthedUser,
} from './setup/test-app';
import {
  PROJECT_SUGGEST_PROVIDER,
  ProjectSuggestProvider,
  SuggestProjectOutput,
} from '../src/ai/interfaces/project-suggest-provider.interface';

// AI suggest(P1) 경로 e2e — 실제 OpenAI를 절대 호출하지 않는다.
//
// NODE_ENV=test에서는 AiModule 팩토리가 항상 StaticProjectSuggestProvider를 주입하므로
// 비용·비결정성 없이 OUTLINE/DETAILED 분기를 검증할 수 있다.
describe('AI suggest (e2e) — 정적 provider', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let me: AuthedUser;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(app);
    me = await loginDevUser(app);
  });

  const base = {
    type: 'WEDDING',
    projectName: '우리 결혼식',
    startDate: '2026-01-01',
    dueDate: '2026-12-31',
    style: 'ALL_IN',
  };

  it('MANUAL: provider를 거치지 않고 빈 계획을 반환한다', async () => {
    const res = await request(server)
      .post('/projects/suggest')
      .set('Authorization', bearer(me.token))
      .send({ ...base, planLevel: 'MANUAL' });
    expect(res.status).toBe(201);
    expect(res.body.phases).toHaveLength(0);
  });

  it('OUTLINE: Phase만 생성하고 tasks는 빈 배열이다', async () => {
    const res = await request(server)
      .post('/projects/suggest')
      .set('Authorization', bearer(me.token))
      .send({ ...base, planLevel: 'OUTLINE' });
    expect(res.status).toBe(201);
    expect(res.body.phases.length).toBeGreaterThan(0);
    expect(
      res.body.phases.every((p: { tasks: unknown[] }) => p.tasks.length === 0),
    ).toBe(true);
  });

  it('DETAILED: Phase + Task 상세를 생성한다', async () => {
    const res = await request(server)
      .post('/projects/suggest')
      .set('Authorization', bearer(me.token))
      .send({ ...base, planLevel: 'DETAILED' });
    expect(res.status).toBe(201);
    expect(res.body.phases.length).toBeGreaterThan(0);
    expect(
      res.body.phases.every((p: { tasks: unknown[] }) => p.tasks.length > 0),
    ).toBe(true);
  });
});

// 명시적 주입 패턴(.overrideProvider) 시연 — 테스트가 "나는 이 가짜를 쓴다"를 선언한다.
// = RTL의 per-test MSW handler. 주입한 provider의 출력이 응답에 그대로 흐르는지(매핑) 검증한다.
describe('AI suggest (e2e) — overrideProvider로 주입한 가짜', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let me: AuthedUser;

  const fixture: SuggestProjectOutput = {
    projectName: '주입된 계획',
    startDate: '2026-03-01',
    dueDate: '2026-09-30',
    budget: 12345,
    phases: [
      {
        name: '주입된 듀',
        expectedStartDate: '2026-03-01',
        expectedEndDate: '2026-09-30',
        order: 0,
        tasks: [{ name: '주입된 항목', status: 'TODO', order: 0 }],
      },
    ],
  };

  const fakeProvider: ProjectSuggestProvider = {
    suggest: () => Promise.resolve(fixture),
  };

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(PROJECT_SUGGEST_PROVIDER).useValue(fakeProvider),
    );
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(app);
    me = await loginDevUser(app);
  });

  it('주입한 provider의 출력이 응답에 그대로 매핑된다', async () => {
    const res = await request(server)
      .post('/projects/suggest')
      .set('Authorization', bearer(me.token))
      .send({
        type: 'WEDDING',
        projectName: '무시됨',
        dueDate: '2026-12-31',
        style: 'ALL_IN',
        planLevel: 'DETAILED',
      });
    expect(res.status).toBe(201);
    expect(res.body.projectName).toBe('주입된 계획');
    expect(res.body.budget).toBe(12345);
    expect(res.body.phases).toHaveLength(1);
    expect(res.body.phases[0].name).toBe('주입된 듀');
    expect(res.body.phases[0].tasks[0].name).toBe('주입된 항목');
  });
});
