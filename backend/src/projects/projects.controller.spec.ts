import { describe, expect, it } from 'vitest';
import { Role } from '../generated/prisma/client.js';
import { ROLES_KEY } from '../common/decorators/roles.decorator.js';
import { ProjectsController } from './projects.controller.js';

describe('ProjectsController role metadata', () => {
  it('leaves project listing available to all authenticated roles', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, ProjectsController.prototype.list),
    ).toBeUndefined();
  });

  it('restricts project mutations and member lookup to managers and admins', () => {
    const managerRoles = [Role.MANAGER, Role.ADMIN];
    for (const handler of [
      ProjectsController.prototype.assignableMembers,
      ProjectsController.prototype.create,
      ProjectsController.prototype.update,
      ProjectsController.prototype.remove,
      ProjectsController.prototype.replaceMembers,
    ]) {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(managerRoles);
    }
  });
});
