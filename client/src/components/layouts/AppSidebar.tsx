import { motion } from 'framer-motion';
import { ChevronLeft, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { navigationItems } from '@/constants/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { authApi } from '@/services/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { useUiStore } from '@/store/ui.store';

export function AppSidebar() {
  const navigate = useNavigate();
  const { canAny } = usePermissions();
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  const visibleItems = navigationItems.filter((item) => canAny(item.permissions));

  const logout = () => {
    const token = refreshToken ?? undefined;
    clearSession();
    navigate('/login', { replace: true });
    toast.success('Logged out securely');
    void authApi.logout(token).catch(() => undefined);
  };

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 80 : 288 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="glass-panel fixed inset-y-0 left-0 z-40 hidden border-y-0 border-l-0 p-4 lg:block"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center justify-between">
          <button
            className={cn('flex items-center gap-3 rounded-xl text-left transition-colors hover:text-cyan-200', sidebarCollapsed && 'justify-center')}
            onClick={() => navigate('/dashboard')}
          >
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-400 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.25)]">
              IT
            </div>
            {!sidebarCollapsed ? (
              <div>
                <p className="text-base font-semibold tracking-tight">IITIL</p>
                <p className="text-xs text-muted-foreground">Enterprise Portal</p>
              </div>
            ) : null}
          </button>
          {!sidebarCollapsed ? (
            <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Collapse sidebar">
              <PanelLeftClose className="size-4" />
            </Button>
          ) : null}
        </div>

        {sidebarCollapsed ? (
          <Button className="mt-4" variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Expand sidebar">
            <PanelLeftOpen className="size-4" />
          </Button>
        ) : null}

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto pr-1">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'group flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-all hover:bg-white/7 hover:text-foreground',
                  isActive && 'bg-gradient-to-r from-cyan-400/16 to-violet-400/16 text-foreground ring-1 ring-cyan-300/20',
                  sidebarCollapsed && 'justify-center px-0'
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
              {!sidebarCollapsed ? <ChevronLeft className="ml-auto size-3 rotate-180 opacity-0 transition-opacity group-hover:opacity-70" /> : null}
            </NavLink>
          ))}
        </nav>

        <Button variant="ghost" className={cn('mt-4 justify-start text-muted-foreground', sidebarCollapsed && 'justify-center px-0')} onClick={logout}>
          <LogOut className="size-4" />
          {!sidebarCollapsed ? 'Log out' : null}
        </Button>
      </div>
    </motion.aside>
  );
}
