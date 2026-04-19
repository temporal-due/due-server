import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Project } from './entities/projects.entity';
import { User } from '../users/entities/user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { PhasesService } from '../phases/phases.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly phasesService: PhasesService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async listProjects(ownerId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { owner: { id: ownerId } },
      order: { createdAt: 'DESC' },
    });
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

  private validateProjectDates(startDate: string, dueDate: string): void {
    if (new Date(startDate) > new Date(dueDate)) {
      throw new BadRequestException('startDate must be earlier than or equal to dueDate');
    }
  }

}
