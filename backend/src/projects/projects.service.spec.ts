import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { ListProjectsDto } from './dto/list-projects.dto.js';
import type { ReplaceProjectMembersDto } from './dto/replace-project-members.dto.js';
import { ProjectsService } from './projects.service.js';

function setup() {
  const transactionClient = {
    project: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    projectMember: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  };
  const prismaMock = {
    project: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((operation: unknown) => {
      if (typeof operation === 'function') {
        const run = operation as (
          transaction: typeof transactionClient,
        ) => Promise<unknown>;
        return run(transactionClient);
      }
      return Promise.all(operation as Promise<unknown>[]);
    }),
  };
  const service = new ProjectsService(prismaMock as unknown as PrismaService);
  return { service, prismaMock, transactionClient };
}

describe('ProjectsService', () => {
  it('paginates projects and computes isAssigned for the requesting user', async () => {
    const { service, prismaMock } = setup();
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Client A',
        description: null,
        color: null,
        isArchived: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        members: [{ userId: 'member-1' }],
      },
      {
        id: 'project-2',
        name: 'Client B',
        description: null,
        color: null,
        isArchived: false,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        members: [],
      },
    ]);
    prismaMock.project.count.mockResolvedValue(2);

    const result = await service.list('member-1', {
      page: 1,
      limit: 20,
      includeArchived: false,
    } satisfies ListProjectsDto);

    expect(result.data.map((project) => project.isAssigned)).toEqual([
      true,
      false,
    ]);
    expect(result.data[0]).not.toHaveProperty('members');
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isArchived: false } }),
    );
  });

  it('returns archived projects only when requested', async () => {
    const { service, prismaMock } = setup();
    prismaMock.project.findMany.mockResolvedValue([]);
    prismaMock.project.count.mockResolvedValue(0);

    await service.list('manager-1', {
      page: 1,
      limit: 20,
      includeArchived: true,
    });

    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('offers only active MEMBER accounts for assignment', async () => {
    const { service, prismaMock } = setup();
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'member-1', name: 'A Member' },
    ]);

    await expect(service.assignableMembers()).resolves.toEqual({
      data: [{ id: 'member-1', name: 'A Member' }],
    });
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: Role.MEMBER, isActive: true },
        select: { id: true, name: true },
      }),
    );
  });

  it('maps a case-insensitive unique-name violation to 409', async () => {
    const { service, prismaMock } = setup();
    prismaMock.project.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '7.10.1',
      }),
    );

    await expect(
      service.create({ name: ' client a ' } satisfies CreateProjectDto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'client a' }),
      }),
    );
  });

  it('updates archive state and permits unarchiving', async () => {
    const { service, prismaMock } = setup();
    prismaMock.project.update.mockResolvedValue({
      id: 'project-1',
      name: 'Client A',
      description: null,
      color: null,
      isArchived: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await service.update('project-1', { isArchived: false });

    expect(prismaMock.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: { isArchived: false },
      }),
    );
  });

  it('maps a report foreign-key restriction to 409 on delete', async () => {
    const { service, prismaMock } = setup();
    prismaMock.project.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('foreign key violation', {
        code: 'P2003',
        clientVersion: '7.10.1',
      }),
    );

    await expect(service.remove('project-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('replaces member assignments atomically after validating active MEMBERs', async () => {
    const { service, transactionClient, prismaMock } = setup();
    transactionClient.project.findUnique.mockResolvedValue({ id: 'project-1' });
    transactionClient.user.findMany.mockResolvedValue([
      { id: 'member-1' },
      { id: 'member-2' },
    ]);
    transactionClient.projectMember.deleteMany.mockResolvedValue({ count: 1 });
    transactionClient.projectMember.createMany.mockResolvedValue({ count: 2 });

    await expect(
      service.replaceMembers('project-1', {
        memberIds: ['member-1', 'member-2'],
      } satisfies ReplaceProjectMembersDto),
    ).resolves.toEqual({
      projectId: 'project-1',
      memberIds: ['member-1', 'member-2'],
    });
    expect(transactionClient.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['member-1', 'member-2'] },
          role: Role.MEMBER,
          isActive: true,
        },
      }),
    );
    expect(transactionClient.projectMember.deleteMany).toHaveBeenCalledOnce();
    expect(transactionClient.projectMember.createMany).toHaveBeenCalledOnce();
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it('rejects non-active or non-MEMBER accounts before changing assignments', async () => {
    const { service, transactionClient } = setup();
    transactionClient.project.findUnique.mockResolvedValue({ id: 'project-1' });
    transactionClient.user.findMany.mockResolvedValue([{ id: 'member-1' }]);

    await expect(
      service.replaceMembers('project-1', {
        memberIds: ['member-1', 'inactive-user'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transactionClient.projectMember.deleteMany).not.toHaveBeenCalled();
    expect(transactionClient.projectMember.createMany).not.toHaveBeenCalled();
  });

  it('supports replacing assignments with an empty list', async () => {
    const { service, transactionClient } = setup();
    transactionClient.project.findUnique.mockResolvedValue({ id: 'project-1' });
    transactionClient.projectMember.deleteMany.mockResolvedValue({ count: 2 });

    await service.replaceMembers('project-1', { memberIds: [] });

    expect(transactionClient.user.findMany).not.toHaveBeenCalled();
    expect(transactionClient.projectMember.deleteMany).toHaveBeenCalledOnce();
    expect(transactionClient.projectMember.createMany).not.toHaveBeenCalled();
  });
});
