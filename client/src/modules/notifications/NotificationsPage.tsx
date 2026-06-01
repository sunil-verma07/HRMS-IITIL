import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarClock, CheckCheck, Mail, MessageSquareMore, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PageTransition } from '@/components/animations/PageTransition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { endpoints } from '@/services/api/endpoints';
import { httpClient } from '@/services/api/http-client';
import { useDebounce } from '@/hooks/use-debounce';
import type { ApiResponse } from '@/types/api';
import type { Notification } from '@/types/domain';

type NotificationListResponse = {
  items: Notification[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  unreadCount: number;
};

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [readState, setReadState] = useState<'all' | 'read' | 'unread'>('all');
  const debouncedSearch = useDebounce(search, 250);

  const notificationsQuery = useQuery({
    queryKey: ['notifications', page, debouncedSearch, readState],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<NotificationListResponse>>(endpoints.notifications, {
        params: {
          page,
          limit: 12,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(readState !== 'all' ? { readState } : {})
        }
      });

      return response.data.data;
    },
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await httpClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await httpClient.patch('/notifications/read-all');
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const items = useMemo(() => notificationsQuery.data?.items ?? [], [notificationsQuery.data?.items]);
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const meta = notificationsQuery.data?.meta;

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Notification center"
          title="Notifications"
          description="Track alerts, mark items read, and jump straight to the source workflow from a single center."
          actions={
            <Button variant="outline" onClick={() => void markAllRead.mutateAsync()} disabled={unreadCount === 0 || markAllRead.isPending}>
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          }
        />

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

        <SectionCard
          title="Inbox"
          description={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
          actions={
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative md:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications..." className="pl-9" />
              </div>
              <select
                value={readState}
                onChange={(event) => setReadState(event.target.value as 'all' | 'read' | 'unread')}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>
          }
        >
          {notificationsQuery.isError ? <ErrorState message={notificationsQuery.error.message} onRetry={() => void notificationsQuery.refetch()} /> : null}

          {notificationsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={Sparkles} title="No notifications" description="Notifications will appear when workflows, interviews, and approvals emit events." />
          ) : (
            <div className="space-y-3">
              {items.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (!notification.isRead) {
                      markRead.mutate(notification.id);
                    }
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${notification.isRead ? 'border-border bg-white/[0.02]' : 'border-cyan-500/30 bg-cyan-500/8'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{notification.title}</p>
                        {!notification.isRead ? <Badge variant="default">New</Badge> : <Badge variant="muted">Read</Badge>}
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{notification.body}</p>
                    </div>
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{notification.type}</span>
                    <span>{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {meta ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>
                Page {meta.page} of {meta.totalPages} · {meta.total} notifications
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage((current) => current + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </PageTransition>
  );
}
