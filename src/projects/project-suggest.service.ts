import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_SUGGEST_PROVIDER,
  ProjectSuggestProvider,
} from '../ai/interfaces/project-suggest-provider.interface';
import { SuggestProjectRequestDto } from './dto/suggest-project-request.dto';
import { SuggestProjectResponseDto } from './dto/suggest-project-response.dto';

@Injectable()
export class ProjectSuggestService {
  constructor(
    @Inject(PROJECT_SUGGEST_PROVIDER)
    private readonly provider: ProjectSuggestProvider,
  ) {}

  suggest(dto: SuggestProjectRequestDto): Promise<SuggestProjectResponseDto> {
    return this.provider.suggest({
      dueDate: dto.dueDate,
      preparationStyle: dto.preparationStyle,
      additionalConsiderations: dto.additionalConsiderations,
    });
  }
}
