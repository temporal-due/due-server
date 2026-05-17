import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService, AuthTokens } from './auth.service';
import { SocialLoginDto } from './dto/social-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

export interface ProtectedResourceDto {
  message: string;
  userId: string;
  timestamp: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('social')
  async socialLogin(@Body() dto: SocialLoginDto): Promise<AuthTokens> {
    return this.authService.loginWithSocialIdToken(dto.provider, dto.idToken);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user.id);
    return { ok: true };
  }

  @ApiBearerAuth('access-token')
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

  @ApiBearerAuth('access-token')
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
