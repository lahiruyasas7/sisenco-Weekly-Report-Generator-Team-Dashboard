import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TeamSectionsQueryDto } from './dto/team-sections-query.dto.js';
import { TeamWeekQueryDto } from './dto/team-week-query.dto.js';
import { TeamService } from './team.service.js';

@Controller('team')
@Roles(Role.MANAGER, Role.ADMIN)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('week-status')
  weekStatus(@Query() query: TeamWeekQueryDto) {
    return this.team.weekStatus(query.weekStart);
  }

  @Get('sections')
  sections(@Query() query: TeamSectionsQueryDto) {
    return this.team.sections(query.weekStart, query.section);
  }
}
