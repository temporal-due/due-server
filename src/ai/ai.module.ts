import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  PROJECT_SUGGEST_PROVIDER,
  ProjectSuggestProvider,
} from './interfaces/project-suggest-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { StaticProjectSuggestProvider } from './providers/static.provider';

// AI suggest provider를 환경에 맞게 주입한다.
//
// 선택 규칙(우선순위):
//   1. NODE_ENV=test            → 항상 static (테스트는 절대 실과금하지 않는다)
//   2. AI_PROVIDER=static|openai → 명시값 존중
//   3. 미설정                    → OPENAI_API_KEY 있으면 openai, 없으면 static
//
// 덕분에 키 없는 로컬 개발(make dev / suggest:dev)도 그대로 돌아가고,
// 키가 있어도 AI_PROVIDER=static으로 비용을 막을 수 있다.
function resolveSuggestProvider(config: ConfigService): ProjectSuggestProvider {
  const logger = new Logger('AiModule');
  const nodeEnv = config.get<string>('NODE_ENV');
  const mode = config.get<string>('AI_PROVIDER');
  const hasKey = !!config.get<string>('OPENAI_API_KEY');

  const useOpenAi =
    nodeEnv !== 'test' && (mode === 'openai' || (mode !== 'static' && hasKey));

  if (useOpenAi) {
    logger.log('project suggest provider: OpenAI (실과금)');
    return new OpenAiProvider(config);
  }
  logger.log('project suggest provider: Static (가짜 데이터, 무과금)');
  return new StaticProjectSuggestProvider();
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PROJECT_SUGGEST_PROVIDER,
      inject: [ConfigService],
      useFactory: resolveSuggestProvider,
    },
  ],
  exports: [PROJECT_SUGGEST_PROVIDER],
})
export class AiModule {}
