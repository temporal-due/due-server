import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { OAuthProvider } from '../../users/entities/user.entity';

export class SocialLoginDto {
  @IsIn(['google', 'kakao', 'apple'])
  provider: OAuthProvider;

  @IsString()
  @IsNotEmpty()
  idToken: string;
}
