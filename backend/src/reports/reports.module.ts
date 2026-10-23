import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReportAccessService } from './report-access.service.js';
import { ReportsController } from './reports.controller.js';
import { ReportSnapshotService } from './report-snapshot.service.js';
import { ReportWorkflowService } from './report-workflow.service.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [
    ReportAccessService,
    ReportSnapshotService,
    ReportWorkflowService,
    ReportsService,
  ],
})
export class ReportsModule {}
