import { CheckCircle2, FileUp, ShieldCheck, UserRound, WalletCards } from 'lucide-react';
import { PageTransition } from '@/components/animations/PageTransition';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function OnboardingPage() {
  const steps = [
    { label: 'Personal Info', icon: UserRound },
    { label: 'Document Upload', icon: FileUp },
    { label: 'Salary Details', icon: WalletCards },
    { label: 'Review', icon: CheckCircle2 },
    { label: 'Approval', icon: ShieldCheck }
  ];

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader eyebrow="Stepper workflow" title="Onboarding" description="Move candidates and employees through document collection, salary details, HR approval, admin approval, and credential generation." />
        <SectionCard title="Workflow steps" description="Stepper architecture is ready for backend-driven current-step state.">
          <div className="grid gap-3 md:grid-cols-5">
            {steps.map((step, index) => (
              <div key={step.label} className="rounded-xl border border-border bg-white/[0.035] p-4">
                <step.icon className="mb-4 size-5 text-cyan-200" />
                <Badge variant="muted">Step {index + 1}</Badge>
                <p className="mt-3 text-sm font-medium">{step.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>
        <OperationalModulePage<GenericRecord>
          config={{
            resource: 'onboarding',
            endpoint: endpoints.onboarding,
            eyebrow: 'Onboarding',
            title: 'Onboarding workflows',
            description: 'Track onboarding candidates, document uploads, approvals, and credential generation.',
            createLabel: 'Start onboarding',
            columns: genericColumns,
            emptyTitle: 'No onboarding workflows',
            emptyDescription: 'Onboarding workflow records will appear after onboarding is initiated.'
          }}
        />
      </div>
    </PageTransition>
  );
}
