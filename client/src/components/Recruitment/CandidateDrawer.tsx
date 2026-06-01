import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, Link as LinkIcon, CalendarDays } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { endpoints } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import type { CandidateDetail } from './types';

type CandidateDrawerProps = {
  candidateId: string | null;
  open: boolean;
  onClose: () => void;
  onScheduleInterview: (candidate: CandidateDetail) => void;
};

type CandidateActivityResponse = {
  activityLogs: Array<{ id: string; action: string; createdAt: string; entityType: string }>;
  auditLogs: Array<{ id: string; event: string; createdAt: string; entityType?: string | null }>;
};

export function CandidateDrawer({ candidateId, open, onClose, onScheduleInterview }: CandidateDrawerProps) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [tagInput, setTagInput] = useState('');

  const detailQuery = useQuery({
    queryKey: ['recruitment', 'candidate-detail', candidateId],
    enabled: Boolean(open && candidateId),
    queryFn: async () => {
      const response = await api.get<ApiResponse<CandidateDetail>>(endpoints.recruitment.candidateDetail(candidateId as string));
      return response.data.data;
    },
  });

  const activityQuery = useQuery({
    queryKey: ['recruitment', 'candidate-activity', candidateId],
    enabled: Boolean(open && candidateId),
    queryFn: async () => {
      const response = await api.get<ApiResponse<CandidateActivityResponse>>(endpoints.recruitment.candidateActivity(candidateId as string));
      return response.data.data;
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (body: string) => {
      if (!candidateId) throw new Error('Candidate is required');
      const response = await api.post<ApiResponse<unknown>>(endpoints.recruitment.candidateNotes(candidateId), { body });
      return response.data.data;
    },
    onSuccess: () => {
      setNewNote('');
      void queryClient.invalidateQueries({ queryKey: ['recruitment', 'candidate-detail', candidateId] });
      void queryClient.invalidateQueries({ queryKey: ['recruitment', 'candidate-activity', candidateId] });
      toast.success('Note added');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to add note'),
  });

  const updateTagsMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      if (!candidateId) throw new Error('Candidate is required');
      const response = await api.patch<ApiResponse<unknown>>(`${endpoints.recruitment.candidates}/${candidateId}`, { tags });
      return response.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recruitment', 'candidate-detail', candidateId] });
      toast.success('Tags updated');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update tags'),
  });

  useEffect(() => {
    setNewNote('');
    setTagInput('');
  }, [candidateId]);

  const candidate = detailQuery.data;
  const tags = candidate?.tags ?? [];
  const editableTags = useMemo(() => tagInput ? tagInput.split(',').map((tag) => tag.trim()).filter(Boolean) : tags, [tagInput, tags]);

  return (
    <AnimatePresence>
      {open && candidate ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col border-l border-border bg-slate-950 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <p className="text-lg font-semibold text-foreground">{candidate.firstName} {candidate.lastName}</p>
                <p className="text-sm text-muted-foreground">{candidate.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {candidate.applications.map((application) => (
                    <Badge key={application.id} variant="outline">{application.job.title} · {application.stage}</Badge>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close candidate drawer">
                <X className="size-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <Tabs defaultValue="profile" className="space-y-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="resume">Resume</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                  <TabsTrigger value="interviews">Interview History</TabsTrigger>
                  <TabsTrigger value="tags">Tags</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoCard label="Phone" value={candidate.phone ?? 'Not provided'} />
                    <InfoCard label="Tags" value={tags.length ? tags.join(', ') : 'No tags'} />
                    <InfoCard label="Applications" value={String(candidate.applications.length)} />
                    <InfoCard label="Resume" value={candidate.resumeUrl ? 'Uploaded' : 'Missing'} />
                  </div>
                </TabsContent>

                <TabsContent value="resume" className="space-y-4">
                  {candidate.resumeUrl ? (
                    <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-border bg-white/[0.03] p-4 text-sm text-cyan-200">
                      <LinkIcon className="size-4" />
                      Open resume
                    </a>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      No resume URL on file.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="space-y-4">
                  <Textarea value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Add a note about this candidate" rows={4} />
                  <div className="flex justify-end">
                    <Button onClick={() => addNoteMutation.mutate(newNote)} disabled={!newNote.trim() || addNoteMutation.isPending}>
                      <Send className="mr-2 size-4" />
                      Save note
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {candidate.notes.length > 0 ? candidate.notes.map((note) => (
                      <div key={note.id} className="rounded-2xl border border-border bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{note.author ? `${note.author.firstName} ${note.author.lastName}` : 'System'}</span>
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{note.body}</p>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No notes yet.</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="interviews" className="space-y-3">
                  {candidate.applications.flatMap((application) => application.interviews.map((interview) => (
                    <div key={interview.id} className="rounded-2xl border border-border bg-white/[0.03] p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{application.job.title}</span>
                        <Badge variant="outline">{interview.status}</Badge>
                      </div>
                      <p className="mt-2 text-muted-foreground">{new Date(interview.scheduledAt).toLocaleString()}</p>
                      <p className="text-muted-foreground">Interviewer: {interview.interviewer ? `${interview.interviewer.firstName} ${interview.interviewer.lastName}` : 'TBD'}</p>
                    </div>
                  )))
                  }
                  {candidate.applications.every((application) => application.interviews.length === 0) ? (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No interview history.</div>
                  ) : null}
                  {activityQuery.data?.activityLogs?.length ? (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Activity log</p>
                      {activityQuery.data.activityLogs.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="rounded-2xl border border-border bg-white/[0.03] p-3 text-xs text-muted-foreground">
                          <p className="text-foreground">{activity.action}</p>
                          <p>{new Date(activity.createdAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="tags" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Tags</label>
                    <Textarea
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      placeholder="comma,separated,tags"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Current: {tags.length ? tags.join(', ') : 'none'}</p>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => updateTagsMutation.mutate(editableTags)} disabled={updateTagsMutation.isPending}>
                      Save tags
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex items-center justify-between border-t border-border p-4">
              <p className="text-xs text-muted-foreground">Resume, notes, and tags are editable from this drawer.</p>
              <Button onClick={() => onScheduleInterview(candidate)}>
                <CalendarDays className="mr-2 size-4" />
                Schedule interview
              </Button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-2 text-sm text-foreground', value === 'Missing' ? 'text-amber-300' : '')}>{value}</p>
    </div>
  );
}
