import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { BCRYPT_SALT_ROUNDS } from '../src/auth/auth.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { Role } from '../src/generated/prisma/client.js';

const API = '/api/v1';
const FIXTURE_PASSWORD = 'Fixture-Password-12345';
const TEMPORARY_PASSWORD = 'Temporary-Password-12345';
const NEW_PASSWORD = 'Changed-Password-12345';

function getAuthCookie(response: request.Response): string {
  const header = response.headers['set-cookie'];
  const cookies = header ? (Array.isArray(header) ? header : [header]) : [];
  const cookie = cookies.find((value) => value.startsWith('access_token='));
  if (!cookie) throw new Error('Login response did not set access_token');
  return cookie.split(';', 1)[0];
}

describe('Auth and user management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  const fixturePrefix = `e2e.${randomUUID()}`;
  const adminEmail = `${fixturePrefix}.admin@example.test`;

  async function createFixtureUser(role: Role, label: string) {
    const email = `${fixturePrefix}.${label}@example.test`;
    const passwordHash = await bcrypt.hash(
      FIXTURE_PASSWORD,
      BCRYPT_SALT_ROUNDS,
    );
    return prisma.user.create({
      data: {
        email,
        name: `${label} e2e user`,
        passwordHash,
        role,
      },
    });
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password })
      .expect(200);
    return getAuthCookie(response);
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
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'e2e admin',
        passwordHash: await bcrypt.hash(FIXTURE_PASSWORD, BCRYPT_SALT_ROUNDS),
        role: Role.ADMIN,
      },
    });
    adminCookie = await login(adminEmail, FIXTURE_PASSWORD);
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: { email: { startsWith: `${fixturePrefix}.` } },
      });
    }
    await app?.close();
  }, 30_000);

  it('registers a MEMBER, issues a cookie at login, and returns the current user', async () => {
    const email = `${fixturePrefix}.registered@example.test`;
    const password = 'Registered-Member-Password-12345';
    const registration = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ email, name: 'Registered Member', password })
      .expect(201);

    expect(registration.body).toMatchObject({
      email,
      name: 'Registered Member',
      role: Role.MEMBER,
      isActive: true,
      mustChangePassword: false,
    });
    expect(registration.body).not.toHaveProperty('passwordHash');

    const cookie = await login(email, password);
    const currentUser = await request(app.getHttpServer())
      .get(`${API}/auth/me`)
      .set('Cookie', cookie)
      .expect(200);

    expect(currentUser.body).toMatchObject({ id: registration.body.id, email });
  });

  it('allows only ADMIN users to access user management endpoints', async () => {
    const member = await createFixtureUser(Role.MEMBER, 'member-rbac');
    const manager = await createFixtureUser(Role.MANAGER, 'manager-rbac');
    const memberCookie = await createSessionCookie(member.id);
    const managerCookie = await createSessionCookie(manager.id);

    await request(app.getHttpServer())
      .get(`${API}/users`)
      .set('Cookie', memberCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(`${API}/users`)
      .set('Cookie', managerCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(`${API}/users`)
      .set('Cookie', adminCookie)
      .expect(200);
  });

  it('requires admin-created users to change their temporary password and revokes the old session', async () => {
    const email = `${fixturePrefix}.temporary@example.test`;
    const created = await request(app.getHttpServer())
      .post(`${API}/users`)
      .set('Cookie', adminCookie)
      .send({
        email,
        name: 'Temporary User',
        role: Role.MEMBER,
        temporaryPassword: TEMPORARY_PASSWORD,
      })
      .expect(201);

    expect(created.body).toMatchObject({
      email,
      role: Role.MEMBER,
      mustChangePassword: true,
    });
    expect(created.body).not.toHaveProperty('passwordHash');

    const temporaryCookie = await login(email, TEMPORARY_PASSWORD);
    await request(app.getHttpServer())
      .get(`${API}/auth/me`)
      .set('Cookie', temporaryCookie)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`${API}/auth/me`)
      .set('Cookie', temporaryCookie)
      .send({ name: 'Should Be Blocked' })
      .expect(403);

    const changedPassword = await request(app.getHttpServer())
      .post(`${API}/auth/change-password`)
      .set('Cookie', temporaryCookie)
      .send({
        currentPassword: TEMPORARY_PASSWORD,
        newPassword: NEW_PASSWORD,
      })
      .expect(204);
    expect(String(changedPassword.headers['set-cookie'])).toContain(
      'access_token=;',
    );

    await request(app.getHttpServer())
      .get(`${API}/auth/me`)
      .set('Cookie', temporaryCookie)
      .expect(401);
    const newCookie = await login(email, NEW_PASSWORD);
    const currentUser = await request(app.getHttpServer())
      .get(`${API}/auth/me`)
      .set('Cookie', newCookie)
      .expect(200);
    expect(currentUser.body.mustChangePassword).toBe(false);
  });

  it('rejects a user’s existing cookie after an admin deactivates the account', async () => {
    const target = await createFixtureUser(Role.MEMBER, 'deactivation-target');
    const targetCookie = await login(target.email, FIXTURE_PASSWORD);

    await request(app.getHttpServer())
      .get(`${API}/auth/me`)
      .set('Cookie', targetCookie)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`${API}/users/${target.id}`)
      .set('Cookie', adminCookie)
      .expect(204);
    await request(app.getHttpServer())
      .get(`${API}/auth/me`)
      .set('Cookie', targetCookie)
      .expect(401);
  });
});
