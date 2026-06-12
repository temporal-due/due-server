import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_SUGGEST_PROVIDER,
  ProjectSuggestProvider,
} from '../ai/interfaces/project-suggest-provider.interface';
import { SuggestProjectRequestDto } from './dto/suggest-project-request.dto';
import { SuggestProjectResponseDto } from './dto/suggest-project-response.dto';
import { PlanLevel } from './entities/projects.entity';

@Injectable()
export class ProjectSuggestService {
  constructor(
    @Inject(PROJECT_SUGGEST_PROVIDER)
    private readonly provider: ProjectSuggestProvider,
  ) {}

  suggest(dto: SuggestProjectRequestDto): Promise<SuggestProjectResponseDto> {
    // MANUAL: AI를 호출하지 않고 빈 플랜 초안을 즉시 반환한다.
    if (dto.planLevel === PlanLevel.MANUAL) {
      return Promise.resolve({
        projectName: dto.projectName ?? '새 프로젝트',
        startDate: dto.startDate,
        dueDate: dto.dueDate,
        phases: [],
      });
    }

    return this.provider.suggest({
      type: dto.type,
      projectName: dto.projectName,
      startDate: dto.startDate,
      dueDate: dto.dueDate,
      scheduleMode: dto.scheduleMode,
      style: dto.style,
      planLevel: dto.planLevel,
      additionalConsiderations: dto.additionalConsiderations,
    });
  }
}
