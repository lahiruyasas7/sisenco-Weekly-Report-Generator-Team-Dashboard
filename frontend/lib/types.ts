export type UserRole = 'MEMBER' | 'MANAGER' | 'ADMIN';

export type Project = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  isAssigned: boolean;
  memberCount: number;
  reportCount: number;
};

export type AssignableMember = Pick<PublicUser, 'id' | 'name'>;

export type ProjectListParams = {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
};

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  color?: string | null;
};

export type UpdateProjectInput = Partial<CreateProjectInput> & {
  isArchived?: boolean;
};

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
