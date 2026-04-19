import { Body, Controller, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskOrderDto } from './dto/update-task-order.dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Patch(':taskId/status')
  updateStatus(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(taskId, dto.status);
  }

  @Patch(':taskId/order')
  updateOrder(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskOrderDto,
  ) {
    return this.tasksService.updateOrder(taskId, dto.order);
  }
}
