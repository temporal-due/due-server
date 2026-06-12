import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

// PH2: PATCH /phases/:phaseId — 듀 수정 모달(이름/기간/순서/메모/색상 부분 수정).
export class UpdatePhaseDto {
  @ApiPropertyOptional({ example: '큰 결정' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional({ example: '2026-01-11' })
  @IsOptional()
  @IsDateString()
  expectedStartDate?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ example: '메모를 입력하세요' })
  @IsOptional()
  @IsString()
  memo?: string;

  @ApiPropertyOptional({ example: '#FFB74D' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color like #RRGGBB' })
  color?: string;
}
