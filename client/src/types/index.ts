import type { PermissionAction, PermissionLevel, PermissionScope } from '@/lib/permissions';

export type DateRange = {
  from: string;
  to: string;
};

export type ApiError = {
  message: string;
  statusCode?: number;
  code?: string;
  details?: Array<{
    field?: string;
    message: string;
  }>;
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type Department = {
  id: string;
  code: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type Permission = {
  id: string;
  roleId: string;
  scope: PermissionScope;
  level: PermissionLevel;
  actions: PermissionAction[];
  createdAt: string;
  updatedAt: string;
};

export type Role = {
  id: string;
  code: string;
  name: string;
  description?: string;
  hierarchyLevel: number;
  isSystem: boolean;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  id: string;
  userId: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  departmentId?: string;
  departmentName?: string;
  designationId?: string;
  designationName?: string;
  reportingManagerId?: string;
  roles: Role[];
  permissions: PermissionScope[];
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PASSWORD_RESET_REQUIRED';
  forcePasswordReset: boolean;
  joinDate: string;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  attendanceDate: string;
  checkInAt?: string;
  checkOutAt?: string;
  workMinutes: number;
  breakMinutes: number;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';
  createdAt: string;
  updatedAt: string;
};

export type LeaveBalance = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  allocated: number;
  used: number;
  remaining: number;
  createdAt: string;
  updatedAt: string;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: 'PENDING_TEAM_LEAD' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
};

export type JobPosting = {
  id: string;
  title: string;
  slug: string;
  description: string;
  department: string;
  location: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'CONSULTANT';
  experience?: string;
  salaryRange?: string;
  skills: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'CLOSED';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  experience?: number;
  skills: string[];
  createdAt: string;
  updatedAt: string;
};

export type Interview = {
  id: string;
  applicationId: string;
  interviewerId: string;
  scheduledAt: string;
  durationMins: number;
  mode: string;
  meetingLink?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED' | 'FEEDBACK_PENDING';
  rating?: number;
  feedback?: string;
  remarks?: string;
  notifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingTask = {
  id: string;
  workflowId: string;
  title: string;
  description?: string;
  ownerId?: string;
  dueDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  createdAt: string;
  updatedAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  body: string;
  isRead: boolean;
  channel?: string;
  metadata?: Record<string, string | number | boolean | null>;
  data?: Record<string, string | number | boolean | null>;
  readAt?: string | null;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  summary?: string;
  actorLabel?: string;
  entityLabel?: string;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  summary?: string;
  actorLabel?: string;
  entityLabel?: string;
  createdAt: string;
};
