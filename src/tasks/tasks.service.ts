import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Task, TaskAssignee, TaskStatus } from './entities/task.entity';
import { Phase } from '../phases/entities/phase.entity';
import { MembersService } from '../members/members.service';
import { CreateTaskDto } from '../projects/dto/create-project.dto';
import { CreateTaskRequestDto } from './dto/create-task-request.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskAssignee as TA } from './entities/task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Phase)
    private readonly phasesRepository: Repository<Phase>,
    private readonly membersService: MembersService,
  ) {}

  async createManyInTransaction(
    manager: EntityManager,
    phase: Phase,
    tasks: CreateTaskDto[],
  ): Promise<void> {
    for (const taskDto of tasks) {
      await manager.save(
        manager.create(Task, {
          name: taskDto.name,
          status: taskDto.status ?? TaskStatus.TODO,
          order: taskDto.order,
          assignee: taskDto.assignee ?? TaskAssignee.UNASSIGNED,
          dueDate: taskDto.dueDate ? new Date(taskDto.dueDate) : null,
          phase,
        }),
      );
    }
  }

  // T1: Phase에 항목 하나를 추가한다.
  async createTask(
    userId: string,
    phaseId: number,
    dto: CreateTaskRequestDto,
  ): Promise<Task> {
    const phase = await this.phasesRepository.findOne({
      where: { id: phaseId },
      relations: { project: true },
    });
    if (!phase) {
      throw new NotFoundException('Phase not found');
    }
    await this.membersService.assertMember(phase.project.id, userId);

    await this.assertTaskOrderAvailable(phaseId, dto.order);

    const task = this.tasksRepository.create({
      name: dto.name,
      status: dto.status ?? TaskStatus.TODO,
      order: dto.order,
      assignee: dto.assignee ?? TaskAssignee.UNASSIGNED,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      phase,
    });
    const saved = await this.tasksRepository.save(task);
    return this.tasksRepository.findOneByOrFail({ id: saved.id });
  }

  // T2: 항목 편집(이름/마감일/순서).
  async updateTask(userId: string, taskId: number, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findAuthorizedTask(userId, taskId);

    if (dto.order !== undefined && dto.order !== task.order) {
      await this.assertTaskOrderAvailable(task.phase.id, dto.order, task.id);
    }

    if (dto.name !== undefined) task.name = dto.name;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.order !== undefined) task.order = dto.order;

    await this.tasksRepository.save(task);
    return this.tasksRepository.findOneByOrFail({ id: task.id });
  }

  // T3: 항목 삭제.
  async deleteTask(userId: string, taskId: number): Promise<void> {
    const task = await this.findAuthorizedTask(userId, taskId);
    await this.tasksRepository.remove(task);
  }

  // T4: 선택 항목 일괄 삭제. 모두 한 프로젝트 소속 + 멤버 소유여야 한다.
  async bulkDelete(userId: string, ids: number[]): Promise<void> {
    const uniqueIds = [...new Set(ids)];
    const tasks = await this.tasksRepository.find({
      where: { id: In(uniqueIds) },
      relations: { phase: { project: true } },
    });

    if (tasks.length !== uniqueIds.length) {
      throw new NotFoundException('Some tasks not found');
    }

    const projectIds = new Set(tasks.map((task) => task.phase.project.id));
    if (projectIds.size > 1) {
      throw new BadRequestException('All tasks must belong to the same project');
    }

    await this.membersService.assertMember([...projectIds][0], userId);

    await this.tasksRepository.remove(tasks);
  }

  // T5: 담당 배정.
  async updateAssignee(taskId: number, assignee: TA): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    task.assignee = assignee;
    return this.tasksRepository.save(task);
  }

  async updateStatus(taskId: number, status: TaskStatus): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    task.status = status;
    return this.tasksRepository.save(task);
  }

  async updateOrder(taskId: number, order: number): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    task.order = order;
    return this.tasksRepository.save(task);
  }

  // Task 존재 확인 + 멤버 권한 확인 후 Task 반환 (phase.project 관계 포함).
  private async findAuthorizedTask(userId: string, taskId: number): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id: taskId },
      relations: { phase: { project: true } },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.membersService.assertMember(task.phase.project.id, userId);
    return task;
  }

  // 같은 Phase 내 Task order 중복 금지.
  private async assertTaskOrderAvailable(
    phaseId: number,
    order: number,
    excludeTaskId?: number,
  ): Promise<void> {
    const qb = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoin('task.phase', 'phase')
      .where('phase.id = :phaseId', { phaseId })
      .andWhere('task.order = :order', { order });
    if (excludeTaskId !== undefined) {
      qb.andWhere('task.id != :excludeTaskId', { excludeTaskId });
    }
    if ((await qb.getCount()) > 0) {
      throw new BadRequestException(`Duplicate task order detected: ${order}`);
    }
  }
}
