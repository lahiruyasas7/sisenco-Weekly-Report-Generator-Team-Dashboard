import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AllowPasswordChange } from '../common/decorators/allow-password-change.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Env } from '../config/env.validation.js';
import { AuthService } from './auth.service.js';
import { authCookieOptions } from './auth-cookie.js';
import { ACCESS_TOKEN_COOKIE } from './auth.constants.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { AuthenticatedUser } from './types/authenticated-user.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @Post('register')
  register(@Body() input: RegisterDto) {
    return this.authService.register(input);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { token, user } = await this.authService.login(
      input.email,
      input.password,
    );

    response.cookie(
      ACCESS_TOKEN_COOKIE,
      token,
      authCookieOptions(
        this.configService.get('NODE_ENV', { infer: true }) === 'production',
      ),
    );

    return user;
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowPasswordChange()
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(user.sessionId);
    response.clearCookie(
      ACCESS_TOKEN_COOKIE,
      authCookieOptions(
        this.configService.get('NODE_ENV', { infer: true }) === 'production',
      ),
    );
  }

  @Get('me')
  @AllowPasswordChange()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, input);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowPasswordChange()
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.changePassword(user.id, input);
    response.clearCookie(
      ACCESS_TOKEN_COOKIE,
      authCookieOptions(
        this.configService.get('NODE_ENV', { infer: true }) === 'production',
      ),
    );
  }
}
