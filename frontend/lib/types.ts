export type UserRole = 'MEMBER' | 'MANAGER' | 'ADMIN';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  name: string;
};

export type UpdateProfileInput = {
  name: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type UserListParams = {
  page?: number;
  limit?: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
};

export type CreateUserInput = {
  email: string;
  name: string;
  role: UserRole;
  temporaryPassword: string;
};

export type UpdateUserInput = {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
};
