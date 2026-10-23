import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ReportStatus,
  type Report,
} from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReportAccessService } from './report-access.service.js';
import {
  reportContentInclude,
  ReportSnapshotService,
} from './report-snapshot.service.js';
import type { UpdateReportDto } from './dto/update-report.dto.js';

@Injectable()
export class ReportWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ReportAccessService,
    private readonly snapshots: ReportSnapshotService,
  ) {}

  async update(
    reportId: string,
    user: AuthenticatedUser,
    input: UpdateReportDto,
  ) {
    const current = await this.access.assertCanWrite(reportId, user);
    this.assertEditable(current.status);
    if (
      input.projectId === undefined &&
      input.tasks === undefined &&
      input.nextWeekTasks === undefined &&
      input.blockers === undefined &&
      input.achievements === undefined &&
      input.timeEntries === undefined &&
      input.notes === undefined &&
      input.links === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one report field to update',
      );
    }
    this.assertAtMostOneKey(input.blockers, 'blocker');
    this.assertAtMostOneKey(input.achievements, 'achievement');
    if (
      input.timeEntries &&
      new Set(input.timeEntries.map(({ taskType }) => taskType)).size !==
        input.timeEntries.length
    ) {
      throw new BadRequestException('Time entry task types must be unique');
    }

    try {
      await this.prisma.$transaction(
        async (transaction) => {
          const fresh = await transaction.report.findUnique({
            where: { id: reportId },
            select: { status: true },
          });
          if (!fresh) throw new NotFoundException('Report not found');
          this.assertEditable(fresh.status);

          if (input.projectId) {
            const project = await transaction.project.findUnique({
              where: { id: input.projectId },
              select: { id: true, isArchived: true },
            });
            if (!project) throw new NotFoundException('Project not found');
            if (project.isArchived) {
              throw new BadRequestException(
                'Archived projects cannot be selected',
              );
            }
          }

          const changed = await transaction.report.updateMany({
            where: { id: reportId, status: fresh.status },
            data: {
              ...(input.projectId !== undefined
                ? { projectId: input.projectId }
                : {}),
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
              ...(input.links !== undefined ? { links: input.links } : {}),
            },
          });
          if (changed.count !== 1) {
            throw new ConflictException(
              'Report changed during editing; reload and retry',
            );
          }

          if (input.tasks !== undefined) {
            await transaction.reportTask.deleteMany({ where: { reportId } });
            if (input.tasks.length) {
              await transaction.reportTask.createMany({
                data: input.tasks.map((task, position) => ({
                  reportId,
                  position,
                  ...task,
                  ...(task.name !== undefined
                    ? { name: task.name.trim() }
                    : {}),
                  ...(task.output !== undefined ? { output: task.output } : {}),
                })),
              });
            }
          }
          if (input.nextWeekTasks !== undefined) {
            await transaction.nextWeekTask.deleteMany({ where: { reportId } });
            if (input.nextWeekTasks.length) {
              await transaction.nextWeekTask.createMany({
                data: input.nextWeekTasks.map((item, position) => ({
                  reportId,
                  position,
                  ...item,
                  ...(item.description !== undefined
                    ? { description: item.description.trim() }
                    : {}),
                })),
              });
            }
          }
          if (input.blockers !== undefined) {
            await transaction.blocker.deleteMany({ where: { reportId } });
            if (input.blockers.length) {
              await transaction.blocker.createMany({
                data: input.blockers.map((item, position) => ({
                  reportId,
                  position,
                  ...item,
                  ...(item.description !== undefined
                    ? { description: item.description.trim() }
                    : {}),
                })),
              });
            }
          }
          if (input.achievements !== undefined) {
            await transaction.achievement.deleteMany({ where: { reportId } });
            if (input.achievements.length) {
              await transaction.achievement.createMany({
                data: input.achievements.map((item, position) => ({
                  reportId,
                  position,
                  ...item,
                  ...(item.description !== undefined
                    ? { description: item.description.trim() }
                    : {}),
                })),
              });
            }
          }
          if (input.timeEntries !== undefined) {
            await transaction.timeEntry.deleteMany({ where: { reportId } });
            if (input.timeEntries.length) {
              await transaction.timeEntry.createMany({
                data: input.timeEntries.map((entry) => ({
                  reportId,
                  ...entry,
                })),
              });
            }
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.mapTransactionConflict(error);
      throw error;
    }

    return this.access.loadForViewer(reportId, user);
  }

  async remove(reportId: string, user: AuthenticatedUser): Promise<void> {
    const report = await this.access.assertCanWrite(reportId, user);
    if (report.status !== ReportStatus.DRAFT) {
      throw new ConflictException('Only draft reports can be deleted');
    }
    const deleted = await this.prisma.report.deleteMany({
      where: { id: reportId, userId: user.id, status: ReportStatus.DRAFT },
    });
    if (deleted.count !== 1) {
      throw new ConflictException(
        'Report changed during deletion; reload and retry',
      );
    }
  }

  async submit(reportId: string, user: AuthenticatedUser) {
    const report = await this.access.assertCanWrite(reportId, user);
    this.assertSubmittableStatus(report.status);
    const submittedAt = new Date();

    try {
      await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.report.findUnique({
            where: { id: reportId },
            include: reportContentInclude,
          });
          if (!current) throw new NotFoundException('Report not found');
          this.assertSubmittableStatus(current.status);
          this.validateForSubmission(current);

          const changed = await transaction.report.updateMany({
            where: { id: reportId, status: current.status },
            data: {
              status: ReportStatus.SUBMITTED,
              currentVersion: { increment: 1 },
              submittedAt,
              firstSubmittedAt: current.firstSubmittedAt ?? submittedAt,
              reviewedAt: null,
            },
          });
          if (changed.count !== 1) {
            throw new ConflictException(
              'Report changed during submission; reload and retry',
            );
          }

          const versionNumber = current.currentVersion + 1;
          await transaction.reportVersion.create({
            data: {
              reportId,
              versionNumber,
              snapshot: this.snapshots.toSnapshot(current),
              submittedById: user.id,
              submittedAt,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.mapTransactionConflict(error);
      throw error;
    }

    return this.access.loadForViewer(reportId, user);
  }

  private validateForSubmission(
    report: Report & {
      project: { id: string; isArchived: boolean } | null;
      tasks: { name: string }[];
      nextWeekTasks: { description: string }[];
      blockers: { description: string }[];
      achievements: { description: string }[];
    },
  ): void {
    if (!report.projectId || !report.project || report.project.isArchived) {
      throw new BadRequestException(
        'Select a non-archived project before submission',
      );
    }
    if (report.tasks.length === 0) {
      throw new BadRequestException('Add at least one task before submission');
    }
    if (report.tasks.some(({ name }) => !name.trim())) {
      throw new BadRequestException(
        'Every task must have a name before submission',
      );
    }
    if (
      report.nextWeekTasks.some(({ description }) => !description.trim()) ||
      report.blockers.some(({ description }) => !description.trim()) ||
      report.achievements.some(({ description }) => !description.trim())
    ) {
      throw new BadRequestException(
        'Next-week tasks, blockers, and achievements must have descriptions',
      );
    }
  }

  private assertAtMostOneKey(
    rows: { isKey?: boolean }[] | undefined,
    label: string,
  ): void {
    if ((rows?.filter(({ isKey }) => isKey).length ?? 0) > 1) {
      throw new BadRequestException(
        `Only one key ${label} is allowed per report`,
      );
    }
  }

  private assertEditable(status: ReportStatus): void {
    if (
      status !== ReportStatus.DRAFT &&
      status !== ReportStatus.NEEDS_CORRECTION
    ) {
      throw new ConflictException(
        'Only draft or needs-correction reports can be edited',
      );
    }
  }

  private assertSubmittableStatus(status: ReportStatus): void {
    if (
      status !== ReportStatus.DRAFT &&
      status !== ReportStatus.NEEDS_CORRECTION
    ) {
      throw new ConflictException(
        'Only draft or needs-correction reports can be submitted',
      );
    }
  }

  private mapTransactionConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      throw new ConflictException(
        'Report changed concurrently; reload and retry',
      );
    }
  }
}
