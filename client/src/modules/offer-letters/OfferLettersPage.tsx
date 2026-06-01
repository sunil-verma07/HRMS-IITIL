import { ArrowLeft, Download, Eye, Loader2, RefreshCw, WandSparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageTransition } from '@/components/animations/PageTransition';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { endpoints } from '@/services/api/endpoints';
import { resourceApi } from '@/services/api/resource.api';
import { httpClient } from '@/services/api/http-client';
import type { ApiResponse } from '@/types/api';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/tables/DataTable';
import { useResourceQuery } from '@/hooks/use-resource-query';

type Template = {
  id: string;
  name: string;
  key: string;
  variables: string[];
  isDefault: boolean;
  htmlContent: string;
  cssContent?: string;
};

type OfferLetter = {
  id: string;
  templateId: string;
  template: { id: string; name: string; key: string };
  variables: Record<string, string>;
  generatedUrl: string;
  status: string;
  createdAt: string;
};

type GenerateResult = {
  id: string;
  generatedHtml: string;
  generatedUrl: string;
};

type Step = 'form' | 'preview';

function interpolate(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v ?? '');
  }
  return result;
}

function buildDoc(html: string, css: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:sans-serif}${css}</style></head><body>${html}</body></html>`;
}

async function downloadAsPdf(html: string, filename: string) {
  const html2pdf = (await import('html2pdf.js')).default;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.color = '#111827';

  const body = parsed.body.cloneNode(true) as HTMLElement;
  container.appendChild(body);

  for (const styleNode of Array.from(parsed.head.querySelectorAll('style'))) {
    const style = document.createElement('style');
    style.textContent = styleNode.textContent ?? '';
    container.appendChild(style);
  }

  document.body.appendChild(container);
  await html2pdf()
    .set({
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(container)
    .save();
  document.body.removeChild(container);
}

export function OfferLettersPage() {
  const queryClient = useQueryClient();

  // Generate modal state
  const [generateOpen, setGenerateOpen] = useState(false);
  const [step, setStep] = useState<Step>('form');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [mobileTab, setMobileTab] = useState<'variables' | 'preview'>('variables');

  // Offer letters list
  const listQuery = useResourceQuery<OfferLetter>('offer-letters', endpoints.offerLetters, { page: 1, limit: 5 });
  const offerLetters = listQuery.data?.items ?? [];

  // Templates for dropdown
  const { data: templatesData } = useQuery({
    queryKey: ['templates-list'],
    queryFn: () => resourceApi.list<Template>(endpoints.templates, { page: 1, limit: 50 }),
    enabled: generateOpen,
  });
  const templates = templatesData?.items ?? [];
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // When template changes, reset values to its detected variables
  useEffect(() => {
    if (!selectedTemplate) return;
    setValues((prev) => {
      const next: Record<string, string> = {};
      for (const v of selectedTemplate.variables) next[v] = prev[v] ?? '';
      return next;
    });
  }, [selectedTemplateId, selectedTemplate]);

  // Live preview in form step
  useEffect(() => {
    if (!selectedTemplate || step !== 'form') return;
    const html = interpolate(selectedTemplate.htmlContent, values);
    setPreviewHtml(buildDoc(html, selectedTemplate.cssContent ?? ''));
  }, [values, selectedTemplate, step]);

  const generateMutation = useMutation({
    mutationFn: () =>
      httpClient.post<ApiResponse<GenerateResult>>('/offer-letters/generate', {
        templateId: selectedTemplateId,
        variables: values,
      }),
    onSuccess: (res) => {
      const data = res.data.data;
      setGeneratedId(data.id);
      setPreviewHtml(data.generatedHtml);
      setStep('preview');
      toast.success('Offer letter generated');
      void queryClient.invalidateQueries({ queryKey: ['offer-letters'] });
    },
    onError: (e: Error) => toast.error(e.message ?? 'Generation failed'),
  });

  function openGenerate(cloneFrom?: OfferLetter) {
    setStep('form');
    setGeneratedId(null);
    setPreviewHtml('');
    setMobileTab('variables');
    if (cloneFrom) {
      setSelectedTemplateId(cloneFrom.templateId);
      setValues({ ...cloneFrom.variables });
    } else {
      const def = templates.find((t) => t.isDefault);
      setSelectedTemplateId(def?.id ?? '');
      setValues({});
    }
    setGenerateOpen(true);
  }

  function closeGenerate() {
    setGenerateOpen(false);
    setStep('form');
    setGeneratedId(null);
    setPreviewHtml('');
    setValues({});
    setSelectedTemplateId('');
  }

  async function handleDownload() {
    if (!selectedTemplate) return;
    setDownloading(true);
    try {
      const html = interpolate(selectedTemplate.htmlContent, values);
      const full = buildDoc(html, selectedTemplate.cssContent ?? '');
      await downloadAsPdf(full, `offer-letter-${generatedId ?? Date.now()}.pdf`);
      toast.success('PDF downloaded');
    } catch {
      toast.error('PDF generation failed');
    } finally {
      setDownloading(false);
    }
  }

  const columns: ColumnDef<OfferLetter>[] = [
    {
      id: 'template',
      header: 'Template',
      cell: ({ row }) => (
        <span className="font-medium text-foreground text-sm">{row.original.template?.name ?? '—'}</span>
      ),
    },
    {
      id: 'variables',
      header: 'Variables',
      cell: ({ row }) => {
        const vars = row.original.variables ?? {};
        const entries = Object.entries(vars).slice(0, 2);
        return (
          <div className="flex flex-col gap-0.5">
            {entries.map(([k, v]) => (
              <span key={k} className="text-xs text-muted-foreground">
                <span className="font-mono text-cyan-400/70">{k}:</span> {String(v).slice(0, 24)}{String(v).length > 24 ? '…' : ''}
              </span>
            ))}
            {Object.keys(vars).length > 2 && (
              <span className="text-xs text-muted-foreground">+{Object.keys(vars).length - 2} more</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge variant="violet">{row.original.status}</Badge>,
    },
    {
      id: 'created',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" title="Clone & edit" onClick={() => openGenerate(row.original)}>
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Preview"
            onClick={() => {
              const t = templates.find((t) => t.id === row.original.templateId);
              if (!t) { toast.error('Template not found'); return; }
              const html = interpolate(t.htmlContent, row.original.variables);
              setPreviewHtml(buildDoc(html, t.cssContent ?? ''));
              setGeneratedId(row.original.id);
              setSelectedTemplateId(t.id);
              setValues(row.original.variables);
              setStep('preview');
              setGenerateOpen(true);
            }}
          >
            <Eye className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const allFilled = selectedTemplate && selectedTemplate.variables.every((v) => values[v]?.trim());

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Document generation"
          title="Offer letters"
          description="Generate offer letters from templates, fill variables, preview and download as PDF."
          actions={
            <Button onClick={() => openGenerate()}>
              <WandSparkles className="size-4" /> Generate offer
            </Button>
          }
        />

        <SectionCard
          title="Generated offer letters"
          description="Last 5 generated offers. Clone any to reuse with minor edits."
        >
          <DataTable
            data={offerLetters}
            columns={columns as ColumnDef<Record<string, unknown>>[]}
            isLoading={listQuery.isLoading}
            emptyTitle="No offer letters yet"
            emptyDescription="Generated offer letters will appear here."
            page={1}
            totalPages={1}
            total={offerLetters.length}
            onPageChange={() => {}}
          />
        </SectionCard>

        {/* Generate / Preview Dialog */}
        <Dialog open={generateOpen} onOpenChange={(o) => !generateMutation.isPending && !downloading && (o ? undefined : closeGenerate())}>
          <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col p-0">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
              <div>
                <DialogTitle className="text-base">
                  {step === 'form' ? 'Generate offer letter' : 'Preview offer letter'}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {step === 'form' ? 'Select a template, fill in the variables and generate.' : 'Review the generated offer. Download as PDF or go back to edit.'}
                </DialogDescription>
              </div>
              {step === 'preview' && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep('form')}>
                    <ArrowLeft className="size-4" /> Back
                  </Button>
                  <Button size="sm" onClick={handleDownload} disabled={downloading}>
                    {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Download PDF
                  </Button>
                </div>
              )}
            </div>

            {step === 'form' && (
              <div className="flex flex-1 overflow-hidden min-h-0">
                {/* Mobile tab switcher */}
                <div className="absolute left-6 top-16 z-10 flex gap-1 rounded-lg border border-border bg-slate-950/80 p-1 md:hidden">
                  {(['variables', 'preview'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setMobileTab(tab)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${mobileTab === tab ? 'bg-white/10 text-foreground' : 'text-muted-foreground'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Variables pane */}
                <div className={`flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-6 md:w-80 lg:w-96 ${mobileTab === 'preview' ? 'hidden md:flex' : 'flex'}`}>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-foreground">Template</span>
                    <select
                      className="h-10 cursor-pointer rounded-lg border border-input bg-slate-950/55 px-3 text-sm text-foreground"
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                    >
                      <option value="">Select template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedTemplate && selectedTemplate.variables.length > 0 && (
                    <div className="grid gap-3">
                      <span className="text-sm font-medium text-foreground">Variables</span>
                      {selectedTemplate.variables.map((v) => (
                        <label key={v} className="grid gap-1 text-sm">
                          <span className="font-mono text-[11px] text-cyan-300">{`{{${v}}}`}</span>
                          <Input
                            value={values[v] ?? ''}
                            onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                            placeholder={`Enter ${v.replace(/_/g, ' ')}…`}
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  {selectedTemplate && selectedTemplate.variables.length === 0 && (
                    <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-3">
                      This template has no variables. Click Generate to proceed.
                    </p>
                  )}

                  <div className="mt-auto pt-2">
                    <Button
                      className="w-full"
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending || !selectedTemplateId}
                    >
                      {generateMutation.isPending
                        ? <><Loader2 className="size-4 animate-spin" /> Generating…</>
                        : <><WandSparkles className="size-4" /> Generate</>}
                    </Button>
                    {selectedTemplate && !allFilled && (
                      <p className="mt-1.5 text-center text-xs text-amber-400/80">Fill all variables for best results</p>
                    )}
                  </div>
                </div>

                {/* Preview pane */}
                <div className={`flex flex-1 flex-col overflow-hidden p-4 ${mobileTab === 'variables' ? 'hidden md:flex' : 'flex'}`}>
                  <p className="mb-2 shrink-0 text-xs text-muted-foreground">Live preview</p>
                  {selectedTemplate ? (
                    <div className="flex-1 overflow-hidden rounded-xl border border-border bg-white">
                      <iframe
                        srcDoc={previewHtml}
                        className="h-full w-full"
                        style={{ border: 'none', minHeight: 400 }}
                        title="Offer letter preview"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
                      <p className="text-sm">Select a template to preview</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="flex flex-1 overflow-hidden min-h-0 p-4">
                <div className="flex-1 overflow-hidden rounded-xl border border-border bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    className="h-full w-full"
                    style={{ border: 'none', minHeight: 500 }}
                    title="Generated offer letter"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}