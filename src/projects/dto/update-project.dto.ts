import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
import { PreparationStyle, ScheduleMode } from '../entities/projects.entity';
import { CreateProjectPersonalityDto } from './create-project.dto';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: '새 프로젝트 이름' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectName?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 50000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({ example: '#FF8A65' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color like #RRGGBB' })
  color?: string;

  @ApiPropertyOptional({ enum: PreparationStyle })
  @IsOptional()
  @IsEnum(PreparationStyle)
  style?: PreparationStyle;

  @ApiPropertyOptional({ enum: ScheduleMode })
  @IsOptional()
  @IsEnum(ScheduleMode)
  scheduleMode?: ScheduleMode;

  @ApiPropertyOptional({ type: () => CreateProjectPersonalityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProjectPersonalityDto)
  personality?: CreateProjectPersonalityDto;
}
