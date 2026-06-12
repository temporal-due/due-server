import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Project } from './entities/projects.entity';
import { User } from '../users/entities/user.entity';
import { Phase } from '../phases/entities/phase.entity';
import { Task, TaskStatus } from '../tasks/entities/task.entity';
import { ProjectMember, ProjectRole } from '../members/entities/project-member.entity';
import { MembersService } from '../members/members.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { PhasesService } from '../phases/phases.service';
import {
  CursorPaginatedDto,
  CursorPaginationQueryDto,
} from '../common/dto/cursor-pagination.dto';
import { decodeCursor, encodeCursor } from '../common/utils/cursor.util';

// 대시보드 그룹 내 Task 아이템 형태 (phaseId/phaseName 포함).
export interface TaskItem {
  id: number;
  name: string;
  status: TaskStatus;
  assignee: string;
  dueDate: Date | null;
  order: number;
  phaseId: number;
  phaseName: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly phasesService: PhasesService,
    private readonly membersService: MembersService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async listProjects(
    userId: string,
    query: CursorPaginationQueryDto,
  ): Promise<CursorPaginatedDto<Project>> {
    const limit = query.limit ?? 20;
    const cursorId = query.cursor ? decodeCursor(query.cursor) : null;

    const projectIds = await this.membersService.getProjectIdsForUser(userId);
    if (projectIds.length === 0) {
      return { data: [], nextCursor: null, hasMore: false };
    }

    const qb = this.projectRepository
      .createQueryBuilder('project')
      .where('project.id IN (:...projectIds)', { projectIds })
      .orderBy('project.id', 'DESC')
      .take(limit + 1);

    if (cursorId !== null) {
      qb.andWhere('project.id < :cursorId', { cursorId });
    }

    const results = await qb.getMany();
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    const nextCursor =
      hasMore ? encodeCursor(data[data.length - 1].id) : null;

    return { data, nextCursor, hasMore };
  }

  async createProject(ownerId: string, dto: CreateProjectDto): Promise<Project> {
    this.validateProjectDates(dto.startDate, dto.dueDate);
    return this.dataSource.transaction(async (manager) => {
      const owner = await manager.findOne(User, { where: { id: ownerId } });
      if (!owner) {
        throw new NotFoundException('Owner user not found');
      }

      const savedProject = await manager.save(
        manager.create(Project, {
          projectName: dto.projectName,
          startDate: new Date(dto.startDate),
          dueDate: new Date(dto.dueDate),
          budget: dto.budget,
          personality: dto.personality,
          owner,
        }),
      );

      await manager.save(
        manager.create(ProjectMember, {
          project: savedProject,
          user: owner,
          role: ProjectRole.OWNER,
        }),
      );

      await this.phasesService.createManyInTransaction(manager, savedProject, dto.phases);

      const createdProject = await manager.findOne(Project, {
        where: { id: savedProject.id },
        relations: { owner: true, phases: { tasks: true } },
      });
      if (!createdProject) throw new NotFoundException('Created project not found');

      createdProject.phases.sort((a, b) => a.order - b.order);
      for (const phase of createdProject.phases) {
        phase.tasks.sort((a, b) => a.order - b.order);
      }

      return createdProject;
    });
  }

  async updateProject(
    userId: string,
    projectId: number,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException('Project not found');
    await this.membersService.assertMember(projectId, userId);

    const effectiveStart =
      dto.startDate ?? new Date(project.startDate).toISOString().split('T')[0];
    const effectiveDue =
      dto.dueDate ?? new Date(project.dueDate).toISOString().split('T')[0];
    this.validateProjectDates(effectiveStart, effectiveDue);

    if (dto.projectName !== undefined) project.projectName = dto.projectName;
    if (dto.startDate !== undefined) project.startDate = new Date(dto.startDate);
    if (dto.dueDate !== undefined) project.dueDate = new Date(dto.dueDate);
    if (dto.budget !== undefined) project.budget = dto.budget;
    if (dto.personality !== undefined) project.personality = dto.personality;

    return this.projectRepository.save(project);
  }

