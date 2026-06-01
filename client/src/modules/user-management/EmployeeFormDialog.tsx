import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/forms/FormField';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  employeeFormSchema,
  type EmployeeFormValues,
} from '@/schemas/employee.schemas';
import { endpoints } from '@/services/api/endpoints';
import { useDebounce } from '@/hooks/use-debounce';
import { httpClient } from '@/services/api/http-client';
import type { ApiResponse } from '@/types/api';

export type EmployeeFormRecord = Partial<EmployeeFormValues> & {
  id?: string;
};

type EmployeeFormDialogProps = {
  open: boolean;
  employee?: EmployeeFormRecord | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: EmployeeFormValues) => void;
};

const defaultValues: EmployeeFormValues = {
  employeeId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  designation: '',
  department: '',
  joiningDate: new Date().toISOString().slice(0, 10),
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  reportingManagerId: '',
};

type ManagerListItem = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  designation: string;
  department: string;
};

export function EmployeeFormDialog({
  open,
  employee,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: EmployeeFormDialogProps) {
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues,
  });

  const [managerSearch, setManagerSearch] = useState('');
  const debouncedSearch = useDebounce(managerSearch, 300);

  const { data: departments = [] } = useQuery({
    queryKey: ['config', 'hr.departments'],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<{ key: string; value: string[] }>>(
        endpoints.config.byKey('hr.departments'),
      );
      return response.data.data?.value ?? [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const { data: designations = [] } = useQuery({
    queryKey: ['config', 'hr.designations'],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<{ key: string; value: string[] }>>(
        endpoints.config.byKey('hr.designations'),
      );
      return response.data.data?.value ?? [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const { data: managersData = [] } = useQuery({
    queryKey: ['employees', 'managers', debouncedSearch],
    queryFn: async () => {
      const response = await httpClient.get<ApiResponse<{ items: ManagerListItem[] }>>(
        endpoints.userManagement.users,
        {
          params: {
            search: debouncedSearch,
            limit: 20,
            role: 'TEAM_LEAD',
          },
        },
      );
      return response.data.data?.items ?? [];
    },
    enabled: open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setManagerSearch('');
      return;
    }

    if (employee) {
      form.reset({
        ...defaultValues,
        ...employee,
        employeeId: employee.id ? (employee.employeeId ?? '') : '',
        joiningDate: employee.joiningDate
          ? String(employee.joiningDate).slice(0, 10)
          : defaultValues.joiningDate,
        reportingManagerId: employee.reportingManagerId ?? '',
      });
      return;
    }

    form.reset(defaultValues);
    setManagerSearch('');
  }, [employee, form, open]);

  const selectedManagerId = form.watch('reportingManagerId') ?? '';

  const selectedManager = useMemo(
    () => managersData.find((item) => item.id === selectedManagerId),
    [managersData, selectedManagerId],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isSubmitting && onOpenChange(next)}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {employee?.id ? 'Edit employee' : 'Create employee'}
          </DialogTitle>
          <DialogDescription>
            {employee?.id
              ? 'Update employee details. Employee ID is auto-managed.'
              : 'Employee ID will be auto-generated. Visibility policy is enforced by the API.'}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Work email"
              name="email"
              register={form.register}
              error={form.formState.errors.email?.message}
            />
            <FormField
              label="First name"
              name="firstName"
              register={form.register}
              error={form.formState.errors.firstName?.message}
            />
            <FormField
              label="Last name"
              name="lastName"
              register={form.register}
              error={form.formState.errors.lastName?.message}
            />
            <FormField
              label="Phone"
              name="phone"
              register={form.register}
              error={form.formState.errors.phone?.message}
            />

            <div className="grid gap-2">
              <Label>Department *</Label>
              <Select
                value={form.watch('department')}
                onValueChange={(value) =>
                  form.setValue('department', value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department} value={department}>
                      {department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.department && (
                <span className="text-xs text-rose-400">
                  {form.formState.errors.department.message}
                </span>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Designation *</Label>
              <Select
                value={form.watch('designation')}
                onValueChange={(value) =>
                  form.setValue('designation', value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {designations.map((designation) => (
                    <SelectItem key={designation} value={designation}>
                      {designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.designation && (
                <span className="text-xs text-rose-400">
                  {form.formState.errors.designation.message}
                </span>
              )}
            </div>

            <FormField
              label="Joining date"
              name="joiningDate"
              type="date"
              register={form.register}
              error={form.formState.errors.joiningDate?.message}
            />

            <div className="grid gap-2 md:col-span-2">
              <Label>Reporting Manager</Label>
              <div className="relative">
                <Input
                  placeholder="Search manager name..."
                  value={managerSearch}
                  onChange={(event) => setManagerSearch(event.target.value)}
                  className="mb-1"
                />
                {managersData.length > 0 && managerSearch && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-slate-900 shadow-xl">
                    {managersData
                      .filter((manager) => manager.id !== employee?.id)
                      .map((manager) => (
                        <button
                          key={manager.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-white/8"
                          onClick={() => {
                            form.setValue('reportingManagerId', manager.id, {
                              shouldValidate: true,
                            });
                            setManagerSearch(
                              `${manager.firstName} ${manager.lastName}`,
                            );
                          }}
                        >
                          <span className="font-medium">
                            {manager.firstName} {manager.lastName}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {manager.designation} · {manager.department}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              {selectedManagerId && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Selected manager:{' '}
                    {selectedManager
                      ? `${selectedManager.firstName} ${selectedManager.lastName}`
                      : selectedManagerId}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue('reportingManagerId', '');
                      setManagerSearch('');
                    }}
                    className="text-rose-400 hover:text-rose-300"
                  >
                    Clear
                  </button>
                </div>
              )}
              {form.formState.errors.reportingManagerId && (
                <span className="text-xs text-rose-400">
                  {form.formState.errors.reportingManagerId.message}
                </span>
              )}
            </div>

            <div className="grid gap-2 text-sm">
              <Label>Employment type</Label>
              <Select
                value={form.watch('employmentType')}
                onValueChange={(value) =>
                  form.setValue('employmentType', value as EmployeeFormValues['employmentType'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employment type" />
                </SelectTrigger>
                <SelectContent>
                  {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT'].map(
                    (item) => (
                      <SelectItem key={item} value={item}>
                        {item.replace('_', ' ')}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 text-sm">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(value) =>
                  form.setValue('status', value as EmployeeFormValues['status'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {['ACTIVE', 'INACTIVE', 'ON_NOTICE', 'TERMINATED'].map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {employee?.id ? 'Update employee' : 'Create employee'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
