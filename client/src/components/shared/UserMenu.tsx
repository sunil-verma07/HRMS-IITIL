import { KeyRound, LogOut, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { authApi } from '@/services/api/auth.api';
import { useAuthStore } from '@/store/auth.store';

export function UserMenu() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  const logout = () => {
    const token = refreshToken ?? undefined;
    clearSession();
    navigate('/login', { replace: true });
    toast.success('Logged out securely');
    void authApi.logout(token).catch(() => undefined);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="premium" className="h-11 gap-3 px-3">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-300 to-violet-400 text-xs font-bold text-slate-950">
            {user?.userId.slice(0, 2).toUpperCase() ?? 'IT'}
          </span>
          <span className="hidden text-left md:block">
            <span className="block text-sm leading-4">{user?.userId ?? 'User'}</span>
            <span className="block text-xs text-muted-foreground">{user?.roles.at(0) ?? 'Portal user'}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigate('/profile')}>
          <UserCircle className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/change-password')}>
          <KeyRound className="size-4" />
          Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
