import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';

type PermissionGateProps = {
  permissions?: string[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function PermissionGate({ permissions = [], fallback = null, children }: PermissionGateProps) {
  const { canAny } = usePermissions();

  if (!canAny(permissions)) {
    return fallback;
  }

  return children;
}
