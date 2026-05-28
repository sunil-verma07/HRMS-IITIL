import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/forms/FormField';
import { employeeFormSchema, type EmployeeFormValues } from '@/schemas/employee.schemas';

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
  status: 'ACTIVE'
};

export function EmployeeFormDialog({ open, employee, isSubmitting, onOpenChange, onSubmit }: EmployeeFormDialogProps) {
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues
  });

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      return;
    }

    if (employee) {
      form.reset({
        ...defaultValues,
        ...employee,
        joiningDate: employee.joiningDate ? String(employee.joiningDate).slice(0, 10) : defaultValues.joiningDate
      });
    }
  }, [employee, form, open]);

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee?.id ? 'Edit employee' : 'Create employee'}</DialogTitle>
          <DialogDescription>Validated HRMS employee details. Visibility policy is enforced by the API.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Employee ID" name="employeeId" register={form.register} error={form.formState.errors.employeeId?.message} />
            <FormField label="Work email" name="email" register={form.register} error={form.formState.errors.email?.message} />
            <FormField label="First name" name="firstName" register={form.register} error={form.formState.errors.firstName?.message} />
            <FormField label="Last name" name="lastName" register={form.register} error={form.formState.errors.lastName?.message} />
            <FormField label="Phone" name="phone" register={form.register} error={form.formState.errors.phone?.message} />
            <FormField label="Designation" name="designation" register={form.register} error={form.formState.errors.designation?.message} />
            <FormField label="Department" name="department" register={form.register} error={form.formState.errors.department?.message} />
            <FormField label="Joining date" name="joiningDate" type="date" register={form.register} error={form.formState.errors.joiningDate?.message} />
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">Employment type</span>
              <select className="h-10 cursor-pointer rounded-lg border border-input bg-slate-950/55 px-3 text-sm" {...form.register('employmentType')}>
                {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium text-foreground">Status</span>
              <select className="h-10 cursor-pointer rounded-lg border border-input bg-slate-950/55 px-3 text-sm" {...form.register('status')}>
                {['ACTIVE', 'INACTIVE', 'ON_NOTICE', 'TERMINATED'].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
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
