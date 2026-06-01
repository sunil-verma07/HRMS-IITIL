import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../common/errors/app-error';

const scopeOrder = ['self', 'team', 'department', 'all'] as const;

function hasScopedPermission(userPermissions: string[], resource: string, action: string): boolean {
  return userPermissions.some((permission) => permission.startsWith(`${resource}:${action}:`));
}

function hasExplicitNone(userPermissions: string[], resource: string, action: string): boolean {
  return userPermissions.includes(`${resource}:${action}:none`);
}

function hasColonPermission(userPermissions: string[], resource: string, action: string, requiredScope?: string): boolean {
  const explicitNone = hasExplicitNone(userPermissions, resource, action);
  if (explicitNone) {
    return false;
  }

  const scopesToCheck = requiredScope
    ? scopeOrder.slice(scopeOrder.indexOf(requiredScope as (typeof scopeOrder)[number]))
    : scopeOrder;

  return scopesToCheck.some((scope) => userPermissions.includes(`${resource}:${action}:${scope}`));
}

export function authorize(...requiredPermissions: string[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.user) {
      next(new UnauthorizedError());
      return;
    }

    const isSuperAdmin = request.user.roles.includes('SUPER_ADMIN');
    if (isSuperAdmin) {
      next();
      return;
    }

    const userPermissions = request.user.permissions;

    const allowed = requiredPermissions.every((required) => {
      if (required.includes('.')) {
        const parts = required.split('.').filter(Boolean);
        const resource = parts[0];
        const action = parts[parts.length - 1];
        if (!resource || !action) {
          return false;
        }

        // Scoped permissions (including explicit :none) take priority over legacy dot permissions.
        if (hasScopedPermission(userPermissions, resource, action)) {
          return hasColonPermission(userPermissions, resource, action);
        }

        return userPermissions.includes(required);
      }

      if (required.includes(':')) {
        const parts = required.split(':');

        if (parts.length === 2) {
          const [resource, action] = parts as [string, string];
          return hasColonPermission(userPermissions, resource, action);
        }

        if (parts.length === 3) {
          const [resource, action, scope] = parts as [string, string, string];
          return hasColonPermission(userPermissions, resource, action, scope);
        }
      }

      return userPermissions.includes(required);
    });

    if (!allowed) {
      next(new ForbiddenError());
      return;
    }

    next();
  };
}
