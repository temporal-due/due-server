import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { OAuthProvider } from '../../users/entities/user.entity';

export class SocialLoginDto {
  @ApiProperty({ enum: ['google', 'kakao', 'apple'], example: 'google' })
  @IsIn(['google', 'kakao', 'apple'])
  provider: OAuthProvider;

  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
