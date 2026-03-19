import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

export interface KakaoProfile {
  id: number;
  username?: string;
  displayName?: string;
  _json?: {
    id: number;
    kakao_account?: {
      email?: string;
      profile?: { nickname?: string; profile_image_url?: string };
    };
    properties?: { nickname?: string; profile_image?: string };
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findOrCreateByKakao(profile: KakaoProfile): Promise<User> {
    const kakaoId = String(profile.id);
    let user = await this.userRepository.findOne({ where: { kakaoId } });

    if (!user) {
      const kakaoAccount = profile._json?.kakao_account;
      const properties = profile._json?.properties;
      user = this.userRepository.create({
        kakaoId,
        nickname:
          properties?.nickname ??
          kakaoAccount?.profile?.nickname ??
          profile.displayName ??
          profile.username ??
          null,
        email: kakaoAccount?.email ?? null,
        profileImageUrl:
          kakaoAccount?.profile?.profile_image_url ??
          properties?.profile_image ??
          null,
      });
      await this.userRepository.save(user);
    } else {
      const kakaoAccount = profile._json?.kakao_account;
      const properties = profile._json?.properties;
      user.nickname =
        properties?.nickname ??
        kakaoAccount?.profile?.nickname ??
        profile.displayName ??
        profile.username ??
        user.nickname;
      user.email = kakaoAccount?.email ?? user.email;
      user.profileImageUrl =
        kakaoAccount?.profile?.profile_image_url ??
        properties?.profile_image ??
        user.profileImageUrl;
      await this.userRepository.save(user);
    }

    return user;
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    await this.userRepository.update(userId, { refreshToken });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }
}
