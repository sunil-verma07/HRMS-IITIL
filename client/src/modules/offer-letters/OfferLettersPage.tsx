import { Eye, FileDown, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/animations/PageTransition';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function OfferLettersPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Document generation"
          title="Offer letters"
          description="Generate offer letters from HTML templates, map variables, preview output, and download PDFs when the backend generator is available."
          actions={
            <>
              <Button variant="outline" onClick={() => toast.info('Offer preview opens when a generated offer is selected')}><Eye className="size-4" /> Preview</Button>
              <Button onClick={() => toast.info('Offer generation endpoint is not enabled yet')}><WandSparkles className="size-4" /> Generate offer</Button>
            </>
          }
        />
        <SectionCard title="Variable mapping" description="Template placeholders are designed for backend-driven variable substitution.">
          <div className="grid gap-3 md:grid-cols-4">
            {['employee_name', 'designation', 'salary', 'joining_date'].map((variable) => (
              <div key={variable} className="rounded-xl border border-border bg-white/[0.035] p-4 font-mono text-sm text-cyan-200">
                {'{{'}{variable}{'}}'}
              </div>
            ))}
          </div>
        </SectionCard>
        <OperationalModulePage<GenericRecord>
          config={{
            resource: 'offer-letters',
            endpoint: endpoints.offerLetters,
            eyebrow: 'Offer letters',
            title: 'Generated offers',
            description: 'Review generated offer letters, source templates, candidate links, and downloadable assets.',
            createLabel: 'New offer',
            columns: genericColumns,
            emptyTitle: 'No offer letters',
            emptyDescription: 'Generated offers will appear after the offer-letter API returns data.'
          }}
        />
        <Button variant="outline" onClick={() => toast.info('Select a generated offer before downloading PDF')}><FileDown className="size-4" /> Download selected PDF</Button>
      </div>
    </PageTransition>
  );
}
