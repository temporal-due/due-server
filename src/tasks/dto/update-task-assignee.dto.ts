import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TaskAssignee } from '../entities/task.entity';

export class UpdateTaskAssigneeDto {
  @ApiProperty({ enum: TaskAssignee })
  @IsEnum(TaskAssignee)
  assignee: TaskAssignee;
}
