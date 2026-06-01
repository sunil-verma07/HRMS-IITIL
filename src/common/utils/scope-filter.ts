export type PermissionScope = 'none' | 'self' | 'team' | 'department' | 'all';
export type PermissionAction = 'read' | 'write' | 'delete' | 'export' | 'approve' | 'manage';

export const SCOPE_LEVEL: Record<PermissionScope, number> = {
  none: 0,
  self: 1,
  team: 2,
  department: 3,
  all: 4
};

export const ACTION_LEVEL: Record<PermissionAction, number> = {
  read: 1,
  write: 2,
  delete: 3,
  export: 3,
  approve: 4,
  manage: 5
};

export function getHighestScope(
  permissions: string[],
  resource: string,
  action: string
): PermissionScope {
  let highestLevel = 0;
  let highestScope: PermissionScope = 'none';

  const requestedActionLevel = ACTION_LEVEL[action as PermissionAction] ?? 1;

  for (const permission of permissions) {
    if (!permission.includes(':')) {
      continue;
    }

    const parts = permission.split(':');
    if (parts.length !== 3) {
      continue;
    }

    const [permResource, permAction, permScope] = parts;
    if (permResource !== resource) {
      continue;
    }

    const permissionActionLevel = ACTION_LEVEL[permAction as PermissionAction] ?? 1;
    if (permissionActionLevel < requestedActionLevel) {
      continue;
    }

    const scopeLevel = SCOPE_LEVEL[permScope as PermissionScope] ?? 0;
    if (scopeLevel > highestLevel) {
      highestLevel = scopeLevel;
      highestScope = permScope as PermissionScope;
    }
  }

  return highestScope;
}

export function expandScopedPermissions(rawCodes: string[]): string[] {
  const expanded = new Set<string>(rawCodes);

  for (const permission of rawCodes) {
    if (!permission.includes(':')) {
      continue;
    }

    const parts = permission.split(':');
    if (parts.length !== 3) {
      continue;
    }

    const [resource, action, scope] = parts;
    const actionLevel = ACTION_LEVEL[action as PermissionAction] ?? 1;
    const scopeLevel = SCOPE_LEVEL[scope as PermissionScope] ?? 0;

    for (const [actionName, actionRank] of Object.entries(ACTION_LEVEL)) {
      if (actionRank <= actionLevel) {
        for (const [scopeName, scopeRank] of Object.entries(SCOPE_LEVEL)) {
          if (scopeRank > 0 && scopeRank <= scopeLevel) {
            expanded.add(`${resource}:${actionName}:${scopeName}`);
          }
        }
      }
    }
  }

  return [...expanded];
}
