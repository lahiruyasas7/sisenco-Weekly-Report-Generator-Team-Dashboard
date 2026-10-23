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

export type ReportStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'NEEDS_CORRECTION'
  | 'APPROVED';

export type ReportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReportTaskStatus =
  | 'COMPLETED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DEFERRED';
export type ReportTaskType =
  | 'DEVELOPMENT'
  | 'TESTING'
  | 'MEETINGS'
  | 'DOCUMENTATION'
  | 'DESIGN'
  | 'OTHER';

export type ReportContent = {
  weekStart: string;
  weekEnd: string;
  project: { id: string; name: string } | null;
  tasks: {
    name: string;
    priority: ReportPriority;
    plannedPercent: number;
    actualPercent: number;
    status: ReportTaskStatus;
    plannedHours: number;
    spentHours: number;
    output: string;
  }[];
  nextWeekTasks: {
    description: string;
    priority: ReportPriority;
    estimatedHours: number | null;
  }[];
  blockers: { description: string; isKey: boolean; isResolved: boolean }[];
  achievements: { description: string; isKey: boolean }[];
  timeEntries: { taskType: ReportTaskType; hours: number }[];
  notes: string;
  links: string[];
};

export type ReportReview = {
  action: 'APPROVED' | 'CHANGES_REQUESTED';
  comment: string | null;
  createdAt: string;
  reviewer: { id: string; name: string };
};

export type Report = {
  id: string;
  user: { id: string; name: string };
  status: ReportStatus;
  currentVersion: number;
  submittedAt: string | null;
  firstSubmittedAt: string | null;
  reviewedAt: string | null;
  latestReview: ReportReview | null;
  content: ReportContent;
};

export type ReportListItem = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: ReportStatus;
  currentVersion: number;
  submittedAt: string | null;
  firstSubmittedAt: string | null;
  project: { id: string; name: string } | null;
};

export type ReportListParams = {
  page?: number;
  limit?: number;
  status?: ReportStatus;
  from?: string;
  to?: string;
};

export type CreateReportInput = {
  weekStart: string;
  projectId?: string;
};

export type UpdateReportInput = {
  projectId: string | null;
  tasks: ReportContent['tasks'];
  nextWeekTasks: ReportContent['nextWeekTasks'];
  blockers: ReportContent['blockers'];
  achievements: ReportContent['achievements'];
  timeEntries: ReportContent['timeEntries'];
  notes: string | null;
  links: string[];
};
