import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { ListProjectsDto } from './dto/list-projects.dto.js';
import type { ReplaceProjectMembersDto } from './dto/replace-project-members.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';

const projectFields = {
  id: true,
  name: true,
  description: true,
  color: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, input: ListProjectsDto) {
    const where: Prisma.ProjectWhereInput = input.includeArchived
      ? {}
      : { isArchived: false };
    const skip = (input.page - 1) * input.limit;

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        select: {
          ...projectFields,
          members: {
            where: { userId },
            select: { userId: true },
            take: 1,
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: input.limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects.map(({ members, ...project }) => ({
        ...project,
        isAssigned: members.length > 0,
      })),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async assignableMembers() {
    return {
      data: await this.prisma.user.findMany({
        where: { role: Role.MEMBER, isActive: true },
        select: { id: true, name: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    };
  }

  async create(input: CreateProjectDto) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('Project name is required');

    try {
      return await this.prisma.project.create({
        data: {
          name,
          description: input.description,
          color: input.color,
        },
        select: projectFields,
      });
    } catch (error) {
      this.rethrowProjectConstraintError(error);
      throw error;
    }
  }

  async update(projectId: string, input: UpdateProjectDto) {
    if (
      input.name === undefined &&
      input.description === undefined &&
      input.color === undefined &&
      input.isArchived === undefined
    ) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const name = input.name?.trim();
    if (input.name !== undefined && !name) {
      throw new BadRequestException('Project name cannot be blank');
    }

    try {
      return await this.prisma.project.update({
        where: { id: projectId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.isArchived !== undefined
            ? { isArchived: input.isArchived }
            : {}),
        },
        select: projectFields,
      });
    } catch (error) {
      this.rethrowProjectConstraintError(error);
      throw error;
    }
  }

  async remove(projectId: string): Promise<void> {
    try {
      await this.prisma.project.delete({ where: { id: projectId } });
    } catch (error) {
      if (this.isKnownPrismaError(error, 'P2003', 'P2014')) {
        throw new ConflictException(
          'A project referenced by a report cannot be deleted; archive it instead',
        );
      }
      if (this.isKnownPrismaError(error, 'P2025')) {
        throw new NotFoundException('Project not found');
      }
      throw error;
    }
  }

  async replaceMembers(projectId: string, input: ReplaceProjectMembersDto) {
    if (new Set(input.memberIds).size !== input.memberIds.length) {
      throw new BadRequestException('Member IDs must be unique');
    }

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const project = await transaction.project.findUnique({
            where: { id: projectId },
            select: { id: true },
          });
          if (!project) throw new NotFoundException('Project not found');

          if (input.memberIds.length > 0) {
            const validMembers = await transaction.user.findMany({
              where: {
                id: { in: input.memberIds },
                role: Role.MEMBER,
                isActive: true,
              },
              select: { id: true },
            });
            if (validMembers.length !== input.memberIds.length) {
              throw new BadRequestException(
                'Every assigned user must be an active MEMBER account',
              );
            }
          }

          await transaction.projectMember.deleteMany({
            where: { projectId },
          });
          if (input.memberIds.length > 0) {
            await transaction.projectMember.createMany({
              data: input.memberIds.map((userId) => ({ projectId, userId })),
            });
          }

          return { projectId, memberIds: input.memberIds };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isKnownPrismaError(error, 'P2034')) {
        throw new ConflictException(
          'Project assignments changed concurrently; retry the request',
        );
      }
      throw error;
    }
  }

  private rethrowProjectConstraintError(error: unknown): void {
    if (this.isKnownPrismaError(error, 'P2002')) {
      throw new ConflictException(
        'A project with this name already exists (names are case-insensitive)',
      );
    }
    if (this.isKnownPrismaError(error, 'P2025')) {
      throw new NotFoundException('Project not found');
    }
  }

  private isKnownPrismaError(
    error: unknown,
    ...codes: string[]
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      codes.includes(error.code)
    );
  }
}
