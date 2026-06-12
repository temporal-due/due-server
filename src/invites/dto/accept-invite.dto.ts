import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({ example: 'AB12CD34' })
  @IsString()
  @Length(8, 8)
  code: string;
}
