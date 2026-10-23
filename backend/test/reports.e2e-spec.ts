import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ReportStatus, Role } from '../src/generated/prisma/client.js';

const API = '/api/v1';
const fixturePrefix = `reports-e2e-${randomUUID()}`;

describe('Member reports API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let managerCookie: string;
  let memberCookie: string;
  let otherMemberCookie: string;
  let memberId: string;
  const fixtureUserIds: string[] = [];
  const projectIds: string[] = [];

  async function createUser(role: Role, label: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `${fixturePrefix}.${label}@example.test`,
        name: `${label} report e2e user`,
        passwordHash: await bcrypt.hash('Reports-E2E-Password-12345', 10),
        role,
      },
    });
    fixtureUserIds.push(user.id);
    return user.id;
  }

  async function cookieFor(userId: string): Promise<string> {
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

  async function cleanup(): Promise<void> {
    if (!prisma) return;
    if (fixtureUserIds.length) {
      await prisma.report.deleteMany({
        where: { userId: { in: fixtureUserIds } },
      });
    }
    if (projectIds.length) {
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    }
    if (fixtureUserIds.length) {
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
    const managerId = await createUser(Role.MANAGER, 'manager');
    memberId = await createUser(Role.MEMBER, 'member');
    const otherId = await createUser(Role.MEMBER, 'other');
    managerCookie = await cookieFor(managerId);
    memberCookie = await cookieFor(memberId);
    otherMemberCookie = await cookieFor(otherId);
  }, 30_000);

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await app?.close();
    }
  }, 30_000);

  it('creates a projectless draft and keeps draft access private', async () => {
    const created = await request(app.getHttpServer())
      .post(`${API}/reports`)
      .set('Cookie', memberCookie)
      .send({ weekStart: '2026-10-19' })
      .expect(201);
    expect(created.body).toMatchObject({
      id: expect.any(String),
      status: ReportStatus.DRAFT,
      currentVersion: 0,
      content: {
        weekStart: '2026-10-19',
        weekEnd: '2026-10-25',
        project: null,
      },
    });

    await request(app.getHttpServer())
      .get(`${API}/reports/${created.body.id as string}`)
      .set('Cookie', memberCookie)
      .expect(200);
    await request(app.getHttpServer())
      .get(`${API}/reports/${created.body.id as string}`)
      .set('Cookie', otherMemberCookie)
      .expect(404);
    await request(app.getHttpServer())
      .get(`${API}/reports/${created.body.id as string}`)
      .set('Cookie', managerCookie)
      .expect(404);

    const history = await request(app.getHttpServer())
      .get(`${API}/reports/me`)
      .set('Cookie', memberCookie)
      .expect(200);
    expect(history.body.data[0]).toMatchObject({
      id: created.body.id,
      status: ReportStatus.DRAFT,
    });
    expect(history.body.meta.total).toBe(1);
  });

  it('validates week boundaries and prevents duplicate member weeks', async () => {
    await request(app.getHttpServer())
      .post(`${API}/reports`)
      .set('Cookie', otherMemberCookie)
      .send({ weekStart: '2026-10-20' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${API}/reports`)
      .set('Cookie', otherMemberCookie)
      .send({ weekStart: '2026-10-26' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${API}/reports`)
      .set('Cookie', memberCookie)
      .send({ weekStart: '2026-10-19' })
      .expect(409);
  });

  it('requires a valid project and report content before submission, then snapshots it', async () => {
    const created = await request(app.getHttpServer())
      .post(`${API}/reports`)
      .set('Cookie', otherMemberCookie)
      .send({ weekStart: '2026-10-19' })
      .expect(201);
    const reportId = created.body.id as string;

    await request(app.getHttpServer())
      .patch(`${API}/reports/${reportId}`)
      .set('Cookie', otherMemberCookie)
      .send({ tasks: [{ name: '  Build feature  ', plannedHours: 5 }] })
      .expect(200);
    await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/submit`)
      .set('Cookie', otherMemberCookie)
      .expect(400);

    const projectResponse = await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set('Cookie', managerCookie)
      .send({ name: `${fixturePrefix}.project` })
      .expect(201);
    const projectId = projectResponse.body.id as string;
    projectIds.push(projectId);

    await request(app.getHttpServer())
      .patch(`${API}/reports/${reportId}`)
      .set('Cookie', otherMemberCookie)
      .send({
        projectId,
        tasks: [
          {
            name: '  Build feature  ',
            priority: 'HIGH',
            plannedPercent: 100,
            actualPercent: 80,
            status: 'IN_PROGRESS',
            plannedHours: 5,
            spentHours: 4,
            output: 'Endpoint',
          },
        ],
        blockers: [{ description: '   ', isKey: true }],
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/submit`)
      .set('Cookie', otherMemberCookie)
      .expect(400);

    const submitted = await request(app.getHttpServer())
      .patch(`${API}/reports/${reportId}`)
      .set('Cookie', otherMemberCookie)
      .send({ blockers: [] })
      .expect(200);
    expect(submitted.body.content.tasks[0].name).toBe('Build feature');

    const response = await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/submit`)
      .set('Cookie', otherMemberCookie)
      .expect(201);
    expect(response.body).toMatchObject({
      status: ReportStatus.SUBMITTED,
      currentVersion: 1,
      content: {
        project: { id: projectId },
        tasks: [{ name: 'Build feature' }],
      },
    });
    expect(response.body.firstSubmittedAt).toBeTruthy();

    const version = await prisma.reportVersion.findUnique({
      where: { reportId_versionNumber: { reportId, versionNumber: 1 } },
    });
    expect(version?.snapshot).toMatchObject({
      project: { id: projectId },
      tasks: [{ name: 'Build feature', output: 'Endpoint' }],
    });

    await prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.NEEDS_CORRECTION },
    });
    await prisma.reportTask.updateMany({
      where: { reportId },
      data: { name: 'unsubmitted working copy' },
    });
    const managerView = await request(app.getHttpServer())
      .get(`${API}/reports/${reportId}`)
      .set('Cookie', managerCookie)
      .expect(200);
    expect(managerView.body.content.tasks[0].name).toBe('Build feature');
  });

  it('does not let managers or members edit another member report, and locks submitted content', async () => {
    const report = await prisma.report.findFirst({
      where: { userId: memberId, status: ReportStatus.DRAFT },
      select: { id: true },
    });
    expect(report).not.toBeNull();
    await request(app.getHttpServer())
      .patch(`${API}/reports/${report?.id as string}`)
      .set('Cookie', managerCookie)
      .send({ notes: 'manager edit' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`${API}/reports/${report?.id as string}`)
      .set('Cookie', otherMemberCookie)
      .expect(404);
  });
});
