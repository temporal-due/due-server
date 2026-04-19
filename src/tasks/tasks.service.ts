import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Task, TaskStatus } from './entities/task.entity';
import { Phase } from '../phases/entities/phase.entity';
import { CreateTaskDto } from '../projects/dto/create-project.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
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
          status: taskDto.status,
          order: taskDto.order,
          phase,
        }),
      );
    }
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
}
