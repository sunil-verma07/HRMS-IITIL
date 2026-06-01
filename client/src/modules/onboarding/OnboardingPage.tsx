import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileUp, ShieldCheck, UserRound, WalletCards, Upload, Save, Play, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { PageTransition } from '@/components/animations/PageTransition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionCard } from '@/components/shared/SectionCard';
import { PageHeader } from '@/components/shared/PageHeader';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { endpoints } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import { Textarea } from '@/components/ui/textarea';

type OnboardingStep = { key: string; title: string; required: boolean };
type OnboardingConfig = {
  requiredDocuments: string[];
  mandatoryFields: string[];
  optionalFields: string[];
  steps: OnboardingStep[];
  updatedAt?: string | null;
};

type OnboardingProgress = {
  id: string;
  employeeId: string;
  currentStep: number;
  completedSteps: string[];
  submittedDocuments: Record<string, unknown>;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  reviewNotes?: string | null;
  reviewedById?: string | null;
};

const defaultConfig: OnboardingConfig = {
  requiredDocuments: [],
  mandatoryFields: [],
  optionalFields: [],
  steps: [
    { key: 'personal', title: 'Personal Info', required: true },
    { key: 'documents', title: 'Documents', required: true },
    { key: 'employment', title: 'Employment', required: true },
    { key: 'review', title: 'Review', required: true },
    { key: 'approval', title: 'Approval', required: true },
  ],
};

const workflowSteps = [
  { label: 'Personal Info', icon: UserRound },
  { label: 'Document Upload', icon: FileUp },
  { label: 'Salary Details', icon: WalletCards },
  { label: 'Review', icon: CheckCircle2 },
  { label: 'Approval', icon: ShieldCheck },
];

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseSteps(value: string): OnboardingStep[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key = '', title = '', required = 'true'] = line.split('|').map((part) => part.trim());
      return { key, title, required: required !== 'false' };
    })
    .filter((step) => step.key && step.title);
}

function stepsToText(steps: OnboardingStep[]): string {
  return steps.map((step) => `${step.key}|${step.title}|${step.required ? 'true' : 'false'}`).join('\n');
}

