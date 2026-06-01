import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle,
  Clock,
  History,
  Loader2,
  LogIn,
  LogOut,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { PageTransition } from "@/components/animations/PageTransition";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { useDebounce } from "@/hooks/use-debounce";
import { endpoints } from "@/services/api/endpoints";
import { httpClient } from "@/services/api/http-client";
import type { ApiResponse } from "@/types/api";
import { parseApiError } from "@/lib/errors";
import { permissions } from "@/constants/permissions";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/auth.store";

type AttendanceRecord = {
  id: string;
  employeeId: string;
  employee?: {
    id: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    department: string;
    designation: string;
  };
  attendanceDate: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  workedMinutes?: number;
  workMinutes?: number;
  status: string;
  isLate?: boolean;
};

type TodayResponse = {
  hasRecord: boolean;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workedMinutes?: number;
  status?: string;
  isLate?: boolean;
  record?: AttendanceRecord;
};

type AttendanceAnalytics = {
  presentDays: number;
  absentDays: number;
  halfDays: number;
  lateDays: number;
  totalWorkedMinutes: number;
  averageWorkedMinutes: number;
};

type PaginatedResponse<T> = {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type AttendanceStatusFilter = "ALL" | "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT";

type EmployeeAttendanceResponse = PaginatedResponse<AttendanceRecord> & {
  meta: PaginatedResponse<AttendanceRecord>["meta"] & {
    scopeEmployeeCount?: number;
  };
};

type DepartmentsResponse = {
  departments: string[];
};

const formatLocalDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parseISO(value));

const formatLocalDay = (value: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(parseISO(value));

const formatLocalTime = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parseISO(value));
};

