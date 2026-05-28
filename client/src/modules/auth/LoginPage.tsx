import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LockKeyhole, LogIn } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/forms/FormField';
import { authApi } from '@/services/api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { loginSchema, type LoginFormValues } from '@/schemas/auth.schemas';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const abortControllerRef = useRef<AbortController | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      userId: '',
      password: ''
    }
  });

  const mutation = useMutation({
    mutationFn: (values: LoginFormValues) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      return authApi.login(values, abortControllerRef.current.signal);
    },
    onSuccess: (session) => {
      setSession(session);
      toast.success('Welcome back', { description: 'Session established securely.' });
      const target = session.user.forcePasswordReset ? '/change-password' : ((location.state as { from?: Location } | null)?.from?.pathname ?? '/dashboard');
      navigate(target, { replace: true });
    },
    onError: (error) => {
      if (error.name !== 'CanceledError') {
        toast.error(error.message);
      }
    }
  });

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const submit = (values: LoginFormValues) => {
    if (mutation.isPending) {
      return;
    }

    mutation.mutate(values);
  };

  return (
    <AuthLayout>
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
        <Card className="gradient-border">
          <CardHeader>
            <div className="mb-2 grid size-12 place-items-center rounded-xl bg-primary/10 text-cyan-200">
              <LockKeyhole className="size-5" />
            </div>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your IITIL Portal user ID and password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
              <FormField label="User ID" name="userId" register={form.register} error={form.formState.errors.userId?.message} placeholder="admin" />
              <FormField label="Password" name="password" type="password" register={form.register} error={form.formState.errors.password?.message} placeholder="Password" />
              <Button className="mt-2" type="submit" disabled={mutation.isPending}>
                <LogIn className="size-4" />
                {mutation.isPending ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
            <div className="mt-5 flex items-center justify-between text-sm">
              <Link className="cursor-pointer text-cyan-200 hover:text-cyan-100" to="/forgot-password">
                Forgot password?
              </Link>
              <span className="text-muted-foreground">Dark mode only</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthLayout>
  );
}
