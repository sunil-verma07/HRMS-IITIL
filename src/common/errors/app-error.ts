import { HttpStatus, type HttpStatusCode } from '../http/status-codes';

export type ErrorDetail = {
  path?: string;
  message: string;
};

export class AppError extends Error {
  readonly statusCode: HttpStatusCode;
  readonly errors: ErrorDetail[];
  readonly isOperational = true;

  constructor(message: string, statusCode: HttpStatusCode, errors: ErrorDetail[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', errors: ErrorDetail[] = []) {
    super(message, HttpStatus.BAD_REQUEST, errors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, HttpStatus.CONFLICT);
  }
}
