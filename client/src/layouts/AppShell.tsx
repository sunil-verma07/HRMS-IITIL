import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/layouts/AppHeader';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { AppSidebar } from '@/components/layouts/AppSidebar';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui.store';

export function AppShell() {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px]">
        <AppSidebar />
        <div className={cn('min-w-0 flex-1 transition-[padding] duration-300', sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72')}>
          <AppHeader />
          <main className="px-4 pb-8 pt-4 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
