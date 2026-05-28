import type { Request, Response } from 'express';
import { HttpStatus } from '../common/http/status-codes';

export function notFoundHandler(request: Request, response: Response): void {
  response.status(HttpStatus.NOT_FOUND).json({
    success: false,
    message: `Route ${request.method} ${request.originalUrl} not found`,
    errors: []
  });
}
