import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Phase } from './entities/phase.entity';
import { Project } from '../projects/entities/projects.entity';
import { CreatePhaseDto } from '../projects/dto/create-project.dto';
import { CreatePhaseRequestDto } from './dto/create-phase-request.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class PhasesService {
  constructor(
    @InjectRepository(Phase)
    private readonly phasesRepository: Repository<Phase>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
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

  // PH1: 프로젝트에 빈 Phase 하나를 추가한다.
  async createPhase(
    userId: string,
    projectId: number,
    dto: CreatePhaseRequestDto,
  ): Promise<Phase> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
      relations: { owner: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    if (project.owner.id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    this.validatePhaseDates(dto.expectedStartDate, dto.expectedEndDate);
    await this.assertPhaseOrderAvailable(projectId, dto.order);

    const phase = this.phasesRepository.create({
      name: dto.name,
      expectedStartDate: new Date(dto.expectedStartDate),
      expectedEndDate: new Date(dto.expectedEndDate),
      order: dto.order,
      memo: dto.memo ?? null,
      color: dto.color ?? null,
      project,
    });
    const saved = await this.phasesRepository.save(phase);
    // 응답에 project.owner(refreshToken 포함)가 새어나가지 않도록 관계 없이 재조회한다.
    return this.phasesRepository.findOneByOrFail({ id: saved.id });
  }

  // PH2: 듀 수정 모달. 부분 수정.
  async updatePhase(userId: string, phaseId: number, dto: UpdatePhaseDto): Promise<Phase> {
    const phase = await this.findOwnedPhase(userId, phaseId);

    const toIso = (d: Date | string) => new Date(d).toISOString().split('T')[0];
    const effectiveStart = dto.expectedStartDate ?? toIso(phase.expectedStartDate);
    const effectiveEnd = dto.expectedEndDate ?? toIso(phase.expectedEndDate);
    this.validatePhaseDates(effectiveStart, effectiveEnd);

    if (dto.order !== undefined && dto.order !== phase.order) {
      await this.assertPhaseOrderAvailable(phase.project.id, dto.order, phase.id);
    }

    if (dto.name !== undefined) phase.name = dto.name;
    if (dto.expectedStartDate !== undefined) phase.expectedStartDate = new Date(dto.expectedStartDate);
    if (dto.expectedEndDate !== undefined) phase.expectedEndDate = new Date(dto.expectedEndDate);
    if (dto.order !== undefined) phase.order = dto.order;
    if (dto.memo !== undefined) phase.memo = dto.memo;
    if (dto.color !== undefined) phase.color = dto.color;

    await this.phasesRepository.save(phase);
    return this.phasesRepository.findOneByOrFail({ id: phase.id });
  }

  // PH3: Phase 삭제. 하위 Task는 FK ON DELETE CASCADE로 함께 제거된다.
  async deletePhase(userId: string, phaseId: number): Promise<void> {
    const phase = await this.findOwnedPhase(userId, phaseId);
    await this.phasesRepository.remove(phase);
  }

  async updateOrder(phaseId: number, order: number): Promise<Phase> {
    const phase = await this.phasesRepository.findOne({ where: { id: phaseId } });
    if (!phase) {
      throw new NotFoundException('Phase not found');
    }

    phase.order = order;
    return this.phasesRepository.save(phase);
  }

  // phase → project → owner 권한 확인 후 Phase 반환.
  private async findOwnedPhase(userId: string, phaseId: number): Promise<Phase> {
    const phase = await this.phasesRepository.findOne({
      where: { id: phaseId },
      relations: { project: { owner: true } },
    });
    if (!phase) {
      throw new NotFoundException('Phase not found');
    }
    if (phase.project.owner.id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return phase;
  }

  // 같은 프로젝트 내 Phase order 중복 금지(서버 자동 재배열 안 함).
  private async assertPhaseOrderAvailable(
    projectId: number,
    order: number,
    excludePhaseId?: number,
  ): Promise<void> {
    const qb = this.phasesRepository
      .createQueryBuilder('phase')
      .leftJoin('phase.project', 'project')
      .where('project.id = :projectId', { projectId })
      .andWhere('phase.order = :order', { order });
    if (excludePhaseId !== undefined) {
      qb.andWhere('phase.id != :excludePhaseId', { excludePhaseId });
    }
    if ((await qb.getCount()) > 0) {
      throw new BadRequestException(`Duplicate phase order detected: ${order}`);
    }
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
