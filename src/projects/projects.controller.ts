import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { ProjectSuggestService } from './project-suggest.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SuggestProjectRequestDto } from './dto/suggest-project-request.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CursorPaginationQueryDto } from '../common/dto/cursor-pagination.dto';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly projectSuggestService: ProjectSuggestService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getProjects(
    @CurrentUser() user: User,
    @Query() query: CursorPaginationQueryDto,
  ) {
    return this.projectsService.listProjects(user.id, query);
  }

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  suggestProject(@Body() dto: SuggestProjectRequestDto) {
    return this.projectSuggestService.suggest(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createProject(
    @CurrentUser() user: User,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.createProject(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updateProject(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(user.id, id, dto);
  }
}
