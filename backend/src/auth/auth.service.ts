import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ACCESS_TOKEN_TTL_MS } from './auth.constants.js';
import { PasswordService } from './password.service.js';
import type { AuthenticatedUser } from './types/authenticated-user.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: AuthenticatedUser['role'];
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwords: PasswordService,
  ) {}

  async register(input: RegisterDto): Promise<PublicUser> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await this.prisma.user.create({
        data: {
          email: this.normalizeEmail(input.email),
          name: input.name.trim(),
          passwordHash,
          role: 'MEMBER',
        },
        select: publicUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ user: PublicUser; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      select: { ...publicUserSelect, passwordHash: true },
    });

    // Keep the response identical for unknown emails, bad passwords, and inactive users.
    const passwordIsValid = await this.passwords.verify(
      password,
      user?.passwordHash,
    );

    if (!user || !user.isActive || !passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    await this.prisma.userSession.create({
      data: { id: sessionId, userId: user.id, expiresAt },
    });

    const token = await this.jwtService.signAsync(
      {},
      {
        subject: user.id,
        jwtid: sessionId,
      },
    );

    const safeUser: PublicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    };
    return { user: safeUser, token };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileDto,
  ): Promise<PublicUser> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name.trim() },
      select: publicUserSelect,
    });
  }

  async changePassword(
    userId: string,
    input: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (
      !user ||
      !(await this.passwords.verify(input.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await this.passwords.hash(input.newPassword);
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  getCurrentUser(user: AuthenticatedUser): Promise<PublicUser> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: publicUserSelect,
    });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
