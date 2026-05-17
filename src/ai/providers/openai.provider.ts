import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  ProjectSuggestProvider,
  SuggestProjectInput,
  SuggestProjectOutput,
} from '../interfaces/project-suggest-provider.interface';

// JSON Schema for GPT structured output — must match SuggestProjectOutput exactly
const PROJECT_SUGGEST_SCHEMA = {
  name: 'project_suggestion',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      projectName: { type: 'string' },
      startDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD)' },
      dueDate: { type: 'string', description: 'ISO date string (YYYY-MM-DD)' },
      budget: { type: 'integer', description: 'Estimated budget in KRW' },
      personality: {
        type: 'object',
        properties: {
          preparationStyle: { type: 'string' },
          additionalConsiderations: { type: 'string' },
        },
        required: ['preparationStyle', 'additionalConsiderations'],
        additionalProperties: false,
      },
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
          required: ['name', 'expectedStartDate', 'expectedEndDate', 'order', 'tasks'],
          additionalProperties: false,
        },
      },
    },
    required: ['projectName', 'startDate', 'dueDate', 'budget', 'personality', 'phases'],
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

    const userMessage = [
      `오늘 날짜: ${today}`,
      `마감일: ${input.dueDate}`,
      `준비 스타일: ${input.preparationStyle}`,
      input.additionalConsiderations
        ? `추가 고려사항: ${input.additionalConsiderations}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: [
            '당신은 프로젝트 플래너입니다.',
            '사용자가 입력한 마감일, 준비 스타일, 추가 고려사항을 바탕으로',
            '프로젝트 생성에 필요한 기본 정보(이름, 예산, 단계, 할 일)를 추천해주세요.',
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

    return JSON.parse(content) as SuggestProjectOutput;
  }
}
