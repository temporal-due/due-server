import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CursorPaginationQueryDto {
  @ApiPropertyOptional({ description: '이전 응답의 nextCursor 값' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: '페이지당 항목 수 (기본 20, 최대 100)', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class CursorPaginatedDto<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ nullable: true, type: String, description: '다음 페이지 cursor. null이면 마지막 페이지' })
  nextCursor: string | null;

  @ApiProperty()
  hasMore: boolean;
}
