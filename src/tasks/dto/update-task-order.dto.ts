import { IsInt, Min } from 'class-validator';

export class UpdateTaskOrderDto {
  @IsInt()
  @Min(0)
  order: number;
}
