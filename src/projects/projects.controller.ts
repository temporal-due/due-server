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

  // PH1: Due 추가하기
  @Post(':id/phases')
  @UseGuards(JwtAuthGuard)
  createPhase(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePhaseRequestDto,
  ) {
    return this.phasesService.createPhase(user.id, id, dto);
  }

  // I1: 초대 코드 발급
  @Post(':id/invites')
  @UseGuards(JwtAuthGuard)
  createInvite(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.createInvite(user.id, id, dto);
  }

  // I3: 멤버 목록 조회
  @Get(':id/members')
  @UseGuards(JwtAuthGuard)
  async listMembers(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.membersService.assertMember(id, user.id);
    return this.membersService.listMembers(id);
  }

  // I4: 멤버 제거 (OWNER만)
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
}