  // P4: 프로젝트 상세 + 진행률 + 멤버.
  async getProjectDetail(userId: string, projectId: number) {
    await this.membersService.assertMember(projectId, userId);

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: { phases: { tasks: true } },
    });
    if (!project) throw new NotFoundException('Project not found');

    project.phases.sort((a, b) => a.order - b.order);
    for (const phase of project.phases) {
      phase.tasks.sort((a, b) => a.order - b.order);
    }

    const allTasks = project.phases.flatMap((p) => p.tasks);
    const progress = this.calculateProgress(allTasks);
    const members = await this.membersService.listMembers(projectId);

    return { ...project, progress, members };
  }

  // P6: 대시보드 (진행률 + 빠르게 해야 할 일 + 그룹).
  async getDashboard(userId: string, projectId: number, query: DashboardQueryDto) {
    await this.membersService.assertMember(projectId, userId);

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: { phases: { tasks: true } },
    });
    if (!project) throw new NotFoundException('Project not found');

    project.phases.sort((a, b) => a.order - b.order);
    for (const phase of project.phases) {
      phase.tasks.sort((a, b) => a.order - b.order);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dday = Math.ceil(
      (new Date(project.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    const allTasks = project.phases.flatMap((phase) =>
      phase.tasks.map((task) => this.annotate(task, phase)),
    );

    const progress = this.calculateProgress(allTasks);

    const upcoming = allTasks
      .filter((t) => t.dueDate != null && t.status !== TaskStatus.DONE)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5)
      .map((t) => ({ taskId: t.id, name: t.name, assignee: t.assignee, dueDate: t.dueDate }));

    const members = await this.membersService.listMembers(projectId);
    const groupBy = query.groupBy ?? 'role';
    const filter = query.filter ?? 'task';
    const groups = this.buildGroups(project.phases, allTasks, groupBy, filter, members);

    return {
      project: {
        id: project.id,
        projectName: project.projectName,
        dueDate: project.dueDate,
        dday,
        color: project.color,
      },
      progress,
      upcoming,
      groups,
    };
  }

  // P7: 프로젝트 삭제 (OWNER만, Phase/Task/멤버/초대 CASCADE).
  async deleteProject(userId: string, projectId: number): Promise<void> {
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException('Project not found');
    await this.membersService.assertMember(projectId, userId, true);
    await this.projectRepository.remove(project);
  }

  // P8: Phase/Task 초기화. 프로젝트·멤버는 유지.
  async resetProject(userId: string, projectId: number): Promise<Project> {
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException('Project not found');
    await this.membersService.assertMember(projectId, userId, true);

    await this.dataSource.getRepository(Phase).delete({ project: { id: projectId } });

    const emptied = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: { phases: true },
    });
    return emptied!;
  }

  // --- private helpers ---

  private annotate(task: Task, phase: Phase): TaskItem {
    return {
      id: task.id,
      name: task.name,
      status: task.status,
      assignee: task.assignee,
      dueDate: task.dueDate,
      order: task.order,
      phaseId: phase.id,
      phaseName: phase.name,
    };
  }

  private calculateProgress(tasks: TaskItem[] | Task[]) {
    const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const inProgress = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const notStarted = tasks.filter((t) => t.status === TaskStatus.TODO).length;
    const total = tasks.length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, inProgress, notStarted, total, percent };
  }

  private buildGroups(
    phases: Phase[],
    allTasks: TaskItem[],
    groupBy: 'role' | 'due',
    filter: 'task' | 'schedule',
    members: { userId: string; nickname: string | null; role: ProjectRole }[],
  ) {
    if (groupBy === 'role') {
      const ownerNick = members.find((m) => m.role === ProjectRole.OWNER)?.nickname;
      const partnerNick = members.find((m) => m.role === ProjectRole.PARTNER)?.nickname;
      const labelMap: Record<string, string> = {
        OWNER: ownerNick ? `${ownerNick} 할 일` : '나 할 일',
        PARTNER: partnerNick ? `${partnerNick} 할 일` : '파트너 할 일',
        TOGETHER: '함께 할 일',
        UNASSIGNED: '미배정',
      };
      const buckets: Record<string, TaskItem[]> = {
        OWNER: [], PARTNER: [], TOGETHER: [], UNASSIGNED: [],
      };
      for (const task of allTasks) {
        buckets[task.assignee].push(task);
      }
      return (['OWNER', 'PARTNER', 'TOGETHER', 'UNASSIGNED'] as const)
        .filter((key) => buckets[key].length > 0)
        .map((key) => ({
          key,
          label: labelMap[key],
          count: buckets[key].length,
          done: buckets[key].filter((t) => t.status === TaskStatus.DONE).length,
          tasks: this.applyFilter(buckets[key], filter),
        }));
    } else {
      // groupBy=due: Phase(듀)별 그룹
      return phases
        .filter((phase) => (phase.tasks || []).length > 0)
        .map((phase) => {
          const phaseTasks = allTasks.filter((t) => t.phaseId === phase.id);
          return {
            key: String(phase.id),
            label: phase.name,
            count: phaseTasks.length,
            done: phaseTasks.filter((t) => t.status === TaskStatus.DONE).length,
            tasks: this.applyFilter(phaseTasks, filter),
          };
        });
    }
  }

  private applyFilter(tasks: TaskItem[], filter: 'task' | 'schedule'): TaskItem[] {
    if (filter === 'schedule') {
      return tasks
        .filter((t) => t.dueDate != null)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    }
    return tasks;
  }

  private validateProjectDates(startDate: string, dueDate: string): void {
    if (new Date(startDate) > new Date(dueDate)) {
      throw new BadRequestException('startDate must be earlier than or equal to dueDate');
    }
  }
}
