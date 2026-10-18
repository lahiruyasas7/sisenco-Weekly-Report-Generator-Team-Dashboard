import type { Role } from '../../generated/prisma/client.js';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  sessionId: string;
};
