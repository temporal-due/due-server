import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { UpdateTaskOrderDto } from './dto/update-task-order.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BulkDeleteTasksDto } from './dto/bulk-delete-tasks.dto';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // T4: 선택 항목 모두 삭제하기 (':taskId' 보다 먼저 선언해 리터럴 경로 우선)
  @Post('bulk-delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  bulkDelete(@CurrentUser() user: User, @Body() dto: BulkDeleteTasksDto) {
    return this.tasksService.bulkDelete(user.id, dto.ids);
  }

  // T2: 항목 편집
  @Patch(':taskId')
  updateTask(
    @CurrentUser() user: User,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(user.id, taskId, dto);
  }

  // T3: 항목 삭제
  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTask(
    @CurrentUser() user: User,
    @Param('taskId', ParseIntPipe) taskId: number,
  ) {
    return this.tasksService.deleteTask(user.id, taskId);
  }

  // T6: 상태(기존 유지)
  @Patch(':taskId/status')
  updateStatus(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateStatus(taskId, dto.status);
  }

  // T7: 정렬(기존 유지)
  @Patch(':taskId/order')
  updateOrder(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: UpdateTaskOrderDto,
  ) {
    return this.tasksService.updateOrder(taskId, dto.order);
  }
}
