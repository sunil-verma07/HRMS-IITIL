import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BriefcaseBusiness, UserRoundSearch, Sparkles } from 'lucide-react';
import { PageTransition } from '@/components/animations/PageTransition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { api } from '@/lib/api';
import { endpoints } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import { JobDialog } from '@/modules/recruitment/JobDialog';
import { KanbanBoard } from '@/components/Recruitment/KanbanBoard';
import { CandidateDrawer } from '@/components/Recruitment/CandidateDrawer';
import { InterviewSchedulerModal } from '@/components/Interviews/InterviewSchedulerModal';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { jobColumns } from '@/modules/recruitment/recruitment-columns';
import type { CandidateDetail, RecruitmentJobListResponse } from '@/components/Recruitment/types';
import type { JobRecord } from '@/modules/recruitment/recruitment-columns';

export function RecruitmentPage() {
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobRecord | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobSearch, setJobSearch] = useState('');
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [candidateDetail, setCandidateDetail] = useState<CandidateDetail | null>(null);
  const [schedulerOpen, setSchedulerOpen] = useState(false);

  const jobsQuery = useQuery({
    queryKey: ['recruitment', 'jobs', 'selector', jobSearch],
    queryFn: async () => {
      const response = await api.get<ApiResponse<RecruitmentJobListResponse>>(endpoints.recruitment.jobs, {
        params: { scope: 'all', limit: 100, search: jobSearch || undefined },
      });
      return response.data.data.items;
    },
    staleTime: 60_000,
  });

  const jobs = jobsQuery.data ?? [];
  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null, [jobs, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId && jobs[0]) {
      setSelectedJobId(jobs[0].id);
      return;
    }

    if (selectedJobId && !jobs.some((job) => job.id === selectedJobId) && jobs[0]) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  const handleCreateJob = () => {
    setEditingJob(null);
    setJobDialogOpen(true);
  };

  const handleEditJob = (job: JobRecord) => {
    setEditingJob(job);
    setJobDialogOpen(true);
  };

  const handleJobDialogClose = () => {
    setJobDialogOpen(false);
    setEditingJob(null);
  };

  const handleCandidateOpen = async (openedCandidateId: string) => {
    setCandidateId(openedCandidateId);
    const response = await api.get<ApiResponse<CandidateDetail>>(endpoints.recruitment.candidateDetail(openedCandidateId));
    setCandidateDetail(response.data.data);
  };

  return (
    <PageTransition>
      <div className="space-y-6 p-5 lg:p-6">
        <PageHeader
          eyebrow="ATS workflow"
          title="Recruitment"
          description="Manage job postings, candidate pipelines, and candidate actions from one place."
        />

        <Tabs defaultValue="pipeline" className="space-y-5">
          <TabsList className="grid w-full max-w-2xl grid-cols-2">
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="space-y-5">
            <SectionCard
              title="Recruitment pipeline"
              description="Drag candidates across stages, open the side drawer, and schedule interviews from published jobs."
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
                <div className="min-w-0 space-y-4 rounded-3xl border border-border bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[280px] flex-1 space-y-2">
                      <Label htmlFor="job-search">Search jobs</Label>
                      <Input
                        id="job-search"
                        value={jobSearch}
                        onChange={(event) => setJobSearch(event.target.value)}
                        placeholder="Search by title, department, or location"
                      />
                    </div>
                    <div className="min-w-[260px] flex-1 space-y-2">
                      <Label>Select job</Label>
                      <Select value={selectedJobId ?? ''} onValueChange={setSelectedJobId}>
                        <SelectTrigger>
                          <SelectValue placeholder={jobsQuery.isLoading ? 'Loading jobs…' : 'Choose a job'} />
                        </SelectTrigger>
                        <SelectContent>
                          {jobs.map((job) => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.title} · {job.department}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" onClick={handleCreateJob} className="shrink-0">
                      <BriefcaseBusiness className="mr-2 size-4" />
                      New job
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{selectedJob?.status ?? 'No job selected'}</Badge>
                    <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5" /> Optimistic stage updates enabled</span>
                    {selectedJob ? (
                      <span className="inline-flex items-center gap-1.5"><UserRoundSearch className="size-3.5" /> {selectedJob.department}</span>
                    ) : null}
                  </div>

                  <div className="min-w-0 max-w-full overflow-hidden">
                    <KanbanBoard jobId={selectedJob?.id ?? null} onCandidateOpen={(openedCandidateId) => void handleCandidateOpen(openedCandidateId)} />
                  </div>
                </div>

                <div className="min-w-0 space-y-4 rounded-3xl border border-border bg-white/[0.03] p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Candidate actions</p>
                    <p className="mt-1 text-sm text-muted-foreground">Open the drawer to update notes, tags, and interview history.</p>
                  </div>
                  <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                    {candidateDetail ? (
                      <>
                        <p className="font-medium text-foreground">{candidateDetail.firstName} {candidateDetail.lastName}</p>
                        <p className="mt-1">{candidateDetail.email}</p>
                        <p className="mt-4">The drawer stays connected to the selected candidate while you move through the pipeline.</p>
                      </>
                    ) : (
                      <p>Select a candidate card to open their profile, notes, tags, and interview controls.</p>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="jobs">
            <OperationalModulePage<JobRecord>
              config={{
                resource: 'jobs',
                endpoint: endpoints.recruitment.jobs,
                eyebrow: 'ATS',
                title: 'Job postings',
                description: 'Create, edit, publish, and monitor job postings.',
                createLabel: 'Create job',
                columns: jobColumns(handleEditJob, () => undefined),
                emptyTitle: 'No job postings',
                emptyDescription: 'Create your first job posting using the create button.',
                onCreate: handleCreateJob,
              }}
            />
          </TabsContent>
        </Tabs>

        <JobDialog open={jobDialogOpen} onClose={handleJobDialogClose} job={editingJob} />
        <CandidateDrawer
          candidateId={candidateId}
          open={Boolean(candidateId)}
          onClose={() => setCandidateId(null)}
          onScheduleInterview={(candidate) => {
            setCandidateDetail(candidate);
            setSchedulerOpen(true);
          }}
        />
        <InterviewSchedulerModal
          open={schedulerOpen}
          onOpenChange={setSchedulerOpen}
          initialCandidate={candidateDetail}
          initialJobId={selectedJob?.id ?? null}
        />
      </div>
    </PageTransition>
  );
}
