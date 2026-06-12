import { Injectable } from '@nestjs/common';
import {
  ProjectSuggestProvider,
  SuggestProjectInput,
  SuggestProjectOutput,
  SuggestPhaseOutput,
} from '../interfaces/project-suggest-provider.interface';

// 실제 OpenAI를 호출하지 않는 정적(가짜) provider.
// 테스트·키 없는 로컬 개발에서 비용·비결정성 없이 동일한 인터페이스로 동작한다.
// 결혼식 기본 시드는 backend-implementation.md §6를 따른다.
//
// planLevel 분기는 실제 provider와 동일하게 지킨다:
//   - OUTLINE  : Phase만, tasks는 빈 배열
//   - DETAILED : Phase + Task 상세
// (MANUAL은 provider를 거치지 않고 서비스가 가로채므로 여기 도달하지 않는다.)

interface SeedPhase {
  name: string;
  tasks: string[];
}

const WEDDING_SEED: SeedPhase[] = [
  {
    name: '큰 결정',
    tasks: [
      '날짜 확정',
      '예산 범위 확정',
      '결혼식 스타일 결정',
      '웨딩홀 투어 & 계약',
    ],
  },
  {
    name: '세부 기획 & 예약',
    tasks: ['스튜디오/드레스/메이크업 예약', '본식 DVD 예약', '촬영 진행'],
  },
  {
    name: '실행 & 본식 준비',
    tasks: ['청첩장 제작', '하객 리스트 확정', '식순 구성', '예물 & 예단'],
  },
  {
    name: '최종 점검 & 본식',
    tasks: ['최종 인원 확정', '좌석 배치', '리허설/동선', '당일 진행'],
  },
];

const GENERIC_SEED: SeedPhase[] = [
  { name: '준비', tasks: ['목표 정하기', '예산 잡기', '일정 짜기'] },
  { name: '실행', tasks: ['핵심 작업 진행', '점검'] },
];

const TYPE_DEFAULT_NAME: Record<string, string> = {
  WEDDING: '우리 결혼식',
  HOUSE: '내 집 마련',
  HONEYMOON: '신혼여행',
  CHILD: '육아 준비',
  EXERCISE: '운동 계획',
  CUSTOM: '나만의 프로젝트',
};

@Injectable()
export class StaticProjectSuggestProvider implements ProjectSuggestProvider {
  suggest(input: SuggestProjectInput): Promise<SuggestProjectOutput> {
    const seed = input.type === 'WEDDING' ? WEDDING_SEED : GENERIC_SEED;
    const isOutline = input.planLevel === 'OUTLINE';
    const ranges = this.splitTimeline(
      input.startDate,
      input.dueDate,
      seed.length,
    );

    const phases: SuggestPhaseOutput[] = seed.map((phase, i) => ({
      name: phase.name,
      expectedStartDate: ranges[i].start,
      expectedEndDate: ranges[i].end,
      order: i,
      tasks: isOutline
        ? []
        : phase.tasks.map((name, order) => ({
            name,
            status: 'TODO' as const,
            order,
          })),
    }));

    return Promise.resolve({
      projectName:
        input.projectName ?? TYPE_DEFAULT_NAME[input.type] ?? '새 프로젝트',
      startDate: input.startDate,
      dueDate: input.dueDate,
      budget: input.type === 'WEDDING' ? 50_000_000 : undefined,
      phases,
    });
  }

  // [start, due] 구간을 n등분해 각 Phase의 기간을 만든다. start가 없으면 오늘부터.
  private splitTimeline(
    start: string | undefined,
    due: string,
    n: number,
  ): Array<{ start: string; end: string }> {
    const startMs = start ? Date.parse(start) : Date.now();
    const dueMs = Date.parse(due);
    const span = Math.max(dueMs - startMs, 0);
    const seg = span / n;
    const fmt = (ms: number): string =>
      new Date(ms).toISOString().split('T')[0];
    return Array.from({ length: n }, (_, i) => ({
      start: fmt(startMs + seg * i),
      end: fmt(startMs + seg * (i + 1)),
    }));
  }
}
