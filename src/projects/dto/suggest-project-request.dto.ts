import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class SuggestProjectRequestDto {
  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ example: 'systematic' })
  @IsString()
  @IsNotEmpty()
  preparationStyle: string;

  @ApiProperty({ example: 'Focus on quality', required: false })
  @IsString()
  @IsOptional()
  additionalConsiderations?: string;
}
