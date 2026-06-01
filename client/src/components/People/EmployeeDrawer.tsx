import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getInitials, type EmployeeListItem } from './types';
import { ProfileTab } from './EmployeeDrawerTabs/ProfileTab';
import { AttendanceSummaryTab } from './EmployeeDrawerTabs/AttendanceSummaryTab';
import { LeaveBalanceTab } from './EmployeeDrawerTabs/LeaveBalanceTab';
import { DocumentsTab } from './EmployeeDrawerTabs/DocumentsTab';
import { PermissionsTab } from './EmployeeDrawerTabs/PermissionsTab';
import { ActivityTab } from './EmployeeDrawerTabs/ActivityTab';

type DrawerTab = 'profile' | 'attendance' | 'leave' | 'documents' | 'permissions' | 'activity';

type EmployeeDrawerProps = {
  employee: EmployeeListItem | null;
  open: boolean;
  onClose: () => void;
  onOpenEmployee?: (id: string) => void;
};

const spring = { type: 'spring', stiffness: 260, damping: 28 } as const;

export function EmployeeDrawer({ employee, open, onClose, onOpenEmployee }: EmployeeDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('profile');
  const [loadedTabs, setLoadedTabs] = useState<DrawerTab[]>(['profile']);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setActiveTab('profile');
      setLoadedTabs(['profile']);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      focusable?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!open || !panelRef.current) {
        return;
      }

      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const tabContent = useMemo(
    () => ({
      profile: (
        <ProfileTab
          employeeId={employee?.id ?? ''}
          enabled={loadedTabs.includes('profile') && Boolean(employee?.id)}
          {...(onOpenEmployee ? { onOpenEmployee } : {})}
        />
      ),
      attendance: <AttendanceSummaryTab employeeId={employee?.id ?? ''} enabled={loadedTabs.includes('attendance') && Boolean(employee?.id)} />,
      leave: <LeaveBalanceTab employeeId={employee?.id ?? ''} enabled={loadedTabs.includes('leave') && Boolean(employee?.id)} />,
      documents: <DocumentsTab employeeId={employee?.id ?? ''} enabled={loadedTabs.includes('documents') && Boolean(employee?.id)} />,
      permissions: <PermissionsTab employeeId={employee?.id ?? ''} enabled={loadedTabs.includes('permissions') && Boolean(employee?.id)} />,
      activity: <ActivityTab employeeId={employee?.id ?? ''} enabled={loadedTabs.includes('activity') && Boolean(employee?.id)} />
    }),
    [employee?.id, loadedTabs, onOpenEmployee]
  );

  return (
    <AnimatePresence>
      {open && employee ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={spring}
            className="fixed inset-0 z-50 flex h-screen flex-col border-l border-border bg-slate-950 md:left-auto md:w-[720px]"
            aria-modal="true"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div className="flex items-center gap-4">
                <div className="grid size-14 place-items-center rounded-2xl bg-cyan-300/10 font-semibold text-cyan-200">
                  {getInitials(employee.name)}
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{employee.name}</p>
                  <p className="text-sm text-muted-foreground">{employee.employeeId}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={employee.status === 'ACTIVE' ? 'success' : 'muted'}>{employee.status}</Badge>
                    <span className="text-xs text-muted-foreground">{employee.role ?? 'Unassigned role'}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close employee drawer">
                <X className="size-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  const nextTab = value as DrawerTab;
                  setActiveTab(nextTab);
                  setLoadedTabs((current) => (current.includes(nextTab) ? current : [...current, nextTab]));
                }}
              >
                <TabsList className="grid w-full grid-cols-3 gap-1 md:grid-cols-6">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                  <TabsTrigger value="leave">Leave</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="profile">{tabContent.profile}</TabsContent>
                <TabsContent value="attendance">{tabContent.attendance}</TabsContent>
                <TabsContent value="leave">{tabContent.leave}</TabsContent>
                <TabsContent value="documents">{tabContent.documents}</TabsContent>
                <TabsContent value="permissions">{tabContent.permissions}</TabsContent>
                <TabsContent value="activity">{tabContent.activity}</TabsContent>
              </Tabs>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