export function OnboardingPage() {
  const queryClient = useQueryClient();
  const [requiredDocuments, setRequiredDocuments] = useState('');
  const [mandatoryFields, setMandatoryFields] = useState('');
  const [optionalFields, setOptionalFields] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const configQuery = useQuery({
    queryKey: ['onboarding', 'config'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<OnboardingConfig>>(endpoints.onboarding.config);
      return response.data.data;
    },
    staleTime: 60_000,
  });

  const progressQuery = useQuery({
    queryKey: ['onboarding', 'my-progress'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<OnboardingProgress>>(endpoints.onboarding.myProgress);
      return response.data.data;
    },
    staleTime: 30_000,
  });

  const config = configQuery.data ?? defaultConfig;
  const progress = progressQuery.data;

  useEffect(() => {
    setRequiredDocuments((config.requiredDocuments ?? []).join(', '));
    setMandatoryFields((config.mandatoryFields ?? []).join(', '));
    setOptionalFields((config.optionalFields ?? []).join(', '));
    setStepsText(stepsToText(config.steps ?? defaultConfig.steps));
  }, [config]);

  useEffect(() => {
    if (!progress) return;
    setCurrentStep(progress.currentStep);
    setCompletedSteps(progress.completedSteps.join(', '));
  }, [progress]);

  const updateConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put<ApiResponse<OnboardingConfig>>(endpoints.onboarding.config, {
        requiredDocuments: splitList(requiredDocuments),
        mandatoryFields: splitList(mandatoryFields),
        optionalFields: splitList(optionalFields),
        steps: parseSteps(stepsText),
      });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding', 'config'] });
      toast.success('Onboarding config updated');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update config'),
  });

  const saveProgressMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put<ApiResponse<OnboardingProgress>>(endpoints.onboarding.myProgress, {
        currentStep,
        completedSteps: splitList(completedSteps),
      });
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding', 'my-progress'] });
      toast.success('Onboarding progress saved');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to save progress'),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<ApiResponse<OnboardingProgress>>(endpoints.onboarding.submit);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['onboarding', 'my-progress'] });
      toast.success('Onboarding submitted');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to submit onboarding'),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('Select a file first');
      const formData = new FormData();
      formData.append('file', uploadFile);
      const response = await api.post<ApiResponse<unknown>>(endpoints.onboarding.upload, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['onboarding', 'my-progress'] }),
      ]);
      setUploadFile(null);
      toast.success('Document uploaded');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to upload document'),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error('Employee ID is required');
      const response = await api.post<ApiResponse<OnboardingProgress>>(endpoints.onboarding.review(employeeId), {
        decision,
        notes: reviewNotes || undefined,
      });
      return response.data.data;
    },
    onSuccess: () => toast.success('Onboarding reviewed'),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to review onboarding'),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error('Employee ID is required');
      const response = await api.post<ApiResponse<unknown>>(endpoints.onboarding.activate(employeeId));
      return response.data.data;
    },
    onSuccess: () => toast.success('Employee activated'),
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to activate employee'),
  });

  const completion = useMemo(() => {
    const stepCount = config.steps?.length ?? 0;
    if (!stepCount) return 0;
    return Math.min(100, Math.round(((progress?.currentStep ?? 1) / stepCount) * 100));
  }, [config.steps, progress?.currentStep]);

  return (
    <PageTransition>
      <div className="space-y-6 p-5 lg:p-6">
        <PageHeader
          eyebrow="Stepper workflow"
          title="Onboarding"
          description="Configure onboarding steps, save employee progress, submit workflows, review approvals, and activate employees."
        />

        <SectionCard title="Workflow steps" description="The backend contract now drives the employee and admin workflows directly.">
          <div className="grid gap-3 md:grid-cols-5">
            {workflowSteps.map((step, index) => (
              <div key={step.label} className="rounded-2xl border border-border bg-white/[0.035] p-4">
                <step.icon className="mb-4 size-5 text-cyan-200" />
                <Badge variant="muted">Step {index + 1}</Badge>
                <p className="mt-3 text-sm font-medium text-foreground">{step.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title="Employee progress" description="Save current progress, upload files, and submit onboarding when ready.">
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-white/[0.03] p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{progress ? `Status: ${progress.status}` : 'Loading progress...'}</p>
                  <p className="text-xs text-muted-foreground">Current step {progress?.currentStep ?? 1} of {config.steps?.length ?? defaultConfig.steps.length}</p>
                </div>
                <Badge variant="outline">{completion}% complete</Badge>
              </div>

              <div className="space-y-3">
                {(config.steps ?? defaultConfig.steps).map((step) => (
                  <div key={step.key} className={cn('flex items-center justify-between rounded-2xl border px-4 py-3', progress?.completedSteps.includes(step.key) ? 'border-emerald-500/30 bg-emerald-500/[0.08]' : 'border-border bg-white/[0.03]')}>
                    <div>
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.key}</p>
                    </div>
                    <Badge variant={step.required ? 'default' : 'outline'}>{step.required ? 'Required' : 'Optional'}</Badge>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Current step</Label>
                  <Input type="number" min={1} value={currentStep} onChange={(event) => setCurrentStep(Number(event.target.value) || 1)} />
                </div>
                <div className="space-y-2">
                  <Label>Completed steps</Label>
                  <Input value={completedSteps} onChange={(event) => setCompletedSteps(event.target.value)} placeholder="personal,documents" />
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-white/[0.03] p-4">
                <Label>Upload document</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <Input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} className="max-w-sm" />
                  <Button onClick={() => uploadMutation.mutate()} disabled={!uploadFile || uploadMutation.isPending}>
                    <Upload className="mr-2 size-4" />
                    Upload
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Selected: {uploadFile ? uploadFile.name : 'none'}</p>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={() => saveProgressMutation.mutate()} disabled={saveProgressMutation.isPending}>
                  <Save className="mr-2 size-4" />
                  Save progress
                </Button>
                <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                  <Play className="mr-2 size-4" />
                  Submit onboarding
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="HR configuration and review" description="Configure required fields, then approve or activate an employee workflow.">
            <div className="space-y-5">
              <div className="space-y-3 rounded-2xl border border-border bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-foreground">Config editor</p>
                <div className="space-y-2">
                  <Label>Required documents</Label>
                  <Textarea rows={2} value={requiredDocuments} onChange={(event) => setRequiredDocuments(event.target.value)} placeholder="PAN, Aadhaar, Bank proof" />
                </div>
                <div className="space-y-2">
                  <Label>Mandatory fields</Label>
                  <Textarea rows={2} value={mandatoryFields} onChange={(event) => setMandatoryFields(event.target.value)} placeholder="phone, address" />
                </div>
                <div className="space-y-2">
                  <Label>Optional fields</Label>
                  <Textarea rows={2} value={optionalFields} onChange={(event) => setOptionalFields(event.target.value)} placeholder="emergencyContact, bloodGroup" />
                </div>
                <div className="space-y-2">
                  <Label>Steps</Label>
                  <Textarea rows={6} value={stepsText} onChange={(event) => setStepsText(event.target.value)} placeholder="personal|Personal Info|true" />
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => updateConfigMutation.mutate()} disabled={updateConfigMutation.isPending}>
                    <Save className="mr-2 size-4" />
                    Save config
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-foreground">Review and activation</p>
                <div className="space-y-2">
                  <Label>Employee ID</Label>
                  <Input value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="employee UUID" />
                </div>
                <div className="space-y-2">
                  <Label>Decision</Label>
                  <Select value={decision} onValueChange={(value) => setDecision(value as 'APPROVED' | 'REJECTED')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Review notes</Label>
                  <Textarea rows={4} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Add approval or rejection notes" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending || !employeeId} className="flex-1">
                    <FileText className="mr-2 size-4" />
                    Save review
                  </Button>
                  <Button onClick={() => activateMutation.mutate()} disabled={activateMutation.isPending || !employeeId} className="flex-1">
                    <ShieldCheck className="mr-2 size-4" />
                    Activate employee
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Current config snapshot</p>
                <p className="mt-2">Required docs: {(config.requiredDocuments ?? []).join(', ') || 'none'}</p>
                <p>Mandatory fields: {(config.mandatoryFields ?? []).join(', ') || 'none'}</p>
                <p>Optional fields: {(config.optionalFields ?? []).join(', ') || 'none'}</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageTransition>
  );
}
