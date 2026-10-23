import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { databaseDateToOnly } from '../common/utils/week.util.js';

export const reportContentInclude = {
  project: { select: { id: true, name: true, isArchived: true } },
  tasks: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
  nextWeekTasks: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
  blockers: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
  achievements: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
  timeEntries: { orderBy: [{ taskType: 'asc' }] },
} satisfies Prisma.ReportInclude;

export type LoadedReport = Prisma.ReportGetPayload<{
  include: typeof reportContentInclude;
}>;

export type ReportContent = {
  weekStart: string;
  weekEnd: string;
  project: { id: string; name: string } | null;
  tasks: {
    name: string;
    priority: string;
    plannedPercent: number;
    actualPercent: number;
    status: string;
    plannedHours: number;
    spentHours: number;
    output: string;
  }[];
  nextWeekTasks: {
    description: string;
    priority: string;
    estimatedHours: number | null;
  }[];
  blockers: { description: string; isKey: boolean; isResolved: boolean }[];
  achievements: { description: string; isKey: boolean }[];
  timeEntries: { taskType: string; hours: number }[];
  notes: string;
  links: string[];
};

@Injectable()
export class ReportSnapshotService {
  toContent(report: LoadedReport): ReportContent {
    return {
      weekStart: databaseDateToOnly(report.weekStart),
      weekEnd: databaseDateToOnly(report.weekEnd),
      project: report.project
        ? { id: report.project.id, name: report.project.name }
        : null,
      tasks: report.tasks.map((task) => ({
        name: task.name,
        priority: task.priority,
        plannedPercent: task.plannedPercent,
        actualPercent: task.actualPercent,
        status: task.status,
        plannedHours: task.plannedHours,
        spentHours: task.spentHours,
        output: task.output ?? '',
      })),
      nextWeekTasks: report.nextWeekTasks.map((task) => ({
        description: task.description,
        priority: task.priority,
        estimatedHours: task.estimatedHours,
      })),
      blockers: report.blockers.map((blocker) => ({
        description: blocker.description,
        isKey: blocker.isKey,
        isResolved: blocker.isResolved,
      })),
      achievements: report.achievements.map((achievement) => ({
        description: achievement.description,
        isKey: achievement.isKey,
      })),
      timeEntries: report.timeEntries.map((entry) => ({
        taskType: entry.taskType,
        hours: entry.hours,
      })),
      notes: report.notes ?? '',
      links: report.links,
    };
  }

  toSnapshot(report: LoadedReport): Prisma.InputJsonValue {
    return this.toContent(report) as Prisma.InputJsonValue;
  }
}
