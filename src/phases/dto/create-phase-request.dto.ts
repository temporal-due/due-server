import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

// PH1: POST /projects/:id/phases — "Due 추가하기"로 빈 Phase를 새로 만든다(Task는 T1로 추가).
export class CreatePhaseRequestDto {
  @ApiProperty({ example: '큰 결정' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2026-01-11' })
  @IsDateString()
  expectedStartDate: string;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  expectedEndDate: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  order: number;

  @ApiPropertyOptional({ example: '예물·예단 생략 예정' })
  @IsOptional()
  @IsString()
  memo?: string;

  @ApiPropertyOptional({ example: '#FFB74D' })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color like #RRGGBB' })
  color?: string;
}
