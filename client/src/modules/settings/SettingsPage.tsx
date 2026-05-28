import { Building2, Clock, Globe2, Palette, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageTransition } from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';

export function SettingsPage() {
  const settings = [
    { title: 'Office timing', icon: Clock, fields: ['Office start time', 'Office end time', 'Grace minutes'] },
    { title: 'Geo-fencing', icon: Globe2, fields: ['Latitude', 'Longitude', 'Allowed radius meters'] },
    { title: 'System settings', icon: Settings2, fields: ['Rate limit', 'Session duration', 'Password reset minutes'] },
    { title: 'Branding', icon: Palette, fields: ['Portal name', 'Accent color', 'Logo URL'] }
  ];

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader eyebrow="Administration" title="Settings" description="Configure attendance policies, office coordinates, geo-fencing radius, system preferences, and portal branding." actions={<Button onClick={() => toast.info('Settings persistence endpoint is not enabled yet')}>Save settings</Button>} />
        <div className="grid gap-5 xl:grid-cols-2">
          {settings.map((section) => (
            <SectionCard key={section.title} title={section.title} description="Fields are prepared for settings API persistence.">
              <section.icon className="mb-5 size-5 text-cyan-200" />
              <div className="grid gap-4">
                {section.fields.map((field) => (
                  <label key={field} className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">{field}</span>
                    <Input placeholder={field} />
                  </label>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
        <SectionCard title="Office policy" description="Working days and office location records are backend-owned.">
          <div className="rounded-xl border border-dashed border-border bg-white/[0.025] p-5 text-sm text-muted-foreground">
            <Building2 className="mb-3 size-5 text-violet-200" />
            Settings forms should submit to the settings endpoints once available, preserving the same API client and validation pattern.
          </div>
        </SectionCard>
      </div>
    </PageTransition>
  );
}
