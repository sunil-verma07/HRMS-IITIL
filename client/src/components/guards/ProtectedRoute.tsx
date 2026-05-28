import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageSkeleton } from '@/components/loaders/PageSkeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';

type ProtectedRouteProps = {
  permissions?: string[];
};

export function ProtectedRoute({ permissions = [] }: ProtectedRouteProps) {
  const location = useLocation();
  const { canAny } = usePermissions();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  if (!hasHydrated) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!canAny(permissions)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
