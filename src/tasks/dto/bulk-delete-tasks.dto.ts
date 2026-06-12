import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

// T4: POST /tasks/bulk-delete — "선택 항목 모두 삭제하기".
export class BulkDeleteTasksDto {
  @ApiProperty({ type: [Number], example: [10, 11, 12] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Type(() => Number)
  ids: number[];
}
