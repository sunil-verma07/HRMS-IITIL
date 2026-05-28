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

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    const refreshToken = useAuthStore.getState().refreshToken;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true;

      try {
        const response = await axios.post<ApiResponse<AuthResult>>(
          `${env.apiBaseUrl}/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        );

        useAuthStore.getState().setSession(response.data.data);
        originalRequest.headers.Authorization = `Bearer ${response.data.data.accessToken}`;
        return httpClient(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().clearSession();
        toast.error('Session expired', { description: 'Please sign in again.' });
        window.location.assign('/session-expired');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);
