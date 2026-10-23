-- Drafts may be created before a project is selected; submission enforces it in the service.
ALTER TABLE "Report" ALTER COLUMN "projectId" DROP NOT NULL;

CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "TaskStatus" AS ENUM ('COMPLETED', 'IN_PROGRESS', 'BLOCKED', 'DEFERRED');
CREATE TYPE "TaskType" AS ENUM ('DEVELOPMENT', 'TESTING', 'MEETINGS', 'DOCUMENTATION', 'DESIGN', 'OTHER');
CREATE TYPE "ReviewAction" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

CREATE TABLE "ReportTask" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "plannedPercent" INTEGER NOT NULL DEFAULT 0,
    "actualPercent" INTEGER NOT NULL DEFAULT 0,
    "status" "TaskStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "plannedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spentHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "output" TEXT,
    CONSTRAINT "ReportTask_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ReportTask_plannedPercent_check" CHECK ("plannedPercent" BETWEEN 0 AND 100),
    CONSTRAINT "ReportTask_actualPercent_check" CHECK ("actualPercent" BETWEEN 0 AND 100),
    CONSTRAINT "ReportTask_plannedHours_check" CHECK ("plannedHours" >= 0),
    CONSTRAINT "ReportTask_spentHours_check" CHECK ("spentHours" >= 0)
);

CREATE TABLE "NextWeekTask" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "estimatedHours" DOUBLE PRECISION,
    CONSTRAINT "NextWeekTask_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NextWeekTask_estimatedHours_check" CHECK ("estimatedHours" IS NULL OR "estimatedHours" >= 0)
);

CREATE TABLE "Blocker" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isKey" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Blocker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isKey" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "taskType" "TaskType" NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TimeEntry_hours_check" CHECK ("hours" >= 0)
);

CREATE TABLE "ReportVersion" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportTask_reportId_position_key" ON "ReportTask"("reportId", "position");
CREATE INDEX "ReportTask_reportId_idx" ON "ReportTask"("reportId");
CREATE UNIQUE INDEX "NextWeekTask_reportId_position_key" ON "NextWeekTask"("reportId", "position");
CREATE INDEX "NextWeekTask_reportId_idx" ON "NextWeekTask"("reportId");
CREATE UNIQUE INDEX "Blocker_reportId_position_key" ON "Blocker"("reportId", "position");
CREATE INDEX "Blocker_reportId_idx" ON "Blocker"("reportId");
CREATE UNIQUE INDEX "Blocker_one_key_per_report" ON "Blocker"("reportId") WHERE "isKey";
CREATE UNIQUE INDEX "Achievement_reportId_position_key" ON "Achievement"("reportId", "position");
CREATE INDEX "Achievement_reportId_idx" ON "Achievement"("reportId");
CREATE UNIQUE INDEX "Achievement_one_key_per_report" ON "Achievement"("reportId") WHERE "isKey";
CREATE UNIQUE INDEX "TimeEntry_reportId_taskType_key" ON "TimeEntry"("reportId", "taskType");
CREATE UNIQUE INDEX "ReportVersion_reportId_versionNumber_key" ON "ReportVersion"("reportId", "versionNumber");
CREATE UNIQUE INDEX "Review_versionId_key" ON "Review"("versionId");
CREATE INDEX "Review_reportId_idx" ON "Review"("reportId");
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

ALTER TABLE "ReportTask" ADD CONSTRAINT "ReportTask_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NextWeekTask" ADD CONSTRAINT "NextWeekTask_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Blocker" ADD CONSTRAINT "Blocker_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportVersion" ADD CONSTRAINT "ReportVersion_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportVersion" ADD CONSTRAINT "ReportVersion_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ReportVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
