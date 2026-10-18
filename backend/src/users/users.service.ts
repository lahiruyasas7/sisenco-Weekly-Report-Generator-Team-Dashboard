import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import type { PublicUser } from '../auth/auth.service.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersDto } from './dto/list-users.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async list(input: ListUsersDto) {
    const search = input.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(input.role ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: input.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async create(input: CreateUserDto): Promise<PublicUser> {
    const passwordHash = await this.passwords.hash(input.temporaryPassword);
    try {
      return await this.prisma.user.create({
        data: {
          email: input.email.trim().toLowerCase(),
          name: input.name.trim(),
          role: input.role,
          passwordHash,
          mustChangePassword: true,
        },
        select: safeUserSelect,
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

  async update(
    actor: AuthenticatedUser,
    userId: string,
    input: UpdateUserDto,
  ): Promise<PublicUser> {
    if (
      input.name === undefined &&
      input.role === undefined &&
      input.isActive === undefined
    ) {
      throw new BadRequestException('Provide at least one field to update');
    }

    if (actor.id === userId && input.isActive === false) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.user.findUnique({
            where: { id: userId },
            select: { role: true, isActive: true },
          });
          if (!current) throw new NotFoundException('User not found');

          const isRemovingActiveAdmin =
            current.role === Role.ADMIN &&
            current.isActive &&
            ((input.role !== undefined && input.role !== Role.ADMIN) ||
              input.isActive === false);

          if (isRemovingActiveAdmin) {
            const activeAdmins = await transaction.user.count({
              where: { role: Role.ADMIN, isActive: true },
            });
            if (activeAdmins <= 1) {
              throw new ForbiddenException(
                'The last active admin cannot be demoted or deactivated',
              );
            }
          }

          const updated = await transaction.user.update({
            where: { id: userId },
            data: {
              ...(input.name !== undefined ? { name: input.name.trim() } : {}),
              ...(input.role !== undefined ? { role: input.role } : {}),
              ...(input.isActive !== undefined
                ? { isActive: input.isActive }
                : {}),
            },
            select: safeUserSelect,
          });

          if (input.isActive === false) {
            await transaction.userSession.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException(
          'A concurrent user update prevented this change; retry the request',
        );
      }
      throw error;
    }
  }

  async deactivate(actor: AuthenticatedUser, userId: string): Promise<void> {
    await this.update(actor, userId, { isActive: false });
  }
}
