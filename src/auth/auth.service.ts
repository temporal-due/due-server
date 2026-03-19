import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { KakaoProfile } from '../users/users.service';

export interface TokenPayload {
  sub: string;
  email?: string;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    nickname: string | null;
    email: string | null;
    profileImageUrl: string | null;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async login(user: User): Promise<AuthTokens> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      type: 'access',
    };
    const expiresInStr =
      this.configService.get<string>('JWT_ACCESS_EXPIRES') ?? '15m';
    const expiresInSec = expiresInStr.endsWith('m')
      ? parseInt(expiresInStr, 10) * 60
      : expiresInStr.endsWith('h')
        ? parseInt(expiresInStr, 10) * 3600
        : parseInt(expiresInStr, 10) || 900;
    const accessToken = this.jwtService.sign(payload as object, {
      secret: this.configService.get<string>('JWT_SECRET') ?? 'default-secret',
      expiresIn: expiresInSec,
    });

    const refreshExpiresSec =
      Number(this.configService.get<string>('JWT_REFRESH_EXPIRES_SEC')) ||
      604800;
    const refreshPayload: TokenPayload = { sub: user.id, type: 'refresh' };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_SECRET') ?? 'default-secret',
      expiresIn: refreshExpiresSec,
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, hashedRefresh);

    const expiresIn = 900; // 15m in seconds

    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
      },
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('User not found');
    }
    const valid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.login(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  /**
   * SPA 방식: 프론트가 받은 카카오 code를 토큰으로 교환하고 프로필 조회 후 우리 User 반환
   */
  async exchangeKakaoCode(code: string, redirectUri: string): Promise<User> {
    const clientId = this.configService.get<string>('KAKAO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('KAKAO_CLIENT_SECRET');
    if (!clientId)
      throw new UnauthorizedException('KAKAO_CLIENT_ID not configured');

    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        ...(clientSecret && { client_secret: clientSecret }),
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new UnauthorizedException(`Kakao token exchange failed: ${err}`);
    }
    const tokenData = (await tokenRes.json()) as { access_token: string };
    const kakaoAccessToken = tokenData.access_token;

    const profileRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });
    if (!profileRes.ok) {
      throw new UnauthorizedException('Kakao profile fetch failed');
    }
    const raw = (await profileRes.json()) as {
      id: number;
      kakao_account?: {
        email?: string;
        profile?: { nickname?: string; profile_image_url?: string };
      };
      properties?: { nickname?: string; profile_image?: string };
    };

    const profile: KakaoProfile = {
      id: raw.id,
      displayName:
        raw.properties?.nickname ??
        raw.kakao_account?.profile?.nickname ??
        undefined,
      _json: raw,
    };
    return this.usersService.findOrCreateByKakao(profile);
  }
}
