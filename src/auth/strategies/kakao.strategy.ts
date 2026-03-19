import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-kakao';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      clientID: configService.get<string>('KAKAO_CLIENT_ID'),
      clientSecret: configService.get<string>('KAKAO_CLIENT_SECRET'),
      callbackURL: configService.get<string>('KAKAO_CALLBACK_URL'),
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: number;
      username?: string;
      displayName?: string;
      _json?: Record<string, unknown>;
    },
  ): Promise<User> {
    return this.usersService.findOrCreateByKakao(
      profile as Parameters<UsersService['findOrCreateByKakao']>[0],
    );
  }
}
