import type { PaginatedResponse } from '@/types';

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type EmployeeListItem = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string | null;
  department: string;
  designation: string;
  reportingManager: string | null;
  status: string;
  joinDate: string;
  lastActive: string | null;
};

export type EmployeeProfile = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  avatar?: string | null;
  department: string;
  designation: string;
  status: string;
  joinDate: string;
  phone?: string;
  reportingManagerId?: string | null;
  reportingManager?: {
    id: string;
    employeeId: string;
    name: string;
    designation: string;
    avatar?: string | null;
  } | null;
  attendanceSummary?: {
    periodDays: number;
    byStatus: Array<{ status: string; count: number }>;
    averageWorkMinutes: number;
  };
  leaveBalances?: Array<{
    leaveType: string;
    leaveTypeCode: string;
    year: number;
    allocated: number;
    used: number;
    remaining: number;
  }>;
  onboardingStatus?: {
    id?: string;
    status: string;
    currentStep: number;
  } | null;
  documents?: string[];
  directReports?: Array<{
    id: string;
    employeeId?: string;
    name: string;
    designation: string;
    status: string;
  }>;
  permissionsSummary?: {
    roles: string[];
    totalPermissions: number;
    permissions: string[];
  };
};

export type FilterOption = {
  id: string;
  name: string;
  avatar?: string | null;
};

export type PeopleFiltersData = {
  departments: FilterOption[];
  roles: FilterOption[];
  designations: FilterOption[];
  reportingManagers: FilterOption[];
};

export type ImportValidationResult = {
  valid: Array<Record<string, unknown>>;
  invalid: Array<{ row: number; errors: string[] }>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicateEmails: number;
    duplicateIds: number;
  };
};

export type PeopleListResponse = PaginatedResponse<EmployeeListItem>;

export function splitCsvParam(value: string | null): string[] {
  return value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
}

export function setSingleSearchParam(params: URLSearchParams, key: string, value?: string): URLSearchParams {
  const next = new URLSearchParams(params);

  if (value && value.length > 0) {
    next.set(key, value);
  } else {
    next.delete(key);
  }

  next.delete('page');

  return next;
}

export function setCsvSearchParam(params: URLSearchParams, key: string, values: string[]): URLSearchParams {
  return setSingleSearchParam(params, key, values.length > 0 ? values.join(',') : undefined);
}

export function getInitials(value: string): string {
  return value
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
