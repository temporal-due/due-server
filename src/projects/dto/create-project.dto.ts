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
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(TaskStatus)
  status: TaskStatus;

  @IsInt()
  @Min(0)
  order: number;
}

export class CreatePhaseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  expectedStartDate: string;

  @IsDateString()
  expectedEndDate: string;

  @IsInt()
  @Min(0)
  order: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  tasks: CreateTaskDto[];
}

export class CreateProjectPersonalityDto {
  @IsString()
  @IsNotEmpty()
  preparationStyle: string;

  @IsString()
  additionalConsiderations: string;
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  projectName: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  dueDate: string;

  @IsInt()
  @Min(0)
  budget: number;

  @ValidateNested()
  @Type(() => CreateProjectPersonalityDto)
  personality: CreateProjectPersonalityDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePhaseDto)
  phases: CreatePhaseDto[];
}
