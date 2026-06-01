// src/modules/settings/SettingsPage.tsx - Updated version
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isSameDay, startOfMonth, subMonths } from 'date-fns';
import { Building2, CalendarDays, ChevronLeft, ChevronRight, Clock, Edit3, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageTransition } from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { Textarea } from '@/components/ui/textarea';
import { httpClient } from '@/services/api/http-client';
import { endpoints } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge'; 
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

type AttendanceSetting = {
  id: string;
  officeStart: string;
  officeEnd: string;
  graceMinutes: number;
  workingDays: string[];
};

type LeaveType = {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  isPaid: boolean;
  isActive: boolean;
  deletedAt?: string;
};

type SettingsData = {
  attendanceSetting: AttendanceSetting | null;
  leaveTypes: LeaveType[];
  regularizationLimit: number;
};

type LeaveCalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: string;
  description?: string | null;
};

type FormState = {
  officeStart: string;
  officeEnd: string;
  graceMinutes: string;
  regularizationLimit: string;
  workingDays?: string[];
};

const DEFAULT_FORM: FormState = {
  officeStart: '09:00',
  officeEnd: '18:00',
  graceMinutes: '10',
  regularizationLimit: '5'
};

function HolidayCalendarManager() {
  const queryClient = useQueryClient();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<LeaveCalendarEvent | null>(null);
  const [holidayForm, setHolidayForm] = useState({
    title: '',
    date: '',
    type: 'HOLIDAY',
    description: '',
  });

  const {
    data: holidayEventsRaw,
    isLoading: holidaysLoading,
    refetch: refetchHolidays,
    error: holidaysError,
  } = useQuery({
    queryKey: ['settings-calendar-events'],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<LeaveCalendarEvent[] | { items: LeaveCalendarEvent[] }>>(
        endpoints.leaveCalendar,
      );
      const payload = response.data.data;
      if (Array.isArray(payload)) return payload;
      if (payload && typeof payload === 'object' && 'items' in payload && Array.isArray(payload.items)) {
        return payload.items;
      }
      return [];
    },
    staleTime: 30_000,
  });

  const holidayEvents: LeaveCalendarEvent[] = Array.isArray(holidayEventsRaw) ? holidayEventsRaw : [];

  const createHolidayMutation = useMutation({
    mutationFn: async (data: { title: string; date: string; type: string; description?: string | null }) => {
      const response = await httpClient.post(endpoints.leaveCalendar, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Holiday added successfully');
      setHolidayDialogOpen(false);
      setHolidayForm({ title: '', date: '', type: 'HOLIDAY', description: '' });
      setEditingHoliday(null);
      void queryClient.invalidateQueries({ queryKey: ['settings-calendar-events'] });
      void refetchHolidays();
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to add holiday');
    },
  });

  const updateHolidayMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title: string; date: string; type: string; description?: string | null } }) => {
      const response = await httpClient.patch(`${endpoints.leaveCalendar}/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Holiday updated');
      setHolidayDialogOpen(false);
      setEditingHoliday(null);
      setHolidayForm({ title: '', date: '', type: 'HOLIDAY', description: '' });
      void queryClient.invalidateQueries({ queryKey: ['settings-calendar-events'] });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to update holiday');
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      await httpClient.delete(`${endpoints.leaveCalendar}/${id}`);
    },
    onSuccess: () => {
      toast.success('Holiday deleted');
      void queryClient.invalidateQueries({ queryKey: ['settings-calendar-events'] });
      void refetchHolidays();
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to delete holiday');
    },
  });

  const handleHolidaySubmit = () => {
    if (!holidayForm.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!holidayForm.date) {
      toast.error('Date is required');
      return;
    }

    if (editingHoliday) {
      const updatePayload: { title: string; date: string; type: string; description?: string | null } = {
        title: holidayForm.title.trim(),
        date: holidayForm.date,
        type: holidayForm.type,
      };
      if (holidayForm.description.trim()) {
        updatePayload.description = holidayForm.description.trim();
      }

      updateHolidayMutation.mutate({
        id: editingHoliday.id,
        data: updatePayload,
      });
      return;
    }

    const createPayload: { title: string; date: string; type: string; description?: string | null } = {
      title: holidayForm.title.trim(),
      date: holidayForm.date,
      type: holidayForm.type,
    };
    if (holidayForm.description.trim()) {
      createPayload.description = holidayForm.description.trim();
    }

    createHolidayMutation.mutate(createPayload);
  };

  const getEventsForDay = (day: Date): LeaveCalendarEvent[] => {
    if (!day || Number.isNaN(day.getTime())) return [];

    return holidayEvents.filter((event) => {
      try {
        if (!event?.date) return false;
        const eventDate = new Date(event.date);
        if (Number.isNaN(eventDate.getTime())) return false;
        return isSameDay(eventDate, day);
      } catch {
        return false;
      }
    });
  };

  const getEventColor = (type: string): string => {
    const colors: Record<string, string> = {
      HOLIDAY: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      FESTIVAL: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      OPTIONAL: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      COMPANY: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    return colors[type] || 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  };

  const monthLabel = (() => {
    try {
      return format(calendarMonth, 'MMMM yyyy');
    } catch {
      return 'Invalid month';
    }
  })();

  return (
    <SectionCard
      title="Holiday Calendar"
      description="Manage company holidays, festivals, and optional holidays."
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditingHoliday(null);
            setHolidayForm({ title: '', date: '', type: 'HOLIDAY', description: '' });
            setHolidayDialogOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add Holiday
        </Button>
      }
    >
      {holidaysLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ) : holidaysError ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-center">
          <p className="text-sm text-rose-300">Failed to load calendar events.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetchHolidays()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                try {
                  setCalendarMonth((prev) => subMonths(prev, 1));
                } catch {
                  setCalendarMonth(new Date());
                }
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-base font-semibold">{monthLabel}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                try {
                  setCalendarMonth((prev) => addMonths(prev, 1));
                } catch {
                  setCalendarMonth(new Date());
                }
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {(() => {
            try {
              const monthStart = startOfMonth(calendarMonth);
              const monthEnd = endOfMonth(calendarMonth);
              const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
              const startDayOfWeek = getDay(monthStart);
              const blanks = Array(startDayOfWeek).fill(null);

              return (
                <div className="grid grid-cols-7 gap-1">
                  {blanks.map((_, index) => (
                    <div
                      key={`blank-${index}`}
                      className="min-h-[80px] rounded-lg border border-border/30 bg-white/[0.01] p-1"
                    />
                  ))}
                  {days.map((day) => {
                    const dayEvents = getEventsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isWeekend = getDay(day) === 0 || getDay(day) === 6;

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'min-h-[80px] rounded-lg border p-1.5',
                          isToday
                            ? 'border-cyan-500/50 bg-cyan-500/5'
                            : isWeekend
                              ? 'border-border/30 bg-white/[0.015]'
                              : 'border-border/30 bg-white/[0.01]',
                        )}
                      >
                        <div
                          className={cn(
                            'mb-1 text-right text-xs',
                            isToday ? 'font-bold text-cyan-400' : isWeekend ? 'text-white/30' : 'text-white/50',
                          )}
                        >
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className={cn(
                                'group relative flex cursor-pointer items-center justify-between gap-1 rounded border px-1 py-0.5 text-[10px] leading-tight',
                                getEventColor(event.type ?? 'HOLIDAY'),
                              )}
                            >
                              <span className="flex-1 truncate">{event.title ?? 'Untitled'}</span>
                              <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                                <button
                                  type="button"
                                  className="transition-colors hover:text-white"
                                  onClick={(mouseEvent) => {
                                    mouseEvent.stopPropagation();
                                    let formattedDate = '';
                                    try {
                                      formattedDate = event.date ? format(new Date(event.date), 'yyyy-MM-dd') : '';
                                    } catch {
                                      formattedDate = '';
                                    }

                                    setEditingHoliday(event);
                                    setHolidayForm({
                                      title: event.title ?? '',
                                      date: formattedDate,
                                      type: event.type ?? 'HOLIDAY',
                                      description: event.description ?? '',
                                    });
                                    setHolidayDialogOpen(true);
                                  }}
                                >
                                  <Edit3 className="size-2.5" />
                                </button>
                                <button
                                  type="button"
                                  className="transition-colors hover:text-rose-400"
                                  onClick={(mouseEvent) => {
                                    mouseEvent.stopPropagation();
                                    if (window.confirm(`Delete "${event.title}"?`)) {
                                      deleteHolidayMutation.mutate(event.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="size-2.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            } catch (error) {
              console.error('Calendar render error:', error);
              return (
                <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-center">
                  <p className="text-sm text-rose-300">Calendar failed to render. Please refresh.</p>
                </div>
              );
            }
          })()}

          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-foreground">All Holidays ({holidayEvents.length})</h3>
            {holidayEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No holidays added yet.</p>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {holidayEvents
                  .filter((event) => event?.id && event?.title)
                  .sort((a, b) => {
                    try {
                      return new Date(a.date).getTime() - new Date(b.date).getTime();
                    } catch {
                      return 0;
                    }
                  })
                  .map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-4 p-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('rounded border px-2 py-0.5 text-xs font-medium', getEventColor(event.type ?? 'HOLIDAY'))}>
                          {event.type ?? 'HOLIDAY'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {(() => {
                              try {
                                return format(new Date(event.date), 'MMMM d, yyyy');
                              } catch {
                                return event.date ?? 'Unknown date';
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            let formattedDate = '';
                            try {
                              formattedDate = event.date ? format(new Date(event.date), 'yyyy-MM-dd') : '';
                            } catch {
                              formattedDate = '';
                            }

                            setEditingHoliday(event);
                            setHolidayForm({
                              title: event.title ?? '',
                              date: formattedDate,
                              type: event.type ?? 'HOLIDAY',
                              description: event.description ?? '',
                            });
                            setHolidayDialogOpen(true);
                          }}
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                          onClick={() => {
                            if (window.confirm(`Delete "${event.title}"?`)) {
                              deleteHolidayMutation.mutate(event.id);
                            }
                          }}
                          disabled={deleteHolidayMutation.isPending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog
        open={holidayDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingHoliday(null);
            setHolidayForm({ title: '', date: '', type: 'HOLIDAY', description: '' });
          }
          setHolidayDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
            <DialogDescription>
              {editingHoliday ? 'Update the holiday details.' : 'Add a new holiday to the company calendar.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Diwali, Christmas, Company Day"
                value={holidayForm.title}
                onChange={(event) => setHolidayForm((prev) => ({ ...prev, title: event.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={holidayForm.date}
                onChange={(event) => setHolidayForm((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Type *</Label>
              <Select
                value={holidayForm.type}
                onValueChange={(value) => setHolidayForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOLIDAY">National Holiday</SelectItem>
                  <SelectItem value="FESTIVAL">Festival</SelectItem>
                  <SelectItem value="OPTIONAL">Optional Holiday</SelectItem>
                  <SelectItem value="COMPANY">Company Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Additional information..."
                value={holidayForm.description}
                onChange={(event) => setHolidayForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleHolidaySubmit}
              disabled={
                !holidayForm.title.trim() ||
                !holidayForm.date ||
                createHolidayMutation.isPending ||
                updateHolidayMutation.isPending
              }
            >
              {createHolidayMutation.isPending || updateHolidayMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : editingHoliday ? (
                'Update Holiday'
              ) : (
                'Add Holiday'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function DepartmentsManager() {
  const queryClient = useQueryClient();
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState('');

  const {
    data: departmentConfig,
    isLoading: deptsLoading,
    refetch: refetchDepts,
  } = useQuery({
    queryKey: ['config', 'hr.departments'],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<{ key: string; value: string[] }>>(
        endpoints.config.byKey('hr.departments'),
      );
      return response.data.data;
    },
    staleTime: 30_000,
  });

  const departments: string[] = Array.isArray(departmentConfig?.value) ? departmentConfig.value : [];

  const saveDeptsMutation = useMutation({
    mutationFn: async (updatedDepts: string[]) => {
      const response = await httpClient.put(endpoints.config.byKey('hr.departments'), {
        value: updatedDepts,
      });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', 'hr.departments'] });
      void refetchDepts();
      toast.success('Departments updated');
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to update departments');
    },
  });

  const handleAddDepartment = () => {
    const trimmed = newDeptName.trim();
    if (!trimmed) {
      toast.error('Department name cannot be empty');
      return;
    }
    if (departments.includes(trimmed)) {
      toast.error('Department already exists');
      return;
    }

    saveDeptsMutation.mutate([...departments, trimmed]);
    setNewDeptName('');
    setDeptDialogOpen(false);
  };

  const handleDeleteDepartment = (deptName: string) => {
    if (!window.confirm(`Delete department "${deptName}"? This cannot be undone.`)) {
      return;
    }

    saveDeptsMutation.mutate(departments.filter((department) => department !== deptName));
  };

  const handleEditDepartment = () => {
    const trimmed = editDeptName.trim();
    if (!trimmed || !editingDept) {
      return;
    }

    if (departments.includes(trimmed) && trimmed !== editingDept) {
      toast.error('Department name already exists');
      return;
    }

    saveDeptsMutation.mutate(departments.map((department) => (department === editingDept ? trimmed : department)));
    setEditingDept(null);
    setEditDeptName('');
  };

  return (
    <SectionCard
      title="Departments & Designations"
      description="Manage master department list used across employee workflows."
      actions={
        <Button
          size="sm"
          onClick={() => {
            setNewDeptName('');
            setDeptDialogOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Add Department
        </Button>
      }
    >
      {deptsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Building2 className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No departments yet. Click "Add Department" to create one.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <div key={department} className="rounded-xl border border-border bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-2">
                {editingDept === department ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={editDeptName}
                      onChange={(event) => setEditDeptName(event.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleEditDepartment();
                        if (event.key === 'Escape') setEditingDept(null);
                      }}
                    />
                    <Button size="sm" onClick={handleEditDepartment} disabled={saveDeptsMutation.isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingDept(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{department}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Department</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setEditingDept(department);
                          setEditDeptName(department);
                        }}
                      >
                        <Edit3 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                        onClick={() => handleDeleteDepartment(department)}
                        disabled={saveDeptsMutation.isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>Enter a name for the new department.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="dept-name">Department Name *</Label>
              <Input
                id="dept-name"
                placeholder="e.g., Engineering"
                value={newDeptName}
                onChange={(event) => setNewDeptName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddDepartment();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeptDialogOpen(false);
                setNewDeptName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddDepartment}
              disabled={!newDeptName.trim() || saveDeptsMutation.isPending}
            >
              {saveDeptsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Department'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

// Leave Types Manager Component
function LeaveTypesManager({ leaveTypes, onUpdate }: { leaveTypes: LeaveType[]; onUpdate: () => void }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [annualQuota, setAnnualQuota] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await httpClient.post('/leave-types', { name, code: code.toUpperCase(), annualQuota: Number(annualQuota), isPaid });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Leave type created');
      setDialogOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      onUpdate();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create leave type')
  });
  
  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await httpClient.patch(`/leave-types/${editingType?.id}`, { name, annualQuota: Number(annualQuota), isPaid });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Leave type updated');
      setDialogOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      onUpdate();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update leave type')
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await httpClient.delete(`/leave-types/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Leave type deleted');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      onUpdate();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete leave type')
  });
  
  const resetForm = () => {
    setName('');
    setCode('');
    setAnnualQuota('');
    setIsPaid(true);
    setEditingType(null);
  };
  
  const handleEdit = (type: LeaveType) => {
    setEditingType(type);
    setName(type.name);
    setCode(type.code);
    setAnnualQuota(String(type.annualQuota));
    setIsPaid(type.isPaid);
    setDialogOpen(true);
  };
  
  const handleSubmit = () => {
    if (editingType) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 size-4" />
              Add Leave Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingType ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
              <DialogDescription>
                Configure leave type settings including name, code, and annual quota.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Casual Leave" />
              </div>
              <div>
                <Label>Code *</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g., CL" maxLength={40} />
              </div>
              <div>
                <Label>Annual Quota (days) *</Label>
                <Input type="number" step="0.5" value={annualQuota} onChange={(e) => setAnnualQuota(e.target.value)} placeholder="12" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Paid Leave</Label>
                <Switch checked={isPaid} onCheckedChange={setIsPaid} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!name || !code || !annualQuota || createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="divide-y divide-border rounded-lg border border-border">
        {leaveTypes.filter(lt => !lt.deletedAt).map((type) => (
          <div key={type.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{type.name}</span>
                <span className="text-xs text-muted-foreground">({type.code})</span>
                {!type.isActive && <Badge variant="secondary">Inactive</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {type.annualQuota} days/year • {type.isPaid ? 'Paid' : 'Unpaid'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(type)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(type.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { roles } = usePermissions();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState('attendance');
  const canManageDepartmentsDesignations = roles.includes('SUPER_ADMIN');
  const canManageHolidayCalendar = roles.includes('SUPER_ADMIN') || roles.includes('PORTAL_ADMIN');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<SettingsData>>('/settings');
      return res.data.data;
    },
    staleTime: 30000
  });

  useEffect(() => {
    if (data?.attendanceSetting) {
      setForm({
        officeStart: data.attendanceSetting.officeStart,
        officeEnd: data.attendanceSetting.officeEnd,
        graceMinutes: String(data.attendanceSetting.graceMinutes),
        regularizationLimit: String(data.regularizationLimit ?? 5)
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormState) => {
      await httpClient.patch('/settings', {
        officeStart: values.officeStart,
        officeEnd: values.officeEnd,
        graceMinutes: Number(values.graceMinutes),
        regularizationLimit: Number(values.regularizationLimit)
      });
    },
    onSuccess: () => {
      toast.success('Settings saved');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save settings')
  });

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  });

  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader eyebrow="Administration" title="Settings" description="Loading settings…" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (isError) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader eyebrow="Administration" title="Settings" description="Failed to load settings." />
          <SectionCard title="Error" description="Could not load settings from the server.">
            <Button variant="outline" onClick={() => void queryClient.invalidateQueries({ queryKey: ['settings'] })}>
              Retry
            </Button>
          </SectionCard>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Settings"
          description="Configure attendance policies, leave types, and system preferences."
          actions={
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leave">Leave Types</TabsTrigger>
            {canManageDepartmentsDesignations ? <TabsTrigger value="departments-designations">Departments & Designations</TabsTrigger> : null}
            {canManageHolidayCalendar ? <TabsTrigger value="holiday-calendar">Holiday Calendar</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="attendance" className="mt-6 space-y-6">
            <div className="grid gap-5 xl:grid-cols-2">
              <SectionCard title="Office Timing" description="Define work hours and grace period for attendance checks.">
                <Clock className="mb-5 size-5 text-cyan-200" />
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Office start time</span>
                    <Input type="time" {...field('officeStart')} />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Office end time</span>
                    <Input type="time" {...field('officeEnd')} />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Grace minutes</span>
                    <Input type="number" min={0} max={60} {...field('graceMinutes')} />
                    <p className="text-xs text-muted-foreground">Plus 15-minute buffer after grace for on-time arrival</p>
                  </label>
                </div>
              </SectionCard>

              <SectionCard title="Regularization Policy" description="Configure attendance regularization limits.">
                <CalendarDays className="mb-5 size-5 text-amber-200" />
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Monthly Regularization Limit</span>
                    <Input type="number" min={1} max={20} {...field('regularizationLimit')} />
                    <p className="text-xs text-muted-foreground">Maximum number of regularization requests per employee per month</p>
                  </label>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Working Days" description="Configure which days are considered working days.">
              <div className="flex flex-wrap gap-3">
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                  <div key={day} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`day-${day}`}
                      checked={data?.attendanceSetting?.workingDays?.includes(day) ?? (day !== 'SAT' && day !== 'SUN')}
                      onChange={(e) => {
                        const current = data?.attendanceSetting?.workingDays ?? ['MON', 'TUE', 'WED', 'THU', 'FRI'];
                        const newDays = e.target.checked ? [...current, day] : current.filter(d => d !== day);
                        setForm(prev => ({ ...prev }));
                        saveMutation.mutate({ ...form, workingDays: newDays as any });
                      }}
                      className="rounded border-border"
                    />
                    <Label htmlFor={`day-${day}`} className="text-sm">{day}</Label>
                  </div>
                ))}
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="leave" className="mt-6">
            <SectionCard title="Leave Types" description="Manage leave types, quotas, and policies.">
              <LeaveTypesManager 
                leaveTypes={data?.leaveTypes ?? []} 
                onUpdate={() => void queryClient.invalidateQueries({ queryKey: ['settings'] })}
              />
            </SectionCard>
          </TabsContent>

          {canManageDepartmentsDesignations ? (
            <TabsContent value="departments-designations" className="mt-6">
              <DepartmentsManager />
            </TabsContent>
          ) : null}

          {canManageHolidayCalendar ? (
            <TabsContent value="holiday-calendar" className="mt-6">
              <HolidayCalendarManager />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </PageTransition>
  );
}