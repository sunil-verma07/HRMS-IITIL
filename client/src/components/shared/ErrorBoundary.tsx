import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="glass-panel max-w-lg rounded-2xl p-8 text-center">
          <div className="mx-auto mb-5 grid size-12 place-items-center rounded-xl bg-rose-400/10 text-rose-200">
            <AlertTriangle className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Something broke inside the portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">Refresh the page and try again. The UI failed before a request could complete.</p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            <RotateCcw className="size-4" />
            Reload
          </Button>
        </div>
      </main>
    );
  }
}
