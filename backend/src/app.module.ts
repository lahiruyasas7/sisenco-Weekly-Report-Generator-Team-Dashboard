import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { SameOriginGuard } from './auth/guards/same-origin.guard.js';
import { PasswordChangeGuard } from './auth/guards/password-change.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true, // parse once, not on every .get()
      validate: (config) => envSchema.parse(config),
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production', // prod uses real env vars, not files
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SameOriginGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
