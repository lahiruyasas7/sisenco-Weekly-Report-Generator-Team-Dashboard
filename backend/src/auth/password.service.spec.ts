import { beforeAll, describe, expect, it } from 'vitest';
import { BCRYPT_SALT_ROUNDS } from './auth.constants.js';
import { PasswordService } from './password.service.js';

const service = new PasswordService();
let storedHash: string;

describe('PasswordService', () => {
  beforeAll(async () => {
    storedHash = await service.hash('correct-password');
  });

  it('hashes passwords using the configured bcrypt work factor', async () => {
    const hash = await service.hash('another-password');

    expect(hash).not.toBe('another-password');
    expect(hash.split('$')[2]).toBe(
      String(BCRYPT_SALT_ROUNDS).padStart(2, '0'),
    );
  });

  it('verifies a password against its stored hash', async () => {
    await expect(service.verify('correct-password', storedHash)).resolves.toBe(
      true,
    );
  });

  it('returns false for an incorrect password', async () => {
    await expect(service.verify('wrong-password', storedHash)).resolves.toBe(
      false,
    );
  });

  it('performs a dummy bcrypt comparison for an unknown user and rejects it', async () => {
    await expect(service.verify('correct-password')).resolves.toBe(false);
  });
});
