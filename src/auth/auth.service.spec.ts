import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

const mockUser = {
  id: 'user-uuid',
  nickname: '홍길동',
  email: 'test@example.com',
  profileImageUrl: null,
  refreshToken: 'hashed-token',
  authProvider: 'google' as const,
  oauthSub: 'sub-123',
};

describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: { sign: jest.Mock; verify: jest.Mock };
  let mockUsersService: {
    updateRefreshToken: jest.Mock;
    findById: jest.Mock;
    findOrCreateByOAuth: jest.Mock;
  };
  let mockConfigService: { get: jest.Mock };

  beforeEach(async () => {
    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };
    mockUsersService = {
      updateRefreshToken: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findOrCreateByOAuth: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          JWT_ACCESS_EXPIRES: '15m',
          JWT_REFRESH_EXPIRES_SEC: '604800',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logout', () => {
    it('updateRefreshToken(userId, null) 호출', async () => {
      await service.logout('user-uuid');
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith('user-uuid', null);
    });
  });

  describe('refreshTokens', () => {
    it('정상 refresh token 시 새 AuthTokens 반환 및 토큰 갱신', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid', type: 'refresh' });
      mockUsersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-token');

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe('user-uuid');
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith('user-uuid', 'new-hashed-token');
    });

    it('JWT 검증 실패 시 UnauthorizedException', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });

      await expect(service.refreshTokens('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it("token type이 'refresh'가 아니면 UnauthorizedException", async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid', type: 'access' });

      await expect(service.refreshTokens('access-token')).rejects.toThrow(UnauthorizedException);
    });

    it('유저를 찾을 수 없으면 UnauthorizedException', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid', type: 'refresh' });
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.refreshTokens('valid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('해시 불일치(토큰 재사용) 시 UnauthorizedException', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-uuid', type: 'refresh' });
      mockUsersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshTokens('reused-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
