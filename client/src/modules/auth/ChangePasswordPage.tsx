import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/forms/FormField';
import { PageTransition } from '@/components/animations/PageTransition';
import { authApi } from '@/services/api/auth.api';
import { changePasswordSchema, type ChangePasswordFormValues } from '@/schemas/auth.schemas';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' }
  });
  const mutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      toast.success('Password updated');
      navigate('/dashboard', { replace: true });
    }
  });

  return (
    <PageTransition>
      <div className="grid min-h-[calc(100vh-8rem)] place-items-center">
        <Card className="gradient-border w-full max-w-lg">
          <CardHeader>
            <div className="mb-2 grid size-12 place-items-center rounded-xl bg-primary/10 text-cyan-200">
              <ShieldCheck className="size-5" />
            </div>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Update your password before continuing to the portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <FormField label="Current password" name="currentPassword" type="password" register={form.register} error={form.formState.errors.currentPassword?.message} />
              <FormField label="New password" name="newPassword" type="password" register={form.register} error={form.formState.errors.newPassword?.message} />
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Updating...' : 'Update password'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
