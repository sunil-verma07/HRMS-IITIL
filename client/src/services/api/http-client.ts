import { api } from '@/lib/api';

export const httpClient = api.client;

export function abortAllPendingRequests(): void {
  // Requests are handled by axios cancellation at call-site when needed.
}
