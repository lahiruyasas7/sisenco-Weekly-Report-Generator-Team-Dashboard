import { DateTime } from 'luxon';
import { Prisma, PrismaClient, Role } from '../src/generated/prisma/client.js';
import {
  buildDemoReportFixtures,
  DEMO_PROJECTS,
  DEMO_USERS,
} from './demo-fixtures.js';

const projectColors = ['#0C7C72', '#4769A8', '#7A5AA6', '#B46A34', '#577B42'];

export async function seedDemoData(
  prisma: PrismaClient,
  passwordHash: string,
  timezone: string,
  dueOffsetDays: number,
  now: DateTime = DateTime.now(),
): Promise<void> {
  const users = DEMO_USERS.map((user) => ({
    ...user,
    role: user.role === 'MANAGER' ? Role.MANAGER : Role.MEMBER,
  }));
  const userIds = users.map(({ id }) => id);
  const projectIds = DEMO_PROJECTS.map(({ id }) => id);
  const members = users.slice(1);
  const fixtures = buildDemoReportFixtures({ now, timezone, dueOffsetDays });
  const firstFixtureWeekIso = now
    .setZone(timezone)
    .startOf('week')
    .minus({ weeks: 7 })
    .toISODate();
  if (!firstFixtureWeekIso) {
    throw new Error('Unable to determine first demo report week');
  }
  const demoUsersCreatedAt = DateTime.fromISO(firstFixtureWeekIso, {
    zone: 'utc',
  }).toJSDate();
  const currentWeekIso = now.setZone(timezone).startOf('week').toISODate();
  if (!currentWeekIso)
    throw new Error('Unable to determine current report week');
  const currentWeekStart = DateTime.fromISO(currentWeekIso, {
    zone: 'utc',
  }).toJSDate();

  await prisma.$transaction(
    async (transaction) => {
      for (const user of users) {
        const existingById = await transaction.user.findUnique({
          where: { id: user.id },
          select: { id: true, email: true, role: true },
        });
        const existingByEmail = await transaction.user.findUnique({
          where: { email: user.email },
          select: { id: true, email: true, role: true },
        });
        if (
          (existingById && existingById.email !== user.email) ||
          (existingByEmail && existingByEmail.id !== user.id) ||
          (existingByEmail && existingByEmail.role !== user.role)
        ) {
          throw new Error(
            `Refusing to overwrite an account that conflicts with demo identity ${user.email}`,
          );
        }

        await transaction.user.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            passwordHash,
            isActive: true,
            mustChangePassword: false,
            createdAt: demoUsersCreatedAt,
            updatedAt: now.toJSDate(),
          },
          update: {
            email: user.email,
            name: user.name,
            role: user.role,
            passwordHash,
            isActive: true,
            mustChangePassword: false,
            createdAt: demoUsersCreatedAt,
            updatedAt: now.toJSDate(),
          },
        });
      }

      await transaction.userSession.updateMany({
        where: { userId: { in: userIds }, revokedAt: null },
        data: { revokedAt: now.toJSDate() },
      });

      for (const [index, project] of DEMO_PROJECTS.entries()) {
        const existingProject = await transaction.project.findFirst({
          where: { name: { equals: project.name, mode: 'insensitive' } },
          select: { id: true },
        });
        if (existingProject && existingProject.id !== project.id) {
          throw new Error(
            `Project "${project.name}" already exists outside the demo seed; refusing to adopt it`,
          );
        }
        await transaction.project.upsert({
          where: { id: project.id },
          create: {
            id: project.id,
            name: project.name,
            description: `Demo project for ${project.name}.`,
            color: projectColors[index],
            isArchived: false,
          },
          update: {
            name: project.name,
            description: `Demo project for ${project.name}.`,
            color: projectColors[index],
            isArchived: false,
          },
        });
      }

      await transaction.projectMember.deleteMany({
        where: {
          projectId: { in: projectIds },
          userId: { in: userIds },
        },
      });
      const assignments = DEMO_PROJECTS.flatMap((project, projectIndex) => {
        const assignedMembers = [
          members[projectIndex % members.length],
          members[(projectIndex + 2) % members.length],
        ];
        return assignedMembers.map((member) => ({
          projectId: project.id,
          userId: member.id,
        }));
      });
      await transaction.projectMember.createMany({ data: assignments });

      await transaction.report.deleteMany({
        where: {
          userId: members[0].id,
          weekStart: currentWeekStart,
        },
      });

      for (const fixture of fixtures) {
        const scalarData = {
          projectId: fixture.projectId,
          weekEnd: fixture.weekEnd,
          status: fixture.status,
          currentVersion: fixture.currentVersion,
          notes: fixture.content.notes,
          links: fixture.content.links,
          submittedAt: fixture.submittedAt,
          firstSubmittedAt: fixture.firstSubmittedAt,
          reviewedAt: fixture.reviewedAt,
          createdAt: fixture.createdAt,
          updatedAt: fixture.updatedAt,
        };
        const report = await transaction.report.upsert({
          where: {
            userId_weekStart: {
              userId: fixture.userId,
              weekStart: fixture.weekStart,
            },
          },
          create: {
            userId: fixture.userId,
            weekStart: fixture.weekStart,
            ...scalarData,
          },
          update: scalarData,
          select: { id: true },
        });

        await transaction.review.deleteMany({
          where: { reportId: report.id },
        });
        await transaction.reportVersion.deleteMany({
          where: { reportId: report.id },
        });
        await transaction.reportTask.deleteMany({
          where: { reportId: report.id },
        });
        await transaction.nextWeekTask.deleteMany({
          where: { reportId: report.id },
        });
        await transaction.blocker.deleteMany({
          where: { reportId: report.id },
        });
        await transaction.achievement.deleteMany({
          where: { reportId: report.id },
        });
        await transaction.timeEntry.deleteMany({
          where: { reportId: report.id },
        });

        const content = fixture.content;
        if (content.tasks.length) {
          await transaction.reportTask.createMany({
            data: content.tasks.map((task, position) => ({
              reportId: report.id,
              position,
              ...task,
            })),
          });
        }
        if (content.nextWeekTasks.length) {
          await transaction.nextWeekTask.createMany({
            data: content.nextWeekTasks.map((task, position) => ({
              reportId: report.id,
              position,
              ...task,
            })),
          });
        }
        if (content.blockers.length) {
          await transaction.blocker.createMany({
            data: content.blockers.map((blocker, position) => ({
              reportId: report.id,
              position,
              ...blocker,
            })),
          });
        }
        if (content.achievements.length) {
          await transaction.achievement.createMany({
            data: content.achievements.map((achievement, position) => ({
              reportId: report.id,
              position,
              ...achievement,
            })),
          });
        }
        if (content.timeEntries.length) {
          await transaction.timeEntry.createMany({
            data: content.timeEntries.map((entry) => ({
              reportId: report.id,
              ...entry,
            })),
          });
        }

        for (const version of fixture.versions) {
          const createdVersion = await transaction.reportVersion.create({
            data: {
              reportId: report.id,
              versionNumber: version.versionNumber,
              snapshot: version.snapshot as Prisma.InputJsonValue,
              submittedById: fixture.userId,
              submittedAt: version.submittedAt,
            },
            select: { id: true },
          });
          if (version.review) {
            await transaction.review.create({
              data: {
                reportId: report.id,
                versionId: createdVersion.id,
                reviewerId: version.review.reviewerId,
                action: version.review.action,
                comment: version.review.comment,
                createdAt: version.review.createdAt,
              },
            });
          }
        }
      }
    },
    { timeout: 60_000 },
  );
}
