import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types/api';

export class ApiError extends Error {
  readonly status: number;
  readonly errors: ApiErrorResponse['errors'];

  constructor(message: string, status: number, errors: ApiErrorResponse['errors'] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return Boolean(value && typeof value === 'object' && 'message' in value && 'errors' in value);
}

export function normalizeApiError(error: AxiosError): ApiError {
  const response = error.response;

  if (!response) {
    return new ApiError('Unable to reach the IITIL API', 0);
  }

  const payload = response.data;

  if (isApiErrorResponse(payload)) {
    return new ApiError(payload.message, response.status, payload.errors);
  }

  return new ApiError(error.message, response.status, []);
}
