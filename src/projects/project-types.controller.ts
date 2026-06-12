import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectTypeResponseDto } from './dto/project-type-response.dto';
import { PROJECT_TYPE_CATALOG } from './project-type.catalog';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@Controller('project-types')
export class ProjectTypesController {
  // C1: S3 종류 선택 카탈로그. 정적 상수를 그대로 반환한다.
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: [ProjectTypeResponseDto] })
  getProjectTypes(): ProjectTypeResponseDto[] {
    return PROJECT_TYPE_CATALOG;
  }
}
