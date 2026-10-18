import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { BCRYPT_SALT_ROUNDS } from './auth.constants.js';

@Injectable()
export class PasswordService {
  private readonly dummyHash = bcrypt.hash(randomUUID(), BCRYPT_SALT_ROUNDS);

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  async verify(password: string, passwordHash?: string): Promise<boolean> {
    const hash = passwordHash ?? (await this.dummyHash);
    const matches = await bcrypt.compare(password, hash);
    return passwordHash !== undefined && matches;
  }
}
