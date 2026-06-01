export const RECRUITMENT_PIPELINE = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'TECHNICAL',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const;

export type RecruitmentStage = (typeof RECRUITMENT_PIPELINE)[number];

export type RecruitmentJob = {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  employmentType: string;
  status: string;
  publishedAt?: string | null;
  createdAt?: string;
  createdByHr?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    department: string;
  };
  pipelineStages?: string[];
};

export type CandidatePipelineItem = {
  id: string;
  applicationId: string;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    resumeUrl?: string | null;
    tags?: string[];
  };
  stage: string;
  score: number;
  tags: string[];
  currentInterviewStatus: string | null;
  appliedAt: string;
  notes?: string | null;
};

export type CandidateNote = {
  id: string;
  body: string;
  createdAt: string;
  author?: {
    firstName: string;
    lastName: string;
  } | null;
};

export type CandidateDetail = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  resumeUrl?: string | null;
  tags: string[];
  applications: Array<{
    id: string;
    stage: string;
    score: number;
    tags: string[];
    notes?: string | null;
    job: {
      id: string;
      title: string;
      department: string;
    };
    interviews: Array<{
      id: string;
      scheduledAt: string;
      status: string;
      interviewer?: {
        firstName: string;
        lastName: string;
      } | null;
    }>;
  }>;
  notes: CandidateNote[];
};

export type RecruitmentJobListResponse = {
  items: RecruitmentJob[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};
