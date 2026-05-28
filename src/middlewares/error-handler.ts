import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { HttpStatus } from '../common/http/status-codes';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    response.status(HttpStatus.CONFLICT).json({
      success: false,
      message: 'Database constraint violation',
      errors: [{ message: error.message }]
    });
    return;
  }

  logger.error({ error, path: request.path }, 'Unhandled application error');

  response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: 'Internal server error',
    errors: env.isProduction ? [] : [{ message: error instanceof Error ? error.message : 'Unknown error' }]
  });
};
