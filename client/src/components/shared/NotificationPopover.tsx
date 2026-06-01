import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ChevronRight, ExternalLink, Inbox } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { endpoints } from '@/services/api/endpoints';
import { httpClient } from '@/services/api/http-client';
import type { Notification } from '@/types/domain';
import type { ApiResponse } from '@/types/api';

type NotificationListResponse = {
  items: Notification[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  unreadCount: number;
};

function resolveTarget(notification: Notification): string | null {
  const fromData = notification.data?.path;
  const fromMetadata = notification.metadata?.path;

  if (typeof fromData === 'string') {
    return fromData;
  }

  if (typeof fromMetadata === 'string') {
    return fromMetadata;
  }

  return null;
}

export function NotificationPopover() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['notifications', 'header'],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<NotificationListResponse>>(endpoints.notifications, {
        params: { page: 1, limit: 8 },
      });
      return response.data.data;
    },
    retry: false,
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

  const unread = data?.unreadCount ?? 0;
  const items = useMemo(() => data?.items ?? [], [data?.items]);

  const openNotification = (notification: Notification) => {
    void markRead.mutateAsync(notification.id);
    const target = resolveTarget(notification);
    setOpen(false);
    if (target) {
      navigate(target);
      return;
    }
    navigate('/notifications');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="icon" className="relative" aria-label="Notifications" onClick={() => setOpen(true)}>
        <Bell className="size-4" />
        {unread > 0 ? <Badge className="absolute -right-1 -top-1 px-1.5 py-0 text-[10px]">{unread}</Badge> : null}
      </Button>

      <DialogContent className="left-auto right-0 top-0 h-[100dvh] max-h-none w-full max-w-md translate-x-0 translate-y-0 rounded-none border-l border-border p-0">
        <div className="flex h-full flex-col">
          <DialogHeader className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle>Notifications</DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">Unread items, recent system events, and shortcuts to the source page.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void markAllRead.mutateAsync()} disabled={unread === 0 || markAllRead.isPending}>
                <CheckCheck className="size-4" />
                Mark all read
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto px-4 py-4">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-white/[0.02] px-6 py-12 text-center">
                <Inbox className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">No notifications yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">New alerts will appear here when workflows emit them.</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/notifications')}>
                  Open notification center
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((notification, index) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${notification.isRead ? 'border-border bg-white/[0.02]' : 'border-cyan-500/30 bg-cyan-500/8 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{notification.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notification.body}</p>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{notification.type}</span>
                      <span>
                        {notification.createdAt
                          ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })
                          : 'Just now'}
                      </span>
                    </div>
                    {index < items.length - 1 ? <Separator className="mt-4 bg-border/60" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border px-5 py-4">
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/notifications')}>
              View all notifications
              <ExternalLink className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
