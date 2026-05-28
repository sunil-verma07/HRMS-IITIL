import { Menu, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { NotificationPopover } from '@/components/shared/NotificationPopover';
import { UserMenu } from '@/components/shared/UserMenu';
import { navigationItems } from '@/constants/navigation';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { toTitleCase } from '@/lib/utils';
import { useUiStore } from '@/store/ui.store';

export function AppHeader() {
  const location = useLocation();
  const setCommandOpen = useUiStore((state) => state.setCommandOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const current = navigationItems.find((item) => location.pathname.startsWith(item.path));
  const title = current?.label ?? toTitleCase(location.pathname.split('/').filter(Boolean).at(-1) ?? 'Dashboard');

  useKeyboardShortcut(['meta', 'k'], () => setCommandOpen(true));
  useKeyboardShortcut(['ctrl', 'k'], () => setCommandOpen(true));

  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-background/68 px-4 py-4 backdrop-blur-2xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar} aria-label="Toggle navigation">
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">IITIL Portal</p>
          <h2 className="truncate text-lg font-semibold">{title}</h2>
        </div>
        <button
          onClick={() => setCommandOpen(true)}
          className="hidden h-10 min-w-80 items-center gap-3 rounded-xl border border-border bg-slate-950/50 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-white/5 md:flex"
        >
          <Search className="size-4" />
          Search or jump to...
          <kbd className="ml-auto rounded-md border border-border bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
        </button>
        <NotificationPopover />
        <UserMenu />
      </div>
    </header>
  );
}
