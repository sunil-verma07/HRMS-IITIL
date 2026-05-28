import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/forms/FormField';
import { authApi } from '@/services/api/auth.api';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/schemas/auth.schemas';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { userId: '' }
  });
  const mutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: () => toast.success('Password reset request accepted')
  });

  return (
    <AuthLayout>
      <Card className="gradient-border">
        <CardHeader>
          <div className="mb-2 grid size-12 place-items-center rounded-xl bg-primary/10 text-cyan-200">
            <MailCheck className="size-5" />
          </div>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>Request a reset token for your portal account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values.userId))}>
            <FormField label="User ID" name="userId" register={form.register} error={form.formState.errors.userId?.message} />
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Submitting...' : 'Submit request'}</Button>
          </form>
          <Link className="mt-5 inline-block text-sm text-cyan-200" to="/login">Back to sign in</Link>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