const toLocalDateKey = (value: string) => {
  const date = parseISO(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const formatMinutesHuman = (minutes: number) => {
  const safe = Math.max(0, Math.floor(minutes));

  if (safe === 0) {
    return "0 Hours";
  }

  const hours = Math.floor(safe / 60);
  const mins = safe % 60;

  if (hours === 0) {
    return `${mins} Min`;
  }

  if (mins === 0) {
    return `${hours} ${hours === 1 ? "Hour" : "Hours"}`;
  }

  return `${hours} ${hours === 1 ? "Hour" : "Hours"} ${mins} Min`;
};

const formatDaysHuman = (days: number) => {
  const safe = Math.max(0, Math.floor(days));
  return `${safe} ${safe === 1 ? "Day" : "Days"}`;
};

const normalizedDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatRowDuration = (record: AttendanceRecord) => {
  const start = normalizedDateTime(record.checkInTime ?? record.checkInAt);
  const end = normalizedDateTime(record.checkOutTime ?? record.checkOutAt);

  if (!start || !end) {
    return "-";
  }

  const diffMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  if (diffMinutes < 0) {
    return "-";
  }

  return formatMinutesHuman(diffMinutes);
};

const formatClockDuration = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const statusClassName = (status: string, isLate?: boolean) => {
  if (isLate) {
    return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  }

  switch (status) {
    case "PRESENT":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "ABSENT":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "HALF_DAY":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "PENDING_REGULARIZATION":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }
};

export function AttendancePage() {
  const queryClient = useQueryClient();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const { can, canAny, canDo, canDoWithScope } = usePermissions();

  const permissionsLoading = !hasHydrated;
  const canAccessMyAttendance =
    can(permissions.attendanceRead) ||
    can(permissions.attendanceWrite) ||
    canDo("attendance", "read") ||
    canDo("attendance", "write");

  const canAccessEmployeeAttendance =
    canDoWithScope("attendance", "read", "team") ||
    canAny([
      "attendance.view.team",
      "attendance.view.department",
      "attendance.view.all",
      "attendance:read:team",
      "attendance:read:department",
      "attendance:read:all",
    ]);

  const [activeTab, setActiveTab] = useState<"my" | "employee">("my");
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeStatus, setEmployeeStatus] = useState<AttendanceStatusFilter>("ALL");
  const [department, setDepartment] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const debouncedEmployeeSearch = useDebounce(employeeSearch, 350);

  useEffect(() => {
    if (!canAccessEmployeeAttendance && activeTab === "employee") {
      setActiveTab("my");
    }
  }, [activeTab, canAccessEmployeeAttendance]);

  useEffect(() => {
    setEmployeePage(1);
  }, [debouncedEmployeeSearch, employeeStatus, department, fromDate, toDate]);

  if (permissionsLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <Tabs value="my">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my" disabled>
                My Attendance
              </TabsTrigger>
              <TabsTrigger value="employee" disabled>
                Employee Attendance
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
          <div className="h-56 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      </PageTransition>
    );
  }

  if (!permissionsLoading && !canAccessMyAttendance) {
    return (
      <PageTransition>
        <div className="flex min-h-64 items-center justify-center">
          <p className="text-muted-foreground">
            You don't have access to attendance records.
          </p>
        </div>
      </PageTransition>
    );
  }

  const [regularizeOpen, setRegularizeOpen] = useState(false);
  const [regularizeDate, setRegularizeDate] = useState("");
  const [regularizeReason, setRegularizeReason] = useState("");
  const [regularizeCheckIn, setRegularizeCheckIn] = useState("");
  const [regularizeCheckOut, setRegularizeCheckOut] = useState("");
  const [checkInLocked, setCheckInLocked] = useState(false);
  const [elapsed, setElapsed] = useState<number>(0);

  const todayQuery = useQuery({
    queryKey: ["attendance-today"],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<TodayResponse>>(endpoints.attendanceToday);
      return res.data.data;
    },
    enabled: canAccessMyAttendance && !permissionsLoading,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || !data.hasRecord) {
        return false;
      }

      const checkIn = data.checkInTime ?? data.record?.checkInTime ?? data.record?.checkInAt;
      const checkOut = data.checkOutTime ?? data.record?.checkOutTime ?? data.record?.checkOutAt;
      return checkIn && !checkOut ? 60_000 : false;
    },
  });

  const analyticsQuery = useQuery({
    queryKey: ["attendance-analytics"],
    queryFn: async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
      const res = await httpClient.get<ApiResponse<AttendanceAnalytics>>(
        `${endpoints.attendanceAnalytics}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      );
      return res.data.data;
    },
    enabled: canAccessMyAttendance && !permissionsLoading,
    staleTime: 60000,
  });

  const myRecordsQuery = useQuery({
    queryKey: ["attendance-records", "self"],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<PaginatedResponse<AttendanceRecord>>>(
        `${endpoints.attendance}?view=self&page=1&limit=31`,
      );
      return res.data.data?.items ?? [];
    },
    enabled: canAccessMyAttendance && !permissionsLoading,
    staleTime: 60000,
  });

  const employeeRecordsQuery = useQuery({
    queryKey: [
      "attendance-records",
      "employees",
      employeePage,
      debouncedEmployeeSearch,
      employeeStatus,
      department,
      fromDate,
      toDate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("view", "employees");
      params.set("page", String(employeePage));
      params.set("limit", "20");
      if (debouncedEmployeeSearch) params.set("search", debouncedEmployeeSearch);
      if (employeeStatus !== "ALL") params.set("status", employeeStatus);
      if (department !== "ALL") params.set("department", department);
      if (fromDate && toDate) {
        params.set("fromDate", new Date(fromDate).toISOString());
        params.set("toDate", new Date(toDate).toISOString());
      }

      const res = await httpClient.get<ApiResponse<EmployeeAttendanceResponse>>(
        `${endpoints.attendance}?${params.toString()}`,
      );
      return res.data.data;
    },
    enabled: canAccessEmployeeAttendance && !permissionsLoading,
    staleTime: 30_000,
  });

  const departmentsQuery = useQuery({
    queryKey: ["attendance-employee-departments"],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<DepartmentsResponse>>(`${endpoints.attendance}/departments`);
      return res.data.data?.departments ?? [];
    },
    enabled: canAccessEmployeeAttendance && !permissionsLoading,
    staleTime: 60_000,
  });

  const today = todayQuery.data;
  const analytics = analyticsQuery.data;
  const myRecords = myRecordsQuery.data ?? [];

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayRecordFromList = useMemo(
    () => myRecords.find((record) => toLocalDateKey(record.attendanceDate) === todayKey),
    [myRecords, todayKey],
  );

  const activeCheckIn =
    today?.checkInTime ??
    today?.record?.checkInTime ??
    today?.record?.checkInAt ??
    todayRecordFromList?.checkInTime ??
    todayRecordFromList?.checkInAt ??
    null;
  const activeCheckOut =
    today?.checkOutTime ??
    today?.record?.checkOutTime ??
    today?.record?.checkOutAt ??
    todayRecordFromList?.checkOutTime ??
    todayRecordFromList?.checkOutAt ??
    null;
  const workedMinutes = today?.workedMinutes ?? today?.record?.workedMinutes ?? today?.record?.workMinutes ?? 0;
  const status = today?.status ?? today?.record?.status ?? "ABSENT";
  const isLate = today?.isLate ?? today?.record?.isLate ?? false;
  const hasTodayRecord = Boolean(today?.hasRecord || todayRecordFromList);

  useEffect(() => {
    if (hasTodayRecord) {
      setCheckInLocked(false);
    }
  }, [hasTodayRecord]);

  useEffect(() => {
    if (!activeCheckIn || activeCheckOut) return;

    const checkIn = new Date(activeCheckIn).getTime();

    const tick = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - checkIn) / 1000));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCheckIn, activeCheckOut]);

  const activeSession = Boolean(activeCheckIn && !activeCheckOut);

  const showRegularize = Boolean(today && (!activeCheckIn || !activeCheckOut));

  const regularizableRows = myRecords.map((record) => ({
    ...record,
    checkInTime: record.checkInTime ?? record.checkInAt ?? null,
    checkOutTime: record.checkOutTime ?? record.checkOutAt ?? null,
    workedMinutes: record.workedMinutes ?? record.workMinutes ?? 0,
  }));

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (hasTodayRecord) {
        throw new Error("Attendance already tracked for today.");
      }

      setCheckInLocked(true);
      const response = await httpClient.post<ApiResponse<AttendanceRecord>>(endpoints.attendance + "/check-in", {});
      return response.data.data;
    },
    onSuccess: () => {
      toast.success("Checked in successfully");
      void queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-analytics"] });
    },
    onError: (error) => {
      setCheckInLocked(false);
      toast.error(parseApiError(error).message);
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const response = await httpClient.post<ApiResponse<AttendanceRecord>>(endpoints.attendance + "/check-out", {});
      return response.data.data;
    },
    onSuccess: () => {
      toast.success("Checked out successfully");
      void queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-analytics"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const regularizeMutation = useMutation({
    mutationFn: async () => {
      const response = await httpClient.post<ApiResponse<unknown>>(endpoints.attendanceRegularize, {
        date: regularizeDate,
        reason: regularizeReason,
        checkInTime: regularizeCheckIn || undefined,
        checkOutTime: regularizeCheckOut || undefined,
      });
      return response.data.data;
    },
    onSuccess: () => {
      toast.success("Regularization request submitted");
      setRegularizeOpen(false);
      setRegularizeDate("");
      setRegularizeReason("");
      setRegularizeCheckIn("");
      setRegularizeCheckOut("");
      void queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
    },
    onError: (error) => toast.error(parseApiError(error).message),
  });

  const myTabLoading = permissionsLoading || todayQuery.isLoading || analyticsQuery.isLoading || myRecordsQuery.isLoading;

  return (
    <PageTransition>
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "my" | "employee")}> 
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my" disabled={permissionsLoading || !canAccessMyAttendance}>
              My Attendance
            </TabsTrigger>
            {canAccessEmployeeAttendance ? (
              <TabsTrigger value="employee" disabled={permissionsLoading}>
                Employee Attendance
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="my" className="space-y-6">
            {myTabLoading ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-xl bg-white/[0.04]" />
                  ))}
                </div>
                <div className="h-56 animate-pulse rounded-xl bg-white/[0.04]" />
              </div>
            ) : (
              <>
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Today"
            value={workedMinutes}
            formattedValue={formatMinutesHuman(workedMinutes)}
            icon={Clock}
            tone="cyan"
            trend={status}
          />
          <StatCard
            label="Present"
            value={analytics?.presentDays ?? 0}
            formattedValue={formatDaysHuman(analytics?.presentDays ?? 0)}
            icon={CheckCircle}
            tone="emerald"
            trend="Current month"
          />
          <StatCard
            label="Late"
            value={analytics?.lateDays ?? 0}
            formattedValue={formatDaysHuman(analytics?.lateDays ?? 0)}
            icon={History}
            tone="amber"
            trend="Current month"
          />
          <StatCard
            label="Average"
            value={analytics?.averageWorkedMinutes ?? 0}
            formattedValue={formatMinutesHuman(analytics?.averageWorkedMinutes ?? 0)}
            icon={Calendar}
            tone="violet"
            trend="Current month"
          />
        </div>

        <SectionCard
          title="Live Work Timer"
          description="Tracks your current session without polling"
          actions={
            <div className="flex gap-2">
              <Button
                onClick={() => checkInMutation.mutate()}
                disabled={
                  permissionsLoading ||
                  checkInMutation.isPending ||
                  checkInLocked ||
                  hasTodayRecord ||
                  activeSession
                }
              >
                {checkInMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}
                {hasTodayRecord ? "Already Checked In Today" : "Check In"}
              </Button>
              <Button
                variant="outline"
                onClick={() => checkOutMutation.mutate()}
                disabled={permissionsLoading || checkOutMutation.isPending || !activeSession}
              >
                {checkOutMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogOut className="mr-2 size-4" />}
                Check Out
              </Button>
              {showRegularize && (
                <Dialog open={regularizeOpen} onOpenChange={setRegularizeOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary">
                      <History className="mr-2 size-4" />
                      Regularize
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request regularization</DialogTitle>
                      <DialogDescription>Submit a correction for the selected attendance date.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Date</label>
                        <input className="rounded-md border border-border bg-background px-3 py-2 text-sm" type="date" value={regularizeDate} onChange={(event) => setRegularizeDate(event.target.value)} max={format(new Date(), "yyyy-MM-dd")} />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Missing check-in time</label>
                        <input className="rounded-md border border-border bg-background px-3 py-2 text-sm" type="time" value={regularizeCheckIn} onChange={(event) => setRegularizeCheckIn(event.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Missing check-out time</label>
                        <input className="rounded-md border border-border bg-background px-3 py-2 text-sm" type="time" value={regularizeCheckOut} onChange={(event) => setRegularizeCheckOut(event.target.value)} />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Reason</label>
                        <Textarea value={regularizeReason} onChange={(event) => setRegularizeReason(event.target.value)} placeholder="Describe the correction needed" rows={3} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRegularizeOpen(false)}>Cancel</Button>
                      <Button onClick={() => regularizeMutation.mutate()} disabled={regularizeMutation.isPending || !regularizeDate || !regularizeReason}>
                        {regularizeMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        Submit
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          }
        >
          <div className="grid gap-4 rounded-xl border border-border/50 bg-white/[0.03] p-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Current status</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge className={statusClassName(status, Boolean(isLate))}>{isLate ? "LATE" : status}</Badge>
                {activeCheckIn && !activeCheckOut && <Badge variant="outline">Checked in</Badge>}
                {activeCheckOut && <Badge variant="outline">Checked out</Badge>}
              </div>
              {activeCheckIn && !activeCheckOut && <p className="mt-3 text-sm text-muted-foreground">Elapsed: {formatClockDuration(elapsed)}</p>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Session times</p>
              <div className="mt-2 grid gap-2 text-sm">
                <div className="flex justify-between rounded-md border border-border/50 px-3 py-2"><span className="text-muted-foreground">Check-in</span><span>{formatLocalTime(activeCheckIn)}</span></div>
                <div className="flex justify-between rounded-md border border-border/50 px-3 py-2"><span className="text-muted-foreground">Check-out</span><span>{formatLocalTime(activeCheckOut)}</span></div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Attendance Records" description="Daily attendance history in your local timezone">
          {regularizableRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No attendance records found.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/50">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border/50 bg-white/[0.03] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Day</th>
                    <th className="px-4 py-3 font-medium">Check-in</th>
                    <th className="px-4 py-3 font-medium">Check-out</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {regularizableRows.map((record) => {
                    const canRegularize = Boolean(record && (!record.checkInTime || !record.checkOutTime));
                    return (
                      <tr key={record.id} className="border-b border-border/40 last:border-b-0">
                        <td className="px-4 py-3">{formatLocalDate(record.attendanceDate)}</td>
                        <td className="px-4 py-3">{formatLocalDay(record.attendanceDate)}</td>
                        <td className="px-4 py-3">{formatLocalTime(record.checkInTime)}</td>
                        <td className="px-4 py-3">{formatLocalTime(record.checkOutTime)}</td>
                        <td className="px-4 py-3">{formatRowDuration(record)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge className={statusClassName(record.status, record.isLate)}>{record.isLate ? "LATE" : record.status}</Badge>
                            {record.isLate && <Badge variant="outline">Late</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canRegularize ? (
                            <Button size="sm" variant="outline" onClick={() => { setRegularizeDate(record.attendanceDate.slice(0, 10)); setRegularizeOpen(true); }}>
                              Regularize
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
              </>
            )}
          </TabsContent>

          {canAccessEmployeeAttendance ? (
            <TabsContent value="employee" className="space-y-4">
              <SectionCard
                title="Employee Attendance"
                description="Server-side attendance search, filters, and pagination across your visibility scope"
              >
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="relative md:col-span-2">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by employee name or employee ID"
                      value={employeeSearch}
                      onChange={(event) => setEmployeeSearch(event.target.value)}
                    />
                  </div>
                  <Select value={employeeStatus} onValueChange={(value) => setEmployeeStatus(value as AttendanceStatusFilter)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="PRESENT">Present</SelectItem>
                      <SelectItem value="LATE">Late</SelectItem>
                      <SelectItem value="HALF_DAY">Half Day</SelectItem>
                      <SelectItem value="ABSENT">Absent</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Departments</SelectItem>
                      {(departmentsQuery.data ?? []).map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                    <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                  </div>
                </div>

                {employeeRecordsQuery.isLoading ? (
                  <div className="mt-4 space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-12 animate-pulse rounded bg-white/[0.04]" />
                    ))}
                  </div>
                ) : employeeRecordsQuery.isError ? (
                  <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center">
                    {(() => {
                      const parsed = parseApiError(employeeRecordsQuery.error);
                      const message = parsed.statusCode === 403
                        ? "You do not have permission to view employee attendance"
                        : parsed.message;

                      return <p className="text-sm text-muted-foreground">{message}</p>;
                    })()}
                    <Button className="mt-3" variant="outline" onClick={() => void employeeRecordsQuery.refetch()}>
                      Retry
                    </Button>
                  </div>
                ) : !employeeRecordsQuery.data?.items.length ? (
                  <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    {employeeRecordsQuery.data?.meta.scopeEmployeeCount === 0
                      ? "No employees are currently in your attendance visibility scope"
                      : "No attendance records found for the selected filters"}
                  </div>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-xl border border-border/50">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border/50 bg-white/[0.03] text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Employee Name</th>
                          <th className="px-4 py-3 font-medium">Employee ID</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Check-in Time</th>
                          <th className="px-4 py-3 font-medium">Check-out Time</th>
                          <th className="px-4 py-3 font-medium">Duration</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeRecordsQuery.data.items.map((record) => {
                          const employeeName = record.employee
                            ? `${record.employee.firstName} ${record.employee.lastName}`.trim()
                            : "-";
                          return (
                            <tr key={record.id} className="border-b border-border/40 last:border-b-0">
                              <td className="px-4 py-3">{employeeName}</td>
                              <td className="px-4 py-3">{record.employee?.employeeId ?? "-"}</td>
                              <td className="px-4 py-3">{formatLocalDate(record.attendanceDate)}</td>
                              <td className="px-4 py-3">{formatLocalTime(record.checkInTime ?? record.checkInAt)}</td>
                              <td className="px-4 py-3">{formatLocalTime(record.checkOutTime ?? record.checkOutAt)}</td>
                              <td className="px-4 py-3">{formatRowDuration(record)}</td>
                              <td className="px-4 py-3">
                                <Badge className={statusClassName(record.status, record.isLate)}>
                                  {record.isLate ? "LATE" : record.status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {employeeRecordsQuery.data?.meta ? (
                  <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Page {employeeRecordsQuery.data.meta.page} of {Math.max(employeeRecordsQuery.data.meta.totalPages, 1)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={employeePage <= 1 || employeeRecordsQuery.isFetching}
                        onClick={() => setEmployeePage((current) => Math.max(1, current - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          employeePage >= employeeRecordsQuery.data.meta.totalPages ||
                          employeeRecordsQuery.isFetching
                        }
                        onClick={() =>
                          setEmployeePage((current) =>
                            Math.min(employeeRecordsQuery.data?.meta.totalPages ?? current, current + 1),
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </SectionCard>
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </PageTransition>
  );
}