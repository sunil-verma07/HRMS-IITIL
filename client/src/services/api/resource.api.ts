import { httpClient } from './http-client';
import type { ApiResponse, PaginatedResult, QueryParams } from '@/types/api';

function buildParams(params?: QueryParams): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};

  if (!params) {
    return output;
  }

  for (const [key, value] of Object.entries(params)) {
    if (key === 'filters' || value === undefined) {
      continue;
    }

    output[key] = value as string | number | boolean;
  }

  for (const [key, value] of Object.entries(params.filters ?? {})) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}

export const resourceApi = {
  async list<T>(path: string, params?: QueryParams): Promise<PaginatedResult<T>> {
    const response = await httpClient.get<ApiResponse<PaginatedResult<T> | T[]>>(path, {
      params: buildParams(params)
    });
    const payload = response.data.data;

    if (Array.isArray(payload)) {
      return {
        items: payload,
        meta: {
          total: payload.length,
          page: params?.page ?? 1,
          limit: params?.limit ?? payload.length,
          totalPages: 1
        }
      };
    }

    return payload;
  },

  async get<T>(path: string, id: string): Promise<T> {
    const response = await httpClient.get<ApiResponse<T>>(`${path}/${id}`);
    return response.data.data;
  },

  async create<TPayload, TResult = TPayload>(path: string, payload: TPayload): Promise<TResult> {
    const response = await httpClient.post<ApiResponse<TResult>>(path, payload);
    return response.data.data;
  },

  async update<TPayload, TResult = TPayload>(path: string, id: string, payload: TPayload): Promise<TResult> {
    const response = await httpClient.patch<ApiResponse<TResult>>(`${path}/${id}`, payload);
    return response.data.data;
  },

  async remove(path: string, id: string): Promise<void> {
    await httpClient.delete(`${path}/${id}`);
  }
};
