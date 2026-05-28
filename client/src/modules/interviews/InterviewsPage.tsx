import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function InterviewsPage() {
  return (
    <OperationalModulePage<GenericRecord>
      config={{
        resource: 'interviews',
        endpoint: endpoints.recruitment.interviews,
        eyebrow: 'Interview management',
        title: 'Interview scheduling',
        description: 'Schedule interviews, assign interviewers, collect feedback, ratings, remarks, and candidate outcomes.',
        createLabel: 'Schedule interview',
        columns: genericColumns,
        emptyTitle: 'No interviews scheduled',
        emptyDescription: 'Interview slots and feedback records will appear when the interview API returns data.'
      }}
    />
  );
}
