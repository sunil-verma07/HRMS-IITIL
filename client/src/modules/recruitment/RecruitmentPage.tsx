// src/pages/recruitment/RecruitmentPage.tsx
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/components/animations/PageTransition';
import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { httpClient } from '@/services/api/http-client';
import { JobDialog } from '@/modules/recruitment/JobDialog';
import { PipelineBoard } from '@/modules/recruitment/PipelineBoard';
import {
  jobColumns,
  candidateColumns,
  applicationColumns,
} from '@/modules/recruitment/recruitment-columns';
import type { JobRecord } from '@/modules/recruitment/recruitment-columns';

export function RecruitmentPage() {
  const queryClient = useQueryClient();
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobRecord | null>(null);

  // Job CRUD handlers
  const handleCreateJob = () => {
    setEditingJob(null);
    setJobDialogOpen(true);
  };

  const handleEditJob = (job: JobRecord) => {
    setEditingJob(job);
    setJobDialogOpen(true);
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm('Delete this job posting? This action cannot be undone.')) return;
    try {
      await httpClient.delete(`/jobs/${id}`);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete job. Please try again.');
    }
  };

  const handleJobDialogClose = () => {
    setJobDialogOpen(false);
    setEditingJob(null);
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  return (
    <PageTransition>
      <Tabs defaultValue="jobs" className="space-y-5">
        <TabsList>
          <TabsTrigger value="jobs">Job postings</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>

        {/* JOBS TAB */}
        <TabsContent value="jobs">
          <OperationalModulePage<JobRecord>
            config={{
              resource: 'jobs',
              endpoint: endpoints.recruitment.jobs,
              eyebrow: 'ATS',
              title: 'Job postings',
              description: 'Create, edit, publish, and monitor SEO‑friendly job postings.',
              createLabel: 'Create job',
              columns: jobColumns(handleEditJob, handleDeleteJob),
              emptyTitle: 'No job postings',
              emptyDescription: 'Create your first job posting using the "Create job" button.',
              onCreate: handleCreateJob,
            }}
          />
        </TabsContent>

        {/* CANDIDATES TAB */}
        <TabsContent value="candidates">
          <OperationalModulePage
            config={{
              resource: 'candidates',
              endpoint: endpoints.recruitment.candidates,
              eyebrow: 'ATS',
              title: 'Candidate directory',
              description: 'Review candidate profiles, resumes, skills, and experience.',
              createLabel: 'Add candidate',
              columns: candidateColumns,
              emptyTitle: 'No candidates',
              emptyDescription: 'Candidates will appear after you add them or when applications come in.',
              // TODO: implement candidate dialog and connect onCreate / edit / delete
            }}
          />
        </TabsContent>

        {/* APPLICATIONS TAB */}
        <TabsContent value="applications">
          <OperationalModulePage
            config={{
              resource: 'applications',
              endpoint: endpoints.recruitment.applications,
              eyebrow: 'ATS',
              title: 'Applications',
              description: 'Track application stages, resumes, and hiring outcomes.',
              createLabel: 'Add application',
              columns: applicationColumns,
              emptyTitle: 'No applications',
              emptyDescription: 'Applications will appear after candidates apply to jobs.',
              // TODO: implement application dialog and connect onCreate / stage update / delete
            }}
          />
        </TabsContent>

        {/* PIPELINE TAB */}
        <TabsContent value="pipeline">
          <PipelineBoard />
        </TabsContent>
      </Tabs>

      {/* Job Create/Edit Dialog */}
      <JobDialog
        open={jobDialogOpen}
        onClose={handleJobDialogClose}
        job={editingJob}
      />
    </PageTransition>
  );
}