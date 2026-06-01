import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth.store';

type Scope = 'none' | 'self' | 'team' | 'department' | 'all';
type Action = 'read' | 'write' | 'delete' | 'export' | 'approve' | 'manage';

const SCOPE_LEVEL: Record<Scope, number> = {
  none: 0,
  self: 1,
  team: 2,
  department: 3,
  all: 4
};

const ACTION_LEVEL: Record<Action, number> = {
  read: 1,
  write: 2,
  delete: 3,
  export: 3,
  approve: 4,
  manage: 5
};

function expandPermissions(rawPermissions: string[]): Set<string> {
  const expanded = new Set<string>();

  for (const permission of rawPermissions) {
    const parts = permission.split(':');

    if (parts.length !== 3) {
      expanded.add(permission);
      continue;
    }

    const [resource, action, scope] = parts as [string, Action, Scope];
    const actionLevel = ACTION_LEVEL[action] ?? 1;
    const scopeLevel = SCOPE_LEVEL[scope] ?? 0;

    for (const [actionName, actionRank] of Object.entries(ACTION_LEVEL)) {
      if (actionRank <= actionLevel) {
        for (const [scopeName, scopeRank] of Object.entries(SCOPE_LEVEL)) {
          if (scopeRank > 0 && scopeRank <= scopeLevel) {
            expanded.add(`${resource}:${actionName}:${scopeName}`);
          }
        }
      }
    }

    expanded.add(permission);
  }

  return expanded;
}

export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const rawPermissions = user?.permissions ?? [];
  const roles = user?.roles ?? [];

  const isSuperAdmin = roles.includes('SUPER_ADMIN');

  const expandedPermissions = useMemo(
    () => (isSuperAdmin ? new Set<string>(['*']) : expandPermissions(rawPermissions)),
    [isSuperAdmin, rawPermissions],
  );

  const legacyPermissions = useMemo(() => new Set(rawPermissions), [rawPermissions]);

  const hasRequiredPermission = (requiredPermission: string): boolean => {
    if (isSuperAdmin) {
      return true;
    }

    if (legacyPermissions.has(requiredPermission) || expandedPermissions.has(requiredPermission)) {
      return true;
    }

    if (requiredPermission.includes('.')) {
      const parts = requiredPermission.split('.').filter(Boolean);
      const resource = parts[0];
      const action = parts[parts.length - 1];

      if (!resource || !action) {
        return false;
      }

      return ['self', 'team', 'department', 'all'].some((scope) =>
        expandedPermissions.has(`${resource}:${action}:${scope}`),
      );
    }

    if (requiredPermission.includes(':')) {
      const parts = requiredPermission.split(':');

      if (parts.length === 2) {
        const [resource, action] = parts;
        if (!resource || !action) {
          return false;
        }

        return ['self', 'team', 'department', 'all'].some((scope) =>
          expandedPermissions.has(`${resource}:${action}:${scope}`),
        );
      }

      if (parts.length === 3) {
        const [resource, action, scope] = parts;
        const minLevel = SCOPE_LEVEL[scope as Scope];
        if (!resource || !action || !minLevel) {
          return false;
        }

        return ['self', 'team', 'department', 'all'].some((candidateScope) => {
          const scopeLevel = SCOPE_LEVEL[candidateScope as Scope] ?? 0;
          return (
            scopeLevel >= minLevel &&
            expandedPermissions.has(`${resource}:${action}:${candidateScope}`)
          );
        });
      }
    }

    return false;
  };

  return {
    permissions: rawPermissions,
    roles,
    can: (permission: string): boolean => {
      return hasRequiredPermission(permission);
    },
    canAny: (required: string[]): boolean => {
      if (required.length === 0) return true;
      return required.some((permission) => hasRequiredPermission(permission));
    },
    canDo: (resource: string, action: string): boolean => {
      if (isSuperAdmin) return true;
      return ['self', 'team', 'department', 'all'].some((scope) =>
        expandedPermissions.has(`${resource}:${action}:${scope}`),
      );
    },
    canDoWithScope: (resource: string, action: string, minScope: Scope): boolean => {
      if (isSuperAdmin) return true;
      const minLevel = SCOPE_LEVEL[minScope];

      return ['self', 'team', 'department', 'all'].some((scope) => {
        const scopeLevel = SCOPE_LEVEL[scope as Scope] ?? 0;
        return scopeLevel >= minLevel && expandedPermissions.has(`${resource}:${action}:${scope}`);
      });
    },
    getScope: (resource: string, action: string): Scope => {
      if (isSuperAdmin) return 'all';
      const scopes: Scope[] = ['all', 'department', 'team', 'self'];

      for (const scope of scopes) {
        if (expandedPermissions.has(`${resource}:${action}:${scope}`)) {
          return scope;
        }
      }

      return 'none';
    },
    isSystemAdmin: (): boolean => isSuperAdmin,
    hasRole: (role: string): boolean => roles.includes(role)
  };
}
