import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTransition } from '@/components/animations/PageTransition';
import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function RecruitmentPage() {
  return (
    <PageTransition>
      <Tabs defaultValue="jobs" className="space-y-5">
        <TabsList>
          <TabsTrigger value="jobs">Job postings</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>
        <TabsContent value="jobs">
          <OperationalModulePage<GenericRecord>
            config={{
              resource: 'jobs',
              endpoint: endpoints.recruitment.jobs,
              eyebrow: 'ATS',
              title: 'Job postings',
              description: 'Create, edit, publish, unpublish, and monitor SEO-friendly public job postings.',
              createLabel: 'Create job',
              columns: genericColumns,
              emptyTitle: 'No job postings',
              emptyDescription: 'Published and draft job postings will appear after the recruitment jobs API returns data.'
            }}
          />
        </TabsContent>
        <TabsContent value="candidates">
          <OperationalModulePage<GenericRecord>
            config={{
              resource: 'candidates',
              endpoint: endpoints.recruitment.candidates,
              eyebrow: 'ATS',
              title: 'Candidate directory',
              description: 'Review candidate profiles, resumes, links, experience, and skills across applications.',
              createLabel: 'Add candidate',
              columns: genericColumns,
              emptyTitle: 'No candidates',
              emptyDescription: 'Candidate profiles will appear after applications are submitted through the public careers flow.'
            }}
          />
        </TabsContent>
        <TabsContent value="applications">
          <OperationalModulePage<GenericRecord>
            config={{
              resource: 'applications',
              endpoint: endpoints.recruitment.applications,
              eyebrow: 'ATS',
              title: 'Applications',
              description: 'Track application stages, resumes, candidate movement, and hiring outcomes.',
              createLabel: 'Add application',
              columns: genericColumns,
              emptyTitle: 'No applications',
              emptyDescription: 'Applications will appear after candidates apply to published jobs.'
            }}
          />
        </TabsContent>
        <TabsContent value="pipeline">
          <PipelineBoard />
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}

function PipelineBoard() {
  const stages = ['Applied', 'Screening', 'Interview Scheduled', 'Technical Round', 'HR Round', 'Selected', 'Offer Sent', 'Joined'];

  return (
    <div className="grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
      {stages.map((stage) => (
        <div key={stage} className="glass-panel min-h-72 rounded-xl p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{stage}</h3>
            <span className="rounded-md bg-white/7 px-2 py-1 text-xs text-muted-foreground">0</span>
          </div>
          <div className="grid h-44 place-items-center rounded-xl border border-dashed border-border bg-white/[0.025] text-center text-sm text-muted-foreground">
            Pipeline cards will render from application stage data.
          </div>
        </div>
      ))}
    </div>
  );
}
