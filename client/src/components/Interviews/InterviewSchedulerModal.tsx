import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { useCandidates, useCandidateApplications, useCreateInterview, useInterviewers, useJobs } from '@/modules/interviews/useInterviews';
import type { CandidateDetail } from '@/components/Recruitment/types';

export type InterviewSchedulerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCandidate?: CandidateDetail | null;
  initialJobId?: string | null;
};

const durations = [30, 45, 60, 90] as const;
const interviewTypes = ['VIDEO', 'IN_PERSON', 'PHONE'] as const;

type FormState = {
  candidateId: string;
  applicationId: string;
  jobId: string;
  date: string;
  time: string;
  durationMins: number;
  type: typeof interviewTypes[number];
  interviewerIds: string[];
  notes: string;
  sendReminder: boolean;
};

const initialState = (): FormState => ({
  candidateId: '',
  applicationId: '',
  jobId: '',
  date: '',
  time: '',
  durationMins: 60,
  type: 'VIDEO',
  interviewerIds: [],
  notes: '',
  sendReminder: true,
});

function isFutureDate(date: string, time: string): boolean {
  if (!date || !time) return false;
  const value = new Date(`${date}T${time}`);
  return value.getTime() > Date.now();
}

export function InterviewSchedulerModal({ open, onOpenChange, initialCandidate, initialJobId }: InterviewSchedulerModalProps) {
  const createMutation = useCreateInterview();
  const [form, setForm] = useState<FormState>(initialState());
  const [candidateSearch, setCandidateSearch] = useState('');
  const [interviewerSearch, setInterviewerSearch] = useState('');
  const debouncedCandidateSearch = useDebounce(candidateSearch, 250);
  const debouncedInterviewerSearch = useDebounce(interviewerSearch, 250);

  const candidateQuery = useCandidates(debouncedCandidateSearch);
  const interviewerQuery = useInterviewers(debouncedInterviewerSearch);
  const jobsQuery = useJobs();

  const candidateOptions = candidateQuery.data ?? [];
  const interviewerOptions = interviewerQuery.data ?? [];
  const jobOptions = jobsQuery.data ?? [];
  const applicationQuery = useCandidateApplications(form.candidateId || null);
  const applicationOptions = applicationQuery.data ?? [];

  const selectedCandidate = useMemo(
    () => candidateOptions.find((candidate) => candidate.id === form.candidateId) ?? initialCandidate ?? null,
    [candidateOptions, form.candidateId, initialCandidate],
  );

  useEffect(() => {
    if (!open) {
      setForm(initialState());
      setCandidateSearch('');
      setInterviewerSearch('');
      return;
    }

    setForm((current) => ({
      ...current,
      candidateId: initialCandidate?.id ?? current.candidateId,
      jobId: initialJobId ?? current.jobId,
    }));
  }, [open, initialCandidate?.id, initialJobId]);

  useEffect(() => {
    if (!initialCandidate) return;
    setForm((current) => ({
      ...current,
      candidateId: initialCandidate.id,
      jobId: initialJobId ?? current.jobId,
      applicationId: initialCandidate.applications[0]?.id ?? current.applicationId,
    }));
  }, [initialCandidate, initialJobId]);

  useEffect(() => {
    if (!applicationOptions.length) return;
    setForm((current) => ({
      ...current,
      applicationId: applicationOptions.find((application) => application.job.id === current.jobId)?.id ?? applicationOptions[0]?.id ?? current.applicationId,
    }));
  }, [applicationOptions]);

  const submit = async () => {
    const scheduledAt = isFutureDate(form.date, form.time) ? new Date(`${form.date}T${form.time}`).toISOString() : '';
    const interviewerId = form.interviewerIds[0];

    if (!form.candidateId || !form.applicationId || !form.jobId || !interviewerId || !form.date || !form.time) {
      toast.error('Fill all required fields');
      return;
    }

    if (!scheduledAt) {
      toast.error('Interview date must be in the future');
      return;
    }

    await createMutation.mutateAsync({
      applicationId: form.applicationId,
      interviewerId,
      scheduledAt,
      durationMins: form.durationMins,
      mode: form.type,
      notes: form.notes || undefined,
    });

    onOpenChange(false);
    setForm(initialState());
  };

  const toggleInterviewer = (id: string) => {
    setForm((current) => ({
      ...current,
      interviewerIds: current.interviewerIds.includes(id)
        ? current.interviewerIds.filter((value) => value !== id)
        : [...current.interviewerIds, id],
    }));
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={(event) => event.target === event.currentTarget && onOpenChange(false)}>
          <motion.div initial={{ y: 20, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-4xl rounded-3xl border border-border bg-slate-950 shadow-2xl">
            <div className="flex items-start justify-between border-b border-border p-6">
              <div>
                <p className="text-lg font-semibold text-foreground">Schedule interview</p>
                <p className="text-sm text-muted-foreground">Published jobs only, with interviewer selection and reminder scheduling.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="size-5" />
              </Button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Candidate</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search candidate by name or email" className="pl-9" />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 rounded-2xl border border-border bg-white/[0.03] p-3">
                    {candidateOptions.map((candidate) => (
                      <button key={candidate.id} type="button" onClick={() => setForm((current) => ({ ...current, candidateId: candidate.id, applicationId: '', jobId: initialJobId ?? current.jobId }))} className={cn('w-full rounded-xl border px-3 py-2 text-left text-sm transition', form.candidateId === candidate.id ? 'border-cyan-400/40 bg-cyan-400/[0.08]' : 'border-border bg-transparent hover:bg-white/[0.04]')}>
                        <p className="font-medium text-foreground">{candidate.firstName} {candidate.lastName}</p>
                        <p className="text-xs text-muted-foreground">{candidate.email}</p>
                      </button>
                    ))}
                    {candidateOptions.length === 0 ? <p className="text-sm text-muted-foreground">No candidates found.</p> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Job</Label>
                  <Select value={form.jobId} onValueChange={(value) => setForm((current) => ({ ...current, jobId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select a published job" /></SelectTrigger>
                    <SelectContent>
                      {jobOptions.map((job) => (
                        <SelectItem key={job.id} value={job.id}>{job.title} · {job.department}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Application</Label>
                  <Select value={form.applicationId} onValueChange={(value) => setForm((current) => ({ ...current, applicationId: value }))}>
                    <SelectTrigger><SelectValue placeholder={applicationQuery.isLoading ? 'Loading applications…' : 'Select application'} /></SelectTrigger>
                    <SelectContent>
                      {applicationOptions.map((application) => (
                        <SelectItem key={application.id} value={application.id}>{application.job.title} · {application.stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input type="time" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Duration</Label>
                  <div className="flex flex-wrap gap-2">
                    {durations.map((duration) => (
                      <button key={duration} type="button" onClick={() => setForm((current) => ({ ...current, durationMins: duration }))} className={cn('rounded-full border px-3 py-1.5 text-sm transition', form.durationMins === duration ? 'border-cyan-400/40 bg-cyan-400/[0.08] text-cyan-200' : 'border-border text-muted-foreground')}>
                        {duration} min
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Interview type</Label>
                  <div className="flex flex-wrap gap-2">
                    {interviewTypes.map((type) => (
                      <button key={type} type="button" onClick={() => setForm((current) => ({ ...current, type }))} className={cn('rounded-full border px-3 py-1.5 text-sm transition', form.type === type ? 'border-violet-400/40 bg-violet-400/[0.08] text-violet-200' : 'border-border text-muted-foreground')}>
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Interviewers</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={interviewerSearch} onChange={(event) => setInterviewerSearch(event.target.value)} placeholder="Search interviewers" className="pl-9" />
                  </div>
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-border bg-white/[0.03] p-3">
                    {interviewerOptions.map((interviewer) => (
                      <label key={interviewer.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm hover:bg-white/[0.04]">
                        <Checkbox checked={form.interviewerIds.includes(interviewer.id)} onCheckedChange={() => toggleInterviewer(interviewer.id)} />
                        <div>
                          <p className="font-medium text-foreground">{interviewer.firstName} {interviewer.lastName}</p>
                          <p className="text-xs text-muted-foreground">{interviewer.designation}</p>
                        </div>
                      </label>
                    ))}
                    {interviewerOptions.length === 0 ? <p className="text-sm text-muted-foreground">No interviewers found.</p> : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea rows={5} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Internal interview notes" />
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-border bg-white/[0.03] p-4 text-sm text-foreground">
                  <Checkbox checked={form.sendReminder} onCheckedChange={(checked) => setForm((current) => ({ ...current, sendReminder: Boolean(checked) }))} />
                  Send reminder notification 15 minutes before
                </label>

                <div className="rounded-2xl border border-border bg-white/[0.03] p-4 text-sm text-muted-foreground">
                  {form.candidateId ? <p>Candidate selected: <span className="text-foreground">{selectedCandidate ? `${selectedCandidate.firstName} ${selectedCandidate.lastName}` : form.candidateId}</span></p> : <p>Select a candidate to continue.</p>}
                  <p className="mt-2">Job: <span className="text-foreground">{jobOptions.find((job) => job.id === form.jobId)?.title ?? 'None selected'}</span></p>
                  <p className="mt-2">Interviewers: <span className="text-foreground">{form.interviewerIds.length}</span></p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border p-6">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => void submit()} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                Schedule interview
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
