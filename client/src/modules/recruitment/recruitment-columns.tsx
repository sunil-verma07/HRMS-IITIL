// src/modules/recruitment/recruitment-columns.ts
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

export type JobRecord = {
  id: string;
  title: string;
  department: string;
  employmentType: string;
  location: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
};

export type CandidateRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  experience: number | null;
  skills: string[];
  createdAt: string;
};

export type ApplicationRecord = {
  id: string;
  stage: string;
  candidate: { firstName: string; lastName: string; email: string };
  job: { title: string; department: string };
  createdAt: string;
};

export type InterviewRecord = {
  id: string;
  scheduledAt: string;
  status: string;
  mode: string;
  interviewer: { firstName: string; lastName: string } | null;
  application: { candidate: { firstName: string; lastName: string }; job: { title: string } } | null;
};

const statusVariant: Record<string, "default" | "violet" | "success" | "warning" | "destructive"> = {
  DRAFT: "default",
  PUBLISHED: "success",
  UNPUBLISHED: "warning",
  CLOSED: "destructive",
  APPLIED: "default",
  SCREENING: "violet",
  INTERVIEW_SCHEDULED: "warning",
  TECHNICAL_ROUND: "violet",
  HR_ROUND: "violet",
  SELECTED: "success",
  REJECTED: "destructive",
  OFFER_SENT: "success",
  JOINED: "success",
  SCHEDULED: "default",
  COMPLETED: "success",
  CANCELLED: "destructive",
  NO_SHOW: "destructive"
};

export const jobColumns = (onEdit: (job: any) => void, onDelete: (id: string) => void): ColumnDef<JobRecord>[] => [
  { accessorKey: "title", header: "Title" },
  { accessorKey: "department", header: "Department" },
  { accessorKey: "employmentType", header: "Type" },
  { accessorKey: "location", header: "Location" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant={statusVariant[row.original.status]}>{row.original.status}</Badge>
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDelete(row.original.id)}>
          <Trash2 className="size-4 text-rose-400" />
        </Button>
      </div>
    )
  }
];
export const candidateColumns: ColumnDef<CandidateRecord>[] = [
  {
    id: "name",
    header: "Name",
    cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`
  },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "experience", header: "Experience (yrs)" },
  {
    accessorKey: "skills",
    header: "Skills",
    cell: ({ row }) => row.original.skills?.slice(0, 3).join(", ") || "-"
  },
  {
    accessorKey: "createdAt",
    header: "Added",
    cell: ({ row }) => formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })
  }
];

export const applicationColumns: ColumnDef<ApplicationRecord>[] = [
  {
    id: "candidate",
    header: "Candidate",
    cell: ({ row }) => `${row.original.candidate.firstName} ${row.original.candidate.lastName}`
  },
  {
    id: "job",
    header: "Job",
    cell: ({ row }) => row.original.job.title
  },
  {
    accessorKey: "stage",
    header: "Stage",
    cell: ({ row }) => <Badge variant={statusVariant[row.original.stage] || "default"}>{row.original.stage}</Badge>
  },
  {
    accessorKey: "createdAt",
    header: "Applied",
    cell: ({ row }) => formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })
  }
];

export const interviewColumns: ColumnDef<InterviewRecord>[] = [
  {
    id: "candidate",
    header: "Candidate",
    cell: ({ row }) => row.original.application?.candidate ? `${row.original.application.candidate.firstName} ${row.original.application.candidate.lastName}` : "-"
  },
  {
    id: "job",
    header: "Job",
    cell: ({ row }) => row.original.application?.job?.title || "-"
  },
  {
    accessorKey: "scheduledAt",
    header: "Scheduled",
    cell: ({ row }) => new Date(row.original.scheduledAt).toLocaleString()
  },
  {
    id: "interviewer",
    header: "Interviewer",
    cell: ({ row }) => row.original.interviewer ? `${row.original.interviewer.firstName} ${row.original.interviewer.lastName}` : "-"
  },
  { accessorKey: "mode", header: "Mode" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <Badge variant={statusVariant[row.original.status] || "default"}>{row.original.status}</Badge>
  }
];