import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  PlanLevel,
  PreparationStyle,
  ProjectType,
  ScheduleMode,
} from '../entities/projects.entity';

export class SuggestProjectRequestDto {
  @ApiProperty({ enum: ProjectType })
  @IsEnum(ProjectType)
  type: ProjectType;

  @ApiPropertyOptional({ example: '나만의 프로젝트', description: 'type=CUSTOM일 때 사용' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectName?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ enum: ScheduleMode, default: ScheduleMode.FIXED })
  @IsOptional()
  @IsEnum(ScheduleMode)
  scheduleMode?: ScheduleMode;

  @ApiProperty({ enum: PreparationStyle })
  @IsEnum(PreparationStyle)
  style: PreparationStyle;

  @ApiPropertyOptional({ enum: PlanLevel, default: PlanLevel.DETAILED })
  @IsOptional()
  @IsEnum(PlanLevel)
  planLevel?: PlanLevel;

  @ApiPropertyOptional({ example: '예물·예단 생략, DVD 희망' })
  @IsOptional()
  @IsString()
  additionalConsiderations?: string;
}
