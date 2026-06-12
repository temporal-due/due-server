import { StaticProjectSuggestProvider } from './static.provider';
import { SuggestProjectInput } from '../interfaces/project-suggest-provider.interface';

// 가짜 provider의 planLevel 분기·passthrough를 순수하게 검증한다(비용·네트워크 없음).
describe('StaticProjectSuggestProvider', () => {
  const provider = new StaticProjectSuggestProvider();

  const baseInput: SuggestProjectInput = {
    type: 'WEDDING',
    dueDate: '2026-12-31',
    startDate: '2026-01-01',
    style: 'ALL_IN',
  };

  it('DETAILED: Phase마다 Task를 채워 반환한다', async () => {
    const out = await provider.suggest({ ...baseInput, planLevel: 'DETAILED' });
    expect(out.phases.length).toBeGreaterThan(0);
    expect(out.phases.every((p) => p.tasks.length > 0)).toBe(true);
    expect(out.phases[0].tasks[0].status).toBe('TODO');
  });

  it('OUTLINE: Phase만 만들고 tasks는 빈 배열이다', async () => {
    const out = await provider.suggest({ ...baseInput, planLevel: 'OUTLINE' });
    expect(out.phases.length).toBeGreaterThan(0);
    expect(out.phases.every((p) => p.tasks.length === 0)).toBe(true);
  });

  it('projectName/dueDate는 입력을 그대로 통과시킨다', async () => {
    const out = await provider.suggest({
      ...baseInput,
      projectName: '커스텀 이름',
      planLevel: 'DETAILED',
    });
    expect(out.projectName).toBe('커스텀 이름');
    expect(out.dueDate).toBe('2026-12-31');
  });

  it('projectName 미입력 시 종류 기본 이름을 쓴다', async () => {
    const out = await provider.suggest({ ...baseInput, planLevel: 'OUTLINE' });
    expect(out.projectName).toBe('우리 결혼식');
  });

  it('order는 0부터 연속이고 Phase 기간은 마감일을 넘지 않는다', async () => {
    const out = await provider.suggest({ ...baseInput, planLevel: 'DETAILED' });
    out.phases.forEach((p, i) => expect(p.order).toBe(i));
    const last = out.phases[out.phases.length - 1];
    expect(last.expectedEndDate <= baseInput.dueDate).toBe(true);
  });
});
