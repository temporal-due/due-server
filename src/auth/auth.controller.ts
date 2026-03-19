import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService, AuthTokens } from './auth.service';
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
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /** SPA 방식: 프론트가 code를 보내면 토큰 교환 후 JSON으로 accessToken, refreshToken 반환 */
  @Post('kakao/token')
  async kakaoToken(
    @Body() body: { code: string; redirectUri: string },
  ): Promise<AuthTokens> {
    const user = await this.authService.exchangeKakaoCode(
      body.code,
      body.redirectUri,
    );
    return this.authService.login(user);
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
