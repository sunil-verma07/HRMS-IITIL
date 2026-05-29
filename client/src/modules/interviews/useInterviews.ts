import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { httpClient } from "@/services/api/http-client";
import { endpoints } from "@/services/api/endpoints";
import type { InterviewRecord } from "@/modules/recruitment/recruitment-columns";
import type { InterviewFilters } from "./useInterviewStore";

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type InterviewAnalytics = {
  todayCount: number;
  upcomingCount: number;
  pendingFeedbackCount: number;
  completedCount: number;
  selectedCount: number;
  cancelledCount: number;
};

export type CreateInterviewPayload = {
  applicationId: string;
  interviewerId: string;
  scheduledAt: string;
  durationMins: number;
  mode: string;
  meetingLink?: string;
  notes?: string;
};

export type UpdateInterviewPayload = Partial<{
  scheduledAt: string;
  durationMins: number;
  mode: string;
  meetingLink: string;
  status: string;
  notes: string;
  feedback: string;
}>;

export type CandidateOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type ApplicationOption = {
  id: string;
  stage: string;
  job: { id: string; title: string; department: string };
};

export type EmployeeOption = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string;
};

export type JobOption = {
  id: string;
  title: string;
  department: string;
  status: string;
};

export type ApplicationSource =
  | "PORTAL"
  | "EMAIL"
  | "LINKEDIN"
  | "REFERRAL"
  | "AGENCY"
  | "OTHER";

export type QuickCreatePayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  jobId: string;
  source: ApplicationSource;
  resumeUrl?: string;
  notes?: string;
};

export type QuickCreateResult = {
  candidate: Pick<CandidateOption, "id" | "firstName" | "lastName" | "email">;
  application: {
    id: string;
    jobId: string;
    candidateId: string;
    stage: string;
  };
  jobIsPublished: boolean;
  action: "created" | "existing";
};


export const interviewKeys = {
  all: ["interviews"] as const,
  lists: () => [...interviewKeys.all, "list"] as const,
  list: (
    page: number,
    limit: number,
    search: string,
    filters: InterviewFilters,
  ) => [...interviewKeys.lists(), { page, limit, search, filters }] as const,
  detail: (id: string) => [...interviewKeys.all, "detail", id] as const,
  analytics: () => [...interviewKeys.all, "analytics"] as const,
  candidateApplications: (candidateId: string) =>
    [...interviewKeys.all, "applications", candidateId] as const,
};


export const jobKeys = {
  all: ["jobs"] as const,
  options: () => [...jobKeys.all, "options"] as const,
};

export const candidateKeys = {
  all: ["candidates"] as const,
  options: (search: string) =>
    [...candidateKeys.all, "options", search] as const,
};

function buildInterviewParams(
  page: number,
  limit: number,
  search: string,
  filters: InterviewFilters,
): Record<string, string> {
  const params: Record<string, string> = {
    page: String(page),
    limit: String(limit),
  };
  if (search) params.search = search;
  if (filters.status.length) params.status = filters.status.join(",");
  if (filters.mode.length) params.mode = filters.mode.join(",");
  if (filters.department.length) params.department = filters.department.join(",");
  if (filters.interviewerId) params.interviewerId = filters.interviewerId;
  if (filters.candidateSearch) params.candidateSearch = filters.candidateSearch;
  if (filters.jobSearch) params.jobSearch = filters.jobSearch;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  return params;
}


