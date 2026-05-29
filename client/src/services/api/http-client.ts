import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth.store';
import type { ApiResponse } from '@/types/api';
import type { AuthResult } from '@/types/auth';
import { normalizeApiError } from './api-error';

type RetryableRequest = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

// Paths that must bypass auth injection + refresh retry logic
const AUTH_PATHS = ['/auth/login', '/auth/logout', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

function isAuthPath(url?: string): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((p) => url.endsWith(p) || url.includes(p));
}

// Global abort controller for non-auth requests
let pendingAbortController = new AbortController();

// Refresh-lock: prevents concurrent token refresh races
let isRefreshing = false;
type QueueEntry = { resolve: (value: string) => void; reject: (reason: unknown) => void };
let refreshQueue: QueueEntry[] = [];

function processRefreshQueue(error: unknown, token: string | null) {
  for (const entry of refreshQueue) {
    if (error) {
      entry.reject(error);
    } else {
      entry.resolve(token!);
    }
  }
  refreshQueue = [];
}

export const httpClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json'
  }
});

httpClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  // Inject bearer token for non-auth paths
  if (token && !isAuthPath(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Apply global abort signal only to non-auth requests so logout
  // never cancels a login or refresh request mid-flight
  if (!isAuthPath(config.url)) {
    config.signal = pendingAbortController.signal;
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;

    // Pass through cancellations without wrapping
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    const refreshToken = useAuthStore.getState().refreshToken;
    const is401 = error.response?.status === 401;
    const canRetry = originalRequest && !originalRequest._retry && refreshToken;
    const onAuthPath = isAuthPath(originalRequest?.url);

    // Do not attempt refresh for auth endpoints — surface error directly
    if (is401 && canRetry && !onAuthPath) {
      originalRequest!._retry = true;

      // If a refresh is already running, queue this request to retry once done
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest!.headers.Authorization = `Bearer ${newToken}`;
          return httpClient(originalRequest!);
        });
      }

      isRefreshing = true;

      try {
        const response = await axios.post<ApiResponse<AuthResult>>(
          `${env.apiBaseUrl}/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );

        const newToken = response.data.data.accessToken;
        useAuthStore.getState().setSession(response.data.data);
        originalRequest!.headers.Authorization = `Bearer ${newToken}`;
        processRefreshQueue(null, newToken);
        return httpClient(originalRequest!);
      } catch (refreshError) {
        processRefreshQueue(refreshError, null);
        useAuthStore.getState().clearSession();
        pendingAbortController.abort();
        pendingAbortController = new AbortController();
        toast.error('Session expired', { description: 'Please sign in again.' });
        window.location.assign('/session-expired');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);

// Abort all non-auth pending requests (called on logout)
export function abortAllPendingRequests() {
  pendingAbortController.abort();
  pendingAbortController = new AbortController();
}
