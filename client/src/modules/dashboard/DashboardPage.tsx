import { useQuery } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  Clock3,
  Gauge,
  UserCheck,
  UsersRound,
  Video
} from 'lucide-react';
import { toast } from 'sonner';
import { PageTransition } from '@/components/animations/PageTransition';
import { AreaTrendChart } from '@/components/charts/AreaTrendChart';
import { RingChart } from '@/components/charts/RingChart';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { StatCard } from '@/components/shared/StatCard';
import { endpoints } from '@/services/api/endpoints';
import { httpClient } from '@/services/api/http-client';
import type { ApiResponse } from '@/types/api';
import type { DashboardStats } from '@/types/domain';

export function DashboardPage() {
  const statsQuery = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<DashboardStats>>(endpoints.dashboard.stats);
      return response.data.data;
    },
    retry: false
  });

  const stats = statsQuery.data;

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Command center"
          title="Enterprise workforce dashboard"
          description="Live HRMS and ATS intelligence for IITIL Portal, including workforce health, attendance posture, recruitment velocity, and approval queues."
          actions={
            <>
              <Button variant="outline" onClick={() => toast.success('Dashboard report export queued')}>
                Export report
              </Button>
              <Button onClick={() => toast.info('Open the command palette with Ctrl+K for quick actions')}>
                Quick action
              </Button>
            </>
          }
        />

        {statsQuery.isError ? <ErrorState message={statsQuery.error.message} onRetry={() => void statsQuery.refetch()} /> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statsQuery.isLoading
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-xl" />)
            : [
                { label: 'Total Employees', value: stats?.totalEmployees ?? 0, icon: UsersRound, tone: 'cyan' as const, trend: 'Active workforce strength' },
                { label: 'Present Today', value: stats?.presentToday ?? 0, icon: UserCheck, tone: 'emerald' as const, trend: 'Attendance captured today' },
                { label: 'Pending Leaves', value: stats?.pendingLeaves ?? 0, icon: ClipboardList, tone: 'amber' as const, trend: 'Awaiting approval workflow' },
                { label: 'Active Jobs', value: stats?.activeJobPosts ?? 0, icon: BriefcaseBusiness, tone: 'violet' as const, trend: 'Published recruitment roles' }
              ].map((item) => <StatCard key={item.label} {...item} />)}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <SectionCard title="Attendance analytics" description="Trendline powered by dashboard analytics API.">
            {stats?.attendanceTrend?.length ? (
              <AreaTrendChart data={stats.attendanceTrend} />
            ) : (
              <EmptyState icon={Gauge} title="No attendance trend yet" description="Attendance trend data will appear after the dashboard endpoint returns time-series metrics." />
            )}
          </SectionCard>
          <SectionCard title="Today snapshot" description="Operational counts for the current working day.">
            <RingChart
              totalLabel="attendance signals"
              segments={[
                { label: 'Present', value: stats?.presentToday ?? 0, color: 'rgb(34 211 238)' },
                { label: 'Late', value: stats?.lateToday ?? 0, color: 'rgb(245 158 11)' },
                { label: 'Absent', value: stats?.absentToday ?? 0, color: 'rgb(244 63 94)' }
              ]}
            />
          </SectionCard>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <StatCard label="Applications" value={stats?.applicationsCount ?? 0} icon={CalendarClock} tone="violet" trend="Candidate applications in ATS" />
          <StatCard label="Interviews" value={stats?.interviewsScheduled ?? 0} icon={Video} tone="cyan" trend="Scheduled interview workload" />
          <StatCard label="Late Today" value={stats?.lateToday ?? 0} icon={Clock3} tone="rose" trend="Late marks from attendance rules" />
        </div>
      </div>
    </PageTransition>
  );
}
