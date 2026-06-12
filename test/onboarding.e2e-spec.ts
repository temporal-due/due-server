import request = require('supertest');
import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  resetDb,
  loginDevUser,
  bearer,
  AuthedUser,
} from './setup/test-app';

// 시나리오 1 — 신규 유저 온보딩 → 첫 프로젝트 생성 → 검토 → 편집 (S2~S14)
//
// RTL 철학: HTTP 경계에서 "유저가 한 행동 → API가 돌려주는 것"만 검증한다.
// 서비스/레포지토리 내부는 들여다보지 않고, 영속 여부는 다시 조회(GET)해서 확인한다.
describe('시나리오 1: 온보딩 → 첫 프로젝트 (e2e)', () => {
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

  it('S2: 로그인 직후 내 정보를 조회한다', async () => {
    const res = await request(server)
      .get('/auth/me')
      .set('Authorization', bearer(me.token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(me.userId);
  });

  it('S2: 토큰 없이 보호 라우트에 접근하면 401', async () => {
    const res = await request(server).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('S4: 닉네임을 설정하면 trim되어 저장된다', async () => {
    const res = await request(server)
      .patch('/users/me')
      .set('Authorization', bearer(me.token))
      .send({ nickname: '  박완섭  ' });
    expect(res.status).toBe(200);
    expect(res.body.nickname).toBe('박완섭');
  });

  it('S4: 닉네임이 20자를 넘으면 400', async () => {
    const res = await request(server)
      .patch('/users/me')
      .set('Authorization', bearer(me.token))
      .send({ nickname: 'a'.repeat(21) });
    expect(res.status).toBe(400);
  });

  it('S3: 종류 카탈로그에서 WEDDING은 활성, 나머지는 잠금이다', async () => {
    const res = await request(server)
      .get('/project-types')
      .set('Authorization', bearer(me.token));
    expect(res.status).toBe(200);
    const wedding = res.body.find(
      (t: { type: string }) => t.type === 'WEDDING',
    );
    expect(wedding.available).toBe(true);
    expect(
      res.body.some((t: { available: boolean }) => t.available === false),
    ).toBe(true);
  });

  it('S5~S7: suggest를 MANUAL로 호출하면 AI 없이 빈 계획을 반환한다', async () => {
    const res = await request(server)
      .post('/projects/suggest')
      .set('Authorization', bearer(me.token))
      .send({
        type: 'WEDDING',
        projectName: '우리 결혼식',
        startDate: '2026-01-01',
        dueDate: '2026-12-31',
        style: 'ALL_IN',
        planLevel: 'MANUAL',
      });
    expect(res.status).toBe(201);
    expect(res.body.phases).toHaveLength(0);
  });

  it('S6/S9: 편집한 계획을 저장하면 OWNER 멤버가 자동 등록되고 다시 조회된다', async () => {
    const create = await request(server)
      .post('/projects')
      .set('Authorization', bearer(me.token))
      .send(weddingPlan());
    expect(create.status).toBe(201);
    expect(create.body.type).toBe('WEDDING');
    expect(create.body.color).toBe('#FF8A65');

    const projectId = create.body.id;

    // 영속 확인: 다시 조회해서 화면이 기대하는 모양(진행률·멤버)이 나오는지 본다.
    const detail = await request(server)
      .get(`/projects/${projectId}`)
      .set('Authorization', bearer(me.token));
    expect(detail.status).toBe(200);
    expect(detail.body.phases).toHaveLength(2);
    expect(detail.body.progress.total).toBe(3);
    expect(detail.body.members[0].role).toBe('OWNER');
  });

  it('S13: 생성한 프로젝트가 홈 목록에 보인다', async () => {
    const create = await request(server)
      .post('/projects')
      .set('Authorization', bearer(me.token))
      .send(weddingPlan());
    const projectId = create.body.id;

    const list = await request(server)
      .get('/projects?limit=20')
      .set('Authorization', bearer(me.token));
    expect(list.status).toBe(200);
    expect(list.body.data.some((p: { id: number }) => p.id === projectId)).toBe(
      true,
    );
  });

  it('S14: 듀 추가 → 항목 추가 → 항목 편집 → 듀 삭제가 순서대로 동작한다', async () => {
    const create = await request(server)
      .post('/projects')
      .set('Authorization', bearer(me.token))
      .send(weddingPlan());
    const projectId = create.body.id;

    const phase = await request(server)
      .post(`/projects/${projectId}/phases`)
      .set('Authorization', bearer(me.token))
      .send({
        name: '최종 점검 & 본식',
        order: 2,
        expectedStartDate: '2026-09-01',
        expectedEndDate: '2026-12-15',
        memo: '막판 체크',
        color: '#4FC3F7',
      });
    expect(phase.status).toBe(201);
    const phaseId = phase.body.id;

    const task = await request(server)
      .post(`/phases/${phaseId}/tasks`)
      .set('Authorization', bearer(me.token))
      .send({ name: '좌석 배치', order: 0, assignee: 'PARTNER' });
    expect(task.status).toBe(201);
    const taskId = task.body.id;

    const edit = await request(server)
      .patch(`/tasks/${taskId}`)
      .set('Authorization', bearer(me.token))
      .send({ name: '좌석 배치 확정', dueDate: '2026-11-30' });
    expect(edit.status).toBe(200);

    const del = await request(server)
      .delete(`/phases/${phaseId}`)
      .set('Authorization', bearer(me.token));
    expect(del.status).toBe(204);

    // 삭제 후 다시 2개(원래 phase)로 돌아왔는지 재조회로 확인.
    const detail = await request(server)
      .get(`/projects/${projectId}`)
      .set('Authorization', bearer(me.token));
    expect(detail.body.phases).toHaveLength(2);
  });

  it('S6: startDate가 dueDate보다 늦으면 400 (날짜 역전 검증)', async () => {
    const res = await request(server)
      .post('/projects')
      .set('Authorization', bearer(me.token))
      .send({
        ...weddingPlan(),
        startDate: '2026-12-31',
        dueDate: '2026-01-01',
      });
    expect(res.status).toBe(400);
  });

  it('S13: 홈 목록이 커서로 페이지네이션된다 (limit + nextCursor)', async () => {
    for (let i = 0; i < 3; i++) {
      await request(server)
        .post('/projects')
        .set('Authorization', bearer(me.token))
        .send(weddingPlan());
    }

    const page1 = await request(server)
      .get('/projects?limit=2')
      .set('Authorization', bearer(me.token));
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(server)
      .get(
        `/projects?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
      )
      .set('Authorization', bearer(me.token));
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.hasMore).toBe(false);
  });
});

// 클라가 suggest 결과를 편집해 보낸다고 가정한 결혼식 계획(phase 2개, task 3개).
function weddingPlan() {
  return {
    type: 'WEDDING',
    projectName: '우리 결혼식',
    style: 'ALL_IN',
    planLevel: 'DETAILED',
    scheduleMode: 'FIXED',
    color: '#FF8A65',
    startDate: '2026-01-01',
    dueDate: '2026-12-31',
    personality: { additionalConsiderations: '예물·예단 생략, 본식 DVD 희망' },
    phases: [
      {
        name: '큰 결정',
        order: 0,
        expectedStartDate: '2026-01-01',
        expectedEndDate: '2026-03-31',
        memo: '가장 중요한 결정들',
        color: '#FFB74D',
        tasks: [
          {
            name: '날짜 확정',
            status: 'TODO',
            order: 0,
            assignee: 'OWNER',
            dueDate: '2026-02-01',
          },
          {
            name: '예산 범위 확정',
            status: 'TODO',
            order: 1,
            assignee: 'TOGETHER',
          },
        ],
      },
      {
        name: '세부 기획 & 예약',
        order: 1,
        expectedStartDate: '2026-04-01',
        expectedEndDate: '2026-08-31',
        tasks: [
          { name: '스튜디오/드레스/메이크업 예약', status: 'TODO', order: 0 },
        ],
      },
    ],
  };
}
