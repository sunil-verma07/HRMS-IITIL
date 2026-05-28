import { BellRing, Mail, MessageSquareMore } from 'lucide-react';
import { PageTransition } from '@/components/animations/PageTransition';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function NotificationsPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader eyebrow="Notification center" title="Notifications" description="Manage in-app and email notifications, templates, preferences, unread counts, and future WhatsApp or push channels." />
        <SectionCard title="Channels" description="Notification architecture supports channel expansion without changing feature modules.">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: 'In-app', icon: BellRing, status: 'Active' },
              { label: 'Email', icon: Mail, status: 'Active' },
              { label: 'WhatsApp / Push', icon: MessageSquareMore, status: 'Future-ready' }
            ].map((channel) => (
              <div key={channel.label} className="rounded-xl border border-border bg-white/[0.035] p-4">
                <channel.icon className="mb-4 size-5 text-cyan-200" />
                <p className="font-medium">{channel.label}</p>
                <Badge className="mt-3" variant="muted">{channel.status}</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
        <OperationalModulePage<GenericRecord>
          config={{
            resource: 'notifications',
            endpoint: endpoints.dashboard.notifications,
            eyebrow: 'Notifications',
            title: 'In-app notifications',
            description: 'View notifications, read state, event metadata, and user preferences.',
            createLabel: 'Create template',
            columns: genericColumns,
            emptyTitle: 'No notifications',
            emptyDescription: 'Notifications will appear when domain events are published.'
          }}
        />
      </div>
    </PageTransition>
  );
}
