// src/modules/leaves/LeaveApprovalsPage.tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { PageTransition } from '@/components/animations/PageTransition';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { httpClient } from '@/services/api/http-client';
import type { ApiResponse } from '@/types/api';

type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  leaveType: {
    name: string;
    code: string;
  };
  employee: {
    employeeId: string;
    firstName: string;
    lastName: string;
    department: string;
    designation: string;
  };
  approvals: Array<{
    approver: { firstName: string; lastName: string; designation: string };
    decision: string;
    level: number;
    remarks?: string;
    decidedAt?: string;
  }>;
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

export function LeaveApprovalsPage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [remarks, setRemarks] = useState('');
  const [decisionType, setDecisionType] = useState<'approve' | 'reject'>('approve');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  // Query for pending leave approvals
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['pending-leave-approvals', pendingPage],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<PaginatedResponse<LeaveRequest>>>(`/leaves/pending-approvals?page=${pendingPage}&limit=10`);
      return res.data.data;
    }
  });

  // Query for approved/rejected leave history
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['leave-approvals-history', historyPage],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<PaginatedResponse<LeaveRequest>>>(`/leaves?status=APPROVED,REJECTED,CANCELLED&page=${historyPage}&limit=10`);
      return res.data.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, decision, remarks }: { id: string; decision: string; remarks?: string }) => {
      const res = await httpClient.patch(`/leaves/${id}`, { decision, remarks });
      return res.data;
    },
    onSuccess: () => {
      toast.success(`Leave request ${decisionType === 'approve' ? 'approved' : 'rejected'}`);
      setDialogOpen(false);
      setRemarks('');
      setSelectedRequest(null);
      refetchPending();
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to process request')
  });

  const handleApprove = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setDecisionType('approve');
    setRemarks('');
    setDialogOpen(true);
  };

  const handleReject = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setDecisionType('reject');
    setRemarks('');
    setDialogOpen(true);
  };

  const confirmAction = () => {
    if (selectedRequest) {
      approveMutation.mutate({
        id: selectedRequest.id,
        decision: decisionType === 'approve' ? 'APPROVED' : 'REJECTED',
        remarks: remarks || undefined
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="muted">Cancelled</Badge>;
      case 'PENDING_TEAM_LEAD':
        return <Badge variant="warning">Pending Team Lead</Badge>;
      case 'PENDING_HR':
        return <Badge variant="warning">Pending HR</Badge>;
      default:
        return <Badge variant="muted">{status}</Badge>;
    }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Approvals"
          title="Leave Approvals"
          description="Review and manage leave requests from your team"
          actions={
            <Button variant="outline" size="sm" onClick={() => { refetchPending(); refetchHistory(); }}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
          }
        />

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Approvals
              {pendingData?.meta && pendingData.meta.total > 0 && (
                <Badge variant="warning" className="ml-2">
                  {pendingData.meta.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Approval History</TabsTrigger>
          </TabsList>

          {/* Pending Approvals Tab */}
          <TabsContent value="pending">
            <SectionCard
              title="Pending Leave Requests"
              description={`${pendingData?.meta?.total || 0} request(s) awaiting your approval`}
            >
              {pendingLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 animate-pulse rounded-lg bg-white/[0.04]" />
                  ))}
                </div>
              ) : pendingData?.items?.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <CheckCircle className="mx-auto mb-3 size-8 text-muted-foreground" />
                  <p className="text-muted-foreground">No pending leave requests</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {pendingData?.items.map((request) => (
                    <div key={request.id} className="flex flex-wrap items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {request.employee.firstName} {request.employee.lastName}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({request.employee.employeeId})
                          </span>
                          <Badge variant="outline">{request.employee.department}</Badge>
                          <Badge variant="secondary">{request.leaveType.name}</Badge>
                          {getStatusBadge(request.status)}
                        </div>
                        <p className="mt-1 text-sm">
                          {format(parseISO(request.startDate), 'MMM d')} - {format(parseISO(request.endDate), 'MMM d, yyyy')} ({request.days} day{request.days !== 1 ? 's' : ''})
                        </p>
                        {request.reason && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            Reason: {request.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="success" onClick={() => handleApprove(request)}>
                          <CheckCircle className="mr-1 size-4" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(request)}>
                          <XCircle className="mr-1 size-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Pagination for Pending */}
              {pendingData?.meta && pendingData.meta.totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage === 1}>
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {pendingPage} of {pendingData.meta.totalPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.min(pendingData.meta.totalPages, p + 1))} disabled={pendingPage === pendingData.meta.totalPages}>
                    Next
                  </Button>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <SectionCard
              title="Approval History"
              description={`${historyData?.meta?.total || 0} processed request(s)`}
            >
              {historyLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 animate-pulse rounded-lg bg-white/[0.04]" />
                  ))}
                </div>
              ) : historyData?.items?.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="text-muted-foreground">No approval history found</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {historyData?.items.map((request) => (
                    <div key={request.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {request.employee.firstName} {request.employee.lastName}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({request.employee.employeeId})
                            </span>
                            <Badge variant="outline">{request.employee.department}</Badge>
                            <Badge variant="secondary">{request.leaveType.name}</Badge>
                            {getStatusBadge(request.status)}
                          </div>
                          <p className="mt-1 text-sm">
                            {format(parseISO(request.startDate), 'MMM d')} - {format(parseISO(request.endDate), 'MMM d, yyyy')} ({request.days} days)
                          </p>
                          {request.reason && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              Reason: {request.reason}
                            </p>
                          )}
                          {/* Show approval decision details */}
                          {request.approvals && request.approvals.map((approval, idx) => (
                            approval.decision !== 'PENDING' && (
                              <div key={idx} className="mt-2 rounded-md bg-white/[0.03] p-2 text-sm">
                                <div className="flex items-center justify-between">
                                  <span>
                                    Reviewed by: {approval.approver.firstName} {approval.approver.lastName}
                                  </span>
                                  <Badge variant={approval.decision === 'APPROVED' ? 'success' : 'danger'}>
                                    {approval.decision}
                                  </Badge>
                                </div>
                                {approval.remarks && (
                                  <p className="mt-1 text-muted-foreground">
                                    Remarks: {approval.remarks}
                                  </p>
                                )}
                                {approval.decidedAt && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {format(parseISO(approval.decidedAt), 'PPP p')}
                                  </p>
                                )}
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Pagination for History */}
              {historyData?.meta && historyData.meta.totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-4 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage === 1}>
                    Previous
                  </Button>
                  <span className="flex items-center px-3 text-sm">
                    Page {historyPage} of {historyData.meta.totalPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setHistoryPage(p => Math.min(historyData.meta.totalPages, p + 1))} disabled={historyPage === historyData.meta.totalPages}>
                    Next
                  </Button>
                </div>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionType === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </DialogTitle>
            <DialogDescription>
              {decisionType === 'approve' 
                ? 'Confirm approval of this leave request.' 
                : 'Confirm rejection of this leave request.'}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="rounded-lg bg-white/[0.04] p-4 space-y-2">
              <p><strong>{selectedRequest.employee.firstName} {selectedRequest.employee.lastName}</strong></p>
              <p className="text-sm">{selectedRequest.leaveType.name} · {selectedRequest.days} day(s)</p>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(selectedRequest.startDate), 'PPP')} - {format(parseISO(selectedRequest.endDate), 'PPP')}
              </p>
              {selectedRequest.reason && (
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Reason:</strong> {selectedRequest.reason}
                </p>
              )}
            </div>
          )}
          <div className="grid gap-2">
            <Label>Remarks (Optional)</Label>
            <Textarea
              placeholder={decisionType === 'reject' ? "Please provide a reason for rejection..." : "Optional comments..."}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={decisionType === 'approve' ? 'default' : 'destructive'}
              onClick={confirmAction}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Processing...' : (decisionType === 'approve' ? 'Approve' : 'Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}