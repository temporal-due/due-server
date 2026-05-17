import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateTaskOrderDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  order: number;
}
