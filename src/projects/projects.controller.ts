import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { ProjectSuggestService } from './project-suggest.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { SuggestProjectRequestDto } from './dto/suggest-project-request.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  getProjects(@CurrentUser() user: User) {
    return this.projectsService.listProjects(user.id);
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
    @Body() createProjectDto: CreateProjectDto,
  ) {
    return this.projectsService.createProject(user.id, createProjectDto);
  }
}
