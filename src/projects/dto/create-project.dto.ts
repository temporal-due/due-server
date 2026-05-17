import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TaskStatus } from '../../tasks/entities/task.entity';

export class CreateTaskDto {
  @ApiProperty({ example: 'Define requirements' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  order: number;
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

  @ApiProperty({ type: () => [CreateTaskDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  tasks: CreateTaskDto[];
}

export class CreateProjectPersonalityDto {
  @ApiProperty({ example: 'systematic' })
  @IsString()
  @IsNotEmpty()
  preparationStyle: string;

  @ApiProperty({ example: 'Focus on quality', required: false })
  @IsString()
  additionalConsiderations: string;
}

export class CreateProjectDto {
  @ApiProperty({ example: 'My Project' })
  @IsString()
  @IsNotEmpty()
  projectName: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ example: 5000000 })
  @IsInt()
  @Min(0)
  budget: number;

  @ApiProperty({ type: () => CreateProjectPersonalityDto })
  @ValidateNested()
  @Type(() => CreateProjectPersonalityDto)
  personality: CreateProjectPersonalityDto;

  @ApiProperty({ type: () => [CreatePhaseDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePhaseDto)
  phases: CreatePhaseDto[];
}
