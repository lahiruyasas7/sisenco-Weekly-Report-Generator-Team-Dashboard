import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { BCRYPT_SALT_ROUNDS } from '../src/auth/auth.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Role, type User } from '../src/generated/prisma/client.js';

const API = '/api/v1';
const fixturePrefix = `projects-e2e-${randomUUID()}`;

describe('Projects API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: User;
  let manager: User;
  let member: User;
  let secondMember: User;
  let inactiveMember: User;
  let adminCookie: string;
  let managerCookie: string;
  let memberCookie: string;
  const fixtureUserIds: string[] = [];

  async function createFixtureUser(
    role: Role,
    label: string,
    isActive = true,
  ): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: `${fixturePrefix}.${label}@example.test`,
        name: `${label} e2e user`,
        passwordHash: await bcrypt.hash(
          'Projects-E2E-Password-12345',
          BCRYPT_SALT_ROUNDS,
        ),
        role,
        isActive,
      },
    });
    fixtureUserIds.push(user.id);
    return user;
  }

  async function createSessionCookie(userId: string): Promise<string> {
    const sessionId = randomUUID();
    await prisma.userSession.create({
      data: {
        id: sessionId,
        userId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const token = await app
      .get(JwtService)
      .signAsync({}, { subject: userId, jwtid: sessionId });
    return `access_token=${token}`;
  }

  async function createProject(name: string): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set('Cookie', managerCookie)
      .send({ name })
      .expect(201);
    return { id: response.body.id as string };
  }

  async function cleanup(): Promise<void> {
    if (!prisma) return;
    if (fixtureUserIds.length > 0) {
      await prisma.report.deleteMany({
        where: { userId: { in: fixtureUserIds } },
      });
    }
    await prisma.project.deleteMany({
      where: { name: { startsWith: fixturePrefix } },
    });
    if (fixtureUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);
    admin = await createFixtureUser(Role.ADMIN, 'admin');
    manager = await createFixtureUser(Role.MANAGER, 'manager');
    member = await createFixtureUser(Role.MEMBER, 'member');
    secondMember = await createFixtureUser(Role.MEMBER, 'second-member');
    inactiveMember = await createFixtureUser(
      Role.MEMBER,
      'inactive-member',
      false,
    );

    adminCookie = await createSessionCookie(admin.id);
    managerCookie = await createSessionCookie(manager.id);
    memberCookie = await createSessionCookie(member.id);
  }, 30_000);

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await app?.close();
    }
  }, 30_000);

  it('requires authentication to list projects and allows all roles to list', async () => {
    await request(app.getHttpServer()).get(`${API}/projects`).expect(401);

    const memberProjects = await request(app.getHttpServer())
      .get(`${API}/projects`)
      .set('Cookie', memberCookie)
      .expect(200);
    expect(memberProjects.body.meta).toMatchObject({ page: 1, limit: 20 });
    await request(app.getHttpServer())
      .get(`${API}/projects`)
      .set('Cookie', managerCookie)
      .expect(200);
    await request(app.getHttpServer())
      .get(`${API}/projects`)
      .set('Cookie', adminCookie)
      .expect(200);
  });

  it('restricts project management and assignable-member lookup to managers/admins', async () => {
    const project = await createProject(`${fixturePrefix}.rbac`);

    await request(app.getHttpServer())
      .get(`${API}/projects/assignable-members`)
      .set('Cookie', memberCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set('Cookie', memberCookie)
      .send({ name: `${fixturePrefix}.forbidden` })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`${API}/projects/${project.id}`)
      .set('Cookie', memberCookie)
      .send({ isArchived: true })
      .expect(403);
    await request(app.getHttpServer())
      .put(`${API}/projects/${project.id}/members`)
      .set('Cookie', memberCookie)
      .send({ memberIds: [] })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`${API}/projects/${project.id}`)
      .set('Cookie', memberCookie)
      .expect(403);

    await request(app.getHttpServer())
      .get(`${API}/projects/assignable-members`)
      .set('Cookie', managerCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set('Cookie', adminCookie)
      .send({ name: `${fixturePrefix}.admin-created` })
      .expect(201);
  });

  it('trims names, rejects case-insensitive duplicates, and filters archived projects', async () => {
    const projectName = `${fixturePrefix}.archive-check`;
    const created = await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set('Cookie', managerCookie)
      .send({
        name: ` ${projectName} `,
        description: 'Initial',
        color: '#6366F1',
      })
      .expect(201);
    expect(created.body.name).toBe(projectName);

    await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set('Cookie', managerCookie)
      .send({ name: projectName.toUpperCase() })
      .expect(409);

    const projectId = created.body.id as string;
    const updated = await request(app.getHttpServer())
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', managerCookie)
      .send({ description: 'Updated description', color: null })
      .expect(200);
    expect(updated.body).toMatchObject({
      description: 'Updated description',
      color: null,
    });

    await request(app.getHttpServer())
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', managerCookie)
      .send({ isArchived: true })
      .expect(200);

    const defaultList = await request(app.getHttpServer())
      .get(`${API}/projects?limit=100`)
      .set('Cookie', memberCookie)
      .expect(200);
    expect(
      defaultList.body.data.some(
        (project: { id: string }) => project.id === projectId,
      ),
    ).toBe(false);

    const archivedList = await request(app.getHttpServer())
      .get(`${API}/projects?includeArchived=true&limit=100`)
      .set('Cookie', memberCookie)
      .expect(200);
    expect(
      archivedList.body.data.some(
        (project: { id: string; isArchived: boolean }) =>
          project.id === projectId && project.isArchived,
      ),
    ).toBe(true);
    expect(archivedList.body.meta).toMatchObject({ page: 1, limit: 100 });

    await request(app.getHttpServer())
      .patch(`${API}/projects/${projectId}`)
      .set('Cookie', managerCookie)
      .send({ isArchived: false })
      .expect(200);
  });

  it('replaces assignments atomically and accepts only active MEMBER accounts', async () => {
    const project = await createProject(`${fixturePrefix}.assignments`);
    const assignable = await request(app.getHttpServer())
      .get(`${API}/projects/assignable-members`)
      .set('Cookie', managerCookie)
      .expect(200);
    const assignableIds = (assignable.body.data as { id: string }[]).map(
      ({ id }) => id,
    );
    expect(assignableIds).toContain(member.id);
    expect(assignableIds).toContain(secondMember.id);
    expect(assignableIds).not.toContain(inactiveMember.id);
    expect(assignableIds).not.toContain(manager.id);
    expect(assignableIds).not.toContain(admin.id);

    await request(app.getHttpServer())
      .put(`${API}/projects/${project.id}/members`)
      .set('Cookie', managerCookie)
      .send({ memberIds: [member.id, secondMember.id] })
      .expect(200)
      .expect({
        projectId: project.id,
        memberIds: [member.id, secondMember.id],
      });

    await request(app.getHttpServer())
      .put(`${API}/projects/${project.id}/members`)
      .set('Cookie', managerCookie)
      .send({ memberIds: [member.id, inactiveMember.id] })
      .expect(400);
    await request(app.getHttpServer())
      .put(`${API}/projects/${project.id}/members`)
      .set('Cookie', managerCookie)
      .send({ memberIds: [member.id, member.id] })
      .expect(400);
    await request(app.getHttpServer())
      .put(`${API}/projects/${project.id}/members`)
      .set('Cookie', managerCookie)
      .send({ memberIds: ['not-a-uuid'] })
      .expect(400);

    const memberProjects = await request(app.getHttpServer())
      .get(`${API}/projects?limit=100`)
      .set('Cookie', memberCookie)
      .expect(200);
    const assignedProject = (
      memberProjects.body.data as { id: string; isAssigned: boolean }[]
    ).find(({ id }) => id === project.id);
    expect(assignedProject?.isAssigned).toBe(true);

    await request(app.getHttpServer())
      .put(`${API}/projects/${project.id}/members`)
      .set('Cookie', managerCookie)
      .send({ memberIds: [] })
      .expect(200);
    const unassignedProjects = await request(app.getHttpServer())
      .get(`${API}/projects?limit=100`)
      .set('Cookie', memberCookie)
      .expect(200);
    const unassignedProject = (
      unassignedProjects.body.data as { id: string; isAssigned: boolean }[]
    ).find(({ id }) => id === project.id);
    expect(unassignedProject?.isAssigned).toBe(false);
  });

  it('returns 409 when deleting a project referenced by a report', async () => {
    const project = await createProject(`${fixturePrefix}.referenced`);
    await prisma.report.create({
      data: {
        userId: member.id,
        projectId: project.id,
        weekStart: new Date('2026-10-19T00:00:00.000Z'),
        weekEnd: new Date('2026-10-25T00:00:00.000Z'),
        links: [],
      },
    });

    await request(app.getHttpServer())
      .delete(`${API}/projects/${project.id}`)
      .set('Cookie', managerCookie)
      .expect(409);
    await expect(
      prisma.project.findUnique({ where: { id: project.id } }),
    ).resolves.not.toBeNull();
  });

  it('deletes an unreferenced project and returns 404 for a missing project', async () => {
    const project = await createProject(`${fixturePrefix}.deletable`);
    await request(app.getHttpServer())
      .delete(`${API}/projects/${project.id}`)
      .set('Cookie', adminCookie)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`${API}/projects/${randomUUID()}`)
      .set('Cookie', managerCookie)
      .expect(404);
  });
});
