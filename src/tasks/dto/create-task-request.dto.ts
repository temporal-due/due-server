import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TaskAssignee, TaskStatus } from '../entities/task.entity';

// T1: POST /phases/:phaseId/tasks — "새로운 항목 추가하기".
export class CreateTaskRequestDto {
  @ApiProperty({ example: '날짜 확정' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  order: number;

  @ApiPropertyOptional({ enum: TaskAssignee, default: TaskAssignee.UNASSIGNED })
  @IsOptional()
  @IsEnum(TaskAssignee)
  assignee?: TaskAssignee;

  @ApiPropertyOptional({ example: '2026-05-12' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
