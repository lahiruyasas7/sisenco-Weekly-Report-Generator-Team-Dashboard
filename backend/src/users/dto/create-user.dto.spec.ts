import { validate } from 'class-validator';
import { Role } from '../../generated/prisma/client.js';
import { describe, expect, it } from 'vitest';
import { CreateUserDto } from './create-user.dto.js';

function createDto(overrides: Record<string, unknown> = {}): CreateUserDto {
  return Object.assign(
    new CreateUserDto(),
    {
      email: 'new-user@example.com',
      name: 'New User',
      role: Role.MEMBER,
      temporaryPassword: 'TemporaryPassword123',
    },
    overrides,
  );
}

describe('CreateUserDto', () => {
  it('accepts a valid account with a temporary password', async () => {
    await expect(validate(createDto())).resolves.toHaveLength(0);
  });

  it('rejects a role that is not defined by the application', async () => {
    const errors = await validate(createDto({ role: 'INVALID_ROLE' }));

    expect(errors.some((error) => error.property === 'role')).toBe(true);
  });

  it('rejects temporary passwords outside bcrypt’s 15–72 byte range', async () => {
    const tooShort = await validate(createDto({ temporaryPassword: 'short' }));
    const tooLong = await validate(
      createDto({ temporaryPassword: 'a'.repeat(73) }),
    );

    expect(
      tooShort.some((error) => error.property === 'temporaryPassword'),
    ).toBe(true);
    expect(
      tooLong.some((error) => error.property === 'temporaryPassword'),
    ).toBe(true);
  });
});
