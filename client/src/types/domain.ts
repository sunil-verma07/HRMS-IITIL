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
