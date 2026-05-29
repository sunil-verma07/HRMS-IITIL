// src/modules/settings/SettingsPage.tsx - Updated version
import { Building2, CalendarDays, Clock, Loader2, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageTransition } from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { httpClient } from '@/services/api/http-client';
import { endpoints } from '@/services/api/endpoints';
import type { ApiResponse } from '@/types/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge'; 

type AttendanceSetting = {
  id: string;
  officeStart: string;
  officeEnd: string;
  graceMinutes: number;
  workingDays: string[];
};

type LeaveType = {
  id: string;
  name: string;
  code: string;
  annualQuota: number;
  isPaid: boolean;
  isActive: boolean;
};

type SettingsData = {
  attendanceSetting: AttendanceSetting | null;
  leaveTypes: LeaveType[];
  regularizationLimit: number;
};

type FormState = {
  officeStart: string;
  officeEnd: string;
  graceMinutes: string;
  regularizationLimit: string;
};

const DEFAULT_FORM: FormState = {
  officeStart: '09:00',
  officeEnd: '18:00',
  graceMinutes: '10',
  regularizationLimit: '5'
};

// Leave Types Manager Component
function LeaveTypesManager({ leaveTypes, onUpdate }: { leaveTypes: LeaveType[]; onUpdate: () => void }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [annualQuota, setAnnualQuota] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await httpClient.post('/leave-types', { name, code: code.toUpperCase(), annualQuota: Number(annualQuota), isPaid });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Leave type created');
      setDialogOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      onUpdate();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create leave type')
  });
  
  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await httpClient.patch(`/leave-types/${editingType?.id}`, { name, annualQuota: Number(annualQuota), isPaid });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Leave type updated');
      setDialogOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      onUpdate();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update leave type')
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await httpClient.delete(`/leave-types/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Leave type deleted');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      onUpdate();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete leave type')
  });
  
  const resetForm = () => {
    setName('');
    setCode('');
    setAnnualQuota('');
    setIsPaid(true);
    setEditingType(null);
  };
  
  const handleEdit = (type: LeaveType) => {
    setEditingType(type);
    setName(type.name);
    setCode(type.code);
    setAnnualQuota(String(type.annualQuota));
    setIsPaid(type.isPaid);
    setDialogOpen(true);
  };
  
  const handleSubmit = () => {
    if (editingType) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 size-4" />
              Add Leave Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingType ? 'Edit Leave Type' : 'Add Leave Type'}</DialogTitle>
              <DialogDescription>
                Configure leave type settings including name, code, and annual quota.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Casual Leave" />
              </div>
              <div>
                <Label>Code *</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g., CL" maxLength={40} />
              </div>
              <div>
                <Label>Annual Quota (days) *</Label>
                <Input type="number" step="0.5" value={annualQuota} onChange={(e) => setAnnualQuota(e.target.value)} placeholder="12" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Paid Leave</Label>
                <Switch checked={isPaid} onCheckedChange={setIsPaid} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!name || !code || !annualQuota || createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="divide-y divide-border rounded-lg border border-border">
        {leaveTypes.filter(lt => !lt.deletedAt).map((type) => (
          <div key={type.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{type.name}</span>
                <span className="text-xs text-muted-foreground">({type.code})</span>
                {!type.isActive && <Badge variant="secondary">Inactive</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {type.annualQuota} days/year • {type.isPaid ? 'Paid' : 'Unpaid'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleEdit(type)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => deleteMutation.mutate(type.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Config List Manager Component (for departments and designations)
function ConfigListManager({ configKey, title, description, placeholder, icon }: {
  configKey: string;
  title: string;
  description: string;
  placeholder: string;
  icon: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState('');

  const { data: items = [], isLoading } = useQuery<string[]>({
    queryKey: ['config', configKey],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<{ key: string; value: string[] }>>(endpoints.config.byKey(configKey));
      return res.data.data.value ?? [];
    },
    staleTime: 30000
  });

  const saveMutation = useMutation({
    mutationFn: (value: string[]) => httpClient.put(endpoints.config.byKey(configKey), { value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config', configKey] });
      toast.success(`${title} updated`);
    },
    onError: () => toast.error(`Failed to update ${title.toLowerCase()}`)
  });

  const handleAdd = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }
    saveMutation.mutate([...items, trimmed]);
    setNewItem('');
  };

  const handleRemove = (item: string) => {
    saveMutation.mutate(items.filter((i) => i !== item));
  };

  return (
    <SectionCard title={title} description={description}>
      {icon}
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="max-w-sm"
            disabled={saveMutation.isPending}
          />
          <Button size="sm" onClick={handleAdd} disabled={!newItem.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>
        {isLoading ? (
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-24 animate-pulse rounded-lg bg-white/[0.06]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No {title.toLowerCase()} added yet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <div key={item} className="flex items-center gap-1.5 rounded-lg border border-border bg-white/[0.04] px-3 py-1.5 text-sm">
                <span>{item}</span>
                <button type="button" onClick={() => handleRemove(item)} disabled={saveMutation.isPending} className="ml-0.5 text-muted-foreground transition-colors hover:text-rose-400">
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState('attendance');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await httpClient.get<ApiResponse<SettingsData>>('/settings');
      return res.data.data;
    },
    staleTime: 30000
  });

  useEffect(() => {
    if (data?.attendanceSetting) {
      setForm({
        officeStart: data.attendanceSetting.officeStart,
        officeEnd: data.attendanceSetting.officeEnd,
        graceMinutes: String(data.attendanceSetting.graceMinutes),
        regularizationLimit: String(data.regularizationLimit ?? 5)
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (values: FormState) => {
      await httpClient.patch('/settings', {
        officeStart: values.officeStart,
        officeEnd: values.officeEnd,
        graceMinutes: Number(values.graceMinutes),
        regularizationLimit: Number(values.regularizationLimit)
      });
    },
    onSuccess: () => {
      toast.success('Settings saved');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to save settings')
  });

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  });

  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader eyebrow="Administration" title="Settings" description="Loading settings…" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        </div>
      </PageTransition>
    );
  }

  if (isError) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <PageHeader eyebrow="Administration" title="Settings" description="Failed to load settings." />
          <SectionCard title="Error" description="Could not load settings from the server.">
            <Button variant="outline" onClick={() => void queryClient.invalidateQueries({ queryKey: ['settings'] })}>
              Retry
            </Button>
          </SectionCard>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Administration"
          title="Settings"
          description="Configure attendance policies, leave types, and system preferences."
          actions={
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
            </Button>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="leave">Leave Types</TabsTrigger>
            <TabsTrigger value="departments">Departments & Designations</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="mt-6 space-y-6">
            <div className="grid gap-5 xl:grid-cols-2">
              <SectionCard title="Office Timing" description="Define work hours and grace period for attendance checks.">
                <Clock className="mb-5 size-5 text-cyan-200" />
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Office start time</span>
                    <Input type="time" {...field('officeStart')} />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Office end time</span>
                    <Input type="time" {...field('officeEnd')} />
                  </label>
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Grace minutes</span>
                    <Input type="number" min={0} max={60} {...field('graceMinutes')} />
                    <p className="text-xs text-muted-foreground">Plus 15-minute buffer after grace for on-time arrival</p>
                  </label>
                </div>
              </SectionCard>

              <SectionCard title="Regularization Policy" description="Configure attendance regularization limits.">
                <CalendarDays className="mb-5 size-5 text-amber-200" />
                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm">
                    <span className="text-muted-foreground">Monthly Regularization Limit</span>
                    <Input type="number" min={1} max={20} {...field('regularizationLimit')} />
                    <p className="text-xs text-muted-foreground">Maximum number of regularization requests per employee per month</p>
                  </label>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Working Days" description="Configure which days are considered working days.">
              <div className="flex flex-wrap gap-3">
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
                  <div key={day} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`day-${day}`}
                      checked={data?.attendanceSetting?.workingDays?.includes(day) ?? (day !== 'SAT' && day !== 'SUN')}
                      onChange={(e) => {
                        const current = data?.attendanceSetting?.workingDays ?? ['MON', 'TUE', 'WED', 'THU', 'FRI'];
                        const newDays = e.target.checked ? [...current, day] : current.filter(d => d !== day);
                        setForm(prev => ({ ...prev }));
                        saveMutation.mutate({ ...form, workingDays: newDays as any });
                      }}
                      className="rounded border-border"
                    />
                    <Label htmlFor={`day-${day}`} className="text-sm">{day}</Label>
                  </div>
                ))}
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="leave" className="mt-6">
            <SectionCard title="Leave Types" description="Manage leave types, quotas, and policies.">
              <LeaveTypesManager 
                leaveTypes={data?.leaveTypes ?? []} 
                onUpdate={() => void queryClient.invalidateQueries({ queryKey: ['settings'] })}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="departments" className="mt-6">
            <div className="grid gap-5 xl:grid-cols-2">
              <ConfigListManager
                configKey="hr.departments"
                title="Departments"
                description="Manage the department list used in employee forms."
                placeholder="e.g., Engineering"
                icon={<Settings2 className="mb-5 size-5 text-cyan-200" />}
              />
              <ConfigListManager
                configKey="hr.designations"
                title="Designations"
                description="Manage the designation list used in employee forms."
                placeholder="e.g., Senior Software Engineer"
                icon={<Settings2 className="mb-5 size-5 text-violet-200" />}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}