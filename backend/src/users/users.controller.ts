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
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListTeamUsersDto } from './dto/list-team-users.dto.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  list(@Query() query: ListUsersDto) {
    return this.usersService.list(query);
  }

  @Get('team')
  @Roles(Role.MANAGER, Role.ADMIN)
  listTeam(@Query() query: ListTeamUsersDto) {
    return this.usersService.listTeam(query);
  }

  @Get(':id/profile')
  @Roles(Role.MANAGER, Role.ADMIN)
  profile(@Param('id', ParseUUIDPipe) userId: string) {
    return this.usersService.profile(userId);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() input: CreateUserDto) {
    return this.usersService.create(input);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() input: UpdateUserDto,
  ) {
    return this.usersService.update(actor, userId, input);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  @Roles(Role.ADMIN)
  deactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.usersService.deactivate(actor, userId);
  }
}
