import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { ListMyReportsDto } from './dto/list-my-reports.dto.js';
import { UpdateReportDto } from './dto/update-report.dto.js';
import { ListReportsDto } from './dto/list-reports.dto.js';
import { ReviewReportDto } from './dto/review-report.dto.js';
import { ReportWorkflowService } from './report-workflow.service.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly workflow: ReportWorkflowService,
  ) {}

  @Get()
  @Roles(Role.MANAGER, Role.ADMIN)
  listForReview(@Query() query: ListReportsDto) {
    return this.reports.listForReview(query);
  }

  @Get('me')
  @Roles(Role.MEMBER)
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyReportsDto,
  ) {
    return this.reports.listMine(user, query);
  }

  @Post()
  @Roles(Role.MEMBER)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateReportDto,
  ) {
    return this.reports.create(user, input);
  }

  @Get(':id')
  getOne(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reports.getOne(reportId, user);
  }

  @Get(':id/versions')
  getVersions(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reports.listVersions(reportId, user);
  }

  @Get(':id/versions/:versionNumber')
  getVersion(
    @Param('id', ParseUUIDPipe) reportId: string,
    @Param('versionNumber') versionNumber: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reports.getVersion(reportId, Number(versionNumber), user);
  }

  @Get(':id/reviews')
  getReviews(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reports.listReviews(reportId, user);
  }

  @Patch(':id')
  @Roles(Role.MEMBER)
  update(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: UpdateReportDto,
  ) {
    return this.workflow.update(reportId, user, input);
  }

  @Post(':id/submit')
  @Roles(Role.MEMBER)
  submit(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workflow.submit(reportId, user);
  }

  @Post(':id/review')
  @Roles(Role.MANAGER, Role.ADMIN)
  review(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ReviewReportDto,
  ) {
    return this.workflow.review(reportId, user, input);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  @Roles(Role.MEMBER)
  remove(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.workflow.remove(reportId, user);
  }
}
