import { useQuery } from '@tanstack/react-query';
import { resourceApi } from '@/services/api/resource.api';
import type { QueryParams } from '@/types/api';

export function useResourceQuery<T>(resource: string, path: string, params: QueryParams) {
  return useQuery({
    queryKey: [resource, params],
    queryFn: () => resourceApi.list<T>(path, params)
  });
}
