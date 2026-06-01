import axios, { type AxiosError } from 'axios';

type ApiErrorDetail = {
  field?: string;
  message: string;
};

type ApiErrorPayload = {
  message?: string;
  code?: string;
  errors?: Array<{ path?: string; message: string }>;
};

export class ApiError extends Error {
  readonly statusCode: number | undefined;
  readonly code: string | undefined;
  readonly details: ApiErrorDetail[];

  constructor(message: string, statusCode?: number, code?: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class PermissionError extends ApiError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'PERMISSION_DENIED');
    this.name = 'PermissionError';
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Validation failed.', details: ApiErrorDetail[] = []) {
    super(message, 422, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Requested resource was not found.') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ServerError extends ApiError {
  constructor(message = 'Server error. Please try again later.', statusCode?: number) {
    super(message, statusCode, 'SERVER_ERROR');
    this.name = 'ServerError';
  }
}

function toApiErrorDetails(payload: ApiErrorPayload | undefined): ApiErrorDetail[] {
  if (!payload?.errors) {
    return [];
  }

  return payload.errors.map((item) => ({
    ...(item.path ? { field: item.path } : {}),
    message: item.message
  }));
}

function parseAxiosError(error: AxiosError): ApiError {
  const status = error.response?.status;
  const payload = (error.response?.data ?? undefined) as ApiErrorPayload | undefined;
  const message = payload?.message ?? error.message;
  const details = toApiErrorDetails(payload);

  if (!status) {
    return new ApiError('Network error. Please check your connection.', 0, 'NETWORK_ERROR', details);
  }

  if (status === 403) {
    return new PermissionError(message);
  }

  if (status === 404) {
    return new NotFoundError(message);
  }

  if (status === 400 || status === 422) {
    return new ValidationError(message, details);
  }

  if (status >= 500) {
    return new ServerError(message, status);
  }

  return new ApiError(message, status, payload?.code, details);
}

export function parseApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    return parseAxiosError(error);
  }

  if (error instanceof Error) {
    return new ApiError(error.message);
  }

  return new ApiError('An unexpected error occurred.');
}

export function getErrorMessage(error: unknown): string {
  return parseApiError(error).message;
}
