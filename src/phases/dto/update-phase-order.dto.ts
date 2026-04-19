import { IsInt, Min } from 'class-validator';

export class UpdatePhaseOrderDto {
  @IsInt()
  @Min(0)
  order: number;
}
