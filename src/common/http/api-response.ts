import type { Response } from 'express';
import type { HttpStatusCode } from './status-codes';
import { HttpStatus } from './status-codes';

type SuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
};

export function sendSuccess<T>(
  response: Response,
  message: string,
  data: T,
  statusCode: HttpStatusCode = HttpStatus.OK
): Response<SuccessResponse<T>> {
  return response.status(statusCode).json({
    success: true,
    message,
    data
  });
}
