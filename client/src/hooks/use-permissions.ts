import { useAuthStore } from '@/store/auth.store';

export function usePermissions() {
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const roles = useAuthStore((state) => state.user?.roles ?? []);

  return {
    permissions,
    roles,
    can: (permission: string) => permissions.includes(permission),
    canAny: (required: string[]) => required.length === 0 || required.some((permission) => permissions.includes(permission)),
    hasRole: (role: string) => roles.includes(role)
  };
}
