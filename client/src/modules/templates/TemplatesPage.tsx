import { Code2, Image, LayoutTemplate } from 'lucide-react';
import { PageTransition } from '@/components/animations/PageTransition';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { endpoints } from '@/services/api/endpoints';
import { OperationalModulePage } from '@/modules/shared/OperationalModulePage';
import { genericColumns, type GenericRecord } from '@/modules/shared/module-columns';

export function TemplatesPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader eyebrow="Template studio" title="Template management" description="Manage HTML and CSS templates for offer letters, notification bodies, and future drag/drop editor workflows." />
        <div className="grid gap-5 xl:grid-cols-2">
          <SectionCard title="HTML editor" description="Editor surface for backend persisted template HTML.">
            <Textarea className="min-h-72 font-mono" placeholder="<section>{{employee_name}}</section>" />
          </SectionCard>
          <SectionCard title="Preview metadata" description="Template preview images and CSS are stored as separate fields.">
            <div className="grid gap-3 md:grid-cols-3">
              {[LayoutTemplate, Code2, Image].map((Icon, index) => (
                <div key={index} className="grid min-h-32 place-items-center rounded-xl border border-dashed border-border bg-white/[0.025] text-muted-foreground">
                  <Icon className="size-7" />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
        <OperationalModulePage<GenericRecord>
          config={{
            resource: 'templates',
            endpoint: endpoints.templates,
            eyebrow: 'Templates',
            title: 'Template library',
            description: 'Store template name, HTML content, CSS content, and preview image metadata.',
            createLabel: 'Create template',
            columns: genericColumns,
            emptyTitle: 'No templates',
            emptyDescription: 'Templates will appear after template records are created.'
          }}
        />
      </div>
    </PageTransition>
  );
}
