import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { ApiError, PermissionError, ServerError, parseApiError } from './errors';

export type ApiRequestConfig = AxiosRequestConfig;

const TOKEN_STORAGE_KEYS = ['iitil-auth-token', 'auth-token', 'token'];
const LEGACY_STORE_KEY = 'iitil-auth';

function getApiBaseUrl(): string {
  const direct = import.meta.env.VITE_API_URL as string | undefined;
  const legacy = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const baseUrl = direct ?? legacy;

  if (!baseUrl) {
    throw new Error('VITE_API_URL is required.');
  }

  return baseUrl.replace(/\/$/, '');
}

function getStoredToken(): string | null {
  for (const key of TOKEN_STORAGE_KEYS) {
    const localToken = localStorage.getItem(key);
    if (localToken) {
      return localToken;
    }

    const sessionToken = sessionStorage.getItem(key);
    if (sessionToken) {
      return sessionToken;
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_STORE_KEY) ?? sessionStorage.getItem(LEGACY_STORE_KEY);
  if (!legacyRaw) {
    return null;
  }

  try {
    const parsed = JSON.parse(legacyRaw) as { state?: { accessToken?: string | null } };
    return parsed.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

function clearStoredAuth(): void {
  for (const key of TOKEN_STORAGE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  localStorage.removeItem(LEGACY_STORE_KEY);
  sessionStorage.removeItem(LEGACY_STORE_KEY);
}

const client: AxiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json'
  }
});

client.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token) {
    const headers = axios.AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const parsedError = parseApiError(error);
    const statusCode = parsedError.statusCode;

    if (statusCode === 401) {
      clearStoredAuth();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }

      return Promise.reject(new ApiError('Session expired. Please sign in again.', 401, 'UNAUTHORIZED'));
    }

    if (statusCode === 403) {
      return Promise.reject(new PermissionError(parsedError.message));
    }

    if (typeof statusCode === 'number' && statusCode >= 500) {
      return Promise.reject(new ServerError(parsedError.message, statusCode));
    }

    return Promise.reject(parsedError);
  }
);

type RequestArgs = [url: string, config?: ApiRequestConfig];
type BodyRequestArgs = [url: string, data?: unknown, config?: ApiRequestConfig];

export const api = {
  client,
  get<T>(...args: RequestArgs): Promise<AxiosResponse<T>> {
    return client.get<T>(...args);
  },
  post<T>(...args: BodyRequestArgs): Promise<AxiosResponse<T>> {
    return client.post<T>(...args);
  },
  put<T>(...args: BodyRequestArgs): Promise<AxiosResponse<T>> {
    return client.put<T>(...args);
  },
  patch<T>(...args: BodyRequestArgs): Promise<AxiosResponse<T>> {
    return client.patch<T>(...args);
  },
  delete<T>(...args: RequestArgs): Promise<AxiosResponse<T>> {
    return client.delete<T>(...args);
  }
};
