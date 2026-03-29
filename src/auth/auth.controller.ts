import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService, AuthTokens } from './auth.service';
import { SocialLoginDto } from './dto/social-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

export interface ProtectedResourceDto {
  message: string;
  userId: string;
  timestamp: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 프론트 SDK 로그인 후 받은 OIDC ID Token으로 검증·회원 연동 후 우리 JWT 발급
   */
  @Post('social')
  async socialLogin(@Body() dto: SocialLoginDto): Promise<AuthTokens> {
    return this.authService.loginWithSocialIdToken(dto.provider, dto.idToken);
  }

  @Post('refresh')
  async refresh(@Body() dto: { refreshToken: string }) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user.id);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      profileImageUrl: user.profileImageUrl,
    };
  }

  @Get('protected-sample')
  @UseGuards(JwtAuthGuard)
  protectedSample(@CurrentUser() user: User): ProtectedResourceDto {
    return {
      message: '보호된 리소스입니다. 로그인된 사용자만 조회할 수 있습니다.',
      userId: user.id,
      timestamp: new Date().toISOString(),
    };
  }
}
