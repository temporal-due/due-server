import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PROJECT_SUGGEST_PROVIDER } from './interfaces/project-suggest-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      // 다른 AI provider로 교체하려면 useClass만 바꾸면 됩니다
      provide: PROJECT_SUGGEST_PROVIDER,
      useClass: OpenAiProvider,
    },
  ],
  exports: [PROJECT_SUGGEST_PROVIDER],
})
export class AiModule {}
