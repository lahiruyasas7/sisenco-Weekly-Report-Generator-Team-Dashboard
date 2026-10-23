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
  Put,
  Query,
} from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ListProjectsDto } from './dto/list-projects.dto.js';
import { ReplaceProjectMembersDto } from './dto/replace-project-members.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProjectsDto,
  ) {
    return this.projectsService.list(user.id, query);
  }

  @Get('assignable-members')
  @Roles(Role.MANAGER, Role.ADMIN)
  assignableMembers() {
    return this.projectsService.assignableMembers();
  }

  @Post()
  @Roles(Role.MANAGER, Role.ADMIN)
  create(@Body() input: CreateProjectDto) {
    return this.projectsService.create(input);
  }

  @Patch(':id')
  @Roles(Role.MANAGER, Role.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() input: UpdateProjectDto,
  ) {
    return this.projectsService.update(projectId, input);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  @Roles(Role.MANAGER, Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) projectId: string): Promise<void> {
    return this.projectsService.remove(projectId);
  }

  @Put(':id/members')
  @Roles(Role.MANAGER, Role.ADMIN)
  replaceMembers(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() input: ReplaceProjectMembersDto,
  ) {
    return this.projectsService.replaceMembers(projectId, input);
  }

  @Get(':id/members')
  @Roles(Role.MANAGER, Role.ADMIN)
  assignedMemberIds(@Param('id', ParseUUIDPipe) projectId: string) {
    return this.projectsService.assignedMemberIds(projectId);
  }
}
