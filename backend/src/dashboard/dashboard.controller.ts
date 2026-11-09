import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { DashboardSummaryQueryDto } from './dto/dashboard-summary-query.dto.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@Roles(Role.MANAGER, Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  summary(@Query() query: DashboardSummaryQueryDto) {
    return this.dashboard.summary(query.weekStart);
  }
}
