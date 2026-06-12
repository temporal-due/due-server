import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { TaskAssignee, TaskStatus } from '../../tasks/entities/task.entity';
import {
  PlanLevel,
  PreparationStyle,
  ProjectType,
  ScheduleMode,
} from '../entities/projects.entity';

export class CreateTaskDto {
  @ApiProperty({ example: 'Define requirements' })
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

export class CreatePhaseDto {
  @ApiProperty({ example: 'Planning' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  expectedStartDate: string;

  @ApiProperty({ example: '2026-05-31' })
  @IsDateString()
  expectedEndDate: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  order: number;

  @ApiPropertyOptional({ example: '메모 내용' })
  @IsOptional()
  @IsString()
  memo?: string;

  @ApiPropertyOptional({ example: '#FFB74D' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color like #RRGGBB' })
  color?: string;

  // planLevel=OUTLINE이면 빈 배열 허용
  @ApiProperty({ type: () => [CreateTaskDto] })
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  tasks: CreateTaskDto[];
}

export class CreateProjectPersonalityDto {
  @ApiPropertyOptional({ example: 'Focus on quality' })
  @IsOptional()
  @IsString()
  additionalConsiderations?: string;
}

export class CreateProjectDto {
  @ApiPropertyOptional({ enum: ProjectType })
  @IsOptional()
  @IsEnum(ProjectType)
  type?: ProjectType;

  @ApiProperty({ example: '결혼식' })
  @IsString()
  @IsNotEmpty()
  projectName: string;

  @ApiPropertyOptional({ enum: PreparationStyle })
  @IsOptional()
  @IsEnum(PreparationStyle)
  style?: PreparationStyle;

  @ApiPropertyOptional({ enum: PlanLevel })
  @IsOptional()
  @IsEnum(PlanLevel)
  planLevel?: PlanLevel;

  @ApiPropertyOptional({ enum: ScheduleMode, default: ScheduleMode.FIXED })
  @IsOptional()
  @IsEnum(ScheduleMode)
  scheduleMode?: ScheduleMode;

  @ApiPropertyOptional({ example: '#FF8A65' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color like #RRGGBB' })
  color?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'scheduleMode=FLEXIBLE이면 생략 가능' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ example: 50000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({ type: () => CreateProjectPersonalityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProjectPersonalityDto)
  personality?: CreateProjectPersonalityDto;

  @ApiProperty({ type: () => [CreatePhaseDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePhaseDto)
  phases: CreatePhaseDto[];
}
