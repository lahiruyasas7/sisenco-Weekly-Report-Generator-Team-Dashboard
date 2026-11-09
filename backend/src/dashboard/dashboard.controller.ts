import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto.js';
import { DashboardTasksTrendQueryDto } from './dto/dashboard-tasks-trend-query.dto.js';
import { DashboardDateRangeQueryDto } from './dto/dashboard-date-range-query.dto.js';
import { DashboardActivityQueryDto } from './dto/dashboard-activity-query.dto.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@Roles(Role.MANAGER, Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@Query() query: DashboardSummaryQueryDto) {
    return this.dashboard.summary(query.weekStart);
  }

  @Get('tasks-trend')
  tasksTrend(@Query() query: DashboardTasksTrendQueryDto) {
    return this.dashboard.tasksTrend(query.from, query.to, query.userId);
  }

  @Get('status-by-member')
  statusByMember(@Query() query: DashboardSummaryQueryDto) {
    return this.dashboard.statusByMember(query.weekStart);
  }

  @Get('workload-by-project')
  workloadByProject(@Query() query: DashboardDateRangeQueryDto) {
    return this.dashboard.workloadByProject(query.from, query.to);
  }

  @Get('time-by-type')
  timeByType(@Query() query: DashboardDateRangeQueryDto) {
    return this.dashboard.timeByType(query.from, query.to);
  }

  @Get('activity')
  activity(@Query() query: DashboardActivityQueryDto) {
    return this.dashboard.activity(query.limit);
  }
}
