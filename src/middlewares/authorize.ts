import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../common/errors/app-error';

export function authorize(...requiredPermissions: string[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.user) {
      next(new UnauthorizedError());
      return;
    }

    const allowed = requiredPermissions.every((permission) => request.user?.permissions.includes(permission));

    if (!allowed) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
