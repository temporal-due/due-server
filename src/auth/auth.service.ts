import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { OAuthProvider, User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

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

type ProviderJwksConfig = {
  issuer: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
};

@Injectable()
export class AuthService {
  private readonly providers: Record<OAuthProvider, ProviderJwksConfig> = {
    google: {
      issuer: 'https://accounts.google.com',
      jwks: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
    },
    kakao: {
      issuer: 'https://kauth.kakao.com',
      jwks: createRemoteJWKSet(new URL('https://kauth.kakao.com/.well-known/jwks.json')),
    },
    apple: {
      issuer: 'https://appleid.apple.com',
      jwks: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
    },
  };

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

  async devLogin(): Promise<AuthTokens> {
    const user = await this.usersService.findOrCreateByOAuth({
      provider: 'google',
      providerId: 'dev-user-local',
      email: 'dev@local.test',
      nickname: 'Dev User',
      profileImageUrl: null,
    });
    return this.login(user);
  }

  /**
   * 프론트 SDK가 받은 OIDC ID Token을 JWKS로 검증하고 표준 클레임을 반환합니다.
   */
  async validateSocialIdToken(
    provider: OAuthProvider,
    idToken: string,
  ): Promise<{ providerId: string; email: string | null; nickname: string | null; profileImageUrl: string | null }> {
    const config = this.providers[provider];
    if (!config) {
      throw new UnauthorizedException('지원하지 않는 제공자입니다.');
    }

    const clientId = this.getClientId(provider);
    if (!clientId) {
      throw new UnauthorizedException(`${provider.toUpperCase()} 클라이언트 ID가 설정되지 않았습니다.`);
    }

    let payload: JWTPayload;
    try {
      const verified = await jwtVerify(idToken, config.jwks, {
        issuer: config.issuer,
        audience: clientId,
      });
      payload = verified.payload;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${provider} ID Token 검증 실패:`, msg);
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    const sub = typeof payload.sub === 'string' ? payload.sub : '';
    if (!sub) {
      throw new UnauthorizedException('토큰에 subject(sub)가 없습니다.');
    }

    const email = typeof payload.email === 'string' ? payload.email : null;

    const rawName =
      payload.name ?? payload.nickname ?? (payload as { nickname?: string }).nickname;
    const nickname =
      typeof rawName === 'string' && rawName.length > 0 ? rawName : null;

    const picture = payload.picture;
    const profileImageUrl =
      typeof picture === 'string' && picture.length > 0 ? picture : null;

    return {
      providerId: sub,
      email,
      nickname,
      profileImageUrl,
    };
  }

  async loginWithSocialIdToken(provider: OAuthProvider, idToken: string): Promise<AuthTokens> {
    const claims = await this.validateSocialIdToken(provider, idToken);
    const user = await this.usersService.findOrCreateByOAuth({
      provider,
      providerId: claims.providerId,
      email: claims.email,
      nickname: claims.nickname,
      profileImageUrl: claims.profileImageUrl,
    });
    return this.login(user);
  }

  private getClientId(provider: OAuthProvider): string {
    switch (provider) {
      case 'google':
        return this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '';
      case 'kakao':
        return this.configService.get<string>('KAKAO_CLIENT_ID') ?? '';
      case 'apple':
        return this.configService.get<string>('APPLE_CLIENT_ID') ?? '';
      default:
        return '';
    }
  }
}
