import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Env } from '../config/env.validation.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { SameOriginGuard } from './guards/same-origin.guard.js';
import { PasswordChangeGuard } from './guards/password-change.guard.js';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.getOrThrow('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    SameOriginGuard,
    PasswordChangeGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    JwtAuthGuard,
    RolesGuard,
    SameOriginGuard,
    PasswordChangeGuard,
  ],
})
export class AuthModule {}
