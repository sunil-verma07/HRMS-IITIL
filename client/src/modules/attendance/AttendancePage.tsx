// src/modules/attendance/AttendancePage.tsx
import {
  Calendar,
  CheckCircle,
  Clock,
  History,
  Loader2,
  LogIn,
  LogOut,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, formatDistanceToNow, isToday, parseISO } from "date-fns";
import { PageTransition } from "@/components/animations/PageTransition";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/shared/SectionCard";
import { StatCard } from "@/components/shared/StatCard";
import { endpoints } from "@/services/api/endpoints";
import {
  genericColumns,
  type GenericRecord,
} from "@/modules/shared/module-columns";
import { httpClient } from "@/services/api/http-client";
import type { ApiResponse } from "@/types/api";
import { OperationalModulePage } from "@/modules/shared/OperationalModulePage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Add missing Label component (create if not exists)
const Label = ({
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className="text-sm font-medium text-muted-foreground" {...props}>
    {children}
  </label>
);

type AttendanceRecord = {
  id: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  workMinutes: number;
  status: string;
  attendanceDate: string;
  employee?: {
    employeeId: string;
    firstName: string;
    lastName: string;
    department: string;
  };
};

type RegularizationRequest = {
  id: string;
  attendanceDate: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  remarks?: string;
  employee?: {
    firstName: string;
    lastName: string;
    employeeId: string;
  };
};

type Settings = {
  attendanceSetting?: {
    officeStart: string;
    officeEnd: string;
    graceMinutes: number;
  };
  regularizationLimit: number;
};

// Progress Bar Component
function WorkProgressBar({
  workMinutes,
  expectedMinutes,
  isCheckedIn,
  isCheckedOut,
}: {
  workMinutes: number;
  expectedMinutes: number;
  isCheckedIn: boolean;
  isCheckedOut: boolean;
}) {
  const progress = Math.min((workMinutes / expectedMinutes) * 100, 100);
  const remainingMinutes = Math.max(expectedMinutes - workMinutes, 0);
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingMins = remainingMinutes % 60;

  if (!isCheckedIn || isCheckedOut) {
    return (
      <div className="rounded-xl bg-white/[0.025] p-6 text-center">
        <p className="text-muted-foreground">
          {!isCheckedIn
            ? "Check in to start tracking your work progress"
            : "Check out completed for today"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium">{Math.round(progress)}%</span>
      </div>
      <div className="relative h-8 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-end rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        >
          <span className="absolute right-2 text-xs font-medium text-white">
            {Math.floor(workMinutes / 60)}h {workMinutes % 60}m
          </span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs font-medium">
          <Clock className="size-3" />
          <span>
            Target: {Math.floor(expectedMinutes / 60)}h {expectedMinutes % 60}m
          </span>
        </div>
      </div>
      {remainingMinutes > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {remainingHours > 0 && `${remainingHours}h `}
          {remainingMins > 0 && `${remainingMins}m`} remaining
        </p>
      )}
    </div>
  );
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const [regularizationOpen, setRegularizationOpen] = useState(false);
  const [regularizationDate, setRegularizationDate] = useState("");
  const [regularizationReason, setRegularizationReason] = useState("");
  const [regularizationCheckIn, setRegularizationCheckIn] = useState("");
  const [regularizationCheckOut, setRegularizationCheckOut] = useState("");

  const { data: todayData, refetch: refetchToday } = useQuery({
    queryKey: ["attendance-today"],
    queryFn: async () => {
      const res = await httpClient.get<
        ApiResponse<{ items: AttendanceRecord[] }>
      >("/attendance?limit=1&page=1&sort=desc");
      const records = res.data.data?.items ?? [];
      const todayRecord = records.find((r) =>
        isToday(parseISO(r.attendanceDate)),
      );
      return todayRecord ?? null;
    },
    staleTime: 30000,
    refetchInterval: (data) => {
      if (data?.checkInAt && !data?.checkOutAt) return 60000;
      return false;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<Settings>>("/settings");
      return res.data.data;
    },
  });

  const { data: regularizations } = useQuery({
    queryKey: ["regularizations"],
    queryFn: async () => {
      const res = await httpClient.get<
        ApiResponse<{ items: RegularizationRequest[] }>
      >("/attendance/regularizations");
      return res.data.data?.items ?? [];
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const res = await httpClient.post<ApiResponse<AttendanceRecord>>(
        "/attendance/check-in",
        {
          deviceInfo: { userAgent: navigator.userAgent },
        },
      );
      return res.data.data;
    },
    onSuccess: () => {
      toast.success("Checked in successfully");
      void queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void refetchToday();
    },
    onError: (err: Error) => toast.error(err.message ?? "Check-in failed"),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const res = await httpClient.post<ApiResponse<AttendanceRecord>>(
        "/attendance/check-out",
        {
          deviceInfo: { userAgent: navigator.userAgent },
        },
      );
      return res.data.data;
    },
    onSuccess: () => {
      toast.success("Checked out successfully");
      void queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      void refetchToday();
    },
    onError: (err: Error) => toast.error(err.message ?? "Check-out failed"),
  });

  const regularizationMutation = useMutation({
    mutationFn: async () => {
      const res = await httpClient.post("/attendance/regularizations", {
        date: regularizationDate,
        reason: regularizationReason,
        requestedCheckIn: regularizationCheckIn || null,
        requestedCheckOut: regularizationCheckOut || null,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Regularization request submitted");
      setRegularizationOpen(false);
      setRegularizationDate("");
      setRegularizationReason("");
      setRegularizationCheckIn("");
      setRegularizationCheckOut("");
      void queryClient.invalidateQueries({ queryKey: ["regularizations"] });
    },
    onError: (err: Error) =>
      toast.error(err.message ?? "Failed to submit request"),
  });

  const isCheckedIn = !!todayData?.checkInAt;
  const isCheckedOut = !!todayData?.checkOutAt;
  const workHours = todayData ? (todayData.workMinutes / 60).toFixed(1) : 0;

  const officeStart = settings?.attendanceSetting?.officeStart || "09:00";
  const officeEnd = settings?.attendanceSetting?.officeEnd || "18:00";
  const [startHours, startMinutes] = officeStart.split(":").map(Number);
  const [endHours, endMinutes] = officeEnd.split(":").map(Number);
  const expectedMinutes =
    endHours * 60 + endMinutes - (startHours * 60 + startMinutes);

  const pendingRegularizations =
    regularizations?.filter((r) => r.status === "PENDING").length || 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Today's Work"
            value={Number(workHours)}
            suffix="h"
            icon={Clock}
            tone="cyan"
            trend={
              todayData?.status
                ? `Status: ${todayData.status}`
                : "Not checked in"
            }
          />
          <StatCard
            label="Regularization Requests"
            value={pendingRegularizations}
            suffix="pending"
            icon={History}
            tone="amber"
            trend="Monthly limit resets"
          />
          <StatCard
            label="Monthly Limit"
            value={settings?.regularizationLimit ?? 5}
            suffix="requests"
            icon={Calendar}
            tone="violet"
            trend="Max per month"
          />
        </div>

        {/* Progress Bar Section */}
        <SectionCard
          title="Work Progress"
          description="Today's attendance tracking"
        >
          <WorkProgressBar
            workMinutes={todayData?.workMinutes || 0}
            expectedMinutes={expectedMinutes}
            isCheckedIn={isCheckedIn}
            isCheckedOut={isCheckedOut}
          />
        </SectionCard>

        {/* Check-in/Check-out Controls */}
        <SectionCard
          title="Attendance Control"
          description="Check in and check out for the day"
          actions={
            <div className="flex gap-2">
              <Button
                onClick={() => checkInMutation.mutate()}
                disabled={
                  checkInMutation.isPending || isCheckedIn || isCheckedOut
                }
                className="min-w-28"
              >
                {checkInMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Checking...
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" /> Check In
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => checkOutMutation.mutate()}
                disabled={
                  checkOutMutation.isPending || !isCheckedIn || isCheckedOut
                }
                className="min-w-28"
              >
                {checkOutMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Checking...
                  </>
                ) : (
                  <>
                    <LogOut className="size-4" /> Check Out
                  </>
                )}
              </Button>
              <Dialog
                open={regularizationOpen}
                onOpenChange={setRegularizationOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="secondary">
                    <History className="size-4" />
                    Regularize
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request Attendance Regularization</DialogTitle>
                    <DialogDescription>
                      Submit a request to adjust your attendance for a specific
                      date. Your reporting manager will review this request.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Date *</Label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={regularizationDate}
                        onChange={(e) => setRegularizationDate(e.target.value)}
                        max={format(new Date(), "yyyy-MM-dd")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Requested Check-in Time (Optional)</Label>
                      <input
                        type="time"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={regularizationCheckIn}
                        onChange={(e) =>
                          setRegularizationCheckIn(e.target.value)
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Requested Check-out Time (Optional)</Label>
                      <input
                        type="time"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={regularizationCheckOut}
                        onChange={(e) =>
                          setRegularizationCheckOut(e.target.value)
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Reason *</Label>
                      <Textarea
                        placeholder="Please explain why you need to regularize this attendance..."
                        value={regularizationReason}
                        onChange={(e) =>
                          setRegularizationReason(e.target.value)
                        }
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setRegularizationOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => regularizationMutation.mutate()}
                      disabled={
                        !regularizationDate ||
                        !regularizationReason ||
                        regularizationMutation.isPending
                      }
                    >
                      {regularizationMutation.isPending && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Submit Request
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          }
        >
          <div className="grid gap-3 rounded-xl border border-dashed border-border bg-white/[0.025] p-5 text-sm text-muted-foreground md:grid-cols-2">
            <div>
              <span className="text-foreground font-medium">
                Today's Status
              </span>
              <div className="mt-1 flex items-center gap-2">
                {isCheckedIn ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle className="size-3" /> Checked In
                  </Badge>
                ) : (
                  <Badge variant="muted" className="gap-1">
                    <XCircle className="size-3" /> Not Checked In
                  </Badge>
                )}
                {isCheckedOut && (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle className="size-3" /> Checked Out
                  </Badge>
                )}
              </div>
              {isCheckedIn && !isCheckedOut && todayData?.checkInAt && (
                <p className="mt-2 text-xs">
                  Checked in{" "}
                  {formatDistanceToNow(parseISO(todayData.checkInAt))} ago
                </p>
              )}
            </div>
            <div>
              <span className="text-foreground font-medium">Grace Period</span>
              <p className="mt-1 text-xs">
                Check-in within 15 minutes after {officeStart} is considered
                on-time. Check-out after {officeEnd} is considered full day.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Attendance Records Table */}
        <Tabs defaultValue="records">
          <TabsList>
            <TabsTrigger value="records">Attendance Records</TabsTrigger>
            <TabsTrigger value="regularizations">
              Regularization Requests
            </TabsTrigger>
          </TabsList>
          <TabsContent value="records" className="mt-4">
            <OperationalModulePage<GenericRecord>
              config={{
                resource: "attendance",
                endpoint: endpoints.attendance,
                eyebrow: "Workforce presence",
                title: "Daily attendance",
                description:
                  "View attendance records, late marks, work duration, and daily attendance status.",
                createLabel: "Export",
                columns: [
                  { accessorKey: "employee.employeeId", header: "Employee ID" },
                  {
                    accessorKey: "employee.firstName",
                    header: "Employee Name",
                    cell: ({ row }: any) =>
                      `${row.original.employee?.firstName} ${row.original.employee?.lastName}`,
                  },
                  { accessorKey: "employee.department", header: "Department" },
                  {
                    accessorKey: "attendanceDate",
                    header: "Date",
                    cell: ({ row }: any) =>
                      format(parseISO(row.original.attendanceDate), "PPP"),
                  },
                  {
                    accessorKey: "checkInAt",
                    header: "Check-in Time",
                    cell: ({ row }: any) =>
                      row.original.checkInAt
                        ? format(parseISO(row.original.checkInAt), "p")
                        : "-",
                  },
                  {
                    accessorKey: "checkOutAt",
                    header: "Check-out Time",
                    cell: ({ row }: any) =>
                      row.original.checkOutAt
                        ? format(parseISO(row.original.checkOutAt), "p")
                        : "-",
                  },
                  {
                    accessorKey: "workMinutes",
                    header: "Work Hours",
                    cell: ({ row }: any) =>
                      `${Math.floor(row.original.workMinutes / 60)}h ${row.original.workMinutes % 60}m`,
                  },
                  {
                    accessorKey: "status",
                    header: "Status",
                    cell: ({ row }: any) => (
                      <Badge
                        variant={
                          row.original.status === "PRESENT"
                            ? "success"
                            : row.original.status === "LATE"
                              ? "warning"
                              : row.original.status === "HALF_DAY"
                                ? "violet"
                                : "danger"
                        }
                      >
                        {row.original.status}
                      </Badge>
                    ),
                  },
                ],
                emptyTitle: "No attendance records",
                emptyDescription:
                  "Attendance records will appear here after employees check in.",
              }}
            />
          </TabsContent>
          <TabsContent value="regularizations" className="mt-4">
            <OperationalModulePage<GenericRecord>
              config={{
                resource: "regularizations",
                endpoint: "/attendance/regularizations",
                eyebrow: "Attendance Corrections",
                title: "Regularization Requests",
                description:
                  "Track your attendance regularization requests and their status.",
                createLabel: "New Request",
                columns: [
                  {
                    accessorKey: "attendanceDate",
                    header: "Date",
                    cell: ({ row }: any) =>
                      format(parseISO(row.original.attendanceDate), "PPP"),
                  },
                  {
                    accessorKey: "requestedCheckIn",
                    header: "Requested Check-in",
                    cell: ({ row }: any) =>
                      row.original.requestedCheckIn
                        ? format(parseISO(row.original.requestedCheckIn), "p")
                        : "-",
                  },
                  {
                    accessorKey: "requestedCheckOut",
                    header: "Requested Check-out",
                    cell: ({ row }: any) =>
                      row.original.requestedCheckOut
                        ? format(parseISO(row.original.requestedCheckOut), "p")
                        : "-",
                  },
                  { accessorKey: "reason", header: "Reason" },
                  {
                    accessorKey: "status",
                    header: "Status",
                    cell: ({ row }: any) => (
                      <Badge
                        variant={
                          row.original.status === "APPROVED"
                            ? "success"
                            : row.original.status === "REJECTED"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {row.original.status}
                      </Badge>
                    ),
                  },
                  {
                    accessorKey: "remarks",
                    header: "Remarks",
                    cell: ({ row }: any) => row.original.remarks || "-",
                  },
                ],
                emptyTitle: "No regularization requests",
                emptyDescription:
                  "Submit a request to correct your attendance records.",
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
