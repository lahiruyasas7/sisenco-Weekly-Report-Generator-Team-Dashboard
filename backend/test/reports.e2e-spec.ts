import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import { DateTime } from 'luxon';
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
  let otherMemberId: string;
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
    otherMemberId = await createUser(Role.MEMBER, 'other');
    managerCookie = await cookieFor(managerId);
    memberCookie = await cookieFor(memberId);
    otherMemberCookie = await cookieFor(otherMemberId);
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
    const futureWeekStart = DateTime.now()
      .setZone(process.env.REPORT_TIMEZONE ?? 'Asia/Colombo')
      .startOf('week')
      .plus({ weeks: 1 })
      .toFormat('yyyy-MM-dd');

    await request(app.getHttpServer())
      .post(`${API}/reports`)
      .set('Cookie', otherMemberCookie)
      .send({ weekStart: '2026-10-20' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${API}/reports`)
      .set('Cookie', otherMemberCookie)
      .send({ weekStart: futureWeekStart })
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

  it('lists manager reports and completes the review and version-history workflow', async () => {
    const projectResponse = await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set('Cookie', managerCookie)
      .send({ name: `${fixturePrefix}.review-project` })
      .expect(201);
    const projectId = projectResponse.body.id as string;
    projectIds.push(projectId);

    const draftResponse = await request(app.getHttpServer())
      .post(`${API}/reports`)
      .set('Cookie', otherMemberCookie)
      .send({ weekStart: '2026-10-05' })
      .expect(201);
    await request(app.getHttpServer())
      .get(`${API}/reports`)
      .query({ weekStart: '2026-10-05' })
      .set('Cookie', managerCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(0);
      });
    await request(app.getHttpServer())
      .get(`${API}/reports/${draftResponse.body.id as string}/versions`)
      .set('Cookie', managerCookie)
      .expect(404);

    const reportResponse = await request(app.getHttpServer())
      .post(`${API}/reports`)
      .set('Cookie', otherMemberCookie)
      .send({ weekStart: '2026-10-12' })
      .expect(201);
    const reportId = reportResponse.body.id as string;
    await request(app.getHttpServer())
      .patch(`${API}/reports/${reportId}`)
      .set('Cookie', otherMemberCookie)
      .send({
        projectId,
        tasks: [{ name: 'Review workflow task', plannedHours: 3 }],
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/submit`)
      .set('Cookie', otherMemberCookie)
      .expect(201);

    await request(app.getHttpServer())
      .get(`${API}/reports`)
      .query({
        weekStart: '2026-10-12',
        userId: otherMemberId,
        projectId,
        status: ReportStatus.SUBMITTED,
      })
      .set('Cookie', managerCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(1);
        expect(body.data[0]).toMatchObject({
          id: reportId,
          status: ReportStatus.SUBMITTED,
          project: { id: projectId },
        });
        expect(body.meta).toMatchObject({
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        });
      });

    await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/review`)
      .set('Cookie', managerCookie)
      .send({ action: 'CHANGES_REQUESTED', comment: '   ' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/review`)
      .set('Cookie', managerCookie)
      .send({
        action: 'CHANGES_REQUESTED',
        comment: 'Please add more detail.',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe(ReportStatus.NEEDS_CORRECTION);
      });

    await request(app.getHttpServer())
      .get(`${API}/reports/${reportId}/versions`)
      .set('Cookie', otherMemberCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(1);
        expect(body.data[0]).toMatchObject({
          number: 1,
          reviews: [
            {
              action: 'CHANGES_REQUESTED',
              comment: 'Please add more detail.',
            },
          ],
        });
      });
    await request(app.getHttpServer())
      .get(`${API}/reports/${reportId}/versions/1`)
      .set('Cookie', otherMemberCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          number: 1,
          content: {
            tasks: [{ name: 'Review workflow task' }],
          },
          reviews: [{ action: 'CHANGES_REQUESTED' }],
        });
      });
    await request(app.getHttpServer())
      .get(`${API}/reports/${reportId}/reviews`)
      .set('Cookie', otherMemberCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(1);
        expect(body.data[0]).toMatchObject({
          action: 'CHANGES_REQUESTED',
          comment: 'Please add more detail.',
          versionNumber: 1,
        });
      });
    await request(app.getHttpServer())
      .get(`${API}/reports/${reportId}/reviews`)
      .set('Cookie', memberCookie)
      .expect(404);
    await request(app.getHttpServer())
      .get(`${API}/reports`)
      .set('Cookie', otherMemberCookie)
      .expect(403);
    await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/review`)
      .set('Cookie', otherMemberCookie)
      .send({ action: 'APPROVED' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`${API}/reports/${reportId}`)
      .set('Cookie', otherMemberCookie)
      .send({ notes: 'Added requested details.' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/submit`)
      .set('Cookie', otherMemberCookie)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: ReportStatus.SUBMITTED,
          currentVersion: 2,
          firstSubmittedAt: expect.any(String),
        });
      });
    await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/review`)
      .set('Cookie', managerCookie)
      .send({ action: 'APPROVED' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: ReportStatus.APPROVED,
          currentVersion: 2,
        });
      });
    await request(app.getHttpServer())
      .post(`${API}/reports/${reportId}/review`)
      .set('Cookie', managerCookie)
      .send({ action: 'APPROVED' })
      .expect(409);

    await request(app.getHttpServer())
      .get(`${API}/reports/${reportId}/versions`)
      .set('Cookie', managerCookie)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(2);
        expect(
          body.data.map((version: { number: number }) => version.number),
        ).toEqual([2, 1]);
        expect(body.data[0].reviews).toHaveLength(1);
        expect(body.data[1].reviews[0]).toMatchObject({
          action: 'CHANGES_REQUESTED',
          comment: 'Please add more detail.',
        });
      });
    await request(app.getHttpServer())
      .get(`${API}/reports/${reportId}/versions/not-a-number`)
      .set('Cookie', managerCookie)
      .expect(404);
  });
});
