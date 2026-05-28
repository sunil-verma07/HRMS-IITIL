import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/forms/FormField';
import { authApi } from '@/services/api/auth.api';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/schemas/auth.schemas';
import { AuthLayout } from './AuthLayout';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: '', newPassword: '' }
  });
  const mutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      toast.success('Password reset successful');
      navigate('/login', { replace: true });
    }
  });

  return (
    <AuthLayout>
      <Card className="gradient-border">
        <CardHeader>
          <div className="mb-2 grid size-12 place-items-center rounded-xl bg-primary/10 text-cyan-200">
            <KeyRound className="size-5" />
          </div>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Enter the reset token and your new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <FormField label="Reset token" name="token" register={form.register} error={form.formState.errors.token?.message} />
            <FormField label="New password" name="newPassword" type="password" register={form.register} error={form.formState.errors.newPassword?.message} />
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Resetting...' : 'Reset password'}</Button>
          </form>
          <Link className="mt-5 inline-block text-sm text-cyan-200" to="/login">Back to sign in</Link>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
