import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInviteDto {
  @ApiPropertyOptional({ example: '같이 계획 세워봐요!' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
