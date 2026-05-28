import { TimerReset } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthLayout } from './AuthLayout';

export function SessionExpiredPage() {
  return (
    <AuthLayout>
      <Card className="gradient-border">
        <CardHeader>
          <div className="mb-2 grid size-12 place-items-center rounded-xl bg-amber-400/10 text-amber-200">
            <TimerReset className="size-5" />
          </div>
          <CardTitle>Session expired</CardTitle>
          <CardDescription>Your secure session has ended. Sign in again to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/login">Return to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
