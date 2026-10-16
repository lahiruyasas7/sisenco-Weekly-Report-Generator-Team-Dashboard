import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

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
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
