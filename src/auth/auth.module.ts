import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { KakaoStrategy } from './strategies/kakao.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const expiresIn = config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m';
        // '15m' -> 900, '7d' -> 604800
        const sec = expiresIn.endsWith('m')
          ? parseInt(expiresIn, 10) * 60
          : expiresIn.endsWith('h')
            ? parseInt(expiresIn, 10) * 3600
            : expiresIn.endsWith('d')
              ? parseInt(expiresIn, 10) * 86400
              : parseInt(expiresIn, 10) || 900;
        return {
          secret: config.get<string>('JWT_SECRET') ?? 'default-secret',
          signOptions: { expiresIn: sec },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, KakaoStrategy, JwtStrategy],
})
export class AuthModule {}
