import { Check, Edit3, ImagePlus, Loader2, Plus, Save, Star, StarOff, Tag, Trash2, X } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageTransition } from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { DataTable } from '@/components/tables/DataTable';
import { endpoints } from '@/services/api/endpoints';
import { resourceApi } from '@/services/api/resource.api';
import { httpClient } from '@/services/api/http-client';
import { useResourceQuery } from '@/hooks/use-resource-query';
import type { ApiResponse } from '@/types/api';
import type { ColumnDef } from '@tanstack/react-table';

type Template = {
  id: string;
  name: string;
  key: string;
  category?: string;
  htmlContent: string;
  cssContent?: string;
  variables: string[];
  isDefault: boolean;
};

const EMPTY: Partial<Template> = {
  name: '',
  key: '',
  category: '',
  htmlContent: '',
  cssContent: '',
};

function extractVariables(html: string): string[] {
  const matches = [...html.matchAll(/\{\{\s*(\w+)\s*\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

function buildPreview(html: string, css: string, sampleValues: Record<string, string>): string {
  let rendered = html;
  for (const [k, v] of Object.entries(sampleValues)) {
    rendered = rendered.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v || `<span style="background:#fbbf2444;border-radius:3px;padding:0 2px">{{${k}}}</span>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:sans-serif}${css}</style></head><body>${rendered}</body></html>`;
}

export function TemplatesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<Partial<Template>>(EMPTY);
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [activeTab, setActiveTab] = useState<'html' | 'css'>('html');

  const detectedVars = extractVariables(form.htmlContent ?? '');

  const refreshPreview = useCallback(() => {
    const html = form.htmlContent ?? '';
    const css = form.cssContent ?? '';
    setPreviewHtml(buildPreview(html, css, sampleValues));
  }, [form.htmlContent, form.cssContent, sampleValues]);

  useEffect(() => { refreshPreview(); }, [refreshPreview]);

  useEffect(() => {
    setSampleValues((prev) => {
      const next: Record<string, string> = {};
      for (const v of detectedVars) next[v] = prev[v] ?? '';
      return next;
    });
  }, [form.htmlContent]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Template>) => resourceApi.create<Partial<Template>, Template>(endpoints.templates, data),
    onSuccess: () => { toast.success('Template created'); close(); void queryClient.invalidateQueries({ queryKey: ['templates'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Template>) => resourceApi.update<Partial<Template>, Template>(endpoints.templates, editing!.id, data),
    onSuccess: () => { toast.success('Template updated'); close(); void queryClient.invalidateQueries({ queryKey: ['templates'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => httpClient.patch<ApiResponse<Template>>(`${endpoints.templates}/${id}/set-default`),
    onSuccess: () => { toast.success('Default template updated'); void queryClient.invalidateQueries({ queryKey: ['templates'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => httpClient.delete(`${endpoints.templates}/${id}`),
    onSuccess: () => { toast.success('Template deleted'); void queryClient.invalidateQueries({ queryKey: ['templates'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [uploadedImages, setUploadedImages] = useState<{ url: string; key: string; name: string }[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await httpClient.post<ApiResponse<{ url: string; key: string }>>('/templates/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { url, key } = res.data.data;
      setUploadedImages((prev) => [...prev, { url, key, name: file.name }]);
      insertImageTag(url, file.name);
      toast.success('Image uploaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setImageUploading(false);
    }
  };

  function insertImageTag(url: string, alt: string) {
    const tag = `<img src="${url}" alt="${alt}" style="max-width:100%;" />`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setForm((f) => ({ ...f, htmlContent: (f.htmlContent ?? '') + '\n' + tag }));
      return;
    }
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const current = form.htmlContent ?? '';
    const next = current.slice(0, start) + tag + current.slice(end);
    setForm((f) => ({ ...f, htmlContent: next }));
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      textarea.focus();
    }, 0);
  }

  function open(template?: Template) {
    setEditing(template ?? null);
    setForm(template ? { ...template } : EMPTY);
    setSampleValues({});
    setDialogOpen(true);
  }

  function close() {
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY);
    setSampleValues({});
    setUploadedImages([]);
  }

  function submit() {
    if (!form.name?.trim() || !form.key?.trim() || !form.htmlContent?.trim()) {
      toast.error('Name, key and HTML content are required');
      return;
    }
    if (editing) updateMutation.mutate(form);
    else createMutation.mutate(form);
  }

  const busy = createMutation.isPending || updateMutation.isPending;

  const templateColumns: ColumnDef<Template>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      id: 'key',
      header: 'Key',
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.key}</span>,
    },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const cat = row.original.category;
        return cat ? <Badge variant="outline" className="text-xs">{cat}</Badge> : <span className="text-muted-foreground text-xs">—</span>;
      },
    },
    {
      id: 'variables',
      header: 'Variables',
      cell: ({ row }) => {
        const vars = row.original.variables ?? [];
        return (
          <div className="flex flex-wrap gap-1">
            {vars.slice(0, 3).map((v) => (
              <span key={v} className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">{`{{${v}}}`}</span>
            ))}
            {vars.length > 3 && <span className="text-muted-foreground text-xs">+{vars.length - 3}</span>}
          </div>
        );
      },
    },
    {
      id: 'default',
      header: 'Default',
      cell: ({ row }) => row.original.isDefault
        ? <Badge variant="success" className="gap-1"><Check className="size-3" />Default</Badge>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex items-center gap-1">
            {!t.isDefault && (
              <Button size="sm" variant="ghost" className="text-amber-400 hover:text-amber-300" onClick={() => defaultMutation.mutate(t.id)} title="Set as default">
                <Star className="size-3.5" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => open(t)}>
              <Edit3 className="size-3.5" />
            </Button>
            {!t.isDefault && (
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                onClick={() => {
                  if (window.confirm(`Delete template "${t.name}"? This cannot be undone.`)) {
                    deleteMutation.mutate(t.id);
                  }
                }}
                title="Delete template"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const listQuery = useResourceQuery<Template>('templates', endpoints.templates, { page: 1, limit: 50 });
  const templates = listQuery.data?.items ?? [];

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Template studio"
          title="Template management"
          description="Build HTML templates with live preview. Variables are auto-detected from {{placeholder}} syntax."
          actions={
            <Button onClick={() => open()}>
              <Plus className="size-4" /> Create template
            </Button>
          }
        />

        <SectionCard
          title="Template library"
          description={`${listQuery.data?.meta?.total ?? 0} templates saved.`}
        >
          <DataTable
            data={templates}
            columns={templateColumns as ColumnDef<Record<string, unknown>>[]}
            isLoading={listQuery.isLoading}
            emptyTitle="No templates yet"
            emptyDescription="Create your first template to start generating offer letters."
            page={1}
            totalPages={1}
            total={templates.length}
            onPageChange={() => {}}
          />
        </SectionCard>

        <Dialog open={dialogOpen} onOpenChange={(o) => !busy && (o ? setDialogOpen(true) : close())}>
          <DialogContent className="max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="size-4" />
                {editing ? 'Edit template' : 'Create template'}
              </DialogTitle>
              <DialogDescription>Use {'{{variable_name}}'} syntax. Variables are detected automatically.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
              {/* Left: editor */}
              <div className="flex w-[45%] shrink-0 flex-col gap-3 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-foreground">Name *</span>
                    <Input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Standard Offer Letter" disabled={busy} />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-foreground">Key *</span>
                    <Input value={form.key ?? ''} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))} placeholder="standard-offer" disabled={busy || !!editing} />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5 text-sm">
                    <span className="font-medium text-foreground flex items-center gap-1"><Tag className="size-3" />Category</span>
                    <Input value={form.category ?? ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="offer_letter, contract…" disabled={busy} />
                  </label>
                  <div className="flex items-end pb-0.5">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, isDefault: !f.isDefault }))}
                      className={`flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-sm transition-colors ${form.isDefault ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-input bg-transparent text-muted-foreground hover:text-foreground'}`}
                      disabled={busy}
                    >
                      {form.isDefault ? <Star className="size-4 fill-amber-400 text-amber-400" /> : <StarOff className="size-4" />}
                      {form.isDefault ? 'Default template' : 'Set as default'}
                    </button>
                  </div>
                </div>

                {/* Tab switcher for HTML / CSS */}
                <div className="flex gap-1 rounded-lg border border-border bg-slate-950/40 p-1">
                  {(['html', 'css'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === tab ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || imageUploading}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    title="Upload image and insert into HTML"
                  >
                    {imageUploading ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
                    Image
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif" className="hidden" onChange={handleImageUpload} />
                </div>

                {activeTab === 'html' && (
                  <Textarea
                    ref={textareaRef}
                    value={form.htmlContent ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, htmlContent: e.target.value }))}
                    className="min-h-64 flex-1 font-mono text-xs"
                    placeholder={'<section>\n  <h1>Offer Letter</h1>\n  <p>Dear {{employee_name}},</p>\n</section>'}
                    disabled={busy}
                  />
                )}
                {activeTab === 'css' && (
                  <Textarea
                    value={form.cssContent ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, cssContent: e.target.value }))}
                    className="min-h-64 flex-1 font-mono text-xs"
                    placeholder={'body { font-family: Georgia, serif; }\nh1 { color: #1e293b; }'}
                    disabled={busy}
                  />
                )}

                {/* Uploaded images this session */}
                {uploadedImages.length > 0 && (
                  <div className="rounded-xl border border-border bg-white/[0.02] p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Uploaded images — click to re-insert</p>
                    <div className="flex flex-wrap gap-2">
                      {uploadedImages.map((img) => (
                        <button
                          key={img.key}
                          type="button"
                          onClick={() => insertImageTag(img.url, img.name)}
                          className="group relative overflow-hidden rounded-lg border border-border bg-white/5 transition-colors hover:border-cyan-500/50"
                          title={`Insert ${img.name}`}
                        >
                          <img src={img.url} alt={img.name} className="h-14 w-20 object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="text-[10px] font-medium text-white">Insert</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detected variables */}
                {detectedVars.length > 0 && (
                  <div className="rounded-xl border border-border bg-white/[0.02] p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Detected variables — enter sample values for preview</p>
                    <div className="grid gap-2">
                      {detectedVars.map((v) => (
                        <label key={v} className="flex items-center gap-2 text-xs">
                          <span className="w-32 shrink-0 rounded bg-cyan-500/10 px-1.5 py-1 font-mono text-cyan-300">{`{{${v}}}`}</span>
                          <Input
                            value={sampleValues[v] ?? ''}
                            onChange={(e) => setSampleValues((s) => ({ ...s, [v]: e.target.value }))}
                            placeholder={`Sample ${v.replace(/_/g, ' ')}`}
                            className="h-7 text-xs"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={close} disabled={busy}><X className="size-4" /> Cancel</Button>
                  <Button onClick={submit} disabled={busy}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> Saving…</> : <><Save className="size-4" /> Save template</>}
                  </Button>
                </div>
              </div>

              {/* Right: live preview */}
              <div className="flex flex-1 flex-col gap-2 overflow-hidden">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Live preview</p>
                  <span className="text-xs text-muted-foreground">{detectedVars.length} variable{detectedVars.length !== 1 ? 's' : ''} detected</span>
                </div>
                <div className="flex-1 overflow-hidden rounded-xl border border-border bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    className="h-full w-full"
                    style={{ border: 'none', minHeight: 500 }}
                    title="Template preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}