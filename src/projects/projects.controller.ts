import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { PhasesService } from '../phases/phases.service';
import { MembersService } from '../members/members.service';
import { InvitesService } from '../invites/invites.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { SuggestProjectRequestDto } from './dto/suggest-project-request.dto';
import { CreatePhaseRequestDto } from '../phases/dto/create-phase-request.dto';
import { CreateInviteDto } from '../invites/dto/create-invite.dto';
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
    private readonly phasesService: PhasesService,
    private readonly membersService: MembersService,
    private readonly invitesService: InvitesService,
  ) {}

  // ── 경로 없는 / 고정 경로 ─────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard)
  getProjects(@CurrentUser() user: User, @Query() query: CursorPaginationQueryDto) {
    return this.projectsService.listProjects(user.id, query);
  }

  @Post('suggest')
  @UseGuards(JwtAuthGuard)
  suggestProject(@Body() dto: SuggestProjectRequestDto) {
    return this.projectSuggestService.suggest(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createProject(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    return this.projectsService.createProject(user.id, dto);
  }

  // ── :id + 하위 고정 경로 (구체적인 것부터) ─────────────────
  // PH1
  @Post(':id/phases')
  @UseGuards(JwtAuthGuard)
  createPhase(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePhaseRequestDto,
  ) {
    return this.phasesService.createPhase(user.id, id, dto);
  }

  // I1
  @Post(':id/invites')
  @UseGuards(JwtAuthGuard)
  createInvite(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.createInvite(user.id, id, dto);
  }

  // P8: Phase/Task 초기화 (OWNER만)
  @Post(':id/reset')
  @UseGuards(JwtAuthGuard)
  resetProject(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projectsService.resetProject(user.id, id);
  }

  // P6: 대시보드
  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard)
  getDashboard(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DashboardQueryDto,
  ) {
    return this.projectsService.getDashboard(user.id, id, query);
  }

  // I3
  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async listMembers(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.membersService.assertMember(id, user.id);
    return this.membersService.listMembers(id);
  }

  // I4 (OWNER만)
  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId') targetUserId: string,
  ) {
    await this.membersService.assertMember(id, user.id, true);
    return this.membersService.removeMember(id, targetUserId);
  }

  // ── :id 단일 파라미터 경로 (마지막에) ──────────────────────
  // P4: 프로젝트 상세
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getProjectDetail(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projectsService.getProjectDetail(user.id, id);
  }

  // P5
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  updateProject(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(user.id, id, dto);
  }

  // P7: 프로젝트 삭제 (OWNER만)
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProject(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.projectsService.deleteProject(user.id, id);
  }
}
