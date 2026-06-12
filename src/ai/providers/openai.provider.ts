import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ProjectSuggestProvider,
  SuggestProjectInput,
  SuggestProjectOutput,
} from '../interfaces/project-suggest-provider.interface';

const TYPE_LABELS: Record<string, string> = {
  WEDDING: '결혼식 준비',
  HOUSE: '집 마련',
  HONEYMOON: '신혼여행',
  CHILD: '육아 준비',
  EXERCISE: '운동/건강',
  CUSTOM: '나만의 프로젝트',
};

const STYLE_LABELS: Record<string, string> = {
  ALL_IN: '최대한 좋은 것으로 아끼지 않기 (🥊)',
  SAVE_MONEY: '알뜰하게 절약 우선 (💵)',
  RECOMMEND: '전문가 추천 따르기 (🧐)',
};

const PROJECT_SUGGEST_SCHEMA = {
  name: 'project_suggestion',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      projectName: { type: 'string' },
      startDate: {
        type: 'string',
        description: 'ISO date string (YYYY-MM-DD)',
      },
      dueDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD)' },
      budget: { type: 'integer', description: 'Estimated budget in KRW' },
      phases: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            expectedStartDate: { type: 'string' },
            expectedEndDate: { type: 'string' },
            order: { type: 'integer' },
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  status: { type: 'string', enum: ['TODO'] },
                  order: { type: 'integer' },
                },
                required: ['name', 'status', 'order'],
                additionalProperties: false,
              },
            },
          },
          required: [
            'name',
            'expectedStartDate',
            'expectedEndDate',
            'order',
            'tasks',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['projectName', 'startDate', 'dueDate', 'budget', 'phases'],
    additionalProperties: false,
  },
};

@Injectable()
export class OpenAiProvider implements ProjectSuggestProvider {
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async suggest(input: SuggestProjectInput): Promise<SuggestProjectOutput> {
    const today = new Date().toISOString().split('T')[0];

    const typeLabel = TYPE_LABELS[input.type] ?? input.type;
    const styleLabel = STYLE_LABELS[input.style] ?? input.style;
    const isOutline = input.planLevel === 'OUTLINE';

    const planLevelInstruction = isOutline
      ? '각 Phase(단계)의 이름과 기간만 생성하고 tasks 배열은 반드시 빈 배열([])로 반환하세요.'
      : '각 Phase(단계)마다 구체적인 Task(할 일) 목록을 상세히 생성하세요.';

    const lines = [
      `프로젝트 종류: ${typeLabel}`,
      input.projectName ? `프로젝트 이름: ${input.projectName}` : null,
      `준비 스타일: ${styleLabel}`,
      `오늘 날짜: ${today}`,
      input.startDate ? `시작일: ${input.startDate}` : '시작일: 미정',
      `마감일: ${input.dueDate}`,
      input.additionalConsiderations
        ? `추가 고려사항: ${input.additionalConsiderations}`
        : null,
    ];

    const userMessage = lines.filter(Boolean).join('\n');

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: [
            '당신은 한국 커플의 생활 이벤트 플래너입니다.',
            '사용자가 입력한 프로젝트 종류, 준비 스타일, 일정, 추가 고려사항을 바탕으로',
            '프로젝트 계획(이름, 예산, 단계, 할 일)을 한국어로 추천해주세요.',
            planLevelInstruction,
            '날짜는 항상 YYYY-MM-DD 형식의 ISO date string으로 반환하세요.',
            '예산은 정수(KRW 기준)로 반환하세요.',
            '각 phase와 task의 order는 0부터 시작하는 정수입니다.',
          ].join(' '),
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: PROJECT_SUGGEST_SCHEMA,
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI provider returned empty response');
    }

    const parsed = JSON.parse(content) as SuggestProjectOutput;
    return parsed;
  }
}
