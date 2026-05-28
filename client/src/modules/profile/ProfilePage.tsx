import { KeyRound, MonitorCheck, ShieldCheck, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageTransition } from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { useAuthStore } from '@/store/auth.store';

export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader eyebrow="Account" title="User profile" description="Manage account identity, permissions, security settings, and active sessions." actions={<Button variant="outline" onClick={() => navigate('/change-password')}><KeyRound className="size-4" /> Change password</Button>} />
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <SectionCard title="Profile" description="Identity from the authenticated session.">
            <div className="flex items-center gap-4">
              <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-violet-400 text-lg font-black text-slate-950">
                {user?.userId.slice(0, 2).toUpperCase() ?? 'IT'}
              </div>
              <div>
                <p className="text-lg font-semibold">{user?.userId}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user?.roles.map((role) => <Badge key={role}>{role}</Badge>)}
                </div>
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Security posture" description="RBAC and session metadata are managed by the backend.">
            <div className="grid gap-3 md:grid-cols-3">
              {[UserCircle, ShieldCheck, MonitorCheck].map((Icon, index) => (
                <div key={index} className="rounded-xl border border-border bg-white/[0.035] p-4">
                  <Icon className="mb-4 size-5 text-cyan-200" />
                  <p className="text-sm text-muted-foreground">{['Profile verified', 'Permission scoped', 'Session active'][index]}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </PageTransition>
  );
}
