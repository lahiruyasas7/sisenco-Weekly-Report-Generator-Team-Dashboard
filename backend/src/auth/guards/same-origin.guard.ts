import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class SameOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      method: string;
      headers: { origin?: string; referer?: string };
    }>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

    // Browser mutations must come from the configured UI origin; no-Origin clients are non-browser API clients.
    const source = request.headers.origin ?? request.headers.referer;
    if (!source) return true;

    try {
      const requestOrigin = new URL(source).origin;
      const allowedOrigin = new URL(
        this.config.getOrThrow('FRONTEND_ORIGIN', { infer: true }),
      ).origin;

      if (requestOrigin === allowedOrigin) return true;
    } catch {
      // Treat malformed Origin/Referer headers as an invalid browser origin.
    }

    throw new ForbiddenException('Request origin is not allowed');
  }
}
