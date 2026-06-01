export type Employee = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  designation: string;
  status: string;
  joiningDate?: string;
};

export type JobPosting = {
  id: string;
  title: string;
  department: string;
  location: string;
  employmentType: string;
  status: string;
  publishedAt?: string;
};

export type Application = {
  id: string;
  candidateName?: string;
  jobTitle?: string;
  stage: string;
  createdAt: string;
};

export type DashboardStats = {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  pendingLeaves: number;
  activeJobPosts: number;
  applicationsCount: number;
  interviewsScheduled: number;
  attendanceTrend?: Array<{ label: string; primary: number; secondary?: number }>;
  recruitmentTrend?: Array<{ label: string; primary: number; secondary?: number }>;
};

export type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  body: string;
  channel?: string;
  isRead: boolean;
  metadata?: Record<string, string | number | boolean | null>;
  data?: Record<string, string | number | boolean | null>;
  readAt?: string | null;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  actorId?: string;
  actorUserId?: string;
  action?: string;
  event: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  actorLabel?: string;
  entityLabel?: string;
  createdAt: string;
};

export type ActivityLog = {
  id: string;
  actorId?: string;
  actorUserId?: string;
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
