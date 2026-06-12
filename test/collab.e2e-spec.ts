import request = require('supertest');
import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  resetDb,
  loginDevUser,
  createUser,
  bearer,
  AuthedUser,
} from './setup/test-app';

// 시나리오 2 — 파트너 협업 → 담당 배정 → 홈 대시보드 → 할 일 완료 → 정리 (S10~S14)
//
// 두 명의 사용자(OWNER, PARTNER) 관점에서 협업 흐름과 권한 모델을 검증한다.
describe('시나리오 2: 협업 → 배정 → 대시보드 (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let owner: AuthedUser;
  let partner: AuthedUser;
  let projectId: number;
  let taskIds: number[];

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  // 매 테스트마다 깨끗한 상태에서 owner가 프로젝트(Task 3개)를 만들어 둔다.
  beforeEach(async () => {
    await resetDb(app);
    owner = await loginDevUser(app);
    partner = await createUser(app, {
      providerId: 'dev-user2-local',
      nickname: '파트너',
      email: 'dev2@local.test',
    });

    const create = await request(server)
      .post('/projects')
      .set('Authorization', bearer(owner.token))
      .send({
        type: 'WEDDING',
        projectName: '협업 결혼식',
        style: 'ALL_IN',
        scheduleMode: 'FIXED',
        color: '#FF8A65',
        startDate: '2026-01-01',
        dueDate: '2026-12-31',
        personality: { additionalConsiderations: '' },
        phases: [
          {
            name: '큰 결정',
            order: 0,
            expectedStartDate: '2026-01-01',
            expectedEndDate: '2026-06-30',
            tasks: [
              {
                name: '날짜 확정',
                status: 'TODO',
                order: 0,
                dueDate: '2026-02-15',
              },
              {
                name: '예산 확정',
                status: 'TODO',
                order: 1,
                dueDate: '2026-03-01',
              },
              {
                name: '웨딩홀 투어',
                status: 'TODO',
                order: 2,
                dueDate: '2026-04-10',
              },
            ],
          },
        ],
      });
    projectId = create.body.id;
    taskIds = create.body.phases[0].tasks.map((t: { id: number }) => t.id);
  });

  // 초대 코드 발급 → 파트너 수락. 자주 쓰여서 헬퍼로 뺀다.
  async function invitePartner(): Promise<void> {
    const invite = await request(server)
      .post(`/projects/${projectId}/invites`)
      .set('Authorization', bearer(owner.token))
      .send({});
    const code = invite.body.code as string;
    await request(server)
      .post('/invites/accept')
      .set('Authorization', bearer(partner.token))
      .send({ code });
  }

  it('S10: 초대 코드를 발급하고 파트너가 수락하면 PARTNER로 합류한다', async () => {
    const invite = await request(server)
      .post(`/projects/${projectId}/invites`)
      .set('Authorization', bearer(owner.token))
      .send({});
    expect(invite.status).toBe(201);
    expect(typeof invite.body.code).toBe('string');

    const accept = await request(server)
      .post('/invites/accept')
      .set('Authorization', bearer(partner.token))
      .send({ code: invite.body.code });
    expect(accept.status).toBe(201);
    expect(accept.body.role).toBe('PARTNER');

    const members = await request(server)
      .get(`/projects/${projectId}/members`)
      .set('Authorization', bearer(owner.token));
    expect(members.body).toHaveLength(2);
  });

  it('S10: 잘못된 초대 코드는 거부된다', async () => {
    const res = await request(server)
      .post('/invites/accept')
      .set('Authorization', bearer(partner.token))
      .send({ code: 'NOPECODE' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('협업 전: 파트너는 남의 프로젝트를 조회할 수 없다 (멤버십 권한)', async () => {
    const res = await request(server)
      .get(`/projects/${projectId}`)
      .set('Authorization', bearer(partner.token));
    expect(res.status).toBe(403);
  });

  it('S13: 합류 후 파트너의 홈 목록에 공유 프로젝트가 보인다', async () => {
    await invitePartner();
    const list = await request(server)
      .get('/projects?limit=20')
      .set('Authorization', bearer(partner.token));
    expect(list.status).toBe(200);
    expect(list.body.data.some((p: { id: number }) => p.id === projectId)).toBe(
      true,
    );
  });

  it('S12/S13: 담당을 배정하고 역할별 대시보드에서 그룹과 임박 항목을 확인한다', async () => {
    await invitePartner();

    const assignments: Array<[number, string, string]> = [
      [taskIds[0], 'OWNER', owner.token],
      [taskIds[1], 'PARTNER', partner.token],
      [taskIds[2], 'TOGETHER', owner.token],
    ];
    for (const [taskId, assignee, token] of assignments) {
      const res = await request(server)
        .patch(`/tasks/${taskId}/assign`)
        .set('Authorization', bearer(token))
        .send({ assignee });
      expect(res.status).toBe(200);
    }

    const dash = await request(server)
      .get(`/projects/${projectId}/dashboard?groupBy=role&filter=task`)
      .set('Authorization', bearer(owner.token));
    expect(dash.status).toBe(200);
    const keys = dash.body.groups.map((g: { key: string }) => g.key).sort();
    expect(keys).toEqual(
      expect.arrayContaining(['OWNER', 'PARTNER', 'TOGETHER']),
    );
    expect(dash.body.upcoming.length).toBeGreaterThan(0);
  });

  it('S13: 할 일을 완료 처리하면 진행률이 갱신된다 (0% → 33%)', async () => {
    await invitePartner();

    const before = await request(server)
      .get(`/projects/${projectId}/dashboard?groupBy=role&filter=task`)
      .set('Authorization', bearer(owner.token));
    expect(before.body.progress.percent).toBe(0);

    // 파트너도 항목 상태는 바꿀 수 있다(멤버십 권한).
    const done = await request(server)
      .patch(`/tasks/${taskIds[0]}/status`)
      .set('Authorization', bearer(partner.token))
      .send({ status: 'DONE' });
    expect(done.status).toBe(200);

    const after = await request(server)
      .get(`/projects/${projectId}/dashboard?groupBy=role&filter=task`)
      .set('Authorization', bearer(owner.token));
    expect(after.body.progress.percent).toBe(33);
  });

  it('S14: reset은 Phase/Task만 비우고 멤버는 유지한다', async () => {
    await invitePartner();

    const reset = await request(server)
      .post(`/projects/${projectId}/reset`)
      .set('Authorization', bearer(owner.token));
    expect(reset.status).toBe(201);
    expect(reset.body.phases).toHaveLength(0);

    const members = await request(server)
      .get(`/projects/${projectId}/members`)
      .set('Authorization', bearer(owner.token));
    expect(members.body).toHaveLength(2);
  });

  it('S14: 파괴적 작업(삭제)은 OWNER만 가능하다', async () => {
    await invitePartner();

    // 파트너는 삭제 불가
    const partnerDelete = await request(server)
      .delete(`/projects/${projectId}`)
      .set('Authorization', bearer(partner.token));
    expect(partnerDelete.status).toBe(403);

    // OWNER는 삭제 가능
    const ownerDelete = await request(server)
      .delete(`/projects/${projectId}`)
      .set('Authorization', bearer(owner.token));
    expect(ownerDelete.status).toBe(204);
  });
});
