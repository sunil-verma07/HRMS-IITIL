import { QueryClient } from '@tanstack/react-query';

type QueryParams = Record<string, string | number | boolean | null | undefined>;

export const employeeKeys = {
  all: (): readonly ['employees'] => ['employees'],
  list: (params?: QueryParams): readonly ['employees', 'list', QueryParams] => ['employees', 'list', params ?? {}],
  detail: (id: string): readonly ['employees', 'detail', string] => ['employees', 'detail', id]
};

export const attendanceKeys = {
  all: (): readonly ['attendance'] => ['attendance'],
  list: (params?: QueryParams): readonly ['attendance', 'list', QueryParams] => ['attendance', 'list', params ?? {}],
  detail: (id: string): readonly ['attendance', 'detail', string] => ['attendance', 'detail', id]
};

export const leaveKeys = {
  all: (): readonly ['leave'] => ['leave'],
  list: (params?: QueryParams): readonly ['leave', 'list', QueryParams] => ['leave', 'list', params ?? {}],
  detail: (id: string): readonly ['leave', 'detail', string] => ['leave', 'detail', id]
};

export const recruitmentKeys = {
  all: (): readonly ['recruitment'] => ['recruitment'],
  list: (params?: QueryParams): readonly ['recruitment', 'list', QueryParams] => ['recruitment', 'list', params ?? {}],
  detail: (id: string): readonly ['recruitment', 'detail', string] => ['recruitment', 'detail', id]
};

export const onboardingKeys = {
  all: (): readonly ['onboarding'] => ['onboarding'],
  list: (params?: QueryParams): readonly ['onboarding', 'list', QueryParams] => ['onboarding', 'list', params ?? {}],
  detail: (id: string): readonly ['onboarding', 'detail', string] => ['onboarding', 'detail', id]
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      retry: (failureCount, error) => {
        const status =
          typeof error === 'object' && error !== null && 'statusCode' in error
            ? Number((error as { statusCode?: number }).statusCode)
            : undefined;

        if (typeof status === 'number' && status >= 400 && status < 500) {
          return false;
        }

        return failureCount < 2;
      }
    }
  }
});

export async function invalidateEmployees(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: employeeKeys.all() });
}

export async function invalidateAttendance(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: attendanceKeys.all() });
}

export async function invalidateLeave(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: leaveKeys.all() });
}

export async function invalidateRecruitment(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: recruitmentKeys.all() });
}

export async function invalidateOnboarding(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: onboardingKeys.all() });
}
