import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { resourceApi } from '@/services/api/resource.api';

type OptimisticMutationOptions<TPayload, TResult> = {
  resourceKey: string;
  endpoint: string;
  successMessage: string;
  mode: 'create' | 'update' | 'delete';
  id?: string;
  invalidate?: unknown[];
  mapResult?: (payload: TPayload, result?: TResult) => unknown;
};

export function useOptimisticResourceMutation<TPayload, TResult = unknown>({
  resourceKey,
  endpoint,
  successMessage,
  mode,
  id,
  invalidate,
  mapResult
}: OptimisticMutationOptions<TPayload, TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: TPayload) => {
      if (mode === 'create') {
        return resourceApi.create<TPayload, TResult>(endpoint, payload);
      }

      if (mode === 'update') {
        if (!id) {
          throw new Error('ID is required for update mutations');
        }

        return resourceApi.update<TPayload, TResult>(endpoint, id, payload);
      }

      if (!id) {
        throw new Error('ID is required for delete mutations');
      }

      await resourceApi.remove(endpoint, id);
      return undefined as TResult;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: [resourceKey] });
      const previous = queryClient.getQueriesData({ queryKey: [resourceKey] });

      if (mapResult) {
        queryClient.setQueriesData({ queryKey: [resourceKey] }, (current) => current ?? mapResult(payload));
      }

      return { previous };
    },
    onError: (error, _payload, context) => {
      context?.previous.forEach(([key, value]) => queryClient.setQueryData(key, value));
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success(successMessage);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: invalidate ?? [resourceKey] });
    }
  });
}