export function useInterviews(
  page: number,
  limit: number,
  search: string,
  filters: InterviewFilters,
) {
  return useQuery<PaginatedResponse<InterviewRecord>>({
    queryKey: interviewKeys.list(page, limit, search, filters),
    queryFn: async () => {
      const params = buildInterviewParams(page, limit, search, filters);
      const { data } = await httpClient.get(endpoints.recruitment.interviews, {
        params,
      });
      return data.data;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useInterviewAnalytics() {
  return useQuery<InterviewAnalytics>({
    queryKey: interviewKeys.analytics(),
    queryFn: async () => {
      const { data } = await httpClient.get(
        `${endpoints.recruitment.interviews}/analytics`,
      );
      return data.data;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function useInterviewDetail(id: string | null) {
  return useQuery<InterviewRecord>({
    queryKey: interviewKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await httpClient.get(
        `${endpoints.recruitment.interviews}/${id}`,
      );
      return data.data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}


export function useCandidates(search: string) {
  return useQuery<CandidateOption[]>({
    queryKey: candidateKeys.options(search),
    queryFn: async () => {
      const { data } = await httpClient.get(endpoints.recruitment.candidates, {
        params: { search, limit: 20 },
      });
      return data.data.items;
    },
  
    enabled: search.length >= 1,
    staleTime: 60_000,
  });
}

export function useCandidateApplications(candidateId: string | null) {
  return useQuery<ApplicationOption[]>({
    queryKey: interviewKeys.candidateApplications(candidateId ?? ""),
    queryFn: async () => {
      const { data } = await httpClient.get(endpoints.recruitment.applications, {
        params: { candidateId, limit: 50 },
      });
      return data.data.items;
    },
    enabled: !!candidateId,
    staleTime: 60_000,
  });
}

export function useInterviewers(search: string) {
  return useQuery<EmployeeOption[]>({
    queryKey: ["employees", "options", search],
    queryFn: async () => {
      const { data } = await httpClient.get(endpoints.employees, {
        params: { search, limit: 20 },
      });
      return data.data.items;
    },
    enabled: true,
    staleTime: 60_000,
  });
}


export function useJobs() {
  return useQuery<JobOption[]>({
    queryKey: jobKeys.options(),
    queryFn: async () => {
      const { data } = await httpClient.get(endpoints.recruitment.jobs, {
        params: { limit: 200, status: "PUBLISHED" },
      });
      return data.data.items;
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateInterview() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateInterviewPayload) => {
      const { data } = await httpClient.post(
        endpoints.recruitment.interviews,
        payload,
      );
      return data.data;
    },
    onSuccess: async (interview) => {
      await qc.invalidateQueries({ queryKey: interviewKeys.lists() });
      await qc.invalidateQueries({ queryKey: interviewKeys.analytics() });
      toast.success("Interview scheduled successfully");

      httpClient
        .post(endpoints.notifications, {
          type: "INTERVIEW_SCHEDULED",
          referenceId: interview.id,
          message: `Interview scheduled for ${new Date(
            interview.scheduledAt,
          ).toLocaleString()}`,
        })
        .catch(() => {});
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message ?? "Failed to schedule interview",
      );
    },
  });
}

export function useUpdateInterview() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateInterviewPayload;
    }) => {
      const { data } = await httpClient.patch(
        `${endpoints.recruitment.interviews}/${id}`,
        payload,
      );
      return data.data;
    },


    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: interviewKeys.detail(id) });
      const prev = qc.getQueryData(interviewKeys.detail(id));
      qc.setQueryData(interviewKeys.detail(id), (old: any) =>
        old ? { ...old, ...payload } : old,
      );
      return { prev };
    },
    onError: (_err, { id }, ctx) => {
      if (ctx?.prev) qc.setQueryData(interviewKeys.detail(id), ctx.prev);
      toast.error("Failed to update interview");
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: interviewKeys.lists() });
      qc.invalidateQueries({ queryKey: interviewKeys.detail(id) });
      qc.invalidateQueries({ queryKey: interviewKeys.analytics() });
      toast.success("Interview updated");
    },
  });
}

export function useDeleteInterview() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await httpClient.delete(`${endpoints.recruitment.interviews}/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interviewKeys.lists() });
      qc.invalidateQueries({ queryKey: interviewKeys.analytics() });
      toast.success("Interview cancelled");
    },
    onError: () => {
      toast.error("Failed to cancel interview");
    },
  });
}


export function useQuickCreateCandidateAndApplication() {
  const qc = useQueryClient();

  return useMutation<QuickCreateResult, Error, QuickCreatePayload>({
    mutationFn: async (payload) => {
      const { data } = await httpClient.post(
        endpoints.recruitment.quickCreate, 
        payload,
      );
      return data.data as QuickCreateResult;
    },

    onSuccess: (result) => {

      qc.invalidateQueries({ queryKey: candidateKeys.all });


      qc.invalidateQueries({
        queryKey: interviewKeys.candidateApplications(result.candidate.id),
      });


    },

    onError: (err: any) => {
      
      toast.error(
        err?.response?.data?.message ??
          "Failed to create candidate. Please try again.",
      );
    },
  });
}