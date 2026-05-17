import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Project } from './entities/projects.entity';
import { User } from '../users/entities/user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PhasesService } from '../phases/phases.service';
import {
  CursorPaginatedDto,
  CursorPaginationQueryDto,
} from '../common/dto/cursor-pagination.dto';
import { decodeCursor, encodeCursor } from '../common/utils/cursor.util';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly phasesService: PhasesService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async listProjects(
    ownerId: string,
    query: CursorPaginationQueryDto,
  ): Promise<CursorPaginatedDto<Project>> {
    const limit = query.limit ?? 20;
    const cursorId = query.cursor ? decodeCursor(query.cursor) : null;

    const qb = this.projectRepository
      .createQueryBuilder('project')
      .leftJoin('project.owner', 'owner')
      .where('owner.id = :ownerId', { ownerId })
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

      await this.phasesService.createManyInTransaction(manager, savedProject, dto.phases);

      const createdProject = await manager.findOne(Project, {
        where: { id: savedProject.id },
        relations: {
          owner: true,
          phases: {
            tasks: true,
          },
        },
      });

      if (!createdProject) {
        throw new NotFoundException('Created project not found');
      }

      createdProject.phases.sort((a, b) => a.order - b.order);
      for (const phase of createdProject.phases) {
        phase.tasks.sort((a, b) => a.order - b.order);
      }

      return createdProject;
    });
  }

  async updateProject(
    ownerId: string,
    projectId: number,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: { owner: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.owner.id !== ownerId) {
      throw new ForbiddenException('Access denied');
    }

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

  private validateProjectDates(startDate: string, dueDate: string): void {
    if (new Date(startDate) > new Date(dueDate)) {
      throw new BadRequestException('startDate must be earlier than or equal to dueDate');
    }
  }
}
