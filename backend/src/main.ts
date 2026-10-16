import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { Env } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableShutdownHooks();
  const config = app.get(ConfigService<Env, true>);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
