import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { navigationItems } from '@/constants/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useUiStore } from '@/store/ui.store';

export function CommandPalette() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const open = useUiStore((state) => state.commandOpen);
  const setOpen = useUiStore((state) => state.setCommandOpen);
  const { canAny } = usePermissions();

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return navigationItems
      .filter((item) => canAny(item.permissions))
      .filter((item) => {
        if (!normalized) {
          return true;
        }

        return [item.label, item.path, ...item.keywords].some((value) => value.toLowerCase().includes(normalized));
      });
  }, [canAny, query]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, workflows, records..."
            className="border-0 bg-transparent px-0 shadow-none focus:ring-0"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {items.map((item) => (
            <button
              key={item.path}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-white/8"
              onClick={() => {
                navigate(item.path);
                setOpen(false);
                setQuery('');
              }}
            >
              <span className="grid size-9 place-items-center rounded-lg bg-white/7 text-cyan-200">
                <item.icon className="size-4" />
              </span>
              <span>
                <span className="block font-medium text-foreground">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.path}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
