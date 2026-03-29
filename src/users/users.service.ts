import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthProvider, User } from './entities/user.entity';

export interface OAuthProfileInput {
  provider: OAuthProvider;
  /** ID Token `sub` */
  providerId: string;
  email: string | null;
  nickname: string | null;
  profileImageUrl: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findOrCreateByOAuth(profile: OAuthProfileInput): Promise<User> {
    const { provider, providerId } = profile;
    let user = await this.userRepository.findOne({
      where: { authProvider: provider, oauthSub: providerId },
    });

    if (!user) {
      user = this.userRepository.create({
        authProvider: provider,
        oauthSub: providerId,
        nickname: profile.nickname,
        email: profile.email,
        profileImageUrl: profile.profileImageUrl,
      });
      await this.userRepository.save(user);
      return user;
    }

    if (profile.nickname) {
      user.nickname = profile.nickname;
    }
    if (profile.email) {
      user.email = profile.email;
    }
    if (profile.profileImageUrl) {
      user.profileImageUrl = profile.profileImageUrl;
    }
    await this.userRepository.save(user);

    return user;
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    await this.userRepository.update(userId, { refreshToken });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }
}
