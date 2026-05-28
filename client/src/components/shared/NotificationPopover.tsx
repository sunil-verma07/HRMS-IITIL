import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { endpoints } from '@/services/api/endpoints';
import { resourceApi } from '@/services/api/resource.api';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt?: string | null;
};

export function NotificationPopover() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['notifications', 'header'],
    queryFn: () => resourceApi.list<NotificationItem>(endpoints.dashboard.notifications, { page: 1, limit: 5 }),
    retry: false
  });

  const unread = data?.items.filter((item) => !item.readAt).length ?? 0;

  return (
    <Button variant="outline" size="icon" className="relative" aria-label="Notifications" onClick={() => navigate('/notifications')}>
      <Bell className="size-4" />
      {unread > 0 ? <Badge className="absolute -right-1 -top-1 px-1.5 py-0 text-[10px]">{unread}</Badge> : null}
    </Button>
  );
}
