// src/modules/leaves/LeavesPage.tsx
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Send } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, parseISO } from 'date-fns';
import { PageTransition } from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/shared/SectionCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { httpClient } from '@/services/api/http-client';
import type { ApiResponse } from '@/types/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LeaveType = {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  isPaid: boolean;
};

type LeaveBalance = {
  id: string;
  leaveTypeId: string;
  allocated: number;
  used: number;
  leaveType: LeaveType;
};

type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  leaveType: LeaveType;
  employee?: {
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  approvals: Array<{
    approver: { firstName: string; lastName: string };
    decision: string;
    level: number;
  }>;
};

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: string;
  description?: string;
};

// Leave Balance Cards Component
function LeaveBalanceCards({ balances }: { balances: LeaveBalance[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {balances.map((balance) => (
        <Card key={balance.leaveTypeId} className="border-border bg-white/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{balance.leaveType.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-bold text-cyan-400">
                {(balance.allocated - balance.used).toFixed(1)} days
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                style={{ width: `${((balance.allocated - balance.used) / balance.allocated) * 100}%` }}
              />
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>Allocated: {balance.allocated}</span>
              <span>Used: {balance.used}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Calendar Component
function LeaveCalendar({ events, onAddEvent, canAddEvents }: { events: CalendarEvent[]; onAddEvent?: () => void; canAddEvents?: boolean }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startDay = getDay(monthStart);
  const blanks = Array(startDay).fill(null);
  const totalDays = days.length;
  const remainingBlanks = 42 - (blanks.length + totalDays);
  
  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(parseISO(event.date), day));
  };
  
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {canAddEvents && onAddEvent && (
          <Button size="sm" onClick={onAddEvent}>
            <Plus className="mr-2 size-4" />
            Add Event
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        
        {blanks.map((_, index) => (
          <div key={`blank-${index}`} className="min-h-[100px] rounded-lg border border-border/50 bg-white/[0.01] p-2" />
        ))}
        
        {days.map(day => {
          const dayEvents = getEventsForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div 
              key={day.toISOString()} 
              className={`min-h-[100px] rounded-lg border p-2 ${
                isToday ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-border/50 bg-white/[0.01]'
              }`}
            >
              <div className={`text-right text-sm ${isToday ? 'font-bold text-cyan-400' : ''}`}>
                {format(day, 'd')}
              </div>
              <div className="mt-1 space-y-1">
                {dayEvents.map(event => (
                  <div 
                    key={event.id}
                    className={`rounded px-1 py-0.5 text-xs ${
                      event.type === 'HOLIDAY' ? 'bg-emerald-500/20 text-emerald-400' :
                      event.type === 'FESTIVAL' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-cyan-500/20 text-cyan-400'
                    }`}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        
        {Array(remainingBlanks).fill(null).map((_, index) => (
          <div key={`remaining-blank-${index}`} className="min-h-[100px] rounded-lg border border-border/50 bg-white/[0.01] p-2" />
        ))}
      </div>
    </div>
  );
}

export function LeavesPage() {
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('HOLIDAY');
  const [eventDescription, setEventDescription] = useState('');
  
  const { data: user } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await httpClient.get('/auth/me');
      return res.data.data;
    }
  });
  
  const { data: balances } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<LeaveBalance[]>>('/leaves/balances');
      return res.data.data ?? [];
    }
  });
  
  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<LeaveType[]>>('/leave-types');
      return res.data.data ?? [];
    }
  });
  
  const { data: requests } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<{ items: LeaveRequest[] }>>('/leaves');
      return res.data.data?.items ?? [];
    }
  });
  
  const { data: calendarEvents, refetch: refetchCalendar } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<CalendarEvent[]>>('/leaves/calendar');
      return res.data.data ?? [];
    }
  });
  
  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await httpClient.post('/leaves', {
        leaveTypeId: selectedLeaveType,
        startDate,
        endDate,
        reason
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Leave request submitted');
      setApplyOpen(false);
      setSelectedLeaveType('');
      setStartDate('');
      setEndDate('');
      setReason('');
      void queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to submit leave request')
  });
  
  const addEventMutation = useMutation({
    mutationFn: async () => {
      const res = await httpClient.post('/leaves/calendar', {
        title: eventTitle,
        date: eventDate,
        type: eventType,
        description: eventDescription
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Calendar event added');
      setEventOpen(false);
      setEventTitle('');
      setEventDate('');
      setEventType('HOLIDAY');
      setEventDescription('');
      void refetchCalendar();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to add event')
  });
  
  const canAddEvents = user?.permissions?.includes('leave.approve') || 
    user?.roles?.includes('PORTAL_ADMIN') || 
    user?.roles?.includes('SUPER_ADMIN');
  
  const pendingCount = requests?.filter(r => r.status === 'PENDING_TEAM_LEAD' || r.status === 'PENDING_HR').length || 0;
  
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Leave Management"
          title="Leaves"
          description="Apply for leave, view your balances, and track request status"
          actions={
            <>
              {pendingCount > 0 && (
                <Badge variant="warning" className="mr-2">
                  {pendingCount} Pending
                </Badge>
              )}
              <Button onClick={() => setApplyOpen(true)}>
                <Plus className="mr-2 size-4" />
                Apply Leave
              </Button>
            </>
          }
        />
        
        {/* Leave Balances */}
        {balances && balances.length > 0 && (
          <LeaveBalanceCards balances={balances} />
        )}
        
        {/* Main Tabs */}
        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">My Requests</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="requests" className="mt-4">
            <SectionCard title="Leave Requests" description="Your leave application history">
              <div className="space-y-4">
                {requests?.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center">
                    <Send className="mx-auto mb-3 size-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No leave requests yet</p>
                    <Button variant="link" onClick={() => setApplyOpen(true)} className="mt-2">
                      Apply for leave
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {requests?.map((request) => (
                      <div key={request.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{request.leaveType.name}</span>
                            <Badge 
                              variant={
                                request.status === 'APPROVED' ? 'success' :
                                request.status === 'REJECTED' ? 'destructive' :
                                'warning'
                              }
                            >
                              {request.status === 'PENDING_TEAM_LEAD' ? 'Pending Team Lead' :
                               request.status === 'PENDING_HR' ? 'Pending HR' :
                               request.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {format(parseISO(request.startDate), 'MMM d')} - {format(parseISO(request.endDate), 'MMM d, yyyy')} ({request.days} day{request.days !== 1 ? 's' : ''})
                          </p>
                          {request.reason && (
                            <p className="mt-1 text-sm">{request.reason}</p>
                          )}
                          {request.approvals.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {request.approvals.map(approval => (
                                <div key={approval.level}>
                                  Level {approval.level}: {approval.decision}
                                  {approval.approver && ` by ${approval.approver.firstName} ${approval.approver.lastName}`}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </TabsContent>
          
          <TabsContent value="calendar" className="mt-4">
            <LeaveCalendar 
              events={calendarEvents || []} 
              onAddEvent={() => setEventOpen(true)}
              canAddEvents={canAddEvents}
            />
          </TabsContent>
        </Tabs>
        
        {/* Apply Leave Dialog */}
        <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
              <DialogDescription>
                Submit a leave request for approval by your reporting manager.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Leave Type *</Label>
                <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypes?.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} ({type.annualQuota} days/year)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date *</Label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
                <div>
                  <Label>End Date *</Label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-border bg-background px-3 py-2"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea
                  placeholder="Optional: Provide additional context for your leave"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => applyMutation.mutate()}
                disabled={!selectedLeaveType || !startDate || !endDate || applyMutation.isPending}
              >
                {applyMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Add Calendar Event Dialog */}
        <Dialog open={eventOpen} onOpenChange={setEventOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Calendar Event</DialogTitle>
              <DialogDescription>
                Add a holiday or festival to the leave calendar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <input
                  type="text"
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="e.g., Diwali, New Year, Company Holiday"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                />
              </div>
              <div>
                <Label>Date *</Label>
                <input
                  type="date"
                  className="w-full rounded-md border border-border bg-background px-3 py-2"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOLIDAY">Holiday</SelectItem>
                    <SelectItem value="FESTIVAL">Festival</SelectItem>
                    <SelectItem value="OPTIONAL">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Additional information about this event"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEventOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => addEventMutation.mutate()}
                disabled={!eventTitle || !eventDate || addEventMutation.isPending}
              >
                {addEventMutation.isPending ? 'Adding...' : 'Add Event'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}