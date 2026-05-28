import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodTypeAny } from 'zod';
import { BadRequestError } from '../common/errors/app-error';

type RequestSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

function mapZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }));
}

export function validateRequest(schemas: RequestSchemas) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        request.body = schemas.body.parse(request.body);
      }

      if (schemas.query) {
        request.query = schemas.query.parse(request.query);
      }

      if (schemas.params) {
        request.params = schemas.params.parse(request.params);
      }

      next();
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        next(new BadRequestError('Validation failed', mapZodError(error as ZodError)));
        return;
      }

      next(error);
    }
  };
}
