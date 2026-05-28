import { MapPin, Timer, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { PageTransition } from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/SectionCard';
import { StatCard } from '@/components/shared/StatCard';
import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function AttendancePage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Work duration" value={0} suffix="h" icon={Timer} tone="cyan" trend="Calculated by attendance API" />
          <StatCard label="Geo radius" value={0} suffix="m" icon={MapPin} tone="violet" trend="Office policy driven" />
          <StatCard label="Break minutes" value={0} icon={Wifi} tone="amber" trend="Tracked per attendance record" />
        </div>
        <SectionCard
          title="Check-in control"
          description="Location-aware check-in/check-out controls are wired for the attendance API and geo-fencing service."
          actions={
            <>
              <Button onClick={() => toast.info('Check-in mutation endpoint is not enabled yet')}>
                Check in
              </Button>
              <Button variant="outline" onClick={() => toast.info('Check-out mutation endpoint is not enabled yet')}>
                Check out
              </Button>
            </>
          }
        >
          <div className="grid gap-3 rounded-xl border border-dashed border-border bg-white/[0.025] p-5 text-sm text-muted-foreground md:grid-cols-3">
            <span>Latitude and longitude are captured from browser geolocation.</span>
            <span>Device metadata and IP address are validated server-side.</span>
            <span>Haversine validation remains backend-authoritative.</span>
          </div>
        </SectionCard>
        <OperationalModulePage<GenericRecord>
          config={{
            resource: 'attendance',
            endpoint: endpoints.attendance,
            eyebrow: 'Workforce presence',
            title: 'Daily attendance',
            description: 'View attendance records, late marks, work duration, break tracking, and daily attendance status.',
            createLabel: 'Manual entry',
            columns: genericColumns,
            emptyTitle: 'No attendance records',
            emptyDescription: 'Attendance records will appear here after employees check in or the attendance API returns data.'
          }}
        />
      </div>
    </PageTransition>
  );
}
