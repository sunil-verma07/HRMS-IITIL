import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageSkeleton } from '@/components/loaders/PageSkeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';

type ProtectedRouteProps = {
  permissions?: string[];
};

export function ProtectedRoute({ permissions = [] }: ProtectedRouteProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { canAny } = usePermissions();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  // Capture "from" path once on mount — location object changes on every nav
  const intendedPath = useRef(location.pathname);

  // Safety valve: if Zustand never fires onRehydrateStorage (rare edge case),
  // break out of the skeleton after 3 s using local state only — do NOT
  // write back to the store (that would cause a Zustand update → re-render loop)
  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    if (hasHydrated) return;
    const id = setTimeout(() => setForceReady(true), 3_000);
    return () => clearTimeout(id);
  }, []); // intentionally empty: timer is set once on mount

  // Imperative navigation runs AFTER render, not during it.
  // Deps are intentionally minimal: only re-run when auth state changes,
  // NOT on every location change (that's what caused the 249-navigation flood).
  useEffect(() => {
    if (!hasHydrated && !forceReady) return;

    if (!user) {
      navigate('/login', {
        replace: true,
        state: { from: intendedPath.current }
      });
      return;
    }

    if (permissions.length > 0 && !canAny(permissions)) {
      navigate('/dashboard', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, forceReady, user]);

  // Zustand still rehydrating — show skeleton
  if (!hasHydrated && !forceReady) {
    return <PageSkeleton />;
  }

  // Not authenticated — return null while the useEffect redirect fires.
  // Returning <Navigate> here was the cause of the infinite navigation loop.
  if (!user) {
    return null;
  }

  // Missing required permissions — return null while redirect fires
  if (permissions.length > 0 && !canAny(permissions)) {
    return null;
  }

  return <Outlet />;
}
