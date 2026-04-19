import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Phase } from './entities/phase.entity';
import { Project } from '../projects/entities/projects.entity';
import { CreatePhaseDto } from '../projects/dto/create-project.dto';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class PhasesService {
  constructor(
    @InjectRepository(Phase)
    private readonly phasesRepository: Repository<Phase>,
    private readonly tasksService: TasksService,
  ) {}

  async createManyInTransaction(
    manager: EntityManager,
    project: Project,
    phases: CreatePhaseDto[],
  ): Promise<void> {
    this.validateDuplicateOrders(
      phases.map((phase) => phase.order),
      'phase order',
    );

    for (const phaseDto of phases) {
      this.validatePhaseDates(phaseDto.expectedStartDate, phaseDto.expectedEndDate);
      this.validateDuplicateOrders(
        phaseDto.tasks.map((task) => task.order),
        `task order in phase(${phaseDto.name})`,
      );

      const savedPhase = await manager.save(
        manager.create(Phase, {
          name: phaseDto.name,
          expectedStartDate: new Date(phaseDto.expectedStartDate),
          expectedEndDate: new Date(phaseDto.expectedEndDate),
          order: phaseDto.order,
          project,
        }),
      );

      await this.tasksService.createManyInTransaction(manager, savedPhase, phaseDto.tasks);
    }
  }

  async updateOrder(phaseId: number, order: number): Promise<Phase> {
    const phase = await this.phasesRepository.findOne({ where: { id: phaseId } });
    if (!phase) {
      throw new NotFoundException('Phase not found');
    }

    phase.order = order;
    return this.phasesRepository.save(phase);
  }

  private validatePhaseDates(startDate: string, endDate: string): void {
    if (new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException(
        'expectedStartDate must be earlier than or equal to expectedEndDate',
      );
    }
  }

  private validateDuplicateOrders(orders: number[], label: string): void {
    const uniqueCount = new Set(orders).size;
    if (uniqueCount !== orders.length) {
      throw new BadRequestException(`Duplicate ${label} detected`);
    }
  }
}
